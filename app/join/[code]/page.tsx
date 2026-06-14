import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import JoinRedeemClient from './JoinRedeemClient'

// =============================================================================
// /join/[code]  — partner join-link landing  (handles signed-out & signed-in)
// =============================================================================
// A partner emails demo.dialerseat.com/join/<CODE>. This page is the wrapper
// that turns that link into a redemption, for BOTH states:
//
//   SIGNED-OUT → redirect into Clerk sign-up, carrying the code in the
//                redirect_url so the agent lands back at /join/<code> after
//                creating their account. (Clerk's <SignUp> on /sign-up reads
//                ?redirect_url and returns here post-signup.)
//
//   SIGNED-IN  → render the client component, which immediately calls the
//                existing /api/teams/redeem with this code and routes the
//                agent based on nextStep (instant for single-use partner
//                seats; billing for agent-pays; pending for multi-use).
//
// The redeem route is unchanged and remains the single source of truth — this
// page only delivers the code into it.
//
// NOTE: codes are stored uppercase and matched case-insensitively, so we
// normalize the path param here too.
// =============================================================================

export const dynamic = 'force-dynamic'

export default async function JoinCodePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code: rawCode } = await params
  const code = (rawCode || '').trim().toUpperCase()

  const { userId } = await auth()

  if (!userId) {
    // Signed-out → into sign-up, return to this same link afterward.
    const returnTo = `/join/${encodeURIComponent(code)}`
    redirect(`/sign-up?redirect_url=${encodeURIComponent(returnTo)}`)
  }

  // Signed-in → hand off to the client redeemer.
  return <JoinRedeemClient code={code} />
}