'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useUser } from '@clerk/nextjs'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import FaqTheme from '@/components/faq-theme'
import GutsShell from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { SITE } from '@/lib/siteTheme'


type Slide = { src: string; alt: string; caption: string; theme: string }

const MOBILE_SLIDES: Slide[] = [
  {
    src: '/faq-images/manager-plus/pwa-login-chrome.png',
    alt: 'White-labeled DialerSeat mobile login screen, light theme',
    caption: 'Login screen, light theme. Custom instagram link, custom copy, fully re-themed colors, installed straight to the home screen.',
    theme: 'CHROME THEME',
  },
  {
    src: '/faq-images/manager-plus/pwa-login-neon.png',
    alt: 'White-labeled DialerSeat mobile login screen, dark neon-green theme',
    caption: 'Same exact login flow, same codebase, completely different theme: dark background, neon-green accent, glowing logo treatment.',
    theme: 'NEON THEME',
  },
  {
    src: '/faq-images/manager-plus/pwa-sidebar-chrome.png',
    alt: 'White-labeled DialerSeat mobile sidebar navigation, light theme',
    caption: 'Sidebar navigation, light theme. Analytics, Dialer, Campaigns, Recordings, Leads, Teams, Settings, the manager\u2019s MANAGER+ badge shown bottom-left.',
    theme: 'CHROME THEME',
  },
  {
    src: '/faq-images/manager-plus/pwa-sidebar-neon.png',
    alt: 'White-labeled DialerSeat mobile sidebar navigation, dark neon-green theme',
    caption: 'Identical navigation structure, neon theme. Every link, every label, every permission, unchanged. Only the skin is different.',
    theme: 'NEON THEME',
  },
  {
    src: '/faq-images/manager-plus/pwa-dialer-chrome.png',
    alt: 'White-labeled DialerSeat mobile dialer terminal, light theme',
    caption: 'The full dialer terminal on mobile: status, duration, connected rate, mode, campaign selector, lead profile. Not a stripped-down view; the same terminal that runs on desktop.',
    theme: 'CHROME THEME',
  },
  {
    src: '/faq-images/manager-plus/pwa-analytics-chrome.png',
    alt: 'White-labeled DialerSeat mobile analytics overview, light theme',
    caption: 'The analytics overview on mobile: same six metric cards and call-volume chart as the desktop version, just reflowed for a phone screen.',
    theme: 'CHROME THEME',
  },
]

function MobileCarousel() {
  const [idx, setIdx] = useState(0)
  const slide = MOBILE_SLIDES[idx]
  const go = (d: number) =>
    setIdx((i) => (i + d + MOBILE_SLIDES.length) % MOBILE_SLIDES.length)

  return (
    <div className="wlm-carousel">
      <div className="wlm-carousel-frame">
        <button className="wlm-carousel-arrow left" onClick={() => go(-1)} aria-label="Previous screenshot">‹</button>
        <div className="wlm-phone-shell">
          <div className="wlm-phone-notch" />
          <div className="wlm-phone-imgwrap">
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
        <button className="wlm-carousel-arrow right" onClick={() => go(1)} aria-label="Next screenshot">›</button>
      </div>
      <div className="wlm-carousel-theme-tag">{slide.theme}</div>
      <p className="wlm-carousel-caption">{slide.caption}</p>
      <div className="wlm-carousel-dots">
        {MOBILE_SLIDES.map((s, i) => (
          <button
            key={s.src}
            className={`wlm-dot ${i === idx ? 'active' : ''}`}
            onClick={() => setIdx(i)}
            aria-label={`Go to screenshot ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

function ThemeCompare() {
  return (
    <div className="wlm-compare">
      <div className="wlm-compare-col">
        <div className="wlm-compare-label">CHROME THEME</div>
        <div className="wlm-compare-frame">
          <Image
            src="/faq-images/manager-plus/pwa-sidebar-chrome.png"
            alt="Chrome themed white-label sidebar"
            fill
            sizes="(max-width: 768px) 45vw, 220px"
            style={{ objectFit: 'cover', objectPosition: 'top' }}
          />
        </div>
      </div>
      <div className="wlm-compare-col">
        <div className="wlm-compare-label neon">NEON THEME</div>
        <div className="wlm-compare-frame">
          <Image
            src="/faq-images/manager-plus/pwa-sidebar-neon.png"
            alt="Neon themed white-label sidebar"
            fill
            sizes="(max-width: 768px) 45vw, 220px"
            style={{ objectFit: 'cover', objectPosition: 'top' }}
          />
        </div>
      </div>
    </div>
  )
}

export default function WhiteLabelMobileFaqView() {
  const { isSignedIn } = useUser()

  return (
    <>
      <SiteHeader />
      <GutsShell rail={faqRail('/faq/white-label-mobile')} activeHref="/faq/white-label-mobile">
        <FaqTheme />
        <style>{`
/* PORTRAIT CAROUSEL */
          .wlm-carousel { margin: 32px 0 8px; display: flex; flex-direction: column; align-items: center; }
          .wlm-carousel-frame {
            position: relative; display: flex; align-items: center; justify-content: center;
            gap: 18px; width: 100%;
          }
          .wlm-phone-shell {
            position: relative; width: 220px; aspect-ratio: 1125 / 2436;
            background: #000; border-radius: 28px; overflow: hidden;
            border: 6px solid #111; box-shadow: 0 24px 60px rgba(20,20,40,0.25);
          }
          .wlm-phone-notch {
            position: absolute; top: 0; left: 50%; transform: translateX(-50%);
            width: 40%; height: 18px; background: #111; border-radius: 0 0 12px 12px;
            z-index: 3;
          }
          .wlm-phone-imgwrap { position: absolute; inset: 0; }
          .wlm-carousel-arrow {
            width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
            background: ${SITE.surface}; color: ${SITE.text}; border: 1px solid ${SITE.border};
            font-size: 20px; line-height: 1; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: background 0.15s;
          }
          .wlm-carousel-arrow:hover { background: ${SITE.surface}; }
          .wlm-carousel-theme-tag {
            margin-top: 16px; font-size: 10px; letter-spacing: 2px; font-weight: bold;
            color: ${SITE.deep}; background: ${SITE.surface}; padding: 4px 12px;
            border-radius: 10px;
          }
          .wlm-carousel-caption {
            font-size: 13.5px; line-height: 1.6; color: ${SITE.muted};
            margin: 12px 4px 0; text-align: center; max-width: 420px;
          }
          .wlm-carousel-dots { display: flex; justify-content: center; gap: 8px; margin-top: 16px; }
          .wlm-dot {
            width: 8px; height: 8px; border-radius: 50%; border: none;
            background: ${SITE.border}; cursor: pointer; padding: 0;
            transition: background 0.15s, transform 0.15s;
          }
          .wlm-dot.active { background: ${SITE.deep}; transform: scale(1.3); }

          /* THEME COMPARE */
          .wlm-compare {
            display: flex; gap: 20px; justify-content: center; margin: 32px 0;
            flex-wrap: wrap;
          }
          .wlm-compare-col { display: flex; flex-direction: column; align-items: center; width: 180px; }
          .wlm-compare-label {
            font-size: 10px; letter-spacing: 2px; font-weight: bold; color: ${SITE.deep};
            margin-bottom: 10px; background: ${SITE.surface}; padding: 4px 10px; border-radius: 10px;
          }
          .wlm-compare-label.neon { color: #1a8a4a; background: #0a1a0f; }
          .wlm-compare-frame {
            position: relative; width: 180px; aspect-ratio: 1125 / 2436;
            background: #000; border-radius: 22px; overflow: hidden;
            border: 5px solid #111; box-shadow: 0 16px 40px rgba(20,20,40,0.2);
          }

          /* HOW IT DIFFERS TABLE */
          .wlm-vs-table { margin: 24px 0 8px; border: 1px solid ${SITE.border}; border-radius: 8px; overflow: hidden; background: ${SITE.surface}; }
          .wlm-vs-row { display: grid; grid-template-columns: 1fr 1fr; }
          .wlm-vs-row + .wlm-vs-row { border-top: 1px solid ${SITE.border}; }
          .wlm-vs-row.head { background: ${SITE.ink}; }
          .wlm-vs-cell {
            padding: 14px 18px; font-size: 14px; line-height: 1.6;
          }
          .wlm-vs-cell.label {
            font-weight: 700; color: ${SITE.text}; background: ${SITE.surface};
            border-right: 1px solid ${SITE.border}; font-size: 13px;
          }
          .wlm-vs-row.head .wlm-vs-cell {
            color: white; font-size: 11px; letter-spacing: 2px; font-weight: bold;
            border-right: 1px solid rgba(255,255,255,0.1);
          }
          .wlm-vs-cell.us { color: ${SITE.green}; font-weight: 600; }
          .wlm-vs-cell.them { color: ${SITE.red}; }@media (max-width: 768px) {
            .wlm-phone-shell { width: 150px; }
            .wlm-carousel-arrow { width: 30px; height: 30px; font-size: 16px; }
            .wlm-compare-col { width: 130px; }
            .wlm-compare-frame { width: 130px; }
            .wlm-vs-cell { font-size: 12.5px; padding: 10px 12px; }
          }
        `}</style>

        <article className="faq-root">
          <div className="faq-eyebrow">▸ WHITE-LABEL, ON MOBILE</div>
          <span style={{ fontSize: 11, color: '#8888aa', letterSpacing: '2px', display: 'block', marginBottom: 16 }}>LAST UPDATED 07/28/2026</span>

          <h1 className="faq-h1">
            Your brand doesn&apos;t stop at the browser tab. It follows onto the phone.
          </h1>

          <p className="faq-deck">
            White-labeling on desktop is table stakes for most resellers.
            Mobile is where it usually falls apart, either there&apos;s no
            real mobile experience at all, or the &ldquo;mobile app&rdquo;
            quietly drops your branding and shows the vendor&apos;s name the
            moment it opens. DialerSeat&apos;s white-label carries all the
            way onto the phone, installed to the home screen, with your
            theme intact from the login screen to the dialer itself.
          </p>

          <div className="faq-badge-row">
            <span className="faq-badge hi">PART OF MANAGER+ ($75/WK)</span>
            <span className="faq-badge">NO APP STORE REQUIRED</span>
            <span className="faq-badge">INSTALLS TO HOME SCREEN</span>
            <span className="faq-badge">SAME CODEBASE AS DESKTOP</span>
          </div>

          {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ HOW IT ACTUALLY WORKS</h2>
            <p>
              DialerSeat&apos;s mobile experience is a <strong>Progressive
              Web App (PWA)</strong>, not a native iOS or Android app
              downloaded from an app store, but a web app that installs to
              the home screen, runs full-screen with no browser chrome, and
              behaves like a native app in every way that matters: an icon
              on the home screen, an app-style launch, offline-friendly
              caching, and no address bar in sight once it&apos;s open.
            </p>
            <p>
              When you white-label your DialerSeat account, that branding 
              your logo, your color palette, your custom domain, carries
              straight through to the PWA. Your agents visit your domain on
              their phone, tap &ldquo;Add to Home Screen,&rdquo; and from
              that point on they&apos;re opening <em>your</em> app icon,
              with <em>your</em> theme, every time.
            </p>
            <p className="muted">
              The install steps themselves, Safari&apos;s Share menu on
              iPhone, Chrome&apos;s install prompt on Android, are the same
              whether an account is white-labeled or not. See{' '}
              <Link href="/faq/mobile">DialerSeat on mobile</Link> for the
              exact step-by-step if you need it spelled out.
            </p>

            <p style={{ marginTop: 8 }}>Swipe through a real white-labeled account below: same account, same features, two completely different themes.</p>

            <MobileCarousel />
          </section>

          {/* ── SAME CODEBASE, DIFFERENT SKIN ──────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ SAME CODEBASE, COMPLETELY DIFFERENT SKIN</h2>
            <p>
              The two screenshots below are the exact same navigation menu,
              on the exact same account type (Manager+), running the exact
              same code. The only thing that changed is the white-label
              theme configuration: colors, background treatment, and logo
              styling.
            </p>

            <ThemeCompare />

            <p className="muted" style={{ textAlign: 'center', marginTop: 8 }}>
              Light and airy, or dark with a neon glow: the layout, the
              links, and the permissions underneath never change. Only the
              skin does.
            </p>
          </section>

          {/* ── HOW OTHERS DON'T ───────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ WHY MOST WHITE-LABEL DIALERS DON&apos;T DO THIS ON MOBILE</h2>
            <p>
              This isn&apos;t a shot at the competition for the sake of it 
              it&apos;s a real, well-documented constraint. Apple and Google
              both restrict publishing multiple near-identical
              &ldquo;boilerplate&rdquo; native apps from the same underlying
              codebase under different names and branding. A dialer vendor
              that wants to give every reseller their own branded native app
              in the App Store and Play Store runs straight into that
              policy, it&apos;s the reason so few white-label platforms of
              any kind bother trying anymore.
            </p>
            <p>
              The usual workarounds are worse than the problem: charge
              resellers a large one-time fee to get a lightly-rebranded
              native app submitted under their own developer account (slow,
              expensive, and it goes stale the moment the platform ships an
              update), or skip mobile branding entirely and just show
              resellers&apos; agents the vendor&apos;s own app with the
              vendor&apos;s own name on it, which is the most common
              outcome in this industry.
            </p>

            <div className="wlm-vs-table">
              <div className="wlm-vs-row head">
                <div className="wlm-vs-cell label">&nbsp;</div>
                <div className="wlm-vs-cell">TYPICAL APPROACH</div>
              </div>
              <div className="wlm-vs-row">
                <div className="wlm-vs-cell label">Mobile branding</div>
                <div className="wlm-vs-cell them">Usually drops to the vendor&apos;s own name and logo, or isn&apos;t offered at all</div>
              </div>
              <div className="wlm-vs-row">
                <div className="wlm-vs-cell label">Getting it installed</div>
                <div className="wlm-vs-cell them">App Store / Play Store submission and review, per reseller, if offered at all</div>
              </div>
              <div className="wlm-vs-row">
                <div className="wlm-vs-cell label">Update cycle</div>
                <div className="wlm-vs-cell them">Separate app store review for every update, per branded build</div>
              </div>
              <div className="wlm-vs-row">
                <div className="wlm-vs-cell label">Cost to reseller</div>
                <div className="wlm-vs-cell them">Often a separate one-time or enterprise fee on top of the base plan</div>
              </div>
            </div>

            <div className="wlm-vs-table" style={{ marginTop: 16 }}>
              <div className="wlm-vs-row head">
                <div className="wlm-vs-cell label">&nbsp;</div>
                <div className="wlm-vs-cell">DIALERSEAT</div>
              </div>
              <div className="wlm-vs-row">
                <div className="wlm-vs-cell label">Mobile branding</div>
                <div className="wlm-vs-cell us">Your logo, colors, and custom domain carry through automatically, same theme as desktop</div>
              </div>
              <div className="wlm-vs-row">
                <div className="wlm-vs-cell label">Getting it installed</div>
                <div className="wlm-vs-cell us">&ldquo;Add to Home Screen&rdquo; from the browser: seconds, no review process</div>
              </div>
              <div className="wlm-vs-row">
                <div className="wlm-vs-cell label">Update cycle</div>
                <div className="wlm-vs-cell us">Instant, it&apos;s the same live codebase as the browser and desktop app</div>
              </div>
              <div className="wlm-vs-row">
                <div className="wlm-vs-cell label">Cost to reseller</div>
                <div className="wlm-vs-cell us">Included in Manager+ ($75/wk), no separate mobile fee</div>
              </div>
            </div>
          </section>

          {/* ── HONEST LIMITATION ──────────────────────────────────────────── */}
          <div className="faq-callout">
            <p>
              <strong>One honest limitation, </strong> a PWA is not a
              listing in the App Store or Play Store. There&apos;s no
              storefront presence, no App Store search visibility, and no
              push-notification behavior identical to a fully native app on
              every device (iOS PWA support in particular trails Android in
              a few areas, like background sync). For a branded internal
              tool your agents install once and use daily, none of that
              matters. If your business model depends specifically on
              public App Store discoverability for an end-consumer app,
              that&apos;s a different product need than what white-labeling
              a dialer solves.
            </p>
          </div>

          {/* ── RELATED ────────────────────────────────────────────────────── */}
          <div className="faq-related">
            <div className="faq-related-label">▸ RELATED READING</div>
            <div className="faq-related-links">
              <Link href="/faq/white-label">White-label your dialer</Link>
              <Link href="/faq/manager-plus">What Manager+ adds over Pro</Link>
              <Link href="/faq/mobile">DialerSeat on mobile (standard accounts)</Link>
              <Link href="/faq/managers">For managers, agency owners &amp; lead vendors</Link>
              <Link href="/faq/dialerseat-teams">DialerSeat for teams</Link>
              <Link href="/faq">FAQ</Link>
            </div>
          </div>

          {/* ── CTA ──────────────────────────────────────────────────────────  */}
          <div className="faq-cta">
            <div className="faq-cta-eyebrow">▸ SEE IT ON YOUR OWN PHONE</div>
            <h3 className="faq-cta-h">Set up your theme, then add it to your home screen.</h3>
            <p>
              White-labeling is part of Manager+, $75/week. Once your theme
              is configured, installing to mobile takes one tap from any
              browser.
            </p>
            <a href={isSignedIn ? '/dashboard/teams' : '/sign-up'} className="faq-cta-btn">
              {isSignedIn ? 'GO TO DASHBOARD →' : 'START MANAGER+ →'}
            </a>
          </div>
        </article>
      </GutsShell>
      <SiteFooter />
    </>
  )
}
