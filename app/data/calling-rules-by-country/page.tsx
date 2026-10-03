import type { Metadata } from 'next'
import Link from 'next/link'
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

// =============================================================================
// /data/calling-rules-by-country
// =============================================================================
// SEARCH INTENT: "<country> telemarketing rules", "cold calling laws <country>",
// "calling hours <country>", "do not call list <country>", and the questions
// a floor asks before dialing a new market. Most answers online are US-only
// or years old; France went opt-in on August 11, 2026 and Spain's 400 prefix
// lands on October 17, 2026, and very few pages say so yet.
//
// Rendered from lib/countryRules.ts, which holds the sources and leaves out
// anything it could not verify. Each country has an anchor (#fr, #es …) so a
// link can point at one country, which is how a page like this gets cited.
// =============================================================================

const ROUTE = '/data/calling-rules-by-country'
const UPDATED = pageDate(ROUTE)

export const metadata: Metadata = {
  title: 'Telemarketing & Cold Calling Rules by Country (2026) | DialerSeat',
  description: `Do Not Call lists, calling hours, consent rules, abandoned-call limits and caller ID prefixes for ${COUNTRY_RULES.length} countries, including the US, Canada, UK, Australia, France, Spain, Brazil and India. Sourced and dated.`,
  keywords: [
    'telemarketing rules by country', 'cold calling laws by country', 'telemarketing calling hours',
    'do not call list by country', 'france cold calling consent 2026', 'spain 400 prefix',
    'uk tps rules', 'australia telemarketing hours', 'canada dncl rules', 'brazil 0303',
  ],
  alternates: {
    canonical: `https://dialerseat.com${ROUTE}`,
    types: { 'text/markdown': `https://dialerseat.com/md${ROUTE}` },
  },
  openGraph: {
    title: 'Outbound calling rules, country by country',
    description: `Do Not Call lists, calling hours, consent and dialer rules for ${COUNTRY_RULES.length} countries, with sources.`,
    url: `https://dialerseat.com${ROUTE}`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Outbound calling rules, country by country',
    description: `Do Not Call lists, calling hours, consent and dialer rules for ${COUNTRY_RULES.length} countries, with sources.`,
  },
}

const FIELDS: { key: keyof CountryRule; label: string }[] = [
  { key: 'dnc', label: 'DO NOT CALL LIST' },
  { key: 'hours', label: 'CALLING HOURS' },
  { key: 'consent', label: 'CONSENT' },
  { key: 'dialer', label: 'DIALER RULES' },
  { key: 'callerId', label: 'CALLER ID & PREFIXES' },
  { key: 'penalties', label: 'PENALTIES' },
  { key: 'localNumber', label: 'GETTING A LOCAL NUMBER' },
]

/** Question-and-answer pairs built only from the verified fields. */
function faqs() {
  const out: { question: string; answer: string }[] = []
  for (const c of COUNTRY_RULES) {
    if (c.hours) out.push({ question: `What are the telemarketing calling hours in ${c.name}?`, answer: c.hours })
    if (c.consent) out.push({ question: `Do you need consent to make marketing calls in ${c.name}?`, answer: c.consent })
    if (c.dnc) out.push({ question: `Is there a Do Not Call list in ${c.name}?`, answer: c.dnc })
  }
  return out
}

const anchor = (c: CountryRule) => c.code.toLowerCase()

export default function CallingRulesByCountry() {
  const changed = COUNTRY_RULES.filter((c) => c.changed)

  return (
    <>
      <JsonLd data={faqPageSchema(faqs())} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Resources', url: '/resources' },
          { name: 'Calling rules by country', url: ROUTE },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Dataset',
          name: 'Outbound calling rules by country',
          description: `Do Not Call lists, calling hours, consent regimes, dialer rules and caller ID requirements for ${COUNTRY_RULES.length} countries, with primary sources.`,
          url: `https://dialerseat.com${ROUTE}`,
          dateModified: UPDATED,
          creator: { '@id': 'https://dialerseat.com/#organization' },
          isAccessibleForFree: true,
          creditText: 'Outbound calling rules by country, DialerSeat',
          spatialCoverage: COUNTRY_RULES.map((c) => c.name),
          distribution: {
            '@type': 'DataDownload',
            encodingFormat: 'text/markdown',
            contentUrl: `https://dialerseat.com/md${ROUTE}`,
          },
        }}
      />
      <SiteHeader />
      <GutsShell rail={resourcesRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">▸ DATA · CALLING RULES</div>
            <h1>
              Outbound calling rules,
              <span className="second">country by country.</span>
            </h1>
            <p>
              Do Not Call lists, calling hours, consent, abandoned-call limits and caller ID rules for{' '}
              {COUNTRY_RULES.length} countries, each with its source. Anything we could not verify is left
              out rather than guessed.
            </p>
            <PageStamp>Rules checked {RULES_CHECKED} · page updated {UPDATED}</PageStamp>
          </div>
        </GutsSection>

        <GutsSection icon="alert" title="Changed recently">
          <ul className="guts-list warn">
            {changed.map((c) => (
              <li key={c.code}>
                <a href={`#${anchor(c)}`}>{c.name}</a>: {c.changed}
              </li>
            ))}
          </ul>
        </GutsSection>

        <GutsSection icon="list" title="Jump to a country">
          <p>
            {COUNTRY_RULES.map((c, i) => (
              <span key={c.code}>
                {i > 0 && ' · '}
                <a href={`#${anchor(c)}`}>{c.name}</a>
              </span>
            ))}
          </p>
        </GutsSection>

        {COUNTRY_RULES.map((c) => (
          <GutsSection key={c.code} icon="shield" title={`${c.name}: telemarketing rules`} id={anchor(c)}>
            <div className="guts-tablewrap">
              <table>
                <tbody>
                  {FIELDS.filter((f) => c[f.key]).map((f) => (
                    <tr key={f.key}>
                      <td style={{ width: '28%', fontSize: 10, letterSpacing: 2 }}>{f.label}</td>
                      <td style={{ textAlign: 'start', color: '#1a1c24' }}>{c[f.key] as string}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="guts-note">
              <Link href={`/data/calling-rules-by-country/${anchor(c)}`}>{c.name} on its own page</Link>
              {' · '}Sources:{' '}
              {c.sources.map((s, i) => (
                <span key={s.url}>
                  {i > 0 && ' · '}
                  <a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>
                </span>
              ))}
            </p>
          </GutsSection>
        ))}

        <GutsSection icon="phone" title="Calling US leads from another country">
          <p>
            The rules follow the person you call, not where your agent sits. An agent in Manila, Cairo or
            Bogotá calling a lead in Texas is bound by the US and Texas rules above, including the calling
            window in the lead’s own time zone. DialerSeat enforces that window on the server, per lead.
          </p>
          <div className="guts-btns">
            <Link href="/faq/dialer-for-offshore-agents" className="guts-btn secondary">OFFSHORE AGENTS</Link>
            <Link href="/faq/calling-hours" className="guts-btn secondary">US CALLING HOURS BY STATE</Link>
            <Link href="/tools/abandon-rate-calculator" className="guts-btn secondary">ABANDON RATE CALCULATOR</Link>
          </div>
        </GutsSection>

        <GutsSection icon="book" title="About this page">
          <p>
            A summary of what each rule asks of a caller, checked against the sources listed under each
            country. It is not legal advice and does not cover sector rules such as financial services,
            debt collection or health. Confirm with local counsel before dialing a new country.
          </p>
          <p>
            Local-number requirements are the ones Twilio publishes for each country; other carriers
            publish their own, which can differ. Seen a rule change? Email{' '}
            <a href="mailto:support@dialerseat.com">support@dialerseat.com</a> with the source.
          </p>
          <CiteThis title="Outbound calling rules by country" path={ROUTE} />
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
