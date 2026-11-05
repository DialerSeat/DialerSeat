import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from '@/components/LocaleLink'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection, type GutsIcon } from '@/components/GutsShell'
import PageStamp from '@/components/PageStamp'
import CiteThis from '@/components/CiteThis'
import { resourcesRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { pageDate } from '@/lib/pageDates'
import { withShareImage } from '@/lib/i18n/metadata'
import { primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'
import ToolLinks from '@/components/ToolLinks'
import { TOOLS } from '@/lib/tools/registry'

// =============================================================================
// ONE LAYOUT FOR EVERY FREE TOOL
// =============================================================================
// The same structure as the first two calculators, so every tool reads as part
// of the same site, built to the page spec in docs/seo (book ch 7):
//   - the H1 is the job, the opening paragraph answers it in 40-80 words
//   - the working tool sits directly under it, no account, no gate
//   - the questions people ask are shown on the page, and only those are
//     marked up as FAQPage (marked-up content must be visible)
//   - DialerSeat is mentioned once, at the end, after the tool has done its job
//   - WebApplication with a price of 0, a standalone breadcrumb, and the
//     embed / cite block that is how other sites link to a tool
// =============================================================================

export interface ToolFaq { question: string; answer: string }

export function toolMetadata(o: { route: string; title: string; description: string; social: string }): Metadata {
  const url = `https://dialerseat.com${o.route}`
  // English only until translated (lib/tools/registry `englishOnly`): no
  // hreflang alternates, so no language version is advertised that would
  // show English text.
  return withShareImage({
    title: o.title,
    description: o.description,
    alternates: { canonical: url },
    openGraph: { title: o.social, description: o.description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title: o.social, description: o.description },
  })
}

/**
 * The next three tools in this tool's group, wrapping round, so every tool gets
 * links from its neighbours instead of depending on the hub.
 */
function neighbours(route: string): string[] {
  const slug = route.replace('/tools/', '')
  const group = TOOLS.filter((x) => x.group === TOOLS.find((y) => y.slug === slug)?.group)
  const at = group.findIndex((x) => x.slug === slug)
  if (at < 0) return []
  return [1, 2, 3].map((n) => group[(at + n) % group.length]).filter((x) => x.slug !== slug).map((x) => x.slug)
}

export default async function ToolPage(p: {
  route: string
  name: string
  eyebrow: string
  h1: string
  h1Second: string
  answer: string
  tool: ReactNode
  toolIcon?: GutsIcon
  faqs: ToolFaq[]
  faqTitle?: string
  /** Sections between the tool and the questions: method, sources, caveats. */
  children?: ReactNode
  related: { href: string; label: string }[]
  /** The one line about DialerSeat, after the tool has done its job. */
  pitch: string
  embedHeight?: number
}) {
  await primeLocale()
  const updated = pageDate(p.route)
  return (
    <>
      <JsonLd data={faqPageSchema(p.faqs)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("Free tools"), url: '/tools' },
          { name: p.name, url: p.route },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: p.name,
          url: `https://dialerseat.com${p.route}`,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          isAccessibleForFree: true,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          dateModified: updated,
          publisher: { '@id': 'https://dialerseat.com/#organization' },
        }}
      />
      <SiteHeader />
      <GutsShell rail={resourcesRail(p.route)} activeHref={p.route}>
        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t(p.eyebrow)}</div>
            <h1>
              {t(p.h1)}<span className="second">{t(p.h1Second)}</span>
            </h1>
            <p>{t(p.answer)}</p>
            <PageStamp>{t("Free, no account · Updated {uPDATED}", { uPDATED: updated })}</PageStamp>
          </div>
        </GutsSection>

        <GutsSection icon={p.toolIcon ?? 'check'}>{p.tool}</GutsSection>

        {p.children}

        <GutsSection icon="chat" title={t(p.faqTitle ?? "Questions people ask")}>
          <div style={{ textAlign: 'start', maxWidth: 660, margin: '0 auto' }}>
            {p.faqs.map((f) => (
              <div key={f.question} style={{ marginBottom: 22 }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{t(f.question)}</h3>
                <p style={{ margin: 0 }}>{t(f.answer)}</p>
              </div>
            ))}
          </div>
          <p>{t(p.pitch)}</p>
          <div className="guts-btns">
            {p.related.map((r) => (
              <Link key={r.href} href={r.href} className="guts-btn secondary">{t(r.label)}</Link>
            ))}
            <Link href="/tools" className="guts-btn secondary">{t("ALL FREE TOOLS")}</Link>
          </div>
          <CiteThis title={t(p.name)} path={p.route} embedPath={`/embed${p.route.replace('/tools', '')}`} embedHeight={p.embedHeight ?? 560} />
        </GutsSection>

        <ToolLinks slugs={neighbours(p.route)} />
      </GutsShell>
      <SiteFooter />
    </>
  )
}
