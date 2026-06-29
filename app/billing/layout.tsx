import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { shouldSeeWelcome } from '@/lib/subscription'
import { headers } from 'next/headers'

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
//
// LOOP PREVENTION: if the user is arriving FROM /welcome (i.e. they clicked
// GET STARTED or SKIP on the showcase), we skip this check entirely. The
// Showcase passes ?from=welcome on every push to /billing, and we also check
// the Referer header as a belt-and-suspenders fallback. Without this, the
// guard bounces the user straight back to /welcome the moment they click
// GET STARTED, creating an inescapable /welcome ↔ /billing loop.
//
// Genuinely lapsed users (who DID subscribe before) return false from
// shouldSeeWelcome and stay on /billing as expected.
// =============================================================================
export default async function BillingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()

  if (userId) {
    // ── LOOP GUARD ────────────────────────────────────────────────────────
    // If the user is arriving intentionally from /welcome (via the GET STARTED
    // or SKIP buttons), bypass the redirect check. Two signals are checked:
    //
    //   1. ?from=welcome query param — set explicitly by Showcase's goBilling()
    //   2. Referer header — belt-and-suspenders for browsers that send it
    //
    // Either signal is sufficient to skip the bounce-back.
    const headersList = await headers()
    const referer = headersList.get('referer') ?? ''

    // Next.js doesn't expose the raw incoming URL to layouts directly, so we
    // read x-invoke-path (set by Next internals) as a proxy for the full URL
    // including search params. If it's absent, we fall back to the referer
    // check alone — that's still enough to prevent the loop.
    const invokePath = headersList.get('x-invoke-path') ?? ''

    const isFromWelcome =
      referer.includes('/welcome') ||
      invokePath.includes('from=welcome')

    if (!isFromWelcome) {
      let sendToWelcome = false
      try {
        sendToWelcome = await shouldSeeWelcome(userId)
      } catch {
        // Fail open: if the check errors, let them reach billing rather than
        // trapping them on the showcase.
        sendToWelcome = false
      }
      // redirect() must be OUTSIDE the try/catch: it works by throwing a
      // special Next.js control-flow signal, and catching it silently breaks
      // the redirect.
      if (sendToWelcome) {
        redirect('/welcome')
      }
    }
  }

  return <>{children}</>
}