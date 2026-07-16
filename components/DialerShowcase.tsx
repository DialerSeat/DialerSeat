'use client'

/**
 * DialerShowcase
 * ----------------------------------------------------------------------
 * The "welcome page 1" dialer mockup (LEAD PROFILE / JOHN DOE / call
 * script tabs / TODAY'S METRICS) - extracted from app/welcome/Showcase.tsx
 * (DialerScene + MacFrame) so it can be reused on the marketing landing
 * page hero, not just inside the post-signup onboarding wizard.
 *
 * Same live attributes as the onboarding version: the call timer ticks up
 * every second and the script tab auto-rotates every 3s.
 *
 * Renders at 100% of its container's width (no JS measurement, so there's
 * no hydration flash). On narrow screens the parent should apply the same
 * fixed-width-plus-CSS-scale technique Showcase.tsx already uses for its
 * own mobile breakpoint - see the `.ds-showcase-shell` rules in app/page.tsx.
 */

import { useState, useEffect } from 'react'

const FUTURA = 'Futura PT, Futura, "Trebuchet MS", sans-serif'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

const C = {
  primary: 'var(--brand-primary, #4a9eff)',
  sidebar: 'var(--brand-sidebar-bg, #111118)',
  onSidebarMuted: 'var(--brand-on-sidebar-muted, #8888aa)',
  page: 'var(--brand-page-bg, #f0f1f4)',
  onPage: 'var(--brand-on-page-bg, #1a1c24)',
  cardBorder: 'var(--brand-card-border, #c4c8d0)',
  muted: 'var(--brand-muted-text, #5a5e6a)',
}
const GREEN = '#1a6a1a'
const GREEN_BRIGHT = '#5ad17a'
const ACCENT = '#2a4a8a'

const SCRIPTS: { key: string; label: string; text: string }[] = [
  {
    key: 'life',
    label: 'Life',
    text: `"Hi (client), this is (your name goes here) reaching
out about the life coverage you
looked into.

It only takes a minute — I can show
you what you'd actually qualify for,
no medical exam needed…"`,
  },
  {
    key: 'health',
    label: 'Health',
    text: `"Hi (client), this is (your name goes here) — you
requested help finding a health plan,
is now a good time?

Perfect. Let's see if we can get you
better coverage for less than you're
paying today…"`,
  },
  {
    key: 'realestate',
    label: 'Real Estate',
    text: `"Hi (client), this is (your name goes here) — I saw
you were curious what your home
might be worth.

I can get you a real number today,
and if you ever decide to sell, walk
you through what's next…"`,
  },
  {
    key: 'solar',
    label: 'Solar',
    text: `"Hi (client), this is (your name goes here) — did I
catch you at an okay time?

Great. You asked about cutting your
power bill with solar, so I wanted to
get you a quick free estimate…"`,
  },
]

const METRICS: [string, string, string][] = [
  ['DIALS', '131', C.primary],
  ['CONNECTED', '35', C.primary],
  ['TALK TIME', '1h 26m', '#4a9eff'],
  ['CLOSED', '12', GREEN],
  ['APPOINTMENTS', '8', '#1a4a8a'],
  ['CALLBACKS', '17', '#8a6a1a'],
  ['NOT INTERESTED', '21', '#8a6a1a'],
  ['DO NOT CALL', '4', '#8a1a1a'],
]

function MacFrame({
  title,
  titleColor,
  bg,
  children,
}: {
  title: string
  titleColor: string
  bg: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        width: '100%',
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        background: bg,
        boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          background: 'rgba(0,0,0,0.18)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
        <span style={{ marginLeft: 10, fontSize: 10, letterSpacing: 2, color: titleColor, fontWeight: 700 }}>
          {title}
        </span>
      </div>
      <div>{children}</div>
    </div>
  )
}

export default function DialerShowcase() {
  const [secs, setSecs] = useState(0)
  const [scriptIdx, setScriptIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setScriptIdx((i) => (i + 1) % SCRIPTS.length), 3000)
    return () => clearInterval(id)
  }, [])

  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')
  const script = SCRIPTS[scriptIdx]

  return (
    <MacFrame title="DIALER" titleColor="#5a8a5a" bg={C.sidebar}>
      <div style={{ display: 'flex', minHeight: 220 }}>
        <div style={{ flex: 1, padding: 8, borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, background: C.page, border: `1px solid ${C.cardBorder}`, borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '4px 12px', background: C.sidebar, borderBottom: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9, letterSpacing: 3, color: C.onSidebarMuted, fontWeight: 700 }}>LEAD PROFILE</span>
              <span style={{ fontSize: 9, fontFamily: MONO, color: C.primary }}>ID: 7a3f9c2e</span>
            </div>
            <div style={{ flex: 1, padding: 6, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '6px 12px', background: C.page, border: `2px solid ${GREEN}`, borderRadius: 4 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 800, fontFamily: MONO, color: C.onPage, letterSpacing: 1, marginBottom: 2 }}>JOHN DOE</div>
                    <div style={{ fontSize: 14, fontFamily: MONO, color: ACCENT, fontWeight: 800, letterSpacing: 2 }}>+1 (713) 555-0142</div>
                    <div style={{ fontSize: 9, fontFamily: MONO, color: C.muted, letterSpacing: 1, marginTop: 3 }}>HOUSTON, TX · {mm}:{ss}</div>
                  </div>
                  <div style={{ padding: '4px 10px', borderRadius: 2, background: '#e8f5e8', border: `1px solid ${GREEN}`, fontSize: 9, letterSpacing: 2, fontWeight: 800, color: GREEN }}>● LIVE</div>
                </div>
              </div>

              <div style={{ flex: 1, marginTop: 4, background: C.page, border: `1px solid ${C.cardBorder}`, borderLeft: `3px solid ${ACCENT}`, borderRadius: 3, display: 'flex', flexDirection: 'column', minHeight: 64, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 6px 0', borderBottom: `1px solid ${C.cardBorder}`, flexWrap: 'wrap' }}>
                  {SCRIPTS.map((sc, i) => (
                    <button
                      key={sc.key}
                      onClick={() => setScriptIdx(i)}
                      style={{
                        padding: '3px 8px',
                        cursor: 'pointer',
                        border: 'none',
                        borderRadius: '5px 5px 0 0',
                        background: i === scriptIdx ? ACCENT : 'transparent',
                        color: i === scriptIdx ? '#fff' : C.muted,
                        fontFamily: FUTURA,
                        fontSize: 8,
                        letterSpacing: 1,
                        fontWeight: 800,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {sc.label.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div style={{ flex: 1, padding: '6px 8px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 7, letterSpacing: 2, color: C.muted, marginBottom: 3 }}>CALL SCRIPT</div>
                  <div key={script.key} style={{ height: 98, fontSize: 9.5, lineHeight: 1.5, color: C.onPage, fontFamily: MONO, whiteSpace: 'pre-wrap', animation: 'ds-showcase-rise 0.25s ease' }}>
                    {script.text}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ width: 196, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '6px 12px', background: C.sidebar, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: 9, letterSpacing: 3, color: C.onSidebarMuted, fontWeight: 700 }}>TODAY&apos;S METRICS</span>
          </div>
          <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {METRICS.map(([label, value, color]) => {
              const isClosed = label === 'CLOSED'
              return (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 9px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderLeft: `3px solid ${color}`,
                    borderRadius: 3,
                  }}
                >
                  <span style={{ fontSize: 8, letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      fontFamily: MONO,
                      color: isClosed ? GREEN_BRIGHT : color === C.primary ? '#7ab8ff' : 'rgba(255,255,255,0.85)',
                    }}
                  >
                    {value}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ds-showcase-rise {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </MacFrame>
  )
}
