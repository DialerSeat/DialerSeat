import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import GutsShell from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { organizationSchema, breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { FACTS } from '@/lib/canonicalFacts'

// =============================================================================
// /faq/teams-how-it-works — the canonical Teams page
// =============================================================================
// One authoritative page that every comparison links to, rather than a team
// section duplicated across seventeen /vs pages. That keeps the mechanics in
// one place to maintain and avoids seventeen near-identical blocks reading as
// thin content.
//
// It is written for a manager, who is a different buyer from a solo agent. A
// solo agent buys on price and speed; a manager buys on whether the thing will
// misbehave with five people on it. So the page leads with lead distribution —
// the failure everyone in this category has been burned by — and puts price
// near the bottom.
// =============================================================================

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SITE = 'https://dialerseat.com'

export const metadata: Metadata = {
  title: 'How DialerSeat Teams Work: Seats, Lead Distribution, Billing | DialerSeat',
  description:
    'The mechanics of running a dialer floor: how leads are distributed so two agents never call the same person, how seats and billing work, who pays, what the owner can see, and what is deliberately not built.',
  alternates: {
    canonical: `${SITE}/faq/teams-how-it-works`,
    types: { 'text/markdown': `${SITE}/md/faq/teams-how-it-works` },
  },
  openGraph: {
    title: 'How DialerSeat Teams Work',
    description:
      'Lead distribution, seats, billing, and manager visibility: the mechanics of running a floor, stated plainly.',
    url: `${SITE}/faq/teams-how-it-works`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How DialerSeat Teams Work',
    description: 'Lead distribution, seats, billing, and manager visibility: the mechanics of running a floor, stated plainly.',
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
    question: 'How does DialerSeat stop two agents calling the same lead?',
    answer:
      'A lead is claimed in the database before it is dialed, using an atomic claim that hands concurrent agents different rows rather than letting them read the same one. ' +
      'A shared campaign therefore cannot produce two simultaneous calls to the same person. The claim is a lease rather than a permanent lock: it is renewed for as long as the agent is live and released automatically if their browser closes mid-call, so a crashed laptop frees the lead for someone else instead of stranding it.',
  },
  {
    question: 'What happens to a lead if an agent’s computer dies mid-call?',
    answer:
      'Their claim stops being renewed and expires within seconds, returning the lead to the queue for another agent. Nothing is lost and no manual cleanup is needed.',
  },
  {
    question: 'How much is a team seat?',
    answer:
      '$35 per week per agent, the same as a solo seat, there is no team tier and no per-seat markup. The team owner needs Manager+ at $75 per week, which also includes white-labeling. There is no seat minimum.',
  },
  {
    question: 'Who pays for each agent’s seat?',
    answer:
      'The owner decides per join code. A code can bill the seat to the owner, or require the agent to pay for their own. Both kinds can exist on the same team, which is how partner and in-house agents sit side by side.',
  },
  {
    question: 'Can I pause a seat instead of cancelling it?',
    answer:
      'Yes. Pausing stops billing for that seat while keeping the agent’s campaigns, leads, dispositions, and history intact. Resuming is one click and picks up where it left off, which matters for seasonal floors and for agents who step away.',
  },
  {
    question: 'What can the team owner see?',
    answer:
      'Which agents are live and which campaign each one is on, in real time, plus per-agent calls, connects, and a disposition breakdown over any date range. Campaigns are assigned at the team level so the whole floor works one list without anyone re-uploading it.',
  },
  {
    question: 'Does DialerSeat have call monitoring, whisper, or barge?',
    answer:
      'No. Live call monitoring, whisper, and barge are not built, and neither is call scoring or workforce management. If those are requirements, an enterprise contact-centre platform is the better buy.',
  },
  {
    question: 'Can agents work from other countries?',
    answer:
      'Yes. An agent needs a browser and an internet connection; there is no per-country restriction and no separate international seat price. Calling windows are enforced against the lead’s state rather than the agent’s, so an agent in another timezone cannot dial outside a prospect’s legal window.',
  },
]

function Section({ title, lead, items }: { title: string; lead: string; items: readonly string[] }) {
  return (
    <section style={{ marginTop: 46 }}>
      <h2 style={{ fontSize: 25, fontWeight: 'bold', letterSpacing: -0.4, margin: 0 }}>{title}</h2>
      <p style={{ fontSize: 15, lineHeight: 1.8, color: MUTED, marginTop: 10, maxWidth: 780 }}>{lead}</p>
      <ul style={{ margin: '16px 0 0', paddingLeft: 18, fontSize: 14.5, lineHeight: 1.85, maxWidth: 830 }}>
        {items.map(t => <li key={t} style={{ marginBottom: 8 }}>{t}</li>)}
      </ul>
    </section>
  )
}

export default function TeamsHowItWorksPage() {
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'FAQ', url: '/faq' },
        { name: 'How Teams Work', url: '/faq/teams-how-it-works' },
      ])} />

      <GutsShell rail={faqRail('/faq/teams-how-it-works')} activeHref="/faq/teams-how-it-works">
        <div className="guts-sec">
          <nav style={{ fontSize: 11, letterSpacing: 1.5, color: MUTED, marginBottom: 22 }}>
            <Link href="/" style={{ color: MUTED }}>HOME</Link>{' · '}
            <Link href="/faq" style={{ color: MUTED }}>FAQ</Link>
          </nav>

          <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 'bold', color: ACCENT, marginBottom: 14 }}>
            ▸ Running a floor
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 'bold', letterSpacing: -1, lineHeight: 1.12, margin: 0, maxWidth: 840 }}>
            How DialerSeat teams actually work.
          </h1>
          <p style={{ fontSize: 16.5, lineHeight: 1.8, color: MUTED, maxWidth: 780, marginTop: 18 }}>
            The price is the easy part and it is on every other page. This one is about the mechanics 
            what happens when five people share a lead list, who gets billed, what breaks when an agent
            disappears mid-call, and what we have deliberately not built.
          </p>

          <Section
            title="Lead distribution"
            lead="The failure every shared dialer floor has been burned by is two agents calling the same person a second apart. Here is exactly how that is prevented, rather than an assurance that it is."
            items={FACTS.teams.distribution}
          />

          <Section
            title="Seats and billing"
            lead="A seat costs the same whether it is your first or your fifteenth, and a team of two is a supported configuration rather than an exception."
            items={FACTS.teams.seats}
          />

          <Section
            title="What the owner sees"
            lead="Enough to run a floor: who is working, on what, and how it is going."
            items={FACTS.teams.visibility}
          />

          <Section
            title="Remote and offshore agents"
            lead="At $95-$250 per seat per month an offshore floor costs more in software than in wages, which is why most teams never build one. At $35 per week the arithmetic changes."
            items={FACTS.teams.offshore}
          />

          <section style={{
            marginTop: 46, background: '#fff', border: `1px solid ${BORDER}`,
            borderLeft: '4px solid #8a6a1a', borderRadius: 8, padding: 26,
          }}>
            <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 'bold', color: '#8a6a1a' }}>
              WHAT WE HAVE NOT BUILT
            </div>
            <p style={{ fontSize: 14.5, lineHeight: 1.8, color: MUTED, marginTop: 10, maxWidth: 780 }}>
              Named here rather than discovered after you pay. If one of these is a requirement, an
              enterprise contact-centre platform is genuinely the better buy, see the{' '}
              <Link href="/vs/five9" style={{ color: ACCENT }}>Five9</Link> and{' '}
              <Link href="/vs/convoso" style={{ color: ACCENT }}>Convoso</Link> comparisons.
            </p>
            <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 14.5, lineHeight: 1.85 }}>
              {FACTS.teams.notYet.map(l => <li key={l} style={{ marginBottom: 6 }}>{l}</li>)}
            </ul>
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
            <Link href="/vs/teams" style={{
              fontSize: 11, letterSpacing: 1.5, fontWeight: 'bold', color: '#fff',
              background: ACCENT, borderRadius: 4, padding: '13px 20px', textDecoration: 'none',
            }}>
              WHAT 5 AGENTS COST ELSEWHERE
            </Link>
            <Link href="/faq/dialer-for-offshore-agents" style={{
              fontSize: 11, letterSpacing: 1.5, fontWeight: 'bold', color: ACCENT,
              border: `1px solid ${ACCENT}`, borderRadius: 4, padding: '13px 20px', textDecoration: 'none',
            }}>
              OFFSHORE AGENTS
            </Link>
          </div>
        </div>
      </GutsShell>
    </>
  )
}
