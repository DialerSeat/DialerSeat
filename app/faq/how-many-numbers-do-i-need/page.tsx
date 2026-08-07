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
    'A caller ID has a daily volume ceiling before answer rates fall. Work back from calls per agent per day, divide by a per-number cap, and add headroom for rotation. The arithmetic, with worked examples.',
  alternates: { canonical: 'https://dialerseat.com/faq/how-many-numbers-do-i-need' },
  openGraph: {
    title: 'How Many Phone Numbers Does a Dialer Need?',
    description:
      'Work back from calls per day and a per-number daily cap. The arithmetic, and why one number never works.',
    url: 'https://dialerseat.com/faq/how-many-numbers-do-i-need',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How Many Phone Numbers Does a Dialer Need?',
    description: 'Calls per day ÷ per-number daily cap, plus headroom. Worked examples.',
  },
}

const FAQS = [
  {
    question: 'How many phone numbers do I need for an outbound dialer?',
    answer:
      'Divide your daily call volume by a per-number daily cap, then add headroom for numbers resting or retired. DialerSeat caps each number at 125 calls a day by default, so a single agent making 250 calls needs at least two numbers and comfortably runs on three. A five-agent floor at 250 calls each is 1,250 calls a day, which needs ten numbers at the cap and closer to thirteen with headroom.',
  },
  {
    question: 'Why not just use one number for everything?',
    answer:
      'Because volume on a single caller ID is the fastest way to get it labelled. Carrier analytics watch call volume, call duration, and how often people decline or report a number. A number placing several hundred short unanswered calls a day looks exactly like a robocall to that scoring, because statistically it is behaving like one. Once the label attaches, the number is finished — and if it is your only number, so is your answer rate.',
  },
  {
    question: 'What is a sensible daily cap per number?',
    answer:
      'DialerSeat defaults to 125 calls per number per day. There is no universal correct figure — carrier scoring is opaque and changes — but a cap in the low hundreds keeps any one number well below the volume that draws attention, and spreading across a pool means no single number carries the whole day.',
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

const EXAMPLES = [
  { agents: '1 agent', calls: '250 calls/day', min: '2 numbers', rec: '3 numbers' },
  { agents: '3 agents', calls: '750 calls/day', min: '6 numbers', rec: '8 numbers' },
  { agents: '5 agents', calls: '1,250 calls/day', min: '10 numbers', rec: '13 numbers' },
  { agents: '10 agents', calls: '2,500 calls/day', min: '20 numbers', rec: '25 numbers' },
  { agents: '20 agents', calls: '5,000 calls/day', min: '40 numbers', rec: '50 numbers' },
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
          <div className="exp-section-label">▸ THE ARITHMETIC</div>
          <h2>Calls per day, divided by a per-number cap, plus headroom.</h2>
          <p>
            Start with your real daily volume — agents multiplied by calls each
            per day. Divide by the cap you are willing to put on any single
            number. DialerSeat defaults that cap to <strong>125 calls per number
            per day</strong>. Then add roughly 25% headroom so retiring a number
            mid-week does not cost you capacity.
          </p>
          <div className="exp-table-wrap" style={{ overflowX: 'auto', margin: '24px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  {['FLOOR', 'VOLUME', 'MINIMUM', 'WITH HEADROOM'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '10px 12px',
                      borderBottom: '2px solid #2a4a8a', color: '#8888aa',
                      fontSize: 11, letterSpacing: 2,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EXAMPLES.map(r => (
                  <tr key={r.agents}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #2a2a4a', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{r.agents}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #2a2a4a', color: '#c4c8d8', whiteSpace: 'nowrap' }}>{r.calls}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #2a2a4a', color: '#c4c8d8', whiteSpace: 'nowrap' }}>{r.min}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #2a2a4a', color: '#4ade80', whiteSpace: 'nowrap' }}>{r.rec}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ color: '#8888aa', fontSize: 14 }}>
            Assumes 250 calls per agent per day, which is a realistic figure for
            power or progressive dialing over a full shift. Predictive pushes that
            higher, so scale the volume column to what your floor actually does
            rather than to this table.
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
            Retiring a number only works if you can afford to lose it. A pool sized
            exactly to your daily volume cannot retire anything without going over
            cap on everything else, which is the whole reason for the headroom
            column above.{' '}
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
