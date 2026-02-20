import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseForRequest } from '@/lib/supabase/request-client'
import { requireAuthContext } from '@/lib/auth/request-context'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * 品番別ギフティング数量API
 *
 * GET /api/analytics/product-quantities?brand=TL
 *
 * Returns: { items: [{ product_code: "TF25084", total_quantity: 15 }, ...] }
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuthContext(request)
  if (!auth.ok) return auth.response

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const brandParam = String(searchParams.get('brand') || '')
    .trim()
    .toUpperCase()

  if (brandParam !== 'TL' && brandParam !== 'BE' && brandParam !== 'AM') {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }

  const allowedBrands = auth.context.brands.map((b: string) => String(b).toUpperCase())
  if (allowedBrands.length > 0 && !allowedBrands.includes(brandParam)) {
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

  const { data, error } = await supabase
    .from('campaigns')
    .select('item_code, item_quantity')
    .eq('brand', brandParam)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 品番別に item_quantity を合計
  const map = new Map<string, number>()
  for (const row of data || []) {
    const code = String(row.item_code || '')
      .trim()
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '')
    if (!code) continue
    const qty = Math.max(0, Math.floor(Number(row.item_quantity) || 0))
    map.set(code, (map.get(code) || 0) + qty)
  }

  const items = Array.from(map.entries())
    .map(([product_code, total_quantity]) => ({ product_code, total_quantity }))
    .sort((a, b) => b.total_quantity - a.total_quantity)

  return NextResponse.json({
    success: true,
    brand: brandParam,
    items,
  })
}
