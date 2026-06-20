import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { getAccessTier } from '@/lib/subscription'
import Showcase from './Showcase'

// =============================================================================
// app/welcome/page.tsx — post-signup product showcase (server guard)
// =============================================================================
// Brand-new users are diverted here by /api/auth/post-signin BEFORE billing.
// This server component re-checks access so the page can't be sat on by anyone
// who shouldn't see it:
//
//   - not signed in        → /sign-in
//   - access tier 'active' → /dashboard/analytics (already paying; skip pitch)
//   - access tier 'lapsed' → /billing (already saw the pitch; go pay)
//   - access tier 'new'    → render the showcase (the only case that stays)
//
// The showcase itself (./Showcase, a client component) drives its own
// navigation: GET STARTED / SKIP push the user forward to /billing. Because
// this route is NOT behind the billing gate and the user leaves via those
// buttons, there is no redirect loop.
//
// force-dynamic: per-user gate, never cached.
// =============================================================================

export const dynamic = 'force-dynamic'

export default async function WelcomePage() {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in')
  }

  let tier: 'active' | 'lapsed' | 'new'
  try {
    tier = await getAccessTier(userId)
  } catch {
    // Fail safe: if the tier check errors, send them to billing rather than
    // trapping them on the showcase.
    redirect('/billing')
  }

  if (tier === 'active') redirect('/dashboard/analytics')
  if (tier === 'lapsed') redirect('/billing')

  // tier === 'new' — show the showcase.
  return <Showcase />
}