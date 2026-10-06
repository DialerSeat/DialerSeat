import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
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
import { localizeMetadata } from '@/lib/i18n/metadata'
import { getT, primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'
import { countryName } from '@/lib/countryNames'

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
  { key: 'dnc', label: msg("Do Not Call list") },
  { key: 'hours', label: msg("Calling hours") },
  { key: 'consent', label: msg("Consent") },
  { key: 'dialer', label: msg("Dialer rules") },
  { key: 'callerId', label: msg("Caller ID and prefixes") },
  { key: 'penalties', label: msg("Penalties") },
  { key: 'localNumber', label: msg("Getting a local number") },
]

// Built during render, after primeLocale(), so the questions and answers are
// in the page's language for the visible list and the FAQ markup alike.
function faqsFor(c: CountryRule) {
  const name = countryName(t, c)
  const out: { question: string; answer: string }[] = []
  if (c.hours) out.push({ question: t('What are the telemarketing calling hours in {name}?', { name }), answer: t(c.hours) })
  if (c.consent) out.push({ question: t('Do you need consent to cold call in {name}?', { name }), answer: t(c.consent) })
  if (c.dnc) out.push({ question: t('Is there a Do Not Call list in {name}?', { name }), answer: t(c.dnc) })
  if (c.dialer) out.push({ question: t('What are the auto dialer rules in {name}?', { name }), answer: t(c.dialer) })
  if (c.callerId) out.push({ question: t('What caller ID rules apply to marketing calls in {name}?', { name }), answer: t(c.callerId) })
  return out
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  const c = byCode(code)
  if (!c) return {}
  // generateMetadata runs outside the page render, so it takes getT(), not t().
  const tm = await getT()
  const name = countryName(tm, c)
  const url = `https://dialerseat.com/data/calling-rules-by-country/${c.code.toLowerCase()}`
  const description = tm(msg('{name}: the telemarketing and cold calling rules we could verify, each with its source.'), { name }) +
    (c.changed ? ` ${tm(c.changed)}` : '')
  const social = tm(msg('{name}: telemarketing and cold calling rules'), { name })
  return localizeMetadata({
    title: tm(msg('{name} Telemarketing & Cold Calling Rules (2026) | DialerSeat'), { name }),
    description,
    alternates: { canonical: url },
    openGraph: { title: social, description, url, type: 'article' },
    twitter: { card: 'summary_large_image', title: social, description },
  })
}

export default async function CountryRulesPage({ params }: { params: Promise<{ code: string }> }) {
  await primeLocale()
  const { code } = await params
  const c = byCode(code)
  if (!c) notFound()

  const ROUTE = `/data/calling-rules-by-country/${c.code.toLowerCase()}`
  const updated = pageDate(ROUTE)
  const faqs = faqsFor(c)
  const name = countryName(t, c)
  const others = COUNTRY_RULES.filter((o) => o.code !== c.code)

  return (
    <>
      {faqs.length > 0 && <JsonLd data={faqPageSchema(faqs)} />}
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("Calling rules by country"), url: '/data/calling-rules-by-country' },
          { name, url: ROUTE },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: t('{name}: telemarketing and cold calling rules', { name }),
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
            <div className="guts-eyebrow">{t("▸ CALLING RULES · {name}", { name: name.toUpperCase() })}</div>
            <h1>
              {name}:
              <span className="second">{t("telemarketing and cold calling rules.")}</span>
            </h1>
            <p>
              {t("What a caller has to do before dialing people in {name}, from each rule’s source. Anything we could not verify is left out rather than guessed.", { name })}</p>
            <PageStamp>{t("Rules checked {rULES_CHECKED} · page updated {updated}", { rULES_CHECKED: RULES_CHECKED, updated })}</PageStamp>
          </div>
        </GutsSection>

        {c.changed && (
          <GutsSection icon="alert" title={t("What changed recently")}>
            <p>{t(c.changed)}</p>
          </GutsSection>
        )}

        {FIELDS.filter((f) => c[f.key]).map((f) => (
          <GutsSection key={f.key} icon="shield" title={t(f.label)}>
            <p>{t(c[f.key] as string)}</p>
          </GutsSection>
        ))}

        <GutsSection icon="book" title={t("Sources")}>
          <ul className="guts-list good">
            {c.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">{t(s.label)}</a>
              </li>
            ))}
          </ul>
          <p className="guts-note">
            {t("A summary of what each rule asks of a caller, not legal advice. Local-number requirements are the ones Twilio publishes; other carriers publish their own. Confirm with local counsel before dialing a new country.")}</p>
        </GutsSection>

        {c.code !== 'US' && (
          <GutsSection icon="phone" title={t("Agents in {name} calling US leads", { name })}>
            <p>
              {t("The rules follow the person being called. An agent in {name} dialing a lead in the United States works under the US rules, including the calling window in the lead’s own time zone, which DialerSeat enforces on the server per lead. The seat price is the same wherever the agent sits.", { name })}</p>
            <div className="guts-btns">
              <Link href="/data/calling-rules-by-country/us" className="guts-btn secondary">{t("US RULES")}</Link>
              <Link href="/faq/dialer-for-offshore-agents" className="guts-btn secondary">{t("OFFSHORE AGENTS")}</Link>
            </div>
          </GutsSection>
        )}

        <GutsSection icon="list" title={t("Other countries")}>
          <p>
            {others.map((o, i) => (
              <span key={o.code}>
                {i > 0 && ' · '}
                <Link href={`/data/calling-rules-by-country/${o.code.toLowerCase()}`}>{countryName(t, o)}</Link>
              </span>
            ))}
          </p>
          <div className="guts-btns">
            <Link href="/data/calling-rules-by-country" className="guts-btn secondary">{t("ALL COUNTRIES IN ONE TABLE")}</Link>
          </div>
          <CiteThis title={t("{name} telemarketing and cold calling rules", { name })} path={ROUTE} />
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
