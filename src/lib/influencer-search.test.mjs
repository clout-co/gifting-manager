import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDuplicateInfluencerMessage,
  dedupeSelectableInfluencers,
  influencerHasExactHandle,
  influencerMatchesQuery,
  normalizeInfluencerHandle,
  sortSelectableInfluencers,
} from './influencer-search.ts'

const base = [
  {
    id: 'be-existing',
    brand: 'BE',
    insta_name: 'llcreator',
    insta_url: null,
    tiktok_name: null,
    tiktok_url: null,
  },
  {
    id: 'tl-partial',
    brand: 'TL',
    insta_name: 'llcreator_sub',
    insta_url: null,
    tiktok_name: null,
    tiktok_url: null,
  },
  {
    id: 'tl-tiktok',
    brand: 'TL',
    insta_name: null,
    insta_url: null,
    tiktok_name: 'll_tok',
    tiktok_url: null,
  },
]

test('normalizeInfluencerHandle strips leading @ and lowercases', () => {
  assert.equal(normalizeInfluencerHandle('  @@Ll.Creator  '), 'll.creator')
})

test('influencer query matching covers instagram and tiktok handles', () => {
  assert.equal(influencerMatchesQuery(base[0], 'llcre'), true)
  assert.equal(influencerMatchesQuery(base[2], '@ll_'), true)
  assert.equal(influencerMatchesQuery(base[2], 'missing'), false)
})

test('exact handle matching ignores leading @ casing', () => {
  assert.equal(influencerHasExactHandle(base[0], '@LLCREATOR'), true)
  assert.equal(influencerHasExactHandle(base[0], 'llcre'), false)
})

test('dedupeSelectableInfluencers keeps first seen id', () => {
  const deduped = dedupeSelectableInfluencers([base[0], base[1], base[0]])
  assert.deepEqual(
    deduped.map((item) => item.id),
    ['be-existing', 'tl-partial']
  )
})

test('sortSelectableInfluencers prioritizes exact match before same-brand partial match', () => {
  const matching = base.filter((item) => influencerMatchesQuery(item, 'llcreator'))
  const sorted = sortSelectableInfluencers(matching, 'TL', 'llcreator')
  assert.deepEqual(
    sorted.map((item) => item.id),
    ['be-existing', 'tl-partial']
  )
})

test('buildDuplicateInfluencerMessage explains same-brand and cross-brand cases', () => {
  assert.equal(
    buildDuplicateInfluencerMessage('TL', 'TL'),
    '同じSNS名のインフルエンサーが既に登録されています。既存データを選択してください。'
  )
  assert.equal(
    buildDuplicateInfluencerMessage('BE', 'TL'),
    'BEブランドで既に登録済みです。案件登録画面では既存インフルエンサーを検索して選択してください。'
  )
})
