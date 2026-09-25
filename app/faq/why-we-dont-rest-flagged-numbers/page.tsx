import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'

// =============================================================================
// /faq/why-we-dont-rest-flagged-numbers — the finding, on its own page
// =============================================================================
// This is the most useful thing DialerSeat has learned about caller IDs, and it
// contradicts the advice every competitor and forum gives, so it earns a page
// rather than a paragraph.
//
// SOURCES. The figures are the ones recorded in
// app/api/cron/number-health/route.ts, where the switch from resting to
// throttling was made on 18 Sept:
//
//   rested 8+ days      came back at 16.4%, below a brand-new number at 20.5%
//   volume cut 109->33  same number, same lead pool, 34.4% -> 63.1% in 1-3 days
//
// Both are this account's own calls, so they are stated as that, with the
// sample caveat, rather than dressed as a general law. The MECHANISM comes from
// Hiya, whose report card grades four published factors, and it is what makes
// a small sample worth acting on: resting removes the very input Maturity is
// built from.
//
// The four factors are paraphrased from Hiya's own blog post announcing the
// report card, which frames Maturity as using established numbers "without
// rotating" — the one phrase kept verbatim, because it is the whole argument.
// The rest is paraphrased and linked rather than reproduced.
// =============================================================================

const ROUTE = '/faq/why-we-dont-rest-flagged-numbers'

export const metadata: Metadata = {
  title: 'Why We Don’t Rest a Flagged Number (We Slow It Down) | DialerSeat',
  description:
    'The standard advice is to pull a flagged caller ID and let it cool off. We did, and our rested numbers came back answering worse than brand-new ones. Cutting volume instead let the same number recover within days. Here is the data and why it works.',
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'Why We Don’t Rest a Flagged Number',
    description:
      'Rested numbers came back worse than new ones. Slowing them down let them recover in days. The data, and why.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Why We Don’t Rest a Flagged Number',
    description:
      'Rested numbers came back worse than new ones. Slowing them down let them recover in days.',
  },
}

const FAQS = [
  {
    question: msg("Should you rest a phone number that has been flagged as spam?"),
    answer:
      msg("In our experience, no. When DialerSeat rested flagged numbers for eight days or more, they came back answering at 16.4%, below a brand-new number at 20.5%. Cutting the volume on a flagged number instead worked: one number went from 109 calls a day to 33, and its answer rate rose from 34.4% to 63.1% within one to three days, on the same lead pool."),
  },
  {
    question: msg("Why would resting a flagged number make it worse?"),
    answer:
      msg("Because call reputation is built from being seen calling. Hiya grades numbers on four factors, and one of them, Maturity, asks whether you use established numbers rather than rotating through fresh ones. A resting number is not seen calling at all, so it cannot rebuild that, while the complaints that flagged it are still on record."),
  },
  {
    question: msg("What does DialerSeat do with a flagged number instead?"),
    answer:
      msg("It drops the number’s daily cap from 60 calls to 15 and leaves it in the pool. It keeps calling, visibly, while fewer and better calls let its answer rate and engagement recover. Once it is back in line with the rest of the pool, the daily check restores it to full volume automatically."),
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
          { name: msg("Why we don’t rest flagged numbers"), url: ROUTE },
        ])}
      />
      <SiteHeader />
      <GutsShell rail={faqRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ SPAM-FREE NUMBERS")}</div>
            <h1>
              {t("Resting a flagged number")}<span className="second">{t("makes it worse.")}</span>
            </h1>
            <p>
              {t("The standard advice when a caller ID gets flagged is to pull it and let it cool off. We did exactly that. Our rested numbers came back answering worse than numbers we had just bought.")}</p>
          </div>
        </GutsSection>

        <GutsSection icon="book" title={t("What we tried first")}>
          <p>
            {t("Our original system did what everyone recommends. When a number’s answer rate collapsed, the dialer took it out of the pool and let it sit, on the theory that time away would let its reputation reset.")}</p>
          <p>{t("It didn’t.")}</p>
          <div className="guts-grid-2">
            <div className="guts-panel">
              <div className="role">{t("RESTED 8 DAYS OR MORE")}</div>
              <h3>{t("16.4% answered")}</h3>
              <p>{t("Flagged numbers, pulled from the pool, then brought back.")}</p>
            </div>
            <div className="guts-panel">
              <div className="role">{t("BRAND-NEW NUMBER")}</div>
              <h3>{t("20.5% answered")}</h3>
              <p>{t("Freshly bought, with no calling history at all.")}</p>
            </div>
          </div>
          <p style={{ marginTop: 24 }}>
            {t("A week and more of rest didn’t just fail to heal those numbers. It left them behind a number with no history whatsoever.")}</p>
        </GutsSection>

        <GutsSection icon="swap" title={t("What worked instead")}>
          <p>
            {t("On a different struggling number, we did the opposite. We didn’t pull it. We cut how much it dialed, and kept everything else the same: same number, same lead pool.")}</p>
          <div className="guts-grid-2">
            <div className="guts-panel">
              <div className="role">{t("BEFORE")}</div>
              <h3>{t("109 calls a day")}</h3>
              <p>{t("34.4% answered.")}</p>
            </div>
            <div className="guts-panel">
              <div className="role">{t("ONE TO THREE DAYS LATER")}</div>
              <h3>{t("33 calls a day")}</h3>
              <p>{t("63.1% answered.")}</p>
            </div>
          </div>
          <div className="guts-callout">
            <p>
              <strong>{t("An honest caveat.")}</strong> {t("This is one account’s calls over a few weeks in September, not a controlled trial, and the samples are small. We’d be overselling it to call it proven. But two responses to the same problem pointing in opposite directions, with a mechanism that explains why, was enough to change what the dialer does.")}</p>
          </div>
        </GutsSection>

        <GutsSection icon="scale" title={t("Why: how a number’s reputation is actually scored")}>
          <p>
            {t("Call-protection providers don’t judge a number on a single moment. Hiya, whose spam labelling it says is used by major mobile networks around the world, publishes a report card that grades a number from A to D on four factors.")}</p>
          <div className="guts-grid-2">
            <div className="guts-panel">
              <h3>{t("Maturity")}</h3>
              <p>
                {t("Does the number have an established calling history? Hiya frames it as using established numbers, “without rotating.”")}</p>
            </div>
            <div className="guts-panel">
              <h3>{t("Connection")}</h3>
              <p>{t("Do the people it calls choose to answer?")}</p>
            </div>
            <div className="guts-panel">
              <h3>{t("Engagement")}</h3>
              <p>{t("Once they answer, do they stay on the line?")}</p>
            </div>
            <div className="guts-panel">
              <h3>{t("Sentiment")}</h3>
              <p>{t("Do people rarely complain about it or block it?")}</p>
            </div>
          </div>
          <p style={{ marginTop: 24 }}>
            {t("Read those four and the result stops being surprising.")}{" "}<strong>{t("A resting number is invisible.")}</strong> {t("It isn’t seen calling, so it can’t build maturity, and it isn’t being answered, so it can’t improve its connection or engagement. The complaints that flagged it are still on file. Time off removes the input that reputation is built from and leaves the damage where it is.")}</p>
          <p>
            <strong>{t("A slowed-down number keeps working on all four.")}</strong> {t("It stays visible, so maturity keeps accruing. Fewer calls to better-matched leads lift connection and engagement. And fewer calls mean fewer chances for a complaint, which protects sentiment.")}</p>
        </GutsSection>

        <GutsSection icon="calendar" title={t("Fifteen calls a day, not zero")}>
          <p>
            {t("A struggling DialerSeat number drops from 60 calls a day to 15. That figure is deliberate: high enough that the number stays visible and keeps building maturity, low enough to be a real cut in exposure.")}</p>
          <p>
            <strong>{t("Getting back up is easier than going down.")}</strong> {t("It takes 40 calls in the window to judge a number as struggling, but only 15 to judge it recovered. That asymmetry is on purpose. A number capped at 15 a day can barely reach 40 calls over three days, so holding recovery to the same bar would quietly make the penalty permanent. If a number is restored too early, the next daily check simply slows it again.")}</p>
        </GutsSection>

        <GutsSection icon="check" title={t("What this means for you")}>
          <p>
            {t("Nothing to manage. A number that starts to struggle is slowed down automatically and put back to full volume automatically when it recovers, and the rest of the pool picks up the slack in between. You just keep dialing.")}</p>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
            <Link href="/faq/how-we-keep-numbers-clean" className="guts-btn secondary">
              {t("THE WHOLE SYSTEM")}</Link>
          </div>
          <p className="guts-note">
            {t("Figures are from DialerSeat’s own calls in September 2026. Reputation factors are summarised from")}{' '}
            <a
              href="https://blog.hiya.com/caller-reputation-the-industrys-first-transparent-view-into-spam-labeling"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("Hiya’s Caller Reputation report card")}</a>
            .
          </p>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
