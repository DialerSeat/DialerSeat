'use client'

import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import DirectoryHub, { type HubItem } from '@/components/DirectoryHub'
import { SITE } from '@/lib/siteTheme'
import { inter } from '@/lib/fonts'

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
    label: 'VS Every Legacy Dialer',
    note: 'The six failures the whole category shares — start here',
    added: '2026-05-17',
    keywords: 'industry all legacy overview start here',
  },
  {
    href: '/vs/readymode',
    label: 'VS ReadyMode',
    note: 'Same multi-line predictive, no setup fee, no contract',
    added: '2026-05-16',
    keywords: 'call center predictive',
  },
  {
    href: '/vs/mojo',
    label: 'VS Mojo Dialer',
    note: 'Triple-line dialing without the real-estate lock-in',
    added: '2026-05-16',
    keywords: 'real estate investor triple line',
  },
  {
    href: '/vs/phoneburner',
    label: 'VS PhoneBurner',
    note: 'Multi-line predictive PhoneBurner does not have',
    added: '2026-05-16',
    keywords: 'sales crm power dialer',
  },
  {
    href: '/vs/batchdialer',
    label: 'VS BatchDialer',
    note: 'Their annual rate without the annual contract',
    added: '2026-08-06',
    keywords: 'real estate investor batch leads',
  },
  {
    href: '/vs/five9',
    label: 'VS Five9',
    note: 'Enterprise compliance, self-serve setup',
    added: '2026-05-18',
    keywords: 'call center enterprise contact center',
  },
  {
    href: '/vs/convoso',
    label: 'VS Convoso',
    note: 'Same dialer modes, no seat minimum',
    added: '2026-07-18',
    keywords: 'call center predictive',
  },
  {
    href: '/vs/vicidial',
    label: 'VS VICIdial',
    note: 'Free software is not a free dialer',
    added: '2026-08-07',
    keywords: 'call center open source self hosted asterisk',
  },
  {
    href: '/vs/kixie',
    label: 'VS Kixie',
    note: 'Every dialer mode at one price, no tier to climb',
    added: '2026-07-18',
    keywords: 'sales crm power dialer',
  },
  {
    href: '/vs/justcall',
    label: 'VS JustCall',
    note: 'The dialer is not a Pro-tier upsell',
    added: '2026-07-18',
    keywords: 'sales crm',
  },
  {
    href: '/vs/orum',
    label: 'VS Orum',
    note: 'Parallel dialing without enterprise pricing',
    added: '2026-07-28',
    keywords: 'sales crm parallel ai',
  },
  {
    href: '/vs/wavv',
    label: 'VS WAVV',
    note: 'Every dialer mode, one flat price',
    added: '2026-07-15',
    keywords: 'real estate investor',
  },
  {
    href: '/vs/calltools',
    label: 'VS CallTools',
    note: 'No setup fee, no sales call',
    added: '2026-08-07',
    keywords: 'call center predictive',
  },
  {
    href: '/vs/dialedin',
    label: 'VS DialedIn',
    note: 'Formerly ChaseData, still tiered',
    added: '2026-08-07',
    keywords: 'call center chasedata chase data',
  },
  {
    href: '/vs/cloudtalk',
    label: 'VS CloudTalk',
    note: 'The dialer is not in the $19 seat',
    added: '2026-07-19',
    keywords: 'phone system voip',
  },
  {
    href: '/vs/aircall',
    label: 'VS Aircall',
    note: 'The power dialer is not on the basic plan',
    added: '2026-07-19',
    keywords: 'phone system voip',
  },
  {
    href: '/vs/dialpad',
    label: 'VS Dialpad',
    note: 'The dialer is a separate product',
    added: '2026-07-19',
    keywords: 'phone system voip',
  },
  {
    href: '/vs/ringcentral',
    label: 'VS RingCentral',
    note: 'A dialer, not a phone system',
    added: '2026-08-07',
    keywords: 'phone system voip ringcx',
  },
  {
    href: '/vs/smrtphone',
    label: 'VS smrtPhone',
    note: 'One weekly number, not three charges',
    added: '2026-08-07',
    keywords: 'real estate investor podio',
  },
  {
    href: '/vs/aloware',
    label: 'VS Aloware',
    note: 'Where the dialing actually lives',
    added: '2026-08-07',
    keywords: 'sales crm hubspot pipedrive',
  },
  {
    href: '/vs/ytel',
    label: 'VS Ytel',
    note: 'No platform fee stacked on top of seats',
    added: '2026-08-07',
    keywords: 'call center api',
  },
  {
    href: '/vs/3cx',
    label: 'VS 3CX',
    note: 'Sales dialer vs business phone system',
    added: '2026-07-15',
    keywords: 'phone system pbx voip',
  },
  {
    href: '/vs/teams',
    label: 'Dialer pricing for teams',
    note: 'What five agents actually cost, across every tool',
    added: '2026-08-06',
    keywords: 'team seats floor agency manager five',
  },
]

/** The names people arrive already typing. */
const TOP_PICKS: HubItem[] = [
  { href: '/vs/readymode', label: 'VS ReadyMode' },
  { href: '/vs/mojo', label: 'VS Mojo Dialer' },
  { href: '/vs/phoneburner', label: 'VS PhoneBurner' },
  { href: '/vs/batchdialer', label: 'VS BatchDialer' },
  { href: '/vs/five9', label: 'VS Five9' },
  { href: '/vs/convoso', label: 'VS Convoso' },
  { href: '/vs/vicidial', label: 'VS VICIdial' },
  { href: '/vs/kixie', label: 'VS Kixie' },
  { href: '/vs/justcall', label: 'VS JustCall' },
  { href: '/vs/ringcentral', label: 'VS RingCentral' },
  { href: '/vs/aircall', label: 'VS Aircall' },
  { href: '/vs/dialpad', label: 'VS Dialpad' },
  { href: '/vs/cloudtalk', label: 'VS CloudTalk' },
  { href: '/vs/calltools', label: 'VS CallTools' },
]

/**
 * The left column.
 *
 * NOT the list of every /vs page — that is the middle column's job, and
 * printing it twice made the old sidebar the tallest thing on the page. These
 * are the routes somebody lands here and then wants instead.
 */
const NAV: HubItem[] = [
  { href: '/?view=landing', label: 'Home' },
  { href: '/?view=landing#pricing', label: 'Pricing' },
  { href: '/dialing-modes', label: 'Dialing modes' },
  { href: '/faq', label: 'Frequently asked questions' },
  { href: '/vs/teams', label: 'Team pricing, compared' },
  { href: '/faq/why-dialerseat', label: 'Why DialerSeat?' },
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
          .vshub-panel {
            background: ${SITE.surface};
            border: 1px solid ${SITE.border};
            border-top: 3px solid #2a6eff;
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
          requestHref="mailto:support@dialerseat.com?subject=Comparison%20request"
          navTitle="Home"
          navDivider="ELSEWHERE ON THE SITE"
          navItems={NAV}
          allTitle="All Comparisons"
          allItems={COMPARISONS}
          allCta="Browse all comparisons"
          recentTitle="Recently Added"
          recentCta="View all recently added"
        />

        <div className="vshub-band">
          <div className="vshub-panel">
            <div className="vshub-eyebrow">▸ FOR TEAMS &amp; AGENCIES</div>
            <h2>Manager+ adds whitelabel for $75/week, flat.</h2>
            <p>
              Running more than one seat, or managing dialing for other people&apos;s teams?
              Manager+ is a flat $75/week upgrade that puts your brand on the platform — same
              rate whether you&apos;re managing 2 seats or 200. None of the dialers on this page
              offer true whitelabel; the closest most get is a referral or reseller program that
              keeps their name on the product.
            </p>
            <p>
              <Link href="/vs/teams">See what five agents cost on every tool →</Link>
            </p>
          </div>

          <section className="vshub-cta">
            <div className="vshub-cta-eyebrow">▸ SKIP THE COMPARISON</div>
            <h2>Skip the comparison. Just try it.</h2>
            <p>
              $35/seat/week. Cancel anytime. Every feature included. No setup fee, no contract,
              no demos. The fastest way to know if DialerSeat™ beats whatever you&apos;re using
              now is to actually use it.
            </p>
            <div className="vshub-cta-row">
              <Link
                href={showSignedIn ? '/dashboard/analytics' : '/sign-up'}
                className="vshub-btn primary"
              >
                {showSignedIn ? 'GO TO DASHBOARD →' : 'GET STARTED →'}
              </Link>
              <Link href="/vs/everyone" className="vshub-btn secondary">
                THE FULL BREAKDOWN
              </Link>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
