import { redirect } from 'next/navigation'
import { getManagerTenant } from '@/lib/manager'
import { getTenantBranding } from '@/lib/tenant'
import { ThemeProvider } from '@/components/ThemeProvider'
import Desktop from '@/components/admin-desktop/Desktop'

// =============================================================================
// /dashboard/manager/desktop — Manager+ desktop (role="manager", branded)
// =============================================================================
// Server-guarded: getManagerTenant() runs on every request. Non-owners (and
// logged-out users) are redirected to /dashboard, so the route can't be
// reached by typing the URL.
//
// Mounts the SAME Desktop component the admin uses, with role="manager". The
// role filters the registry (visibleTo) and is the seam each app's API
// branches on for tenant-scoped data. ONE desktop, ONE registry, ONE copy of
// every app — change the admin app and the manager picks it up, restricted.
//
// BRANDING: wrapped in <ThemeProvider> with the owner's full tenant branding
// (same provider the dashboard pages use), so every desktop app that reads
// --brand-* CSS vars renders in the tenant's colors. We pull the FULL
// TenantBranding via getTenantBranding(slug) (getManagerTenant only carries
// the 4 color tokens; ThemeProvider's type wants the full shape).
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

  // Full branding for the theme provider (owner's own tenant by slug).
  const branding = await getTenantBranding(tenant.slug)

  return (
    <ThemeProvider initialBranding={branding}>
      <Desktop role="manager" />
    </ThemeProvider>
  )
}