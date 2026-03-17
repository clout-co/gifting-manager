import { calculateInfluencerScore } from './scoring.js'
import type { InfluencerRank } from './scoring'

type CampaignInfluencer =
  | {
      id?: string | null
      insta_name?: string | null
      tiktok_name?: string | null
    }
  | null
  | undefined

type CampaignInfluencerValue = CampaignInfluencer | CampaignInfluencer[]

export type DashboardCountryCampaign = {
  influencer_id?: string | null
  influencer?: CampaignInfluencerValue
  shipping_country?: string | null
  is_international_shipping?: boolean | null
  item_quantity?: number | null
  international_shipping_cost?: number | null
  post_date?: string | null
  post_url?: string | null
  likes?: number | null
  comments?: number | null
  consideration_comment?: number | null
  agreed_amount?: number | null
}

export type CountryDistributionStat = {
  country: string
  gift_count: number
  post_count: number
  influencer_count: number
  shipping_cost_total: number
}

export type CountryInfluencerRankingEntry = {
  display_name: string
  total_likes: number
  total_comments: number
  total_campaigns: number
  total_posts: number
  total_amount: number
  cost_per_like: number
  score: number
  rank: InfluencerRank
}

export type CountryInfluencerRanking = {
  country: string
  influencers: CountryInfluencerRankingEntry[]
}

type InfluencerAccumulator = {
  display_name: string
  total_likes: number
  total_comments: number
  total_campaigns: number
  total_posts: number
  total_amount: number
  total_consideration_comments: number
}

function normalizeCountry(value: unknown): string {
  const raw = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  return raw || '未設定'
}

function getInfluencerRecord(value: CampaignInfluencerValue): CampaignInfluencer {
  if (Array.isArray(value)) {
    return value[0] || null
  }
  return value || null
}

function getInfluencerDisplayName(value: CampaignInfluencerValue): string {
  const influencer = getInfluencerRecord(value)
  if (!influencer) return '不明'

  return String(influencer.insta_name || '').trim()
    || String(influencer.tiktok_name || '').trim()
    || '不明'
}

function getInfluencerKey(campaign: DashboardCountryCampaign): string {
  const influencer = getInfluencerRecord(campaign.influencer)
  const influencerId = String(campaign.influencer_id || influencer?.id || '').trim()
  if (influencerId) return influencerId
  return `name:${getInfluencerDisplayName(campaign.influencer)}`
}

function getGiftCount(itemQuantity: unknown): number {
  const parsed = Math.floor(Number(itemQuantity) || 0)
  return parsed > 0 ? parsed : 1
}

function hasPosted(campaign: DashboardCountryCampaign): boolean {
  const postDate = String(campaign.post_date || '').trim()
  const postUrl = String(campaign.post_url || '').trim()
  const likes = Number(campaign.likes || 0)
  const comments = Number(campaign.comments || 0)
  return Boolean(postDate || postUrl || likes > 0 || comments > 0)
}

function isInternationalCampaign(campaign: DashboardCountryCampaign): boolean {
  const country = String(campaign.shipping_country || '').trim()
  return Boolean(campaign.is_international_shipping || country)
}

function buildInfluencerRanking(
  campaigns: DashboardCountryCampaign[],
  topN: number
): CountryInfluencerRankingEntry[] {
  const influencerMap = new Map<string, InfluencerAccumulator>()

  for (const campaign of campaigns) {
    const key = getInfluencerKey(campaign)
    const current = influencerMap.get(key) || {
      display_name: getInfluencerDisplayName(campaign.influencer),
      total_likes: 0,
      total_comments: 0,
      total_campaigns: 0,
      total_posts: 0,
      total_amount: 0,
      total_consideration_comments: 0,
    }

    current.total_likes += Number(campaign.likes || 0)
    current.total_comments += Number(campaign.comments || 0)
    current.total_campaigns += 1
    current.total_posts += hasPosted(campaign) ? 1 : 0
    current.total_amount += Number(campaign.agreed_amount || 0)
    current.total_consideration_comments += Number(campaign.consideration_comment || 0)

    influencerMap.set(key, current)
  }

  return Array.from(influencerMap.values())
    .map((entry) => {
      const avgLikes = entry.total_campaigns > 0 ? entry.total_likes / entry.total_campaigns : 0
      const avgConsiderationComments =
        entry.total_campaigns > 0 ? entry.total_consideration_comments / entry.total_campaigns : 0
      const costPerLike = entry.total_likes > 0 ? entry.total_amount / entry.total_likes : 0
      const scoreResult = calculateInfluencerScore({
        avgConsiderationComments,
        avgLikes,
        costPerLike,
      })

      return {
        display_name: entry.display_name,
        total_likes: entry.total_likes,
        total_comments: entry.total_comments,
        total_campaigns: entry.total_campaigns,
        total_posts: entry.total_posts,
        total_amount: entry.total_amount,
        cost_per_like: costPerLike,
        score: scoreResult.totalScore,
        rank: scoreResult.rank,
      }
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      if (right.total_posts !== left.total_posts) return right.total_posts - left.total_posts
      if (right.total_likes !== left.total_likes) return right.total_likes - left.total_likes
      if (right.total_campaigns !== left.total_campaigns) return right.total_campaigns - left.total_campaigns
      return left.display_name.localeCompare(right.display_name, 'ja')
    })
    .slice(0, topN)
}

export function buildDashboardCountryInsights(
  campaigns: DashboardCountryCampaign[],
  options?: { topN?: number }
): {
  countryDistributionStats: CountryDistributionStat[]
  internationalInfluencerRanking: CountryInfluencerRankingEntry[]
  countryInfluencerRanking: CountryInfluencerRanking[]
} {
  const topN = options?.topN ?? 10
  const internationalCampaigns = campaigns.filter(isInternationalCampaign)

  if (internationalCampaigns.length === 0) {
    return {
      countryDistributionStats: [],
      internationalInfluencerRanking: [],
      countryInfluencerRanking: [],
    }
  }

  const distributionMap = new Map<
    string,
    {
      gift_count: number
      post_count: number
      shipping_cost_total: number
      influencer_ids: Set<string>
    }
  >()
  const countryCampaignMap = new Map<string, DashboardCountryCampaign[]>()

  for (const campaign of internationalCampaigns) {
    const country = normalizeCountry(campaign.shipping_country)
    const distribution = distributionMap.get(country) || {
      gift_count: 0,
      post_count: 0,
      shipping_cost_total: 0,
      influencer_ids: new Set<string>(),
    }
    const influencerKey = getInfluencerKey(campaign)

    distribution.gift_count += getGiftCount(campaign.item_quantity)
    distribution.post_count += hasPosted(campaign) ? 1 : 0
    distribution.shipping_cost_total += Number(campaign.international_shipping_cost || 0)
    distribution.influencer_ids.add(influencerKey)
    distributionMap.set(country, distribution)

    const countryCampaigns = countryCampaignMap.get(country) || []
    countryCampaigns.push(campaign)
    countryCampaignMap.set(country, countryCampaigns)
  }

  const countryDistributionStats = Array.from(distributionMap.entries())
    .map(([country, entry]) => ({
      country,
      gift_count: entry.gift_count,
      post_count: entry.post_count,
      influencer_count: entry.influencer_ids.size,
      shipping_cost_total: entry.shipping_cost_total,
    }))
    .sort((left, right) => {
      if (right.gift_count !== left.gift_count) return right.gift_count - left.gift_count
      if (right.post_count !== left.post_count) return right.post_count - left.post_count
      return left.country.localeCompare(right.country, 'ja')
    })

  const countryInfluencerRanking = Array.from(countryCampaignMap.entries())
    .map(([country, countryCampaigns]) => ({
      country,
      influencers: buildInfluencerRanking(countryCampaigns, topN),
    }))
    .sort((left, right) => {
      const leftGiftCount = distributionMap.get(left.country)?.gift_count || 0
      const rightGiftCount = distributionMap.get(right.country)?.gift_count || 0
      if (rightGiftCount !== leftGiftCount) return rightGiftCount - leftGiftCount
      return left.country.localeCompare(right.country, 'ja')
    })

  return {
    countryDistributionStats,
    internationalInfluencerRanking: buildInfluencerRanking(internationalCampaigns, topN),
    countryInfluencerRanking,
  }
}
