'use client'
import { useEffect } from 'react'

// =============================================================================
// DASHBOARD APP — return to the main dashboard (automatic)
// =============================================================================
// Manager-only base app. Opening it navigates straight back to /dashboard —
// no button, no extra click. When the window opens it redirects on mount.
//
// WHY THIS NO LONGER LOOPS: the desktop used to restore last-session windows on
// boot, so a restored Dashboard window would auto-redirect on every boot and
// fight the sidebar's "Go to Desktop" forever. That's fixed in Desktop.tsx via
// NEVER_RESTORE_APP_IDS = ['dashboard'] — the Dashboard window is dropped from
// restored state, so this effect only ever runs when the user ACTIVELY opens
// the app (double-click / Start menu), which is precisely the intent. Auto-
// redirect is safe again.
// =============================================================================

export default function DashboardApp() {
  useEffect(() => {
    window.location.href = '/dashboard'
  }, [])

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--brand-page-bg, #f0f1f4)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12,
      fontFamily: 'Futura PT, Futura, sans-serif', padding: 24,
      boxSizing: 'border-box', textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 'bold', color: 'var(--brand-muted-text, #5a5e6a)' }}>
        RETURNING TO DASHBOARD…
      </div>
    </div>
  )
}