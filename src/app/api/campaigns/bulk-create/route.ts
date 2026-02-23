import { NextRequest, NextResponse } from 'next/server'
import { requireAuthContext } from '@/lib/auth/request-context'
import { createSupabaseForRequest } from '@/lib/supabase/request-client'
import { writeAuditLog } from '@/lib/clout-audit'
import {
  getRequestIdFromHeaders,
  postDecisionEvents,
} from '@/lib/clout-master'
import { buildCampaignDecisionEvent } from '@/lib/decision-events'
import {
  canonicalizeProductCode,
  buildProductSearchQueries,
} from '@/lib/product-code'

type AllowedBrand = 'TL' | 'BE' | 'AM'

function isAllowedBrand(value: unknown): value is AllowedBrand {
  return value === 'TL' || value === 'BE' || value === 'AM'
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

type MasterProduct = {
  id: string
  product_code: string
  cost: number | null
  sale_date: string | null
}

function getSsoToken(request: NextRequest): string | null {
  return (
    request.cookies.get('__Host-clout_token')?.value ||
    request.cookies.get('clout_token')?.value ||
    null
  )
}

async function getProductMasterBaseUrl(request: NextRequest): Promise<string | null> {
  const envUrl = process.env.PRODUCT_MASTER_URL || process.env.NEXT_PUBLIC_PRODUCT_MASTER_URL
  if (envUrl) return envUrl

  const cloutAuthUrl = process.env.CLOUT_AUTH_URL || process.env.NEXT_PUBLIC_CLOUT_AUTH_URL
  if (!cloutAuthUrl) return null

  try {
    const token = getSsoToken(request)
    const res = await fetch(`${cloutAuthUrl}/api/master/apps`, {
      headers: token ? { Cookie: `clout_token=${token}` } : {},
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    const apps = Array.isArray(data?.apps) ? data.apps : []
    const pm = apps.find((a: { slug?: string }) => a.slug === 'product-master')
    return pm?.url || null
  } catch {
    return null
  }
}

async function resolveProduct(
  request: NextRequest,
  brand: AllowedBrand,
  itemCode: string
): Promise<{ ok: true; product: MasterProduct } | { ok: false; error: string }> {
  const qCanon = canonicalizeProductCode(itemCode)
  if (!qCanon) return { ok: false, error: 'item_code is required' }

  const token = getSsoToken(request)
  if (!token) return { ok: false, error: 'Not authenticated' }

  const baseUrl = await getProductMasterBaseUrl(request)
  if (!baseUrl) return { ok: false, error: 'Product Master URL not found' }

  const queries = buildProductSearchQueries(itemCode)

  for (const q of queries) {
    const url = new URL('/api/products', baseUrl)
    url.searchParams.set('brand', brand)
    url.searchParams.set('q', q)

    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Cookie: `__session=${token}; __Host-clout_token=${token}; clout_token=${token}`,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        redirect: 'manual',
        cache: 'no-store',
      })

      if (res.status >= 300 && res.status < 400) {
        return { ok: false, error: 'Product Master auth redirect' }
      }

      const data = await res.json().catch(() => null)
      if (!res.ok) continue

      const rows: unknown[] =
        Array.isArray(data?.data) ? data.data
        : Array.isArray(data?.products) ? data.products
        : Array.isArray(data?.items) ? data.items
        : []

      const products: MasterProduct[] = rows
        .map((p: unknown) => {
          const row = p && typeof p === 'object' ? (p as Record<string, unknown>) : {}
          const productCode = String(row.product_code || '').trim()
          const rawCost = row.cost
          const cost = rawCost === null || rawCost === undefined || rawCost === '' ? null : Number(rawCost)
          return {
            id: String(row.id || productCode),
            product_code: productCode,
            cost: Number.isFinite(cost as number) ? (cost as number) : null,
            sale_date:
              typeof row.sales_date === 'string' ? row.sales_date.slice(0, 10)
              : typeof row.sale_date === 'string' ? row.sale_date.slice(0, 10)
              : typeof row.release_date === 'string' ? row.release_date.slice(0, 10)
              : null,
          }
        })
        .filter((p) => Boolean(p.product_code))

      const exact = products.find((p) => canonicalizeProductCode(p.product_code) === qCanon)
      if (exact) return { ok: true, product: exact }
    } catch {
      continue
    }
  }

  return { ok: false, error: `品番 "${itemCode}" が見つかりません` }
}

/**
 * POST /api/campaigns/bulk-create
 * Body: { brand: string, items: { influencer_id, item_code, agreed_amount, status, staff_id, sale_date, shipping_cost }[] }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuthContext(request, { requireWrite: true })
  if (!auth.ok) return auth.response

  if (!supabaseUrl || (!supabaseAnonKey && !supabaseServiceRoleKey)) {
    return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
  }

  let body: any = null
  try {
    body = await request.json()
  } catch {
    body = null
  }

  const brand = String(body?.brand || '').trim().toUpperCase()
  if (!isAllowedBrand(brand)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }

  const allowedBrands = auth.context.brands
  if (allowedBrands.length > 0 && !allowedBrands.includes(brand)) {
    return NextResponse.json({ error: 'Forbidden brand' }, { status: 403 })
  }

  const items: unknown[] = Array.isArray(body?.items) ? body.items : []
  if (items.length === 0) {
    return NextResponse.json({ error: 'items is required (non-empty array)' }, { status: 400 })
  }
  if (items.length > 20) {
    return NextResponse.json({ error: 'Too many items (max 20)' }, { status: 400 })
  }

  let supabaseCtx: ReturnType<typeof createSupabaseForRequest>
  try {
    supabaseCtx = createSupabaseForRequest({
      request,
      supabaseUrl,
      supabaseAnonKey,
      supabaseServiceRoleKey,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to init DB client' },
      { status: 500 }
    )
  }
  if (supabaseCtx.configWarning && !supabaseCtx.usingServiceRole && !supabaseCtx.hasSupabaseAccessToken) {
    return NextResponse.json(
      { error: 'Supabase write auth is misconfigured', reason: supabaseCtx.configWarning },
      { status: 503 }
    )
  }
  const supabase = supabaseCtx.client

  const payloads: Record<string, unknown>[] = []
  const errors: { index: number; error: string }[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item || typeof item !== 'object') {
      errors.push({ index: i, error: 'Invalid item' })
      continue
    }
    const row = item as Record<string, unknown>

    const influencerId = String(row.influencer_id || '').trim()
    if (!influencerId) {
      errors.push({ index: i, error: 'influencer_id is required' })
      continue
    }

    const rawItemCode = String(row.item_code || '').trim()
    if (!rawItemCode) {
      errors.push({ index: i, error: 'item_code is required' })
      continue
    }

    const resolved = await resolveProduct(request, brand, rawItemCode)
    if (!resolved.ok) {
      errors.push({ index: i, error: resolved.error })
      continue
    }

    const productCost = typeof resolved.product.cost === 'number' ? Math.round(resolved.product.cost) : 0
    const saleDate = String(row.sale_date || '').trim() || (resolved.product.sale_date || '')
    const agreedAmount = Math.max(0, Number(row.agreed_amount) || 0)
    const status = String(row.status || 'pending')
    const staffId = String(row.staff_id || '').trim() || null
    const shippingCost = Number(row.shipping_cost) >= 0 ? Number(row.shipping_cost) : 800
    const today = new Date().toISOString().split('T')[0]

    payloads.push({
      brand,
      influencer_id: influencerId,
      item_code: resolved.product.product_code,
      item_quantity: 1,
      sale_date: saleDate || null,
      agreed_date: today,
      offered_amount: 0,
      agreed_amount: agreedAmount,
      status,
      post_status: null,
      post_date: null,
      post_url: null,
      likes: 0,
      comments: 0,
      consideration_comment: 0,
      engagement_date: null,
      number_of_times: 1,
      product_cost: productCost,
      shipping_cost: shippingCost,
      is_international_shipping: false,
      shipping_country: null,
      international_shipping_cost: null,
      notes: null,
      staff_id: staffId,
    })
  }

  if (payloads.length === 0) {
    return NextResponse.json({ ok: false, created: [], errors }, { status: errors.length > 0 ? 400 : 200 })
  }

  const { data, error } = await supabase
    .from('campaigns')
    .insert(payloads)
    .select('id, brand, influencer_id, item_code, agreed_amount, product_cost, shipping_cost, staff_id')

  if (error) {
    const msg = error.message || 'DB insert failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const createdIds = (data || []).map((d: { id: string }) => d.id)

  // Fire-and-forget: audit logs + decision events
  const requestIdBase = getRequestIdFromHeaders(request.headers) || `gifting-bulk-create-${Date.now()}`
  for (const row of data || []) {
    void writeAuditLog(request, {
      action: 'campaign.bulk_create',
      entity_type: 'campaign',
      entity_key: String(row.id),
      old_values: null,
      new_values: row,
      metadata: { app: 'gifting-app' },
    })

    const event = buildCampaignDecisionEvent({
      requestId: `${requestIdBase}:campaign:bulk-create:${row.id}`,
      operation: 'campaign_created',
      brand: brand as AllowedBrand,
      campaignId: String(row.id),
      productCode: String(row.item_code || ''),
      staffId: typeof row.staff_id === 'string' ? row.staff_id : null,
      metrics: {
        item_quantity: 1,
        offered_amount: 0,
        agreed_amount: Number(row.agreed_amount || 0),
        product_cost: Number(row.product_cost || 0),
        shipping_cost: Number(row.shipping_cost || 0),
        international_shipping_cost: 0,
      },
      payload: {
        status: 'pending',
        is_international_shipping: false,
      },
    })
    void postDecisionEvents(request, [event])
  }

  return NextResponse.json(
    { ok: true, created: createdIds, errors },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
