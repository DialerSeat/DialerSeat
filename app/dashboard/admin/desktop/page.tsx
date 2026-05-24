import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Desktop from '@/components/admin-desktop/Desktop'

// =============================================================================
// ADMIN DESKTOP PAGE
// =============================================================================
// Server-gated entry to the Win7 desktop admin shell. Verifies admin status
// via Clerk + Supabase users.is_admin before rendering the client component.
//
// On non-admin or signed-out requests we redirect to /dashboard/analytics
// (the standard agent dashboard) rather than 404'ing — that matches existing
// behavior elsewhere in the app.
//
// We intentionally don't render the site-header on this route. The desktop
// itself owns the full viewport — header on top would break the illusion.
// To do that we use a route-scoped layout (sibling layout.tsx).
// =============================================================================

export const metadata = {
  title: 'DialerSeat Admin',
}

export default async function AdminDesktopPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in?redirect_url=/dashboard/admin/desktop')
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data } = await supabase
    .from('users')
    .select('is_admin')
    .eq('clerk_id', userId)
    .maybeSingle()

  if (!data?.is_admin) {
    redirect('/dashboard/analytics')
  }

  return <Desktop />
}