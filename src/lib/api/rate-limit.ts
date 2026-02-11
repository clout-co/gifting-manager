type RateLimitBucket = {
  count: number
  resetAt: number
}

type RateLimitResult =
  | { ok: true; remaining: number; retryAfterSeconds: 0 }
  | { ok: false; remaining: 0; retryAfterSeconds: number }

type RateLimitArgs = {
  key: string
  limit: number
  windowMs: number
}

const STORE_KEY = '__clout_rate_limit_store__'

function getStore(): Map<string, RateLimitBucket> {
  const g = globalThis as unknown as Record<string, unknown>
  const existing = g[STORE_KEY]
  if (existing instanceof Map) return existing as Map<string, RateLimitBucket>
  const store = new Map<string, RateLimitBucket>()
  g[STORE_KEY] = store
  return store
}

export function rateLimit({ key, limit, windowMs }: RateLimitArgs): RateLimitResult {
  const now = Date.now()
  const store = getStore()

  const bucket = store.get(key)
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 }
  }

  if (bucket.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    return { ok: false, remaining: 0, retryAfterSeconds }
  }

  bucket.count += 1
  store.set(key, bucket)
  return { ok: true, remaining: Math.max(0, limit - bucket.count), retryAfterSeconds: 0 }
}

