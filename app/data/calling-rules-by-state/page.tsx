import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
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
// /data/calling-rules-by-state
// =============================================================================
// SEARCH INTENT: "telemarketing laws by state", "mini tcpa states", "<state>
// telemarketing laws", "cold calling laws in <state>". The state-level twin of
// /data/calling-rules-by-country, in the same layout and under the same rule:
// only what was read from the state's own statute or agency site, with the
// source, and nothing filled in. Rendered from lib/stateRules.ts, with each
// state's own Do Not Call list from components/tools/StateDncTable.tsx.
// =============================================================================

const ROUTE = '/data/calling-rules-by-state'
const UPDATED = pageDate(ROUTE)

const baseMetadata: Metadata = {
  title: 'Telemarketing Laws by State: Calling Rules (2026) | DialerSeat',
  keywords: [
    'telemarketing laws by state', 'mini tcpa states', 'state telemarketing rules', 'cold calling laws by state',
    'florida telemarketing law', 'maryland stop the spam calls act', 'washington telemarketing hours', 'state do not call list',
  ],
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: { title: 'Outbound calling rules, state by state', url: `https://dialerseat.com${ROUTE}`, type: 'article' },
  twitter: { card: 'summary_large_image', title: 'Outbound calling rules, state by state' },
}

export async function generateMetadata(): Promise<Metadata> {
  const tm = await getT()
  const n = STATE_RULES.length
  const description = tm(msg('State telemarketing laws for {n} states: their own Do Not Call lists, calling hours, call limits, consent for automated calls and penalties, each from the state’s own statute or agency site.'), { n })
  return localizeMetadata({
    ...baseMetadata,
    description,
    openGraph: { ...baseMetadata.openGraph, description },
    twitter: { ...baseMetadata.twitter, description },
  })
}

const FIELDS: { key: keyof StateRule; label: string }[] = [
  { key: 'dnc', label: msg("DO NOT CALL LIST") },
  { key: 'hours', label: msg("CALLING HOURS") },
  { key: 'limits', label: msg("HOW OFTEN") },
  { key: 'consent', label: msg("CONSENT") },
  { key: 'identify', label: msg("ON THE CALL") },
  { key: 'onRequest', label: msg("WHEN ASKED TO STOP") },
  { key: 'registration', label: msg("REGISTRATION") },
  { key: 'penalties', label: msg("PENALTIES") },
]

const anchor = (s: StateRule) => s.code.toLowerCase()

export default async function CallingRulesByState() {
  await primeLocale()

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("Resources"), url: '/resources' },
          { name: msg("Calling rules by state"), url: ROUTE },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Dataset',
          name: msg("Outbound calling rules by US state"),
          description: t("State Do Not Call lists, calling hours, call limits, consent rules and penalties for {length} US states, with primary sources.", { length: STATE_RULES.length }),
          url: `https://dialerseat.com${ROUTE}`,
          dateModified: UPDATED,
          creator: { '@id': 'https://dialerseat.com/#organization' },
          isAccessibleForFree: true,
          license: 'https://creativecommons.org/licenses/by/4.0/',
          creditText: msg("Outbound calling rules by US state, DialerSeat"),
          spatialCoverage: STATE_RULES.map((s) => s.name),
        }}
      />
      <SiteHeader />
      <GutsShell rail={resourcesRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ DATA · CALLING RULES")}</div>
            <h1>
              {t("Outbound calling rules,")}<span className="second">{t("state by state.")}</span>
            </h1>
            <p>
              {t("State Do Not Call lists, calling hours, call limits, consent and penalties for {length} states, each from the state’s own statute or agency site. Anything we could not verify there is left out rather than guessed.", { length: STATE_RULES.length })}</p>
            <PageStamp>{t("Rules checked {rULES_CHECKED} · page updated {uPDATED}", { rULES_CHECKED: STATE_RULES_CHECKED, uPDATED: UPDATED })}</PageStamp>
          </div>
        </GutsSection>

        <GutsSection icon="list" title={t("Jump to a state")}>
          <p>
            {STATE_RULES.map((s, i) => (
              <span key={s.code}>
                {i > 0 && ' · '}
                <a href={`#${anchor(s)}`}>{s.name}</a>
              </span>
            ))}
          </p>
        </GutsSection>

        {STATE_RULES.map((s) => {
          const list = s.list ? STATE_LISTS.find((l) => l.state === s.name) : undefined
          return (
            <GutsSection key={s.code} icon="shield" title={t("{name}: telemarketing rules", { name: s.name })} id={anchor(s)}>
              <div className="guts-tablewrap">
                <table>
                  <tbody>
                    {list && (
                      <tr>
                        <td style={{ width: '28%', fontSize: 10, letterSpacing: 2 }}>{t("STATE DO NOT CALL LIST")}</td>
                        <td style={{ textAlign: 'start', color: '#1a1c24' }}>{t(list.runBy)}. {t(list.cost)}</td>
                      </tr>
                    )}
                    {FIELDS.filter((f) => s[f.key]).map((f) => (
                      <tr key={f.key}>
                        <td style={{ width: '28%', fontSize: 10, letterSpacing: 2 }}>{t(f.label)}</td>
                        <td style={{ textAlign: 'start', color: '#1a1c24' }}>{t(s[f.key] as string)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="guts-note">
                <Link href={`/data/calling-rules-by-state/${anchor(s)}`}>{t("{name} on its own page", { name: s.name })}</Link>
                {' · '}{t("Sources:")}{' '}
                {s.sources.map((x, i) => (
                  <span key={x.url}>
                    {i > 0 && ' · '}
                    <a href={x.url} target="_blank" rel="noopener noreferrer">{t(x.label)}</a>
                  </span>
                ))}
              </p>
            </GutsSection>
          )
        })}

        <GutsSection icon="phone" title={t("Federal rules apply in every state")}>
          <p>
            {t("These state rules come on top of the federal ones: the National Do Not Call Registry, the 8 a.m. to 9 p.m. window in the lead’s time zone, the TCPA’s consent rules and the 3% abandoned-call limit. Where a state is stricter, the stricter rule wins. A state missing from this page may still have rules of its own.")}</p>
          <div className="guts-btns">
            <Link href="/data/calling-rules-by-country/us" className="guts-btn secondary">{t("US RULES")}</Link>
            <Link href="/tools/state-do-not-call-lists" className="guts-btn secondary">{t("STATE DO NOT CALL LISTS")}</Link>
            <Link href="/data/calling-rules-by-country" className="guts-btn secondary">{t("RULES BY COUNTRY")}</Link>
          </div>
        </GutsSection>

        <GutsSection icon="book" title={t("About this page")}>
          <p>
            {t("A summary of what each state rule asks of a caller, checked against the sources listed under each state. It is not legal advice and leaves out exemptions and sector rules. Confirm with counsel before you dial. Seen a rule change? Email")}{' '}
            <a href="mailto:support@dialerseat.com">support@dialerseat.com</a> {t("with the source.")}</p>
          <CiteThis title={t("Outbound calling rules by US state")} path={ROUTE} />
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
