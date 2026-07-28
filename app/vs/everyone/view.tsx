'use client'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import BackToVsButton from '@/components/back-to-vs-button'

const T = {
  bg: '#0a0a14',
  surface: '#1a1a2e',
  surface2: '#2a2a4a',
  border: '#2a2a4a',
  dark: '#1a1a2e',
  darker: '#0a0a14',
  text: '#ffffff',
  muted: '#8888aa',
  accent: '#2a4a8a',
  blue: '#4a9eff',
  green: '#4ade80',
  red: '#f87171',
  amber: '#fbbf24',
}

const FUTURA = `'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif`

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
  { name: 'READYMODE', href: '/vs/readymode', summary: 'Same multi-line predictive at $35/week, cancel anytime, instead of $199–$249/month locked into a contract. No $500–$2,000 setup fee.' },
  { name: 'MOJO DIALER', href: '/vs/mojo', summary: 'Same triple-line speed across every industry — not just real estate. No mandatory $10/mo Agent Access fee stacked on top.' },
  { name: 'PHONEBURNER', href: '/vs/phoneburner', summary: 'Multi-line predictive included (PhoneBurner is single-line only). Weekly billing, no annual contract.' },
  { name: 'FIVE9', href: '/vs/five9', summary: 'Same compliance posture without the enterprise sales cycle. Self-serve setup in minutes, not weeks.' },
  { name: 'CONVOSO', href: '/vs/convoso', summary: 'Same high-volume outbound dialing for insurance, solar, and lead-heavy verticals. One flat weekly price, no seat minimum.' },
  { name: 'KIXIE', href: '/vs/kixie', summary: 'Same predictive and multi-line dialing without paying Kixie\'s $95+/seat/month multi-line tier.' },
  { name: 'JUSTCALL', href: '/vs/justcall', summary: 'Same power and predictive dialing without the Pro-tier upgrade — JustCall\'s $29/month plan doesn\'t include a dialer.' },
  { name: 'AIRCALL', href: '/vs/aircall', summary: 'Same self-serve outbound dialing without the Professional-tier upsell — Aircall gates its dialer behind a $50/seat/month tier.' },
]

const teamScaling: FeatureRow[] = [
  { feature: 'Whitelabel available', ds: 'Manager+, $75/mo flat', rm: false, mo: false, pb: false, f9: false, cv: false },
  { feature: 'Manager/supervisor seat', ds: 'Included in Manager+', rm: 'Admin seat can\u2019t dial', mo: false, pb: 'Requires Professional tier', f9: 'Requires 50-seat Optimum quote', cv: 'Custom quote' },
  { feature: 'Live call monitoring / coaching', ds: true, rm: 'iQ tier only', mo: false, pb: 'Professional tier ($195+/seat)', f9: 'Optimum tier, custom quote', cv: true },
  { feature: 'Price change as team grows', ds: 'None — flat $35/wk per seat', rm: '+$50/seat at 5th license', mo: 'None — but no team plan exists', pb: '+$30–$50/seat per tier', f9: '50-seat minimum on every plan', cv: '~20-seat minimum before you can meaningfully start' },
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

export default function VsEveryoneView() {
  const { isLoaded, isSignedIn } = useUser()
  const showSignedIn = isLoaded && isSignedIn

  return (
    <>
      <SiteHeader />
      <BackToVsButton />
      <main style={{
        background: T.bg,
        minHeight: '100vh',
        fontFamily: FUTURA,
        color: T.text,
      }}>
        <style>{`
          .vs-root * { box-sizing: border-box; }

          /* ── HERO ── */
          .vs-hero {
            background: linear-gradient(135deg, ${T.darker} 0%, ${T.dark} 100%);
            color: white;
            padding: 100px 32px 80px;
            text-align: center;
            position: relative;
            overflow: hidden;
            border-bottom: 2px solid ${T.accent};
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

          /* ── BODY ── */
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

          /* ── VERDICT CARD ── */
          .verdict-card {
            background: ${T.surface};
            border: 1px solid ${T.border};
            border-radius: 4px;
            padding: 32px;
            margin-bottom: 48px;
            border-top: 3px solid ${T.blue};
          }
          .verdict-card h3 { font-size: 20px; font-weight: 800; margin: 0 0 12px 0; letter-spacing: -0.3px; }
          .verdict-card p { font-size: 15px; line-height: 1.7; color: ${T.muted}; margin: 0; }

          /* ── FAILURE GRID ── */
          .failure-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 72px; }
          .failure-card {
            background: ${T.surface};
            border: 1px solid ${T.border};
            border-radius: 4px;
            padding: 28px;
            display: flex;
            gap: 20px;
          }
          .failure-num { font-size: 32px; font-weight: 800; color: ${T.blue}; opacity: 0.5; line-height: 1; }
          .failure-card h4 { font-size: 16px; font-weight: 800; margin: 0 0 8px 0; letter-spacing: 1px; color: ${T.text}; }
          .failure-card p { font-size: 14px; line-height: 1.6; color: ${T.muted}; margin: 0; }

          /* ── COMPARISON TABLE ── */
          .table-container { 
            background: ${T.surface}; 
            border: 1px solid ${T.border}; 
            border-radius: 4px; 
            overflow-x: auto; 
            margin-bottom: 72px; 
          }
          table { width: 100%; border-collapse: collapse; min-width: 900px; }
          th { 
            background: ${T.dark}; 
            padding: 16px 20px; 
            text-align: center; 
            font-size: 10px; 
            letter-spacing: 2.5px; 
            color: ${T.muted}; 
            border-bottom: 2px solid ${T.accent};
          }
          th:first-child { text-align: left; }
          td { 
            padding: 14px 20px; 
            border-bottom: 1px solid ${T.border}; 
            text-align: center; 
            font-size: 13px; 
          }
          td:first-child { text-align: left; font-weight: 600; color: ${T.text}; width: 220px; }
          tr:nth-child(even) td { background: rgba(255,255,255,0.02); }
          .ds-col { background: rgba(74,158,255,0.04) !important; color: ${T.blue} !important; font-weight: bold; }

          /* ── SWITCHING GRID ── */
          .switching-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 72px; }
          .switching-card {
            background: ${T.surface};
            border: 1px solid ${T.border};
            border-radius: 4px;
            padding: 20px;
            text-decoration: none;
            transition: all 0.15s;
          }
          .switching-card:hover { transform: translateY(-2px); border-color: ${T.blue}; }
          .switching-card h5 { font-size: 12px; font-weight: 800; color: ${T.blue}; margin: 0 0 8px 0; letter-spacing: 2px; }
          .switching-card p { font-size: 13px; line-height: 1.5; color: ${T.muted}; margin: 0; }

          /* ── BUTTONS ── */
          .btn-primary {
            padding: 16px 32px;
            background: #1a1a2e;
            border: none;
            border-top: 3px solid ${T.blue};
            color: ${T.blue};
            font-size: 13px;
            letter-spacing: 4px;
            font-weight: bold;
            text-decoration: none;
            display: inline-block;
            border-radius: 6px;
          }
          .btn-secondary {
            padding: 16px 32px;
            background: transparent;
            color: white;
            border: 1px solid #c4c8d0;
            border-top: 3px solid white;
            font-size: 13px;
            letter-spacing: 4px;
            font-weight: bold;
            text-decoration: none;
            display: inline-block;
            border-radius: 6px;
          }

          /* ── CTA ── */
          .final-cta { background: ${T.dark}; padding: 80px 32px; text-align: center; border-top: 2px solid ${T.accent}; }
          .final-cta h2 { font-size: 42px; font-weight: 800; letter-spacing: -1px; margin-bottom: 16px; line-height: 1.1; }
          .final-cta p { font-size: 17px; color: ${T.muted}; max-width: 600px; margin: 0 auto 32px; }

          @media (max-width: 768px) {
            .vs-h1 { font-size: 36px; }
            .failure-grid { grid-template-columns: 1fr; }
            .switching-grid { grid-template-columns: 1fr; }
            .btn-primary, .btn-secondary { width: 100%; text-align: center; }
          }
        `}</style>

        <section className="vs-hero">
          <div className="vs-hero-inner">
            <div className="vs-eyebrow">DIALERSEAT™ VS EVERYONE</div>
            <h1 className="vs-h1">
              The industry is broken.<br />
              <span className="versus">WE FIXED IT.</span>
            </h1>
            <p className="vs-subhead">
              The outbound dialer industry was built by enterprise sales teams for enterprise budgets.
              DialerSeat was built for the people actually making the calls.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href={showSignedIn ? '/dashboard' : '/sign-up'} className="btn-primary">
                {showSignedIn ? 'GO TO DASHBOARD →' : 'GET STARTED →'}
              </Link>
              <Link href="#failures" className="btn-secondary">THE SIX FAILURES</Link>
            </div>
          </div>
        </section>

        <section className="vs-section">
          <div id="failures" className="vs-section-eyebrow">▸ THE VERDICT</div>
          <h2 className="vs-section-h2">Legacy dialers are bloated, dated, and overpriced.</h2>
          <p className="vs-section-lede">
            Most of our customers switch from ReadyMode, Mojo, or Five9 because they&apos;re tired
            of paying for features they don&apos;t use, UI they don&apos;t like, and contracts they can&apos;t escape.
          </p>

          <div className="verdict-card">
            <h3>The DialerSeat Difference</h3>
            <p>
              We took the core predictive and power dialing technology that enterprise tools charge
              hundreds for, stripped away the sales-demo bloat, and packaged it into a modern
              interface that works on any device. Then we priced it at $35/week with no contract.
              It&apos;s not a &quot;budget&quot; alternative — it&apos;s a more capable tool built for a modern workflow.
            </p>
          </div>

          <div className="vs-section-eyebrow">▸ SIX INDUSTRY FAILURES</div>
          <h2 className="vs-section-h2">Why the industry needs a reset.</h2>
          <div className="failure-grid">
            {INDUSTRY_FAILURES.map(f => (
              <div key={f.num} className="failure-card">
                <div className="failure-num">{f.num}</div>
                <div>
                  <h4>{f.title}</h4>
                  <p>{f.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="vs-section-eyebrow">▸ SIDE-BY-SIDE</div>
          <h2 className="vs-section-h2">Every feature. Every competitor.</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>FEATURE</th>
                  <th style={{ color: T.blue }}>DIALERSEAT</th>
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

          <div className="vs-section-eyebrow">▸ SWITCHING FROM...</div>
          <h2 className="vs-section-h2">Direct head-to-heads.</h2>
          <div className="switching-grid">
            {SWITCHING_FROM.map(s => (
              <Link key={s.name} href={s.href || '#'} className="switching-card">
                <h5>{s.name}</h5>
                <p>{s.summary}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="final-cta">
          <div className="vs-hero-inner">
            <h2>STOP PAYING THE LEGACY TAX.</h2>
            <p>
              Join the teams closing more deals for 5x less cost. No contracts, no demos,
              no setup fees. Just a better dialer.
            </p>
            <Link href={showSignedIn ? '/dashboard' : '/sign-up'} className="btn-primary">
              {showSignedIn ? 'GO TO DASHBOARD →' : 'GET STARTED →'}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
