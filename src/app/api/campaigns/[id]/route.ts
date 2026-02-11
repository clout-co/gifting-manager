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
  if (v === undefined) return undefined
  if (v === null) return null
  if (typeof v === 'string') {
    const t = v.trim()
    return t ? t : null
  }
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

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await requireAuthContext(request)
  if (!auth.ok) {
    return auth.response
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
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

  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const expectedBrand = String(request.nextUrl.searchParams.get('brand') || '')
    .trim()
    .toUpperCase()
  if (expectedBrand && !isAllowedBrand(expectedBrand)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('campaigns')
    .select(`
      *,
      influencer:influencers(*),
      staff:staffs(*)
    `)
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const brand = String(data.brand || '').trim().toUpperCase()
  if (!isAllowedBrand(brand)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }
  if (expectedBrand && brand !== expectedBrand) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const allowedBrands = auth.context.brands
  if (allowedBrands.length > 0 && !allowedBrands.includes(brand)) {
    return NextResponse.json({ error: 'Forbidden brand' }, { status: 403 })
  }

  return NextResponse.json({ campaign: data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const auth = await requireAuthContext(request, { requireWrite: true })
  if (!auth.ok) {
    return auth.response
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
  }

  // E2E/dev-only stub (never enabled in production builds).
  if (isE2E()) {
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
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

  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  let body: any = null
  try {
    body = await request.json()
  } catch {
    body = null
  }

  const { data: existing, error: fetchError } = await supabase
    .from('campaigns')
    .select('id, brand, item_code, product_cost, sale_date, post_date, desired_post_date, desired_post_start, desired_post_end, is_international_shipping, shipping_country, international_shipping_cost')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const brand = String(existing.brand || '').trim().toUpperCase()
  if (!isAllowedBrand(brand)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }

  const allowedBrands = auth.context.brands
  if (allowedBrands.length > 0 && !allowedBrands.includes(brand)) {
    return NextResponse.json({ error: 'Forbidden brand' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}

  // Apply fields that are present in the payload (partial update).
  const keys = [
    'influencer_id',
    'item_quantity',
    'sale_date',
    'desired_post_date',
    'desired_post_start',
    'desired_post_end',
    'agreed_date',
    'offered_amount',
    'agreed_amount',
    'status',
    'post_date',
    'post_url',
    'likes',
    'comments',
    'consideration_comment',
    'engagement_date',
    'number_of_times',
    'is_international_shipping',
    'shipping_country',
    'international_shipping_cost',
    'notes',
    'staff_id',
  ] as const

  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(body || {}, k)) {
      updates[k] = normalizeNullish(body?.[k])
    }
  }

  // shipping_cost is fixed and must not drift.
  updates.shipping_cost = 800

  // If item_code is present in the payload, treat it as a "campaign save" and enforce Product Master resolution.
  const itemCodeIsProvided = Object.prototype.hasOwnProperty.call(body || {}, 'item_code')
  if (itemCodeIsProvided) {
    const rawItemCode = String(body?.item_code || '').trim()
    if (!rawItemCode) {
      return NextResponse.json({ error: 'item_code is required' }, { status: 400 })
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

    updates.item_code = resolved.product.product_code
    updates.product_cost = productCost
  }

  // Keep post_status consistent (server-side source of truth).
  const nextSale = String(updates.sale_date ?? existing.sale_date ?? '').trim()
  const nextPost = String(updates.post_date ?? existing.post_date ?? '').trim()
  const nextDesired = String(updates.desired_post_date ?? existing.desired_post_date ?? '').trim()
  const nextDesiredStart = String(updates.desired_post_start ?? existing.desired_post_start ?? '').trim()
  const nextDesiredEnd = String(updates.desired_post_end ?? existing.desired_post_end ?? '').trim()

  const nextPostStatus = calculatePostStatus(nextSale, nextPost, nextDesired, nextDesiredStart, nextDesiredEnd)
  updates.post_status = normalizeNullish(nextPostStatus)

  // Normalize numeric fields if provided.
  if (Object.prototype.hasOwnProperty.call(updates, 'item_quantity')) {
    updates.item_quantity = parsePositiveInt(updates.item_quantity, 1)
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'offered_amount')) {
    updates.offered_amount = parseNonNegativeNumber(updates.offered_amount, 0)
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'agreed_amount')) {
    updates.agreed_amount = parseNonNegativeNumber(updates.agreed_amount, 0)
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'likes')) {
    updates.likes = parseNonNegativeNumber(updates.likes, 0)
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'comments')) {
    updates.comments = parseNonNegativeNumber(updates.comments, 0)
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'consideration_comment')) {
    updates.consideration_comment = parseNonNegativeNumber(updates.consideration_comment, 0)
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'number_of_times')) {
    updates.number_of_times = parsePositiveInt(updates.number_of_times, 1)
  }

  // International shipping normalization.
  const nextIsInternational = Object.prototype.hasOwnProperty.call(updates, 'is_international_shipping')
    ? Boolean(updates.is_international_shipping)
    : Boolean(existing.is_international_shipping)

  if (!nextIsInternational) {
    updates.is_international_shipping = false
    updates.shipping_country = null
    updates.international_shipping_cost = null
  } else {
    const sc = String(updates.shipping_country ?? existing.shipping_country ?? '').trim()
    const ic = parseNonNegativeNumber(updates.international_shipping_cost ?? existing.international_shipping_cost, 0)
    if (!sc) {
      return NextResponse.json({ error: 'shipping_country is required for international shipping' }, { status: 400 })
    }
    if (ic <= 0) {
      return NextResponse.json({ error: 'international_shipping_cost is required for international shipping' }, { status: 400 })
    }
    updates.is_international_shipping = true
    updates.shipping_country = sc
    updates.international_shipping_cost = ic
  }

  const { error: updateError } = await supabase
    .from('campaigns')
    .update(updates)
    .eq('id', id)
    .eq('brand', brand)

  if (updateError) {
    const msg = updateError.message || 'DB update failed'
    const isRls = msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('rls')
    return NextResponse.json({ error: msg }, { status: isRls ? 403 : 500 })
  }

  {
    const old_values: Record<string, unknown> = {}
    const new_values: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(updates)) {
      old_values[k] = (existing as any)[k]
      new_values[k] = v
    }

    void writeAuditLog(request, {
      action: 'campaign.update',
      entity_type: 'campaign',
      entity_key: String(id),
      old_values,
      new_values,
      metadata: {
        app: 'gifting-app',
        brand,
      },
    })
  }

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
