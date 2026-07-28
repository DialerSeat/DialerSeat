'use client'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'

const T = {
  bg: '#f0f1f4',
  surface: '#ffffff',
  border: '#c4c8d0',
  dark: '#1a1a2e',
  darker: '#0a0a14',
  text: '#1a1c24',
  muted: '#5a5e6a',
  accent: '#4a9eff',
  accentDark: '#2a4a8a',
}

interface Comparison {
  slug: string
  name: string
  tagline: string
  pitch: string
  badge?: string
}

const COMPARISONS: Comparison[] = [
  {
    slug: 'everyone',
    name: 'EVERY LEGACY DIALER',
    tagline: 'The industry-wide breakdown',
    pitch:
      'Six failures every legacy dialer shares — opaque pricing, annual contracts, dated UI, add-ons, desktop-only, compliance shortcuts. DialerSeat fixes every one at $35/week.',
    badge: 'START HERE',
  },
  {
    slug: 'readymode',
    name: 'VS READYMODE',
    tagline: 'Same predictive at a fraction of the cost',
    pitch:
      'Same multi-line predictive at $35/week, cancel anytime, instead of $199–$249/month locked into a contract. No $500–$2,000 setup fee. Modern UI. Works on phones and tablets where ReadyMode is desktop-only.',
  },
  {
    slug: 'mojo',
    name: 'VS MOJO DIALER',
    tagline: 'Triple-line dialing without the real-estate lock-in',
    pitch:
      'Same triple-line speed across every industry — not just real estate. No mandatory $10/mo Agent Access fee stacked on top of your plan. No $25–$49 data add-ons stacking. Multiple scripts, calendar-aligned analytics — all for $35/week, cancel anytime.',
  },
  {
    slug: 'phoneburner',
    name: 'VS PHONEBURNER',
    tagline: 'Multi-line predictive PhoneBurner doesn\'t have',
    pitch:
      'Multi-line predictive included (PhoneBurner is single-line only). Weekly billing, no annual contract. Per-campaign dialer mode. Flexible list sizes — no forced increments.',
  },
  {
    slug: 'five9',
    name: 'VS FIVE9',
    tagline: 'Enterprise compliance, self-serve setup',
    pitch:
      'Same compliance posture without the enterprise sales cycle. Self-serve setup in minutes, not weeks. Flat $35/week per seat vs Five9\'s $175+ with custom quotes and annual commits.',
  },
  {
    slug: 'wavv',
    name: 'VS WAVV',
    tagline: 'Every dialer mode, one flat price',
    pitch:
      'WAVV charges $59–$149/month depending on which dialer mode you unlock, plus $1/mo per number. DialerSeat is $35/week flat — preview, power, and multi-line predictive all included, no tier to climb.',
  },
  {
    slug: '3cx',
    name: 'VS 3CX',
    tagline: 'Sales dialer vs business phone system',
    pitch:
      '3CX is a real PBX licensed by simultaneous call capacity — not built for outbound sales campaigns. DialerSeat is purpose-built for it: lead lists, dispositions, AMD, and TCPA compliance at $35/week per seat, no capacity planning required.',
  },
  {
    slug: 'hookedcrm',
    name: 'VS HOOKED CRM',
    tagline: 'Named dialer modes vs an unnamed one',
    pitch:
      'Hooked CRM calls itself an all-in-one dialer, but never names a specific dialing mode anywhere on their site. DialerSeat includes Preview, Power, Progressive, and Predictive dialing, named and included, at $35/week — self-serve signup, no demo required.',
  },
  {
    slug: 'convoso',
    name: 'VS CONVOSO',
    tagline: 'Same dialer modes, no seat minimum',
    pitch:
      'Convoso is a genuinely strong predictive dialer built for 20+ seat operations with custom, usage-billed quotes. DialerSeat matches the four dialer modes at a published $35/week per seat — no seat minimum, no demo, no separate carrier billing.',
  },
  {
    slug: 'kixie',
    name: 'VS KIXIE',
    tagline: 'Every dialer mode, one price',
    pitch:
      'Kixie is well-reviewed but tiers dialing power by price — multi-line dialing runs $95+/seat/month, AI voice detection is a $30/mo add-on. DialerSeat includes predictive, power, progressive, and preview dialing at $35/week, one price, no tier to climb.',
  },
  {
    slug: 'justcall',
    name: 'VS JUSTCALL',
    tagline: 'The dialer isn\'t a Pro-tier upsell',
    pitch:
      'JustCall advertises $29/user/month, but the power and predictive dialer sit behind the $49+/month Pro tier, plus a 2-seat minimum on every standard plan. DialerSeat includes every dialer mode at $35/week per seat, one seat minimum: one.',
  },
  {
    slug: 'cloudtalk',
    name: 'VS CLOUDTALK',
    tagline: 'The dialer isn\'t in the $19 seat',
    pitch:
      'CloudTalk\'s cheap headline price doesn\'t include a dialer — Power Dialer is a $15/seat/mo add-on, Parallel Dialer is $39/seat/mo, both stacked on top. DialerSeat includes every dialer mode at $35/week, flat, no add-on required.',
  },
  {
    slug: 'aircall',
    name: 'VS AIRCALL',
    tagline: 'The power dialer isn\'t on the basic plan',
    pitch:
      'Aircall\'s $30 Essentials plan has no Power Dialer, no Salesforce integration, and no call monitoring — all three require the $50 Professional tier, plus a 3-license minimum. DialerSeat includes the dialer at $35/week, no tier upgrade, no seat minimum.',
  },
  {
    slug: 'dialpad',
    name: 'VS DIALPAD',
    tagline: 'The dialer is a separate product',
    pitch:
      'Dialpad Connect\'s phone plans have no power dialer at any tier — it\'s exclusive to a separate product, Dialpad Sell, starting around $39/seat/mo. DialerSeat includes every dialer mode in one product at $35/week, no second purchase required.',
  },
]

export default function VsHubView() {
  return (
    <>
      <SiteHeader />
      <main style={{
        background: T.bg,
        minHeight: '100vh',
        fontFamily: 'Futura PT, Futura, sans-serif',
        color: T.text,
      }}>
        <style>{`
          .vshub * { box-sizing: border-box; }

          /* ── HERO ── */
          .vshub-hero {
            background: linear-gradient(135deg, ${T.darker} 0%, ${T.dark} 100%);
            color: white;
            padding: 100px 32px 80px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .vshub-hero::before {
            content: '';
            position: absolute; inset: 0;
            background:
              radial-gradient(circle at 20% 30%, rgba(74,158,255,0.18) 0%, transparent 45%),
              radial-gradient(circle at 80% 60%, rgba(74,158,255,0.12) 0%, transparent 45%);
          }
          .vshub-hero-inner {
            position: relative;
            max-width: 880px;
            margin: 0 auto;
          }
          .vshub-eyebrow {
            display: inline-block;
            padding: 6px 14px;
            background: rgba(74,158,255,0.15);
            border: 1px solid ${T.accent};
            border-radius: 4px;
            color: ${T.accent};
            font-size: 11px;
            letter-spacing: 3px;
            font-weight: bold;
            margin-bottom: 24px;
          }
          .vshub-hero h1 {
            font-size: 56px;
            font-weight: 800;
            letter-spacing: -1.5px;
            line-height: 1.05;
            margin: 0 0 20px 0;
          }
          .vshub-hero h1 .accent {
            background: linear-gradient(135deg, ${T.accent}, #a0c4ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          .vshub-lead {
            font-size: 18px;
            line-height: 1.6;
            color: #c4c8d8;
            max-width: 680px;
            margin: 0 auto;
          }
          .vshub-verified {
            font-size: 12px;
            color: ${T.muted};
            margin-top: 16px;
          }

          /* ── BODY ── */
          .vshub-body {
            max-width: 1180px;
            margin: 0 auto;
            padding: 80px 32px;
          }

          /* ── SECTION HEADER ── */
          .vshub-section-eyebrow {
            font-size: 11px;
            letter-spacing: 4px;
            color: ${T.muted};
            font-weight: bold;
            margin-bottom: 12px;
            text-align: center;
          }
          .vshub-section-h2 {
            font-size: 36px;
            letter-spacing: -0.5px;
            line-height: 1.15;
            font-weight: 800;
            margin: 0 0 16px 0;
            color: ${T.text};
            text-align: center;
          }
          .vshub-section-lede {
            font-size: 16px;
            color: ${T.muted};
            line-height: 1.65;
            max-width: 680px;
            margin: 0 auto 48px auto;
            text-align: center;
          }
          .vshub-section-lede a {
            color: ${T.accent};
            text-decoration: underline;
          }

          /* ── FEATURED CARD (START HERE) ── */
          .vshub-featured {
            display: block;
            background: linear-gradient(135deg, ${T.dark} 0%, #2a2c44 100%);
            border-radius: 14px;
            padding: 40px 44px;
            text-decoration: none;
            color: white;
            position: relative;
            overflow: hidden;
            margin-bottom: 20px;
            transition: transform 0.15s, box-shadow 0.15s;
            border: 1px solid rgba(255,255,255,0.05);
            border-top: 4px solid ${T.accent};
          }
          .vshub-featured:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 32px rgba(0,0,0,0.22);
            border-color: ${T.accent};
            border-top-color: ${T.accent};
          }
          .vshub-featured::before {
            content: '';
            position: absolute; right: -60px; top: -60px;
            width: 280px; height: 280px;
            background: radial-gradient(circle, rgba(74,158,255,0.2) 0%, transparent 70%);
            pointer-events: none;
          }
          .vshub-featured-badge {
            position: absolute;
            top: 20px; right: 20px;
            font-size: 9px;
            letter-spacing: 2.5px;
            font-weight: bold;
            color: white;
            background: ${T.accent};
            padding: 4px 10px;
            border-radius: 100px;
          }
          .vshub-featured-eyebrow {
            position: relative;
            display: inline-block;
            padding: 4px 10px;
            background: rgba(74,158,255,0.15);
            border: 1px solid ${T.accent};
            border-radius: 4px;
            color: ${T.accent};
            font-size: 9px;
            letter-spacing: 2.5px;
            font-weight: bold;
            margin-bottom: 16px;
          }
          .vshub-featured h2 {
            position: relative;
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -0.5px;
            line-height: 1.15;
            margin: 0 0 14px 0;
            color: white;
          }
          .vshub-featured p {
            position: relative;
            font-size: 15px;
            line-height: 1.7;
            color: #c4c8d8;
            margin: 0 0 20px 0;
            max-width: 600px;
          }
          .vshub-featured-cta {
            position: relative;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
            letter-spacing: 2.5px;
            font-weight: bold;
            color: ${T.accent};
          }

          /* ── COMPARISON GRID ── */
          .vshub-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 14px;
            margin-bottom: 72px;
          }
          .vshub-card {
            background: white;
            border: 1px solid ${T.border};
            border-radius: 14px;
            padding: 28px 32px;
            text-decoration: none;
            color: ${T.text};
            display: flex;
            flex-direction: column;
            gap: 10px;
            transition: all 0.15s ease;
            position: relative;
            overflow: hidden;
          }
          .vshub-card:hover {
            border-color: ${T.accent};
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(74,158,255,0.12);
          }
          .vshub-card .tagline {
            font-size: 11px;
            letter-spacing: 2.5px;
            font-weight: bold;
            color: ${T.accent};
            margin: 0;
          }
          .vshub-card h3 {
            font-size: 20px;
            font-weight: 800;
            letter-spacing: -0.3px;
            color: ${T.text};
            margin: 0;
          }
          .vshub-card .pitch {
            font-size: 14px;
            line-height: 1.65;
            color: ${T.muted};
            margin: 0;
          }
          .vshub-card .read-more {
            font-size: 10px;
            letter-spacing: 2px;
            font-weight: bold;
            color: ${T.accent};
            margin-top: auto;
            padding-top: 8px;
          }

          /* ── TEAMS SECTION ── */
          .vshub-teams-section { margin-bottom: 72px; }

          /* ── CTA ── */
          .vshub-cta {
            background: linear-gradient(135deg, ${T.dark}, ${T.darker});
            color: white;
            padding: 80px 32px;
            text-align: center;
          }
          .vshub-cta-inner { max-width: 720px; margin: 0 auto; }
          .vshub-cta-eyebrow {
            font-size: 11px;
            letter-spacing: 4px;
            color: #8888aa;
            font-weight: bold;
            margin-bottom: 16px;
          }
          .vshub-cta h2 {
            font-size: 42px;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: white;
            margin: 0 0 16px 0;
            line-height: 1.15;
          }
          .vshub-cta p {
            font-size: 17px;
            line-height: 1.6;
            color: #c4c8d8;
            margin: 0 auto 32px;
            max-width: 520px;
          }
          .vshub-btn-primary {
            padding: 16px 32px;
            background: linear-gradient(135deg, ${T.accent}, #2a6eff);
            color: white;
            font-size: 13px;
            letter-spacing: 2.5px;
            font-weight: bold;
            border-radius: 8px;
            text-decoration: none;
            display: inline-block;
            box-shadow: 0 0 24px rgba(74,158,255,0.4);
          }

          /* ── RESPONSIVE ── */
          @media (max-width: 768px) {
            .vshub-hero { padding: 64px 20px 56px; }
            .vshub-hero h1 { font-size: 36px; letter-spacing: -0.5px; }
            .vshub-lead { font-size: 16px; }
            .vshub-body { padding: 56px 20px; }
            .vshub-featured { padding: 28px 24px; }
            .vshub-featured h2 { font-size: 24px; }
            .vshub-section-h2 { font-size: 28px; }
            .vshub-grid { grid-template-columns: 1fr; }
            .vshub-cta { padding: 56px 20px; }
            .vshub-cta h2 { font-size: 30px; }
            .vshub-btn-primary { width: 100%; box-sizing: border-box; text-align: center; }
          }
        `}</style>

        <div className="vshub">

          {/* ── HERO ── */}
          <section className="vshub-hero">
            <div className="vshub-hero-inner">
              <div className="vshub-eyebrow">COMPARISONS</div>
              <h1>
                Pick your competitor.<br />
                <span className="accent">We&apos;ll show you why we win.</span>
              </h1>
              <p className="vshub-lead">
                Honest, side-by-side breakdowns of DialerSeat™ against every major outbound
                dialer. Pricing, features, what each tool wins at, and who should switch.
                No marketing fluff — just the facts.
              </p>
              <p className="vshub-verified">Pricing and features last verified 7/19/26</p>
            </div>
          </section>

          {/* ── BODY ── */}
          <div className="vshub-body">

            {/* FEATURED CARD — START HERE */}
            {(() => {
              const featured = COMPARISONS.find(c => c.slug === 'everyone')!
              return (
                <Link href="/vs/everyone" className="vshub-featured">
                  {featured.badge && (
                    <div className="vshub-featured-badge">{featured.badge}</div>
                  )}
                  <div className="vshub-featured-eyebrow">THE FULL PICTURE</div>
                  <h2>{featured.name}</h2>
                  <p>{featured.pitch}</p>
                  <span className="vshub-featured-cta">
                    READ THE BREAKDOWN →
                  </span>
                </Link>
              )
            })()}

            {/* COMPARISON GRID */}
            <div className="vshub-section-eyebrow" style={{ marginTop: 56 }}>▸ HEAD-TO-HEAD COMPARISONS</div>
            <h2 className="vshub-section-h2">Every legacy dialer, broken down.</h2>
            <p className="vshub-section-lede">
              We&apos;ll keep adding more as our customers ask. Don&apos;t see your current
              dialer?{' '}
              <a href="mailto:support@dialerseat.com">Tell us at support@dialerseat.com</a>{' '}
              and we&apos;ll prioritize it.
            </p>

            <div className="vshub-grid">
              {COMPARISONS.filter(c => c.slug !== 'everyone').map((c) => (
                <Link
                  key={c.slug}
                  href={`/vs/${c.slug}`}
                  className="vshub-card"
                >
                  <p className="tagline">{c.tagline}</p>
                  <h3>{c.name}</h3>
                  <p className="pitch">{c.pitch}</p>
                  <div className="read-more">VIEW COMPARISON →</div>
                </Link>
              ))}
            </div>

            {/* TEAMS SECTION */}
            <div className="vshub-teams-section">
              <div className="vshub-section-eyebrow">▸ FOR TEAMS &amp; AGENCIES</div>
              <h2 className="vshub-section-h2">Manager+ adds whitelabel for $75/week, flat.</h2>
              <p className="vshub-section-lede">
                Running more than one seat, or managing dialing for other people&apos;s teams?
                Manager+ is a flat $75/week upgrade that puts your brand on the platform — same
                rate whether you&apos;re managing 2 seats or 200. None of the dialers on this
                page offer true whitelabel; the closest most get is a referral or reseller
                program that keeps their name on the product. Every comparison above breaks down
                what each competitor actually charges to scale a team.
              </p>
            </div>

          </div>

          {/* ── CTA ── */}
          <section className="vshub-cta">
            <div className="vshub-cta-inner">
              <div className="vshub-cta-eyebrow">▸ SKIP THE COMPARISON</div>
              <h2>Skip the comparison. Just try it.</h2>
              <p>
                $35/seat/week. Cancel anytime. Every feature included. No setup fee, no
                contract, no demos. The fastest way to know if DialerSeat™ beats whatever
                you&apos;re using now is to actually use it.
              </p>
              <Link href="/sign-up" className="vshub-btn-primary">
                START DIALING →
              </Link>
            </div>
          </section>

        </div>
      </main>
      <SiteFooter />
    </>
  )
}
