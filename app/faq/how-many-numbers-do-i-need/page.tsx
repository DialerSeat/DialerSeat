import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import JsonLd from '@/components/json-ld'
import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import DialingModeCTA from '@/components/DialingModeCTA'
import ExplainerStyles from '@/components/ExplainerStyles'
import ExplainerCrossLinks from '@/components/ExplainerCrossLinks'

export const metadata: Metadata = {
  title: 'How Many Phone Numbers Does an Outbound Dialer Need? | DialerSeat',
  description:
    'A caller ID has a daily volume ceiling before answer rates fall. Why one number never works, how rotation and headroom protect an answer rate, and how to think about pool size without guessing.',
  alternates: { canonical: 'https://dialerseat.com/faq/how-many-numbers-do-i-need' },
  openGraph: {
    title: 'How Many Phone Numbers Does a Dialer Need?',
    description:
      'Why one number never works, and how rotation protects your answer rate.',
    url: 'https://dialerseat.com/faq/how-many-numbers-do-i-need',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How Many Phone Numbers Does a Dialer Need?',
    description: 'Why one number never works, and how rotation protects your answer rate.',
  },
}

const FAQS = [
  {
    question: 'How many phone numbers do I need for an outbound dialer?',
    answer:
      'Enough that no single number carries a whole day of calls, plus headroom for numbers resting or retired. DialerSeat applies a per-number daily cap automatically and rotates across the pool, so the practical answer is that you add numbers when the pool tells you it is running hot rather than by working out a figure in advance. A single agent is comfortable on a handful; a floor needs proportionally more.',
  },
  {
    question: 'Why not just use one number for everything?',
    answer:
      'Because volume on a single caller ID is the fastest way to get it labelled. Carrier analytics watch call volume, call duration, and how often people decline or report a number. A number placing several hundred short unanswered calls a day looks exactly like a robocall to that scoring, because statistically it is behaving like one. Once the label attaches, the number is finished — and if it is your only number, so is your answer rate.',
  },
  {
    question: 'What is a sensible daily cap per number?',
    answer:
      'There is no universal correct figure, and anyone who quotes you one with confidence is guessing — carrier scoring is opaque and it changes. DialerSeat sets and enforces the cap for you, tuned against live answer-rate data rather than a number picked once and forgotten. What matters on your side is that the volume is spread across a pool instead of concentrated on one caller ID.',
  },
  {
    question: 'Do more numbers mean better answer rates?',
    answer:
      'Up to a point, and then no. Enough numbers to keep each one under its cap protects your answer rate. Far more numbers than you need does not improve it further, and each one still costs money every month. The goal is coverage with headroom, not accumulation.',
  },
  {
    question: 'What about local presence — do I need a number in every area code?',
    answer:
      'No, and chasing that is how a pool becomes expensive. DialerSeat prefers a caller ID matching the lead’s area code when one is available, falls back to the same state, then to any healthy number. A pool covering the regions your list actually concentrates in gets most of the benefit. Buying a number for every area code in the country gets very little more for a great deal more cost.',
  },
  {
    question: 'What happens when a number goes bad?',
    answer:
      'DialerSeat tracks answer rate per number over a rolling window. A number whose answer rate has degraded relative to the rest of the pool is flagged and can be retired rather than dialed until it is worthless. That is the reason to hold headroom: retiring a number should not reduce your capacity below what the day needs.',
  },
]

export default function Page() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Faq', url: '/faq' },
        { name: 'How Many Phone Numbers Do I Need?', url: '/faq/how-many-numbers-do-i-need' },
      ])} />
      <JsonLd data={faqPageSchema(FAQS)} />
      <SiteHeader />
      <main className="exp-root">
        <ExplainerStyles accent="#2a4a8a" accentBg="#e8eef8" />

        <section className="exp-hero">
          <div className="exp-hero-inner">
            <div className="exp-eyebrow">EXPLAINER · NUMBER POOLS</div>
            <h1>How many phone numbers does a dialer need?</h1>
            <p className="exp-lead">
              Enough that no single number carries a whole day of calls. The
              arithmetic is simple; the reason behind it is what most teams learn
              the expensive way.
            </p>
          </div>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ HOW TO THINK ABOUT IT</div>
          <h2>Enough that no one number carries the day.</h2>
          <p>
            The instinct is to work out an exact figure in advance. Resist it —
            the honest answer is that the right number depends on your call
            volume, how long your calls run, and how carriers are scoring
            traffic that month, and only the first of those is knowable up
            front.
          </p>
          <p>
            DialerSeat applies a per-number daily cap and rotates across the
            pool automatically. You do not set it, and you do not need to
            calculate against it. What you watch instead is whether the pool is
            running hot: when numbers are regularly hitting their cap or
            answer rates start slipping, that is the pool telling you to add a
            few. It is a feedback loop rather than a formula.
          </p>
          <p>
            Buy in small batches and add as you grow. A number costs about a
            dollar a month; an agent whose calls stop connecting costs
            considerably more than that in an afternoon.
          </p>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ WHY NOT ONE NUMBER</div>
          <h2>Volume on a single caller ID is what gets it labelled.</h2>
          <p>
            Carrier analytics do not know your intent. They observe a number
            placing several hundred calls a day, most of them short, most of them
            unanswered, many of them to people who have never called back. That is
            a behavioural profile, and it is the same profile a robocaller has.
          </p>
          <p>
            Once a number picks up a Spam Likely label it is effectively finished
            — and if it was carrying your entire operation, your answer rate goes
            with it. Spreading the same volume across a pool keeps every number
            below the threshold where that pattern forms.
          </p>
          <p>
            This is also why buying numbers is cheap insurance. A number costs
            about a dollar a month. An agent whose calls stop connecting costs
            considerably more than that in an afternoon.
          </p>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ LOCAL PRESENCE</div>
          <h2>Match the region, not every area code.</h2>
          <p>
            DialerSeat picks a caller ID by locality: an exact area-code match
            first, then the same state, then any healthy number in the pool. A
            lead in Charlotte sees a Charlotte number if one is free.
          </p>
          <p>
            The temptation is to buy a number for every area code your list
            touches. Resist it. Most lists concentrate heavily in a handful of
            regions, and covering those captures nearly all of the benefit. The
            long tail of one-lead area codes costs the same per number and returns
            almost nothing.
          </p>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ WHEN A NUMBER GOES BAD</div>
          <h2>Headroom is what makes retirement possible.</h2>
          <p>
            DialerSeat tracks answer rate per number across a rolling window. When
            one falls materially behind the rest of the pool, that is the signal it
            has been labelled somewhere upstream, and the right response is to stop
            using it — not to keep dialing and hope.
          </p>
          <p>
            Retiring a number only works if you can afford to lose it. A pool
            sized exactly to your daily volume cannot retire anything without
            pushing everything else over its cap, which is the whole argument
            for keeping a few spare.{' '}
            <Link href="/faq/numbers">How the number pool works</Link> covers
            rotation, caps and health monitoring in detail.
          </p>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ COMMON QUESTIONS</div>
          <h2>Pool sizing, answered.</h2>
          {FAQS.map(f => (
            <div key={f.question} style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 18, marginBottom: 8 }}>{f.question}</h3>
              <p style={{ margin: 0 }}>{f.answer}</p>
            </div>
          ))}
        </section>

        <DialingModeCTA
          headline="Numbers are included, not metered."
          description="Buy what your volume needs, rotate automatically, retire what degrades. No per-number fee. $35/week per seat."
        />
        <ExplainerCrossLinks current="pool-sizing" />
      </main>
      <SiteFooter />
    </>
  )
}
