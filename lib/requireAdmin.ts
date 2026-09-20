import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

























// ── ONE ADMIN LOOKUP PER MINUTE, NOT PER REQUEST ────────────────────────
// Every admin route asks the same question of the same table: is this clerk
// id an admin. With the ops console beating every few seconds and each beat
// touching several admin endpoints, that was 26,000 reads of `users` a day —
// the second largest source of Supabase egress on this project, all of it
// re-answering a question whose answer had not moved.
//
// Sixty seconds, deliberately shorter than the five minutes the calling-window
// allowlist uses, because this one gates ADMIN access: revoking someone takes
// effect within a minute rather than being cached for five.
//
// Only a definite answer is cached. A lookup that errored stays uncached so a
// transient Supabase failure cannot pin "not an admin" — or, worse, "admin" —
// for the next minute. Per instance, so it empties on every deploy.
const ADMIN_CACHE_TTL_MS = 60_000
const adminCache = new Map<string, { isAdmin: boolean; expires: number }>()

function cachedAdmin(clerkId: string): boolean | null {
  const hit = adminCache.get(clerkId)
  if (!hit) return null
  if (hit.expires <= Date.now()) {
    adminCache.delete(clerkId)
    return null
  }
  return hit.isAdmin
}

function rememberAdmin(clerkId: string, isAdmin: boolean): void {
  adminCache.set(clerkId, { isAdmin, expires: Date.now() + ADMIN_CACHE_TTL_MS })
  // Bounded: an unbounded map keyed by user id is a slow leak on a long-lived
  // instance. Cleared wholesale rather than evicted one by one — at this size
  // the next lookup simply re-reads, which is the thing being budgeted anyway.
  if (adminCache.size > 500) adminCache.clear()
}

/**
 * Drop a cached answer immediately.
 *
 * For the path that CHANGES someone's admin flag: without this the change
 * would not be believed for up to a minute on the instance that made it.
 */
export function forgetAdminCache(clerkId: string): void {
  adminCache.delete(clerkId)
}

export type GateResult =
  | { ok: true; clerkId: string }
  | { ok: false; status: number; message: string }

export async function requireAdmin(): Promise<GateResult> {
  const { userId } = await auth()
  if (!userId) {
    return { ok: false, status: 401, message: 'Not signed in' }
  }

  const cached = cachedAdmin(userId)
  if (cached !== null) {
    return cached
      ? { ok: true, clerkId: userId }
      : { ok: false, status: 403, message: 'Not authorized' }
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('clerk_id', userId)
    .maybeSingle()

  if (error) {
    // Deliberately not cached — see ADMIN_CACHE_TTL_MS.
    return { ok: false, status: 500, message: 'Admin lookup failed' }
  }
  rememberAdmin(userId, !!data?.is_admin)
  if (!data?.is_admin) {
    return { ok: false, status: 403, message: 'Not authorized' }
  }
  return { ok: true, clerkId: userId }
}


export async function checkIsAdmin(): Promise<{ isAdmin: boolean; userId: string | null }> {
  const { userId } = await auth()
  if (!userId) return { isAdmin: false, userId: null }

  const cached = cachedAdmin(userId)
  if (cached !== null) return { isAdmin: cached, userId }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('clerk_id', userId)
    .maybeSingle()

  // An errored or missing lookup answers false for THIS request but is not
  // remembered, so the next one asks again.
  if (error || !data) return { isAdmin: false, userId }
  rememberAdmin(userId, !!data.is_admin)
  return { isAdmin: !!data.is_admin, userId }
}