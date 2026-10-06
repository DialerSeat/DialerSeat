import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

// =============================================================================
// /faq/how-we-measure-answer-rate
// =============================================================================
// Every rule on this page is lib/dialOutcome, and every surface that quotes a
// rate uses it: api/analytics/summary, api/teams/[id]/analytics,
// api/manager/analytics, api/cron/number-health and /data/connect-rates.
//
//   answered          calls.answered_at, written once on the carrier's answer
//                       event for the lead leg (api/calls/events)
//   never rang        no answered_at AND duration 0 (neverRang). Out of the
//                       denominator of every answer, connect and contact rate;
//                       kept in dial counts and cost, because it was billed
//   still ringing     same signature, since duration is written at hangup, so
//                       it counts neither way until it ends
//   minimum sample    /data/connect-rates MIN_SAMPLE = 250, a dash below it
//
// DELIBERATELY NOT HERE: the platform figures from the dead-socket bug that
// made this rule necessary. The worked example is invented and labelled as
// such, so no reader can mistake it for our numbers.
// =============================================================================

const ROUTE = '/faq/how-we-measure-answer-rate'

const baseMetadata: Metadata = {
  title: 'How DialerSeat Measures Answer Rate and Connect Rate | DialerSeat',
  description:
    'An answer rate is only as honest as its denominator. DialerSeat counts every dial you paid for, but calculates answer and connect rates only over dials that actually rang, so a technical failure is never blamed on your list.',
  keywords: [
    'how to calculate answer rate',
    'dialer answer rate',
    'connect rate calculation',
    'outbound call answer rate',
    'contact rate vs connect rate',
    'cold calling answer rate',
  ],
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'How DialerSeat Measures Answer Rate',
    description:
      'Every dial you paid for is counted. Only dials that rang are in the rate.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How DialerSeat Measures Answer Rate',
    description: 'Every dial you paid for is counted. Only dials that rang are in the rate.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("How does DialerSeat calculate answer rate?"),
    answer:
      msg("Answered calls divided by dials that actually rang. A dial that failed before it reached the phone, with no answer and no ring time at all, is left out of the answer, connect and contact rates, because nobody had the chance to pick up. It is still counted in your dial totals and in your costs, because it was attempted and billed."),
  },
  {
    question: msg("Why not divide by every dial?"),
    answer:
      msg("Because a dial that never rang tells you nothing about your list, your hours or your caller ID. Dividing by every dial would lower the rate every time something failed on the way out, and you would go looking for the problem in the wrong place."),
  },
  {
    question: msg("Are calls that are still ringing counted as unanswered?"),
    answer:
      msg("No. A call is not counted either way until it has finished. Counting a call that is ringing right now as a miss would pull the rate down during every busy hour."),
  },
  {
    question: msg("Does the same rule apply to phone number health?"),
    answer:
      msg("Yes. Each number’s answer rate is compared with the rest of the pool using only calls that rang, so a number is never held back because of dials that never reached anyone."),
  },
]

export default async function Page() {
  await primeLocale()
  return (
    <>
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("FAQ"), url: '/faq' },
          { name: msg("How we measure answer rate"), url: ROUTE },
        ])}
      />
      <SiteHeader />
      <GutsShell rail={faqRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ METRICS")}</div>
            <h1>
              {t("A dial that never rang")}<span className="second">{t("isn’t a missed call.")}</span>
            </h1>
            <p>
              {t("An answer rate is only as honest as what it’s divided by. We count every dial you paid for, and we calculate your rates only over the dials that actually reached a phone.")}</p>
          </div>
        </GutsSection>

        <GutsSection icon="info" title={t("The three numbers")}>
          <div className="guts-grid-3">
            <div className="guts-panel">
              <div className="role">{t("DIALS")}</div>
              <h3>{t("Every attempt")}</h3>
              <p>
                {t("Every call the dialer placed, whatever happened next. This is what you pay for, so it is what your dial counts and costs are built on.")}</p>
            </div>
            <div className="guts-panel">
              <div className="role">{t("DIALS THAT RANG")}</div>
              <h3>{t("The denominator")}</h3>
              <p>
                {t("Dials that reached the other end. Only these gave anyone the chance to answer.")}</p>
            </div>
            <div className="guts-panel">
              <div className="role">{t("ANSWERED")}</div>
              <h3>{t("Somebody picked up")}</h3>
              <p>
                {t("Recorded once, at the moment the carrier reports the call was answered. Not inferred from how long the call lasted.")}</p>
            </div>
          </div>
          <p style={{ marginTop: 24 }}>
            {t("Answer rate is")}{" "}<strong>{t("answered ÷ dials that rang")}</strong>{t(". Connect and contact rates use the same denominator.")}</p>
        </GutsSection>

        <GutsSection icon="alert" title={t("What “never rang” means")}>
          <p>
            {t("A dial can fail on the way out before it ever reaches a phone. When that happens there is no answer and no ring time at all: zero seconds. A phone that nobody picks up still rings for twenty seconds or more, so the two are easy to tell apart.")}</p>
          <p>
            {t("A dial like that is left out of the rate, because no one had the chance to answer it. It stays in your dial count and your costs, because it really was attempted and billed. Hiding it from those would make your costs look lower than they are.")}</p>
        </GutsSection>

        <GutsSection icon="table" title={t("Why it matters: an example")}>
          <p>
            {t("An invented campaign, to show the arithmetic. Not our data.")}</p>
          <div className="guts-grid-2">
            <div className="guts-panel">
              <div className="role">{t("DIVIDED BY EVERY DIAL")}</div>
              <h3>32%</h3>
              <p>{t("1,000 dials, 320 answered. But 200 of those dials failed before they rang.")}</p>
            </div>
            <div className="guts-panel">
              <div className="role">{t("DIVIDED BY DIALS THAT RANG")}</div>
              <h3>40%</h3>
              <p>{t("800 dials rang, 320 answered. This is how the list actually performed.")}</p>
            </div>
          </div>
          <p style={{ marginTop: 24 }}>
            {t("The first figure would send you to change your list, your calling hours or your caller ID, when none of them was the problem. The second tells you how people actually responded.")}</p>
        </GutsSection>

        <GutsSection icon="check" title={t("Two more rules")}>
          <ul className="guts-list good">
            <li>
              <strong>{t("Calls still ringing don’t count yet.")}</strong> {t("Until a call has finished it isn’t evidence either way, so it isn’t counted as answered or unanswered.")}</li>
            <li>
              <strong>{t("Small samples get a dash, not a number.")}</strong> {t("Our public")}{' '}
              <Link href="/data/connect-rates">{t("connect-rate data")}</Link> {t("shows a rate only where at least 250 dials rang. Below that, ordinary chance would move the figure by several points, and we would be publishing noise.")}</li>
          </ul>
        </GutsSection>

        <GutsSection icon="phone" title={t("The same rule for your numbers")}>
          <p>
            {t("Each caller ID’s answer rate is compared with the rest of the pool to catch numbers that carriers have started flagging. That comparison uses only calls that rang, so a number is never held back because of dials that never reached anyone. See")}{' '}
            <Link href="/faq/how-we-keep-numbers-clean">{t("how we keep numbers clean")}</Link>.
          </p>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
            <Link href="/data/connect-rates" className="guts-btn secondary">{t("SEE CONNECT-RATE DATA")}</Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
