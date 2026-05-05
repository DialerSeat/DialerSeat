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

export default function AdminTeamsPage() {
  return (
    <div style={{
      flex: 1,
      background: T.bg,
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        background: T.dark,
        padding: '12px 20px',
        borderBottom: `2px solid ${T.accent}`,
      }}>
        <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: T.blue }}>
          TEAMS
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
          textAlign: 'center',
          maxWidth: 480,
          padding: '48px 32px',
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 8,
          borderTop: `3px solid ${T.blue}`,
        }}>
          <div style={{ fontSize: 56, marginBottom: 24 }}>🏢</div>
          <div style={{
            fontSize: 13,
            fontWeight: 'bold',
            letterSpacing: 4,
            color: T.text,
            marginBottom: 12,
          }}>
            COMING SOON
          </div>
          <p style={{
            fontSize: 13,
            lineHeight: 1.7,
            color: T.muted,
            marginBottom: 16,
          }}>
            The Teams page will show every team owner on DialerSeat, who is on each team, and how many seats they are paying for.
          </p>
          <p style={{
            fontSize: 11,
            lineHeight: 1.6,
            color: T.muted,
            letterSpacing: 1,
          }}>
            Wires up automatically once the Teams feature ships.
          </p>
        </div>
      </div>
    </div>
  )
}