export function getCloutApiUrl(): string {
  return (
    process.env.CLOUT_API_URL ||
    process.env.NEXT_PUBLIC_CLOUT_API_URL ||
    'https://dashboard.clout.co.jp'
  )
}

export function getRequestIdFromHeaders(headers: { get(name: string): string | null }): string {
  return String(headers.get('x-clout-request-id') || '').trim()
}

export function getCompanyIdFromHeaders(headers: { get(name: string): string | null }): string {
  const raw = String(headers.get('x-clout-company-id') || '').trim()
  if (raw) return raw.toLowerCase()
  return String(process.env.CLOUT_COMPANY_ID || 'clout').trim().toLowerCase()
}

export function getVercelOidcTokenFromHeaders(headers: { get(name: string): string | null }): string {
  // Vercel injects this header at runtime on every Function request.
  const token = String(headers.get('x-vercel-oidc-token') || '').trim()
  if (token) return token

  // Local/dev fallback (vercel env pull).
  return String(process.env.VERCEL_OIDC_TOKEN || '').trim()
}

export async function fetchCloutMaster(
  request: { headers: { get(name: string): string | null } },
  path: string,
  init: RequestInit & { next?: { revalidate?: number } } = {}
): Promise<Response> {
  const baseUrl = getCloutApiUrl()
  const token = getVercelOidcTokenFromHeaders(request.headers)
  if (!token) {
    throw new Error('Missing Vercel OIDC token')
  }

  const requestId = getRequestIdFromHeaders(request.headers)
  const companyId = getCompanyIdFromHeaders(request.headers)

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json')
  if (requestId) {
    headers.set('x-clout-request-id', requestId)
  }
  if (companyId) {
    headers.set('x-clout-company-id', companyId)
  }

  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  })
}

export type DecisionEventPayload = {
  request_id?: string
  source_app: 'gifting-app'
  event_type: 'kpi_snapshot' | 'direction_decision' | 'execution_outcome' | 'data_quality_alert'
  occurred_at?: string
  brand_code: 'TL' | 'BE' | 'AM'
  product_code?: string | null
  campaign_id?: string | null
  staff_id?: string | null
  metrics?: Record<string, number>
  payload?: Record<string, unknown>
}

export async function postDecisionEvents(
  request: { headers: { get(name: string): string | null } },
  events: DecisionEventPayload[]
): Promise<{ accepted: number; rejected: number }> {
  if (!Array.isArray(events) || events.length === 0) {
    return { accepted: 0, rejected: 0 }
  }

  try {
    const response = await fetchCloutMaster(
      request,
      '/api/os/events/batch',
      {
        method: 'POST',
        body: JSON.stringify({ events }),
        cache: 'no-store',
        signal: AbortSignal.timeout(1200),
      }
    )

    if (!response.ok) {
      return { accepted: 0, rejected: events.length }
    }

    const data = (await response.json().catch(() => null)) as
      | { accepted_count?: unknown; rejected_count?: unknown }
      | null

    const accepted =
      typeof data?.accepted_count === 'number' && Number.isFinite(data.accepted_count)
        ? data.accepted_count
        : 0
    const rejected =
      typeof data?.rejected_count === 'number' && Number.isFinite(data.rejected_count)
        ? data.rejected_count
        : Math.max(0, events.length - accepted)

    return { accepted, rejected }
  } catch {
    return { accepted: 0, rejected: events.length }
  }
}
