'use client'

// =============================================================================
// DASHBOARD APP — return to the main dashboard
// =============================================================================
// Manager-only base app. Its job is to take the owner back to /dashboard —
// but ONLY on an explicit click, never on mount.
//
// WHY NOT navigate-on-mount: an app that redirects in useEffect fires every
// time it renders. On the manager desktop that creates a loop — the desktop
// mounts the app (even briefly or off-screen), it redirects to /dashboard, the
// sidebar's "Go to Desktop" returns here, and round it goes. Gating navigation
// behind a button press breaks the cycle: nothing happens until the user acts.
// =============================================================================

export default function DashboardApp() {
  const goToDashboard = () => {
    window.location.href = '/dashboard'
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#f0f1f4',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 18,
      fontFamily: 'Futura PT, Futura, sans-serif', padding: 24,
      boxSizing: 'border-box', textAlign: 'center',
    }}>
      <div style={{ fontSize: 12, letterSpacing: 3, fontWeight: 'bold', color: '#5a5e6a' }}>
        RETURN TO DASHBOARD
      </div>
      <div style={{ fontSize: 12, color: '#5a5e6a', lineHeight: 1.5, maxWidth: 320 }}>
        Leave the desktop and go back to your main DialerSeat dashboard.
      </div>
      <button
        onClick={goToDashboard}
        style={{
          padding: '12px 28px',
          background: '#2a4a8a',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          fontSize: 11,
          letterSpacing: 3,
          fontWeight: 'bold',
          cursor: 'pointer',
          fontFamily: 'Futura PT, Futura, sans-serif',
        }}
      >
        GO TO DASHBOARD →
      </button>
    </div>
  )
}