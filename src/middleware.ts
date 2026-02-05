import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const CLOUT_AUTH_URL = process.env.NEXT_PUBLIC_CLOUT_AUTH_URL || 'https://clout-dashboard.vercel.app'

// 公開パス（認証不要）
const PUBLIC_PATHS = [
  '/api/',           // API routes
  '/_next/',         // Next.js internal
  '/favicon.ico',    // Favicon
  '/auth/redirect',  // SSO redirect callback
]

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 500

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
 * SSO認証ミドルウェア
 * 全てのページアクセスはClout Dashboard経由の認証が必須
 * ローカル認証は廃止（ADR-006）
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 公開パスはスキップ
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // 旧認証ページ（/auth）へのアクセスはClout Dashboardへリダイレクト
  if (pathname === '/auth' || pathname.startsWith('/auth/')) {
    return NextResponse.redirect(new URL(`${CLOUT_AUTH_URL}/sign-in`, request.url))
  }

  // SSO認証チェック
  const token = request.cookies.get('__session')?.value || request.cookies.get('clout_token')?.value

  if (!token) {
    // トークンがない場合はClout Dashboardへリダイレクト
    const redirectUrl = `${CLOUT_AUTH_URL}/sign-in?redirect_url=${encodeURIComponent(request.url)}`
    return NextResponse.redirect(redirectUrl)
  }

  // トークン検証（リトライ付き）
  try {
    const response = await fetchWithRetry(`${CLOUT_AUTH_URL}/api/auth/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ app: 'ggcrm' }),
    })

    const data = await response.json()

    if (!data.allowed) {
      // 権限がない場合
      const redirectUrl = `${CLOUT_AUTH_URL}/sign-in?redirect_url=${encodeURIComponent(request.url)}&error=unauthorized`
      return NextResponse.redirect(redirectUrl)
    }

    // 認証成功 - ユーザー情報をヘッダーに追加
    const requestHeaders = new Headers(request.headers)
    if (data.user) {
      requestHeaders.set('x-clout-user-id', data.user.id)
      requestHeaders.set('x-clout-user-email', data.user.email)
      requestHeaders.set('x-clout-user-name', data.user.fullName || '')
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  } catch (error) {
    console.error('SSO verification error after retries:', error)
    // 検証エラーの場合もリダイレクト
    const redirectUrl = `${CLOUT_AUTH_URL}/sign-in?redirect_url=${encodeURIComponent(request.url)}&error=auth_failed`
    return NextResponse.redirect(redirectUrl)
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*$).*)',
  ],
}
