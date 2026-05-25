// =============================================================================
// WL CALLOUT
// =============================================================================
// Small "FOR AGENCIES" callout block, used on:
//   - Landing page (between PRICING and FINAL CTA)
//   - Every /vs/<competitor>/view.tsx page (between "Where DialerSeat Wins"
//     and the final CTA section)
//
// DESIGN:
//   Matches the existing dark-on-light section rhythm used across the site —
//   centered, dark surface card with blue glow, mailto CTA. Stays out of the
//   primary conversion path (the $35/wk signup CTA) so it doesn't dilute it.
//
// COPY:
//   Leads with the agency-reseller angle. Mentions weekly billing + no
//   contract because that's the genuine differentiator against Convoso /
//   CallTools / ReadyMode reseller programs ($500-2k/mo minimums + annual
//   commits). Email goes to whitelabel@dialerseat.com (must be created as
//   a Google Workspace alias before this ships — see v20 reminders).
//
// VARIANTS:
//   Two layout variants so the callout reads naturally in two different
//   page contexts:
//     - "centered" — for landing-style pages where everything else is centered
//     - "card"     — for /vs pages where everything is in a 1080px column
//   Both share copy and CTA; only the chrome differs.
// =============================================================================

import Link from 'next/link'

interface WLCalloutProps {
  variant?: 'centered' | 'card'
}

export default function WLCallout({ variant = 'centered' }: WLCalloutProps) {
  if (variant === 'card') return <CardVariant />
  return <CenteredVariant />
}

// ── CENTERED VARIANT (landing) ─────────────────────────────────────────────
// Full-width section that drops between PRICING and FINAL CTA on the landing.
// Mirrors the visual rhythm of other landing sections (section padding,
// centered headline + lede).
function CenteredVariant() {
  return (
    <section className="ds-section ds-wl-section" style={{
      maxWidth: 880,
      margin: '0 auto',
      textAlign: 'center',
    }}>
      <style>{`
        .ds-wl-section { padding: 80px 60px; }
        @media (max-width: 768px) {
          .ds-wl-section { padding: 56px 20px; }
          .ds-wl-h2 { font-size: 24px !important; letter-spacing: 3px !important; }
          .ds-wl-card { padding: 32px 24px !important; }
          .ds-wl-rate { font-size: 22px !important; letter-spacing: 0 !important; }
        }
      `}</style>

      <div style={{
        fontSize: 11,
        letterSpacing: 4,
        color: 'var(--accent-blue)',
        fontWeight: 'bold',
        marginBottom: 14,
      }}>
        FOR AGENCIES & RESELLERS
      </div>

      <h2 className="ds-wl-h2" style={{
        fontSize: 36,
        fontWeight: 'bold',
        letterSpacing: 6,
        color: 'var(--text-primary)',
        marginBottom: 16,
        lineHeight: 1.15,
      }}>
        WHITE-LABEL DIALERSEAT
      </h2>

      <p style={{
        fontSize: 15,
        lineHeight: 1.7,
        color: 'var(--text-secondary)',
        maxWidth: 640,
        margin: '0 auto 32px',
      }}>
        Run your own dialer brand. Your domain, your logo, your customers.
        Weekly billing — no $500/month minimums, no annual contracts.
      </p>

      <div className="ds-wl-card" style={{
        display: 'inline-block',
        padding: '32px 48px',
        borderRadius: 16,
        background: 'var(--surface)',
        border: '1px solid var(--accent-blue)',
        boxShadow: '0 0 60px rgba(74,158,255,0.10)',
        marginBottom: 24,
      }}>
        <div className="ds-wl-rate" style={{
          fontSize: 28,
          fontWeight: 'bold',
          letterSpacing: 1,
          color: 'var(--text-primary)',
          marginBottom: 6,
        }}>
          $115<span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 'normal' }}>/wk base</span>
          <span style={{ margin: '0 12px', color: 'var(--text-secondary)', fontWeight: 'normal' }}>+</span>
          $35<span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 'normal' }}>/wk per agent seat</span>
        </div>
        <div style={{
          fontSize: 11,
          letterSpacing: 3,
          color: 'var(--text-secondary)',
        }}>
          WEEKLY BILLING · NO CONTRACT · CANCEL ANYTIME
        </div>
      </div>

      <div>
        <Link
          href="mailto:whitelabel@dialerseat.com?subject=White-Label%20Inquiry"
          style={{
            display: 'inline-block',
            padding: '16px 36px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 'bold',
            letterSpacing: 3,
            color: 'white',
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
            boxShadow: '0 0 40px rgba(74,158,255,0.3)',
          }}
        >
          REQUEST WHITE-LABEL →
        </Link>
      </div>
    </section>
  )
}

// ── CARD VARIANT (/vs pages) ──────────────────────────────────────────────
// Inline card meant to drop into the existing /vs/<x>/view.tsx layout, which
// uses a 1080px content column with `.vs-section` padding. The card is
// constrained to that column and uses the local Futura PT styling.
function CardVariant() {
  return (
    <div className="vs-section" style={{ paddingTop: 0 }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #0a0a14 100%)',
        borderRadius: 16,
        padding: '48px 40px',
        textAlign: 'center',
        color: 'white',
        boxShadow: '0 12px 40px rgba(10,10,20,0.18)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Atmospheric glow, same trick the /vs hero uses */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 30% 30%, rgba(74,158,255,0.18) 0%, transparent 50%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative' }}>
          <div style={{
            fontSize: 11,
            letterSpacing: 3,
            color: '#4a9eff',
            fontWeight: 'bold',
            marginBottom: 12,
          }}>
            FOR AGENCIES & RESELLERS
          </div>

          <h2 style={{
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: -0.5,
            margin: '0 0 14px 0',
            lineHeight: 1.15,
          }}>
            White-label DialerSeat — without the enterprise contract.
          </h2>

          <p style={{
            fontSize: 15,
            lineHeight: 1.65,
            color: '#c4c8d8',
            maxWidth: 640,
            margin: '0 auto 28px',
          }}>
            Run your own branded dialer on your own domain. $115/week base
            + $35/week per agent seat. Weekly billing, no annual contract,
            cancel any time — unlike most reseller programs that lock you
            into multi-thousand-dollar monthly minimums.
          </p>

          <Link
            href="mailto:whitelabel@dialerseat.com?subject=White-Label%20Inquiry"
            style={{
              display: 'inline-block',
              padding: '14px 32px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 'bold',
              letterSpacing: 2.5,
              color: 'white',
              textDecoration: 'none',
              background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
              boxShadow: '0 0 24px rgba(74,158,255,0.4)',
            }}
          >
            REQUEST WHITE-LABEL →
          </Link>
        </div>
      </div>
    </div>
  )
}