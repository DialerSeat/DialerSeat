import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import DialingModeCTA from '@/components/DialingModeCTA'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Preview Dialer — How It Works, Where It Came From, When To Use It | DialerSeat',
  description:
    'A deep look at the preview dialer: the original semi-automated outbound mode, dating back to 1970s telemarketing. Mechanism, history, use cases, and how it works on DialerSeat.',
  alternates: { canonical: 'https://dialerseat.com/dialing-modes/preview' },
  openGraph: {
    title: 'The Preview Dialer — Origins and Mechanics',
    description:
      'The original semi-automated outbound mode. One lead at a time, agent reviews first, agent clicks dial. Used since the 1970s in B2B, debt collection, and insurance.',
    url: 'https://dialerseat.com/dialing-modes/preview',
    type: 'article',
  },
}

const MODE_COLOR = '#5a5e6a'
const MODE_BG = '#f0f0f4'

export default function PreviewDialerPage() {
  return (
    <>
      <SiteHeader />
      <main className="dm-root dm-preview">
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
            background: radial-gradient(circle at 30% 30%, ${MODE_COLOR}33 0%, transparent 55%);
          }
          .dm-hero-inner { position: relative; max-width: 760px; margin: 0 auto; }
          .dm-eyebrow {
            display: inline-block;
            padding: 6px 14px;
            background: ${MODE_COLOR}26;
            border: 1px solid ${MODE_COLOR};
            border-radius: 4px;
            color: #c4c8d0;
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
            border: 1px solid #e4e6ec;
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
            color: ${MODE_COLOR};
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
          .dm-other-card:hover {
            transform: translateY(-2px);
          }
          .dm-other-card .pill {
            display: inline-block;
            padding: 3px 9px;
            font-size: 10px;
            letter-spacing: 2px;
            font-weight: bold;
            border-radius: 3px;
            margin-bottom: 8px;
          }
          .dm-other-card.power .pill { background: #e8eef8; color: #2a4a8a; border: 1px solid #2a4a8a; }
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
          .dm-cta h2 {
            font-size: 32px;
            margin: 0 0 14px 0;
          }
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
            <div className="dm-eyebrow">PREVIEW DIALER</div>
            <h1>The original outbound mode.</h1>
            <p className="dm-lead">
              One lead at a time. The agent reads first, then clicks dial.
              Slow by design — and that&apos;s exactly the point. It&apos;s
              the mode that built modern outbound sales, and it&apos;s still
              the right answer for a surprising number of campaigns.
            </p>
          </div>
        </section>

        {/* INTRO + MECHANISM */}
        <section className="dm-section">
          <h2>How preview dialing works</h2>
          <p>
            Preview is the simplest semi-automated dialer. There&apos;s no
            algorithm pacing anything, no lines fired in parallel, no
            voicemail detection deciding your fate. The agent stays in
            charge of every dial.
          </p>
          <ol className="dm-steps">
            <li><div>The system pulls the next lead from your campaign queue and displays it on your screen — name, phone number, location, any custom fields you uploaded with the list.</div></li>
            <li><div>You read it. Maybe glance at the LinkedIn, maybe re-read your last note, maybe pull up their account history. Take as long as you need.</div></li>
            <li><div>You click <em>Dial This Lead</em>. The outbound call goes out. You hear the ring.</div></li>
            <li><div>If a human answers: the call connects and you talk. If it&apos;s voicemail or no-answer, you hang up and disposition.</div></li>
            <li><div>The system pulls the next lead. Loop.</div></li>
          </ol>
          <div className="dm-pullquote">
            The defining property of preview is that <strong>nothing happens
            without the agent</strong>. No call leaves the system unless a
            human clicked dial. That single property is what makes preview
            the safest and the slowest dialing mode there is.
          </div>
        </section>

        {/* ORIGINS */}
        <section className="dm-section alt">
          <div className="inner">
            <h2>Where it came from</h2>
            <p>
              Preview dialing predates almost every other call-center
              concept you can name. In the 1970s, when telemarketing operations
              first started buying calling lists in bulk, the dialer was a
              human finger and a rotary phone. The first &quot;preview
              systems&quot; were just CRT terminals showing the next record
              from a mainframe-stored list while the agent dialed by hand.
            </p>
            <p>
              Through the 1980s and into the 1990s, as PC-based call-center
              software matured, the workflow stayed: <em>display the lead,
              wait for the agent, place the call, log the disposition</em>.
              The phone system was now picking up the dialing, but the
              human was still the trigger. This was &quot;agent-controlled
              dialing&quot; — the textbook term you&apos;ll find in old AT&amp;T
              and Aspect Communications documentation.
            </p>
            <p>
              When predictive and progressive modes arrived and started
              chasing throughput, preview stuck around because some industries
              fundamentally need the pause. Debt collectors had to review
              account histories before opening their mouths. Insurance
              agents had to confirm policy details. B2B sellers had to
              actually research the prospect. The slow mode never went away
              — it just got pushed up-market.
            </p>
            <p>
              Today preview is the default in collections, complex B2B, and
              any vertical where the call is too high-touch to start cold.
              It&apos;s also the mode most new agents start on, because it
              teaches you to read a lead before you talk to one.
            </p>
          </div>
        </section>

        {/* WHEN IT SHINES */}
        <section className="dm-section">
          <h2>When preview wins</h2>
          <p>
            Preview gets dismissed as &quot;the slow one&quot;, but it earns its
            place in any campaign where the cost of a bad opening is higher
            than the cost of a few extra seconds between dials.
          </p>
          <div className="dm-shines-grid">
            <div className="dm-shines-card">
              <h4>HIGH-TICKET B2B</h4>
              <p>Calling a VP of Sales without knowing what their company does is worse than not calling at all. Read first, then dial.</p>
            </div>
            <div className="dm-shines-card">
              <h4>DEBT COLLECTION</h4>
              <p>Account history, last contact date, payment plan status — you need all of it open before the conversation starts.</p>
            </div>
            <div className="dm-shines-card">
              <h4>INSURANCE RENEWALS</h4>
              <p>Coverage, deductible, last quote, family status. Walking in cold costs you the renewal.</p>
            </div>
            <div className="dm-shines-card">
              <h4>WARM FOLLOW-UPS</h4>
              <p>The lead already filled out a form or attended a webinar. Reviewing what they said before calling is the whole job.</p>
            </div>
            <div className="dm-shines-card">
              <h4>TRAINING</h4>
              <p>New agents on power or predictive flame out fast. Preview teaches you to read a lead before you talk to one.</p>
            </div>
            <div className="dm-shines-card">
              <h4>LOW-VOLUME LISTS</h4>
              <p>If your list is 200 leads, not 20,000, the speed difference doesn&apos;t matter. Use the time to do it right.</p>
            </div>
          </div>
        </section>

        {/* TRADE-OFFS */}
        <section className="dm-section alt">
          <div className="inner">
            <h2>What you give up</h2>
            <p>
              Throughput. Preview agents do somewhere between 5 and 15 dials
              per hour depending on call length and review time. Power
              dialers in the same hour will do 30–60. Predictive can push
              that into triple digits. If your campaign is volume-bound
              instead of context-bound, preview is the wrong tool.
            </p>
            <p>
              The other thing you give up is consistency. Two agents on the
              same list in preview mode can have wildly different pace
              depending on how thorough they are. That&apos;s a feature if
              you&apos;re paying for quality; it&apos;s a bug if you&apos;re
              paying for connects.
            </p>
          </div>
        </section>

        {/* ON DIALERSEAT */}
        <section className="dm-on-ds">
          <div className="inner">
            <h2>Preview on DialerSeat</h2>
            <p>
              Preview is available on every account, every campaign, every
              tier. There&apos;s no extra setting to enable it — just pick
              <em> PREVIEW</em> from the mode selector on the campaign or in
              the dialer terminal.
            </p>
            <ul className="dm-bullets">
              <li>Lead profile shows every custom field you uploaded with the list — not just name and phone.</li>
              <li>If the campaign has a script, it sits beside the profile so you can read both before dialing.</li>
              <li><em>Skip This Lead</em> dispositions cleanly and pulls the next one — no penalty for passing.</li>
              <li>Auto-pull next lead after disposition (toggle on/off in your settings).</li>
              <li>TCPA window check still runs — leads outside their local 8 AM–9 PM window are skipped automatically.</li>
              <li>DNC scrub before every dial. The agent never has to remember.</li>
            </ul>
          </div>
        </section>

        {/* OTHER MODES */}
        <section className="dm-other">
          <div className="inner">
            <h2>The other three modes</h2>
            <div className="dm-other-grid">
              <Link href="/dialing-modes/power" className="dm-other-card power">
                <span className="pill">POWER</span>
                <h3>Auto-dial, one line per agent</h3>
                <p>Click once, system handles the queue. Same compliance profile as preview, 2–3× the volume.</p>
              </Link>
              <Link href="/dialing-modes/progressive" className="dm-other-card progressive">
                <span className="pill">PROGRESSIVE</span>
                <h3>Auto-dial with voicemail filtering</h3>
                <p>One line per agent, but the system listens to the pickup. Voicemails never reach you.</p>
              </Link>
              <Link href="/dialing-modes/predictive" className="dm-other-card predictive">
                <span className="pill">PREDICTIVE</span>
                <h3>Multiple lines, agent prediction</h3>
                <p>1.5–3× lines per agent, routed by algorithm. Highest throughput, tightest compliance.</p>
              </Link>
            </div>
          </div>
        </section>

        {/* CTA — auth-aware: signed-in → /dashboard/dialer, signed-out → /sign-up */}
        <DialingModeCTA
          headline="Try it on a real list."
          description="Upload a CSV, pick preview mode, and dial. $35/week per seat, no contract. Cancel anytime."
        />
      </main>
      <SiteFooter />
    </>
  )
}