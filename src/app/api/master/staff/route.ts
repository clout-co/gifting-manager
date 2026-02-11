import { NextRequest, NextResponse } from 'next/server'
import { fetchCloutMaster } from '@/lib/clout-master'

function canonicalBrandCode(value: string): string {
  const key = String(value || '').trim().toLowerCase()
  if (!key) return ''

  const aliases: Record<string, string> = {
    'thats-life': 'TL',
    'thats life': 'TL',
    'thats_life': 'TL',
    tl: 'TL',
    belvet: 'BE',
    be: 'BE',
    antimid: 'AM',
    am: 'AM',
  }

  return (aliases[key] || key).toUpperCase()
}

function isValidBrandCode(value: string): boolean {
  const code = canonicalBrandCode(value)
  return code === 'TL' || code === 'BE' || code === 'AM'
}

/**
 * Clout Dashboard Master API proxy (staff)
 *
 * - service-to-service は Vercel OIDC（`Authorization: Bearer <oidc-jwt>`）で認証
 * - CORSを避ける（same-origin fetch）
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const brandParam = url.searchParams.get('brand')
    const brand = brandParam ? canonicalBrandCode(brandParam) : ''

    if (brandParam && !isValidBrandCode(brandParam)) {
      return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
    }

    const qs = url.searchParams.toString()
    const upstreamPath = `/api/master/staff${qs ? `?${qs}` : ''}`

    const response = await fetchCloutMaster(request, upstreamPath, {
      cache: 'no-store',
    })

    const data = await response.json().catch(() => null)
    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status }
      )
    }

    // brand 指定がない場合は、そのまま返す
    if (!brand) {
      return NextResponse.json(data)
    }

    // brand フィルタは upstream (/api/master/staff) が処理する
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 502 }
    )
  }
}
