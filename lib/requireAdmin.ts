import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

// =============================================================================
// ADMIN GATE — single source of truth (CONSOLIDATED)
// =============================================================================
// Previously there were TWO requireAdmin() functions with OPPOSITE contracts:
//   - lib/admin.ts          → THREW a Response (consumed via try/catch)
//   - lib/requireAdmin.ts   → RETURNED a GateResult (consumed via if(!gate.ok))
//
// Sharing a name with opposite behavior is a landmine: a copy-paste of the
// wrong consumption pattern produces a route that either crashes or — worse —
// FAILS OPEN past the gate. This file is now the ONLY implementation.
//
// Contract: NON-THROWING. Returns a discriminated result.
//
//   const gate = await requireAdmin()
//   if (!gate.ok) {
//     return NextResponse.json({ error: gate.message }, { status: gate.status })
//   }
//   // gate.clerkId is the authenticated admin's id
//
// lib/admin.ts re-exports from here (see that file) and additionally provides
// a throwing adapter (requireAdminOrThrow) so the legacy try/catch call sites
// keep working until they are migrated. New code should import from here.
// =============================================================================

export type GateResult =
  | { ok: true; clerkId: string }
  | { ok: false; status: number; message: string }

export async function requireAdmin(): Promise<GateResult> {
  const { userId } = await auth()
  if (!userId) {
    return { ok: false, status: 401, message: 'Not signed in' }
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('clerk_id', userId)
    .maybeSingle()

  if (error) {
    return { ok: false, status: 500, message: 'Admin lookup failed' }
  }
  if (!data?.is_admin) {
    return { ok: false, status: 403, message: 'Not authorized' }
  }
  return { ok: true, clerkId: userId }
}

/**
 * Convenience for client components / simple checks that just want a boolean.
 * Does not enforce — callers decide what to do with the result.
 */
export async function checkIsAdmin(): Promise<{ isAdmin: boolean; userId: string | null }> {
  const { userId } = await auth()
  if (!userId) return { isAdmin: false, userId: null }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('clerk_id', userId)
    .maybeSingle()

  if (error || !data) return { isAdmin: false, userId }
  return { isAdmin: !!data.is_admin, userId }
}