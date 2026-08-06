import { auth } from '@clerk/nextjs/server'
import { checkIsAdmin } from '@/lib/requireAdmin'

// =============================================================================
// ANALYTICS SCOPE — whose numbers am I allowed to read?
// =============================================================================
// Every analytics endpoint answers the same question and they had four
// different answers to it, one of which didn't work:
//
//   summary      accepted ?user_id and then threw it away —
//                `(requested && requested === auth) ? auth : auth` always
//                returns auth, so the parameter looked supported and wasn't.
//   timeseries   \
//   dispositions  } always the caller, no parameter at all.
//   campaigns    /
//
// That was fine while analytics was only ever self-service. The admin user
// tracker now renders a specific user's own dashboard, which needs to read
// someone else's numbers — so the rule has to be stated once, here, rather
// than reinvented per route.
//
// THE RULE: you get your own data. An ADMIN may request another user's by id.
// Nobody else can, and a non-admin passing ?user_id is silently scoped back to
// themselves rather than refused — the parameter is an admin capability, not
// an error for everyone else to trip over.
// =============================================================================

export interface AnalyticsScope {
  /** The user whose data should be returned. */
  userId: string
  /** True when an admin is looking at somebody else. */
  isImpersonating: boolean
}

export type ScopeResult =
  | { ok: true; scope: AnalyticsScope }
  | { ok: false; status: number; error: string }

/**
 * Resolve which user's analytics to serve for this request.
 *
 * `requestedUserId` is the raw `?user_id` value. Pass it through verbatim —
 * this decides whether to honour it.
 */
export async function resolveAnalyticsScope(
  requestedUserId: string | null | undefined
): Promise<ScopeResult> {
  const { userId: authUserId } = await auth()
  if (!authUserId) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  // No request to view someone else, or a request to view yourself.
  if (!requestedUserId || requestedUserId === authUserId) {
    return { ok: true, scope: { userId: authUserId, isImpersonating: false } }
  }

  // Takes no argument — it reads the session itself.
  const { isAdmin } = await checkIsAdmin()
  if (!isAdmin) {
    // Deliberately NOT a 403. Returning the caller's own data keeps a stray or
    // stale ?user_id from breaking a normal user's dashboard, and tells an
    // attacker nothing about whether the id they guessed exists.
    return { ok: true, scope: { userId: authUserId, isImpersonating: false } }
  }

  return { ok: true, scope: { userId: requestedUserId, isImpersonating: true } }
}
