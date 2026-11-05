import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import { resourcesRail } from '@/lib/gutsRail'
import { breadcrumbSchema } from '@/lib/schema'
import { toolMetadata } from '@/components/tools/ToolPage'
import { TOOLS, TOOL_GROUPS, toolPath } from '@/lib/tools/registry'
import { primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'

// =============================================================================
// /tools — every free tool on one page
// =============================================================================
// The hub in the ilovepdf shape: every tool one click away, grouped by the job
// it does, each a full page of its own at /tools/<slug> (book ch 6: one job,
// one page, one query). On the main domain rather than a subdomain so the
// links the tools earn count for dialerseat.com.
// =============================================================================

const ROUTE = '/tools'

export const metadata: Metadata = toolMetadata({
  route: ROUTE,
  title: 'Free Dialer & Cold Calling Tools: No Signup',
  description: 'Free tools for outbound calling: clean a lead list, format phone numbers, look up area codes, check calling hours, staff a queue, write a script.',
  social: 'Free tools for outbound calling',
})

export default async function ToolsHub() {
  await primeLocale()
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: msg("Home"), url: '/' }, { name: msg("Free tools"), url: ROUTE }])} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Free tools for outbound calling',
          url: `https://dialerseat.com${ROUTE}`,
          hasPart: TOOLS.map((tool) => ({ '@type': 'WebApplication', name: tool.name, url: `https://dialerseat.com${toolPath(tool.slug)}` })),
          publisher: { '@id': 'https://dialerseat.com/#organization' },
        }}
      />
      <SiteHeader />
      <GutsShell rail={resourcesRail(ROUTE)} activeHref={ROUTE}>
        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ FREE TOOLS")}</div>
            <h1>{t("Free tools")}<span className="second">{t("for people who call.")}</span></h1>
            <p>{t("Clean a lead list, format phone numbers, check what time it is in an area code, stay inside calling hours, staff a queue or write tomorrow's script. Every tool is free, needs no account, and runs in your browser: the ones that read your lists never upload them.")}</p>
          </div>
        </GutsSection>
        {TOOL_GROUPS.map((g) => (
          <GutsSection key={g.key} icon={g.key === 'lists' ? 'list' : g.key === 'compliance' ? 'shield' : g.key === 'callcenter' ? 'team' : 'chat'} title={t(g.label)}>
            <div className="tools-grid">
              {TOOLS.filter((tool) => tool.group === g.key).map((tool) => (
                <Link key={tool.slug} href={toolPath(tool.slug)} className="tools-card">
                  <b>{t(tool.name)}</b>
                  <span>{t(tool.blurb)}</span>
                </Link>
              ))}
            </div>
          </GutsSection>
        ))}
        <GutsSection icon="table" title={t("Data you can cite")}>
          <div className="tools-grid">
            <Link href="/data/connect-rates" className="tools-card"><b>{t("Best time to call, by state and hour")}</b><span>{t("Live connect rates measured on real outbound calls.")}</span></Link>
            <Link href="/data/dialer-pricing" className="tools-card"><b>{t("Dialer pricing index")}</b><span>{t("What 30 dialers charge, their contracts and seat minimums.")}</span></Link>
            <Link href="/data/calling-rules-by-country" className="tools-card"><b>{t("Calling rules by country")}</b><span>{t("Do Not Call lists, hours and consent for 15 countries.")}</span></Link>
          </div>
          <p>{t("Built by DialerSeat, a browser dialer at $35 a seat a week. None of these tools need it.")}</p>
        </GutsSection>
      </GutsShell>
      <style>{`
        .tools-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; text-align: start; }
        .tools-card { display: block; background: #f5f7fb; border: 1px solid #d6dbe3; border-radius: 12px; padding: 16px 18px; color: #1a1c24 !important; text-decoration: none !important; transition: border-color .15s, transform .15s; }
        .tools-card:hover { border-color: #2a6eff; transform: translateY(-1px); }
        .tools-card b { display: block; font-size: 15px; margin-bottom: 6px; color: #1a1c24; }
        .tools-card span { display: block; font-size: 13px; line-height: 1.5; color: #5a6072; }
      `}</style>
      <SiteFooter />
    </>
  )
}
