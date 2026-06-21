import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// =============================================================================
// REQUIRE USER — the identity boundary for user-scoped API routes
// =============================================================================
// THE BUG THIS FIXES:
//   Several routes scoped their queries to a `user_id` taken from the QUERY
//   STRING (e.g. /api/leads/export?user_id=<anything>). The middleware only
//   verified that *a* user was signed in — never that the signed-in user
//   matched the requested user_id. Because every server query uses the
//   Supabase SERVICE-ROLE key (which bypasses Row-Level Security), any
//   authenticated user could read or export another user's data by changing
//   the param. This is an IDOR / cross-tenant data exposure.
//
// THE FIX:
//   Resolve identity from the Clerk session (auth()) — the ONLY trustworthy
//   source — and IGNORE whatever the client put in the URL. Our `user_id`
//   columns store the Clerk id (see leads/upload, campaigns/create), so the
//   authenticated Clerk userId is exactly the value these queries need.
//
// USAGE (drop-in at the top of a route handler):
//
//   const gate = await requireUser()
//   if (!gate.ok) return gate.response
//   const userId = gate.userId          // <- use THIS, never searchParams
//
// If you still want to accept a `user_id` param for backwards-compat (e.g. an
// old client that sends it), use requireUserMatching() which 403s on mismatch
// instead of silently ignoring it. Prefer requireUser() for new code.
// =============================================================================

export type RequireUserResult =
  | { ok: true; userId: string; response: null }
  | { ok: false; userId: null; response: NextResponse }

/**
 * Resolves the authenticated Clerk user id. Returns a 401 response if the
 * caller is not signed in. The returned userId is the trusted identity to
 * scope all queries by — callers MUST use it instead of any client-supplied
 * user_id.
 */
export async function requireUser(): Promise<RequireUserResult> {
  const { userId } = await auth()
  if (!userId) {
    return {
      ok: false,
      userId: null,
      response: NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      ),
    }
  }
  return { ok: true, userId, response: null }
}

/**
 * Like requireUser(), but if the request also carries a `user_id` (query or
 * body), assert it matches the authenticated user. Returns 403 on mismatch.
 *
 * Use this when a route's existing contract takes a user_id and you want an
 * explicit, auditable rejection rather than silently overriding it. The
 * `requested` argument is whatever the client sent (may be null).
 */
export async function requireUserMatching(
  requested: string | null | undefined
): Promise<RequireUserResult> {
  const gate = await requireUser()
  if (!gate.ok) return gate

  // A missing param is fine — we just use the authenticated id. A PRESENT
  // param that disagrees is a red flag (stale client, or an attempt to read
  // someone else's data) and gets refused.
  if (requested && requested !== gate.userId) {
    return {
      ok: false,
      userId: null,
      response: NextResponse.json(
        { success: false, error: 'Forbidden: user mismatch' },
        { status: 403 }
      ),
    }
  }
  return gate
}