'use client'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import FaqTheme from '@/components/faq-theme'
import { SITE } from '@/lib/siteTheme'


export default function BillingFaqView() {
  const { isSignedIn } = useUser()

  return (
    <>
      <SiteHeader />
      <div
        style={{
          flex: 1,
          background: SITE.bg,
          minHeight: 'calc(100vh - 64px)',
          fontFamily: 'Futura PT, Futura, sans-serif',
          color: SITE.text,
        }}
      >
        <FaqTheme />
        <style>{`
/* SCENARIO CARDS */
          .bil-scenario {
            margin: 20px 0; padding: 24px 26px; background: ${SITE.surface};
            border: 1px solid ${SITE.border}; border-radius: 8px;
          }
          .bil-scenario-eyebrow {
            font-size: 10px; letter-spacing: 3px; font-weight: bold;
            color: ${SITE.deep}; margin-bottom: 10px;
          }
          .bil-scenario h4 { font-size: 18px; margin: 0 0 12px 0; font-weight: 700; }
          .bil-scenario p { font-size: 15px; line-height: 1.7; margin: 0 0 10px 0; color: ${SITE.text}; }
          .bil-scenario p:last-child { margin-bottom: 0; }@media (max-width: 768px) {
            .bil-scenario { padding: 20px 20px; }
          }
        `}</style>

        <article className="faq-root">
          <div className="faq-eyebrow">▸ BILLING &amp; CANCELLATION</div>
          <span style={{ fontSize: 11, color: '#8888aa', letterSpacing: '2px', display: 'block', marginBottom: 16 }}>LAST UPDATED 07/28/2026</span>

          <h1 className="faq-h1">
            &ldquo;Cancel anytime&rdquo; is a real button, not a phone call. <em>Here&apos;s exactly what it does.</em>
          </h1>

          <p className="faq-deck">
            Every dialer says &ldquo;no contracts.&rdquo; Fewer explain what
            actually happens the moment you click cancel, what a failed
            card does to your account, or how billing works when you add a
            seat mid-week. Here&apos;s the real mechanics, not just the
            marketing line.
          </p>

          <div className="faq-badge-row">
            <span className="faq-badge hi">BILLED WEEKLY VIA STRIPE</span>
            <span className="faq-badge">NO ANNUAL COMMITMENT</span>
            <span className="faq-badge">CANCEL KEEPS ACCESS THROUGH THE WEEK</span>
          </div>

          {/* ── WHAT CANCEL ACTUALLY DOES ──────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ WHAT HAPPENS THE MOMENT YOU CLICK CANCEL</h2>
            <p>
              Cancellation doesn&apos;t cut your access off immediately.
              It schedules the subscription to end at the close of the
              current billing period — meaning if you cancel on day 2 of a
              paid week, you keep full access through day 7. You&apos;re not
              charged again after that, and nothing auto-renews.
            </p>

            <div className="faq-flow">
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>YOU CLICK CANCEL</h4>
                  <p>The subscription is marked to end at period close. No refund is issued for the current week — you already paid for it, so you keep it.</p>
                </div>
              </div>
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>YOU KEEP DIALING</h4>
                  <p>Full access continues completely normally for the rest of the paid week — nothing is restricted or downgraded early.</p>
                </div>
              </div>
              <div className="faq-flow-step">
                <div className="faq-flow-body">
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
          <section className="faq-section">
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
          <section className="faq-section">
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

          {/* ── WHAT YOU CAN ACTUALLY LOSE ──────────────────────────────────
              The refund policy used to be stated first and alone, which made a
              $35 weekly product read as riskier than it is: "only considered
              within 24 hours" is an accurate sentence that lands as a warning.
              The exposure figure is the honest headline — the 24-hour window is
              a second chance on top of it, not the only thing standing between
              a buyer and a lost charge. Same policy, stated in the order that
              reflects what is actually at stake. */}
          <section className="faq-section">
            <h2>▸ WHAT YOU CAN ACTUALLY LOSE</h2>
            <p>
              <strong>Nothing, for the first seven days.</strong> New accounts
              start on a free trial — a card is required to begin it, but you
              are not charged until it ends, and cancelling before then costs
              you nothing at all.
            </p>
            <p>
              <strong>After that: one week. $35.</strong> That is the whole
              downside, and it is worth saying plainly, because most of this
              industry does not let you find out this cheaply. There is no
              annual contract to break, no setup fee to write off and no
              implementation project to walk away from — the incumbents
              commonly charge $500–$2,000 before the first call is placed.
            </p>
            <p>
              Cancel in Settings and you keep access through the week you have
              already paid for. You are not charged again, and nothing
              auto-renews.
            </p>
            <p>
              Your <strong>lead data is preserved</strong> if a subscription
              lapses. Campaigns, leads, dispositions and call history stay
              where they are, so coming back later means signing in rather than
              rebuilding — which also means leaving is not a decision you have
              to be certain about.
            </p>

            <h3 style={{ fontSize: 17, marginTop: 28, marginBottom: 10 }}>
              And if it is wrong within the first day
            </h3>
            <p>
              Not what you expected? Email{' '}
              <a href="mailto:support@dialerseat.com">support@dialerseat.com</a>{' '}
              within <strong>24 hours</strong> of the charge and we will refund
              it. After that window the charge is final — canceling stops
              future billing but does not refund the period you are already in.
            </p>
            <p className="muted">
              Which is the part worth remembering: past 24 hours, the most you
              are out is the week you are standing in. Not a quarter, not a
              year.
            </p>
          </section>

          {/* ── HONEST NOTE ───────────────────────────────────────────────── */}
          <div className="faq-callout">
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
          <div className="faq-related">
            <div className="faq-related-label">▸ RELATED READING</div>
            <div className="faq-related-links">
              <Link href="/faq/why-we-charge">Why we charge what we charge</Link>
              <Link href="/faq/manager-plus">What Manager+ adds over Pro</Link>
              <Link href="/faq/dialerseat-teams">DialerSeat for teams</Link>
              <Link href="/faq/data-and-recordings">Recordings &amp; your data</Link>
              <Link href="/faq">FAQ</Link>
            </div>
          </div>

          {/* ── CTA ──────────────────────────────────────────────────────────  */}
          <div className="faq-cta">
            <div className="faq-cta-eyebrow">▸ NO CONTRACT, NO RETENTION CALL</div>
            <h3 className="faq-cta-h">$35/week. Cancel with one click, any time.</h3>
            <p>
              You keep access through what you already paid for — nothing
              cut off early, nothing to negotiate.
            </p>
            <a href={isSignedIn ? '/dashboard' : '/sign-up'} className="faq-cta-btn">
              {isSignedIn ? 'GO TO DASHBOARD →' : 'GET STARTED →'}
            </a>
          </div>
        </article>
      </div>
      <SiteFooter />
    </>
  )
}
