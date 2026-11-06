'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Maximize2, X } from 'lucide-react'
import Link from '@/components/LocaleLink'
import Image from 'next/image'
import { useUser } from '@clerk/nextjs'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import FaqTheme from '@/components/faq-theme'
import GutsShell from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { SITE } from '@/lib/siteTheme'
import { t } from '@/lib/i18n/client'
import { msg } from '@/lib/i18n/msg'


type Slide = { src: string; alt: string; theme: string; caption: string }

const THEMES = [["brown", msg("brown")],["navy", msg("navy")],["tan", msg("tan")],["black", msg("black")],["teal", msg("teal")],["lavender", msg("lavender")],["green", msg("green")],["white", msg("white")],["blue", msg("blue")]]
const DESKTOP_SLIDES: Slide[] = THEMES.map(([name, theme]) => ({
  src: `/faq-images/manager-plus/theme-${name}.png`,
  alt: msg("DialerSeat Manager+ analytics dashboard white-labeled in a {theme} theme, with a placeholder logo"),
  theme,
  caption: msg("The same dashboard under your logo and your colors."),
}))

// Swipe on a phone, arrow keys and Escape on a computer. Plays by itself until
// the person takes over.
function Slideshow({ start, onClose }: { start: number; onClose: () => void }) {
  const [idx, setIdx] = useState(start)
  const [playing, setPlaying] = useState(true)
  const touchX = useRef<number | null>(null)
  const count = DESKTOP_SLIDES.length
  const go = useCallback((d: number) => { setPlaying(false); setIdx(i => (i + d + count) % count) }, [count])
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', k)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', k) }
  }, [go, onClose])
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setIdx(i => (i + 1) % count), 2000)
    return () => clearInterval(id)
  }, [playing, count])
  const slide = DESKTOP_SLIDES[idx]
  return (
    <div
      className="mp-show" role="dialog" aria-modal="true" aria-label={t("Screenshot slideshow")}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      onTouchStart={e => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
      }}
    >
      <button className="mp-show-close" onClick={onClose} aria-label={t("Close")}><X size={20} aria-hidden="true" /></button>
      <div className="mp-show-stage">
        <Image key={slide.src} src={slide.src} alt={t(slide.alt, { theme: t(slide.theme) })} width={1919} height={991} sizes="100vw" priority className="mp-show-img" />
      </div>
      <div className="mp-show-bar">
        <button className="mp-show-arrow" onClick={() => go(-1)} aria-label={t("Previous screenshot")}>‹</button>
        <span className="mp-show-count">{idx + 1} / {count}</span>
        <button className="mp-show-arrow" onClick={() => go(1)} aria-label={t("Next screenshot")}>›</button>
      </div>
    </div>
  )
}

function DesktopCarousel() {
  const [idx, setIdx] = useState(0)
  const [full, setFull] = useState(false)
  const [playing, setPlaying] = useState(true)
  const close = useCallback(() => setFull(false), [])
  const slide = DESKTOP_SLIDES[idx]
  // Plays by itself until the person picks a slide.
  const go = (d: number) => {
    setPlaying(false)
    setIdx((i) => (i + d + DESKTOP_SLIDES.length) % DESKTOP_SLIDES.length)
  }
  useEffect(() => {
    if (!playing || full) return
    const id = setInterval(() => setIdx(i => (i + 1) % DESKTOP_SLIDES.length), 2000)
    return () => clearInterval(id)
  }, [playing, full])

  return (
    <div className="mp-carousel">
      <div className="mp-carousel-frame">
        <button
          className="mp-carousel-arrow left"
          onClick={() => go(-1)}
          aria-label={t("Previous screenshot")}
        >
          ‹
        </button>
        <button className="mp-carousel-imgwrap" onClick={() => setFull(true)} aria-label={t("View full screen")}>
          <Image
            key={slide.src}
            src={slide.src}
            alt={t(slide.alt, { theme: t(slide.theme) })}
            fill
            sizes="(max-width: 768px) 100vw, 1200px"
            style={{ objectFit: 'contain' }}
            priority={idx === 0}
          />
        </button>
        <button className="mp-carousel-full" onClick={() => setFull(true)}>
          <Maximize2 size={13} aria-hidden="true" /> {t("FULL SCREEN")}
        </button>
        <button
          className="mp-carousel-arrow right"
          onClick={() => go(1)}
          aria-label={t("Next screenshot")}
        >
          ›
        </button>
      </div>
      <p className="mp-carousel-caption">{t(slide.caption)}</p>
      <div className="mp-carousel-dots">
        {DESKTOP_SLIDES.map((s, i) => (
          <button
            key={s.src}
            className={`mp-dot ${i === idx ? 'active' : ''}`}
            onClick={() => { setPlaying(false); setIdx(i) }}
            aria-label={t("Go to screenshot {i}", { i: i + 1 })}
          />
        ))}
      </div>
      {full && <Slideshow start={idx} onClose={close} />}
    </div>
  )
}

export default function ManagerPlusFaqView() {
  const { isSignedIn } = useUser()

  return (
    <>
      <SiteHeader />
      <GutsShell rail={faqRail('/faq/manager-plus')} activeHref="/faq/manager-plus">
        <FaqTheme />
        <style>{`
/* PRICING TABLE */
          .mp-tiers {
            display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
            margin: 28px 0 32px;
          }
          .mp-tier-card {
            background: ${SITE.surface}; border: 1px solid ${SITE.border}; border-radius: 8px;
            padding: 24px 22px;
          }
          .mp-tier-card.hi {
            border: 2px solid ${SITE.deep};
          }
          .mp-tier-name {
            font-size: 11px; letter-spacing: 2px; font-weight: bold; color: ${SITE.muted};
            margin-bottom: 8px;
          }
          .mp-tier-card.hi .mp-tier-name { color: ${SITE.deep}; }
          .mp-tier-price { font-size: 30px; font-weight: 800; margin-bottom: 4px; }
          .mp-tier-price span { font-size: 14px; font-weight: 600; color: ${SITE.muted}; }
          .mp-tier-sub { font-size: 13px; color: ${SITE.muted}; margin-bottom: 16px; }
          .mp-tier-card ul { margin: 0; padding-inline-start: 18px; }
          .mp-tier-card li { font-size: 14px; line-height: 1.6; margin-bottom: 6px; }

          /* MATH BLOCK */
          .mp-math {
            margin: 28px 0; padding: 24px 28px;
            background: ${SITE.surface}; border: 1px solid ${SITE.border};
            border-inline-start: 3px solid ${SITE.green}; border-radius: 6px;
          }
          .mp-math-title {
            font-size: 11px; letter-spacing: 3px; color: ${SITE.green};
            font-weight: bold; margin-bottom: 14px;
          }
          .mp-math-row {
            display: flex; justify-content: space-between; align-items: baseline;
            padding: 6px 0; font-size: 15px; border-bottom: 1px dashed ${SITE.border};
          }
          .mp-math-row:last-child { border-bottom: none; padding-top: 10px; margin-top: 4px; }
          .mp-math-row.total {
            border-top: 2px solid ${SITE.border}; border-bottom: none;
            padding-top: 12px; margin-top: 8px; font-size: 17px; font-weight: 700;
          }
          .mp-math-row.total .mp-math-val { color: ${SITE.green}; }
          .mp-math-label { color: ${SITE.muted}; }
          .mp-math-val { font-family: monospace; font-weight: 600; color: ${SITE.text}; }

          /* SCENARIO CARDS */
          .mp-scenario {
            margin: 28px 0; padding: 26px 28px; background: ${SITE.surface};
            border: 1px solid ${SITE.border}; border-radius: 8px;
          }
          .mp-scenario-eyebrow {
            font-size: 10px; letter-spacing: 3px; font-weight: bold;
            color: ${SITE.deep}; margin-bottom: 10px;
          }
          .mp-scenario h4 { font-size: 19px; margin: 0 0 12px 0; font-weight: 700; }
          .mp-scenario p { font-size: 15px; line-height: 1.7; margin: 0 0 12px 0; color: ${SITE.text}; }
          .mp-scenario p:last-child { margin-bottom: 0; }

          /* CAROUSEL */
          .mp-carousel { margin: 0 0 32px; }
          .mp-carousel-frame {
            position: relative; width: 100%; aspect-ratio: 1919 / 991;
            background: ${SITE.ink}; border-radius: 10px; overflow: hidden;
            border: 1px solid ${SITE.border};
            box-shadow: 0 20px 50px rgba(20,20,40,0.18);
          }
          .mp-carousel-imgwrap { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; border: none; background: none; cursor: zoom-in; }
          .mp-carousel-full {
            position: absolute; right: 12px; bottom: 12px; z-index: 2; display: inline-flex; align-items: center; gap: 6px;
            padding: 7px 11px; border-radius: 6px; border: none; cursor: pointer;
            background: rgba(20,20,30,0.75); color: #fff; font-size: 10px; font-weight: 700; letter-spacing: 1.5px;
          }
          .mp-show {
            position: fixed; inset: 0; z-index: 2000; display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: 14px; padding: 20px; background: rgba(7,8,15,0.6);
            -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
          }
          .mp-show-stage { width: 100%; max-width: min(1600px, calc((100dvh - 110px) * 1919 / 991)); pointer-events: none; }
          .mp-show-img { display: block; width: 100%; height: auto; border-radius: 8px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
          .mp-show-bar { display: flex; align-items: center; gap: 18px; color: #fff; font-size: 13px; letter-spacing: 1.5px; }
          .mp-show-arrow, .mp-show-close {
            display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%;
            border: 1px solid rgba(255,255,255,0.3); background: rgba(20,20,30,0.6); color: #fff; font-size: 24px; line-height: 1; cursor: pointer;
          }
          .mp-show-close { position: absolute; top: max(14px, env(safe-area-inset-top)); right: 14px; }
          .mp-show-count { min-width: 52px; text-align: center; font-variant-numeric: tabular-nums; }
          .mp-carousel-arrow {
            position: absolute; top: 50%; transform: translateY(-50%);
            width: 40px; height: 40px; border-radius: 50%;
            background: rgba(20,20,30,0.55); color: white; border: none;
            font-size: 22px; line-height: 1; cursor: pointer; z-index: 2;
            display: flex; align-items: center; justify-content: center;
            transition: background 0.15s;
          }
          .mp-carousel-arrow:hover { background: rgba(20,20,30,0.8); }
          .mp-carousel-arrow.left { left: 12px; }
          .mp-carousel-arrow.right { right: 12px; }
          .mp-carousel-caption {
            font-size: 13.5px; line-height: 1.6; color: ${SITE.muted};
            margin: 14px 4px 0; text-align: center;
          }
          .mp-carousel-dots {
            display: flex; justify-content: center; gap: 8px; margin-top: 14px;
          }
          .mp-dot {
            width: 8px; height: 8px; border-radius: 50%; border: none;
            background: ${SITE.border}; cursor: pointer; padding: 0;
            transition: background 0.15s, transform 0.15s;
          }
          .mp-dot.active { background: ${SITE.deep}; transform: scale(1.3); }

          /* PRIORITY LIST */
          .mp-priority-grid {
            display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;
            margin: 20px 0 8px;
          }
          .mp-priority-item {
            background: ${SITE.surface}; border: 1px solid ${SITE.border}; border-radius: 8px;
            padding: 18px 20px;
          }
          .mp-priority-item h5 {
            font-size: 14px; margin: 0 0 6px 0; color: ${SITE.deep}; font-weight: 700;
          }
          .mp-priority-item p { font-size: 13.5px; line-height: 1.6; margin: 0; color: ${SITE.muted}; }
          .mp-cta-secondary {
            display: inline-block; margin-top: 16px; color: #888a92;
            font-size: 11px; letter-spacing: 2px; text-decoration: none;
          }
          .mp-cta-secondary:hover { color: ${SITE.muted}; }@media (max-width: 768px) {
            .mp-tiers { grid-template-columns: 1fr; }
            .mp-priority-grid { grid-template-columns: 1fr; }
            .mp-math { padding: 18px 20px; }
            .mp-scenario { padding: 20px 20px; }
          }
        `}</style>

        <article className="faq-root">
          <DesktopCarousel />

          <div className="faq-eyebrow">{t("▸ MANAGER+")}</div>
          <span style={{ fontSize: 11, color: '#8888aa', letterSpacing: '2px', display: 'block', marginBottom: 16 }}>{t("LAST UPDATED 11/05/2026")}</span>

          <h1 className="faq-h1">
            {t("Your dialer, your brand, and your whole team in one place.")}</h1>

          <p className="faq-deck">
            {t("Manager+ is DialerSeat for people who run the operation. Put your own logo and colors on the platform, bring your agents onto one team, and see every call, recording, and result from one dashboard. Every screenshot above is the same analytics page under a different brand.")}</p>

          <div className="faq-badge-row" style={{ justifyContent: 'center' }}>
            <span className="faq-badge price">{t("$75 / WEEK")}</span>
            <span className="faq-badge">{t("REPLACES PRO, NOT STACKED ON TOP")}</span>
            <span className="faq-badge">{t("NO CONTRACT")}</span>
            <span className="faq-badge">{t("CANCEL ANYTIME")}</span>
          </div>

          {/* ── WHAT YOU GET ───────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ WHAT YOU GET")}</h2>
            <p>{t("Everything in Pro, including all four dialer modes and voicemail detection on Progressive and Predictive, plus the tools to run a team under your own name.")}</p>

            <div className="mp-priority-grid">
              <div className="mp-priority-item">
                <h5>{t("YOUR BRAND ON EVERYTHING")}</h5>
                <p>{t("Your logo, your colors, and your company name in the browser tab, on your own subdomain or custom domain. Login and signup screens carry your brand too.")}</p>
              </div>
              <div className="mp-priority-item">
                <h5>{t("TEAMS YOU OWN")}</h5>
                <p>{t("Create teams, share campaigns with them, and send out seat links. Invite people who are already active on DialerSeat, or buy seats for your whole crew.")}</p>
              </div>
              <div className="mp-priority-item">
                <h5>{t("THE WHOLE FLOOR IN ONE VIEW")}</h5>
                <p>{t("Team totals, a breakdown for each agent and campaign, and a live floor view. Filter by today, this week, this month, all time, or a custom range.")}</p>
              </div>
              <div className="mp-priority-item">
                <h5>{t("YOUR AGENTS' RECORDINGS")}</h5>
                <p>{t("Open any agent on your team and play back their recorded calls, so you can coach from what was actually said.")}</p>
              </div>
              <div className="mp-priority-item">
                <h5>{t("YOU DECIDE WHO PAYS")}</h5>
                <p>{t("Each seat link is either owner-pays or agent-pays, and one team can use both.")}</p>
              </div>
              <div className="mp-priority-item">
                <h5>{t("PRIORITY SUPPORT")}</h5>
                <p>{t("Manager+ requests are handled ahead of standard tickets, and domain and branding setup questions are handled directly.")}</p>
              </div>
            </div>
          </section>

          {/* ── PRO OR MANAGER+ ────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ PRO OR MANAGER+")}</h2>
            <p>{t("There are only two plans. If you dial for yourself, Pro is all you need. If other people dial under you, or you want your own brand on the platform, that is Manager+.")}</p>

            <div className="mp-tiers">
              <div className="mp-tier-card">
                <div className="mp-tier-name">{t("PRO")}</div>
                <div className="mp-tier-price">$35<span> {t("/ week")}</span></div>
                <div className="mp-tier-sub">{t("Per seat. What every dialing agent runs on.")}</div>
                <ul>
                  <li>{t("All four dialer modes: preview, power, progressive, predictive")}</li>
                  <li>{t("Voicemail detection on progressive and predictive")}</li>
                  <li>{t("Unlimited outbound numbers and unlimited minutes")}</li>
                  <li>{t("Call recording (30-day retention)")}</li>
                  <li>{t("Your own analytics")}</li>
                  <li>{t("Join a team with an invite")}</li>
                </ul>
              </div>

              <div className="mp-tier-card hi">
                <div className="mp-tier-name">{t("MANAGER+")}</div>
                <div className="mp-tier-price">$75<span> {t("/ week")}</span></div>
                <div className="mp-tier-sub">{t("Per team owner. Everything in Pro, plus:")}</div>
                <ul>
                  <li>{t("Full white-label branding")}</li>
                  <li>{t("Create and own teams")}</li>
                  <li>{t("Team, agent, and campaign analytics")}</li>
                  <li>{t("Playback of your agents' recordings")}</li>
                  <li>{t("Owner-pays or agent-pays seat links")}</li>
                  <li>{t("Priority support")}</li>
                </ul>
              </div>
            </div>
          </section>

          {/* ── WHAT IT COSTS ──────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ WHAT IT COSTS")}</h2>
            <p>{t("There are two numbers: $75 a week for Manager+, and $35 a week for each agent seat. You choose who covers the seats. Here is a team of six agents both ways.")}</p>

            <div className="mp-math">
              <div className="mp-math-title">{t("YOU COVER EVERY SEAT")}</div>
              <div className="mp-math-row">
                <span className="mp-math-label">{t("Manager+")}</span>
                <span className="mp-math-val">{t("$75 / week")}</span>
              </div>
              <div className="mp-math-row">
                <span className="mp-math-label">{t("6 agent seats × $35/week")}</span>
                <span className="mp-math-val">{t("$210 / week")}</span>
              </div>
              <div className="mp-math-row total">
                <span>{t("Your cost")}</span>
                <span className="mp-math-val">{t("$285 / week")}</span>
              </div>
            </div>

            <div className="mp-math">
              <div className="mp-math-title">{t("AGENTS COVER THEIR OWN SEATS")}</div>
              <div className="mp-math-row">
                <span className="mp-math-label">{t("Manager+")}</span>
                <span className="mp-math-val">{t("$75 / week")}</span>
              </div>
              <div className="mp-math-row">
                <span className="mp-math-label">{t("6 agent seats × $35/week")}</span>
                <span className="mp-math-val">{t("paid by each agent")}</span>
              </div>
              <div className="mp-math-row total">
                <span>{t("Your cost")}</span>
                <span className="mp-math-val">{t("$75 / week")}</span>
              </div>
            </div>

            <p className="muted">
              {t("Staffing a larger floor? Email sales@dialerseat.com. For how seat links and shared campaigns work, see")}{' '}
              <Link href="/faq/dialerseat-teams">{t("DialerSeat for teams")}</Link>.
            </p>
          </section>

          {/* ── WHO IT'S FOR ───────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ WHO IT'S FOR")}</h2>

            <div className="mp-scenario">
              <div className="mp-scenario-eyebrow">{t("AGENCY OWNERS")}</div>
              <h4>{t("You run a sales floor and want it on your own dialer.")}</h4>
              <p>{t("Your agents sign in on your domain and see your logo and colors. You share campaigns with the team, watch the numbers by agent and by campaign, and review their recordings when it is time to coach.")}</p>
            </div>

            <div className="mp-scenario">
              <div className="mp-scenario-eyebrow">{t("LEAD GENERATORS")}</div>
              <h4>{t("You generate leads and want to sell access, not spreadsheets.")}</h4>
              <p>{t("Upload your leads to a campaign and give buyers a seat link instead of a file. They dial inside the platform, and you can see every dial and disposition on your campaign.")}</p>
              <p>{t("DialerSeat does not process what you charge your buyers or agents. You collect that yourself, and we do not take a cut.")}</p>
            </div>
          </section>

          {/* ── GETTING STARTED ────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ GETTING STARTED")}</h2>
            <ol>
              <li>{t("Choose Manager+ at checkout.")}</li>
              <li>{t("Pick your subdomain, upload your logo, and set your brand colors.")}</li>
              <li>{t("Land on your Teams overview, create a team, and send out your first invite.")}</li>
            </ol>
            <p className="muted">
              {t("Already on Pro? Manager+ replaces it, so you never pay for both. It also works on phones: see")}{' '}
              <Link href="/faq/white-label-mobile">{t("White-label on mobile")}</Link>.
            </p>
          </section>

          {/* ── RELATED ────────────────────────────────────────────────────── */}
          <div className="faq-related">
            <div className="faq-related-label">{t("▸ RELATED READING")}</div>
            <div className="faq-related-links">
              <Link href="/faq/managers">{t("For managers, agency owners & lead vendors")}</Link>
              <Link href="/faq/white-label">{t("White-label your dialer")}</Link>
              <Link href="/faq/white-label-mobile">{t("White-label on mobile")}</Link>
              <Link href="/faq/dialerseat-teams">{t("DialerSeat for teams")}</Link>
              <Link href="/faq/why-we-charge">{t("Why we charge what we charge")}</Link>
              <Link href="/faq">{t("FAQ")}</Link>
            </div>
          </div>

          {/* ── CTA ──────────────────────────────────────────────────────────  */}
          <div className="faq-cta">
            <div className="faq-cta-eyebrow">{t("▸ MANAGER+")}</div>
            <h3 className="faq-cta-h">{t("$75/week. No contract. Cancel any time.")}</h3>
            <p>{t("Set up your brand, create your first team, and send your first invite.")}</p>
            <a href={isSignedIn ? '/dashboard/teams' : '/sign-up?plan=wl'} className="faq-cta-btn">
              {isSignedIn ? t("GO TO TEAMS →") : t("START MANAGER+ →")}
            </a>
          </div>
        </article>
      </GutsShell>
      <SiteFooter />
    </>
  )
}

