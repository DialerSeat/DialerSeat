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
// /faq/how-to-scrub-the-do-not-call-registry
// =============================================================================
// DialerSeat does not scrub against the National Do Not Call Registry, and the
// rest of the site says so (lib/suppression, the Terms, /faq/how-we-keep-
// compliance). Saying "that's your job" and stopping there leaves a customer
// with a legal obligation and no instructions, so this page is the
// instructions.
//
// SOURCES, both read 24 Sept 2026:
//   telemarketing.donotcall.gov  $85 per area code from 1 Oct 2026, first five
//                                  free, capped at $23,425
//   16 CFR 310.4(b)(3)(iv)       safe harbor: a copy of the registry no more
//                                  than 31 days old when the call is made
//   16 CFR 310.4(b)(1)(iii)      registered numbers may be called only with an
//                                  express written agreement or an established
//                                  business relationship; and a person who has
//                                  asked the SELLER not to call must not be
//
// DELIBERATELY NOT HERE: the established-business-relationship time limits and
// the registration screens, neither of which was verified. Both are linked to
// the FTC rather than paraphrased from memory.
//
// Nor does it describe what happens when an agent marks a lead Do Not Call.
// That reaches one campaign today while the rule attaches the request to the
// seller, and the scope is an open product decision; see lib/suppression
// DNC_DISPOSITION_SCOPE.
// =============================================================================

const ROUTE = '/faq/how-to-scrub-the-do-not-call-registry'

const baseMetadata: Metadata = {
  title: 'How to Scrub Your List Against the Do Not Call Registry | DialerSeat',
  description:
    'Calling numbers on the National Do Not Call Registry is illegal without consent or an existing relationship. How to access the registry, what it costs from October 2026, how often you must re-scrub, and the exceptions.',
  keywords: [
    'how to scrub against the do not call list',
    'national do not call registry scrubbing',
    'DNC scrubbing',
    'do not call registry cost',
    'do not call 31 days',
    'telemarketing do not call rules',
  ],
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'How to Scrub Your List Against the Do Not Call Registry',
    description:
      'Access, cost, the 31-day rule and the exceptions, in the order you need them.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How to Scrub Against the Do Not Call Registry',
    description: 'Access, cost, the 31-day rule and the exceptions.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("Does DialerSeat scrub my list against the National Do Not Call Registry?"),
    answer:
      msg("No. Registry access requires your own organization’s registration and subscription with the FTC, so scrubbing is your responsibility. Remove registered numbers from your list before you upload it. DialerSeat does block numbers automatically when someone presses 9 on its abandoned-call message or texts STOP."),
  },
  {
    question: msg("How much does the Do Not Call Registry cost?"),
    answer:
      msg("From October 1, 2026, the FTC charges $85 per area code, with the first five area codes free and a maximum of $23,425."),
  },
  {
    question: msg("How often do I have to scrub against the Do Not Call Registry?"),
    answer:
      msg("To stay within the Telemarketing Sales Rule’s safe harbor, the copy of the registry you scrub against must be no more than 31 days old on the date of each call. In practice that means downloading it again and re-scrubbing at least every 31 days."),
  },
  {
    question: msg("Can I ever call a number on the Do Not Call Registry?"),
    answer:
      msg("Yes, in two cases under the Telemarketing Sales Rule: when the person has given you an express agreement in writing to be called, or when you have an established business relationship with them and they have not asked you to stop. The FTC’s guidance sets out the details of each."),
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
          { name: msg("Scrubbing the Do Not Call Registry"), url: ROUTE },
        ])}
      />
      <SiteHeader />
      <GutsShell rail={faqRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ COMPLIANCE")}</div>
            <h1>
              {t("We don’t scrub the national list.")}<span className="second">{t("Here’s exactly how you do.")}</span>
            </h1>
            <p>
              {t("Calling a number on the National Do Not Call Registry without consent or an existing relationship breaks federal telemarketing rules. Access to the registry is tied to your organization, so the scrubbing is yours. This is how to do it properly.")}</p>
          </div>
        </GutsSection>

        <GutsSection icon="info" title={t("Why this one is on you")}>
          <p>
            {t("The registry is run by the FTC, and access is granted to the organization doing the calling, under its own registration and subscription. We can’t scrub against it on your behalf, so we say so plainly rather than let you assume otherwise.")}</p>
          <p>
            {t("What DialerSeat does block automatically: anyone who presses 9 on the dialer’s abandoned-call message is blocked across your whole account, and anyone who texts STOP to one of our numbers is blocked on every DialerSeat account.")}</p>
        </GutsSection>

        <GutsSection icon="list" title={t("How to scrub, step by step")}>
          <ul className="guts-list good">
            <li>
              <strong>{t("Register your organization")}</strong> {t("at the FTC’s")}{' '}
              <a href="https://telemarketing.donotcall.gov" target="_blank" rel="noopener noreferrer">
                {t("telemarketer registry site")}</a>
              .
            </li>
            <li>
              <strong>{t("Subscribe to the area codes you call.")}</strong> {t("Only the area codes in your lists matter.")}</li>
            <li>
              <strong>{t("Download the registered numbers")}</strong> {t("for those area codes.")}</li>
            <li>
              <strong>{t("Remove every match from your list")}</strong> {t("before you upload it to DialerSeat, unless one of the exceptions below applies to that person.")}</li>
            <li>
              <strong>{t("Repeat at least every 31 days.")}</strong> {t("People add their numbers all the time, so an old copy goes stale.")}</li>
          </ul>
        </GutsSection>

        <GutsSection icon="price" title={t("What it costs")}>
          <div className="guts-grid-2">
            <div className="guts-panel">
              <div className="role">{t("FIRST FIVE AREA CODES")}</div>
              <h3>{t("Free")}</h3>
              <p>{t("Enough for many local and regional teams.")}</p>
            </div>
            <div className="guts-panel">
              <div className="role">{t("FROM 1 OCTOBER 2026")}</div>
              <h3>{t("$85 per area code")}</h3>
              <p>{t("For each area code beyond the first five, capped at $23,425 in total.")}</p>
            </div>
          </div>
        </GutsSection>

        <GutsSection icon="calendar" title={t("The 31-day rule")}>
          <p>
            {t("The Telemarketing Sales Rule protects telemarketers from liability for an accidental call to a registered number if, among other things, they used a copy of the registry")}{' '}
            <strong>{t("no more than 31 days old")}</strong> {t("on the day of the call.")}</p>
          <p>
            {t("So scrubbing once when you buy a list isn’t enough. If you are still dialing that list five weeks later, it needs scrubbing again.")}</p>
        </GutsSection>

        <GutsSection icon="check" title={t("The two exceptions")}>
          <p>{t("A registered number may still be called in two cases.")}</p>
          <ul className="guts-list good">
            <li>
              <strong>{t("Written agreement.")}</strong> {t("The person has given you an express agreement, in writing, to receive your calls.")}</li>
            <li>
              <strong>{t("An established business relationship.")}</strong> {t("You already do business with them, and they haven’t asked you to stop calling.")}</li>
          </ul>
          <p>
            {t("Both have specific conditions. The FTC’s")}{' '}
            <a
              href="https://www.ftc.gov/business-guidance/resources/complying-telemarketing-sales-rule"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("Telemarketing Sales Rule guide")}</a>{' '}
            {t("sets them out.")}</p>
        </GutsSection>

        <GutsSection icon="alert" title={t("Your own do-not-call list, too")}>
          <p>
            {t("The national registry is only half of it. When someone tells you directly not to call them again, the rule says you must not call them again on behalf of that seller, whether or not they are on the registry. Keep a record of every one of those requests and remove those numbers before any future upload.")}</p>
          <p className="guts-note">
            {t("This page explains the federal rules as written and isn’t legal advice. Rule text is from the")}{' '}
            <a href="https://www.law.cornell.edu/cfr/text/16/310.4" target="_blank" rel="noopener noreferrer">
              {t("Telemarketing Sales Rule, 16 CFR 310.4")}</a>
            {t("; fees are from the")}{' '}
            <a href="https://telemarketing.donotcall.gov/faqs.aspx" target="_blank" rel="noopener noreferrer">
              {t("FTC’s registry FAQ")}</a>
            .
          </p>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
            <Link href="/faq/is-a-predictive-dialer-legal" className="guts-btn secondary">
              {t("IS A PREDICTIVE DIALER LEGAL?")}</Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
