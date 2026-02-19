import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getAllowedBrands } from '@/lib/api-guard'
import { requireAuthContext } from '@/lib/auth/request-context'

export const dynamic = 'force-dynamic'

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

  const { searchParams } = new URL(request.url)
  const brandParam = String(searchParams.get('brand') || '')
    .trim()
    .toUpperCase()

  if (brandParam !== 'TL' && brandParam !== 'BE' && brandParam !== 'AM') {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }

  const allowedBrands = getAllowedBrands(request).map((b) => String(b).toUpperCase())
  if (allowedBrands.length > 0 && !allowedBrands.includes(brandParam)) {
    return NextResponse.json({ error: 'Forbidden brand' }, { status: 403 })
  }

  const supabase = createServerClient()

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
