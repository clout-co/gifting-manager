import { NextRequest, NextResponse } from 'next/server'
import { calculatePostStatus } from '@/lib/post-status'
import { writeAuditLog } from '@/lib/clout-audit'
import { requireAuthContext } from '@/lib/auth/request-context'
import { createSupabaseForRequest } from '@/lib/supabase/request-client'

type AllowedBrand = 'TL' | 'BE' | 'AM'

type MasterProduct = {
  id: string
  product_code: string
  title: string | null
  sku: string | null
  image_url: string | null
  cost: number | null
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function isE2E(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_E2E === 'true'
}

const toHalfWidth = (value: string) => {
  return String(value || '')
    .replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ')
}

const normalizeProductCodeInput = (value: string) => toHalfWidth(value).trim()

const canonicalizeProductCode = (value: string) =>
  normalizeProductCodeInput(value)
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')

const buildProductSearchQueries = (value: string): string[] => {
  const raw = normalizeProductCodeInput(value)
  const compact = raw.replace(/\s+/g, '')
  const upper = compact.toUpperCase()

  const queries: string[] = []
  const push = (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    if (queries.includes(trimmed)) return
    queries.push(trimmed)
  }

  push(upper)

  const m = upper.match(/^([A-Z]{2})(\d{3,})$/)
  if (m) push(`${m[1]}-${m[2]}`)

  const m2 = upper.match(/^([A-Z]{2})-(\d{3,})$/)
  if (m2) push(`${m2[1]}${m2[2]}`)

  return queries
}

async function resolveProductFromMaster(
  request: NextRequest,
  args: { brand: AllowedBrand; itemCode: string }
): Promise<
  | { ok: true; product: MasterProduct }
  | { ok: false; status: number; error: string; reason?: string }
> {
  const { brand, itemCode } = args

  const qCanon = canonicalizeProductCode(itemCode)
  if (!qCanon) {
    return { ok: false, status: 400, error: 'item_code is required' }
  }

  const base = new URL(request.url)
  base.pathname = '/api/master/products'

  const cookie = request.headers.get('cookie') || ''
  const queries = buildProductSearchQueries(itemCode)

  for (const q of queries) {
    const url = new URL(base.toString())
    url.searchParams.set('brand', brand)
    url.searchParams.set('q', q)
    url.searchParams.set('limit', '50')

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        // Forward cookies so the nested call can authenticate to Product Master.
        Cookie: cookie,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      const msg =
        data && typeof data.error === 'string'
          ? data.error
          : `Product Master error: ${res.status}`
      const reason =
        data && typeof data.reason === 'string'
          ? data.reason
          : undefined
      return { ok: false, status: res.status, error: msg, reason }
    }

    const products: MasterProduct[] = Array.isArray(data?.products) ? (data.products as MasterProduct[]) : []
    const exact = products.find((p) => canonicalizeProductCode(p.product_code) === qCanon) || null
    if (exact) return { ok: true, product: exact }
  }

  return { ok: false, status: 400, error: '品番がProduct Master に見つかりません' }
}

function normalizeNullish(v: unknown): unknown {
  if (v === undefined) return null
  if (typeof v === 'string' && v.trim() === '') return null
  return v
}

function parseNonNegativeNumber(value: unknown, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, n)
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(1, Math.floor(n))
}

function isAllowedBrand(value: unknown): value is AllowedBrand {
  return value === 'TL' || value === 'BE' || value === 'AM'
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthContext(request)
  if (!auth.ok) {
    return auth.response
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
  }

  const brand = String(request.nextUrl.searchParams.get('brand') || '')
    .trim()
    .toUpperCase()
  if (!isAllowedBrand(brand)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }

  const allowedBrands = auth.context.brands
  if (allowedBrands.length > 0 && !allowedBrands.includes(brand)) {
    return NextResponse.json({ error: 'Forbidden brand' }, { status: 403 })
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
      {
        error: 'Supabase read auth is misconfigured',
        reason: supabaseCtx.configWarning,
      },
      { status: 503 }
    )
  }
  const supabase = supabaseCtx.client

  const { data, error } = await supabase
    .from('campaigns')
    .select(`
      *,
      influencer:influencers(id, insta_name, tiktok_name, insta_url, tiktok_url),
      staff:staffs(id, name)
    `)
    .eq('brand', brand)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to fetch campaigns' }, { status: 500 })
  }

  return NextResponse.json(
    { campaigns: Array.isArray(data) ? data : [] },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthContext(request, { requireWrite: true })
  if (!auth.ok) {
    return auth.response
  }

  if (!supabaseUrl || !supabaseAnonKey) {
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

  const influencerId = String(body?.influencer_id || '').trim()
  if (!influencerId) {
    return NextResponse.json({ error: 'influencer_id is required' }, { status: 400 })
  }

  const rawItemCode = String(body?.item_code || '').trim()
  if (!rawItemCode) {
    return NextResponse.json({ error: 'item_code is required' }, { status: 400 })
  }

  const saleDate = String(body?.sale_date || '').trim()
  if (!saleDate) {
    return NextResponse.json({ error: 'sale_date is required' }, { status: 400 })
  }

  const itemQuantity = parsePositiveInt(body?.item_quantity, 1)

  const isInternational = Boolean(body?.is_international_shipping)
  const shippingCountry = isInternational ? String(body?.shipping_country || '').trim() : ''
  const intlShippingCost = isInternational ? parseNonNegativeNumber(body?.international_shipping_cost, 0) : 0
  if (isInternational) {
    if (!shippingCountry) {
      return NextResponse.json({ error: 'shipping_country is required for international shipping' }, { status: 400 })
    }
    if (intlShippingCost <= 0) {
      return NextResponse.json({ error: 'international_shipping_cost is required for international shipping' }, { status: 400 })
    }
  }

  const resolved = await resolveProductFromMaster(request, { brand, itemCode: rawItemCode })
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error, reason: resolved.reason },
      { status: resolved.status }
    )
  }

  const productCost = typeof resolved.product.cost === 'number' ? Math.round(resolved.product.cost) : 0
  if (productCost <= 0) {
    return NextResponse.json({ error: 'Product Masterに原価が未登録です' }, { status: 400 })
  }

  const desiredPostDate = String(body?.desired_post_date || '').trim()
  const desiredPostStart = String(body?.desired_post_start || '').trim()
  const desiredPostEnd = String(body?.desired_post_end || '').trim()
  const postDate = String(body?.post_date || '').trim()
  const postStatus = calculatePostStatus(
    saleDate,
    postDate,
    desiredPostDate,
    desiredPostStart,
    desiredPostEnd
  )

  const payload = {
    brand,
    influencer_id: influencerId,
    item_code: resolved.product.product_code,
    item_quantity: itemQuantity,
    sale_date: normalizeNullish(saleDate),
    desired_post_date: normalizeNullish(desiredPostDate),
    desired_post_start: normalizeNullish(desiredPostStart),
    desired_post_end: normalizeNullish(desiredPostEnd),
    agreed_date: normalizeNullish(String(body?.agreed_date || '').trim()),
    offered_amount: parseNonNegativeNumber(body?.offered_amount, 0),
    agreed_amount: parseNonNegativeNumber(body?.agreed_amount, 0),
    status: String(body?.status || 'pending'),
    post_status: normalizeNullish(postStatus),
    post_date: normalizeNullish(postDate),
    post_url: normalizeNullish(String(body?.post_url || '').trim()),
    likes: parseNonNegativeNumber(body?.likes, 0),
    comments: parseNonNegativeNumber(body?.comments, 0),
    consideration_comment: parseNonNegativeNumber(body?.consideration_comment, 0),
    engagement_date: normalizeNullish(String(body?.engagement_date || '').trim()),
    number_of_times: parsePositiveInt(body?.number_of_times, 1),
    product_cost: productCost,
    // Fixed to keep cost math consistent across the app
    shipping_cost: 800,
    is_international_shipping: isInternational,
    shipping_country: isInternational ? shippingCountry : null,
    international_shipping_cost: isInternational ? intlShippingCost : null,
    notes: normalizeNullish(String(body?.notes || '')),
    staff_id: normalizeNullish(String(body?.staff_id || '')),
  }

  // E2E/dev-only stub (never enabled in production builds).
  // Keeps E2E deterministic even when Supabase RLS blocks anon writes in certain environments.
  if (isE2E()) {
    const id = `e2e-${Date.now()}`
    return NextResponse.json(
      { ok: true, id },
      { headers: { 'Cache-Control': 'no-store' } }
    )
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
      {
        error: 'Supabase write auth is misconfigured',
        reason: supabaseCtx.configWarning,
      },
      { status: 503 }
    )
  }
  const supabase = supabaseCtx.client

  const { data, error } = await supabase.from('campaigns').insert([payload]).select('id').single()

  if (error) {
    const msg = error.message || 'DB insert failed'
    const isRls = msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('rls')
    return NextResponse.json(
      { error: msg },
      { status: isRls ? 403 : 500 }
    )
  }

  if (data?.id) {
    void writeAuditLog(request, {
      action: 'campaign.create',
      entity_type: 'campaign',
      entity_key: String(data.id),
      old_values: null,
      new_values: {
        id: data.id,
        brand,
        influencer_id: influencerId,
        item_code: rawItemCode,
        item_quantity: itemQuantity,
        sale_date: saleDate,
        product_cost: productCost,
        staff_id: payload.staff_id,
        is_international_shipping: isInternational,
      },
      metadata: {
        app: 'gifting-app',
      },
    })
  }

  return NextResponse.json(
    { ok: true, id: data?.id },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
