'use client'

const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
  border: '#c4c8d0',
  dark: '#1a1a2e',
  text: '#1a1c24',
  muted: '#5a5e6a',
  accent: '#2a4a8a',
  blue: '#4a9eff',
}

export default function AdminSettingsPage() {
  return (
    <div style={{
      flex: 1,
      background: T.bg,
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Futura PT, Futura, sans-serif',
    }}>
      <div style={{
        background: T.dark,
        padding: '12px 20px',
        borderBottom: `2px solid ${T.accent}`,
      }}>
        <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: T.blue }}>
          ADMIN SETTINGS
        </span>
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}>
        <div style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderTop: `3px solid ${T.blue}`,
          borderRadius: 4,
          padding: '40px 48px',
          maxWidth: 480,
          width: '100%',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>⚙️</div>
          <div style={{
            fontSize: 14,
            fontWeight: 'bold',
            letterSpacing: 4,
            color: T.blue,
            marginBottom: 12,
          }}>COMING SOON</div>
          <p style={{
            fontSize: 12,
            lineHeight: 1.7,
            color: T.text,
            letterSpacing: 1,
            margin: 0,
          }}>
            Platform-wide configuration tools for the DialerSeat admin will live here. Pricing controls, feature flags, default policies, and operational settings.
          </p>
        </div>
      </div>
    </div>
  )
}