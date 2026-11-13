import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ConsoleShell } from '@/components/developers/ConsoleShell'
import { consoleEnv, devBase, getDevContext } from '@/lib/developers/server'

export const metadata: Metadata = { title: { default: 'Console', template: '%s · Console · DialerSeat for Developers' }, robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/** Signed in and activated, or sent to the step that is missing. */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const base = await devBase()
  const ctx = await getDevContext()
  if (!ctx) redirect(`${base}/sign-in?redirect_url=${encodeURIComponent(base + '/console')}`)
  if (!ctx.platform) redirect(`${base}/welcome`)
  const p = ctx.platform
  return <ConsoleShell platform={{ name: p.name, live_status: p.live_status, tier: p.tier }} env={await consoleEnv()}>{children}</ConsoleShell>
}
