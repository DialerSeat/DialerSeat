'use client'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'

const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
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

export default function BillingFaqView() {
  const { isSignedIn } = useUser()

  return (
    <div
      style={{
        flex: 1,
        background: T.bg,
        minHeight: 'calc(100vh - 64px)',
        fontFamily: 'Futura PT, Futura, sans-serif',
        color: T.text,
      }}
    >
      <style>{`
        .bil-root { max-width: 820px; margin: 0 auto; padding: 80px 32px 120px; }
        .bil-eyebrow {
          font-size: 11px; letter-spacing: 4px; color: ${T.muted};
          font-weight: bold; margin-bottom: 18px;
        }
        .bil-h1 {
          font-size: 42px; line-height: 1.15; letter-spacing: -0.5px;
          font-weight: 700; margin: 0 0 24px 0;
        }
        .bil-h1 em { font-style: normal; color: ${T.green}; }
        .bil-deck {
          font-size: 19px; line-height: 1.6; color: ${T.muted};
          margin-bottom: 40px; max-width: 680px;
        }
        .bil-badge-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 56px; }
        .bil-badge {
          padding: 8px 16px; border-radius: 20px; font-size: 12px;
          font-weight: bold; letter-spacing: 1px; border: 1px solid ${T.border};
          background: white; color: ${T.text};
        }
        .bil-badge.hi { background: ${T.dark}; color: #8fd18f; border-color: ${T.dark}; }

        .bil-section { margin: 56px 0; }
        .bil-section h2 {
          font-size: 13px; letter-spacing: 3px; font-weight: bold;
          color: ${T.accent}; margin: 0 0 18px 0;
          padding-bottom: 10px; border-bottom: 1px solid ${T.border};
        }
        .bil-section h3 {
          font-size: 22px; line-height: 1.3; font-weight: 700;
          margin: 28px 0 14px 0; letter-spacing: -0.2px;
        }
        .bil-section p {
          font-size: 16px; line-height: 1.75; margin: 0 0 18px 0;
          color: ${T.text};
        }
        .bil-section p.muted { color: ${T.muted}; font-size: 15px; }
        .bil-section strong { color: ${T.text}; font-weight: 700; }
        .bil-section em { font-style: italic; color: ${T.accent}; }
        .bil-section ul { margin: 14px 0 24px 0; padding-left: 22px; }
        .bil-section li { font-size: 16px; line-height: 1.75; margin-bottom: 8px; }

        /* SCENARIO CARDS */
        .bil-scenario {
          margin: 20px 0; padding: 24px 26px; background: white;
          border: 1px solid ${T.border}; border-radius: 8px;
        }
        .bil-scenario-eyebrow {
          font-size: 10px; letter-spacing: 3px; font-weight: bold;
          color: ${T.accent}; margin-bottom: 10px;
        }
        .bil-scenario h4 { font-size: 18px; margin: 0 0 12px 0; font-weight: 700; }
        .bil-scenario p { font-size: 15px; line-height: 1.7; margin: 0 0 10px 0; color: ${T.text}; }
        .bil-scenario p:last-child { margin-bottom: 0; }

        /* TIMELINE */
        .bil-flow { display: flex; flex-direction: column; gap: 0; margin: 24px 0 8px; }
        .bil-flow-step {
          display: flex; gap: 16px; padding: 14px 0; align-items: flex-start;
          border-left: 2px solid ${T.border}; padding-left: 22px; margin-left: 15px;
          position: relative;
        }
        .bil-flow-step::before {
          content: ''; position: absolute; left: -7px; top: 18px;
          width: 12px; height: 12px; border-radius: 50%;
          background: ${T.green}; border: 2px solid white;
        }
        .bil-flow-step:last-child { border-left: 2px solid transparent; }
        .bil-flow-body h4 { font-size: 15px; margin: 0 0 4px 0; font-weight: 700; }
        .bil-flow-body p { font-size: 14px; line-height: 1.6; margin: 0; color: ${T.muted}; }

        .bil-callout {
          margin: 32px 0; padding: 22px 26px; background: ${T.surface};
          border-left: 3px solid ${T.amber}; border-radius: 4px;
        }
        .bil-callout p { font-size: 15px; line-height: 1.7; margin: 0; color: ${T.text}; }
        .bil-callout strong { color: ${T.accent}; }

        .bil-related {
          margin-top: 48px; padding-top: 28px; border-top: 1px solid ${T.border};
        }
        .bil-related-label {
          font-size: 10px; letter-spacing: 3px; color: ${T.muted};
          font-weight: bold; margin-bottom: 14px;
        }
        .bil-related-links { display: flex; gap: 24px; flex-wrap: wrap; }
        .bil-related-links a {
          font-size: 13px; color: ${T.accent}; text-decoration: none;
          border-bottom: 1px solid transparent; padding-bottom: 1px;
          transition: border-color 0.15s;
        }
        .bil-related-links a:hover { border-bottom-color: ${T.accent}; }

        .bil-cta-box {
          margin-top: 56px; padding: 40px 36px; background: ${T.dark};
          border-radius: 8px; text-align: center;
        }
        .bil-cta-box .bil-cta-eyebrow {
          font-size: 10px; letter-spacing: 4px; color: #8fd18f;
          font-weight: bold; margin-bottom: 14px;
        }
        .bil-cta-box .bil-cta-h {
          font-size: 26px; color: white; font-weight: 700;
          margin: 0 0 12px 0; letter-spacing: -0.2px;
        }
        .bil-cta-box p { font-size: 15px; color: #c0c2ca; line-height: 1.6; margin: 0 0 28px 0; }
        .bil-cta-box .bil-cta-btn {
          display: inline-block; padding: 16px 36px;
          background: linear-gradient(135deg, #2fd16a, #1a8a4a);
          border: none; border-radius: 6px; color: white;
          font-size: 12px; font-weight: bold; letter-spacing: 3px;
          text-decoration: none; font-family: 'Futura PT', Futura, sans-serif;
          box-shadow: 0 0 24px rgba(47,209,106,0.25);
        }

        @media (max-width: 768px) {
          .bil-root { padding: 48px 20px 80px; }
          .bil-h1 { font-size: 28px; }
          .bil-deck { font-size: 16px; }
          .bil-section h3 { font-size: 19px; }
          .bil-section p, .bil-section li { font-size: 15px; }
          .bil-scenario { padding: 20px 20px; }
          .bil-cta-box { padding: 32px 24px; }
          .bil-cta-box .bil-cta-h { font-size: 22px; }
        }
      `}</style>

      <article className="bil-root">
        <div className="bil-eyebrow">▸ BILLING &amp; CANCELLATION</div>

        <h1 className="bil-h1">
          &ldquo;Cancel anytime&rdquo; is a real button, not a phone call. <em>Here&apos;s exactly what it does.</em>
        </h1>

        <p className="bil-deck">
          Every dialer says &ldquo;no contracts.&rdquo; Fewer explain what
          actually happens the moment you click cancel, what a failed
          card does to your account, or how billing works when you add a
          seat mid-week. Here&apos;s the real mechanics, not just the
          marketing line.
        </p>

        <div className="bil-badge-row">
          <span className="bil-badge hi">BILLED WEEKLY VIA STRIPE</span>
          <span className="bil-badge">NO ANNUAL COMMITMENT</span>
          <span className="bil-badge">CANCEL KEEPS ACCESS THROUGH THE WEEK</span>
        </div>

        {/* ── WHAT CANCEL ACTUALLY DOES ──────────────────────────────────── */}
        <section className="bil-section">
          <h2>▸ WHAT HAPPENS THE MOMENT YOU CLICK CANCEL</h2>
          <p>
            Cancellation doesn&apos;t cut your access off immediately.
            It schedules the subscription to end at the close of the
            current billing period — meaning if you cancel on day 2 of a
            paid week, you keep full access through day 7. You&apos;re not
            charged again after that, and nothing auto-renews.
          </p>

          <div className="bil-flow">
            <div className="bil-flow-step">
              <div className="bil-flow-body">
                <h4>YOU CLICK CANCEL</h4>
                <p>The subscription is marked to end at period close. No refund is issued for the current week — you already paid for it, so you keep it.</p>
              </div>
            </div>
            <div className="bil-flow-step">
              <div className="bil-flow-body">
                <h4>YOU KEEP DIALING</h4>
                <p>Full access continues completely normally for the rest of the paid week — nothing is restricted or downgraded early.</p>
              </div>
            </div>
            <div className="bil-flow-step">
              <div className="bil-flow-body">
                <h4>THE WEEK ENDS</h4>
                <p>Access stops. No further charge happens. There&apos;s nothing else to do — no retention call, no confirmation email you have to click through.</p>
              </div>
            </div>
          </div>

          <p className="muted" style={{ marginTop: 20 }}>
            Changed your mind before the week ends? Reactivating just
            un-schedules the cancellation — you&apos;re not treated as a
            new signup and don&apos;t lose anything.
          </p>
        </section>

        {/* ── FAILED PAYMENT ─────────────────────────────────────────────── */}
        <section className="bil-section">
          <h2>▸ WHAT A FAILED CARD ACTUALLY DOES</h2>
          <p>
            If a weekly charge fails — expired card, insufficient funds,
            bank decline — the subscription moves to a{' '}
            <strong>past due</strong> state rather than canceling
            immediately. Stripe automatically retries the charge on its
            standard retry schedule.
          </p>

          <div className="bil-scenario">
            <div className="bil-scenario-eyebrow">IF YOU&apos;RE ON MANAGER+ WITH WHITE-LABEL ACTIVE</div>
            <h4>Your branded domain deactivates immediately on past-due.</h4>
            <p>
              This is the one place a failed payment has an immediate,
              visible effect: white-label goes inactive the moment a
              charge fails, not after a grace period. The moment payment
              succeeds again — whether from an automatic retry or you
              updating your card — it reactivates on its own, no support
              ticket required.
            </p>
          </div>

          <p className="muted">
            You can still cancel a past-due subscription yourself if
            you&apos;d rather stop retrying than fix the card — canceling
            isn&apos;t blocked just because a payment failed.
          </p>
        </section>

        {/* ── MID-WEEK SEAT CHANGES ──────────────────────────────────────── */}
        <section className="bil-section">
          <h2>▸ ADDING OR REMOVING A SEAT MID-WEEK</h2>
          <p>
            Each seat — Pro, Manager+, or an agent seat under a
            Manager+ team — is its own Stripe subscription. Adding a
            seat starts billing for that seat from the moment it&apos;s
            created; removing one follows the same cancel-at-period-end
            rule as canceling your own account, so you don&apos;t lose
            access to a seat you already paid for that week.
          </p>
          <p>
            For the manager-side mechanics of this — who pays for which
            seat, owner-pays vs. agent-pays — see{' '}
            <Link href="/faq/manager-plus">what Manager+ adds over
            Pro</Link> and <Link href="/faq/dialerseat-teams">DialerSeat
            for teams</Link>.
          </p>
        </section>

        {/* ── HONEST NOTE ───────────────────────────────────────────────── */}
        <div className="bil-callout">
          <p>
            <strong>One thing worth knowing —</strong> there&apos;s no
            annual or upfront billing option today. Every plan bills
            weekly, which means no discount for committing longer term,
            but also means you&apos;re never sitting on months of prepaid
            access you can&apos;t get back if your situation changes. See{' '}
            <Link href="/faq/why-we-charge">why we charge what we
            charge</Link> for the fuller reasoning behind weekly billing
            as the default.
          </p>
        </div>

        {/* ── RELATED ────────────────────────────────────────────────────── */}
        <div className="bil-related">
          <div className="bil-related-label">▸ RELATED READING</div>
          <div className="bil-related-links">
            <Link href="/faq/why-we-charge">Why we charge what we charge</Link>
            <Link href="/faq/manager-plus">What Manager+ adds over Pro</Link>
            <Link href="/faq/dialerseat-teams">DialerSeat for teams</Link>
            <Link href="/faq/data-and-recordings">Recordings &amp; your data</Link>
            <Link href="/faq">FAQ</Link>
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────────  */}
        <div className="bil-cta-box">
          <div className="bil-cta-eyebrow">▸ NO CONTRACT, NO RETENTION CALL</div>
          <h3 className="bil-cta-h">$35/week. Cancel with one click, any time.</h3>
          <p>
            You keep access through what you already paid for — nothing
            cut off early, nothing to negotiate.
          </p>
          <a href={isSignedIn ? '/dashboard' : '/sign-up'} className="bil-cta-btn">
            {isSignedIn ? 'GO TO DASHBOARD →' : 'GET STARTED →'}
          </a>
        </div>
      </article>
    </div>
  )
}
