import { NextRequest, NextResponse } from 'next/server'
import { requireAuthContext } from '@/lib/auth/request-context'
import { createSupabaseForRequest } from '@/lib/supabase/request-client'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function isAllowedBrand(value: unknown): value is 'TL' | 'BE' | 'AM' {
  return value === 'TL' || value === 'BE' || value === 'AM'
}

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

  const selectedItem = request.nextUrl.searchParams.get('item') || 'all'
  const dateRange = request.nextUrl.searchParams.get('range') || 'all'

  let query = supabase
    .from('campaigns')
    .select('status, agreed_amount, likes, comments, influencer_id, item_code, created_at')
    .eq('brand', brand)

  if (selectedItem !== 'all') {
    query = query.eq('item_code', selectedItem)
  }

  const startDate = getStartDateFromRange(dateRange)
  if (startDate) {
    query = query.gte('created_at', startDate.toISOString())
  }

  const { data: campaigns, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to fetch KPIs' }, { status: 500 })
  }

  const rows = (campaigns as Record<string, unknown>[]) || []

  const totalSpent = rows.reduce((sum, c) => sum + (Number(c.agreed_amount) || 0), 0)
  const totalLikes = rows.reduce((sum, c) => sum + (Number(c.likes) || 0), 0)
  const totalComments = rows.reduce((sum, c) => sum + (Number(c.comments) || 0), 0)
  const pendingCount = rows.filter((c) => c.status === 'pending').length
  const agreedCount = rows.filter((c) => c.status === 'agree').length
  const totalInfluencers = new Set(rows.map((c) => c.influencer_id).filter(Boolean)).size

  return NextResponse.json(
    {
      totalCampaigns: rows.length,
      totalInfluencers,
      totalSpent,
      totalLikes,
      totalComments,
      pendingCount,
      agreedCount,
      costPerLike: totalLikes > 0 ? totalSpent / totalLikes : 0,
    },
    { headers: { 'Cache-Control': 'private, max-age=60' } }
  )
}

function getStartDateFromRange(dateRange: string): Date | null {
  if (dateRange === 'all') return null
  const now = new Date()
  switch (dateRange) {
    case '7d':
      return new Date(now.setDate(now.getDate() - 7))
    case '30d':
      return new Date(now.setDate(now.getDate() - 30))
    case '90d':
      return new Date(now.setDate(now.getDate() - 90))
    case '1y':
      return new Date(now.setFullYear(now.getFullYear() - 1))
    default:
      return null
  }
}
