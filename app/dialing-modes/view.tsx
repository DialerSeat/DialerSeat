'use client'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'

const T = {
  bg: '#f0f1f4',
  surface: '#ffffff',
  border: '#c4c8d0',
  dark: '#1a1a2e',
  text: '#1a1c24',
  muted: '#5a5e6a',
  accent: '#2a4a8a',
  blue: '#4a9eff',
  green: '#1a6a1a',
  red: '#8a1a1a',
}

export default function DialingModesView() {
  const { isSignedIn, isLoaded } = useUser()

  return (
    <div style={{
      background: T.bg,
      minHeight: '100vh',
      fontFamily: 'Futura PT, Futura, sans-serif',
      color: T.text,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <SiteHeader />

      <main style={{
        maxWidth: 880,
        margin: '0 auto',
        padding: '48px 24px 80px',
        width: '100%',
        flex: 1,
      }}>

        <div style={{ marginBottom: 48 }}>
          <div style={{
            fontSize: 11,
            letterSpacing: 4,
            color: T.muted,
            fontWeight: 'bold',
            marginBottom: 16,
          }}>
            ▸ DIALING MODES
          </div>
          <h1 style={{
            fontSize: 38,
            fontWeight: 'bold',
            letterSpacing: -0.5,
            lineHeight: 1.15,
            margin: '0 0 16px 0',
            color: T.text,
          }}>
            Four dialing modes. Pick by team size and risk tolerance.
          </h1>
          <p style={{
            fontSize: 16,
            lineHeight: 1.65,
            color: T.muted,
            margin: 0,
            maxWidth: 680,
          }}>
            Preview, power, progressive, and predictive. Each trades speed against regulatory exposure. Here&apos;s what each one does, in plain terms, and what DialerSeat enforces to keep you compliant.
          </p>
        </div>

        <section style={{ marginBottom: 48 }}>
          <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            overflow: 'hidden',
            overflowX: 'auto',
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: 'Futura PT, Futura, sans-serif',
              minWidth: 640,
            }}>
              <thead>
                <tr style={{ background: T.dark }}>
                  <th style={th}>MODE</th>
                  <th style={th}>HOW IT WORKS</th>
                  <th style={th}>SPEED</th>
                  <th style={th}>ABANDONS</th>
                  <th style={th}>BEST FOR</th>
                </tr>
              </thead>
              <tbody>
                <ModeRow
                  mode="PREVIEW"
                  slug="preview"
                  modeColor={T.muted}
                  how="Agent reviews the lead, then clicks DIAL or SKIP."
                  speed="Slowest"
                  abandons="Zero"
                  bestFor="High-value B2B, warm re-engagement"
                />
                <ModeRow
                  mode="POWER"
                  slug="power"
                  modeColor={T.accent}
                  how="One call at a time. Agent handles voicemails."
                  speed="Moderate"
                  abandons="Zero"
                  bestFor="Solo agents, steady pace"
                />
                <ModeRow
                  mode="PROGRESSIVE"
                  slug="progressive"
                  modeColor={T.green}
                  how="Auto-dials after each disposition. AMD filters voicemails."
                  speed="Fast"
                  abandons="Zero"
                  bestFor="Most solo agents and small teams"
                />
                <ModeRow
                  mode="PREDICTIVE"
                  slug="predictive"
                  modeColor={T.red}
                  how="Multi-line pacing algorithm, auto-throttled at 2.5% abandons."
                  speed="Fastest"
                  abandons="Capped under 3% by law"
                  bestFor="Teams of 8+ concurrent agents"
                />
              </tbody>
            </table>
          </div>
          <div style={{
            marginTop: 10,
            fontSize: 11,
            letterSpacing: 1,
            color: T.muted,
            textAlign: 'right',
          }}>
            Click any mode for the full deep dive →
          </div>
        </section>

        <section style={{ marginBottom: 48 }}>
          <SectionLabel>THE MODES</SectionLabel>

          <ModeCard
            label="PREVIEW"
            slug="preview"
            color={T.muted}
            body="Every call starts with a human decision. The lead profile loads, the agent reads it, and nothing dials until they click. Zero abandoned calls by design, and the lowest regulatory exposure of any mode."
            bestFor="High-touch B2B and appointment confirmations, where context before the dial improves conversion."
          />
          <ModeCard
            label="POWER"
            slug="power"
            color={T.accent}
            body="Click once, dial one lead, handle whatever answers — human, voicemail, or nothing — then dispose and dial again. One call per agent means abandoned calls are structurally impossible."
            bestFor="Solo agents who want predictable dialing with no algorithm in the loop."
          />
          <ModeCard
            label="PROGRESSIVE"
            slug="progressive"
            color={T.green}
            body="Same one-call-per-agent safety as power mode, but the system auto-dials the next lead after each disposition and answering machine detection screens out voicemails before they reach you. Roughly double the live conversations on voicemail-heavy lists."
            bestFor="The default recommendation for solo agents and small teams."
          />
          <ModeCard
            label="PREDICTIVE"
            slug="predictive"
            color={T.red}
            body="Dials multiple lines per agent using a pacing algorithm. Fastest mode, and the only one where abandoned calls are possible — so DialerSeat auto-throttles back to one line per agent when the rolling 30-day abandon rate hits 2.5%, keeping a buffer under the 3% legal cap. Runs single-line until a campaign has 8+ concurrent agents, the threshold where multi-line pacing is statistically safe."
            bestFor="Teams with 8+ agents dialing the same campaign at once."
          />
        </section>

        <section style={{ marginBottom: 48 }}>
          <SectionLabel>COMPLIANCE</SectionLabel>
          <h2 style={h2}>What we enforce, and what&apos;s on you</h2>

          <div style={cardStyle(T.accent)}>
            <h3 style={h3}>Enforced in software</h3>
            <ul style={ul}>
              <li style={li}><strong>3% abandon cap</strong> (FTC safe harbor) — predictive auto-throttles at 2.5%, resumes below 2.0%.</li>
              <li style={li}><strong>15-second minimum ring</strong> before a call is treated as unanswered.</li>
              <li style={li}><strong>Recorded notice on abandons</strong> identifying the seller, per 16 CFR 310.4(b)(4)(iii).</li>
              <li style={li}><strong>Calling windows</strong> — leads outside 8 AM–9 PM local time are skipped automatically.</li>
              <li style={li}><strong>Full call records</strong> — every attempt, AMD result, and abandonment logged and exportable.</li>
            </ul>
          </div>

          <div style={cardStyle(T.red)}>
            <h3 style={h3}>Your responsibility as the seller</h3>
            <ul style={ul}>
              <li style={li}><strong>Consent.</strong> TCPA requires prior express written consent for autodialed marketing calls to wireless numbers, specific to your business under the one-to-one consent rule. We store consent metadata per lead — you supply it.</li>
              <li style={li}><strong>DNC scrubbing.</strong> Scrub your lists against the National Do Not Call Registry before upload.</li>
              <li style={li}><strong>Litigator scrubbing.</strong> Best practice at high volume; we don&apos;t currently integrate a scrub service.</li>
            </ul>
          </div>

          <p style={{ ...p, marginTop: 8 }}>
            Any dialer that claims to handle all of TCPA compliance for you is either lying or charging far more than $35/week.
          </p>
        </section>

        {isLoaded && isSignedIn ? (
          <section style={ctaSection}>
            <div style={ctaLabel}>▸ READY TO DIAL</div>
            <p style={ctaText}>
              Pick the mode that fits your campaign. You can change it anytime in Campaign Settings.
            </p>
            <Link href="/dashboard/campaigns" style={ctaButton}>GO TO CAMPAIGNS →</Link>
          </section>
        ) : (
          <section style={ctaSection}>
            <div style={ctaLabel}>▸ DIALERSEAT</div>
            <h2 style={{
              fontSize: 22,
              fontWeight: 'bold',
              letterSpacing: 1,
              color: 'white',
              margin: '0 0 12px 0',
            }}>
              $35/week. All four dialing modes. No call-volume limits.
            </h2>
            <p style={{ ...ctaText, maxWidth: 540 }}>
              Cancel anytime. Your leads, recordings, and campaigns stay yours.
            </p>
            <Link href="/sign-up" style={ctaButton}>GET STARTED →</Link>
          </section>
        )}

        <p style={{
          fontSize: 11,
          color: T.muted,
          lineHeight: 1.6,
          marginTop: 40,
          paddingTop: 24,
          borderTop: `1px solid ${T.border}`,
          letterSpacing: 0.3,
        }}>
          <strong>Not legal advice.</strong> This page describes our software&apos;s technical behavior with respect to specific U.S. federal regulations. It is not a legal opinion, does not establish an attorney-client relationship, and does not guarantee compliance for any specific use case. Telemarketing law varies by state and circumstance. Consult qualified counsel for advice on your specific operations. Last updated: July 2026. Citations: 16 CFR 310.4(b)(4); 47 CFR 64.1200; 47 USC 227.
        </p>
      </main>

      <SiteFooter />
    </div>
  )
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    fontSize: 10,
    letterSpacing: 4,
    color: T.muted,
    fontWeight: 'bold',
    marginBottom: 16,
  }}>
    ▸ {children}
  </div>
)

const ModeRow = ({ mode, slug, modeColor, how, speed, abandons, bestFor }: {
  mode: string; slug: string; modeColor: string; how: string; speed: string; abandons: string; bestFor: string
}) => (
  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
    <td style={{ ...td, fontWeight: 'bold', color: modeColor, letterSpacing: 2, fontSize: 11 }}>
      <Link
        href={`/dialing-modes/${slug}`}
        style={{
          color: modeColor,
          textDecoration: 'none',
          borderBottom: `1px dotted ${modeColor}`,
          paddingBottom: 1,
        }}
        title={`Read the full ${mode.toLowerCase()} deep dive`}
      >
        {mode}
      </Link>
    </td>
    <td style={td}>{how}</td>
    <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{speed}</td>
    <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{abandons}</td>
    <td style={{ ...td, fontSize: 12 }}>{bestFor}</td>
  </tr>
)

const ModeCard = ({ label, slug, color, body, bestFor }: {
  label: string; slug: string; color: string; body: string; bestFor: string
}) => (
  <div style={{
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderLeft: `3px solid ${color}`,
    borderRadius: 8,
    padding: '20px 24px',
    marginBottom: 16,
  }}>
    <h3 style={{
      fontSize: 16,
      fontWeight: 'bold',
      letterSpacing: 4,
      color,
      margin: '0 0 10px 0',
    }}>{label}</h3>
    <p style={{
      fontSize: 14,
      lineHeight: 1.7,
      color: T.text,
      margin: '0 0 10px 0',
    }}>{body}</p>
    <p style={{
      fontSize: 13,
      lineHeight: 1.6,
      color: T.muted,
      margin: '0 0 14px 0',
    }}>
      <strong style={{ color: T.text }}>Best for:</strong> {bestFor}
    </p>
    <Link
      href={`/dialing-modes/${slug}`}
      style={{
        fontSize: 11,
        letterSpacing: 3,
        fontWeight: 'bold',
        color,
        textDecoration: 'none',
      }}
    >
      READ THE FULL {label} DEEP DIVE →
    </Link>
  </div>
)

const cardStyle = (edge: string): React.CSSProperties => ({
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderLeft: `3px solid ${edge}`,
  borderRadius: 6,
  padding: '20px 24px',
  marginBottom: 16,
})

const ctaSection: React.CSSProperties = {
  background: T.dark,
  borderRadius: 12,
  padding: '36px 32px',
  textAlign: 'center',
  marginTop: 56,
}

const ctaLabel: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 4,
  color: '#8888aa',
  fontWeight: 'bold',
  marginBottom: 12,
}

const ctaText: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.7,
  color: '#c0c2ca',
  margin: '0 auto 20px',
}

const ctaButton: React.CSSProperties = {
  display: 'inline-block',
  padding: '13px 26px',
  background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
  borderRadius: 6,
  color: 'white',
  fontSize: 11,
  fontWeight: 'bold',
  letterSpacing: 3,
  textDecoration: 'none',
}

const h2 = {
  fontSize: 22,
  fontWeight: 'bold' as const,
  letterSpacing: -0.2,
  lineHeight: 1.3,
  margin: '0 0 16px 0',
  color: T.text,
}

const h3 = {
  fontSize: 15,
  fontWeight: 'bold' as const,
  letterSpacing: 1,
  margin: '0 0 10px 0',
  color: T.text,
}

const p = {
  fontSize: 14,
  lineHeight: 1.7,
  color: T.muted,
  margin: '0 0 16px 0',
}

const ul: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.7,
  color: T.text,
  paddingLeft: 20,
  margin: 0,
}

const li: React.CSSProperties = {
  marginBottom: 8,
}

const th: React.CSSProperties = {
  padding: '12px 14px',
  textAlign: 'left',
  fontSize: 9,
  letterSpacing: 3,
  color: '#8888aa',
  fontWeight: 'bold',
  borderBottom: `1px solid ${T.border}`,
}

const td: React.CSSProperties = {
  padding: '14px',
  fontSize: 13,
  lineHeight: 1.6,
  color: T.text,
  verticalAlign: 'top',
  borderBottom: `1px solid ${T.border}`,
}
