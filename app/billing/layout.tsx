import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { shouldSeeWelcome } from '@/lib/subscription'

// Billing must run dynamically — the new-user→welcome decision is per-user and
// must never be statically cached and served to everyone.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// BILLING ROUTE GUARD — brand-new users see /welcome first
// =============================================================================
// Problem this fixes: a fresh, never-subscribed account is correctly sent to
// /welcome right after sign-in (by /api/auth/post-signin). But the PWA's
// start_url is /dashboard, so REOPENING the installed app skips post-signin
// entirely and the user can land on /billing instead of the showcase.
//
// This guard re-applies the SAME rule everywhere /billing is reached — PWA
// reopen, direct navigation, or a dashboard gate: if the user is brand-new
// (never truly subscribed and never on a paid seat), bounce them to /welcome.
// The welcome page's own GET STARTED / SKIP buttons are what move them forward
// to /billing, so there is no loop. Genuinely lapsed users (who DID subscribe
// before) return false from shouldSeeWelcome and stay on /billing as today.
// =============================================================================
export default async function BillingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()
  if (userId) {
    let sendToWelcome = false
    try {
      sendToWelcome = await shouldSeeWelcome(userId)
    } catch {
      // Fail open: if the check errors, let them reach billing rather than
      // trapping them on the showcase.
      sendToWelcome = false
    }
    // redirect() must be OUTSIDE the try/catch: it works by throwing a special
    // Next.js control-flow signal, and catching it would silently break the
    // redirect.
    if (sendToWelcome) {
      redirect('/welcome')
    }
  }
  return <>{children}</>
}
