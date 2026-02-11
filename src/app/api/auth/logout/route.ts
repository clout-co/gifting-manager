import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function clearAuthCookies(response: NextResponse) {
  const isProd = process.env.NODE_ENV === 'production'
  const legacyCookieOptions = {
    path: '/',
    expires: new Date(0),
    sameSite: 'lax' as const,
    secure: isProd,
    httpOnly: true,
  }
  const hostCookieOptions = {
    ...legacyCookieOptions,
    secure: true,
  }

  response.cookies.set('__Host-clout_token', '', hostCookieOptions)
  response.cookies.set('clout_token', '', legacyCookieOptions)
  response.cookies.set('__session', '', legacyCookieOptions)
}

export async function POST() {
  const response = NextResponse.json({ ok: true })
  clearAuthCookies(response)
  return response
}

function buildCloutSignOutUrl(returnTo: string) {
  const base = process.env.NEXT_PUBLIC_CLOUT_AUTH_URL || 'https://dashboard.clout.co.jp'
  const url = new URL('/sign-out', base)
  url.searchParams.set('redirect_url', returnTo)
  return url
}

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin
  const response = NextResponse.redirect(buildCloutSignOutUrl(origin))
  clearAuthCookies(response)
  return response
}
