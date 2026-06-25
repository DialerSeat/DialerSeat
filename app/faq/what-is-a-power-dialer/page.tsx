import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import DialingModeCTA from '@/components/DialingModeCTA'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Power Dialer — History, Mechanics, and the Click-to-Dial Era | DialerSeat',
  description:
    'The power dialer: one line per agent, auto-advance, and the workhorse of inside sales since the mid-1990s. How it works, where it came from, when to use it.',
  alternates: { canonical: 'https://dialerseat.com/dialing-modes/power' },
  openGraph: {
    title: 'The Power Dialer — Origins and Mechanics',
    description:
      'One line per agent, queue-driven, auto-advancing. The mode that defined inside sales from 1995 onward. Mojo, PhoneBurner, Aspect — they all started here.',
    url: 'https://dialerseat.com/dialing-modes/power',
    type: 'article',
  },
}

const MODE_COLOR = '#2a4a8a'
const MODE_BG = '#e8eef8'

export default function PowerDialerPage() {
  return (
    <>
      <SiteHeader />
      <main className="dm-root dm-power">
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
            color: #9ab4e0;
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
          .dm-section p {
            font-size: 16px;
            line-height: 1.75;
            color: #2c3038;
            margin: 0 0 16px 0;
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
            border: 1px solid #d4dceb;
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
          .dm-other-card.progressive .pill { background: #e8f5e8; color: #1a6a1a; border: 1px solid #1a6a1a; }
          .dm-other-card.predictive .pill { background: #f8e8e8; color: #8a1a1a; border: 1px solid #8a1a1a; }
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
            <div className="dm-eyebrow">POWER DIALER</div>
            <h1>The workhorse of inside sales.</h1>
            <p className="dm-lead">
              One line per agent, queue-driven, auto-advancing. If you&apos;ve
              ever heard the words <em>&quot;click-to-dial&quot;</em> on a sales
              floor, you&apos;ve heard the power dialer. It&apos;s the mode
              that defined outbound from 1995 onward and still does the
              majority of the work in B2B and SDR shops.
            </p>
          </div>
        </section>

        {/* MECHANISM */}
        <section className="dm-section">
          <h2>How power dialing works</h2>
          <p>
            Power is preview&apos;s faster sibling. The agent still triggers
            the run, but once started the system stops asking permission
            between calls. You click once, it dials forever — or until you
            stop it.
          </p>
          <ol className="dm-steps">
            <li><div>Set yourself available, pick a campaign, click <em>Initiate Dial Sequence</em>.</div></li>
            <li><div>The system pulls the next lead from the queue and immediately places the call. The lead profile appears on your screen as the phone rings.</div></li>
            <li><div>Phone rings. You wait. If a human answers, you talk. If voicemail or no-answer, the system can drop the call and move on (or pop disposition first, depending on settings).</div></li>
            <li><div>After hangup or disposition, the queue advances. The next lead pulls automatically. No clicking required.</div></li>
            <li><div>Loop forever, or until you set yourself offline.</div></li>
          </ol>
          <div className="dm-pullquote">
            The defining property of power is <strong>one outbound line per
            agent</strong>. The system never has more calls in flight than it
            has people to answer them. Throughput goes up, compliance profile
            stays identical to preview.
          </div>
        </section>

        {/* ORIGINS */}
        <section className="dm-section alt">
          <div className="inner">
            <h2>Where it came from</h2>
            <p>
              The power dialer is a 1990s invention. Through the 1980s, big
              call centers had been running predictive systems (more on those
              later), but predictive required serious hardware — Aspect
              CallCenter, Rockwell Spectrum, EIS dialers — and serious
              compliance discipline. Smaller shops couldn&apos;t afford either.
            </p>
            <p>
              What smaller shops <em>could</em> afford, by the mid-1990s,
              was a PC running early CRM software (ACT!, GoldMine, Maximizer)
              with a TAPI or modem dial-out integration. Click a contact in
              the CRM, the modem dials the number, the agent picks up the
              handset. That was the seed. It got formalized as
              &quot;click-to-dial&quot; by Avaya and similar vendors and
              quickly evolved into queue-driven workflows — the system
              wouldn&apos;t just dial when clicked, it would auto-pull from a
              list.
            </p>
            <p>
              The term &quot;power dialer&quot; came from the marketing
              departments of vendors trying to differentiate this faster
              mode from manual without claiming it was predictive. Mojo
              Dialer (founded 2001, with VoIP from around 2008) and
              PhoneBurner (2008) brought it down-market to solo agents and
              small teams in the 2010s. By then, predictive had become a
              big-shop tool and power had become the default for everyone
              else.
            </p>
            <p>
              The mode hasn&apos;t fundamentally changed in 25 years. What
              changed around it is everything else: lead lists in cloud
              CRMs, dialer audio over WebRTC instead of a desk phone, and
              answering-machine detection (AMD) that&apos;s good enough to
              meaningfully cut wasted time on voicemails.
            </p>
          </div>
        </section>

        {/* WHEN IT SHINES */}
        <section className="dm-section">
          <h2>When power wins</h2>
          <p>
            Power is the right default for most outbound. It&apos;s faster
            than preview, safer than predictive, and works with a team of one.
          </p>
          <div className="dm-shines-grid">
            <div className="dm-shines-card">
              <h4>SDR TEAMS</h4>
              <p>Inside sales reps qualifying leads. You need volume, you need to read the lead while it rings, you don&apos;t need predictive pacing.</p>
            </div>
            <div className="dm-shines-card">
              <h4>SOLO AGENTS</h4>
              <p>Predictive needs multiple agents to make sense. Power is the most efficient mode you can run alone.</p>
            </div>
            <div className="dm-shines-card">
              <h4>B2B COLD CALLING</h4>
              <p>Calling businesses with mid-quality lists. You want speed without dropping calls — power handles that.</p>
            </div>
            <div className="dm-shines-card">
              <h4>WARM B2C FOLLOW-UPS</h4>
              <p>Leads opted in, you have context, you don&apos;t need predictive throughput. Power keeps it personal but fast.</p>
            </div>
            <div className="dm-shines-card">
              <h4>SMALL TEAMS (2-4)</h4>
              <p>Below the threshold where predictive math actually pays off, but above where preview is too slow. Power is the sweet spot.</p>
            </div>
            <div className="dm-shines-card">
              <h4>COMPLIANCE-SENSITIVE LISTS</h4>
              <p>Zero abandonment risk by design — one line per agent. You stay 100% within FTC and TCPA rules without thinking about it.</p>
            </div>
          </div>
        </section>

        {/* TRADE-OFFS */}
        <section className="dm-section alt">
          <div className="inner">
            <h2>What you give up</h2>
            <p>
              The dead time during ring. A power agent spends real seconds
              waiting on each ring. On a list with a 25% pickup rate, three
              out of four dials are time you&apos;ll never get back. Add a
              few seconds per disposition, and your effective talk time
              floats around 15–20 minutes per hour.
            </p>
            <p>
              The other thing power gives up is voicemail filtering — by
              default. If you&apos;re hitting answering machines on every
              third dial and you don&apos;t have AMD running, you&apos;re
              going to hear the same robotic &quot;Hi, you&apos;ve reached
              ...&quot; ten thousand times before the year is out. (DialerSeat
              runs AMD by default in power mode for this exact reason.)
            </p>
          </div>
        </section>

        {/* ON DIALERSEAT */}
        <section className="dm-on-ds">
          <div className="inner">
            <h2>Power on DialerSeat</h2>
            <p>
              Power is the default mode for new campaigns. Pick it and you&apos;re
              dialing — no per-campaign tuning required.
            </p>
            <ul className="dm-bullets">
              <li>AMD on by default. Voicemails get detected and dropped; the queue advances automatically.</li>
              <li>Auto-advance after disposition — no clicking between calls once you&apos;re going.</li>
              <li>One outbound line per agent. Zero abandonment possible. No FTC exposure.</li>
              <li>TCPA window enforcement per lead&apos;s local time zone. No 6 AM Pacific dials to East Coast leads.</li>
              <li>DNC scrub on every dial — both federal and state lists.</li>
              <li>Keyboard shortcuts for disposition so you keep your hands on the keys, not the mouse.</li>
              <li>Live duration timer, connected-rate counter, and per-session metrics in the right sidebar.</li>
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
              <Link href="/dialing-modes/progressive" className="dm-other-card progressive">
                <span className="pill">PROGRESSIVE</span>
                <h3>Auto-dial with voicemail filtering</h3>
                <p>Same compliance profile as power, but the system listens to the pickup and drops machines.</p>
              </Link>
              <Link href="/dialing-modes/predictive" className="dm-other-card predictive">
                <span className="pill">PREDICTIVE</span>
                <h3>Multiple lines, agent prediction</h3>
                <p>1.5–3× lines per agent. Highest throughput, tightest compliance, needs a team.</p>
              </Link>
            </div>
          </div>
        </section>

        {/* CTA — auth-aware: signed-in → /dashboard/dialer, signed-out → /sign-up */}
        <DialingModeCTA
          headline="Start with power. Switch later if you want."
          description="Every account gets every mode. Pick power, start dialing, and change your mind any time. $35/week per seat, no contract."
        />
      </main>
      <SiteFooter />
    </>
  )
}