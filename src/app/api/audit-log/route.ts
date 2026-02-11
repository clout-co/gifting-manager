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
 * GET /api/audit-log?brand=TL
 *
 * Returns activity logs derived from campaigns + influencers for the
 * specified brand.  Previously the client page ran these queries
 * directly against Supabase (anon key), which breaks under SSO-only
 * auth because Supabase RLS requires `auth.role() = 'authenticated'`.
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

  // Fetch user_profiles, campaigns (with joins), and influencers in parallel
  const [usersResult, campaignsResult, influencersResult] = await Promise.all([
    supabase.from('user_profiles').select('id, email, display_name'),
    supabase
      .from('campaigns')
      .select(`
        id, brand, item_code, status, created_at, updated_at,
        created_by, updated_by,
        influencer:influencers(insta_name),
        creator:user_profiles!campaigns_created_by_fkey(id, email, display_name),
        updater:user_profiles!campaigns_updated_by_fkey(id, email, display_name)
      `)
      .eq('brand', brand)
      .order('updated_at', { ascending: false })
      .limit(200),
    supabase
      .from('influencers')
      .select('id, insta_name, tiktok_name, created_at')
      .eq('brand', brand)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (campaignsResult.error) {
    return NextResponse.json(
      { error: campaignsResult.error.message || 'Failed to fetch campaigns' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      users: Array.isArray(usersResult.data) ? usersResult.data : [],
      campaigns: Array.isArray(campaignsResult.data) ? campaignsResult.data : [],
      influencers: Array.isArray(influencersResult.data) ? influencersResult.data : [],
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
