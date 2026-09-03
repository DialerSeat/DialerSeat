import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import { organizationSchema, breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { COMPETITORS, DIALERSEAT } from '@/lib/competitors'
import { FACTS } from '@/lib/canonicalFacts'

// =============================================================================
// /vs/teams — what a five-agent floor actually costs, across every tool
// =============================================================================
// The single most persuasive artifact we can publish for the team buyer, and
// deliberately built as ONE page rather than a section repeated on seventeen
// comparison pages. Repeating it would be thin, near-duplicate content and a
// maintenance trap the first time a vendor changes seat terms.
//
// It leads on FRICTION, not price. A manager comparing dialers already knows
// the headline rate; what decides the purchase is whether adding the sixth
// agent is an afternoon decision or a procurement event. That is the column
// nobody else publishes, because for most of them the honest answer is bad.
// =============================================================================

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SITE = 'https://dialerseat.com'

export const metadata: Metadata = {
  title: 'Dialer Pricing for Teams: What 5 Agents Actually Cost | DialerSeat',
  description:
    'Seat minimums, contract terms, and what it really takes to add one more agent, compared across every major outbound dialer. Plus how leads are distributed across a floor without two agents calling the same person.',
  alternates: {
    canonical: `${SITE}/vs/teams`,
    types: { 'text/markdown': `${SITE}/md/vs/teams` },
  },
  openGraph: {
    title: 'What a 5-Agent Dialer Floor Actually Costs',
    description:
      'Seat minimums, contracts, and the real cost of adding one more agent, across every major dialer.',
    url: `${SITE}/vs/teams`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'What a 5-Agent Dialer Floor Actually Costs',
    description: 'Seat minimums, contracts, and the real cost of adding one more agent, across every major dialer.',
  },
}

const INK = '#1a1c24'
const MUTED = '#5a5e6a'
const BORDER = '#c4c8d0'
const ACCENT = '#2a4a8a'
const FUTURA = "'Futura PT', Futura, 'Trebuchet MS', sans-serif"

const FAQS = [
  {
    question: 'What does a 5-agent dialer team cost?',
    answer:
      'On DialerSeat, $175 per week in seats ($35 each) plus $75 per week for the Manager+ owner, with all four dialer modes included and no contract. ' +
      'Most alternatives price per seat per month with a minimum: Orum is around $1,250/month for five, billed annually with a three-seat minimum; ' +
      'Aircall is $250/month on the tier that includes the Power Dialer, with a three-licence minimum; Five9 does not publish pricing and quotes commonly land at $175+ per seat per month.',
  },
  {
    question: 'Can two agents on the same campaign call the same lead?',
    answer:
      'Not on DialerSeat. Leads are claimed atomically in the database before they are dialed, so a shared campaign cannot hand the same lead to two agents. ' +
      'The claim is a lease that is renewed while the agent is live and released automatically if their browser closes mid-call, so a crashed session frees its lead instead of stranding it.',
  },
  {
    question: 'Is there a seat minimum?',
    answer:
      'No. A team of two is a supported configuration. Several alternatives have minimums: Orum requires three seats, Aircall three licences, JustCall two.',
  },
  {
    question: 'Who pays for each agent’s seat?',
    answer:
      'The team owner chooses per join code. A code can be set so the owner is billed for that seat, or so the agent pays for their own. Both can exist on the same team.',
  },
  {
    question: 'Can an agent work from another country?',
    answer:
      'Yes. Agents need a browser and an internet connection; there is no per-country restriction and no separate international seat price. ' +
      'Calling windows are enforced against the lead’s state rather than the agent’s, so an agent in another timezone cannot dial outside a prospect’s legal window.',
  },
]

function Th({ children, w }: { children: React.ReactNode; w?: string }) {
  return (
    <th style={{
      textAlign: 'left', fontSize: 9.5, letterSpacing: 1.8, color: ACCENT,
      borderBottom: `2px solid ${ACCENT}`, padding: '10px 12px', fontWeight: 'bold',
      width: w, verticalAlign: 'bottom',
    }}>{children}</th>
  )
}

function Td({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return (
    <td style={{
      padding: '11px 12px', borderBottom: `1px solid ${BORDER}`,
      fontSize: 13.5, lineHeight: 1.55, verticalAlign: 'top',
      fontWeight: bold ? 'bold' : 'normal',
    }}>{children}</td>
  )
}

export default function TeamsComparisonPage() {
  const rows = COMPETITORS.filter(c => c.crossShopped)

  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Comparisons', url: '/vs' },
        { name: 'Teams', url: '/vs/teams' },
      ])} />

      <main style={{
        background: 'var(--brand-page-bg, #f0f1f4)', minHeight: '100vh',
        fontFamily: FUTURA, color: INK,
      }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '80px 24px 96px' }}>
          <nav style={{ fontSize: 11, letterSpacing: 1.5, color: MUTED, marginBottom: 22 }}>
            <Link href="/" style={{ color: MUTED }}>HOME</Link>{' · '}
            <Link href="/vs" style={{ color: MUTED }}>COMPARISONS</Link>
          </nav>

          <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 'bold', color: ACCENT, marginBottom: 14 }}>
            ▸ Dialers for teams
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 'bold', letterSpacing: -1, lineHeight: 1.12, margin: 0, maxWidth: 820 }}>
            What a five-agent floor actually costs.
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.8, color: MUTED, maxWidth: 760, marginTop: 18 }}>
            Every vendor publishes a per-seat rate. Almost none publish the seat minimum, the contract
            term, or what it takes to add the sixth agent, which is the part that decides whether a
            growing floor is an afternoon decision or a procurement event.
          </p>

          {/* ── THE TABLE ─────────────────────────────────────────────────── */}
          <div style={{ overflowX: 'auto', marginTop: 36 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', minWidth: 780 }}>
              <thead>
                <tr>
                  <Th w="16%">Tool</Th>
                  <Th w="16%">Smallest team</Th>
                  <Th w="34%">Adding one more agent</Th>
                  <Th w="34%">Five agents</Th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: 'rgba(42, 74, 138, 0.06)' }}>
                  <Td bold>DialerSeat</Td>
                  <Td>{DIALERSEAT.team.minimum}</Td>
                  <Td>{DIALERSEAT.team.addingASeat}</Td>
                  <Td bold>{DIALERSEAT.team.fiveSeats}</Td>
                </tr>
                {rows.map(c => (
                  <tr key={c.slug}>
                    <Td bold>
                      <Link href={`/vs/${c.slug}`} style={{ color: ACCENT, textDecoration: 'none' }}>
                        {c.name}
                      </Link>
                    </Td>
                    <Td>{c.team.minimum}</Td>
                    <Td>{c.team.addingASeat}</Td>
                    <Td>{c.team.fiveSeats}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: 12, lineHeight: 1.8, color: MUTED, marginTop: 14, maxWidth: 820 }}>
            Other vendors&apos; pricing is summarised from their public materials and changes without
            notice, verify current terms before buying. Where a vendor does not publish pricing, that
            is stated rather than guessed. Corrections welcome; we would rather be accurate than
            flattering.
          </p>

          {/* ── THE PART PRICE DOESN'T COVER ──────────────────────────────── */}
          <section style={{ marginTop: 56 }}>
            <h2 style={{ fontSize: 26, fontWeight: 'bold', letterSpacing: -0.5, margin: 0 }}>
              The part a price comparison misses
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: MUTED, marginTop: 12, maxWidth: 780 }}>
              Cost is the easy question. What actually goes wrong on a shared floor is mechanical, and
              it is worth knowing exactly how a tool handles each of these before five people depend
              on it.
            </p>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 18, marginTop: 26,
            }}>
              {[
                ['LEAD DISTRIBUTION', FACTS.teams.distribution],
                ['SEATS AND BILLING', FACTS.teams.seats],
                ['WHAT THE OWNER SEES', FACTS.teams.visibility],
              ].map(([title, items]) => (
                <div key={title as string} style={{
                  background: '#fff', border: `1px solid ${BORDER}`,
                  borderTop: `3px solid ${ACCENT}`, borderRadius: 8, padding: 24,
                }}>
                  <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 'bold', color: ACCENT }}>
                    {title as string}
                  </div>
                  <ul style={{ margin: '12px 0 0', paddingLeft: 17, fontSize: 13.5, lineHeight: 1.75 }}>
                    {(items as readonly string[]).map(t => <li key={t} style={{ marginBottom: 8 }}>{t}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* ── LIMITS, STATED ────────────────────────────────────────────── */}
          <section style={{
            marginTop: 28, background: '#fff', border: `1px solid ${BORDER}`,
            borderLeft: `4px solid #8a6a1a`, borderRadius: 8, padding: 26,
          }}>
            <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 'bold', color: '#8a6a1a' }}>
              WHAT DIALERSEAT DOES NOT DO FOR TEAMS
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.75, color: MUTED, marginTop: 10 }}>
              If any of these is a requirement, one of the enterprise platforms above is the better
              buy and we would rather you found that out here than after paying us.
            </p>
            <ul style={{ margin: '10px 0 0', paddingLeft: 17, fontSize: 14, lineHeight: 1.8 }}>
              {FACTS.teams.notYet.map(l => <li key={l} style={{ marginBottom: 5 }}>{l}</li>)}
            </ul>
          </section>

          {/* ── OFFSHORE ──────────────────────────────────────────────────── */}
          <section style={{ marginTop: 56 }}>
            <h2 style={{ fontSize: 26, fontWeight: 'bold', letterSpacing: -0.5, margin: 0 }}>
              Remote and offshore agents
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: MUTED, marginTop: 12, maxWidth: 780 }}>
              At $95-$250 per seat per month, an offshore floor costs more in software than in wages,
              which is why most teams never build one. At $35 per week the arithmetic changes.
            </p>
            <ul style={{ margin: '16px 0 0', paddingLeft: 17, fontSize: 14.5, lineHeight: 1.85, maxWidth: 800 }}>
              {FACTS.teams.offshore.map(l => <li key={l} style={{ marginBottom: 7 }}>{l}</li>)}
            </ul>
            <p style={{ fontSize: 14, lineHeight: 1.8, color: MUTED, marginTop: 16, maxWidth: 800 }}>
              More detail:{' '}
              <Link href="/faq/dialer-for-offshore-agents" style={{ color: ACCENT }}>
                running a dialer with remote or offshore agents
              </Link>.
            </p>
          </section>

          {/* ── FAQ ───────────────────────────────────────────────────────── */}
          <section style={{ marginTop: 56 }}>
            <h2 style={{ fontSize: 26, fontWeight: 'bold', letterSpacing: -0.5, margin: 0 }}>
              Questions
            </h2>
            <div style={{ marginTop: 20 }}>
              {FAQS.map(f => (
                <div key={f.question} style={{ marginBottom: 22, maxWidth: 830 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 'bold', margin: 0 }}>{f.question}</h3>
                  <p style={{ fontSize: 14.5, lineHeight: 1.8, color: MUTED, margin: '7px 0 0' }}>
                    {f.answer}
                  </p>
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
            <Link href="/vs" style={{
              fontSize: 11, letterSpacing: 1.5, fontWeight: 'bold', color: ACCENT,
              border: `1px solid ${ACCENT}`, borderRadius: 4, padding: '13px 20px', textDecoration: 'none',
            }}>
              ALL COMPARISONS
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
