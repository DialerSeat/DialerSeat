'use client'
import { useEffect, useRef, useState } from 'react'
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
  // v2: drag-reorder of open-window pills
  onReorderWindows: (dragWindowId: string, targetWindowId: string) => void
}

// =============================================================================
// TASKBAR — v2
// =============================================================================
// v2 changes vs v1:
// - DRAGGABLE PILLS: open-window buttons reorder via HTML5 drag-and-drop,
//   like real Windows. Drag a pill over another and drop — Desktop reorders
//   its windows array (pill order = array order; zIndex untouched). The drop
//   target shows a left accent bar while hovered. Reordering is desktop-only
//   (mobile pills are tap targets, drag would fight scroll).
// - iconSrc SUPPORT: pills render the app's image icon when the registry
//   entry sets iconSrc, falling back to the emoji glyph.
// All v1 visuals retained: Aero gradient strip, start orb, tray, clock,
// show-desktop sliver, safe-area fill shell.
//
// v2.1: SAFE-AREA FIX. Shell was `bottom: -100, height: 148` — a leftover
// debug offset that shifted the whole shell 100px below the viewport, so
// only the top 48px (the interactive strip) was ever actually on-screen.
// The remaining ~100px that was meant to fill the safe-area-inset-bottom
// zone (home indicator strip) was rendering entirely off-screen and doing
// nothing, which is why that zone showed whatever was behind the taskbar
// instead of the taskbar's own background. Fixed: `bottom: 0`, and height
// is now `48px + env(safe-area-inset-bottom)` (real device value) instead
// of a guessed 148px constant, so the shell is flush with the true bottom
// edge on any device and exactly covers the strip with no gap and no
// wasted off-screen space.
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
  onReorderWindows,
}: TaskbarProps) {
  const [now, setNow] = useState<Date>(new Date())

  // v2: pill drag state
  const dragWindowIdRef = useRef<string | null>(null)
  const [dragOverWindowId, setDragOverWindowId] = useState<string | null>(null)

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
        bottom: 0,
        left: 0,
        right: 0,
        // 48px interactive strip + whatever the device's real safe-area
        // bottom inset is (0 on devices without a home indicator). Replaces
        // the old hardcoded `height: 148` guess, which was wrong on most
        // devices even before the -100 offset bug.
        height: 'calc(48px + env(safe-area-inset-bottom, 0px))',
        // Match the BOTTOM stop of the 48px strip's gradient (#0a1020) so the
        // safe-area zone below the strip reads as a continuation of the
        // taskbar, not a separate flat-black bar. Was '#0a0a0f', which on
        // tall mobile safe areas showed as a distinct black strip.
        background: '#0a1020',
        boxShadow: '0 -1px 0 rgba(255,255,255,0.08) inset, 0 -8px 24px rgba(0,0,0,0.3)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        fontFamily: '"Segoe UI", Tahoma, sans-serif',
      }}
    >
      {/* 48px interactive strip — always at top of the taskbar shell */}
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
        </button>

        {/* ── OPEN-WINDOW PILLS (v2: draggable to reorder) ───────────────── */}
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
            const isDragTarget = dragOverWindowId === win.id
            const label = isMobile ? '' : (app.shortName || app.name)

            return (
              <button
                key={win.id}
                draggable={!isMobile}
                onDragStart={(e) => {
                  dragWindowIdRef.current = win.id
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (dragWindowIdRef.current && dragWindowIdRef.current !== win.id) {
                    setDragOverWindowId(win.id)
                  }
                }}
                onDragLeave={() => {
                  if (dragOverWindowId === win.id) setDragOverWindowId(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const dragId = dragWindowIdRef.current
                  dragWindowIdRef.current = null
                  setDragOverWindowId(null)
                  if (dragId && dragId !== win.id) {
                    onReorderWindows(dragId, win.id)
                  }
                }}
                onDragEnd={() => {
                  dragWindowIdRef.current = null
                  setDragOverWindowId(null)
                }}
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
                  borderLeft: isDragTarget
                    ? '3px solid #ffd96a'
                    : '1px solid ' + (isFocused ? '#7ec0ff' : '#3a4a6a'),
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
                  overflow: 'hidden',
                }}>
                  {app.iconSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={app.iconSrc} alt="" width={13} height={13}
                      style={{ objectFit: 'contain', pointerEvents: 'none' }} draggable={false} />
                  ) : app.icon}
                </span>
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

          {/* Show Desktop button */}
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