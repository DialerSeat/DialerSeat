import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Returns { isAdmin, userId } for the current Clerk session.
 * Used by client components that fetch admin status via the API.
 */
export async function checkIsAdmin(): Promise<{ isAdmin: boolean; userId: string | null }> {
  const { userId } = await auth()
  if (!userId) return { isAdmin: false, userId: null }

  const { data, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('clerk_id', userId)
    .single()

  if (error || !data) return { isAdmin: false, userId }
  return { isAdmin: !!data.is_admin, userId }
}

/**
 * Use at the top of every admin API route.
 * Returns { userId } on success, or throws a Response that the route should return.
 */
export async function requireAdmin(): Promise<{ userId: string }> {
  const { isAdmin, userId } = await checkIsAdmin()
  if (!userId) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!isAdmin) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return { userId }
}