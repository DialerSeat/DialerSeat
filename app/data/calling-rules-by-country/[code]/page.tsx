import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import PageStamp from '@/components/PageStamp'
import CiteThis from '@/components/CiteThis'
import { resourcesRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { COUNTRY_RULES, RULES_CHECKED, type CountryRule } from '@/lib/countryRules'
import { pageDate } from '@/lib/pageDates'
import { withShareImage } from '@/lib/i18n/metadata'

// =============================================================================
// /data/calling-rules-by-country/<code> — one country's rules, on its own page
// =============================================================================
// The table page answers "rules by country". This answers "France cold calling
// rules", "Spain 400 prefix", "Australia telemarketing hours": the searches a
// floor makes about one market, and the page another site links when it
// mentions one country. An anchor on the table cannot rank for those; a page
// with that country in its title and h1 can.
//
// Not thin: each page is only the rules we verified for that country, with
// their sources, and nothing is padded to make pages look alike. A country
// with three verified rules gets a page with three rules.
// =============================================================================

export function generateStaticParams() {
  return COUNTRY_RULES.map((c) => ({ code: c.code.toLowerCase() }))
}

function byCode(code: string): CountryRule | undefined {
  return COUNTRY_RULES.find((c) => c.code.toLowerCase() === code.toLowerCase())
}

const FIELDS: { key: keyof CountryRule; label: string }[] = [
  { key: 'dnc', label: 'Do Not Call list' },
  { key: 'hours', label: 'Calling hours' },
  { key: 'consent', label: 'Consent' },
  { key: 'dialer', label: 'Dialer rules' },
  { key: 'callerId', label: 'Caller ID and prefixes' },
  { key: 'penalties', label: 'Penalties' },
  { key: 'localNumber', label: 'Getting a local number' },
]

function faqsFor(c: CountryRule) {
  const out: { question: string; answer: string }[] = []
  if (c.hours) out.push({ question: `What are the telemarketing calling hours in ${c.name}?`, answer: c.hours })
  if (c.consent) out.push({ question: `Do you need consent to cold call in ${c.name}?`, answer: c.consent })
  if (c.dnc) out.push({ question: `Is there a Do Not Call list in ${c.name}?`, answer: c.dnc })
  if (c.dialer) out.push({ question: `What are the auto dialer rules in ${c.name}?`, answer: c.dialer })
  if (c.callerId) out.push({ question: `What caller ID rules apply to marketing calls in ${c.name}?`, answer: c.callerId })
  return out
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  const c = byCode(code)
  if (!c) return {}
  const url = `https://dialerseat.com/data/calling-rules-by-country/${c.code.toLowerCase()}`
  const topics = [c.dnc && 'Do Not Call list', c.hours && 'calling hours', c.consent && 'consent', c.dialer && 'dialer rules', c.callerId && 'caller ID rules']
    .filter(Boolean)
    .join(', ')
  const description = `${c.name} telemarketing and cold calling rules: ${topics}, with sources.${c.changed ? ` ${c.changed}` : ''}`
  return withShareImage({
    title: `${c.name} Telemarketing & Cold Calling Rules (2026) | DialerSeat`,
    description: description.slice(0, 300),
    keywords: [
      `${c.name} telemarketing rules`, `${c.name} cold calling laws`, `${c.name} do not call list`,
      `${c.name} calling hours`, `cold calling ${c.name}`,
    ],
    alternates: { canonical: url },
    openGraph: { title: `${c.name}: telemarketing and cold calling rules`, description, url, type: 'article' },
    twitter: { card: 'summary_large_image', title: `${c.name}: telemarketing and cold calling rules`, description },
  })
}

export default async function CountryRulesPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const c = byCode(code)
  if (!c) notFound()

  const ROUTE = `/data/calling-rules-by-country/${c.code.toLowerCase()}`
  const updated = pageDate(ROUTE)
  const faqs = faqsFor(c)
  const others = COUNTRY_RULES.filter((o) => o.code !== c.code)

  return (
    <>
      {faqs.length > 0 && <JsonLd data={faqPageSchema(faqs)} />}
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Calling rules by country', url: '/data/calling-rules-by-country' },
          { name: c.name, url: ROUTE },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: `${c.name}: telemarketing and cold calling rules`,
          url: `https://dialerseat.com${ROUTE}`,
          dateModified: updated,
          about: { '@type': 'Country', name: c.name },
          author: { '@id': 'https://dialerseat.com/#organization' },
          publisher: { '@id': 'https://dialerseat.com/#organization' },
          citation: c.sources.map((s) => s.url),
        }}
      />
      <SiteHeader />
      <GutsShell rail={resourcesRail('/data/calling-rules-by-country')} activeHref="/data/calling-rules-by-country">

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">▸ CALLING RULES · {c.name.toUpperCase()}</div>
            <h1>
              {c.name}:
              <span className="second">telemarketing and cold calling rules.</span>
            </h1>
            <p>
              What a caller has to do before dialing people in {c.name}, from each rule’s source. Anything we
              could not verify is left out rather than guessed.
            </p>
            <PageStamp>Rules checked {RULES_CHECKED} · page updated {updated}</PageStamp>
          </div>
        </GutsSection>

        {c.changed && (
          <GutsSection icon="alert" title="What changed recently">
            <p>{c.changed}</p>
          </GutsSection>
        )}

        {FIELDS.filter((f) => c[f.key]).map((f) => (
          <GutsSection key={f.key} icon="shield" title={f.label}>
            <p>{c[f.key] as string}</p>
          </GutsSection>
        ))}

        <GutsSection icon="book" title="Sources">
          <ul className="guts-list good">
            {c.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>
              </li>
            ))}
          </ul>
          <p className="guts-note">
            A summary of what each rule asks of a caller, not legal advice. Local-number requirements are the
            ones Twilio publishes; other carriers publish their own. Confirm with local counsel before dialing
            a new country.
          </p>
        </GutsSection>

        {c.code !== 'US' && (
          <GutsSection icon="phone" title={`Agents in ${c.name} calling US leads`}>
            <p>
              The rules follow the person being called. An agent in {c.name} dialing a lead in the United States
              works under the US rules, including the calling window in the lead’s own time zone, which DialerSeat
              enforces on the server per lead. The seat price is the same wherever the agent sits.
            </p>
            <div className="guts-btns">
              <Link href="/data/calling-rules-by-country/us" className="guts-btn secondary">US RULES</Link>
              <Link href="/faq/dialer-for-offshore-agents" className="guts-btn secondary">OFFSHORE AGENTS</Link>
            </div>
          </GutsSection>
        )}

        <GutsSection icon="list" title="Other countries">
          <p>
            {others.map((o, i) => (
              <span key={o.code}>
                {i > 0 && ' · '}
                <Link href={`/data/calling-rules-by-country/${o.code.toLowerCase()}`}>{o.name}</Link>
              </span>
            ))}
          </p>
          <div className="guts-btns">
            <Link href="/data/calling-rules-by-country" className="guts-btn secondary">ALL COUNTRIES IN ONE TABLE</Link>
          </div>
          <CiteThis title={`${c.name} telemarketing and cold calling rules`} path={ROUTE} />
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
