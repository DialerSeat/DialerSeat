'use client'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'

// =============================================================================
// /managers — For Agency Owners & Lead Vendors
// =============================================================================
// Founder voice. This page exists because the agency-owner and lead-vendor
// audiences are buying for very different reasons than a solo agent, and
// the homepage isn't going to convince either of them by itself.
//
// Two audiences, one page:
//   1. Agency owners — already running a sales floor on someone else's dialer
//      paying $99–$199/seat/month, looking to consolidate
//   2. Lead vendors — selling leads to independent agents, looking to bundle
//      a dialer with their leads so the agent has nowhere else to dial them
//
// The simplification under the new product framing:
//   - Manager features are NOT a separate tier. They're included in the
//     standard $35/wk Pro subscription. Anyone can flip to "manager mode"
//     by creating a team.
//   - White-label is its own thing, $75/wk, gets its own /white-label page
//   - DialerSeat doesn't process resell payments. Agent-to-Manager money
//     happens off-platform.
//   - Promo / referral arrangements exist for proven operators, by email.
// =============================================================================

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

export default function View() {
  const { isSignedIn } = useUser()

  return (
    <div style={{
      flex: 1,
      background: T.bg,
      minHeight: 'calc(100vh - 64px)',
      fontFamily: 'Futura PT, Futura, sans-serif',
      color: T.text,
    }}>
      <style>{`
        .mgr-root { max-width: 820px; margin: 0 auto; padding: 80px 32px 120px; }
        .mgr-eyebrow {
          font-size: 11px; letter-spacing: 4px; color: ${T.muted};
          font-weight: bold; margin-bottom: 18px;
        }
        .mgr-h1 {
          font-size: 44px; line-height: 1.15; letter-spacing: -0.5px;
          font-weight: 700; margin: 0 0 24px 0;
        }
        .mgr-h1 em {
          font-style: normal; color: ${T.blue};
        }
        .mgr-deck {
          font-size: 19px; line-height: 1.6; color: ${T.muted};
          margin-bottom: 56px; max-width: 680px;
        }
        .mgr-section { margin: 56px 0; }
        .mgr-section h2 {
          font-size: 13px; letter-spacing: 3px; font-weight: bold;
          color: ${T.accent}; margin: 0 0 18px 0;
          padding-bottom: 10px; border-bottom: 1px solid ${T.border};
        }
        .mgr-section h3 {
          font-size: 22px; line-height: 1.3; font-weight: 700;
          margin: 28px 0 14px 0; letter-spacing: -0.2px;
        }
        .mgr-section p {
          font-size: 16px; line-height: 1.75; margin: 0 0 18px 0;
          color: ${T.text};
        }
        .mgr-section p.muted { color: ${T.muted}; font-size: 15px; }
        .mgr-section strong { color: ${T.text}; font-weight: 700; }
        .mgr-section em { font-style: italic; color: ${T.accent}; }
        .mgr-section ul { margin: 14px 0 24px 0; padding-left: 22px; }
        .mgr-section li { font-size: 16px; line-height: 1.75; margin-bottom: 8px; }

        .mgr-math {
          margin: 28px 0; padding: 24px 28px;
          background: white;
          border: 1px solid ${T.border};
          border-left: 3px solid ${T.green};
          border-radius: 6px;
        }
        .mgr-math-title {
          font-size: 11px; letter-spacing: 3px; color: ${T.green};
          font-weight: bold; margin-bottom: 14px;
        }
        .mgr-math-row {
          display: flex; justify-content: space-between; align-items: baseline;
          padding: 6px 0; font-size: 15px;
          border-bottom: 1px dashed ${T.border};
        }
        .mgr-math-row:last-child { border-bottom: none; padding-top: 10px; margin-top: 4px; }
        .mgr-math-row.total {
          border-top: 2px solid ${T.border}; border-bottom: none;
          padding-top: 12px; margin-top: 8px;
          font-size: 17px; font-weight: 700;
        }
        .mgr-math-row.total .mgr-math-val { color: ${T.green}; }
        .mgr-math-label { color: ${T.muted}; }
        .mgr-math-val { font-family: monospace; font-weight: 600; color: ${T.text}; }

        .mgr-callout {
          margin: 32px 0; padding: 22px 26px;
          background: ${T.surface};
          border-left: 3px solid ${T.blue};
          border-radius: 4px;
        }
        .mgr-callout p { font-size: 15px; line-height: 1.7; margin: 0; color: ${T.text}; }
        .mgr-callout strong { color: ${T.accent}; }

        .mgr-promo {
          margin: 56px 0 32px;
          padding: 20px 24px;
          background: white;
          border: 1px dashed ${T.amber};
          border-radius: 6px;
          font-size: 14px; line-height: 1.7;
          color: ${T.muted}; font-style: italic;
        }
        .mgr-promo strong {
          font-style: normal; color: ${T.amber};
          letter-spacing: 1px;
        }

        .mgr-wl-upsell {
          margin: 56px 0 0;
          padding: 28px 30px;
          background: linear-gradient(135deg, #1a1a2e 0%, #2a3a5a 100%);
          border-radius: 8px;
          color: white;
        }
        .mgr-wl-upsell .mgr-wl-eyebrow {
          font-size: 10px; letter-spacing: 4px; color: #ffaa3e;
          font-weight: bold; margin-bottom: 10px;
        }
        .mgr-wl-upsell h3 {
          font-size: 22px; color: white; margin: 0 0 12px 0;
          letter-spacing: -0.2px; line-height: 1.3;
        }
        .mgr-wl-upsell p {
          font-size: 14px; line-height: 1.7; color: #c0c2ca;
          margin: 0 0 16px 0;
        }
        .mgr-wl-upsell a {
          color: #4a9eff; font-size: 12px; letter-spacing: 2px;
          font-weight: bold; text-decoration: none;
          border-bottom: 1px solid transparent;
        }
        .mgr-wl-upsell a:hover { border-bottom-color: #4a9eff; }

        .mgr-cta-box {
          margin-top: 56px;
          padding: 40px 36px;
          background: ${T.dark};
          border-radius: 8px;
          text-align: center;
        }
        .mgr-cta-box .mgr-cta-eyebrow {
          font-size: 10px; letter-spacing: 4px; color: ${T.blue};
          font-weight: bold; margin-bottom: 14px;
        }
        .mgr-cta-box .mgr-cta-h {
          font-size: 26px; color: white; font-weight: 700;
          margin: 0 0 12px 0; letter-spacing: -0.2px;
        }
        .mgr-cta-box p {
          font-size: 15px; color: #c0c2ca; line-height: 1.6;
          margin: 0 0 28px 0;
        }
        .mgr-cta-box .mgr-cta-btn {
          display: inline-block;
          padding: 16px 36px;
          background: linear-gradient(135deg, #4a9eff, #2a6eff);
          border: none; border-radius: 6px;
          color: white;
          font-size: 12px; font-weight: bold; letter-spacing: 3px;
          text-decoration: none;
          font-family: 'Futura PT', Futura, sans-serif;
          box-shadow: 0 0 24px rgba(74,158,255,0.3);
        }
        .mgr-cta-secondary {
          display: inline-block; margin-top: 16px;
          color: #888a92; font-size: 11px; letter-spacing: 2px;
          text-decoration: none;
        }
        .mgr-cta-secondary:hover { color: #c0c2ca; }

        .mgr-related {
          margin-top: 48px;
          padding-top: 28px;
          border-top: 1px solid ${T.border};
        }
        .mgr-related-label {
          font-size: 10px; letter-spacing: 3px; color: ${T.muted};
          font-weight: bold; margin-bottom: 14px;
        }
        .mgr-related-links { display: flex; gap: 24px; flex-wrap: wrap; }
        .mgr-related-links a {
          font-size: 13px; color: ${T.accent}; text-decoration: none;
          border-bottom: 1px solid transparent; padding-bottom: 1px;
          transition: border-color 0.15s;
        }
        .mgr-related-links a:hover { border-bottom-color: ${T.accent}; }

        @media (max-width: 768px) {
          .mgr-root { padding: 48px 20px 80px; }
          .mgr-h1 { font-size: 30px; }
          .mgr-deck { font-size: 16px; }
          .mgr-section h3 { font-size: 19px; }
          .mgr-section p, .mgr-section li { font-size: 15px; }
          .mgr-math { padding: 18px 20px; }
          .mgr-cta-box { padding: 32px 24px; }
          .mgr-cta-box .mgr-cta-h { font-size: 22px; }
          .mgr-wl-upsell { padding: 22px 22px; }
        }
      `}</style>

      <article className="mgr-root">

        <div className="mgr-eyebrow">▸ FOR MANAGERS</div>

        <h1 className="mgr-h1">
          Built for the people <em>actually running the sales floor.</em>
        </h1>

        <p className="mgr-deck">
          This page is for agency owners and lead vendors. If you&apos;re
          running other agents — paying for their dialer, generating their
          leads, or both — DialerSeat is built around what you actually need.
          Here&apos;s the plain version of how it works.
        </p>

        {/* ── WHAT IT IS ─────────────────────────────────────────────────── */}
        <section className="mgr-section">
          <h2>WHAT IT IS</h2>

          <p>
            Manager mode isn&apos;t a separate plan. It&apos;s included in
            your <strong>$35/week DialerSeat subscription.</strong> You sign
            up the same as any other user, you get the same dialer, the same
            campaigns, the same recordings. The moment you create a team, you
            unlock the manager view: add agents, attach campaigns, generate
            seat codes, watch your floor work in real-time.
          </p>

          <p>
            What makes it actually useful for you isn&apos;t the feature list.
            It&apos;s the economics. You decide, per code, who pays the
            $35/week seat fee — you, or the agent. And you decide what the
            agent pays <em>you</em> on top of that, completely outside our
            platform. <strong>We don&apos;t see your resell price. We
            don&apos;t take a cut of it.</strong> Whatever you charge the
            agent for access to your leads is yours.
          </p>

          <p>
            Two flavors of this make sense — agency owner and lead vendor.
            Read whichever fits.
          </p>
        </section>

        {/* ── AGENCY OWNER ───────────────────────────────────────────────── */}
        <section className="mgr-section">
          <h2>▸ FOR AGENCY OWNERS</h2>

          <h3>You already run a floor. You already pay per seat somewhere.</h3>

          <p>
            Most agency dialers charge $99–$199 per seat per month, locked
            into contracts, with onboarding fees, with admin fees, with
            whatever else they came up with last quarter. Five agents on the
            floor and you&apos;re paying $750–$1,000 a month before anyone
            has dialed a single number.
          </p>

          <p>
            DialerSeat charges you <strong>$35/week per active seat.</strong>{' '}
            No contracts, no setup, no admin fees. Cancel a seat the day an
            agent quits and the charge stops at period close. You pay only
            for the people actually working that week.
          </p>

          <p>
            But here&apos;s the part most owners miss: you don&apos;t have to
            <em> absorb </em>that $35. You can charge your agents whatever you
            want for the dialer plus the leads. Most owners I&apos;ve talked
            to bundle leads + dialer + script + manager support and charge
            their agents <strong>$100 to $200 a week</strong> for the seat.
            That&apos;s the going rate for working a desk in an agency.
            It&apos;s already what the market pays.
          </p>

          <div className="mgr-math">
            <div className="mgr-math-title">EXAMPLE — 5 AGENTS ON YOUR FLOOR</div>
            <div className="mgr-math-row">
              <span className="mgr-math-label">You charge each agent / week</span>
              <span className="mgr-math-val">$150</span>
            </div>
            <div className="mgr-math-row">
              <span className="mgr-math-label">× 5 agents</span>
              <span className="mgr-math-val">$750 / week</span>
            </div>
            <div className="mgr-math-row">
              <span className="mgr-math-label">DialerSeat charges you (5 seats × $35)</span>
              <span className="mgr-math-val">−$175 / week</span>
            </div>
            <div className="mgr-math-row total">
              <span>Your margin on the dialer alone</span>
              <span className="mgr-math-val">$575 / week</span>
            </div>
          </div>

          <p className="muted">
            That&apos;s ~$30,000 a year in dialer-margin alone, on top of
            whatever you&apos;re already making on commission splits. And it
            scales linearly — 10 agents is ~$60k, 20 is ~$120k. The dialer
            stops being a cost center and starts being a revenue line.
          </p>

          <h3>Plus you actually see what they&apos;re doing.</h3>

          <p>
            The manager view shows you every agent on your team in real-time:
            who&apos;s live, who&apos;s on a call, who&apos;s wrapping,
            who&apos;s been idle for twenty minutes. You see today&apos;s
            connect counts, disposition breakdowns, conversion rates. You can
            listen back to any recording. You can pull a CSV of every
            appointment your floor set this week.
          </p>

          <p>
            That visibility is what other dialers charge a separate enterprise
            tier for. It&apos;s standard with manager mode.
          </p>
        </section>

        {/* ── LEAD VENDOR ────────────────────────────────────────────────── */}
        <section className="mgr-section">
          <h2>▸ FOR LEAD VENDORS</h2>

          <h3>You sell leads. The agents who buy them dial them somewhere.</h3>

          <p>
            If you&apos;re generating leads and selling them — Medicare, ACA,
            final expense, mortgage, solar, whatever — you&apos;re leaving
            money on the table by handing the lead off and hoping the agent
            knows what to do with it. Half of them dial through some bargain
            VOIP setup, half don&apos;t dial fast enough, and your refund
            requests come from agents who never actually got someone on the
            phone.
          </p>

          <p>
            With manager mode you can <strong>bundle the dialer with the
            lead.</strong> Agent buys your leads, you give them a code, they
            redeem it, they dial inside <em>your</em> system. AMD is on.
            TCPA window enforcement is on. Predictive pacing is available if
            they want it. Your script is preloaded. They get connected calls
            faster than they would on their own setup, which means they hit
            your refund window less often.
          </p>

          <p>
            And the seat fee is its own revenue stream. You charge per-lead
            <em> and </em>per-seat-access. Most lead vendors I know don&apos;t
            even charge for the dialer access separately — they just bundle
            it into the lead price and let the agent feel like they&apos;re
            getting a free dialer. That&apos;s fine. The margin&apos;s still
            there.
          </p>

          <div className="mgr-math">
            <div className="mgr-math-title">EXAMPLE — 10 AGENTS BUYING YOUR LEADS</div>
            <div className="mgr-math-row">
              <span className="mgr-math-label">You bundle dialer access at / week</span>
              <span className="mgr-math-val">$100</span>
            </div>
            <div className="mgr-math-row">
              <span className="mgr-math-label">× 10 agents</span>
              <span className="mgr-math-val">$1,000 / week</span>
            </div>
            <div className="mgr-math-row">
              <span className="mgr-math-label">DialerSeat charges you (10 seats × $35)</span>
              <span className="mgr-math-val">−$350 / week</span>
            </div>
            <div className="mgr-math-row total">
              <span>Margin on top of lead sales</span>
              <span className="mgr-math-val">$650 / week</span>
            </div>
          </div>

          <p className="muted">
            That&apos;s ~$34,000 a year in pure dialer-bundling margin, on
            top of every lead dollar you&apos;re already making. The agent
            doesn&apos;t feel nickeled-and-dimed because they&apos;re used to
            paying for a dialer anyway, and they get a better one than they
            had before.
          </p>

          <h3>The other thing lead vendors get: control over how leads are dialed.</h3>

          <p>
            When you&apos;re inside DialerSeat, you set the dialer mode per
            campaign. You decide if AMD is forced on. You can attach a script
            that pops up in front of every agent dialing your leads, so they
            don&apos;t go off-script the way they would with a CRM you
            don&apos;t control. You see exactly when each lead was called,
            how many times, by whom, with what outcome. <strong>Your leads
            stop being a black box the moment they leave your hands.</strong>
          </p>

          <p>
            That&apos;s the part vendors care about most — keeping your
            reputation tight. If your leads get burned by bad dialing, your
            refund rate goes up and your repeat customers stop repeating.
            Owning the dialer side fixes that.
          </p>
        </section>

        {/* ── WHAT YOU BOTH GET ──────────────────────────────────────────── */}
        <section className="mgr-section">
          <h2>▸ WHAT YOU BOTH GET</h2>

          <p>
            Whether you&apos;re running an agency or generating leads, manager
            mode gives you:
          </p>

          <ul>
            <li>
              <strong>Unlimited team creation.</strong> Different teams for
              different campaigns, different agent groups, different lead
              types. One account, infinite team configurations.
            </li>
            <li>
              <strong>Seat codes & recruit codes.</strong> Seat codes give
              instant access. Recruit codes require your approval before the
              agent gets in. Scope a code to one campaign or all of them.
              Owner-pays or agent-pays, per code.
            </li>
            <li>
              <strong>Live agent monitoring.</strong> Every agent on every
              team, real-time state, current call, today&apos;s metrics.
              You&apos;ll know who&apos;s working without having to ask.
            </li>
            <li>
              <strong>Recording access.</strong> Every call your agents make,
              30 days retained, downloadable. Pull recordings for QA, for
              dispute resolution, for training.
            </li>
            <li>
              <strong>Disposition & conversion reporting.</strong> Per-agent,
              per-campaign, per-team, per-day. CSV export. Build your own
              dashboards on top of it.
            </li>
            <li>
              <strong>Per-campaign access control.</strong> Move agents
              between campaigns without canceling and re-issuing codes.
              Revoke one campaign&apos;s access without kicking them off the
              team entirely.
            </li>
          </ul>
        </section>

        {/* ── HONEST CALLOUT ─────────────────────────────────────────────── */}
        <div className="mgr-callout">
          <p>
            <strong>One honest thing</strong> — DialerSeat doesn&apos;t process
            your resell payments. If you charge agents $150/week and
            they&apos;re on agent-pays codes, they pay DialerSeat $35 directly
            for their seat, and they pay <em>you</em> $115 separately, through
            Stripe or Venmo or whatever you set up on your side. Payment
            routing for managers is on the roadmap, but right now the
            agent-to-you transaction is yours to handle.
          </p>
        </div>

        {/* ── PROMO PARAGRAPH ────────────────────────────────────────────── */}
        <div className="mgr-promo">
          <p style={{ margin: 0 }}>
            <strong>ONE MORE THING.</strong> &nbsp;If you&apos;re a proven
            agency owner or a lead generator with real volume, the door&apos;s
            open to talk about promo codes, referral arrangements, and seat
            pricing that reflects what you&apos;re actually bringing to the
            platform. Those conversations happen one at a time. Send me an
            email and we&apos;ll talk.
          </p>
        </div>

        {/* ── WHITE-LABEL UPSELL ─────────────────────────────────────────── */}
        <div className="mgr-wl-upsell">
          <div className="mgr-wl-eyebrow">▸ THE NEXT STEP</div>
          <h3>Want it to look like your product, not ours?</h3>
          <p>
            For $75/week — instead of the standard $35 — you get the entire
            platform white-labeled. Your logo, your colors, your custom
            domain. Your agents log in and see your brand. They never see
            DialerSeat anywhere. It&apos;s the same product underneath, but
            to them it&apos;s yours.
          </p>
          <Link href="/white-label">READ ABOUT WHITE-LABEL →</Link>
        </div>

        {/* ── HOW TO ACTUALLY START ──────────────────────────────────────── */}
        <section className="mgr-section">
          <h2>HOW TO ACTUALLY START</h2>

          <p>
            Sign up for a regular DialerSeat account. Subscribe. Go to the
            Teams tab. Click <em>Create a Team</em>. Attach a campaign to it.
            Generate a code. Send the code to your first agent. That&apos;s
            the whole flow — there&apos;s no separate manager sign-up, no
            sales call, no waitlist.
          </p>

          <p>
            If you want to talk through how to structure pricing for your
            specific situation, or you&apos;re a lead vendor and want to
            think out loud about how to bundle your leads with the dialer,
            email me directly. I read every one.
          </p>
        </section>

        {/* ── CTA ────────────────────────────────────────────────────────── */}
        <div className="mgr-cta-box">
          <div className="mgr-cta-eyebrow">▸ READY TO TRY IT</div>
          <div className="mgr-cta-h">
            Start a team in under five minutes.
          </div>
          <p>
            $35/week per active seat. No contracts. Cancel anytime.<br/>
            You decide what to charge your agents on top.
          </p>
          <Link
            href={isSignedIn ? '/dashboard/teams' : '/signup'}
            className="mgr-cta-btn"
          >
            {isSignedIn ? 'GO TO TEAMS →' : 'GET STARTED →'}
          </Link>
          <div>
            <a
              href="mailto:hello@dialerseat.com?subject=Manager mode — let's talk"
              className="mgr-cta-secondary"
            >
              OR EMAIL ME DIRECTLY →
            </a>
          </div>
        </div>

        {/* ── RELATED ────────────────────────────────────────────────────── */}
        <div className="mgr-related">
          <div className="mgr-related-label">▸ RELATED READING</div>
          <div className="mgr-related-links">
            <Link href="/white-label">White-label your dialer</Link>
            <Link href="/faq/why-dialerseat">Why I built DialerSeat</Link>
            <Link href="/dialing-modes">Dialing modes explained</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/pricing">Pricing</Link>
          </div>
        </div>

      </article>
    </div>
  )
}