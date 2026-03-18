export const POSTS_META_PREFIX = '[POSTS_JSON:'
export const POSTS_META_REGEX = /\[POSTS_JSON:([A-Za-z0-9+/=]+)\]\n?/

export type CampaignPost = {
  sort_order: number
  post_date: string | null
  post_url: string | null
  likes: number
  comments: number
  consideration_comment: number
  engagement_date: string | null
  is_unavailable: boolean
}

export type CampaignPostSummary = {
  post_date: string | null
  post_url: string | null
  likes: number
  comments: number
  consideration_comment: number
  engagement_date: string | null
}

type CampaignPostLike = {
  sort_order?: unknown
  post_date?: unknown
  post_url?: unknown
  likes?: unknown
  comments?: unknown
  consideration_comment?: unknown
  engagement_date?: unknown
  is_unavailable?: unknown
}

type BufferLike = {
  from(input: string, encoding: 'utf8' | 'base64'): {
    toString(encoding: 'base64' | 'utf8'): string
  }
}

function getGlobalBuffer(): BufferLike | undefined {
  return (globalThis as { Buffer?: BufferLike }).Buffer
}

function toDateValue(value: unknown): string | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function toOptionalString(value: unknown): string | null {
  const normalized = String(value || '').trim()
  return normalized || null
}

function toNonNegativeInt(value: unknown): number {
  const normalized = String(value ?? '')
    .replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ')
    .replace(/[^\d]/g, '')
  if (!normalized) return 0
  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function hasMeaningfulPost(row: CampaignPost): boolean {
  return Boolean(
    row.post_date ||
    row.post_url ||
    row.likes > 0 ||
    row.comments > 0 ||
    row.consideration_comment > 0 ||
    row.engagement_date ||
    row.is_unavailable
  )
}

function decodeBase64Utf8(value: string): string {
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(value)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  }

  const Buffer = getGlobalBuffer()
  if (Buffer) {
    return Buffer.from(value, 'base64').toString('utf8')
  }

  throw new Error('Base64 decoder is not available')
}

function encodeBase64Utf8(value: string): string {
  if (typeof globalThis.btoa === 'function') {
    const bytes = new TextEncoder().encode(value)
    let binary = ''
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte)
    })
    return globalThis.btoa(binary)
  }

  const Buffer = getGlobalBuffer()
  if (Buffer) {
    return Buffer.from(value, 'utf8').toString('base64')
  }

  throw new Error('Base64 encoder is not available')
}

export function stripCampaignPostMeta(notes: string | null | undefined): string {
  return String(notes || '').replace(POSTS_META_REGEX, '').trim()
}

export function normalizeCampaignPosts(source: CampaignPostLike[]): CampaignPost[] {
  return source
    .map((row, index) => {
      const item = row && typeof row === 'object' ? row : {}
      const isUnavailable = Boolean(item.is_unavailable)
      const sortOrderRaw = Number(item.sort_order)

      return {
        sort_order: Number.isFinite(sortOrderRaw) ? Math.max(0, Math.floor(sortOrderRaw)) : index,
        post_date: toDateValue(item.post_date),
        post_url: toOptionalString(item.post_url),
        likes: isUnavailable ? 0 : toNonNegativeInt(item.likes),
        comments: isUnavailable ? 0 : toNonNegativeInt(item.comments),
        consideration_comment: isUnavailable ? 0 : toNonNegativeInt(item.consideration_comment),
        engagement_date: isUnavailable ? null : toDateValue(item.engagement_date),
        is_unavailable: isUnavailable,
      } satisfies CampaignPost
    })
    .filter(hasMeaningfulPost)
    .sort((a, b) => a.sort_order - b.sort_order)
}

export function decodeCampaignPostsFromNotes(notes: string | null | undefined): CampaignPost[] {
  const match = String(notes || '').match(POSTS_META_REGEX)
  if (!match || !match[1]) return []

  try {
    const decoded = decodeBase64Utf8(match[1])
    const parsed = JSON.parse(decoded) as unknown
    if (!Array.isArray(parsed)) return []
    return normalizeCampaignPosts(parsed as CampaignPostLike[])
  } catch {
    return []
  }
}

export function summarizeCampaignPosts(source: CampaignPost[]): CampaignPostSummary {
  if (source.length === 0) {
    return {
      post_date: null,
      post_url: null,
      likes: 0,
      comments: 0,
      consideration_comment: 0,
      engagement_date: null,
    }
  }

  const totalLikes = source.reduce((sum, row) => sum + row.likes, 0)
  const totalComments = source.reduce((sum, row) => sum + row.comments, 0)
  const totalConsideration = source.reduce((sum, row) => sum + row.consideration_comment, 0)

  const latestPostByDate = source
    .filter((row) => row.post_date)
    .sort((a, b) => String(a.post_date).localeCompare(String(b.post_date)))
    .at(-1)
  const latestPostByOrder = source.at(-1) || null
  const representative = latestPostByDate || latestPostByOrder

  const latestEngagementDate = source
    .filter((row) => row.engagement_date)
    .sort((a, b) => String(a.engagement_date).localeCompare(String(b.engagement_date)))
    .at(-1)?.engagement_date || null

  return {
    post_date: representative?.post_date || null,
    post_url: representative?.post_url || null,
    likes: totalLikes,
    comments: totalComments,
    consideration_comment: totalConsideration,
    engagement_date: latestEngagementDate,
  }
}

export function summarizeCampaignPostsFromNotes(notes: string | null | undefined): CampaignPostSummary {
  return summarizeCampaignPosts(decodeCampaignPostsFromNotes(notes))
}

export function encodeCampaignPostsToMeta(source: CampaignPostLike[]): string {
  const normalized = normalizeCampaignPosts(source)
  if (normalized.length === 0) return ''

  const encoded = encodeBase64Utf8(JSON.stringify(normalized))
  return `${POSTS_META_PREFIX}${encoded}]\n`
}
