import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'

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
//   no message if not set up   same file: no seller name or callback number
//                                means it holds the line and hangs up rather
//                                than play an unlawful message
// =============================================================================

const ROUTE = '/faq/is-a-predictive-dialer-legal'

export const metadata: Metadata = {
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

const FAQS = [
  {
    question: 'Is a predictive dialer legal?',
    answer:
      'Yes. In the US, predictive dialers are legal as long as they meet conditions set by the FTC’s Telemarketing Sales Rule and the FCC’s TCPA rules: abandon no more than 3% of calls answered by a person per campaign over each 30-day period, let an unanswered call ring at least 15 seconds or four rings, play a recorded message naming the seller and a callback number when no agent is free, offer an automated opt-out, keep records, and call only between 8 a.m. and 9 p.m. in the called person’s local time.',
  },
  {
    question: 'What is an abandoned call?',
    answer:
      'Under the Telemarketing Sales Rule, a call is abandoned when a person answers it and is not connected to a sales representative within two seconds of finishing their greeting. Predictive dialers dial more numbers than there are free agents, so occasionally more people answer than can be connected, and those calls are abandoned.',
  },
  {
    question: 'What is the 3% abandon rate rule?',
    answer:
      'No more than 3% of calls answered by a person may be abandoned, measured per calling campaign over the campaign’s length if under 30 days, or separately over each 30-day period after that. Both the FTC and the FCC set the same 3% limit.',
  },
  {
    question: 'How does DialerSeat keep predictive dialing under 3%?',
    answer:
      'It tracks each campaign’s abandon rate over a rolling 30 days. When a campaign reaches 2.5%, below the 3% limit, the dialer stops dialing extra lines for it and drops to one line per agent. It returns to multi-line dialing once the rate is back under 2.5%. Unanswered predictive calls ring for 20 seconds, above the 15-second minimum.',
  },
  {
    question: 'Does DialerSeat play the required recorded message?',
    answer:
      'Yes, once you set your business name and callback number on the campaign. The dialer then plays a message naming your business and number when no agent is free, and offers the person the option to press 9 to stop future calls, which blocks that number across your whole account. If those two fields are not set, the dialer does not play a message it cannot lawfully play: it holds the line briefly and hangs up. Set them before running predictive.',
  },
]

export default function Page() {
  return (
    <>
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'FAQ', url: '/faq' },
          { name: 'Is a predictive dialer legal?', url: ROUTE },
        ])}
      />
      <SiteHeader />
      <GutsShell rail={faqRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">▸ COMPLIANCE</div>
            <h1>
              Is a predictive dialer legal?
              <span className="second">Yes, with four conditions.</span>
            </h1>
            <p>
              Predictive dialing is legal in the US. The rules around it are specific, though, and
              a dialer that ignores them puts every call you make at risk. Here is what they say,
              and what DialerSeat handles for you.
            </p>
          </div>
        </GutsSection>

        <GutsSection icon="info" title="Why predictive dialing is regulated at all">
          <p>
            A predictive dialer calls more numbers than there are free agents, betting that most
            won’t answer. Usually that bet pays off. Sometimes more people pick up than there are
            agents to take them, and someone answers to silence.
          </p>
          <p>
            The Telemarketing Sales Rule calls that an <strong>abandoned call</strong>: a person
            answers and isn’t connected to a sales representative within two seconds of finishing
            their greeting. The rules don’t ban abandoned calls outright. They cap how many you can
            make, and set what has to happen when one occurs.
          </p>
        </GutsSection>

        <GutsSection icon="shield" title="The four conditions">
          <p>
            The FTC’s Telemarketing Sales Rule offers a “safe harbor” from liability for abandoned
            calls if a telemarketer meets all four of these.
          </p>
          <div className="guts-grid-2">
            <div className="guts-panel">
              <div className="role">1. THE 3% LIMIT</div>
              <h3>Abandon no more than 3%</h3>
              <p>
                Of calls answered by a person, measured per campaign over its length if under 30
                days, or over each 30-day period after that. The FCC sets the same 3% limit.
              </p>
            </div>
            <div className="guts-panel">
              <div className="role">2. RING TIME</div>
              <h3>At least 15 seconds or 4 rings</h3>
              <p>Before hanging up on a call nobody has answered.</p>
            </div>
            <div className="guts-panel">
              <div className="role">3. THE MESSAGE</div>
              <h3>Say who you are</h3>
              <p>
                When no agent is free, promptly play a recorded message giving the seller’s name
                and phone number. The FCC also requires an automated way to opt out.
              </p>
            </div>
            <div className="guts-panel">
              <div className="role">4. RECORDS</div>
              <h3>Keep the proof</h3>
              <p>Retain records showing you met the first three.</p>
            </div>
          </div>
          <p style={{ marginTop: 24 }}>
            Separately, the FCC limits telephone solicitation to between 8 a.m. and 9 p.m. in the
            called person’s local time. That applies to every dialing mode, not just predictive.
          </p>
        </GutsSection>

        <GutsSection icon="check" title="What DialerSeat enforces for you">
          <ul className="guts-list good">
            <li>
              <strong>The 3% limit.</strong> Every campaign’s abandon rate is tracked over a rolling
              30 days. At 2.5%, below the limit, the dialer stops dialing extra lines for that
              campaign and drops to one line per agent. It goes back to multi-line once the rate is
              under 2.5% again.
            </li>
            <li>
              <strong>Ring time.</strong> An unanswered predictive call rings for 20 seconds before
              the dialer gives up, above the 15-second minimum.
            </li>
            <li>
              <strong>The message and opt-out.</strong> With your business name and callback number
              set on the campaign, the dialer plays the message and offers “press 9” to stop future
              calls. Pressing 9 blocks that number across your whole account.
            </li>
            <li>
              <strong>Calling hours.</strong> Calls are only placed inside the permitted window for
              each lead’s location. See <Link href="/faq/calling-hours">calling hours by state</Link>.
            </li>
            <li>
              <strong>Records.</strong> Call records are kept, and you can export them per campaign.
              See <Link href="/faq/compliance-export">compliance export</Link>.
            </li>
          </ul>
          <div className="guts-callout">
            <p>
              <strong>Set your business name and callback number first.</strong> If they are
              missing, the dialer won’t play a message it can’t lawfully play. It holds the line
              briefly and hangs up instead, and under the rule that is still an abandoned call. Both
              fields are in your campaign settings.
            </p>
          </div>
        </GutsSection>

        <GutsSection icon="alert" title="What the dialer can’t do for you">
          <ul className="guts-list warn">
            <li>
              <strong>Consent.</strong> Whether you may call someone at all depends on how you got
              their number and what they agreed to.
            </li>
            <li>
              <strong>The National Do Not Call Registry.</strong> Scrubbing your list against it is
              your responsibility. See{' '}
              <Link href="/faq/how-to-scrub-the-do-not-call-registry">
                how to scrub your list against the registry
              </Link>.
            </li>
            <li>
              <strong>State rules.</strong> Some states go further than the federal rules.
            </li>
          </ul>
          <p className="guts-note">
            This page explains the federal rules as written and what DialerSeat does. It isn’t legal
            advice. For your specific situation, talk to a lawyer who knows telemarketing law. Rule
            text is from the{' '}
            <a href="https://www.law.cornell.edu/cfr/text/16/310.4" target="_blank" rel="noopener noreferrer">
              Telemarketing Sales Rule, 16 CFR 310.4
            </a>{' '}
            and the{' '}
            <a href="https://www.law.cornell.edu/cfr/text/47/64.1200" target="_blank" rel="noopener noreferrer">
              FCC’s rules, 47 CFR 64.1200
            </a>
            .
          </p>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">GET STARTED →</Link>
            <Link href="/faq/what-is-a-predictive-dialer" className="guts-btn secondary">
              WHAT IS A PREDICTIVE DIALER?
            </Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
