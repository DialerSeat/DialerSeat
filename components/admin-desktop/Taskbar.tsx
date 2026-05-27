'use client'
import { useEffect, useState } from 'react'
import type { WindowState, AppDefinition } from './types'
import { getApp } from './registry'

interface TaskbarProps {
  windows: WindowState[]
  focusedWindowId: string | null
  recentApps: AppDefinition[]
  onStartClick: () => void
  startMenuOpen: boolean
  onTaskbarItemClick: (windowId: string) => void
  onTaskbarItemContextMenu: (windowId: string, clientX: number, clientY: number) => void
  onShowDesktop: () => void
  isMobile: boolean
}

// =============================================================================
// TASKBAR
// =============================================================================
// v22 CHANGES:
//   1. Show Desktop button added right of the clock (Win7 convention —
//      minimizes all visible windows; second click restores).
//   2. Safe-area-inset-bottom support — taskbar's height grows on devices
//      with a home indicator so the visible 48px stays above the gesture
//      bar. iOS PWA installations no longer cut off the bottom of the
//      taskbar visually.
//   3. D brand mark switched to /icons/master.svg — the canonical brand
//      vector. Identical to the favicon and PWA icons.
//
// v22.d CHANGES:
//   4. Safe-area bottom region now renders as a solid dark color that
//      matches the bottom edge of the gradient (#0a1020). Before this,
//      the gradient extended into the safe-area zone but its visual
//      density at the bottom looked like wallpaper showing through. The
//      fix: split rendering into two layers — gradient bar (top 48px)
//      and solid bottom strip (safe-area-inset-bottom). Together they
//      look like one continuous taskbar that reaches the hardware
//      bottom, instead of "taskbar floating above a gap."
// =============================================================================

export default function Taskbar({
  windows,
  focusedWindowId,
  onStartClick,
  startMenuOpen,
  onTaskbarItemClick,
  onTaskbarItemContextMenu,
  onShowDesktop,
  isMobile,
}: TaskbarProps) {
  const [now, setNow] = useState<Date>(new Date())

  // ── KEYBOARD OFFSET (v22.d, mobile) ───────────────────────────────────────
  // When iOS opens the on-screen keyboard, the visual viewport shrinks but
  // `position: fixed; bottom: 0` keeps the taskbar pinned to the LAYOUT
  // viewport (full screen), so it slides behind the keyboard. We use the
  // visualViewport API to measure the offset and lift the taskbar by that
  // amount via translateY.
  //
  // The keyboard's height equals the gap between the visual viewport's
  // bottom and the layout viewport's bottom:
  //   keyboardHeight = window.innerHeight - (visualViewport.height + visualViewport.offsetTop)
  //
  // We listen to BOTH `resize` (keyboard appears/disappears) and `scroll`
  // (iOS sometimes fires scroll instead of resize during the transition).
  // The offset is applied only on mobile — desktop doesn't have this issue
  // and applying a transform would interfere with the show-desktop animation.
  const [keyboardOffset, setKeyboardOffset] = useState(0)

  useEffect(() => {
    if (!isMobile) return
    const vv = window.visualViewport
    if (!vv) return  // older browser without API; nothing we can do

    const recompute = () => {
      const gap = window.innerHeight - (vv.height + vv.offsetTop)
      // Clamp to non-negative; some browsers can briefly report negatives
      // during orientation/keyboard transitions
      setKeyboardOffset(Math.max(0, gap))
    }
    recompute()
    vv.addEventListener('resize', recompute)
    vv.addEventListener('scroll', recompute)
    return () => {
      vv.removeEventListener('resize', recompute)
      vv.removeEventListener('scroll', recompute)
    }
  }, [isMobile])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const openLanding = () => {
    window.open('/?view=landing', '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      role="toolbar"
      aria-label="Taskbar"
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        // v22.d: outer container is solid #0a1020 (matches the bottom of
        // the gradient). This is what fills the safe-area zone. The
        // gradient strip lives in an inner div constrained to height 48
        // at the top of this container.
        height: `calc(48px + env(safe-area-inset-bottom, 0px))`,
        background: '#0a1020',
        boxShadow: '0 -1px 0 rgba(255,255,255,0.08) inset, 0 -8px 24px rgba(0,0,0,0.3)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        // v22.d: lift taskbar above iOS on-screen keyboard. keyboardOffset
        // is 0 when keyboard is closed (so this is a no-op for desktop and
        // mobile-with-no-keyboard). The transition makes the lift feel
        // smooth instead of jumpy when the keyboard animates in/out.
        transform: keyboardOffset > 0 ? `translateY(-${keyboardOffset}px)` : 'none',
        transition: 'transform 0.18s ease-out',
        fontFamily: '"Segoe UI", Tahoma, sans-serif',
      }}
    >
      {/* Gradient bar — fixed 48px, contains all interactive content.
          The remaining height (safe-area-inset-bottom) is solid #0a1020
          from the outer container, blending visually into the gradient's
          bottom stop. On laptop (no safe-area), this is the entire
          taskbar. On iPhone PWA, the gradient ends right where the home
          indicator zone begins, with a seamless dark continuation. */}
      <div style={{
        height: 48,
        flexShrink: 0,
        background: 'linear-gradient(to bottom, #1a1f2e 0%, #1a2540 18%, #2a3a5a 50%, #1a2540 82%, #0a1020 100%)',
        borderTop: '1px solid #5a7ba8',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 0,
        paddingRight: 4,
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Interactive content row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: 48,
        }}>
        {/* ── START BUTTON ───────────────────────────────────────────────── */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onStartClick()
          }}
          aria-label="Start"
          title="Start"
          style={{
            width: isMobile ? 56 : 64,
            height: 48,
            border: 'none',
            background: startMenuOpen
              ? 'radial-gradient(circle at 50% 50%, #6ab8ff 0%, #2a6ec0 40%, #1a4a8a 100%)'
              : 'radial-gradient(circle at 50% 50%, #4a9eff 0%, #1a4a8a 60%, #0a2a5a 100%)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRight: '1px solid #0a1020',
            padding: 0,
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={(e) => {
            if (!startMenuOpen) {
              e.currentTarget.style.background = 'radial-gradient(circle at 50% 50%, #5aaaff 0%, #2a5a9a 60%, #0a3a6a 100%)'
            }
          }}
          onMouseLeave={(e) => {
            if (!startMenuOpen) {
              e.currentTarget.style.background = 'radial-gradient(circle at 50% 50%, #4a9eff 0%, #1a4a8a 60%, #0a2a5a 100%)'
            }
          }}
        >
          <DBrandMark size={isMobile ? 28 : 32} />
        </button>        {/* ── OPEN-WINDOW PILLS ──────────────────────────────────────────── */}
        <div style={{
          flex: 1,
          display: 'flex',
          gap: 2,
          paddingLeft: 4,
          overflowX: 'auto',
          height: '100%',
          alignItems: 'center',
        }}>
          {windows.map((win) => {
            const app = getApp(win.appId)
            if (!app) return null
            const isFocused = focusedWindowId === win.id && !win.minimized
            const isMinimized = win.minimized
            const label = isMobile ? '' : (app.shortName || app.name)

            return (
              <button
                key={win.id}
                onClick={() => onTaskbarItemClick(win.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  onTaskbarItemContextMenu(win.id, e.clientX, e.clientY)
                }}
                title={app.name}
                style={{
                  height: 40,
                  minWidth: isMobile ? 44 : 120,
                  maxWidth: 200,
                  padding: '0 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  border: '1px solid ' + (isFocused ? '#7ec0ff' : '#3a4a6a'),
                  background: isFocused
                    ? 'linear-gradient(to bottom, #4a8ad0 0%, #2a5a9a 100%)'
                    : (isMinimized
                      ? 'linear-gradient(to bottom, #1a2540 0%, #0f1828 100%)'
                      : 'linear-gradient(to bottom, #2a3550 0%, #1a2540 100%)'),
                  color: 'white',
                  borderRadius: 3,
                  cursor: 'pointer',
                  boxShadow: isFocused ? '0 0 6px rgba(126,192,255,0.5) inset, 0 0 8px rgba(126,192,255,0.3)' : 'none',
                  fontFamily: 'inherit',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 0.3,
                }}
                onMouseEnter={(e) => {
                  if (!isFocused) {
                    e.currentTarget.style.background = 'linear-gradient(to bottom, #3a4a70 0%, #2a3a5a 100%)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isFocused) {
                    e.currentTarget.style.background = isMinimized
                      ? 'linear-gradient(to bottom, #1a2540 0%, #0f1828 100%)'
                      : 'linear-gradient(to bottom, #2a3550 0%, #1a2540 100%)'
                  }
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: 3,
                  background: app.iconBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, flexShrink: 0,
                }}>{app.icon}</span>
                {!isMobile && (
                  <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textShadow: '0 1px 0 rgba(0,0,0,0.5)',
                  }}>{label}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── SYSTEM TRAY ────────────────────────────────────────────────── */}
        <div style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          borderLeft: '1px solid #0a1020',
          boxShadow: 'inset 1px 0 0 rgba(255,255,255,0.04)',
        }}>
          {/* View Landing icon */}
          <button
            onClick={openLanding}
            title="View landing page"
            aria-label="View landing page"
            style={{
              width: isMobile ? 36 : 40,
              height: 40,
              margin: '0 4px',
              padding: 0,
              border: '1px solid transparent',
              background: 'transparent',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.12s, border-color 0.12s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to bottom, #3a5a8a 0%, #1a3a6a 100%)'
              e.currentTarget.style.borderColor = '#5a7ba8'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'transparent'
            }}
          >
            <div style={{
              width: 22, height: 22,
              borderRadius: 4,
              background: 'linear-gradient(135deg, #5dd5d5, #2a8a8a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              boxShadow: '0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.4)',
              border: '1px solid rgba(0,0,0,0.2)',
              lineHeight: 1,
            }}>
              🌐
            </div>
          </button>

          {/* Clock */}
          <div style={{
            padding: '0 14px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            justifyContent: 'center',
            borderLeft: '1px solid rgba(0,0,0,0.4)',
            boxShadow: 'inset 1px 0 0 rgba(255,255,255,0.04)',
            color: 'white',
            textShadow: '0 1px 0 rgba(0,0,0,0.5)',
            fontSize: 11,
            lineHeight: 1.2,
            minWidth: isMobile ? 64 : 90,
          }}>
            <div style={{ fontWeight: 600 }}>
              {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </div>
            {!isMobile && (
              <div style={{ fontSize: 10, opacity: 0.85 }}>
                {now.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' })}
              </div>
            )}
          </div>

          {/* v22 NEW — SHOW DESKTOP button (rightmost, after clock).
              Win7's was a sliver button on the far right edge of the
              taskbar that minimized everything on click. */}
          <button
            onClick={onShowDesktop}
            title="Show desktop"
            aria-label="Show desktop"
            style={{
              width: isMobile ? 10 : 14,
              height: '100%',
              padding: 0,
              border: 'none',
              borderLeft: '1px solid rgba(0,0,0,0.4)',
              boxShadow: 'inset 1px 0 0 rgba(255,255,255,0.06)',
              background: 'linear-gradient(to right, rgba(255,255,255,0.02), rgba(255,255,255,0.08))',
              cursor: 'pointer',
              transition: 'background 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to right, rgba(120,180,255,0.15), rgba(120,180,255,0.30))'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to right, rgba(255,255,255,0.02), rgba(255,255,255,0.08))'
            }}
          />
        </div>
      </div>
      </div>
    </div>
  )
}

// =============================================================================
// D BRAND MARK — v22.1
// =============================================================================
// v22.0 used an inline <path> SVG to draw the "D" so it didn't depend on
// fonts. Problem: the geometry I authored didn't match the rest of the
// product's brand glyph, so it looked off (you flagged it as "not Futura"
// — which it wasn't because nothing in the codebase actually USES Futura
// for the brand mark; the brand glyph everywhere else is a vector D
// inside a rounded square).
//
// v22.1: use the existing brand SVG file at /public/icons/master.svg.
// It's the canonical vector and renders identically to the favicon,
// PWA icons, og:image, and apple-touch-icon. No font dependency, no
// hand-drawn path geometry — just the actual brand mark, shrunk.
//
// The drop-shadow filter is preserved to match the Win7 Start-button
// glow effect.
// =============================================================================
function DBrandMark({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/icons/master.svg"
      alt="DialerSeat"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        display: 'block',
        filter: 'drop-shadow(0 0 6px rgba(120,180,255,0.6)) drop-shadow(0 1px 2px rgba(0,0,0,0.4))',
        userSelect: 'none',
        pointerEvents: 'none',
      }}
      draggable={false}
    />
  )
}