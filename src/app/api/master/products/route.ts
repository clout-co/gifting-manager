import { NextRequest, NextResponse } from 'next/server'
import { fetchCloutMaster } from '@/lib/clout-master'

type MasterApp = { id: string; url?: string }

const PRODUCT_MASTER_CACHE_TTL_MS = 5 * 60_000
let cachedProductMasterUrl: string | null = null
let cachedProductMasterAt = 0

async function getProductMasterConfig(request: { headers: { get(name: string): string | null } }) {
  const now = Date.now()
  if (cachedProductMasterUrl && now - cachedProductMasterAt < PRODUCT_MASTER_CACHE_TTL_MS) {
    return { baseUrl: cachedProductMasterUrl }
  }

  // Prefer the Clout Dashboard App Registry (single source of truth).
  try {
    const response = await fetchCloutMaster(
      request,
      '/api/master/apps',
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      }
    )

    if (response.ok) {
      const data = (await response.json().catch(() => null)) as { apps?: MasterApp[] } | null
      const apps = Array.isArray(data?.apps) ? (data?.apps as MasterApp[]) : []
      const master = apps.find((a) => a && a.id === 'master' && typeof a.url === 'string' && a.url)
      const url = String(master?.url || '').trim()
      if (url) {
        cachedProductMasterUrl = url
        cachedProductMasterAt = now
        return { baseUrl: url }
      }
    }
  } catch {
    // ignore (fallback below)
  }

  // Fallback (dev/local): allow explicit base URL override.
  const fromEnv = String(process.env.PRODUCT_MASTER_URL || process.env.NEXT_PUBLIC_PRODUCT_MASTER_URL || '').trim()
  if (fromEnv) {
    cachedProductMasterUrl = fromEnv
    cachedProductMasterAt = now
    return { baseUrl: fromEnv }
  }

  return { baseUrl: '' }
}

function getCloutToken(request: NextRequest): string | null {
  // 1. Prefer Authorization header (proxy forwards the original Bearer token).
  const bearer = String(request.headers.get('authorization') || '').trim()
  if (bearer.toLowerCase().startsWith('bearer ')) {
    const t = bearer.slice(7).trim()
    if (t) return t
  }
  // 2. App-issued SSO cookies (direct browser access).
  return (
    request.cookies.get('__Host-clout_token')?.value ||
    request.cookies.get('clout_token')?.value ||
    null
  )
}

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

function parseLimit(value: string | null): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 20
  return Math.max(1, Math.min(50, Math.floor(n)))
}

function canonicalizeProductCode(value: string): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ')
    .replace(/[^0-9A-Z]/g, '')
}

/**
 * Product Master API proxy (products)
 *
 * - Uses the current user's SSO token (cookie) to access Product Master API.
 * - Avoids cross-origin fetch and hides upstream base URL configuration.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const brandRaw = String(searchParams.get('brand') || '').trim()
  const brand = canonicalBrandCode(brandRaw)
  const q = String(searchParams.get('q') || '').trim()
  const limit = parseLimit(searchParams.get('limit'))

  if (!brandRaw) {
    return NextResponse.json({ error: 'brand is required' }, { status: 400 })
  }
  if (!isValidBrandCode(brandRaw)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }
  if (q.length > 200) {
    return NextResponse.json({ error: 'q is too long' }, { status: 400 })
  }

  // Avoid fetching full product catalogs for typeahead use-cases.
  if (q.length < 2) {
    return NextResponse.json(
      { products: [], count: 0 },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  // E2E/dev-only stub (never enabled in production builds).
  // This keeps UI tests deterministic without Product Master dependency.
  if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_E2E === 'true') {
    const fixtures = [
      {
        id: 'e2e-tf-2408',
        product_code: 'TF-2408',
        title: 'E2E Test Product',
        sku: 'TF-2408',
        image_url: null,
        cost: 1234,
        sale_date: '2026-02-01',
      },
      {
        id: 'e2e-tf-2409',
        product_code: 'TF-2409',
        title: 'E2E Test Product 2',
        sku: 'TF-2409',
        image_url: null,
        cost: 2345,
        sale_date: '2026-02-15',
      },
    ]

    const qCanon = canonicalizeProductCode(q)
    const products = fixtures
      .filter((p) => canonicalizeProductCode(p.product_code).includes(qCanon))
      .slice(0, limit)

    return NextResponse.json(
      { products, count: products.length },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const token = getCloutToken(request)
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated', reason: 'missing_sso_token' }, { status: 401 })
  }

  const { baseUrl } = await getProductMasterConfig(request)
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'Missing Product Master base URL (Clout App Registry)' },
      { status: 500 }
    )
  }
  let upstreamBase: URL
  try {
    upstreamBase = new URL(baseUrl)
  } catch {
    return NextResponse.json(
      { error: 'Invalid PRODUCT_MASTER_URL' },
      { status: 500 }
    )
  }

  const upstreamUrl = new URL('/api/products', upstreamBase)
  upstreamUrl.searchParams.set('brand', brand)
  upstreamUrl.searchParams.set('q', q)

  try {
    const response = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers: {
        // Product Master auth implementations differ:
        // - Some apps read `__session` (Clerk) cookie
        // - Others read `clout_token` (SSO relay) cookie
        // Send both, and also include Authorization for maximum compatibility.
        Cookie: `__session=${token}; __Host-clout_token=${token}; clout_token=${token}`,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      redirect: 'manual',
      cache: 'no-store',
    })

    // If SSO fails, Product Master may redirect to /sign-in. Do not follow redirects.
    if (response.status >= 300 && response.status < 400) {
      return NextResponse.json({ error: 'Unauthorized', reason: 'product_master_auth_redirect' }, { status: 401 })
    }

    const data = await response.json().catch(() => null)
    if (!response.ok) {
      const msg =
        data && typeof data.error === 'string'
          ? data.error
          : `Upstream error: ${response.status}`
      const reason =
        data && typeof data.reason === 'string'
          ? data.reason
          : undefined
      return NextResponse.json({ error: msg, reason }, { status: response.status })
    }

    const rows: unknown[] =
      Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.products)
          ? data.products
          : Array.isArray(data?.items)
            ? data.items
            : []
    const products = rows
      .map((p: unknown) => {
        const row =
          p && typeof p === 'object' ? (p as Record<string, unknown>) : {}

        const productCode = String(row.product_code || '').trim()
        const rawCost = row.cost
        const cost =
          rawCost === null || rawCost === undefined || rawCost === ''
            ? null
            : Number(rawCost)

        const rawSaleDate =
          row.sales_date ??
          row.sale_date ??
          row.release_date ??
          null
        const saleDate = typeof rawSaleDate === 'string'
          ? rawSaleDate.slice(0, 10)
          : null

        return {
          id: String(row.id || productCode),
          product_code: productCode,
          title: row.title ? String(row.title) : null,
          sku: row.sku ? String(row.sku) : null,
          image_url: row.image_url ? String(row.image_url) : null,
          cost: Number.isFinite(cost as number) ? (cost as number) : null,
          sale_date: saleDate,
        }
      })
      .filter((p) => Boolean(p.product_code))
      .slice(0, limit)

    return NextResponse.json(
      { products, count: products.length },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 502 }
    )
  }
}
