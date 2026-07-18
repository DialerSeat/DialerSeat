'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
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
  gold: '#ffaa3e',
}

type Slide = { src: string; alt: string; caption: string }

const DESKTOP_SLIDES: Slide[] = [
  {
    src: '/faq-images/manager-plus/desktop-analytics.png',
    alt: 'DialerSeat Manager+ analytics overview, white-labeled, showing total calls, hours dialed, conversions, closed deals, talk time, and best campaign',
    caption:
      'ANALYTICS OVERVIEW — every number a manager actually checks each morning, in one screen. This account is running white-labeled, so the branding is entirely the operator\u2019s own.',
  },
  {
    src: '/faq-images/manager-plus/desktop-dialer.png',
    alt: 'DialerSeat dialer terminal in power mode, white-labeled, showing manual dial pad and today\u2019s metrics sidebar',
    caption:
      'The dialer terminal itself, same white-label skin. Manager+ doesn\u2019t change what agents dial with \u2014 it changes what the owner sees around it.',
  },
  {
    src: '/faq-images/manager-plus/desktop-os-multiwindow.png',
    alt: 'DialerSeat desktop app showing Teams and Analytics windows open side by side',
    caption:
      'The desktop app running Teams and Analytics side by side \u2014 a manager watching team performance update live while managing seat codes in the next window.',
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
          aria-label="Previous screenshot"
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
          aria-label="Next screenshot"
        >
          ›
        </button>
      </div>
      <p className="mp-carousel-caption">{slide.caption}</p>
      <div className="mp-carousel-dots">
        {DESKTOP_SLIDES.map((s, i) => (
          <button
            key={s.src}
            className={`mp-dot ${i === idx ? 'active' : ''}`}
            onClick={() => setIdx(i)}
            aria-label={`Go to screenshot ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

export default function ManagerPlusFaqView() {
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
        .mp-root { max-width: 820px; margin: 0 auto; padding: 80px 32px 120px; }
        .mp-eyebrow {
          font-size: 11px; letter-spacing: 4px; color: ${T.muted};
          font-weight: bold; margin-bottom: 18px;
        }
        .mp-h1 {
          font-size: 44px; line-height: 1.15; letter-spacing: -0.5px;
          font-weight: 700; margin: 0 0 24px 0;
        }
        .mp-h1 em { font-style: normal; color: ${T.blue}; }
        .mp-deck {
          font-size: 19px; line-height: 1.6; color: ${T.muted};
          margin-bottom: 40px; max-width: 680px;
        }

        .mp-badge-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 56px; }
        .mp-badge {
          padding: 8px 16px; border-radius: 20px; font-size: 12px;
          font-weight: bold; letter-spacing: 1px; border: 1px solid ${T.border};
          background: white; color: ${T.text};
        }
        .mp-badge.price { background: ${T.dark}; color: white; border-color: ${T.dark}; }

        .mp-section { margin: 56px 0; }
        .mp-section h2 {
          font-size: 13px; letter-spacing: 3px; font-weight: bold;
          color: ${T.accent}; margin: 0 0 18px 0;
          padding-bottom: 10px; border-bottom: 1px solid ${T.border};
        }
        .mp-section h3 {
          font-size: 22px; line-height: 1.3; font-weight: 700;
          margin: 28px 0 14px 0; letter-spacing: -0.2px;
        }
        .mp-section p {
          font-size: 16px; line-height: 1.75; margin: 0 0 18px 0;
          color: ${T.text};
        }
        .mp-section p.muted { color: ${T.muted}; font-size: 15px; }
        .mp-section strong { color: ${T.text}; font-weight: 700; }
        .mp-section em { font-style: italic; color: ${T.accent}; }
        .mp-section ul { margin: 14px 0 24px 0; padding-left: 22px; }
        .mp-section li { font-size: 16px; line-height: 1.75; margin-bottom: 8px; }

        /* PRICING TABLE */
        .mp-tiers {
          display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
          margin: 28px 0 32px;
        }
        .mp-tier-card {
          background: white; border: 1px solid ${T.border}; border-radius: 8px;
          padding: 24px 22px;
        }
        .mp-tier-card.hi {
          border: 2px solid ${T.accent};
          box-shadow: 0 4px 20px rgba(42,74,138,0.12);
        }
        .mp-tier-name {
          font-size: 11px; letter-spacing: 2px; font-weight: bold; color: ${T.muted};
          margin-bottom: 8px;
        }
        .mp-tier-card.hi .mp-tier-name { color: ${T.accent}; }
        .mp-tier-price { font-size: 30px; font-weight: 800; margin-bottom: 4px; }
        .mp-tier-price span { font-size: 14px; font-weight: 600; color: ${T.muted}; }
        .mp-tier-sub { font-size: 13px; color: ${T.muted}; margin-bottom: 16px; }
        .mp-tier-card ul { margin: 0; padding-left: 18px; }
        .mp-tier-card li { font-size: 14px; line-height: 1.6; margin-bottom: 6px; }

        /* MATH BLOCK */
        .mp-math {
          margin: 28px 0; padding: 24px 28px;
          background: white; border: 1px solid ${T.border};
          border-left: 3px solid ${T.green}; border-radius: 6px;
        }
        .mp-math-title {
          font-size: 11px; letter-spacing: 3px; color: ${T.green};
          font-weight: bold; margin-bottom: 14px;
        }
        .mp-math-row {
          display: flex; justify-content: space-between; align-items: baseline;
          padding: 6px 0; font-size: 15px; border-bottom: 1px dashed ${T.border};
        }
        .mp-math-row:last-child { border-bottom: none; padding-top: 10px; margin-top: 4px; }
        .mp-math-row.total {
          border-top: 2px solid ${T.border}; border-bottom: none;
          padding-top: 12px; margin-top: 8px; font-size: 17px; font-weight: 700;
        }
        .mp-math-row.total .mp-math-val { color: ${T.green}; }
        .mp-math-label { color: ${T.muted}; }
        .mp-math-val { font-family: monospace; font-weight: 600; color: ${T.text}; }

        /* SCENARIO CARDS */
        .mp-scenario {
          margin: 28px 0; padding: 26px 28px; background: white;
          border: 1px solid ${T.border}; border-radius: 8px;
        }
        .mp-scenario-eyebrow {
          font-size: 10px; letter-spacing: 3px; font-weight: bold;
          color: ${T.accent}; margin-bottom: 10px;
        }
        .mp-scenario h4 { font-size: 19px; margin: 0 0 12px 0; font-weight: 700; }
        .mp-scenario p { font-size: 15px; line-height: 1.7; margin: 0 0 12px 0; color: ${T.text}; }
        .mp-scenario p:last-child { margin-bottom: 0; }

        /* CAROUSEL */
        .mp-carousel { margin: 32px 0 8px; }
        .mp-carousel-frame {
          position: relative; width: 100%; aspect-ratio: 16 / 9;
          background: ${T.dark}; border-radius: 10px; overflow: hidden;
          border: 1px solid ${T.border};
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
          font-size: 13.5px; line-height: 1.6; color: ${T.muted};
          margin: 14px 4px 0; text-align: center;
        }
        .mp-carousel-dots {
          display: flex; justify-content: center; gap: 8px; margin-top: 14px;
        }
        .mp-dot {
          width: 8px; height: 8px; border-radius: 50%; border: none;
          background: ${T.border}; cursor: pointer; padding: 0;
          transition: background 0.15s, transform 0.15s;
        }
        .mp-dot.active { background: ${T.accent}; transform: scale(1.3); }

        /* CALLOUT */
        .mp-callout {
          margin: 32px 0; padding: 22px 26px; background: ${T.surface};
          border-left: 3px solid ${T.blue}; border-radius: 4px;
        }
        .mp-callout p { font-size: 15px; line-height: 1.7; margin: 0; color: ${T.text}; }
        .mp-callout strong { color: ${T.accent}; }

        /* PRIORITY LIST */
        .mp-priority-grid {
          display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;
          margin: 20px 0 8px;
        }
        .mp-priority-item {
          background: white; border: 1px solid ${T.border}; border-radius: 8px;
          padding: 18px 20px;
        }
        .mp-priority-item h5 {
          font-size: 14px; margin: 0 0 6px 0; color: ${T.accent}; font-weight: 700;
        }
        .mp-priority-item p { font-size: 13.5px; line-height: 1.6; margin: 0; color: ${T.muted}; }

        /* CTA */
        .mp-cta-box {
          margin-top: 56px; padding: 40px 36px; background: ${T.dark};
          border-radius: 8px; text-align: center;
        }
        .mp-cta-box .mp-cta-eyebrow {
          font-size: 10px; letter-spacing: 4px; color: ${T.blue};
          font-weight: bold; margin-bottom: 14px;
        }
        .mp-cta-box .mp-cta-h {
          font-size: 26px; color: white; font-weight: 700;
          margin: 0 0 12px 0; letter-spacing: -0.2px;
        }
        .mp-cta-box p { font-size: 15px; color: #c0c2ca; line-height: 1.6; margin: 0 0 28px 0; }
        .mp-cta-box .mp-cta-btn {
          display: inline-block; padding: 16px 36px;
          background: linear-gradient(135deg, #4a9eff, #2a6eff);
          border: none; border-radius: 6px; color: white;
          font-size: 12px; font-weight: bold; letter-spacing: 3px;
          text-decoration: none; font-family: 'Futura PT', Futura, sans-serif;
          box-shadow: 0 0 24px rgba(74,158,255,0.3);
        }
        .mp-cta-secondary {
          display: inline-block; margin-top: 16px; color: #888a92;
          font-size: 11px; letter-spacing: 2px; text-decoration: none;
        }
        .mp-cta-secondary:hover { color: #c0c2ca; }

        .mp-related {
          margin-top: 48px; padding-top: 28px; border-top: 1px solid ${T.border};
        }
        .mp-related-label {
          font-size: 10px; letter-spacing: 3px; color: ${T.muted};
          font-weight: bold; margin-bottom: 14px;
        }
        .mp-related-links { display: flex; gap: 24px; flex-wrap: wrap; }
        .mp-related-links a {
          font-size: 13px; color: ${T.accent}; text-decoration: none;
          border-bottom: 1px solid transparent; padding-bottom: 1px;
          transition: border-color 0.15s;
        }
        .mp-related-links a:hover { border-bottom-color: ${T.accent}; }

        @media (max-width: 768px) {
          .mp-root { padding: 48px 20px 80px; }
          .mp-h1 { font-size: 30px; }
          .mp-deck { font-size: 16px; }
          .mp-section h3 { font-size: 19px; }
          .mp-section p, .mp-section li { font-size: 15px; }
          .mp-tiers { grid-template-columns: 1fr; }
          .mp-priority-grid { grid-template-columns: 1fr; }
          .mp-math { padding: 18px 20px; }
          .mp-scenario { padding: 20px 20px; }
          .mp-cta-box { padding: 32px 24px; }
          .mp-cta-box .mp-cta-h { font-size: 22px; }
          .mp-carousel-frame { aspect-ratio: 4 / 3; }
        }
      `}</style>

      <article className="mp-root">
        <div className="mp-eyebrow">▸ THE TIER ABOVE PRO</div>

        <h1 className="mp-h1">
          Manager+: the higher tier for people who <em>own</em> the operation, not just work it.
        </h1>

        <p className="mp-deck">
          Pro gets you the dialer. Manager+ gets you the dialer <em>plus</em>{' '}
          the ability to own teams, resell seats, white-label the entire
          platform under your own brand, and see a level of analytics depth
          most competitors reserve for enterprise quotes. This page is the
          plain breakdown: what it costs, what it includes, and two real
          examples of who it&apos;s for.
        </p>

        <div className="mp-badge-row">
          <span className="mp-badge price">$75 / WEEK</span>
          <span className="mp-badge">REPLACES PRO — NOT STACKED ON TOP</span>
          <span className="mp-badge">NO CONTRACT</span>
          <span className="mp-badge">CANCEL ANYTIME</span>
        </div>

        {/* ── THE TWO TIERS ──────────────────────────────────────────────── */}
        <section className="mp-section">
          <h2>▸ THE TWO TIERS</h2>
          <p>
            DialerSeat only has two pricing tiers. No middle tiers, no
            &ldquo;call us&rdquo; enterprise page, no feature matrix with
            eleven columns. Pro is the dialer. Manager+ is the dialer plus
            ownership.
          </p>

          <div className="mp-tiers">
            <div className="mp-tier-card">
              <div className="mp-tier-name">PRO</div>
              <div className="mp-tier-price">$35<span> / week</span></div>
              <div className="mp-tier-sub">Per seat. What every dialing agent runs on.</div>
              <ul>
                <li>All four dialer modes — preview, power, progressive, predictive</li>
                <li>Genuine AMD (answering-machine detection)</li>
                <li>Unlimited outbound numbers and unlimited minutes</li>
                <li>Inbound reception included</li>
                <li>Call recording (30-day retention)</li>
                <li>Standard analytics dashboard</li>
                <li>Join a team as a member with a seat code</li>
              </ul>
            </div>

            <div className="mp-tier-card hi">
              <div className="mp-tier-name">MANAGER+</div>
              <div className="mp-tier-price">$75<span> / week</span></div>
              <div className="mp-tier-sub">Per team owner. Everything in Pro, plus:</div>
              <ul>
                <li><strong>Create and own teams</strong> — unlimited teams, unlimited seat codes</li>
                <li><strong>Full white-labeling</strong> — your logo, colors, domain, agents never see &ldquo;DialerSeat&rdquo;</li>
                <li><strong>Advanced analytics</strong> — team-wide rollups, per-agent and per-campaign breakdowns, live floor monitoring</li>
                <li><strong>Owner-pays or agent-pays</strong> billing, configured per seat code</li>
                <li><strong>Priority support</strong> — see below for what that actually means</li>
                <li>Individual agent seats inside the team are still $35/week each, billed separately</li>
              </ul>
            </div>
          </div>

          <p className="muted">
            One clarification worth stating plainly: Manager+ is what the
            team <em>owner</em> pays to unlock team creation, white-labeling,
            and the advanced analytics view. It doesn&apos;t change what an
            individual agent pays to dial — that&apos;s still $35/week per
            seat, whether the owner absorbs it or the agent covers their
            own.
          </p>
        </section>

        {/* ── TWO EXAMPLES ───────────────────────────────────────────────── */}
        <section className="mp-section">
          <h2>▸ TWO PEOPLE THIS TIER IS BUILT FOR</h2>
          <p>
            Manager+ covers a lot of different setups, but almost everyone
            who signs up for it falls into one of two shapes. Here&apos;s
            both, worked through with real numbers.
          </p>

          <div className="mp-scenario">
            <div className="mp-scenario-eyebrow">EXAMPLE 1 — LEAD GENERATOR SELLING CAMPAIGN ACCESS</div>
            <h4>&ldquo;I generate leads. I want to sell dialer access to them instead of selling raw CSVs.&rdquo;</h4>
            <p>
              You run a website that generates solar leads. Right now you
              sell exports — spreadsheets that go stale, get resold twice,
              and give you zero visibility into what happens after the sale.
              With Manager+, you upload the leads into a DialerSeat campaign
              instead, generate a seat code, and list it on your site as a
              <strong> seat</strong>, not a file: &ldquo;$100/week — live
              dialer access to our exclusive solar campaign, no CSV, no
              resale.&rdquo;
            </p>
            <p>
              A buyer clicks your link, redeems the code, and is dialing
              your leads inside DialerSeat within minutes — on an
              agent-pays code, so they cover their own $35/week seat on top
              of what they pay you. You watch every dial, every disposition,
              every conversion from your Manager+ analytics view. If a buyer
              is burning your leads with bad talk-offs, you see it in the
              disposition breakdown before your refund requests pile up.
            </p>
            <p>
              Ten buyers at $100/week is $1,000/week in bundling revenue on
              top of whatever you already charge for the leads themselves,
              against a fixed $75/week Manager+ cost — margin that gets
              better, not worse, as you add more buyers, since the platform
              fee never changes.
            </p>
          </div>

          <div className="mp-scenario">
            <div className="mp-scenario-eyebrow">EXAMPLE 2 — AGENCY OWNER RUNNING THEIR OWN FLOOR</div>
            <h4>&ldquo;I run a sales floor. I want my own branded dialer, not a tool with someone else&apos;s name on it.&rdquo;</h4>
            <p>
              You manage 8 insurance agents. They currently dial on a
              generic third-party tool that looks the same for every agency
              using it — no brand recognition, no trust-building for your
              company name. You sign up for Manager+, white-label it under
              your own domain (say, dial.youragency.com), and generate seat
              codes scoped to your live campaigns.
            </p>
            <p>
              Your agents get an email invite, sign in, and see{' '}
              <em>your</em> logo and colors from the login screen onward —
              they never see the word &ldquo;DialerSeat&rdquo; anywhere in
              the product. You watch the whole floor live from the
              analytics overview: who&apos;s connected, who&apos;s closing,
              which campaign is converting best today versus this week.
            </p>
            <p>
              You choose owner-pays for your 8 core reps ($75 Manager+ + 8 ×
              $35 seats = $355/week total DialerSeat cost) and keep an
              agent-pays code in reserve for contractors who come and go —
              they cover their own seat, you still see everything they do
              on your campaigns.
            </p>
          </div>
        </section>

        <section className="mp-section">
          <h2>▸ HOW THE SEAT COST STACKS</h2>
          <p>
            Two numbers, always. What you pay for Manager+ itself, and what
            each agent seat costs on top. Nothing hidden in between.
          </p>

          <div className="mp-math">
            <div className="mp-math-title">A TEAM OF 6 AGENTS, OWNER COVERING EVERYONE</div>
            <div className="mp-math-row">
              <span className="mp-math-label">Manager+ (you, the owner)</span>
              <span className="mp-math-val">$75 / week</span>
            </div>
            <div className="mp-math-row">
              <span className="mp-math-label">6 agent seats × $35/week</span>
              <span className="mp-math-val">$210 / week</span>
            </div>
            <div className="mp-math-row total">
              <span>Total DialerSeat cost</span>
              <span className="mp-math-val">$285 / week</span>
            </div>
          </div>

          <p>
            That&apos;s the whole bill if you&apos;re paying for everyone.
            The moment you&apos;d rather not carry that cost yourself,
            there&apos;s a second route.
          </p>

          <div className="mp-math">
            <div className="mp-math-title">SAME TEAM, AGENTS COVERING THEIR OWN SEATS</div>
            <div className="mp-math-row">
              <span className="mp-math-label">Manager+ (you, the owner)</span>
              <span className="mp-math-val">$75 / week</span>
            </div>
            <div className="mp-math-row">
              <span className="mp-math-label">6 agent seats × $35/week</span>
              <span className="mp-math-val">paid directly by each agent</span>
            </div>
            <div className="mp-math-row total">
              <span>Your DialerSeat cost</span>
              <span className="mp-math-val">$75 / week</span>
            </div>
          </div>

          <p className="muted">
            Set this per seat code, not per account — a single team can mix
            owner-pays codes for your core reps and agent-pays codes for
            contractors or trial hires, side by side. For the full
            mechanics of how seat codes, recruit codes, and shared campaigns
            work, see{' '}
            <Link href="/faq/dialerseat-teams">DialerSeat for teams</Link>.
          </p>
        </section>

        {/* ── ADVANCED ANALYTICS ─────────────────────────────────────────── */}
        <section className="mp-section">
          <h2>▸ WHAT &ldquo;ADVANCED ANALYTICS&rdquo; ACTUALLY MEANS</h2>
          <p>
            Pro gives you your own dialing stats. Manager+ gives you the
            operation-wide view: every team, every agent, every campaign,
            rolled up into one dashboard you can slice by day, week, month,
            or a custom range. Below is the actual analytics overview
            running on a live white-labeled account — not a mockup.
          </p>

          <DesktopCarousel />

          <p style={{ marginTop: 28 }}>
            The four panels update the same way whether you&apos;re
            watching your own solo numbers or forty agents across six
            teams: <strong>call volume over time</strong>,{' '}
            <strong>conversion rate over time</strong>,{' '}
            <strong>disposition breakdown</strong>, and{' '}
            <strong>campaign performance</strong> — each one filterable to
            today, this week, this month, all time, or a custom window.
          </p>
          <p>
            This is also where the desktop app pulls ahead of a browser
            tab: run <strong>Analytics</strong> and <strong>Teams</strong>{' '}
            as separate windows side by side, the way the multi-window
            screenshot above shows, and watch your floor&apos;s numbers
            move while you&apos;re actively managing seat codes in the
            window next to it.
          </p>
          <p className="muted">
            We ship analytics features on a rolling basis, not a yearly
            roadmap cycle — if managers ask for a specific breakdown enough
            times, it tends to show up in the dashboard within weeks, not
            quarters.
          </p>
        </section>

        {/* ── PRIORITY ───────────────────────────────────────────────────── */}
        <section className="mp-section">
          <h2>▸ WHAT PRIORITY ACTUALLY MEANS</h2>
          <p>
            &ldquo;Priority support&rdquo; is a phrase that gets thrown
            around loosely in this industry, so here&apos;s what it
            concretely changes for Manager+ accounts:
          </p>

          <div className="mp-priority-grid">
            <div className="mp-priority-item">
              <h5>FASTER RESPONSE QUEUE</h5>
              <p>Manager+ support requests are triaged ahead of standard Pro tickets — you&apos;re running a floor of other people&apos;s money and time, so a stuck dialer costs you more than it costs a solo user.</p>
            </div>
            <div className="mp-priority-item">
              <h5>DIRECT LINE ON WHITE-LABEL ISSUES</h5>
              <p>Domain, DNS, and branding setup questions get handled directly rather than routed through a generic help queue — this is a technical setup step most support tiers elsewhere don&apos;t touch at all.</p>
            </div>
            <div className="mp-priority-item">
              <h5>FEATURE REQUEST WEIGHT</h5>
              <p>Manager+ feedback carries more weight in what gets built next, simply because managers surface problems affecting an entire floor, not just one seat.</p>
            </div>
            <div className="mp-priority-item">
              <h5>VOLUME CONVERSATIONS</h5>
              <p>Proven agency owners or lead generators with real volume can talk directly about promo codes, referral arrangements, and seat pricing that reflects what they&apos;re bringing to the platform — see the note at the bottom of the <Link href="/faq/managers">managers page</Link>.</p>
            </div>
          </div>
        </section>

        {/* ── HONEST CALLOUT ─────────────────────────────────────────────── */}
        <div className="mp-callout">
          <p>
            <strong>One honest thing —</strong> DialerSeat doesn&apos;t
            process your resell payments for you. If you charge a buyer or
            agent more than the $35 seat cost, that markup is collected by
            you directly — Stripe, Venmo, invoicing, whatever you already
            use. We don&apos;t take a cut of it and we don&apos;t see the
            number. Payment routing for managers is on the roadmap; today
            the buyer-to-you transaction is yours to handle.
          </p>
        </div>

        {/* ── RELATED ────────────────────────────────────────────────────── */}
        <div className="mp-related">
          <div className="mp-related-label">▸ RELATED READING</div>
          <div className="mp-related-links">
            <Link href="/faq/managers">For managers — agency owners &amp; lead vendors</Link>
            <Link href="/faq/white-label">White-label your dialer</Link>
            <Link href="/faq/white-label-mobile">White-label on mobile</Link>
            <Link href="/faq/mobile">DialerSeat on mobile</Link>
            <Link href="/faq/dialerseat-teams">DialerSeat for teams</Link>
            <Link href="/faq/why-we-charge">Why we charge what we charge</Link>
            <Link href="/faq">FAQ</Link>
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────────  */}
        <div className="mp-cta-box">
          <div className="mp-cta-eyebrow">▸ READY TO OWN YOUR OWN FLOOR?</div>
          <h3 className="mp-cta-h">$75/week. No contract. Cancel any time.</h3>
          <p>
            Sign up, create your first team, and generate your first seat
            code in the next few minutes. White-labeling is a setting away
            once you&apos;re in.
          </p>
          <a href={isSignedIn ? '/dashboard/teams' : '/sign-up'} className="mp-cta-btn">
            {isSignedIn ? 'GO TO TEAMS →' : 'START MANAGER+ →'}
          </a>
          <br />
          <Link href="/faq/dialerseat-teams" className="mp-cta-secondary">
            OR READ THE FULL TEAMS BREAKDOWN →
          </Link>
        </div>
      </article>
    </div>
  )
}

