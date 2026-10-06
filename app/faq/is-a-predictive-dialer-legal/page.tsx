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
// /faq/is-a-predictive-dialer-legal
// =============================================================================
// SOURCES. The rules are quoted from the regulations themselves, via Cornell's
// Legal Information Institute (the eCFR refuses automated fetches):
//
//   16 CFR 310.4(b)(1)(iv)  abandoned = not connected within 2 seconds of the
//                             person's completed greeting
//   16 CFR 310.4(b)(4)      safe harbor: <=3% of calls answered by a person
//                             per campaign per 30 days; ring >=15 seconds or 4
//                             rings; recorded message with the seller's name
//                             and number; keep records
//   47 CFR 64.1200(a)(7)    the FCC's same 3% limit, plus an automated opt-out
//   47 CFR 64.1200(c)(1)    8 a.m. to 9 p.m., the called party's local time
//
// WHAT DIALERSEAT DOES is traced to the code that runs, not to its status text:
//
//   30-day per-campaign rate   lib/dialerPacing computeAbandonRate30d
//   one line at 2.5%           lib/dialerPacing: isDegraded = rate >= 0.025
//   back to multi-line <2.5%   the SAME line. There is no 2.0% recovery band in
//                                the pacing decision, whatever the compliance
//                                status message says. This page describes the
//                                code, not the message.
//   20-second ring             lib/placeOutboundCall ringTimeoutSecs, predictive
//   message + press 9          lib/predictive/leads; press 9 suppresses the
//                                number account-wide ('user' scope)
//   predictive is GATED on it  lib/sellerIdentity. The seller name and callback
//                                number live on the ACCOUNT (users.tsr_*), set
//                                once in Settings, and a campaign uses its
//                                OWNER's. Without them predictive does not
//                                start at all: /api/campaigns/create and
//                                /update refuse the mode with 428,
//                                /api/dialer/arm refuses START, and the
//                                controller idles. This replaced the old
//                                per-campaign fields, which no campaign had
//                                ever been given, and it replaced the earlier
//                                behaviour this page described: holding the
//                                line and hanging up, which was itself an
//                                abandoned call.
// =============================================================================

const ROUTE = '/faq/is-a-predictive-dialer-legal'

const baseMetadata: Metadata = {
  title: 'Is a Predictive Dialer Legal? The 3% Rule and What It Requires | DialerSeat',
  description:
    'Yes, predictive dialers are legal in the US under conditions set by the FTC and FCC: a 3% abandon limit per campaign, a 15-second minimum ring, a recorded message and an opt-out. What each rule says, and what DialerSeat enforces for you.',
  keywords: [
    'is a predictive dialer legal',
    'predictive dialer legal',
    'predictive dialer 3% rule',
    'abandoned call rule',
    'TSR safe harbor',
    'telemarketing sales rule abandoned calls',
  ],
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'Is a Predictive Dialer Legal?',
    description:
      'The 3% abandon rule, the 15-second ring, the recorded message, and what DialerSeat enforces for you.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Is a Predictive Dialer Legal?',
    description: 'The 3% abandon rule, the 15-second ring, the recorded message, and what DialerSeat enforces.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("Is a predictive dialer legal?"),
    answer:
      msg("Yes. In the US, predictive dialers are legal as long as they meet conditions set by the FTC’s Telemarketing Sales Rule and the FCC’s TCPA rules: abandon no more than 3% of calls answered by a person per campaign over each 30-day period, let an unanswered call ring at least 15 seconds or four rings, play a recorded message naming the seller and a callback number when no agent is free, offer an automated opt-out, keep records, and call only between 8 a.m. and 9 p.m. in the called person’s local time."),
  },
  {
    question: msg("What is an abandoned call?"),
    answer:
      msg("Under the Telemarketing Sales Rule, a call is abandoned when a person answers it and is not connected to a sales representative within two seconds of finishing their greeting. Predictive dialers dial more numbers than there are free agents, so occasionally more people answer than can be connected, and those calls are abandoned."),
  },
  {
    question: msg("What is the 3% abandon rate rule?"),
    answer:
      msg("No more than 3% of calls answered by a person may be abandoned, measured per calling campaign over the campaign’s length if under 30 days, or separately over each 30-day period after that. Both the FTC and the FCC set the same 3% limit."),
  },
  {
    question: msg("How does DialerSeat keep predictive dialing under 3%?"),
    answer:
      msg("It tracks each campaign’s abandon rate over a rolling 30 days. When a campaign reaches 2.5%, below the 3% limit, the dialer stops dialing extra lines for it and drops to one line per agent. It returns to multi-line dialing once the rate is back under 2.5%. Unanswered predictive calls ring for 20 seconds, above the 15-second minimum."),
  },
  {
    question: msg("Does DialerSeat play the required recorded message?"),
    answer:
      msg("Yes. You set your business name and a callback number once, in Settings, and the dialer plays a message naming them when no agent is free, offering the person the option to press 9 to stop future calls, which blocks that number across your whole account. Until both are set, DialerSeat will not run predictive at all: the mode cannot be saved on a campaign and the dialer refuses to start. Predictive without that message is not lawful, so the dialer declines to place the calls rather than place them wrongly."),
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
          { name: msg("Is a predictive dialer legal?"), url: ROUTE },
        ])}
      />
      <SiteHeader />
      <GutsShell rail={faqRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ COMPLIANCE")}</div>
            <h1>
              {t("Is a predictive dialer legal?")}<span className="second">{t("Yes, with four conditions.")}</span>
            </h1>
            <p>
              {t("Predictive dialing is legal in the US. The rules around it are specific, though, and a dialer that ignores them puts every call you make at risk. Here is what they say, and what DialerSeat handles for you.")}</p>
          </div>
        </GutsSection>

        <GutsSection icon="info" title={t("Why predictive dialing is regulated at all")}>
          <p>
            {t("A predictive dialer calls more numbers than there are free agents, betting that most won’t answer. Usually that bet pays off. Sometimes more people pick up than there are agents to take them, and someone answers to silence.")}</p>
          <p>
            {t("The Telemarketing Sales Rule calls that an")}{" "}<strong>{t("abandoned call")}</strong>{t(": a person answers and isn’t connected to a sales representative within two seconds of finishing their greeting. The rules don’t ban abandoned calls outright. They cap how many you can make, and set what has to happen when one occurs.")}</p>
        </GutsSection>

        <GutsSection icon="shield" title={t("The four conditions")}>
          <p>
            {t("The FTC’s Telemarketing Sales Rule offers a “safe harbor” from liability for abandoned calls if a telemarketer meets all four of these.")}</p>
          <div className="guts-grid-2">
            <div className="guts-panel">
              <div className="role">{t("1. THE 3% LIMIT")}</div>
              <h3>{t("Abandon no more than 3%")}</h3>
              <p>
                {t("Of calls answered by a person, measured per campaign over its length if under 30 days, or over each 30-day period after that. The FCC sets the same 3% limit.")}</p>
            </div>
            <div className="guts-panel">
              <div className="role">{t("2. RING TIME")}</div>
              <h3>{t("At least 15 seconds or 4 rings")}</h3>
              <p>{t("Before hanging up on a call nobody has answered.")}</p>
            </div>
            <div className="guts-panel">
              <div className="role">{t("3. THE MESSAGE")}</div>
              <h3>{t("Say who you are")}</h3>
              <p>
                {t("When no agent is free, promptly play a recorded message giving the seller’s name and phone number. The FCC also requires an automated way to opt out.")}</p>
            </div>
            <div className="guts-panel">
              <div className="role">{t("4. RECORDS")}</div>
              <h3>{t("Keep the proof")}</h3>
              <p>{t("Retain records showing you met the first three.")}</p>
            </div>
          </div>
          <p style={{ marginTop: 24 }}>
            {t("Separately, the FCC limits telephone solicitation to between 8 a.m. and 9 p.m. in the called person’s local time. That applies to every dialing mode, not just predictive.")}</p>
        </GutsSection>

        <GutsSection icon="check" title={t("What DialerSeat enforces for you")}>
          <ul className="guts-list good">
            <li>
              <strong>{t("The 3% limit.")}</strong> {t("Every campaign’s abandon rate is tracked over a rolling 30 days. At 2.5%, below the limit, the dialer stops dialing extra lines for that campaign and drops to one line per agent. It goes back to multi-line once the rate is under 2.5% again.")}</li>
            <li>
              <strong>{t("Ring time.")}</strong> {t("An unanswered predictive call rings for 20 seconds before the dialer gives up, above the 15-second minimum.")}</li>
            <li>
              <strong>{t("The message and opt-out.")}</strong> {t("Set your business name and a callback number once in Settings, and the dialer plays the message when no agent is free, offering “press 9” to stop future calls. Pressing 9 blocks that number across your whole account. On a team campaign the message names the team owner’s business, because that is the seller the call is placed for.")}</li>
            <li>
              <strong>{t("Calling hours.")}</strong> {t("Calls are only placed inside the permitted window for each lead’s location. See")}{" "}<Link href="/faq/calling-hours">{t("calling hours by state")}</Link>.
            </li>
            <li>
              <strong>{t("Records.")}</strong> {t("Call records are kept, and you can export them per campaign. See")}{" "}<Link href="/faq/compliance-export">{t("compliance export")}</Link>.
            </li>
          </ul>
          <div className="guts-callout">
            <p>
              <strong>{t("Predictive is locked until those two details exist.")}</strong> {t("Without a business name and a callback number there is no lawful message to play, so DialerSeat does not let predictive run at all: the mode can’t be saved on a campaign, and the dialer refuses to start. Settings shows it as LOCKED or UNLOCKED. It is one field each, set once for the account, and every campaign you own uses them.")}</p>
          </div>
        </GutsSection>

        <GutsSection icon="alert" title={t("What the dialer can’t do for you")}>
          <ul className="guts-list warn">
            <li>
              <strong>{t("Consent.")}</strong> {t("Whether you may call someone at all depends on how you got their number and what they agreed to.")}</li>
            <li>
              <strong>{t("The National Do Not Call Registry.")}</strong> {t("Scrubbing your list against it is your responsibility. See")}{' '}
              <Link href="/faq/how-to-scrub-the-do-not-call-registry">
                {t("how to scrub your list against the registry")}</Link>.
            </li>
            <li>
              <strong>{t("State rules.")}</strong> {t("Some states go further than the federal rules.")}</li>
          </ul>
          <p className="guts-note">
            {t("This page explains the federal rules as written and what DialerSeat does. It isn’t legal advice. For your specific situation, talk to a lawyer who knows telemarketing law. Rule text is from the")}{' '}
            <a href="https://www.law.cornell.edu/cfr/text/16/310.4" target="_blank" rel="noopener noreferrer">
              {t("Telemarketing Sales Rule, 16 CFR 310.4")}</a>{' '}
            {t("and the")}{' '}
            <a href="https://www.law.cornell.edu/cfr/text/47/64.1200" target="_blank" rel="noopener noreferrer">
              {t("FCC’s rules, 47 CFR 64.1200")}</a>
            .
          </p>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
            <Link href="/dialing-modes/predictive" className="guts-btn secondary">
              {t("WHAT IS A PREDICTIVE DIALER?")}</Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
