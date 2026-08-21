import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import JoinRedeemClient from './JoinRedeemClient'
import DeadInvite from './DeadInvite'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────
// A DEAD LINK MUST SAY SO BEFORE ANYONE MAKES AN ACCOUNT
//
// Regenerating a team code kills the old one, and old links keep circulating —
// in texts, in emails, in a recruiter's saved message. Previously a signed-out
// visitor following a dead link was sent straight to sign-up without the code
// being checked at all. They created an account, confirmed an email, arrived at
// billing, and only there discovered the invite was worthless.
//
// The worse version is the quiet one: they land on billing with a code that
// silently fails to apply, assume the invite "worked", and pay for a seat that
// joins them to nothing.
//
// So the code is validated here, before the redirect, while there is still
// nothing to undo. This is the only place in the flow where the check costs
// the visitor nothing.
//
// Unauthenticated, so it says only whether the link is usable — never the team
// name, never who owns it. A dead link and a code that never existed produce
// the same page on purpose.
// ─────────────────────────────────────────────────────────────────────────

async function codeIsLive(code: string): Promise<boolean> {
  if (!code) return false

  try {
    return await lookupCodeIsLive(code)
  } catch (err) {
    // This route is public and unauthenticated, so it must degrade rather than
    // 500 when the database is unreachable. Same fail-open reasoning as below:
    // redeem re-checks everything, so the cost of being wrong here is the old
    // behaviour, not a wrongly rejected agent.
    console.error('[join] code lookup threw', err)
    return true
  }
}

async function lookupCodeIsLive(code: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('team_codes')
    .select('id, max_uses, use_count')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle()

  // Fail OPEN on a lookup error: a database blip must not turn a live invite
  // into a dead one. The redeem step re-checks everything anyway, so the worst
  // case is the old behaviour, not a wrongly rejected agent.
  if (error) {
    console.error('[join] code lookup failed', error)
    return true
  }

  if (!data) return false
  if (data.max_uses !== null && data.use_count >= data.max_uses) return false
  return true
}

export default async function JoinCodePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code: rawCode } = await params
  const code = (rawCode || '').trim().toUpperCase()

  const { userId } = await auth()

  if (!userId) {
    if (!(await codeIsLive(code))) {
      return <DeadInvite code={code} />
    }

    // Via the cookie setter, not straight to sign-up. ?redirect_url alone does
    // not survive the trip: Clerk's hosted portal has its own after-sign-in
    // destination, and post-signin then routes a user with no billing to
    // /welcome and on to /billing. The cookie outlives every one of those hops.
    // See app/api/join/start/route.ts.
    redirect(`/api/join/start?code=${encodeURIComponent(code)}`)
  }

  return <JoinRedeemClient code={code} />
}
