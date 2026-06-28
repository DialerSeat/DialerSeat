import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Browser/anon client (RLS enforced)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'public' },
})

// Shared server client (service role — bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Factory for a correctly-configured service-role client. Use this INSTEAD of
// hand-rolling `createClient(url, SERVICE_ROLE_KEY)` inline in a route, so every
// server client is built in one place with the same hardened config (no session
// persistence / token-refresh timers in a serverless request). The `tag` is
// reserved for future per-client tracing and has no effect today.
export function getServiceClient(tag?: string): SupabaseClient {
  void tag
  return createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: 'public' },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
