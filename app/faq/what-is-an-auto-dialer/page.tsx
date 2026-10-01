import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { pageDate } from '@/lib/pageDates'

// =============================================================================
// /faq/what-is-an-auto-dialer
// =============================================================================
// SEARCH INTENT: "auto dialer" (~3,600 US and ~8,100 worldwide searches a
// month, the largest term in the category), "what is an auto dialer", "how do
// auto dialers work", "are auto dialers illegal", "auto dialer vs predictive
// dialer". The site had a page for each of the four modes and none for the
// umbrella term people actually type.
//
// WHAT IS CLAIMED, and where it comes from:
//   the four modes                 lib/canonicalFacts FACTS.modes
//   3% abandon, 2 s, 15 s ring     FTC TSR, 16 CFR 310.4(b)(4)
//   the ATDS definition            Facebook v. Duguid, 592 U.S. 395 (2021)
//   prerecorded calls need consent 47 U.S.C. 227(b), as summarised by the FCC
//   $35 / seat / week              lib/canonicalFacts pricing
//
// WHAT IS DELIBERATELY NOT CLAIMED: which state laws define an autodialer more
// broadly, by name. Several have, and some have since amended; naming them
// here would put a list on a page built to be quoted that goes stale the next
// time a legislature sits. The page says the rule exists and sends the reader
// to counsel.
// =============================================================================

const ROUTE = '/faq/what-is-an-auto-dialer'
const UPDATED = pageDate(ROUTE)

export const metadata: Metadata = {
  title: 'What Is an Auto Dialer? How It Works, Types, and Is It Legal | DialerSeat',
  description:
    'An auto dialer places calls from a lead list automatically and connects the agent when a person answers. How auto dialers work, the four types, what the law allows, and what one costs.',
  keywords: [
    'auto dialer', 'what is an auto dialer', 'how do auto dialers work', 'are auto dialers illegal',
    'auto dialer software', 'automatic dialer', 'auto dialer vs predictive dialer', 'auto dialer system',
  ],
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'What is an auto dialer?',
    description: 'How auto dialers work, the four types, what the law allows, and what one costs.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'What is an auto dialer?',
    description: 'How auto dialers work, the four types, what the law allows, and what one costs.',
  },
}

const FAQS = [
  {
    question: 'What is an auto dialer?',
    answer:
      'An auto dialer is software that places outbound calls from a list automatically, so an agent is not typing numbers. When a person answers, the call is connected to the agent; voicemails and unanswered calls are handled without the agent. The four common types are preview, power, progressive and predictive dialers.',
  },
  {
    question: 'How does an auto dialer work?',
    answer:
      'You upload a list of leads. The dialer calls them in order, detects whether a person or an answering machine picked up, connects live answers to an agent, and records the outcome of each call so the lead is retried, called back or closed out. A predictive dialer calls several numbers per agent at once to cut the waiting between conversations.',
  },
  {
    question: 'Are auto dialers illegal?',
    answer:
      'No. Auto dialers are legal in the US. What the law regulates is how they are used: prerecorded or artificial-voice calls need the person’s consent, predictive dialers must keep abandoned calls under 3% of answered calls per campaign per 30 days, calls must respect calling hours and the Do Not Call Registry, and caller ID must be shown. Some states add their own rules.',
  },
  {
    question: 'What is the difference between an auto dialer and a predictive dialer?',
    answer:
      'Auto dialer is the umbrella term. A predictive dialer is one kind of auto dialer: it dials several lines per agent at once and uses a pacing algorithm to connect answered calls as agents come free. Power and progressive dialers dial one line at a time; preview dialers let the agent read the lead before the call starts.',
  },
  {
    question: 'Is an auto dialer the same as a robocall?',
    answer:
      'No. A robocall plays a recorded message. An auto dialer used for sales connects a live agent to the person who answers. The rules differ: prerecorded calls need prior consent, while live agent calls to numbers not on the Do Not Call Registry generally do not.',
  },
  {
    question: 'How much does an auto dialer cost?',
    answer:
      'Published prices for multi-line and predictive dialers run from about $49 to $250 per seat per month where they are published at all, usually billed monthly or annually. DialerSeat is $35 per seat per week with all four dialer modes included and no contract.',
  },
]

export default function WhatIsAnAutoDialerPage() {
  return (
    <>
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'FAQ', url: '/faq' },
          { name: 'What is an auto dialer?', url: ROUTE },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: 'What is an auto dialer?',
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
            <div className="guts-eyebrow">▸ AUTO DIALER</div>
            <h1>
              What is an auto dialer?
              <span className="second">The dialing, without the dialing.</span>
            </h1>
            <p>
              An auto dialer calls the numbers on your list for you and hands you the call when a person
              answers. Voicemails, busy signals and rings that go nowhere are dealt with before you hear
              them. Here is how it works, the four kinds, and what the law expects of you.
            </p>
            <div className="guts-stamp">Updated {UPDATED}</div>
          </div>
        </GutsSection>

        <GutsSection icon="list" title="How an auto dialer works">
          <ol style={{ textAlign: 'start', maxWidth: 660, margin: '0 auto', paddingInlineStart: 20, lineHeight: 1.7 }}>
            <li><strong>You load a list.</strong> A spreadsheet of leads, or leads sent in from a CRM.</li>
            <li><strong>It dials.</strong> One number at a time, or several per agent, depending on the mode.</li>
            <li>
              <strong>It listens.</strong> Answering-machine detection tells a person from a voicemail
              greeting, so machines never reach the agent.{' '}
              <Link href="/faq/how-does-amd-work">How AMD works</Link>.
            </li>
            <li><strong>It connects.</strong> A live answer goes straight to the agent with the lead on screen.</li>
            <li>
              <strong>It remembers.</strong> Each outcome is recorded, so the lead is retried, called back
              at the time you set, or taken off the list.
            </li>
          </ol>
        </GutsSection>

        <GutsSection icon="swap" title="The four kinds of auto dialer">
          <div className="guts-grid-2">
            <Link href="/dialing-modes/preview" className="guts-panel">
              <div className="role">AGENT STARTS EACH CALL</div>
              <h3>Preview dialer</h3>
              <p>The agent reads the lead first and starts the call. Slowest, best for leads that cost real money.</p>
            </Link>
            <Link href="/dialing-modes/power" className="guts-panel">
              <div className="role">ONE LINE, NO GAPS</div>
              <h3>Power dialer</h3>
              <p>Dials the next lead the moment the last call ends. One line, no pause between calls.</p>
            </Link>
            <Link href="/dialing-modes/progressive" className="guts-panel">
              <div className="role">AGENT ALREADY ON THE LINE</div>
              <h3>Progressive dialer</h3>
              <p>Dials automatically with the agent already connected, so there is no delay when someone answers.</p>
            </Link>
            <Link href="/dialing-modes/predictive" className="guts-panel">
              <div className="role">SEVERAL LINES PER AGENT</div>
              <h3>Predictive dialer</h3>
              <p>Dials several numbers at once and routes the first person who answers. The most conversations per hour.</p>
            </Link>
          </div>
          <p style={{ marginTop: 24 }}>
            Most dialers sell these as tiers. On DialerSeat all four are included and chosen per campaign.{' '}
            <Link href="/faq/dialer-modes">Which mode to use when</Link>.
          </p>
        </GutsSection>

        <GutsSection icon="shield" title="Is an auto dialer legal?">
          <p>
            Yes. Auto dialers are legal. The rules are about how a call is made and who it is made to:
          </p>
          <ul className="guts-list good">
            <li>
              <strong>Abandoned calls.</strong> A predictive dialer may abandon no more than 3% of calls
              answered by a person, per campaign, over each 30-day period. The agent must be connected
              within 2 seconds, or a recorded message must give the seller’s name and number, and an
              unanswered call must ring 15 seconds or four rings first.{' '}
              <Link href="/faq/is-a-predictive-dialer-legal">The 3% rule in full</Link>.
            </li>
            <li>
              <strong>The legal meaning of “autodialer”.</strong> For the TCPA’s consent rule on calls to
              mobile phones, the Supreme Court held in{' '}
              <a href="https://www.supremecourt.gov/opinions/20pdf/19-511_p86b.pdf" target="_blank" rel="noopener noreferrer">
                Facebook v. Duguid
              </a>{' '}
              (2021) that an automatic telephone dialing system must use a random or sequential number
              generator. A dialer that calls a list of leads you supplied is generally outside that
              definition. Some states define it more broadly.
            </li>
            <li>
              <strong>Recorded messages.</strong> A prerecorded or artificial-voice marketing call needs
              the person’s prior express written consent, whatever dialed it.
            </li>
            <li>
              <strong>Hours and the registry.</strong> 8 a.m. to 9 p.m. in the recipient’s time zone, with
              stricter state windows, and no marketing calls to numbers on the National Do Not Call
              Registry without consent.{' '}
              <Link href="/faq/calling-hours">Calling hours by state</Link> ·{' '}
              <Link href="/faq/how-to-scrub-the-do-not-call-registry">Scrubbing the registry</Link>.
            </li>
          </ul>
          <p style={{ marginTop: 18 }}>
            Outside the US the rules change country by country; France became opt-in on August 11, 2026.{' '}
            <Link href="/data/calling-rules-by-country">Calling rules by country</Link>. This is a summary,
            not legal advice.
          </p>
        </GutsSection>

        <GutsSection icon="check" title="What to look for in an auto dialer">
          <ul className="guts-list good">
            <li><strong>Every mode you will need</strong>, without paying for a higher tier to switch.</li>
            <li><strong>Answering-machine detection</strong> that keeps voicemails away from the agent.</li>
            <li><strong>Local caller ID and number rotation</strong>, so calls do not get labelled Spam Likely.{' '}
              <Link href="/faq/why-calls-show-spam-likely">Why calls get flagged</Link>.</li>
            <li><strong>Calling windows enforced per lead</strong>, against the lead’s state, not the agent’s.</li>
            <li><strong>The abandon-rate cap enforced automatically</strong> in predictive mode.</li>
            <li><strong>Billing you can stop.</strong> Annual contracts and seat minimums are where the cost hides.</li>
          </ul>
        </GutsSection>

        <GutsSection icon="price" title="What an auto dialer costs">
          <p>
            Where multi-line and predictive dialing is priced publicly, it runs from about $49 to $250 per
            seat per month, usually billed monthly or annually, and several vendors sell only by quote.
            DialerSeat is $35 per seat per week with all four modes, billed weekly with no contract.
          </p>
          <div className="guts-btns">
            <Link href="/pricing" className="guts-btn primary">DIALERSEAT PRICING</Link>
            <Link href="/data/dialer-pricing" className="guts-btn secondary">EVERY DIALER’S PRICING</Link>
          </div>
        </GutsSection>

        <GutsSection icon="chat" title="Auto dialer questions">
          <div style={{ textAlign: 'start', maxWidth: 660, margin: '0 auto' }}>
            {FAQS.map((f) => (
              <div key={f.question} style={{ marginBottom: 22 }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{f.question}</h3>
                <p style={{ margin: 0 }}>{f.answer}</p>
              </div>
            ))}
          </div>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">GET STARTED →</Link>
            <Link href="/faq/dialer-glossary" className="guts-btn secondary">DIALER GLOSSARY</Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
