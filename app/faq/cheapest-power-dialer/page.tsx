import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import JsonLd from '@/components/json-ld'
import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import DialingModeCTA from '@/components/DialingModeCTA'
import ExplainerStyles from '@/components/ExplainerStyles'
import GutsShell from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import RelatedLinks from '@/components/RelatedLinks'
import { RELATED_BY_ROUTE } from '@/lib/relatedLinks'
import { primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'
import ToolLinks from '@/components/ToolLinks'

const ROUTE = '/faq/cheapest-power-dialer'

const baseMetadata: Metadata = {
  title: 'Cheapest Power Dialer: What You Actually Pay First | DialerSeat',
  description:
    'The cheapest power dialer depends on how long you dial. See the smallest amount you can spend on each one, read from their own pricing pages.',
  alternates: { canonical: 'https://dialerseat.com/faq/cheapest-power-dialer' },
  openGraph: {
    title: 'Cheapest Power Dialer: It Depends How Long You Dial',
    description: 'The smallest amount you can spend on each dialer, read from their own pricing pages.',
    url: 'https://dialerseat.com/faq/cheapest-power-dialer',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cheapest Power Dialer: It Depends How Long You Dial',
    description: 'The smallest amount you can spend on each dialer, read from their own pricing pages.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

// Each row is the cheapest plan with power dialing, one seat, billed by the
// shortest term the vendor sells, read from the vendor's own pricing page on
// 6 Nov 2026. A vendor that sells only by quote has no row. DialerSeat's price
// is only ever stated in weeks.
const ROWS: { dialer: string; plan: string; first: string; weekly?: boolean }[] = [
  { dialer: 'DialerSeat', plan: msg("Pro, with all four dialing modes"), first: msg("$35, one week"), weekly: true },
  { dialer: 'CloudTalk', plan: msg("Starter plus the Power Dialer add-on, whose $15 is listed as billed annually"), first: msg("$49, one month") },
  { dialer: 'smrtPhone', plan: msg("Standard plus smrtDialer Single Line"), first: msg("$79, one month, plus $0.03 a minute") },
  { dialer: 'Mojo Dialer', plan: msg("Single Line plus Agent Access"), first: msg("$99, one month") },
  { dialer: 'WAVV', plan: 'Single Line', first: msg("$99, one month") },
  { dialer: 'Close', plan: 'Growth', first: msg("$109, one month, plus calling") },
  { dialer: 'BatchDialer', plan: msg("3 lines per agent"), first: msg("$119, one month") },
  { dialer: 'JustCall', plan: 'Pro', first: msg("$138, one month, for the two-seat minimum") },
  { dialer: 'PhoneBurner', plan: 'Standard', first: msg("$165, one month") },
  { dialer: 'ReadyMode', plan: 'Starter', first: msg("$239, one month") },
]

const WEEKS: { label: string; ds: string }[] = [
  { label: msg("1 week"), ds: '$35' },
  { label: msg("2 weeks"), ds: '$70' },
  { label: msg("3 weeks"), ds: '$105' },
  { label: msg("4 weeks"), ds: '$140' },
]

const FAQS = [
  {
    question: msg("What is the cheapest power dialer?"),
    answer: msg("For a short job, DialerSeat at $35 for one week. Nothing on this page lets you spend less to start, and that week includes predictive dialing. Over months of steady dialing on one line, plans such as CloudTalk Starter with its Power Dialer add-on ($49) or smrtPhone ($79 plus minutes) can cost less."),
  },
  {
    question: msg("How much does a power dialer cost?"),
    answer: msg("On the monthly plans above, from $49 to $239 for the smallest purchase for one seat, before any usage charges. DialerSeat is $35 a week."),
  },
  {
    question: msg("Why do cheap dialers cost more than they look?"),
    answer: msg("The advertised price is often the annual rate, paid up front, and the dialer is often a higher tier or an add-on. ReadyMode’s $199 needs a 12-month term paid upfront, for example, and its monthly price is $239."),
  },
]

const cell = { padding: '10px 8px', borderBottom: '1px solid #e2e4ea', textAlign: 'left' as const, fontSize: 13, lineHeight: 1.4, verticalAlign: 'top' as const }
const head = { ...cell, fontSize: 12, fontWeight: 700, color: '#1a1c24' }

export default async function Page() {
  await primeLocale()
  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: msg("Home"), url: '/' },
        { name: msg("Faq"), url: '/faq' },
        { name: msg("Cheapest power dialer"), url: ROUTE },
      ])} />
      <JsonLd data={faqPageSchema(FAQS)} />
      <SiteHeader />
      <GutsShell rail={faqRail(ROUTE)} activeHref={ROUTE}>
      <div className="exp-root">
        <ExplainerStyles accent="#2a4a8a" accentBg="#e8eef8" />

        <section className="exp-hero">
          <div className="exp-hero-inner">
            <div className="exp-eyebrow">{t("EXPLAINER · DIALER PRICING")}</div>
            <h1>{t("Cheapest power dialer: it depends how long you dial.")}</h1>
            <p className="exp-lead">
              {t("The cheapest power dialer depends on how long you need it. DialerSeat bills by the week, so a week costs $35. Dialers that bill by the month charge the whole month even if you dial for one week. Plans with annual terms charge a year up front. Compare the smallest amount you can actually spend.")}</p>
          </div>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">{t("▸ THE SMALLEST PURCHASE")}</div>
          <h2>{t("What each one makes you spend first.")}</h2>
          <p>
            {t("Each price is for one seat on the cheapest plan with power dialing, read from the vendor’s own pricing page on 6 November 2026. Prices change, so check before you buy.")}</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
              <thead>
                <tr>
                  <th scope="col" style={head}>{t("Dialer")}</th>
                  <th scope="col" style={head}>{t("Smallest purchase")}</th>
                  <th scope="col" style={head}>{t("Plan")}</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(r => (
                  <tr key={r.dialer} style={r.weekly ? { background: '#e8eef8', fontWeight: 700 } : undefined}>
                    <td style={cell}>{r.dialer}</td>
                    <td style={cell}>{t(r.first)}</td>
                    <td style={cell}>{t(r.plan)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 18 }}>
            {t("Kixie, CallTools, Ytel, Five9 and Convoso sell by quote, so there is no price to put here.")}</p>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">{t("▸ THE MATH")}</div>
          <h2>{t("How long you dial decides it.")}</h2>
          <p>
            {t("A monthly plan costs the same whether you dial for one week or four. DialerSeat costs $35 for each week you use it. The shorter the job, the further ahead weekly billing gets.")}</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
              <thead>
                <tr>
                  <th scope="col" style={head}>{t("You dial for")}</th>
                  <th scope="col" style={head}>DialerSeat</th>
                  <th scope="col" style={head}>{t("A $99 monthly plan")}</th>
                  <th scope="col" style={head}>{t("A $165 monthly plan")}</th>
                </tr>
              </thead>
              <tbody>
                {WEEKS.map(w => (
                  <tr key={w.label}>
                    <th scope="row" style={{ ...cell, fontWeight: 600 }}>{t(w.label)}</th>
                    <td style={{ ...cell, fontWeight: 700 }}>{w.ds}</td>
                    <td style={cell}>$99</td>
                    <td style={cell}>$165</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 18 }}>
            {t("Against a $99 plan, DialerSeat costs less for up to two weeks and more from the third. Against a $165 plan, it costs less for all four.")}{' '}
            {t("Against a $49 plan, it costs less only for the first week.")}</p>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">{t("▸ WHEN SOMETHING ELSE IS CHEAPER")}</div>
          <h2>{t("If you dial every week, a low monthly plan can cost less.")}</h2>
          <p>
            {t("If you will dial every week for months and one line is enough, a low monthly plan costs less than weekly billing. The")}{' '}
            <Link href="/tools/dialer-cost-calculator">{t("dialer cost calculator")}</Link>{' '}
            {t("shows the exact figures for your weeks and agents.")}</p>
          <p>
            {t("Read what the low price leaves out. CloudTalk’s and smrtPhone’s dialers are add-ons, smrtPhone meters call time, and Close bills calling on top of the seat. On DialerSeat, all four dialing modes, unlimited numbers and calling are in the seat.")}</p>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">{t("▸ COMMON QUESTIONS")}</div>
          <h2>{t("Dialer cost, answered.")}</h2>
          {FAQS.map(f => (
            <div key={f.question} style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 18, marginBottom: 8 }}>{t(f.question)}</h3>
              <p style={{ margin: 0 }}>{t(f.answer)}</p>
            </div>
          ))}
        </section>

        <DialingModeCTA
          headline="One week costs $35."
          description="Every dialer mode, unlimited numbers and calling in the seat. Billed weekly, cancel any week."
        />
        <ToolLinks slugs={['dialer-cost-calculator']} />
        <RelatedLinks links={RELATED_BY_ROUTE[ROUTE]} />
        </div>
      </GutsShell>
      <SiteFooter />
    </>
  )
}
