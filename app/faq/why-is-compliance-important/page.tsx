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
  title: 'Why Is Compliance Important? (And Why Legacy Dialers Don\'t Care) | DialerSeat',
  description:
    'Telemarketing compliance isn\'t a nice-to-have. The FTC can write checks north of $53,000 per violation. Here\'s why it matters, and why most dialers treat it as someone else\'s problem.',
  alternates: { canonical: 'https://dialerseat.com/faq/why-is-compliance-important' },
  openGraph: {
    title: 'Why Is Compliance Important?',
    description:
      'A light-hearted look at why telemarketing compliance matters — and why so many dialers can\'t be bothered.',
    url: 'https://dialerseat.com/faq/why-is-compliance-important',
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
          <div className="exp-hero-inner">            <div className="exp-eyebrow">EXPLAINER · COMPLIANCE</div>
            <h1>Why is compliance important?</h1>
            <p className="exp-lead">
              Because the FTC has been writing checks with a lot of zeros
              on them for over twenty years, and it&apos;s not going to
              stop just because your dialer&apos;s out of date.
            </p>
          </div>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ THE REAL ANSWER</div>
          <h2>Because the fines are real, and they flow downhill.</h2>
          <p>
            Telemarketing in the U.S. is governed by two big rules: the
            <strong> TCPA</strong> (the law that says you can&apos;t auto-
            dial someone&apos;s cell phone without consent) and the
            <strong> FTC Telemarketing Sales Rule</strong> (the one that
            caps abandoned calls at 3% and says you can&apos;t call before
            8 AM or after 9 PM in the lead&apos;s time zone, among other
            things).
          </p>
          <p>
            Break them, and the penalties are not small. TCPA: $500–$1,500
            <em> per call</em>. TSR: up to $53,088 per violation, the
            FTC&apos;s current inflation-adjusted maximum as of January
            2025. When the FTC settles with a serial offender, the numbers
            tend to have a lot of zeros. There have been individual
            settlements over $200 million in the last decade. There have
            been settlements over $500 million.
          </p>
          <div className="exp-pullquote">
            The bill always lands somewhere. The dialer platform might get
            sued. The seller might get sued. The downstream agent who
            actually placed the call might get sued. Compliance isn&apos;t
            theoretical and it&apos;s not optional.
          </div>
        </section>

        <section className="exp-section alt">
          <div className="inner">
            <div className="exp-section-label">▸ WHAT THE RULES ACTUALLY SAY</div>
            <h2>The short list.</h2>
            <div className="exp-cards">
              <div className="exp-card">
                <h3>3% ABANDON CAP</h3>
                <p>If you&apos;re running predictive, you cannot abandon more than 3% of answered calls over any 30-day rolling window. FTC rule. Not negotiable.</p>
              </div>
              <div className="exp-card">
                <h3>8 AM – 9 PM LOCAL</h3>
                <p>No outbound calls outside that window in the called party&apos;s time zone. Some states are stricter. We enforce this automatically.</p>
              </div>
              <div className="exp-card">
                <h3>DNC SCRUBBING</h3>
                <p>You can&apos;t call numbers on the National Do Not Call Registry. Your responsibility as the seller to scrub before upload.</p>
              </div>
              <div className="exp-card">
                <h3>PRIOR EXPRESS WRITTEN CONSENT</h3>
                <p>Consent has to be in writing, signed, and clearly disclosed. (A stricter &quot;one-to-one&quot; rule almost took effect in January 2025 but was struck down by the courts days before it started — worth watching in case the FCC tries again.)</p>
              </div>
              <div className="exp-card">
                <h3>STIR/SHAKEN</h3>
                <p>Carriers now attest to whether outbound calls are legitimate. We provision through SignalWire with full attestation enabled.</p>
              </div>
              <div className="exp-card">
                <h3>RECORDED NOTICE ON ABANDON</h3>
                <p>If an abandoned call <em>does</em> happen, the seller must be identified via a brief recorded notice. We play this automatically.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ THE AWKWARD PART</div>
          <h2>Why most legacy dialers don&apos;t really care.</h2>
          <p>
            Here&apos;s the thing nobody in this industry wants to say out
            loud: a lot of the big-name legacy dialers <em>can</em> run
            non-compliant configurations. Some of them ship by default
            with abandon rates well above 3%. Some don&apos;t enforce the
            calling-time window in software — they leave it up to the
            campaign owner to remember. Some make AMD an optional add-on.
          </p>
          <p>
            Why? Because they&apos;re big enough to absorb the occasional
            fine, and because the actual liability tends to land on the
            seller, not the platform. They have lawyers on retainer.
            They&apos;ve been doing this for fifteen years. The fines are
            a line item.
          </p>
          <p>
            That&apos;s not a moral failing — it&apos;s a business decision
            with measurable trade-offs. But the trade-off works for
            <em> them</em>, not necessarily for <em>you</em>. If a class-
            action TCPA suit lands on your campaign, &quot;my dialer let me
            do it&quot; is not a defense that holds up in court.
          </p>
          <div className="exp-pullquote">
            The right way to read this: if your dialer&apos;s default
            settings let you abandon 5% of calls, that&apos;s not because
            the law is gray. That&apos;s because someone made a choice. We
            think it&apos;s the wrong choice.
          </div>
        </section>

        <section className="exp-section alt">
          <div className="inner">
            <div className="exp-section-label">▸ HOW WE&apos;RE DIFFERENT</div>
            <h2>Compliance baked in, not bolted on.</h2>
            <p>
              We built DialerSeat with compliance enforcement at the
              architecture level, not as a configurable feature you can
              turn off when nobody&apos;s looking.
            </p>
            <div className="exp-cards">
              <div className="exp-card">
                <h3>HARD 8 AM – 9 PM ENFORCEMENT</h3>
                <p>Every outbound call checks the lead&apos;s local time zone before it fires. Outside the window? Skipped, with a TCPA_BLOCKED disposition. You don&apos;t have to remember.</p>
              </div>
              <div className="exp-card">
                <h3>AUTO-DEGRADE AT 2.5%</h3>
                <p>Predictive abandon-rate monitoring runs every 5 seconds. Hit 2.5% on the rolling 30-day window and the controller cuts you back to 1× lines automatically.</p>
              </div>
              <div className="exp-card">
                <h3>AMD ON BY DEFAULT</h3>
                <p>Progressive and predictive get AMD pre-screen automatically. The recorded notice on abandoned calls is configured per campaign with a sensible default already in place.</p>
              </div>
              <div className="exp-card">
                <h3>FULL RECORDS, 24 MONTHS</h3>
                <p>Every dial, every AMD result, every disposition, every abandon — stored and exportable. The TSR&apos;s 24-month record-keeping requirement is handled.</p>
              </div>
            </div>
            <p style={{ marginTop: 24 }}>
              We&apos;re also transparent about what we <em>don&apos;t</em>
              do for you: DNC scrubbing is still the seller&apos;s
              responsibility, and consent records are too. We&apos;ve
              written about that split honestly on the{' '}
              <Link href="/faq/how-we-keep-compliance">how we keep
              compliance page</Link>.
            </p>
          </div>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ THE TAKEAWAY</div>
          <h2>Pick a dialer that takes the rules seriously.</h2>
          <p>
            Compliance isn&apos;t a feature you should be excited about.
            It&apos;s the cost of being allowed to do outbound at all. The
            dialers that treat it like an afterthought are betting that
            the bill won&apos;t come — and that if it does, it&apos;ll land
            on you, not them.
          </p>
          <p>
            We&apos;d rather build it correctly the first time. It&apos;s
            cheaper for everyone involved, and it lets us sleep at night.
          </p>
        </section>

        <ExplainerCrossLinks current="compliance-why" />

        <DialingModeCTA
          headline="Compliance shouldn't be the thing that wakes you up at 3 AM."
          description="We enforce the rules in software so you don't have to remember them. $35/week per seat, every mode included, no contract."
        />
      </main>
      <SiteFooter />
    </>
  )
}