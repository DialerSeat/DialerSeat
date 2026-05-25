'use client'
import { useEffect, useState } from 'react'
import type { WindowState, AppDefinition } from './types'
import { getApp } from './registry'
import { jost } from '@/lib/fonts'

interface TaskbarProps {
  windows: WindowState[]
  focusedWindowId: string | null
  recentApps: AppDefinition[]    // closed-recently for jump list
  onStartClick: () => void
  startMenuOpen: boolean
  onTaskbarItemClick: (windowId: string) => void
  onTaskbarItemContextMenu: (windowId: string, clientX: number, clientY: number) => void
  isMobile: boolean
}

// =============================================================================
// TASKBAR
// =============================================================================
// Win7 taskbar:
//   - 48px tall
//   - Start button (gradient circle) on the left
//       • v20: replaced the fake 4-pane Windows glyph with the "DialerSeat"
//         wordmark in Jost (Futura clone) with blue glow.
//   - Open-window pills in the middle (icon + name, glow if focused)
//   - System tray on the right:
//       • v20: added a "View Landing" globe icon left of the clock that
//         opens / in a new tab. Replaces the old desktop icon for it.
//       • Clock (no system icons since we're in a browser)
// =============================================================================

export default function Taskbar({
  windows,
  focusedWindowId,
  onStartClick,
  startMenuOpen,
  onTaskbarItemClick,
  onTaskbarItemContextMenu,
  isMobile,
}: TaskbarProps) {
  const [now, setNow] = useState<Date>(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  // ── VIEW LANDING TRAY HANDLER ────────────────────────────────────────
  const openLanding = () => {
    window.open('/', '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      role="toolbar"
      aria-label="Taskbar"
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: 48,
        background: 'linear-gradient(to bottom, #1a1f2e 0%, #1a2540 18%, #2a3a5a 50%, #1a2540 82%, #0a1020 100%)',
        borderTop: '1px solid #5a7ba8',
        boxShadow: '0 -1px 0 rgba(255,255,255,0.08) inset, 0 -8px 24px rgba(0,0,0,0.3)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 0,
        paddingRight: 4,
        userSelect: 'none',
        fontFamily: '"Segoe UI", Tahoma, sans-serif',
      }}
    >
      {/* ── START BUTTON ───────────────────────────────────────────────── */}
      {/* v20: DialerSeat wordmark in Jost (Futura clone) with blue glow.
          Keeps the same circular gradient surface as before so the rest
          of the taskbar styling is undisturbed. */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onStartClick()
        }}
        aria-label="Start"
        title="Start"
        className={jost.className}
        style={{
          width: isMobile ? 64 : 96,
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
        <span
          style={{
            color: '#ffffff',
            fontSize: isMobile ? 10 : 13,
            fontWeight: 700,
            letterSpacing: isMobile ? 0.5 : 1,
            // Blue glow — layered shadows produce a real bloom effect rather
            // than a single soft halo. Inner white shadow lifts the letters.
            textShadow: `
              0 0 4px rgba(180,220,255,0.95),
              0 0 10px rgba(120,180,255,0.85),
              0 0 18px rgba(74,158,255,0.7),
              0 1px 0 rgba(0,0,0,0.5)
            `,
            whiteSpace: 'nowrap',
            textTransform: 'uppercase',
            fontFamily: jost.style.fontFamily,
          }}
        >
          {isMobile ? 'DS' : 'DialerSeat'}
        </span>
      </button>

      {/* ── OPEN-WINDOW PILLS ──────────────────────────────────────────── */}
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
        {/* View Landing icon — new in v20.
            Replaces the desktop icon for / so the icon grid stays tight.
            Single-click opens in a new tab. */}
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
          {/* Glossy globe tile to match desktop-icon styling */}
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
      </div>
    </div>
  )
}