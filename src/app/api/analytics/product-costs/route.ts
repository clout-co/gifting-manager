import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseForRequest } from '@/lib/supabase/request-client'
import { getAllowedBrands } from '@/lib/api-guard'
import { requireAuthContext } from '@/lib/auth/request-context'

export const dynamic = 'force-dynamic'

type BrandCode = 'TL' | 'BE' | 'AM'

function canonicalizeProductCode(value: string): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
}

function parseDateParam(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return 0
}

type CampaignRow = {
  item_code: string | null
  agreed_amount: number | null
  product_cost: number | null
  item_quantity: number | null
  shipping_cost: number | string | null
  is_international_shipping: boolean | null
  international_shipping_cost: number | string | null
  created_at: string | null
}

function calcCampaignCost(row: CampaignRow): {
  total: number
  breakdown: {
    influencer: number
    product: number
    shipping: number
    intl: number
  }
} {
  const influencer = Math.max(0, toNumber(row.agreed_amount))
  const unitCost = Math.max(0, toNumber(row.product_cost))
  const qty = Math.max(1, Math.floor(toNumber(row.item_quantity) || 1))

  const shippingRaw = row.shipping_cost
  const shipping =
    typeof shippingRaw === 'number'
      ? shippingRaw
      : shippingRaw === null || shippingRaw === undefined
        ? 800
        : Number.isFinite(Number(shippingRaw))
          ? Number(shippingRaw)
          : 800

  const intl = row.is_international_shipping
    ? Math.max(0, toNumber(row.international_shipping_cost))
    : 0

  const product = unitCost * qty
  const total = influencer + product + shipping + intl

  return {
    total: Number.isFinite(total) ? total : 0,
    breakdown: {
      influencer,
      product,
      shipping,
      intl,
    },
  }
}

/**
 * 品番別のGiftコスト集計API
 *
 * GET /api/analytics/product-costs?brand=TL&startDate=2026-01-01&endDate=2026-01-31
 *
 * Notes:
 * - GGCRM側のコスト定義（Analytics page）に合わせる:
 *   agreed_amount + product_cost*qty + shipping_cost + international_shipping_cost
 * - startDate/endDate は campaigns.created_at を基準にフィルタ（既存Analyticsと同じ）
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuthContext(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const brandParam = String(searchParams.get('brand') || '')
    .trim()
    .toUpperCase()
  const startDateRaw = searchParams.get('startDate')
  const endDateRaw = searchParams.get('endDate')

  if (brandParam !== 'TL' && brandParam !== 'BE' && brandParam !== 'AM') {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }

  const allowedBrands = getAllowedBrands(request).map((b) => String(b).toUpperCase())
  if (allowedBrands.length > 0 && !allowedBrands.includes(brandParam)) {
    return NextResponse.json({ error: 'Forbidden brand' }, { status: 403 })
  }

  const startDate = parseDateParam(startDateRaw)
  const endDate = parseDateParam(endDateRaw)

  if (startDateRaw && !startDate) {
    return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 })
  }
  if (endDateRaw && !endDate) {
    return NextResponse.json({ error: 'Invalid endDate' }, { status: 400 })
  }

  const { client: supabase } = createSupabaseForRequest({
    request,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  })

  let query = supabase
    .from('campaigns')
    .select(
      'item_code, agreed_amount, product_cost, item_quantity, shipping_cost, is_international_shipping, international_shipping_cost, created_at'
    )
    .eq('brand', brandParam)

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString())
  }

  if (endDate) {
    const end = new Date(endDate)
    // If it's a YYYY-MM-DD style input, make it inclusive for the whole day.
    if (endDateRaw && endDateRaw.length <= 10) {
      end.setHours(23, 59, 59, 999)
    }
    query = query.lte('created_at', end.toISOString())
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const items = new Map<
    string,
    {
      product_code: string
      campaigns: number
      total_cost: number
      influencer_cost: number
      product_cost: number
      shipping_cost: number
      international_shipping_cost: number
    }
  >()

  const totals = {
    campaigns: 0,
    total_cost: 0,
    influencer_cost: 0,
    product_cost: 0,
    shipping_cost: 0,
    international_shipping_cost: 0,
  }

  for (const row of (data || []) as CampaignRow[]) {
    const codeRaw = row.item_code
    if (!codeRaw) continue
    const product_code = canonicalizeProductCode(codeRaw)
    if (!product_code) continue

    const { total, breakdown } = calcCampaignCost(row)

    totals.campaigns += 1
    totals.total_cost += total
    totals.influencer_cost += breakdown.influencer
    totals.product_cost += breakdown.product
    totals.shipping_cost += breakdown.shipping
    totals.international_shipping_cost += breakdown.intl

    const existing =
      items.get(product_code) || {
        product_code,
        campaigns: 0,
        total_cost: 0,
        influencer_cost: 0,
        product_cost: 0,
        shipping_cost: 0,
        international_shipping_cost: 0,
      }

    existing.campaigns += 1
    existing.total_cost += total
    existing.influencer_cost += breakdown.influencer
    existing.product_cost += breakdown.product
    existing.shipping_cost += breakdown.shipping
    existing.international_shipping_cost += breakdown.intl
    items.set(product_code, existing)
  }

  const list = Array.from(items.values())
    .sort((a, b) => b.total_cost - a.total_cost)
    .map((row) => ({
      ...row,
      total_cost: Math.round(row.total_cost),
      influencer_cost: Math.round(row.influencer_cost),
      product_cost: Math.round(row.product_cost),
      shipping_cost: Math.round(row.shipping_cost),
      international_shipping_cost: Math.round(row.international_shipping_cost),
    }))

  return NextResponse.json({
    success: true,
    brand: brandParam as BrandCode,
    range: {
      startDate: startDateRaw || null,
      endDate: endDateRaw || null,
    },
    totals: {
      campaigns: totals.campaigns,
      total_cost: Math.round(totals.total_cost),
      influencer_cost: Math.round(totals.influencer_cost),
      product_cost: Math.round(totals.product_cost),
      shipping_cost: Math.round(totals.shipping_cost),
      international_shipping_cost: Math.round(totals.international_shipping_cost),
    },
    items: list,
  })
}
