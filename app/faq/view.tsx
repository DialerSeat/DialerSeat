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
  darker: '#0a0a14',
  text: '#1a1c24',
  muted: '#5a5e6a',
  accent: '#4a9eff',
  accentDark: '#2a4a8a',
}

export default function FaqView() {
  const { isLoaded, isSignedIn } = useUser()
  const showSignedIn = isLoaded && isSignedIn

  return (
    <>
      <SiteHeader />
      <main style={{
        background: T.bg,
        minHeight: '100vh',
        fontFamily: 'Futura PT, Futura, sans-serif',
        color: T.text,
      }}>
        <style>{`
          .faq-root * { box-sizing: border-box; }

          /* ── HERO ── */
          .faq-hero {
            background: linear-gradient(135deg, ${T.darker} 0%, ${T.dark} 100%);
            color: white;
            padding: 100px 32px 80px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .faq-hero::before {
            content: '';
            position: absolute; inset: 0;
            background:
              radial-gradient(circle at 20% 30%, rgba(74,158,255,0.18) 0%, transparent 45%),
              radial-gradient(circle at 80% 60%, rgba(74,158,255,0.12) 0%, transparent 45%);
          }
          .faq-hero-inner {
            position: relative;
            max-width: 880px;
            margin: 0 auto;
          }
          .faq-eyebrow {
            display: inline-block;
            padding: 6px 14px;
            background: rgba(74,158,255,0.15);
            border: 1px solid ${T.accent};
            border-radius: 4px;
            color: ${T.accent};
            font-size: 11px;
            letter-spacing: 3px;
            font-weight: bold;
            margin-bottom: 24px;
          }
          .faq-hero h1 {
            font-size: 56px;
            font-weight: 800;
            letter-spacing: -1.5px;
            line-height: 1.05;
            margin: 0 0 20px 0;
          }
          .faq-hero h1 .accent {
            background: linear-gradient(135deg, ${T.accent}, #a0c4ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          .faq-lead {
            font-size: 18px;
            line-height: 1.6;
            color: #c4c8d8;
            max-width: 680px;
            margin: 0 auto;
          }

          /* ── BODY ── */
          .faq-body {
            max-width: 1180px;
            margin: 0 auto;
            padding: 80px 32px;
          }

          /* ── SECTION HEADER ── */
          .faq-section-eyebrow {
            font-size: 11px;
            letter-spacing: 4px;
            color: ${T.muted};
            font-weight: bold;
            margin-bottom: 12px;
            text-align: center;
          }
          .faq-section-h2 {
            font-size: 36px;
            letter-spacing: -0.5px;
            line-height: 1.15;
            font-weight: 800;
            margin: 0 0 16px 0;
            color: ${T.text};
            text-align: center;
          }
          .faq-section-lede {
            font-size: 16px;
            color: ${T.muted};
            line-height: 1.65;
            max-width: 680px;
            margin: 0 auto 48px auto;
            text-align: center;
          }

          /* ── FEATURED CARD ── */
          .faq-featured {
            display: block;
            background: linear-gradient(135deg, ${T.dark} 0%, #2a2c44 100%);
            border-radius: 14px;
            padding: 40px 44px;
            text-decoration: none;
            color: white;
            position: relative;
            overflow: hidden;
            margin-bottom: 72px;
            transition: transform 0.15s, box-shadow 0.15s;
            border: 1px solid rgba(255,255,255,0.05);
            border-top: 4px solid ${T.accent};
          }
          .faq-featured:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 32px rgba(0,0,0,0.22);
            border-color: ${T.accent};
            border-top-color: ${T.accent};
          }
          .faq-featured::before {
            content: '';
            position: absolute; right: -60px; top: -60px;
            width: 280px; height: 280px;
            background: radial-gradient(circle, rgba(74,158,255,0.2) 0%, transparent 70%);
            pointer-events: none;
          }
          .faq-featured-eyebrow {
            position: relative;
            display: inline-block;
            padding: 4px 10px;
            background: rgba(74,158,255,0.15);
            border: 1px solid ${T.accent};
            border-radius: 4px;
            color: ${T.accent};
            font-size: 9px;
            letter-spacing: 2.5px;
            font-weight: bold;
            margin-bottom: 16px;
          }
          .faq-featured h2 {
            position: relative;
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -0.5px;
            line-height: 1.15;
            margin: 0 0 14px 0;
            color: white;
          }
          .faq-featured p {
            position: relative;
            font-size: 15px;
            line-height: 1.7;
            color: #c4c8d8;
            margin: 0 0 20px 0;
            max-width: 600px;
          }
          .faq-featured-cta {
            position: relative;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
            letter-spacing: 2.5px;
            font-weight: bold;
            color: ${T.accent};
          }

          /* ── EXPLAINER GRID ── */
          .faq-explainers { margin-bottom: 72px; }
          .faq-explainers-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 14px;
            margin-top: 0;
          }
          .faq-exp-card {
            background: white;
            border: 1px solid ${T.border};
            border-radius: 14px;
            padding: 22px 24px;
            text-decoration: none;
            color: ${T.text};
            display: flex;
            flex-direction: column;
            gap: 10px;
            transition: all 0.15s ease;
            position: relative;
            overflow: hidden;
          }
          .faq-exp-card:hover {
            border-color: ${T.accent};
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(74,158,255,0.12);
          }
          .faq-exp-card .pill {
            display: inline-block;
            font-size: 9px;
            letter-spacing: 2.5px;
            font-weight: bold;
            padding: 3px 8px;
            border-radius: 100px;
            width: fit-content;
          }
          .faq-exp-card .card-title {
            font-size: 14px;
            font-weight: 700;
            line-height: 1.4;
            color: ${T.text};
          }
          .faq-exp-card .read-more {
            font-size: 10px;
            letter-spacing: 2px;
            font-weight: bold;
            color: ${T.accent};
            margin-top: auto;
            padding-top: 4px;
          }

          /* pill color variants */
          .faq-exp-card.preview .pill   { background: #f0f0f4; color: #5a5e6a; border: 1px solid #5a5e6a; }
          .faq-exp-card.power .pill     { background: #e8eef8; color: #2a4a8a; border: 1px solid #2a4a8a; }
          .faq-exp-card.progressive .pill { background: #e8f5e8; color: #1a6a1a; border: 1px solid #1a6a1a; }
          .faq-exp-card.predictive .pill  { background: #f8e8e8; color: #8a1a1a; border: 1px solid #8a1a1a; }
          .faq-exp-card.compliance .pill  { background: #fdf4e8; color: #8a6a1a; border: 1px solid #8a6a1a; }
          .faq-exp-card.amd .pill         { background: #e8eef8; color: #2a4a8a; border: 1px solid #2a4a8a; }
          .faq-exp-card.pricing .pill     { background: #e8f5e8; color: #1a6a1a; border: 1px solid #1a6a1a; }
          .faq-exp-card.teams .pill       { background: #f0eafd; color: #5a2a8a; border: 1px solid #5a2a8a; }
          .faq-exp-card.managerplus .pill { background: #eaf0fd; color: #2a4a8a; border: 1px solid #2a4a8a; }
          .faq-exp-card.mobile .pill      { background: #e8f0fd; color: #1a4a8a; border: 1px solid #1a4a8a; }
          .faq-exp-card.numbers .pill     { background: #fdeaea; color: #8a1a1a; border: 1px solid #8a1a1a; }
          .faq-exp-card.leads .pill       { background: #e8f5e8; color: #1a6a4a; border: 1px solid #1a6a4a; }
          .faq-exp-card.scripts .pill     { background: #eaeaff; color: #4a4aa8; border: 1px solid #4a4aa8; }
          .faq-exp-card.campaigns .pill   { background: #e8f0fd; color: #2a4a8a; border: 1px solid #2a4a8a; }
          .faq-exp-card.billing .pill     { background: #e8f5e8; color: #1a6a1a; border: 1px solid #1a6a1a; }
          .faq-exp-card.compliance-export .pill { background: #fdf4e8; color: #8a6a1a; border: 1px solid #8a6a1a; }
          .faq-exp-card.data .pill        { background: #eaeaff; color: #4a4aa8; border: 1px solid #4a4aa8; }

          /* ── ACCORDION ── */
          .faq-qa-section { margin-bottom: 72px; }
          .faq-qa details {
            background: white;
            border: 1px solid ${T.border};
            border-radius: 14px;
            margin-bottom: 10px;
            overflow: hidden;
            transition: border-color 0.12s;
          }
          .faq-qa details[open] {
            border-color: ${T.accent};
          }
          .faq-qa summary {
            padding: 22px 28px;
            font-size: 15px;
            font-weight: 700;
            color: ${T.text};
            cursor: pointer;
            list-style: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
          }
          .faq-qa summary::-webkit-details-marker { display: none; }
          .faq-qa summary::after {
            content: '+';
            color: ${T.accent};
            font-size: 22px;
            font-weight: bold;
            flex-shrink: 0;
            line-height: 1;
          }
          .faq-qa details[open] summary::after { content: '−'; }
          .faq-qa .answer {
            padding: 0 28px 24px;
            font-size: 14px;
            line-height: 1.8;
            color: ${T.muted};
          }
          .faq-qa .answer p { margin: 0 0 12px 0; }
          .faq-qa .answer p:last-child { margin-bottom: 0; }
          .faq-qa .answer code {
            background: ${T.bg};
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 12.5px;
            font-family: monospace;
          }
          .faq-qa .answer a {
            color: ${T.accent};
            text-decoration: none;
            border-bottom: 1px dotted ${T.accent};
          }
          .faq-qa .answer strong { color: ${T.text}; }

          /* ── CTA ── */
          .faq-cta {
            background: linear-gradient(135deg, ${T.dark}, ${T.darker});
            color: white;
            padding: 80px 32px;
            text-align: center;
          }
          .faq-cta-inner { max-width: 720px; margin: 0 auto; }
          .faq-cta-eyebrow {
            font-size: 11px;
            letter-spacing: 4px;
            color: #8888aa;
            font-weight: bold;
            margin-bottom: 16px;
          }
          .faq-cta h2 {
            font-size: 42px;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: white;
            margin: 0 0 16px 0;
            line-height: 1.15;
          }
          .faq-cta p {
            font-size: 17px;
            line-height: 1.6;
            color: #c4c8d8;
            margin: 0 auto 32px;
            max-width: 520px;
          }
          .faq-cta-row {
            display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
          }
          .faq-btn-primary {
            padding: 16px 32px;
            background: linear-gradient(135deg, ${T.accent}, #2a6eff);
            color: white;
            font-size: 13px;
            letter-spacing: 2.5px;
            font-weight: bold;
            border-radius: 8px;
            text-decoration: none;
            display: inline-block;
            box-shadow: 0 0 24px rgba(74,158,255,0.4);
          }
          .faq-btn-secondary {
            padding: 16px 32px;
            background: transparent;
            color: white;
            border: 1px solid rgba(255,255,255,0.25);
            font-size: 13px;
            letter-spacing: 2.5px;
            font-weight: bold;
            border-radius: 8px;
            text-decoration: none;
            display: inline-block;
          }

          /* ── RESPONSIVE ── */
          @media (max-width: 768px) {
            .faq-hero { padding: 64px 20px 56px; }
            .faq-hero h1 { font-size: 36px; letter-spacing: -0.5px; }
            .faq-lead { font-size: 16px; }
            .faq-body { padding: 56px 20px; }
            .faq-featured { padding: 28px 24px; }
            .faq-featured h2 { font-size: 24px; }
            .faq-section-h2 { font-size: 28px; }
            .faq-explainers-grid { grid-template-columns: 1fr 1fr; }
            .faq-cta { padding: 56px 20px; }
            .faq-cta h2 { font-size: 30px; }
            .faq-btn-primary, .faq-btn-secondary { width: 100%; box-sizing: border-box; text-align: center; }
          }
          @media (max-width: 480px) {
            .faq-explainers-grid { grid-template-columns: 1fr; }
          }
        `}</style>

        <div className="faq-root">

          {/* ── HERO ── */}
          <section className="faq-hero">
            <div className="faq-hero-inner">
              <div className="faq-eyebrow">FREQUENTLY ASKED QUESTIONS</div>
              <h1>
                The questions buyers<br />
                <span className="accent">actually ask.</span>
              </h1>
              <p className="faq-lead">
                Pricing, contracts, compliance, team setup, and the bigger question
                of why we built DialerSeat in the first place — answered honestly.
              </p>
            </div>
          </section>

          {/* ── BODY ── */}
          <div className="faq-body">

            {/* FEATURED CARD */}
            <Link href="/faq/why-dialerseat" className="faq-featured">
              <div className="faq-featured-eyebrow">THE BIG ONE</div>
              <h2>Why DialerSeat?</h2>
              <p>
                The full answer — why this product exists, who builds it, how we ship,
                what makes us different from the entrenched names in the space, and
                where we&apos;re going next.
              </p>
              <span className="faq-featured-cta">
                READ THE FULL STORY →
              </span>
            </Link>

            {/* QUICK EXPLAINERS */}
            <div className="faq-explainers">
              <div className="faq-section-eyebrow">▸ QUICK EXPLAINERS</div>
              <h2 className="faq-section-h2">Plain-English answers to the big topics.</h2>
              <p className="faq-section-lede">
                Every major feature, concept, and policy — each on its own dedicated page
                so you can link directly to what you need.
              </p>
              <div className="faq-explainers-grid">
                <Link href="/faq/what-is-a-preview-dialer" className="faq-exp-card preview">
                  <span className="pill">PREVIEW</span>
                  <div className="card-title">What is a preview dialer?</div>
                  <div className="read-more">READ MORE →</div>
                </Link>
                <Link href="/faq/what-is-a-power-dialer" className="faq-exp-card power">
                  <span className="pill">POWER</span>
                  <div className="card-title">What is a power dialer?</div>
                  <div className="read-more">READ MORE →</div>
                </Link>
                <Link href="/faq/what-is-a-progressive-dialer" className="faq-exp-card progressive">
                  <span className="pill">PROGRESSIVE</span>
                  <div className="card-title">What is a progressive dialer?</div>
                  <div className="read-more">READ MORE →</div>
                </Link>
                <Link href="/faq/what-is-a-predictive-dialer" className="faq-exp-card predictive">
                  <span className="pill">PREDICTIVE</span>
                  <div className="card-title">What is a predictive dialer?</div>
                  <div className="read-more">READ MORE →</div>
                </Link>
                <Link href="/faq/why-is-compliance-important" className="faq-exp-card compliance">
                  <span className="pill">COMPLIANCE · WHY</span>
                  <div className="card-title">Why is compliance important?</div>
                  <div className="read-more">READ MORE →</div>
                </Link>
                <Link href="/faq/how-we-keep-compliance" className="faq-exp-card compliance">
                  <span className="pill">COMPLIANCE · HOW</span>
                  <div className="card-title">How we keep compliance.</div>
                  <div className="read-more">READ MORE →</div>
                </Link>
                <Link href="/faq/how-does-amd-work" className="faq-exp-card amd">
                  <span className="pill">AMD</span>
                  <div className="card-title">How does AMD work?</div>
                  <div className="read-more">READ MORE →</div>
                </Link>
                <Link href="/faq/why-we-charge" className="faq-exp-card pricing">
                  <span className="pill">PRICING</span>
                  <div className="card-title">Why we charge what we charge.</div>
                  <div className="read-more">READ MORE →</div>
                </Link>
                <Link href="/faq/dialerseat-teams" className="faq-exp-card teams">
                  <span className="pill">TEAMS</span>
                  <div className="card-title">DialerSeat for teams.</div>
                  <div className="read-more">READ MORE →</div>
                </Link>
                <Link href="/faq/manager-plus" className="faq-exp-card managerplus">
                  <span className="pill">MANAGER+</span>
                  <div className="card-title">What Manager+ adds over Pro.</div>
                  <div className="read-more">READ MORE →</div>
                </Link>
                <Link href="/faq/mobile" className="faq-exp-card mobile">
                  <span className="pill">MOBILE</span>
                  <div className="card-title">DialerSeat on mobile — install the PWA.</div>
                  <div className="read-more">READ MORE →</div>
                </Link>
                <Link href="/faq/numbers" className="faq-exp-card numbers">
                  <span className="pill">NUMBERS</span>
                  <div className="card-title">Caller ID, attestation, avoiding spam flags.</div>
                  <div className="read-more">READ MORE →</div>
                </Link>
                <Link href="/faq/leads" className="faq-exp-card leads">
                  <span className="pill">LEADS</span>
                  <div className="card-title">Uploading &amp; managing your lead lists.</div>
                  <div className="read-more">READ MORE →</div>
                </Link>
                <Link href="/faq/campaigns" className="faq-exp-card campaigns">
                  <span className="pill">CAMPAIGNS</span>
                  <div className="card-title">Mode, AMD, voicemail drop — campaign setup.</div>
                  <div className="read-more">READ MORE →</div>
                </Link>
                <Link href="/faq/scripts" className="faq-exp-card scripts">
                  <span className="pill">SCRIPTS</span>
                  <div className="card-title">Call scripts — write, attach, reorder.</div>
                  <div className="read-more">READ MORE →</div>
                </Link>
                <Link href="/faq/compliance-export" className="faq-exp-card compliance-export">
                  <span className="pill">COMPLIANCE EXPORT</span>
                  <div className="card-title">Prove it, don&apos;t just claim it.</div>
                  <div className="read-more">READ MORE →</div>
                </Link>
                <Link href="/faq/billing" className="faq-exp-card billing">
                  <span className="pill">BILLING</span>
                  <div className="card-title">What cancel, failed cards, and seats actually do.</div>
                  <div className="read-more">READ MORE →</div>
                </Link>
                <Link href="/faq/data-and-recordings" className="faq-exp-card data">
                  <span className="pill">DATA</span>
                  <div className="card-title">Recordings, full export, account deletion.</div>
                  <div className="read-more">READ MORE →</div>
                </Link>
              </div>
            </div>

            {/* COMMON Q&A */}
            <div className="faq-qa-section">
              <div className="faq-section-eyebrow">▸ EVERYTHING ELSE</div>
              <h2 className="faq-section-h2">Common questions.</h2>
              <p className="faq-section-lede">
                The questions that come up most often — answered directly, without the runaround.
              </p>

              <div className="faq-qa">
                <details>
                  <summary>How much does DialerSeat cost?</summary>
                  <div className="answer">
                    <p>
                      $35 per week per seat on Pro. That&apos;s the entire price for a dialing
                      agent. No setup fee, no per-call surcharge, no tier upcharges, no add-on
                      modules, no annual minimum, no &quot;contact sales for pricing.&quot;
                      Billing is weekly through Stripe.
                    </p>
                    <p>
                      Every seat includes unlimited dial-out numbers, multiple inbound numbers,
                      all four dialer modes, call recording, voicemail detection, and analytics —
                      no metered minutes, no per-number fees. See{' '}
                      <Link href="/faq/why-we-charge">why we charge what we charge</Link> for
                      the full breakdown vs. competitors who stack add-ons.
                    </p>
                    <p>
                      Want to own a team, resell seats, or white-label the whole platform?
                      That&apos;s <strong>Manager+</strong> at $75/week instead of the standard
                      $35 — see <Link href="/faq/manager-plus">what Manager+ adds</Link> for
                      the full breakdown.
                    </p>
                  </div>
                </details>

                <details>
                  <summary>Do I have to sign a contract?</summary>
                  <div className="answer">
                    <p>
                      No. There&apos;s no contract and no minimum term. You pay for the current
                      week of service and cancel whenever you want. We don&apos;t lock anyone
                      into anything.
                    </p>
                  </div>
                </details>

                <details>
                  <summary>Can I cancel anytime?</summary>
                  <div className="answer">
                    <p>
                      Yes. Cancel from your billing page in two clicks. Your subscription ends
                      at the close of the current weekly cycle — you keep access through what
                      you&apos;ve paid for, then it stops billing. Your leads, recordings, and
                      campaigns remain accessible if you want to come back.
                    </p>
                    <p>
                      See <Link href="/faq/billing">billing &amp; cancellation</Link> for what
                      a failed card actually does and how mid-week seat changes are billed.
                    </p>
                  </div>
                </details>

                <details>
                  <summary>Which dialing modes do you support?</summary>
                  <div className="answer">
                    <p>
                      All four: preview, power, progressive, and predictive. Each is available
                      on every account at every tier — we don&apos;t gate dialing modes behind
                      upgrades. Full breakdown on the{' '}
                      <Link href="/dialing-modes">dialing modes page</Link>.
                    </p>
                  </div>
                </details>

                <details>
                  <summary>How do I upload leads?</summary>
                  <div className="answer">
                    <p>
                      Drop in a spreadsheet — there&apos;s no template to match or import wizard
                      to click through. Column headers like <code>phone</code>,{' '}
                      <code>first_name</code>, <code>email</code>, and <code>state</code> get
                      auto-detected regardless of exact capitalization, and the only hard
                      requirement is a column with something that has at least 10 digits in it
                      once you strip out formatting.
                    </p>
                    <p>
                      See <Link href="/faq/leads">uploading &amp; managing leads</Link> for the
                      full field reference, optional consent columns, and how the 3-attempt retry
                      cycle works once leads are in a campaign.
                    </p>
                  </div>
                </details>

                <details>
                  <summary>Can I write my own call scripts?</summary>
                  <div className="answer">
                    <p>
                      Yes — write as many as you want, attach them to whichever campaigns need
                      them, and reorder which one shows first if a campaign has several. Personal
                      scripts are yours alone; a Manager+ team owner can also publish a script
                      the whole team sees.
                    </p>
                    <p>
                      See <Link href="/faq/scripts">call scripts</Link> for how attaching and
                      reordering actually works.
                    </p>
                  </div>
                </details>

                <details>
                  <summary>How do I set up a campaign?</summary>
                  <div className="answer">
                    <p>
                      Create it, name it or don&apos;t, pick a dialer mode (defaults to power),
                      and it&apos;s active immediately — no setup wizard, no required fields
                      beyond that. AMD, predictive pacing, and voicemail drop are all optional
                      settings with sane defaults.
                    </p>
                    <p>
                      See <Link href="/faq/campaigns">setting up a campaign</Link> for the
                      complete settings reference.
                    </p>
                  </div>
                </details>

                <details>
                  <summary>How does DialerSeat handle TCPA compliance?</summary>
                  <div className="answer">
                    <p>
                      The dialer enforces the federal calling-time window (8 AM–9 PM in the
                      lead&apos;s local time zone) on every outbound call. Predictive mode
                      applies the FTC TSR safe-harbor conditions in software — 3% abandon-rate
                      cap, auto-degrade at 2.5% to leave a safety buffer, AMD pre-screen,
                      ring-duration handling.
                    </p>
                    <p>
                      National DNC list scrubbing and consent records remain the seller&apos;s
                      responsibility — we don&apos;t scrub your list against the registry for
                      you today. We&apos;re transparent about which compliance layers we own and
                      which fall on the campaign owner on the{' '}
                      <Link href="/faq/how-we-keep-compliance">how we keep compliance page</Link>.
                    </p>
                  </div>
                </details>

                <details>
                  <summary>How do you keep numbers from getting flagged as spam?</summary>
                  <div className="answer">
                    <p>
                      Every outbound number carries STIR/SHAKEN A-attestation, is registered
                      for CNAM and the Free Caller Registry, and dials with local presence by
                      default — the carrier-level protections that most dialers sell as separate
                      add-ons are just the default here. The number pool also rotates and cools
                      down instead of hammering one number until it burns.
                    </p>
                    <p>
                      See <Link href="/faq/numbers">phone numbers &amp; caller ID</Link> for the
                      full breakdown — including what&apos;s still on you (list quality, abandon
                      rate, DNC scrubbing) since no infrastructure makes a number permanently
                      immune to flagging.
                    </p>
                  </div>
                </details>

                <details>
                  <summary>Can I export a compliance record for a campaign?</summary>
                  <div className="answer">
                    <p>
                      Yes — any campaign owner can pull a downloadable CSV for any date range:
                      AMD result, abandon flag, disposition, and duration, one row per call,
                      with the lead&apos;s phone number masked by default. It&apos;s the actual
                      receipt behind the compliance claims, not just a dashboard summary.
                    </p>
                    <p>
                      See <Link href="/faq/compliance-export">compliance export</Link> for the
                      full column reference and when people actually pull one.
                    </p>
                  </div>
                </details>

                <details>
                  <summary>Can I record calls?</summary>
                  <div className="answer">
                    <p>
                      Yes. Recordings are captured server-side, stored encrypted, and accessible
                      from your dashboard for 30 days. Pull them down for review, training, or
                      your own long-term archive during that window — call metadata (dial
                      timestamps, dispositions, AMD results) is kept separately for 24 months to
                      meet the TSR&apos;s record-keeping floor, but the audio itself follows the
                      30-day retention window.
                    </p>
                  </div>
                </details>

                <details>
                  <summary>Do you have a team plan?</summary>
                  <div className="answer">
                    <p>
                      Yes — <strong>Manager+</strong>, at $75/week. It&apos;s what the team
                      owner pays to create and own a team; each individual seat inside the team
                      still runs $35/week, regardless of team size. You can configure it so the
                      owner pays for the whole team&apos;s seats, or so individual agents pay
                      for their own access. Both flows are supported.
                    </p>
                    <p>
                      See <Link href="/faq/dialerseat-teams">DialerSeat for teams</Link> for the
                      full breakdown: owner-paid vs. agent-paid mechanics, shared campaigns,
                      team-mode predictive routing, and how seat cancellations work.
                    </p>
                  </div>
                </details>

                <details>
                  <summary>Can my team share campaigns?</summary>
                  <div className="answer">
                    <p>
                      Yes. Team owners can grant campaign access to team members. In team-mode
                      predictive dialing, the system routes connected humans across all agents
                      working the same campaign — when an agent disconnects, the routed human
                      reroutes to another available agent on the same campaign rather than
                      dropping.
                    </p>
                  </div>
                </details>

                <details>
                  <summary>Do you offer a white-label option?</summary>
                  <div className="answer">
                    <p>
                      Yes — it&apos;s bundled into <strong>Manager+</strong> at $75/week,
                      replacing your $35/week Pro subscription rather than stacking on top of
                      it. Includes a custom subdomain, your branding (logo, colors, favicon),
                      and the ability to onboard your own users under your brand. The underlying
                      dialer is the same one we run. See{' '}
                      <Link href="/faq/white-label">white-label</Link> for the branding details,
                      or <Link href="/faq/manager-plus">the Manager+ breakdown</Link> for the
                      full tier — team ownership, advanced analytics, and priority support
                      included.
                    </p>
                  </div>
                </details>

                <details>
                  <summary>Is there a mobile app?</summary>
                  <div className="answer">
                    <p>
                      Yes — DialerSeat installs to your phone&apos;s home screen as a
                      Progressive Web App (PWA): the same dialer terminal, analytics, and teams
                      tools as desktop, full-screen, with no App Store download required. We
                      strongly recommend installing it rather than dialing from a regular browser
                      tab if you&apos;re working from your phone at all. See{' '}
                      <Link href="/faq/mobile">DialerSeat on mobile</Link> for install steps on
                      iPhone and Android, or{' '}
                      <Link href="/faq/white-label-mobile">white-label on mobile</Link> if your
                      account is branded.
                    </p>
                  </div>
                </details>

                <details>
                  <summary>Where is my data hosted?</summary>
                  <div className="answer">
                    <p>
                      Application data sits on Supabase (US region). Recordings are stored
                      encrypted. Payments are handled by Stripe — DialerSeat never sees or
                      stores credit card numbers. Telephony runs through Telnyx with full
                      STIR/SHAKEN attestation.
                    </p>
                    <p>
                      You can export everything in your account as a single JSON file, or
                      permanently delete your account, both self-serve from settings. See{' '}
                      <Link href="/faq/data-and-recordings">recordings &amp; your data</Link>{' '}
                      for exactly what&apos;s included in each and how deletion is protected
                      against accidental use.
                    </p>
                  </div>
                </details>

                <details>
                  <summary>Will the $35/week price change?</summary>
                  <div className="answer">
                    <p>
                      We have no plans to raise it. If we ever needed to, existing customers
                      would be grandfathered at the rate they signed up at. The price
                      you&apos;re looking at today is the price you&apos;ll keep paying.
                    </p>
                  </div>
                </details>
              </div>
            </div>

          </div>

          {/* ── CTA ── */}
          <section className="faq-cta">
            <div className="faq-cta-inner">
              <div className="faq-cta-eyebrow">
                {showSignedIn ? '▸ READY TO DIAL' : '▸ STILL HAVE QUESTIONS?'}
              </div>
              {showSignedIn ? (
                <>
                  <h2>Hop back in.</h2>
                  <p>The terminal&apos;s waiting.</p>
                  <div className="faq-cta-row">
                    <Link href="/dashboard/dialer" className="faq-btn-primary">
                      OPEN DIALER →
                    </Link>
                    <Link href="/dialing-modes" className="faq-btn-secondary">
                      DIALING MODES
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h2>The best way to find out is to use it.</h2>
                  <p>
                    $35 for a week. No contract. Cancel any time. Your data stays yours.
                  </p>
                  <div className="faq-cta-row">
                    <Link href="/sign-up" className="faq-btn-primary">
                      START DIALING →
                    </Link>
                    <Link href="/faq/why-dialerseat" className="faq-btn-secondary">
                      WHY DIALERSEAT?
                    </Link>
                  </div>
                </>
              )}
            </div>
          </section>

        </div>
      </main>
      <SiteFooter />
    </>
  )
}
