'use client'

// =============================================================================
// /faq/why-dialerseat — founder-voice deep dive
// =============================================================================
// Linked from the FAQ index. Stands on its own as a thesis/story page —
// could be discovered via direct search or share. Threads in the
// comparisons content (links out to /vs/*) since "why us" and "vs them"
// are the same conversation.
//
// Structure:
//   1. Back-link breadcrumb → /faq
//   2. Hero
//   3. Why we exist (thesis)
//   4. Who builds it
//   5. How we work
//   6. Setting the record straight (comparisons + /vs links)
//   7. Our promise
//   8. Where we're going (gratitude + future)
//   9. Auth-aware bottom CTA
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
  green: '#1a6a1a',
  red: '#8a1a1a',
}

export default function WhyDialerSeatView() {
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
          .why-root * { box-sizing: border-box; }

          /* HERO */
          .why-hero {
            background: linear-gradient(135deg, #0a0a14 0%, #1a1a2e 100%);
            color: white;
            padding: 88px 32px 72px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .why-hero::before {
            content: '';
            position: absolute; inset: 0;
            background: radial-gradient(circle at 30% 30%, rgba(74,158,255,0.18) 0%, transparent 55%);
          }
          .why-hero-inner { position: relative; max-width: 760px; margin: 0 auto; }
          .why-breadcrumb {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
            letter-spacing: 2px;
            color: #8888aa;
            text-decoration: none;
            margin-bottom: 22px;
            transition: color 0.12s;
          }
          .why-breadcrumb:hover { color: ${T.accent}; }
          .why-eyebrow {
            display: inline-block;
            padding: 6px 14px;
            background: rgba(74,158,255,0.15);
            border: 1px solid #4a9eff;
            border-radius: 4px;
            color: #4a9eff;
            font-size: 11px;
            letter-spacing: 3px;
            font-weight: bold;
            margin-bottom: 24px;
          }
          .why-hero h1 {
            font-size: 56px;
            font-weight: 800;
            letter-spacing: -1px;
            line-height: 1.05;
            margin: 0 0 20px 0;
          }
          .why-lead {
            font-size: 18px;
            line-height: 1.6;
            color: #c4c8d8;
            max-width: 620px;
            margin: 0 auto;
          }

          /* BODY SECTIONS */
          .why-section {
            max-width: 820px;
            margin: 0 auto;
            padding: 72px 32px;
          }
          .why-section.alt {
            background: white;
            max-width: none;
          }
          .why-section.alt > .inner {
            max-width: 820px;
            margin: 0 auto;
            padding: 0 32px;
          }
          .why-section-label {
            font-size: 10px;
            letter-spacing: 4px;
            color: ${T.muted};
            font-weight: bold;
            margin-bottom: 14px;
          }
          .why-section h2 {
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -0.4px;
            line-height: 1.2;
            margin: 0 0 22px 0;
          }
          .why-section p {
            font-size: 16px;
            line-height: 1.75;
            color: #2c3038;
            margin: 0 0 16px 0;
          }
          .why-pullquote {
            margin: 28px 0;
            padding: 22px 26px;
            background: ${T.bg};
            border-left: 3px solid ${T.accent};
            border-radius: 4px;
            font-size: 16px;
            line-height: 1.7;
            color: ${T.text};
          }

          /* CARD GRID */
          .why-cards {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            margin-top: 28px;
          }
          .why-card {
            padding: 22px 24px;
            background: white;
            border: 1px solid #e4e6ec;
            border-left: 3px solid ${T.accent};
            border-radius: 8px;
          }
          .why-card h3 {
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.5px;
            margin: 0 0 8px 0;
            color: ${T.accentDark};
          }
          .why-card p {
            font-size: 14px;
            line-height: 1.65;
            color: ${T.text};
            margin: 0;
          }

          /* COMPARISONS */
          .why-comp-takedown {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 14px;
            margin-top: 28px;
            margin-bottom: 24px;
          }
          .why-comp-card {
            padding: 20px 22px;
            background: white;
            border: 1px solid #e4e6ec;
            border-top: 3px solid ${T.red};
            border-radius: 8px;
          }
          .why-comp-card h4 {
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 2px;
            margin: 0 0 8px 0;
            color: ${T.red};
          }
          .why-comp-card p {
            font-size: 13px;
            line-height: 1.6;
            color: ${T.text};
            margin: 0;
          }
          .why-comp-links {
            margin-top: 26px;
            padding: 24px;
            background: ${T.dark};
            border-radius: 10px;
          }
          .why-comp-links-label {
            font-size: 10px;
            letter-spacing: 3px;
            color: #8888aa;
            font-weight: bold;
            margin-bottom: 14px;
          }
          .why-comp-links-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          .why-comp-link {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 6px;
            color: white;
            text-decoration: none;
            font-size: 13px;
            letter-spacing: 0.5px;
            transition: background 0.12s, border-color 0.12s;
          }
          .why-comp-link:hover {
            background: rgba(74,158,255,0.12);
            border-color: ${T.accent};
          }
          .why-comp-link .arrow {
            color: ${T.accent};
            font-weight: bold;
          }

          /* OUR PROMISE */
          .why-promise {
            display: flex;
            flex-direction: column;
            gap: 14px;
            margin-top: 24px;
          }
          .why-promise-item {
            display: flex;
            gap: 14px;
            padding: 16px 18px;
            background: white;
            border: 1px solid #e4e6ec;
            border-left: 3px solid ${T.green};
            border-radius: 8px;
          }
          .why-promise-item .check {
            color: ${T.green};
            font-weight: bold;
            flex-shrink: 0;
            font-size: 18px;
            line-height: 1.4;
          }
          .why-promise-item .body { flex: 1; }
          .why-promise-item h3 {
            font-size: 14px;
            font-weight: 700;
            margin: 0 0 4px 0;
            color: ${T.text};
            letter-spacing: 0.3px;
          }
          .why-promise-item p {
            font-size: 13px;
            line-height: 1.6;
            color: ${T.muted};
            margin: 0;
          }

          /* CTA */
          .why-cta {
            background: ${T.dark};
            color: white;
            padding: 72px 32px;
            text-align: center;
          }
          .why-cta-inner { max-width: 640px; margin: 0 auto; }
          .why-cta-eyebrow {
            font-size: 11px;
            letter-spacing: 4px;
            color: #8888aa;
            font-weight: bold;
            margin-bottom: 12px;
          }
          .why-cta h2 {
            font-size: 30px;
            font-weight: 800;
            letter-spacing: -0.3px;
            color: white;
            margin: 0 0 14px 0;
          }
          .why-cta p {
            font-size: 15px;
            line-height: 1.7;
            color: #c0c2ca;
            margin: 0 auto 28px;
            max-width: 540px;
          }
          .why-cta-row {
            display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
          }
          .why-btn-primary {
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
          .why-btn-secondary {
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

          @media (max-width: 768px) {
            .why-hero { padding: 64px 20px 56px; }
            .why-hero h1 { font-size: 36px; }
            .why-lead { font-size: 15px; }
            .why-section, .why-section.alt > .inner {
              padding-left: 20px; padding-right: 20px;
            }
            .why-section { padding-top: 52px; padding-bottom: 52px; }
            .why-section h2 { font-size: 26px; }
            .why-cards { grid-template-columns: 1fr; }
            .why-comp-takedown { grid-template-columns: 1fr; }
            .why-comp-links-grid { grid-template-columns: 1fr; }
            .why-cta { padding: 56px 20px; }
            .why-cta h2 { font-size: 24px; }
            .why-btn-primary, .why-btn-secondary { width: 100%; box-sizing: border-box; }
          }
        `}</style>

        <div className="why-root">

          {/* HERO */}
          <section className="why-hero">
            <div className="why-hero-inner">
              <div className="why-eyebrow">WHY DIALERSEAT?</div>
              <h1>We built the dialer we wished existed.</h1>
              <p className="why-lead">
                DialerSeat exists because we got tired of paying enterprise
                prices for tools that hadn&apos;t shipped a real feature in
                years. We built it the way we&apos;d want to use it — and
                then we kept building. This is the page where we tell you
                the rest.
              </p>
            </div>
          </section>

          {/* THESIS */}
          <section className="why-section">
            <div className="why-section-label">▸ WHY WE EXIST</div>
            <h2>The dialer market needed someone to actually care.</h2>
            <p>
              The outbound dialer space is full of products that were built
              a decade ago, repriced twice, and are now sold with annual
              contracts and a feature roadmap that hasn&apos;t budged since
              2014. The teams behind them aren&apos;t bad people. They just
              stopped paying attention.
            </p>
            <p>
              DialerSeat was started by people who&apos;ve sat in the
              dialing seat, lost deals to dropped calls, watched a quarter
              of their workday disappear into voicemails, and gotten told
              &quot;that&apos;s on the roadmap&quot; for the third year
              running. We built the answer to those moments. And we kept
              building.
            </p>
            <div className="why-pullquote">
              The thing we got from the competition wasn&apos;t inspiration —
              it was motivation. Every clunky UI, every missing feature,
              every two-year contract somebody got trapped in is the reason
              this product exists.
            </div>
          </section>

          {/* WHO BUILDS IT */}
          <section className="why-section alt">
            <div className="inner">
              <div className="why-section-label">▸ WHO BUILDS IT</div>
              <h2>Seasoned developers, working alongside people who&apos;ve actually dialed.</h2>
              <p>
                Every feature shipped on DialerSeat goes through the hands
                of someone who has done outbound for real money. We don&apos;t
                ship UI that demos well on a slide and breaks during a
                Tuesday-afternoon shift. We ship things we&apos;d be willing
                to use ourselves at the top of an hour with a dialing list
                in front of us — because that&apos;s exactly where this
                product gets used.
              </p>
              <div className="why-cards">
                <div className="why-card">
                  <h3>BUILT BY OPERATORS</h3>
                  <p>
                    The product is informed by people who&apos;ve spent
                    real years on dialing floors — insurance, B2B, lead-gen,
                    collections. The features we prioritize come from
                    real-world friction, not market research decks.
                  </p>
                </div>
                <div className="why-card">
                  <h3>WRITTEN BY ENGINEERS</h3>
                  <p>
                    The codebase is held to a standard. We use modern
                    infrastructure (SignalWire for telephony, Supabase for
                    data, Stripe for billing) and we keep the implementation
                    tight enough to ship changes weekly without breaking
                    things.
                  </p>
                </div>
                <div className="why-card">
                  <h3>WE USE IT OURSELVES</h3>
                  <p>
                    The team dials on DialerSeat. If something&apos;s broken
                    for you, it&apos;s broken for us. That feedback loop is
                    why bugs get fixed in days rather than the next quarterly
                    release.
                  </p>
                </div>
                <div className="why-card">
                  <h3>SMALL, FOCUSED, AVAILABLE</h3>
                  <p>
                    No tiered support, no enterprise channel, no
                    eighteen-touch ticket system. You email us, we answer.
                    That&apos;s the whole support model and it&apos;s the
                    one we plan to keep.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* HOW WE WORK */}
          <section className="why-section">
            <div className="why-section-label">▸ HOW WE WORK</div>
            <h2>Feedback isn&apos;t a roadmap item. It&apos;s the roadmap.</h2>
            <p>
              We&apos;ve shipped feature requests in the same week they
              came in. That&apos;s not marketing — it&apos;s the actual
              git history. The product evolves at the pace of real
              customer use, not at the pace of a quarterly planning cycle
              held in a conference room three states away from where
              dialing actually happens.
            </p>
            <p>
              When something&apos;s broken, we fix it. When something&apos;s
              missing, we build it. When something&apos;s working, we make
              it better. The product you&apos;re using a month from now
              is meaningfully better than the one you signed up on — not
              because we cycle through marketing campaigns, but because
              we put the work in.
            </p>
            <div className="why-pullquote">
              We put our money where our mouth is on development. The
              development budget isn&apos;t a line item we try to minimize —
              it&apos;s the entire point of the company. Every dollar that
              comes in goes back into making the product better for the
              people paying.
            </div>
          </section>

          {/* SETTING THE RECORD STRAIGHT */}
          <section className="why-section alt">
            <div className="inner">
              <div className="why-section-label">▸ SETTING THE RECORD STRAIGHT</div>
              <h2>&quot;But what about [other dialer]?&quot;</h2>
              <p>
                We don&apos;t really see the other dialers as competition.
                We see them as the reason we exist. ReadyMode, Mojo,
                PhoneBurner, CallTools, Convoso, Kixie, JustCall — they all
                do parts of what we do, often at three or four times the
                price, often locked behind annual contracts, often with
                feature sets that haven&apos;t materially changed in a
                decade.
              </p>
              <p>
                When you build a dialer in 2026 with modern telephony,
                modern AMD, browser-native calling, an honest abandon-rate
                controller, and a team that ships weekly — you don&apos;t
                end up looking like a 2014 product. You don&apos;t need to.
              </p>

              <div className="why-comp-takedown">
                <div className="why-comp-card">
                  <h4>READYMODE</h4>
                  <p>
                    Capable, enterprise-priced, contract-heavy. Built for
                    big shops with big budgets and patience for long
                    onboarding. We&apos;re built for the rest of the market.
                  </p>
                </div>
                <div className="why-comp-card">
                  <h4>MOJO DIALER</h4>
                  <p>
                    Real-estate-focused. Bundled list manager + dialer.
                    Locked into per-month tiers, no real predictive mode,
                    interface dates the product more than the features do.
                  </p>
                </div>
                <div className="why-comp-card">
                  <h4>PHONEBURNER</h4>
                  <p>
                    Solo-agent friendly. No predictive. No multi-line.
                    $149/month for what amounts to a power dialer with
                    voicemail drops. We do more for less, and faster.
                  </p>
                </div>
              </div>

              <p style={{ marginTop: 28 }}>
                There is, in our honest view, no real comparison. But you&apos;ll
                want to see for yourself, and we respect that. We&apos;ve
                written the full side-by-sides — they&apos;re linked below.
                If you read them and disagree, send us an email; we&apos;ll
                ship the missing thing.
              </p>

              <div className="why-comp-links">
                <div className="why-comp-links-label">▸ FULL SIDE-BY-SIDES</div>
                <div className="why-comp-links-grid">
                  <Link href="/vs" className="why-comp-link">
                    <span>DialerSeat vs. the field</span>
                    <span className="arrow">→</span>
                  </Link>
                  <Link href="/vs/everyone" className="why-comp-link">
                    <span>DialerSeat vs. everyone</span>
                    <span className="arrow">→</span>
                  </Link>
                  <Link href="/vs/readymode" className="why-comp-link">
                    <span>DialerSeat vs. ReadyMode</span>
                    <span className="arrow">→</span>
                  </Link>
                  <Link href="/vs/mojo" className="why-comp-link">
                    <span>DialerSeat vs. Mojo Dialer</span>
                    <span className="arrow">→</span>
                  </Link>
                  <Link href="/vs/phoneburner" className="why-comp-link">
                    <span>DialerSeat vs. PhoneBurner</span>
                    <span className="arrow">→</span>
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* OUR PROMISE */}
          <section className="why-section">
            <div className="why-section-label">▸ OUR PROMISE</div>
            <h2>What you&apos;re actually signing up for.</h2>
            <p>
              A lot of dialer companies bury the real terms in a 12-page
              MSA. Ours fit on a page. Here they are.
            </p>
            <div className="why-promise">
              <div className="why-promise-item">
                <span className="check">✓</span>
                <div className="body">
                  <h3>$35 per week per seat. That&apos;s the whole price.</h3>
                  <p>No setup fee, no per-call surcharge, no tier upcharge,
                  no annual minimum. Cancel from your billing page anytime.</p>
                </div>
              </div>
              <div className="why-promise-item">
                <span className="check">✓</span>
                <div className="body">
                  <h3>Your data stays yours.</h3>
                  <p>Leads you uploaded, recordings you made, campaigns you
                  configured — all of it remains accessible. Cancellation
                  doesn&apos;t mean we lock the door behind you.</p>
                </div>
              </div>
              <div className="why-promise-item">
                <span className="check">✓</span>
                <div className="body">
                  <h3>The product gets better every week, not every quarter.</h3>
                  <p>Real-feature releases on a continuous cadence. We don&apos;t
                  batch fixes into &quot;maintenance windows&quot; — we ship
                  what&apos;s ready when it&apos;s ready.</p>
                </div>
              </div>
              <div className="why-promise-item">
                <span className="check">✓</span>
                <div className="body">
                  <h3>We pick up.</h3>
                  <p>Email us, you get an answer from a person who knows the
                  product. No bot deflection, no &quot;tier two&quot;
                  handoffs, no eight-day SLAs.</p>
                </div>
              </div>
            </div>
          </section>

          {/* WHERE WE'RE GOING */}
          <section className="why-section alt">
            <div className="inner">
              <div className="why-section-label">▸ WHERE WE&apos;RE GOING</div>
              <h2>Grateful for the present. Excited about the next year.</h2>
              <p>
                We&apos;re deeply grateful to the operators who took a chance
                on a new tool in a category dominated by entrenched names.
                Every paying customer has shaped this product — the codebase
                has the receipts. The features you&apos;re using today
                exist because someone asked for them in an email and we
                shipped them the same week.
              </p>
              <p>
                The future of DialerSeat is more of the same: deeper team
                workflows, better visibility into what&apos;s actually
                working on your campaigns, more compliance tooling that the
                enterprise vendors hold behind enterprise prices, and the
                kind of integrations that make this fit naturally into
                whatever stack you already run. We&apos;ve got a lot of room
                to grow, and we plan to keep showing up for the people who
                help us get there.
              </p>
              <p>
                If you&apos;re reading this and considering signing up: thanks
                for being here. We&apos;ll do right by you.
              </p>
            </div>
          </section>

          {/* CTA */}
          <section className="why-cta">
            <div className="why-cta-inner">
              <div className="why-cta-eyebrow">
                {showSignedIn ? '▸ READY TO DIAL' : '▸ ONE WEEK. $35. THAT&apos;S IT.'}
              </div>
              {showSignedIn ? (
                <>
                  <h2>Hop back in.</h2>
                  <p>The terminal&apos;s waiting.</p>
                  <div className="why-cta-row">
                    <Link href="/dashboard/dialer" className="why-btn-primary">
                      OPEN DIALER →
                    </Link>
                    <Link href="/faq" className="why-btn-secondary">
                      BACK TO FAQ
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h2>Try us for a week.</h2>
                  <p>
                    $35. No contract. Cancel any time. The dialer is the
                    one we use ourselves — if you don&apos;t like it,
                    leave, and your data stays yours.
                  </p>
                  <div className="why-cta-row">
                    <Link href="/sign-up" className="why-btn-primary">
                      START DIALING →
                    </Link>
                    <Link href="/faq" className="why-btn-secondary">
                      BACK TO FAQ
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