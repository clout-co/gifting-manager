import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

type JwtPayload = {
  ref?: string
  role?: string
}

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

function parseJwtPayload(token: string): JwtPayload | null {
  const parts = String(token || '').split('.')
  if (parts.length < 2) return null
  try {
    const raw = Buffer.from(parts[1], 'base64url').toString('utf8')
    const payload = JSON.parse(raw) as JwtPayload
    return payload
  } catch {
    return null
  }
}

function getSupabaseAccessToken(request: NextRequest): string | null {
  const forwarded = String(request.headers.get('x-supabase-access-token') || '').trim()
  if (forwarded) return forwarded

  const auth = String(request.headers.get('authorization') || '').trim()
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim()
  }

  return null
}

export type SupabaseRequestClientResult = {
  // Shared API routes currently operate without generated DB types.
  // Keep this intentionally wide to avoid `never` inference regressions.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any
  usingServiceRole: boolean
  hasSupabaseAccessToken: boolean
  configWarning?: string
}

export function createSupabaseForRequest(args: {
  request: NextRequest
  supabaseUrl?: string
  supabaseAnonKey?: string
  supabaseServiceRoleKey?: string
}): SupabaseRequestClientResult {
  const supabaseUrl = normalizeEnvValue(args.supabaseUrl)
  const supabaseAnonKey = normalizeEnvValue(args.supabaseAnonKey)
  const supabaseServiceRoleKey = normalizeEnvValue(args.supabaseServiceRoleKey)

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  }
  if (!supabaseAnonKey && !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase API key (NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY)')
  }

  const projectRef = parseProjectRefFromUrl(supabaseUrl)
  if (supabaseAnonKey) {
    const anonPayload = parseJwtPayload(supabaseAnonKey)
    if (projectRef && anonPayload?.ref && anonPayload.ref !== projectRef) {
      throw new Error(
        `NEXT_PUBLIC_SUPABASE_ANON_KEY project ref mismatch (${anonPayload.ref} != ${projectRef})`
      )
    }
  }

  let usingServiceRole = false
  let configWarning: string | undefined = 'SUPABASE_SERVICE_ROLE_KEY is missing'
  if (supabaseServiceRoleKey) {
    const servicePayload = parseJwtPayload(supabaseServiceRoleKey)
    if (!servicePayload || servicePayload.role !== 'service_role') {
      configWarning = 'SUPABASE_SERVICE_ROLE_KEY is invalid (expected service_role JWT)'
    } else if (projectRef && servicePayload.ref && servicePayload.ref !== projectRef) {
      configWarning = `SUPABASE_SERVICE_ROLE_KEY project ref mismatch (${servicePayload.ref} != ${projectRef})`
    } else {
      usingServiceRole = true
      configWarning = undefined
    }
  }

  if (!usingServiceRole && !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  const accessToken = usingServiceRole ? null : getSupabaseAccessToken(args.request)
  const headers: Record<string, string> = {}
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  const apiKey = usingServiceRole ? supabaseServiceRoleKey : supabaseAnonKey
  const client = createClient(supabaseUrl, apiKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers,
    },
  })

  return {
    client,
    usingServiceRole,
    hasSupabaseAccessToken: Boolean(accessToken),
    ...(configWarning ? { configWarning } : null),
  }
}
