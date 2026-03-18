import { NextRequest, NextResponse } from 'next/server'
import { requireAuthContext } from '@/lib/auth/request-context'
import { createSupabaseForRequest } from '@/lib/supabase/request-client'
import { getRequestIdFromHeaders, postDecisionEvents } from '@/lib/clout-master'
import { buildInfluencerDecisionEvent } from '@/lib/decision-events'

type AllowedBrand = 'TL' | 'BE' | 'AM'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function isE2E(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_E2E === 'true'
}

function isAllowedBrand(value: unknown): value is AllowedBrand {
  return value === 'TL' || value === 'BE' || value === 'AM'
}

function normalizeNullishText(v: unknown): string | null {
  const s = String(v || '').trim()
  return s ? s : null
}

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await requireAuthContext(request)
  if (!auth.ok) {
    return auth.response
  }

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

  if (isE2E()) {
    const rows = [
      {
        id: 'e2e-influencer-tl',
        brand: 'TL',
        insta_name: 'e2e_insta',
        insta_url: null,
        tiktok_name: null,
        tiktok_url: null,
        real_name: null,
        postal_code: null,
        address: null,
        phone: null,
        email: null,
        bank_name: null,
        bank_branch: null,
        bank_code: null,
        branch_code: null,
        account_type: null,
        account_number: null,
        account_holder: null,
        invoice_registration_number: null,
        invoice_acknowledged: false,
        form_token: null,
        form_token_expires_at: null,
        form_token_used_at: null,
        created_at: '2026-02-06T00:00:00.000Z',
        updated_at: '2026-02-06T00:00:00.000Z',
      },
      {
        id: 'e2e-influencer-be',
        brand: 'BE',
        insta_name: 'e2e_insta_be',
        insta_url: null,
        tiktok_name: null,
        tiktok_url: null,
        real_name: null,
        postal_code: null,
        address: null,
        phone: null,
        email: null,
        bank_name: null,
        bank_branch: null,
        bank_code: null,
        branch_code: null,
        account_type: null,
        account_number: null,
        account_holder: null,
        invoice_registration_number: null,
        invoice_acknowledged: false,
        form_token: null,
        form_token_expires_at: null,
        form_token_used_at: null,
        created_at: '2026-02-06T00:00:00.000Z',
        updated_at: '2026-02-06T00:00:00.000Z',
      },
      {
        id: 'e2e-influencer-am',
        brand: 'AM',
        insta_name: 'e2e_insta_am',
        insta_url: null,
        tiktok_name: null,
        tiktok_url: null,
        real_name: null,
        postal_code: null,
        address: null,
        phone: null,
        email: null,
        bank_name: null,
        bank_branch: null,
        bank_code: null,
        branch_code: null,
        account_type: null,
        account_number: null,
        account_holder: null,
        invoice_registration_number: null,
        invoice_acknowledged: false,
        form_token: null,
        form_token_expires_at: null,
        form_token_used_at: null,
        created_at: '2026-02-06T00:00:00.000Z',
        updated_at: '2026-02-06T00:00:00.000Z',
      },
    ] as const

    const row = rows.find((item) => item.id === id)
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (expectedBrand && row.brand !== expectedBrand) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ influencer: row }, { headers: { 'Cache-Control': 'no-store' } })
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
    .from('influencers')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const brand = String(data.brand || '').toUpperCase()
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

  return NextResponse.json({ influencer: data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const auth = await requireAuthContext(request, { requireWrite: true })
  if (!auth.ok) {
    return auth.response
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

  const { data: existing, error: existingError } = await supabase
    .from('influencers')
    .select('id, brand, insta_name, tiktok_name')
    .eq('id', id)
    .single()

  if (existingError || !existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const brand = String(existing.brand || '').toUpperCase()
  if (!isAllowedBrand(brand)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }

  const allowedBrands = auth.context.brands
  if (allowedBrands.length > 0 && !allowedBrands.includes(brand)) {
    return NextResponse.json({ error: 'Forbidden brand' }, { status: 403 })
  }

  let body: Record<string, unknown> | null = null
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    body = null
  }

  const updates: Record<string, unknown> = {}
  if (body && 'insta_name' in body) updates.insta_name = normalizeNullishText(body.insta_name)
  if (body && 'insta_url' in body) updates.insta_url = normalizeNullishText(body.insta_url)
  if (body && 'tiktok_name' in body) updates.tiktok_name = normalizeNullishText(body.tiktok_name)
  if (body && 'tiktok_url' in body) updates.tiktok_url = normalizeNullishText(body.tiktok_url)

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
  }

  const nextInsta = (Object.prototype.hasOwnProperty.call(updates, 'insta_name')
    ? updates.insta_name
    : existing.insta_name) as string | null
  const nextTiktok = (Object.prototype.hasOwnProperty.call(updates, 'tiktok_name')
    ? updates.tiktok_name
    : existing.tiktok_name) as string | null

  if (!nextInsta && !nextTiktok) {
    return NextResponse.json(
      { error: 'Instagram名またはTikTok名のどちらかを入力してください' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('influencers')
    .update(updates)
    .eq('id', id)
    .eq('brand', brand)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to update influencer' },
      { status: 400 }
    )
  }

  {
    const requestIdBase = getRequestIdFromHeaders(request.headers) || `gifting-influencer-${Date.now()}`
    const decisionEvent = buildInfluencerDecisionEvent({
      requestId: `${requestIdBase}:influencer:update`,
      operation: 'influencer_updated',
      brand: brand as AllowedBrand,
      influencerId: String(id),
      metrics: {
        changed_fields: Object.keys(updates).length,
      },
      payload: {
        updated_fields: Object.keys(updates),
      },
    })
    void postDecisionEvents(request, [decisionEvent])
  }

  return NextResponse.json({ influencer: data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const auth = await requireAuthContext(request, { requireWrite: true })
  if (!auth.ok) {
    return auth.response
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

  const { data: existing, error: existingError } = await supabase
    .from('influencers')
    .select('id, brand')
    .eq('id', id)
    .single()

  if (existingError || !existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const brand = String(existing.brand || '').toUpperCase()
  if (!isAllowedBrand(brand)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }

  const allowedBrands = auth.context.brands
  if (allowedBrands.length > 0 && !allowedBrands.includes(brand)) {
    return NextResponse.json({ error: 'Forbidden brand' }, { status: 403 })
  }

  const { error } = await supabase
    .from('influencers')
    .delete()
    .eq('id', id)
    .eq('brand', brand)

  if (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete influencer' },
      { status: 400 }
    )
  }

  {
    const requestIdBase = getRequestIdFromHeaders(request.headers) || `gifting-influencer-${Date.now()}`
    const decisionEvent = buildInfluencerDecisionEvent({
      requestId: `${requestIdBase}:influencer:delete`,
      operation: 'influencer_deleted',
      brand: brand as AllowedBrand,
      influencerId: String(id),
      metrics: {
        deleted_count: 1,
      },
    })
    void postDecisionEvents(request, [decisionEvent])
  }

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
