import { getServiceClient } from '@/lib/supabase'

// =============================================================================
// CALLING-WINDOW OVERRIDE — named accounts only
// =============================================================================
// Fixes and dialer changes on this platform get tested after hours, which the
// per-lead calling window (lib/callingWindow.ts) correctly refuses. The way
// that was being worked around was editing the window code, testing, and
// editing it back — a process where one forgotten revert leaves TCPA
// enforcement off for every subscriber on the platform.
//
// This replaces that with a per-ACCOUNT override, so the risky state can't be
// left behind by accident:
//
//   - It is keyed to an explicit email allowlist. Nothing about it is a global
//     switch, an env flag that flips behaviour platform-wide, or something a
//     user can turn on for themselves.
//   - It is resolved per request and passed in explicitly. isCallableNow stays
//     a pure function that enforces by default; a caller has to opt a specific
//     user out, which means the bypass is visible at every call site.
//   - It FAILS CLOSED. Any error resolving who the caller is means no override.
//   - Every bypass is logged with the reason it would otherwise have been
//     blocked, so after-hours dialing is auditable rather than invisible.
//
// Scope: whoever is listed here can dial their own leads outside the lead's
// local window. It does not widen anything for anyone else, and it does not
// touch the campaign-level or platform-level controls.
// =============================================================================

const supabase = getServiceClient('callingWindowOverride')

/**
 * Accounts exempt from calling-window hours.
 *
 * Deliberately in code rather than a database column: a column is something
 * that can be set by any path with write access to the users table, including
 * an admin UI misclick, and it would not show up in review. Adding a name here
 * is a commit.
 */
const OVERRIDE_EMAILS = [
  'joshuacribbffl@gmail.com',
]

/** Optional additions, comma-separated. Extends the list above, never replaces it. */
function allowlist(): Set<string> {
  const extra = (process.env.CALLING_WINDOW_OVERRIDE_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
  return new Set([...OVERRIDE_EMAILS.map(e => e.toLowerCase()), ...extra])
}

// Per-instance memo. The dial path calls this on every attempt and predictive
// fanout calls it several times a second; the email behind a Clerk id does not
// change on that timescale. Short TTL so removing a name from the list takes
// effect without a redeploy of every warm instance.
const CACHE_TTL_MS = 5 * 60_000
const cache = new Map<string, { value: boolean; expires: number }>()

/**
 * Whether this Clerk user may dial outside the lead's local calling window.
 *
 * Returns false for anyone not named, for an unknown id, and for any lookup
 * failure — the safe answer in every one of those cases is "enforce".
 */
export async function hasCallingWindowOverride(
  clerkId: string | null | undefined
): Promise<boolean> {
  if (!clerkId) return false

  const emails = allowlist()
  if (emails.size === 0) return false

  const hit = cache.get(clerkId)
  if (hit && hit.expires > Date.now()) return hit.value

  let value = false
  try {
    const { data, error } = await supabase
      .from('users')
      .select('email')
      .eq('clerk_id', clerkId)
      .maybeSingle()

    if (error) throw new Error(error.message)

    const email = (data?.email || '').trim().toLowerCase()
    value = email.length > 0 && emails.has(email)
  } catch (err) {
    // Not cached: a transient Supabase failure must not pin "no override" for
    // the next five minutes, and must never pin the opposite.
    console.error(
      '[callingWindowOverride] could not resolve account, enforcing window:',
      err instanceof Error ? err.message : err
    )
    return false
  }

  cache.set(clerkId, { value, expires: Date.now() + CACHE_TTL_MS })
  return value
}
