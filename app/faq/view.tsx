'use client'

import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import DirectoryHub, { type HubItem } from '@/components/DirectoryHub'
import { SITE } from '@/lib/siteTheme'
import { inter } from '@/lib/fonts'

// =============================================================================
// /faq — the answers index
// =============================================================================
// Same rebuild as /vs, and for the same reason: eighteen pill-tagged cards in a
// grid, then seventeen accordions underneath, with no way to search either. A
// visitor who came for "how do I upload leads" had to read the whole grid.
//
// It is now the directory template — top picks, live search, full index — with
// the accordion kept below it. The accordion is not redundant with the index:
// the index links to pages, the accordion answers the questions that never
// needed a page of their own.
//
// The layout lives in components/DirectoryHub.tsx, shared with /vs.
//
// `added` is the date each page's first commit landed, read out of git rather
// than estimated, because it drives the Recently Added column.
// =============================================================================

/** The hub runs on Inter, not the site's never-loaded Futura. See lib/fonts.ts. */
const HUB_FONT = inter.style.fontFamily

/** Every published /faq page, most-asked first. */
const ANSWERS: HubItem[] = [
  {
    href: '/faq/why-dialerseat',
    label: 'Why DialerSeat?',
    note: 'The thesis, the team, and the honest comparison',
    added: '2026-05-29',
    keywords: 'about story founder',
  },
  {
    href: '/faq/why-we-charge',
    label: 'Why we charge what we charge',
    note: '$35/week, and what the incumbents stack on top',
    added: '2026-06-11',
    keywords: 'pricing price cost cheap',
  },
  {
    href: '/faq/billing',
    label: 'Billing & cancellation',
    note: 'Failed cards, mid-week seat changes, what cancel does',
    added: '2026-07-20',
    keywords: 'pricing stripe subscription cancel',
  },
  {
    href: '/faq/dialer-modes',
    label: 'Dialer modes (TL;DR)',
    note: 'Preview, power, progressive, predictive: in one page',
    added: '2026-06-25',
    keywords: 'modes comparison summary',
  },
  {
    href: '/faq/what-is-a-preview-dialer',
    label: 'What is a preview dialer?',
    note: 'How it works, where it came from, when to use it',
    added: '2026-05-29',
    keywords: 'modes',
  },
  {
    href: '/faq/what-is-a-power-dialer',
    label: 'What is a power dialer?',
    note: 'History, mechanics, and the click-to-dial era',
    added: '2026-05-29',
    keywords: 'modes',
  },
  {
    href: '/faq/what-is-a-progressive-dialer',
    label: 'What is a progressive dialer?',
    note: 'The middle ground between power and predictive',
    added: '2026-05-29',
    keywords: 'modes',
  },
  {
    href: '/faq/what-is-a-predictive-dialer',
    label: 'What is a predictive dialer?',
    note: 'The 1980s algorithm that built modern call centers',
    added: '2026-05-29',
    keywords: 'modes multi line',
  },
  {
    href: '/faq/how-does-amd-work',
    label: 'How does AMD work?',
    note: 'Answering machine detection, explained',
    added: '2026-05-29',
    keywords: 'voicemail machine detection',
  },
  {
    href: '/faq/why-is-compliance-important',
    label: 'Why is compliance important?',
    note: 'And why legacy dialers do not seem to care',
    added: '2026-05-29',
    keywords: 'tcpa legal fines',
  },
  {
    href: '/faq/how-we-keep-compliance',
    label: 'How we keep compliance',
    note: 'What the software enforces, and what stays on you',
    added: '2026-05-29',
    keywords: 'tcpa tsr abandon rate dnc',
  },
  {
    href: '/faq/calling-hours',
    label: 'Telemarketing calling hours by state',
    note: 'The windows DialerSeat enforces per lead',
    added: '2026-08-07',
    keywords: 'tcpa compliance time zone curfew',
  },
  {
    href: '/faq/compliance-export',
    label: 'Compliance export',
    note: 'Proving it, not just claiming it',
    added: '2026-07-20',
    keywords: 'tcpa csv audit record',
  },
  {
    href: '/faq/10dlc-and-outbound-calling',
    label: 'Do I need 10DLC registration?',
    note: 'What 10DLC covers, and what it does not',
    added: '2026-08-07',
    keywords: 'compliance sms registration',
  },
  {
    href: '/faq/numbers',
    label: 'Phone numbers & caller ID',
    note: 'Attestation, CNAM, and avoiding Spam Likely',
    added: '2026-07-18',
    keywords: 'stir shaken local presence flagged',
  },
  {
    href: '/faq/how-many-numbers-do-i-need',
    label: 'How many numbers do I need?',
    note: 'What a dialing floor actually burns through',
    added: '2026-08-07',
    keywords: 'numbers pool rotation',
  },
  {
    href: '/faq/leads',
    label: 'Uploading & managing leads',
    note: 'CSV format, fields, and the retry cycle',
    added: '2026-07-18',
    keywords: 'import spreadsheet list data',
  },
  {
    href: '/faq/campaigns',
    label: 'Setting up a campaign',
    note: 'Mode, AMD, and predictive pacing',
    added: '2026-07-20',
    keywords: 'settings dialing',
  },
  {
    href: '/faq/scripts',
    label: 'Call scripts',
    note: 'Write them, attach them, reorder them',
    added: '2026-07-20',
    keywords: 'pitch talk track',
  },
  {
    href: '/faq/dialerseat-teams',
    label: 'DialerSeat for teams',
    note: 'Sell seats into your premium lead campaigns',
    added: '2026-06-10',
    keywords: 'team agency seats',
  },
  {
    href: '/faq/teams-how-it-works',
    label: 'How teams actually work',
    note: 'Seats, lead distribution, and who gets billed',
    added: '2026-08-06',
    keywords: 'team owner agent billing',
  },
  {
    href: '/faq/managers',
    label: 'For managers',
    note: 'Agency owners and lead vendors',
    added: '2026-05-30',
    keywords: 'team agency reseller',
  },
  {
    href: '/faq/manager-plus',
    label: 'What Manager+ adds over Pro',
    note: 'Team ownership and white-label, at $75/week',
    added: '2026-07-18',
    keywords: 'pricing tier upgrade whitelabel',
  },
  {
    href: '/faq/white-label',
    label: 'White-label your dialer',
    note: 'Your brand, your subdomain, our infrastructure',
    added: '2026-05-30',
    keywords: 'whitelabel branding reseller manager plus',
  },
  {
    href: '/faq/white-label-mobile',
    label: 'White-label on mobile',
    note: 'How the branded PWA installs',
    added: '2026-07-18',
    keywords: 'whitelabel branding app phone',
  },
  {
    href: '/faq/mobile',
    label: 'DialerSeat on mobile',
    note: 'Installing the PWA on iPhone and Android',
    added: '2026-07-18',
    keywords: 'app phone tablet ios android pwa',
  },
  {
    href: '/faq/dialer-for-offshore-agents',
    label: 'Dialer for offshore & remote agents',
    note: 'VAs, Philippines teams, and what they need',
    added: '2026-08-06',
    keywords: 'team remote virtual assistant',
  },
  {
    href: '/faq/data-and-recordings',
    label: 'Recordings & your data',
    note: 'Export, deletion, and retention windows',
    added: '2026-07-20',
    keywords: 'privacy storage delete account',
  },
]

/** The questions people arrive already asking. */
const TOP_PICKS: HubItem[] = [
  { href: '/faq/what-is-a-preview-dialer', label: 'Preview dialer' },
  { href: '/faq/what-is-a-power-dialer', label: 'Power dialer' },
  { href: '/faq/what-is-a-progressive-dialer', label: 'Progressive dialer' },
  { href: '/faq/what-is-a-predictive-dialer', label: 'Predictive dialer' },
  { href: '/faq/how-does-amd-work', label: 'AMD' },
  { href: '/faq/why-we-charge', label: 'Pricing' },
  { href: '/faq/billing', label: 'Billing' },
  { href: '/faq/how-we-keep-compliance', label: 'Compliance' },
  { href: '/faq/numbers', label: 'Numbers' },
  { href: '/faq/leads', label: 'Leads' },
  { href: '/faq/campaigns', label: 'Campaigns' },
  { href: '/faq/scripts', label: 'Scripts' },
  { href: '/faq/dialerseat-teams', label: 'Teams' },
  { href: '/faq/manager-plus', label: 'Manager+' },
]

/** The left column — where someone goes next, not a second copy of the index. */
const NAV: HubItem[] = [
  { href: '/vs', label: 'VS' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy policy' },
]

export default function FaqView() {
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
          .faqx-band {
            max-width: 1180px;
            margin: 0 auto;
            padding: 0 32px 88px;
          }

          /* ── COMMON QUESTIONS ─────────────────────────────────────────
             Same card shell as the directory columns above it, so the
             accordion reads as one more panel rather than a new page. */
          .faqx-card {
            background: ${SITE.surface};
            border: 1px solid ${SITE.border};
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 18px;
          }
          .faqx-head {
            display: flex; align-items: center; gap: 13px;
            padding: 18px 20px;
            border-bottom: 1px solid ${SITE.borderSoft};
          }
          .faqx-badge {
            flex-shrink: 0;
            width: 34px; height: 34px;
            display: grid; place-items: center;
            border-radius: 9px;
            background: #2a6eff; color: #fff;
          }
          .faqx-head h2 {
            margin: 0;
            font-size: 17px; font-weight: 800; letter-spacing: -0.2px;
            color: ${SITE.text};
          }
          .faqx-ask {
            margin-left: auto;
            font-size: 13px; color: ${SITE.muted};
          }
          .faqx-ask a { color: #2a6eff; font-weight: 600; text-decoration: none; }
          .faqx-ask a:hover { text-decoration: underline; text-underline-offset: 3px; }

          .faqx-card details { border-bottom: 1px solid #f0f2f6; }
          .faqx-card details:last-of-type { border-bottom: none; }
          .faqx-card summary {
            display: flex; align-items: center; justify-content: space-between;
            gap: 16px;
            padding: 17px 20px;
            font-size: 15.5px; font-weight: 700;
            color: ${SITE.text};
            cursor: pointer;
            list-style: none;
            transition: background 0.14s ease;
          }
          .faqx-card summary::-webkit-details-marker { display: none; }
          .faqx-card summary:hover { background: #f4f8ff; }
          .faqx-card summary::after {
            content: '+';
            flex-shrink: 0;
            color: #2a6eff;
            font-size: 22px; font-weight: bold; line-height: 1;
          }
          .faqx-card details[open] summary { color: #2a6eff; }
          .faqx-card details[open] summary::after { content: '−'; }
          .faqx-answer {
            padding: 0 20px 20px;
            font-size: 14.5px; line-height: 1.75;
            color: ${SITE.muted};
          }
          .faqx-answer p { margin: 0 0 12px 0; }
          .faqx-answer p:last-child { margin-bottom: 0; }
          .faqx-answer a { color: #2a6eff; font-weight: 600; text-decoration: none; }
          .faqx-answer a:hover { text-decoration: underline; text-underline-offset: 3px; }
          .faqx-answer code {
            background: ${SITE.bg};
            border: 1px solid ${SITE.borderSoft};
            border-radius: 4px;
            padding: 1px 6px;
            font-size: 13px;
          }
          .faqx-answer strong { color: ${SITE.text}; }

          /* ── CTA ── */
          .faqx-cta {
            background: ${SITE.ink};
            border-radius: 12px;
            padding: 56px 40px;
            text-align: center;
          }
          .faqx-cta-eyebrow {
            font-size: 10px; font-weight: bold; letter-spacing: 3px;
            color: rgba(255,255,255,0.5);
            margin-bottom: 14px;
          }
          .faqx-cta h2 {
            margin: 0 0 14px 0;
            font-size: 38px; font-weight: 800; letter-spacing: -1px;
            line-height: 1.12;
            color: #fff;
          }
          .faqx-cta p {
            margin: 0 auto 28px;
            max-width: 540px;
            font-size: 16px; line-height: 1.65;
            color: rgba(255,255,255,0.66);
          }
          .faqx-cta-row {
            display: flex; align-items: center; justify-content: center;
            gap: 14px; flex-wrap: wrap;
          }
          .faqx-btn {
            display: inline-block;
            padding: 15px 30px;
            border-radius: 6px;
            font-size: 12px; font-weight: bold; letter-spacing: 3px;
            text-decoration: none;
          }
          .faqx-btn.primary {
            background: #fff; color: ${SITE.text};
            border-top: 3px solid #2a6eff;
          }
          .faqx-btn.secondary {
            background: transparent; color: #fff;
            border: 1px solid rgba(255,255,255,0.28);
            border-top: 3px solid rgba(255,255,255,0.75);
          }

          @media (max-width: 760px) {
            .faqx-band { padding: 0 20px 64px; }
            .faqx-head { flex-wrap: wrap; }
            .faqx-ask { margin-left: 0; flex-basis: 100%; }
            .faqx-card summary { font-size: 14.5px; padding: 15px 18px; }
            .faqx-answer { padding: 0 18px 18px; }
            .faqx-cta { padding: 40px 22px; }
            .faqx-cta h2 { font-size: 28px; }
            .faqx-btn { display: block; width: 100%; text-align: center; }
          }
        `}</style>

        <DirectoryHub
          headlineTop="Pick your question."
          headlineBottom="We'll give you a straight answer."
          leadHref="/faq/why-dialerseat"
          leadLabel="Start with why we built this"
          picksLabel="TOP PICKS"
          picks={TOP_PICKS}
          searchPlaceholder="Search answers..."
          searchNoun="answers"
          requestTitle="Can't find yours?"
          requestLabel="Ask us directly"
          requestPrompt="Ask anything we have not answered here, or tell us what a page got wrong. A real person reads these."
          navTitle="FAQ"
          navDivider="ELSEWHERE ON THE SITE"
          navItems={NAV}
          allTitle="All Answers"
          allItems={ANSWERS}
          allCta="Browse all answers"
          recentTitle="Recently Added"
        />

        <div className="faqx-band">

          {/* ── COMMON QUESTIONS ── */}
          <div className="faqx-card">
            <div className="faqx-head">
              <span className="faqx-badge">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20.4 14.4a2.2 2.2 0 0 1-2.2 2.2H7.8L3.6 20.4V5.6a2.2 2.2 0 0 1 2.2-2.2h12.4a2.2 2.2 0 0 1 2.2 2.2z" />
                </svg>
              </span>
              <h2>Common questions</h2>
              <span className="faqx-ask">
                Not listed? <a href="mailto:support@dialerseat.com">Email support</a>
              </span>
            </div>

            <details>
              <summary>How much does DialerSeat cost?</summary>
              <div className="faqx-answer">
                <p>
                  $35 per week per seat on Pro. That&apos;s the entire price for a dialing
                  agent. No setup fee, no per-call surcharge, no tier upcharges, no add-on
                  modules, no annual minimum, no &quot;contact sales for pricing.&quot;
                  Billing is weekly through Stripe.
                </p>
                <p>
                  Every seat includes unlimited dial-out numbers, multiple inbound numbers,
                  all four dialer modes, call recording, voicemail detection, and analytics 
                  no metered minutes, no per-number fees. See{' '}
                  <Link href="/faq/why-we-charge">why we charge what we charge</Link> for
                  the full breakdown vs. competitors who stack add-ons.
                </p>
                <p>
                  Want to own a team, resell seats, or white-label the whole platform?
                  That&apos;s <strong>Manager+</strong> at $75/week instead of the standard
                  $35, see <Link href="/faq/manager-plus">what Manager+ adds</Link> for
                  the full breakdown.
                </p>
              </div>
            </details>

            <details>
              <summary>Do I have to sign a contract?</summary>
              <div className="faqx-answer">
                <p>
                  No. There&apos;s no contract and no minimum term. You pay for the current
                  week of service and cancel whenever you want. We don&apos;t lock anyone
                  into anything.
                </p>
              </div>
            </details>

            <details>
              <summary>Can I cancel anytime?</summary>
              <div className="faqx-answer">
                <p>
                  Yes. Cancel from your billing page in two clicks. Your subscription ends
                  at the close of the current weekly cycle, you keep access through what
                  you&apos;ve paid for, then it stops billing. Your leads, recordings, and
                  campaigns remain accessible if you want to come back.
                </p>
                <p>
                  See <Link href="/faq/billing">billing &amp; cancellation</Link> for what
                  a failed card actually does and how mid-week seat changes are billed.
                </p>
              </div>
            </details>

            <details>
              <summary>Which dialing modes do you support?</summary>
              <div className="faqx-answer">
                <p>
                  All four: preview, power, progressive, and predictive. Each is available
                  on every account at every tier, we don&apos;t gate dialing modes behind
                  upgrades. Full breakdown on the{' '}
                  <Link href="/dialing-modes">dialing modes page</Link>.
                </p>
              </div>
            </details>

            <details>
              <summary>How do I upload leads?</summary>
              <div className="faqx-answer">
                <p>
                  Drop in a spreadsheet, there&apos;s no template to match or import wizard
                  to click through. Column headers like <code>phone</code>,{' '}
                  <code>first_name</code>, <code>email</code>, and <code>state</code> get
                  auto-detected regardless of exact capitalization, and the only hard
                  requirement is a column with something that has at least 10 digits in it
                  once you strip out formatting.
                </p>
                <p>
                  See <Link href="/faq/leads">uploading &amp; managing leads</Link> for the
                  full field reference, optional consent columns, and how the 3-attempt retry
                  cycle works once leads are in a campaign.
                </p>
              </div>
            </details>

            <details>
              <summary>Can I write my own call scripts?</summary>
              <div className="faqx-answer">
                <p>
                  Yes: write as many as you want, attach them to whichever campaigns need
                  them, and reorder which one shows first if a campaign has several. Personal
                  scripts are yours alone; a Manager+ team owner can also publish a script
                  the whole team sees.
                </p>
                <p>
                  See <Link href="/faq/scripts">call scripts</Link> for how attaching and
                  reordering actually works.
                </p>
              </div>
            </details>

            <details>
              <summary>How do I set up a campaign?</summary>
              <div className="faqx-answer">
                <p>
                  Create it, name it or don&apos;t, pick a dialer mode (defaults to power),
                  and it&apos;s active immediately: no setup wizard, no required fields
                  beyond that. AMD and predictive pacing are both optional settings with
                  sane defaults.
                </p>
                <p>
                  See <Link href="/faq/campaigns">setting up a campaign</Link> for the
                  complete settings reference.
                </p>
              </div>
            </details>

            <details>
              <summary>How does DialerSeat handle TCPA compliance?</summary>
              <div className="faqx-answer">
                <p>
                  The dialer enforces the federal calling-time window (8 AM-9 PM in the
                  lead&apos;s local time zone) on every outbound call. Predictive mode
                  applies the FTC TSR safe-harbor conditions in software, 3% abandon-rate
                  cap, auto-degrade at 2.5% to leave a safety buffer, AMD pre-screen,
                  ring-duration handling.
                </p>
                <p>
                  National DNC list scrubbing and consent records remain the seller&apos;s
                  responsibility, we don&apos;t scrub your list against the registry for
                  you today. We&apos;re transparent about which compliance layers we own and
                  which fall on the campaign owner on the{' '}
                  <Link href="/faq/how-we-keep-compliance">how we keep compliance page</Link>.
                </p>
              </div>
            </details>

            <details>
              <summary>How do you keep numbers from getting flagged as spam?</summary>
              <div className="faqx-answer">
                <p>
                  Every outbound number carries STIR/SHAKEN A-attestation, is registered
                  for CNAM and the Free Caller Registry, and dials with local presence by
                  default, the carrier-level protections that most dialers sell as separate
                  add-ons are just the default here. The number pool also rotates and cools
                  down instead of hammering one number until it burns.
                </p>
                <p>
                  See <Link href="/faq/numbers">phone numbers &amp; caller ID</Link> for the
                  full breakdown: including what&apos;s still on you (list quality, abandon
                  rate, DNC scrubbing) since no infrastructure makes a number permanently
                  immune to flagging.
                </p>
              </div>
            </details>

            <details>
              <summary>Can I export a compliance record for a campaign?</summary>
              <div className="faqx-answer">
                <p>
                  Yes, any campaign owner can pull a downloadable CSV for any date range:
                  AMD result, abandon flag, disposition, and duration, one row per call,
                  with the lead&apos;s phone number masked by default. It&apos;s the actual
                  receipt behind the compliance claims, not just a dashboard summary.
                </p>
                <p>
                  See <Link href="/faq/compliance-export">compliance export</Link> for the
                  full column reference and when people actually pull one.
                </p>
              </div>
            </details>

            <details>
              <summary>Can I record calls?</summary>
              <div className="faqx-answer">
                <p>
                  Yes. Recordings are captured server-side, stored encrypted, and accessible
                  from your dashboard for 30 days. Pull them down for review, training, or
                  your own long-term archive during that window, call metadata (dial
                  timestamps, dispositions, AMD results) is kept separately for 24 months to
                  meet the TSR&apos;s record-keeping floor, but the audio itself follows the
                  30-day retention window.
                </p>
              </div>
            </details>

            <details>
              <summary>Do you have a team plan?</summary>
              <div className="faqx-answer">
                <p>
                  Yes: <strong>Manager+</strong>, at $75/week. It&apos;s what the team
                  owner pays to create and own a team; each individual seat inside the team
                  still runs $35/week, regardless of team size. You can configure it so the
                  owner pays for the whole team&apos;s seats, or so individual agents pay
                  for their own access. Both flows are supported.
                </p>
                <p>
                  See <Link href="/faq/dialerseat-teams">DialerSeat for teams</Link> for the
                  full breakdown: owner-paid vs. agent-paid mechanics, shared campaigns,
                  team-mode predictive routing, and how seat cancellations work.
                </p>
              </div>
            </details>

            <details>
              <summary>Can my team share campaigns?</summary>
              <div className="faqx-answer">
                <p>
                  Yes. Team owners can grant campaign access to team members. In team-mode
                  predictive dialing, the system routes connected humans across all agents
                  working the same campaign: when an agent disconnects, the routed human
                  reroutes to another available agent on the same campaign rather than
                  dropping.
                </p>
              </div>
            </details>

            <details>
              <summary>Do you offer a white-label option?</summary>
              <div className="faqx-answer">
                <p>
                  Yes: it&apos;s bundled into <strong>Manager+</strong> at $75/week,
                  replacing your $35/week Pro subscription rather than stacking on top of
                  it. Includes a custom subdomain, your branding (logo, colors, favicon),
                  and the ability to onboard your own users under your brand. The underlying
                  dialer is the same one we run. See{' '}
                  <Link href="/faq/white-label">white-label</Link> for the branding details,
                  or <Link href="/faq/manager-plus">the Manager+ breakdown</Link> for the
                  full tier: team ownership, advanced analytics, and priority support
                  included.
                </p>
              </div>
            </details>

            <details>
              <summary>Is there a mobile app?</summary>
              <div className="faqx-answer">
                <p>
                  Yes, DialerSeat installs to your phone&apos;s home screen as a
                  Progressive Web App (PWA): the same dialer terminal, analytics, and teams
                  tools as desktop, full-screen, with no App Store download required. We
                  strongly recommend installing it rather than dialing from a regular browser
                  tab if you&apos;re working from your phone at all. See{' '}
                  <Link href="/faq/mobile">DialerSeat on mobile</Link> for install steps on
                  iPhone and Android, or{' '}
                  <Link href="/faq/white-label-mobile">white-label on mobile</Link> if your
                  account is branded.
                </p>
              </div>
            </details>

            <details>
              <summary>Where is my data hosted?</summary>
              <div className="faqx-answer">
                <p>
                  Application data sits on Supabase (US region). Recordings are stored
                  encrypted. Payments are handled by Stripe, DialerSeat never sees or
                  stores credit card numbers. Telephony runs through Telnyx with full
                  STIR/SHAKEN attestation.
                </p>
                <p>
                  You can export everything in your account as a single JSON file, or
                  permanently delete your account, both self-serve from settings. See{' '}
                  <Link href="/faq/data-and-recordings">recordings &amp; your data</Link>{' '}
                  for exactly what&apos;s included in each and how deletion is protected
                  against accidental use.
                </p>
              </div>
            </details>

            <details>
              <summary>Will the $35/week price change?</summary>
              <div className="faqx-answer">
                <p>
                  We have no plans to raise it. If we ever needed to, existing customers
                  would be grandfathered at the rate they signed up at. The price
                  you&apos;re looking at today is the price you&apos;ll keep paying.
                </p>
              </div>
            </details>
          </div>

          {/* ── CTA ── */}
          <section className="faqx-cta">
            <div className="faqx-cta-eyebrow">
              {showSignedIn ? '▸ READY TO DIAL' : '▸ STILL HAVE QUESTIONS?'}
            </div>
            {showSignedIn ? (
              <>
                <h2>Hop back in.</h2>
                <p>The terminal&apos;s waiting.</p>
                <div className="faqx-cta-row">
                  <Link href="/dashboard/analytics" className="faqx-btn primary">
                    GO TO DASHBOARD →
                  </Link>
                  <Link href="/dialing-modes" className="faqx-btn secondary">
                    DIALING MODES
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2>The best way to find out is to use it.</h2>
                <p>$35 for a week. No contract. Cancel any time. Your data stays yours.</p>
                <div className="faqx-cta-row">
                  <Link href="/sign-up" className="faqx-btn primary">
                    GET STARTED →
                  </Link>
                  <Link href="/faq/why-dialerseat" className="faqx-btn secondary">
                    WHY DIALERSEAT?
                  </Link>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
