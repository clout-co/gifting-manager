import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { fetchCloutMaster, getCloutApiUrl, getVercelOidcTokenFromHeaders } from '@/lib/clout-master'

type CheckResult = { ok: boolean; error?: string }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function normalizeEnvValue(value: string | undefined): string {
  return String(value || '')
    .replace(/\\n/g, '')
    .trim()
}

function parseProjectRefFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname
    const ref = host.split('.')[0]?.trim() || ''
    return ref || null
  } catch {
    return null
  }
}

function parseJwtPayload(token: string): { ref?: string; role?: string } | null {
  const parts = String(token || '').split('.')
  if (parts.length < 2) return null
  try {
    const raw = Buffer.from(parts[1], 'base64url').toString('utf8')
    return JSON.parse(raw) as { ref?: string; role?: string }
  } catch {
    return null
  }
}

// Avoid throwing at module-eval time when env vars are missing (preview / misconfig).
const normalizedSupabaseUrl = normalizeEnvValue(supabaseUrl)
const normalizedSupabaseAnonKey = normalizeEnvValue(supabaseAnonKey)
const supabase =
  normalizedSupabaseUrl && normalizedSupabaseAnonKey
    ? createClient(normalizedSupabaseUrl, normalizedSupabaseAnonKey)
    : null

export async function GET(request: NextRequest) {
  const checks: Record<string, CheckResult> = {}
  const normalizedUrl = normalizedSupabaseUrl
  const normalizedAnonKey = normalizedSupabaseAnonKey
  const normalizedServiceKey = normalizeEnvValue(supabaseServiceRoleKey)

  if (!normalizedUrl || !normalizedAnonKey) {
    checks.database = { ok: false, error: 'Missing Supabase env vars' }
  } else {
    try {
      const { error } = await supabase!
        .from('staffs')
        .select('id')
        .limit(1)
      checks.database = error ? { ok: false, error: error.message } : { ok: true }
    } catch (error) {
      checks.database = { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  if (!normalizedUrl || !normalizedAnonKey) {
    checks.supabaseConfig = { ok: false, error: 'Missing Supabase env vars' }
  } else {
    const projectRef = parseProjectRefFromUrl(normalizedUrl)
    const anonPayload = parseJwtPayload(normalizedAnonKey)
    const servicePayload = normalizedServiceKey ? parseJwtPayload(normalizedServiceKey) : null

    if (projectRef && anonPayload?.ref && anonPayload.ref !== projectRef) {
      checks.supabaseConfig = {
        ok: false,
        error: `NEXT_PUBLIC_SUPABASE_ANON_KEY ref mismatch (${anonPayload.ref} != ${projectRef})`,
      }
    } else if (!normalizedServiceKey) {
      checks.supabaseConfig = { ok: false, error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }
    } else if (!servicePayload || servicePayload.role !== 'service_role') {
      checks.supabaseConfig = { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY is invalid' }
    } else if (projectRef && servicePayload.ref && servicePayload.ref !== projectRef) {
      checks.supabaseConfig = {
        ok: false,
        error: `SUPABASE_SERVICE_ROLE_KEY ref mismatch (${servicePayload.ref} != ${projectRef})`,
      }
    } else {
      checks.supabaseConfig = { ok: true }
    }
  }

  const masterUrl = getCloutApiUrl()
  const serviceToken = getVercelOidcTokenFromHeaders(request.headers)
  if (!masterUrl) {
    checks.masterApi = { ok: false, error: 'Missing CLOUT_API_URL (or NEXT_PUBLIC_CLOUT_API_URL)' }
  } else if (!serviceToken) {
    checks.masterApi = { ok: false, error: 'Missing Vercel OIDC token' }
  } else {
    try {
      const response = await fetchCloutMaster(request, '/api/master/brands', {
        cache: 'no-store',
      })
      checks.masterApi = response.ok ? { ok: true } : { ok: false, error: `API returned ${response.status}` }
    } catch (error) {
      checks.masterApi = { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  const authUrl = process.env.NEXT_PUBLIC_CLOUT_AUTH_URL || masterUrl || 'https://dashboard.clout.co.jp'

  // Token-based healthcheck is brittle (token rotation / Clerk instance mismatch).
  // Here we only verify the auth endpoint is reachable and correctly returns 401 for an invalid token.
  try {
    const response = await fetch(`${authUrl}/api/auth/verify`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer healthcheck-invalid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ app: 'ggcrm' }),
      cache: 'no-store',
    })
    checks.permissions = response.status === 401
      ? { ok: true }
      : { ok: false, error: `Auth API ${response.status}` }
  } catch (error) {
    checks.permissions = { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }

  const ok = Object.values(checks).every((check) => check.ok)

  return NextResponse.json(
    {
      ok,
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  )
}
