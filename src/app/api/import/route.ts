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
 * POST /api/import/check-duplicates
 *
 * Checks for duplicate influencer + item_code combinations in the database.
 * Used by the import page to warn about existing data before importing.
 *
 * POST /api/import/find-or-create-influencer
 *
 * Finds an existing influencer by insta_name or tiktok_name within a brand,
 * or creates a new one if not found. Used during import to avoid direct
 * client-side Supabase access.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuthContext(request)
  if (!auth.ok) {
    return auth.response
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
  }

  let body: Record<string, unknown> | null = null
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    body = null
  }

  const action = String(body?.action || '').trim()

  if (action === 'check-duplicates') {
    return handleCheckDuplicates(request, auth.context, body)
  }
  if (action === 'find-or-create-influencer') {
    return handleFindOrCreateInfluencer(request, auth.context, body)
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCheckDuplicates(
  request: NextRequest,
  authCtx: { brands: AllowedBrand[] },
  body: Record<string, unknown> | null
) {
  const brand = String(body?.brand || '').trim().toUpperCase()
  if (!isAllowedBrand(brand)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }

  if (authCtx.brands.length > 0 && !authCtx.brands.includes(brand)) {
    return NextResponse.json({ error: 'Forbidden brand' }, { status: 403 })
  }

  const rows = body?.rows
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'rows is required' }, { status: 400 })
  }

  // Limit to 500 rows per request
  if (rows.length > 500) {
    return NextResponse.json({ error: 'Too many rows (max 500)' }, { status: 400 })
  }

  let supabaseCtx: ReturnType<typeof createSupabaseForRequest>
  try {
    supabaseCtx = createSupabaseForRequest({
      request,
      supabaseUrl: supabaseUrl!,
      supabaseAnonKey: supabaseAnonKey!,
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

  const duplicates: { row: number; name: string; existingCampaigns: number }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as { insta_name?: string; tiktok_name?: string; item_code?: string }
    const instaName = String(row?.insta_name || '').trim()
    const tiktokName = String(row?.tiktok_name || '').trim()
    const itemCode = String(row?.item_code || '').trim()
    const name = instaName || tiktokName
    if (!name) continue

    // Find influencer by name within brand
    const influencerRes = instaName
      ? await supabase.from('influencers').select('id').eq('insta_name', instaName).eq('brand', brand).single()
      : await supabase.from('influencers').select('id').eq('tiktok_name', tiktokName).eq('brand', brand).single()

    if (influencerRes.data?.id) {
      const { count } = await supabase
        .from('campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('influencer_id', influencerRes.data.id)
        .eq('brand', brand)
        .eq('item_code', itemCode)

      if (count && count > 0) {
        duplicates.push({
          row: i + 1,
          name,
          existingCampaigns: count,
        })
      }
    }
  }

  return NextResponse.json({ duplicates }, { headers: { 'Cache-Control': 'no-store' } })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleFindOrCreateInfluencer(
  request: NextRequest,
  authCtx: { brands: AllowedBrand[] },
  body: Record<string, unknown> | null
) {
  const brand = String(body?.brand || '').trim().toUpperCase()
  if (!isAllowedBrand(brand)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }

  if (authCtx.brands.length > 0 && !authCtx.brands.includes(brand)) {
    return NextResponse.json({ error: 'Forbidden brand' }, { status: 403 })
  }

  const instaName = String(body?.insta_name || '').trim() || null
  const instaUrl = String(body?.insta_url || '').trim() || null
  const tiktokName = String(body?.tiktok_name || '').trim() || null
  const tiktokUrl = String(body?.tiktok_url || '').trim() || null

  if (!instaName && !tiktokName) {
    return NextResponse.json({ error: 'insta_name or tiktok_name required' }, { status: 400 })
  }

  let supabaseCtx: ReturnType<typeof createSupabaseForRequest>
  try {
    supabaseCtx = createSupabaseForRequest({
      request,
      supabaseUrl: supabaseUrl!,
      supabaseAnonKey: supabaseAnonKey!,
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
      { error: 'Supabase write auth is misconfigured', reason: supabaseCtx.configWarning },
      { status: 503 }
    )
  }
  const supabase = supabaseCtx.client

  // Try to find existing
  const searchRes = instaName
    ? await supabase.from('influencers').select('id').eq('insta_name', instaName).eq('brand', brand).single()
    : await supabase.from('influencers').select('id').eq('tiktok_name', tiktokName!).eq('brand', brand).single()

  if (searchRes.data?.id) {
    return NextResponse.json(
      { influencer: { id: searchRes.data.id }, created: false },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  // Create new
  const { data, error } = await supabase
    .from('influencers')
    .insert([{ insta_name: instaName, insta_url: instaUrl, tiktok_name: tiktokName, tiktok_url: tiktokUrl, brand }])
    .select('id')
    .single()

  if (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to create influencer' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { influencer: { id: data.id }, created: true },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
