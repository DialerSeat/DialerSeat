import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * /dashboard is an admin-aware redirect.
 *   - Admins → /dashboard/admin/desktop   (Win7 admin shell, v20)
 *   - Everyone else → /dashboard/analytics
 *
 * Server-side check avoids the flash of agent UI before client redirect kicks in.
 */
export default async function DashboardIndex() {
  const { userId } = await auth()

  if (userId) {
    const { data } = await supabase
      .from('users')
      .select('is_admin')
      .eq('clerk_id', userId)
      .maybeSingle()

    if (data?.is_admin) {
      redirect('/dashboard/admin/desktop')
    }
  }

  redirect('/dashboard/analytics')
}