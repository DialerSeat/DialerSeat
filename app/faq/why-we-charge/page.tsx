'use client'

import Link from 'next/link'

// =============================================================================
// /faq/why-we-charge — WHY WE CHARGE WHAT WE CHARGE
// =============================================================================
// JC's pitch: $35/week per seat looks high next to "$99/month" competitors
// until you realize what's bundled. Every DialerSeat seat includes
// UNLIMITED dial-out numbers, multiple inbound numbers, voicemail
// detection, recording, four dialer modes, and no per-call charges.
// Most competitors charge per number, per minute, per agent on top of
// their base subscription.
//
// This page exists so prospects who balk at the weekly price can read a
// clear breakdown of what they're getting, and so existing customers
// have a link to share when they recommend the product.
//
// Themed via --brand-* variables so white-label tenants see this page in
// their own colors when linked from their dashboard footer.
// =============================================================================

const FUTURA = 'Futura PT, Futura, "Trebuchet MS", sans-serif'

export default function WhyWeChargeFaqPage() {
  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <Link href="/dashboard" style={backLinkStyle}>
          ← BACK TO DASHBOARD
        </Link>

        <h1 style={titleStyle}>WHY WE CHARGE WHAT WE CHARGE</h1>
        <div style={subtitleStyle}>
          $35 a week, per seat. Here&apos;s exactly what that buys you — and
          why most &ldquo;cheaper&rdquo; dialers cost more once you actually use them.
        </div>

        {/* ── HEADLINE ── */}
        <section style={sectionStyle}>
          <div style={sectionTitleStyle}>THE SHORT VERSION</div>
          <p style={paragraphStyle}>
            Most outbound dialers price like a software subscription
            and then charge you separately for everything that makes a
            dialer actually work — phone numbers, minutes used, voicemail
            detection, recording storage, additional agents. By the time
            you finish stacking add-ons, a &ldquo;$99 / month&rdquo; plan often
            runs $300–$600 a month per agent.
          </p>
          <p style={paragraphStyle}>
            DialerSeat bundles all of that into one weekly price. No
            metered minutes. No per-number fees. No tiered feature gates.
            One seat, one number, one price — or as many of each as you
            need, all included.
          </p>
        </section>

        {/* ── MULTIPLE NUMBERS ── */}
        <section style={sectionStyle}>
          <div style={sectionTitleStyle}>UNLIMITED PHONE NUMBERS</div>
          <p style={paragraphStyle}>
            Most dialers charge $1–$5 per phone number per month. They
            cap how many you can have. They charge extra if you want a
            number with a specific area code. If you want to spoof local
            presence — display a local number when calling that area —
            you&apos;re paying for dozens of numbers across dozens of area
            codes, every month, forever.
          </p>
          <p style={paragraphStyle}>
            On DialerSeat, every seat gets <strong>unlimited dial-out
            numbers</strong>. Add a number for every area code you call.
            Rotate them automatically. Burn one if it gets flagged and
            spin up a fresh one — no charge, no quota.
          </p>
          <p style={paragraphStyle}>
            You also get <strong>multiple inbound numbers</strong> per
            seat. Hand out different numbers for different lead sources,
            different campaigns, different markets — track which ones
            ring and which ones don&apos;t. All inbound calls route to your
            seat. All show up in your analytics.
          </p>
        </section>

        {/* ── WHAT'S INCLUDED ── */}
        <section style={sectionStyle}>
          <div style={sectionTitleStyle}>WHAT&apos;S INCLUDED IN $35 / WEEK</div>
          <div style={bulletListStyle}>
            <div style={bulletItemStyle}>
              <span style={bulletMarkStyle}>▸</span>
              <div>
                <div style={bulletLabelStyle}>FOUR DIALER MODES</div>
                <div style={bulletDescStyle}>
                  Preview, progressive, power, and predictive. Switch
                  between them per campaign. Competitors usually gate
                  predictive behind a higher tier.
                </div>
              </div>
            </div>
            <div style={bulletItemStyle}>
              <span style={bulletMarkStyle}>▸</span>
              <div>
                <div style={bulletLabelStyle}>UNLIMITED DIAL-OUT NUMBERS</div>
                <div style={bulletDescStyle}>
                  Add as many outbound numbers as you want. Any area code.
                  No per-number monthly fee.
                </div>
              </div>
            </div>
            <div style={bulletItemStyle}>
              <span style={bulletMarkStyle}>▸</span>
              <div>
                <div style={bulletLabelStyle}>MULTIPLE INBOUND NUMBERS</div>
                <div style={bulletDescStyle}>
                  Multiple ring-in lines per seat. Track different lead
                  sources or campaigns by which number rang.
                </div>
              </div>
            </div>
            <div style={bulletItemStyle}>
              <span style={bulletMarkStyle}>▸</span>
              <div>
                <div style={bulletLabelStyle}>AUTOMATIC VOICEMAIL DETECTION</div>
                <div style={bulletDescStyle}>
                  Skip voicemails automatically, leave pre-recorded
                  messages, or transfer to a live agent — your call.
                </div>
              </div>
            </div>
            <div style={bulletItemStyle}>
              <span style={bulletMarkStyle}>▸</span>
              <div>
                <div style={bulletLabelStyle}>CALL RECORDING + STORAGE</div>
                <div style={bulletDescStyle}>
                  Every call recorded and stored. No separate storage
                  tier, no per-minute archival fees.
                </div>
              </div>
            </div>
            <div style={bulletItemStyle}>
              <span style={bulletMarkStyle}>▸</span>
              <div>
                <div style={bulletLabelStyle}>UNMETERED MINUTES</div>
                <div style={bulletDescStyle}>
                  Dial as much as you want. There is no per-minute charge.
                  There is no monthly minute cap.
                </div>
              </div>
            </div>
            <div style={bulletItemStyle}>
              <span style={bulletMarkStyle}>▸</span>
              <div>
                <div style={bulletLabelStyle}>LEAD MANAGEMENT + CRM-LIGHT</div>
                <div style={bulletDescStyle}>
                  Import leads from CSV. Add notes, dispositions, custom
                  fields. Filter and segment for follow-up.
                </div>
              </div>
            </div>
            <div style={bulletItemStyle}>
              <span style={bulletMarkStyle}>▸</span>
              <div>
                <div style={bulletLabelStyle}>ANALYTICS</div>
                <div style={bulletDescStyle}>
                  Contact rate, talk time, conversion rate, best-time-to-
                  call analysis. Per-campaign, per-agent, per-number.
                </div>
              </div>
            </div>
            <div style={bulletItemStyle}>
              <span style={bulletMarkStyle}>▸</span>
              <div>
                <div style={bulletLabelStyle}>TEAM FEATURES</div>
                <div style={bulletDescStyle}>
                  Manager+ adds team rosters, owner-paid or agent-paid
                  seats, shared campaigns, role-based access. See the{' '}
                  <Link href="/faq/dialerseat-teams" style={inlineLinkStyle}>
                    Teams FAQ
                  </Link>{' '}
                  for the full breakdown.
                </div>
              </div>
            </div>
            <div style={bulletItemStyle}>
              <span style={bulletMarkStyle}>▸</span>
              <div>
                <div style={bulletLabelStyle}>NO CONTRACT</div>
                <div style={bulletDescStyle}>
                  Cancel anytime from settings. Pro-rated to the end of
                  your current week.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── COMPARISON ── */}
        <section style={sectionStyle}>
          <div style={sectionTitleStyle}>HOW THE MATH ACTUALLY WORKS</div>
          <p style={paragraphStyle}>
            Take a typical &ldquo;$99/month&rdquo; dialer. By the time you add:
          </p>
          <div style={comparisonTableStyle}>
            <div style={comparisonRowStyle}>
              <span style={comparisonLabelStyle}>BASE PLAN</span>
              <span style={comparisonValueStyle}>$99 / mo</span>
            </div>
            <div style={comparisonRowStyle}>
              <span style={comparisonLabelStyle}>10 PHONE NUMBERS @ $3 EA</span>
              <span style={comparisonValueStyle}>$30 / mo</span>
            </div>
            <div style={comparisonRowStyle}>
              <span style={comparisonLabelStyle}>3,000 OUTBOUND MIN @ $0.015</span>
              <span style={comparisonValueStyle}>$45 / mo</span>
            </div>
            <div style={comparisonRowStyle}>
              <span style={comparisonLabelStyle}>VOICEMAIL DETECTION ADD-ON</span>
              <span style={comparisonValueStyle}>$25 / mo</span>
            </div>
            <div style={comparisonRowStyle}>
              <span style={comparisonLabelStyle}>RECORDING STORAGE</span>
              <span style={comparisonValueStyle}>$15 / mo</span>
            </div>
            <div style={comparisonRowStyle}>
              <span style={comparisonLabelStyle}>PREDICTIVE MODE UPGRADE</span>
              <span style={comparisonValueStyle}>$40 / mo</span>
            </div>
            <div style={{ ...comparisonRowStyle, borderBottom: 'none', paddingTop: 10, marginTop: 6, borderTop: '1px solid var(--brand-card-border)' }}>
              <span style={{ ...comparisonLabelStyle, fontWeight: 700, color: 'var(--brand-on-page-bg)' }}>TOTAL PER MONTH</span>
              <span style={{ ...comparisonValueStyle, color: 'var(--color-error, #ff8888)', fontWeight: 700 }}>~$254 / mo</span>
            </div>
            <div style={comparisonRowStyle}>
              <span style={{ ...comparisonLabelStyle, fontWeight: 700, color: 'var(--brand-primary)' }}>DIALERSEAT (4 WEEKS)</span>
              <span style={{ ...comparisonValueStyle, color: 'var(--brand-primary)', fontWeight: 700 }}>$140 / mo</span>
            </div>
          </div>
          <p style={paragraphStyle}>
            And our $140 includes <strong>unlimited</strong> numbers,
            <strong> unlimited</strong> minutes, every dialer mode, and
            every feature. No tier gates. No per-line surcharges.
          </p>
        </section>

        {/* ── WHY WE CAN DO IT ── */}
        <section style={sectionStyle}>
          <div style={sectionTitleStyle}>WHY WE CAN PRICE THIS WAY</div>
          <p style={paragraphStyle}>
            We&apos;re a focused team running on modern infrastructure. We
            negotiate carrier rates directly. We don&apos;t pay a sales force
            to talk you into a 12-month contract. We don&apos;t pay for the
            kind of marketing budget that funds &ldquo;feature parity&rdquo; pages
            and steakhouse dinners. That overhead is what you&apos;re really
            paying for at the legacy dialer companies — it just shows up
            on your invoice as &ldquo;extra phone numbers.&rdquo;
          </p>
          <p style={paragraphStyle}>
            We&apos;d rather charge a flat, weekly, all-in price and let
            our product do the selling. If it doesn&apos;t earn its keep in
            a week, cancel it. No call to retention. No exit interview.
          </p>
        </section>

        {/* ── WHY WEEKLY ── */}
        <section style={sectionStyle}>
          <div style={sectionTitleStyle}>WHY WEEKLY INSTEAD OF MONTHLY</div>
          <p style={paragraphStyle}>
            Outbound dialing is a weekly rhythm. Most operators dial
            Monday through Friday, evaluate Friday afternoon, plan the
            next week. A weekly bill matches that rhythm. If a week is
            slow — you&apos;re traveling, you took on a different project,
            a campaign dried up — you pause for that week. You don&apos;t
            owe us 30 days&apos; notice.
          </p>
          <p style={paragraphStyle}>
            Monthly contracts exist mostly to make cancellations harder.
            Weekly billing makes them frictionless. That&apos;s by design.
          </p>
        </section>

        {/* ── FOOTER CTA ── */}
        <div style={ctaBoxStyle}>
          <div style={ctaTextStyle}>
            Questions about pricing for teams, white-label, or
            multi-seat setups? Email{' '}
            <a href="mailto:support@dialerseat.com" style={inlineLinkStyle}>
              support@dialerseat.com
            </a>.
          </div>
        </div>

        <Link href="/dashboard" style={backLinkStyle}>
          ← BACK TO DASHBOARD
        </Link>
      </div>
    </main>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--brand-page-bg)',
  padding: '40px 20px',
  fontFamily: FUTURA,
  color: 'var(--brand-on-page-bg)',
}

const cardStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: '0 auto',
  background: 'var(--brand-card-surface)',
  border: '1px solid var(--brand-card-border)',
  borderTop: '3px solid var(--brand-primary)',
  borderRadius: 6,
  padding: '36px 40px',
  boxSizing: 'border-box',
}

const backLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 10,
  letterSpacing: 3,
  color: 'var(--brand-primary)',
  textDecoration: 'none',
  fontWeight: 700,
  marginBottom: 28,
  marginTop: 24,
}

const titleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  letterSpacing: 4,
  color: 'var(--brand-primary)',
  marginBottom: 12,
  marginTop: 0,
  lineHeight: 1.2,
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: 'var(--brand-muted-text)',
  marginBottom: 36,
  letterSpacing: 0.3,
}

const sectionStyle: React.CSSProperties = {
  marginBottom: 32,
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 3,
  fontWeight: 700,
  color: 'var(--brand-primary)',
  marginBottom: 12,
  paddingBottom: 8,
  borderBottom: '1px solid var(--brand-card-border)',
}

const paragraphStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.7,
  color: 'var(--brand-on-page-bg)',
  marginBottom: 12,
  letterSpacing: 0.2,
}

const bulletListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  marginTop: 14,
}

const bulletItemStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'flex-start',
}

const bulletMarkStyle: React.CSSProperties = {
  color: 'var(--brand-primary)',
  fontSize: 14,
  fontWeight: 700,
  marginTop: 1,
  flexShrink: 0,
}

const bulletLabelStyle: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: 2,
  fontWeight: 700,
  color: 'var(--brand-on-page-bg)',
  marginBottom: 4,
}

const bulletDescStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.6,
  color: 'var(--brand-muted-text)',
  letterSpacing: 0.2,
}

const comparisonTableStyle: React.CSSProperties = {
  background: 'var(--brand-page-bg)',
  border: '1px solid var(--brand-card-border)',
  borderRadius: 4,
  padding: 16,
  margin: '14px 0',
}

const comparisonRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 0',
  borderBottom: '1px solid var(--brand-card-border)',
  fontSize: 12,
}

const comparisonLabelStyle: React.CSSProperties = {
  letterSpacing: 1.5,
  color: 'var(--brand-muted-text)',
  fontSize: 11,
  fontWeight: 500,
}

const comparisonValueStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 13,
  color: 'var(--brand-on-page-bg)',
  letterSpacing: 0.5,
}

const inlineLinkStyle: React.CSSProperties = {
  color: 'var(--brand-primary)',
  textDecoration: 'underline',
  fontWeight: 700,
}

const ctaBoxStyle: React.CSSProperties = {
  background: 'var(--brand-primary-soft)',
  border: '1px solid color-mix(in srgb, var(--brand-primary) 30%, transparent)',
  borderLeft: '3px solid var(--brand-primary)',
  borderRadius: 4,
  padding: 16,
  marginTop: 32,
  marginBottom: 24,
}

const ctaTextStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.6,
  color: 'var(--brand-on-page-bg)',
  letterSpacing: 0.3,
}