'use client'

// =============================================================================
// /faq/dialerseat-teams — public deep dive on DialerSeat Teams
// =============================================================================
// v2 content rewrite. Premium leads is now the centerpiece; aged leads
// is demoted to a tracked secondary callout inside the lead-vendor deep
// dive. Title and hero no longer lead with aged leads.
//
// Pitch: rent seat-based dialer access to your premium lead campaigns,
// with full attribution. As a bonus, the platform automatically tracks
// which leads went un-worked so you can build secondary campaigns from
// the aged remainder without manual list management.
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
  amber: '#8a6a1a',
  red: '#8a1a1a',
}

export default function DialerSeatTeamsFaqView() {
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
          .tfaq-root * { box-sizing: border-box; }

          /* HERO */
          .tfaq-hero {
            background: linear-gradient(135deg, #0a0a14 0%, #1a1a2e 100%);
            color: white;
            padding: 88px 32px 72px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .tfaq-hero::before {
            content: '';
            position: absolute; inset: 0;
            background: radial-gradient(circle at 30% 30%, rgba(74,158,255,0.18) 0%, transparent 55%);
          }
          .tfaq-hero-inner { position: relative; max-width: 820px; margin: 0 auto; }
          .tfaq-breadcrumb {
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
          .tfaq-breadcrumb:hover { color: ${T.accent}; }
          .tfaq-eyebrow {
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
          .tfaq-hero h1 {
            font-size: 54px;
            font-weight: 800;
            letter-spacing: -1px;
            line-height: 1.05;
            margin: 0 0 22px 0;
          }
          .tfaq-lead {
            font-size: 18px;
            line-height: 1.6;
            color: #c4c8d8;
            max-width: 680px;
            margin: 0 auto;
          }

          /* SECTIONS */
          .tfaq-section {
            max-width: 860px;
            margin: 0 auto;
            padding: 72px 32px;
          }
          .tfaq-section.alt {
            background: white;
            max-width: none;
          }
          .tfaq-section.alt > .inner {
            max-width: 860px;
            margin: 0 auto;
            padding: 0 32px;
          }
          .tfaq-label {
            font-size: 10px;
            letter-spacing: 4px;
            color: ${T.muted};
            font-weight: bold;
            margin-bottom: 14px;
          }
          .tfaq-section h2 {
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -0.4px;
            line-height: 1.2;
            margin: 0 0 22px 0;
          }
          .tfaq-section h3 {
            font-size: 19px;
            font-weight: 700;
            letter-spacing: 0.2px;
            margin: 28px 0 12px 0;
            color: ${T.accentDark};
          }
          .tfaq-section p {
            font-size: 16px;
            line-height: 1.75;
            color: #2c3038;
            margin: 0 0 16px 0;
          }
          .tfaq-pullquote {
            margin: 26px 0;
            padding: 22px 26px;
            background: ${T.bg};
            border-left: 3px solid ${T.accent};
            border-radius: 4px;
            font-size: 16px;
            line-height: 1.7;
            color: ${T.text};
          }

          /* AGED LEADS CALLOUT — subdued, signals "bonus feature" */
          .tfaq-aged-callout {
            margin-top: 36px;
            padding: 24px 26px;
            background: ${T.bg};
            border: 1px solid ${T.border};
            border-left: 3px solid ${T.amber};
            border-radius: 6px;
          }
          .tfaq-aged-callout .label {
            font-size: 10px;
            letter-spacing: 3px;
            color: ${T.amber};
            font-weight: bold;
            margin-bottom: 8px;
          }
          .tfaq-aged-callout h4 {
            font-size: 18px;
            font-weight: 700;
            margin: 0 0 12px 0;
            color: ${T.text};
            letter-spacing: 0.2px;
          }
          .tfaq-aged-callout p {
            font-size: 14px;
            line-height: 1.65;
            color: ${T.text};
            margin: 0 0 10px 0;
          }
          .tfaq-aged-callout p:last-child { margin-bottom: 0; }

          /* AUDIENCE CARDS (3-up) */
          .tfaq-audience-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-top: 28px;
          }
          .tfaq-audience-card {
            padding: 24px 22px;
            background: white;
            border: 1px solid #e4e6ec;
            border-top: 3px solid ${T.accent};
            border-radius: 8px;
          }
          .tfaq-audience-card h3 {
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 2px;
            margin: 0 0 10px 0;
            color: ${T.accentDark};
          }
          .tfaq-audience-card p {
            font-size: 13px;
            line-height: 1.65;
            color: ${T.text};
            margin: 0;
          }

          /* BILLING MODE CARDS (2x2 grid) */
          .tfaq-mode-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 14px;
            margin-top: 28px;
          }
          .tfaq-mode-card {
            padding: 22px 24px;
            background: white;
            border: 1px solid #e4e6ec;
            border-left: 3px solid ${T.accent};
            border-radius: 8px;
          }
          .tfaq-mode-card.free { border-left-color: ${T.green}; }
          .tfaq-mode-card h3 {
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 2px;
            margin: 0 0 4px 0;
            color: ${T.accentDark};
          }
          .tfaq-mode-card.free h3 { color: ${T.green}; }
          .tfaq-mode-card .sub {
            font-size: 11px;
            letter-spacing: 1px;
            color: ${T.muted};
            font-weight: bold;
            margin-bottom: 10px;
          }
          .tfaq-mode-card p {
            font-size: 13px;
            line-height: 1.6;
            color: ${T.text};
            margin: 0;
          }

          /* PLATFORM-SUB NOTICE */
          .tfaq-platform-notice {
            margin-top: 22px;
            padding: 18px 22px;
            background: ${T.dark};
            border-radius: 8px;
            color: white;
          }
          .tfaq-platform-notice .label {
            font-size: 10px;
            letter-spacing: 3px;
            color: #8888aa;
            font-weight: bold;
            margin-bottom: 8px;
          }
          .tfaq-platform-notice p {
            font-size: 14px;
            line-height: 1.65;
            color: #d0d2da;
            margin: 0;
          }
          .tfaq-platform-notice strong { color: white; }

          /* STEP-BY-STEP */
          .tfaq-steps-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 16px;
            margin-top: 28px;
          }
          .tfaq-step-block {
            background: white;
            border: 1px solid #e4e6ec;
            border-radius: 10px;
            overflow: hidden;
          }
          .tfaq-step-head {
            padding: 16px 22px;
            background: ${T.dark};
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
          }
          .tfaq-step-head .title {
            font-size: 14px;
            letter-spacing: 2px;
            font-weight: 700;
          }
          .tfaq-step-head .badge {
            font-size: 9px;
            letter-spacing: 2px;
            padding: 4px 10px;
            background: rgba(74,158,255,0.15);
            border: 1px solid ${T.accent};
            border-radius: 3px;
            color: ${T.accent};
            font-weight: bold;
          }
          .tfaq-step-body { padding: 20px 24px; }
          .tfaq-step-body ol {
            margin: 0;
            padding-left: 22px;
            counter-reset: tfaq-step;
            list-style: none;
          }
          .tfaq-step-body li {
            position: relative;
            padding-left: 6px;
            margin-bottom: 12px;
            font-size: 14px;
            line-height: 1.6;
            color: ${T.text};
            counter-increment: tfaq-step;
          }
          .tfaq-step-body li::before {
            content: counter(tfaq-step);
            position: absolute;
            left: -22px;
            top: 0;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: ${T.accent};
            color: white;
            font-size: 10px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .tfaq-step-body p {
            font-size: 13px;
            color: ${T.muted};
            margin: 10px 0 0 0;
            line-height: 1.55;
            padding-top: 10px;
            border-top: 1px solid #e4e6ec;
          }

          /* Q&A GRID */
          .tfaq-qa-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 14px;
            margin-top: 24px;
          }
          .tfaq-qa-card {
            padding: 18px 20px;
            background: white;
            border: 1px solid #e4e6ec;
            border-radius: 8px;
          }
          .tfaq-qa-card h4 {
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.4px;
            margin: 0 0 8px 0;
            color: ${T.accentDark};
          }
          .tfaq-qa-card p {
            font-size: 13px;
            line-height: 1.6;
            color: ${T.text};
            margin: 0;
          }

          /* CTA */
          .tfaq-cta {
            background: ${T.dark};
            color: white;
            padding: 72px 32px;
            text-align: center;
          }
          .tfaq-cta-inner { max-width: 640px; margin: 0 auto; }
          .tfaq-cta-eyebrow {
            font-size: 11px;
            letter-spacing: 4px;
            color: #8888aa;
            font-weight: bold;
            margin-bottom: 12px;
          }
          .tfaq-cta h2 {
            font-size: 30px;
            font-weight: 800;
            letter-spacing: -0.3px;
            color: white;
            margin: 0 0 14px 0;
          }
          .tfaq-cta p {
            font-size: 15px;
            line-height: 1.7;
            color: #c0c2ca;
            margin: 0 auto 28px;
            max-width: 540px;
          }
          .tfaq-cta-row {
            display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
          }
          .tfaq-btn-primary {
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
          .tfaq-btn-secondary {
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
            .tfaq-hero { padding: 64px 20px 56px; }
            .tfaq-hero h1 { font-size: 34px; }
            .tfaq-lead { font-size: 15px; }
            .tfaq-section, .tfaq-section.alt > .inner {
              padding-left: 20px; padding-right: 20px;
            }
            .tfaq-section { padding-top: 52px; padding-bottom: 52px; }
            .tfaq-section h2 { font-size: 26px; }
            .tfaq-audience-grid,
            .tfaq-mode-grid,
            .tfaq-qa-grid {
              grid-template-columns: 1fr;
            }
            .tfaq-cta { padding: 56px 20px; }
            .tfaq-cta h2 { font-size: 24px; }
            .tfaq-btn-primary, .tfaq-btn-secondary { width: 100%; box-sizing: border-box; }
          }
        `}</style>

        <div className="tfaq-root">

          {/* HERO */}
          <section className="tfaq-hero">
            <div className="tfaq-hero-inner">
              <Link href="/faq" className="tfaq-breadcrumb">← BACK TO FAQ</Link>
              <div style={{ marginTop: 4 }} />
              <div className="tfaq-eyebrow">DIALERSEAT TEAMS</div>
              <h1>Premium leads, agency floors, shared pools.</h1>
              <p className="tfaq-lead">
                DialerSeat Teams is the overlay that lets you sell seat-based
                dialer access to your premium lead campaigns — with full
                attribution back to you. Built for lead vendors monetizing
                their premium files, agencies running multiple producers,
                and any operation where more than one person dials the same
                list.
              </p>
            </div>
          </section>

          {/* WHAT IT IS */}
          <section className="tfaq-section">
            <div className="tfaq-label">▸ WHAT TEAMS ACTUALLY ARE</div>
            <h2>One account holder. Many seats. Real attribution.</h2>
            <p>
              A Team is created by one DialerSeat account holder (the
              owner). They attach their own premium campaigns to that team
              and invite other DialerSeat users to dial those campaigns.
              Members keep their own DialerSeat login. Every dial they make
              on team campaigns rolls back into the owner&apos;s analytics
              view in real time.
            </p>
            <p>
              It is not a separate product. It does not replace your account.
              It does not bypass platform billing. It is a structured way to
              rent dialing access to premium campaigns you own — with the
              audit trail, attribution, and analytics your business actually
              needs.
            </p>
          </section>

          {/* THREE AUDIENCES */}
          <section className="tfaq-section alt">
            <div className="inner">
              <div className="tfaq-label">▸ WHO TEAMS IS FOR</div>
              <h2>Three real use cases.</h2>
              <p>
                Teams was designed around three specific operator types we&apos;ve
                watched lose money to outdated tooling. If you&apos;re any of
                these, this is the product.
              </p>
              <div className="tfaq-audience-grid">
                <div className="tfaq-audience-card">
                  <h3>LEAD VENDORS</h3>
                  <p>
                    You generate premium leads. Instead of selling raw CSVs
                    and losing the relationship, you keep the file and rent
                    seat-based dialer access on your campaigns to buyer
                    agents — turning a one-shot sale into recurring revenue.
                  </p>
                </div>
                <div className="tfaq-audience-card">
                  <h3>AGENCY OWNERS</h3>
                  <p>
                    You run a producer floor — insurance, B2B, lead-gen,
                    debt, anywhere outbound matters. You need per-rep
                    attribution, recording audit, and live floor visibility
                    without enterprise prices or annual contracts.
                  </p>
                </div>
                <div className="tfaq-audience-card">
                  <h3>SHARED-POOL OPS</h3>
                  <p>
                    You have one big list and multiple dialers. You need
                    everyone hitting the file without double-dialing,
                    TCPA-safe across the whole team, with attempts and
                    timestamps updating globally as agents work.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* DEEP DIVE: LEAD VENDORS (PREMIUM LEADS) */}
          <section className="tfaq-section">
            <div className="tfaq-label">▸ LEAD VENDORS</div>
            <h2>Rent seats to your premium campaigns.</h2>
            <p>
              You spend real marketing dollars generating premium leads.
              Those leads have value. The old way of monetizing them caps
              you at the first sale — ship the CSV, take the check, lose
              the relationship. The buyer ghosts you, works the file out
              their way, and you start over with the next buyer the next
              month.
            </p>
            <p>
              DialerSeat Teams flips that. Upload your premium file to a
              campaign you own, build a team around it, and rent seats to
              your buyer agents. They dial inside your campaign on their
              own DialerSeat account. You see every dial, every disposition,
              every timestamp. Every call is recorded on your side. Attempt
              counts update globally — no double-dialing across the buyer
              pool, no TCPA risk from one buyer overworking the file.
            </p>
            <div className="tfaq-pullquote">
              The pitch isn&apos;t &quot;come buy my list.&quot; The pitch
              is &quot;come dial my premium file on my platform — I keep
              the data, you keep the appointments, we both stay
              accountable.&quot; That&apos;s a recurring product. CSVs
              aren&apos;t.
            </div>

            <h3>FOUR PRICING MODELS</h3>
            <p>
              The four billing modes (covered in detail below) map naturally
              to the seat structure. Pick whichever matches how you want to
              charge:
            </p>
            <ol style={{ paddingLeft: 22, marginTop: 14 }}>
              <li style={{ marginBottom: 12, fontSize: 15, lineHeight: 1.65 }}>
                <strong>Per-seat-per-week markup.</strong> You eat the $35
                seat cost and charge buyers a flat weekly markup. Clean
                recurring revenue per active dialing buyer.
              </li>
              <li style={{ marginBottom: 12, fontSize: 15, lineHeight: 1.65 }}>
                <strong>Pass-through seat.</strong> Set the campaign to
                AGENT PAYS. Each buyer covers their own $35 seat directly
                to DialerSeat. You charge a separate access fee outside.
              </li>
              <li style={{ marginBottom: 12, fontSize: 15, lineHeight: 1.65 }}>
                <strong>Flat membership, free dialing.</strong> Set the
                campaign to FREE mode. Nobody pays per-seat. You charge a
                recurring membership fee outside DialerSeat — best margins
                if your buyers dial heavily.
              </li>
              <li style={{ marginBottom: 12, fontSize: 15, lineHeight: 1.65 }}>
                <strong>Pay-per-result.</strong> Bill on the back end using
                the disposition feed — count CLOSED or APPOINTMENT marks
                and charge per outcome.
              </li>
            </ol>

            <p style={{ marginTop: 20 }}>
              Your premium file never leaves your account. Buyers see one
              lead at a time in the dialer UI. They don&apos;t get the
              underlying CSV. They can&apos;t export. When you revoke
              access, their visibility ends within seconds.
            </p>

            {/* AGED LEADS — tracked secondary capability */}
            <div className="tfaq-aged-callout">
              <div className="label">▸ BONUS — AGED LEADS, TRACKED AUTOMATICALLY</div>
              <h4>The platform knows which premium leads went un-worked.</h4>
              <p>
                Premium leads that sit untouched for 30, 60, or 90 days
                become aged. DialerSeat tracks every dial against every
                lead — attempts, last-called timestamps, disposition
                history — so at any point you know exactly which leads
                from a premium batch were never worked.
              </p>
              <p>
                Build a second team around those aged leads, rent seats to
                a different buyer pool, and run the same playbook on the
                untouched remainder. No manual list management, no separate
                upload, no risk of stepping on the first buyer pool —
                the platform handles the bookkeeping. Aged-lead resale is
                a side effect of running premium properly, not a separate
                product.
              </p>
            </div>
          </section>

          {/* DEEP DIVE: AGENCY OWNERS */}
          <section className="tfaq-section alt">
            <div className="inner">
              <div className="tfaq-label">▸ AGENCY OWNERS</div>
              <h2>Your producers, your floor, your numbers.</h2>
              <p>
                You run a floor — five reps, fifty reps, doesn&apos;t matter.
                Without Teams you&apos;d be either sharing a login (terrible
                — no per-rep attribution), buying an enterprise dialer
                (expensive, contract-heavy), or stitching together exports
                manually.
              </p>
              <p>
                With Teams the owner holds the master account on MANAGER+.
                Producers each hold their own DialerSeat account on PRO, or
                you comp them via corporate billing. Campaigns get attached
                to a team. Dialing happens. Analytics roll up.
              </p>

              <h3>WHAT YOU GET TO DO WITH THE DATA</h3>
              <p>
                Per-rep production: dials, connects, connect rate, appointments,
                closes, dispositions mix, abandon rate, time on phone.
                Per-campaign production: which lead source is converting,
                where to spend your next ad dollar. Per-rep × per-campaign
                hybrid: which rep crushes which source, so you assign
                correctly. Recording audit on every call. TCPA timestamps
                on every lead. Live floor visibility — see who&apos;s active
                right now and what state they&apos;re in (ready, dialing,
                on call, wrapping).
              </p>
              <div className="tfaq-pullquote">
                Coach off real numbers, not hunches. The whole point of
                running a floor instead of being a sole producer is the
                economy of scale on data — Teams gives you the data.
              </div>
              <p>
                Multiple teams per owner account is supported. Common
                setup: a &quot;Floor&quot; team with all your active
                producers and full campaign access, a &quot;Bootcamp&quot;
                team for trainees with restricted campaigns, a
                &quot;Closers&quot; team for live transfers only.
              </p>
            </div>
          </section>

          {/* DEEP DIVE: SHARED POOLS */}
          <section className="tfaq-section">
            <div className="tfaq-label">▸ SHARED LEAD POOL</div>
            <h2>Many dialers, one file, zero collisions.</h2>
            <p>
              Whether you&apos;re a lead vendor or an agency, the dialer
              needs to handle multiple humans hitting the same list at
              once without stepping on each other. Teams handles this
              automatically.
            </p>
            <p>
              DialerSeat hands a different lead to each agent simultaneously.
              <code style={{ background: '#e8eef8', padding: '2px 6px', borderRadius: 3, fontSize: 14 }}>last_called_at</code>
              {' '}and{' '}
              <code style={{ background: '#e8eef8', padding: '2px 6px', borderRadius: 3, fontSize: 14 }}>dial_attempts</code>
              {' '}increment globally — once anyone on the team dials a lead,
              every other agent sees the updated state. No double-dialing
              within the platform&apos;s 24-hour cooldown unless the owner
              explicitly allows it. TCPA window enforcement (8am–9pm local
              to the lead) applies team-wide, not per-agent.
            </p>
            <p>
              Run the pool wide open and everyone gets the next available
              lead. Or partition by attribute — state, source field, lead
              score, vertical — so each agent works the slice that matches
              their license, skill set, or assignment.
            </p>
          </section>

          {/* BILLING MODES */}
          <section className="tfaq-section alt">
            <div className="inner">
              <div className="tfaq-label">▸ BILLING MODES</div>
              <h2>Four ways to handle the per-seat cost.</h2>
              <p>
                When the team owner attaches a campaign to a team, they pick
                one of four access modes for that campaign. The mode
                determines who, if anyone, pays the per-seat campaign fee on
                top of the platform subscription.
              </p>

              <div className="tfaq-mode-grid">
                <div className="tfaq-mode-card">
                  <h3>OWNER PAYS</h3>
                  <div className="sub">$35/WK per active agent — owner billed</div>
                  <p>
                    Owner&apos;s card is charged for one seat per dialing
                    agent. Agents dial free of any per-campaign charge.
                    Best for agencies baking seat into a retainer or
                    vendors packaging access into a flat fee.
                  </p>
                </div>
                <div className="tfaq-mode-card">
                  <h3>AGENT PAYS</h3>
                  <div className="sub">$35/WK per agent — agents billed</div>
                  <p>
                    Each agent pays their own seat fee directly to
                    DialerSeat. Owner pays nothing per-seat. Best for
                    lead vendors selling premium campaign access where
                    buyers cover their own usage cost.
                  </p>
                </div>
                <div className="tfaq-mode-card">
                  <h3>PUBLIC</h3>
                  <div className="sub">No code required</div>
                  <p>
                    Any active DialerSeat subscriber can access the
                    campaign without a team code. Rarely used — mostly
                    for free-promo or community-list scenarios.
                  </p>
                </div>
                <div className="tfaq-mode-card free">
                  <h3>FREE</h3>
                  <div className="sub">No per-seat fee for anyone</div>
                  <p>
                    Neither owner nor agents pay any per-campaign seat
                    charge. Best for small agencies under corporate
                    billing, internal training accounts, comping a
                    trial seat, or premium-campaign memberships with a
                    flat external access fee.
                  </p>
                </div>
              </div>

              <div className="tfaq-platform-notice">
                <div className="label">PLATFORM SUB IS ALWAYS REQUIRED</div>
                <p>
                  Every team member — owner and agents both — needs an
                  active personal DialerSeat subscription to actually dial:
                  <strong> PRO ($35/wk)</strong> to dial as a member, or
                  <strong> MANAGER+ ($75/wk)</strong> to own a team. The
                  access mode only controls the optional per-campaign seat
                  fee that sits on top of the platform sub. FREE mode means
                  no per-seat fee — it does NOT mean free platform access.
                </p>
              </div>
            </div>
          </section>

          {/* STEP-BY-STEP SETUPS */}
          <section className="tfaq-section">
            <div className="tfaq-label">▸ STEP-BY-STEP SETUPS</div>
            <h2>How each use case actually goes.</h2>

            <div className="tfaq-steps-grid">
              <div className="tfaq-step-block">
                <div className="tfaq-step-head">
                  <span className="title">PREMIUM LEAD VENDOR</span>
                  <span className="badge">RECURRING REVENUE</span>
                </div>
                <div className="tfaq-step-body">
                  <ol>
                    <li>Sign up for DialerSeat MANAGER+ ($75/wk).</li>
                    <li>Upload your premium lead file to a campaign in your account.</li>
                    <li>Create a team named after the offer — e.g. &quot;Q4 Refi Premium — Tier 1.&quot;</li>
                    <li>Attach the campaign to the team.</li>
                    <li>Pick the access mode that matches your pricing — AGENT PAYS, FREE, or OWNER PAYS.</li>
                    <li>Generate a team code. Send to your buyer agents.</li>
                    <li>Buyers create their own DialerSeat accounts (or use existing ones), redeem the code, start dialing.</li>
                    <li>Watch analytics roll in. Pull QA on recordings. Kick non-performers or rule-breakers instantly.</li>
                  </ol>
                  <p>
                    Your premium file never leaves your account. Buyers
                    see one lead at a time. When access is revoked, their
                    visibility ends within seconds. Aged leads from the
                    same file are tracked automatically — see the lead
                    vendor section above.
                  </p>
                </div>
              </div>

              <div className="tfaq-step-block">
                <div className="tfaq-step-head">
                  <span className="title">AGENCY OWNER</span>
                  <span className="badge">FLOOR OPS</span>
                </div>
                <div className="tfaq-step-body">
                  <ol>
                    <li>Sign up for DialerSeat MANAGER+ ($75/wk).</li>
                    <li>Upload your campaigns and leads to your account.</li>
                    <li>Create a team — e.g. &quot;[Your Agency] Floor.&quot;</li>
                    <li>Attach the campaigns you want your reps dialing.</li>
                    <li>Pick access mode — OWNER PAYS for clean line-item expense, or FREE if reps are on corporate-comped PRO subs.</li>
                    <li>Email-invite each producer. They sign up for PRO ($35/wk) or accept your comped invite.</li>
                    <li>Open team analytics every morning. Coach off real numbers.</li>
                  </ol>
                  <p>
                    Multiple teams per account is supported — use it to
                    structure your floor, trainees, and closer tiers
                    separately.
                  </p>
                </div>
              </div>

              <div className="tfaq-step-block">
                <div className="tfaq-step-head">
                  <span className="title">SHARED LEAD POOL</span>
                  <span className="badge">MULTI-AGENT</span>
                </div>
                <div className="tfaq-step-body">
                  <ol>
                    <li>Attach a single large campaign (e.g. 50,000 leads) to a team.</li>
                    <li>Multiple agents log in and select that campaign in their dialer.</li>
                    <li>Each agent hits INITIATE DIAL SEQUENCE. DialerSeat hands each one a different lead.</li>
                    <li>Attempt counts and last-called timestamps update globally as leads get dialed.</li>
                    <li>Once a lead is dispositioned, it drops from the active queue per standard DialerSeat rules.</li>
                  </ol>
                  <p>
                    Run wide-open if you don&apos;t care who dials what.
                    Partition by state, source field, or lead score if
                    you want each rep on a specific slice.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* COMMON QUESTIONS */}
          <section className="tfaq-section alt">
            <div className="inner">
              <div className="tfaq-label">▸ COMMON QUESTIONS</div>
              <h2>The ones that come up before signup.</h2>

              <div className="tfaq-qa-grid">
                <div className="tfaq-qa-card">
                  <h4>Do I need MANAGER+ to create a team?</h4>
                  <p>
                    Yes. Team ownership is a MANAGER+ feature ($75/week).
                    Use code MANAGERTEST for 100% off if you want to try it
                    before committing.
                  </p>
                </div>
                <div className="tfaq-qa-card">
                  <h4>Can a user be on multiple teams?</h4>
                  <p>
                    Yes. An agent can be invited to teams from different
                    owners and switch between them in the dialer. One PRO
                    subscription covers all their team activity.
                  </p>
                </div>
                <div className="tfaq-qa-card">
                  <h4>Can I charge different agents different rates?</h4>
                  <p>
                    DialerSeat sets one access mode per campaign-per-team.
                    For tiered pricing, create separate teams (e.g.
                    &quot;Premium&quot; with AGENT PAYS, &quot;Standard&quot;
                    with OWNER PAYS) and put different members in each.
                  </p>
                </div>
                <div className="tfaq-qa-card">
                  <h4>Can team members export the lead CSV?</h4>
                  <p>
                    No. Members see leads one at a time in the dialer UI
                    and in their own call history. Your master file is
                    never exposed.
                  </p>
                </div>
                <div className="tfaq-qa-card">
                  <h4>What happens if I cancel my subscription?</h4>
                  <p>
                    Your team data is preserved. Members lose dialing access
                    until you resubscribe. Once you&apos;re active again,
                    everything resumes — no data is lost.
                  </p>
                </div>
                <div className="tfaq-qa-card">
                  <h4>What happens if a member cancels their sub?</h4>
                  <p>
                    They can&apos;t dial. They keep their account in
                    read-only mode but team campaigns require an active sub
                    to launch a call.
                  </p>
                </div>
                <div className="tfaq-qa-card">
                  <h4>How does TCPA enforcement work across a team?</h4>
                  <p>
                    Platform-wide. The 8am–9pm local-to-the-lead window
                    applies to every dial regardless of which agent placed
                    it. Cooldowns and attempt caps are calculated across
                    the whole team — no agent can re-dial early to game
                    the cap.
                  </p>
                </div>
                <div className="tfaq-qa-card">
                  <h4>Can I remove someone instantly?</h4>
                  <p>
                    Yes. Open team settings, find the member, click Remove.
                    Their access to all team campaigns is revoked within
                    seconds. Their personal account is untouched.
                  </p>
                </div>
                <div className="tfaq-qa-card">
                  <h4>Who owns the recordings?</h4>
                  <p>
                    The team owner owns recordings made by team members on
                    team campaigns. Members can play and download their
                    own recordings; the owner can play and download any
                    team recording. Standard 30-day retention applies.
                  </p>
                </div>
                <div className="tfaq-qa-card">
                  <h4>Can I switch billing modes after attaching a campaign?</h4>
                  <p>
                    Yes. Owner can flip a campaign between OWNER PAYS,
                    AGENT PAYS, PUBLIC, and FREE anytime from team settings.
                    Switching to AGENT PAYS or FREE revokes any
                    owner-paid access on that campaign — agents can be
                    re-granted under the new mode.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="tfaq-cta">
            <div className="tfaq-cta-inner">
              <div className="tfaq-cta-eyebrow">
                {showSignedIn ? '▸ READY TO BUILD A TEAM' : '▸ START THE TEAM ON DAY ONE'}
              </div>
              {showSignedIn ? (
                <>
                  <h2>Open the teams page.</h2>
                  <p>
                    Build your first team, attach a premium campaign,
                    generate a code, send it. You&apos;ll be operational
                    in under ten minutes.
                  </p>
                  <div className="tfaq-cta-row">
                    <Link href="/dashboard/teams" className="tfaq-btn-primary">
                      OPEN TEAMS →
                    </Link>
                    <Link href="/faq" className="tfaq-btn-secondary">
                      BACK TO FAQ
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h2>Get your team running this week.</h2>
                  <p>
                    MANAGER+ is $75/week. No contract. Cancel any time.
                    Use code MANAGERTEST for 100% off your first period
                    if you want to test-drive teams before committing.
                  </p>
                  <div className="tfaq-cta-row">
                    <Link href="/sign-up" className="tfaq-btn-primary">
                      START DIALING →
                    </Link>
                    <Link href="/faq" className="tfaq-btn-secondary">
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