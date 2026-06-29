import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { shouldSeeWelcome } from '@/lib/subscription'
import Showcase from './Showcase'

// =============================================================================
// app/welcome/page.tsx — post-signup product showcase (server guard)
// =============================================================================
// Brand-new users are diverted here by /api/auth/post-signin BEFORE billing.
// This server component re-checks access so the page can't be sat on by anyone
// who shouldn't see it:
//
//   - not signed in        → /sign-in
//   - shouldSeeWelcome()   → false (active, lapsed, or previously paid seat)
//                          → /billing  (they've used the product; skip pitch)
//   - shouldSeeWelcome()   → true  (brand-new, never activated)
//                          → render the showcase
//
// REDIRECT CHAIN SAFETY:
// When this page redirects to /billing, the Showcase has NOT set ?from=welcome
// because the user didn't click GET STARTED — they arrived at /welcome directly
// but don't qualify. The billing layout will then run shouldSeeWelcome() again.
// For a truly lapsed user shouldSeeWelcome() returns false both times, so they
// pass straight through billing. For a brand-new user who somehow bypassed the
// layout's guard, shouldSeeWelcome() returns true in the layout and they are
// sent back here — that IS the correct behavior (they must see the showcase).
// There is no loop because the two guards agree on who belongs where.
//
// The Showcase client component (./Showcase) drives forward navigation:
// GET STARTED and SKIP both call router.push('/billing?from=welcome'), which
// signals the billing layout to skip its new-user check and let them through.
//
// force-dynamic: per-user gate, never cached.
// =============================================================================

export const dynamic = 'force-dynamic'

export default async function WelcomePage() {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in')
  }

  let show: boolean
  try {
    show = await shouldSeeWelcome(userId)
  } catch {
    // Fail safe: if the check errors, send them to billing rather than
    // trapping them on the showcase.
    redirect('/billing')
  }

  // Anyone who shouldn't see the showcase goes to billing. (A currently-active
  // user who lands here manually also gets moved along — billing will in turn
  // bounce an active user onward to /dashboard, so this stays correct without
  // re-checking the full tier here.)
  if (!show!) redirect('/billing')

  // Brand-new / never-activated user — show the showcase.
  return <Showcase />
}