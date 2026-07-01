import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from "next/link"
import SiteFooter from '@/components/site-footer'
import SiteHeader from '@/components/site-header'
import LandingAuthSync from '@/components/LandingAuthSync'

// =============================================================================
// LANDING PAGE — v24 (tenant-aware return-to-dashboard)
// =============================================================================
// v24 change (this revision):
//   When a white-label (Manager+) user views the landing page, middleware
//   now redirects them from their tenant subdomain to dialerseat.com with a
//   `?tenant=<slug>` param attached (see middleware.ts). This page reads
//   that param and, if present, points "GO TO DASHBOARD" / the header's
//   "← DASHBOARD" link back to `https://<slug>.dialerseat.com/dashboard`
//   instead of the relative `/dashboard`, which would otherwise resolve on
//   dialerseat.com and strand the user off their own subdomain.
//
// v23 change (kept):
//   Removed box-shadow glow from all buttons site-wide on this page.
//   Every CTA that previously had `boxShadow: '0 0 Npx rgba(74,158,255,0.N)'`
//   now has no box-shadow. Button backgrounds and colors are unchanged.
//   All other v22 fixes are preserved as-is.
//
// v22 fix (kept):
//   LOGOUT HEADER RACE. export const dynamic = 'force-dynamic' forces a
//   per-request render so auth() is always re-evaluated and the right
//   header renders immediately.
//
// v21.d fixes (kept):
// 1. SITEHEADER NOW SHOWS FOR LOGGED-IN USERS
// 2. HERO PADDING SPLIT INTO TWO CLASSES
//
// MANAGER+ ADDITION (kept):
//    - Manager+ tier ($75/wk, white-label) sits beside Pro.
// =============================================================================

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

  // Tenant slug the user was redirected FROM (set by middleware when a
  // white-label user views the landing page from their own subdomain).
  // Used to send "back to dashboard" links to the right host instead of
  // dialerseat.com/dashboard.
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
        background: 'var(--background)',
        minHeight: isLoggedIn ? 'auto' : '100vh',
        overflowX: 'hidden',
      }}>
      <style>{`
        :root {
          --hero-fs: 80px;
          --section-fs: 36px;
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

        .ds-hero-logged-out {
          padding-top: max(120px, calc(env(safe-area-inset-top, 0px) + 100px));
          padding-bottom: 80px;
          padding-left: 40px;
          padding-right: 40px;
          min-height: 100vh;
        }
        .ds-hero-logged-in {
          padding-top: 40px;
          padding-bottom: 80px;
          padding-left: 40px;
          padding-right: 40px;
        }

        .ds-stats { flex-direction: row; padding: 32px 60px; gap: 48px; }
        .ds-section { padding: 120px 60px; }
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
            --section-fs: 26px;
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

          .ds-hero-logged-out {
            padding-top: max(100px, calc(env(safe-area-inset-top, 0px) + 80px));
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
          .ds-pricing-grid { gap: 16px; padding: 0 8px; }
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
        }
      `}</style>

      {!isLoggedIn && (
        <nav className="ds-nav" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(10,10,15,0.9)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border)',
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
            <Link href="/sign-up" className="ds-nav-link" style={{ fontSize: '12px', letterSpacing: '3px', color: 'white', textDecoration: 'none', padding: '10px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #4a9eff, #2a6eff)', whiteSpace: 'nowrap' }}>GET STARTED</Link>
          </div>
        </nav>
      )}

      <section
        className={isLoggedIn ? 'ds-hero-logged-in' : 'ds-hero-logged-out'}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
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
          $35/WEEK · NO CONTRACTS · CANCEL ANYTIME
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
          maxWidth: '600px',
          marginBottom: '40px',
          padding: '0 8px',
        }}>
          The professional outbound dialer built for <u>ANYONE</u> who lives on the phone. Upload your leads, launch your campaigns, and let DialerSeat do the heavy lifting — for a fraction of what everyone else charges.
        </p>

        <div className="ds-cta-buttons" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '24px',
          maxWidth: 480,
        }}>
          <Link href={ctaHref} style={{
            padding: '16px 40px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 'bold',
            letterSpacing: '3px',
            color: 'white',
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
          }}>
            {ctaLabel}
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
            { number: '5X', label: 'CHEAPER THAN OTHERS' },
            { number: '$0', label: 'SETUP FEES' },
            { number: '∞', label: 'LEADS UPLOADED' },
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
            FOR SALES TEAMS, CALL CENTERS, AGENCIES, AND <u>ANYONE</u> WHO WORKS LEADS.
          </p>
        </div>

        <div className="ds-grid-3" style={{ display: 'grid', gap: '20px' }}>
          {[
            { icon: '⚡', title: 'PREDICTIVE DIALING', desc: 'Multiple leads dialed at once. The first to pick up is yours. Maximum live conversations per hour, every hour.' },
            { icon: '🎙️', title: 'IDENTIFIES VOICEMAIL', desc: 'Stop wasting your day on dead air. DialerSeat knows when a machine answers and skips ahead to the next live human.' },
            { icon: '📋', title: 'MULTIPLE CAMPAIGNS', desc: 'Run unlimited campaigns simultaneously. Upload a CSV, name it, and you are dialing in seconds.' },
            { icon: '🎯', title: 'MEMORY OF MARKED LEADS', desc: 'Every disposition, callback, and note remembers itself. Your work is never lost between sessions or seats.' },
            { icon: '📞', title: 'MANUAL DIALER', desc: 'When you want to control every call yourself, we have you. Click-to-dial individual numbers any time.' },
            { icon: '🏢', title: 'TEAM WORKFLOW', desc: 'Buy seats for your whole crew. Each agent gets their own login, campaigns, and call data — all under one roof.' },
            { icon: '🌎', title: 'WORKS GLOBALLY', desc: 'Dial anywhere on the map. International leads supported with the same simple weekly rate.' },
            { icon: '✨', title: 'CLEAN, PLUG-AND-PLAY UI', desc: 'No bloat, no setup wizard, no learning curve. Sign in, upload, dial. Works on desktop and mobile.' },
            { icon: '🔒', title: 'YOUR DATA, ALWAYS YOURS', desc: 'Your leads stay saved even if your subscription lapses. Pick up right where you left off — no questions asked.' },
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
            FROM ZERO TO DIALING IN UNDER 2 MINUTES.
          </p>
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

      <section id="compare" className="ds-section" style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 style={{
            fontSize: 'var(--section-fs)',
            fontWeight: 'bold',
            letterSpacing: '6px',
            color: 'var(--text-primary)',
            marginBottom: '16px',
          }}>WHY DIALERSEAT</h2>
          <p style={{ fontSize: '12px', letterSpacing: '4px', color: 'var(--text-secondary)' }}>
            THE NUMBERS SPEAK FOR THEMSELVES.
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

        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <Link href="/vs" style={{
            display: 'inline-block',
            padding: '14px 32px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 'bold',
            letterSpacing: '3px',
            color: 'var(--text-primary)',
            textDecoration: 'none',
            border: '1px solid var(--accent-blue)',
            background: 'rgba(74,158,255,0.05)',
          }}>
            SEE ALL COMPARISONS →
          </Link>
        </div>
      </section>

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

        <div className="ds-pricing-grid">

          {/* PRO TIER */}
          <div className="ds-pricing-card" style={{
            borderRadius: '24px',
            background: 'var(--surface)',
            border: '1px solid var(--accent-blue)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '11px',
              letterSpacing: '4px',
              color: 'var(--accent-blue)',
              marginBottom: '24px',
            }}>DIALERSEAT PRO</div>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '64px', fontWeight: 'bold', lineHeight: 1, color: 'var(--text-primary)' }}>$35</span>
              <span style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '10px' }}>/week</span>
            </div>

            <p style={{
              fontSize: '11px',
              letterSpacing: '3px',
              color: 'var(--text-secondary)',
              marginBottom: '16px',
            }}>PER SEAT · BILLED WEEKLY · CANCEL ANYTIME</p>

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

            <Link href={ctaHref} style={{
              display: 'block',
              padding: '16px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 'bold',
              letterSpacing: '3px',
              color: 'white',
              textDecoration: 'none',
              background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
              marginBottom: '16px',
            }}>
              {ctaLabel}
            </Link>
            <p style={{ fontSize: '11px', letterSpacing: '2px', color: 'var(--text-secondary)' }}>
              $35 CHARGED TODAY · CANCEL ANYTIME
            </p>
          </div>

          {/* MANAGER+ TIER */}
          <div className="ds-pricing-card" style={{
            borderRadius: '24px',
            background: 'var(--surface)',
            border: '1px solid var(--accent-blue)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '11px',
              letterSpacing: '4px',
              color: 'var(--accent-blue)',
              marginBottom: '24px',
            }}>DIALERSEAT MANAGER+</div>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '64px', fontWeight: 'bold', lineHeight: 1, color: 'var(--text-primary)' }}>$75</span>
              <span style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '10px' }}>/week</span>
            </div>

            <p style={{
              fontSize: '11px',
              letterSpacing: '3px',
              color: 'var(--text-secondary)',
              marginBottom: '16px',
            }}>PER OWNER · BILLED WEEKLY · CANCEL ANYTIME</p>

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
                    background: 'rgba(74,158,255,0.1)',
                    border: '1px solid var(--accent-blue)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: '10px', color: 'var(--accent-blue)' }}>✓</span>
                  </div>
                  <span style={{
                    fontSize: '13px',
                    letterSpacing: '0.5px',
                    color: 'var(--text-secondary)',
                    fontWeight: i === 0 ? 'bold' : 'normal',
                  }}>{feature}</span>
                </div>
              ))}
            </div>

            <Link href={wlCtaHref} style={{
              display: 'block',
              padding: '16px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 'bold',
              letterSpacing: '3px',
              color: 'white',
              textDecoration: 'none',
              background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
              marginBottom: '16px',
            }}>
              {wlCtaLabel}
            </Link>
            <p style={{ fontSize: '11px', letterSpacing: '2px', color: 'var(--text-secondary)' }}>
              $75 CHARGED TODAY · CANCEL ANYTIME
            </p>
          </div>

        </div>
      </section>

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
          Join the dialer built for the people actually making the calls. No fluff, no bloat, no contracts. Just pure dialing power at a price that makes sense.
        </p>
        <Link href={ctaHref} style={{
          display: 'inline-block',
          padding: '20px 60px',
          borderRadius: '14px',
          fontSize: '14px',
          fontWeight: 'bold',
          letterSpacing: '4px',
          color: 'white',
          textDecoration: 'none',
          background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
        }}>
          {ctaLabel}
        </Link>
        <p style={{ marginTop: '20px', fontSize: '11px', letterSpacing: '3px', color: 'var(--text-secondary)' }}>
          $35/WEEK · NO CONTRACTS · CANCEL ANYTIME
        </p>
      </section>

      <SiteFooter />
      </main>
    </>
  )
}