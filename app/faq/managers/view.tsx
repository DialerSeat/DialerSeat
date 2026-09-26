'use client'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import FaqTheme from '@/components/faq-theme'
import GutsShell from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { SITE } from '@/lib/siteTheme'
import { t } from '@/lib/i18n/client'

























export default function View() {
  const { isSignedIn } = useUser()

  return (
    <>
      <SiteHeader />
      <GutsShell rail={faqRail('/faq/managers')} activeHref="/faq/managers">
        <FaqTheme />
        <style>{`
.mgr-math {
            margin: 28px 0; padding: 24px 28px;
            background: ${SITE.surface};
            border: 1px solid ${SITE.border};
            border-inline-start: 3px solid ${SITE.green};
            border-radius: 6px;
          }
          .mgr-math-title {
            font-size: 11px; letter-spacing: 3px; color: ${SITE.green};
            font-weight: bold; margin-bottom: 14px;
          }
          .mgr-math-row {
            display: flex; justify-content: space-between; align-items: baseline;
            padding: 6px 0; font-size: 15px;
            border-bottom: 1px dashed ${SITE.border};
          }
          .mgr-math-row:last-child { border-bottom: none; padding-top: 10px; margin-top: 4px; }
          .mgr-math-row.total {
            border-top: 2px solid ${SITE.border}; border-bottom: none;
            padding-top: 12px; margin-top: 8px;
            font-size: 17px; font-weight: 700;
          }
          .mgr-math-row.total .mgr-math-val { color: ${SITE.green}; }
          .mgr-math-label { color: ${SITE.muted}; }
          .mgr-math-val { font-family: monospace; font-weight: 600; color: ${SITE.text}; }

          .mgr-promo {
            margin: 56px 0 32px;
            padding: 20px 24px;
            background: ${SITE.surface};
            border: 1px dashed ${SITE.amber};
            border-radius: 6px;
            font-size: 14px; line-height: 1.7;
            color: ${SITE.muted}; font-style: italic;
          }
          .mgr-promo strong {
            font-style: normal; color: ${SITE.amber};
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
            font-size: 14px; line-height: 1.7; color: ${SITE.muted};
            margin: 0 0 16px 0;
          }
          .mgr-wl-upsell a {
            color: #4a9eff; font-size: 12px; letter-spacing: 2px;
            font-weight: bold; text-decoration: none;
            border-bottom: 1px solid transparent;
          }
          .mgr-wl-upsell a:hover { border-bottom-color: #4a9eff; }
          .mgr-cta-secondary {
            display: inline-block; margin-top: 16px;
            color: #888a92; font-size: 11px; letter-spacing: 2px;
            text-decoration: none;
          }
          .mgr-cta-secondary:hover { color: ${SITE.muted}; }@media (max-width: 768px) {
            .mgr-math { padding: 18px 20px; }
            .mgr-wl-upsell { padding: 22px 22px; }
          }
        `}</style>

        <article className="faq-root">

          <div className="faq-eyebrow">{t("▸ FOR MANAGERS")}</div>
          <span style={{ fontSize: 11, color: '#8888aa', letterSpacing: '2px', display: 'block', marginBottom: 16 }}>{t("LAST UPDATED 07/28/2026")}</span>

          <h1 className="faq-h1">
            {t("Built for the people")}{" "}<em>{t("actually running the sales floor.")}</em>
          </h1>

          <p className="faq-deck">
            {t("This page is for agency owners and lead vendors. If you're running other agents: paying for their dialer, generating their leads, or both, DialerSeat is built around what you actually need. Here's the plain version of how it works.")}</p>

          {/* ── WHAT IT IS ─────────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("WHAT IT IS")}</h2>

            <p>
              {t("Manager mode runs on")}{" "}<strong>{t("Manager+, DialerSeat's $75/week tier")}</strong>{t(", it replaces your $35/week Pro subscription rather than stacking on top of it. You sign up, you get the same dialer, the same campaigns, the same recordings you'd get on Pro, plus the manager view: add agents, attach campaigns, generate seat codes, watch your floor work in real-time. Creating a team requires Manager+; dialing as a member of someone else's team just needs a regular $35/week Pro seat.")}</p>

            <p>
              {t("What makes it actually useful for you isn't the feature list. It's the economics. Beyond your own $75/week platform cost, you decide, per code, who pays the $35/week seat fee for each agent: you, or the agent. And you decide what the agent pays")}{" "}<em>{t("you")}</em> {t("on top of that, completely outside our platform.")}{" "}<strong>{t("We don't see your resell price. We don't take a cut of it.")}</strong> {t("Whatever you charge the agent for access to your leads is yours.")}</p>

            <p>
              {t("Two flavors of this make sense, agency owner and lead vendor. Read whichever fits.")}</p>
          </section>

          {/* ── AGENCY OWNER ───────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ FOR AGENCY OWNERS")}</h2>

            <h3>{t("You already run a floor. You already pay per seat somewhere.")}</h3>

            <p>
              {t("Most agency dialers charge $99-$199 per seat per month, locked into contracts, with onboarding fees, with admin fees, with whatever else they came up with last quarter. Five agents on the floor and you're paying $750-$1,000 a month before anyone has dialed a single number.")}</p>

            <p>
              {t("DialerSeat charges you")}{" "}<strong>{t("$35/week per active seat.")}</strong>{' '}
              {t("No contracts, no setup, no admin fees. Cancel a seat the day an agent quits and the charge stops at period close. You pay only for the people actually working that week.")}</p>

            <p>
              {t("But here's the part most owners miss: you don't have to")}<em> {t("absorb")}{" "}</em>{t("that $35. You can charge your agents whatever you want for the dialer plus the leads. Most owners I've talked to bundle leads + dialer + script + manager support and charge their agents")}{" "}<strong>{t("$100 to $200 a week")}</strong> {t("for the seat. That's the going rate for working a desk in an agency. It's already what the market pays.")}</p>

            <div className="mgr-math">
              <div className="mgr-math-title">{t("EXAMPLE, 5 AGENTS ON YOUR FLOOR (OWNER PAYS)")}</div>
              <div className="mgr-math-row">
                <span className="mgr-math-label">{t("You charge each agent / week")}</span>
                <span className="mgr-math-val">$150</span>
              </div>
              <div className="mgr-math-row">
                <span className="mgr-math-label">{t("× 5 agents")}</span>
                <span className="mgr-math-val">{t("$750 / week")}</span>
              </div>
              <div className="mgr-math-row">
                <span className="mgr-math-label">{t("Your Manager+ platform cost")}</span>
                <span className="mgr-math-val">{t("−$75 / week")}</span>
              </div>
              <div className="mgr-math-row">
                <span className="mgr-math-label">{t("DialerSeat charges you (5 seats × $35)")}</span>
                <span className="mgr-math-val">{t("−$175 / week")}</span>
              </div>
              <div className="mgr-math-row total">
                <span>{t("Your margin on the dialer alone")}</span>
                <span className="mgr-math-val">{t("$500 / week")}</span>
              </div>
            </div>

            <p className="muted">
              {t("That's ~$26,000 a year in dialer-margin alone, on top of whatever you're already making on commission splits. The $75/week Manager+ cost is fixed no matter how many agents you add, so the math gets better as you scale, 10 agents nets you ~$56k a year, 20 agents ~$116k. The dialer stops being a cost center and starts being a revenue line.")}</p>

            <h3>{t("Plus you actually see what they're doing.")}</h3>

            <p>
              {t("The manager view shows you every agent on your team in real-time: who's live, who's on a call, who's wrapping, who's been idle for twenty minutes. You see today's connect counts, disposition breakdowns, conversion rates. You can listen back to any recording. You can pull a CSV of every appointment your floor set this week.")}</p>

            <p>
              {t("That visibility is what other dialers charge a separate enterprise tier for. It's standard with manager mode.")}</p>
          </section>

          {/* ── LEAD VENDOR ────────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ FOR LEAD VENDORS")}</h2>

            <h3>{t("You sell leads. The agents who buy them dial them somewhere.")}</h3>

            <p>
              {t("If you're generating leads and selling them: Medicare, ACA, final expense, mortgage, solar, whatever, you're leaving money on the table by handing the lead off and hoping the agent knows what to do with it. Half of them dial through some bargain VOIP setup, half don't dial fast enough, and your refund requests come from agents who never actually got someone on the phone.")}</p>

            <p>
              {t("With manager mode you can")}{" "}<strong>{t("bundle the dialer with the lead.")}</strong> {t("Agent buys your leads, you give them a code, they redeem it, they dial inside")}{" "}<em>{t("your")}</em> {t("system. AMD is on. TCPA window enforcement is on. Predictive pacing is available if they want it. Your script is preloaded. They get connected calls faster than they would on their own setup, which means they hit your refund window less often.")}</p>

            <p>
              {t("And the seat fee is its own revenue stream. You charge per-lead")}<em> {t("and")}{" "}</em>{t("per-seat-access. Most lead vendors I know don't even charge for the dialer access separately, they just bundle it into the lead price and let the agent feel like they're getting a free dialer. That's fine. The margin's still there.")}</p>

            <div className="mgr-math">
              <div className="mgr-math-title">{t("EXAMPLE, 10 AGENTS BUYING YOUR LEADS (OWNER PAYS)")}</div>
              <div className="mgr-math-row">
                <span className="mgr-math-label">{t("You bundle dialer access at / week")}</span>
                <span className="mgr-math-val">$100</span>
              </div>
              <div className="mgr-math-row">
                <span className="mgr-math-label">{t("× 10 agents")}</span>
                <span className="mgr-math-val">{t("$1,000 / week")}</span>
              </div>
              <div className="mgr-math-row">
                <span className="mgr-math-label">{t("Your Manager+ platform cost")}</span>
                <span className="mgr-math-val">{t("−$75 / week")}</span>
              </div>
              <div className="mgr-math-row">
                <span className="mgr-math-label">{t("DialerSeat charges you (10 seats × $35)")}</span>
                <span className="mgr-math-val">{t("−$350 / week")}</span>
              </div>
              <div className="mgr-math-row total">
                <span>{t("Margin on top of lead sales")}</span>
                <span className="mgr-math-val">{t("$575 / week")}</span>
              </div>
            </div>

            <p className="muted">
              {t("That's ~$30,000 a year in pure dialer-bundling margin, on top of every lead dollar you're already making. Prefer to skip the platform cost entirely? Set the campaign to AGENT PAYS instead and each buyer covers their own $35 seat directly you just charge your bundled access fee on top. The agent doesn't feel nickeled-and-dimed because they're used to paying for a dialer anyway, and they get a better one than they had before.")}</p>

            <h3>{t("The other thing lead vendors get: control over how leads are dialed.")}</h3>

            <p>
              {t("When you're inside DialerSeat, you set the dialer mode per campaign. You decide if AMD is forced on. You can attach a script that pops up in front of every agent dialing your leads, so they don't go off-script the way they would with a CRM you don't control. You see exactly when each lead was called, how many times, by whom, with what outcome.")}{" "}<strong>{t("Your leads stop being a black box the moment they leave your hands.")}</strong>
            </p>

            <p>
              {t("That's the part vendors care about most, keeping your reputation tight. If your leads get burned by bad dialing, your refund rate goes up and your repeat customers stop repeating. Owning the dialer side fixes that.")}</p>
          </section>

          {/* ── WHAT YOU BOTH GET ──────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ WHAT YOU BOTH GET")}</h2>

            <p>
              {t("Whether you're running an agency or generating leads, manager mode gives you:")}</p>

            <ul>
              <li>
                <strong>{t("Unlimited team creation.")}</strong> {t("Different teams for different campaigns, different agent groups, different lead types. One account, infinite team configurations.")}</li>
              <li>
                <strong>{t("Seat codes & recruit codes.")}</strong> {t("Seat codes give instant access. Recruit codes require your approval before the agent gets in. Scope a code to one campaign or all of them. Owner-pays or agent-pays, per code.")}</li>
              <li>
                <strong>{t("Live agent monitoring.")}</strong> {t("Every agent on every team, real-time state, current call, today's metrics. You'll know who's working without having to ask.")}</li>
              <li>
                <strong>{t("Recording access.")}</strong> {t("Every call your agents make, 30 days retained, downloadable. Pull recordings for QA, for dispute resolution, for training.")}</li>
              <li>
                <strong>{t("Disposition & conversion reporting.")}</strong> {t("Per-agent, per-campaign, per-team, per-day. CSV export. Build your own dashboards on top of it.")}</li>
              <li>
                <strong>{t("Per-campaign access control.")}</strong> {t("Move agents between campaigns without canceling and re-issuing codes. Revoke one campaign's access without kicking them off the team entirely.")}</li>
            </ul>
          </section>

          {/* ── HONEST CALLOUT ─────────────────────────────────────────────── */}
          <div className="faq-callout">
            <p>
              <strong>{t("One honest thing")}</strong>{t(", DialerSeat doesn't process your resell payments. If you charge agents $150/week and they're on agent-pays codes, they pay DialerSeat $35 directly for their seat, and they pay")}{" "}<em>{t("you")}</em> {t("$115 separately, through Stripe or Venmo or whatever you set up on your side. Payment routing for managers is on the roadmap, but right now the agent-to-you transaction is yours to handle.")}</p>
          </div>

          {/* ── PROMO PARAGRAPH ────────────────────────────────────────────── */}
          <div className="mgr-promo">
            <p style={{ margin: 0 }}>
              <strong>{t("ONE MORE THING.")}</strong> {t(" If you're a proven agency owner or a lead generator with real volume, the door's open to talk about promo codes, referral arrangements, and seat pricing that reflects what you're actually bringing to the platform. Those conversations happen one at a time. Send me an email and we'll talk.")}</p>
          </div>

          {/* ── WHITE-LABEL UPSELL ─────────────────────────────────────────── */}
          <div className="mgr-wl-upsell">
            <div className="mgr-wl-eyebrow">{t("▸ THE NEXT STEP")}</div>
            <h3>{t("Want it to look like your product, not ours?")}</h3>
            <p>
              {t("For $75/week, instead of the standard $35, you get the entire platform white-labeled. Your logo, your colors, your custom domain. Your agents log in and see your brand. They never see DialerSeat anywhere. It's the same product underneath, but to them it's yours.")}</p>
            <Link href="/faq/white-label">{t("READ ABOUT WHITE-LABEL →")}</Link>
          </div>

          {/* ── HOW TO ACTUALLY START ──────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("HOW TO ACTUALLY START")}</h2>

            <p>
              {t("Sign up for a regular DialerSeat account. Subscribe. Go to the Teams tab. Click")}{" "}<em>{t("Create a Team")}</em>{t(". Attach a campaign to it. Generate a code. Send the code to your first agent. That's the whole flow: there's no separate manager sign-up, no sales call, no waitlist.")}</p>

            <p>
              {t("If you want to talk through how to structure pricing for your specific situation, or you're a lead vendor and want to think out loud about how to bundle your leads with the dialer, email me directly. I read every one.")}</p>
          </section>

          {/* ── CTA ────────────────────────────────────────────────────────── */}
          <div className="faq-cta">
            <div className="faq-cta-eyebrow">{t("▸ READY TO TRY IT")}</div>
            <div className="faq-cta-h">
              {t("Start a team in under five minutes.")}</div>
            <p>
              {t("$35/week per active seat. No contracts. Cancel anytime.")}<br/>
              {t("You decide what to charge your agents on top.")}</p>
            <Link
              href={isSignedIn ? '/dashboard/teams' : '/signup'}
              className="faq-cta-btn"
            >
              {isSignedIn ? t("GO TO TEAMS →") : t("GET STARTED →")}
            </Link>
            <div>
              <a
                href="mailto:hello@dialerseat.com?subject=Manager mode, let's talk"
                className="mgr-cta-secondary"
              >
                {t("OR EMAIL ME DIRECTLY →")}</a>
            </div>
          </div>

          {/* ── RELATED ────────────────────────────────────────────────────── */}
          <div className="faq-related">
            <div className="faq-related-label">{t("▸ RELATED READING")}</div>
            <div className="faq-related-links">
              <Link href="/faq/white-label">{t("White-label your dialer")}</Link>
              <Link href="/faq/why-dialerseat">{t("Why I built DialerSeat")}</Link>
              <Link href="/dialing-modes">{t("Dialing modes explained")}</Link>
              <Link href="/faq">{t("FAQ")}</Link>
              <Link href="/faq/why-we-charge">{t("Pricing")}</Link>
            </div>
          </div>

        </article>
      </GutsShell>
      <SiteFooter />
    </>
  )
}