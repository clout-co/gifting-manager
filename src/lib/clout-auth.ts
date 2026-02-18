/**
 * Clout Dashboard SSO認証ヘルパー
 * ADR-006: SSO認証基盤（Clout Dashboard統合）
 */

interface CloutUser {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  fullName: string
  imageUrl?: string
}

interface VerifyResponse {
  valid: boolean
  user?: CloutUser
  brands?: string[]
  error?: string
}

interface PermissionResponse {
  allowed: boolean
  app?: string
  reason?: string
  user?: Pick<CloutUser, 'id' | 'email' | 'fullName'>
  permissions?: string[]
  brands?: string[]
  error?: string
}

const CLOUT_AUTH_URL = process.env.NEXT_PUBLIC_CLOUT_AUTH_URL || 'https://dashboard.clout.co.jp'

/**
 * Clout DashboardのJWTトークンを検証
 */
export async function verifyCloutToken(token: string): Promise<VerifyResponse> {
  try {
    const response = await fetch(`${CLOUT_AUTH_URL}/api/auth/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    return data as VerifyResponse
  } catch (error) {
    console.error('Clout auth verification failed:', error)
    return { valid: false, error: 'Failed to verify token' }
  }
}

/**
 * アプリへのアクセス権限を確認
 */
export async function checkCloutPermission(token: string): Promise<PermissionResponse> {
  try {
    const response = await fetch(`${CLOUT_AUTH_URL}/api/auth/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ app: 'gifting-app' }),
    })

    const data = await response.json()
    return data as PermissionResponse
  } catch (error) {
    console.error('Clout permission check failed:', error)
    return { allowed: false, error: 'Failed to check permissions' }
  }
}

/**
 * Clout Dashboardへリダイレクト（SSO再認証）
 *
 * - 既にClerkセッションが有効なら、/api/auth/redirect が無操作で新しい code を発行して戻す
 * - 未ログインなら /sign-in に落ちる
 */
export function redirectToCloutSignIn(redirectUrl?: string): void {
  const currentUrl = redirectUrl || (typeof window !== 'undefined' ? window.location.href : '')
  const rid = (() => {
    try {
      return crypto.randomUUID()
    } catch {
      return `${Date.now()}`
    }
  })()
  const reauthUrl =
    `${CLOUT_AUTH_URL}/api/auth/redirect?app=gifting-app&redirect_url=${encodeURIComponent(currentUrl)}&rid=${encodeURIComponent(rid)}`

  if (typeof window !== 'undefined') {
    window.location.href = reauthUrl
  }
}

/**
 * ログアウト処理
 */
export function cloutLogout(): void {
  // localStorageをクリア
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('clout_user')
    // User-scoped caches
    localStorage.removeItem('clout_allowed_brands_cache')
    localStorage.removeItem('clout_allowed_brands_cache_expiry')
  }

  // Clout Dashboardへリダイレクト
  if (typeof window !== 'undefined') {
    // Server-side logout clears httpOnly cookies reliably and then signs out from Clerk.
    window.location.href = '/api/auth/logout'
  }
}

/**
 * Cookieからトークンを取得
 */
export function getCloutToken(): string | null {
  if (typeof document === 'undefined') return null

  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    // NOTE: In production the SSO token is stored as an httpOnly cookie, so this
    // function typically returns null. Keep for dev/debug where cookies might not be httpOnly.
    if (name === '__Host-clout_token' || name === 'clout_token') {
      return value
    }
  }

  return null
}

/**
 * SSO認証が有効かどうか
 * 環境変数で切り替え可能
 */
export function isSSOEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SSO_ENABLED === 'true'
}

export { CLOUT_AUTH_URL }
