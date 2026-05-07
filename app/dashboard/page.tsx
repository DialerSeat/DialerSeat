import { redirect } from 'next/navigation'

/**
 * /dashboard is no longer a real page — agents land on /dashboard/analytics
 * and admins are redirected by the admin/check flow on the analytics page.
 */
export default function DashboardIndex() {
  redirect('/dashboard/analytics')
}