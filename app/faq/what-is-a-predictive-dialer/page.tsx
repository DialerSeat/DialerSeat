import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import DialingModeCTA from '@/components/DialingModeCTA'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Predictive Dialer — The 1980s Algorithm That Built Modern Call Centers | DialerSeat',
  description:
    'The predictive dialer: an algorithm that pre-dials multiple lines per agent and routes humans in real time. From its 1980s origin through the FTC TSR era to today.',
  alternates: { canonical: 'https://dialerseat.com/dialing-modes/predictive' },
  openGraph: {
    title: 'The Predictive Dialer — A Brief History',
    description:
      'Invented in the early 1980s, regulated in 2003, still the highest-throughput outbound mode in existence. Mechanism, history, math, and how DialerSeat implements it.',
    url: 'https://dialerseat.com/dialing-modes/predictive',
    type: 'article',
  },
}

const MODE_COLOR = '#8a1a1a'
const MODE_BG = '#f8e8e8'

export default function PredictiveDialerPage() {
  return (
    <>
      <SiteHeader />
      <main className="dm-root dm-predictive">
        <style>{`
          .dm-root, .dm-root * { box-sizing: border-box; }
          .dm-root {
            background: #f0f1f4;
            min-height: 100vh;
            font-family: 'Futura PT', Futura, sans-serif;
            color: #1a1c24;
          }
          .dm-hero {
            background: linear-gradient(135deg, #0a0a14 0%, #1a1a2e 100%);
            color: white;
            padding: 100px 32px 80px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .dm-hero::before {
            content: '';
            position: absolute; inset: 0;
            background: radial-gradient(circle at 30% 30%, ${MODE_COLOR}44 0%, transparent 55%);
          }
          .dm-hero-inner { position: relative; max-width: 760px; margin: 0 auto; }
          .dm-eyebrow {
            display: inline-block;
            padding: 6px 14px;
            background: ${MODE_COLOR}33;
            border: 1px solid ${MODE_COLOR};
            border-radius: 4px;
            color: #d49090;
            font-size: 11px;
            letter-spacing: 3px;
            font-weight: bold;
            margin-bottom: 24px;
          }
          .dm-hero h1 {
            font-size: 56px;
            font-weight: 800;
            letter-spacing: -1px;
            line-height: 1.05;
            margin: 0 0 20px 0;
          }
          .dm-lead {
            font-size: 18px;
            line-height: 1.55;
            color: #c4c8d8;
            max-width: 620px;
            margin: 0 auto;
          }
          .dm-section {
            max-width: 780px;
            margin: 0 auto;
            padding: 72px 32px;
          }
          .dm-section.alt { background: white; max-width: none; }
          .dm-section.alt > .inner {
            max-width: 780px;
            margin: 0 auto;
            padding: 0 32px;
          }
          .dm-section h2 {
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -0.4px;
            margin: 0 0 20px 0;
          }
          .dm-section h3 {
            font-size: 18px;
            font-weight: 700;
            margin: 24px 0 10px 0;
          }
          .dm-section p {
            font-size: 16px;
            line-height: 1.75;
            color: #2c3038;
            margin: 0 0 16px 0;
          }
          .dm-math {
            font-family: monospace;
            background: #1a1c24;
            color: #4a9eff;
            padding: 16px 20px;
            border-radius: 6px;
            font-size: 13px;
            line-height: 1.7;
            margin: 16px 0;
            white-space: pre-wrap;
          }
          .dm-steps {
            list-style: none;
            counter-reset: step;
            padding: 0;
            margin: 24px 0 0 0;
          }
          .dm-steps li {
            counter-increment: step;
            display: flex;
            gap: 16px;
            padding: 16px 0;
            border-top: 1px solid #e4e6ec;
          }
          .dm-steps li:first-child { border-top: none; }
          .dm-steps li::before {
            content: counter(step, decimal-leading-zero);
            font-family: monospace;
            font-size: 13px;
            font-weight: bold;
            color: ${MODE_COLOR};
            flex-shrink: 0;
            min-width: 32px;
          }
          .dm-steps li > div {
            font-size: 15px;
            line-height: 1.65;
            color: #2c3038;
          }
          .dm-shines-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 14px;
            margin-top: 24px;
          }
          .dm-shines-card {
            padding: 18px 20px;
            background: ${MODE_BG};
            border: 1px solid #e8c8c8;
            border-left: 3px solid ${MODE_COLOR};
            border-radius: 6px;
          }
          .dm-shines-card h4 {
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.5px;
            margin: 0 0 6px 0;
            color: ${MODE_COLOR};
          }
          .dm-shines-card p {
            font-size: 13px;
            line-height: 1.55;
            color: #2c3038;
            margin: 0;
          }
          .dm-pullquote {
            margin: 24px 0;
            padding: 20px 24px;
            background: ${MODE_BG};
            border-left: 3px solid ${MODE_COLOR};
            border-radius: 4px;
            font-size: 15px;
            line-height: 1.7;
            color: #1a1c24;
          }
          .dm-on-ds {
            background: linear-gradient(135deg, #0a0a14 0%, #1a1a2e 100%);
            color: white;
            padding: 72px 32px;
          }
          .dm-on-ds > .inner { max-width: 780px; margin: 0 auto; }
          .dm-on-ds h2 { color: white; }
          .dm-on-ds p { color: #c4c8d8; }
          .dm-on-ds .dm-bullets {
            list-style: none;
            padding: 0;
            margin: 20px 0 0 0;
          }
          .dm-on-ds .dm-bullets li {
            padding: 10px 0 10px 28px;
            font-size: 15px;
            line-height: 1.6;
            color: #d4d8e0;
            position: relative;
            border-top: 1px solid rgba(255,255,255,0.08);
          }
          .dm-on-ds .dm-bullets li:first-child { border-top: none; }
          .dm-on-ds .dm-bullets li::before {
            content: '→';
            color: #4a9eff;
            font-weight: bold;
            position: absolute;
            left: 0;
            top: 10px;
          }
          .dm-other {
            background: #f0f1f4;
            padding: 72px 32px;
          }
          .dm-other > .inner { max-width: 880px; margin: 0 auto; }
          .dm-other h2 {
            font-size: 22px;
            margin: 0 0 24px 0;
            text-align: center;
          }
          .dm-other-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 14px;
          }
          .dm-other-card {
            padding: 22px 20px;
            background: white;
            border: 1px solid #d8dce4;
            border-radius: 8px;
            text-decoration: none;
            color: #1a1c24;
            transition: transform 0.12s, border-color 0.12s;
          }
          .dm-other-card:hover { transform: translateY(-2px); }
          .dm-other-card .pill {
            display: inline-block;
            padding: 3px 9px;
            font-size: 10px;
            letter-spacing: 2px;
            font-weight: bold;
            border-radius: 3px;
            margin-bottom: 8px;
          }
          .dm-other-card.preview .pill { background: #f0f0f4; color: #5a5e6a; border: 1px solid #5a5e6a; }
          .dm-other-card.power .pill { background: #e8eef8; color: #2a4a8a; border: 1px solid #2a4a8a; }
          .dm-other-card.progressive .pill { background: #e8f5e8; color: #1a6a1a; border: 1px solid #1a6a1a; }
          .dm-other-card h3 {
            font-size: 16px;
            font-weight: 700;
            margin: 0 0 6px 0;
          }
          .dm-other-card p {
            font-size: 13px;
            line-height: 1.5;
            color: #5a5e6a;
            margin: 0;
          }
          .dm-cta {
            background: white;
            padding: 72px 32px;
            text-align: center;
          }
          .dm-cta h2 { font-size: 32px; margin: 0 0 14px 0; }
          .dm-cta p {
            font-size: 16px;
            color: #5a5e6a;
            max-width: 540px;
            margin: 0 auto 28px;
          }
          .dm-cta .btn-row {
            display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
          }
          .dm-btn-primary {
            padding: 14px 28px;
            background: linear-gradient(135deg, #4a9eff, #2a6eff);
            color: white;
            font-size: 12px;
            letter-spacing: 2.5px;
            font-weight: bold;
            border-radius: 8px;
            text-decoration: none;
          }
          .dm-btn-secondary {
            padding: 14px 28px;
            background: transparent;
            color: #1a1c24;
            border: 1px solid #c4c8d0;
            font-size: 12px;
            letter-spacing: 2.5px;
            font-weight: bold;
            border-radius: 8px;
            text-decoration: none;
          }
          @media (max-width: 768px) {
            .dm-hero { padding: 64px 20px 56px; }
            .dm-hero h1 { font-size: 36px; }
            .dm-lead { font-size: 15px; }
            .dm-section, .dm-section.alt > .inner, .dm-on-ds > .inner,
            .dm-other > .inner { padding-left: 20px; padding-right: 20px; }
            .dm-section { padding-top: 48px; padding-bottom: 48px; }
            .dm-section h2 { font-size: 26px; }
            .dm-shines-grid { grid-template-columns: 1fr; }
            .dm-other-grid { grid-template-columns: 1fr; }
            .dm-cta h2 { font-size: 26px; }
            .dm-btn-primary, .dm-btn-secondary { width: 100%; }
          }
        `}</style>

        {/* HERO */}
        <section className="dm-hero">
          <div className="dm-hero-inner">
            <div className="dm-eyebrow">PREDICTIVE DIALER</div>
            <h1>An algorithm dressed as a dialer.</h1>
            <p className="dm-lead">
              The predictive dialer doesn&apos;t ring one phone at a time. It
              fires a fan of outbound calls — 1.5, 2, sometimes 3 lines per
              ready agent — and routes whichever one a human picks up first.
              Invented in the early 1980s, regulated since 2003, and still
              the highest-throughput outbound mode in existence.
            </p>
          </div>
        </section>

        {/* MECHANISM */}
        <section className="dm-section">
          <h2>How predictive dialing works</h2>
          <p>
            Every dialing mode before this one was reactive. An agent
            triggers a call, the system places it, the agent waits. The
            queue is a pipeline of size one. Predictive breaks that. Instead
            of one line per agent, predictive runs a controller — a small
            algorithm that looks at how many agents are ready, how many
            calls are already in flight, and how many people typically
            answer — and fires <em>more</em> outbound calls than it has
            agents to handle.
          </p>
          <ol className="dm-steps">
            <li><div>Set yourself available, pick a campaign, click <em>Initiate Dial Sequence</em>. You enter the engine&apos;s pool of ready agents.</div></li>
            <li><div>The controller runs every few seconds. It checks: how many ready agents are there? How many calls are currently dialing or being detected? How aggressive is the configured pace?</div></li>
            <li><div>Based on that math (below), it fires N new outbound lines. Multiple lines per agent. The agents don&apos;t see anything happen yet.</div></li>
            <li><div>Each line goes through AMD on pickup. Machines, faxes, and unknowns get dropped silently.</div></li>
            <li><div>The first line where AMD says <em>human</em>, the system grabs the next ready agent and routes the call. That agent&apos;s screen pops with the lead profile mid-greeting.</div></li>
            <li><div>The other lines that connected to humans — if any — get the abandon treatment: ring then drop. Those count against the abandon-rate ceiling.</div></li>
            <li><div>The controller runs again. Refills the lines. The agent finishes the call, dispositions, returns to the ready pool. The engine pulls them into the next routed human within seconds.</div></li>
          </ol>
          <h3>The math</h3>
          <p>
            Every predictive controller is some variant of the same equation:
          </p>
          <div className="dm-math">{`target_lines = configured_multiplier        // e.g. 1.5x, 2.0x, 3.0x
desired_calls = active_agents * target_lines
in_flight = calls_currently_dialing
should_dial = max(0, desired_calls - in_flight)`}</div>
          <p>
            That&apos;s the entire core algorithm. The intelligence lives in
            picking the multiplier — too low and you&apos;re basically running
            progressive; too high and you blow the abandon-rate cap and the
            FTC eventually notices.
          </p>
          <div className="dm-pullquote">
            The defining property of predictive is <strong>multiple lines per
            agent</strong>. Everything else — the prediction math, the AMD,
            the abandon-rate monitoring — exists in service of making that
            structurally aggressive choice survive contact with the real
            world and the law.
          </div>
        </section>

        {/* ORIGINS */}
        <section className="dm-section alt">
          <div className="inner">
            <h2>Where it came from</h2>
            <p>
              The predictive dialer is older than most people think. One
              foundational US patent — Crockett et al.&apos;s
              &quot;Method for Predictive Dialing&quot; (US patent 4,829,563,
              granted May 1989) — formalized a prediction algorithm that
              much of the industry built on. Around the same time, Douglas
              A. Samuelson of InfoLogix independently developed a
              queuing-and-simulation approach to predictive dialing (his
              own patent, 4,858,120, covers the underlying pacing method),
              publishing the work in a 1999 <em>Interfaces</em> paper.
              Between them, these are the two names historians of the
              category point to. The mechanism itself predates both
              patents — mid-1980s call centers at large banks, retailers,
              and collection agencies were already running early predictive
              systems built on minicomputers and custom hardware.
            </p>
            <p>
              EIS International (acquired by SER Systems, which in turn
              became SER Solutions) was the early dominant vendor.
              Through the late 80s and early 90s, EIS sold predictive
              dialing systems that cost six figures and required dedicated
              hardware: T1 trunks, proprietary call-processing cards, and
              software running on Unix workstations. Aspect Communications
              followed with the Aspect CallCenter. Rockwell with the
              Spectrum. Davox (later Concerto, later part of Aspect) with
              the Unison. These were big boxes in big rooms in big call
              centers.
            </p>
            <p>
              The 1990s were the predictive dialer&apos;s wild west. Outbound
              call centers ran at abandon rates that today would generate
              an FTC investigation: 10%, 15%, sometimes 25% of calls
              dropped because no agent was free when a human picked up.
              The downstream consumer experience was, in the literal sense
              of the word, untenable: phones ringing across America, picked
              up, and met with silence or a click. The complaints piled up
              through the late 90s.
            </p>
            <p>
              The regulatory response landed in steps. The TCPA had passed
              in 1991 but didn&apos;t initially constrain predictive
              specifically. The FCC&apos;s 2003 implementing rules and the
              FTC&apos;s simultaneous Telemarketing Sales Rule revisions
              were what actually changed the industry. The TSR&apos;s
              16 CFR §310.4(b)(1)(iv) drew the line: <strong>no more than
              3% abandoned calls per 30-day window per campaign</strong>,
              measured against answered calls. If a human picks up and no
              agent is available within 2 seconds of the greeting, that&apos;s
              an abandoned call.
            </p>
            <p>
              Everything since has been some adaptation to that 3% cap.
              Better AMD to avoid wasting lines on voicemails. Smarter
              pacing algorithms that back off when abandon rate creeps up.
              Server-side controllers that monitor abandon rate in real
              time and degrade the multiplier automatically before any
              human in the loop notices a problem.
            </p>
            <p>
              The market itself consolidated through the 2000s. EIS folded
              into SER, SER into other vendors. Aspect, Avaya, Genesys
              became the enterprise players. A second tier — Five9,
              Noble Systems, CallTools, ReadyMode, Convoso — grew up to
              serve the mid-market. By the 2010s, predictive had moved off
              the on-prem boxes and onto cloud platforms, but the
              underlying idea is still the same pacing math Crockett and
              Samuelson separately worked out in the late &apos;80s.
            </p>
          </div>
        </section>

        {/* WHEN IT SHINES */}
        <section className="dm-section">
          <h2>When predictive wins</h2>
          <p>
            Predictive earns its keep when volume is the constraint, not
            quality, and when you have enough agents on the same campaign
            for the math to work.
          </p>
          <div className="dm-shines-grid">
            <div className="dm-shines-card">
              <h4>HIGH-VOLUME B2C</h4>
              <p>Big consumer lead lists where every minute of agent talk time produces revenue. This is the home turf.</p>
            </div>
            <div className="dm-shines-card">
              <h4>TEAMS OF 8+</h4>
              <p>DialerSeat&apos;s predictive controller engages true multi-line dialing at 8+ concurrent agents on a campaign — below that threshold it runs as progressive-equivalent so a small surprise in pickups can&apos;t spike your abandon rate.</p>
            </div>
            <div className="dm-shines-card">
              <h4>ESTABLISHED CAMPAIGNS</h4>
              <p>You know your historical contact and pickup rates. The controller tunes itself faster on data it&apos;s seen before.</p>
            </div>
            <div className="dm-shines-card">
              <h4>THIN-MARGIN OUTBOUND</h4>
              <p>Lead-gen at scale, debt buying, opt-in B2C — anywhere unit economics demand 35+ talk-minutes per agent-hour.</p>
            </div>
            <div className="dm-shines-card">
              <h4>FRESH LISTS</h4>
              <p>Pickup rates are higher on fresh data. Predictive captures the contact-rate spike before the list cools off.</p>
            </div>
            <div className="dm-shines-card">
              <h4>MULTI-SHIFT OPERATIONS</h4>
              <p>Day-shift, evening-shift, weekend coverage. Predictive&apos;s pace lets you cover more list per shift without burning out the agents.</p>
            </div>
          </div>
        </section>

        {/* TRADE-OFFS */}
        <section className="dm-section alt">
          <div className="inner">
            <h2>What you give up</h2>
            <p>
              Calm. Predictive is by design an over-dialing system. It&apos;s
              firing more calls than it has agents to answer, and trusting
              that probability and AMD will sort it out. The system feels
              busy. When the math tips even slightly wrong — a busy spell of
              high-pickup minutes, a slow disposition cycle on a hard call —
              you can hear it in the abandon-rate counter ticking up.
            </p>
            <p>
              You also give up a clean conscience about the dropped calls.
              Even a perfectly-tuned predictive campaign is going to abandon
              some calls. The legal cap is 3%, the practical target is
              1–2%, and that means out of every 100 humans who pick up, one
              or two of them hear silence and a click. That&apos;s the
              tradeoff that bought you the throughput, and there&apos;s no
              way around it.
            </p>
            <p>
              Predictive also requires real agents on real schedules.
              You can&apos;t flip predictive on at noon, walk away for
              twenty minutes, and have it gracefully recover. The
              controller wants steady state. Agents flickering in and out
              of available causes pacing oscillation. Predictive likes
              shifts; preview and power don&apos;t care.
            </p>
          </div>
        </section>

        {/* ON DIALERSEAT */}
        <section className="dm-on-ds">
          <div className="inner">
            <h2>Predictive on DialerSeat</h2>
            <p>
              Predictive on DialerSeat is built around one principle: the
              system should never let you blow past the legal cap, even if
              you&apos;re not watching. The controller monitors abandon
              rate in real time and auto-degrades long before you would
              notice a problem.
            </p>
            <ul className="dm-bullets">
              <li>Per-campaign lines-per-agent setting (1–5). Default 1.5–3 depending on campaign maturity.</li>
              <li>Per-agent lines override. If you want to run 1.5 while the rest of the team runs 2.0, you can.</li>
              <li>Server-side controller fires lines on a 5-second heartbeat. Predictable cadence, no client-side guesswork.</li>
              <li>30-day rolling abandon-rate calculation per campaign, recomputed every controller tick.</li>
              <li>Auto-degrade at 2.5% — the engine drops to 1× lines (progressive-equivalent) before you hit the 3% legal cap.</li>
              <li>Recovery threshold at 2.0% — stays degraded with a 0.5% safety buffer until the rate clearly drops.</li>
              <li>Live abandon-rate display in the agent terminal so you always know where the campaign is sitting.</li>
              <li>AMD pre-screen so machine pickups never count as abandons against your number.</li>
              <li>TCPA window check on every dial. CNAM-aware caller-ID routing. National DNC scrubbing is still on you — see <Link href="/faq/how-we-keep-compliance">how we keep compliance</Link> for the full split.</li>
            </ul>
          </div>
        </section>

        {/* OTHER MODES */}
        <section className="dm-other">
          <div className="inner">
            <h2>The other three modes</h2>
            <div className="dm-other-grid">
              <Link href="/dialing-modes/preview" className="dm-other-card preview">
                <span className="pill">PREVIEW</span>
                <h3>Agent reviews, then dials</h3>
                <p>The original outbound mode. Slow by design — right for high-touch, high-value calls.</p>
              </Link>
              <Link href="/dialing-modes/power" className="dm-other-card power">
                <span className="pill">POWER</span>
                <h3>Auto-dial, one line per agent</h3>
                <p>The inside-sales workhorse since the mid-1990s. Faster than preview, simpler than progressive.</p>
              </Link>
              <Link href="/dialing-modes/progressive" className="dm-other-card progressive">
                <span className="pill">PROGRESSIVE</span>
                <h3>Auto-dial with voicemail filtering</h3>
                <p>Same compliance profile as power, but AMD pre-screens the pickup. Humans only.</p>
              </Link>
            </div>
          </div>
        </section>

        {/* CTA — auth-aware: signed-in → /dashboard/dialer, signed-out → /sign-up */}
        <DialingModeCTA
          headline="Run predictive without losing sleep over abandon rate."
          description="The controller does the math. Auto-degrades before you hit the FTC cap. Live abandon-rate display in the terminal. $35/week per seat, no contract."
        />
      </main>
      <SiteFooter />
    </>
  )
}