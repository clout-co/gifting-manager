import { createClient } from '@supabase/supabase-js'

const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
const supabaseAnonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()
const hasEnv = Boolean(supabaseUrl && supabaseAnonKey)

if (!hasEnv) {
  // Preview env parity: do not crash at module-eval time. Fail only when used.
  console.warn('Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

function missingEnvFetch(): Promise<Response> {
  throw new Error(
    'Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY). ' +
    'Set them for Vercel Preview/Production, or in .env.local for local dev.'
  )
}

const clientOptions: Parameters<typeof createClient>[2] = hasEnv
  ? undefined
  : {
      global: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fetch: missingEnvFetch as any,
      },
    }

export const supabase = createClient(
  hasEnv ? supabaseUrl : 'https://example.supabase.co',
  hasEnv ? supabaseAnonKey : 'invalid-anon-key',
  clientOptions
)

// サーバーサイド用
export const createServerClient = () => {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  const key = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()

  if (!url || !key) {
    throw new Error('Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  return createClient(url, key)
};
