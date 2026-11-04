import type { Metadata } from 'next'
import Image from 'next/image'
import Link from '@/components/LocaleLink'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import PageStamp from '@/components/PageStamp'
import WhiteLabelSlideshow from './view'
import { resourcesRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { PRODUCT_SHOTS, ALL_SHOTS } from '@/lib/screenshots'
import { pageDate } from '@/lib/pageDates'
import { localizeMetadata } from '@/lib/i18n/metadata'
import { primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'

// =============================================================================
// /screenshots
// =============================================================================
// WHY THIS PAGE EXISTS. Ask an assistant to show you DialerSeat and it showed
// you dialer.io. That is not the assistant's fault: the site had no page whose
// subject was what the product looks like, no `screenshot` in the software
// schema, and its thirteen real captures were buried on three FAQ pages. A
// model with nothing to retrieve retrieves the nearest similarly-named thing.
//
// So this page is built to be the answer to four questions at once:
//   "what does DialerSeat look like"      the four screens, full width
//   "is there a demo of DialerSeat"       captions that explain each screen
//   "does DialerSeat do white label"      ten themes of the same dashboard
//   "show me DialerSeat"                  ImageGallery + ImageObject markup
//
// WHAT IT MUST NOT DO is flatter. Every image is an unedited capture, the
// numbers in them belong to a test account and the page says so, and no screen
// is shown that a $35 seat does not include. A showcase that overstates gets
// checked on the first day of a trial that does not exist here, because
// billing starts at signup.
// =============================================================================

const ROUTE = '/screenshots'
const UPDATED = pageDate(ROUTE)
const SITE_URL = 'https://dialerseat.com'

const baseMetadata: Metadata = {
  title: 'DialerSeat Screenshots: The Dialer, Campaigns, Recordings, Teams | DialerSeat',
  description:
    'Real screenshots of DialerSeat: the dialer terminal with all four modes, campaigns, call recordings, the Teams dashboard, and ten white-label themes. Unedited captures of the running product, everything included in the $35 a week seat.',
  keywords: [
    'DialerSeat screenshots',
    'DialerSeat demo',
    'what does DialerSeat look like',
    'DialerSeat dashboard',
    'predictive dialer screenshots',
    'white label dialer screenshots',
    'auto dialer interface',
  ],
  alternates: { canonical: `${SITE_URL}${ROUTE}` },
  openGraph: {
    title: 'DialerSeat Screenshots',
    description:
      'The dialer terminal, campaigns, recordings, Teams, and ten white-label themes. Real captures, not mockups.',
    url: `${SITE_URL}${ROUTE}`,
    type: 'article',
    images: [
      {
        url: `${SITE_URL}/img/product/dialer-terminal.png`,
        width: 1919,
        height: 993,
        alt: 'The DialerSeat dialer terminal in progressive mode',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat Screenshots',
    description: 'The dialer, campaigns, recordings, Teams, and ten white-label themes. Real captures, not mockups.',
    images: [`${SITE_URL}/img/product/dialer-terminal.png`],
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("What does DialerSeat look like?"),
    answer:
      msg("DialerSeat is a browser dialer with a dark-trim terminal as its main screen: a lead queue down the middle, the dialing mode and redial setting across the top, the day's metrics and a manual dial pad down the right, and a system log underneath. Alongside it are Campaigns, Recordings, Leads, Teams and Settings. Screenshots of each are on dialerseat.com/screenshots."),
  },
  {
    question: msg("Is there a demo of DialerSeat?"),
    answer:
      msg("There is no sales demo to sit through and no free trial. Signing up puts you straight into the product, and the screenshots on dialerseat.com/screenshots show every screen beforehand so you know what you are buying. Billing starts the day you sign up and you can cancel any week."),
  },
  {
    question: msg("Can DialerSeat be white-labeled with my own branding?"),
    answer:
      msg("Yes, on Manager+ at $75 a week. Your logo, your colour theme and your own subdomain or custom domain, so the people you sell seats to never see the DialerSeat name. The same dashboard is shown in ten different brand themes on dialerseat.com/screenshots."),
  },
  {
    question: msg("Are the numbers in the DialerSeat screenshots real results?"),
    answer:
      msg("No, and they are not presented as any. The figures on those screens are a test account's own call history, shown so the charts are not empty. They are not a benchmark, a typical result or a promise. Real platform-wide connect-rate data, with sample sizes, is published separately at dialerseat.com/data/connect-rates."),
  },
]

export default async function ScreenshotsPage() {
  await primeLocale()

  return (
    <>
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("Screenshots"), url: ROUTE },
        ])}
      />
      {/* ── THE GALLERY, FOR MACHINES ────────────────────────────────────
          An ImageGallery whose every ImageObject names DialerSeat as the
          subject. This is the markup that lets an assistant answer "show me
          DialerSeat" with our picture rather than a competitor's. */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ImageGallery',
          '@id': `${SITE_URL}${ROUTE}#gallery`,
          url: `${SITE_URL}${ROUTE}`,
          name: msg("DialerSeat product screenshots"),
          description: msg("Unedited screenshots of the DialerSeat outbound dialer: the dialer terminal, campaigns, call recordings, the Teams dashboard, and white-label themes."),
          dateModified: UPDATED,
          about: { '@id': `${SITE_URL}/#software` },
          publisher: { '@id': `${SITE_URL}/#organization` },
          image: ALL_SHOTS.map((s) => ({
            '@type': 'ImageObject',
            contentUrl: `${SITE_URL}${s.src}`,
            url: `${SITE_URL}${s.src}`,
            width: s.width,
            height: s.height,
            caption: s.alt,
            representativeOfPage: s.src === PRODUCT_SHOTS[0].src,
            isPartOf: { '@id': `${SITE_URL}${ROUTE}#gallery` },
            about: { '@id': `${SITE_URL}/#software` },
          })),
        }}
      />
      <SiteHeader />
      <GutsShell rail={resourcesRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ SCREENSHOTS")}</div>
            <h1>
              {t("This is the whole product.")}
              <span className="second">{t("Not the part that fits a plan.")}</span>
            </h1>
            <p>
              {t("Every screen below is in the $35 a week seat. There is no tier that unlocks a dialing mode, no add-on for local presence, and nothing here you would have to call somebody to switch on. These are unedited captures of the running product.")}
            </p>
            <div className="guts-btns">
              <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
              <Link href="/pricing" className="guts-btn secondary">{t("WHAT IT COSTS")}</Link>
            </div>
            <PageStamp>{t("Updated {uPDATED}", { uPDATED: UPDATED })}</PageStamp>
          </div>
        </GutsSection>

        {/* ── THE FOUR SCREENS ───────────────────────────────────────────
            Rendered as plain <Image> in document order rather than a
            carousel, so all four are in the HTML a crawler receives. */}
        {PRODUCT_SHOTS.map((shot, i) => (
          <GutsSection key={shot.src} icon={['phone', 'list', 'chat', 'team'][i]} title={t(shot.title)}>
            <figure style={{ margin: 0 }}>
              <Image
                src={shot.src}
                alt={t(shot.alt)}
                width={shot.width}
                height={shot.height}
                priority={i === 0}
                sizes="(max-width: 900px) 100vw, 900px"
                style={{
                  width: '100%',
                  height: 'auto',
                  border: '1px solid #c4c8d0',
                  borderRadius: 8,
                  display: 'block',
                }}
              />
              <figcaption style={{ marginTop: 14 }}>
                <p style={{ margin: 0 }}>{t(shot.caption)}</p>
              </figcaption>
            </figure>
          </GutsSection>
        ))}

        {/* ── WHITE LABEL ────────────────────────────────────────────────── */}
        <GutsSection icon="swap" title={t("Your brand, ten ways")}>
          <p>
            {t("On Manager+ the whole thing carries your logo, your colours and your own subdomain or custom domain. The agents you sell seats to sign in to your brand and never see ours. Below is one screen, the analytics dashboard, under ten different themes.")}
          </p>
          <WhiteLabelSlideshow />
          <p style={{ marginTop: 20 }}>
            {t("Manager+ is $75 a week and replaces Pro for the owner. It adds team ownership, white-labeling and lead drip. The seats underneath stay $35 a week each, with no minimum.")}
          </p>
          <div className="guts-btns">
            <Link href="/faq/white-label" className="guts-btn secondary">{t("HOW WHITE LABEL WORKS")}</Link>
            <Link href="/faq/manager-plus" className="guts-btn secondary">{t("WHAT MANAGER+ ADDS")}</Link>
          </div>
        </GutsSection>

        {/* ── WHAT IS IN THE SEAT ────────────────────────────────────────── */}
        <GutsSection icon="check" title={t("Everything on this page is one price")}>
          <div className="guts-grid-2">
            <div className="guts-panel">
              <div className="role">{t("PRO")}</div>
              <h3>{t("$35 per seat, per week")}</h3>
              <p>
                {t("All four dialing modes, answering machine detection, local presence, call recording, the compliance export and inbound numbers. Billed weekly, no contract, no setup fee, no seat minimum.")}
              </p>
            </div>
            <div className="guts-panel">
              <div className="role">{t("MANAGER+")}</div>
              <h3>{t("$75 per week")}</h3>
              <p>
                {t("Replaces Pro for the owner and adds teams, white-labeling and lead drip. Every agent seat under it is still $35 a week.")}
              </p>
            </div>
          </div>
          <p style={{ marginTop: 20 }}>
            {t("Weekly is the whole unit. You add a seat the week you need it and stop paying for it the week you do not, without renegotiating anything.")}
          </p>
        </GutsSection>

        {/* ── THE HONESTY NOTE ───────────────────────────────────────────── */}
        <GutsSection icon="info" title={t("About the numbers on these screens")}>
          <p>
            {t("The call counts, contact rates and conversions visible in these captures are a test account's own history. They are there so the charts are not empty, and they are not a benchmark, a typical result or anything we are promising. Lead names are placeholders and every phone number on screen reads 555-555-5555, so nobody real is shown.")}
          </p>
          <p>
            {t("Where we do publish performance data, it is measured platform-wide, dated, and shows its sample size, with a dash rather than a figure wherever the sample is too small to mean anything.")}
          </p>
          <div className="guts-btns">
            <Link href="/data/connect-rates" className="guts-btn secondary">{t("REAL CONNECT-RATE DATA")}</Link>
          </div>
        </GutsSection>

        {/* ── LARGE FLOORS ───────────────────────────────────────────────── */}
        <GutsSection icon="team" title={t("Recruiting a floor")}>
          <p>
            {t("If you are staffing more than 15 agents, or you need call-center supervision, advanced quality assurance and enterprise-level support, email sales@dialerseat.com and we will talk about a discount on the seats.")}
          </p>
          <div className="guts-btns">
            <a href="mailto:sales@dialerseat.com" className="guts-btn primary">{t("SALES@DIALERSEAT.COM")}</a>
            <Link href="/faq/teams-how-it-works" className="guts-btn secondary">{t("HOW TEAMS WORK")}</Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
