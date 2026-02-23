import { NextRequest, NextResponse } from 'next/server'
import { requireAuthContext } from '@/lib/auth/request-context'
import { createSupabaseForRequest } from '@/lib/supabase/request-client'

type AllowedBrand = 'TL' | 'BE' | 'AM'

function isAllowedBrand(value: unknown): value is AllowedBrand {
  return value === 'TL' || value === 'BE' || value === 'AM'
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * POST /api/campaigns/bulk-update
 *
 * Body: { brand: string, updates: { id: string, likes?: number, comments?: number, input_date?: string }[] }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuthContext(request, { requireWrite: true })
  if (!auth.ok) return auth.response

  if (!supabaseUrl || (!supabaseAnonKey && !supabaseServiceRoleKey)) {
    return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
  }

  let body: any = null
  try {
    body = await request.json()
  } catch {
    body = null
  }

  const brand = String(body?.brand || '').trim().toUpperCase()
  if (!isAllowedBrand(brand)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }

  const allowedBrands = auth.context.brands
  if (allowedBrands.length > 0 && !allowedBrands.includes(brand)) {
    return NextResponse.json({ error: 'Forbidden brand' }, { status: 403 })
  }

  const updates: unknown[] = Array.isArray(body?.updates) ? body.updates : []
  if (updates.length === 0) {
    return NextResponse.json({ error: 'updates is required (non-empty array)' }, { status: 400 })
  }
  if (updates.length > 200) {
    return NextResponse.json({ error: 'Too many updates (max 200)' }, { status: 400 })
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
      { error: 'Supabase write auth is misconfigured', reason: supabaseCtx.configWarning },
      { status: 503 }
    )
  }
  const supabase = supabaseCtx.client

  const results: string[] = []
  const errors: { id: string; error: string }[] = []

  for (const item of updates) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = String(row.id || '').trim()
    if (!id) continue

    const data: Record<string, unknown> = {}
    if (typeof row.likes === 'number') data.likes = Math.max(0, Math.floor(row.likes))
    if (typeof row.comments === 'number') data.comments = Math.max(0, Math.floor(row.comments))
    if (typeof row.input_date === 'string' && row.input_date.trim()) data.engagement_date = row.input_date.trim()

    // 拡張フィールド: 品番（品番変更時は product_cost もセットで必要）
    if (typeof row.item_code === 'string' && row.item_code.trim()) {
      data.item_code = row.item_code.trim()
      if (typeof row.product_cost !== 'number' || row.product_cost < 0) {
        errors.push({ id, error: 'product_cost is required when item_code is updated' })
        continue
      }
      data.product_cost = Math.max(0, Math.floor(row.product_cost))
    } else if (typeof row.product_cost === 'number') {
      data.product_cost = Math.max(0, Math.floor(row.product_cost))
    }

    // 拡張フィールド: 合意額
    if (typeof row.agreed_amount === 'number') {
      data.agreed_amount = Math.max(0, row.agreed_amount)
    }

    // 拡張フィールド: ステータス
    const validStatuses = ['pending', 'agree', 'disagree', 'cancelled', 'ignored']
    if (typeof row.status === 'string' && validStatuses.includes(row.status)) {
      data.status = row.status
    }

    // 拡張フィールド: 投稿URL
    if (typeof row.post_url === 'string') {
      data.post_url = row.post_url.trim() || null
    }

    if (Object.keys(data).length === 0) continue

    const { error } = await supabase
      .from('campaigns')
      .update(data)
      .eq('id', id)
      .eq('brand', brand)

    if (error) {
      errors.push({ id, error: error.message })
    } else {
      results.push(id)
    }
  }

  return NextResponse.json(
    { ok: true, updated: results, errors },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
