import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { auth } from '@clerk/nextjs/server'
import { shouldSeeWelcome } from '@/lib/subscription'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── SHOWING THE SHOWCASE BEFORE THE CHECKOUT ─────────────────────────────
// A brand-new signup was landing straight on /billing. Every hop in the
// chain reads correctly on paper — the CTAs are plain /sign-up with no
// ?redirect_url, <SignUp> carries fallbackRedirectUrl="/api/auth/post-signin",
// post-signin checks shouldSeeWelcome() before anything else, and the proxy
// lets /welcome through — so the divert is happening somewhere this repo does
// not control (Clerk's own after-sign-up destination is configured in their
// dashboard, and it outranks the component prop).
//
// Rather than guess at that, this guard makes the destination true from our
// side: whatever route somebody took to reach /billing, if they have never
// seen the showcase and have nothing to pay with yet, they see it first.
//
// ── WHY THIS ONE DOESN'T LOOP ────────────────────────────────────────────
// A guard lived here before and was removed for looping. It tried to answer
// "did we just come from /welcome" by sniffing the referer and an
// x-invoke-path header that nothing sets — neither survives a Stripe return
// or a router.push, so it failed open and bounced /billing -> /welcome ->
// /billing with no exit.
//
// This asks a question that has a durable answer instead. The proxy stamps
// ds_welcome_seen on the response that actually serves /welcome, so after one
// visit the cookie exists and this stands down for good. Worst case is one
// extra hop, never a loop.
//
// ── AND WHY A TEAM JOIN IS EXEMPT ────────────────────────────────────────
// Somebody holding ds_join_code is mid-invite. That path already works and
// was explicitly not to be disturbed: /join/CODE redeems, works out who is
// paying, and sends them on. Dropping the showcase into the middle of it
// would put a product tour between an agent and the team they were invited
// to. They are not evaluating DialerSeat — somebody already bought it.
export default async function BillingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()

  if (userId) {
    const jar = await cookies()
    const alreadySeen = jar.get('ds_welcome_seen')?.value === '1'
    // Literal rather than imported: the constant lives in app/api/join/start,
    // and pulling a route handler into a layout drags its whole server graph
    // along with it. Keep the two in step.
    const midJoin = !!jar.get('ds_join_code')?.value

    if (!alreadySeen && !midJoin) {
      let show = false
      try {
        show = await shouldSeeWelcome(userId)
      } catch {
        // Fail toward the checkout, never toward another redirect. If we
        // cannot tell, rendering /billing is the harmless answer — it is
        // where they were going anyway.
        show = false
      }
      // Outside the try on purpose: redirect() works by throwing, so a catch
      // wrapped around it would swallow the redirect and render instead.
      if (show) redirect('/welcome')
    }
  }

  return <>{children}</>
}
