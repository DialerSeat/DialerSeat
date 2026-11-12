'use client'
// ─────────────────────────────────────────────────────────────────────────
// LOOK AROUND BEFORE PAYING, AND A ONE-TIME TUTORIAL AFTER.
//
// Mounted once in the dashboard layout. For an account that has never paid
// (preview, see lib/preview.ts) it shows:
//   · a DEMO DATA banner across the top of every page,
//   · the /welcome showcase as a popup the first time they land,
//   · SHOW ME AROUND: one card per page, docked bottom-left, in sidebar order,
//   · the real billing page as a popup whenever something needs a paid seat.
// For an account that has just paid from the preview, a three-step tutorial
// in the same card: upload leads, set available, check analytics. Skip or
// finish it and it never comes back. Every flag is on the users row, so all
// of this is once per account on any device.
// ─────────────────────────────────────────────────────────────────────────
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import BillingPage from '@/app/billing/page'
import { BillingOverlayContext } from '@/lib/billingOverlay'
import { SCENES, DialerScene, AnalyticsScene, SuperiorScene } from '@/app/welcome/Showcase'
import { PAYWALL_EVENT, PREVIEW_BEFORE_PAYMENT, isPreviewTier, openPaywall, type PaywallReason } from '@/lib/preview'
import { t as tr } from '@/lib/i18n/client'
import { msg } from '@/lib/i18n/msg'

const FUTURA = 'Futura PT, Futura, "Trebuchet MS", sans-serif'

type Flags = { popupDone: boolean; tourOn: boolean; tourDone: boolean; tutPending: boolean; tutDone: boolean; minimised: boolean }
const NO_FLAGS: Flags = { popupDone: true, tourOn: false, tourDone: false, tutPending: false, tutDone: true, minimised: false }

const ACTIVATE: PaywallReason = { eyebrow: msg('ACTIVATE YOUR SEAT'), line: msg('No contracts, cancel anytime.'), source: 'Activate' }

const REDIAL = msg('1x calls a lead once and moves on. On 2x or 3x, if nobody picks up, it calls straight back up to that many times in a row, which can get through to a phone on Do Not Disturb.')

// One stop per sidebar page, in sidebar order.
const TOUR: { href: string; label: string; h: string; p: string; extra?: string }[] = [
  { href: '/dashboard/analytics', label: msg('ANALYTICS'), h: msg('This is your Analytics page'), p: msg('Every call, conversion, close, and minute of talk time, tracked the second each call ends. Nothing to log and nothing to maintain. You always know what is working and where your closes come from.') },
  { href: '/dashboard/dialer', label: msg('DIALER'), h: msg('This is your Dialer'), p: msg('This is where you make your money. Four dialer modes, all of your scripts in one place, and an unlimited number pool. Progressive and Predictive have voicemail detection built in, so machines get screened out and your time goes to real conversations.'), extra: REDIAL },
  { href: '/dashboard/campaigns', label: msg('CAMPAIGNS'), h: msg('This is your Campaigns page'), p: msg('Drop in your CSV and you are ready to dial. Run as many campaigns as you want, name them, organize them, and switch each one on or off in a click.') },
  { href: '/dashboard/recordings', label: msg('RECORDINGS'), h: msg('This is your Recordings page'), p: msg("Turn recording on and every call lands here to play back. Hear what closed and fix what did not, or review your agents' calls on Teams.") },
  { href: '/dashboard/leads', label: msg('LEADS'), h: msg('This is your Leads page'), p: msg('Every lead from every campaign, in one place. Every disposition, callback, and note remembers itself, so your work is never lost and no lead slips through the cracks.') },
  { href: '/dashboard/teams', label: msg('TEAMS'), h: msg('This is your Teams page'), p: msg('Send out an invite link to active users or buy seats for your whole crew. Each agent gets their own login, campaigns, and call data, all under one roof. (Contact teams@dialerseat.com for more info)') },
  { href: '/dashboard/settings', label: msg('SETTINGS'), h: msg('This is your Settings page'), p: msg('Your plan, your profile, and your predictive setup, all in one place. No contracts: cancel anytime, right here in Settings.') },
]
// The last step, back where the tour began: the moment to ask.
const TOUR_END = { href: '/dashboard/analytics', label: msg('WHAT HAPPENS NEXT'), h: msg('Ready to dial?'), p: msg("That's the whole platform. When you activate, this demo data clears and you start on a clean dashboard. A short tutorial walks you through uploading your leads and setting yourself available, and your own numbers fill in as you dial. It's $35 a week with no contract, and you can cancel anytime.") }
const TOUR_END_KEY = 'obx-tour-end'

async function saveFlags(patch: Partial<Flags>) {
  try { await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }) } catch {}
}

export default function PreviewOnboarding() {
  const { user } = useUser()
  const pathname = usePathname() || ''
  const router = useRouter()
  const [tier, setTier] = useState<string | null>(null)
  const [flags, setFlags] = useState<Flags>(NO_FLAGS)
  const [loaded, setLoaded] = useState(false)
  const [paywall, setPaywall] = useState<PaywallReason | null>(null)

  useEffect(() => {
    if (!PREVIEW_BEFORE_PAYMENT || !user) return
    let off = false
    Promise.all([
      fetch('/api/stripe/status').then(r => r.json()).catch(() => ({})),
      fetch('/api/onboarding').then(r => r.json()).catch(() => ({})),
    ]).then(([st, ob]) => {
      if (off) return
      setTier(st?.tier || null)
      if (ob?.success) setFlags({ popupDone: ob.popupDone, tourOn: ob.tourOn, tourDone: ob.tourDone, tutPending: ob.tutPending, tutDone: ob.tutDone, minimised: ob.minimised })
      setLoaded(true)
    })
    return () => { off = true }
  }, [user])

  useEffect(() => {
    const on = (e: Event) => setPaywall((e as CustomEvent<PaywallReason>).detail || ACTIVATE)
    window.addEventListener(PAYWALL_EVENT, on)
    return () => window.removeEventListener(PAYWALL_EVENT, on)
  }, [])

  // /billing sends a never-paid account here with ?activate=1: open the popup.
  useEffect(() => {
    if (!loaded || !isPreviewTier(tier)) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('activate') === '1') {
      setFlags(f => ({ ...f, popupDone: true }))
      void saveFlags({ popupDone: true })
      setPaywall(ACTIVATE)
      // Once only: coming back to this address must not open it again.
      params.delete('activate')
      const rest = params.toString()
      window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''))
    }
  }, [loaded, tier])

  // Paid in another tab, or the payment finished while this page was open: every
  // page on screen is showing the demo, so start clean.
  useEffect(() => {
    if (!loaded || !isPreviewTier(tier)) return
    const id = setInterval(() => {
      if (document.hidden) return
      fetch('/api/stripe/status').then(r => r.json()).then(s => {
        if (s?.tier && !isPreviewTier(s.tier)) window.location.reload()
      }).catch(() => {})
    }, 10000)
    return () => clearInterval(id)
  }, [loaded, tier])
  const closePaywall = useCallback(() => {
    setPaywall(null)
  }, [])

  const bannerRef = useCallback((el: HTMLDivElement | null) => {
    const root = document.documentElement
    if (!el) { root.style.removeProperty('--obx-banner-h'); return }
    const set = () => root.style.setProperty('--obx-banner-h', `${el.offsetHeight}px`)
    set()
    new ResizeObserver(set).observe(el)
  }, [])

  const update = useCallback((patch: Partial<Flags>) => { setFlags(f => ({ ...f, ...patch })); void saveFlags(patch) }, [])

  if (!PREVIEW_BEFORE_PAYMENT || !loaded) return null
  const preview = isPreviewTier(tier)
  const tutorial = tier === 'active' && flags.tutPending && !flags.tutDone

  const startTour = () => { update({ popupDone: true, tourOn: true, minimised: false }); router.push(TOUR[0].href) }

  return (
    <>
      <style>{CSS}</style>
      {preview && (
        <div className="obx-banner" ref={bannerRef}>
          <span><b>{tr('DEMO DATA')}</b> {tr('Everything here is sample data so you can see DialerSeat working. It clears when you activate.')}</span>
          <span className="obx-sp" />
          <button className="obx-solid" onClick={() => openPaywall(ACTIVATE)}>{tr('ACTIVATE · $35/WEEK')}</button>
          {!flags.tourOn && <button className="obx-ghost" onClick={startTour}>{tr('SHOW ME AROUND')}</button>}
        </div>
      )}

      {preview && !flags.popupDone && (
        <WelcomePopup
          onTour={startTour}
          // Every way out of the welcome starts the tour, so nobody is left on one
          // screen: a 10 Nov signup closed it and never saw the dialer. Activate
          // starts it too, under the paywall, for when they close that unpaid.
          onActivate={() => { update({ popupDone: true, tourOn: true, minimised: false }); openPaywall(ACTIVATE) }}
          onClose={startTour}
        />
      )}

      {preview && flags.tourOn && (
        <TourCard
          pathname={pathname}
          minimised={flags.minimised}
          onMinimise={() => update({ minimised: !flags.minimised })}
          onGo={href => router.push(href)}
          // KEEP LOOKING on the last step is the only thing that ends the tour.
          // Activate leaves it up: if they close the paywall unpaid it is still
          // there, and paying reloads the page without it.
          onEnd={() => update({ tourOn: false, tourDone: true })}
          onActivate={() => openPaywall(ACTIVATE)}
        />
      )}

      {tutorial && user && (
        <TutorialCard
          userId={user.id}
          pathname={pathname}
          minimised={flags.minimised}
          onMinimise={() => update({ minimised: !flags.minimised })}
          onGo={href => router.push(href)}
          onDone={() => update({ tutDone: true })}
        />
      )}

      {paywall && <PaywallPopup reason={paywall} onClose={closePaywall} />}
    </>
  )
}

// ── WELCOME POPUP: the /welcome showcase, inside the dashboard ───────────
function WelcomePopup({ onTour, onActivate, onClose }: { onTour: () => void; onActivate: () => void; onClose: () => void }) {
  const [i, setI] = useState(0)
  const last = i === SCENES.length - 1
  const sc = SCENES[i]
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI(x => Math.min(SCENES.length - 1, x + 1))
      else if (e.key === 'ArrowLeft') setI(x => Math.max(0, x - 1))
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="obx-layer" role="dialog" aria-modal="true" aria-label={tr('Welcome to DialerSeat')}>
      <div className="obx-dim" />
      <div className="obx-pop">
        <div className="obx-pop-top">
          <div className="obx-dots">
            {SCENES.map((s, j) => <button key={s.key} onClick={() => setI(j)} aria-label={tr('Go to step {i}', { i: j + 1 })} className={j <= i ? 'on' : ''} />)}
          </div>
          <span className="obx-sp" />
          <button className="obx-x" onClick={onClose} aria-label={tr('Close')}>×</button>
        </div>
        <div className="obx-stage"><div className="sw-stage-inner obx-stage-inner">
          {i === 0 && <DialerScene />}
          {i === 1 && <AnalyticsScene />}
          {i === 2 && <SuperiorScene />}
        </div></div>
        <div key={sc.key} className="obx-explain">
          <div className="e">{tr(sc.eyebrow)}</div>
          {sc.headline2 ? (<><div className="h small">{tr(sc.headline)}</div><div className="h">{sc.headline2}</div></>) : <div className="h">{tr(sc.headline)}</div>}
          <div className="s">{tr(sc.sub)}</div>
        </div>
        <div className="obx-ctrl">
          {last ? (
            <>
              <button className="obx-act" onClick={onActivate}>{tr('ACTIVATE · $35/WEEK')}</button>
              <button className="obx-white" onClick={onTour}>{tr('SHOW ME AROUND')}</button>
            </>
          ) : (
            <>
              {i > 0 ? <button className="obx-back" onClick={() => setI(i - 1)}>{tr('← BACK')}</button> : <button className="obx-back" onClick={onClose}>{tr('SKIP')}</button>}
              <button className="obx-next" onClick={() => setI(i + 1)}>{tr('NEXT →')}</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── THE GUIDE CARD: same place on every page ──────────────────────────────
function Card({ label, n, of, h, p, extra, lift, minimised, onMinimise, children }: { label: string; n: number; of: number; h: string; p: string; extra?: string; lift?: boolean; minimised: boolean; onMinimise: () => void; children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add('obx-has-card')
    return () => document.body.classList.remove('obx-has-card')
  }, [])
  return (
    <div className={`obx-card${minimised ? ' min' : ''}${lift ? ' lift' : ''}`} role="region" aria-label={tr(h)}>
      <div className="obx-bar"><i style={{ width: `${(n / of) * 100}%` }} /></div>
      <div className="obx-in">
        <div className="obx-eyebrow"><span>{tr(label)} · {n} {tr('OF')} {of}</span><button onClick={onMinimise}>{minimised ? tr('SHOW') : tr('HIDE')}</button></div>
        {!minimised && (<>
          <h4>{tr(h)}</h4>
          <p>{tr(p)}</p>
          {extra && (
            <div className="obx-redial">
              <div className="obx-chips"><span>{tr('REDIAL')}</span><b className="on">1x</b><b>2x</b><b>3x</b></div>
              <p>{tr(extra)}</p>
            </div>
          )}
          <div className="obx-row">{children}</div>
        </>)}
      </div>
    </div>
  )
}

function TourCard({ pathname, minimised, onMinimise, onGo, onEnd, onActivate }: { pathname: string; minimised: boolean; onMinimise: () => void; onGo: (h: string) => void; onEnd: () => void; onActivate: () => void }) {
  const steps = TOUR.length + 1
  const [end, setEndState] = useState(() => { try { return sessionStorage.getItem(TOUR_END_KEY) === '1' } catch { return false } })
  const setEnd = (v: boolean) => { setEndState(v); try { if (v) sessionStorage.setItem(TOUR_END_KEY, '1'); else sessionStorage.removeItem(TOUR_END_KEY) } catch {} }
  const onEndPage = pathname === TOUR_END.href
  // Leaving Analytics by the sidebar puts them back on the ordinary stops.
  useEffect(() => { if (!onEndPage) setEnd(false) }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps
  const i = TOUR.findIndex(s => pathname === s.href || pathname.startsWith(s.href + '/'))
  // A page outside the tour shows the last step rather than nothing, so the
  // card never vanishes until they choose KEEP LOOKING.
  if ((end && onEndPage) || i < 0) {
    return (
      <Card label={TOUR_END.label} n={steps} of={steps} h={TOUR_END.h} p={TOUR_END.p} minimised={minimised} onMinimise={onMinimise}>
        <button className="obx-bk obx-wide" onClick={() => { setEnd(false); onEnd() }}>{tr('KEEP LOOKING')}</button>
        <button className="obx-bk" onClick={() => { setEnd(false); onGo(TOUR[TOUR.length - 1].href) }}>{tr('← BACK')}</button>
        <span className="obx-sp" />
        <button className="obx-nx" onClick={onActivate}>{tr('ACTIVATE · $35/WEEK')}</button>
      </Card>
    )
  }
  const s = TOUR[i], last = i === TOUR.length - 1
  return (
    <>
      {/* The sidebar item for this stop lights up, so they learn where it lives. */}
      <style>{`.ds-nav-link[href="${s.href}"]{box-shadow:inset 3px 0 0 var(--brand-primary);animation:obx-nav 1.6s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.ds-nav-link[href="${s.href}"]{animation:none}}`}</style>
      <Card label={s.label} n={i + 1} of={steps} h={s.h} p={s.p} extra={s.extra} minimised={minimised} onMinimise={onMinimise}>
        {i > 0 && <button className="obx-bk" onClick={() => onGo(TOUR[i - 1].href)}>{tr('← BACK')}</button>}
        {/* Skipping goes to the last step, the one that asks them to activate. */}
        <button className="obx-sk" onClick={() => { setEnd(true); onGo(TOUR_END.href) }}>{tr('SKIP TOUR')}</button>
        <span className="obx-sp" />
        <button className="obx-nx" onClick={() => { if (last) { setEnd(true); onGo(TOUR_END.href) } else onGo(TOUR[i + 1].href) }}>{tr('NEXT →')}</button>
      </Card>
    </>
  )
}

// ── AFTER PAYING: upload, dial, look at the numbers ───────────────────────
function TutorialCard({ userId, pathname, minimised, onMinimise, onGo, onDone }: { userId: string; pathname: string; minimised: boolean; onMinimise: () => void; onGo: (h: string) => void; onDone: () => void }) {
  const [progress, setProgress] = useState<{ campaigns: number; calls: number } | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    let off = false
    const check = async () => {
      try {
        const [c, s] = await Promise.all([
          fetch(`/api/campaigns/list?user_id=${encodeURIComponent(userId)}`).then(r => r.json()),
          fetch(`/api/analytics/summary?user_id=${encodeURIComponent(userId)}`).then(r => r.json()),
        ])
        const campaigns = Array.isArray(c?.campaigns) ? c.campaigns.length : Array.isArray(c?.data) ? c.data.length : 0
        if (!off) setProgress({ campaigns, calls: s?.summary?.totalCalls || 0 })
      } catch {}
    }
    check()
    timer.current = setInterval(check, 4000)
    return () => { off = true; if (timer.current) clearInterval(timer.current) }
  }, [userId, pathname])
  if (!progress) return null
  const step = progress.campaigns === 0 ? 0 : progress.calls === 0 ? 1 : 2
  const on = (h: string) => pathname === h || pathname.startsWith(h + '/')
  const S = [
    { label: msg('CAMPAIGNS'), href: '/dashboard/campaigns', h: msg('Upload your leads'), p: msg('Drop your CSV into a campaign. Name it, organize it, and have multiple campaigns ready to go simultaneously.'), here: msg('PRESS + NEW CAMPAIGN ↑'), go: msg('OPEN CAMPAIGNS →') },
    { label: msg('DIALER'), href: '/dashboard/dialer', h: msg('Set available to dial'), p: msg('Pick your campaign, choose a mode, and set yourself available. The dialer starts calling, and on Progressive and Predictive voicemail detection screens out the machines for you.'), extra: REDIAL, here: msg('PRESS SET AVAILABLE ↓'), go: msg('OPEN THE DIALER →') },
    { label: msg('ANALYTICS'), href: '/dashboard/analytics', h: msg('Check your analytics'), p: msg('Every call you just made is already counted: calls, conversions, talk time, and where your closes come from.'), here: '', go: msg('OPEN ANALYTICS →') },
  ][step]
  return (
    <Card label={S.label} n={step + 1} of={3} h={S.h} p={S.p} extra={(S as { extra?: string }).extra} lift={step === 1 && on(S.href)} minimised={minimised} onMinimise={onMinimise}>
      <button className="obx-sk" onClick={onDone}>{tr('SKIP TUTORIAL')}</button>
      <span className="obx-sp" />
      {step === 2 && on(S.href)
        ? <button className="obx-nx go" onClick={onDone}>{tr('FINISH')}</button>
        : on(S.href) ? <>
            <span className="obx-hint">{tr(S.here)}</span>
          </>
        : <button className="obx-nx" onClick={() => onGo(S.href)}>{tr(S.go)}</button>}
    </Card>
  )
}

// ── THE REAL BILLING PAGE, AS A POPUP OVER WHATEVER PAGE THEY ARE ON ──────
function PaywallPopup({ reason, onClose }: { reason: PaywallReason; onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', k) }
  }, [onClose])
  return (
    <BillingOverlayContext.Provider value={{ close: onClose }}>
      <div className="obx-layer obx-bill-layer" role="dialog" aria-modal="true" aria-label={tr('Activate your seat')}>
        <div className="obx-dim" onClick={onClose} />
        <div className="obx-bill">
          <div className="obx-pay-strip">
            <span><b>{tr(reason.eyebrow)}</b> {tr(reason.line)}</span>
            <button className="obx-x" onClick={onClose} aria-label={tr('Close')}>×</button>
          </div>
          <Suspense fallback={null}><BillingPage /></Suspense>
        </div>
      </div>
    </BillingOverlayContext.Provider>
  )
}

const CSS = `
@keyframes sw-rise { from { opacity:0; transform: translateY(10px);} to {opacity:1; transform: translateY(0);} }
@keyframes sw-pulse { 0%,100%{opacity:1;} 50%{opacity:.4;} }
@keyframes sw-blink { 0%,100%{opacity:1;} 50%{opacity:.2;} }
@keyframes sw-grow { from { transform: scaleY(0);} to { transform: scaleY(1);} }
@keyframes sw-pop { from { opacity:0; transform: translateY(8px) scale(0.98);} to { opacity:1; transform: translateY(0) scale(1);} }
@keyframes obx-up { from { opacity:0; transform: translateY(40px);} to { opacity:1; transform:none;} }
@keyframes obx-nav { 50% { background: color-mix(in srgb, var(--brand-primary) 22%, transparent); } }

.obx-banner{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 16px;background:#0b1a2e;border-bottom:1px solid #1e3a5f;color:#7cc0ff;font-size:13px;line-height:1.5;font-family:${FUTURA}}
.obx-banner b{font-size:10px;letter-spacing:2px;color:#4a9eff;margin-inline-end:6px}
.obx-sp{flex:1}
.obx-banner button{padding:7px 14px;border-radius:4px;border:1px solid var(--brand-primary);font-size:10px;letter-spacing:2px;font-weight:700;cursor:pointer;font-family:${FUTURA}}
.obx-banner .obx-ghost{background:#fff;color:#1a1c24;border:1px solid #c4c8d0;border-top:2px solid #1a1c24}
.obx-solid{background:var(--brand-primary);color:var(--brand-on-primary)}

.obx-layer{position:fixed;inset:0;z-index:900;display:flex;align-items:center;justify-content:center;padding:20px;font-family:${FUTURA}}
.obx-dim{position:absolute;inset:0;background:rgba(7,8,15,.72)}
.obx-pop{position:relative;width:100%;max-width:820px;max-height:calc(100dvh - 40px);overflow:auto;border-radius:12px;color:var(--brand-on-sidebar,#fff);border:1px solid rgba(255,255,255,.1);background:radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--brand-sidebar-bg,#111118) 80%, #1a2340) 0%, var(--brand-sidebar-bg,#111118) 60%, #07080f 100%);animation:sw-pop .3s ease}
.obx-pop-top{display:flex;align-items:center;gap:16px;padding:18px 22px 4px}
.obx-dots{display:flex;gap:8px;flex:1;max-width:280px}
.obx-dots button{flex:1;height:4px;border-radius:3px;border:none;padding:0;cursor:pointer;background:rgba(255,255,255,.16)}
.obx-dots button.on{background:var(--brand-primary)}
.obx-x{width:34px;height:34px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.25);color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.obx-stage{padding:14px 22px 0;display:flex;justify-content:center}
.obx-stage-inner{width:100%;max-width:760px}
.obx-explain{max-width:620px;margin:0 auto;text-align:center;padding:18px 24px 6px;animation:sw-rise .45s ease}
.obx-explain .e{font-size:11px;letter-spacing:4px;color:var(--brand-primary);font-weight:800;margin-bottom:10px}
.obx-explain .h{font-size:26px;font-weight:800;letter-spacing:.3px;line-height:1.15;margin-bottom:10px;white-space:pre-line}
.obx-explain .h.small{font-size:20px;margin-bottom:6px}
.obx-explain .s{font-size:14px;line-height:1.6;color:rgba(255,255,255,.72);white-space:pre-line}
.obx-ctrl{position:sticky;bottom:0;z-index:2;display:flex;justify-content:center;align-items:center;gap:14px;padding:14px 28px 20px;flex-wrap:wrap;background:linear-gradient(to top,#07080f 72%,transparent)}
@media (min-width:769px) and (max-height:860px){.obx-stage-inner{zoom:.8}.obx-explain{padding-top:12px}.obx-explain .h{font-size:23px}.obx-explain .s{font-size:13.5px}}
.obx-back{padding:12px 20px;border-radius:10px;cursor:pointer;background:transparent;border:1px solid rgba(255,255,255,.18);color:rgba(255,255,255,.85);font-family:${FUTURA};font-size:12px;letter-spacing:2px;font-weight:700}
.obx-act{padding:12px 20px;border-radius:10px;border:none;cursor:pointer;background:var(--brand-primary);color:var(--brand-on-primary);font-family:${FUTURA};font-size:12px;letter-spacing:2px;font-weight:700}
/* The white button from the landing page (SEE HOW WE COMPARE), on a dark surface. */
.obx-white{padding:13px 28px;border-radius:10px;cursor:pointer;background:#fff;color:#1a1c24;border:1px solid #c4c8d0;border-top:3px solid #1a1c24;font-family:${FUTURA};font-size:13px;letter-spacing:2px;font-weight:800}
.obx-next{padding:13px 28px;border-radius:10px;border:none;cursor:pointer;background:var(--brand-primary);color:var(--brand-on-primary);font-family:${FUTURA};font-size:13px;letter-spacing:2px;font-weight:800}

.obx-card{position:fixed;left:278px;bottom:18px;z-index:800;width:340px;max-width:calc(100vw - 296px);background:var(--brand-sidebar-bg,#111118);color:var(--brand-on-sidebar,#fff);border:1px solid rgba(255,255,255,.12);border-radius:8px;overflow:hidden;font-family:${FUTURA};animation:sw-pop .25s ease}
.obx-bar{height:3px;background:rgba(255,255,255,.08)}
.obx-bar i{display:block;height:100%;background:var(--brand-primary);transition:width .3s}
.obx-in{padding:16px}
.obx-card.min .obx-in{padding:12px 16px}
.obx-card.lift{bottom:68px}
.obx-eyebrow{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:9px;letter-spacing:3px;color:var(--brand-primary);font-weight:800;margin-bottom:8px}
.obx-card.min .obx-eyebrow{margin-bottom:0}
.obx-eyebrow button{background:none;border:none;color:rgba(255,255,255,.5);font-size:9px;letter-spacing:1.5px;font-weight:700;padding:0;cursor:pointer;font-family:${FUTURA}}
.obx-card h4{font-size:17px;font-weight:800;margin:0 0 6px;letter-spacing:.3px}
.obx-card p{font-size:12.5px;line-height:1.55;color:rgba(255,255,255,.72);margin:0 0 14px;white-space:pre-line}
.obx-redial{border-top:1px solid rgba(255,255,255,.1);padding-top:12px;margin-bottom:14px}
.obx-redial p{margin:0}
.obx-chips{display:flex;align-items:center;gap:4px;margin-bottom:8px}
.obx-chips span{font-size:9px;letter-spacing:1.2px;color:rgba(255,255,255,.55);margin-inline-end:4px}
.obx-chips b{font-size:10px;font-weight:700;padding:3px 8px;border-radius:3px;border:1px solid rgba(255,255,255,.25);color:rgba(255,255,255,.7)}
.obx-chips b.on{background:var(--brand-primary);border-color:var(--brand-primary);color:var(--brand-on-primary)}
.obx-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.obx-row button,.obx-ctrl button,.obx-banner button{box-shadow:none!important;text-shadow:none!important;filter:none!important;-webkit-tap-highlight-color:transparent}
.obx-row button:focus:not(:focus-visible),.obx-ctrl button:focus:not(:focus-visible),.obx-banner button:focus:not(:focus-visible){outline:none}
.obx-row button{padding:9px 14px;border-radius:6px;font-size:10px;letter-spacing:2px;font-weight:800;cursor:pointer;font-family:${FUTURA}}
.obx-nx{background:var(--brand-primary);border:none;color:var(--brand-on-primary)}
.obx-nx.go{background:#1a6a1a;color:#fff}
.obx-row .obx-wide{flex:1 1 100%;padding:13px 14px;font-size:11px}
.obx-bk{background:transparent;border:1px solid rgba(255,255,255,.18);color:#fff}
.obx-row .obx-sk{background:transparent;border:none;color:rgba(255,255,255,.55);padding-inline:4px}
.obx-hint{order:-1;flex:1 1 100%;font-size:10px;letter-spacing:2px;color:#ffaa3e;font-weight:800}

.obx-bill-layer{z-index:1000}
.obx-bill{position:relative;width:100%;max-width:1040px;max-height:calc(100dvh - 40px);overflow-y:auto;border-radius:12px;background:#0d0e14;border:1px solid #2a2c34;box-shadow:0 30px 80px rgba(0,0,0,.6);animation:sw-pop .25s ease}
/* The billing page is built to fill a window; inside the popup it fills the popup. */
.obx-bill main{min-height:0!important;padding:14px!important;background:transparent!important}
.obx-bill .billing-brand-desktop-only{display:none!important}
.obx-pay-strip{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:12px;padding:10px 16px;background:#0b1a2e;border-bottom:1px solid #1e3a5f;color:#7cc0ff;font-size:13px;line-height:1.5;font-family:${FUTURA}}
.obx-pay-strip span{flex:1}
.obx-pay-strip b{font-size:10px;letter-spacing:2px;color:#4a9eff;margin-inline-end:6px}

@media (max-width:768px){
  .obx-layer{align-items:flex-end;padding:0}
  .obx-pop{max-height:92dvh;border-radius:16px 16px 0 0;animation:obx-up .3s ease;padding-bottom:env(safe-area-inset-bottom,0px)}
  .obx-pop-top{padding:14px 16px 4px}
  .obx-stage{overflow:hidden;padding:8px 0 0}
  .obx-stage-inner{width:760px!important;max-width:760px!important;flex-shrink:0;transform:scale(.44);transform-origin:top center;margin-bottom:-210px}
  .obx-explain{padding:6px 18px 4px}
  .obx-explain .e{font-size:10px;letter-spacing:2.5px;margin-bottom:8px}
  .obx-explain .h{font-size:19px;margin-bottom:8px}
  .obx-explain .h.small{font-size:15px}
  .obx-explain .s{font-size:12px;line-height:1.45}
  .obx-ctrl{padding:12px 16px 18px}
  .obx-ctrl button{flex:1}
  .obx-ctrl .obx-act{flex:2 1 0;padding:10px 8px;font-size:10px;letter-spacing:1.5px;line-height:1.35}
  .obx-ctrl .obx-white{flex:3 1 0;padding:13px 8px;font-size:12px;letter-spacing:1.5px}
  .obx-card.lift{bottom:0}
  .obx-bill{max-height:92dvh;border-radius:16px 16px 0 0;border-width:1px 0 0;animation:obx-up .3s ease;padding-bottom:env(safe-area-inset-bottom,0px)}
  .obx-bill main{padding:12px!important}
  .obx-card{left:0;right:0;bottom:0;width:auto;max-width:none;border-radius:14px 14px 0 0;padding-bottom:env(safe-area-inset-bottom,0px);animation:obx-up .3s ease}
  body.obx-has-card .ds-mobile-content{padding-bottom:230px}
}
@media (prefers-reduced-motion:reduce){.obx-pop,.obx-card,.obx-bill,.obx-explain{animation:none}}
`
