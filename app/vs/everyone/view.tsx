'use client'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { useState } from 'react'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import SuggestionModal from '@/components/SuggestionModal'
import { SITE } from '@/lib/siteTheme'
import { inter } from '@/lib/fonts'

// =============================================================================
// /vs/everyone — the industry-wide breakdown
// =============================================================================
// Rebuilt to the directory shell: a dark navigation rail on the left and one
// white article card on the right, its sections divided by hairlines and each
// led by a round icon.
//
// The text inside every section is CENTERED. That is the one deliberate
// departure from the reference, and it changes what the page is: left-aligned
// sections beside an icon read as documentation you work through, and this
// reads as an argument you take in top to bottom — which is what a comparison
// page is for.
//
// The content is unchanged. Same six failures, same feature table, same team
// scaling table, same head-to-heads. Only the shell around them is new.
// =============================================================================

const T = {
  bg: SITE.bg,
  surface: SITE.surface,
  surface2: SITE.borderSoft,
  border: SITE.border,
  text: SITE.text,
  muted: SITE.muted,
  accent: SITE.deep,
  blue: SITE.blue,
  royal: '#2a6eff',
  green: SITE.green,
  red: SITE.red,
  amber: SITE.amber,
  /** The navigation rail. Dark, so the article beside it reads as the page. */
  rail: '#0d1830',
  railLine: 'rgba(255,255,255,0.10)',
  railMuted: 'rgba(255,255,255,0.52)',
}

const HUB_FONT = inter.style.fontFamily

type Cell = true | false | string

interface FeatureRow {
  feature: string
  ds: Cell
  rm: Cell // ReadyMode
  mo: Cell // Mojo
  pb: Cell // PhoneBurner
  f9: Cell // Five9
  cv: Cell // Convoso
}

const features: FeatureRow[] = [
  { feature: 'Per-seat price', ds: '$35/wk, cancel anytime', rm: '$199-$249/mo', mo: '$149/mo + add-ons', pb: '$165-$215/mo', f9: '$175+/mo', cv: '$90+/mo, custom quote' },
  { feature: 'Weekly billing option', ds: true, rm: false, mo: false, pb: false, f9: false, cv: false },
  { feature: 'Annual contract required', ds: false, rm: 'Typical', mo: false, pb: 'For best price', f9: 'Typical', cv: 'Typical' },
  { feature: 'Public pricing on website', ds: true, rm: false, mo: true, pb: true, f9: false, cv: false },
  { feature: 'Self-serve signup (no demo)', ds: true, rm: false, mo: true, pb: true, f9: false, cv: false },
  { feature: 'Setup fee', ds: '$0', rm: '$500-$2K', mo: '$0', pb: '$0', f9: 'Variable', cv: 'Variable' },
  { feature: 'Power dialer', ds: true, rm: true, mo: true, pb: true, f9: true, cv: true },
  { feature: 'Preview dialer', ds: true, rm: true, mo: true, pb: false, f9: true, cv: true },
  { feature: 'Progressive dialer', ds: true, rm: true, mo: 'Partial', pb: false, f9: true, cv: true },
  { feature: 'Predictive dialer (multi-line)', ds: true, rm: true, mo: 'Triple-line only', pb: false, f9: true, cv: true },
  { feature: 'Per-campaign dialer mode', ds: true, rm: false, mo: false, pb: false, f9: false, cv: false },
  { feature: 'AMD voicemail filter (~1.8s)', ds: 'Always on', rm: 'Users report misses', mo: 'Optional', pb: true, f9: true, cv: true },
  { feature: 'Multiple scripts per campaign', ds: true, rm: false, mo: false, pb: false, f9: 'Custom build', cv: false },
  { feature: 'Live mid-call script switching', ds: true, rm: false, mo: false, pb: false, f9: false, cv: false },
  { feature: 'Works on phones + tablets', ds: 'Full dialer, same as desktop', rm: false, mo: 'Native app, poor reviews', pb: false, f9: 'Supervisor app only', cv: 'No app found; iOS issues reported' },
  { feature: 'All outbound numbers carrier-registered', ds: true, rm: 'Inconsistent', mo: 'Inconsistent', pb: 'Variable', f9: 'Variable', cv: 'Variable' },
  { feature: 'STIR/SHAKEN A-attestation', ds: true, rm: 'Variable', mo: 'Variable', pb: true, f9: true, cv: 'Variable' },
  { feature: 'TCPA enforced server-side', ds: true, rm: 'Partial', mo: 'Partial', pb: 'Partial', f9: 'Partial', cv: 'Partial' },
  { feature: 'Local presence dialing', ds: true, rm: true, mo: true, pb: true, f9: true, cv: true },
  { feature: 'Public API + webhooks (works with any CRM)', ds: true, rm: false, mo: false, pb: true, f9: true, cv: 'Limited' },
  { feature: 'Calendar-aligned analytics (Sun/1st)', ds: true, rm: false, mo: false, pb: false, f9: false, cv: false },
  { feature: 'Lapsed-user data preservation', ds: true, rm: false, mo: false, pb: false, f9: false, cv: false },
]

const INDUSTRY_FAILURES = [
  {
    num: '01',
    title: 'OPAQUE PRICING',
    body: 'Five9, Convoso, ReadyMode, and most enterprise dialers hide their real pricing behind a sales call. You spend a week scheduling and sitting through demos before anyone gives you a number. We publish $35/week on the homepage.',
  },
  {
    num: '02',
    title: 'ANNUAL CONTRACT LOCK-IN',
    body: 'The industry standard for "best pricing" is a 12-month commitment with auto-renewal and 60-day cancellation clauses. PhoneBurner, Five9, Convoso, ReadyMode all do this. We bill weekly with one-click cancellation.',
  },
  {
    num: '03',
    title: 'ADD-ON STACKING',
    body: 'The headline $149-$199 advertised price becomes $200-$300 effective once you add data feeds (Mojo $25-$49 per dataset), tier upgrades for basic features, or industry-specific add-ons. Our $35/week, cancel anytime, is the bill: nothing stacks on top, and it never becomes a monthly premium.',
  },
  {
    num: '04',
    title: 'DESKTOP-ONLY SOFTWARE',
    body: 'Most legacy dialers were built before tablets existed and never modernized. ReadyMode and PhoneBurner have no mobile app at all. Five9 publishes one, but it\'s for supervisors to monitor calls, not for agents to dial from. Field agents and solo reps need to be at their desk. We work on phone, tablet, and desktop, with the full dialer, install to home screen and it behaves like a native app.',
  },
  {
    num: '05',
    title: 'COMPLIANCE SHORTCUTS',
    body: 'Number registration is inconsistent at most competitors. TCPA enforcement is often partial rather than server-side per lead state. We register every outbound number with the carrier registry and enforce TCPA windows server-side. We respect the laws so you do not get blocked or fined.',
  },
  {
    num: '06',
    title: 'DATED INTERFACES',
    body: 'ReadyMode reviewers describe the UI as "Windows 8" or "dated." Mojo, PhoneBurner, and most enterprise tools accumulated UI debt over a decade. Rep retention suffers when the software feels old. DialerSeat ships with a modern design system: clean, fast, and built for the way teams actually work.',
  },
]

const SWITCHING_FROM = [
  { name: 'READYMODE', href: '/vs/readymode', summary: 'Same multi-line predictive at $35/week, cancel anytime, instead of $199-$249/month locked into a contract. No $500-$2,000 setup fee.' },
  { name: 'BATCHDIALER', href: '/vs/batchdialer', summary: "Their $95/seat headline is the annual prepay rate, month to month it's $119-$249. Automatic number replacement on every DialerSeat plan, not gated behind Pro." },
  { name: 'MOJO DIALER', href: '/vs/mojo', summary: 'Same triple-line speed across every industry, not just real estate. No mandatory $10/mo Agent Access fee stacked on top.' },
  { name: 'PHONEBURNER', href: '/vs/phoneburner', summary: 'Multi-line predictive included (PhoneBurner is single-line only). Weekly billing, no annual contract.' },
  { name: 'FIVE9', href: '/vs/five9', summary: 'Same compliance posture without the enterprise sales cycle. Self-serve setup in minutes, not weeks.' },
  { name: 'CONVOSO', href: '/vs/convoso', summary: 'Same high-volume outbound dialing for insurance, solar, and lead-heavy verticals. One flat weekly price, no seat minimum.' },
  { name: 'KIXIE', href: '/vs/kixie', summary: 'Same predictive and multi-line dialing without paying Kixie\'s $95+/seat/month multi-line tier.' },
  { name: 'JUSTCALL', href: '/vs/justcall', summary: 'Same power and predictive dialing without the Pro-tier upgrade, JustCall\'s $29/month plan doesn\'t include a dialer.' },
  { name: 'AIRCALL', href: '/vs/aircall', summary: 'Same self-serve outbound dialing without the Professional-tier upsell, Aircall gates its dialer behind a $50/seat/month tier.' },
]

const teamScaling: FeatureRow[] = [
  { feature: 'Whitelabel available', ds: 'Manager+, $75/mo flat', rm: false, mo: false, pb: false, f9: false, cv: false },
  { feature: 'Manager/supervisor seat', ds: 'Included in Manager+', rm: 'Admin seat can’t dial', mo: false, pb: 'Requires Professional tier', f9: 'Requires 50-seat Optimum quote', cv: 'Custom quote' },
  { feature: 'Live call monitoring / coaching', ds: true, rm: 'iQ tier only', mo: false, pb: 'Professional tier ($195+/seat)', f9: 'Optimum tier, custom quote', cv: true },
  { feature: 'Price change as team grows', ds: 'None: flat $35/wk per seat', rm: '+$50/seat at 5th license', mo: 'None: but no team plan exists', pb: '+$30-$50/seat per tier', f9: '50-seat minimum on every plan', cv: '~20-seat minimum before you can meaningfully start' },
]

/** The rail's middle block. Real published routes only. */
const OTHER_VS = [
  { label: 'DialerSeat vs ReadyMode', href: '/vs/readymode' },
  { label: 'DialerSeat vs Mojo Dialer', href: '/vs/mojo' },
  { label: 'DialerSeat vs PhoneBurner', href: '/vs/phoneburner' },
  { label: 'DialerSeat vs BatchDialer', href: '/vs/batchdialer' },
  { label: 'DialerSeat vs Five9', href: '/vs/five9' },
  { label: 'DialerSeat vs Convoso', href: '/vs/convoso' },
  { label: 'DialerSeat vs VICIdial', href: '/vs/vicidial' },
  { label: 'DialerSeat vs Kixie', href: '/vs/kixie' },
  { label: 'Dialer pricing for teams', href: '/vs/teams' },
  { label: 'All dialer comparisons', href: '/vs' },
]

const SITE_INFO = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Use', href: '/terms' },
  { label: 'Frequently Asked Questions', href: '/faq' },
  { label: 'Dialing Modes', href: '/dialing-modes' },
]

function StatusCell({ value }: { value: Cell }) {
  if (value === true) return <span style={{ color: T.green, fontSize: 18, fontWeight: 'bold' }}>✓</span>
  if (value === false) return <span style={{ color: T.red, fontSize: 18, fontWeight: 'bold' }}>✕</span>

  const lower = value.toLowerCase()
  let color: string = T.text
  if (lower.includes('add-on') || lower.includes('partial') || lower.includes('variable') || lower.includes('inconsistent') || lower.includes('limited') || lower.includes('only') || lower.includes('tier') || lower.includes('premium') || lower.includes('misses') || lower.includes('custom')) {
    color = T.amber
  }
  return <span style={{ color, fontSize: 11, fontStyle: lower.includes('add-on') || lower.includes('partial') ? 'italic' : 'normal', letterSpacing: 0.3 }}>{value}</span>
}

/* ── SECTION ICONS ─────────────────────────────────────────────────────── */

function IconVerdict() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.6v5" />
      <path d="M12 16.2h.01" />
    </svg>
  )
}
function IconWeek() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.6" y="5" width="16.8" height="15" rx="2.4" />
      <path d="M3.6 9.8h16.8M8.4 3.4v3.2M15.6 3.4v3.2" />
    </svg>
  )
}
function IconFailures() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.3 3.9 1.9 18.4a1.9 1.9 0 0 0 1.7 2.9h16.8a1.9 1.9 0 0 0 1.7-2.9L13.7 3.9a1.9 1.9 0 0 0-3.4 0z" />
      <path d="M12 9.4v4M12 17.2h.01" />
    </svg>
  )
}
function IconTable() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.4" y="4.4" width="17.2" height="15.2" rx="2.2" />
      <path d="M3.4 9.6h17.2M9.6 9.6v10" />
    </svg>
  )
}
function IconTeam() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8.4" r="3.3" />
      <path d="M2.8 19.6a6.2 6.2 0 0 1 12.4 0" />
      <path d="M16.4 5.6a3.3 3.3 0 0 1 0 5.7M17.6 14.2a6.2 6.2 0 0 1 3.6 5.4" />
    </svg>
  )
}
function IconSwitch() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.6 8.2h13.2l-3.4-3.4M20.4 15.8H7.2l3.4 3.4" />
    </svg>
  )
}
function IconAsk() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.4 14.4a2.2 2.2 0 0 1-2.2 2.2H7.8L3.6 20.4V5.6a2.2 2.2 0 0 1 2.2-2.2h12.4a2.2 2.2 0 0 1 2.2 2.2z" />
    </svg>
  )
}
function RailChevron() {
  return (
    <svg className="chev" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </svg>
  )
}

export default function VsEveryoneView() {
  const { isLoaded, isSignedIn } = useUser()
  const showSignedIn = isLoaded && isSignedIn
  const [askOpen, setAskOpen] = useState(false)

  return (
    <>
      <SiteHeader />
      <main
        style={{
          background: T.bg,
          minHeight: '100vh',
          fontFamily: HUB_FONT,
          color: T.text,
        }}
      >
        <style>{`
          .vse * { box-sizing: border-box; }
          .vse { max-width: 1220px; margin: 0 auto; padding: 34px 32px 80px; }

          .vse-grid {
            display: grid;
            grid-template-columns: 290px minmax(0, 1fr);
            gap: 20px;
            align-items: start;
          }

          /* ── THE RAIL ─────────────────────────────────────────────── */
          .vse-rail {
            background: ${T.rail};
            border-radius: 14px;
            padding: 22px 0 14px;
            position: sticky;
            top: 78px;
          }
          .vse-rail-label {
            padding: 0 20px;
            margin: 0 0 12px;
            font-size: 10px; font-weight: bold; letter-spacing: 2.6px;
            color: ${T.railMuted};
          }
          .vse-rail-group + .vse-rail-group {
            margin-top: 22px; padding-top: 20px;
            border-top: 1px solid ${T.railLine};
          }
          .vse-rail a {
            display: flex; align-items: center; gap: 11px;
            padding: 10px 20px;
            color: rgba(255,255,255,0.86);
            text-decoration: none;
            font-size: 14px;
          }
          .vse-rail a:hover { background: rgba(255,255,255,0.06); color: #fff; }
          .vse-rail a .chev { color: rgba(255,255,255,0.34); flex-shrink: 0; }
          .vse-rail a:hover .chev { color: ${T.blue}; }
          .vse-rail a.here {
            background: ${T.royal};
            color: #fff; font-weight: 700;
            margin: 0 12px; padding: 10px 14px; border-radius: 8px;
          }
          .vse-rail a.here .chev { color: rgba(255,255,255,0.75); }

          /* ── THE ARTICLE ──────────────────────────────────────────── */
          .vse-card {
            background: ${T.surface};
            border: 1px solid ${T.border};
            border-radius: 14px;
            overflow: hidden;
          }
          /* Every section is centered. That is the departure from the
             reference, and it is what turns a documentation page into an
             argument you read straight down. */
          .vse-sec {
            padding: 44px 48px;
            border-bottom: 1px solid ${T.surface2};
            text-align: center;
          }
          .vse-sec:last-child { border-bottom: none; }
          .vse-icon {
            width: 52px; height: 52px; margin: 0 auto 18px;
            display: grid; place-items: center;
            border-radius: 999px;
            background: ${T.royal}; color: #fff;
          }
          .vse-sec h2 {
            margin: 0 0 14px;
            font-size: 27px; font-weight: 800; letter-spacing: -0.6px;
            line-height: 1.2;
            color: ${T.text};
          }
          .vse-sec p {
            margin: 0 auto 14px;
            max-width: 660px;
            font-size: 15.5px; line-height: 1.75;
            color: ${T.muted};
          }
          .vse-sec p:last-child { margin-bottom: 0; }

          .vse-hero { padding: 52px 48px 44px; }
          .vse-hero .eyebrow {
            font-size: 10px; font-weight: bold; letter-spacing: 3px;
            color: ${T.accent};
            margin-bottom: 14px;
          }
          .vse-hero h1 {
            margin: 0 0 16px;
            font-size: 42px; font-weight: 800; letter-spacing: -1.4px;
            line-height: 1.08;
          }
          .vse-hero h1 .second { display: block; color: ${T.royal}; }
          .vse-hero .stamp { margin-top: 16px; font-size: 12px; color: ${T.muted}; }

          /* ── PRICE TILES ──────────────────────────────────────────── */
          .vse-tiles {
            display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px; max-width: 620px; margin: 22px auto 0;
            text-align: left;
          }
          .vse-tile {
            border: 1px solid ${T.border}; border-radius: 10px;
            background: ${T.bg}; padding: 20px 18px;
          }
          .vse-tile.ours { background: ${T.rail}; border-color: ${T.rail}; }
          .vse-tile-num { font-size: 30px; font-weight: 800; letter-spacing: -1.2px; line-height: 1; color: ${T.muted}; }
          .vse-tile.ours .vse-tile-num { color: ${T.blue}; }
          .vse-tile-label { margin-top: 8px; font-size: 10px; font-weight: bold; letter-spacing: 2px; color: ${T.muted}; }
          .vse-tile.ours .vse-tile-label { color: rgba(255,255,255,0.6); }
          .vse-tile-sub { margin-top: 7px; font-size: 12.5px; line-height: 1.5; color: ${T.muted}; }
          .vse-tile.ours .vse-tile-sub { color: rgba(255,255,255,0.6); }

          /* ── FAILURES ─────────────────────────────────────────────── */
          .vse-failures { display: grid; gap: 12px; margin-top: 24px; text-align: left; }
          .vse-failure {
            display: flex; gap: 16px;
            background: ${T.bg};
            border: 1px solid ${T.border};
            border-radius: 10px;
            padding: 20px 22px;
          }
          .vse-failure .num {
            font-size: 26px; font-weight: 800; color: ${T.royal};
            opacity: 0.42; line-height: 1; flex-shrink: 0;
          }
          .vse-failure h3 { margin: 0 0 7px; font-size: 14px; font-weight: 800; letter-spacing: 1px; color: ${T.text}; }
          .vse-failure p { margin: 0; max-width: none; font-size: 13.5px; line-height: 1.65; color: ${T.muted}; }

          /* ── TABLES ───────────────────────────────────────────────── */
          .vse-tablewrap {
            margin-top: 24px;
            border: 1px solid ${T.border};
            border-radius: 10px;
            overflow-x: auto;
            text-align: left;
          }
          .vse-tablewrap table { width: 100%; border-collapse: collapse; min-width: 880px; }
          .vse-tablewrap th {
            background: ${T.rail};
            color: rgba(255,255,255,0.7);
            padding: 14px 16px;
            text-align: center;
            font-size: 10px; letter-spacing: 2px; font-weight: bold;
            white-space: nowrap;
          }
          .vse-tablewrap th:first-child { text-align: left; }
          .vse-tablewrap th.ds-head { color: ${T.blue}; }
          .vse-tablewrap td {
            padding: 12px 16px;
            border-bottom: 1px solid ${T.surface2};
            text-align: center;
            font-size: 12.5px;
          }
          .vse-tablewrap tr:last-child td { border-bottom: none; }
          .vse-tablewrap td:first-child {
            text-align: left; font-weight: 600; color: ${T.text};
            width: 230px; font-size: 13px;
          }
          .vse-tablewrap tr:nth-child(even) td { background: rgba(226,228,234,0.34); }
          .vse-tablewrap td.ds-col { background: rgba(42,110,255,0.06) !important; color: ${T.royal} !important; font-weight: bold; }

          /* ── SWITCHING ────────────────────────────────────────────── */
          .vse-switch {
            display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px; margin-top: 24px; text-align: left;
          }
          .vse-switch a {
            background: ${T.bg}; border: 1px solid ${T.border};
            border-radius: 10px; padding: 16px 18px;
            text-decoration: none; display: block;
            transition: border-color 0.15s, transform 0.15s;
          }
          .vse-switch a:hover { border-color: ${T.royal}; transform: translateY(-2px); }
          .vse-switch h3 { margin: 0 0 7px; font-size: 12px; font-weight: 800; letter-spacing: 1.6px; color: ${T.royal}; }
          .vse-switch p { margin: 0; max-width: none; font-size: 12.5px; line-height: 1.55; color: ${T.muted}; }

          /* ── BUTTONS ──────────────────────────────────────────────── */
          .vse-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 24px; }
          .vse-btn {
            display: inline-block; padding: 14px 28px; border-radius: 8px;
            font-family: inherit;
            font-size: 12px; font-weight: bold; letter-spacing: 2.6px;
            text-decoration: none; cursor: pointer;
          }
          .vse-btn.primary { background: ${T.royal}; color: #fff; border: none; }
          .vse-btn.primary:hover { background: ${T.accent}; }
          .vse-btn.secondary {
            background: transparent; color: ${T.text};
            border: 1px solid ${T.border}; border-top: 3px solid ${T.text};
          }

          .vse-inline {
            background: none; border: none; padding: 0;
            font: inherit; color: ${T.royal}; font-weight: 600;
            text-decoration: underline; text-underline-offset: 3px;
            cursor: pointer;
          }

          @media (max-width: 1000px) {
            .vse-grid { grid-template-columns: minmax(0, 1fr); }
            .vse-rail { position: static; }
            .vse-switch { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          }
          @media (max-width: 700px) {
            .vse { padding: 20px 16px 56px; }
            .vse-sec { padding: 32px 22px; }
            .vse-hero { padding: 34px 22px 30px; }
            .vse-hero h1 { font-size: 29px; letter-spacing: -0.8px; }
            .vse-sec h2 { font-size: 22px; }
            .vse-tiles { grid-template-columns: minmax(0, 1fr); }
            .vse-switch { grid-template-columns: minmax(0, 1fr); }
            .vse-failure { flex-direction: column; gap: 8px; }
            .vse-btn { display: block; width: 100%; text-align: center; }
          }
        `}</style>

        <div className="vse">
          <div className="vse-grid">

            {/* ── NAVIGATION RAIL ── */}
            <aside className="vse-rail">
              <div className="vse-rail-group">
                <p className="vse-rail-label">MAIN MENU</p>
                <Link href="/?view=landing"><RailChevron /> Home</Link>
                <Link href="/vs" className="here"><RailChevron /> All Comparisons</Link>
                <Link href="/faq"><RailChevron /> FAQ</Link>
                <Link href="/dialing-modes"><RailChevron /> Dialing Modes</Link>
              </div>

              <div className="vse-rail-group">
                <p className="vse-rail-label">OTHER VS PAGES</p>
                {OTHER_VS.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <RailChevron /> {item.label}
                  </Link>
                ))}
              </div>

              <div className="vse-rail-group">
                <p className="vse-rail-label">SITE INFO</p>
                {SITE_INFO.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <RailChevron /> {item.label}
                  </Link>
                ))}
              </div>
            </aside>

            {/* ── THE ARTICLE ── */}
            <div className="vse-card">

              <section className="vse-sec vse-hero">
                <div className="eyebrow">▸ DIALERSEAT™ VS EVERYONE</div>
                <h1>
                  The industry is broken.
                  <span className="second">We fixed it.</span>
                </h1>
                <p>
                  The outbound dialer industry was built by enterprise sales teams for
                  enterprise budgets. DialerSeat was built for the people actually making
                  the calls.
                </p>
                <div className="vse-btns">
                  <Link href={showSignedIn ? '/dashboard' : '/sign-up'} className="vse-btn primary">
                    {showSignedIn ? 'GO TO DASHBOARD →' : 'GET STARTED →'}
                  </Link>
                  <a href="#failures" className="vse-btn secondary">THE SIX FAILURES</a>
                </div>
                <p className="stamp">Last updated 07/28/2026</p>
              </section>

              <section className="vse-sec">
                <div className="vse-icon"><IconVerdict /></div>
                <h2>Legacy dialers are bloated, dated, and overpriced.</h2>
                <p>
                  Most of our customers switch from ReadyMode, Mojo, or Five9 because
                  they&apos;re tired of paying for features they don&apos;t use, UI they
                  don&apos;t like, and contracts they can&apos;t escape.
                </p>
                <p>
                  We took the core predictive and power dialing technology that enterprise
                  tools charge hundreds for, stripped away the sales-demo bloat, and packaged
                  it into a modern interface that works on any device. Then we priced it at
                  $35/week with no contract. It&apos;s not a &quot;budget&quot; alternative,
                  it&apos;s a more capable tool built for a modern workflow.
                </p>
              </section>

              <section className="vse-sec">
                <div className="vse-icon"><IconWeek /></div>
                <h2>Nobody else sells a week.</h2>
                <p>
                  Say you want to dial for one week: a push before a deadline, a trial run on
                  a new list, a single busy stretch. Everywhere else, the smallest thing you
                  can buy is a month, so a week of dialing costs you a month&apos;s
                  subscription. Month to month, on the dialers that actually run multi-line
                  predictive, that&apos;s roughly $120 to $250 a seat before setup fees.
                </p>
                <p>
                  DialerSeat sells the week. $35, and if you don&apos;t want the next one you
                  don&apos;t buy it. Four weeks of DialerSeat still costs less than one month
                  almost anywhere on this page.
                </p>
                <div className="vse-tiles">
                  <div className="vse-tile">
                    <div className="vse-tile-num">$120-$250</div>
                    <div className="vse-tile-label">EVERYWHERE ELSE</div>
                    <div className="vse-tile-sub">
                      One month, because a month is the smallest unit sold. Setup fees extra.
                    </div>
                  </div>
                  <div className="vse-tile ours">
                    <div className="vse-tile-num">$35</div>
                    <div className="vse-tile-label">DIALERSEAT</div>
                    <div className="vse-tile-sub">
                      One week. Cancel before the next one and that is the whole bill.
                    </div>
                  </div>
                </div>
              </section>

              <section className="vse-sec" id="failures">
                <div className="vse-icon"><IconFailures /></div>
                <h2>Why the industry needs a reset.</h2>
                <p>
                  Six failures every legacy dialer shares. Not one of them is a technical
                  limit; each is a pricing or packaging decision somebody made on purpose.
                </p>
                <div className="vse-failures">
                  {INDUSTRY_FAILURES.map((f) => (
                    <div key={f.num} className="vse-failure">
                      <div className="num">{f.num}</div>
                      <div>
                        <h3>{f.title}</h3>
                        <p>{f.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="vse-sec">
                <div className="vse-icon"><IconTable /></div>
                <h2>Every feature. Every competitor.</h2>
                <p>
                  Where a competitor is genuinely better, the row says so. A table where one
                  column wins everything is marketing, not a comparison.
                </p>
                <div className="vse-tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>FEATURE</th>
                        <th className="ds-head">DIALERSEAT</th>
                        <th>READYMODE</th>
                        <th>MOJO</th>
                        <th>PHONEBURNER</th>
                        <th>FIVE9</th>
                        <th>CONVOSO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {features.map((f) => (
                        <tr key={f.feature}>
                          <td>{f.feature}</td>
                          <td className="ds-col"><StatusCell value={f.ds} /></td>
                          <td><StatusCell value={f.rm} /></td>
                          <td><StatusCell value={f.mo} /></td>
                          <td><StatusCell value={f.pb} /></td>
                          <td><StatusCell value={f.f9} /></td>
                          <td><StatusCell value={f.cv} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="vse-sec">
                <div className="vse-icon"><IconTeam /></div>
                <h2>What happens when you add the fifth agent.</h2>
                <p>
                  The headline seat rate is the number everyone compares. What decides the
                  purchase is whether growing the floor is an afternoon decision or a
                  procurement event.
                </p>
                <div className="vse-tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>SCALING</th>
                        <th className="ds-head">DIALERSEAT</th>
                        <th>READYMODE</th>
                        <th>MOJO</th>
                        <th>PHONEBURNER</th>
                        <th>FIVE9</th>
                        <th>CONVOSO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamScaling.map((f) => (
                        <tr key={f.feature}>
                          <td>{f.feature}</td>
                          <td className="ds-col"><StatusCell value={f.ds} /></td>
                          <td><StatusCell value={f.rm} /></td>
                          <td><StatusCell value={f.mo} /></td>
                          <td><StatusCell value={f.pb} /></td>
                          <td><StatusCell value={f.f9} /></td>
                          <td><StatusCell value={f.cv} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="vse-sec">
                <div className="vse-icon"><IconSwitch /></div>
                <h2>Direct head-to-heads.</h2>
                <p>
                  Every tool above gets its own page, with the pricing written the way that
                  vendor writes it and the things they genuinely do better left in.
                </p>
                <div className="vse-switch">
                  {SWITCHING_FROM.map((s) => (
                    <Link key={s.name} href={s.href}>
                      <h3>{s.name}</h3>
                      <p>{s.summary}</p>
                    </Link>
                  ))}
                </div>
              </section>

              <section className="vse-sec">
                <div className="vse-icon"><IconAsk /></div>
                <h2>Still have questions?</h2>
                <p>
                  If your dialer isn&apos;t on this page, or something here doesn&apos;t match
                  what you were quoted, tell us. A real person reads every one of these.{' '}
                  <button type="button" className="vse-inline" onClick={() => setAskOpen(true)}>
                    Send us a request here.
                  </button>
                </p>
                <div className="vse-btns">
                  <Link href={showSignedIn ? '/dashboard' : '/sign-up'} className="vse-btn primary">
                    {showSignedIn ? 'GO TO DASHBOARD →' : 'GET STARTED →'}
                  </Link>
                  <Link href="/vs" className="vse-btn secondary">ALL COMPARISONS</Link>
                </div>
              </section>

            </div>
          </div>
        </div>

        <SuggestionModal
          open={askOpen}
          onClose={() => setAskOpen(false)}
          title="Send us a request"
          intro="Tell us which dialer to compare next, or what this page got wrong. A real person reads these."
          defaultKind="comparison"
        />
      </main>
      <SiteFooter />
    </>
  )
}
