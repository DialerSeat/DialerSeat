import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// =============================================================================
// Supabase clients
// =============================================================================
// Three ways to reach the database, one correct config for each:
//
//   supabase          — browser/anon client (RLS enforced).
//   supabaseAdmin     — the shared server client (service role, bypasses RLS).
//                       Most server code should just import this.
//   getServiceClient()— factory returning a service-role client with the SAME
//                       hardened config. Use it INSTEAD of hand-rolling
//                       `createClient(url, SERVICE_ROLE_KEY)` inline in a route.
//
// WHY THE FACTORY EXISTS:
//   ~60 routes were each constructing their own service-role client inline, and
//   most omitted `persistSession:false`/`autoRefreshToken:false` — which spins
//   up pointless token-refresh timers in a serverless request and leaves no
//   single place to enforce config, attach tracing, or evolve the client. The
//   factory is that single blessed source. Existing `supabaseAdmin` imports keep
//   working unchanged; inline routes migrate to `getServiceClient()` over time.
//
// NOTE ON STATEMENT TIMEOUTS:
//   A query timeout is NOT set per-client here — the Supabase Client API can't
//   carry a session `statement_timeout`. It's enforced at the ROLE level in the
//   database (ALTER ROLE service_role SET statement_timeout=...), which covers
//   every query from every client (factory or inline) without code changes.
// =============================================================================

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

/**
 * Returns a service-role Supabase client configured exactly like `supabaseAdmin`
 * (bypasses RLS; no session persistence or token refresh).
 *
 * Prefer importing `supabaseAdmin` when you just need the shared instance. Use
 * this factory to REPLACE inline `createClient(url, SERVICE_ROLE_KEY)` calls in
 * routes, so every server client is constructed in one correct place.
 *
 * @param tag optional label for the caller (reserved for future per-client
 *            request logging / tracing; has no effect on behavior today).
 */
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
