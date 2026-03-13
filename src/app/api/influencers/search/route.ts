import { NextRequest, NextResponse } from 'next/server'
import { requireAuthContext } from '@/lib/auth/request-context'
import { createSupabaseForRequest } from '@/lib/supabase/request-client'
import {
  dedupeSelectableInfluencers,
  influencerMatchesQuery,
  sortSelectableInfluencers,
  type SelectableInfluencer,
} from '@/lib/influencer-search'

type AllowedBrand = 'TL' | 'BE' | 'AM'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function isAllowedBrand(value: unknown): value is AllowedBrand {
  return value === 'TL' || value === 'BE' || value === 'AM'
}

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return 20
  return Math.min(Math.max(parsed, 1), 50)
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

  const q = String(request.nextUrl.searchParams.get('q') || '').trim()
  if (q.length < 2) {
    return NextResponse.json({ influencers: [] }, { headers: { 'Cache-Control': 'no-store' } })
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
  const limit = parseLimit(request.nextUrl.searchParams.get('limit'))

  // Cross-brand selection is limited to handles/URLs only and used from campaign registration
  // so existing global influencer rows remain selectable without exposing personal/bank details.
  const { data, error } = await supabase
    .from('influencers')
    .select('id, brand, insta_name, insta_url, tiktok_name, tiktok_url')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to search influencers' },
      { status: 500 }
    )
  }

  const filtered = dedupeSelectableInfluencers(
    (Array.isArray(data) ? data : []).filter((item): item is SelectableInfluencer =>
      Boolean(item?.id) && influencerMatchesQuery(item as SelectableInfluencer, q)
    )
  )

  const influencers = sortSelectableInfluencers(filtered, brand, q).slice(0, limit)

  return NextResponse.json({ influencers }, { headers: { 'Cache-Control': 'no-store' } })
}
