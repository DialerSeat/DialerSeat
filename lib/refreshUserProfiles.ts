import { supabaseAdmin } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────────────────
// THE NAME ON A ROSTER SHOULD BE THE NAME THE PERSON HAS
//
// Clerk owns the profile; the users table holds the copy every screen reads.
// Two things keep that copy honest, and neither was enough on its own:
//
//   The user.updated webhook — instant, but only if that event is subscribed
//   in the Clerk dashboard, and a name that silently never syncs looks exactly
//   like a name nobody changed.
//
//   A refresh on sign-in — reliable, but it corrects the profile of whoever
//   just signed IN. The person reading a roster is the team owner, and no
//   amount of the owner signing in will fix an agent's name.
//
// This is the third: when a roster is read, the names on it are re-checked
// against Clerk in one bulk call. It closes the case the other two cannot —
// somebody looking at a list of other people.
//
// RATE LIMITED IN MEMORY. A roster is re-read constantly (every refresh, every
// tab switch, every poll), and Clerk is a network call with a rate limit.
// Checking a given person at most once every ten minutes per process keeps
// this off the hot path while still being far faster than "next time they
// happen to sign in".
//
// NEVER THROWS, NEVER BLOCKS. A stale display name is a small problem; a
// roster that fails to load because Clerk was slow is a large one.
// ─────────────────────────────────────────────────────────────────────────

const CHECKED = new Map<string, number>()
const RECHECK_AFTER_MS = 10 * 60 * 1000

/** Clerk allows a bounded page size; rosters larger than this are simply
 *  refreshed a slice at a time across successive loads. */
const MAX_PER_CALL = 100

export async function refreshUserProfiles(clerkIds: string[]): Promise<void> {
  try {
    const now = Date.now()
    const due = Array.from(new Set(clerkIds.filter(Boolean)))
      .filter(id => {
        const last = CHECKED.get(id)
        return last === undefined || now - last > RECHECK_AFTER_MS
      })
      .slice(0, MAX_PER_CALL)

    if (due.length === 0) return

    // Marked before the call, not after. If Clerk is failing, retrying every
    // roster load turns one broken dependency into a request storm.
    for (const id of due) CHECKED.set(id, now)

    const { clerkClient } = await import('@clerk/nextjs/server')
    const client = await clerkClient()
    const list = await client.users.getUserList({ userId: due, limit: MAX_PER_CALL })

    const { data: rows } = await supabaseAdmin
      .from('users')
      .select('clerk_id, first_name, last_name, username, email')
      .in('clerk_id', due)

    const current = new Map((rows || []).map((r: any) => [r.clerk_id, r]))

    for (const u of list.data) {
      const existing = current.get(u.id)
      if (!existing) continue

      const email =
        u.emailAddresses?.find(e => e.id === u.primaryEmailAddressId)?.emailAddress ||
        u.emailAddresses?.[0]?.emailAddress ||
        null

      const changed =
        existing.first_name !== (u.firstName || null) ||
        existing.last_name !== (u.lastName || null) ||
        existing.username !== (u.username || null) ||
        (email !== null && existing.email !== email)

      if (!changed) continue

      await supabaseAdmin
        .from('users')
        .update({
          first_name: u.firstName || null,
          last_name: u.lastName || null,
          username: u.username || null,
          ...(email ? { email } : {}),
        })
        .eq('clerk_id', u.id)
    }
  } catch (err) {
    console.error('[refreshUserProfiles] skipped:', (err as any)?.message || err)
  }
}
