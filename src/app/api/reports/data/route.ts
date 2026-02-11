import { NextRequest, NextResponse } from 'next/server'
import { requireAuthContext } from '@/lib/auth/request-context'
import { createSupabaseForRequest } from '@/lib/supabase/request-client'

type AllowedBrand = 'TL' | 'BE' | 'AM'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function isAllowedBrand(value: unknown): value is AllowedBrand {
  return value === 'TL' || value === 'BE' || value === 'AM'
}

/**
 * GET /api/reports/data?brand=TL&dateFrom=2025-01-01&dateTo=2025-12-31&items=ABC123,DEF456
 *
 * Returns campaigns + influencers for report generation.
 * Replaces direct client-side Supabase queries in the reports page.
 *
 * This BFF route uses SERVICE_ROLE to bypass RLS.
 */
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
      { error: 'Supabase read auth is misconfigured', reason: supabaseCtx.configWarning },
      { status: 503 }
    )
  }
  const supabase = supabaseCtx.client

  // Build campaigns query with optional filters
  const dateFrom = String(request.nextUrl.searchParams.get('dateFrom') || '').trim()
  const dateTo = String(request.nextUrl.searchParams.get('dateTo') || '').trim()
  const itemsRaw = String(request.nextUrl.searchParams.get('items') || '').trim()
  const items = itemsRaw ? itemsRaw.split(',').map((s) => s.trim()).filter(Boolean) : []

  let campaignsQuery = supabase
    .from('campaigns')
    .select('*, influencer:influencers(*)')
    .eq('brand', brand)

  if (dateFrom) {
    campaignsQuery = campaignsQuery.gte('created_at', dateFrom)
  }
  if (dateTo) {
    campaignsQuery = campaignsQuery.lte('created_at', dateTo + 'T23:59:59')
  }
  if (items.length > 0) {
    campaignsQuery = campaignsQuery.in('item_code', items)
  }

  const [campaignsResult, influencersResult] = await Promise.all([
    campaignsQuery,
    supabase.from('influencers').select('id, insta_name, tiktok_name').eq('brand', brand),
  ])

  if (campaignsResult.error) {
    return NextResponse.json(
      { error: campaignsResult.error.message || 'Failed to fetch campaigns' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      campaigns: Array.isArray(campaignsResult.data) ? campaignsResult.data : [],
      influencers: Array.isArray(influencersResult.data) ? influencersResult.data : [],
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
