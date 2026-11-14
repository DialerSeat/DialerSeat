import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { devBase, getDevContext } from '@/lib/developers/server'
import { ProjectSurvey } from '@/components/developers/ProjectSurvey'

export const metadata: Metadata = { title: 'New project', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/**
 * Create a project. Every developer comes through here before any code is
 * shown: a name, a short survey of what the project is and what it is for,
 * then the project is made and they are taken straight into its setup.
 */
export default async function NewProjectPage() {
  const base = await devBase()
  const ctx = await getDevContext()
  if (!ctx) redirect(`${base}/sign-in?redirect_url=${encodeURIComponent(base + '/new')}`)
  if (!ctx.account) redirect(`${base}/welcome`)
  return <ProjectSurvey first={ctx.projects.length === 0} />
}
