import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { shouldSeeWelcome } from '@/lib/subscription'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function BillingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()

  if (userId) {

    const headersList = await headers()
    const referer = headersList.get('referer') ?? ''

    const invokePath = headersList.get('x-invoke-path') ?? ''

    const isFromWelcome =
      referer.includes('/welcome') ||
      invokePath.includes('from=welcome')

    if (!isFromWelcome) {
      let sendToWelcome = false
      try {
        sendToWelcome = await shouldSeeWelcome(userId)
      } catch {

        sendToWelcome = false
      }

      if (sendToWelcome) {
        redirect('/welcome')
      }
    }
  }

  return <>{children}</>
}