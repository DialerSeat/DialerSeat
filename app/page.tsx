import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from "next/link"
import SiteFooter from '@/components/site-footer'
import SiteHeader from '@/components/site-header'
import LandingAuthSync from '@/components/LandingAuthSync'
import HashScrollFix from '@/components/HashScrollFix'
import DialerShowcase from '@/components/DialerShowcase'
import JsonLd from '@/components/json-ld'
import { organizationSchema, softwareApplicationSchema } from '@/lib/schema'
import LeadQueueShowcase from '@/components/LeadQueueShowcase'

/**
 * One cell of the comparison table.
 *
 * A tick and a cross are the two values that carry meaning at a glance, so
 * they get colour; everything else is a real figure and is left as text,
 * because "Limited" and "$150+/mo" both say more than a cross would.
 *
 * `ours` changes weight and colour only. It does not change what is claimed:
 * the DialerSeat column loses rows in this table and is supposed to.
 */
function CompareCell({ value, ours = false }: { value: string; ours?: boolean }) {
  const isYes = value === '✓'
  const isNo = value === '✗'
  return (
    <div
      className="ds-compare-cell"
      style={{
        fontSize: isYes || isNo ? '15px' : '13.5px',
        fontWeight: ours && !isNo ? 'bold' : 'normal',
        color: isYes ? '#1a6a1a' : isNo ? '#9aa0ac' : ours ? '#2a4a8a' : '#5a5e6a',
        textAlign: 'center',
      }}
    >
      {value}
    </div>
  )
}

interface PageProps {
  searchParams: Promise<{ view?: string; tenant?: string }>
}

// ── THE HOMEPAGE HAD NO CANONICAL ──────────────────────────────────
// Title, description, Open Graph and the Twitter card all come from the root
// layout, so this page was never bare. What it lacked is the one tag a layout
// cannot supply for you: a self-referencing canonical.
//
// That matters more here than anywhere else on the site. This route reads
// searchParams and is force-dynamic, so /?view=landing and /?tenant=x are
// distinct URLs serving the same page — and every UTM-tagged link anyone has
// ever shared is another one. Without a canonical those are all separately
// crawlable copies of the most important page on the domain, splitting its
// ranking signals across variants that should be consolidating into one.
export const metadata: Metadata = {
  alternates: { canonical: 'https://dialerseat.com' },
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

      {/* Present on every other page, and until now absent from the one

          a search engine is most likely to render as a rich result. */}

      <JsonLd data={organizationSchema()} />

      <JsonLd data={softwareApplicationSchema()} />

      <LandingAuthSync serverThoughtLoggedIn={isLoggedIn} />
      <HashScrollFix />

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

        /* Built-for-volume section: demo left, claim right on desktop.
           On narrow screens it stacks with the HEADLINE FIRST and the panel
           beneath it, a phone visitor needs to be told what they're looking
           at before they see it, where a desktop visitor takes in both at
           once. The DOM order is demo-then-copy for the desktop layout, so
           the mobile order is set with the order property rather than by reordering the
           markup. */
        .ds-volume-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 32px;
          align-items: center;
          text-align: center;
        }
        .ds-volume-demo { order: 2; }
        .ds-volume-copy { order: 1; }
        .ds-volume-demo { max-width: 640px; margin: 0 auto; width: 100%; text-align: left; }
        /* Near full-bleed. The mockup runs the panel to ~80px from the left
           edge and the headline to ~80px from the right; a 1200px (or even
           1720px) centred container can't reach either. */
        /* padding-bottom lives on the two-class rule below, not here: the
           later .ds-section padding shorthand outranks a single-class
           longhand on source order and silently wins. */
        /* ── FULL BLEED, WITH A CEILING ──────────────────────────────────
           This section is deliberately wider than the rest of the page: the
           panel runs inboard of the left edge and the headline out to the
           right margin, which is what makes it read as a spread rather than
           another centred block.

           The ceiling exists only to stop the 192px left inset drifting away
           from the content on a very zoomed-out window, where the viewport
           grows and a fixed inset does not. 1720px is far above any ordinary
           window, so at every normal width this behaves exactly as if it were
           max-width: none. */
        .ds-volume-section { max-width: 1720px; margin-left: auto; margin-right: auto; }

        /* ── WHY 1240px AND NOT 1000px ───────────────────────────────────────
           The two-column layout below has fixed costs that do not shrink:

               192px  left inset
             + 635px  demo column
             +  64px  gap
             +  80px  right inset
             ───────
               971px  before the headline gets a single pixel

           The headline column is minmax(0, 1fr), so it absorbs whatever is
           left, including nothing. At 1000px that left it 29px wide, and at
           1024px (an iPad held vertically, the common case) 47px, against a
           longest word needing 238px at 48px type. The words overflowed the
           column and overflow-x: hidden on <main> sliced them off mid-letter.

           Engaging a layout below the width it can physically occupy is the
           bug; the breakpoint is now set above the fixed costs plus a headline
           column wide enough to read as deliberate. Everything under it uses
           the stacked layout, which was already designed for narrow viewports
           and needs no changes.

           IF YOU CHANGE THE INSETS, THE DEMO WIDTH OR THE GAP, REDO THIS SUM
           AND MOVE THIS BREAKPOINT WITH IT. 1240px is not a device width, it
           is 971px of fixed cost plus ~270px of headline. */
        @media (min-width: 1240px) {
          /* Tight to the section divider. The default 90px top padding pushed
             the whole block ~67px lower than the mockup, which is what dragged
             "BUILT FOR VOLUME" and the headline down with it. */
          .ds-section.ds-volume-section {
            /* Left inset is deliberately much larger than the right: the panel
               sits inboard of the page edge while the headline still runs out
               to the same 80px margin as every other section.

               DO NOT centre this in a 1280px container. That was tried, to
               stop the panel drifting on a zoomed-out window, and it squeezed
               both columns: the panel jumped inward and the headline column
               lost enough width to wrap from three lines to four and run off
               the bottom of the section. The drift is handled by the
               max-width on .ds-volume-section instead, which only engages far
               wider than any normal window. */
            padding-left: 192px; padding-right: 80px; padding-top: 24px;
            /* Tight to the feature cards. The demo and its caption are this
               section's payoff; 90px of trough under them made the cards read
               as an unrelated block rather than the continuation they are. */
            padding-bottom: 24px;
          }
        }
        @media (min-width: 1240px) {
          .ds-volume-grid {
            /* Demo holds a fixed readable width on the left; the headline takes
               everything else. A generous gap is what keeps the two halves from
               reading as one crowded row. */
            grid-template-columns: minmax(0, 635px) minmax(0, 1fr);
            /* Tightened from 162px alongside the larger left inset below. The
               inset pushes the whole grid right; pulling the gap in brings the
               headline back so the PANEL moves a long way and the TEXT barely
               moves, which is the difference between the two mockups. */
            gap: 64px;
            text-align: left;
            /* Top-aligned, not centred. In the mockup the eyebrow sits a fixed
               distance below the panel's top edge rather than floating at its
               vertical middle, centring made the text drift down as the panel
               grew, which is what put "BUILT FOR VOLUME" too low. */
            align-items: start;
          }
          /* Sets how far the headline sits below the panel's top edge. 33px
             put its cap-line ~45px down; the mockup has it ~78px down, so the
             text reads as anchored to the middle of the panel rather than to
             its top. */
          .ds-volume-copy { padding-top: 69px; }
          .ds-volume-demo { margin: 0; max-width: none; order: 1; }
          .ds-volume-copy { order: 2; }
          /* The headline is CENTRED in its column, that's what puts "LEADS."
             on its own centred line rather than ragged-left. */
          .ds-volume-copy { text-align: center; }
        }

        /* ── TABLET NAV ──────────────────────────────────────────────────────
           The full link row is shown from 769px up, but it is spaced for a
           desktop: 60px of side padding and 40px between five links needs
           829px on an 820px iPad, so "GET STARTED" hung off the right edge.
           Only the spacing is reduced here: no link is hidden, because the
           links are the navigation and a tablet is not a phone. Above 1200px
           nothing changes. */
        @media (min-width: 769px) and (max-width: 1199px) {
          .ds-nav { padding-left: 28px; padding-right: 28px; }
          .ds-nav-links { gap: 22px; }
        }

        .ds-stats { flex-direction: row; padding: 16px 12px; gap: 8px; }
        .ds-section { padding: 90px 60px; }

        #features, #compare, #pricing { scroll-margin-top: 135px; }
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

          #features, #compare, #pricing { scroll-margin-top: 115px; }

          .ds-hero-logged-out {
            padding-top: max(122px, calc(env(safe-area-inset-top, 0px) + 105px));
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
          /* The step row stays a ROW on a phone. It used to stack, which was
             right when the number was a large transparent glyph; it is now a
             fixed 52px filled badge, and stacking left it sitting alone above
             the text with the icon orphaned between them. Only the sizes move. */
          .ds-step-card { gap: 14px !important; padding: 16px 14px !important; }
          .ds-step-num { width: 42px !important; height: 42px !important; font-size: 16px !important; }
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
              The professional outbound dialer built for <u>ANYONE</u> who lives on the phone. Upload your leads, launch your campaigns, and let DialerSeat do the heavy lifting, for a fraction of what everyone else charges.
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
        {/* Wider than the 1200px the rest of the section uses. The demo needs
            real width to read, and at 1200 the headline column got squeezed
            into five short lines instead of the three it's written for. */}
        <div className="ds-section ds-volume-section">
        {/* Two columns: the demo on the LEFT, the claim on the RIGHT — the
            mirror of the hero, which runs copy-left / product-right. Alternating
            the sides keeps the page from reading as one long centred column,
            and putting the panel first here means the evidence is what the eye
            lands on when the section says "built for volume".

            NOT wrapped in .ds-showcase-shell/.ds-showcase-scale like the hero
            dialer. That pair pins a 640px inner width and applies zoom: 0.5 on
            mobile, which the hero needs because DialerShowcase has a fixed
            internal layout. This panel is a four-column list that reflows
            cleanly, so it stays fluid and keeps its type at full size —
            halving it would render the rows at ~5px. Its own narrow-viewport
            rules live in components/LeadQueueShowcase.tsx. */}
        <div className="ds-volume-grid" style={{ marginBottom: '32px' }}>
          <div className="ds-volume-demo">
            <LeadQueueShowcase />
            <p style={{
              marginTop: '14px',
              fontSize: '11px',
              letterSpacing: '2px',
              textAlign: 'center',
              color: 'var(--brand-muted-text, #5a5e6a)',
            }}>
              LIVE DEMO &middot; THE QUEUE WORKS ITSELF TOP-DOWN
            </p>
          </div>

          <div className="ds-volume-copy">
            <h2 style={{
              fontSize: 'var(--section-fs)',
              fontWeight: 'bold',
              letterSpacing: '-1px',
              lineHeight: '1.15',
              color: '#1a1c24',
              margin: 0,
            }}>
              FOR SALES TEAMS, CALL CENTERS, AGENCIES, AND <u>ANYONE</u> WHO WORKS LEADS.
            </h2>
          </div>
        </div>
        </div>

        <div className="ds-section" style={{ maxWidth: '1200px', margin: '0 auto', paddingTop: 0 }}>
        {/* Heads the feature cards, the way "Simple pricing" heads the pricing
            cards and "Why DialerSeat" heads the comparison — centred block,
            16px to what follows it, 64px to the grid. It carries the #features
            anchor for the same reason those carry theirs: the label belongs to
            the section it names, so arriving at it lands on the label. */}
        <div id="features" style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '3px', fontWeight: 'bold', textTransform: 'uppercase', color: '#2a4a8a' }}>
            ▸ Built for volume
          </div>
        </div>

        {/* Each card ends in a real link. A feature grid that only asserts
            is a wall of claims; one that offers the page behind each claim
            gives an interested reader somewhere to go, and gives the nine
            most-searched terms on this site an internal link from the
            highest-authority page on the domain. */}
        <div className="ds-grid-3" style={{ display: 'grid', gap: '20px' }}>
          {[
            { icon: '⚡', title: 'PREDICTIVE DIALING', href: '/dialing-modes/predictive', desc: 'Multiple leads dialed at once. The first to pick up is yours. Maximum live conversations per hour, every hour.' },
            { icon: '🎙️', title: 'IDENTIFIES VOICEMAIL', href: '/faq/how-does-amd-work', desc: 'Stop wasting your day on dead air. DialerSeat knows when a machine answers and skips ahead to the next live human.' },
            { icon: '📋', title: 'MULTIPLE CAMPAIGNS', href: '/faq/campaigns', desc: 'Run unlimited campaigns simultaneously. Upload a CSV, name it, and you are dialing in seconds.' },
            { icon: '🎯', title: 'MEMORY OF MARKED LEADS', href: '/faq/leads', desc: 'Every disposition, callback, and note remembers itself. Your work is never lost between sessions or seats.' },
            { icon: '📞', title: 'MANUAL DIALER', href: '/faq/what-is-a-preview-dialer', desc: 'When you want to control every call yourself, we have you. Click-to-dial individual numbers any time.' },
            { icon: '🏢', title: 'TEAM WORKFLOW', href: '/faq/teams-how-it-works', desc: 'Buy seats for your whole crew. Each agent gets their own login, campaigns, and call data, all under one roof.' },
            { icon: '🌎', title: 'WORKS GLOBALLY', href: '/faq/dialer-for-offshore-agents', desc: 'Dial US based leads from any country in the world. No increased price jumps for dialing while abroad.' },
            { icon: '✨', title: 'CLEAN, PLUG-AND-PLAY UI', href: '/faq/mobile', desc: 'No bloat, no setup wizard, no learning curve. Sign in, upload, dial. Works on desktop and mobile.' },
            { icon: '🔒', title: 'YOUR DATA, ALWAYS YOURS', href: '/faq/data-and-recordings', desc: 'Your leads stay saved even if your subscription lapses. Pick up right where you left off, no questions asked.' },
          ].map((f, i) => (
            <div key={i} className="ds-feature-card" style={{
              padding: '30px',
              borderRadius: '4px',
              background: '#ffffff',
              border: '1px solid #c4c8d0',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div style={{ fontSize: '26px', marginBottom: '14px' }}>{f.icon}</div>
              <h3 style={{
                fontSize: '13px',
                fontWeight: 'bold',
                letterSpacing: '1.5px',
                color: '#2a4a8a',
                marginBottom: '12px',
              }}>{f.title}</h3>
              <p style={{
                fontSize: '13.5px',
                lineHeight: '1.65',
                color: '#5a5e6a',
                marginBottom: '18px',
              }}>{f.desc}</p>
              {/* Pushed to the bottom edge so every card's link sits on the
                  same line regardless of how long its description runs. */}
              <Link href={f.href} style={{
                marginTop: 'auto',
                alignSelf: 'flex-end',
                fontSize: '12.5px',
                color: '#2a4a8a',
                textDecoration: 'underline',
              }}>Learn more &raquo;</Link>
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

        {/* One bordered table rather than four floating cards. The steps are
            a sequence, and a shared container with dividers reads as an ordered
            list; four separated cards read as four unrelated options. */}
        <div style={{
          border: '1px solid #c4c8d0',
          borderRadius: '4px',
          background: '#ffffff',
          overflow: 'hidden',
        }}>
          {[
            { step: '01', icon: '👤', title: 'CREATE YOUR ACCOUNT', desc: 'Sign up with Google or email. Enter your card and you are dialing in seconds. $35 weekly, cancel anytime.' },
            { step: '02', icon: '📤', title: 'UPLOAD YOUR LEADS', desc: 'Drop your CSV into a campaign. Name it, organize it, and have multiple campaigns ready to go simultaneously.' },
            { step: '03', icon: '📞', title: 'HIT DIAL AND GO', desc: 'Launch your campaign and DialerSeat starts working immediately. Live connections come through the second someone picks up.' },
            { step: '04', icon: '📊', title: 'TRACK AND CLOSE', desc: 'Disposition every call in one click. Track your performance in real time. Rinse and repeat until your list is done.' },
          ].map((step, i, arr) => (
            <div key={i} className="ds-step-card" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '22px',
              padding: '22px 26px',
              borderBottom: i < arr.length - 1 ? '1px solid #e2e4ea' : 'none',
            }}>
              {/* Filled, not outlined. The number is the strongest thing in
                  the row because the order is the point of the section. */}
              <div className="ds-step-num" style={{
                width: '52px',
                height: '52px',
                flexShrink: 0,
                borderRadius: '4px',
                background: '#2a4a8a',
                color: '#ffffff',
                fontSize: '20px',
                fontWeight: 'bold',
                letterSpacing: '-0.5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>{step.step}</div>
              <div style={{ fontSize: '24px', flexShrink: 0 }} aria-hidden="true">{step.icon}</div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{
                  fontSize: '13px',
                  fontWeight: 'bold',
                  letterSpacing: '1.5px',
                  color: '#2a4a8a',
                  marginBottom: '6px',
                }}>{step.title}</h3>
                <p style={{
                  fontSize: '13.5px',
                  lineHeight: '1.6',
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

        {/* A tick and a cross carry the meaning here, so they are coloured
            rather than left as grey glyphs: green reads as "yes" before the
            eye has finished crossing the row. Anything that is not a tick or a
            cross is a real value and stays as text, because "Limited" and
            "$150+/mo" say more than a cross would. */}
        <div style={{ borderRadius: '4px', overflow: 'hidden', border: '1px solid #c4c8d0', background: '#ffffff' }}>
          <div className="ds-compare-header" style={{
            display: 'grid',
            gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
            padding: '15px 26px',
            background: '#2a4a8a',
          }}>
            <div className="ds-compare-cell" style={{ fontSize: '11px', letterSpacing: '2px', fontWeight: 'bold', color: '#ffffff' }}>FEATURE</div>
            <div className="ds-compare-cell" style={{ fontSize: '11px', letterSpacing: '2px', fontWeight: 'bold', color: '#ffffff', textAlign: 'center' }}>DIALERSEAT</div>
            <div className="ds-compare-cell" style={{ fontSize: '11px', letterSpacing: '2px', fontWeight: 'bold', color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>READYMODE</div>
            <div className="ds-compare-cell" style={{ fontSize: '11px', letterSpacing: '2px', fontWeight: 'bold', color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>OTHERS</div>
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
              gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
              padding: '13px 26px',
              alignItems: 'center',
              borderBottom: i < arr.length - 1 ? '1px solid #e2e4ea' : 'none',
              background: i % 2 === 1 ? '#f6f7f9' : '#ffffff',
            }}>
              <div className="ds-compare-cell" style={{ fontSize: '13.5px', color: '#1a1c24' }}>{row.feature}</div>
              <CompareCell value={row.us} ours />
              <CompareCell value={row.them1} />
              <CompareCell value={row.them2} />
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
