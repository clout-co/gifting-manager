import { NextRequest, NextResponse } from 'next/server'
import { requireAuthContext } from '@/lib/auth/request-context'
import { createSupabaseForRequest } from '@/lib/supabase/request-client'
import { getRequestIdFromHeaders, postDecisionEvents } from '@/lib/clout-master'
import { buildInfluencerDecisionEvent } from '@/lib/decision-events'
import {
  buildDuplicateInfluencerMessage,
  influencerHasExactHandle,
  type SelectableInfluencer,
} from '@/lib/influencer-search'

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

function isDuplicateKeyError(message: string): boolean {
  return (
    message.includes('duplicate key') ||
    message.includes('unique constraint') ||
    message.includes('idx_influencers_insta_name')
  )
}

async function findExistingInfluencerByHandle(
  supabase: ReturnType<typeof createSupabaseForRequest>['client'],
  handles: { insta_name: string | null; tiktok_name: string | null }
): Promise<SelectableInfluencer | null> {
  const candidates = [handles.insta_name, handles.tiktok_name].filter(Boolean) as string[]
  if (candidates.length === 0) return null

  const orFilters = candidates.flatMap((candidate) => [
    `insta_name.eq.${candidate}`,
    `tiktok_name.eq.${candidate}`,
  ])

  const { data, error } = await supabase
    .from('influencers')
    .select('id, brand, insta_name, insta_url, tiktok_name, tiktok_url')
    .or(orFilters.join(','))
    .limit(10)

  if (error || !Array.isArray(data)) {
    return null
  }

  return (
    data.find(
      (item) =>
        influencerHasExactHandle(item as SelectableInfluencer, handles.insta_name || '') ||
        influencerHasExactHandle(item as SelectableInfluencer, handles.tiktok_name || '')
    ) || null
  ) as SelectableInfluencer | null
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthContext(request)
  if (!auth.ok) {
    return auth.response
  }

  if (!supabaseUrl || (!supabaseAnonKey && !supabaseServiceRoleKey)) {
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
    .from('influencers')
    .select('*')
    .eq('brand', brand)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch influencers' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { influencers: Array.isArray(data) ? data : [] },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthContext(request, { requireWrite: true })
  if (!auth.ok) {
    return auth.response
  }

  if (isE2E()) {
    return NextResponse.json(
      {
        influencer: {
          id: 'e2e-influencer-created',
          insta_name: 'e2e_created',
          insta_url: null,
          tiktok_name: null,
          tiktok_url: null,
          brand: 'TL',
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  if (!supabaseUrl || (!supabaseAnonKey && !supabaseServiceRoleKey)) {
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
        error: 'Supabase write auth is misconfigured',
        reason: supabaseCtx.configWarning,
      },
      { status: 503 }
    )
  }
  const supabase = supabaseCtx.client

  let body: Record<string, unknown> | null = null
  try {
    body = (await request.json()) as Record<string, unknown>
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

  const insta_name = normalizeNullishText(body?.insta_name)
  const insta_url = normalizeNullishText(body?.insta_url)
  const tiktok_name = normalizeNullishText(body?.tiktok_name)
  const tiktok_url = normalizeNullishText(body?.tiktok_url)

  if (!insta_name && !tiktok_name) {
    return NextResponse.json(
      { error: 'Instagram名またはTikTok名のどちらかを入力してください' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('influencers')
    .insert([{ insta_name, insta_url, tiktok_name, tiktok_url, brand }])
    .select('*')
    .single()

  if (error) {
    if (isDuplicateKeyError(error.message || '')) {
      const existing = await findExistingInfluencerByHandle(supabase, { insta_name, tiktok_name })
      if (existing) {
        return NextResponse.json(
          {
            error: buildDuplicateInfluencerMessage(String(existing.brand || ''), brand),
            code: 'influencer_already_exists',
            existing_influencer: existing,
            same_brand: String(existing.brand || '').toUpperCase() === brand,
          },
          { status: 409 }
        )
      }
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create influencer' },
      { status: 400 }
    )
  }

  {
    const requestIdBase = getRequestIdFromHeaders(request.headers) || `gifting-influencer-${Date.now()}`
    const decisionEvent = buildInfluencerDecisionEvent({
      requestId: `${requestIdBase}:influencer:create`,
      operation: 'influencer_created',
      brand: brand as AllowedBrand,
      influencerId: String(data.id),
      metrics: {
        has_instagram_name: insta_name ? 1 : 0,
        has_tiktok_name: tiktok_name ? 1 : 0,
      },
    })
    void postDecisionEvents(request, [decisionEvent])
  }

  return NextResponse.json({ influencer: data }, { headers: { 'Cache-Control': 'no-store' } })
}
