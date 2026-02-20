import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { rateLimit } from './lib/api/rate-limit'

const CLOUT_AUTH_URL = process.env.NEXT_PUBLIC_CLOUT_AUTH_URL || 'https://dashboard.clout.co.jp'
const APP_SLUG = 'gifting-app'

/**
 * Service-to-service auth: allow other Clout apps (e.g., Product Master) to call
 * read-only analytics API endpoints without going through the full SSO verify flow.
 * The calling app sends `x-clout-service-key` header with the shared secret and
 * must also provide `x-clout-user-id` + `x-clout-user-email` headers (already verified
 * by the calling app's proxy).
 */
const CLOUT_SERVICE_SECRET = String(process.env.CLOUT_SERVICE_SECRET || '').trim()
const SERVICE_AUTH_ALLOWED_PATHS = new Set([
  '/api/analytics/product-costs',
])

const HOST_TOKEN_COOKIE = '__Host-clout_token'
const LEGACY_TOKEN_COOKIE = 'clout_token'
const IS_PROD = process.env.NODE_ENV === 'production'
const TOKEN_COOKIE = IS_PROD ? HOST_TOKEN_COOKIE : LEGACY_TOKEN_COOKIE
const COMPANY_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 500

// Clerk session JWTs are short-lived (~60s default). To avoid constant re-verification
// (and the intermittent 401s that come with expired tokens), we cache a successful
// verification result for 30 minutes. During this window the user's identity and
// permissions are trusted without re-contacting Dashboard.
const VERIFY_CACHE_TTL_ALLOWED_MS = 30 * 60 * 1000 // 30 minutes
const VERIFY_CACHE_TTL_DENIED_MS = 10 * 1000
// Transient errors (5xx, network timeouts) are NOT cached.
// This ensures that a brief Dashboard hiccup does not cascade into a burst of
// false 401/503 responses for the affected user.
const VERIFY_CACHE_TTL_ERROR_MS = 0

type VerifyCacheEntry = {
  expiresAt: number
  status: number
  data: any | null
}

// Edge runtime: in-memory cache (best-effort). Helps reduce extra /api/auth/verify calls
// caused by multiple same-origin API requests during initial app load.
const verifyCache = new Map<string, VerifyCacheEntry>()

function resolveCompanyId(candidate: unknown): string {
  const raw = String(candidate || '').trim()
  if (raw && COMPANY_ID_PATTERN.test(raw)) {
    return raw.toLowerCase()
  }
  const envCompanyId = String(process.env.CLOUT_COMPANY_ID || '').trim()
  if (envCompanyId && COMPANY_ID_PATTERN.test(envCompanyId)) {
    return envCompanyId.toLowerCase()
  }
  return 'clout'
}

function buildReauthRedirectUrl(targetUrl: string, requestId: string): string {
  const url = new URL('/api/auth/redirect', CLOUT_AUTH_URL)
  url.searchParams.set('app', APP_SLUG)
  url.searchParams.set('redirect_url', targetUrl)
  url.searchParams.set('rid', requestId)
  return url.toString()
}

/**
 * リトライ付きfetch
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = MAX_RETRIES
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(5000), // 5秒タイムアウト
      })
      return response
    } catch (error) {
      if (attempt === retries) throw error
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)))
    }
  }
  throw new Error('Max retries exceeded')
}

/**
 * SSO proxy (Clout Dashboard integration)
 *
 * IMPORTANT: Next.js still requires `src/middleware.ts` (or `middleware.ts`) as an entrypoint.
 * This file holds the shared logic and should be re-exported from middleware.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isApiRoute = pathname.startsWith('/api/')
  const ridFromUrl = request.nextUrl.searchParams.get('rid')?.trim() || ''
  const requestId =
    request.headers.get('x-clout-request-id')?.trim() ||
    (ridFromUrl && ridFromUrl.length <= 128 ? ridFromUrl : '') ||
    crypto.randomUUID()
  const companyId = resolveCompanyId(request.headers.get('x-clout-company-id'))

  // One-time code handoff (?code=...) -> dashboard exchange -> clout_token cookie + URL cleanup
  const codeFromUrl = request.nextUrl.searchParams.get('code')
  if (codeFromUrl) {
    const cleanUrl = request.nextUrl.clone()
    cleanUrl.searchParams.delete('code')
    cleanUrl.searchParams.delete('rid')
    try {
      const serviceToken =
        String(request.headers.get('x-vercel-oidc-token') || '').trim() ||
        String(process.env.VERCEL_OIDC_TOKEN || '').trim()
      const response = await fetchWithRetry(`${CLOUT_AUTH_URL}/api/auth/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(serviceToken ? { Authorization: `Bearer ${serviceToken}` } : null),
          'x-clout-request-id': requestId,
          'x-clout-company-id': companyId,
        },
        body: JSON.stringify({ code: codeFromUrl, app: APP_SLUG }),
      })

      const data = await response.json().catch(() => null) as { token?: unknown } | null
      const token = data && typeof data.token === 'string' ? data.token.trim() : ''
      if (response.ok && token) {
        const res = NextResponse.redirect(cleanUrl)
        res.cookies.set(TOKEN_COOKIE, token, {
          path: '/',
          sameSite: 'lax',
          secure: IS_PROD,
          httpOnly: true,
          maxAge: 7 * 24 * 60 * 60, // 7 days – matches JWT expiry
        })
        // Ensure stale legacy session cookie does not shadow fresh app token.
        res.cookies.set('__session', '', {
          path: '/',
          maxAge: 0,
          sameSite: 'lax',
          secure: IS_PROD,
          httpOnly: true,
        })
        if (IS_PROD) {
          res.cookies.set(LEGACY_TOKEN_COOKIE, '', { path: '/', maxAge: 0 })
        }
        res.headers.set('x-clout-request-id', requestId)
        return res
      }
    } catch {
      // ignore
    }

    if (isApiRoute) {
      return NextResponse.json(
        { error: 'auth_failed', reason: 'code_exchange_failed', rid: requestId },
        { status: 401, headers: { 'Cache-Control': 'no-store', 'x-clout-request-id': requestId } }
      )
    }
    const res = NextResponse.redirect(buildReauthRedirectUrl(cleanUrl.toString(), requestId))
    res.headers.set('Cache-Control', 'no-store')
    res.headers.set('x-clout-request-id', requestId)
    return res
  }

  // Legacy token-in-URL (?token=...) is no longer supported.
  const tokenFromUrl = request.nextUrl.searchParams.get('token')
  if (tokenFromUrl) {
    const cleanUrl = request.nextUrl.clone()
    cleanUrl.searchParams.delete('token')
    cleanUrl.searchParams.delete('rid')

    console.warn(`[rid=${requestId}] Legacy token-in-URL rejected (app=${APP_SLUG})`)
    if (isApiRoute) {
      return NextResponse.json(
        { error: 'auth_failed', reason: 'legacy_token_disabled' },
        { status: 401, headers: { 'Cache-Control': 'no-store', 'x-clout-request-id': requestId } }
      )
    }
    const redirectUrl = `${CLOUT_AUTH_URL}/sign-in?redirect_url=${encodeURIComponent(cleanUrl.toString())}&app=${encodeURIComponent(APP_SLUG)}&error=auth_failed&reason=legacy_token_disabled&rid=${encodeURIComponent(requestId)}`
    const res = NextResponse.redirect(redirectUrl)
    res.headers.set('Cache-Control', 'no-store')
    res.headers.set('x-clout-request-id', requestId)
    res.headers.set('x-clout-legacy-token-in-url', 'rejected')
    return res
  }

  // ヘルスチェックは認証不要
  if (pathname === '/api/health' || pathname.startsWith('/api/health/')) {
    return NextResponse.next()
  }

  // Logout must work even if SSO verify is temporarily failing.
  if (pathname === '/api/auth/logout') {
    return NextResponse.next()
  }

  // Service-to-service bypass: allow other Clout apps to call whitelisted analytics
  // endpoints using a shared secret + pre-verified x-clout-* headers.
  // This avoids the app-slug permission check (the calling app already verified the user).
  if (
    isApiRoute &&
    request.method === 'GET' &&
    CLOUT_SERVICE_SECRET &&
    SERVICE_AUTH_ALLOWED_PATHS.has(pathname) &&
    request.headers.get('x-clout-service-key') === CLOUT_SERVICE_SECRET
  ) {
    const svcUserId = String(request.headers.get('x-clout-user-id') || '').trim()
    const svcEmail = String(request.headers.get('x-clout-user-email') || '').trim()
    if (svcUserId && svcEmail) {
      // Headers are already set by the calling app's proxy — pass through as-is.
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-clout-request-id', requestId)
      requestHeaders.delete('x-clout-service-key') // Don't leak to downstream
      return NextResponse.next({ request: { headers: requestHeaders } })
    }
  }

  // E2E/dev-only bypass (never enabled in production builds).
  // This allows deterministic UI testing without real SSO tokens.
  const bypassEnabled =
    process.env.NODE_ENV !== 'production' &&
    (process.env.SSO_BYPASS === 'true' || process.env.NEXT_PUBLIC_E2E === 'true')

  if (bypassEnabled) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-clout-request-id', requestId)
    requestHeaders.set('x-clout-user-id', process.env.SSO_BYPASS_USER_ID || 'e2e-user')
    requestHeaders.set(
      'x-clout-user-db-id',
      process.env.SSO_BYPASS_USER_DB_ID || '00000000-0000-0000-0000-000000000000'
    )
    requestHeaders.set('x-clout-user-email', process.env.SSO_BYPASS_USER_EMAIL || 'e2e@clout.co.jp')
    requestHeaders.set('x-clout-user-name', encodeURIComponent(process.env.SSO_BYPASS_USER_NAME || 'E2E User'))
    requestHeaders.set(
      'x-clout-company-id',
      resolveCompanyId(process.env.SSO_BYPASS_COMPANY_ID || companyId)
    )
    requestHeaders.set('x-clout-brands', process.env.SSO_BYPASS_BRANDS || 'TL,BE,AM')
    // UI affordance: app switchers can hide apps the user can't access.
    requestHeaders.set(
      'x-clout-apps',
      process.env.SSO_BYPASS_APPS ||
        'clout-dashboard,gifting-app,shorts-os,master,model-crm,sales-targets'
    )
    requestHeaders.set('x-clout-app-permission-level', process.env.SSO_BYPASS_APP_PERMISSION_LEVEL || 'admin')

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  // 旧認証ページ（/auth）へのアクセスはClout Dashboardへリダイレクト
  if (pathname === '/auth' || pathname.startsWith('/auth/')) {
    const res = NextResponse.redirect(buildReauthRedirectUrl(request.url, requestId))
    res.headers.set('Cache-Control', 'no-store')
    res.headers.set('x-clout-request-id', requestId)
    return res
  }

  // SSO認証チェック
  // Token sources (in priority order):
  // 1. App-issued SSO cookies (__Host-clout_token, clout_token)
  // 2. Authorization: Bearer <token> header — used by internal server-to-server
  //    calls (e.g., campaigns route → /api/master/products) where cookies may
  //    not be properly forwarded due to __Host- cookie restrictions.
  // `__session` (legacy Clerk/Supabase) is intentionally excluded:
  // it can contain a stale JWT that Clout Dashboard rejects, causing false 401 loops
  // that get cached in verifyCache for up to 10 seconds.
  const bearerHeader = String(request.headers.get('authorization') || '').trim()
  const bearerToken =
    bearerHeader.toLowerCase().startsWith('bearer ')
      ? bearerHeader.slice(7).trim()
      : ''
  const token =
    request.cookies.get(HOST_TOKEN_COOKIE)?.value ||
    request.cookies.get(LEGACY_TOKEN_COOKIE)?.value ||
    bearerToken

  if (!token) {
    // APIはリダイレクトしない（クライアント側でハンドリングする）
    if (isApiRoute) {
      return NextResponse.json(
        { user: null, rid: requestId },
        { status: 401, headers: { 'Cache-Control': 'no-store', 'x-clout-request-id': requestId } }
      )
    }

    // トークンがない場合はClout Dashboardへリダイレクト
    const res = NextResponse.redirect(buildReauthRedirectUrl(request.url, requestId))
    res.headers.set('Cache-Control', 'no-store')
    res.headers.set('x-clout-request-id', requestId)
    return res
  }

  // トークン検証（リトライ付き）
  try {
    const cached = verifyCache.get(token)
    let status: number
    let data: any = null

    if (cached && Date.now() < cached.expiresAt) {
      status = cached.status
      data = cached.data
    } else {
      const response = await fetchWithRetry(`${CLOUT_AUTH_URL}/api/auth/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-clout-request-id': requestId,
          'x-clout-company-id': companyId,
        },
        body: JSON.stringify({ app: APP_SLUG }),
      })

      status = response.status

      // NOTE: response.ok is false for permission denies (403). We must inspect JSON payload.
      try {
        data = await response.json()
      } catch {
        data = null
      }

      // Only cache definitive results (success, 401, 403). Transient errors
      // (5xx, network failures) are NOT cached to prevent cascading false 401s.
      if (response.ok && data?.allowed !== false) {
        verifyCache.set(token, { expiresAt: Date.now() + VERIFY_CACHE_TTL_ALLOWED_MS, status, data })
      } else if (status === 401 || status === 403 || data?.allowed === false) {
        verifyCache.set(token, { expiresAt: Date.now() + VERIFY_CACHE_TTL_DENIED_MS, status, data })
      }
      // else: transient error — do not cache
    }

    if (status === 401) {
      if (isApiRoute) {
        return NextResponse.json(
          { error: 'auth_failed', reason: 'invalid_or_expired_token', rid: requestId },
          { status: 401, headers: { 'Cache-Control': 'no-store', 'x-clout-request-id': requestId } }
        )
      }
      const res = NextResponse.redirect(buildReauthRedirectUrl(request.url, requestId))
      res.headers.set('Cache-Control', 'no-store')
      res.headers.set('x-clout-request-id', requestId)
      return res
    }

    if (status === 403 || data?.allowed === false) {
      const reason = typeof data?.reason === 'string' && data.reason
        ? data.reason
        : 'no_app_permission'

      if (reason === 'inactive_user') {
        if (isApiRoute) {
          return NextResponse.json(
            { error: 'inactive_user', reason, rid: requestId },
            { status: 403, headers: { 'Cache-Control': 'no-store', 'x-clout-request-id': requestId } }
          )
        }
        return NextResponse.redirect(`${CLOUT_AUTH_URL}/inactive`)
      }

      if (isApiRoute) {
        return NextResponse.json(
          { error: 'unauthorized', reason, rid: requestId },
          { status: 403, headers: { 'Cache-Control': 'no-store', 'x-clout-request-id': requestId } }
        )
      }
      const deniedUrl =
        `${CLOUT_AUTH_URL}/access-denied?app=${encodeURIComponent(APP_SLUG)}&reason=${encodeURIComponent(reason)}&rid=${encodeURIComponent(requestId)}`
      return NextResponse.redirect(deniedUrl)
    }

    if (!data || data?.allowed === undefined) {
      // No JSON body or unexpected schema. Treat as auth verify failure.
      if (isApiRoute) {
        return NextResponse.json(
          { error: `auth_failed:${status}`, rid: requestId, reason: 'verify_unavailable' },
          { status: 503, headers: { 'Cache-Control': 'no-store', 'x-clout-request-id': requestId } }
        )
      }
      const redirectUrl = `${CLOUT_AUTH_URL}/sign-in?redirect_url=${encodeURIComponent(request.url)}&app=${encodeURIComponent(APP_SLUG)}&error=auth_failed&rid=${encodeURIComponent(requestId)}`
      const res = NextResponse.redirect(redirectUrl)
      res.headers.set('Cache-Control', 'no-store')
      res.headers.set('x-clout-request-id', requestId)
      return res
    }

    if (status < 200 || status >= 300) {
      // 4xx/5xx (other than 401/403) -> treat as auth verify failure.
      if (isApiRoute) {
        return NextResponse.json(
          { error: `auth_failed:${status}`, rid: requestId, reason: 'verify_unavailable' },
          { status: 503, headers: { 'Cache-Control': 'no-store', 'x-clout-request-id': requestId } }
        )
      }
      const redirectUrl = `${CLOUT_AUTH_URL}/sign-in?redirect_url=${encodeURIComponent(request.url)}&app=${encodeURIComponent(APP_SLUG)}&error=auth_failed&rid=${encodeURIComponent(requestId)}`
      const res = NextResponse.redirect(redirectUrl)
      res.headers.set('Cache-Control', 'no-store')
      res.headers.set('x-clout-request-id', requestId)
      return res
    }

    // 認証成功 - ユーザー情報をヘッダーに追加
    // Rate-limit write API calls (best-effort, in-memory).
    {
      const method = String(request.method || 'GET').toUpperCase()
      const isMutation = isApiRoute && method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
      if (isMutation) {
        const userKey =
          data.user && typeof data.user.id === 'string' && data.user.id.trim()
            ? data.user.id.trim()
            : token.slice(0, 16)
        const rl = rateLimit({
          key: `mut:${APP_SLUG}:${userKey}`,
          limit: 120,
          windowMs: 60_000,
        })
        if (!rl.ok) {
          return NextResponse.json(
            { error: 'rate_limited' },
            {
              status: 429,
              headers: {
                'Cache-Control': 'no-store',
                'x-clout-request-id': requestId,
                'Retry-After': String(rl.retryAfterSeconds),
              },
            }
          )
        }
      }
    }

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-clout-request-id', requestId)
    requestHeaders.set('x-clout-company-id', resolveCompanyId(data?.company_id || companyId))
    // Forward the verified SSO token so downstream API routes can use it
    // for upstream calls (e.g., Product Master) without re-reading cookies.
    requestHeaders.set('authorization', `Bearer ${token}`)
    if (data.user) {
      requestHeaders.set('x-clout-user-id', data.user.id)
      if (typeof data.user.dbId === 'string' && data.user.dbId.trim()) {
        requestHeaders.set('x-clout-user-db-id', data.user.dbId)
      }
      requestHeaders.set('x-clout-user-email', data.user.email)
      // Header values must be ByteString (0-255). Encode unicode names safely.
      requestHeaders.set('x-clout-user-name', encodeURIComponent(data.user.fullName || ''))
    }
    if (Array.isArray(data.brands)) {
      requestHeaders.set('x-clout-brands', data.brands.join(','))
    }
    if (Array.isArray(data.permissions)) {
      requestHeaders.set('x-clout-apps', data.permissions.join(','))
    }
    const permissionLevel =
      typeof data.appPermissionLevel === 'string' && data.appPermissionLevel.trim()
        ? data.appPermissionLevel.trim()
        : 'view' // Safer default: never grant edit implicitly when the level is missing.
    requestHeaders.set('x-clout-app-permission-level', permissionLevel)

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  } catch (error) {
    console.error('SSO verification error after retries:', error)
    // 検証エラーの場合もリダイレクト
    if (isApiRoute) {
      return NextResponse.json(
        { error: 'auth_failed', rid: requestId, reason: 'verify_fetch_failed' },
        { status: 503, headers: { 'Cache-Control': 'no-store', 'x-clout-request-id': requestId } }
      )
    }
    const redirectUrl = `${CLOUT_AUTH_URL}/sign-in?redirect_url=${encodeURIComponent(request.url)}&app=${encodeURIComponent(APP_SLUG)}&error=auth_failed&rid=${encodeURIComponent(requestId)}`
    const res = NextResponse.redirect(redirectUrl)
    res.headers.set('Cache-Control', 'no-store')
    res.headers.set('x-clout-request-id', requestId)
    return res
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)',
  ],
}
