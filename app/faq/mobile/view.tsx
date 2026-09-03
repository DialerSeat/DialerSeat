'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useUser } from '@clerk/nextjs'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import FaqTheme from '@/components/faq-theme'
import { SITE } from '@/lib/siteTheme'


type Slide = { src: string; alt: string; caption: string; isJpg?: boolean }

const MOBILE_SLIDES: Slide[] = [
  {
    src: '/faq-images/regular-mobile/landing-page.jpg',
    alt: 'DialerSeat marketing landing page on mobile, before signing in',
    caption: 'The landing page on mobile, this is what a new visitor sees before ever signing up. Fully responsive, no separate mobile site.',
    isJpg: true,
  },
  {
    src: '/faq-images/regular-mobile/sidebar-nav.png',
    alt: 'DialerSeat mobile sidebar navigation, standard Pro plan account',
    caption: 'The sidebar on a standard Pro account: Analytics, Dialer, Campaigns, Recordings, Leads, Teams, Settings. Same navigation as desktop, same permissions.',
  },
  {
    src: '/faq-images/regular-mobile/dialer-progressive.png',
    alt: 'DialerSeat mobile dialer terminal running in progressive mode',
    caption: 'The dialer terminal, running progressive mode with a live campaign selected. Full status, duration, connected rate, and mode readouts, nothing trimmed down for the smaller screen.',
  },
  {
    src: '/faq-images/regular-mobile/analytics-overview.png',
    alt: 'DialerSeat mobile analytics overview showing real call data',
    caption: 'The analytics overview with real dialing history: total calls, hours dialed, conversions, and the call-volume chart, all on a phone screen.',
  },
]

function MobileCarousel() {
  const [idx, setIdx] = useState(0)
  const slide = MOBILE_SLIDES[idx]
  const go = (d: number) =>
    setIdx((i) => (i + d + MOBILE_SLIDES.length) % MOBILE_SLIDES.length)

  return (
    <div className="mob-carousel">
      <div className="mob-carousel-frame">
        <button className="mob-carousel-arrow left" onClick={() => go(-1)} aria-label="Previous screenshot">‹</button>
        <div className="mob-phone-shell">
          <div className="mob-phone-notch" />
          <div className="mob-phone-imgwrap">
            <Image
              key={slide.src}
              src={slide.src}
              alt={slide.alt}
              fill
              sizes="(max-width: 768px) 70vw, 280px"
              style={{ objectFit: 'cover', objectPosition: 'top' }}
              priority={idx === 0}
            />
          </div>
        </div>
        <button className="mob-carousel-arrow right" onClick={() => go(1)} aria-label="Next screenshot">›</button>
      </div>
      <p className="mob-carousel-caption">{slide.caption}</p>
      <div className="mob-carousel-dots">
        {MOBILE_SLIDES.map((s, i) => (
          <button
            key={s.src}
            className={`mob-dot ${i === idx ? 'active' : ''}`}
            onClick={() => setIdx(i)}
            aria-label={`Go to screenshot ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

export default function MobileFaqView() {
  const { isSignedIn } = useUser()

  return (
    <>
      <SiteHeader />
      <div
        style={{
          flex: 1,
          background: SITE.bg,
          minHeight: 'calc(100vh - 64px)',
          fontFamily: 'Futura PT, Futura, sans-serif',
          color: SITE.text,
        }}
      >
        <FaqTheme />
        <style>{`
/* STRONG RECOMMENDATION CALLOUT */
          .mob-recommend {
            margin: 28px 0; padding: 26px 28px; background: ${SITE.ink};
            border-radius: 8px; border-left: 4px solid #4a9eff;
          }
          .mob-recommend-eyebrow {
            font-size: 10px; letter-spacing: 3px; color: #7ab8ff;
            font-weight: bold; margin-bottom: 10px;
          }
          .mob-recommend p { color: #e0e2ea; font-size: 15.5px; line-height: 1.7; margin: 0; }
          .mob-recommend strong { color: white; }

          /* PORTRAIT CAROUSEL */
          .mob-carousel { margin: 32px 0 8px; display: flex; flex-direction: column; align-items: center; }
          .mob-carousel-frame {
            position: relative; display: flex; align-items: center; justify-content: center;
            gap: 18px; width: 100%;
          }
          .mob-phone-shell {
            position: relative; width: 220px; aspect-ratio: 1125 / 2436;
            background: #000; border-radius: 28px; overflow: hidden;
            border: 6px solid #111; box-shadow: 0 24px 60px rgba(20,20,40,0.25);
          }
          .mob-phone-notch {
            position: absolute; top: 0; left: 50%; transform: translateX(-50%);
            width: 40%; height: 18px; background: #111; border-radius: 0 0 12px 12px;
            z-index: 3;
          }
          .mob-phone-imgwrap { position: absolute; inset: 0; }
          .mob-carousel-arrow {
            width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
            background: ${SITE.surface}; color: ${SITE.text}; border: 1px solid ${SITE.border};
            font-size: 20px; line-height: 1; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: background 0.15s;
          }
          .mob-carousel-arrow:hover { background: ${SITE.surface}; }
          .mob-carousel-caption {
            font-size: 13.5px; line-height: 1.6; color: ${SITE.muted};
            margin: 16px 4px 0; text-align: center; max-width: 420px;
          }
          .mob-carousel-dots { display: flex; justify-content: center; gap: 8px; margin-top: 16px; }
          .mob-dot {
            width: 8px; height: 8px; border-radius: 50%; border: none;
            background: ${SITE.border}; cursor: pointer; padding: 0;
            transition: background 0.15s, transform 0.15s;
          }
          .mob-dot.active { background: ${SITE.deep}; transform: scale(1.3); }

          /* INSTALL STEPS */
          .mob-install-grid {
            display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 24px 0;
          }
          .mob-install-card {
            background: ${SITE.surface}; border: 1px solid ${SITE.border}; border-radius: 8px;
            padding: 24px 24px;
          }
          .mob-install-platform {
            display: flex; align-items: center; gap: 8px; margin-bottom: 16px;
          }
          .mob-install-platform .icon {
            width: 28px; height: 28px; border-radius: 6px; display: flex;
            align-items: center; justify-content: center; font-size: 13px;
            font-weight: 800; color: white; flex-shrink: 0;
          }
          .mob-install-platform.ios .icon { background: #1a1a2e; }
          .mob-install-platform.android .icon { background: #1a6a1a; }
          .mob-install-platform span.name { font-size: 15px; font-weight: 700; }
          .mob-install-card ol { margin: 0; padding-left: 20px; }
          .mob-install-card li {
            font-size: 14.5px; line-height: 1.65; margin-bottom: 10px; color: ${SITE.text};
          }
          .mob-install-card li:last-child { margin-bottom: 0; }
          .mob-install-card code {
            background: ${SITE.surface}; padding: 1px 6px; border-radius: 3px;
            font-size: 13px; font-family: monospace;
          }@media (max-width: 768px) {
            .mob-phone-shell { width: 150px; }
            .mob-carousel-arrow { width: 30px; height: 30px; font-size: 16px; }
            .mob-install-grid { grid-template-columns: 1fr; }
          }
        `}</style>

        <article className="faq-root">
          <div className="faq-eyebrow">▸ DIALERSEAT ON YOUR PHONE</div>
          <span style={{ fontSize: 11, color: '#8888aa', letterSpacing: '2px', display: 'block', marginBottom: 16 }}>LAST UPDATED 07/28/2026</span>

          <h1 className="faq-h1">
            The full dialer. Installed to your <em>home screen.</em>
          </h1>

          <p className="faq-deck">
            DialerSeat runs as a complete Progressive Web App (PWA) on
            mobile: the same terminal, the same analytics, the same teams
            tools you get on desktop, installed to your phone in under a
            minute. No App Store, no separate download, no stripped-down
            &ldquo;mobile version.&rdquo;
          </p>

          <div className="faq-badge-row">
            <span className="faq-badge hi">FREE ON EVERY PLAN</span>
            <span className="faq-badge">NO APP STORE REQUIRED</span>
            <span className="faq-badge">INSTALLS IN UNDER A MINUTE</span>
            <span className="faq-badge">SAME FEATURES AS DESKTOP</span>
          </div>

          {/* ── STRONGLY RECOMMENDED ───────────────────────────────────────── */}
          <div className="mob-recommend">
            <div className="mob-recommend-eyebrow">▸ BEFORE YOU DIAL FROM YOUR PHONE</div>
            <p>
              <strong>We strongly recommend installing the PWA rather than
              using DialerSeat in a regular browser tab</strong> if you plan
              to dial from mobile at all. Installed mode runs full-screen
              with no browser address bar eating into your screen space,
              launches instantly from your home screen instead of requiring
              you to navigate back to the site, and keeps your session
              persistent instead of getting reloaded every time your browser
              app gets backgrounded by iOS or Android. If you&apos;re going
              to run a shift from your phone, install it first, it takes
              under a minute and the instructions are right below.
            </p>
          </div>

          {/* ── SEE IT ─────────────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ SEE IT RUNNING</h2>
            <p>
              Real screenshots, standard Pro plan, no white-labeling, this
              is exactly what every DialerSeat account gets on mobile.
            </p>

            <MobileCarousel />
          </section>

          {/* ── HOW TO INSTALL ─────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ HOW TO INSTALL IT</h2>
            <p>
              &ldquo;Installing&rdquo; a PWA doesn&apos;t mean an app store
              download, it means telling your phone&apos;s browser to save
              a home-screen shortcut that opens full-screen, with no address
              bar. Here&apos;s exactly how, on both platforms.
            </p>

            <div className="mob-install-grid">
              <div className="mob-install-card">
                <div className="mob-install-platform ios">
                  <div className="icon">i</div>
                  <span className="name">iPHONE (SAFARI)</span>
                </div>
                <ol>
                  <li>Open <code>dialerseat.com</code> in <strong>Safari</strong> (this only works in Safari, not Chrome, on iOS: that&apos;s an Apple restriction, not ours).</li>
                  <li>Sign in to your account.</li>
                  <li>Tap the <strong>Share</strong> icon in the bottom toolbar (the square with an arrow pointing up).</li>
                  <li>Scroll down and tap <strong>&ldquo;Add to Home Screen.&rdquo;</strong></li>
                  <li>Tap <strong>&ldquo;Add&rdquo;</strong> in the top-right corner.</li>
                  <li>The DialerSeat icon now sits on your home screen: tap it any time to launch full-screen, already signed in.</li>
                </ol>
              </div>

              <div className="mob-install-card">
                <div className="mob-install-platform android">
                  <div className="icon">A</div>
                  <span className="name">ANDROID (CHROME)</span>
                </div>
                <ol>
                  <li>Open <code>dialerseat.com</code> in <strong>Chrome</strong>.</li>
                  <li>Sign in to your account.</li>
                  <li>Tap the <strong>three-dot menu</strong> in the top-right corner.</li>
                  <li>Tap <strong>&ldquo;Install app&rdquo;</strong> or <strong>&ldquo;Add to Home screen&rdquo;</strong> (wording varies slightly by Chrome version).</li>
                  <li>Confirm by tapping <strong>&ldquo;Install.&rdquo;</strong></li>
                  <li>The DialerSeat icon now sits on your home screen and in your app drawer, launching full-screen like any other installed app.</li>
                </ol>
              </div>
            </div>

            <p className="muted">
              Once installed, updates happen automatically in the background
 the same way the website updates. There&apos;s nothing to
              manually update and no separate release you&apos;re waiting
              on.
            </p>
          </section>

          {/* ── WHAT YOU GET ───────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ WHAT&apos;S ACTUALLY THERE ON MOBILE</h2>
            <p>
              Nothing is held back for the smaller screen. Everything a
              Pro-plan account gets on desktop is present and fully
              functional on mobile:
            </p>
            <ul>
              <li><strong>Full dialer terminal</strong>: all four dialer modes, manual dial pad, live campaign selection, lead profile view</li>
              <li><strong>Analytics overview</strong>: the same call volume, conversion rate, disposition breakdown, and campaign performance panels as desktop</li>
              <li><strong>Campaigns, Recordings, and Leads</strong>: browse, manage, and review from your phone exactly like you would at a desk</li>
              <li><strong>Teams</strong>: for Manager+ accounts, the same team management tools carry over too; see <Link href="/faq/white-label-mobile">white-label on mobile</Link> if you&apos;re running a branded account</li>
              <li><strong>Settings</strong>: account and campaign configuration, unchanged from desktop</li>
            </ul>
            <p className="muted">
              The one place mobile intentionally trades convenience for
              practicality is dense side-by-side views, the desktop app&apos;s
              multi-window layout (analytics and teams open next to each
              other) doesn&apos;t translate to a phone screen, so those stay
              single-view on mobile and swap via the sidebar instead.
            </p>
          </section>

          {/* ── HONEST LIMITATION ──────────────────────────────────────────── */}
          <div className="faq-callout">
            <p>
              <strong>One honest note: </strong> like any PWA, this
              isn&apos;t a listing in the App Store or Play Store, so there&apos;s
              no storefront search visibility and iOS in particular restricts
              installation to Safari specifically (Chrome and other iOS
              browsers can&apos;t trigger the install prompt, that&apos;s
              an Apple platform rule, not a DialerSeat limitation). For
              actually running your dialer day to day, none of that changes
              the experience once it&apos;s installed.
            </p>
          </div>

          {/* ── RELATED ────────────────────────────────────────────────────── */}
          <div className="faq-related">
            <div className="faq-related-label">▸ RELATED READING</div>
            <div className="faq-related-links">
              <Link href="/faq/white-label-mobile">White-label on mobile</Link>
              <Link href="/faq/manager-plus">What Manager+ adds over Pro</Link>
              <Link href="/faq/why-dialerseat">Why I built DialerSeat</Link>
              <Link href="/faq/dialerseat-teams">DialerSeat for teams</Link>
              <Link href="/faq">FAQ</Link>
            </div>
          </div>

          {/* ── CTA ──────────────────────────────────────────────────────────  */}
          <div className="faq-cta">
            <div className="faq-cta-eyebrow">▸ TRY IT ON YOUR PHONE RIGHT NOW</div>
            <h3 className="faq-cta-h">$35/week. No contract. Cancel any time.</h3>
            <p>
              Sign up, sign in on your phone&apos;s browser, and install it
              to your home screen in the next sixty seconds.
            </p>
            <a href={isSignedIn ? '/dashboard/dialer' : '/sign-up'} className="faq-cta-btn">
              {isSignedIn ? 'GO TO DIALER →' : 'GET STARTED →'}
            </a>
          </div>
        </article>
      </div>
      <SiteFooter />
    </>
  )
}
