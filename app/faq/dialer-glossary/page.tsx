import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { primeLocale, t as tr } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

// =============================================================================
// /faq/dialer-glossary
// =============================================================================
// WHY A GLOSSARY. Every one of these words is a search of its own ("what is an
// abandoned call", "what does AMD mean", "connect rate vs contact rate"), and
// a model answering one of them wants a single definition it can lift. One page
// of short, sourced definitions is worth more than the same words scattered
// through prose on twelve pages.
//
// THE RULE APPLIED HERE. A term gets a definition from the RULE or the CODE,
// never from how the industry loosely uses it:
//
//   abandoned call        16 CFR 310.4(b)(1)(iv), via Cornell
//   3% abandon rate       16 CFR 310.4(b)(4)(i), 47 CFR 64.1200(a)(7)
//   answer / connect /    lib/dialOutcome plus api/analytics/summary:
//     contact rate          contact = CLOSED, APPOINTMENT, NOT INTERESTED or
//                           DO NOT CALL, over dials that RANG
//   drop to one line      lib/dialerPacing, at 2.5%
//   local presence        claim_pool_number's ORDER BY; see the local presence
//                           page for the full order
//   dispositions          the six in lib/canonicalFacts, which is what the app
//                           actually offers
//
// Terms we do NOT offer are defined anyway (barge, whisper), because a reader
// comparing platforms searches for them, and because the honest answer is that
// we decided against them rather than that they do not exist.
// =============================================================================

const ROUTE = '/faq/dialer-glossary'

const baseMetadata: Metadata = {
  title: 'Dialer Glossary: Every Auto Dialer Term, Defined | DialerSeat',
  description:
    'Plain definitions of the terms outbound calling runs on: abandoned call, abandon rate, AMD, answer rate, connect rate, contact rate, local presence, STIR/SHAKEN, DNC, disposition, pacing and the rest.',
  keywords: [
    'dialer glossary',
    'auto dialer terms',
    'what is an abandoned call',
    'what is AMD dialer',
    'connect rate vs contact rate',
    'what is local presence',
    'predictive dialer terminology',
  ],
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'Dialer Glossary: Every Auto Dialer Term, Defined',
    description: 'Plain definitions of the terms outbound calling runs on.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dialer Glossary',
    description: 'Plain definitions of the terms outbound calling runs on.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("What is an abandoned call?"),
    answer:
      msg("Under the FTC’s Telemarketing Sales Rule, a call is abandoned when a person answers it and is not connected to a sales representative within two seconds of finishing their greeting. Predictive dialers cause them by dialing more numbers than there are free agents."),
  },
  {
    question: msg("What is AMD, or answering machine detection?"),
    answer:
      msg("Software that listens to how a call is answered and decides whether it reached a person or a voicemail greeting, so the dialer can pass people to an agent and handle machines separately. It is a judgement made on audio, so it is never perfect."),
  },
  {
    question: msg("What is the difference between connect rate and contact rate?"),
    answer:
      msg("Connect rate is how often somebody picks up. Contact rate is how often the agent actually spoke to the right person and got an outcome, which is a smaller number. A call answered by a voicemail greeting can raise connect rate without raising contact rate."),
  },
  {
    question: msg("What is local presence dialing?"),
    answer:
      msg("Calling each prospect from a phone number local to them, so the caller ID shows a familiar area code. DialerSeat matches the prospect’s area code first, then their state, then their region."),
  },
  {
    question: msg("What does “lines per agent” mean?"),
    answer:
      msg("How many numbers a predictive dialer calls at once for each available agent. More lines mean less waiting between conversations and more abandoned calls, which is why the rate is capped at 3%."),
  },
]

/** One definition. `see` is an internal page that explains it properly. */
type Term = { term: string; def: string; see?: { href: string; label: string } }

const MODES: Term[] = [
  {
    term: 'Preview dialer',
    def: 'The agent sees the lead before the call is placed and starts it themselves. Slowest, and the right choice when each lead is worth preparing for.',
    see: { href: '/faq/what-is-a-preview-dialer', label: msg("Preview dialing") },
  },
  {
    term: 'Power dialer',
    def: 'Dials the next lead automatically as soon as the last call ends. One call at a time, with no pause between them.',
    see: { href: '/faq/what-is-a-power-dialer', label: msg("Power dialing") },
  },
  {
    term: 'Progressive dialer',
    def: 'Dials automatically with the agent already on the line, so there is no connect delay when somebody answers.',
    see: { href: '/faq/what-is-a-progressive-dialer', label: msg("Progressive dialing") },
  },
  {
    term: 'Predictive dialer',
    def: 'Dials several numbers at once per available agent and passes the first person who answers to an agent. The most conversations per hour, and the only mode the abandon rules apply to.',
    see: { href: '/faq/what-is-a-predictive-dialer', label: msg("Predictive dialing") },
  },
  {
    term: 'Lines per agent',
    def: 'How many calls a predictive dialer places at once for each free agent, often written 1x, 2x or 3x. More lines mean less waiting and more abandoned calls.',
  },
  {
    term: 'Pacing',
    def: 'The dialer deciding how many lines to run right now, based on how many agents are free and how the campaign has been performing. Pacing is what keeps a predictive campaign under its abandon limit.',
  },
]

const METRICS: Term[] = [
  {
    term: 'Dial',
    def: 'One attempt to call one number. Every dial is billed by the carrier whether or not anyone answers.',
  },
  {
    term: 'Answer rate',
    def: 'How often somebody picks up, as a share of the dials that actually rang. Dials that failed before reaching a phone are left out of the rate and kept in the dial count.',
    see: { href: '/faq/how-we-measure-answer-rate', label: msg("How we measure it") },
  },
  {
    term: 'Connect rate',
    def: 'Used interchangeably with answer rate by most vendors: how often a dial reaches somebody rather than ringing out. Always ask what the denominator is before comparing two platforms’ figures.',
  },
  {
    term: 'Contact rate',
    def: 'How often a call produced a real outcome with the person, rather than just being answered. On DialerSeat that means the agent marked the call closed, an appointment, not interested, or do not call.',
  },
  {
    term: 'Conversion rate',
    def: 'The share of calls that ended in the outcome you are dialing for. On DialerSeat, calls marked closed or appointment.',
  },
  {
    term: 'Talk time',
    def: 'Time spent actually speaking to somebody, measured from when they answered. Not the same as time spent dialing, which includes every ring and every wrap-up.',
  },
  {
    term: 'Wrap-up',
    def: 'The seconds after a call while the agent records what happened. Long wrap-ups are usually the biggest hidden cost on a dialing floor.',
  },
  {
    term: 'Disposition',
    def: 'What the agent marks a call as when it ends. DialerSeat has six: closed, call back, not interested, do not call, skipped and no answer.',
  },
]

const COMPLIANCE: Term[] = [
  {
    term: 'Abandoned call',
    def: 'A call where a person answers and is not connected to a sales representative within two seconds of finishing their greeting. The definition is the FTC’s, in the Telemarketing Sales Rule.',
    see: { href: '/faq/is-a-predictive-dialer-legal', label: msg("The rules in full") },
  },
  {
    term: 'Abandon rate, and the 3% rule',
    def: 'The share of calls answered by a person that were abandoned. Both the FTC and the FCC cap it at 3%, measured per campaign over each 30-day period. DialerSeat drops a campaign to one line per agent at 2.5%, before the limit.',
    see: { href: '/faq/is-a-predictive-dialer-legal', label: msg("How the cap is enforced") },
  },
  {
    term: 'TCPA',
    def: 'The Telephone Consumer Protection Act, the federal law behind the FCC’s calling rules, including calling hours and restrictions on automated calls to mobiles.',
  },
  {
    term: 'TSR',
    def: 'The Telemarketing Sales Rule, the FTC’s rulebook for telemarketing. It contains the abandoned-call definition, the 3% cap and the do-not-call requirements.',
  },
  {
    term: 'DNC',
    def: 'Do not call. Both the National Do Not Call Registry, which you scrub your own lists against, and your own list of people who told you directly to stop.',
    see: { href: '/faq/how-to-scrub-the-do-not-call-registry', label: msg("How to scrub") },
  },
  {
    term: 'Suppression list',
    def: 'Numbers a dialer refuses to call again. On DialerSeat, pressing 9 on the abandoned-call message blocks a number across your account, and a text saying STOP blocks it platform-wide.',
  },
  {
    term: 'Calling window',
    def: 'The hours you are allowed to call. Federally 8 a.m. to 9 p.m. in the person’s own local time, with some states stricter. DialerSeat enforces it per lead, not per agent.',
    see: { href: '/faq/calling-hours', label: msg("Calling hours by state") },
  },
  {
    term: 'Safe harbor',
    def: 'The protection from liability a telemarketer gets for an occasional mistake, provided they met the conditions attached to it. Missing any condition means there is no safe harbor at all.',
  },
]

const NUMBERS: Term[] = [
  {
    term: 'Caller ID',
    def: 'The number shown on the phone you are calling. On an outbound floor it is chosen per call, from a pool.',
  },
  {
    term: 'CNAM',
    def: 'Caller ID name: the text shown alongside a number. It comes from carrier databases rather than from the call itself, and most mobile phones do not display it at all.',
  },
  {
    term: 'STIR/SHAKEN',
    def: 'The system US carriers use to sign calls so the receiving carrier can tell the caller ID was not spoofed.',
  },
  {
    term: 'A-attestation',
    def: 'The strongest STIR/SHAKEN signature: the carrier is confirming both who is calling and that they are entitled to use that number. Lower grades make a call more likely to be flagged.',
  },
  {
    term: 'Local presence',
    def: 'Calling from a number in the prospect’s own area. DialerSeat matches area code, then state, then region, on every call.',
    see: { href: '/faq/local-presence-dialing', label: msg("How the number is picked") },
  },
  {
    term: 'Spam Likely',
    def: 'A label a carrier or a phone app puts on an incoming call. It is a judgement made by analytics companies about how a number behaves, not a legal status, and it can be wrong.',
    see: { href: '/faq/why-calls-show-spam-likely', label: msg("Why it happens") },
  },
  {
    term: 'Number pool',
    def: 'The set of numbers a dialer calls from, so no single number carries all the traffic. DialerSeat sends a number to the back of the queue after 40 calls in a day, and rests it at 60.',
    see: { href: '/faq/how-many-numbers-do-i-need', label: msg("How many you need") },
  },
  {
    term: 'Number rotation',
    def: 'Spreading calls across a pool. Worth knowing that rotating faster is not automatically better: a brand new number with no history is not a trusted one.',
    see: { href: '/faq/why-we-dont-rest-flagged-numbers', label: msg("What we do instead") },
  },
]

const FLOOR: Term[] = [
  {
    term: 'AMD',
    def: 'Answering machine detection. The dialer listens to how a call was answered and decides whether it reached a person or a voicemail greeting. It is a judgement about audio, so it is never perfect in either direction.',
    see: { href: '/faq/how-does-amd-work', label: msg("How AMD works") },
  },
  {
    term: 'Voicemail drop',
    def: 'Leaving a pre-recorded message on a voicemail without the agent speaking it.',
  },
  {
    term: 'Lead drip',
    def: 'New leads arriving into a running campaign automatically from a CRM or a form, rather than being uploaded as a file.',
    see: { href: '/faq/send-leads-from-your-crm', label: msg("Setting it up") },
  },
  {
    term: 'Barge, whisper and monitor',
    def: 'A supervisor listening to a live call, speaking only to the agent, or joining it. DialerSeat does not offer them. Supervision here is reviewing recordings afterwards.',
  },
  {
    term: 'Seat',
    def: 'One agent’s access to the dialer. DialerSeat charges $35 per seat per week with no minimum, so a seat is the whole unit of cost.',
    see: { href: '/faq/why-we-charge', label: msg("What that covers") },
  },
]

function TermList({ terms }: { terms: Term[] }) {
  return (
    <div className="guts-grid-2">
      {terms.map(t => (
        <div className="guts-panel" key={t.term}>
          <h3>{tr(t.term)}</h3>
          <p>{tr(t.def)}</p>
          {t.see && (
            <p>
              <Link href={t.see.href}>{tr(t.see.label)} →</Link>
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

export default async function Page() {
  await primeLocale()
  return (
    <>
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("FAQ"), url: '/faq' },
          { name: msg("Dialer glossary"), url: ROUTE },
        ])}
      />
      <SiteHeader />
      <GutsShell rail={faqRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{tr("▸ GLOSSARY")}</div>
            <h1>
              {tr("Every dialer term,")}<span className="second">{tr("defined once, properly.")}</span>
            </h1>
            <p>
              {tr("Outbound calling has its own vocabulary, and a lot of it is used loosely by the people selling it. Where a term has a legal definition, that is the one used here. Where it describes something DialerSeat does, it says what we actually do.")}</p>
          </div>
        </GutsSection>

        <GutsSection icon="swap" title={tr("Dialing modes and pacing")}>
          <TermList terms={MODES} />
        </GutsSection>

        <GutsSection icon="table" title={tr("The numbers on your dashboard")}>
          <TermList terms={METRICS} />
          <p style={{ marginTop: 24 }}>
            {tr("When you compare two platforms’ figures, ask what each one divides by. That choice moves a rate more than anything the platforms actually do differently.")}{' '}
            <Link href="/faq/how-we-measure-answer-rate">{tr("How we measure ours")}</Link>.
          </p>
        </GutsSection>

        <GutsSection icon="shield" title={tr("Compliance")}>
          <TermList terms={COMPLIANCE} />
        </GutsSection>

        <GutsSection icon="phone" title={tr("Phone numbers and caller ID")}>
          <TermList terms={NUMBERS} />
        </GutsSection>

        <GutsSection icon="team" title={tr("On the floor")}>
          <TermList terms={FLOOR} />
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">{tr("GET STARTED →")}</Link>
            <Link href="/faq" className="guts-btn secondary">{tr("ALL ANSWERS")}</Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
