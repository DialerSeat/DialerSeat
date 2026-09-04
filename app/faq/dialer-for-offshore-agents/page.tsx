import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import GutsShell from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { organizationSchema, breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { FACTS } from '@/lib/canonicalFacts'

// =============================================================================
// /faq/dialer-for-offshore-agents — the wedge nobody is priced for
// =============================================================================
// A separate page rather than a section on the teams hub, because it is a
// separate SEARCH INTENT: "dialer for virtual assistants", "philippines call
// center dialer", "dialer for offshore sales team". Those queries have real
// demand and essentially no competition, because the tools that would rank for
// them are priced at $95–$250 per seat per month — where an offshore floor
// costs more in software than in wages and therefore mostly does not get built.
//
// The honest framing matters here. This page does not claim offshore dialing is
// easy or that compliance stops mattering; it is specific about what carries
// over the border (the seat price, the browser) and what does not (audio
// quality is a real variable, and the legal duties stay with the business).
// =============================================================================

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SITE = 'https://dialerseat.com'

export const metadata: Metadata = {
  title: 'Dialer for Offshore & Remote Agents: VAs, Philippines Teams | DialerSeat',
  description:
    'Running an outbound dialer with agents overseas: what it costs per seat, how calling windows follow the lead rather than the agent, what to test before you hire, and where the real constraints are.',
  alternates: {
    canonical: `${SITE}/faq/dialer-for-offshore-agents`,
    types: { 'text/markdown': `${SITE}/md/faq/dialer-for-offshore-agents` },
  },
  openGraph: {
    title: 'Running a Dialer With Offshore Agents',
    description:
      'Same $35/week seat wherever the agent sits. Calling windows follow the lead, not the agent.',
    url: `${SITE}/faq/dialer-for-offshore-agents`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Running a Dialer With Offshore Agents',
    description: 'Same $35/week seat wherever the agent sits. Calling windows follow the lead, not the agent.',
  },
  robots: { index: true, follow: true },
}

const INK = '#1a1c24'
const MUTED = '#5a5e6a'
const BORDER = '#c4c8d0'
const ACCENT = '#2a4a8a'
const FUTURA = "'Futura PT', Futura, 'Trebuchet MS', sans-serif"

const FAQS = [
  {
    question: 'Can I use DialerSeat with agents in the Philippines or elsewhere overseas?',
    answer:
      'Yes. An agent needs a browser and an internet connection. There is no per-country restriction and no separate international seat price, a seat is $35 per week whether the agent is in Ohio or Manila. The account, the phone numbers, and the leads remain US.',
  },
  {
    question: 'Does an offshore agent cost more per seat?',
    answer:
      'No. This is the difference that makes an offshore floor viable at all: at $95-$250 per seat per month on other platforms, the software costs more than the wage, so the model does not work. At $35 per week it does.',
  },
  {
    question: 'How do calling hours work when the agent is in a different timezone?',
    answer:
      'Calling windows are enforced against the lead’s own state, not the agent’s location or the account’s timezone. An agent working a Manila afternoon cannot dial a Florida lead outside that lead’s legal window, the server refuses the call rather than relying on the agent to know.',
  },
  {
    question: 'Will call quality be acceptable from overseas?',
    answer:
      'Usually, but test it before you staff. Audio crosses the same distance regardless of platform, and the variable is the agent’s own connection, a wired office line behaves very differently from residential wifi. Run one agent on real calls for a day before hiring five.',
  },
  {
    question: 'Does using offshore agents change my compliance obligations?',
    answer:
      'No. TCPA and DNC duties attach to the business placing the calls, not to where the person dialling sits. DialerSeat enforces calling windows per lead state and gives every campaign owner a per-call compliance export, but national DNC scrubbing and consent records remain your responsibility wherever your agents are.',
  },
  {
    question: 'Can each offshore agent have their own login and data?',
    answer:
      'Yes. Every agent gets their own login, their own dialer session, and their own call history. The owner sees per-agent activity and can pause a seat without losing that agent’s data.',
  },
]

export default function OffshoreAgentsPage() {
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'FAQ', url: '/faq' },
        { name: 'Offshore Agents', url: '/faq/dialer-for-offshore-agents' },
      ])} />

      <GutsShell rail={faqRail('/faq/dialer-for-offshore-agents')} activeHref="/faq/dialer-for-offshore-agents">
        <div className="guts-sec">
          <nav style={{ fontSize: 11, letterSpacing: 1.5, color: MUTED, marginBottom: 22 }}>
            <Link href="/" style={{ color: MUTED }}>HOME</Link>{' · '}
            <Link href="/faq" style={{ color: MUTED }}>FAQ</Link>
          </nav>

          <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 'bold', color: ACCENT, marginBottom: 14 }}>
            ▸ Remote &amp; offshore
          </div>
          <h1 style={{ fontSize: 43, fontWeight: 'bold', letterSpacing: -1, lineHeight: 1.13, margin: 0, maxWidth: 820 }}>
            Running a dialer with agents overseas.
          </h1>
          <p style={{ fontSize: 16.5, lineHeight: 1.8, color: MUTED, maxWidth: 770, marginTop: 18 }}>
            Most teams never build an offshore floor because the dialer costs more per seat than the
            agent does per hour. That is a pricing problem, not a technical one.
          </p>

          <section style={{
            marginTop: 34, background: '#fff', border: `1px solid ${BORDER}`,
            borderTop: `3px solid ${ACCENT}`, borderRadius: 8, padding: 28,
          }}>
            <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 'bold', color: ACCENT }}>
              THE ARITHMETIC
            </div>
            <p style={{ fontSize: 15.5, lineHeight: 1.85, marginTop: 12, maxWidth: 760 }}>
              A ten-agent floor costs <strong>$350 per week</strong> in seats on DialerSeat, plus $75
              for the Manager+ owner. The same ten seats on a platform charging $250 per user per
              month is roughly <strong>$2,500 a month</strong>, usually on an annual commitment.
            </p>
            <p style={{ fontSize: 14.5, lineHeight: 1.8, color: MUTED, marginTop: 12, maxWidth: 760 }}>
              That gap is not a discount. It is the difference between a staffing model that works and
              one that does not get attempted.
            </p>
          </section>

          <section style={{ marginTop: 46 }}>
            <h2 style={{ fontSize: 25, fontWeight: 'bold', letterSpacing: -0.4, margin: 0 }}>
              What carries over the border
            </h2>
            <ul style={{ margin: '16px 0 0', paddingLeft: 18, fontSize: 14.5, lineHeight: 1.85, maxWidth: 820 }}>
              {FACTS.teams.offshore.map(l => <li key={l} style={{ marginBottom: 8 }}>{l}</li>)}
            </ul>
          </section>

          <section style={{ marginTop: 46 }}>
            <h2 style={{ fontSize: 25, fontWeight: 'bold', letterSpacing: -0.4, margin: 0 }}>
              The one thing worth testing first
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.85, color: MUTED, marginTop: 12, maxWidth: 790 }}>
              Audio quality is the variable, and it is about the agent&apos;s connection rather than the
              platform. Voice has to cross the same ocean whatever software you use, and a wired office
              line in Manila behaves very differently from residential wifi during a storm.
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.85, color: MUTED, marginTop: 10, maxWidth: 790 }}>
              Put one agent on real calls for a day before hiring five. It is a cheap test and it is
              the only one that tells you anything, a speed test will not.
            </p>
          </section>

          <section style={{
            marginTop: 40, background: '#fff', border: `1px solid ${BORDER}`,
            borderLeft: '4px solid #8a6a1a', borderRadius: 8, padding: 26,
          }}>
            <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 'bold', color: '#8a6a1a' }}>
              COMPLIANCE DOES NOT MOVE OFFSHORE WITH THE AGENT
            </div>
            <p style={{ fontSize: 14.5, lineHeight: 1.8, marginTop: 10, maxWidth: 790 }}>
              TCPA and DNC obligations attach to the business placing the calls, not to where the
              person dialling sits. DialerSeat enforces calling windows per lead state and exports a
              per-call compliance record for any date range, but national DNC scrubbing and consent
              records stay your responsibility, exactly as they would with a domestic floor.
            </p>
          </section>

          <section style={{ marginTop: 52 }}>
            <h2 style={{ fontSize: 25, fontWeight: 'bold', letterSpacing: -0.4, margin: 0 }}>Questions</h2>
            <div style={{ marginTop: 20 }}>
              {FAQS.map(f => (
                <div key={f.question} style={{ marginBottom: 24, maxWidth: 840 }}>
                  <h3 style={{ fontSize: 16.5, fontWeight: 'bold', margin: 0 }}>{f.question}</h3>
                  <p style={{ fontSize: 14.5, lineHeight: 1.8, color: MUTED, margin: '7px 0 0' }}>{f.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <div style={{ marginTop: 44, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/faq/teams-how-it-works" style={{
              fontSize: 11, letterSpacing: 1.5, fontWeight: 'bold', color: '#fff',
              background: ACCENT, borderRadius: 4, padding: '13px 20px', textDecoration: 'none',
            }}>
              HOW TEAMS WORK
            </Link>
            <Link href="/vs/teams" style={{
              fontSize: 11, letterSpacing: 1.5, fontWeight: 'bold', color: ACCENT,
              border: `1px solid ${ACCENT}`, borderRadius: 4, padding: '13px 20px', textDecoration: 'none',
            }}>
              WHAT 5 AGENTS COST ELSEWHERE
            </Link>
          </div>
        </div>
      </GutsShell>
    </>
  )
}
