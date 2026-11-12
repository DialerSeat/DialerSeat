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
import { breadcrumbSchema } from '@/lib/schema'
import { STATE_RULES, STATE_RULES_CHECKED, type StateRule } from '@/lib/stateRules'
import { STATE_LISTS } from '@/components/tools/StateDncTable'
import { pageDate } from '@/lib/pageDates'
import { localizeMetadata } from '@/lib/i18n/metadata'
import { getT, primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'

// =============================================================================
// /data/calling-rules-by-state/<code> — one state's rules, on its own page
// =============================================================================
// The state-level twin of /data/calling-rules-by-country/<code>, in the same
// layout. It answers "Florida telemarketing laws", "Maryland mini-TCPA",
// "Texas do not call list": searches for one state that a page covering all
// fifty cannot rank for.
//
// Not thin: each page carries only what was read from that state's own
// statute or agency site, with the source. Federal rules apply on top, and the
// page links them rather than repeating them.
// =============================================================================

export function generateStaticParams() {
  return STATE_RULES.map((s) => ({ code: s.code.toLowerCase() }))
}

function byCode(code: string): StateRule | undefined {
  return STATE_RULES.find((s) => s.code.toLowerCase() === code.toLowerCase())
}

const FIELDS: { key: keyof StateRule; label: string }[] = [
  { key: 'dnc', label: msg("Do Not Call list") },
  { key: 'hours', label: msg("Calling hours") },
  { key: 'limits', label: msg("How often you can call") },
  { key: 'consent', label: msg("Consent") },
  { key: 'identify', label: msg("What to say and show on the call") },
  { key: 'onRequest', label: msg("When someone asks not to be called") },
  { key: 'registration', label: msg("Registration") },
  { key: 'penalties', label: msg("Penalties") },
]

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  const s = byCode(code)
  if (!s) return {}
  const tm = await getT()
  const name = s.name
  const url = `https://dialerseat.com/data/calling-rules-by-state/${s.code.toLowerCase()}`
  const description = tm(msg('{name} telemarketing laws: the state rules on calling hours, Do Not Call lists, call limits and consent that we could verify, each with its source.'), { name })
  const social = tm(msg('{name}: state telemarketing and cold calling rules'), { name })
  return localizeMetadata({
    title: tm(msg('{name} Telemarketing Laws & Calling Rules (2026) | DialerSeat'), { name }),
    description,
    alternates: { canonical: url },
    openGraph: { title: social, description, url, type: 'article' },
    twitter: { card: 'summary_large_image', title: social, description },
  })
}

export default async function StateRulesPage({ params }: { params: Promise<{ code: string }> }) {
  await primeLocale()
  const { code } = await params
  const s = byCode(code)
  if (!s) notFound()

  const ROUTE = `/data/calling-rules-by-state/${s.code.toLowerCase()}`
  const updated = pageDate(ROUTE)
  const name = s.name
  const list = s.list ? STATE_LISTS.find((l) => l.state === s.name) : undefined
  const others = STATE_RULES.filter((o) => o.code !== s.code)

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("Calling rules by state"), url: '/data/calling-rules-by-state' },
          { name, url: ROUTE },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: t('{name}: state telemarketing and cold calling rules', { name }),
          url: `https://dialerseat.com${ROUTE}`,
          dateModified: updated,
          about: { '@type': 'State', name: s.name },
          author: { '@id': 'https://dialerseat.com/#organization' },
          publisher: { '@id': 'https://dialerseat.com/#organization' },
          citation: s.sources.map((x) => x.url),
        }}
      />
      <SiteHeader />
      <GutsShell rail={resourcesRail('/data/calling-rules-by-state')} activeHref="/data/calling-rules-by-state">

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ CALLING RULES · {name}", { name: name.toUpperCase() })}</div>
            <h1>
              {name}:
              <span className="second">{t("state telemarketing and cold calling rules.")}</span>
            </h1>
            <p>
              {t("What {name} asks of a caller on top of the federal rules, from the state’s own statute or agency site. Anything we could not verify there is left out rather than guessed.", { name })}</p>
            <PageStamp>{t("Rules checked {rULES_CHECKED} · page updated {updated}", { rULES_CHECKED: STATE_RULES_CHECKED, updated })}</PageStamp>
          </div>
        </GutsSection>

        {list && (
          <GutsSection icon="shield" title={t("State Do Not Call list")}>
            <div className="guts-tablewrap">
              <table>
                <tbody>
                  <tr>
                    <td style={{ width: '28%', fontSize: 10, letterSpacing: 2 }}>{t("Who runs it")}</td>
                    <td style={{ textAlign: 'start', color: '#1a1c24' }}>{t(list.runBy)}</td>
                  </tr>
                  <tr>
                    <td style={{ width: '28%', fontSize: 10, letterSpacing: 2 }}>{t("What telemarketers pay")}</td>
                    <td style={{ textAlign: 'start', color: '#1a1c24' }}>{t(list.cost)}</td>
                  </tr>
                  <tr>
                    <td style={{ width: '28%', fontSize: 10, letterSpacing: 2 }}>{t("Refreshed")}</td>
                    <td style={{ textAlign: 'start', color: '#1a1c24' }}>{t(list.refresh)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {list.note && <p>{t(list.note)}</p>}
            <p className="guts-note">
              {t("This is on top of the National Do Not Call Registry, not instead of it.")}{' '}
              <Link href="/tools/state-do-not-call-lists">{t("Every state list in one table")}</Link>
            </p>
          </GutsSection>
        )}

        {FIELDS.filter((f) => s[f.key]).map((f) => (
          <GutsSection key={f.key} icon="shield" title={t(f.label)}>
            <p>{t(s[f.key] as string)}</p>
          </GutsSection>
        ))}

        <GutsSection icon="book" title={t("Sources")}>
          <ul className="guts-list good">
            {s.sources.map((x) => (
              <li key={x.url}>
                <a href={x.url} target="_blank" rel="noopener noreferrer">{t(x.label)}</a>
              </li>
            ))}
          </ul>
          <p className="guts-note">
            {t("A summary of what each rule asks of a caller, not legal advice. State laws have exemptions this page does not list, and some cover text messages too. Confirm with counsel before you dial.")}</p>
        </GutsSection>

        <GutsSection icon="phone" title={t("Federal rules apply too")}>
          <p>
            {t("Every call into {name} also has to follow the federal rules: the National Do Not Call Registry, the 8 a.m. to 9 p.m. window in the lead’s time zone, the TCPA’s consent rules and the 3% abandoned-call limit. Where the state is stricter, the stricter rule wins.", { name })}</p>
          <div className="guts-btns">
            <Link href="/data/calling-rules-by-country/us" className="guts-btn secondary">{t("US RULES")}</Link>
            <Link href="/tools/telemarketing-calling-hours" className="guts-btn secondary">{t("CALLING HOURS BY STATE")}</Link>
          </div>
        </GutsSection>

        <GutsSection icon="list" title={t("Other states")}>
          <p>
            {others.map((o, i) => (
              <span key={o.code}>
                {i > 0 && ' · '}
                <Link href={`/data/calling-rules-by-state/${o.code.toLowerCase()}`}>{o.name}</Link>
              </span>
            ))}
          </p>
          <div className="guts-btns">
            <Link href="/data/calling-rules-by-state" className="guts-btn secondary">{t("ALL STATES IN ONE TABLE")}</Link>
          </div>
          <CiteThis title={t("{name} state telemarketing and cold calling rules", { name })} path={ROUTE} />
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
