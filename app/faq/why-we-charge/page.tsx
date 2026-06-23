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
  title: 'Why We Charge What We Charge | DialerSeat',
  description:
    '$35 per week per seat, all-in. Unlimited dial-out numbers, multiple inbound numbers, every dialer mode, no per-minute charges. Manager+ at $75/week adds full white-label. Here\'s the math vs competitors.',
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
          <div className="exp-hero-inner">            <div className="exp-eyebrow">EXPLAINER · PRICING</div>
            <h1>Why we charge what we charge.</h1>
            <p className="exp-lead">
              $35 a week, per seat. Unlimited dial-out numbers, multiple
              inbound numbers, every dialer mode, no per-minute charges.
              Manager+ — our white-label tier — is $75/week and adds
              teams, shared campaigns, and your own branding. Here&apos;s
              why we can price this way.
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
          <p>
            Two tiers, that&apos;s it. <strong>Pro</strong> at $35/week
            is the full dialer for one person. <strong>Manager+</strong>
            at $75/week is the white-label tier — adds team rosters,
            shared campaigns, owner-paid or agent-paid seat billing, and
            your own branded subdomain.
          </p>
        </section>

        <section className="exp-section alt">
          <div className="inner">
            <div className="exp-section-label">▸ COMMON QUESTIONS</div>
            <h2>What people actually want to know.</h2>

            <div className="exp-qa">
              <details>
                <summary>What&apos;s included in $35 / week (Pro)?</summary>
                <div className="answer">
                  <p>The full dialer feature set. Same on every account:</p>
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
                    <strong>No contract.</strong> Cancel anytime from
                    settings.
                  </p>
                </div>
              </details>

              <details>
                <summary>What does Manager+ at $75 / week add?</summary>
                <div className="answer">
                  <p>
                    Manager+ is DialerSeat&apos;s white-label tier. One
                    price, three things bundled in:
                  </p>
                  <p>
                    <strong>White-label.</strong> Your own subdomain
                    (e.g. <code>yourbrand.dialerseat.com</code>), your
                    logo, your colors, your favicon. The dashboard your
                    team and your customers see is your brand, not ours.
                    Sign-in page, dialer, analytics — all themed to your
                    palette.
                  </p>
                  <p>
                    <strong>Teams.</strong> Roster your agents, share
                    campaigns across the team, route inbound calls.
                    Team-mode predictive routes humans across the entire
                    team — when an agent disconnects, the routed human
                    reroutes to another available agent on the same
                    campaign rather than dropping. Full breakdown on the
                    <Link href="/faq/dialerseat-teams"> Teams FAQ</Link>.
                  </p>
                  <p>
                    <strong>Flexible seat billing.</strong> Pay for your
                    agents&apos; seats yourself (owner-paid), let them
                    pay their own (agent-paid), or run a free internal
                    mode where neither pays per-seat — agents just need
                    their own personal Pro subscription to dial.
                  </p>
                  <p>
                    The $75/week is what the team owner pays. Individual
                    seats inside the team still pay the standard
                    $35/week per dialing seat.
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
                    DialerSeat Pro at $35/week is roughly
                    <strong> $140/month</strong> — and that includes
                    <em> unlimited</em> numbers, <em>unlimited</em>
                    minutes, every dialer mode, and every feature. No
                    tier gates. No per-line surcharges.
                  </p>
                  <p>
                    Manager+ at $75/week works out to ~$300/month for
                    the team owner. Most competitors charge that just
                    for &ldquo;team admin&rdquo; on top of their per-
                    agent base — and white-label is usually a separate
                    enterprise quote on top of that.
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
                <summary>Will the prices ever change?</summary>
                <div className="answer">
                  <p>
                    We have no plans to raise either tier. If we ever
                    needed to, existing customers would be grandfathered
                    at the rate they signed up at. The price you&apos;re
                    looking at today is the price you&apos;ll keep paying.
                  </p>
                </div>
              </details>

              <details>
                <summary>Can I cancel anytime?</summary>
                <div className="answer">
                  <p>
                    Yes. Cancel from your settings page in two clicks.
                    Pro cancels at the end of the current weekly cycle —
                    you keep dialing through what you&apos;ve paid for,
                    then billing stops. Same for Manager+: cancel the
                    Manager+ tier and your white-label tenant stays
                    accessible through the end of the week, then it goes
                    inactive.
                  </p>
                  <p>
                    Your leads, recordings, campaigns, and saved themes
                    all stay in the database if you come back later.
                  </p>
                </div>
              </details>
            </div>
          </div>
        </section>

        <ExplainerCrossLinks current="pricing" />

        <DialingModeCTA
          headline="One price. Everything included. Cancel any week."
          description="$35 a week per seat for Pro. $75/week for Manager+ with white-label and teams. The best way to see if it's worth it is to use it for a week."
        />
      </main>
      <SiteFooter />
    </>
  )
}