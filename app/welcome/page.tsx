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

  // ── THE CODE TRAVELS WITH THEM TO BILLING ─────────────────────────────
  // Safe for both kinds of code, which is not obvious and was briefly
  // "fixed" the wrong way: billing does not simply put an owner-pays code in
  // a checkout. Applying one redeems it, recognises that somebody else is
  // paying, sets the balance to nothing and sends the agent to the dialer.
  // See the payer === 'owner' branch in app/billing/page.tsx.
  //
  // So a new signup sees the showcase, then billing, and billing decides
  // whether there is anything to collect. Nobody is asked to buy a seat that
  // is already bought.
  const nextAfterWelcome = joinCode
    ? `/billing?from=welcome&promo=${encodeURIComponent(joinCode)}`
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