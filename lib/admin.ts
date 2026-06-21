// =============================================================================
// lib/admin.ts — COMPATIBILITY SHIM (post-consolidation)
// =============================================================================
// The real admin gate now lives in lib/requireAdmin.ts (non-throwing,
// GateResult contract). This file used to contain a SECOND, divergent
// requireAdmin() that THREW a Response. To avoid breaking the 14 routes that
// still `import { requireAdmin } from '@/lib/admin'` and consume it via
// try/catch, we keep a throwing adapter here under the SAME old behavior.
//
// MIGRATION PATH (do this incrementally, no rush):
//   1. In each route importing from '@/lib/admin', switch the import to
//      '@/lib/requireAdmin' and change:
//          try { await requireAdmin() } catch (res) { return res as Response }
//      to:
//          const gate = await requireAdmin()
//          if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })
//   2. Once no route imports from '@/lib/admin', delete this file.
//
// Until then, BOTH import paths resolve to the SAME underlying check, so there
// is exactly one source of truth for "is this user an admin".
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