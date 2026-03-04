import { NextRequest, NextResponse } from 'next/server'
import { requireAuthContext } from '@/lib/auth/request-context'
import { createSupabaseForRequest } from '@/lib/supabase/request-client'
import { writeAuditLog } from '@/lib/clout-audit'

type AllowedBrand = 'TL' | 'BE' | 'AM'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function isAllowedBrand(value: unknown): value is AllowedBrand {
  return value === 'TL' || value === 'BE' || value === 'AM'
}

/** 有効なアクション */
type PaymentAction = 'approve' | 'unapprove' | 'paid' | 'unpaid'
const VALID_ACTIONS: PaymentAction[] = ['approve', 'unapprove', 'paid', 'unpaid']

/** アクションごとの前提条件となる payment_status */
const ACTION_PRECONDITIONS: Record<PaymentAction, string[]> = {
  approve: ['unpaid'],   // 未払い → 承認済み
  unapprove: ['approved'], // 承認済み → 未払い（承認取消）
  paid: ['approved'],     // 承認済み → 支払い済み
  unpaid: ['paid'],       // 支払い済み → 未払い（完全リセット）
}

/**
 * GET /api/payments?brand=TL&payment_status=unpaid
 *
 * 支払い対象案件を取得する。表示条件:
 * 1. 案件が存在する
 * 2. post_url が登録されている（投稿確認済み）
 * 3. インフルエンサーの銀行情報が登録済み（bank_name, bank_branch, account_number, account_holder）
 * 4. agreed_amount > 0（有償案件）
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuthContext(request)
  if (!auth.ok) {
    return auth.response
  }

  if (!supabaseUrl || (!supabaseAnonKey && !supabaseServiceRoleKey)) {
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

  const paymentStatusFilter = request.nextUrl.searchParams.get('payment_status') || 'unpaid'

  // 条件1: 案件が存在 + 条件2: post_url IS NOT NULL + 条件4: agreed_amount > 0
  let query = supabase
    .from('campaigns')
    .select(`
      id, brand, influencer_id, item_code, item_quantity,
      agreed_date, offered_amount, agreed_amount, status,
      post_date, post_url,
      product_cost, shipping_cost,
      payment_status, paid_at,
      approved_by, approved_by_email, approved_at,
      staff_id, created_at, updated_at,
      influencer:influencers(
        id, insta_name, tiktok_name, insta_url, tiktok_url,
        real_name, bank_name, bank_branch, bank_code, branch_code,
        account_type, account_number, account_holder,
        invoice_registration_number, invoice_acknowledged
      ),
      staff:staffs(id, name, email)
    `)
    .eq('brand', brand)
    .not('post_url', 'is', null)
    .gt('agreed_amount', 0)

  // 支払いステータスフィルタ
  if (paymentStatusFilter === 'unpaid') {
    query = query.or('payment_status.eq.unpaid,payment_status.is.null')
  } else if (paymentStatusFilter === 'approved') {
    query = query.eq('payment_status', 'approved')
  } else if (paymentStatusFilter === 'paid') {
    query = query.eq('payment_status', 'paid')
  }
  // 'all' = フィルタなし

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch payments' },
      { status: 500 }
    )
  }

  // 条件3: インフルエンサーの銀行情報が登録済み（アプリ側ポストフィルタ）
  // Supabase JSはJOINカラムでのフィルタ不可のため
  interface InfluencerJoin {
    bank_name: string | null
    bank_branch: string | null
    account_number: string | null
    account_holder: string | null
  }
  const filtered = (data || []).filter((c: { influencer: InfluencerJoin | null }) => {
    const inf = c.influencer
    if (!inf) return false
    return Boolean(inf.bank_name && inf.bank_branch && inf.account_number && inf.account_holder)
  })

  return NextResponse.json(
    { campaigns: filtered },
    { headers: { 'Cache-Control': 'private, max-age=30' } }
  )
}

/**
 * POST /api/payments
 *
 * 支払いステータスを更新する（承認フロー対応）
 * Body: { brand: string, ids: string[], action: 'approve' | 'unapprove' | 'paid' | 'unpaid' }
 *
 * フロー: unpaid → approved → paid
 * - approve:   unpaid → approved（承認者ID記録）
 * - unapprove: approved → unpaid（承認取消）
 * - paid:      approved → paid（支払い完了）
 * - unpaid:    paid → unpaid（完全リセット）
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuthContext(request, { requireWrite: true })
  if (!auth.ok) {
    return auth.response
  }

  if (!supabaseUrl || (!supabaseAnonKey && !supabaseServiceRoleKey)) {
    return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
  }

  let body: Record<string, unknown> | null = null
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const brand = String(body?.brand || '').trim().toUpperCase()
  if (!isAllowedBrand(brand)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }

  const allowedBrands = auth.context.brands
  if (allowedBrands.length > 0 && !allowedBrands.includes(brand)) {
    return NextResponse.json({ error: 'Forbidden brand' }, { status: 403 })
  }

  const ids = body?.ids
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })
  }
  if (ids.length > 200) {
    return NextResponse.json({ error: 'Too many ids (max 200)' }, { status: 400 })
  }

  const action = String(body?.action || '') as PaymentAction
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${VALID_ACTIONS.join(', ')}` },
      { status: 400 }
    )
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

  // ──── フロー制御: 前提条件を満たすIDのみ抽出 ────
  const preconditions = ACTION_PRECONDITIONS[action]

  // 対象レコードの現在の payment_status + 担当者情報を取得
  const { data: currentRecords, error: selectError } = await supabase
    .from('campaigns')
    .select('id, payment_status, staff_id, staff:staffs(id, name, email)')
    .in('id', ids)
    .eq('brand', brand)

  if (selectError) {
    return NextResponse.json(
      { error: selectError.message || 'Failed to check current status' },
      { status: 500 }
    )
  }

  type CampaignRecord = {
    id: string
    payment_status: string | null
    staff_id: string | null
    staff: { id: string; name: string; email: string | null } | null
  }

  // 前提条件を満たすIDをフィルタ
  const eligibleRecords = (currentRecords || [])
    .filter((r: CampaignRecord) => {
      const currentStatus = r.payment_status || 'unpaid'
      return preconditions.includes(currentStatus)
    })

  if (eligibleRecords.length === 0) {
    return NextResponse.json(
      { ok: true, updated: 0, skipped: ids.length, message: 'No eligible records for this action' },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  // ──── 承認アクション: 登録者本人のみ承認可能（監査要件） ────
  if (action === 'approve') {
    const actorEmail = auth.context.email.toLowerCase()

    // 担当者未設定の案件を検出
    const noStaff = eligibleRecords.filter(
      (r: CampaignRecord) => !r.staff_id || !r.staff?.email
    )
    if (noStaff.length > 0) {
      return NextResponse.json(
        {
          error: '担当者が未設定の案件は承認できません。先に担当者を設定してください。',
          no_staff_ids: noStaff.map((r: CampaignRecord) => r.id),
        },
        { status: 400 }
      )
    }

    // 登録者（担当者）本人チェック: メールアドレスで照合
    const unauthorized = eligibleRecords.filter((r: CampaignRecord) => {
      const staffEmail = (r.staff?.email || '').toLowerCase()
      return staffEmail !== actorEmail
    })
    if (unauthorized.length > 0) {
      const staffNames = [...new Set(
        unauthorized.map((r: CampaignRecord) => r.staff?.name || '不明')
      )]
      return NextResponse.json(
        {
          error: `案件の登録者（担当者）本人のみ承認可能です。担当者: ${staffNames.join(', ')}`,
          unauthorized_ids: unauthorized.map((r: CampaignRecord) => r.id),
        },
        { status: 403 }
      )
    }
  }

  const eligibleIds = eligibleRecords.map((r: CampaignRecord) => r.id)

  // ──── 更新データ構築 ────
  const now = new Date().toISOString()
  let updateData: Record<string, unknown>

  switch (action) {
    case 'approve':
      updateData = {
        payment_status: 'approved',
        approved_by: auth.context.userId,
        approved_by_email: auth.context.email,
        approved_at: now,
      }
      break
    case 'unapprove':
      updateData = {
        payment_status: 'unpaid',
        approved_by: null,
        approved_by_email: null,
        approved_at: null,
      }
      break
    case 'paid':
      updateData = {
        payment_status: 'paid',
        paid_at: now,
      }
      break
    case 'unpaid':
      // 完全リセット（承認情報もクリア）
      updateData = {
        payment_status: 'unpaid',
        paid_at: null,
        approved_by: null,
        approved_by_email: null,
        approved_at: null,
      }
      break
  }

  const { error: updateError } = await supabase
    .from('campaigns')
    .update(updateData)
    .in('id', eligibleIds)
    .eq('brand', brand)

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || 'Failed to update payment status' },
      { status: 500 }
    )
  }

  // ──── 監査ログ記録（全アクション） ────
  const ACTION_LABELS: Record<PaymentAction, string> = {
    approve: '支払い承認',
    unapprove: '承認取消',
    paid: '支払い完了',
    unpaid: '未払いリセット',
  }

  const oldStatuses = Object.fromEntries(
    eligibleRecords.map((r: CampaignRecord) => [r.id, r.payment_status || 'unpaid'])
  )

  for (const record of eligibleRecords) {
    writeAuditLog(request, {
      action: `payment.${action}`,
      entity_type: 'campaign',
      entity_id: record.id,
      entity_key: `${brand}/${record.id}`,
      old_values: { payment_status: oldStatuses[record.id] },
      new_values: updateData,
      metadata: {
        app: 'gifting-app',
        brand,
        action_label: ACTION_LABELS[action],
        staff_id: record.staff_id,
        staff_name: record.staff?.name,
        staff_email: record.staff?.email,
      },
    }).catch(() => {})
  }

  return NextResponse.json(
    {
      ok: true,
      updated: eligibleIds.length,
      skipped: ids.length - eligibleIds.length,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
