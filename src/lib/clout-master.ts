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

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json')
  if (requestId) {
    headers.set('x-clout-request-id', requestId)
  }

  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  })
}

