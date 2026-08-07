'use client'

import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'

const T = {
  bg: '#0a0a14',
  surface: '#1a1a2e',
  border: '#2a2a4a',
  dark: '#1a1a2e',
  darker: '#0a0a14',
  text: '#ffffff',
  muted: '#8888aa',
  accent: '#2a4a8a',
  blue: '#4a9eff',
}

const FUTURA = `'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif`

export default function FaqView() {
  const { isLoaded, isSignedIn } = useUser()
  const showSignedIn = isLoaded && isSignedIn

  return (
    <>
      <SiteHeader />
      <main style={{
        background: T.bg,
        minHeight: '100vh',
        fontFamily: FUTURA,
        color: T.text,
      }}>
        <style>{`
          .faq-root * { box-sizing: border-box; }

          /* ── HERO ── */
          .faq-hero {
            background: linear-gradient(135deg, ${T.darker} 0%, ${T.dark} 100%);
            color: white;
            padding: 80px 32px 64px;
            text-align: center;
            position: relative;
            overflow: hidden;
            border-bottom: 2px solid ${T.accent};
          }
          .faq-hero-inner {
            position: relative;
            max-width: 720px;
            margin: 0 auto;
          }
          .faq-eyebrow {
            display: inline-block;
            padding: 6px 14px;
            background: rgba(74,158,255,0.15);
            border: 1px solid ${T.blue};
            border-radius: 4px;
            color: ${T.blue};
            font-size: 11px;
            letter-spacing: 3px;
            font-weight: bold;
            margin-bottom: 22px;
          }
          .faq-hero h1 {
            font-size: 44px;
            font-weight: 800;
            letter-spacing: -0.5px;
            line-height: 1.1;
            margin: 0 0 16px 0;
          }
          .faq-lead {
            font-size: 16px;
            line-height: 1.6;
            color: #c4c8d8;
            max-width: 560px;
            margin: 0 auto;
          }

          /* ── BODY ── */
          .faq-body {
            max-width: 800px;
            margin: 0 auto;
            padding: 56px 32px 72px;
          }

          /* ── SECTION LABELS ── */
          .faq-section-label {
            font-size: 10px;
            letter-spacing: 4px;
            color: ${T.muted};
            font-weight: bold;
            margin-bottom: 14px;
          }
          .faq-section-title {
            font-size: 24px;
            font-weight: 800;
            letter-spacing: -0.3px;
            margin: 0 0 24px 0;
            color: ${T.text};
          }

          /* ── FEATURED CARD ── */
          .faq-featured {
            display: block;
            background: ${T.surface};
            border-radius: 4px;
            padding: 32px 36px;
            text-decoration: none;
            color: white;
            position: relative;
            overflow: hidden;
            margin-bottom: 48px;
            transition: transform 0.15s;
            border: 1px solid ${T.border};
            border-top: 3px solid ${T.blue};
          }
          .faq-featured:hover {
            transform: translateY(-2px);
            border-color: ${T.blue};
          }
          .faq-featured-eyebrow {
            position: relative;
            display: inline-block;
            padding: 4px 10px;
            background: rgba(74,158,255,0.15);
            border: 1px solid ${T.blue};
            border-radius: 4px;
            color: ${T.blue};
            font-size: 10px;
            letter-spacing: 3px;
            font-weight: bold;
            margin-bottom: 14px;
          }
          .faq-featured h2 {
            position: relative;
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -0.3px;
            line-height: 1.2;
            margin: 0 0 12px 0;
            color: white;
          }
          .faq-featured p {
            position: relative;
            font-size: 15px;
            line-height: 1.65;
            color: #c4c8d8;
            margin: 0 0 18px 0;
            max-width: 560px;
          }
          .faq-featured-cta {
            position: relative;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            letter-spacing: 2.5px;
            font-weight: bold;
            color: ${T.blue};
          }

          /* ── EXPLAINER GRID ── */
          .faq-explainers { margin-bottom: 44px; }
          .faq-explainers-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin-top: 18px;
          }
          .faq-exp-card {
            background: ${T.surface};
            border: 1px solid ${T.border};
            border-radius: 4px;
            padding: 16px 18px;
            text-decoration: none;
            color: ${T.text};
            display: flex;
            flex-direction: column;
            gap: 8px;
            transition: all 0.15s ease;
          }
          .faq-exp-card:hover {
            border-color: ${T.blue};
            transform: translateY(-2px);
          }
          .faq-exp-card .pill {
            display: inline-block;
            font-size: 9px;
            letter-spacing: 2px;
            font-weight: bold;
            padding: 2px 7px;
            border-radius: 3px;
            width: fit-content;
            border-top: 3px solid transparent;
          }
          .faq-exp-card .card-title {
            font-size: 13px;
            font-weight: 600;
            line-height: 1.4;
          }

          /* pill color variants from PALETTE.md status pills */
          .faq-exp-card.preview .pill   { background: #1a1a2e; color: #8888aa; border-top-color: #8888aa; }
          .faq-exp-card.power .pill     { background: rgba(74,158,255,0.1); color: ${T.blue}; border-top-color: ${T.blue}; }
          .faq-exp-card.progressive .pill { background: rgba(26,106,26,0.1); color: #4ade80; border-top-color: #4ade80; }
          .faq-exp-card.predictive .pill  { background: rgba(138,26,26,0.1); color: #f87171; border-top-color: #f87171; }
          .faq-exp-card.compliance .pill  { background: rgba(138,106,26,0.1); color: #fbbf24; border-top-color: #fbbf24; }
          .faq-exp-card.amd .pill         { background: rgba(74,158,255,0.1); color: ${T.blue}; border-top-color: ${T.blue}; }
          .faq-exp-card.pricing .pill     { background: rgba(26,106,26,0.1); color: #4ade80; border-top-color: #4ade80; }
          .faq-exp-card.teams .pill       { background: rgba(90,42,138,0.1); color: #a78bfa; border-top-color: #a78bfa; }
          .faq-exp-card.managerplus .pill { background: rgba(74,158,255,0.1); color: ${T.blue}; border-top-color: ${T.blue}; }
          .faq-exp-card.mobile .pill      { background: rgba(74,158,255,0.1); color: ${T.blue}; border-top-color: ${T.blue}; }
          .faq-exp-card.numbers .pill     { background: rgba(138,26,26,0.1); color: #f87171; border-top-color: #f87171; }
          .faq-exp-card.leads .pill       { background: rgba(26,106,74,0.1); color: #34d399; border-top-color: #34d399; }
          .faq-exp-card.scripts .pill     { background: rgba(74,74,168,0.1); color: #818cf8; border-top-color: #818cf8; }
          .faq-exp-card.campaigns .pill   { background: rgba(74,158,255,0.1); color: ${T.blue}; border-top-color: ${T.blue}; }
          .faq-exp-card.billing .pill     { background: rgba(26,106,26,0.1); color: #4ade80; border-top-color: #4ade80; }
          .faq-exp-card.compliance-export .pill { background: rgba(138,106,26,0.1); color: #fbbf24; border-top-color: #fbbf24; }
          .faq-exp-card.data .pill        { background: rgba(74,74,168,0.1); color: #818cf8; border-top-color: #818cf8; }

          /* ── ACCORDION ── */
          .faq-qa details {
            background: ${T.surface};
            border: 1px solid ${T.border};
            border-radius: 4px;
            margin-bottom: 10px;
            overflow: hidden;
            transition: border-color 0.12s;
          }
          .faq-qa details[open] {
            border-color: ${T.blue};
            border-top: 3px solid ${T.blue};
          }
          .faq-qa summary {
            padding: 18px 22px;
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
            color: ${T.blue};
            font-size: 22px;
            font-weight: bold;
            flex-shrink: 0;
            line-height: 1;
          }
          .faq-qa details[open] summary::after { content: '−'; }
          .faq-qa .answer {
            padding: 0 22px 20px;
            font-size: 14px;
            line-height: 1.75;
            color: ${T.muted};
          }
          .faq-qa .answer p { margin: 0 0 12px 0; }
          .faq-qa .answer p:last-child { margin-bottom: 0; }
          .faq-qa .answer code {
            background: ${T.bg};
            padding: 1px 6px;
            border-radius: 3px;
            font-size: 12.5px;
            font-family: monospace;
          }
          .faq-qa .answer a {
            color: ${T.blue};
            text-decoration: none;
            border-bottom: 1px dotted ${T.blue};
          }
          .faq-qa .answer strong { color: ${T.text}; }

          /* ── CTA ── */
          .faq-cta {
            background: ${T.dark};
            color: white;
            padding: 64px 32px;
            text-align: center;
            border-top: 2px solid ${T.accent};
          }
          .faq-cta-inner { max-width: 600px; margin: 0 auto; }
          .faq-cta-eyebrow {
            font-size: 11px;
            letter-spacing: 4px;
            color: #8888aa;
            font-weight: bold;
            margin-bottom: 12px;
          }
          .faq-cta h2 {
            font-size: 26px;
            font-weight: 800;
            letter-spacing: -0.3px;
            color: white;
            margin: 0 0 12px 0;
          }
          .faq-cta p {
            font-size: 15px;
            line-height: 1.7;
            color: #c0c2ca;
            margin: 0 auto 24px;
            max-width: 480px;
          }
          .faq-cta-row {
            display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
          }
          
          /* Landing page white outlined button style */
          .faq-btn-primary {
            padding: 14px 28px;
            background: white;
            border: none;
            border-top: 3px solid white;
            color: #1a1a2e;
            font-size: 12px;
            letter-spacing: 4px;
            font-weight: bold;
            text-decoration: none;
            display: inline-block;
            border-radius: 6px;
          }
          .faq-btn-secondary {
            padding: 14px 28px;
            background: transparent;
            color: white;
            border: 1px solid #c4c8d0;
            border-top: 3px solid white;
            font-size: 12px;
            letter-spacing: 4px;
            font-weight: bold;
            text-decoration: none;
            display: inline-block;
            border-radius: 6px;
          }

          /* ── EMAIL ── */
          .faq-support-prompt {
            font-size: 16px;
            color: ${T.muted};
            line-height: 1.65;
            max-width: 680px;
            margin: 0 auto 48px auto;
            text-align: center;
          }
          .faq-support-prompt a {
            color: ${T.blue};
            text-decoration: none;
          }

          /* ── RESPONSIVE ── */
          @media (max-width: 768px) {
            .faq-hero { padding: 56px 20px 44px; }
            .faq-hero h1 { font-size: 30px; }
            .faq-lead { font-size: 14px; }
            .faq-body { padding: 40px 20px 56px; }
            .faq-featured { padding: 24px; }
            .faq-featured h2 { font-size: 22px; }
            .faq-explainers-grid { grid-template-columns: 1fr; }
            .faq-cta { padding: 48px 20px; }
            .faq-cta h2 { font-size: 22px; }
            .faq-btn-primary, .faq-btn-secondary { width: 100%; box-sizing: border-box; text-align: center; }
          }
        `}</style>

        <div className="faq-root">

          {/* ── HERO ── */}
          <section className="faq-hero">
            <div className="faq-hero-inner">
              <div className="faq-eyebrow">FREQUENTLY ASKED QUESTIONS</div>
              <div style={{ fontSize: 12, color: '#8888aa', marginBottom: 16, letterSpacing: '2px' }}>LAST UPDATED 07/28/2026</div>
              <h1>The questions buyers actually ask.</h1>
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
              <div className="faq-section-label">▸ QUICK EXPLAINERS</div>
              <h2 className="faq-section-title">Plain-English answers to the big topics.</h2>
              
              <div className="faq-explainers-grid">
                <Link href="/faq/what-is-a-preview-dialer" className="faq-exp-card preview">
                  <span className="pill">PREVIEW</span>
                  <div className="card-title">What is a preview dialer?</div>
                </Link>
                <Link href="/faq/what-is-a-power-dialer" className="faq-exp-card power">
                  <span className="pill">POWER</span>
                  <div className="card-title">What is a power dialer?</div>
                </Link>
                <Link href="/faq/what-is-a-progressive-dialer" className="faq-exp-card progressive">
                  <span className="pill">PROGRESSIVE</span>
                  <div className="card-title">What is a progressive dialer?</div>
                </Link>
                <Link href="/faq/what-is-a-predictive-dialer" className="faq-exp-card predictive">
                  <span className="pill">PREDICTIVE</span>
                  <div className="card-title">What is a predictive dialer?</div>
                </Link>
                <Link href="/faq/why-is-compliance-important" className="faq-exp-card compliance">
                  <span className="pill">COMPLIANCE · WHY</span>
                  <div className="card-title">Why is compliance important?</div>
                </Link>
                <Link href="/faq/how-we-keep-compliance" className="faq-exp-card compliance">
                  <span className="pill">COMPLIANCE · HOW</span>
                  <div className="card-title">How we keep compliance.</div>
                </Link>
                <Link href="/faq/how-does-amd-work" className="faq-exp-card amd">
                  <span className="pill">AMD</span>
                  <div className="card-title">How does AMD work?</div>
                </Link>
                <Link href="/faq/why-we-charge" className="faq-exp-card pricing">
                  <span className="pill">PRICING</span>
                  <div className="card-title">Why we charge what we charge.</div>
                </Link>
                <Link href="/faq/dialerseat-teams" className="faq-exp-card teams">
                  <span className="pill">TEAMS</span>
                  <div className="card-title">DialerSeat for teams.</div>
                </Link>
                <Link href="/faq/manager-plus" className="faq-exp-card managerplus">
                  <span className="pill">MANAGER+</span>
                  <div className="card-title">What Manager+ adds over Pro.</div>
                </Link>
                <Link href="/faq/mobile" className="faq-exp-card mobile">
                  <span className="pill">MOBILE</span>
                  <div className="card-title">DialerSeat on mobile — install the PWA.</div>
                </Link>
                <Link href="/faq/numbers" className="faq-exp-card numbers">
                  <span className="pill">NUMBERS</span>
                  <div className="card-title">Caller ID, attestation, avoiding spam flags.</div>
                </Link>
                <Link href="/faq/leads" className="faq-exp-card leads">
                  <span className="pill">LEADS</span>
                  <div className="card-title">Uploading &amp; managing your lead lists.</div>
                </Link>
                <Link href="/faq/campaigns" className="faq-exp-card campaigns">
                  <span className="pill">CAMPAIGNS</span>
                  <div className="card-title">Mode, AMD, predictive pacing — campaign setup.</div>
                </Link>
                <Link href="/faq/scripts" className="faq-exp-card scripts">
                  <span className="pill">SCRIPTS</span>
                  <div className="card-title">Call scripts — write, attach, reorder.</div>
                </Link>
                <Link href="/faq/compliance-export" className="faq-exp-card compliance-export">
                  <span className="pill">COMPLIANCE EXPORT</span>
                  <div className="card-title">Prove it, don&apos;t just claim it.</div>
                </Link>
                <Link href="/faq/billing" className="faq-exp-card billing">
                  <span className="pill">BILLING</span>
                  <div className="card-title">What cancel, failed cards, and seats actually do.</div>
                </Link>
                <Link href="/faq/data-and-recordings" className="faq-exp-card data">
                  <span className="pill">DATA</span>
                  <div className="card-title">Recordings, full export, account deletion.</div>
                </Link>
              </div>
            </div>

            {/* COMMON Q&A */}
            <div className="faq-qa-section">
              <div className="faq-section-label">▸ EVERYTHING ELSE</div>
              <h2 className="faq-section-title">Common questions.</h2>
              
              <p className="faq-support-prompt">
                Have a question that isn&apos;t listed? Email{' '}
                <a href="mailto:support@dialerseat.com">support@dialerseat.com</a>
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
                      beyond that. AMD and predictive pacing are both optional
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
                    <Link href="/dashboard/analytics" className="faq-btn-primary">
                      GO TO DASHBOARD →
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
                      GET STARTED →
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
