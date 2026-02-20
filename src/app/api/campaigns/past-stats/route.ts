import { NextRequest, NextResponse } from 'next/server'
import { requireAuthContext } from '@/lib/auth/request-context'
import { createSupabaseForRequest } from '@/lib/supabase/request-client'

type AllowedBrand = 'TL' | 'BE' | 'AM'

function isAllowedBrand(value: unknown): value is AllowedBrand {
  return value === 'TL' || value === 'BE' || value === 'AM'
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * GET /api/campaigns/past-stats?brand=TL&influencer_id=xxx
 *
 * Returns past average stats for an influencer within a brand.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuthContext(request)
  if (!auth.ok) return auth.response

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
  }

  const brand = String(request.nextUrl.searchParams.get('brand') || '').trim().toUpperCase()
  if (!isAllowedBrand(brand)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }

  const allowedBrands = auth.context.brands
  if (allowedBrands.length > 0 && !allowedBrands.includes(brand)) {
    return NextResponse.json({ error: 'Forbidden brand' }, { status: 403 })
  }

  const influencerId = String(request.nextUrl.searchParams.get('influencer_id') || '').trim()
  if (!influencerId) {
    return NextResponse.json({ error: 'influencer_id is required' }, { status: 400 })
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
      { error: 'Supabase read auth is misconfigured', reason: supabaseCtx.configWarning },
      { status: 503 }
    )
  }
  const supabase = supabaseCtx.client

  // agreed_amount がある案件のみ（平均計算用）
  const { data, error } = await supabase
    .from('campaigns')
    .select('offered_amount, agreed_amount, likes, comments')
    .eq('influencer_id', influencerId)
    .eq('brand', brand)
    .not('agreed_amount', 'is', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 全案件カウント（numberOfTimes 用 — agreed_amount 有無を問わない）
  const { count: totalAllCampaigns, error: countError } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('influencer_id', influencerId)
    .eq('brand', brand)

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 })
  }

  if ((!data || data.length === 0) && (totalAllCampaigns ?? 0) === 0) {
    return NextResponse.json({ stats: null }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const avgOffered = data && data.length > 0
    ? data.reduce((sum: number, c: any) => sum + (c.offered_amount || 0), 0) / data.length : 0
  const avgAgreed = data && data.length > 0
    ? data.reduce((sum: number, c: any) => sum + (c.agreed_amount || 0), 0) / data.length : 0
  const avgLikes = data && data.length > 0
    ? data.reduce((sum: number, c: any) => sum + (c.likes || 0), 0) / data.length : 0

  return NextResponse.json({
    stats: {
      avgOfferedAmount: Math.round(avgOffered),
      avgAgreedAmount: Math.round(avgAgreed),
      avgLikes: Math.round(avgLikes),
      totalCampaigns: data?.length ?? 0,
      totalAllCampaigns: totalAllCampaigns ?? 0,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
