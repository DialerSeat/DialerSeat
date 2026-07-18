import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import DialingModeCTA from '@/components/DialingModeCTA'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Progressive Dialer — The Middle Ground Between Power and Predictive | DialerSeat',
  description:
    'The progressive dialer: one line per agent with pre-screen voicemail detection. How it works, where it came from, and why it became the favorite of compliance-sensitive industries.',
  alternates: { canonical: 'https://dialerseat.com/dialing-modes/progressive' },
  openGraph: {
    title: 'The Progressive Dialer — Origins and Mechanics',
    description:
      'One line per agent, AMD pre-screens, agent only hears humans. The mode that emerged in the early 2000s as the safe middle ground between power and predictive.',
    url: 'https://dialerseat.com/dialing-modes/progressive',
    type: 'article',
  },
}

const MODE_COLOR = '#1a6a1a'
const MODE_BG = '#e8f5e8'

export default function ProgressiveDialerPage() {
  return (
    <>
      <SiteHeader />
      <main className="dm-root dm-progressive">
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
            color: #88c488;
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
            border: 1px solid #c8e4c8;
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
            <div className="dm-eyebrow">PROGRESSIVE DIALER</div>
            <h1>Power, but without the voicemails.</h1>
            <p className="dm-lead">
              One line per agent — same as power, same compliance profile —
              but the system listens to the pickup before connecting you. The
              answering machines never reach your ear. Born in the early
              2000s as the safe middle ground between power and predictive,
              it became the default in any vertical where one mistake could
              cost more than ten thousand connects.
            </p>
          </div>
        </section>

        {/* MECHANISM */}
        <section className="dm-section">
          <h2>How progressive dialing works</h2>
          <p>
            Progressive looks almost identical to power on paper, with one
            critical difference: the system makes the agent wait an extra
            second or two while answering-machine detection (AMD) decides
            whether the pickup is human. If it is, the agent gets connected.
            If it isn&apos;t, the call gets dropped and the queue advances
            silently.
          </p>
          <ol className="dm-steps">
            <li><div>Set yourself available, pick a campaign, click <em>Initiate Dial Sequence</em>.</div></li>
            <li><div>The system pulls the next lead and places the call — same as power.</div></li>
            <li><div>Phone rings. Pickup happens. <em>The agent doesn&apos;t hear it yet.</em></div></li>
            <li><div>AMD listens for the first ~1.5 seconds. It&apos;s checking the audio signature — humans say short greetings (&quot;Hello?&quot;); machines deliver long monologues (&quot;Hi, you&apos;ve reached...&quot;).</div></li>
            <li><div>If AMD detects a human, the system connects the agent and the lead profile pops on the screen. You jump in mid-greeting.</div></li>
            <li><div>If AMD detects a machine, the call is silently dropped and the queue advances. You never heard the voicemail.</div></li>
            <li><div>Loop.</div></li>
          </ol>
          <div className="dm-pullquote">
            The defining property of progressive is the <strong>AMD
            pre-screen</strong>. One line per agent (zero abandonment, like
            power), but the audio gets filtered through detection before
            reaching the agent. You only hear humans.
          </div>
        </section>

        {/* ORIGINS */}
        <section className="dm-section alt">
          <div className="inner">
            <h2>Where it came from</h2>
            <p>
              Progressive is the youngest of the four classical dialing
              modes. It didn&apos;t exist until two things came together in
              the late 1990s: cheap real-time DSP (digital signal processing)
              capable of running AMD in the cloud, and the
              regulatory shock of the FTC&apos;s Telemarketing Sales Rule.
            </p>
            <p>
              The TSR landed in its modern form in 2003 (revisions to 16 CFR
              Part 310), and the headline change was the 3% abandonment cap
              on predictive dialers. Overnight, predictive went from
              &quot;turn it up and let it run&quot; to a regulated activity
              that required active monitoring, abandon-rate accounting, and
              real legal exposure if you got it wrong.
            </p>
            <p>
              That left an obvious gap: shops that wanted the speed of
              auto-dialing but couldn&apos;t justify the compliance overhead
              of predictive. The answer that emerged from vendors like Noble
              Systems, Genesys, and CallTools in the early-to-mid 2000s was
              progressive — one line per agent (so abandonment is
              structurally impossible) plus AMD to chew through the
              voicemails that were eating power dialers alive.
            </p>
            <p>
              By the late 2000s, progressive had become the standard mode
              for insurance lead-gen, mortgage refi outreach, and any B2C
              vertical where the cost of a TCPA complaint dwarfed the
              throughput gain from predictive. It&apos;s still that today,
              mostly. AMD has gotten dramatically better — pre-dial
              SignalWire/Twilio detection in the 2020s is meaningfully more
              accurate than the early DSP attempts — but the shape of the
              mode hasn&apos;t changed.
            </p>
          </div>
        </section>

        {/* WHEN IT SHINES */}
        <section className="dm-section">
          <h2>When progressive wins</h2>
          <p>
            Progressive is the right call when you want power&apos;s pace
            without burning the day on voicemails, or when you&apos;re in a
            vertical where predictive feels too aggressive.
          </p>
          <div className="dm-shines-grid">
            <div className="dm-shines-card">
              <h4>INSURANCE LEAD-GEN</h4>
              <p>High voicemail rates kill power. Progressive cuts the machine wastage and keeps you within compliance lines all states recognize.</p>
            </div>
            <div className="dm-shines-card">
              <h4>MORTGAGE / REFI</h4>
              <p>Time-sensitive offers, B2C audience, heavy TCPA scrutiny. Progressive is the legacy industry default for exactly these reasons.</p>
            </div>
            <div className="dm-shines-card">
              <h4>SOLAR / HOME SERVICES</h4>
              <p>Lots of dial volume on warmer-but-not-warm lists. Progressive&apos;s AMD pre-screen is the productivity unlock.</p>
            </div>
            <div className="dm-shines-card">
              <h4>HEALTHCARE OUTREACH</h4>
              <p>Patient calls where compliance and tone matter. One line per agent is structurally safer; AMD avoids accidental message-on-machine TCPA issues.</p>
            </div>
            <div className="dm-shines-card">
              <h4>HIGH-VOICEMAIL LISTS</h4>
              <p>If you&apos;re hitting 40%+ voicemail on your campaigns, progressive saves you literal hours per agent per day.</p>
            </div>
            <div className="dm-shines-card">
              <h4>RAMPING TO PREDICTIVE</h4>
              <p>Many shops use progressive as the bridge: get the team comfortable with auto-advance and AMD, then move to predictive once volume justifies the pacing math.</p>
            </div>
          </div>
        </section>

        {/* TRADE-OFFS */}
        <section className="dm-section alt">
          <div className="inner">
            <h2>What you give up</h2>
            <p>
              The first second or two of the call. AMD needs to hear the
              pickup before it can decide. That means when the audio finally
              reaches your headset, the person on the other end has already
              said &quot;Hello&quot; — sometimes twice. Good agents adapt
              quickly (you open with &quot;Hi, this is Maria from...&quot;
              instead of waiting for them to speak), but it takes a session
              or two to get used to.
            </p>
            <p>
              You also give up some throughput vs predictive. Progressive is
              still one line per agent — if you have 10 ready agents, you
              have 10 outbound calls in flight at most. Predictive on the
              same campaign would have 15–30 lines in flight. For pure
              volume, predictive wins. For everything else, progressive
              wins.
            </p>
            <p>
              And AMD isn&apos;t perfect. False positives (humans flagged as
              machines and dropped) cost you connects. False negatives
              (machines that get through to the agent) cost you a few
              wasted seconds per call. The error rate is low — meaningfully
              under 5% on modern carriers — but it&apos;s not zero.
            </p>
          </div>
        </section>

        {/* ON DIALERSEAT */}
        <section className="dm-on-ds">
          <div className="inner">
            <h2>Progressive on DialerSeat</h2>
            <p>
              Switch any campaign to <em>PROGRESSIVE</em> from the mode tile
              in the dialer terminal. AMD enables automatically — that&apos;s
              the whole point of the mode.
            </p>
            <ul className="dm-bullets">
              <li>SignalWire AMD via the platform&apos;s native call answering analytics. Detects machine_start, machine_end_beep, machine_end_silence, machine_end_other, fax, and unknown.</li>
              <li>Machine-detected calls get dropped server-side. Agent sees a quick &quot;VOICEMAIL FILTERED&quot; log line, then the next lead loads.</li>
              <li>Auto-advance after disposition (you don&apos;t click between calls).</li>
              <li>One outbound line per agent. Zero abandonment risk by definition.</li>
              <li>TCPA window check before every dial.</li>
              <li>National DNC scrubbing is on you — scrub your list against the registry before you upload it. State-specific lists are on you too. See <Link href="/faq/how-we-keep-compliance">how we keep compliance</Link>.</li>
              <li>Per-call AMD result stored on the calls table for later analytics. You can see your true human-pickup rate by campaign.</li>
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
              <Link href="/dialing-modes/predictive" className="dm-other-card predictive">
                <span className="pill">PREDICTIVE</span>
                <h3>Multiple lines, agent prediction</h3>
                <p>1.5–3× lines per agent. Highest throughput, needs a team of 8+ to really engage, auto-degrade keeps it off the legal line.</p>
              </Link>
            </div>
          </div>
        </section>

        {/* CTA — auth-aware: signed-in → /dashboard/dialer, signed-out → /sign-up */}
        <DialingModeCTA
          headline="Try progressive on a voicemail-heavy list."
          description="If your current dialer is making you sit through six voicemails for every connect, progressive cuts that to zero. $35/week per seat, no contract."
        />
      </main>
      <SiteFooter />
    </>
  )
}