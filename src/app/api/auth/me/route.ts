import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * SSO認証ユーザー情報API
 *
 * middleware.ts が Clout Dashboard で検証済みのユーザー情報/許可ブランドを
 * リクエストヘッダーに注入している。このエンドポイントはそのヘッダーを
 * クライアントに返す。
 */
export async function GET(request: NextRequest) {
  const userId = String(request.headers.get('x-clout-user-id') || '').trim()
  const email = String(request.headers.get('x-clout-user-email') || '').trim()
  const companyId = String(
    request.headers.get('x-clout-company-id') || process.env.CLOUT_COMPANY_ID || 'clout'
  )
    .trim()
    .toLowerCase()

  const parseName = (raw: string) => {
    try {
      return raw ? decodeURIComponent(raw) : ''
    } catch {
      return raw || ''
    }
  }
  const parseList = (raw: string) =>
    raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)

  // Fast-path: middleware/proxy injected headers.
  if (userId && email) {
    const rawName = String(request.headers.get('x-clout-user-name') || '')
    const brands = parseList(String(request.headers.get('x-clout-brands') || ''))
    const apps = parseList(String(request.headers.get('x-clout-apps') || ''))
    return NextResponse.json({
      user: {
        id: userId,
        email,
        name: parseName(rawName),
      },
      company_id: companyId,
      brands,
      apps,
    })
  }

  // Fallback: resolve from token directly when headers are unexpectedly missing.
  // `__session` (legacy Clerk/Supabase) excluded to prevent false 401 loops.
  const token =
    request.cookies.get('__Host-clout_token')?.value ||
    request.cookies.get('clout_token')?.value ||
    ''
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  const authUrl = process.env.NEXT_PUBLIC_CLOUT_AUTH_URL || 'https://dashboard.clout.co.jp'
  const requestId = String(request.headers.get('x-clout-request-id') || '').trim()
  const response = await fetch(`${authUrl}/api/auth/verify`, {
    method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(requestId ? { 'x-clout-request-id': requestId } : null),
        ...(companyId ? { 'x-clout-company-id': companyId } : null),
      },
      body: JSON.stringify({ app: 'gifting-app' }),
      cache: 'no-store',
  }).catch(() => null)

  if (!response) {
    return NextResponse.json({ user: null }, { status: 503 })
  }

  const data = (await response.json().catch(() => null)) as
    | {
        allowed?: boolean
        user?: { id?: string; email?: string; fullName?: string }
        company_id?: string
        brands?: unknown
        permissions?: unknown
      }
    | null

  if (!response.ok || data?.allowed === false || !data?.user?.id || !data?.user?.email) {
    return NextResponse.json({ user: null }, { status: response.status === 401 ? 401 : 403 })
  }

  const brands = Array.isArray(data.brands)
    ? data.brands.map((b) => String(b || '').trim()).filter(Boolean)
    : []
  const apps = Array.isArray(data.permissions)
    ? data.permissions.map((a) => String(a || '').trim()).filter(Boolean)
    : []

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      name: String(data.user.fullName || ''),
    },
    company_id: String(data.company_id || companyId).trim().toLowerCase(),
    brands,
    apps,
  })
}
