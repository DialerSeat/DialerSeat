import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from "next/link"
import SiteHeader from '@/components/site-header'
import JsonLd from '@/components/json-ld'
import {
  organizationSchema,
  softwareApplicationSchema,
  faqPageSchema,
} from '@/lib/schema'

const LANDING_FAQS = [
  {
    question: 'How much does DialerSeat cost?',
    answer:
      'DialerSeat is $35 per seat per week (about $140/month equivalent). Weekly billing only — no annual contract, no setup fee, no add-on charges. All features included in the base price. Cancel any time.',
  },
  {
    question: 'Can solo agents use DialerSeat, or is it only for teams?',
    answer:
      'Both. DialerSeat is built for solo agents and teams of 1 to 500+ reps. Same product, same $35/week per seat. No minimum team size, no team-only features locked away. Solo agents get the same dialer that 500-seat call centers use.',
  },
  {
    question: 'Does DialerSeat work on phones and tablets?',
    answer:
      'Yes — DialerSeat works fully on phones, tablets, and desktops. Install as a Progressive Web App on iOS or Android, or use the native iOS, Android, macOS, and Windows apps. Field agents dial from an iPad. Solo agents dial from their phone. Manager dashboards run on laptops.',
  },
  {
    question: 'Is DialerSeat TCPA compliant?',
    answer:
      'Yes. DialerSeat enforces TCPA calling windows server-side per lead state (8AM–9PM local time). Every outbound number is carrier-registered (CNAM verified, FCR-clean, A2P 10DLC for SMS). DNC scrubbing on every upload. Full STIR/SHAKEN A-attestation. We respect the laws so you do not get blocked, fined, or sued.',
  },
  {
    question: 'What is predictive dialing?',
    answer:
      'Predictive dialing uses a pacing algorithm to call multiple numbers simultaneously across a team, predicting when agents will become available based on average call durations. Maximizes agent talk time. Designed for teams of 8+ concurrent agents. DialerSeat includes a legal 3% abandon rate cap to stay TCPA-compliant.',
  },
  {
    question: 'Do I have to sign a contract?',
    answer:
      'No. DialerSeat bills weekly and cancellation is one click. No annual commitment, no minimum term, no recovery calls from a customer success rep. Pay $35 this week, cancel before next Monday, owe nothing more.',
  },
  {
    question: 'What industries is DialerSeat for?',
    answer:
      'Any industry that makes outbound calls — insurance (life, health, IUL, veterans benefits), real estate, financial services, B2B SaaS, fundraising, debt resolution, mortgage, solar, home services, recruiting, political campaigning. DialerSeat is industry-agnostic and works the same across all of them.',
  },
]

export default async function Home() {
  const { userId } = await auth()
  if (userId) {
    redirect('/dashboard')
  }

  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={softwareApplicationSchema()} />
      <JsonLd data={faqPageSchema(LANDING_FAQS)} />
      <SiteHeader />
      <main style={{ background: 'var(--background)', minHeight: '100vh', overflowX: 'hidden' }}>
        <style>{`
          :root {
            --hero-fs: 80px;
            --section-fs: 36px;
            --cta-fs: 52px;
          }

          .ds-hero { padding: 80px 40px 80px; }
          .ds-stats { flex-direction: row; padding: 32px 60px; gap: 48px; }
          .ds-section { padding: 120px 60px; }
          .ds-grid-3 { grid-template-columns: repeat(3, 1fr); }
          .ds-pricing-card { padding: 60px; }
          .ds-cta-buttons { flex-direction: row; }

          @media (max-width: 768px) {
            :root {
              --hero-fs: 44px;
              --section-fs: 26px;
              --cta-fs: 32px;
            }
            .ds-hero { padding: 60px 20px 60px; }
            .ds-hero-h1 { letter-spacing: -1px !important; line-height: 1.1 !important; }
            .ds-hero-p { font-size: 15px !important; }
            .ds-stats {
              flex-direction: column;
              padding: 24px 20px;
              gap: 24px;
              margin-top: 60px !important;
              width: 100%;
              box-sizing: border-box;
            }
            .ds-stats-num { font-size: 28px !important; }
            .ds-section { padding: 60px 20px; }
            .ds-grid-3 { grid-template-columns: 1fr; }
            .ds-pricing-card { padding: 32px 24px !important; }
            .ds-cta-buttons { flex-direction: column; width: 100%; }
            .ds-cta-buttons > a { width: 100%; box-sizing: border-box; text-align: center; }
            .ds-feature-card { padding: 28px !important; }
            .ds-step-card { flex-direction: column !important; gap: 12px !important; padding: 28px !important; }
            .ds-step-num { font-size: 36px !important; }
            .ds-compare-row,
            .ds-compare-header {
              grid-template-columns: 1.4fr 0.9fr 0.9fr 0.9fr !important;
              padding: 14px 16px !important;
              gap: 8px;
            }
            .ds-compare-cell { font-size: 11px !important; letter-spacing: 0 !important; }
            .ds-final-cta-h2 { letter-spacing: 0 !important; }
            .ds-faq-item { padding: 20px !important; }
          }
        `}</style>

        {/* HERO */}
        <section className="ds-hero" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 60px)',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 20px',
            borderRadius: '100px',
            border: '1px solid var(--border)',
            color: 'var(--accent-blue)',
            background: 'rgba(74,158,255,0.05)',
            fontSize: '11px',
            letterSpacing: '3px',
            marginBottom: '40px',
            textAlign: 'center',
          }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: 'var(--accent-blue)', flexShrink: 0,
            }}></div>
            $35/WEEK · WORKS ON EVERY DEVICE · 100% COMPLIANT
          </div>

          <h1 className="ds-hero-h1" style={{
            fontSize: 'var(--hero-fs)',
            fontWeight: 'bold',
            letterSpacing: '-2px',
            lineHeight: '1.05',
            marginBottom: '32px',
            maxWidth: '900px',
          }}>
            <span style={{ color: 'var(--text-primary)' }}>DIAL </span>
            <span style={{
              background: 'linear-gradient(135deg, #4a9eff, #a0c4ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>SMARTER.</span>
            <br />
            <span style={{ color: 'var(--text-primary)' }}>CLOSE </span>
            <span style={{ color: 'var(--accent-silver)' }}>FASTER.</span>
          </h1>

          <p className="ds-hero-p" style={{
            fontSize: '18px',
            lineHeight: '1.7',
            letterSpacing: '0.5px',
            color: 'var(--text-secondary)',
            maxWidth: '640px',
            marginBottom: '40px',
            padding: '0 8px',
          }}>
            The professional outbound dialer for solo agents and high-volume teams. Multi-line predictive dialing, mobile-ready, fully compliant. <strong>$35 a week</strong> — for a fraction of what everyone else charges. Insurance, real estate, financial services, every industry welcome.
          </p>

          <div className="ds-cta-buttons" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '24px',
            maxWidth: 480,
          }}>
            <Link href="/sign-up" style={{
              padding: '16px 40px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 'bold',
              letterSpacing: '3px',
              color: 'white',
              textDecoration: 'none',
              background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
              boxShadow: '0 0 40px rgba(74,158,255,0.3)',
            }}>
              GET STARTED
            </Link>
            <Link href="#compare" style={{
              padding: '16px 40px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 'bold',
              letterSpacing: '3px',
              color: 'var(--text-primary)',
              textDecoration: 'none',
              border: '1px solid var(--border)',
            }}>
              SEE HOW WE COMPARE
            </Link>
          </div>

          <p style={{ fontSize: '11px', letterSpacing: '3px', color: 'var(--text-secondary)' }}>
            $35/WEEK · NO CONTRACTS · CANCEL ANYTIME
          </p>

          {/* STATS BAR */}
          <div className="ds-stats" style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: '80px',
            borderRadius: '16px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}>
            {[
              { number: '$35', label: 'PER WEEK' },
              { number: '1.8s', label: 'VOICEMAIL DROP' },
              { number: '$0', label: 'SETUP FEES' },
              { number: '100%', label: 'COMPLIANT' },
            ].map((stat, i) => (
              <div key={i} style={{ textAlign: 'center', flex: 1 }}>
                <div className="ds-stats-num" style={{
                  fontSize: '36px',
                  fontWeight: 'bold',
                  color: 'var(--accent-blue)',
                  letterSpacing: '-1px',
                  marginBottom: '6px',
                }}>{stat.number}</div>
                <div style={{
                  fontSize: '10px',
                  letterSpacing: '3px',
                  color: 'var(--text-secondary)',
                }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="ds-section" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 style={{
              fontSize: 'var(--section-fs)',
              fontWeight: 'bold',
              letterSpacing: '6px',
              color: 'var(--text-primary)',
              marginBottom: '16px',
            }}>BUILT FOR VOLUME</h2>
            <p style={{ fontSize: '12px', letterSpacing: '4px', color: 'var(--text-secondary)' }}>
              FOR SOLO AGENTS, SALES TEAMS, AND CALL CENTERS WHO WORK LEADS ALL DAY.
            </p>
          </div>

          <div className="ds-grid-3" style={{ display: 'grid', gap: '20px' }}>
            {[
              { icon: '⚡', title: 'MULTI-LINE PREDICTIVE', desc: 'Multiple leads dialed at once. The first to pick up is yours. Maximum live conversations per hour. Preview, Power, Progressive, and Predictive modes — configurable per campaign.' },
              { icon: '🎙️', title: 'AMD VOICEMAIL FILTER', desc: 'Drops voicemails in 1.8 seconds before any agent hears a beep. Hardcoded server-side and always on. Reliable detection where competitors miss.' },
              { icon: '📋', title: 'MULTIPLE SCRIPTS PER CAMPAIGN', desc: 'Real estate script, health script, veterans script, IUL script — every team\'s go-to scripts on tabs, one tap away on every call. Add as many as you need per campaign.' },
              { icon: '📱', title: 'WORKS ON EVERY DEVICE', desc: 'Phones, tablets, and desktops. Native iOS, Android, macOS, and Windows apps. Install as a PWA from any browser. Field agents on iPad, solo reps on their phone, manager dashboards on laptop.' },
              { icon: '🔒', title: '100% COMPLIANT — NO SHORTCUTS', desc: 'Every outbound number registered (CNAM, FCR, A2P 10DLC). TCPA windows enforced server-side per lead state. DNC scrubbed on every upload. Full STIR/SHAKEN A-attestation.' },
              { icon: '🏢', title: 'TEAM WORKFLOW', desc: 'Buy seats for your whole team. Each agent gets their own login, campaigns, and call data. Live monitoring, whisper, and barge for coaching new reps in real time.' },
              { icon: '🎯', title: 'LAPSED-USER DATA PRESERVATION', desc: 'Pause your subscription, your data stays. Campaigns, leads, recordings, call history — all preserved. Resubscribe and pick up where you left off. No questions, no charges.' },
              { icon: '🌎', title: 'EVERY INDUSTRY', desc: 'Insurance (life, health, IUL, veterans). Real estate. Financial services. B2B SaaS. Solar. Mortgage. Recruiting. DialerSeat is industry-agnostic — bring your list, we will dial it.' },
              { icon: '✨', title: 'MODERN UI, NO LEARNING CURVE', desc: 'Built fresh this year. No bloat, no setup wizard, no manual to read. Sign up, configure your team, and dial in under 10 minutes.' },
            ].map((f, i) => (
              <div key={i} className="ds-feature-card" style={{
                padding: '36px',
                borderRadius: '16px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: '28px', marginBottom: '16px' }}>{f.icon}</div>
                <h3 style={{
                  fontSize: '12px',
                  fontWeight: 'bold',
                  letterSpacing: '3px',
                  color: 'var(--text-primary)',
                  marginBottom: '12px',
                }}>{f.title}</h3>
                <p style={{
                  fontSize: '13px',
                  lineHeight: '1.7',
                  color: 'var(--text-secondary)',
                }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="ds-section" style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 style={{
              fontSize: 'var(--section-fs)',
              fontWeight: 'bold',
              letterSpacing: '6px',
              color: 'var(--text-primary)',
              marginBottom: '16px',
            }}>HOW IT WORKS</h2>
            <p style={{ fontSize: '12px', letterSpacing: '4px', color: 'var(--text-secondary)' }}>
              FROM SIGNUP TO DIALING IN UNDER 10 MINUTES.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {[
              { step: '01', title: 'CREATE YOUR ACCOUNT', desc: 'Sign up with Google or email. Enter your card and you are dialing in seconds. $35 weekly, cancel anytime, no annual lock-in.' },
              { step: '02', title: 'UPLOAD YOUR LEADS', desc: 'Drop your CSV into a campaign. Our parser auto-detects headers and delimiters. Multiple campaigns run simultaneously. DNC scrubbing happens automatically.' },
              { step: '03', title: 'CONFIGURE SCRIPTS + MODE', desc: 'Set your dialer mode per campaign (Preview, Power, Progressive, Predictive). Add your scripts as tabs — switch mid-call as needed.' },
              { step: '04', title: 'DIAL FROM ANY DEVICE', desc: 'Phone, tablet, laptop — same dialer everywhere. Live connections come through the moment someone picks up. AMD drops voicemails automatically.' },
              { step: '05', title: 'TRACK AND CLOSE', desc: 'Disposition every call in one click. Track performance in real time. Calendar-aligned analytics (Sunday/1st resets) match how teams actually think.' },
            ].map((step, i) => (
              <div key={i} className="ds-step-card" style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '32px',
                padding: '36px',
                borderRadius: '16px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}>
                <div className="ds-step-num" style={{
                  fontSize: '48px',
                  fontWeight: 'bold',
                  color: 'var(--accent-blue)',
                  opacity: 0.3,
                  lineHeight: 1,
                  flexShrink: 0,
                  letterSpacing: '-2px',
                }}>{step.step}</div>
                <div>
                  <h3 style={{
                    fontSize: '13px',
                    fontWeight: 'bold',
                    letterSpacing: '3px',
                    color: 'var(--text-primary)',
                    marginBottom: '12px',
                  }}>{step.title}</h3>
                  <p style={{
                    fontSize: '14px',
                    lineHeight: '1.7',
                    color: 'var(--text-secondary)',
                  }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* COMPARE */}
        <section id="compare" className="ds-section" style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 style={{
              fontSize: 'var(--section-fs)',
              fontWeight: 'bold',
              letterSpacing: '6px',
              color: 'var(--text-primary)',
              marginBottom: '16px',
            }}>WHY DIALERSEAT</h2>
            <p style={{ fontSize: '12px', letterSpacing: '4px', color: 'var(--text-secondary)' }}>
              SIDE-BY-SIDE WITH THE LEGACY DIALERS.
            </p>
          </div>

          <div style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div className="ds-compare-header" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              padding: '20px 32px',
              background: 'var(--surface-2)',
              borderBottom: '1px solid var(--border)',
            }}>
              <div className="ds-compare-cell" style={{ fontSize: '11px', letterSpacing: '3px', color: 'var(--text-secondary)' }}>FEATURE</div>
              <div className="ds-compare-cell" style={{ fontSize: '11px', letterSpacing: '3px', color: 'var(--accent-blue)', textAlign: 'center' }}>DIALERSEAT</div>
              <div className="ds-compare-cell" style={{ fontSize: '11px', letterSpacing: '3px', color: 'var(--text-secondary)', textAlign: 'center' }}>READYMODE</div>
              <div className="ds-compare-cell" style={{ fontSize: '11px', letterSpacing: '3px', color: 'var(--text-secondary)', textAlign: 'center' }}>OTHERS</div>
            </div>

            {[
              { feature: 'Weekly Cost', us: '$35', them1: '$199+/mo', them2: '$150+/mo' },
              { feature: 'Weekly Billing Option', us: '✓', them1: '✗', them2: '✗' },
              { feature: 'No Contract Required', us: '✓', them1: '✗', them2: '✗' },
              { feature: 'Setup Fee', us: '$0', them1: '$0–$2,000', them2: '$200+' },
              { feature: 'Multi-Line Predictive', us: '✓', them1: '✓', them2: 'Limited' },
              { feature: 'Per-Campaign Dialer Mode', us: '✓', them1: '✗', them2: '✗' },
              { feature: 'AMD Voicemail Detection', us: '1.8s', them1: 'Misses', them2: 'Variable' },
              { feature: 'Multiple Scripts per Campaign', us: '✓', them1: '✗', them2: '✗' },
              { feature: 'Live Mid-Call Script Switching', us: '✓', them1: '✗', them2: '✗' },
              { feature: 'Works on Phones + Tablets', us: '✓', them1: '✗', them2: '✗' },
              { feature: 'Native iOS/Android Apps', us: '✓', them1: '✗', them2: '✗' },
              { feature: 'All Numbers Carrier-Registered', us: '✓', them1: 'Inconsistent', them2: 'Variable' },
              { feature: 'TCPA Enforced Server-Side', us: '✓', them1: 'Partial', them2: 'Partial' },
              { feature: 'STIR/SHAKEN A-Attestation', us: '✓', them1: 'Variable', them2: 'Variable' },
              { feature: 'DNC Scrubbing on Upload', us: '✓', them1: '✓', them2: '✓' },
              { feature: 'Solo Agent Friendly', us: '✓', them1: 'Limited', them2: 'Limited' },
              { feature: 'Every Industry', us: '✓', them1: 'Limited', them2: 'Limited' },
              { feature: 'Lapsed-User Data Preservation', us: '✓', them1: '✗', them2: '✗' },
              { feature: 'Calendar-Aligned Analytics', us: '✓', them1: '✗', them2: '✗' },
              { feature: 'Public API + Webhooks', us: '✓', them1: '✗', them2: 'Limited' },
            ].map((row, i, arr) => (
              <div key={i} className="ds-compare-row" style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                padding: '16px 32px',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                background: i % 2 === 0 ? 'var(--surface)' : 'transparent',
              }}>
                <div className="ds-compare-cell" style={{ fontSize: '13px', letterSpacing: '1px', color: 'var(--text-secondary)' }}>{row.feature}</div>
                <div className="ds-compare-cell" style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-blue)', textAlign: 'center' }}>{row.us}</div>
                <div className="ds-compare-cell" style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', opacity: 0.6 }}>{row.them1}</div>
                <div className="ds-compare-cell" style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', opacity: 0.6 }}>{row.them2}</div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '32px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/vs/readymode" style={{
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 'bold',
              letterSpacing: '2px',
              color: 'var(--accent-blue)',
              textDecoration: 'none',
              border: '1px solid var(--accent-blue)',
            }}>
              VS READYMODE →
            </Link>
            <Link href="/vs/mojo" style={{
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 'bold',
              letterSpacing: '2px',
              color: 'var(--accent-blue)',
              textDecoration: 'none',
              border: '1px solid var(--accent-blue)',
            }}>
              VS MOJO DIALER →
            </Link>
            <Link href="/vs/phoneburner" style={{
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 'bold',
              letterSpacing: '2px',
              color: 'var(--accent-blue)',
              textDecoration: 'none',
              border: '1px solid var(--accent-blue)',
            }}>
              VS PHONEBURNER →
            </Link>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="ds-section">
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 style={{
              fontSize: 'var(--section-fs)',
              fontWeight: 'bold',
              letterSpacing: '6px',
              color: 'var(--text-primary)',
              marginBottom: '16px',
            }}>SIMPLE PRICING</h2>
            <p style={{ fontSize: '12px', letterSpacing: '4px', color: 'var(--text-secondary)' }}>
              ONE PLAN. EVERYTHING INCLUDED. NO SURPRISES.
            </p>
          </div>

          <div className="ds-pricing-card" style={{
            maxWidth: '440px',
            margin: '0 auto',
            borderRadius: '24px',
            background: 'var(--surface)',
            border: '1px solid var(--accent-blue)',
            boxShadow: '0 0 80px rgba(74,158,255,0.08)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '11px',
              letterSpacing: '4px',
              color: 'var(--accent-blue)',
              marginBottom: '24px',
            }}>DIALERSEAT</div>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '64px', fontWeight: 'bold', lineHeight: 1, color: 'var(--text-primary)' }}>$35</span>
              <span style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '10px' }}>/seat/week</span>
            </div>

            <p style={{
              fontSize: '11px',
              letterSpacing: '3px',
              color: 'var(--text-secondary)',
              marginBottom: '16px',
            }}>≈ $140/MONTH EQUIVALENT · BILLED WEEKLY</p>

            <div style={{
              display: 'inline-block',
              padding: '8px 20px',
              borderRadius: '100px',
              background: 'rgba(74,158,255,0.1)',
              border: '1px solid var(--accent-blue)',
              fontSize: '11px',
              letterSpacing: '3px',
              color: 'var(--accent-blue)',
              marginBottom: '40px',
            }}>
              CANCEL ANY TIME · NO ANNUAL LOCK-IN
            </div>

            <div style={{ marginBottom: '40px', textAlign: 'left' }}>
              {[
                'Multi-line predictive dialer (4 modes)',
                'AMD voicemail detection in 1.8s',
                'Multiple scripts per campaign',
                'Live monitoring + whisper + barge',
                'Works on phones, tablets, desktops',
                'All numbers carrier-registered',
                'TCPA enforced server-side',
                'STIR/SHAKEN A-attestation',
                'DNC scrubbing on every upload',
                'Unlimited outbound minutes',
                'Unlimited lead uploads',
                'Lapsed-user data preservation',
                'Native iOS / Android / desktop apps',
                'Public API + webhooks',
                'SOC 2 Type II · 99.9% uptime SLA',
              ].map((feature, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  marginBottom: '14px',
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'rgba(74,158,255,0.1)',
                    border: '1px solid var(--accent-blue)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: '10px', color: 'var(--accent-blue)' }}>✓</span>
                  </div>
                  <span style={{ fontSize: '13px', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>{feature}</span>
                </div>
              ))}
            </div>

            <Link href="/sign-up" style={{
              display: 'block',
              padding: '16px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 'bold',
              letterSpacing: '3px',
              color: 'white',
              textDecoration: 'none',
              background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
              boxShadow: '0 0 30px rgba(74,158,255,0.3)',
              marginBottom: '16px',
            }}>
              GET STARTED
            </Link>
            <p style={{ fontSize: '11px', letterSpacing: '2px', color: 'var(--text-secondary)' }}>
              $35 CHARGED TODAY · CANCEL ANYTIME
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="ds-section" style={{ maxWidth: '780px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 style={{
              fontSize: 'var(--section-fs)',
              fontWeight: 'bold',
              letterSpacing: '6px',
              color: 'var(--text-primary)',
              marginBottom: '16px',
            }}>QUESTIONS</h2>
            <p style={{ fontSize: '12px', letterSpacing: '4px', color: 'var(--text-secondary)' }}>
              EVERYTHING WORTH ASKING BEFORE YOU SIGN UP.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {LANDING_FAQS.map((faq, i) => (
              <div key={i} className="ds-faq-item" style={{
                padding: '28px 32px',
                borderRadius: '12px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}>
                <h3 style={{
                  fontSize: '15px',
                  fontWeight: 'bold',
                  letterSpacing: '1px',
                  color: 'var(--text-primary)',
                  marginBottom: '12px',
                  lineHeight: 1.4,
                }}>{faq.question}</h3>
                <p style={{
                  fontSize: '14px',
                  lineHeight: '1.7',
                  color: 'var(--text-secondary)',
                  margin: 0,
                }}>{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="ds-section" style={{
          textAlign: 'center',
          maxWidth: '800px',
          margin: '0 auto',
        }}>
          <h2 className="ds-final-cta-h2" style={{
            fontSize: 'var(--cta-fs)',
            fontWeight: 'bold',
            letterSpacing: '-1px',
            color: 'var(--text-primary)',
            marginBottom: '24px',
            lineHeight: '1.1',
          }}>
            STOP PAYING TOO MUCH.<br />
            <span style={{
              background: 'linear-gradient(135deg, #4a9eff, #a0c4ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>START CLOSING MORE.</span>
          </h2>
          <p style={{
            fontSize: '15px',
            letterSpacing: '0.5px',
            color: 'var(--text-secondary)',
            marginBottom: '40px',
            lineHeight: '1.7',
          }}>
            The dialer built for solo agents and high-volume teams. No fluff, no bloat, no contracts. Just modern, compliant dialing on every device at a price that makes sense.
          </p>
          <Link href="/sign-up" style={{
            display: 'inline-block',
            padding: '20px 60px',
            borderRadius: '14px',
            fontSize: '14px',
            fontWeight: 'bold',
            letterSpacing: '4px',
            color: 'white',
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
            boxShadow: '0 0 60px rgba(74,158,255,0.4)',
          }}>
            GET STARTED
          </Link>
          <p style={{ marginTop: '20px', fontSize: '11px', letterSpacing: '3px', color: 'var(--text-secondary)' }}>
            $35/WEEK · NO CONTRACTS · CANCEL ANYTIME
          </p>
        </section>

        {/* FOOTER */}
        <footer style={{
          padding: '40px 20px',
          textAlign: 'center',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: '12px' }}>D</span>
            </div>
            <span style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '6px', color: 'var(--text-primary)' }}>DIALERSEAT</span>
          </div>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
            <Link href="/vs/readymode" style={{ fontSize: '11px', letterSpacing: '2px', color: 'var(--text-secondary)', textDecoration: 'none' }}>VS READYMODE</Link>
            <Link href="/vs/mojo" style={{ fontSize: '11px', letterSpacing: '2px', color: 'var(--text-secondary)', textDecoration: 'none' }}>VS MOJO</Link>
            <Link href="/vs/phoneburner" style={{ fontSize: '11px', letterSpacing: '2px', color: 'var(--text-secondary)', textDecoration: 'none' }}>VS PHONEBURNER</Link>
            <Link href="/dialing-modes" style={{ fontSize: '11px', letterSpacing: '2px', color: 'var(--text-secondary)', textDecoration: 'none' }}>DIALING MODES</Link>
          </div>
          <p style={{ fontSize: '11px', letterSpacing: '3px', color: 'var(--text-secondary)' }}>
            © {new Date().getFullYear()} DIALERSEAT · ALL RIGHTS RESERVED
          </p>
        </footer>
      </main>
    </>
  )
}