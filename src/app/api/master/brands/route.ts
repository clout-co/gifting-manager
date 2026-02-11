import { NextResponse } from 'next/server'
import { fetchCloutMaster } from '@/lib/clout-master'

/**
 * Clout Dashboard Master API proxy (brands)
 *
 * - service-to-service は Vercel OIDC（`Authorization: Bearer <oidc-jwt>`）で認証
 * - CORSを避ける（same-origin fetch）
 */
export async function GET(request: Request) {
  try {
    const response = await fetchCloutMaster(
      { headers: request.headers },
      '/api/master/brands',
      // Brands are stable enough for caching.
      { next: { revalidate: 60 * 60 } }
    )

    const data = await response.json().catch(() => null)
    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 502 }
    )
  }
}
