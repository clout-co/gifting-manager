import { NextRequest, NextResponse } from 'next/server'
import { requireAuthContext } from '@/lib/auth/request-context'
import { createSupabaseForRequest } from '@/lib/supabase/request-client'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * GET /api/admin/stats
 *
 * Returns system-wide statistics for the admin dashboard.
 * No brand filter — admin sees everything.
 *
 * This BFF route uses SERVICE_ROLE to bypass RLS.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuthContext(request)
  if (!auth.ok) {
    return auth.response
  }

  // Admin check: only admin permission level can access this endpoint
  if (auth.context.permissionLevel !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })
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
      { error: 'Supabase read auth is misconfigured', reason: supabaseCtx.configWarning },
      { status: 503 }
    )
  }
  const supabase = supabaseCtx.client

  const [campaignsResult, influencersResult, usersResult] = await Promise.all([
    supabase
      .from('campaigns')
      .select(`
        id, brand, status, created_at, updated_at,
        created_by, updated_by,
        creator:user_profiles!campaigns_created_by_fkey(email, display_name),
        updater:user_profiles!campaigns_updated_by_fkey(email, display_name),
        influencer:influencers(insta_name)
      `),
    supabase.from('influencers').select('id'),
    supabase.from('user_profiles').select('id, email, display_name'),
  ])

  if (campaignsResult.error) {
    return NextResponse.json(
      { error: campaignsResult.error.message || 'Failed to fetch campaigns' },
      { status: 500 }
    )
  }

  const campaigns = Array.isArray(campaignsResult.data) ? campaignsResult.data : []
  const influencers = Array.isArray(influencersResult.data) ? influencersResult.data : []
  const users = Array.isArray(usersResult.data) ? usersResult.data : []

  return NextResponse.json(
    { campaigns, influencers, users },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
