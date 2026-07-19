'use client'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'


















const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
  border: '#c4c8d0',
  dark: '#1a1a2e',
  darker: '#0a0a14',
  text: '#1a1c24',
  muted: '#5a5e6a',
  accent: '#2a4a8a',
  blue: '#4a9eff',
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
      <main
        style={{
          background: T.bg,
          minHeight: '100vh',
          fontFamily: 'Futura PT, Futura, sans-serif',
          color: T.text,
        }}
      >
        <style>{`
          .vshub * { box-sizing: border-box; }
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
            position: absolute;
            inset: 0;
            background:
              radial-gradient(circle at 20% 30%, rgba(74,158,255,0.18) 0%, transparent 45%),
              radial-gradient(circle at 80% 60%, rgba(74,158,255,0.12) 0%, transparent 45%);
          }
          .vshub-hero-inner { position: relative; max-width: 880px; margin: 0 auto; }
          .vshub-eyebrow {
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
          .vshub-h1 {
            font-size: 56px;
            letter-spacing: -1.5px;
            line-height: 1.05;
            font-weight: 800;
            margin: 0 0 20px 0;
          }
          .vshub-h1 .accent {
            background: linear-gradient(135deg, ${T.blue}, #a0c4ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          .vshub-subhead {
            font-size: 18px;
            line-height: 1.6;
            color: #c4c8d8;
            max-width: 680px;
            margin: 0 auto 36px;
          }
          .vshub-section {
            max-width: 1180px;
            margin: 0 auto;
            padding: 80px 32px;
          }
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
          .vshub-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
          }
          .vshub-grid .feature-card {
            grid-column: span 2;
          }
          .vshub-card {
            background: white;
            border: 1px solid ${T.border};
            border-radius: 14px;
            padding: 32px;
            text-decoration: none;
            color: ${T.text};
            display: flex;
            flex-direction: column;
            gap: 14px;
            transition: all 0.15s ease;
            position: relative;
            overflow: hidden;
          }
          .vshub-card:hover {
            border-color: ${T.blue};
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(74,158,255,0.12);
          }
          .vshub-card.feature-card {
            border-top: 4px solid ${T.blue};
            background: linear-gradient(135deg, white 0%, #f4f7fc 100%);
          }
          .vshub-card .badge {
            position: absolute;
            top: 16px;
            right: 16px;
            font-size: 9px;
            letter-spacing: 2.5px;
            font-weight: bold;
            color: white;
            background: ${T.blue};
            padding: 4px 10px;
            border-radius: 100px;
          }
          .vshub-card h3 {
            font-size: 22px;
            font-weight: 800;
            letter-spacing: -0.3px;
            color: ${T.text};
            margin: 0;
          }
          .vshub-card .tagline {
            font-size: 12px;
            letter-spacing: 2.5px;
            font-weight: bold;
            color: ${T.blue};
            margin: 0;
          }
          .vshub-card .pitch {
            font-size: 14px;
            line-height: 1.65;
            color: ${T.muted};
            margin: 0;
          }
          .vshub-card .read-more {
            font-size: 11px;
            letter-spacing: 2.5px;
            font-weight: bold;
            color: ${T.blue};
            margin-top: auto;
            padding-top: 8px;
          }
          .vshub-final-cta {
            background: linear-gradient(135deg, ${T.dark}, ${T.darker});
            color: white;
            padding: 80px 32px;
            text-align: center;
          }
          .vshub-final-cta-inner { max-width: 720px; margin: 0 auto; }
          .vshub-final-cta-h2 {
            font-size: 42px;
            font-weight: 800;
            letter-spacing: -0.5px;
            margin: 0 0 16px 0;
            line-height: 1.15;
          }
          .vshub-final-cta-p {
            font-size: 17px;
            color: #c4c8d8;
            line-height: 1.6;
            margin: 0 0 32px 0;
          }
          .vshub-btn-primary {
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

          @media (max-width: 768px) {
            .vshub-hero { padding: 64px 20px 56px; }
            .vshub-h1 { font-size: 36px; }
            .vshub-subhead { font-size: 16px; }
            .vshub-section { padding: 56px 20px; }
            .vshub-section-h2 { font-size: 28px; }
            .vshub-grid { grid-template-columns: 1fr; }
            .vshub-grid .feature-card { grid-column: span 1; }
            .vshub-final-cta { padding: 56px 20px; }
            .vshub-final-cta-h2 { font-size: 30px; }
            .vshub-btn-primary { width: 100%; box-sizing: border-box; }
          }
        `}</style>

        <div className="vshub">
          <div className="vshub-hero">
            <div className="vshub-hero-inner">
              <div className="vshub-eyebrow">COMPARISONS</div>
              <h1 className="vshub-h1">
                Pick your competitor.<br />
                <span className="accent">We'll show you why we win.</span>
              </h1>
              <p className="vshub-subhead">
                Honest, side-by-side breakdowns of DialerSeat™ against every major outbound
                dialer. Pricing, features, what each tool wins at, and who should switch.
                No marketing fluff — just the facts.
              </p>
            </div>
          </div>

          <div className="vshub-section">
            <div className="vshub-section-eyebrow">13 COMPARISONS — MORE COMING SOON</div>
            <h2 className="vshub-section-h2">Every legacy dialer, broken down.</h2>
            <p className="vshub-section-lede">
              We'll keep adding more as our customers ask. Convoso, CallTools, Kixie, JustCall
              are next on the list. Don't see your current dialer? Tell us at{' '}
              <a
                href="mailto:support@dialerseat.com"
                style={{ color: T.blue, textDecoration: 'underline' }}
              >
                support@dialerseat.com
              </a>{' '}
              and we'll prioritize it.
            </p>

            <div className="vshub-grid">
              {COMPARISONS.map((c) => {
                const isFeature = c.slug === 'everyone'
                return (
                  <Link
                    key={c.slug}
                    href={`/vs/${c.slug}`}
                    className={`vshub-card ${isFeature ? 'feature-card' : ''}`}
                  >
                    {c.badge && <div className="badge">{c.badge}</div>}
                    <p className="tagline">{c.tagline}</p>
                    <h3>{c.name}</h3>
                    <p className="pitch">{c.pitch}</p>
                    <div className="read-more">VIEW COMPARISON →</div>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="vshub-section" style={{ paddingTop: 0 }}>
            <div className="vshub-section-eyebrow">FOR TEAMS & AGENCIES</div>
            <h2 className="vshub-section-h2">Manager+ adds whitelabel for $75/month, flat.</h2>
            <p className="vshub-section-lede">
              Running more than one seat, or managing dialing for other people's teams? Manager+
              is a flat $75/month add-on that puts your brand on the platform — same rate whether
              you're managing 2 seats or 200. None of the dialers on this page offer true
              whitelabel; the closest most get is a referral or reseller program that keeps their
              name on the product. Every comparison below breaks down what each competitor
              actually charges to scale a team.
            </p>
          </div>

          <div className="vshub-final-cta">
            <div className="vshub-final-cta-inner">
              <h2 className="vshub-final-cta-h2">Skip the comparison. Just try it.</h2>
              <p className="vshub-final-cta-p">
                $35/seat/week. Cancel anytime. Every feature included. No setup fee, no
                contract, no demos. The fastest way to know if DialerSeat™ beats whatever
                you're using now is to actually use it.
              </p>
              <Link href="/sign-up" className="vshub-btn-primary">
                START DIALING →
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}