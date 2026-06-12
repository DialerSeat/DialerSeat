import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import DialingModeCTA from '@/components/DialingModeCTA'
import ExplainerStyles from '@/components/ExplainerStyles'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Why We Charge What We Charge | DialerSeat',
  description:
    '$35 per week per seat, all-in. Unlimited dial-out numbers, multiple inbound numbers, every dialer mode, no per-minute charges. Here\'s why we can price this way — and what most "cheaper" dialers actually cost.',
  alternates: { canonical: 'https://dialerseat.com/faq/why-we-charge' },
  openGraph: {
    title: 'Why we charge what we charge.',
    description:
      'The breakdown on $35/week per seat — what\'s included, what competitors charge extra for, and why we can keep it flat.',
    url: 'https://dialerseat.com/faq/why-we-charge',
    type: 'article',
  },
}

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="exp-root">
        <ExplainerStyles accent="#1a6a1a" accentBg="#e8f5e8" />

        <section className="exp-hero">
          <div className="exp-hero-inner">
            <Link href="/faq" className="exp-breadcrumb">← BACK TO FAQ</Link>
            <div className="exp-eyebrow">EXPLAINER · PRICING</div>
            <h1>Why we charge what we charge.</h1>
            <p className="exp-lead">
              $35 a week, per seat. Unlimited dial-out numbers, multiple
              inbound numbers, every dialer mode, no per-minute charges.
              Here&apos;s why we can price this way — and what most
              &ldquo;cheaper&rdquo; dialers actually cost you once you
              stack the add-ons.
            </p>
          </div>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ THE SHORT VERSION</div>
          <h2>One weekly price. Everything included.</h2>
          <p>
            Most outbound dialers price like a software subscription and
            then charge you separately for everything that makes a dialer
            actually work — phone numbers, minutes used, voicemail
            detection, recording storage, additional agents. By the time
            you finish stacking add-ons, a &ldquo;$99 / month&rdquo; plan
            often runs $300–$600 a month per agent.
          </p>
          <p>
            DialerSeat bundles all of that into one weekly price. Every
            seat includes <strong>unlimited dial-out numbers</strong>,
            <strong> multiple inbound numbers</strong>, unmetered
            outbound minutes, voicemail detection, recording, all four
            dialer modes, and analytics. No metered minutes. No
            per-number fees. No tiered feature gates. One seat, one
            number, one price — or as many of each as you need, all
            included.
          </p>
        </section>

        <section className="exp-section alt">
          <div className="inner">
            <div className="exp-section-label">▸ COMMON QUESTIONS</div>
            <h2>What people actually want to know.</h2>

            <div className="exp-qa">
              <details>
                <summary>What&apos;s included in $35 / week?</summary>
                <div className="answer">
                  <p>The full feature set. Same on every account:</p>
                  <p>
                    <strong>All four dialer modes</strong> — preview,
                    power, progressive, predictive. No mode gated behind
                    a higher tier.
                  </p>
                  <p>
                    <strong>Unlimited dial-out numbers.</strong> Any area
                    code. Rotate them automatically. Burn one if it gets
                    flagged and spin up a fresh one — no charge, no
                    quota.
                  </p>
                  <p>
                    <strong>Multiple inbound numbers</strong> per seat.
                    Hand out different numbers for different lead
                    sources, different campaigns, different markets.
                  </p>
                  <p>
                    <strong>Automatic voicemail detection.</strong> See
                    <Link href="/faq/how-does-amd-work"> how AMD works</Link>.
                  </p>
                  <p>
                    <strong>Call recording + storage.</strong> No
                    per-minute archival fees.
                  </p>
                  <p>
                    <strong>Unmetered outbound minutes.</strong> Dial as
                    much as you want.
                  </p>
                  <p>
                    <strong>Lead management</strong> with CSV import,
                    custom fields, dispositions, notes.
                  </p>
                  <p>
                    <strong>Analytics</strong> — contact rate, talk time,
                    best-time-to-call, per-campaign / per-agent / per-number.
                  </p>
                  <p>
                    <strong>Teams + role-based access</strong> for
                    Manager+ accounts. Full breakdown on the
                    <Link href="/faq/dialerseat-teams"> Teams FAQ</Link>.
                  </p>
                  <p>
                    <strong>No contract.</strong> Cancel anytime from
                    settings.
                  </p>
                </div>
              </details>

              <details>
                <summary>Show me the math vs a typical competitor.</summary>
                <div className="answer">
                  <p>
                    Take a typical &ldquo;$99/month&rdquo; dialer. By the
                    time you add the things you actually need to use it:
                  </p>
                  <p>
                    Base plan: <strong>$99/mo</strong>. Add 10 phone
                    numbers at $3 each: <strong>+$30</strong>. Add 3,000
                    outbound minutes at $0.015/min: <strong>+$45</strong>.
                    Voicemail detection add-on:
                    <strong> +$25</strong>. Recording storage tier:
                    <strong> +$15</strong>. Predictive mode upgrade:
                    <strong> +$40</strong>.
                  </p>
                  <p>
                    Total: <strong>~$254/month per agent.</strong>
                  </p>
                  <p>
                    DialerSeat at $35/week is roughly <strong>$140/month</strong>
                    — and that includes <em>unlimited</em> numbers,
                    <em> unlimited</em> minutes, every dialer mode, and
                    every feature. No tier gates. No per-line surcharges.
                  </p>
                </div>
              </details>

              <details>
                <summary>Why is &ldquo;multiple numbers&rdquo; such a big deal?</summary>
                <div className="answer">
                  <p>
                    Most dialers charge $1–$5 per phone number per month.
                    They cap how many you can have. They charge extra if
                    you want a number in a specific area code. If you
                    want to spoof local presence — display a local number
                    when calling that area — you&apos;re paying for
                    dozens of numbers across dozens of area codes, every
                    month, forever.
                  </p>
                  <p>
                    On DialerSeat you can add a number for every area
                    code you call, rotate them automatically, and burn
                    one the instant it gets flagged. The same goes for
                    inbound — multiple ring-in lines per seat let you
                    track which lead source, campaign, or market actually
                    rings, all in one analytics view.
                  </p>
                  <p>
                    Most operators don&apos;t realize how much &ldquo;phone
                    numbers&rdquo; is costing them at their current
                    dialer until they look at the line item.
                  </p>
                </div>
              </details>

              <details>
                <summary>Why weekly instead of monthly?</summary>
                <div className="answer">
                  <p>
                    Outbound dialing is a weekly rhythm. Most operators
                    dial Monday through Friday, evaluate Friday
                    afternoon, plan the next week. A weekly bill matches
                    that rhythm. If a week is slow — you&apos;re
                    traveling, you took on a different project, a
                    campaign dried up — you pause for that week. You
                    don&apos;t owe us 30 days&apos; notice.
                  </p>
                  <p>
                    Monthly contracts exist mostly to make cancellations
                    harder. Weekly billing makes them frictionless.
                    That&apos;s by design.
                  </p>
                </div>
              </details>

              <details>
                <summary>How are you able to charge so much less than the legacy dialers?</summary>
                <div className="answer">
                  <p>
                    We&apos;re a focused team running on modern
                    infrastructure. We negotiate carrier rates directly.
                    We don&apos;t pay a sales force to talk you into a
                    12-month contract. We don&apos;t pay for the kind of
                    marketing budget that funds &ldquo;feature parity&rdquo;
                    pages and steakhouse dinners. That overhead is what
                    you&apos;re really paying for at the legacy dialer
                    companies — it just shows up on your invoice as
                    &ldquo;extra phone numbers.&rdquo;
                  </p>
                  <p>
                    We&apos;d rather charge a flat, weekly, all-in price
                    and let the product do the selling. If it doesn&apos;t
                    earn its keep in a week, cancel it. No call to
                    retention. No exit interview.
                  </p>
                </div>
              </details>

              <details>
                <summary>Will the $35/week price ever change?</summary>
                <div className="answer">
                  <p>
                    We have no plans to raise it. If we ever needed to,
                    existing customers would be grandfathered at the rate
                    they signed up at. The price you&apos;re looking at
                    today is the price you&apos;ll keep paying.
                  </p>
                </div>
              </details>

              <details>
                <summary>Is there a team / Manager+ price?</summary>
                <div className="answer">
                  <p>
                    Yes. Manager+ is $75/week for the team owner and
                    unlocks team rosters, shared campaigns, team-mode
                    predictive routing, and owner-paid or agent-paid seat
                    billing. Individual seats inside a team still pay the
                    standard $35/week.
                  </p>
                  <p>
                    Full breakdown on the <Link href="/faq/dialerseat-teams">Teams
                    FAQ</Link>.
                  </p>
                </div>
              </details>

              <details>
                <summary>What about white-label?</summary>
                <div className="answer">
                  <p>
                    $115/week. Custom subdomain, your branding (logo,
                    colors, favicon), and the ability to onboard your own
                    users under your brand. The underlying dialer is the
                    same one we run.
                  </p>
                </div>
              </details>
            </div>
          </div>
        </section>

        

        <DialingModeCTA
          headline="One price. Everything included. Cancel any week."
          description="$35 a week per seat. Unlimited dial-out numbers, unmetered minutes, every dialer mode. The best way to see if it's worth it is to use it for a week."
        />
      </main>
      <SiteFooter />
    </>
  )
}