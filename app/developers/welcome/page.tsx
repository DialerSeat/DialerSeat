import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { devBase, getDevContext, signedInEmail } from '@/lib/developers/server'
import { WelcomeChoice } from '@/components/developers/WelcomeChoice'

export const metadata: Metadata = { title: 'Welcome', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/**
 * Where everyone lands after signing in or up here, new account or existing.
 * Activated developers go straight to the console. Everyone else chooses:
 * activate a free developer account, or go back to dialerseat.com signed in,
 * where the main site's own rules decide the demo or the dashboard.
 */
export default async function WelcomePage() {
  const base = await devBase()
  const ctx = await getDevContext()
  if (!ctx) redirect(`${base}/sign-in`)
  if (ctx.platform) redirect(`${base}/console`)
  const email = await signedInEmail()
  return <WelcomeChoice email={email} />
}
