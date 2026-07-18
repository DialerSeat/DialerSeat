'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useUser } from '@clerk/nextjs'

const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
  border: '#c4c8d0',
  dark: '#1a1a2e',
  text: '#1a1c24',
  muted: '#5a5e6a',
  accent: '#2a4a8a',
  blue: '#4a9eff',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}

type Slide = { src: string; alt: string; caption: string; isJpg?: boolean }

const MOBILE_SLIDES: Slide[] = [
  {
    src: '/faq-images/regular-mobile/landing-page.jpg',
    alt: 'DialerSeat marketing landing page on mobile, before signing in',
    caption: 'The landing page on mobile — this is what a new visitor sees before ever signing up. Fully responsive, no separate mobile site.',
    isJpg: true,
  },
  {
    src: '/faq-images/regular-mobile/sidebar-nav.png',
    alt: 'DialerSeat mobile sidebar navigation, standard Pro plan account',
    caption: 'The sidebar on a standard Pro account — Analytics, Dialer, Campaigns, Recordings, Leads, Teams, Settings. Same navigation as desktop, same permissions.',
  },
  {
    src: '/faq-images/regular-mobile/dialer-progressive.png',
    alt: 'DialerSeat mobile dialer terminal running in progressive mode',
    caption: 'The dialer terminal, running progressive mode with a live campaign selected. Full status, duration, connected rate, and mode readouts — nothing trimmed down for the smaller screen.',
  },
  {
    src: '/faq-images/regular-mobile/analytics-overview.png',
    alt: 'DialerSeat mobile analytics overview showing real call data',
    caption: 'The analytics overview with real dialing history — total calls, hours dialed, conversions, and the call-volume chart, all on a phone screen.',
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
    <div
      style={{
        flex: 1,
        background: T.bg,
        minHeight: 'calc(100vh - 64px)',
        fontFamily: 'Futura PT, Futura, sans-serif',
        color: T.text,
      }}
    >
      <style>{`
        .mob-root { max-width: 820px; margin: 0 auto; padding: 80px 32px 120px; }
        .mob-eyebrow {
          font-size: 11px; letter-spacing: 4px; color: ${T.muted};
          font-weight: bold; margin-bottom: 18px;
        }
        .mob-h1 {
          font-size: 42px; line-height: 1.15; letter-spacing: -0.5px;
          font-weight: 700; margin: 0 0 24px 0;
        }
        .mob-h1 em { font-style: normal; color: ${T.blue}; }
        .mob-deck {
          font-size: 19px; line-height: 1.6; color: ${T.muted};
          margin-bottom: 40px; max-width: 680px;
        }
        .mob-badge-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 56px; }
        .mob-badge {
          padding: 8px 16px; border-radius: 20px; font-size: 12px;
          font-weight: bold; letter-spacing: 1px; border: 1px solid ${T.border};
          background: white; color: ${T.text};
        }
        .mob-badge.hi { background: ${T.dark}; color: #7ab8ff; border-color: ${T.dark}; }

        .mob-section { margin: 56px 0; }
        .mob-section h2 {
          font-size: 13px; letter-spacing: 3px; font-weight: bold;
          color: ${T.accent}; margin: 0 0 18px 0;
          padding-bottom: 10px; border-bottom: 1px solid ${T.border};
        }
        .mob-section h3 {
          font-size: 22px; line-height: 1.3; font-weight: 700;
          margin: 28px 0 14px 0; letter-spacing: -0.2px;
        }
        .mob-section p {
          font-size: 16px; line-height: 1.75; margin: 0 0 18px 0;
          color: ${T.text};
        }
        .mob-section p.muted { color: ${T.muted}; font-size: 15px; }
        .mob-section strong { color: ${T.text}; font-weight: 700; }
        .mob-section ul { margin: 14px 0 24px 0; padding-left: 22px; }
        .mob-section li { font-size: 16px; line-height: 1.75; margin-bottom: 8px; }

        /* STRONG RECOMMENDATION CALLOUT */
        .mob-recommend {
          margin: 28px 0; padding: 26px 28px; background: ${T.dark};
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
          background: white; color: ${T.text}; border: 1px solid ${T.border};
          font-size: 20px; line-height: 1; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .mob-carousel-arrow:hover { background: ${T.surface}; }
        .mob-carousel-caption {
          font-size: 13.5px; line-height: 1.6; color: ${T.muted};
          margin: 16px 4px 0; text-align: center; max-width: 420px;
        }
        .mob-carousel-dots { display: flex; justify-content: center; gap: 8px; margin-top: 16px; }
        .mob-dot {
          width: 8px; height: 8px; border-radius: 50%; border: none;
          background: ${T.border}; cursor: pointer; padding: 0;
          transition: background 0.15s, transform 0.15s;
        }
        .mob-dot.active { background: ${T.accent}; transform: scale(1.3); }

        /* INSTALL STEPS */
        .mob-install-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 24px 0;
        }
        .mob-install-card {
          background: white; border: 1px solid ${T.border}; border-radius: 8px;
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
          font-size: 14.5px; line-height: 1.65; margin-bottom: 10px; color: ${T.text};
        }
        .mob-install-card li:last-child { margin-bottom: 0; }
        .mob-install-card code {
          background: ${T.surface}; padding: 1px 6px; border-radius: 3px;
          font-size: 13px; font-family: monospace;
        }

        .mob-callout {
          margin: 32px 0; padding: 22px 26px; background: ${T.surface};
          border-left: 3px solid ${T.blue}; border-radius: 4px;
        }
        .mob-callout p { font-size: 15px; line-height: 1.7; margin: 0; color: ${T.text}; }
        .mob-callout strong { color: ${T.accent}; }

        .mob-related {
          margin-top: 48px; padding-top: 28px; border-top: 1px solid ${T.border};
        }
        .mob-related-label {
          font-size: 10px; letter-spacing: 3px; color: ${T.muted};
          font-weight: bold; margin-bottom: 14px;
        }
        .mob-related-links { display: flex; gap: 24px; flex-wrap: wrap; }
        .mob-related-links a {
          font-size: 13px; color: ${T.accent}; text-decoration: none;
          border-bottom: 1px solid transparent; padding-bottom: 1px;
          transition: border-color 0.15s;
        }
        .mob-related-links a:hover { border-bottom-color: ${T.accent}; }

        .mob-cta-box {
          margin-top: 56px; padding: 40px 36px; background: ${T.dark};
          border-radius: 8px; text-align: center;
        }
        .mob-cta-box .mob-cta-eyebrow {
          font-size: 10px; letter-spacing: 4px; color: ${T.blue};
          font-weight: bold; margin-bottom: 14px;
        }
        .mob-cta-box .mob-cta-h {
          font-size: 26px; color: white; font-weight: 700;
          margin: 0 0 12px 0; letter-spacing: -0.2px;
        }
        .mob-cta-box p { font-size: 15px; color: #c0c2ca; line-height: 1.6; margin: 0 0 28px 0; }
        .mob-cta-box .mob-cta-btn {
          display: inline-block; padding: 16px 36px;
          background: linear-gradient(135deg, #4a9eff, #2a6eff);
          border: none; border-radius: 6px; color: white;
          font-size: 12px; font-weight: bold; letter-spacing: 3px;
          text-decoration: none; font-family: 'Futura PT', Futura, sans-serif;
          box-shadow: 0 0 24px rgba(74,158,255,0.3);
        }

        @media (max-width: 768px) {
          .mob-root { padding: 48px 20px 80px; }
          .mob-h1 { font-size: 28px; }
          .mob-deck { font-size: 16px; }
          .mob-section h3 { font-size: 19px; }
          .mob-section p, .mob-section li { font-size: 15px; }
          .mob-phone-shell { width: 150px; }
          .mob-carousel-arrow { width: 30px; height: 30px; font-size: 16px; }
          .mob-install-grid { grid-template-columns: 1fr; }
          .mob-cta-box { padding: 32px 24px; }
          .mob-cta-box .mob-cta-h { font-size: 22px; }
        }
      `}</style>

      <article className="mob-root">
        <div className="mob-eyebrow">▸ DIALERSEAT ON YOUR PHONE</div>

        <h1 className="mob-h1">
          The full dialer. Installed to your <em>home screen.</em>
        </h1>

        <p className="mob-deck">
          DialerSeat runs as a complete Progressive Web App (PWA) on
          mobile — the same terminal, the same analytics, the same teams
          tools you get on desktop, installed to your phone in under a
          minute. No App Store, no separate download, no stripped-down
          &ldquo;mobile version.&rdquo;
        </p>

        <div className="mob-badge-row">
          <span className="mob-badge hi">FREE ON EVERY PLAN</span>
          <span className="mob-badge">NO APP STORE REQUIRED</span>
          <span className="mob-badge">INSTALLS IN UNDER A MINUTE</span>
          <span className="mob-badge">SAME FEATURES AS DESKTOP</span>
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
            to run a shift from your phone, install it first — it takes
            under a minute and the instructions are right below.
          </p>
        </div>

        {/* ── SEE IT ─────────────────────────────────────────────────────── */}
        <section className="mob-section">
          <h2>▸ SEE IT RUNNING</h2>
          <p>
            Real screenshots, standard Pro plan, no white-labeling — this
            is exactly what every DialerSeat account gets on mobile.
          </p>

          <MobileCarousel />
        </section>

        {/* ── HOW TO INSTALL ─────────────────────────────────────────────── */}
        <section className="mob-section">
          <h2>▸ HOW TO INSTALL IT</h2>
          <p>
            &ldquo;Installing&rdquo; a PWA doesn&apos;t mean an app store
            download — it means telling your phone&apos;s browser to save
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
                <li>Open <code>dialerseat.com</code> in <strong>Safari</strong> (this only works in Safari, not Chrome, on iOS — that&apos;s an Apple restriction, not ours).</li>
                <li>Sign in to your account.</li>
                <li>Tap the <strong>Share</strong> icon in the bottom toolbar (the square with an arrow pointing up).</li>
                <li>Scroll down and tap <strong>&ldquo;Add to Home Screen.&rdquo;</strong></li>
                <li>Tap <strong>&ldquo;Add&rdquo;</strong> in the top-right corner.</li>
                <li>The DialerSeat icon now sits on your home screen — tap it any time to launch full-screen, already signed in.</li>
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
            — the same way the website updates. There&apos;s nothing to
            manually update and no separate release you&apos;re waiting
            on.
          </p>
        </section>

        {/* ── WHAT YOU GET ───────────────────────────────────────────────── */}
        <section className="mob-section">
          <h2>▸ WHAT&apos;S ACTUALLY THERE ON MOBILE</h2>
          <p>
            Nothing is held back for the smaller screen. Everything a
            Pro-plan account gets on desktop is present and fully
            functional on mobile:
          </p>
          <ul>
            <li><strong>Full dialer terminal</strong> — all four dialer modes, manual dial pad, live campaign selection, lead profile view</li>
            <li><strong>Analytics overview</strong> — the same call volume, conversion rate, disposition breakdown, and campaign performance panels as desktop</li>
            <li><strong>Campaigns, Recordings, and Leads</strong> — browse, manage, and review from your phone exactly like you would at a desk</li>
            <li><strong>Teams</strong> — for Manager+ accounts, the same team management tools carry over too; see <Link href="/faq/white-label-mobile">white-label on mobile</Link> if you&apos;re running a branded account</li>
            <li><strong>Settings</strong> — account and campaign configuration, unchanged from desktop</li>
          </ul>
          <p className="muted">
            The one place mobile intentionally trades convenience for
            practicality is dense side-by-side views — the desktop app&apos;s
            multi-window layout (analytics and teams open next to each
            other) doesn&apos;t translate to a phone screen, so those stay
            single-view on mobile and swap via the sidebar instead.
          </p>
        </section>

        {/* ── HONEST LIMITATION ──────────────────────────────────────────── */}
        <div className="mob-callout">
          <p>
            <strong>One honest note —</strong> like any PWA, this
            isn&apos;t a listing in the App Store or Play Store, so there&apos;s
            no storefront search visibility and iOS in particular restricts
            installation to Safari specifically (Chrome and other iOS
            browsers can&apos;t trigger the install prompt — that&apos;s
            an Apple platform rule, not a DialerSeat limitation). For
            actually running your dialer day to day, none of that changes
            the experience once it&apos;s installed.
          </p>
        </div>

        {/* ── RELATED ────────────────────────────────────────────────────── */}
        <div className="mob-related">
          <div className="mob-related-label">▸ RELATED READING</div>
          <div className="mob-related-links">
            <Link href="/faq/white-label-mobile">White-label on mobile</Link>
            <Link href="/faq/manager-plus">What Manager+ adds over Pro</Link>
            <Link href="/faq/why-dialerseat">Why I built DialerSeat</Link>
            <Link href="/faq/dialerseat-teams">DialerSeat for teams</Link>
            <Link href="/faq">FAQ</Link>
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────────  */}
        <div className="mob-cta-box">
          <div className="mob-cta-eyebrow">▸ TRY IT ON YOUR PHONE RIGHT NOW</div>
          <h3 className="mob-cta-h">$35/week. No contract. Cancel any time.</h3>
          <p>
            Sign up, sign in on your phone&apos;s browser, and install it
            to your home screen in the next sixty seconds.
          </p>
          <a href={isSignedIn ? '/dashboard/dialer' : '/sign-up'} className="mob-cta-btn">
            {isSignedIn ? 'GO TO DIALER →' : 'GET STARTED →'}
          </a>
        </div>
      </article>
    </div>
  )
}
