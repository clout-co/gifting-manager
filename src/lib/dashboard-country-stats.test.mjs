import test from 'node:test'
import assert from 'node:assert/strict'

import { buildDashboardCountryInsights } from './dashboard-country-stats.ts'

test('buildDashboardCountryInsights groups BE international campaigns by country and ranking', () => {
  const result = buildDashboardCountryInsights([
    {
      influencer_id: 'kr-1',
      influencer: { id: 'kr-1', insta_name: 'k_creator' },
      shipping_country: '韓国',
      is_international_shipping: true,
      item_quantity: 2,
      international_shipping_cost: 2400,
      post_date: '2026-03-10',
      likes: 3200,
      comments: 80,
      consideration_comment: 5,
      agreed_amount: 10000,
    },
    {
      influencer_id: 'kr-1',
      influencer: { id: 'kr-1', insta_name: 'k_creator' },
      shipping_country: '韓国',
      is_international_shipping: true,
      item_quantity: 1,
      international_shipping_cost: 1200,
      post_url: 'https://example.com/post',
      likes: 1800,
      comments: 40,
      consideration_comment: 3,
      agreed_amount: 8000,
    },
    {
      influencer_id: 'uk-1',
      influencer: { id: 'uk-1', insta_name: 'uk_creator' },
      shipping_country: 'イギリス',
      is_international_shipping: true,
      item_quantity: 1,
      international_shipping_cost: 2000,
      likes: 0,
      comments: 0,
      consideration_comment: 1,
      agreed_amount: 6000,
    },
    {
      influencer_id: 'jp-1',
      influencer: { id: 'jp-1', insta_name: 'domestic_creator' },
      shipping_country: null,
      is_international_shipping: false,
      item_quantity: 5,
      international_shipping_cost: null,
      likes: 9999,
      comments: 100,
      consideration_comment: 9,
      agreed_amount: 50000,
    },
  ])

  assert.deepEqual(result.countryDistributionStats, [
    {
      country: '韓国',
      gift_count: 3,
      post_count: 2,
      influencer_count: 1,
      shipping_cost_total: 3600,
    },
    {
      country: 'イギリス',
      gift_count: 1,
      post_count: 0,
      influencer_count: 1,
      shipping_cost_total: 2000,
    },
  ])

  assert.equal(result.internationalInfluencerRanking.length, 2)
  assert.deepEqual(result.internationalInfluencerRanking[0], {
    display_name: 'k_creator',
    total_likes: 5000,
    total_comments: 120,
    total_campaigns: 2,
    total_posts: 2,
    total_amount: 18000,
    cost_per_like: 3.6,
    score: result.internationalInfluencerRanking[0].score,
    rank: result.internationalInfluencerRanking[0].rank,
  })

  const koreaRanking = result.countryInfluencerRanking.find((entry) => entry.country === '韓国')
  assert.ok(koreaRanking)
  assert.equal(koreaRanking.influencers.length, 1)
  assert.equal(koreaRanking.influencers[0].display_name, 'k_creator')
  assert.equal(koreaRanking.influencers[0].total_posts, 2)
})
