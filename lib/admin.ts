// =============================================================================
// lib/admin.ts — COMPATIBILITY SHIM (post-consolidation)
// =============================================================================
// The real admin gate now lives in lib/requireAdmin.ts (non-throwing,
// GateResult contract). This file used to contain a SECOND, divergent
// requireAdmin() that THREW a Response. To avoid breaking the 14 routes that
// still `import { requireAdmin } from '@/lib/admin'` and consume it via
// try/catch, we keep a throwing adapter here under the SAME old behavior.
//
// DESIGN (permanent, deliberate — not a temporary shim):
//   Two consumption styles coexist on purpose, both backed by the ONE gate in
//   lib/requireAdmin.ts so they can never disagree:
//     - throwing  : `await requireAdmin()` inside a try/catch (this file)
//     - GateResult: `const g = await requireAdmin(); if (!g.ok) ...` (canonical)
//   Many admin routes wrap auth + business logic in a single try/catch, where
//   the throwing contract is the cleaner fit. Forcing those to the GateResult
//   style would restructure control flow with a real fail-OPEN risk for no
//   security gain. So this adapter stays. New code may use either; both are
//   first-class and both resolve to the same fail-closed check.
// =============================================================================

import { requireAdmin as requireAdminGate, checkIsAdmin } from '@/lib/requireAdmin'

export { checkIsAdmin }

/**
 * Legacy throwing contract. Throws a Response on failure (catch and return it),
 * returns { userId } on success. Backed by the single consolidated gate so it
 * can never disagree with the GateResult version.
 */
export async function requireAdmin(): Promise<{ userId: string }> {
  const gate = await requireAdminGate()
  if (!gate.ok) {
    throw new Response(JSON.stringify({ error: gate.message }), {
      status: gate.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return { userId: gate.clerkId }
}