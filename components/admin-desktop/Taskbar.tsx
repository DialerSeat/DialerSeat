'use client'
import { useEffect, useState } from 'react'
import type { WindowState, AppDefinition } from './types'
import { getApp } from './registry'

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
//   - Start button (gradient circle with Windows-like glyph) on the left
//   - Open-window pills in the middle (icon + name, glow if focused)
//   - System tray on the right (clock, no system icons since we're in a browser)
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
      <button
        onClick={(e) => {
          e.stopPropagation()
          onStartClick()
        }}
        aria-label="Start"
        title="Start"
        style={{
          width: 56,
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
        {/* Pseudo-Windows logo: 4 panes from gradient D colors */}
        <div style={{
          width: 22, height: 22,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 2,
        }}>
          <div style={{ background: '#ff5252', transform: 'skewX(-12deg)' }} />
          <div style={{ background: '#52ff52', transform: 'skewX(-12deg)' }} />
          <div style={{ background: '#5252ff', transform: 'skewX(-12deg)' }} />
          <div style={{ background: '#ffcc00', transform: 'skewX(-12deg)' }} />
        </div>
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
        padding: '0 14px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        justifyContent: 'center',
        borderLeft: '1px solid #0a1020',
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
  )
}