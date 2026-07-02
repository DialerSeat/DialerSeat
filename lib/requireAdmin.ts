import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

























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