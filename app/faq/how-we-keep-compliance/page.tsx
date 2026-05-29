import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import DialingModeCTA from '@/components/DialingModeCTA'
import ExplainerStyles from '@/components/ExplainerStyles'
import ExplainerCrossLinks from '@/components/ExplainerCrossLinks'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'How We Keep Compliance | DialerSeat',
  description:
    'The exact mechanisms DialerSeat uses to enforce TCPA and FTC TSR rules in software — calling-time windows, abandon-rate monitoring, auto-degrade, AMD, STIR/SHAKEN, and record retention.',
  alternates: { canonical: 'https://dialerseat.com/faq/how-we-keep-compliance' },
  openGraph: {
    title: 'How We Keep Compliance',
    description:
      'The compliance enforcement layer of DialerSeat, explained without marketing fluff. What runs in software, what falls on the seller, and how the auto-degrade controller actually works.',
    url: 'https://dialerseat.com/faq/how-we-keep-compliance',
    type: 'article',
  },
}

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="exp-root">
        <ExplainerStyles accent="#8a6a1a" accentBg="#fdf4e8" />

        <section className="exp-hero">
          <div className="exp-hero-inner">
            <Link href="/faq" className="exp-breadcrumb">← BACK TO FAQ</Link>
            <div className="exp-eyebrow">COMPLIANCE · HOW IT WORKS</div>
            <h1>How we keep compliance.</h1>
            <p className="exp-lead">
              The exact mechanisms DialerSeat uses to enforce TCPA and FTC
              TSR rules in software. The receipts page for the &quot;we
              take compliance seriously&quot; claim.
            </p>
          </div>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ THE PRINCIPLE</div>
          <h2>Compliance is the floor, not a feature.</h2>
          <p>
            Most dialers treat compliance settings the way airlines treat
            seat selection — technically available, but inconveniently
            buried, and you can opt out for any reason. We took the
            opposite approach. Every rule on this page is enforced at the
            <em> architecture</em> level, which means it&apos;s not a
            checkbox in a settings panel that someone can disable at 11 PM
            on a quarter-end deadline. It just happens.
          </p>
          <p>
            That principle is the whole point. If you&apos;d like the
            broader context — why these rules exist, who wrote them, and
            why so many incumbents treat the fines as a cost of doing
            business — read <Link href="/faq/why-is-compliance-important">
            why is compliance important?</Link> first.
          </p>
          <div className="exp-pullquote">
            The right way to evaluate a dialer&apos;s compliance posture
            isn&apos;t to ask whether it <em>can</em> be configured
            safely. It&apos;s to ask whether it <em>can</em> be configured
            unsafely. The fewer footguns the platform offers, the safer
            you are.
          </div>
        </section>

        <section className="exp-section alt">
          <div className="inner">
            <div className="exp-section-label">▸ THE MECHANISMS</div>
            <h2>Every rule, every enforcement point.</h2>

            <h3>1. Calling-time window enforcement</h3>
            <p>
              The TCPA prohibits outbound calls before 8 AM or after 9 PM
              in the called party&apos;s local time zone. Every lead in a
              DialerSeat campaign has a phone number; before every dial,
              we resolve that number to its time zone (via NPA/NXX lookup)
              and check the current local time at that lead&apos;s location.
            </p>
            <p>
              If the lead is currently outside its calling window, the
              dial doesn&apos;t fire. The lead gets a <code>TCPA_BLOCKED</code>
              disposition with the timestamp, and the campaign engine
              advances to the next eligible lead automatically. The agent
              doesn&apos;t have to think about it — and there&apos;s no
              setting to disable this.
            </p>

            <h3>2. Predictive abandon-rate monitoring</h3>
            <p>
              For predictive campaigns, the abandon rate is the number
              that matters. The FTC TSR caps abandoned calls at 3% of
              answered calls, measured on a rolling 30-day window. Cross
              that line and the safe harbor evaporates.
            </p>
            <p>
              Our pacing controller computes the rolling 30-day abandon
              rate continuously — recomputed every 5 seconds while a
              campaign is active. The live rate is displayed on the agent
              terminal so nobody has to log into an admin panel to see
              where they stand.
            </p>

            <h3>3. Auto-degrade at 2.5%</h3>
            <p>
              The legal cap is 3%, but waiting until you&apos;re at 3% to
              intervene is too late. When the rolling rate hits
              <strong> 2.5%</strong>, the controller automatically degrades
              the campaign to 1× lines per agent (effectively progressive
              mode). It stays degraded until the rate drops back below
              <strong> 2.0%</strong>, then resumes the configured
              multiplier.
            </p>
            <p>
              That 0.5% buffer is deliberate. It means a sudden answer-
              rate spike — caused by a bad list, a great script, or a
              statistical fluke — gets caught at 2.5% rather than at 3.1%.
              You should never see your campaign cross the legal threshold
              even under abnormal conditions.
            </p>

            <h3>4. The 8-agent multi-line gate</h3>
            <p>
              Predictive&apos;s mathematical advantage over progressive
              depends on having enough concurrent agents that statistical
              smoothing dampens variance. With 2 agents on a 2× campaign,
              you have 4 lines in flight; one unexpected pickup can spike
              your abandon rate dramatically. With 10 agents on a 2×
              campaign, you have 20 lines in flight; the same surprise
              event barely moves the needle.
            </p>
            <p>
              DialerSeat&apos;s predictive controller currently engages
              multi-line dialing only when 8+ concurrent agents are active
              on the campaign. Below that threshold, the campaign runs
              effectively as progressive even if predictive is configured.
              We surface this in the dialer with a banner so nobody is
              surprised.
            </p>

            <h3>5. AMD pre-screen on progressive and predictive</h3>
            <p>
              Answering Machine Detection runs on every progressive and
              predictive call by default, via SignalWire&apos;s native AMD.
              Machine-detected calls drop server-side and never reach an
              agent — which means the abandon-rate math isn&apos;t
              polluted by phantom &quot;answered&quot; calls that are just
              voicemail greetings.
            </p>
            <p>
              The AMD result is stored on every call record. <Link href="/faq/how-does-amd-work">
              How AMD works</Link> has the full breakdown.
            </p>

            <h3>6. Ring duration ≥ 15 seconds</h3>
            <p>
              Per § 310.4(b)(4)(i) of the TSR safe harbor, an unanswered
              call must ring for at least 15 seconds (or 4 rings) before
              being treated as no-answer. Our outbound calls are
              configured to honor this duration. Calls that ring through
              are not eligible for early disconnect.
            </p>

            <h3>7. Recorded notice on abandoned calls</h3>
            <p>
              When an abandoned call <em>does</em> occur — meaning a human
              answered and no agent was available within 2 seconds — the
              TSR safe harbor requires a brief recorded notice identifying
              the seller and the call&apos;s purpose, per § 310.4(b)(4)(iii).
              Every DialerSeat campaign has this configured by default with
              a sensible generic notice; campaign owners can customize the
              recording per campaign.
            </p>

            <h3>8. STIR/SHAKEN attestation</h3>
            <p>
              Outbound calls placed through DialerSeat go through SignalWire,
              which provides full A-level STIR/SHAKEN attestation. This is
              the carrier-level proof-of-identity that downstream carriers
              use to decide whether to label your call as spam, &quot;Likely
              Scam,&quot; etc. Full attestation doesn&apos;t eliminate
              spam-labeling risk, but it&apos;s the strongest available.
            </p>

            <h3>9. Records: 24 months minimum, exportable</h3>
            <p>
              Every dial attempt, AMD result, agent assignment, disposition,
              abandon event, calling-window skip, and recording is stored
              and retained for at least 24 months — the TSR&apos;s
              record-keeping floor. Records are exportable from your
              dashboard for compliance audits, internal QA, or any other
              reason you need them.
            </p>
          </div>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ HONEST DISCLOSURE</div>
          <h2>What we don&apos;t do for you.</h2>
          <p>
            Compliance is a layered problem. The list above covers the
            dialer-side layers — the parts that have to happen during the
            call itself, on the platform that places the call. There are
            other compliance layers that fall on you, the campaign owner,
            and which no dialer software can fully automate:
          </p>
          <div className="exp-cards">
            <div className="exp-card">
              <h3>CONSENT RECORDS</h3>
              <p>The seller is responsible for prior express written consent. We store consent metadata per-lead so you can show it on demand, but you supply the consent itself.</p>
            </div>
            <div className="exp-card">
              <h3>NATIONAL DNC SCRUBBING</h3>
              <p>You are responsible for scrubbing your list against the National DNC Registry before upload. We&apos;re evaluating commercial DNC integrations; not in yet.</p>
            </div>
            <div className="exp-card">
              <h3>LITIGATOR SCRUBBING</h3>
              <p>Commercial databases of known TCPA plaintiffs exist. Scrubbing against them is industry best practice for high-volume dialers. Not integrated yet.</p>
            </div>
            <div className="exp-card">
              <h3>STATE-SPECIFIC RULES</h3>
              <p>The 8 AM–9 PM window is federal. Several states impose stricter rules (call frequency caps, holiday restrictions, registration requirements). Those are on you.</p>
            </div>
          </div>
          <p style={{ marginTop: 24 }}>
            We list these openly because that&apos;s how we&apos;d want a
            platform to talk to us. A dialer that claims to handle every
            layer of compliance for you is either lying or charging you a
            lot more than $35/week.
          </p>
        </section>

        <section className="exp-section alt">
          <div className="inner">
            <div className="exp-section-label">▸ IN PRACTICE</div>
            <h2>Three scenarios.</h2>

            <h3>Scenario A: You upload a list at 11 AM ET</h3>
            <p>
              Your list contains 5,000 leads across all four U.S. time zones.
              When dialing starts, the system filters in real-time: leads
              currently in their local 8 AM–9 PM window are eligible, leads
              outside it are skipped with <code>TCPA_BLOCKED</code> and re-
              queued for when they enter their window. By 2 PM Pacific
              you&apos;ll have called a different mix than you did at 11 AM
              Eastern. The agent never thinks about it.
            </p>

            <h3>Scenario B: Predictive abandon rate spikes</h3>
            <p>
              You&apos;re running predictive at 2.0× with 6 agents. A
              campaign on a Tuesday afternoon hits an unusually high
              answer rate — maybe a fresh batch of warm leads dropped in —
              and your in-flight calls outpace agents being free. The
              30-day rolling abandon rate ticks up to 2.51%. Within 5
              seconds, the controller cuts you back to 1.0× lines. You
              keep dialing, but as progressive, not predictive. When the
              30-day average works its way back below 2.0%, you resume
              2.0× automatically.
            </p>

            <h3>Scenario C: You get an audit request</h3>
            <p>
              An attorney asks for records of every call placed to a
              specific phone number over the last 18 months. You filter the
              calls log to that number, see every dial timestamp, AMD
              result, agent who took the call, disposition, recording link,
              and any TCPA-window skips. Export the result to CSV; hand
              it over. You did the right things, you have the proof.
            </p>
          </div>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ THE BOTTOM LINE</div>
          <h2>The platform should make doing the right thing the default.</h2>
          <p>
            That&apos;s the design philosophy. Compliance shouldn&apos;t
            require expert knowledge of 16 CFR 310. It shouldn&apos;t
            require remembering to flip a switch. It shouldn&apos;t require
            trusting that your agents will check the lead&apos;s time zone
            before every dial. It should just be how the platform behaves.
          </p>
          <p>
            We obviously can&apos;t guarantee your compliance — that
            depends on what you actually do with the platform, what
            consent you have, what state you&apos;re calling into. But we
            can guarantee that the dialer itself won&apos;t be the reason
            you end up in trouble. That&apos;s the line we drew, and we
            held it.
          </p>
        </section>

        <ExplainerCrossLinks current="compliance-how" />

        <DialingModeCTA
          headline="Compliance you don't have to babysit."
          description="The 3% cap, the 8 AM–9 PM window, AMD, STIR/SHAKEN, 24-month records — enforced in software, not in policy docs. $35/week per seat, every mode included."
        />
      </main>
      <SiteFooter />
    </>
  )
}