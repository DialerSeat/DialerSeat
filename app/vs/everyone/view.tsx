'use client'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import BackToVsButton from '@/components/back-to-vs-button'


const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
  surface2: '#d4d7df',
  border: '#c4c8d0',
  dark: '#1a1a2e',
  darker: '#0a0a14',
  text: '#1a1c24',
  muted: '#5a5e6a',
  accent: '#2a4a8a',
  blue: '#4a9eff',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}


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
  { feature: 'Per-seat price', ds: '$35/wk, cancel anytime', rm: '$199–$249/mo', mo: '$149/mo + add-ons', pb: '$165–$215/mo', f9: '$175+/mo', cv: '$90+/mo, custom quote' },
  { feature: 'Weekly billing option', ds: true, rm: false, mo: false, pb: false, f9: false, cv: false },
  { feature: 'Annual contract required', ds: false, rm: 'Typical', mo: false, pb: 'For best price', f9: 'Typical', cv: 'Typical' },
  { feature: 'Public pricing on website', ds: true, rm: false, mo: true, pb: true, f9: false, cv: false },
  { feature: 'Self-serve signup (no demo)', ds: true, rm: false, mo: true, pb: true, f9: false, cv: false },
  { feature: 'Setup fee', ds: '$0', rm: '$500–$2K', mo: '$0', pb: '$0', f9: 'Variable', cv: 'Variable' },
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
    body: 'The headline $149–$199 advertised price becomes $200–$300 effective once you add data feeds (Mojo $25–$49 per dataset), tier upgrades for basic features, or industry-specific add-ons. Our $35/week, cancel anytime, is the bill — nothing stacks on top, and it never becomes a monthly premium.',
  },
  {
    num: '04',
    title: 'DESKTOP-ONLY SOFTWARE',
    body: 'Most legacy dialers were built before tablets existed and never modernized. ReadyMode and PhoneBurner have no mobile app at all. Five9 publishes one, but it\'s for supervisors to monitor calls, not for agents to dial from. Field agents and solo reps need to be at their desk. We work on phone, tablet, and desktop, with the full dialer — install to home screen and it behaves like a native app.',
  },
  {
    num: '05',
    title: 'COMPLIANCE SHORTCUTS',
    body: 'Number registration is inconsistent at most competitors. TCPA enforcement is often partial rather than server-side per lead state. We register every outbound number with the carrier registry and enforce TCPA windows server-side. We respect the laws so you do not get blocked or fined.',
  },
  {
    num: '06',
    title: 'DATED INTERFACES',
    body: 'ReadyMode reviewers describe the UI as "Windows 8" or "dated." Mojo, PhoneBurner, and most enterprise tools accumulated UI debt over a decade. Rep retention suffers when the software feels old. DialerSeat ships with a modern design system — clean, fast, and built for the way teams actually work.',
  },
]

const SWITCHING_FROM = [
  {
    name: 'READYMODE',
    href: '/vs/readymode',
    summary: 'Same multi-line predictive at $35/week, cancel anytime, instead of $199–$249/month locked into a contract. No $500–$2,000 setup fee. Modern UI. Works on phones and tablets where ReadyMode is desktop-only.',
  },
  {
    name: 'MOJO DIALER',
    href: '/vs/mojo',
    summary: 'Same triple-line speed across every industry — not just real estate. No mandatory $10/mo Agent Access fee stacked on top of your plan. No $25–$49 data add-ons stacking. Multiple scripts per campaign, calendar-aligned analytics.',
  },
  {
    name: 'PHONEBURNER',
    href: '/vs/phoneburner',
    summary: 'Multi-line predictive included (PhoneBurner is single-line only). Weekly billing, no annual contract. Per-campaign dialer mode. Flexible list sizes (no forced 10/25/50 increments).',
  },
  {
    name: 'FIVE9',
    href: '/vs/five9',
    summary: 'Same compliance posture without the enterprise sales cycle. Self-serve setup in minutes, not weeks. Flat $35/week per seat vs Five9\'s $175+ with custom quotes and annual commitments.',
  },
  {
    name: 'CONVOSO',
    href: '/vs/convoso',
    summary: 'Same high-volume outbound dialing for insurance, solar, and lead-heavy verticals. Without the custom quoting, ~20-seat minimum, and carrier fees billed separately from the base price. One flat weekly price, no seat minimum.',
  },
  {
    name: 'KIXIE / JUSTCALL',
    href: null,
    summary: 'Both tier their dialer capability by price — multi-line and predictive dialing cost more than the advertised entry rate, or require a plan upgrade entirely. DialerSeat includes every dialer mode at one flat weekly price from the first seat.',
  },
  {
    name: 'CALLTOOLS',
    href: null,
    summary: 'Cleaner UI, full multi-line predictive, proper compliance infrastructure, and a public API that works with any CRM. Same price band, more capability, no custom quote required.',
  },
]

function Cell({ value }: { value: Cell }) {
  if (value === true) return <span style={{ color: T.green, fontSize: 18, fontWeight: 'bold' }}>✓</span>
  if (value === false) return <span style={{ color: T.red, fontSize: 18, fontWeight: 'bold' }}>✕</span>
  
  const lower = value.toLowerCase()
  let color: string = T.text
  if (lower.includes('add-on') || lower.includes('partial') || lower.includes('variable') || lower.includes('inconsistent') || lower.includes('limited') || lower.includes('only') || lower.includes('tier') || lower.includes('premium') || lower.includes('misses') || lower.includes('custom')) {
    color = T.amber
  }
  return <span style={{ color, fontSize: 11, fontStyle: lower.includes('add-on') || lower.includes('partial') ? 'italic' : 'normal', letterSpacing: 0.3 }}>{value}</span>
}

const teamScaling: FeatureRow[] = [
  { feature: 'Whitelabel available', ds: 'Manager+, $75/mo flat', rm: false, mo: false, pb: false, f9: false, cv: false },
  { feature: 'Manager/supervisor seat', ds: 'Included in Manager+', rm: 'Admin seat can\u2019t dial', mo: false, pb: 'Requires Professional tier', f9: 'Requires 50-seat Optimum quote', cv: 'Custom quote' },
  { feature: 'Live call monitoring / coaching', ds: true, rm: 'iQ tier only', mo: false, pb: 'Professional tier ($195+/seat)', f9: 'Optimum tier, custom quote', cv: true },
  { feature: 'Price change as team grows', ds: 'None — flat $35/wk per seat', rm: '+$50/seat at 5th license', mo: 'None — but no team plan exists', pb: '+$30–$50/seat per tier', f9: '50-seat minimum on every plan', cv: '~20-seat minimum before you can meaningfully start' },
  { feature: 'Reseller / partner program', ds: 'Not needed — sold direct', rm: 'Affiliate/referral only', mo: false, pb: false, f9: 'VAR/reseller, Five9-branded', cv: 'None found — quote-request form only' },
]

export default function VsEveryoneView() {
  return (
    <>
      <SiteHeader />
      <BackToVsButton />
      <div className="vs-root" style={{
        background: T.bg,
        minHeight: '100vh',
        fontFamily: 'Futura PT, Futura, sans-serif',
        color: T.text,
      }}>
        <style>{`
          .vs-root * { box-sizing: border-box; }
          .vs-hero {
            background: linear-gradient(135deg, ${T.darker} 0%, ${T.dark} 100%);
            color: white;
            padding: 80px 32px 100px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .vs-hero::before {
            content: '';
            position: absolute;
            inset: 0;
            background:
              radial-gradient(circle at 20% 30%, rgba(74,158,255,0.18) 0%, transparent 45%),
              radial-gradient(circle at 80% 60%, rgba(74,158,255,0.12) 0%, transparent 45%);
          }
          .vs-hero-inner { position: relative; max-width: 920px; margin: 0 auto; }
          .vs-eyebrow {
            display: inline-block;
            padding: 6px 14px;
            background: rgba(74,158,255,0.15);
            border: 1px solid ${T.blue};
            border-radius: 4px;
            color: ${T.blue};
            font-size: 11px;
            letter-spacing: 3px;
            font-weight: bold;
            margin-bottom: 24px;
          }
          .vs-h1 {
            font-size: 60px;
            letter-spacing: -1.5px;
            line-height: 1.05;
            font-weight: 800;
            margin: 0 0 20px 0;
          }
          .vs-h1 .versus { color: ${T.blue}; }
          .vs-subhead {
            font-size: 19px;
            line-height: 1.55;
            color: #c4c8d8;
            max-width: 760px;
            margin: 0 auto 36px;
          }
          .vs-cta-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
          .vs-btn-primary {
            padding: 16px 32px;
            background: linear-gradient(135deg, ${T.blue}, #2a6eff);
            color: white;
            font-size: 13px;
            letter-spacing: 2.5px;
            font-weight: bold;
            border-radius: 8px;
            text-decoration: none;
            display: inline-block;
            box-shadow: 0 0 24px rgba(74,158,255,0.4);
          }
          .competitor-strip {
            margin-top: 36px;
            font-size: 11px;
            letter-spacing: 2.5px;
            color: rgba(255,255,255,0.5);
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 18px;
          }
          .competitor-strip span {
            opacity: 0.7;
          }
          .vs-section { max-width: 1180px; margin: 0 auto; padding: 80px 32px; }
          .vs-section-eyebrow { font-size: 11px; letter-spacing: 4px; color: ${T.muted}; font-weight: bold; margin-bottom: 12px; }
          .vs-section-h2 {
            font-size: 36px;
            letter-spacing: -0.5px;
            line-height: 1.15;
            font-weight: 800;
            margin: 0 0 16px 0;
            color: ${T.text};
          }
          .vs-section-lede {
            font-size: 16px;
            color: ${T.muted};
            line-height: 1.65;
            max-width: 760px;
            margin: 0 0 48px 0;
          }
          .verdict-card {
            background: white;
            border: 1px solid ${T.border};
            border-radius: 12px;
            padding: 32px;
            margin-bottom: 48px;
            border-left: 4px solid ${T.blue};
            box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          }
          .verdict-title { font-size: 14px; font-weight: bold; letter-spacing: 3px; color: ${T.blue}; margin-bottom: 12px; }
          .verdict-text { font-size: 17px; line-height: 1.7; color: ${T.text}; margin: 0; }
          .sins-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-top: 24px;
          }
          .sin-card {
            background: white;
            border: 1px solid ${T.border};
            border-radius: 12px;
            padding: 28px;
            position: relative;
            overflow: hidden;
          }
          .sin-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
            background: ${T.red};
          }
          .sin-num {
            font-size: 36px;
            font-weight: 800;
            color: ${T.surface2};
            letter-spacing: -1px;
            line-height: 1;
            margin-bottom: 8px;
          }
          .sin-title {
            font-size: 14px;
            font-weight: 800;
            letter-spacing: 2.5px;
            color: ${T.text};
            margin-bottom: 10px;
          }
          .sin-body {
            font-size: 14px;
            line-height: 1.65;
            color: ${T.muted};
            margin: 0;
          }
          .cost-breakdown {
            background: white;
            border: 1px solid ${T.border};
            border-radius: 12px;
            padding: 24px;
            margin-top: 24px;
            max-width: 600px;
          }
          .cost-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px dashed ${T.border};
            font-size: 14px;
          }
          .cost-row:last-child {
            border-bottom: none;
            border-top: 2px solid ${T.text};
            margin-top: 6px;
            font-weight: 800;
            font-size: 17px;
            padding-top: 14px;
          }
          .cost-row .item { color: ${T.text}; }
          .cost-row .price { color: ${T.muted}; font-family: monospace; }
          .price-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 32px; }
          .price-card { padding: 32px; border-radius: 12px; background: white; border: 1px solid ${T.border}; }
          .price-card.winner { border: 2px solid ${T.blue}; box-shadow: 0 8px 32px rgba(74,158,255,0.12); }
          .price-card-label { font-size: 11px; letter-spacing: 3px; font-weight: bold; color: ${T.muted}; margin-bottom: 8px; }
          .price-card.winner .price-card-label { color: ${T.blue}; }
          .price-card-name { font-size: 24px; font-weight: 800; color: ${T.text}; margin-bottom: 16px; }
          .price-card-big { font-size: 44px; font-weight: 800; letter-spacing: -1px; color: ${T.text}; line-height: 1; }
          .price-card-suffix { font-size: 14px; color: ${T.muted}; margin-left: 4px; letter-spacing: 1px; }
          .price-card-monthly { margin-top: 8px; font-size: 13px; color: ${T.muted}; letter-spacing: 0.5px; }
          .price-card-list { margin-top: 20px; padding-top: 20px; border-top: 1px solid ${T.border}; list-style: none; padding-left: 0; }
          .price-card-list li {
            padding: 6px 0;
            font-size: 13px;
            line-height: 1.5;
            display: flex;
            align-items: flex-start;
            gap: 8px;
          }
          .price-card-list li.bad { color: ${T.muted}; }
          .check, .cross { display: inline-block; width: 18px; flex-shrink: 0; }
          .check { color: ${T.green}; }
          .cross { color: ${T.red}; }
          .matrix-wrap {
            background: white;
            border: 1px solid ${T.border};
            border-radius: 12px;
            overflow: hidden;
            margin-top: 24px;
          }
          .matrix-scroll { overflow-x: auto; }
          .matrix {
            width: 100%;
            border-collapse: collapse;
            min-width: 880px;
          }
          .matrix th {
            padding: 14px 12px;
            background: ${T.dark};
            color: white;
            font-size: 10px;
            letter-spacing: 1.5px;
            text-align: center;
            font-weight: bold;
            border-right: 1px solid rgba(255,255,255,0.06);
          }
          .matrix th:first-child { text-align: left; padding-left: 20px; }
          .matrix th.ds-col { background: ${T.accent}; color: white; }
          .matrix td {
            padding: 12px;
            border-top: 1px solid ${T.border};
            font-size: 13px;
            text-align: center;
            border-right: 1px solid ${T.border};
          }
          .matrix td:first-child {
            text-align: left;
            padding-left: 20px;
            color: ${T.text};
            font-weight: 500;
            font-size: 13px;
          }
          .matrix td:last-child { border-right: none; }
          .matrix tr:nth-child(even) td { background: ${T.bg}; }
          .matrix .ds-cell { background: rgba(74,158,255,0.06) !important; font-weight: bold; }
          .win-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 24px; }
          .win-card {
            padding: 28px;
            background: white;
            border: 1px solid ${T.border};
            border-radius: 12px;
            border-left: 4px solid ${T.green};
          }
          .win-card-title { font-size: 17px; font-weight: 800; color: ${T.text}; margin-bottom: 10px; }
          .win-card-body { font-size: 14px; line-height: 1.65; color: ${T.muted}; margin: 0; }
          .switching-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-top: 24px;
          }
          .switching-mini-card {
            background: white;
            border: 1px solid ${T.border};
            border-top: 3px solid ${T.blue};
            border-radius: 8px;
            padding: 24px;
            text-decoration: none;
            color: ${T.text};
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 14px;
          }
          .switching-mini-card.has-link:hover {
            border-color: ${T.blue};
            box-shadow: 0 4px 16px rgba(74,158,255,0.10);
          }
          .switching-mini-card h4 {
            font-size: 14px;
            font-weight: 800;
            letter-spacing: 2.5px;
            color: ${T.text};
            margin: 0;
          }
          .switching-mini-card p {
            font-size: 13px;
            line-height: 1.6;
            color: ${T.muted};
            margin: 0;
            flex: 1;
          }
          .switching-mini-card .read-more {
            font-size: 10px;
            letter-spacing: 2px;
            font-weight: bold;
            color: ${T.blue};
            margin-top: 4px;
          }
          .vs-final-cta {
            background: linear-gradient(135deg, ${T.dark}, ${T.darker});
            color: white;
            padding: 80px 32px;
            text-align: center;
          }
          .vs-final-cta-inner { max-width: 720px; margin: 0 auto; }
          .vs-final-cta-h2 { font-size: 42px; font-weight: 800; letter-spacing: -0.5px; margin: 0 0 16px 0; line-height: 1.15; }
          .vs-final-cta-p { font-size: 17px; color: #c4c8d8; line-height: 1.6; margin: 0 0 32px 0; }

          @media (max-width: 768px) {
            .vs-hero { padding: 56px 20px 64px; }
            .vs-h1 { font-size: 36px; }
            .vs-subhead { font-size: 16px; }
            .competitor-strip { font-size: 9px; gap: 10px; }
            .vs-section { padding: 56px 20px; }
            .vs-section-h2 { font-size: 28px; }
            .sins-grid { grid-template-columns: 1fr; }
            .price-grid { grid-template-columns: 1fr; }
            .win-grid { grid-template-columns: 1fr; }
            .switching-grid { grid-template-columns: 1fr; }
            .vs-final-cta { padding: 56px 20px; }
            .vs-final-cta-h2 { font-size: 30px; }
            .vs-btn-primary { width: 100%; }
          }
        `}</style>

        <div className="vs-hero">
          <div className="vs-hero-inner">
            <div className="vs-eyebrow">DIALERSEAT VS THE WHOLE INDUSTRY</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>Pricing and features last verified 7/19/26</div>
            <h1 className="vs-h1">
              Every legacy dialer fails the same way.<br />
              <span className="versus">We fix all of it. $35 a week.</span>
            </h1>
            <p className="vs-subhead">
              ReadyMode, Mojo, PhoneBurner, Five9, Convoso, CallTools, Kixie, JustCall —
              whichever you're considering, they share the same flaws: opaque pricing, annual
              contracts, dated UI, add-on stacking, desktop-only, compliance shortcuts.
              DialerSeat™ fixes every one of them at <strong>$35/week per seat</strong>.
              Solo agent or 500-seat team. Every industry. Every device.
            </p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">START DIALING →</Link>
            </div>
            <div className="competitor-strip">
              <span>READYMODE</span>
              <span>·</span>
              <span>MOJO DIALER</span>
              <span>·</span>
              <span>PHONEBURNER</span>
              <span>·</span>
              <span>FIVE9</span>
              <span>·</span>
              <span>CONVOSO</span>
              <span>·</span>
              <span>CALLTOOLS</span>
              <span>·</span>
              <span>KIXIE</span>
              <span>·</span>
              <span>JUSTCALL</span>
              <span>·</span>
              <span>ETC.</span>
            </div>
          </div>
        </div>

        <div className="vs-section">
          <div className="vs-section-eyebrow">THE QUICK VERDICT</div>
          <h2 className="vs-section-h2">Pick any "industry-leading" dialer. They all share the same flaws.</h2>
          <p className="vs-section-lede">
            The outbound dialer category has been dominated by tools built between 2010–2018.
            They were designed for traditional call centers — desktop-only, annual contracts,
            add-on revenue models, opaque pricing. The industry never modernized. DialerSeat™
            was built from scratch to fix every shared flaw at once.
          </p>

          <div className="verdict-card">
            <div className="verdict-title">▸ BOTTOM LINE</div>
            <p className="verdict-text">
              <strong>Switch to DialerSeat™</strong> for one product that beats every legacy
              alternative on price, billing flexibility, mobile support, compliance depth, and
              modern UI. Whichever competitor you'd otherwise choose — ReadyMode, Mojo,
              PhoneBurner, Five9, Convoso, or any other — there's a cleaner version of it
              here at $35/week.
            </p>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">THE INDUSTRY-WIDE PROBLEMS</div>
          <h2 className="vs-section-h2">Six failures every legacy dialer shares.</h2>
          <p className="vs-section-lede">
            Across the major outbound dialing tools, six patterns repeat. Each one is a
            choice — not a constraint. Modern infrastructure makes all of them avoidable.
          </p>

          <div className="sins-grid">
            {INDUSTRY_FAILURES.map((sin, i) => (
              <div key={i} className="sin-card">
                <div className="sin-num">{sin.num}</div>
                <div className="sin-title">{sin.title}</div>
                <p className="sin-body">{sin.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">THE REAL COST OF LEGACY DIALERS</div>
          <h2 className="vs-section-h2">$149–$199 advertised. $200–$300 in practice.</h2>
          <p className="vs-section-lede">
            The headline pricing legacy dialers advertise rarely matches the bill teams
            actually receive. Below is a representative "real bill" for a single seat once
            common add-ons and tier upgrades stack. DialerSeat™'s $35/week is the bill —
            nothing stacks on top, and it's never billed as a monthly premium.
          </p>

          <div className="cost-breakdown">
            <div className="cost-row"><span className="item">Base plan (industry average)</span><span className="price">$175.00/mo</span></div>
            <div className="cost-row"><span className="item">Tier upgrade for inbound numbers</span><span className="price">+$30.00/mo</span></div>
            <div className="cost-row"><span className="item">Tier upgrade for live monitoring</span><span className="price">+$25.00/mo</span></div>
            <div className="cost-row"><span className="item">Industry data / skip tracing (Mojo-style)</span><span className="price">+$49.00/mo</span></div>
            <div className="cost-row"><span className="item">Implementation / setup amortized</span><span className="price">+$20.00/mo</span></div>
            <div className="cost-row"><span className="item">Real effective per-seat bill</span><span className="price">$299.00/mo</span></div>
          </div>

          <div className="price-grid">
            <div className="price-card winner">
              <div className="price-card-label">DIALERSEAT</div>
              <div className="price-card-name">Everything included, weekly</div>
              <div>
                <span className="price-card-big">$35</span>
                <span className="price-card-suffix">/seat/week</span>
              </div>
              <div className="price-card-monthly">Cancel anytime — no monthly lock-in</div>
              <ul className="price-card-list">
                <li><span className="check">✓</span> Multi-line predictive + 4 modes</li>
                <li><span className="check">✓</span> Multiple scripts per campaign</li>
                <li><span className="check">✓</span> Public API + webhooks (any CRM)</li>
                <li><span className="check">✓</span> All outbound numbers carrier-registered</li>
                <li><span className="check">✓</span> TCPA enforced server-side</li>
                <li><span className="check">✓</span> Calendar-aligned analytics</li>
                <li><span className="check">✓</span> Works on every device (PWA install)</li>
                <li><span className="check">✓</span> Weekly billing — no annual lock-in</li>
                <li><span className="check">✓</span> Unlimited outbound minutes</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">LEGACY DIALER (TYPICAL)</div>
              <div className="price-card-name">Stacked add-ons + annual</div>
              <div>
                <span className="price-card-big">$200–$300</span>
                <span className="price-card-suffix">/seat/month (effective)</span>
              </div>
              <div className="price-card-monthly">Annual contract for best rate. No weekly option.</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> Annual contract typical</li>
                <li className="bad"><span className="cross">✕</span> Inbound numbers gated to tier</li>
                <li className="bad"><span className="cross">✕</span> Live monitoring tier-gated</li>
                <li className="bad"><span className="cross">✕</span> Data feeds stacked separately</li>
                <li className="bad"><span className="cross">✕</span> CRM coverage varies</li>
                <li className="bad"><span className="cross">✕</span> Desktop-only or minimal mobile</li>
                <li className="bad"><span className="cross">✕</span> Pricing hidden behind sales call</li>
                <li className="bad"><span className="cross">✕</span> Setup fees $500–$2,000</li>
                <li className="bad"><span className="cross">✕</span> Compliance partial / inconsistent</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">FEATURE MATRIX</div>
          <h2 className="vs-section-h2">DialerSeat vs five major competitors, side by side.</h2>
          <p className="vs-section-lede">
            One row per feature, six columns including DialerSeat. Green ✓ = full support,
            red ✕ = not available, amber italic = partial, add-on, or tier-gated. Scroll
            horizontally on mobile.
          </p>

          <div className="matrix-wrap">
            <div className="matrix-scroll">
              <table className="matrix">
                <thead>
                  <tr>
                    <th>FEATURE</th>
                    <th className="ds-col">DIALERSEAT</th>
                    <th>READYMODE</th>
                    <th>MOJO</th>
                    <th>PHONEBURNER</th>
                    <th>FIVE9</th>
                    <th>CONVOSO</th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((f, i) => (
                    <tr key={i}>
                      <td>{f.feature}</td>
                      <td className="ds-cell"><Cell value={f.ds} /></td>
                      <td><Cell value={f.rm} /></td>
                      <td><Cell value={f.mo} /></td>
                      <td><Cell value={f.pb} /></td>
                      <td><Cell value={f.f9} /></td>
                      <td><Cell value={f.cv} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">SCALING A TEAM</div>
          <h2 className="vs-section-h2">Whitelabel and manager tools, across the whole category.</h2>
          <p className="vs-section-lede">
            Checked directly against each vendor's own pricing pages and independently corroborated
            pricing research. None of the five offer true whitelabel — the closest most get is a
            referral or reseller program that keeps their name on the product. DialerSeat™
            Manager+ is a flat $75/month add-on with full whitelabel included, at any team size.
          </p>

          <div className="matrix-wrap">
            <div className="matrix-scroll">
              <table className="matrix">
                <thead>
                  <tr>
                    <th>FEATURE</th>
                    <th className="ds-col">DIALERSEAT</th>
                    <th>READYMODE</th>
                    <th>MOJO</th>
                    <th>PHONEBURNER</th>
                    <th>FIVE9</th>
                    <th>CONVOSO</th>
                  </tr>
                </thead>
                <tbody>
                  {teamScaling.map((f, i) => (
                    <tr key={i}>
                      <td>{f.feature}</td>
                      <td className="ds-cell"><Cell value={f.ds} /></td>
                      <td><Cell value={f.rm} /></td>
                      <td><Cell value={f.mo} /></td>
                      <td><Cell value={f.pb} /></td>
                      <td><Cell value={f.f9} /></td>
                      <td><Cell value={f.cv} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="vs-section-lede" style={{ marginTop: 20, marginBottom: 0, fontSize: 13 }}>
            See the <Link href="/vs/convoso" style={{ color: T.accent }}>full DialerSeat vs Convoso comparison</Link> for
            the complete pricing and feature breakdown.
          </p>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">WHERE DIALERSEAT WINS</div>
          <h2 className="vs-section-h2">Eight advantages no legacy dialer matches.</h2>

          <div className="win-grid">
            <div className="win-card">
              <div className="win-card-title">1. Weekly billing — unique in the entire category</div>
              <p className="win-card-body">
                $35 this week. Cancel before next Monday and you owe nothing more. Every other
                dialer in the category bills monthly minimum, most prefer annual. We are the
                only outbound dialer billing weekly at this price point.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">2. AMD that actually drops voicemails in ~1.8 seconds</div>
              <p className="win-card-body">
                Hardcoded server-side, always on. Reviewers across multiple competitors report
                voicemail detection failures — calls reaching agents that turn out to be
                machines. Our AMD drops every voicemail and gets straight to the next lead.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">3. Multiple scripts per campaign with live switching</div>
              <p className="win-card-body">
                Real estate script, health script, veterans script, IUL script — every team's
                go-to scripts on tabs, one tap away on every call. No legacy dialer in the
                category supports this. They all force you into one script per campaign.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">4. Per-campaign dialer mode</div>
              <p className="win-card-body">
                Your cold list runs Predictive. Your hot follow-ups run Preview. Same agent,
                same session, different modes per campaign. Every competitor locks you to one
                mode account-wide.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">5. The full dialer works on a phone or tablet</div>
              <p className="win-card-body">
                Install DialerSeat™ to your home screen on iPhone, iPad, Android, or any
                desktop and get the same dialer modes everywhere. Field agents on iPad, solo
                agents on their phone, manager dashboards on laptop. ReadyMode and PhoneBurner
                have no mobile app at all; Five9's is for supervisors, not dialing.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">6. Compliance posture without shortcuts</div>
              <p className="win-card-body">
                Every outbound number is carrier-registered (CNAM, FCR). TCPA windows enforced
                server-side per lead state. Full STIR/SHAKEN A-attestation. Compliance at
                most competitors is partial — variable number registration, partial TCPA
                enforcement.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">7. Public API + webhooks — works with any CRM</div>
              <p className="win-card-body">
                Push call results, lead updates, and dispositions to any CRM via our public
                API and webhooks. No native integration lock-in, no waiting for us to build a
                connector. If your CRM has an API, it works with DialerSeat™ today.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">8. Modern UI with no learning curve</div>
              <p className="win-card-body">
                Legacy dialers accumulated UI debt over a decade. Reviewers describe ReadyMode
                as "Windows 8" and PhoneBurner's contact panel as missing basic information.
                DialerSeat™ ships with a modern design system — clean, fast, and built for the
                way teams actually work. Your reps will notice.
              </p>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">SWITCHING FROM ANYWHERE</div>
          <h2 className="vs-section-h2">Whichever competitor you're on now — we've got you.</h2>
          <p className="vs-section-lede">
            Every reason teams stay on their current dialer has a clean answer on DialerSeat™.
            Quick takes below. Click through for the detailed comparison.
          </p>

          <div className="switching-grid">
            {SWITCHING_FROM.map((item, i) => {
              const inner = (
                <>
                  <h4>VS {item.name}</h4>
                  <p>{item.summary}</p>
                  {item.href && <div className="read-more">FULL COMPARISON →</div>}
                </>
              )
              if (item.href) {
                return (
                  <Link key={i} href={item.href} className="switching-mini-card has-link">
                    {inner}
                  </Link>
                )
              }
              return (
                <div key={i} className="switching-mini-card">
                  {inner}
                </div>
              )
            })}
          </div>
        </div>

        <div className="vs-final-cta">
          <div className="vs-final-cta-inner">
            <h2 className="vs-final-cta-h2">Beat every legacy dialer. $35 a week.</h2>
            <p className="vs-final-cta-p">
              $35/seat/week. Solo or team. Every industry. Every device. No add-ons, no
              annual contract, no setup fee, no compliance shortcuts. Just a modern dialer
              that beats every legacy alternative.
            </p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">START DIALING →</Link>
            </div>
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  )
}