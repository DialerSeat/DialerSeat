'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useUser } from '@clerk/nextjs'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import FaqTheme from '@/components/faq-theme'
import GutsShell from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { SITE } from '@/lib/siteTheme'
import { t } from '@/lib/i18n/client'
import { msg } from '@/lib/i18n/msg'


type Slide = { src: string; alt: string; caption: string }

const DESKTOP_SLIDES: Slide[] = [
  {
    src: '/faq-images/manager-plus/desktop-analytics.png',
    alt: 'DialerSeat Manager+ analytics overview, white-labeled, showing total calls, hours dialed, conversions, closed deals, talk time, and best campaign',
    caption:
      msg("ANALYTICS OVERVIEW: every number a manager actually checks each morning, in one screen. This account is running white-labeled, so the branding is entirely the operator’s own."),
  },
  {
    src: '/faq-images/manager-plus/desktop-dialer.png',
    alt: 'DialerSeat dialer terminal in power mode, white-labeled, showing manual dial pad and today\u2019s metrics sidebar',
    caption:
      msg("The dialer terminal itself, same white-label skin. Manager+ doesn’t change what agents dial with, it changes what the owner sees around it."),
  },
  {
    src: '/faq-images/manager-plus/desktop-os-multiwindow.png',
    alt: 'DialerSeat desktop app showing Teams and Analytics windows open side by side',
    caption:
      msg("The desktop app running Teams and Analytics side by side, a manager watching team performance update live while managing seat codes in the next window."),
  },
]

function DesktopCarousel() {
  const [idx, setIdx] = useState(0)
  const slide = DESKTOP_SLIDES[idx]
  const go = (d: number) =>
    setIdx((i) => (i + d + DESKTOP_SLIDES.length) % DESKTOP_SLIDES.length)

  return (
    <div className="mp-carousel">
      <div className="mp-carousel-frame">
        <button
          className="mp-carousel-arrow left"
          onClick={() => go(-1)}
          aria-label={t("Previous screenshot")}
        >
          ‹
        </button>
        <div className="mp-carousel-imgwrap">
          <Image
            key={slide.src}
            src={slide.src}
            alt={slide.alt}
            fill
            sizes="(max-width: 768px) 100vw, 780px"
            style={{ objectFit: 'contain' }}
            priority={idx === 0}
          />
        </div>
        <button
          className="mp-carousel-arrow right"
          onClick={() => go(1)}
          aria-label={t("Next screenshot")}
        >
          ›
        </button>
      </div>
      <p className="mp-carousel-caption">{t(slide.caption)}</p>
      <div className="mp-carousel-dots">
        {DESKTOP_SLIDES.map((s, i) => (
          <button
            key={s.src}
            className={`mp-dot ${i === idx ? 'active' : ''}`}
            onClick={() => setIdx(i)}
            aria-label={t("Go to screenshot {i}", { i: i + 1 })}
          />
        ))}
      </div>
    </div>
  )
}

export default function ManagerPlusFaqView() {
  const { isSignedIn } = useUser()

  return (
    <>
      <SiteHeader />
      <GutsShell rail={faqRail('/faq/manager-plus')} activeHref="/faq/manager-plus">
        <FaqTheme />
        <style>{`
/* PRICING TABLE */
          .mp-tiers {
            display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
            margin: 28px 0 32px;
          }
          .mp-tier-card {
            background: ${SITE.surface}; border: 1px solid ${SITE.border}; border-radius: 8px;
            padding: 24px 22px;
          }
          .mp-tier-card.hi {
            border: 2px solid ${SITE.deep};
            box-shadow: 0 4px 20px rgba(42,74,138,0.12);
          }
          .mp-tier-name {
            font-size: 11px; letter-spacing: 2px; font-weight: bold; color: ${SITE.muted};
            margin-bottom: 8px;
          }
          .mp-tier-card.hi .mp-tier-name { color: ${SITE.deep}; }
          .mp-tier-price { font-size: 30px; font-weight: 800; margin-bottom: 4px; }
          .mp-tier-price span { font-size: 14px; font-weight: 600; color: ${SITE.muted}; }
          .mp-tier-sub { font-size: 13px; color: ${SITE.muted}; margin-bottom: 16px; }
          .mp-tier-card ul { margin: 0; padding-left: 18px; }
          .mp-tier-card li { font-size: 14px; line-height: 1.6; margin-bottom: 6px; }

          /* MATH BLOCK */
          .mp-math {
            margin: 28px 0; padding: 24px 28px;
            background: ${SITE.surface}; border: 1px solid ${SITE.border};
            border-left: 3px solid ${SITE.green}; border-radius: 6px;
          }
          .mp-math-title {
            font-size: 11px; letter-spacing: 3px; color: ${SITE.green};
            font-weight: bold; margin-bottom: 14px;
          }
          .mp-math-row {
            display: flex; justify-content: space-between; align-items: baseline;
            padding: 6px 0; font-size: 15px; border-bottom: 1px dashed ${SITE.border};
          }
          .mp-math-row:last-child { border-bottom: none; padding-top: 10px; margin-top: 4px; }
          .mp-math-row.total {
            border-top: 2px solid ${SITE.border}; border-bottom: none;
            padding-top: 12px; margin-top: 8px; font-size: 17px; font-weight: 700;
          }
          .mp-math-row.total .mp-math-val { color: ${SITE.green}; }
          .mp-math-label { color: ${SITE.muted}; }
          .mp-math-val { font-family: monospace; font-weight: 600; color: ${SITE.text}; }

          /* SCENARIO CARDS */
          .mp-scenario {
            margin: 28px 0; padding: 26px 28px; background: ${SITE.surface};
            border: 1px solid ${SITE.border}; border-radius: 8px;
          }
          .mp-scenario-eyebrow {
            font-size: 10px; letter-spacing: 3px; font-weight: bold;
            color: ${SITE.deep}; margin-bottom: 10px;
          }
          .mp-scenario h4 { font-size: 19px; margin: 0 0 12px 0; font-weight: 700; }
          .mp-scenario p { font-size: 15px; line-height: 1.7; margin: 0 0 12px 0; color: ${SITE.text}; }
          .mp-scenario p:last-child { margin-bottom: 0; }

          /* CAROUSEL */
          .mp-carousel { margin: 32px 0 8px; }
          .mp-carousel-frame {
            position: relative; width: 100%; aspect-ratio: 16 / 9;
            background: ${SITE.ink}; border-radius: 10px; overflow: hidden;
            border: 1px solid ${SITE.border};
            box-shadow: 0 20px 50px rgba(20,20,40,0.18);
          }
          .mp-carousel-imgwrap { position: absolute; inset: 0; }
          .mp-carousel-arrow {
            position: absolute; top: 50%; transform: translateY(-50%);
            width: 40px; height: 40px; border-radius: 50%;
            background: rgba(20,20,30,0.55); color: white; border: none;
            font-size: 22px; line-height: 1; cursor: pointer; z-index: 2;
            display: flex; align-items: center; justify-content: center;
            transition: background 0.15s;
          }
          .mp-carousel-arrow:hover { background: rgba(20,20,30,0.8); }
          .mp-carousel-arrow.left { left: 12px; }
          .mp-carousel-arrow.right { right: 12px; }
          .mp-carousel-caption {
            font-size: 13.5px; line-height: 1.6; color: ${SITE.muted};
            margin: 14px 4px 0; text-align: center;
          }
          .mp-carousel-dots {
            display: flex; justify-content: center; gap: 8px; margin-top: 14px;
          }
          .mp-dot {
            width: 8px; height: 8px; border-radius: 50%; border: none;
            background: ${SITE.border}; cursor: pointer; padding: 0;
            transition: background 0.15s, transform 0.15s;
          }
          .mp-dot.active { background: ${SITE.deep}; transform: scale(1.3); }

          /* PRIORITY LIST */
          .mp-priority-grid {
            display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;
            margin: 20px 0 8px;
          }
          .mp-priority-item {
            background: ${SITE.surface}; border: 1px solid ${SITE.border}; border-radius: 8px;
            padding: 18px 20px;
          }
          .mp-priority-item h5 {
            font-size: 14px; margin: 0 0 6px 0; color: ${SITE.deep}; font-weight: 700;
          }
          .mp-priority-item p { font-size: 13.5px; line-height: 1.6; margin: 0; color: ${SITE.muted}; }
          .mp-cta-secondary {
            display: inline-block; margin-top: 16px; color: #888a92;
            font-size: 11px; letter-spacing: 2px; text-decoration: none;
          }
          .mp-cta-secondary:hover { color: ${SITE.muted}; }@media (max-width: 768px) {
            .mp-tiers { grid-template-columns: 1fr; }
            .mp-priority-grid { grid-template-columns: 1fr; }
            .mp-math { padding: 18px 20px; }
            .mp-scenario { padding: 20px 20px; }
            .mp-carousel-frame { aspect-ratio: 4 / 3; }
          }
        `}</style>

        <article className="faq-root">
          <div className="faq-eyebrow">{t("▸ THE TIER ABOVE PRO")}</div>
          <span style={{ fontSize: 11, color: '#8888aa', letterSpacing: '2px', display: 'block', marginBottom: 16 }}>{t("LAST UPDATED 07/28/2026")}</span>

          <h1 className="faq-h1">
            {t("Manager+: the higher tier for people who")}{" "}<em>{t("own")}</em> {t("the operation, not just work it.")}</h1>

          <p className="faq-deck">
            {t("Pro gets you the dialer. Manager+ gets you the dialer")}{" "}<em>{t("plus")}</em>{' '}
            {t("the ability to own teams, resell seats, white-label the entire platform under your own brand, and see a level of analytics depth most competitors reserve for enterprise quotes. This page is the plain breakdown: what it costs, what it includes, and two real examples of who it's for.")}</p>

          <div className="faq-badge-row">
            <span className="faq-badge price">{t("$75 / WEEK")}</span>
            <span className="faq-badge">{t("REPLACES PRO, NOT STACKED ON TOP")}</span>
            <span className="faq-badge">{t("NO CONTRACT")}</span>
            <span className="faq-badge">{t("CANCEL ANYTIME")}</span>
          </div>

          {/* ── THE TWO TIERS ──────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ THE TWO TIERS")}</h2>
            <p>
              {t("DialerSeat only has two pricing tiers. No middle tiers, no “call us” enterprise page, no feature matrix with eleven columns. Pro is the dialer. Manager+ is the dialer plus ownership.")}</p>

            <div className="mp-tiers">
              <div className="mp-tier-card">
                <div className="mp-tier-name">{t("PRO")}</div>
                <div className="mp-tier-price">$35<span> {t("/ week")}</span></div>
                <div className="mp-tier-sub">{t("Per seat. What every dialing agent runs on.")}</div>
                <ul>
                  <li>{t("All four dialer modes: preview, power, progressive, predictive")}</li>
                  <li>{t("Genuine AMD (answering-machine detection)")}</li>
                  <li>{t("Unlimited outbound numbers and unlimited minutes")}</li>
                  <li>{t("Inbound reception included")}</li>
                  <li>{t("Call recording (30-day retention)")}</li>
                  <li>{t("Standard analytics dashboard")}</li>
                  <li>{t("Join a team as a member with a seat code")}</li>
                </ul>
              </div>

              <div className="mp-tier-card hi">
                <div className="mp-tier-name">{t("MANAGER+")}</div>
                <div className="mp-tier-price">$75<span> {t("/ week")}</span></div>
                <div className="mp-tier-sub">{t("Per team owner. Everything in Pro, plus:")}</div>
                <ul>
                  <li><strong>{t("Create and own teams")}</strong>{t(": unlimited teams, unlimited seat codes")}</li>
                  <li><strong>{t("Full white-labeling")}</strong>{t(": your logo, colors, domain, agents never see “DialerSeat”")}</li>
                  <li><strong>{t("Advanced analytics")}</strong>{t(": team-wide rollups, per-agent and per-campaign breakdowns, live floor monitoring")}</li>
                  <li><strong>{t("Owner-pays or agent-pays")}</strong> {t("billing, configured per seat code")}</li>
                  <li><strong>{t("Priority support")}</strong>{t(", see below for what that actually means")}</li>
                  <li>{t("Individual agent seats inside the team are still $35/week each, billed separately")}</li>
                </ul>
              </div>
            </div>

            <p className="muted">
              {t("One clarification worth stating plainly: Manager+ is what the team")}{" "}<em>{t("owner")}</em> {t("pays to unlock team creation, white-labeling, and the advanced analytics view. It doesn't change what an individual agent pays to dial, that's still $35/week per seat, whether the owner absorbs it or the agent covers their own.")}</p>
          </section>

          {/* ── TWO EXAMPLES ───────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ TWO PEOPLE THIS TIER IS BUILT FOR")}</h2>
            <p>
              {t("Manager+ covers a lot of different setups, but almost everyone who signs up for it falls into one of two shapes. Here's both, worked through with real numbers.")}</p>

            <div className="mp-scenario">
              <div className="mp-scenario-eyebrow">{t("EXAMPLE 1, LEAD GENERATOR SELLING CAMPAIGN ACCESS")}</div>
              <h4>{t("“I generate leads. I want to sell dialer access to them instead of selling raw CSVs.”")}</h4>
              <p>
                {t("You run a website that generates solar leads. Right now you sell exports: spreadsheets that go stale, get resold twice, and give you zero visibility into what happens after the sale. With Manager+, you upload the leads into a DialerSeat campaign instead, generate a seat code, and list it on your site as a")}<strong> {t("seat")}</strong>{t(", not a file: “$100/week, live dialer access to our exclusive solar campaign, no CSV, no resale.”")}</p>
              <p>
                {t("A buyer clicks your link, redeems the code, and is dialing your leads inside DialerSeat within minutes, on an agent-pays code, so they cover their own $35/week seat on top of what they pay you. You watch every dial, every disposition, every conversion from your Manager+ analytics view. If a buyer is burning your leads with bad talk-offs, you see it in the disposition breakdown before your refund requests pile up.")}</p>
              <p>
                {t("Ten buyers at $100/week is $1,000/week in bundling revenue on top of whatever you already charge for the leads themselves, against a fixed $75/week Manager+ cost, margin that gets better, not worse, as you add more buyers, since the platform fee never changes.")}</p>
            </div>

            <div className="mp-scenario">
              <div className="mp-scenario-eyebrow">{t("EXAMPLE 2, AGENCY OWNER RUNNING THEIR OWN FLOOR")}</div>
              <h4>{t("“I run a sales floor. I want my own branded dialer, not a tool with someone else's name on it.”")}</h4>
              <p>
                {t("You manage 8 insurance agents. They currently dial on a generic third-party tool that looks the same for every agency using it: no brand recognition, no trust-building for your company name. You sign up for Manager+, white-label it under your own domain (say, dial.youragency.com), and generate seat codes scoped to your live campaigns.")}</p>
              <p>
                {t("Your agents get an email invite, sign in, and see")}{' '}
                <em>{t("your")}</em> {t("logo and colors from the login screen onward they never see the word “DialerSeat” anywhere in the product. You watch the whole floor live from the analytics overview: who's connected, who's closing, which campaign is converting best today versus this week.")}</p>
              <p>
                {t("You choose owner-pays for your 8 core reps ($75 Manager+ + 8 × $35 seats = $355/week total DialerSeat cost) and keep an agent-pays code in reserve for contractors who come and go they cover their own seat, you still see everything they do on your campaigns.")}</p>
            </div>
          </section>

          <section className="faq-section">
            <h2>{t("▸ HOW THE SEAT COST STACKS")}</h2>
            <p>
              {t("Two numbers, always. What you pay for Manager+ itself, and what each agent seat costs on top. Nothing hidden in between.")}</p>

            <div className="mp-math">
              <div className="mp-math-title">{t("A TEAM OF 6 AGENTS, OWNER COVERING EVERYONE")}</div>
              <div className="mp-math-row">
                <span className="mp-math-label">{t("Manager+ (you, the owner)")}</span>
                <span className="mp-math-val">{t("$75 / week")}</span>
              </div>
              <div className="mp-math-row">
                <span className="mp-math-label">{t("6 agent seats × $35/week")}</span>
                <span className="mp-math-val">{t("$210 / week")}</span>
              </div>
              <div className="mp-math-row total">
                <span>{t("Total DialerSeat cost")}</span>
                <span className="mp-math-val">{t("$285 / week")}</span>
              </div>
            </div>

            <p>
              {t("That's the whole bill if you're paying for everyone. The moment you'd rather not carry that cost yourself, there's a second route.")}</p>

            <div className="mp-math">
              <div className="mp-math-title">{t("SAME TEAM, AGENTS COVERING THEIR OWN SEATS")}</div>
              <div className="mp-math-row">
                <span className="mp-math-label">{t("Manager+ (you, the owner)")}</span>
                <span className="mp-math-val">{t("$75 / week")}</span>
              </div>
              <div className="mp-math-row">
                <span className="mp-math-label">{t("6 agent seats × $35/week")}</span>
                <span className="mp-math-val">{t("paid directly by each agent")}</span>
              </div>
              <div className="mp-math-row total">
                <span>{t("Your DialerSeat cost")}</span>
                <span className="mp-math-val">{t("$75 / week")}</span>
              </div>
            </div>

            <p className="muted">
              {t("Set this per seat code, not per account, a single team can mix owner-pays codes for your core reps and agent-pays codes for contractors or probationary hires, side by side. For the full mechanics of how seat codes, recruit codes, and shared campaigns work, see")}{' '}
              <Link href="/faq/dialerseat-teams">{t("DialerSeat for teams")}</Link>.
            </p>
          </section>

          {/* ── ADVANCED ANALYTICS ─────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ WHAT “ADVANCED ANALYTICS” ACTUALLY MEANS")}</h2>
            <p>
              {t("Pro gives you your own dialing stats. Manager+ gives you the operation-wide view: every team, every agent, every campaign, rolled up into one dashboard you can slice by day, week, month, or a custom range. Below is the actual analytics overview running on a live white-labeled account, not a mockup.")}</p>

            <DesktopCarousel />

            <p style={{ marginTop: 28 }}>
              {t("The four panels update the same way whether you're watching your own solo numbers or forty agents across six teams:")}{" "}<strong>{t("call volume over time")}</strong>,{' '}
              <strong>{t("conversion rate over time")}</strong>,{' '}
              <strong>{t("disposition breakdown")}</strong>{t(", and")}{' '}
              <strong>{t("campaign performance")}</strong>{t(", each one filterable to today, this week, this month, all time, or a custom window.")}</p>
            <p>
              {t("This is also where the desktop app pulls ahead of a browser tab: run")}{" "}<strong>{t("Analytics")}</strong> {t("and")}{" "}<strong>{t("Teams")}</strong>{' '}
              {t("as separate windows side by side, the way the multi-window screenshot above shows, and watch your floor's numbers move while you're actively managing seat codes in the window next to it.")}</p>
            <p className="muted">
              {t("We ship analytics features on a rolling basis, not a yearly roadmap cycle, if managers ask for a specific breakdown enough times, it tends to show up in the dashboard within weeks, not quarters.")}</p>
          </section>

          {/* ── PRIORITY ───────────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ WHAT PRIORITY ACTUALLY MEANS")}</h2>
            <p>
              {t("“Priority support” is a phrase that gets thrown around loosely in this industry, so here's what it concretely changes for Manager+ accounts:")}</p>

            <div className="mp-priority-grid">
              <div className="mp-priority-item">
                <h5>{t("FASTER RESPONSE QUEUE")}</h5>
                <p>{t("Manager+ support requests are triaged ahead of standard Pro tickets: you're running a floor of other people's money and time, so a stuck dialer costs you more than it costs a solo user.")}</p>
              </div>
              <div className="mp-priority-item">
                <h5>{t("DIRECT LINE ON WHITE-LABEL ISSUES")}</h5>
                <p>{t("Domain, DNS, and branding setup questions get handled directly rather than routed through a generic help queue, this is a technical setup step most support tiers elsewhere don't touch at all.")}</p>
              </div>
              <div className="mp-priority-item">
                <h5>{t("FEATURE REQUEST WEIGHT")}</h5>
                <p>{t("Manager+ feedback carries more weight in what gets built next, simply because managers surface problems affecting an entire floor, not just one seat.")}</p>
              </div>
              <div className="mp-priority-item">
                <h5>{t("VOLUME CONVERSATIONS")}</h5>
                <p>{t("Proven agency owners or lead generators with real volume can talk directly about promo codes, referral arrangements, and seat pricing that reflects what they're bringing to the platform, see the note at the bottom of the")}{" "}<Link href="/faq/managers">{t("managers page")}</Link>.</p>
              </div>
            </div>
          </section>

          {/* ── HONEST CALLOUT ─────────────────────────────────────────────── */}
          <div className="faq-callout">
            <p>
              <strong>{t("One honest thing,")}{" "}</strong> {t("DialerSeat doesn't process your resell payments for you. If you charge a buyer or agent more than the $35 seat cost, that markup is collected by you directly: Stripe, Venmo, invoicing, whatever you already use. We don't take a cut of it and we don't see the number. Payment routing for managers is on the roadmap; today the buyer-to-you transaction is yours to handle.")}</p>
          </div>

          {/* ── RELATED ────────────────────────────────────────────────────── */}
          <div className="faq-related">
            <div className="faq-related-label">{t("▸ RELATED READING")}</div>
            <div className="faq-related-links">
              <Link href="/faq/managers">{t("For managers, agency owners & lead vendors")}</Link>
              <Link href="/faq/white-label">{t("White-label your dialer")}</Link>
              <Link href="/faq/white-label-mobile">{t("White-label on mobile")}</Link>
              <Link href="/faq/mobile">{t("DialerSeat on mobile")}</Link>
              <Link href="/faq/dialerseat-teams">{t("DialerSeat for teams")}</Link>
              <Link href="/faq/why-we-charge">{t("Why we charge what we charge")}</Link>
              <Link href="/faq">{t("FAQ")}</Link>
            </div>
          </div>

          {/* ── CTA ──────────────────────────────────────────────────────────  */}
          <div className="faq-cta">
            <div className="faq-cta-eyebrow">{t("▸ READY TO OWN YOUR OWN FLOOR?")}</div>
            <h3 className="faq-cta-h">{t("$75/week. No contract. Cancel any time.")}</h3>
            <p>
              {t("Sign up, create your first team, and generate your first seat code in the next few minutes. White-labeling is a setting away once you're in.")}</p>
            <a href={isSignedIn ? '/dashboard/teams' : '/sign-up'} className="faq-cta-btn">
              {isSignedIn ? t("GO TO TEAMS →") : t("START MANAGER+ →")}
            </a>
            <br />
            <Link href="/faq/dialerseat-teams" className="mp-cta-secondary">
              {t("OR READ THE FULL TEAMS BREAKDOWN →")}</Link>
          </div>
        </article>
      </GutsShell>
      <SiteFooter />
    </>
  )
}

