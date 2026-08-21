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

  const billingWithCode = joinCode
    ? `/billing?from=welcome&promo=${encodeURIComponent(joinCode)}`
    : '/billing'

  let show: boolean
  try {
    show = await shouldSeeWelcome(userId)
  } catch {
    
    
    redirect(billingWithCode)
  }

  
  
  
  
  if (!show!) redirect(billingWithCode)

  
  return <Showcase joinCode={joinCode} />
}