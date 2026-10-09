import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import PageStamp from '@/components/PageStamp'
import { faqRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { pageDate } from '@/lib/pageDates'
import { localizeMetadata } from '@/lib/i18n/metadata'
import { primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'

// =============================================================================
// /faq/what-is-a-parallel-dialer
// =============================================================================
// SEARCH INTENT: "parallel dialer", "parallel dialer meaning", "parallel
// dialer software", "power vs parallel dialer", "multi-line dialer". All of
// them appear in Google's suggestions (checked 2026-10-08) and the site had no
// page for the term, though DialerSeat's predictive mode is exactly this: an
// SDR calls it parallel dialing, a call center calls it predictive.
//
// WHAT IS CLAIMED, and where it comes from:
//   2 or 3 lines per agent          lib/predictive/pacing PREDICTIVE_MIN/MAX_LINES
//   line count from the campaign's  lib/predictive/pacing legalLineCount,
//   own 30 days, 2% target, one     docs/PREDICTIVE.md section 4
//   line at 2.5%, new campaign
//   starts on one line
//   seller name + callback number   lib/predictiveController (no_seller_message)
//   the abandoned-share table       the same formula: (L·h − (1 − (1 − h)^L)) / (L·h),
//                                   one agent, every line allowed to ring out
//   3% / 2 s / recorded message     FTC TSR, 16 CFR 310.4(b)(4); 47 CFR 64.1200(a)(7)
//   $35 / seat / week               lib/canonicalFacts pricing
//
// WHAT IS DELIBERATELY NOT CLAIMED: whether the abandoned-call rule reaches a
// particular business-to-business call. That turns on facts about the call;
// the page says DialerSeat applies the limit to every predictive campaign and
// leaves the legal question to counsel.
// =============================================================================

const ROUTE = '/faq/what-is-a-parallel-dialer'
const UPDATED = pageDate(ROUTE)

const baseMetadata: Metadata = {
  title: 'Parallel Dialer: How It Works and the 3% Rule | DialerSeat',
  description:
    'A parallel dialer calls several numbers at once and connects the first person who answers. How it works, how it differs from power dialing, and the 3% rule.',
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'What is a parallel dialer?',
    description: 'Several numbers at once, the first person who answers gets the agent. How it works and what the 3% rule allows.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'What is a parallel dialer?',
    description: 'Several numbers at once, the first person who answers gets the agent. How it works and what the 3% rule allows.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("What is a parallel dialer?"),
    answer: msg("A parallel dialer calls several numbers at the same time for one agent and connects the first person who answers. The other lines end when they reach voicemail or nobody picks up. It is the same idea as a predictive dialer: sales teams tend to say parallel, call centers say predictive."),
  },
  {
    question: msg("What is the difference between a parallel dialer and a power dialer?"),
    answer: msg("A power dialer calls one number at a time and moves to the next as soon as the call ends. A parallel dialer calls several at once, so the agent waits less between conversations, but if two people answer at the same moment only one can be connected and the other call is abandoned. Power dialing cannot abandon a call; parallel dialing has to be limited so it abandons few."),
  },
  {
    question: msg("Is parallel dialing legal?"),
    answer: msg("Yes, within the abandoned-call rules. For US telemarketing calls, abandoned calls may not exceed 3% of calls answered by a person, per campaign, over each 30-day period, and a person who is not connected to an agent within 2 seconds must hear a recorded message with the seller’s name and a callback number. DialerSeat holds every predictive campaign under that limit. Whether it applies to a particular business-to-business call is a question for counsel."),
  },
  {
    question: msg("How many lines should a parallel dialer use?"),
    answer: msg("As many as the abandoned-call limit allows for that list, which depends on how often people answer. At a 5% pickup rate, two lines abandon about 1 in 40 people who answer; at 12%, three lines abandon about 1 in 9. That is why DialerSeat sets the line count from each campaign’s own record instead of a fixed number."),
  },
  {
    question: msg("Does DialerSeat have a parallel dialer?"),
    answer: msg("Yes. DialerSeat’s predictive mode dials 2 or 3 lines per agent, the agent’s choice, and connects the first person who answers. It is included in the $35 per seat per week price with the other three modes, with no contract and no seat minimum."),
  },
]

// One agent, every line allowed to ring out (docs/PREDICTIVE.md section 4).
const abandonedShare = (lines: number, pickup: number) => {
  const people = lines * pickup
  const surplus = people - (1 - (1 - pickup) ** lines)
  return `${((surplus / people) * 100).toFixed(1)}%`
}
const TABLE = [2, 3, 5].map((lines) => ({ lines, low: abandonedShare(lines, 0.05), high: abandonedShare(lines, 0.12) }))

export default async function WhatIsAParallelDialerPage() {
  await primeLocale()
  return (
    <>
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("FAQ"), url: '/faq' },
          { name: msg("What is a parallel dialer?"), url: ROUTE },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: 'What is a parallel dialer?',
          url: `https://dialerseat.com${ROUTE}`,
          dateModified: UPDATED,
          author: { '@id': 'https://dialerseat.com/#organization' },
          publisher: { '@id': 'https://dialerseat.com/#organization' },
        }}
      />
      <SiteHeader />
      <GutsShell rail={faqRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ PARALLEL DIALER")}</div>
            <h1>
              {t("What is a parallel dialer?")}<span className="second">{t("Several lines, one conversation.")}</span>
            </h1>
            <p>
              {t("A parallel dialer calls several numbers at once for one agent and connects the first person who answers. Less waiting between conversations, with one catch: when two people answer together, only one can be connected. Here is how it works, how it differs from power dialing, and how many lines the 3% rule allows.")}</p>
            <PageStamp>{t("Updated {uPDATED}", { uPDATED: UPDATED })}</PageStamp>
          </div>
        </GutsSection>

        <GutsSection icon="list" title={t("How parallel dialing works")}>
          <ol style={{ textAlign: 'start', maxWidth: 660, margin: '0 auto', paddingInlineStart: 20, lineHeight: 1.7 }}>
            <li><strong>{t("The agent is ready.")}</strong> {t("The dialer starts a round: two or three numbers from the list, dialed together.")}</li>
            <li><strong>{t("It listens on every line.")}</strong> {t("Voicemail greetings and rings that go nowhere are ended without the agent hearing them.")}{' '}
              <Link href="/faq/how-does-amd-work">{t("How AMD works")}</Link>.
            </li>
            <li><strong>{t("The first person through gets the agent.")}</strong> {t("Their lead is on screen as the call connects.")}</li>
            <li><strong>{t("Anyone else who answered is abandoned.")}</strong> {t("They hear a short recorded message with your business name and callback number, which the law requires.")}</li>
            <li><strong>{t("The next round starts")}</strong> {t("when every line of this one has ended and the agent is ready again.")}</li>
          </ol>
        </GutsSection>

        <GutsSection icon="swap" title={t("Parallel, power and predictive")}>
          <div className="guts-grid-2">
            <Link href="/dialing-modes/power" className="guts-panel">
              <div className="role">{t("ONE LINE, NO GAPS")}</div>
              <h3>{t("Power dialer")}</h3>
              <p>{t("One number at a time, the next dialed as the last ends. It can never abandon a call, and the agent hears every ring that goes unanswered.")}</p>
            </Link>
            <Link href="/dialing-modes/predictive" className="guts-panel">
              <div className="role">{t("SEVERAL LINES PER AGENT")}</div>
              <h3>{t("Parallel or predictive dialer")}</h3>
              <p>{t("Several numbers at once, the first person who answers gets the agent. Two names for one idea: sales teams say parallel, call centers say predictive.")}</p>
            </Link>
          </div>
          <p style={{ marginTop: 24 }}>
            {t("All four modes, preview, power, progressive and predictive, are included on DialerSeat and chosen per campaign.")}{' '}
            <Link href="/dialing-modes">{t("Every mode compared")}</Link>.
          </p>
        </GutsSection>

        <GutsSection icon="shield" title={t("The catch: two people answer at once")}>
          <p>
            {t("An agent can take one call. When two of the lines in a round reach a person at the same moment, the second is an abandoned call. How often that happens depends on how many lines you dial and how often people on the list pick up. With every line allowed to ring out, the share of people who answer and are left without an agent is:")}</p>
          <div style={{ overflowX: 'auto', margin: '18px auto', maxWidth: 520 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, textAlign: 'start' }}>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: 'start', padding: '8px 10px', borderBottom: '1px solid #d6dbe3' }}>{t("LINES PER AGENT")}</th>
                  <th scope="col" style={{ textAlign: 'end', padding: '8px 10px', borderBottom: '1px solid #d6dbe3' }}>{t("5% PICK UP")}</th>
                  <th scope="col" style={{ textAlign: 'end', padding: '8px 10px', borderBottom: '1px solid #d6dbe3' }}>{t("12% PICK UP")}</th>
                </tr>
              </thead>
              <tbody>
                {TABLE.map((r) => (
                  <tr key={r.lines}>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #e8ebf0' }}>{r.lines}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #e8ebf0', textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>{r.low}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #e8ebf0', textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>{r.high}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            {t("The US limit for telemarketing is 3% of calls answered by a person, per campaign, over each 30-day period. So more lines is not simply faster: on a list where people answer often, two lines can already be over the limit, and on a list where they rarely do, three can be safe.")}{' '}
            <Link href="/faq/is-a-predictive-dialer-legal">{t("The 3% rule in full")}</Link> ·{' '}
            <Link href="/tools/abandon-rate-calculator">{t("Check a campaign against it")}</Link>.
          </p>
        </GutsSection>

        <GutsSection icon="check" title={t("How DialerSeat runs it")}>
          <ul className="guts-list good">
            <li><strong>{t("2 or 3 lines per agent")}</strong>{t(", the agent’s choice, in predictive mode. It works for one agent dialing alone as well as for a floor.")}</li>
            <li><strong>{t("The campaign’s own record sets the count.")}</strong> {t("Before each round DialerSeat projects the campaign’s 30-day abandon rate and runs fewer lines whenever more would push it past 2%, a margin under the 3% limit. A new campaign starts on one line until it has a record.")}</li>
            <li><strong>{t("One line at 2.5%.")}</strong> {t("If the measured rate reaches 2.5%, the campaign drops to one line until it recovers.")}</li>
            <li><strong>{t("The recorded message is set up first.")}</strong> {t("Predictive will not start until your business name and callback number are in Settings, because an abandoned call has to play them.")}</li>
            <li><strong>{t("Included in the seat.")}</strong> {t("$35 per seat per week with the other three modes, billed weekly, no contract and no seat minimum.")}</li>
          </ul>
          <p style={{ marginTop: 18 }}>
            {t("Parallel dialers built for large SDR teams dial more lines per rep and sell them as a premium tier.")}{' '}
            <Link href="/vs/orum">{t("DialerSeat vs Orum")}</Link>.
          </p>
        </GutsSection>

        <GutsSection icon="chat" title={t("Parallel dialer questions")}>
          <div style={{ textAlign: 'start', maxWidth: 660, margin: '0 auto' }}>
            {FAQS.map((f) => (
              <div key={f.question} style={{ marginBottom: 22 }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{t(f.question)}</h3>
                <p style={{ margin: 0 }}>{t(f.answer)}</p>
              </div>
            ))}
          </div>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
            <Link href="/faq/what-is-an-auto-dialer" className="guts-btn secondary">{t("WHAT IS AN AUTO DIALER")}</Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
