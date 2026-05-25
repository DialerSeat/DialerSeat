import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

// =============================================================================
// ADMIN GATE
// =============================================================================
// Shared helper for /api/admin/** routes. Looks up the calling user's
// is_admin flag in Supabase via service-role key. Returns { ok: true, clerkId }
// for admins, { ok: false, status, message } otherwise.
//
// Routes use it like:
//   const gate = await requireAdmin()
//   if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })
// =============================================================================

type GateResult =
  | { ok: true; clerkId: string }
  | { ok: false; status: number; message: string }

export async function requireAdmin(): Promise<GateResult> {
  const { userId } = await auth()
  if (!userId) {
    return { ok: false, status: 401, message: 'Not signed in' }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
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