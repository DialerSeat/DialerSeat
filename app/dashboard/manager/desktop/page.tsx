import { redirect } from 'next/navigation'
import { getManagerTenant } from '@/lib/manager'
import Desktop from '@/components/admin-desktop/Desktop'

// =============================================================================
// /dashboard/manager/desktop — Manager+ desktop (role="manager")
// =============================================================================
// Server-guarded: getManagerTenant() runs on every request. Non-owners (and
// logged-out users) are redirected to /dashboard, so the route can't be
// reached by typing the URL — gating the sidebar button is NOT enough, the
// page refuses on its own.
//
// Mounts the SAME Desktop component the admin uses, with role="manager". The
// role does two things: (1) filters the registry via each app's visibleTo, so
// managers see only manager-visible apps (analytics, teams, notes, account,
// app store — never logs/numbers/whitelabel/overview); (2) is the seam each
// app's API branches on to return tenant-scoped data instead of sitewide.
// ONE desktop, ONE registry, ONE copy of every app — change the admin app and
// the manager picks it up the same second, just restricted.
//
// NOTE: add '/dashboard/manager/desktop' to BARE_LAYOUT_PREFIXES in
// app/dashboard/layout.tsx so this renders full-screen without the dashboard
// sidebar wrapping it (same treatment the admin desktop already gets).
//
// force-dynamic: ownership is per-user and must never be cached/prerendered.
// =============================================================================

export const dynamic = 'force-dynamic'

export default async function ManagerDesktopPage() {
  const tenant = await getManagerTenant()
  if (!tenant) {
    redirect('/dashboard')
  }

  return <Desktop role="manager" />
}