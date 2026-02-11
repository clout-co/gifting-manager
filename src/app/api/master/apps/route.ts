import { NextRequest, NextResponse } from 'next/server'
import { fetchCloutMaster } from '@/lib/clout-master'

/**
 * Clout Dashboard Master API proxy (apps)
 *
 * - service-to-service は Vercel OIDC（`Authorization: Bearer <oidc-jwt>`）で認証
 * - CORSを避ける（same-origin fetch）
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const qs = url.searchParams.toString()
    const upstreamPath = `/api/master/apps${qs ? `?${qs}` : ''}`

    const response = await fetchCloutMaster(request, upstreamPath, {
      // Apps registry changes rarely, but keep it reasonably fresh.
      next: { revalidate: 60 * 5 },
    })

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
