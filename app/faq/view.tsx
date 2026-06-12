'use client'

// =============================================================================
// /faq — FAQ index page (Push E corrected: original order, new tiles at end)
// =============================================================================
// Push E correction vs the previous Push E build:
//   - Explainer tiles restored to ORIGINAL order: preview, power,
//     progressive, predictive, compliance·why, compliance·how, amd.
//     PRICING and TEAMS appended as the LAST two tiles, not the first two.
//   - Accordion link-outs from cost and team questions preserved — those
//     help users find the new deep-dive pages from inside the existing
//     accordion flow.
//
// Structure unchanged from original:
//   1. Hero (slim)
//   2. Featured "Why DialerSeat?" card → /faq/why-dialerseat
//   3. Quick explainers grid (9 tiles, original order + 2 appended)
//   4. Common Q&A accordion
//   5. Auth-aware bottom CTA
// =============================================================================

import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'

const T = {
  bg: '#f0f1f4',
  surface: '#ffffff',
  border: '#c4c8d0',
  dark: '#1a1a2e',
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

          /* HERO (slim — this is an index page, not a marketing landing) */
          .faq-hero {
            background: linear-gradient(135deg, #0a0a14 0%, #1a1a2e 100%);
            color: white;
            padding: 80px 32px 64px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .faq-hero::before {
            content: '';
            position: absolute; inset: 0;
            background: radial-gradient(circle at 30% 30%, rgba(74,158,255,0.15) 0%, transparent 55%);
          }
          .faq-hero-inner { position: relative; max-width: 720px; margin: 0 auto; }
          .faq-eyebrow {
            display: inline-block;
            padding: 6px 14px;
            background: rgba(74,158,255,0.15);
            border: 1px solid #4a9eff;
            border-radius: 4px;
            color: #4a9eff;
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

          /* BODY */
          .faq-body {
            max-width: 800px;
            margin: 0 auto;
            padding: 56px 32px 72px;
          }

          /* FEATURED CARD — "Why DialerSeat?" */
          .faq-featured {
            display: block;
            background: linear-gradient(135deg, ${T.dark} 0%, #2a2c44 100%);
            border-radius: 14px;
            padding: 32px 36px;
            text-decoration: none;
            color: white;
            position: relative;
            overflow: hidden;
            margin-bottom: 48px;
            transition: transform 0.15s, box-shadow 0.15s;
            border: 1px solid rgba(255,255,255,0.05);
          }
          .faq-featured:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 32px rgba(0,0,0,0.18);
            border-color: ${T.accent};
          }
          .faq-featured::before {
            content: '';
            position: absolute; right: -40px; top: -40px;
            width: 200px; height: 200px;
            background: radial-gradient(circle, rgba(74,158,255,0.25) 0%, transparent 70%);
            pointer-events: none;
          }
          .faq-featured-eyebrow {
            position: relative;
            display: inline-block;
            padding: 4px 10px;
            background: rgba(74,158,255,0.15);
            border: 1px solid #4a9eff;
            border-radius: 4px;
            color: #4a9eff;
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
            color: ${T.accent};
          }

          /* SECTION LABEL */
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

          /* ACCORDION */
          .faq-qa details {
            background: white;
            border: 1px solid ${T.border};
            border-radius: 8px;
            margin-bottom: 10px;
            overflow: hidden;
            transition: border-color 0.12s;
          }
          .faq-qa details[open] {
            border-color: ${T.accent};
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
            color: ${T.accent};
            font-size: 22px;
            font-weight: bold;
            flex-shrink: 0;
            line-height: 1;
          }
          .faq-qa details[open] summary::after {
            content: '−';
          }
          .faq-qa .answer {
            padding: 0 22px 20px;
            font-size: 14px;
            line-height: 1.75;
            color: ${T.text};
          }
          .faq-qa .answer p { margin: 0 0 12px 0; }
          .faq-qa .answer p:last-child { margin-bottom: 0; }
          .faq-qa .answer a {
            color: ${T.accent};
            text-decoration: none;
            border-bottom: 1px dotted ${T.accent};
          }

          /* CTA */
          .faq-cta {
            background: ${T.dark};
            color: white;
            padding: 64px 32px;
            text-align: center;
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
          .faq-btn-primary {
            padding: 14px 28px;
            background: linear-gradient(135deg, #4a9eff, #2a6eff);
            color: white;
            font-size: 12px;
            letter-spacing: 2.5px;
            font-weight: bold;
            border-radius: 8px;
            text-decoration: none;
            box-shadow: 0 0 20px rgba(74,158,255,0.3);
          }
          .faq-btn-secondary {
            padding: 14px 28px;
            background: transparent;
            color: white;
            border: 1px solid rgba(255,255,255,0.25);
            font-size: 12px;
            letter-spacing: 2.5px;
            font-weight: bold;
            border-radius: 8px;
            text-decoration: none;
          }

          /* QUICK EXPLAINERS GRID */
          .faq-explainers {
            margin: 8px 0 44px;
          }
          .faq-explainers-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin-top: 18px;
          }
          .faq-exp-card {
            padding: 16px 18px;
            background: white;
            border: 1px solid #d8dce4;
            border-radius: 8px;
            text-decoration: none;
            color: ${T.text};
            font-size: 13px;
            line-height: 1.4;
            font-weight: 600;
            transition: transform 0.12s, border-color 0.12s;
          }
          .faq-exp-card:hover {
            transform: translateY(-2px);
            border-color: ${T.accent};
          }
          .faq-exp-card .pill {
            display: inline-block;
            font-size: 9px;
            letter-spacing: 2px;
            font-weight: bold;
            padding: 2px 7px;
            border-radius: 3px;
            margin-bottom: 6px;
          }
          .faq-exp-card.preview .pill { background: #f0f0f4; color: #5a5e6a; border: 1px solid #5a5e6a; }
          .faq-exp-card.power .pill { background: #e8eef8; color: #2a4a8a; border: 1px solid #2a4a8a; }
          .faq-exp-card.progressive .pill { background: #e8f5e8; color: #1a6a1a; border: 1px solid #1a6a1a; }
          .faq-exp-card.predictive .pill { background: #f8e8e8; color: #8a1a1a; border: 1px solid #8a1a1a; }
          .faq-exp-card.compliance .pill { background: #fdf4e8; color: #8a6a1a; border: 1px solid #8a6a1a; }
          .faq-exp-card.amd .pill { background: #e8eef8; color: #2a4a8a; border: 1px solid #2a4a8a; }
          .faq-exp-card.pricing .pill { background: #e8f5e8; color: #1a6a1a; border: 1px solid #1a6a1a; }
          .faq-exp-card.teams .pill { background: #f0eafd; color: #5a2a8a; border: 1px solid #5a2a8a; }

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
            .faq-btn-primary, .faq-btn-secondary { width: 100%; box-sizing: border-box; }
          }
        `}</style>

        <div className="faq-root">

          {/* HERO */}
          <section className="faq-hero">
            <div className="faq-hero-inner">
              <div className="faq-eyebrow">FREQUENTLY ASKED QUESTIONS</div>
              <h1>The questions buyers actually ask.</h1>
              <p className="faq-lead">
                Pricing, contracts, compliance, team setup, and the
                bigger question of why we built DialerSeat in the first
                place — answered honestly.
              </p>
            </div>
          </section>

          {/* BODY */}
          <div className="faq-body">

            {/* FEATURED CARD → /faq/why-dialerseat */}
            <Link href="/faq/why-dialerseat" className="faq-featured">
              <div className="faq-featured-eyebrow">THE BIG ONE</div>
              <h2>Why DialerSeat?</h2>
              <p>
                The full answer — why this product exists, who builds it,
                how we ship, what makes us different from the entrenched
                names in the space, and where we&apos;re going next.
              </p>
              <span className="faq-featured-cta">
                READ THE FULL STORY <span>→</span>
              </span>
            </Link>

            {/* QUICK EXPLAINERS — original order preserved, PRICING and TEAMS appended at end */}
            <div className="faq-explainers">
              <div className="faq-section-label">▸ QUICK EXPLAINERS</div>
              <h2 className="faq-section-title">Plain-English answers to the big topics.</h2>
              <div className="faq-explainers-grid">
                <Link href="/faq/what-is-a-preview-dialer" className="faq-exp-card preview">
                  <span className="pill">PREVIEW</span>
                  <div>What is a preview dialer?</div>
                </Link>
                <Link href="/faq/what-is-a-power-dialer" className="faq-exp-card power">
                  <span className="pill">POWER</span>
                  <div>What is a power dialer?</div>
                </Link>
                <Link href="/faq/what-is-a-progressive-dialer" className="faq-exp-card progressive">
                  <span className="pill">PROGRESSIVE</span>
                  <div>What is a progressive dialer?</div>
                </Link>
                <Link href="/faq/what-is-a-predictive-dialer" className="faq-exp-card predictive">
                  <span className="pill">PREDICTIVE</span>
                  <div>What is a predictive dialer?</div>
                </Link>
                <Link href="/faq/why-is-compliance-important" className="faq-exp-card compliance">
                  <span className="pill">COMPLIANCE · WHY</span>
                  <div>Why is compliance important?</div>
                </Link>
                <Link href="/faq/how-we-keep-compliance" className="faq-exp-card compliance">
                  <span className="pill">COMPLIANCE · HOW</span>
                  <div>How we keep compliance.</div>
                </Link>
                <Link href="/faq/how-does-amd-work" className="faq-exp-card amd">
                  <span className="pill">AMD</span>
                  <div>How does AMD work?</div>
                </Link>
                <Link href="/faq/why-we-charge" className="faq-exp-card pricing">
                  <span className="pill">PRICING</span>
                  <div>Why we charge what we charge.</div>
                </Link>
                <Link href="/faq/dialerseat-teams" className="faq-exp-card teams">
                  <span className="pill">TEAMS</span>
                  <div>DialerSeat for teams.</div>
                </Link>
              </div>
            </div>

            {/* COMMON Q&A */}
            <div className="faq-section-label">▸ EVERYTHING ELSE</div>
            <h2 className="faq-section-title">Common questions.</h2>

            <div className="faq-qa">
              <details>
                <summary>How much does DialerSeat cost?</summary>
                <div className="answer">
                  <p>
                    $35 per week per seat. That&apos;s the entire price.
                    No setup fee, no per-call surcharge, no tier upcharges,
                    no add-on modules, no annual minimum, no &quot;contact
                    sales for pricing.&quot; Billing is weekly through
                    Stripe.
                  </p>
                  <p>
                    Every seat includes unlimited dial-out numbers,
                    multiple inbound numbers, all four dialer modes, call
                    recording, voicemail detection, and analytics — no
                    metered minutes, no per-number fees. See{' '}
                    <Link href="/faq/why-we-charge">why we charge what we
                    charge</Link> for the full breakdown vs. competitors
                    who stack add-ons.
                  </p>
                </div>
              </details>

              <details>
                <summary>Do I have to sign a contract?</summary>
                <div className="answer">
                  <p>
                    No. There&apos;s no contract and no minimum term. You
                    pay for the current week of service and cancel whenever
                    you want. We don&apos;t lock anyone into anything.
                  </p>
                </div>
              </details>

              <details>
                <summary>Can I cancel anytime?</summary>
                <div className="answer">
                  <p>
                    Yes. Cancel from your billing page in two clicks. Your
                    subscription ends at the close of the current weekly
                    cycle — you keep access through what you&apos;ve paid
                    for, then it stops billing. Your leads, recordings, and
                    campaigns remain accessible if you want to come back.
                  </p>
                </div>
              </details>

              <details>
                <summary>Which dialing modes do you support?</summary>
                <div className="answer">
                  <p>
                    All four: preview, power, progressive, and predictive.
                    Each is available on every account at every tier — we
                    don&apos;t gate dialing modes behind upgrades. Full
                    breakdown on the <Link href="/dialing-modes">dialing
                    modes page</Link>.
                  </p>
                </div>
              </details>

              <details>
                <summary>How does DialerSeat handle TCPA compliance?</summary>
                <div className="answer">
                  <p>
                    The dialer enforces the federal calling-time window
                    (8 AM–9 PM in the lead&apos;s local time zone) on every
                    outbound call. Predictive mode applies the FTC TSR
                    safe-harbor conditions in software — 3% abandon-rate
                    cap, auto-degrade at 2.5% to leave a safety buffer,
                    AMD pre-screen, ring-duration handling.
                  </p>
                  <p>
                    DNC list scrubbing and consent records remain the
                    seller&apos;s responsibility — we&apos;re transparent
                    about which compliance layers we own and which fall on
                    the campaign owner on the <Link href="/dialing-modes">
                    dialing modes page</Link>.
                  </p>
                </div>
              </details>

              <details>
                <summary>Can I record calls?</summary>
                <div className="answer">
                  <p>
                    Yes. Recordings are captured server-side, stored
                    encrypted, and accessible from your dashboard. Pulling
                    them down for review, training, or compliance archives
                    is straightforward.
                  </p>
                </div>
              </details>

              <details>
                <summary>Do you have a team plan?</summary>
                <div className="answer">
                  <p>
                    Yes. Each seat is $35/week regardless of team size.
                    Team owners can pay for the whole team&apos;s seats,
                    or you can configure it so individual agents pay for
                    their own access. Both flows are supported.
                  </p>
                  <p>
                    See <Link href="/faq/dialerseat-teams">DialerSeat for
                    teams</Link> for the full breakdown: owner-paid vs.
                    agent-paid mechanics, shared campaigns, team-mode
                    predictive routing, and how seat cancellations work.
                  </p>
                </div>
              </details>

              <details>
                <summary>Can my team share campaigns?</summary>
                <div className="answer">
                  <p>
                    Yes. Team owners can grant campaign access to team
                    members. Team-mode predictive routes humans across the
                    whole team — when an agent disconnects, the routed
                    human reroutes to another available agent on the same
                    campaign rather than dropping.
                  </p>
                </div>
              </details>

              <details>
                <summary>Do you offer a white-label option?</summary>
                <div className="answer">
                  <p>
                    Yes — $115/week. Includes a custom subdomain, your
                    branding (logo, colors, favicon), and the ability to
                    onboard your own users under your brand. The
                    underlying dialer is the same one we run.
                  </p>
                </div>
              </details>

              <details>
                <summary>Where is my data hosted?</summary>
                <div className="answer">
                  <p>
                    Application data sits on Supabase (US region).
                    Recordings are stored encrypted. Payments are handled
                    by Stripe — DialerSeat never sees or stores credit
                    card numbers. Telephony runs through SignalWire with
                    full STIR/SHAKEN attestation.
                  </p>
                </div>
              </details>

              <details>
                <summary>Will the $35/week price change?</summary>
                <div className="answer">
                  <p>
                    We have no plans to raise it. If we ever needed to,
                    existing customers would be grandfathered at the rate
                    they signed up at. The price you&apos;re looking at
                    today is the price you&apos;ll keep paying.
                  </p>
                </div>
              </details>
            </div>

          </div>

          {/* CTA — auth-aware */}
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
                    $35 for a week. No contract. Cancel any time. Your
                    data stays yours.
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