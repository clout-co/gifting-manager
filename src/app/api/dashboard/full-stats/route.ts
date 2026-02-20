import { NextRequest, NextResponse } from 'next/server'
import { requireAuthContext } from '@/lib/auth/request-context'
import { createSupabaseForRequest } from '@/lib/supabase/request-client'
import {
  calculateInfluencerScore,
  type InfluencerRank,
} from '@/lib/scoring'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function isAllowedBrand(value: unknown): value is 'TL' | 'BE' | 'AM' {
  return value === 'TL' || value === 'BE' || value === 'AM'
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

function toDateOnly(value: unknown): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

function calcCampaignCost(campaign: {
  agreed_amount?: number | null
  product_cost?: number | null
  item_quantity?: number | null
  shipping_cost?: number | null
  international_shipping_cost?: number | null
}): number {
  const agreed = Number(campaign.agreed_amount || 0)
  const unitCost = Number(campaign.product_cost || 0)
  const qty = Math.max(1, Number(campaign.item_quantity || 1))
  const shipping = Number(campaign.shipping_cost || 0)
  const intlShipping = Number(campaign.international_shipping_cost || 0)
  return agreed + unitCost * qty + shipping + intlShipping
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
    .select(`
      brand,
      status,
      agreed_amount,
      sale_date,
      likes,
      comments,
      consideration_comment,
      influencer_id,
      item_code,
      item_quantity,
      product_cost,
      shipping_cost,
      international_shipping_cost,
      post_date,
      created_at,
      influencer:influencers(id, insta_name, tiktok_name)
    `)
    .eq('brand', brand)

  if (selectedItem !== 'all') {
    query = query.eq('item_code', selectedItem)
  }
  if (dateRange !== 'all') {
    const startDate = getStartDateFromRange(dateRange)
    if (startDate) {
      query = query.gte('created_at', startDate.toISOString())
    }
  }

  const { data: campaigns, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to fetch stats' }, { status: 500 })
  }

  if (!campaigns) {
    return NextResponse.json(null, { headers: { 'Cache-Control': 'no-store' } })
  }

  // 単一パス集計: 全ての統計情報を1回のループで計算
  const statusCount = { pending: 0, agree: 0, disagree: 0, cancelled: 0 }
  const brandMap = new Map<string, { count: number; amount: number; likes: number }>()
  const monthMap = new Map<string, { campaigns: number; amount: number; likes: number }>()
  const influencerMap = new Map<string, {
    display_name: string
    total_likes: number
    total_comments: number
    total_campaigns: number
    total_amount: number
    total_consideration_comments: number
  }>()
  const itemMap = new Map<string, { count: number; likes: number; comments: number; amount: number }>()
  const itemCostMap = new Map<string, { total_cost: number; campaigns: number }>()
  const itemPostTimingMap = new Map<string, { pre_sale_posts: number; post_sale_posts: number; no_post: number }>()

  const influencerIds = new Set<string>()
  let totalSpent = 0
  let totalLikes = 0
  let totalComments = 0

  for (const c of campaigns as any[]) {
    const likes = c.likes || 0
    const comments = c.comments || 0
    const agreedAmount = c.agreed_amount || 0
    const totalCost = calcCampaignCost(c)

    // Totals
    totalSpent += totalCost
    totalLikes += likes
    totalComments += comments
    if (c.influencer_id) influencerIds.add(c.influencer_id)

    // Status
    if (c.status in statusCount) {
      statusCount[c.status as keyof typeof statusCount]++
    }

    // Brand
    const b = c.brand || '未設定'
    const brandEntry = brandMap.get(b)
    if (brandEntry) {
      brandEntry.count++
      brandEntry.amount += agreedAmount
      brandEntry.likes += likes
    } else {
      brandMap.set(b, { count: 1, amount: agreedAmount, likes })
    }

    // Monthly
    const date = c.sale_date || c.post_date || c.created_at
    if (date) {
      const month = date.substring(0, 7)
      const monthEntry = monthMap.get(month)
      if (monthEntry) {
        monthEntry.campaigns++
        monthEntry.amount += totalCost
        monthEntry.likes += likes
      } else {
        monthMap.set(month, { campaigns: 1, amount: totalCost, likes })
      }
    }

    // Influencer
    const raw = c.influencer
    const influencer = Array.isArray(raw) ? raw[0] : raw
    if (influencer) {
      const key = String(influencer.id || '')
      if (key) {
        const displayName = String(influencer.insta_name || '') || String(influencer.tiktok_name || '') || '不明'
        const infEntry = influencerMap.get(key)
        if (infEntry) {
          infEntry.total_likes += likes
          infEntry.total_comments += comments
          infEntry.total_campaigns++
          infEntry.total_amount += agreedAmount
          infEntry.total_consideration_comments += (c.consideration_comment || 0)
        } else {
          influencerMap.set(key, {
            display_name: displayName,
            total_likes: likes,
            total_comments: comments,
            total_campaigns: 1,
            total_amount: agreedAmount,
            total_consideration_comments: c.consideration_comment || 0,
          })
        }
      }
    }

    // Item stats
    if (c.item_code) {
      const itemEntry = itemMap.get(c.item_code)
      if (itemEntry) {
        itemEntry.count++
        itemEntry.likes += likes
        itemEntry.comments += comments
        itemEntry.amount += totalCost
      } else {
        itemMap.set(c.item_code, { count: 1, likes, comments, amount: totalCost })
      }

      const costEntry = itemCostMap.get(c.item_code)
      if (costEntry) {
        costEntry.total_cost += totalCost
        costEntry.campaigns++
      } else {
        itemCostMap.set(c.item_code, { total_cost: totalCost, campaigns: 1 })
      }

      const saleDate = toDateOnly(c.sale_date)
      const postDate = toDateOnly(c.post_date)
      let timing = itemPostTimingMap.get(c.item_code)
      if (!timing) {
        timing = { pre_sale_posts: 0, post_sale_posts: 0, no_post: 0 }
        itemPostTimingMap.set(c.item_code, timing)
      }
      if (!postDate) {
        timing.no_post++
      } else if (saleDate && postDate < saleDate) {
        timing.pre_sale_posts++
      } else {
        timing.post_sale_posts++
      }
    }
  }

  // Influencer ranking
  const influencerRanking = Array.from(influencerMap.values())
    .map((inf) => {
      const costPerLike = inf.total_likes > 0 ? inf.total_amount / inf.total_likes : 0
      const avgLikes = inf.total_campaigns > 0 ? inf.total_likes / inf.total_campaigns : 0
      const avgConsiderationComments = inf.total_campaigns > 0
        ? inf.total_consideration_comments / inf.total_campaigns
        : 0

      let score = 0
      let rank: InfluencerRank = 'C'
      if (inf.total_campaigns > 0) {
        const scoreResult = calculateInfluencerScore({
          avgConsiderationComments,
          avgLikes,
          costPerLike,
        })
        score = scoreResult.totalScore
        rank = scoreResult.rank
      }

      return {
        ...inf,
        cost_per_like: costPerLike,
        score,
        rank,
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  // Influencer screening
  const influencerScreeningCount = {
    high_3000_plus: 0,
    mid_1000_plus: 0,
    low_500_or_less: 0,
    mid_501_999: 0,
  }
  for (const inf of influencerMap.values()) {
    if (inf.total_campaigns <= 0) continue
    const avgLikes = inf.total_likes / inf.total_campaigns
    if (avgLikes >= 3000) {
      influencerScreeningCount.high_3000_plus += 1
    } else if (avgLikes >= 1000) {
      influencerScreeningCount.mid_1000_plus += 1
    } else if (avgLikes <= 500) {
      influencerScreeningCount.low_500_or_less += 1
    } else {
      influencerScreeningCount.mid_501_999 += 1
    }
  }

  const result = {
    totalCampaigns: campaigns.length,
    totalInfluencers: influencerIds.size,
    totalSpent,
    totalLikes,
    totalComments,
    statusBreakdown: [
      { name: '合意', value: statusCount.agree, color: '#374151' },
      { name: '保留', value: statusCount.pending, color: '#6b7280' },
      { name: '不合意', value: statusCount.disagree, color: '#9ca3af' },
      { name: 'キャンセル', value: statusCount.cancelled, color: '#d1d5db' },
    ].filter((s) => s.value > 0),
    brandStats: Array.from(brandMap.entries())
      .map(([b, data]) => ({ brand: b, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10),
    monthlyStats: Array.from(monthMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12),
    itemCostStats: Array.from(itemCostMap.entries())
      .map(([item_code, data]) => ({ item_code, ...data }))
      .sort((a, b) => b.total_cost - a.total_cost)
      .slice(0, 12),
    itemPostTimingStats: Array.from(itemPostTimingMap.entries())
      .map(([item_code, data]) => ({ item_code, ...data }))
      .sort((a, b) => (b.pre_sale_posts + b.post_sale_posts + b.no_post) - (a.pre_sale_posts + a.post_sale_posts + a.no_post))
      .slice(0, 12),
    influencerScreening: [
      { segment: '3000いいね以上', count: influencerScreeningCount.high_3000_plus, color: '#1d4ed8' },
      { segment: '1000-2999いいね', count: influencerScreeningCount.mid_1000_plus, color: '#2563eb' },
      { segment: '500いいね以下', count: influencerScreeningCount.low_500_or_less, color: '#60a5fa' },
      { segment: '501-999いいね', count: influencerScreeningCount.mid_501_999, color: '#93c5fd' },
    ],
    influencerRanking,
    itemStats: Array.from(itemMap.entries())
      .map(([item_code, data]) => ({ item_code, ...data }))
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 10),
  }

  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, max-age=60' } })
}
