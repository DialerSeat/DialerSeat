import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { auth } from '@clerk/nextjs/server'
import { JOIN_CODE_COOKIE } from '@/app/api/join/start/route'
import { shouldSeeWelcome } from '@/lib/subscription'
import Showcase from './Showcase'































export const dynamic = 'force-dynamic'

export default async function WelcomePage() {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in')
  }

  // The invite they arrived with, if any. Read here on the server and passed
  // down so the "continue" button carries it to billing — otherwise the code
  // is lost at exactly the step that needs it.
  const jar = await cookies()
  const joinCode = jar.get(JOIN_CODE_COOKIE)?.value || null

  // ── AN INVITE GOES TO THE JOIN PAGE, NOT TO BILLING ───────────────────
  // This used to hand the code to billing as ?promo=. That is right for an
  // agent-pays code and wrong for an owner-pays one, where the agent owes
  // nothing at all — sending them to a checkout with a promo box would ask
  // them to pay for a seat somebody else had already bought.
  //
  // /join/CODE knows which it is. It names the team, asks them to confirm,
  // then routes to billing with the promo attached, to the dialer, or to a
  // pending notice, according to what the code actually says.
  const nextAfterWelcome = joinCode
    ? `/join/${encodeURIComponent(joinCode)}`
    : '/billing'

  let show: boolean
  try {
    show = await shouldSeeWelcome(userId)
  } catch {
    
    
    redirect(nextAfterWelcome)
  }

  
  
  
  
  if (!show!) redirect(nextAfterWelcome)

  
  return <Showcase joinCode={joinCode} />
}