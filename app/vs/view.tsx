'use client'

import { useUser } from '@clerk/nextjs'
import Link from '@/components/LocaleLink'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import DirectoryHub, { type HubItem } from '@/components/DirectoryHub'
import { SITE } from '@/lib/siteTheme'
import { inter } from '@/lib/fonts'
import { t } from '@/lib/i18n/client'
import { msg } from '@/lib/i18n/msg'

// =============================================================================
// /vs — the comparison index
// =============================================================================
// This was a wall of twenty-three prose cards, two across. Every card carried a
// tagline, a four-line pitch and a read-more, which meant the page was about
// eleven screens long and a visitor who arrived knowing they wanted ReadyMode
// had to scroll past twenty-two other dialers to find it.
//
// It is now a directory: top picks for the visitor who knows, a live search for
// the visitor who doesn't, and the full index in a column they can scan in one
// screen. The prose that used to sit in the cards belongs on the comparison
// pages themselves, which is where somebody has actually chosen to read it.
//
// The layout lives in components/DirectoryHub.tsx because /faq is the same page
// with different nouns.
//
// `added` is the date each page's first commit landed, read out of git rather
// than estimated, because it drives the Recently Added column.
// =============================================================================

/** The hub runs on Inter, not the site's never-loaded Futura. See lib/fonts.ts. */
const HUB_FONT = inter.style.fontFamily

/**
 * Every published /vs page, most-asked-about first.
 *
 * `keywords` are the segment labels from lib/competitors.ts — a visitor
 * searching "call center" should find Five9 and Convoso without having to know
 * either name. They are matched, never rendered.
 */
const COMPARISONS: HubItem[] = [
  {
    href: '/vs/everyone',
    label: msg("VS Every Legacy Dialer"),
    note: msg("The six failures the whole category shares: start here"),
    added: '2026-05-17',
    keywords: 'industry all legacy overview start here',
  },
  {
    href: '/vs/readymode',
    label: msg("VS ReadyMode"),
    note: msg("Same multi-line predictive, no setup fee, no contract"),
    added: '2026-05-16',
    keywords: 'call center predictive',
  },
  {
    href: '/vs/mojo',
    label: msg("VS Mojo Dialer"),
    note: msg("Triple-line dialing without the real-estate lock-in"),
    added: '2026-05-16',
    keywords: 'real estate investor triple line',
  },
  {
    href: '/vs/phoneburner',
    label: msg("VS PhoneBurner"),
    note: msg("Multi-line predictive PhoneBurner does not have"),
    added: '2026-05-16',
    keywords: 'sales crm power dialer',
  },
  {
    href: '/vs/batchdialer',
    label: msg("VS BatchDialer"),
    note: msg("Their annual rate without the annual contract"),
    added: '2026-08-06',
    keywords: 'real estate investor batch leads',
  },
  {
    href: '/vs/five9',
    label: msg("VS Five9"),
    note: msg("Enterprise compliance, self-serve setup"),
    added: '2026-05-18',
    keywords: 'call center enterprise contact center',
  },
  {
    href: '/vs/convoso',
    label: msg("VS Convoso"),
    note: msg("Same dialer modes, no seat minimum"),
    added: '2026-07-18',
    keywords: 'call center predictive',
  },
  {
    href: '/vs/vicidial',
    label: msg("VS VICIdial"),
    note: msg("Free software is not a free dialer"),
    added: '2026-08-07',
    keywords: 'call center open source self hosted asterisk',
  },
  {
    href: '/vs/kixie',
    label: msg("VS Kixie"),
    note: msg("Every dialer mode at one price, no tier to climb"),
    added: '2026-07-18',
    keywords: 'sales crm power dialer',
  },
  {
    href: '/vs/justcall',
    label: msg("VS JustCall"),
    note: msg("The dialer is not a Pro-tier upsell"),
    added: '2026-07-18',
    keywords: 'sales crm',
  },
  {
    href: '/vs/orum',
    label: msg("VS Orum"),
    note: msg("Parallel dialing without enterprise pricing"),
    added: '2026-07-28',
    keywords: 'sales crm parallel ai',
  },
  {
    href: '/vs/wavv',
    label: msg("VS WAVV"),
    note: msg("Every dialer mode, one flat price"),
    added: '2026-07-15',
    keywords: 'real estate investor',
  },
  {
    href: '/vs/calltools',
    label: msg("VS CallTools"),
    note: msg("No setup fee, no sales call"),
    added: '2026-08-07',
    keywords: 'call center predictive',
  },
  {
    href: '/vs/dialedin',
    label: msg("VS DialedIn"),
    note: msg("Formerly ChaseData, still tiered"),
    added: '2026-08-07',
    keywords: 'call center chasedata chase data',
  },
  {
    href: '/vs/cloudtalk',
    label: msg("VS CloudTalk"),
    note: msg("The dialer is not in the $19 seat"),
    added: '2026-07-19',
    keywords: 'phone system voip',
  },
  {
    href: '/vs/aircall',
    label: msg("VS Aircall"),
    note: msg("The power dialer is not on the basic plan"),
    added: '2026-07-19',
    keywords: 'phone system voip',
  },
  {
    href: '/vs/dialpad',
    label: msg("VS Dialpad"),
    note: msg("The dialer is a separate product"),
    added: '2026-07-19',
    keywords: 'phone system voip',
  },
  {
    href: '/vs/ringcentral',
    label: msg("VS RingCentral"),
    note: msg("A dialer, not a phone system"),
    added: '2026-08-07',
    keywords: 'phone system voip ringcx',
  },
  {
    href: '/vs/smrtphone',
    label: msg("VS smrtPhone"),
    note: msg("One weekly number, not three charges"),
    added: '2026-08-07',
    keywords: 'real estate investor podio',
  },
  {
    href: '/vs/aloware',
    label: msg("VS Aloware"),
    note: msg("Where the dialing actually lives"),
    added: '2026-08-07',
    keywords: 'sales crm hubspot pipedrive',
  },
  {
    href: '/vs/dialer-io',
    label: msg("VS Dialer.io"),
    note: msg("A published price against a three-month commitment"),
    added: '2026-09-14',
    keywords: 'sales crm speed to lead gohighlevel hubspot dialerio dialer io sdr',
  },
  {
    href: '/vs/close',
    label: msg("VS Close"),
    note: msg("A CRM with the dialer on its upper plans"),
    added: '2026-09-24',
    keywords: 'sales crm close.com closeio power dialer predictive',
  },
  {
    href: '/vs/gohighlevel',
    label: msg("VS GoHighLevel"),
    note: msg("A power dialer inside an agency platform"),
    added: '2026-09-24',
    keywords: 'sales crm highlevel go high level agency lc phone',
  },
  {
    href: '/vs/hubspot',
    label: msg("VS HubSpot"),
    note: msg("Calling inside your CRM, minutes capped by plan"),
    added: '2026-09-24',
    keywords: 'sales crm hubspot calling sales hub power dialer',
  },
  {
    href: '/vs/redx',
    label: msg("VS REDX"),
    note: msg("Real estate leads with a dialer attached"),
    added: '2026-09-24',
    keywords: 'real estate investor expired fsbo leads storm',
  },
  {
    href: '/vs/talkdesk',
    label: msg("VS Talkdesk"),
    note: 'Seats are priced; the dialer add-on is not',
    added: '2026-09-25',
    keywords: 'enterprise contact center omnichannel add-on',
  },
  {
    href: '/vs/nextiva',
    label: msg("VS Nextiva"),
    note: msg("The plans with a published price do not dial"),
    added: '2026-09-25',
    keywords: 'phone system voip business contact center',
  },
  {
    href: '/vs/ringover',
    label: msg("VS Ringover"),
    note: msg("A three-user minimum and a twelve-month commitment"),
    added: '2026-09-24',
    keywords: 'phone system voip cloud contract',
  },
  {
    href: '/vs/manual-dialing',
    label: msg("VS Manual Dialing"),
    note: msg("Is a dialer worth it over a phone and a spreadsheet?"),
    added: '2026-09-24',
    keywords: 'manual dialing cell phone by hand worth it solo agent',
  },
  {
    href: '/vs/ytel',
    label: msg("VS Ytel"),
    note: msg("No platform fee stacked on top of seats"),
    added: '2026-08-07',
    keywords: 'call center api',
  },
  {
    href: '/vs/3cx',
    label: msg("VS 3CX"),
    note: msg("Sales dialer vs business phone system"),
    added: '2026-07-15',
    keywords: 'phone system pbx voip',
  },
  {
    href: '/vs/teams',
    label: msg("Dialer pricing for teams"),
    note: msg("What five agents actually cost, across every tool"),
    added: '2026-08-06',
    keywords: 'team seats floor agency manager five',
  },
]

/** The names people arrive already typing. */
const TOP_PICKS: HubItem[] = [
  { href: '/vs/readymode', label: msg("VS ReadyMode") },
  { href: '/vs/mojo', label: msg("VS Mojo Dialer") },
  { href: '/vs/phoneburner', label: msg("VS PhoneBurner") },
  { href: '/vs/batchdialer', label: msg("VS BatchDialer") },
  { href: '/vs/five9', label: msg("VS Five9") },
  { href: '/vs/convoso', label: msg("VS Convoso") },
  { href: '/vs/vicidial', label: msg("VS VICIdial") },
  { href: '/vs/kixie', label: msg("VS Kixie") },
  { href: '/vs/justcall', label: msg("VS JustCall") },
  { href: '/vs/ringcentral', label: msg("VS RingCentral") },
  { href: '/vs/aircall', label: msg("VS Aircall") },
  { href: '/vs/dialpad', label: msg("VS Dialpad") },
  { href: '/vs/cloudtalk', label: msg("VS CloudTalk") },
  { href: '/vs/calltools', label: msg("VS CallTools") },
]

/**
 * The left column.
 *
 * NOT the list of every /vs page — that is the middle column's job, and
 * printing it twice made the old sidebar the tallest thing on the page. These
 * are the routes somebody lands here and then wants instead.
 */
const NAV: HubItem[] = [
  { href: '/?view=landing', label: msg("Home") },
  { href: '/faq', label: msg("FAQ") },
  { href: '/terms', label: msg("Terms") },
  { href: '/privacy', label: msg("Privacy policy") },
]

export default function VsHubView() {
  const { isLoaded, isSignedIn } = useUser()
  const showSignedIn = isLoaded && isSignedIn

  return (
    <>
      <SiteHeader />
      <main
        style={{
          background: SITE.bg,
          minHeight: '100vh',
          fontFamily: HUB_FONT,
          color: SITE.text,
        }}
      >
        <style>{`
          .vshub-band {
            max-width: 1180px;
            margin: 0 auto;
            padding: 0 32px 88px;
          }
          /* No accent top rule. None of the directory cards above this panel
             carry one, and the blue bar made the Manager+ section read as a
             different component bolted onto the bottom of the page. */
          .vshub-panel {
            background: ${SITE.surface};
            border: 1px solid ${SITE.border};
            border-radius: 12px;
            padding: 34px 38px;
            margin-bottom: 18px;
          }
          .vshub-eyebrow {
            font-size: 10px; font-weight: bold; letter-spacing: 3px;
            color: ${SITE.deep};
            margin-bottom: 12px;
          }
          .vshub-panel h2 {
            margin: 0 0 14px 0;
            font-size: 28px; font-weight: 800; letter-spacing: -0.6px;
            line-height: 1.2;
            color: ${SITE.text};
          }
          .vshub-panel p {
            margin: 0 0 8px 0;
            font-size: 15.5px; line-height: 1.7;
            color: ${SITE.muted};
            max-width: 760px;
          }
          .vshub-panel a { color: #2a6eff; font-weight: 600; text-decoration: none; }
          .vshub-panel a:hover { text-decoration: underline; text-underline-offset: 3px; }

          .vshub-cta {
            background: ${SITE.ink};
            border-radius: 12px;
            padding: 56px 40px;
            text-align: center;
          }
          .vshub-cta-eyebrow {
            font-size: 10px; font-weight: bold; letter-spacing: 3px;
            color: rgba(255,255,255,0.5);
            margin-bottom: 14px;
          }
          .vshub-cta h2 {
            margin: 0 0 14px 0;
            font-size: 38px; font-weight: 800; letter-spacing: -1px;
            line-height: 1.12;
            color: #fff;
          }
          .vshub-cta p {
            margin: 0 auto 28px;
            max-width: 540px;
            font-size: 16px; line-height: 1.65;
            color: rgba(255,255,255,0.66);
          }
          .vshub-cta-row {
            display: flex; align-items: center; justify-content: center;
            gap: 14px; flex-wrap: wrap;
          }
          .vshub-btn {
            display: inline-block;
            padding: 15px 30px;
            border-radius: 6px;
            font-size: 12px; font-weight: bold; letter-spacing: 3px;
            text-decoration: none;
          }
          .vshub-btn.primary {
            background: #fff; color: ${SITE.text};
            border-top: 3px solid #2a6eff;
          }
          .vshub-btn.secondary {
            background: transparent; color: #fff;
            border: 1px solid rgba(255,255,255,0.28);
            border-top: 3px solid rgba(255,255,255,0.75);
          }

          @media (max-width: 760px) {
            .vshub-band { padding: 0 20px 64px; }
            .vshub-panel { padding: 26px 22px; }
            .vshub-panel h2 { font-size: 23px; }
            .vshub-cta { padding: 40px 22px; }
            .vshub-cta h2 { font-size: 28px; }
            .vshub-btn { display: block; width: 100%; text-align: center; }
          }
        `}</style>

        <DirectoryHub
          headlineTop="Pick your competitor."
          headlineBottom="We'll show you why we win."
          underline="why"
          leadHref="/vs/everyone"
          leadLabel="Start with the industry-wide breakdown"
          picksLabel="TOP PICKS"
          picks={TOP_PICKS}
          searchPlaceholder="Search competitors..."
          searchNoun="comparisons"
          requestTitle="Can't find yours?"
          requestLabel="Submit a request"
          requestPrompt="Tell us which dialer to compare next, or ask anything about how DialerSeat stacks up. A real person reads these."
          navTitle="VS"
          navDivider="ELSEWHERE ON THE SITE"
          navItems={NAV}
          allTitle="All Comparisons"
          allItems={COMPARISONS}
          allCta="Browse all comparisons"
          recentTitle="Recently Added"
        />

        <div className="vshub-band">
          <div className="vshub-panel">
            <div className="vshub-eyebrow">{t("▸ FOR TEAMS & AGENCIES")}</div>
            <h2>{t("Manager+ adds whitelabel for $75/week, flat.")}</h2>
            <p>
              {t("Running more than one seat, or managing dialing for other people's teams? Manager+ is a flat $75/week upgrade that puts your brand on the platform, same rate whether you're managing 2 seats or 200. None of the dialers on this page offer true whitelabel; the closest most get is a referral or reseller program that keeps their name on the product.")}</p>
            <p>
              <Link href="/vs/teams">{t("See what five agents cost on every tool →")}</Link>
            </p>
          </div>

          <section className="vshub-cta">
            <div className="vshub-cta-eyebrow">{t("▸ SKIP THE COMPARISON")}</div>
            <h2>{t("Skip the comparison. Just try it.")}</h2>
            <p>
              {t("$35/seat/week. Cancel anytime. Every feature included. No setup fee, no contract, no demos. The fastest way to know if DialerSeat™ beats whatever you're using now is to actually use it.")}</p>
            <div className="vshub-cta-row">
              <Link
                href={showSignedIn ? '/dashboard/analytics' : '/sign-up'}
                className="vshub-btn primary"
              >
                {showSignedIn ? t("GO TO DASHBOARD →") : t("GET STARTED →")}
              </Link>
              <Link href="/vs/everyone" className="vshub-btn secondary">
                {t("THE FULL BREAKDOWN")}</Link>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
