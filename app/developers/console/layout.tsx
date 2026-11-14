import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ConsoleShell } from '@/components/developers/ConsoleShell'
import { consoleEnv, devBase, getDevContext } from '@/lib/developers/server'

export const metadata: Metadata = { title: { default: 'Console', template: '%s · Console · DialerSeat for Developers' }, robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/** Signed in, activated and with a project, or sent to the step that is missing. */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const base = await devBase()
  const ctx = await getDevContext()
  if (!ctx) redirect(`${base}/sign-in?redirect_url=${encodeURIComponent(base + '/console')}`)
  if (!ctx.account) redirect(`${base}/welcome`)
  if (!ctx.platform) redirect(`${base}/new`)
  const p = ctx.platform
  const projects = ctx.projects.map(x => ({ id: x.id, name: x.name, live_status: x.live_status }))
  return (
    <ConsoleShell platform={{ id: p.id, name: p.name, live_status: p.live_status, tier: p.tier, setup_done: !!p.setup_completed_at }} projects={projects} env={await consoleEnv()}>
      {children}
    </ConsoleShell>
  )
}
