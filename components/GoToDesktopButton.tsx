import Link from 'next/link'
import { getManagerTenant } from '@/lib/manager'

// =============================================================================
// GO TO DESKTOP BUTTON — sidebar entry to the Manager+ desktop
// =============================================================================
// Self-gating SERVER component. It calls getManagerTenant() itself and returns
// null for anyone who isn't a Manager+ owner, so you can drop it anywhere
// (e.g. just above the profile block in the sidebar / app/layout.tsx) without
// wrapping it in your own conditional — it shows for Manager+, vanishes for
// everyone else. This is the `if (managerPlus) show _` pattern, encapsulated.
//
// Themed with the owner's primary_color so it reads as part of THEIR brand.
// Links to /dashboard/manager/desktop, which re-checks ownership server-side
// (gating the button alone is never enough — the page guards itself too).
//
// If your sidebar is a CLIENT component and can't render an async server
// child, see the note at the bottom for the prop-drilled variant.
// =============================================================================

export default async function GoToDesktopButton() {
  const tenant = await getManagerTenant()
  if (!tenant) return null

  return (
    <Link
      href="/dashboard/manager/desktop"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        margin: '0 0 8px 0',
        borderRadius: 10,
        textDecoration: 'none',
        background: `linear-gradient(135deg, ${tenant.primary_color}, ${tenant.primary_color}cc)`,
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 2,
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>🖥️</span>
      <span>GO TO DESKTOP</span>
    </Link>
  )
}

// -----------------------------------------------------------------------------
// CLIENT-SIDEBAR VARIANT
// -----------------------------------------------------------------------------
// If the sidebar is 'use client', it can't await getManagerTenant() inline.
// In that case: call getManagerTenant() once in the nearest SERVER parent
// (layout or page), pass the result down, and render this presentational
// button when it's non-null:
//
//   // in the server parent:
//   const managerTenant = await getManagerTenant()
//   <Sidebar managerTenant={managerTenant} />
//
//   // in the client Sidebar, above the profile block:
//   {managerTenant && (
//     <a href="/dashboard/manager/desktop" style={{ ...same styles,
//        background: `linear-gradient(135deg, ${managerTenant.primary_color}, ${managerTenant.primary_color}cc)` }}>
//       🖥️ GO TO DESKTOP
//     </a>
//   )}
// -----------------------------------------------------------------------------