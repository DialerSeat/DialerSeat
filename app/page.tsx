import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from "next/link"
import SiteFooter from '@/components/site-footer'
import SiteHeader from '@/components/site-header'
import LandingAuthSync from '@/components/LandingAuthSync'
import DialerShowcase from '@/components/DialerShowcase'

interface PageProps {
  searchParams: Promise<{ view?: string; tenant?: string }>
}

export const dynamic = 'force-dynamic'

export default async function Home({ searchParams }: PageProps) {
  const { userId } = await auth()
  const params = await searchParams
  const wantsLanding = params.view === 'landing'

  if (userId && !wantsLanding) {
    redirect('/dashboard')
  }

  const isLoggedIn = !!userId

  const returnTenantSlug = params.tenant || null
  const dashboardBase = returnTenantSlug ? `https://${returnTenantSlug}.dialerseat.com` : ''

  const ctaHref = isLoggedIn ? `${dashboardBase}/dashboard` : '/sign-up'
  const ctaLabel = isLoggedIn ? 'GO TO DASHBOARD' : 'GET STARTED'

  const wlCtaHref = isLoggedIn ? '/billing?plan=wl' : '/sign-up?plan=wl'
  const wlCtaLabel = 'GET MANAGER+'

  return (
    <>
      <LandingAuthSync serverThoughtLoggedIn={isLoggedIn} />

      {isLoggedIn && <SiteHeader tenantSlug={returnTenantSlug} />}

      <main style={{
        background: 'var(--brand-page-bg, #f0f1f4)',
        minHeight: isLoggedIn ? 'auto' : '100vh',
        overflowX: 'hidden',
      }}>
      <style>{`
        :root {
          --hero-fs: 86px;
          --section-fs: 48px;
          --cta-fs: 52px;
        }

        .ds-nav {
          padding-top: max(20px, calc(env(safe-area-inset-top, 0px) + 12px));
          padding-bottom: 20px;
          padding-left: 60px;
          padding-right: 60px;
        }
        .ds-nav-links { display: flex; align-items: center; gap: 40px; }
        .ds-nav-link { display: inline-block; }

        .ds-announce-banner {
          padding: 8px 20px;
        }

        .ds-hero-logged-out {
          padding-top: max(140px, calc(env(safe-area-inset-top, 0px) + 120px));
          padding-bottom: 56px;
          padding-left: 40px;
          padding-right: 40px;
        }
        .ds-hero-logged-in {
          padding-top: 40px;
          padding-bottom: 56px;
          padding-left: 40px;
          padding-right: 40px;
        }

        .ds-hero-grid {
          display: grid;
          grid-template-columns: 1.15fr 1fr;
          grid-template-areas:
            "top        showcase"
            "paragraph  showcase"
            "buttons    showcase";
          column-gap: 56px;
          row-gap: 24px;
          align-items: start;
          max-width: 1280px;
          margin: 0 auto;
        }
        .ds-hero-copy-top { grid-area: top; }
        .ds-hero-copy-paragraph { grid-area: paragraph; }
        .ds-hero-copy-buttons { grid-area: buttons; }
        .ds-hero-showcase { grid-area: showcase; align-self: center; min-width: 0; }

        .ds-showcase-shell { width: 100%; }
        .ds-showcase-scale { width: 100%; }

        .ds-stats { flex-direction: row; padding: 16px 12px; gap: 8px; }
        .ds-section { padding: 90px 60px; }

        #features, #compare, #pricing { scroll-margin-top: 106px; }
        .ds-grid-3 { grid-template-columns: repeat(3, 1fr); }
        .ds-pricing-card { padding: 60px; }
        .ds-cta-buttons { flex-direction: row; }

        .ds-pricing-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 24px;
          justify-content: center;
          align-items: stretch;
          max-width: 960px;
          margin: 0 auto;
          padding: 0 20px;
        }
        .ds-pricing-grid > .ds-pricing-card {
          flex: 1 1 380px;
          max-width: 460px;
          margin: 0;
          display: flex;
          flex-direction: column;
        }

        @media (max-width: 768px) {
          :root {
            --hero-fs: 44px;
            --section-fs: 30px;
            --cta-fs: 32px;
          }
          .ds-nav {
            padding-top: max(14px, calc(env(safe-area-inset-top, 0px) + 8px));
            padding-bottom: 14px;
            padding-left: 20px;
            padding-right: 20px;
          }
          .ds-nav-links { gap: 0; }
          .ds-nav-link { display: none; }
          .ds-nav-link.ds-show-mobile { display: inline-block; }

          .ds-announce-banner {
            padding: 8px 14px !important;
            font-size: 9px !important;
            letter-spacing: 2px !important;
          }

          #features, #compare, #pricing { scroll-margin-top: 90px; }

          .ds-hero-logged-out {
            padding-top: max(140px, calc(env(safe-area-inset-top, 0px) + 120px));
            padding-bottom: 60px;
            padding-left: 20px;
            padding-right: 20px;
          }
          .ds-hero-logged-in {
            padding-top: 24px;
            padding-bottom: 60px;
            padding-left: 20px;
            padding-right: 20px;
          }

          .ds-hero-grid {
            grid-template-columns: 1fr !important;
            grid-template-areas:
              "top"
              "showcase"
              "buttons"
              "paragraph" !important;
            row-gap: 28px !important;
          }

          .ds-showcase-shell {
            width: 100%;
          }
          .ds-showcase-scale {
            width: 640px;
            zoom: 0.5;
          }
          .ds-hero-showcase { width: 100%; }

          .ds-hero-h1 { letter-spacing: -1px !important; line-height: 1.1 !important; }
          .ds-hero-p { font-size: 15px !important; }
          .ds-hero-fineprint { font-size: 10px !important; letter-spacing: 1.5px !important; text-align: center !important; }
          .ds-stats {
            padding: 14px 10px !important;
            gap: 6px !important;
            margin-top: 16px !important;
            width: 100%;
            box-sizing: border-box;
          }
          .ds-stats-num { font-size: 17px !important; }
          .ds-stats-label { font-size: 7px !important; letter-spacing: 1px !important; }
          .ds-section { padding: 60px 20px; }
          .ds-grid-3 { grid-template-columns: 1fr; }
          .ds-pricing-card { padding: 32px 24px !important; }
          .ds-pricing-grid { gap: 16px; padding: 0 8px; }
          .ds-cta-buttons { flex-direction: column; width: 100%; gap: 10px !important; }
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
        }
      `}</style>

      {!isLoggedIn && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }}>
          <nav className="ds-nav" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(26,26,46,0.94)',
            backdropFilter: 'blur(20px)',
            borderBottom: '2px solid #2a4a8a',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>D</span>
              </div>
              <span style={{
                fontSize: '16px',
                fontWeight: 'bold',
                letterSpacing: '4px',
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
              }}>DIALERSEAT</span>
            </div>

            <div className="ds-nav-links">
              <Link href="#features" className="ds-nav-link" style={{ fontSize: '12px', letterSpacing: '3px', color: 'var(--text-secondary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>FEATURES</Link>
              <Link href="#pricing" className="ds-nav-link" style={{ fontSize: '12px', letterSpacing: '3px', color: 'var(--text-secondary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>PRICING</Link>
              <Link href="#compare" className="ds-nav-link" style={{ fontSize: '12px', letterSpacing: '3px', color: 'var(--text-secondary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>COMPARE</Link>
              <Link href="/sign-in" className="ds-nav-link ds-show-mobile" style={{ fontSize: '11px', letterSpacing: '2px', color: 'var(--text-primary)', textDecoration: 'none', padding: '8px 14px', border: '1px solid var(--border)', borderRadius: '8px', whiteSpace: 'nowrap' }}>SIGN IN</Link>
              <Link href="/sign-up" className="ds-nav-link" style={{ fontSize: '12px', letterSpacing: '3px', color: '#4a9eff', textDecoration: 'none', padding: '10px 20px', borderRadius: '6px', background: 'transparent', border: '1px solid #4a9eff', borderTop: '3px solid #4a9eff', whiteSpace: 'nowrap' }}>GET STARTED</Link>
            </div>
          </nav>
          <div className="ds-announce-banner" style={{
            textAlign: 'center',
            background: '#e8eef8',
            borderBottom: '2px solid #2a4a8a',
            color: '#2a4a8a',
            fontSize: '11px',
            letterSpacing: '3px',
            fontWeight: 'bold',
          }}>
            $35/WEEK · NO CONTRACTS · CANCEL ANYTIME
          </div>
        </div>
      )}

      <section className={isLoggedIn ? 'ds-hero-logged-in' : 'ds-hero-logged-out'}>
        <div className="ds-hero-grid">
          <div className="ds-hero-copy-top" style={{ textAlign: 'left' }}>
            <div style={{
              fontSize: '11px',
              letterSpacing: '3px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              color: '#2a4a8a',
              marginBottom: '20px',
            }}>
              ▸ The dialer for people who live on the phone
            </div>

            <h1 className="ds-hero-h1" style={{
              fontSize: 'var(--hero-fs)',
              fontWeight: 'bold',
              letterSpacing: '-3px',
              lineHeight: '1.05',
              maxWidth: '700px',
            }}>
              <span style={{ color: '#1a1c24' }}>DIAL SMARTER.</span>
              <br />
              <span style={{ color: '#2a4a8a' }}>CLOSE FASTER.</span>
            </h1>
          </div>

          <div className="ds-hero-showcase">
            <div className="ds-showcase-shell">
              <div className="ds-showcase-scale">
                <DialerShowcase />
              </div>
            </div>

            <div className="ds-stats" style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: '16px',
              borderRadius: '8px',
              background: '#0e0e16',
              border: '1px solid rgba(255,255,255,0.08)',
              maxWidth: '100%',
              boxSizing: 'border-box',
            }}>
              {[
                { number: '$35', label: 'PER WEEK' },
                { number: '5X', label: 'CHEAPER THAN OTHERS' },
                { number: '$0', label: 'SETUP FEES' },
                { number: '∞', label: 'LEADS UPLOADED' },
              ].map((stat, i) => (
                <div key={i} style={{ textAlign: 'center', flex: 1 }}>
                  <div className="ds-stats-num" style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: '#4a9eff',
                    letterSpacing: '-1px',
                    marginBottom: '4px',
                  }}>{stat.number}</div>
                  <div className="ds-stats-label" style={{
                    fontSize: '9px',
                    letterSpacing: '2px',
                    color: 'rgba(255,255,255,0.55)',
                  }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="ds-hero-copy-paragraph" style={{ textAlign: 'left' }}>
            <p className="ds-hero-p" style={{
              fontSize: '17px',
              lineHeight: '1.7',
              letterSpacing: '0.5px',
              color: 'var(--brand-muted-text, #5a5e6a)',
              maxWidth: '520px',
            }}>
              The professional outbound dialer built for <u>ANYONE</u> who lives on the phone. Upload your leads, launch your campaigns, and let DialerSeat do the heavy lifting — for a fraction of what everyone else charges.
            </p>
          </div>

          <div className="ds-hero-copy-buttons" style={{ textAlign: 'left' }}>
            <div className="ds-cta-buttons" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '24px',
              maxWidth: 480,
            }}>
              <Link href={ctaHref} style={{
                padding: '16px 32px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 'bold',
                letterSpacing: '3px',
                color: '#4a9eff',
                textDecoration: 'none',
                background: '#1a1a2e',
                borderTop: '3px solid #4a9eff',
              }}>
                {ctaLabel} →
              </Link>
              <Link href="#compare" style={{
                padding: '16px 32px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 'bold',
                letterSpacing: '3px',
                color: '#1a1c24',
                textDecoration: 'none',
                background: 'transparent',
                border: '1px solid #c4c8d0',
                borderTop: '3px solid #1a1c24',
              }}>
                SEE HOW WE COMPARE
              </Link>
            </div>

            <p className="ds-hero-fineprint" style={{ fontSize: '11px', letterSpacing: '3px', color: 'var(--brand-muted-text, #5a5e6a)' }}>
              $35/WEEK · NO CONTRACTS · CANCEL ANYTIME
            </p>
          </div>
        </div>
      </section>

      <section style={{ background: 'rgba(226,228,234,0.5)', borderTop: '1px solid #c4c8d0' }}>
        <div className="ds-section" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div id="features" style={{ textAlign: 'center', marginBottom: '100px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '3px', fontWeight: 'bold', textTransform: 'uppercase', color: '#2a4a8a', marginBottom: '16px' }}>
            ▸ Built for volume
          </div>
          <h2 style={{
            fontSize: 'var(--section-fs)',
            fontWeight: 'bold',
            letterSpacing: '-1px',
            lineHeight: '1.15',
            color: '#1a1c24',
            maxWidth: '900px',
            margin: '0 auto',
          }}>
            FOR SALES TEAMS, CALL CENTERS, AGENCIES, AND <u>ANYONE</u> WHO WORKS LEADS.
          </h2>
        </div>

        <div className="ds-grid-3" style={{ display: 'grid', gap: '20px' }}>
          {[
            { icon: '⚡', title: 'PREDICTIVE DIALING', desc: 'Multiple leads dialed at once. The first to pick up is yours. Maximum live conversations per hour, every hour.' },
            { icon: '🎙️', title: 'IDENTIFIES VOICEMAIL', desc: 'Stop wasting your day on dead air. DialerSeat knows when a machine answers and skips ahead to the next live human.' },
            { icon: '📋', title: 'MULTIPLE CAMPAIGNS', desc: 'Run unlimited campaigns simultaneously. Upload a CSV, name it, and you are dialing in seconds.' },
            { icon: '🎯', title: 'MEMORY OF MARKED LEADS', desc: 'Every disposition, callback, and note remembers itself. Your work is never lost between sessions or seats.' },
            { icon: '📞', title: 'MANUAL DIALER', desc: 'When you want to control every call yourself, we have you. Click-to-dial individual numbers any time.' },
            { icon: '🏢', title: 'TEAM WORKFLOW', desc: 'Buy seats for your whole crew. Each agent gets their own login, campaigns, and call data — all under one roof.' },
            { icon: '🌎', title: 'WORKS GLOBALLY', desc: 'Dial US based leads from any country in the world. No increased price jumps for dialing while abroad.' },
            { icon: '✨', title: 'CLEAN, PLUG-AND-PLAY UI', desc: 'No bloat, no setup wizard, no learning curve. Sign in, upload, dial. Works on desktop and mobile.' },
            { icon: '🔒', title: 'YOUR DATA, ALWAYS YOURS', desc: 'Your leads stay saved even if your subscription lapses. Pick up right where you left off — no questions asked.' },
          ].map((f, i) => (
            <div key={i} className="ds-feature-card" style={{
              padding: '36px',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid #c4c8d0',
              borderTop: '3px solid #2a4a8a',
            }}>
              <div style={{ fontSize: '28px', marginBottom: '16px' }}>{f.icon}</div>
              <h3 style={{
                fontSize: '12px',
                fontWeight: 'bold',
                letterSpacing: '3px',
                color: '#1a1c24',
                marginBottom: '12px',
              }}>{f.title}</h3>
              <p style={{
                fontSize: '13px',
                lineHeight: '1.7',
                color: '#5a5e6a',
              }}>{f.desc}</p>
            </div>
          ))}
        </div>
        </div>
      </section>

      <section style={{ borderTop: '1px solid #c4c8d0' }}>
        <div className="ds-section" style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '3px', fontWeight: 'bold', textTransform: 'uppercase', color: '#2a4a8a', marginBottom: '16px' }}>
            ▸ How it works
          </div>
          <h2 style={{
            fontSize: 'var(--section-fs)',
            fontWeight: 'bold',
            letterSpacing: '-1px',
            lineHeight: '1.15',
            color: '#1a1c24',
            maxWidth: '900px',
            margin: '0 auto',
          }}>
            FROM ZERO TO DIALING IN UNDER 2 MINUTES.
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {[
            { step: '01', title: 'CREATE YOUR ACCOUNT', desc: 'Sign up with Google or email. Enter your card and you are dialing in seconds. $35 weekly, cancel anytime.' },
            { step: '02', title: 'UPLOAD YOUR LEADS', desc: 'Drop your CSV into a campaign. Name it, organize it, and have multiple campaigns ready to go simultaneously.' },
            { step: '03', title: 'HIT DIAL AND GO', desc: 'Launch your campaign and DialerSeat starts working immediately. Live connections come through the second someone picks up.' },
            { step: '04', title: 'TRACK AND CLOSE', desc: 'Disposition every call in one click. Track your performance in real time. Rinse and repeat until your list is done.' },
          ].map((step, i) => (
            <div key={i} className="ds-step-card" style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '32px',
              padding: '36px',
              borderRadius: '8px',
              background: '#e2e4ea',
              border: '1px solid #c4c8d0',
              borderLeft: '3px solid #4a9eff',
            }}>
              <div className="ds-step-num" style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: '#4a9eff',
                opacity: 0.35,
                lineHeight: 1,
                flexShrink: 0,
                letterSpacing: '-2px',
              }}>{step.step}</div>
              <div>
                <h3 style={{
                  fontSize: '13px',
                  fontWeight: 'bold',
                  letterSpacing: '3px',
                  color: '#1a1c24',
                  marginBottom: '12px',
                }}>{step.title}</h3>
                <p style={{
                  fontSize: '14px',
                  lineHeight: '1.7',
                  color: '#5a5e6a',
                }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
        </div>
      </section>

      <section style={{ background: 'rgba(226,228,234,0.5)', borderTop: '1px solid #c4c8d0' }}>
        <div className="ds-section" style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div id="compare" style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '3px', fontWeight: 'bold', textTransform: 'uppercase', color: '#2a4a8a', marginBottom: '16px' }}>
            ▸ Why DialerSeat
          </div>
          <h2 style={{
            fontSize: 'var(--section-fs)',
            fontWeight: 'bold',
            letterSpacing: '-1px',
            lineHeight: '1.15',
            color: '#1a1c24',
            maxWidth: '900px',
            margin: '0 auto',
          }}>
            THE NUMBERS SPEAK FOR THEMSELVES.
          </h2>
        </div>

        <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #c4c8d0', background: '#ffffff' }}>
          <div className="ds-compare-header" style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            padding: '20px 32px',
            background: '#1a1a2e',
            borderBottom: '2px solid #2a4a8a',
          }}>
            <div className="ds-compare-cell" style={{ fontSize: '11px', letterSpacing: '3px', color: '#8888aa' }}>FEATURE</div>
            <div className="ds-compare-cell" style={{ fontSize: '11px', letterSpacing: '3px', color: '#4a9eff', textAlign: 'center' }}>DIALERSEAT</div>
            <div className="ds-compare-cell" style={{ fontSize: '11px', letterSpacing: '3px', color: '#8888aa', textAlign: 'center' }}>READYMODE</div>
            <div className="ds-compare-cell" style={{ fontSize: '11px', letterSpacing: '3px', color: '#8888aa', textAlign: 'center' }}>OTHERS</div>
          </div>

          {[
            { feature: 'Weekly Cost', us: '$35', them1: '$199+/mo', them2: '$150+/mo' },
            { feature: 'No Contract', us: '✓', them1: '✗', them2: '✗' },
            { feature: 'Setup Fee', us: '$0', them1: '$0', them2: '$200+' },
            { feature: 'Plug & Play', us: '✓', them1: '✗', them2: '✗' },
            { feature: 'Predictive Dialing', us: '✓', them1: '✓', them2: 'Limited' },
            { feature: 'Identifies Voicemail', us: '✓', them1: '✓', them2: '✗' },
            { feature: 'Manual Dialer', us: '✓', them1: '✗', them2: '✓' },
            { feature: 'Multi Campaign', us: '✓', them1: '✓', them2: '✓' },
            { feature: 'Unlimited Leads', us: '✓', them1: '✓', them2: 'Limited' },
            { feature: 'Memory of Marked Leads', us: '✓', them1: 'Limited', them2: '✗' },
            { feature: 'Data Saved Always', us: '✓', them1: '✗', them2: '✗' },
            { feature: 'Team Workflow', us: '✓', them1: '✓', them2: 'Add-on' },
            { feature: 'Works on Mobile', us: '✓', them1: '✗', them2: '✗' },
            { feature: 'Works Globally', us: '✓', them1: 'US/CA', them2: 'Limited' },
            { feature: 'Satisfaction Priority', us: '✓', them1: '✗', them2: '✗' },
          ].map((row, i, arr) => (
            <div key={i} className="ds-compare-row" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              padding: '16px 32px',
              borderBottom: i < arr.length - 1 ? '1px solid #e2e4ea' : 'none',
              background: i % 2 === 0 ? '#f0f1f4' : '#ffffff',
            }}>
              <div className="ds-compare-cell" style={{ fontSize: '13px', letterSpacing: '1px', color: '#5a5e6a' }}>{row.feature}</div>
              <div className="ds-compare-cell" style={{ fontSize: '13px', fontWeight: 'bold', color: '#4a9eff', textAlign: 'center' }}>{row.us}</div>
              <div className="ds-compare-cell" style={{ fontSize: '13px', color: '#5a5e6a', textAlign: 'center', opacity: 0.6 }}>{row.them1}</div>
              <div className="ds-compare-cell" style={{ fontSize: '13px', color: '#5a5e6a', textAlign: 'center', opacity: 0.6 }}>{row.them2}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <Link href="/vs" style={{
            display: 'inline-block',
            padding: '14px 32px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 'bold',
            letterSpacing: '3px',
            color: '#1a1c24',
            textDecoration: 'none',
            background: 'transparent',
            border: '1px solid #c4c8d0',
            borderTop: '3px solid #2a4a8a',
          }}>
            SEE ALL COMPARISONS →
          </Link>
        </div>
        </div>
      </section>

      <section style={{ borderTop: '1px solid #c4c8d0' }}>
        <div className="ds-section">
        <div id="pricing" style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '3px', fontWeight: 'bold', textTransform: 'uppercase', color: '#2a4a8a', marginBottom: '16px' }}>
            ▸ Simple pricing
          </div>
          <h2 style={{
            fontSize: 'var(--section-fs)',
            fontWeight: 'bold',
            letterSpacing: '-1px',
            lineHeight: '1.15',
            color: '#1a1c24',
            maxWidth: '900px',
            margin: '0 auto',
          }}>
            ONE PLAN. EVERYTHING INCLUDED. NO SURPRISES.
          </h2>
        </div>

        <div className="ds-pricing-grid">

          {/* PRO TIER - highlighted, dark */}
          <div className="ds-pricing-card" style={{
            borderRadius: '8px',
            background: '#1a1a2e',
            border: '1px solid #1a1a2e',
            borderTop: '3px solid #4a9eff',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '11px',
              letterSpacing: '4px',
              color: '#4a9eff',
              marginBottom: '24px',
            }}>DIALERSEAT PRO</div>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '64px', fontWeight: 'bold', lineHeight: 1, color: '#ffffff' }}>$35</span>
              <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>/week</span>
            </div>

            <p style={{
              fontSize: '11px',
              letterSpacing: '3px',
              color: 'rgba(255,255,255,0.6)',
              marginBottom: '16px',
            }}>PER SEAT · BILLED WEEKLY · CANCEL ANYTIME</p>

            <div style={{
              display: 'inline-block',
              padding: '8px 20px',
              borderRadius: '100px',
              background: 'rgba(74,158,255,0.15)',
              border: '1px solid #4a9eff',
              fontSize: '11px',
              letterSpacing: '3px',
              color: '#4a9eff',
              marginBottom: '40px',
            }}>
              FIRST CHARGE TODAY · CANCEL ANYTIME
            </div>

            <div style={{ marginBottom: '40px', textAlign: 'left', flex: 1 }}>
              {[
                'Predictive dialing engine',
                'Voicemail detection',
                'Unlimited outbound calling',
                'Unlimited lead uploads',
                'Multiple simultaneous campaigns',
                'Disposition memory across sessions',
                'Team seat management',
                'Works globally',
                'Your data saved forever',
                'No setup fees ever',
              ].map((feature, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  marginBottom: '16px',
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'rgba(74,158,255,0.15)',
                    border: '1px solid #4a9eff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: '10px', color: '#4a9eff' }}>✓</span>
                  </div>
                  <span style={{ fontSize: '13px', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.75)' }}>{feature}</span>
                </div>
              ))}
            </div>

            <Link href={ctaHref} style={{
              display: 'block',
              padding: '16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 'bold',
              letterSpacing: '3px',
              color: '#4a9eff',
              textDecoration: 'none',
              background: 'transparent',
              border: '1px solid #4a9eff',
              borderTop: '3px solid #4a9eff',
              marginBottom: '16px',
            }}>
              {ctaLabel}
            </Link>
            <p style={{ fontSize: '11px', letterSpacing: '2px', color: 'rgba(255,255,255,0.5)' }}>
              $35 CHARGED TODAY · CANCEL ANYTIME
            </p>
          </div>

          {/* MANAGER+ TIER - white, amber accent */}
          <div className="ds-pricing-card" style={{
            borderRadius: '8px',
            background: '#ffffff',
            border: '1px solid #c4c8d0',
            borderTop: '3px solid #8a6a1a',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '11px',
              letterSpacing: '4px',
              color: '#8a6a1a',
              marginBottom: '24px',
            }}>DIALERSEAT MANAGER+</div>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '64px', fontWeight: 'bold', lineHeight: 1, color: '#1a1c24' }}>$75</span>
              <span style={{ fontSize: '16px', color: '#5a5e6a', marginBottom: '10px' }}>/week</span>
            </div>

            <p style={{
              fontSize: '11px',
              letterSpacing: '3px',
              color: '#5a5e6a',
              marginBottom: '16px',
            }}>PER OWNER · BILLED WEEKLY · CANCEL ANYTIME</p>

            <div style={{
              display: 'inline-block',
              padding: '8px 20px',
              borderRadius: '100px',
              background: '#f7f1e6',
              border: '1px solid #8a6a1a',
              fontSize: '11px',
              letterSpacing: '3px',
              color: '#8a6a1a',
              marginBottom: '40px',
            }}>
              CUSTOMIZE YOUR WHITELABEL DIALER
            </div>

            <div style={{ marginBottom: '40px', textAlign: 'left', flex: 1 }}>
              {[
                'Everything in Pro, plus:',
                'Your own subdomain (you.dialerseat.com)',
                'Upload your logo',
                'Customize brand colors and theme',
                'Branded sign-in for your team',
                'Unlimited team seats under your brand',
                'Your customers see your dialer, not ours',
                'Priority manager-tier support',
              ].map((feature, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  marginBottom: '16px',
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'rgba(138,106,26,0.12)',
                    border: '1px solid #8a6a1a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: '10px', color: '#8a6a1a' }}>✓</span>
                  </div>
                  <span style={{
                    fontSize: '13px',
                    letterSpacing: '0.5px',
                    color: '#5a5e6a',
                    fontWeight: i === 0 ? 'bold' : 'normal',
                  }}>{feature}</span>
                </div>
              ))}
            </div>

            <Link href={wlCtaHref} style={{
              display: 'block',
              padding: '16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 'bold',
              letterSpacing: '3px',
              color: '#ffffff',
              textDecoration: 'none',
              background: '#1a1a2e',
              borderTop: '3px solid #8a6a1a',
              marginBottom: '16px',
            }}>
              {wlCtaLabel}
            </Link>
            <p style={{ fontSize: '11px', letterSpacing: '2px', color: '#5a5e6a' }}>
              $75 CHARGED TODAY · CANCEL ANYTIME
            </p>
          </div>

        </div>
        </div>
      </section>

      <section style={{ background: '#1a1a2e', borderTop: '3px solid #4a9eff' }}>
        <div className="ds-section" style={{
          textAlign: 'center',
          maxWidth: '800px',
          margin: '0 auto',
        }}>
        <h2 className="ds-final-cta-h2" style={{
          fontSize: 'var(--cta-fs)',
          fontWeight: 'bold',
          letterSpacing: '-1px',
          color: '#ffffff',
          marginBottom: '24px',
          lineHeight: '1.1',
        }}>
          STOP PAYING TOO MUCH.<br />
          <span style={{ color: '#4a9eff' }}>START CLOSING MORE.</span>
        </h2>
        <p style={{
          fontSize: '15px',
          letterSpacing: '0.5px',
          color: 'rgba(255,255,255,0.6)',
          marginBottom: '40px',
          lineHeight: '1.7',
        }}>
          Join the dialer built for the people actually making the calls. No fluff, no bloat, no contracts. Just pure dialing power at a price that makes sense.
        </p>
        <Link href={ctaHref} style={{
          display: 'inline-block',
          padding: '20px 60px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 'bold',
          letterSpacing: '4px',
          color: '#4a9eff',
          textDecoration: 'none',
          background: 'transparent',
          border: '1px solid #4a9eff',
          borderTop: '3px solid #4a9eff',
        }}>
          {ctaLabel} →
        </Link>
        <p style={{ marginTop: '20px', fontSize: '11px', letterSpacing: '3px', color: 'rgba(255,255,255,0.5)' }}>
          $35/WEEK · NO CONTRACTS · CANCEL ANYTIME
        </p>
        </div>
      </section>

      <SiteFooter />
      </main>
    </>
  )
}
