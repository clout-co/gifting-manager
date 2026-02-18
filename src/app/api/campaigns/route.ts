import { NextRequest, NextResponse } from 'next/server'
import { calculatePostStatus } from '@/lib/post-status'
import { writeAuditLog } from '@/lib/clout-audit'
import { requireAuthContext } from '@/lib/auth/request-context'
import { createSupabaseForRequest } from '@/lib/supabase/request-client'
import {
  fetchCloutMaster,
  getRequestIdFromHeaders,
  postDecisionEvents,
} from '@/lib/clout-master'
import { buildCampaignDecisionEvent } from '@/lib/decision-events'
type AllowedBrand = 'TL' | 'BE' | 'AM'

type MasterProduct = {
  id: string
  product_code: string
  title: string | null
  sku: string | null
  image_url: string | null
  cost: number | null
  sale_date: string | null
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
    if (!trimmed || trimmed.length < 2) return
    if (queries.includes(trimmed)) return
    queries.push(trimmed)
  }

  push(upper)

  const m = upper.match(/^([A-Z]{2})(\d{3,})$/)
  if (m) push(`${m[1]}-${m[2]}`)

  const m2 = upper.match(/^([A-Z]{2})-(\d{3,})$/)
  if (m2) push(`${m2[1]}${m2[2]}`)

  // Product Master stores style-level codes (e.g. TF25084) but campaigns
  // may store full SKU-level codes (e.g. TF25084MDBR00001).
  // Try progressively shorter prefixes to find the style-level product.
  const canon = upper.replace(/[^0-9A-Z]/g, '')
  // Pattern: 2-letter prefix + digits = style code (e.g. TF25084)
  const styleMatch = canon.match(/^([A-Z]{2}\d{3,5})/)
  if (styleMatch) {
    push(styleMatch[1])
    push(`${styleMatch[1].slice(0, 2)}-${styleMatch[1].slice(2)}`)
  }

  return queries
}

// ---------- Product Master resolution (direct upstream call) ----------
// Resolves the Product Master base URL from the Clout Dashboard App Registry
// using the Vercel OIDC token, then calls the upstream Product Master API
// directly with the user's SSO token. This avoids self-referential fetch
// which is unreliable in Vercel serverless environments.

type MasterApp = { id: string; url?: string }

const PRODUCT_MASTER_CACHE_TTL_MS = 5 * 60_000
let cachedProductMasterUrl: string | null = null
let cachedProductMasterAt = 0

async function getProductMasterBaseUrl(request: NextRequest): Promise<string> {
  const now = Date.now()
  if (cachedProductMasterUrl && now - cachedProductMasterAt < PRODUCT_MASTER_CACHE_TTL_MS) {
    return cachedProductMasterUrl
  }

  try {
    const response = await fetchCloutMaster(
      request,
      '/api/master/apps',
      { cache: 'no-store', signal: AbortSignal.timeout(5000) }
    )
    if (response.ok) {
      const data = (await response.json().catch(() => null)) as { apps?: MasterApp[] } | null
      const apps = Array.isArray(data?.apps) ? (data.apps as MasterApp[]) : []
      const master = apps.find((a) => a && a.id === 'master' && typeof a.url === 'string' && a.url)
      const url = String(master?.url || '').trim()
      if (url) {
        cachedProductMasterUrl = url
        cachedProductMasterAt = now
        return url
      }
    }
  } catch {
    // fallback below
  }

  const fromEnv = String(process.env.PRODUCT_MASTER_URL || process.env.NEXT_PUBLIC_PRODUCT_MASTER_URL || '').trim()
  if (fromEnv) {
    cachedProductMasterUrl = fromEnv
    cachedProductMasterAt = now
    return fromEnv
  }

  return ''
}

function getSsoToken(request: NextRequest): string | null {
  const bearer = String(request.headers.get('authorization') || '').trim()
  if (bearer.toLowerCase().startsWith('bearer ')) {
    const t = bearer.slice(7).trim()
    if (t) return t
  }
  return (
    request.cookies.get('__Host-clout_token')?.value ||
    request.cookies.get('clout_token')?.value ||
    null
  )
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

  const token = getSsoToken(request)
  if (!token) {
    return { ok: false, status: 401, error: 'Not authenticated' }
  }

  const baseUrl = await getProductMasterBaseUrl(request)
  if (!baseUrl) {
    return { ok: false, status: 500, error: 'Missing Product Master base URL' }
  }

  const queries = buildProductSearchQueries(itemCode)

  for (const q of queries) {
    const upstreamUrl = new URL('/api/products', baseUrl)
    upstreamUrl.searchParams.set('brand', brand)
    upstreamUrl.searchParams.set('q', q)

    try {
      const res = await fetch(upstreamUrl.toString(), {
        method: 'GET',
        headers: {
          Cookie: `__session=${token}; __Host-clout_token=${token}; clout_token=${token}`,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        redirect: 'manual',
        cache: 'no-store',
      })

      // If SSO fails, Product Master may redirect to /sign-in.
      if (res.status >= 300 && res.status < 400) {
        return { ok: false, status: 401, error: 'Product Master auth redirect' }
      }

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = data && typeof data.error === 'string' ? data.error : `Product Master error: ${res.status}`
        const reason = data && typeof data.reason === 'string' ? data.reason : undefined
        return { ok: false, status: res.status, error: msg, reason }
      }

      // Product Master returns { success: true, data: [...] }
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
            title: row.title ? String(row.title) : null,
            sku: row.sku ? String(row.sku) : null,
            image_url: row.image_url ? String(row.image_url) : null,
            cost: Number.isFinite(cost as number) ? (cost as number) : null,
            sale_date:
              typeof row.sales_date === 'string'
                ? row.sales_date.slice(0, 10)
                : typeof row.sale_date === 'string'
                  ? row.sale_date.slice(0, 10)
                  : typeof row.release_date === 'string'
                    ? row.release_date.slice(0, 10)
                    : null,
          }
        })
        .filter((p) => Boolean(p.product_code))

      // Exact match first, then prefix match (style code is a prefix of full SKU).
      // e.g. Product Master has "TF25084" but campaign stores "TF25084MDBR00001"
      const exact = products.find((p) => canonicalizeProductCode(p.product_code) === qCanon)
      if (exact) return { ok: true, product: exact }

      const prefixMatch = products.find((p) => {
        const pCanon = canonicalizeProductCode(p.product_code)
        return pCanon.length >= 5 && qCanon.startsWith(pCanon)
      })
      if (prefixMatch) return { ok: true, product: prefixMatch }
    } catch (error) {
      return { ok: false, status: 502, error: error instanceof Error ? error.message : 'Unknown error' }
    }
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

function normalizeMasterSaleDate(value: unknown): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
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

  const rawSaleDate = String(body?.sale_date || '').trim()

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

  // E2E/dev-only stub (never enabled in production builds).
  // Keep this before Product Master resolution because bypass mode does not mint
  // a real SSO token for upstream auth.
  if (isE2E()) {
    const id = `e2e-${Date.now()}`
    return NextResponse.json(
      { ok: true, id },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const resolved = await resolveProductFromMaster(request, { brand, itemCode: rawItemCode })
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error, reason: resolved.reason },
      { status: resolved.status }
    )
  }

  const saleDate = rawSaleDate || normalizeMasterSaleDate(resolved.product.sale_date)
  if (!saleDate) {
    return NextResponse.json({ error: 'sale_date is required' }, { status: 400 })
  }

  // Allow cost=0 when Product Master has no cost registered.
  // Users can save campaigns and fix the cost later via Product Master.
  const productCost = typeof resolved.product.cost === 'number' ? Math.round(resolved.product.cost) : 0

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

  const { data, error } = await supabase
    .from('campaigns')
    .insert([payload])
    .select(`
      *,
      influencer:influencers(id, insta_name, tiktok_name, insta_url, tiktok_url),
      staff:staffs(id, name)
    `)
    .single()

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

    const requestIdBase = getRequestIdFromHeaders(request.headers) || `gifting-campaign-${Date.now()}`
    const decisionEvent = buildCampaignDecisionEvent({
      requestId: `${requestIdBase}:campaign:create`,
      operation: 'campaign_created',
      brand: brand as AllowedBrand,
      campaignId: String(data.id),
      productCode: payload.item_code,
      staffId: typeof payload.staff_id === 'string' ? payload.staff_id : null,
      metrics: {
        item_quantity: Number(payload.item_quantity || 0),
        offered_amount: Number(payload.offered_amount || 0),
        agreed_amount: Number(payload.agreed_amount || 0),
        product_cost: Number(payload.product_cost || 0),
        shipping_cost: Number(payload.shipping_cost || 0),
        international_shipping_cost: Number(payload.international_shipping_cost || 0),
      },
      payload: {
        status: payload.status,
        is_international_shipping: Boolean(payload.is_international_shipping),
      },
    })
    void postDecisionEvents(request, [decisionEvent])
  }

  return NextResponse.json(
    { ok: true, id: data?.id, campaign: data || null },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function DELETE(request: NextRequest) {
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

  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((v: unknown) => typeof v === 'string' && v) : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids is required (non-empty array)' }, { status: 400 })
  }

  const brand = String(body?.brand || '').trim().toUpperCase()
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
        error: 'Supabase write auth is misconfigured',
        reason: supabaseCtx.configWarning,
      },
      { status: 503 }
    )
  }
  const supabase = supabaseCtx.client

  const { error: deleteError } = await supabase
    .from('campaigns')
    .delete()
    .in('id', ids)
    .eq('brand', brand)

  if (deleteError) {
    const msg = deleteError.message || 'DB delete failed'
    const isRls = msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('rls')
    return NextResponse.json({ error: msg }, { status: isRls ? 403 : 500 })
  }

  void writeAuditLog(request, {
    action: 'campaign.bulk_delete',
    entity_type: 'campaign',
    entity_key: ids.join(','),
    old_values: { ids, brand },
    new_values: null,
    metadata: {
      app: 'gifting-app',
      brand,
      count: ids.length,
    },
  })

  {
    const requestIdBase = getRequestIdFromHeaders(request.headers) || `gifting-campaign-${Date.now()}`
    const decisionEvent = buildCampaignDecisionEvent({
      requestId: `${requestIdBase}:campaign:bulk-delete`,
      operation: 'campaign_bulk_deleted',
      brand: brand as AllowedBrand,
      campaignId: null,
      metrics: {
        deleted_count: ids.length,
      },
      payload: {
        deleted_ids: ids.slice(0, 30),
      },
    })
    void postDecisionEvents(request, [decisionEvent])
  }

  return NextResponse.json({ ok: true, deleted: ids.length }, { headers: { 'Cache-Control': 'no-store' } })
}
