import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import PageStamp from '@/components/PageStamp'
import { faqRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { LOCALES, ENABLED_LOCALES } from '@/lib/i18n/locales'
import { pageDate } from '@/lib/pageDates'
import { localizeMetadata } from '@/lib/i18n/metadata'
import { primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'

// =============================================================================
// /faq/languages
// =============================================================================
// The languages the interface comes in, and the four honest limits around it.
//
// THE LIST IS READ FROM lib/i18n/locales, never typed out here. A page that
// hardcodes "twelve languages" is a page that says eleven or thirteen the day
// after somebody edits ENABLED_LOCALES, and this is the page a buyer checks
// before putting a Spanish-speaking floor on seats.
//
// WHAT IT MUST NOT DO is let "we speak your language" slide into meaning more
// than it does. The interface is translated. Support is in English, the layout
// stays left-to-right even in Arabic and Hebrew, nothing the customer types is
// translated, and the price is the same number of US dollars in every one of
// them. All four are stated on the page rather than discovered later.
// =============================================================================

const ROUTE = '/faq/languages'
const UPDATED = pageDate(ROUTE)
const SITE_URL = 'https://dialerseat.com'

/** The enabled languages, in the order lib/i18n/locales declares them. */
const LIVE = LOCALES.filter((l) => ENABLED_LOCALES.includes(l.code))
const COUNT = LIVE.length
const NAMES = LIVE.map((l) => l.label).join(', ')
const RTL = LIVE.filter((l) => l.dir === 'rtl').map((l) => l.label).join(' and ')

const baseMetadata: Metadata = {
  title: `What Languages Does DialerSeat Support? ${COUNT} Interface Languages | DialerSeat`,
  description:
    `DialerSeat's interface is available in ${COUNT} languages: ${NAMES}. The whole product is translated, not just the marketing pages, and the language never changes on its own. What is translated, what is not, and how to switch.`,
  keywords: [
    'DialerSeat languages',
    'dialer in Spanish',
    'Spanish dialer software',
    'multilingual dialer',
    'dialer for offshore agents language',
    'call center software languages',
  ],
  alternates: { canonical: `${SITE_URL}${ROUTE}` },
  openGraph: {
    title: `DialerSeat in ${COUNT} languages`,
    description: `The whole interface, not just the marketing pages: ${NAMES}.`,
    url: `${SITE_URL}${ROUTE}`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: `DialerSeat in ${COUNT} languages`,
    description: `The whole interface, not just the marketing pages: ${NAMES}.`,
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("What languages does DialerSeat support?"),
    answer:
      `DialerSeat's interface is available in ${COUNT} languages: ${NAMES}. It is the whole product, not only the marketing pages: the dialer, campaigns, leads, recordings, analytics, compliance and settings are all translated. A language is only switched on once its translation covers every string in the product, because a half-translated screen reads as broken.`,
  },
  {
    question: msg("Is DialerSeat available in Spanish?"),
    answer:
      msg("Yes, and the Spanish is Latin American rather than European, because that is what the Colombian, Mexican and Dominican floors this was built for actually read. The entire dialer is in Spanish, not just the website. Pick it from the globe in the header, or go straight to dialerseat.com/es."),
  },
  {
    question: msg("Does DialerSeat change language by itself?"),
    answer:
      msg("No. With no cookie, no account setting and no click, the answer is always English. If your device or your country suggests another language, DialerSeat asks once, in the language it is offering, with the English underneath. Either answer is remembered and the question never comes back."),
  },
  {
    question: msg("Does changing the language change the price?"),
    answer:
      msg("No. A seat is $35 per week and Manager+ is $75 per week, in US dollars, in every language. There is no regional pricing, no local currency and no translated plan that costs something different."),
  },
  {
    question: msg("Is DialerSeat support available in my language?"),
    answer:
      msg("Support is in English. The interface is translated and the sign-in, sign-up and checkout screens are translated, but an email to support@dialerseat.com is read and answered in English. That is worth knowing before a floor depends on it."),
  },
  {
    question: msg("Are my leads, scripts and recordings translated?"),
    answer:
      msg("No, and they are not touched. The interface around your work is translated; the work itself is yours. Lead names and notes, call scripts, campaign names, dispositions you typed and recorded calls all stay exactly as you entered them, whatever language the buttons are in. DialerSeat does not translate or interpret live calls."),
  },
]

export default async function LanguagesPage() {
  await primeLocale()

  return (
    <>
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("FAQ"), url: '/faq' },
          { name: msg("Languages"), url: ROUTE },
        ])}
      />
      <SiteHeader />
      <GutsShell rail={faqRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ LANGUAGES")}</div>
            <h1>
              {t("The whole dialer,")}
              <span className="second">{t("not just the website.")}</span>
            </h1>
            <p>
              {t("Plenty of software translates its marketing pages and leaves the product in English, which is the half that an agent actually spends the day in. DialerSeat translates the product: the dialer terminal, campaigns, leads, recordings, analytics, compliance and settings.")}
            </p>
            <div className="guts-btns">
              <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
              <Link href="/screenshots" className="guts-btn secondary">{t("SEE THE SCREENS")}</Link>
            </div>
            <PageStamp>{t("Updated {uPDATED}", { uPDATED: UPDATED })}</PageStamp>
          </div>
        </GutsSection>

        {/* ── THE LIST ────────────────────────────────────────────────────
            Rendered from lib/i18n/locales, so it cannot claim a language the
            product does not actually ship. */}
        <GutsSection icon="list" title={t("The languages")}>
          <div className="guts-grid-3">
            {LIVE.map((l) => (
              <div key={l.code} className="guts-panel">
                <div className="role">{l.short}</div>
                <h3 lang={l.code} dir={l.dir} style={{ margin: 0 }}>{l.label}</h3>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 20 }}>
            {t("A language is switched on only once its translation covers every string in the product. There is no half-finished language sitting in the menu, because a screen that is translated in places reads as broken rather than as multilingual.")}
          </p>
        </GutsSection>

        {/* ── IT NEVER DECIDES FOR YOU ───────────────────────────────────── */}
        <GutsSection icon="check" title={t("It asks. It does not decide.")}>
          <p>
            {t("With no cookie, no account setting and no click, DialerSeat is in English. Nothing about your location or your browser changes that on its own.")}
          </p>
          <ul className="guts-list good">
            <li>{t("Your device comes first. A phone set to Spanish is the thing that knows what you read, more than an IP address does.")}</li>
            <li>{t("Location is only the fallback, for the common case of an agent abroad whose phone was left in English.")}</li>
            <li>{t("It asks in the language it is offering, with the English underneath, so the question is readable either way.")}</li>
            <li>{t("Either answer is remembered, and it never asks again.")}</li>
            <li>{t("Signed in, your choice is saved to your account and follows you to any device. Signed out, it is kept in a cookie on that browser.")}</li>
          </ul>
          <p>
            {t("It also stays quiet where it should. The Philippines, India and Jamaica have no suggestion attached to them at all, because call-center work in those countries is done in English and offering to switch would be presumptuous. Filipino and Hindi are both in the menu for anyone who wants them.")}
          </p>
        </GutsSection>

        {/* ── SWITCHING ──────────────────────────────────────────────────── */}
        <GutsSection icon="swap" title={t("Changing it")}>
          <ul className="guts-list good">
            <li>{t("The globe in the header, on every page of the site.")}</li>
            <li>{t("The globe at the bottom of the dashboard sidebar, once you are signed in.")}</li>
            <li>{t("Or by address: every public page also exists at its own language address, so dialerseat.com/es/pricing is the pricing page in Spanish.")}</li>
          </ul>
          <p>
            {t("Those language addresses are real pages rather than a redirect with a cookie attached, each one listing the others, which is what lets somebody searching in their own language find the page in it.")}
          </p>
        </GutsSection>

        {/* ── SIGN-IN AND CHECKOUT ───────────────────────────────────────── */}
        <GutsSection icon="shield" title={t("Signing up and paying, in the same language")}>
          <p>
            {t("The screens that are not ours are translated too. The sign-in, sign-up and account screens come in your language, and so does the checkout. A confirmation box that asks you to type a word to confirm asks for the word in the language the instruction was written in, which sounds obvious until you meet software where it is not.")}
          </p>
          <p className="guts-note">
            {t("Two gaps worth naming: Filipino has no translation pack from our sign-in provider, so those screens are in English with our own copy translated around them, and Hindi has none from our payment processor, so checkout follows the browser there.")}
          </p>
        </GutsSection>

        {/* ── THE LIMITS ─────────────────────────────────────────────────── */}
        <GutsSection icon="alert" title={t("What is not translated")}>
          <p>
            {t("Stated here so nobody finds out after paying for a floor.")}
          </p>
          <ul className="guts-list warn">
            <li>
              <strong>{t("Support is in English.")}</strong>{' '}
              {t("The interface is translated; an email to support is read and answered in English.")}
            </li>
            <li>
              <strong>{t("{rtl} are translated, but the layout is not mirrored.", { rtl: RTL })}</strong>{' '}
              {t("The text is in the language. The page still runs left to right rather than right to left, which is a real difference and not one we are going to pretend about.")}
            </li>
            <li>
              <strong>{t("Your own content stays yours.")}</strong>{' '}
              {t("Leads, notes, scripts, campaign names and recordings are never translated or altered.")}
            </li>
            <li>
              <strong>{t("Calls are not translated.")}</strong>{' '}
              {t("There is no live interpretation and no translated transcription. The agent speaks the language the agent speaks.")}
            </li>
            <li>
              <strong>{t("The price does not change.")}</strong>{' '}
              {t("$35 per seat per week and $75 for Manager+, in US dollars, in every language.")}
            </li>
          </ul>
        </GutsSection>

        {/* ── WHY IT EXISTS ──────────────────────────────────────────────── */}
        <GutsSection icon="team" title={t("Why a dialer bothers with this")}>
          <p>
            {t("Because a great deal of outbound calling is done by people who are not calling in their first language, and for a floor abroad the interface is the part that can be in theirs. An agent who reads their own dispositions and their own campaign settings makes fewer mistakes in them.")}
          </p>
          <p>
            {t("The compliance side is unaffected by any of it. Calling windows are enforced against the lead's own state, never the agent's location or the language the screen is in, which is what makes a remote or offshore floor safe to run in the first place.")}
          </p>
          <div className="guts-btns">
            <Link href="/faq/dialer-for-offshore-agents" className="guts-btn secondary">{t("DIALING FROM ABROAD")}</Link>
            <Link href="/faq/teams-how-it-works" className="guts-btn secondary">{t("HOW TEAMS WORK")}</Link>
            <Link href="/faq/how-we-keep-compliance" className="guts-btn secondary">{t("HOW WE KEEP COMPLIANCE")}</Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
