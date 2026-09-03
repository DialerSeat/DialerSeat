import Link from 'next/link'

// Shown when a join link is no longer usable — regenerated, deactivated, or it
// never existed. Deliberately identical in all three cases: someone guessing
// codes should learn nothing from the difference, and the person holding a real
// dead link needs the same instruction either way.
//
// The instruction is the point. "Invalid code" alone leaves someone stuck; what
// they actually need to know is that codes get regenerated and their contact
// can send a fresh one in seconds.
export default function DeadInvite({ code }: { code: string }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--brand-sidebar-bg, #111118)',
        color: 'var(--brand-on-sidebar, #ffffff)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        fontFamily: 'Futura PT, Futura, "Trebuchet MS", sans-serif',
      }}
    >
      <div style={{ maxWidth: 460, width: '100%', textAlign: 'center' }}>
        <div
          style={{
            fontSize: 13,
            letterSpacing: '0.18em',
            opacity: 0.55,
            marginBottom: 28,
            textTransform: 'uppercase',
          }}
        >
          DialerSeat
        </div>

        <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 20 }}>⛔</div>

        <h1 style={{ fontSize: 26, margin: '0 0 14px', fontWeight: 600 }}>
          This invite link no longer works
        </h1>

        <p style={{ fontSize: 15, lineHeight: 1.6, opacity: 0.75, margin: '0 0 10px' }}>
          Invite codes are replaced whenever a team owner regenerates them, which
          turns off every link built on the old one.
        </p>

        <p style={{ fontSize: 15, lineHeight: 1.6, opacity: 0.75, margin: '0 0 28px' }}>
          Ask whoever invited you for a new link, it takes them a few seconds.
          Nothing has been created on your side, so there is nothing to undo.
        </p>

        {code ? (
          <div
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 13,
              opacity: 0.4,
              marginBottom: 30,
            }}
          >
            code: {code}
          </div>
        ) : null}

        <Link
          href="/"
          style={{
            display: 'inline-block',
            padding: '12px 26px',
            borderRadius: 8,
            background: 'var(--brand-primary, #4a9eff)',
            color: 'var(--brand-on-primary, #ffffff)',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}
        >
          GO TO DIALERSEAT
        </Link>
      </div>
    </main>
  )
}
