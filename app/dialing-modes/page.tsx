import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Dialing Modes & Compliance Methodology | DialerSeat',
  description:
    'A technical breakdown of preview, power, progressive, and predictive dialing — and exactly how DialerSeat enforces TCPA and FTC TSR compliance for each. No fluff, no marketing spin.',
  openGraph: {
    title: 'Dialing Modes & Compliance Methodology | DialerSeat',
    description:
      'How DialerSeat handles preview, power, progressive, and predictive dialing under TCPA and FTC TSR rules.',
    type: 'article',
  },
  alternates: { canonical: 'https://dialerseat.com/dialing-modes' },
}

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
  amber: '#8a6a1a',
}

export default function DialingModesPage() {
  return (
    <div style={{
      background: T.bg,
      minHeight: '100vh',
      fontFamily: 'Futura PT, Futura, sans-serif',
      color: T.text,
    }}>
      {/* HEADER NAV */}
      <header style={{
        background: T.dark,
        borderBottom: `2px solid ${T.accent}`,
        padding: '14px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{
          maxWidth: 980,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <Link href="/" style={{
            fontSize: 13,
            fontWeight: 'bold',
            letterSpacing: 4,
            color: T.blue,
            textDecoration: 'none',
          }}>
            DIALERSEAT
          </Link>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link href="/sign-in" style={{
              fontSize: 10,
              letterSpacing: 2,
              color: '#8888aa',
              textDecoration: 'none',
              fontWeight: 'bold',
            }}>SIGN IN</Link>
            <Link href="/sign-up" style={{
              padding: '8px 16px',
              borderRadius: 4,
              background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
              color: 'white',
              fontSize: 10,
              fontWeight: 'bold',
              letterSpacing: 2,
              textDecoration: 'none',
            }}>START FREE</Link>
          </div>
        </div>
      </header>

      <main style={{
        maxWidth: 880,
        margin: '0 auto',
        padding: '48px 24px 80px',
      }}>

        {/* HERO */}
        <div style={{ marginBottom: 56 }}>
          <div style={{
            fontSize: 11,
            letterSpacing: 4,
            color: T.muted,
            fontWeight: 'bold',
            marginBottom: 16,
          }}>
            ▸ METHODOLOGY · COMPLIANCE
          </div>
          <h1 style={{
            fontSize: 42,
            fontWeight: 'bold',
            letterSpacing: -0.5,
            lineHeight: 1.15,
            margin: '0 0 20px 0',
            color: T.text,
          }}>
            How DialerSeat dials — and how we stay compliant doing it
          </h1>
          <p style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: T.muted,
            margin: 0,
            maxWidth: 700,
          }}>
            DialerSeat supports four dialing modes: preview, power, progressive, and predictive. Each one handles a different tradeoff between agent productivity and regulatory exposure. This page explains what each mode does, what the law says about it, and what our software does specifically to stay on the right side of the line.
          </p>
        </div>

        {/* TL;DR TABLE */}
        <section style={{ marginBottom: 56 }}>
          <SectionLabel>TL;DR</SectionLabel>
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
                  modeColor={T.muted}
                  how="Lead profile loads. Agent reviews context. Agent clicks DIAL or SKIP."
                  speed="Slowest"
                  abandons="Zero"
                  bestFor="High-value B2B, appointment confirmations, re-engagement"
                />
                <ModeRow
                  mode="POWER"
                  modeColor={T.accent}
                  how="Agent clicks DIAL. One call at a time. Agent handles voicemails."
                  speed="Moderate"
                  abandons="Zero"
                  bestFor="Solo agents, lists with high consent quality"
                />
                <ModeRow
                  mode="PROGRESSIVE"
                  modeColor={T.green}
                  how="Auto-dials next lead after disposition. AMD filters voicemails."
                  speed="Fast"
                  abandons="Zero"
                  bestFor="Single agents who want pickup-density without compliance risk"
                />
                <ModeRow
                  mode="PREDICTIVE"
                  modeColor={T.red}
                  how="Multi-line dialing. Pacing algorithm. Auto-throttles at 2.5% abandon rate."
                  speed="Fastest"
                  abandons="Capped under 3% by law"
                  bestFor="Teams of 8+ concurrent agents on the same campaign"
                />
              </tbody>
            </table>
          </div>
        </section>

        {/* THE LAW SECTION */}
        <section style={{ marginBottom: 56 }}>
          <SectionLabel>THE LAW · WHAT WE OBEY</SectionLabel>
          <h2 style={h2}>The two regulations that govern outbound dialing</h2>
          <p style={p}>
            In the United States, outbound dialing is governed by two federal regulatory regimes that frequently overlap:
          </p>

          <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderLeft: `3px solid ${T.accent}`,
            borderRadius: 6,
            padding: '20px 24px',
            marginBottom: 16,
          }}>
            <h3 style={h3}>1. The Telephone Consumer Protection Act (TCPA)</h3>
            <p style={{ ...p, marginBottom: 8 }}>
              Enforced by the FCC, with a robust private right of action. The TCPA governs autodialed and prerecorded calls, with statutory damages of $500–$1,500 per call. The 2024 one-to-one consent rule (effective January 27, 2025) requires consumer consent to be specific to the seller calling — blanket consent given to a lead aggregator is no longer sufficient for autodialed marketing calls to that consumer.
            </p>
          </div>

          <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderLeft: `3px solid ${T.red}`,
            borderRadius: 6,
            padding: '20px 24px',
            marginBottom: 16,
          }}>
            <h3 style={h3}>2. The FTC Telemarketing Sales Rule (TSR), 16 CFR 310</h3>
            <p style={{ ...p, marginBottom: 8 }}>
              Enforced by the FTC and state Attorneys General. Section 310.4(b)(4) creates a&nbsp;
              <strong>safe harbor for predictive dialing</strong>&nbsp;— a detailed set of conditions under which abandoned calls won&apos;t trigger enforcement. The safe harbor requires four things, all of which DialerSeat enforces in software:
            </p>
            <ol style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: T.text,
              paddingLeft: 22,
              margin: '12px 0 0 0',
            }}>
              <li style={{ marginBottom: 8 }}>
                <strong>Abandonment rate ≤ 3%</strong> of calls answered by a live person, measured per campaign per 30-day window.
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Ring ≥ 15 seconds or 4 rings</strong> before treating an unanswered call as no-answer.
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Play a brief recorded notice</strong> if a live agent is not available within 2 seconds of the consumer&apos;s greeting, identifying the seller and the call&apos;s purpose.
              </li>
              <li>
                <strong>Maintain records</strong> documenting compliance with the above for at least 24 months.
              </li>
            </ol>
          </div>

          <p style={{ ...p, marginTop: 24 }}>
            Both regimes apply simultaneously. Compliance with one doesn&apos;t excuse violations of the other. Our software is built to enforce both.
          </p>
        </section>

        {/* THE FOUR MODES SECTION */}
        <section style={{ marginBottom: 56 }}>
          <SectionLabel>THE FOUR MODES · IN DETAIL</SectionLabel>

          <ModeBlock
            label="PREVIEW"
            color={T.muted}
            tagline="Manual gate before every call. Agent reviews lead context, then chooses."
            mechanics={[
              'Agent goes available + selects a preview-mode campaign.',
              'Click "LOAD NEXT LEAD" — system fetches a lead from the queue and displays the full profile (name, phone, all custom fields, prior call attempts).',
              'Agent decides: "DIAL THIS LEAD" or "SKIP THIS LEAD."',
              'Only on DIAL click does the call actually fire.',
            ]}
            compliance="Lowest regulatory exposure of any auto-call mode, because every call is preceded by an explicit human decision. There's no software-driven dialing decision to characterize as 'autodialing' under TCPA. No abandons are possible because the call doesn't exist until the agent fires it."
            bestFor="High-touch B2B sales, premium appointment confirmation, re-engaging warm leads where context-before-dial measurably improves conversion."
          />

          <ModeBlock
            label="POWER"
            color={T.accent}
            tagline="Agent-initiated. One call at a time. Agent handles voicemails personally."
            mechanics={[
              'Agent clicks "INITIATE DIAL SEQUENCE."',
              'System pulls the next available lead and dials immediately.',
              'Agent hears whatever picks up — human, voicemail, or no answer.',
              'After the call ends and a disposition is set, the next call only fires when the agent clicks again (or, in our implementation, after a brief pause).',
            ]}
            compliance="One call per agent at any moment. Zero abandoned calls structurally — there's only ever one connection per agent, so a human picking up always has an agent ready. The TSR's 3% abandon-rate cap doesn't apply because the architecture cannot produce abandoned calls."
            bestFor="Solo agents working a list at moderate pace. Teams that want predictable, consistent dialing without an algorithm in the loop."
          />

          <ModeBlock
            label="PROGRESSIVE"
            color={T.green}
            tagline="Auto-dial next lead. Answering Machine Detection (AMD) filters voicemails out."
            mechanics={[
              'Agent disposes the current call.',
              'After ~1.2 seconds, the system auto-dials the next available lead.',
              'AMD analyzes the first few seconds of audio when the line picks up.',
              'If AMD detects a voicemail or answering machine, the call is hung up immediately and disposed as NO_ANSWER_AMD. The agent never hears the voicemail.',
              'If AMD detects a human, the call connects to the agent normally.',
            ]}
            compliance="Still one call per agent at any moment. Still zero abandoned calls. The only difference vs. power mode is that voicemail-handling time is removed from the agent's day — which can roughly double effective pickup density on lists with high voicemail rates."
            bestFor="The default recommendation for solo agents and small teams. Same compliance profile as power mode, with substantially higher live-conversation density. Most ReadyMode users we've seen run progressive in practice."
          />

          <ModeBlock
            label="PREDICTIVE"
            color={T.red}
            tagline="Multi-line dialing. Pacing algorithm. Hard-capped at 3% abandon rate by software."
            mechanics={[
              'Each agent on the campaign heartbeats an active session every 30 seconds.',
              'A pacing algorithm computes target_lines = configured_multiplier (1.0×–3.0×, default 1.5×).',
              'Effective target lines = active_agents × target_lines.',
              'When a line should fire and an agent is free, dial happens automatically.',
              'AMD filters voicemails from reaching agents.',
              'A rolling 30-day abandon-rate calculation runs continuously.',
            ]}
            compliance={
              <>
                <strong>This is the only mode the FTC TSR safe harbor specifically addresses.</strong> DialerSeat enforces all four safe-harbor conditions:
                <br /><br />
                <strong>(1) The 3% cap.</strong> When the rolling 30-day abandon rate hits 2.5%, the pacing algorithm auto-throttles the campaign back to 1.0× lines per agent (i.e., progressive mode). It stays throttled until the rate drops below 2.0%. This 0.5% safety buffer means you should never come within striking distance of the 3% legal threshold, even with sudden answer-rate spikes.
                <br /><br />
                <strong>(2) Ring duration.</strong> Outbound calls are configured to ring for at least 15 seconds before being treated as unanswered.
                <br /><br />
                <strong>(3) Recorded notice on abandon.</strong> When an abandoned call occurs (a human answers and no agent is free within 2 seconds), the system plays a brief recorded notice identifying the seller before disconnecting, per § 310.4(b)(4)(iii). This is configured per-campaign by the campaign owner.
                <br /><br />
                <strong>(4) Records.</strong> Every call attempt, AMD result, agent assignment, and abandonment is logged in the campaign owner&apos;s records and exportable for compliance audits.
              </>
            }
            bestFor="Teams with 8+ concurrent agents on a single campaign. Below 8 agents, predictive's mathematical advantage over progressive is small, and the abandon-rate variance is high. We surface a warning in the dialer when fewer than 8 agents are active on a predictive campaign."
            extraNote="The 8-agent threshold isn't arbitrary. With fewer agents, even a small spike in answer rate can push abandon rate over the cap. With 8+ agents, statistical smoothing keeps abandon rate stable. This is consistent with industry standards."
          />
        </section>

        {/* WHAT WE DON'T DO YET */}
        <section style={{ marginBottom: 56 }}>
          <SectionLabel>HONEST DISCLOSURE · WHAT WE DON&apos;T DO YET</SectionLabel>
          <h2 style={h2}>Compliance is a layered problem. Here&apos;s what is and isn&apos;t our job.</h2>
          <p style={p}>
            DialerSeat enforces the dialer-side compliance requirements above. There are additional compliance requirements that fall on the campaign owner — the seller — that no dialer software can fully automate:
          </p>

          <ul style={{
            fontSize: 14,
            lineHeight: 1.8,
            color: T.text,
            paddingLeft: 22,
            margin: '20px 0',
          }}>
            <li style={{ marginBottom: 12 }}>
              <strong>Consent records.</strong> TCPA requires prior express written consent for autodialed marketing calls to wireless numbers. Under the 2024 one-to-one consent rule, that consent must name the specific seller calling. Verifying that your leads have valid consent is your responsibility as the seller. We are working on lead-level consent record storage and one-click verification, but it isn&apos;t live yet.
            </li>
            <li style={{ marginBottom: 12 }}>
              <strong>National Do Not Call (DNC) Registry scrubbing.</strong> The TSR requires sellers to scrub against the National DNC Registry before calling. We do not currently provide automatic DNC scrubbing — campaign owners are responsible for scrubbing their lists before upload. We&apos;re evaluating integration with commercial DNC scrub services.
            </li>
            <li style={{ marginBottom: 12 }}>
              <strong>State-specific calling windows.</strong> The TCPA limits calling to between 8:00 AM and 9:00 PM in the called party&apos;s local time zone. Several states impose stricter windows. We will surface area-code-based time zone hints, but campaign owners are responsible for ensuring their dialing windows comply with each state where their leads are located.
            </li>
            <li style={{ marginBottom: 12 }}>
              <strong>Litigator scrubbing.</strong> Commercial databases of known TCPA plaintiffs exist. Scrubbing against them is best practice for high-volume dialers. We don&apos;t currently integrate with these services.
            </li>
            <li>
              <strong>STIR/SHAKEN attestation.</strong> Numbers used through DialerSeat are SignalWire-provided, which provides full STIR/SHAKEN attestation. This reduces (but does not eliminate) carrier spam-labeling risk.
            </li>
          </ul>

          <p style={p}>
            We list these openly because we think it&apos;s the right way to talk to professional buyers. A dialer platform that claims to handle all of TCPA compliance for you is either lying or charging you a lot more than $35/week.
          </p>
        </section>

        {/* MULTI-LINE DISCLOSURE */}
        <section style={{ marginBottom: 56 }}>
          <SectionLabel>CURRENT IMPLEMENTATION · TRANSPARENCY</SectionLabel>
          <h2 style={h2}>What &quot;predictive&quot; mode does today on DialerSeat</h2>
          <p style={p}>
            We are intentionally cautious about how aggressively we ship multi-line predictive dialing. As of this writing, predictive mode on DialerSeat operates with all the monitoring infrastructure of a multi-line predictive dialer — session tracking, abandon-rate calculation, auto-throttle, AMD filtering — but defaults to single-line per agent until a campaign reaches the 8-agent concurrency threshold where multi-line dialing is statistically safe.
          </p>
          <p style={p}>
            In practice, this means: when you turn on predictive mode, you get progressive-style dialing (one call at a time per agent) plus full visibility into your abandon-rate exposure. If your campaign grows to 8+ concurrent agents, multi-line dialing engages automatically. If your campaign shrinks back below 8 agents, multi-line dialing disengages.
          </p>
          <p style={p}>
            We&apos;d rather ship a predictive mode that&apos;s slightly less aggressive than ReadyMode and never gets a customer fined, than the inverse. If your team has the agent count to safely operate at higher line ratios, you can configure that explicitly per campaign.
          </p>
        </section>

        {/* CTA */}
        <section style={{
          background: T.dark,
          borderRadius: 12,
          padding: '40px 32px',
          textAlign: 'center',
          marginTop: 64,
        }}>
          <div style={{
            fontSize: 11,
            letterSpacing: 4,
            color: '#8888aa',
            fontWeight: 'bold',
            marginBottom: 12,
          }}>▸ DIALERSEAT</div>
          <h2 style={{
            fontSize: 22,
            fontWeight: 'bold',
            letterSpacing: 1,
            color: 'white',
            margin: '0 0 12px 0',
          }}>
            $35/week. All four dialing modes. No call-volume limits.
          </h2>
          <p style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: '#c0c2ca',
            maxWidth: 540,
            margin: '0 auto 24px',
          }}>
            Cancel anytime. Your leads, recordings, and campaigns stay yours.
          </p>
          <Link href="/sign-up" style={{
            display: 'inline-block',
            padding: '14px 28px',
            background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
            borderRadius: 6,
            color: 'white',
            fontSize: 12,
            fontWeight: 'bold',
            letterSpacing: 3,
            textDecoration: 'none',
            boxShadow: '0 0 20px rgba(74,158,255,0.3)',
          }}>START FREE →</Link>
        </section>

        {/* FOOTER LEGAL DISCLAIMER */}
        <p style={{
          fontSize: 11,
          color: T.muted,
          lineHeight: 1.6,
          marginTop: 40,
          paddingTop: 24,
          borderTop: `1px solid ${T.border}`,
          letterSpacing: 0.3,
        }}>
          <strong>Not legal advice.</strong> This page describes our software&apos;s technical behavior with respect to specific U.S. federal regulations. It is not a legal opinion, does not establish an attorney-client relationship, and does not guarantee compliance for any specific use case. Telemarketing law varies by state and circumstance. Consult qualified counsel for advice on your specific operations. Last updated: May 2026. Citations: 16 CFR 310.4(b)(4); 47 CFR 64.1200; 47 USC 227.
        </p>
      </main>
    </div>
  )
}

// ── Helper components ──────────────────────────────────────────────────────

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

const ModeRow = ({ mode, modeColor, how, speed, abandons, bestFor }: {
  mode: string; modeColor: string; how: string; speed: string; abandons: string; bestFor: string
}) => (
  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
    <td style={{ ...td, fontWeight: 'bold', color: modeColor, letterSpacing: 2, fontSize: 11 }}>{mode}</td>
    <td style={td}>{how}</td>
    <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{speed}</td>
    <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{abandons}</td>
    <td style={{ ...td, fontSize: 12 }}>{bestFor}</td>
  </tr>
)

interface ModeBlockProps {
  label: string
  color: string
  tagline: string
  mechanics: string[]
  compliance: React.ReactNode
  bestFor: string
  extraNote?: string
}

const ModeBlock = ({ label, color, tagline, mechanics, compliance, bestFor, extraNote }: ModeBlockProps) => (
  <div style={{
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderLeft: `3px solid ${color}`,
    borderRadius: 8,
    padding: '24px 28px',
    marginBottom: 20,
  }}>
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: 14,
      marginBottom: 14,
      flexWrap: 'wrap',
    }}>
      <h3 style={{
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 4,
        color,
        margin: 0,
      }}>{label}</h3>
      <span style={{
        fontSize: 13,
        color: T.muted,
        fontStyle: 'italic',
      }}>{tagline}</span>
    </div>

    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10,
        letterSpacing: 3,
        color: T.muted,
        fontWeight: 'bold',
        marginBottom: 8,
      }}>HOW IT WORKS</div>
      <ol style={{
        fontSize: 13,
        lineHeight: 1.7,
        color: T.text,
        paddingLeft: 20,
        margin: 0,
      }}>
        {mechanics.map((m, i) => <li key={i} style={{ marginBottom: 4 }}>{m}</li>)}
      </ol>
    </div>

    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10,
        letterSpacing: 3,
        color: T.muted,
        fontWeight: 'bold',
        marginBottom: 8,
      }}>COMPLIANCE</div>
      <div style={{
        fontSize: 13,
        lineHeight: 1.7,
        color: T.text,
      }}>{compliance}</div>
    </div>

    <div>
      <div style={{
        fontSize: 10,
        letterSpacing: 3,
        color: T.muted,
        fontWeight: 'bold',
        marginBottom: 8,
      }}>BEST FOR</div>
      <p style={{
        fontSize: 13,
        lineHeight: 1.7,
        color: T.text,
        margin: 0,
      }}>{bestFor}</p>
    </div>

    {extraNote && (
      <div style={{
        marginTop: 16,
        padding: '12px 14px',
        background: T.bg,
        borderRadius: 6,
        fontSize: 12,
        lineHeight: 1.6,
        color: T.muted,
        fontStyle: 'italic',
      }}>{extraNote}</div>
    )}
  </div>
)

// ── Styles ─────────────────────────────────────────────────────────────────

const h2 = {
  fontSize: 24,
  fontWeight: 'bold' as const,
  letterSpacing: -0.2,
  lineHeight: 1.3,
  margin: '0 0 16px 0',
  color: T.text,
}

const h3 = {
  fontSize: 16,
  fontWeight: 'bold' as const,
  letterSpacing: 1,
  margin: '0 0 10px 0',
  color: T.text,
}

const p = {
  fontSize: 15,
  lineHeight: 1.7,
  color: T.text,
  margin: '0 0 16px 0',
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