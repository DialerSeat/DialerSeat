import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getManagerTenant } from '@/lib/manager'

// =============================================================================
// /dashboard/manager/desktop — Manager+ desktop (Coming Soon shell)
// =============================================================================
// Server-guarded: getManagerTenant() runs on every request. Non-owners (and
// logged-out users) are redirected to /dashboard, so the route can't be
// reached by typing the URL — gating the sidebar button is NOT enough, the
// page refuses on its own.
//
// v1 is a themed Coming Soon. When the real tenant desktop ships, this page
// mounts the desktop shell with a tenant-scoped registry (apps whose data is
// tied to THIS tenant; neutral apps stay neutral). The chrome is intentionally
// identical to the admin desktop — only what's INSIDE the apps differs.
//
// force-dynamic: ownership is per-user and must never be cached/prerendered.
// =============================================================================

export const dynamic = 'force-dynamic'

export default async function ManagerDesktopPage() {
  const tenant = await getManagerTenant()
  if (!tenant) {
    redirect('/dashboard')
  }

  const onPrimary = pickContrastText(tenant.primary_color)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: tenant.page_bg_color,
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 24,
        fontFamily: '"Segoe UI", Tahoma, sans-serif',
      }}
    >
      {/* brand mark */}
      {tenant.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tenant.logo_url}
          alt={tenant.brand_name}
          style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 12, marginBottom: 20 }}
        />
      ) : (
        <div
          style={{
            width: 56, height: 56, borderRadius: 12, marginBottom: 20,
            background: tenant.primary_color, color: onPrimary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 'bold',
          }}
        >
          {tenant.brand_name?.[0]?.toUpperCase() ?? 'D'}
        </div>
      )}

      <div
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 16px', borderRadius: 100, marginBottom: 22,
          border: `1px solid ${tenant.primary_color}`,
          background: `${tenant.primary_color}1a`,
          color: tenant.primary_color,
          fontSize: 11, letterSpacing: 3, fontWeight: 700,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: tenant.primary_color }} />
        MANAGER+ DESKTOP
      </div>

      <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1, marginBottom: 14 }}>
        Coming Soon
      </h1>

      <p
        style={{
          fontSize: 14, lineHeight: 1.7, maxWidth: 460,
          color: 'rgba(255,255,255,0.7)', marginBottom: 32,
        }}
      >
        Your branded {tenant.brand_name} desktop is on the way — a full workspace
        with your analytics, your team, and your tools, all under your brand.
        We&apos;re putting the finishing touches on it.
      </p>

      <Link
        href="/dashboard"
        style={{
          padding: '12px 28px', borderRadius: 10, textDecoration: 'none',
          background: tenant.primary_color, color: onPrimary,
          fontSize: 12, fontWeight: 700, letterSpacing: 2,
        }}
      >
        ← BACK TO DASHBOARD
      </Link>
    </div>
  )
}

// WCAG-ish auto-contrast: true white on dark, near-black on light. Matches the
// threshold used in WhitelabelLivePreview so themed chrome stays readable.
function pickContrastText(hex: string): string {
  const h = (hex || '').replace('#', '').padEnd(6, '0').slice(0, 6)
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return '#1a1c24'
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return L > 0.18 ? '#1a1c24' : '#ffffff'
}