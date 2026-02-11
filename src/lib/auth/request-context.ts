import { NextRequest, NextResponse } from 'next/server'
import { AppPermissionLevel, canWrite, parseAppPermissionLevel } from '@/lib/auth/permission'

export type AllowedBrand = 'TL' | 'BE' | 'AM'

type AuthContext = {
  userId: string
  email: string
  permissionLevel: AppPermissionLevel
  brands: AllowedBrand[]
}

type AuthResult =
  | { ok: true; context: AuthContext }
  | { ok: false; response: NextResponse }

const CLOUT_AUTH_URL = process.env.NEXT_PUBLIC_CLOUT_AUTH_URL || 'https://dashboard.clout.co.jp'
const APP_SLUG = 'gifting-app'

function parseBrands(raw: string): AllowedBrand[] {
  return raw
    .split(',')
    .map((b) => b.trim().toUpperCase())
    .filter((b): b is AllowedBrand => b === 'TL' || b === 'BE' || b === 'AM')
}

function readToken(request: NextRequest): string {
  const bearer = String(request.headers.get('authorization') || '')
  if (bearer.toLowerCase().startsWith('bearer ')) {
    return bearer.slice(7).trim()
  }

  return (
    request.cookies.get('__Host-clout_token')?.value ||
    request.cookies.get('clout_token')?.value ||
    request.cookies.get('__session')?.value ||
    ''
  ).trim()
}

function badAuth(status: number, body: Record<string, unknown>): AuthResult {
  return {
    ok: false,
    response: NextResponse.json(body, { status }),
  }
}

/**
 * Resolve app auth context for API routes.
 *
 * Primary: trusted headers injected by proxy/middleware.
 * Fallback: direct verify to clout-dashboard when headers are missing.
 * This removes false 401s caused by edge header propagation issues.
 */
export async function requireAuthContext(
  request: NextRequest,
  opts?: { requireWrite?: boolean }
): Promise<AuthResult> {
  const requireWrite = Boolean(opts?.requireWrite)

  const headerUserId = String(request.headers.get('x-clout-user-id') || '').trim()
  const headerEmail = String(request.headers.get('x-clout-user-email') || '').trim()
  const headerPermissionLevel = parseAppPermissionLevel(request.headers)
  const headerBrands = parseBrands(String(request.headers.get('x-clout-brands') || ''))

  // Fast-path: proxy-injected headers.
  if (headerUserId && headerEmail) {
    if (requireWrite && !canWrite(headerPermissionLevel)) {
      return badAuth(403, { error: 'Forbidden' })
    }
    return {
      ok: true,
      context: {
        userId: headerUserId,
        email: headerEmail,
        permissionLevel: headerPermissionLevel,
        brands: headerBrands,
      },
    }
  }

  // Fallback: verify by token when headers are missing.
  const token = readToken(request)
  if (!token) {
    return badAuth(401, { error: 'Not authenticated' })
  }

  const requestId = String(request.headers.get('x-clout-request-id') || '').trim()
  let verifyResp: Response
  try {
    verifyResp = await fetch(`${CLOUT_AUTH_URL}/api/auth/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(requestId ? { 'x-clout-request-id': requestId } : null),
      },
      body: JSON.stringify({ app: APP_SLUG }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    return badAuth(503, { error: 'auth_failed', reason: 'verify_fetch_failed' })
  }

  const data = (await verifyResp.json().catch(() => null)) as
    | {
        allowed?: boolean
        reason?: string
        user?: { id?: string; email?: string }
        appPermissionLevel?: string
        brands?: unknown
        error?: string
      }
    | null

  if (verifyResp.status === 401) {
    return badAuth(401, {
      error: 'auth_failed',
      reason: 'invalid_or_expired_token',
    })
  }

  if (verifyResp.status === 403 || data?.allowed === false) {
    return badAuth(403, {
      error: 'unauthorized',
      reason: data?.reason || 'no_app_permission',
    })
  }

  if (!verifyResp.ok) {
    return badAuth(503, {
      error: `auth_failed:${verifyResp.status}`,
      reason: 'verify_unavailable',
    })
  }

  const userId = String(data?.user?.id || '').trim()
  const email = String(data?.user?.email || '').trim()
  const permissionRaw = String(data?.appPermissionLevel || '').trim().toLowerCase()
  const permissionLevel: AppPermissionLevel =
    permissionRaw === 'none' ||
    permissionRaw === 'view' ||
    permissionRaw === 'edit' ||
    permissionRaw === 'approve' ||
    permissionRaw === 'admin'
      ? permissionRaw
      : 'view'

  const brands = Array.isArray(data?.brands)
    ? (data!.brands as unknown[])
        .map((b) => String(b || '').trim().toUpperCase())
        .filter((b): b is AllowedBrand => b === 'TL' || b === 'BE' || b === 'AM')
    : []

  if (!userId || !email) {
    return badAuth(503, { error: 'auth_failed', reason: 'verify_bad_payload' })
  }

  if (requireWrite && !canWrite(permissionLevel)) {
    return badAuth(403, { error: 'Forbidden' })
  }

  return {
    ok: true,
    context: {
      userId,
      email,
      permissionLevel,
      brands,
    },
  }
}

