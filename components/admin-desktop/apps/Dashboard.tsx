'use client'
import { useEffect } from 'react'

// =============================================================================
// DASHBOARD APP — return to the main dashboard
// =============================================================================
// A tiny base app (manager desktop only) whose whole job is to take the owner
// back to /dashboard. Registered with `external`-style behavior isn't possible
// here (that opens a new tab), so instead this component navigates on mount —
// when the window opens, it immediately routes to /dashboard. The brief shell
// below is what shows for the instant before navigation.
//
// It's a BASE app (never uninstallable) and manager-only (visibleTo:
// ['manager']). It's pinned first/top-left by default via DEFAULT_ICON_ORDER
// in the registry, but is movable like any other icon.
// =============================================================================

export default function DashboardApp() {
  useEffect(() => {
    // Full navigation out of the desktop back to the dashboard.
    window.location.href = '/dashboard'
  }, [])

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#f0f1f4',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12,
      fontFamily: 'Futura PT, Futura, sans-serif',
    }}>
      <div style={{ fontSize: 30 }}>🏠</div>
      <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 'bold', color: '#5a5e6a' }}>
        RETURNING TO DASHBOARD…
      </div>
    </div>
  )
}