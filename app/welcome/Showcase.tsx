'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'






















const FUTURA = 'Futura PT, Futura, "Trebuchet MS", sans-serif'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'



const BILLING_PATH = '/billing?from=welcome'

const C = {
  primary: 'var(--brand-primary, #4a9eff)',
  onPrimary: 'var(--brand-on-primary, #ffffff)',
  sidebar: 'var(--brand-sidebar-bg, #111118)',
  onSidebar: 'var(--brand-on-sidebar, #ffffff)',
  onSidebarMuted: 'var(--brand-on-sidebar-muted, #8888aa)',
  page: 'var(--brand-page-bg, #f0f1f4)',
  onPage: 'var(--brand-on-page-bg, #1a1c24)',
  card: 'var(--brand-card-surface, #e2e4ea)',
  cardBorder: 'var(--brand-card-border, #c4c8d0)',
  muted: 'var(--brand-muted-text, #5a5e6a)',
  header: 'var(--brand-header-bg, #1a1a2e)',
}
const GREEN = '#1a6a1a'
const GREEN_BRIGHT = '#5ad17a'
const ACCENT = '#2a4a8a'

interface Scene {
  key: string
  eyebrow: string
  headline: string
  sub: string
  subLead?: string
  
  headline2?: string
}

const SCENES: Scene[] = [
  {
    key: 'dialer',
    eyebrow: 'A SUPERIOR DIALER',
    headline: "If your career is dialing numbers,\nYou're in the right place.",
    sub: "Dial all day on an unlimited number pool, with all of your scripts in one place — with four dialer modes included to suit your style seamlessly.",
  },
  {
    key: 'analytics',
    eyebrow: 'YOUR NUMBERS, LIVE',
    headline: 'DialerSeat Analytics',
    headline2: 'Statistics as you dial.',
    sub: "Calls, conversions, talk time, and where your closes come from — all tracked on the backend for you, the second each call ends. Nothing to log, and nothing to maintain. Upload infinite campaigns and toggle each one on or off for the smoothest possible workflow.",
  },
  {
    key: 'superior',
    eyebrow: 'WHY IT WINS',
    headline: 'Designed to make you a closing machine',
    sub: "Created by a team of seasoned developers alongside a group of high-ranking producers with real knowledge of the game who are tired of empty promises. DialerSeat is built around your experience — and we're actively taking suggestions as well, to provide the best dialer on the face of the earth. Thanks for all of your support along this journey.\n~ DialerSeat",
  },
]

export default function ShowcaseWizard() {
  const router = useRouter()
  const [scene, setScene] = useState(0)

  const goBilling = useCallback(() => router.push(BILLING_PATH), [router])
  const next = useCallback(() => setScene(s => (s >= SCENES.length - 1 ? s : s + 1)), [])
  const prev = useCallback(() => setScene(s => Math.max(0, s - 1)), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'Escape') goBilling()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, goBilling])

  const current = SCENES[scene]
  const isLast = scene === SCENES.length - 1

  return (
    <div className="sw-root" style={{
      position: 'fixed', inset: 0, overflow: 'hidden', overflowX: 'hidden',
      background: `radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, ${C.sidebar} 80%, #1a2340) 0%, ${C.sidebar} 60%, #07080f 100%)`,
      color: C.onSidebar, fontFamily: FUTURA, display: 'flex', flexDirection: 'column',
    }}>
      {/* top: clickable progress dots + skip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 28px' }}>
        <div style={{ display: 'flex', gap: 8, flex: 1, maxWidth: 280 }}>
          {SCENES.map((s, i) => (
            <button key={s.key} onClick={() => setScene(i)} aria-label={`Go to step ${i + 1}`} style={{
              flex: 1, height: 4, borderRadius: 3, cursor: 'pointer', border: 'none', padding: 0,
              background: i <= scene ? C.primary : 'rgba(255,255,255,0.16)', transition: 'background 0.25s ease',
            }} />
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={goBilling} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', fontFamily: FUTURA, fontSize: 12, letterSpacing: 2, fontWeight: 700, cursor: 'pointer', padding: '6px 4px' }}>SKIP →</button>
      </div>

      {/* MIDDLE GROUP */}
      <div className="sw-mid" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '25px 0 8px' }}>
        {/* stage */}
        <div className="sw-stage" style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', minHeight: 0 }}>
          <div className="sw-stage-inner" style={{ width: '100%', maxWidth: 760 }}>
            {scene === 0 && <DialerScene />}
            {scene === 1 && <AnalyticsScene />}
            {scene === 2 && <SuperiorScene />}
          </div>
        </div>

        {/* explanation */}
        <div style={{ padding: '18px 24px 12px', display: 'flex', justifyContent: 'center' }}>
          <div key={current.key} className="sw-explain" style={{ maxWidth: 620, textAlign: 'center', animation: 'sw-rise 0.45s ease' }}>
            <div style={{ fontSize: 11, letterSpacing: 4, color: C.primary, fontWeight: 800, marginBottom: 10 }}>{current.eyebrow}</div>
            {current.headline2 ? (
              <>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.3, lineHeight: 1.15, marginBottom: 6, whiteSpace: 'pre-line' }}>{current.headline}</div>
                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 0.3, lineHeight: 1.15, marginBottom: 12, whiteSpace: 'pre-line' }}>{current.headline2}</div>
              </>
            ) : (
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 0.3, lineHeight: 1.15, marginBottom: 12, whiteSpace: 'pre-line' }}>{current.headline}</div>
            )}
            {current.subLead && <div style={{ fontSize: 15, lineHeight: 1.6, color: C.primary, fontWeight: 700, marginBottom: 6 }}>{current.subLead}</div>}
            <div style={{ fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.72)', whiteSpace: 'pre-line' }}>{current.sub}</div>
          </div>
        </div>

        {/* controls */}
        <div style={{ padding: '16px 28px 30px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          {scene > 0 && (
            <button onClick={prev} style={{ padding: '12px 20px', borderRadius: 10, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.85)', fontFamily: FUTURA, fontSize: 12, letterSpacing: 2, fontWeight: 700 }}>← BACK</button>
          )}
          <button onClick={isLast ? goBilling : next} style={{ padding: '13px 28px', borderRadius: 10, border: 'none', cursor: 'pointer', background: C.primary, color: C.onPrimary, fontFamily: FUTURA, fontSize: 13, letterSpacing: 2, fontWeight: 800 }}>
            {isLast ? 'GET STARTED →' : 'NEXT →'}
          </button>
        </div>
      </div>

      <style>{`
        html, body { background: var(--brand-sidebar-bg, #111118) !important; }
        @keyframes sw-rise { from { opacity:0; transform: translateY(10px);} to {opacity:1; transform: translateY(0);} }
        @keyframes sw-pulse { 0%,100%{opacity:1;} 50%{opacity:.4;} }
        @keyframes sw-blink { 0%,100%{opacity:1;} 50%{opacity:.2;} }
        @keyframes sw-grow { from { transform: scaleY(0);} to { transform: scaleY(1);} }
        @keyframes sw-pop { from { opacity:0; transform: translateY(8px) scale(0.98);} to { opacity:1; transform: translateY(0) scale(1);} }

        @media (max-width: 820px) {
          .sw-root { font-size: 13px; overflow-x: hidden; background: var(--brand-sidebar-bg, #111118) !important; }
          .sw-root::before {
            content: '';
            position: fixed;
            top: 0; left: 0; right: 0;
            height: env(safe-area-inset-top, 0px);
            background: var(--brand-sidebar-bg, #111118);
            z-index: 10;
            pointer-events: none;
          }
          .sw-root > div:first-child { padding: calc(env(safe-area-inset-top, 0px) + 18px) 14px 12px !important; }
          .sw-explain { max-width: 100% !important; padding: 0 18px 8px !important; }
          .sw-explain > div:nth-child(1) { font-size: 10px !important; letter-spacing: 2.5px !important; margin-bottom: 8px !important; }
          .sw-explain > div:nth-child(2) { font-size: 19px !important; margin-bottom: 8px !important; line-height: 1.15 !important; }
          .sw-explain > div:nth-child(3) { font-size: 12px !important; line-height: 1.45 !important; }
          .sw-explain > div { font-size: 11px !important; line-height: 1.45 !important; }
          .sw-mid { padding: 0 0 env(safe-area-inset-bottom, 0px) !important; justify-content: center !important; }
          .sw-stage { overflow: hidden !important; padding: 0 !important; }
          .sw-stage-inner {
            width: 760px !important;
            max-width: 760px !important;
            transform: scale(0.44);
            transform-origin: top center;
            margin-left: calc((100vw - 760px) / 2) !important;
            margin-right: calc((100vw - 760px) / 2) !important;
            margin-bottom: -210px !important;
          }
        }
      `}</style>
    </div>
  )
}

function MacFrame({ title, titleColor, bg, children }: { title: string; titleColor: string; bg: string; children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: bg, boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: 'rgba(0,0,0,0.18)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
        <span style={{ marginLeft: 10, fontSize: 10, letterSpacing: 2, color: titleColor, fontWeight: 700 }}>{title}</span>
      </div>
      <div>{children}</div>
    </div>
  )
}


const SCRIPTS: { key: string; label: string; text: string }[] = [
  { key: 'life', label: 'Life', text: `"Hi (client), this is (your name goes here) reaching
out about the life coverage you
looked into.

It only takes a minute — I can show
you what you'd actually qualify for,
no medical exam needed…"` },
  { key: 'health', label: 'Health', text: `"Hi (client), this is (your name goes here) — you
requested help finding a health plan,
is now a good time?

Perfect. Let's see if we can get you
better coverage for less than you're
paying today…"` },
  { key: 'realestate', label: 'Real Estate', text: `"Hi (client), this is (your name goes here) — I saw
you were curious what your home
might be worth.

I can get you a real number today,
and if you ever decide to sell, walk
you through what's next…"` },
  { key: 'solar', label: 'Solar', text: `"Hi (client), this is (your name goes here) — did I
catch you at an okay time?

Great. You asked about cutting your
power bill with solar, so I wanted to
get you a quick free estimate…"` },
]

function DialerScene() {
  const [secs, setSecs] = useState(0)
  const [closed, setClosed] = useState(false)
  const [scriptIdx, setScriptIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setSecs(s => s + 1), 1000)
    const log = setTimeout(() => setClosed(true), 3200)
    return () => { clearInterval(t); clearTimeout(log) }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setScriptIdx(i => (i + 1) % SCRIPTS.length), 3000)
    return () => clearInterval(id)
  }, [])

  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')
  const script = SCRIPTS[scriptIdx]

  const metrics: [string, string, string][] = [
    ['DIALS', '131', C.primary],
    ['CONNECTED', '35', C.primary],
    ['TALK TIME', '1h 26m', '#4a9eff'],
    ['CLOSED', '12', GREEN],
    ['APPOINTMENTS', '8', '#1a4a8a'],
    ['CALLBACKS', '17', '#8a6a1a'],
    ['NOT INTERESTED', '21', '#8a6a1a'],
    ['DO NOT CALL', '4', '#8a1a1a'],
  ]

  return (
    <MacFrame title="DIALER" titleColor="#5a8a5a" bg={C.sidebar}>
      <div className="sw-dialer-row" style={{ display: 'flex', minHeight: 300 }}>
        <div className="sw-dialer-call" style={{ flex: 1, padding: 14, borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, background: C.page, border: `1px solid ${C.cardBorder}`, borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '7px 12px', background: C.sidebar, borderBottom: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9, letterSpacing: 3, color: C.onSidebarMuted, fontWeight: 700 }}>LEAD PROFILE</span>
              <span style={{ fontSize: 9, fontFamily: MONO, color: C.primary }}>ID: 7a3f9c2e</span>
            </div>
            <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '10px 14px', background: C.page, border: `2px solid ${GREEN}`, borderRadius: 4 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 19, fontWeight: 800, fontFamily: MONO, color: C.onPage, letterSpacing: 1, marginBottom: 3 }}>JOHN DOE</div>
                    <div style={{ fontSize: 15, fontFamily: MONO, color: ACCENT, fontWeight: 800, letterSpacing: 2 }}>+1 (713) 555-0142</div>
                    <div style={{ fontSize: 10, fontFamily: MONO, color: C.muted, letterSpacing: 1, marginTop: 4 }}>HOUSTON, TX · {mm}:{ss}</div>
                  </div>
                  <div style={{ padding: '4px 10px', borderRadius: 2, background: '#e8f5e8', border: `1px solid ${GREEN}`, fontSize: 9, letterSpacing: 2, fontWeight: 800, color: GREEN }}>● LIVE</div>
                </div>
              </div>

              <div style={{ flex: 1, marginTop: 10, background: C.page, border: `1px solid ${C.cardBorder}`, borderLeft: `3px solid ${ACCENT}`, borderRadius: 3, display: 'flex', flexDirection: 'column', minHeight: 96, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px 0', borderBottom: `1px solid ${C.cardBorder}`, flexWrap: 'wrap' }}>
                  {SCRIPTS.map((sc, i) => (
                    <button key={sc.key} onClick={() => setScriptIdx(i)} style={{
                      padding: '5px 10px', cursor: 'pointer', border: 'none', borderRadius: '5px 5px 0 0',
                      background: i === scriptIdx ? ACCENT : 'transparent',
                      color: i === scriptIdx ? '#fff' : C.muted,
                      fontFamily: FUTURA, fontSize: 9, letterSpacing: 1, fontWeight: 800,
                      transition: 'all 0.15s ease',
                    }}>{sc.label.toUpperCase()}</button>
                  ))}
                </div>
                <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 8, letterSpacing: 2, color: C.muted, marginBottom: 6 }}>CALL SCRIPT</div>
                  <div key={script.key} style={{ height: 136, fontSize: 11, lineHeight: 1.7, color: C.onPage, fontFamily: MONO, whiteSpace: 'pre-wrap', animation: 'sw-rise 0.25s ease' }}>{script.text}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="sw-dialer-metrics" style={{ width: 196, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 14px', background: C.sidebar, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: 9, letterSpacing: 3, color: C.onSidebarMuted, fontWeight: 700 }}>TODAY'S METRICS</span>
          </div>
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {metrics.map(([label, value, color]) => {
              const cl = label === 'CLOSED'
              return (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 11px', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)', borderLeft: `3px solid ${color}`, borderRadius: 3,
                }}>
                  <span style={{ fontSize: 8, letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, fontFamily: MONO, color: cl ? GREEN_BRIGHT : color === C.primary ? '#7ab8ff' : 'rgba(255,255,255,0.85)' }}>{value}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </MacFrame>
  )
}


function AnalyticsScene() {
  const tiles: [string, number, string, string, string, boolean][] = [
    ['TOTAL CALLS', 1284, C.primary, '', '↑ 12%', true],
    ['CONVERSIONS', 159, GREEN, '', '↑ 15%', false],
    ['TALK TIME', 14, '#4a9eff', 'h', '↑ 6%', false],
    ['CLOSED', 86, GREEN, '', '↑ 9%', false],
  ]
  const [vals, setVals] = useState(tiles.map(() => 0))
  const [showCharts, setShowCharts] = useState(false)
  useEffect(() => {
    setVals(tiles.map(() => 0)); setShowCharts(false)
    const start = Date.now(), dur = 780
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / dur), e = 1 - Math.pow(1 - p, 3)
      setVals(tiles.map(t => Math.round(t[1] * e)))
      if (p >= 1) clearInterval(id)
    }, 30)
    const c = setTimeout(() => setShowCharts(true), 420)
    return () => { clearInterval(id); clearTimeout(c) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pts = [10, 26, 18, 34, 28, 44, 36, 52, 46, 60, 54, 70]
  const W = 280, H = 74, maxV = 76
  const coords = pts.map((v, i) => [(i / (pts.length - 1)) * W, H - (v / maxV) * H])
  const linePath = 'M' + coords.map(c => `${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' L')
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  const pie = [
    { label: 'Closed', val: 42, color: GREEN },
    { label: 'Callback', val: 28, color: C.primary },
    { label: 'Not int.', val: 20, color: '#8a6a1a' },
    { label: 'DNC', val: 10, color: '#8a1a1a' },
  ]
  let acc = 0; const R = 34, CX = 40, CY = 40
  const arcs = pie.map(seg => {
    const a0 = (acc / 100) * Math.PI * 2 - Math.PI / 2; acc += seg.val
    const a1 = (acc / 100) * Math.PI * 2 - Math.PI / 2
    const large = a1 - a0 > Math.PI ? 1 : 0
    const x0 = CX + R * Math.cos(a0), y0 = CY + R * Math.sin(a0)
    const x1 = CX + R * Math.cos(a1), y1 = CY + R * Math.sin(a1)
    return { d: `M${CX},${CY} L${x0.toFixed(1)},${y0.toFixed(1)} A${R},${R} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z`, color: seg.color }
  })

  return (
    <MacFrame title="ANALYTICS" titleColor="#4a9eff" bg={C.page}>
      <div style={{ background: C.header, padding: '12px 18px', borderBottom: `2px solid ${C.primary}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: GREEN_BRIGHT, animation: 'sw-pulse 1.2s infinite' }} />
          <span style={{ fontSize: 12, letterSpacing: 3, color: C.primary, fontWeight: 800 }}>ANALYTICS OVERVIEW</span>
        </span>
        <span style={{ fontSize: 8.5, letterSpacing: 1.5, color: 'rgba(255,255,255,0.6)', fontWeight: 700, border: '1px solid rgba(255,255,255,0.18)', borderRadius: 4, padding: '3px 8px' }}>LAST 7 DAYS</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.onPage, marginBottom: 12, letterSpacing: 0.5 }}>WELCOME BACK, (YOUR NAME GOES HERE).</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 9, marginBottom: 12 }}>
          {tiles.map((t, i) => (
            <div key={t[0]} style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderTop: `3px solid ${t[2]}`, borderRadius: 8, padding: 11 }}>
              <div style={{ fontSize: 8, letterSpacing: 1.5, color: C.muted, fontWeight: 700, marginBottom: 6 }}>{t[0]}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 20, fontWeight: 800, fontFamily: MONO, color: t[2] }}>
                  {t[5] ? vals[i].toLocaleString() : vals[i]}{t[3]}
                </span>
                <span style={{ fontSize: 8, fontWeight: 800, color: GREEN_BRIGHT, background: `${GREEN_BRIGHT}24`, padding: '2px 5px', borderRadius: 4, letterSpacing: 0.3 }}>{t[4]}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="sw-an-row" style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 8, letterSpacing: 1.5, color: C.muted, fontWeight: 700 }}>CALL VOLUME OVER TIME</span>
              <span style={{ fontSize: 8, fontWeight: 800, color: GREEN_BRIGHT }}>↑ 18% vs last week</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 74, display: 'block' }}>
              <defs><linearGradient id="cv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.primary} stopOpacity="0.32" /><stop offset="100%" stopColor={C.primary} stopOpacity="0" /></linearGradient></defs>
              {[0.25, 0.5, 0.75].map(g => <line key={g} x1="0" y1={H * g} x2={W} y2={H * g} stroke={C.cardBorder} strokeWidth="1" strokeDasharray="3 3" />)}
              <path d={areaPath} fill="url(#cv)" style={{ opacity: showCharts ? 1 : 0, transition: 'opacity 0.5s ease 0.2s' }} />
              <path d={linePath} fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ strokeDasharray: 760, strokeDashoffset: showCharts ? 0 : 760, transition: 'stroke-dashoffset 0.7s ease-out' }} />
              {coords.map((c, i) => <circle key={i} cx={c[0]} cy={c[1]} r="2.3" fill={C.primary} style={{ opacity: showCharts ? 1 : 0, transition: `opacity 0.3s ease ${0.3 + i * 0.03}s` }} />)}
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {days.map((d, i) => <span key={i} style={{ fontSize: 7.5, color: C.muted, fontFamily: MONO }}>{d}</span>)}
            </div>
          </div>
          <div className="sw-an-right" style={{ width: 188, background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 8, letterSpacing: 1.5, color: C.muted, fontWeight: 700, marginBottom: 8 }}>DISPOSITION BREAKDOWN</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: showCharts ? 1 : 0, transition: 'opacity 0.5s ease 0.15s' }}>
              <svg viewBox="0 0 80 80" style={{ width: 70, height: 70, flexShrink: 0 }}>
                {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} />)}
                <circle cx={CX} cy={CY} r="16" fill={C.card} />
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {pie.map(seg => (
                  <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: seg.color }} />
                    <span style={{ fontSize: 9, color: C.onPage, fontWeight: 600 }}>{seg.label}</span>
                    <span style={{ fontSize: 9, color: C.muted, fontFamily: MONO, marginLeft: 'auto' }}>{seg.val}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MacFrame>
  )
}


function SuperiorScene() {
  const features: { icon: string; title: string; body: string }[] = [
    { icon: '⊘', title: 'No contracts', body: "Cancel anytime, absolutely no strings attached. Stay for the right reasons, not because you have to." },
    { icon: '🔒', title: 'Secured & protected', body: 'Your data is protected and secured at every level — your numbers and leads PERMANENTLY yours.' },
    { icon: '💸', title: 'The best price, guaranteed', body: 'More dialer for less money than the competition — enterprise-grade quality without the enterprise-level pricing.' },
    { icon: '∞', title: 'Unlimited dialing', body: 'Dial all day on an unlimited number pool — no line limits, never any surprise coverage fees.' },
    { icon: '📮', title: 'Voicemail Detection', body: "Real voicemail detection — not the fake stuff. Skip dead drops and spend your time on live people." },
    { icon: '🎯', title: 'Always improving', body: 'Shaped by real producers and updated constantly — the dialer that keeps getting better.' },
  ]
  return (
    <MacFrame title="WHY DIALERSEAT" titleColor="#5a8a5a" bg={C.sidebar}>
      <div style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.onSidebar, letterSpacing: 0.5 }}>A superior dialer, designed for success.</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {features.map((f, i) => (
            <div key={f.title} style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, padding: 14, animation: `sw-pop 0.45s ease ${i * 0.06}s both`,
            }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in srgb, ${C.primary} 22%, transparent)`, color: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, marginBottom: 9 }}>{f.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.onSidebar, marginBottom: 5 }}>{f.title}</div>
              <div style={{ fontSize: 11, lineHeight: 1.5, color: 'rgba(255,255,255,0.6)' }}>{f.body}</div>
            </div>
          ))}
        </div>
      </div>
    </MacFrame>
  )
}