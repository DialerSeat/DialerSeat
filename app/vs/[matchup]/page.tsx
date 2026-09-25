import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import JsonLd from '@/components/json-ld'
import GutsShell from '@/components/GutsShell'
import { vsRail } from '@/lib/gutsRail'
import { organizationSchema, breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import {
  COMPETITORS,
  DIALERSEAT,
  competitorBySlug,
  crossShoppedPairs,
  matchupSlug,
  type Competitor,
} from '@/lib/competitors'
import { getT, primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

// =============================================================================
// HEAD-TO-HEAD COMPARISONS — "<A> vs <B>", where neither one is us
// =============================================================================
// WHY PUBLISH A PAGE THAT DOESN'T LEAD WITH OUR PRODUCT
//
// The /vs/<competitor> pages capture "DialerSeat alternative" searches — people
// who already know we exist. That is the smaller half of the demand. The larger
// half is "mojo vs phoneburner": a buyer comparing two tools we aren't in,
// which is precisely the moment the decision is still open.
//
// Whoever answers that question fairly is the trusted party in the room. So
// these pages genuinely answer it: a real table, real concessions, and a
// recommendation that frequently is not us. DialerSeat appears at the bottom as
// a third option, disclosed as ours, because a page that pretended to be
// neutral while steering would be worth less than one that is simply useful.
//
// Only cross-shopped pairs are generated. See crossShoppedPairs() in
// lib/competitors.ts for why publishing all 91 combinations would be doorway
// content rather than a resource.
// =============================================================================

const SITE = 'https://dialerseat.com'

interface Matchup {
  a: Competitor
  b: Competitor
}

function resolveMatchup(slug: string): Matchup | null {
  for (const [a, b] of crossShoppedPairs()) {
    if (matchupSlug(a, b) === slug) return { a, b }
  }
  return null
}

/**
 * Does this slug name two real competitors, even if we no longer publish the
 * pair?
 *
 * The published set shrank when pairing was gated by segment — combinations
 * like "mojo vs five9" were being generated because both tools were flagged
 * cross-shopped, not because anyone was choosing between a real-estate dialer
 * and an enterprise contact centre. Roughly thirty such pages went away.
 *
 * Those URLs existed and may be linked or indexed, so they get a 301 to the
 * comparison index rather than a 404. A slug naming tools we have never heard
 * of is a different thing entirely and still 404s — redirecting genuine
 * nonsense to a real page is how soft-404 problems start.
 */
function namesTwoRealCompetitors(slug: string): boolean {
  const parts = slug.split('-vs-')
  return parts.length === 2 && parts.every(p => !!competitorBySlug(p))
}

export function generateStaticParams() {
  return crossShoppedPairs().map(([a, b]) => ({ matchup: matchupSlug(a, b) }))
}

export async function generateMetadata(
  props: { params: Promise<{ matchup: string }> }
): Promise<Metadata> {
  await primeLocale()
  return localizeMetadata(await matchupMetadata(props))
}

async function matchupMetadata(
  { params }: { params: Promise<{ matchup: string }> }
): Promise<Metadata> {
  const { matchup } = await params
  const m = resolveMatchup(matchup)
  if (!m) return {}

  // getT, not t: metadata runs outside the page render, where the request's
  // language has not been primed for the synchronous t().
  const tm = await getT()
  const title = tm(msg("{a} vs {b}: Pricing, Dialing Modes, and Who Each One Suits"), { a: m.a.name, b: m.b.name })
  const description = tm(msg("An honest side-by-side of {a} and {b}: what each costs, which dialing modes you actually get, the pros and cons of each, and which buyer each suits."), { a: m.a.name, b: m.b.name })

  return {
    title: tm(msg("{title} | DialerSeat"), { title }),
    description,
    // Both names, in the forms people search a two-way decision. See lib/vsSeo
    // for why the headings and structured data matter more than this tag.
    keywords: [
      `${m.a.name} vs ${m.b.name}`,
      `${m.a.name} vs ${m.b.name} pros and cons`,
      `${m.b.name} vs ${m.a.name}`,
      `pros and cons of ${m.a.name}`,
      `pros and cons of ${m.b.name}`,
      `cons of ${m.a.name}`,
      `cons of ${m.b.name}`,
    ],
    alternates: {
      canonical: `${SITE}/vs/${matchup}`,
      types: { 'text/markdown': `${SITE}/md/vs/${matchup}` },
    },
    openGraph: {
      title: `${m.a.name} vs ${m.b.name}`,
      description,
      url: `${SITE}/vs/${matchup}`,
      type: 'article',
    },
    // Next.js merges metadata field-by-field rather than deeply, so a page
    // that sets openGraph and omits twitter inherits the ROOT LAYOUT's card
    // wholesale. Without this, every one of these comparisons previewed on X
    // as "DialerSeat — Dial Smarter. Close Faster." — the homepage, not the
    // page being shared.
    twitter: {
      card: 'summary_large_image',
      title: `${m.a.name} vs ${m.b.name}`,
      description,
    },
  }
}

// ── presentation tokens, matching the marketing pages ────────────────────────
const INK = '#1a1c24'
const MUTED = '#5a5e6a'
const BORDER = '#c4c8d0'
const ACCENT = '#2a4a8a'
const SURFACE = '#ffffff'
const FUTURA = "'Futura PT', Futura, 'Trebuchet MS', sans-serif"

function Column({ c }: { c: Competitor }) {
  return (
    <div style={{
      background: SURFACE, border: `1px solid ${BORDER}`, borderTop: `3px solid ${ACCENT}`,
      borderRadius: 8, padding: 28,
    }}>
      <h2 style={{ fontSize: 20, fontWeight: 'bold', letterSpacing: -0.3, margin: 0, color: INK }}>
        {c.name}
      </h2>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: MUTED, marginTop: 10 }}>{t(c.summary)}</p>

      <dl style={{ margin: '20px 0 0' }}>
        {[
          [msg("PRICING"), c.pricing],
          [msg("BILLING"), c.contract],
          [msg("DIALING"), c.dialing],
          [msg("BEST FOR"), c.bestFor],
        ].map(([label, value]) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <dt style={{ fontSize: 10, letterSpacing: 2, fontWeight: 'bold', color: ACCENT }}>{t(label)}</dt>
            <dd style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.65, color: INK }}>{t(value)}</dd>
          </div>
        ))}
      </dl>

      {/* Real headings rather than styled divs, worded the way people search
          ("pros of X", "cons of X"). A div that looks like a heading is just
          text to a crawler; an h3 is a signal. Same visual as before. */}
      <div style={{ marginTop: 20 }}>
        <h3 style={{ margin: 0, fontSize: 10, letterSpacing: 2, fontWeight: 'bold', color: '#16a34a', textTransform: 'uppercase' }}>
          {t("Pros of {name}", { name: c.name })}
        </h3>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 14, lineHeight: 1.8, color: INK }}>
          {c.wins.map(w => <li key={w}>{t(w)}</li>)}
        </ul>
      </div>

      <div style={{ marginTop: 18 }}>
        <h3 style={{ margin: 0, fontSize: 10, letterSpacing: 2, fontWeight: 'bold', color: '#8a6a1a', textTransform: 'uppercase' }}>
          {t("Cons of {name}", { name: c.name })}
        </h3>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 14, lineHeight: 1.8, color: INK }}>
          {c.friction.map(f => <li key={f}>{t(f)}</li>)}
        </ul>
      </div>
    </div>
  )
}

export default async function MatchupPage(
  { params }: { params: Promise<{ matchup: string }> }
) {
  await primeLocale()
  const { matchup } = await params
  const m = resolveMatchup(matchup)
  if (!m) {
    // A pair we used to publish and no longer do: send the link equity to the
    // index instead of dropping it on the floor.
    if (namesTwoRealCompetitors(matchup)) permanentRedirect('/vs')
    notFound()
  }

  const { a, b } = m

  const faqs = [
    {
      question: `Is ${a.name} or ${b.name} cheaper?`,
      answer:
        `${a.name}: ${a.pricing} ${a.contract} ${b.name}: ${b.pricing} ${b.contract} ` +
        `Compare the total including add-ons and minimums rather than the headline rate, for several ` +
        msg("tools in this category the advertised number excludes the dialer itself."),
    },
    {
      question: `Which one should I pick, ${a.name} or ${b.name}?`,
      answer:
        `Pick ${a.name} if you are ${a.bestFor.charAt(0).toLowerCase()}${a.bestFor.slice(1)} ` +
        `Pick ${b.name} if you are ${b.bestFor.charAt(0).toLowerCase()}${b.bestFor.slice(1)}`,
    },
    {
      question: `Do ${a.name} and ${b.name} both offer predictive dialing?`,
      answer: `${a.name}: ${a.dialing} ${b.name}: ${b.dialing}`,
    },
  ]

  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={faqPageSchema(faqs)} />
      <JsonLd data={breadcrumbSchema([
        { name: msg("Home"), url: '/' },
        { name: msg("Comparisons"), url: '/vs' },
        { name: `${a.name} vs ${b.name}`, url: `/vs/${matchup}` },
      ])} />

      <GutsShell rail={vsRail()} activeHref="/vs">
        <div className="guts-sec">
          <nav style={{ fontSize: 11, letterSpacing: 1.5, color: MUTED, marginBottom: 22 }}>
            <Link href="/" style={{ color: MUTED }}>{t("HOME")}</Link>
            {' · '}
            <Link href="/vs" style={{ color: MUTED }}>{t("COMPARISONS")}</Link>
          </nav>

          <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 'bold', color: ACCENT, marginBottom: 14 }}>
            {t("▸ Head to head")}</div>
          <h1 style={{ fontSize: 44, fontWeight: 'bold', letterSpacing: -1, lineHeight: 1.12, margin: 0 }}>
            {t("{name} vs {name2}", { name: a.name, name2: b.name })}
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.8, color: MUTED, maxWidth: 760, marginTop: 18 }}>
            {t("Both are real options and each is the right answer for someone. Below is what each one costs, which dialing modes you actually get for that money, and the buyer each genuinely suits: followed by a note on where our own product fits, clearly marked as ours.")}</p>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 20, marginTop: 40,
          }}>
            <Column c={a} />
            <Column c={b} />
          </div>

          {/* ── The recommendation, stated plainly ───────────────────────── */}
          <section style={{
            marginTop: 40, background: SURFACE, border: `1px solid ${BORDER}`,
            borderRadius: 8, padding: 28,
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 'bold', margin: 0 }}>{t("Which one to pick")}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.85, color: INK, marginTop: 12 }}>
              <strong>{t("Choose {name}", { name: a.name })}</strong> {t("if you are {charAt}{slice}", { charAt: t(a.bestFor).charAt(0).toLowerCase(), slice: t(a.bestFor).slice(1) })}
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.85, color: INK, marginTop: 8 }}>
              <strong>{t("Choose {name}", { name: b.name })}</strong> {t("if you are {charAt}{slice}", { charAt: t(b.bestFor).charAt(0).toLowerCase(), slice: t(b.bestFor).slice(1) })}
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.8, color: MUTED, marginTop: 14 }}>
              {t("The most common mistake in this comparison is reading the advertised rate as the bill. Add the seat minimum, the tier the dialer actually lives on, per-number charges, and any setup fee before deciding which is cheaper.")}</p>
          </section>

          {/* ── Disclosed self-mention. Last, and labelled. ───────────────── */}
          <section style={{
            marginTop: 20, background: SURFACE, border: `1px solid ${ACCENT}`,
            borderLeft: `4px solid ${ACCENT}`, borderRadius: 8, padding: 28,
          }}>
            <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 'bold', color: ACCENT }}>
              {t("DISCLOSURE, THIS IS OUR PRODUCT")}</div>
            <h2 style={{ fontSize: 20, fontWeight: 'bold', margin: '10px 0 0' }}>
              {t("Where DialerSeat fits")}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.85, color: INK, marginTop: 12 }}>
              {t("We publish this page, so weigh it accordingly. {pricing} {contract} {dialing}", { pricing: t(DIALERSEAT.pricing), contract: t(DIALERSEAT.contract), dialing: t(DIALERSEAT.dialing) })}
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.8, color: MUTED, marginTop: 12 }}>
              {t("Where we are")}{" "}<em>{t("not")}</em> {t("the right answer: {friction}.", { friction: DIALERSEAT.friction.map((f) => t(f)).join('; ') })}</p>
            <div style={{ marginTop: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href={`/vs/${a.slug}`} style={{
                fontSize: 11, letterSpacing: 1.5, fontWeight: 'bold', color: ACCENT,
                border: `1px solid ${ACCENT}`, borderRadius: 4, padding: '10px 16px', textDecoration: 'none',
              }}>
                {t("DIALERSEAT VS {name}", { name: a.name.toUpperCase() })}
              </Link>
              <Link href={`/vs/${b.slug}`} style={{
                fontSize: 11, letterSpacing: 1.5, fontWeight: 'bold', color: ACCENT,
                border: `1px solid ${ACCENT}`, borderRadius: 4, padding: '10px 16px', textDecoration: 'none',
              }}>
                {t("DIALERSEAT VS {name}", { name: b.name.toUpperCase() })}
              </Link>
            </div>
          </section>

          {/* ── Internal links: the other matchups these two appear in ────── */}
          <section style={{ marginTop: 44 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 'bold', color: MUTED }}>
              {t("OTHER COMPARISONS")}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {crossShoppedPairs()
                .filter(([x, y]) =>
                  matchupSlug(x, y) !== matchup &&
                  (x.slug === a.slug || y.slug === a.slug || x.slug === b.slug || y.slug === b.slug))
                .slice(0, 12)
                .map(([x, y]) => (
                  <Link
                    key={matchupSlug(x, y)}
                    href={`/vs/${matchupSlug(x, y)}`}
                    style={{
                      fontSize: 12, color: ACCENT, background: SURFACE,
                      border: `1px solid ${BORDER}`, borderRadius: 4,
                      padding: '7px 11px', textDecoration: 'none',
                    }}
                  >
                    {t("{name} vs {name2}", { name: x.name, name2: y.name })}
                  </Link>
                ))}
            </div>
          </section>

          <p style={{ fontSize: 12, lineHeight: 1.8, color: MUTED, marginTop: 40, maxWidth: 760 }}>
            {t("Pricing and packaging for other vendors change without notice and are summarised here from their public materials. Verify current terms with the vendor before buying. Corrections are welcome, we would rather be accurate than flattering. Competitors listed:")}{' '}
            {COMPETITORS.filter(c => c.crossShopped).map(c => c.name).join(', ')}.
          </p>
        </div>
      </GutsShell>
    </>
  )
}
