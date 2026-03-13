import type { Influencer } from '@/types'

export type SelectableInfluencer = Pick<
  Influencer,
  'id' | 'brand' | 'insta_name' | 'insta_url' | 'tiktok_name' | 'tiktok_url'
>

export function normalizeInfluencerHandle(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
    .trim()
    .toLowerCase()
}

export function getInfluencerPrimaryHandle(influencer: SelectableInfluencer): string {
  return influencer.insta_name || influencer.tiktok_name || ''
}

export function influencerMatchesQuery(
  influencer: SelectableInfluencer,
  query: string
): boolean {
  const normalizedQuery = normalizeInfluencerHandle(query)
  if (!normalizedQuery) return false

  return [influencer.insta_name, influencer.tiktok_name]
    .map((handle) => normalizeInfluencerHandle(handle))
    .some((handle) => handle.includes(normalizedQuery))
}

export function influencerHasExactHandle(
  influencer: SelectableInfluencer,
  query: string
): boolean {
  const normalizedQuery = normalizeInfluencerHandle(query)
  if (!normalizedQuery) return false

  return [influencer.insta_name, influencer.tiktok_name]
    .map((handle) => normalizeInfluencerHandle(handle))
    .some((handle) => handle === normalizedQuery)
}

export function dedupeSelectableInfluencers<T extends SelectableInfluencer>(items: T[]): T[] {
  const seen = new Set<string>()
  const deduped: T[] = []

  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue
    seen.add(item.id)
    deduped.push(item)
  }

  return deduped
}

export function sortSelectableInfluencers<T extends SelectableInfluencer>(
  items: T[],
  currentBrand: string,
  query: string
): T[] {
  return [...items].sort((left, right) => {
    const leftExact = influencerHasExactHandle(left, query) ? 0 : 1
    const rightExact = influencerHasExactHandle(right, query) ? 0 : 1
    if (leftExact !== rightExact) return leftExact - rightExact

    const leftBrand = String(left.brand || '').toUpperCase() === currentBrand ? 0 : 1
    const rightBrand = String(right.brand || '').toUpperCase() === currentBrand ? 0 : 1
    if (leftBrand !== rightBrand) return leftBrand - rightBrand

    return getInfluencerPrimaryHandle(left).localeCompare(
      getInfluencerPrimaryHandle(right),
      'ja'
    )
  })
}

export function buildDuplicateInfluencerMessage(existingBrand: string, requestedBrand: string): string {
  if (existingBrand === requestedBrand) {
    return '同じSNS名のインフルエンサーが既に登録されています。既存データを選択してください。'
  }

  return `${existingBrand}ブランドで既に登録済みです。案件登録画面では既存インフルエンサーを検索して選択してください。`
}
