import { breadcrumbSchema } from '@/lib/schema'
import JsonLd from '@/components/json-ld'
import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import DialingModeCTA from '@/components/DialingModeCTA'
import ExplainerStyles from '@/components/ExplainerStyles'
import GutsShell from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import ExplainerCrossLinks from '@/components/ExplainerCrossLinks'
import { primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'

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
      'The breakdown on $35/week per seat: what\'s included, what competitors charge extra for, and why we can keep it flat.',
    url: 'https://dialerseat.com/faq/why-we-charge',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Why we charge what we charge.',
    description: 'The breakdown on $35/week per seat: what\'s included, what competitors charge extra for, and why we can keep it flat.',
  },
}

export default async function Page() {
  await primeLocale()
  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: msg("Home"), url: '/' },
        { name: msg("Faq"), url: '/faq' },
        { name: msg("Why We Charge What We Charge"), url: '/faq/why-we-charge' },
      ])} />
      <>
      <SiteHeader />
      <GutsShell rail={faqRail('/faq/why-we-charge')} activeHref="/faq/why-we-charge">
      <div className="exp-root">
        <ExplainerStyles accent="#1a6a1a" accentBg="#e8f5e8" />

        <section className="exp-hero">
          <div className="exp-hero-inner">            <div className="exp-eyebrow">{t("EXPLAINER · PRICING")}</div>
            <span style={{ fontSize: 11, color: "#8888aa", letterSpacing: "2px", display: "block", marginBottom: 16 }}>{t("LAST UPDATED 07/28/2026")}</span>
            <h1>{t("Why we charge what we charge.")}</h1>
            <p className="exp-lead">
              {t("$35 a week, per seat. Unlimited dial-out numbers, multiple inbound numbers, every dialer mode, no per-minute charges. Manager+, our white-label tier, is $75/week and adds teams, shared campaigns, and your own branding. Here's why we can price this way.")}</p>
          </div>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">{t("▸ THE SHORT VERSION")}</div>
          <h2>{t("One weekly price. Everything included.")}</h2>
          <p>
            {t("Most outbound dialers price like a software subscription and then charge you separately for everything that makes a dialer actually work: phone numbers, minutes used, voicemail detection, recording storage, additional agents. By the time you finish stacking add-ons, a “$99 / month” plan often runs $300-$600 a month per agent.")}</p>
          <p>
            {t("DialerSeat bundles all of that into one weekly price. Every seat includes")}{" "}<strong>{t("unlimited dial-out numbers")}</strong>,
            <strong> {t("multiple inbound numbers")}</strong>{t(", unmetered outbound minutes, voicemail detection, recording, all four dialer modes, and analytics. No metered minutes. No per-number fees. No tiered feature gates. One seat, one number, one price: or as many of each as you need, all included.")}</p>
          <p>
            {t("Two tiers, that's it.")}{" "}<strong>{t("Pro")}</strong> {t("at $35/week is the full dialer for one person.")}{" "}<strong>{t("Manager+")}</strong>
            {t("at $75/week is the white-label tier: adds team rosters, shared campaigns, owner-paid or agent-paid seat billing, and your own branded subdomain.")}</p>
        </section>

        <section className="exp-section alt">
          <div className="inner">
            <div className="exp-section-label">{t("▸ COMMON QUESTIONS")}</div>
            <h2>{t("What people actually want to know.")}</h2>

            <div className="exp-qa">
              <details>
                <summary>{t("What's included in $35 / week (Pro)?")}</summary>
                <div className="answer">
                  <p>{t("The full dialer feature set. Same on every account:")}</p>
                  <p>
                    <strong>{t("All four dialer modes")}</strong>{t(": preview, power, progressive, predictive. No mode gated behind a higher tier.")}</p>
                  <p>
                    <strong>{t("Unlimited dial-out numbers.")}</strong> {t("Any area code. Rotate them automatically. Burn one if it gets flagged and spin up a fresh one: no charge, no quota.")}</p>
                  <p>
                    <strong>{t("Multiple inbound numbers")}</strong> {t("per seat. Hand out different numbers for different lead sources, different campaigns, different markets.")}</p>
                  <p>
                    <strong>{t("Automatic voicemail detection.")}</strong> {t("See")}<Link href="/faq/how-does-amd-work"> {t("how AMD works")}</Link>.
                  </p>
                  <p>
                    <strong>{t("Call recording + storage.")}</strong> {t("No per-minute archival fees.")}</p>
                  <p>
                    <strong>{t("Unmetered outbound minutes.")}</strong> {t("Dial as much as you want.")}</p>
                  <p>
                    <strong>{t("Lead management")}</strong> {t("with CSV import, custom fields, dispositions, notes.")}</p>
                  <p>
                    <strong>{t("Analytics")}</strong>{t(": contact rate, talk time, best-time-to-call, per-campaign / per-agent / per-number.")}</p>
                  <p>
                    <strong>{t("No contract.")}</strong> {t("Cancel anytime from settings.")}</p>
                </div>
              </details>

              <details>
                <summary>{t("What does Manager+ at $75 / week add?")}</summary>
                <div className="answer">
                  <p>
                    {t("Manager+ is DialerSeat's white-label tier. One price, three things bundled in:")}</p>
                  <p>
                    <strong>{t("White-label.")}</strong> {t("Your own subdomain (e.g.")}{" "}<code>yourbrand.dialerseat.com</code>{t("), your logo, your colors, your favicon. The dashboard your team and your customers see is your brand, not ours. Sign-in page, dialer, analytics, all themed to your palette.")}</p>
                  <p>
                    <strong>{t("Teams.")}</strong> {t("Roster your agents, share campaigns across the team, route inbound calls. Team-mode predictive routes humans across the entire team: when an agent disconnects, the routed human reroutes to another available agent on the same campaign rather than dropping. Full breakdown on the")}<Link href="/faq/dialerseat-teams"> {t("Teams FAQ")}</Link>.
                  </p>
                  <p>
                    <strong>{t("Flexible seat billing.")}</strong> {t("Pay for your agents' seats yourself (owner-paid), let them pay their own (agent-paid), or run a free internal mode where neither pays per-seat, agents just need their own personal Pro subscription to dial.")}</p>
                  <p>
                    {t("The $75/week is what the team owner pays. Individual seats inside the team still pay the standard $35/week per dialing seat.")}</p>
                </div>
              </details>

              <details>
                <summary>{t("Show me the math vs a typical competitor.")}</summary>
                <div className="answer">
                  <p>
                    {t("Take a typical “$99/month” dialer. By the time you add the things you actually need to use it:")}</p>
                  <p>
                    {t("Base plan:")}{" "}<strong>{t("$99/mo")}</strong>{t(". Add 10 phone numbers at $3 each:")}{" "}<strong>+$30</strong>{t(". Add 3,000 outbound minutes at $0.015/min:")}{" "}<strong>+$45</strong>{t(". Voicemail detection add-on:")}<strong> +$25</strong>{t(". Recording storage tier:")}<strong> +$15</strong>{t(". Predictive mode upgrade:")}<strong> +$40</strong>.
                  </p>
                  <p>
                    {t("Total:")}{" "}<strong>{t("~$254/month per agent.")}</strong>
                  </p>
                  <p>
                    {t("DialerSeat Pro is")}{" "}<strong>{t("$35/week")}</strong>{t(", and that includes")}{" "}<em>{t("unlimited")}</em> {t("numbers,")}{" "}<em>{t("unlimited")}</em>
                    {t("minutes, every dialer mode, and every feature. No tier gates. No per-line surcharges. No monthly contract to sign either way, you're never locked into a billing cycle longer than the week you're actually dialing in.")}</p>
                  <p>
                    {t("Manager+ is")}{" "}<strong>{t("$75/week")}</strong> {t("for the team owner. Most competitors charge a comparable amount just for “team admin” on top of their per-agent base, and white-label is usually a separate enterprise quote on top of that, often billed monthly with a minimum term attached.")}</p>
                </div>
              </details>

              <details>
                <summary>{t("Why is “multiple numbers” such a big deal?")}</summary>
                <div className="answer">
                  <p>
                    {t("Most dialers charge $1-$5 per phone number per month. They cap how many you can have. They charge extra if you want a number in a specific area code. If you want to spoof local presence, display a local number when calling that area, you're paying for dozens of numbers across dozens of area codes, every month, forever.")}</p>
                  <p>
                    {t("On DialerSeat you can add a number for every area code you call, rotate them automatically, and burn one the instant it gets flagged. The same goes for inbound, multiple ring-in lines per seat let you track which lead source, campaign, or market actually rings, all in one analytics view.")}</p>
                  <p>
                    {t("Most operators don't realize how much “phone numbers” is costing them at their current dialer until they look at the line item.")}</p>
                </div>
              </details>

              <details>
                <summary>{t("Why weekly instead of monthly?")}</summary>
                <div className="answer">
                  <p>
                    {t("Outbound dialing is a weekly rhythm. Most operators dial Monday through Friday, evaluate Friday afternoon, plan the next week. A weekly bill matches that rhythm. If a week is slow, you're traveling, you took on a different project, a campaign dried up, you pause for that week. You don't owe us 30 days' notice.")}</p>
                  <p>
                    {t("Monthly contracts exist mostly to make cancellations harder. Weekly billing makes them frictionless. That's by design.")}</p>
                </div>
              </details>

              <details>
                <summary>{t("How are you able to charge so much less than the legacy dialers?")}</summary>
                <div className="answer">
                  <p>
                    {t("We're a focused team running on modern infrastructure. We negotiate carrier rates directly. We don't pay a sales force to talk you into a 12-month contract. We don't pay for the kind of marketing budget that funds “feature parity” pages and steakhouse dinners. That overhead is what you're really paying for at the legacy dialer companies, it just shows up on your invoice as “extra phone numbers.”")}</p>
                  <p>
                    {t("We'd rather charge a flat, weekly, all-in price and let the product do the selling. If it doesn't earn its keep in a week, cancel it. No call to retention. No exit interview.")}</p>
                </div>
              </details>

              <details>
                <summary>{t("Will the prices ever change?")}</summary>
                <div className="answer">
                  <p>
                    {t("We have no plans to raise either tier. If we ever needed to, existing customers would be grandfathered at the rate they signed up at. The price you're looking at today is the price you'll keep paying.")}</p>
                </div>
              </details>

              <details>
                <summary>{t("Can I cancel anytime?")}</summary>
                <div className="answer">
                  <p>
                    {t("Yes. Cancel from your settings page in two clicks. Pro cancels at the end of the current weekly cycle you keep dialing through what you've paid for, then billing stops. Same for Manager+: cancel the Manager+ tier and your white-label tenant stays accessible through the end of the week, then it goes inactive.")}</p>
                  <p>
                    {t("Your leads, recordings, campaigns, and saved themes all stay in the database if you come back later.")}</p>
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
        </div>
      </GutsShell>
      <SiteFooter />
    </>
    </>
  )
}