import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { shouldSeeWelcome } from '@/lib/subscription'
import Showcase from './Showcase'































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
    
    
    redirect('/billing')
  }

  
  
  
  
  if (!show!) redirect('/billing')

  
  return <Showcase />
}