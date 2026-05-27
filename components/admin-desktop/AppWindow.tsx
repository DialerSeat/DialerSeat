'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import type { ComponentType } from 'react'
import type { WindowState } from './types'

interface AppWindowProps {
  state: WindowState
  appName: string
  appIcon: string
  iconBg: string
  Component?: ComponentType
  isFocused: boolean
  isMobile: boolean
  onFocus: () => void
  onClose: () => void
  onMinimize: () => void
  onToggleMaximize: () => void
  onMove: (x: number, y: number) => void
  onResize: (width: number, height: number) => void
  onTitleBarContextMenu: (clientX: number, clientY: number) => void
}

// =============================================================================
// APP WINDOW — v22.1
// =============================================================================
// Authentic Win7 Aero window. v22.1 fixes two long-standing bugs on iPhone PWA:
//
//   1. SCROLL CONTAINER CONFLICT — Before v22.1 the AppWindow body wrapper
//      had `overflow: auto`, which meant apps inside (Notes, Logs, etc) had
//      a scroll container OUTSIDE their root. Apps that ALSO declared their
//      own scroll regions (Notes' textarea, Logs' message list) ended up
//      with two competing scroll boundaries: iOS would grow the inner
//      content past the outer container's visible area instead of clipping
//      it. Result: Notes body textarea on iPhone would never scroll to the
//      bottom — the textarea was effectively taller than the AppWindow.
//
//      Fix: body wrapper now uses `overflow: hidden`. Apps that need to
//      scroll declare their OWN scroll containers internally with proper
//      `min-height: 0` constraints. This is the standard pattern — let the
//      app own its scroll behavior, the window just clips.
//
//   2. MOBILE FULL-SCREEN IGNORES SAFE AREAS — Before v22.1 mobile maximize
//      used `width: 100vw; height: calc(100vh - 48px)`. iPhone PWA with
//      `apple-mobile-web-app-status-bar-style: black-translucent` lays
//      content UNDER the status bar / Dynamic Island AND under the home
//      indicator. So the title bar was hidden by the notch, and the bottom
//      of the app got grazed by the home indicator. Same fix as elsewhere
//      in v22: use `env(safe-area-inset-*)` for the four edges.
//
//      The Desktop component still probes safe-area-bottom and adjusts
//      TASKBAR_HEIGHT — that's how the bottom of the window finds the
//      right stopping point. This component handles the TOP safe area.
// =============================================================================

export default function AppWindow({
  state,
  appName,
  appIcon,
  iconBg,
  Component,
  isFocused,
  isMobile,
  onFocus,
  onClose,
  onMinimize,
  onToggleMaximize,
  onMove,
  onResize,
  onTitleBarContextMenu,
}: AppWindowProps) {
  const winRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const [resizing, setResizing] = useState<'br' | null>(null)
  const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 })

  // ── DRAG TO MOVE (desktop only) ──────────────────────────────────────────
  const onTitleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMobile || state.maximized) return
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('[data-window-control]')) return

    onFocus()
    setDragging(true)
    dragOffsetRef.current = {
      x: e.clientX - state.x,
      y: e.clientY - state.y,
    }
    e.preventDefault()
  }, [isMobile, state.maximized, state.x, state.y, onFocus])

  useEffect(() => {
    if (!dragging) return
    const onMove_ = (e: MouseEvent) => {
      const newX = e.clientX - dragOffsetRef.current.x
      const newY = e.clientY - dragOffsetRef.current.y
      const minY = 0
      const maxY = window.innerHeight - 60
      const minX = -state.width + 120
      const maxX = window.innerWidth - 120
      onMove(
        Math.max(minX, Math.min(maxX, newX)),
        Math.max(minY, Math.min(maxY, newY))
      )
    }
    const onUp = () => setDragging(false)
    document.addEventListener('mousemove', onMove_)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove_)
      document.removeEventListener('mouseup', onUp)
    }
  }, [dragging, state.width, onMove])

  // ── RESIZE FROM BOTTOM-RIGHT CORNER ──────────────────────────────────────
  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMobile || state.maximized) return
    if (e.button !== 0) return
    setResizing('br')
    resizeStartRef.current = {
      x: e.clientX, y: e.clientY,
      w: state.width, h: state.height,
    }
    e.preventDefault()
    e.stopPropagation()
  }, [isMobile, state.maximized, state.width, state.height])

  useEffect(() => {
    if (!resizing) return
    const onMove_ = (e: MouseEvent) => {
      const dx = e.clientX - resizeStartRef.current.x
      const dy = e.clientY - resizeStartRef.current.y
      const newW = Math.max(360, resizeStartRef.current.w + dx)
      const newH = Math.max(240, resizeStartRef.current.h + dy)
      const maxW = window.innerWidth - state.x - 8
      const maxH = window.innerHeight - state.y - 60
      onResize(Math.min(maxW, newW), Math.min(maxH, newH))
    }
    const onUp = () => setResizing(null)
    document.addEventListener('mousemove', onMove_)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove_)
      document.removeEventListener('mouseup', onUp)
    }
  }, [resizing, state.x, state.y, onResize])

  // ── KEYBOARD: Alt+F4 to close ────────────────────────────────────────────
  useEffect(() => {
    if (!isFocused) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }
      if (e.altKey && e.key === 'F4') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isFocused, onClose])

  // ── COMPUTED GEOMETRY ────────────────────────────────────────────────────
  // Mobile or maximized: full screen ABOVE the taskbar.
  //
  // v22.1 — safe-area awareness:
  //   On iPhone PWA the top inset (status bar / notch / Dynamic Island) can
  //   be 20–60+ px depending on device. Without accommodation the title bar
  //   sits behind the battery icon. We pin top:0 and add padding-top on the
  //   title bar so its CONTENT (icon + name + controls) sits below the
  //   notch. We DON'T just push top: by safe-area because then there'd be
  //   a transparent gap above the title bar showing the wallpaper.
  //
  //   Bottom safe area is handled by Desktop.tsx which subtracts it from
  //   the viewport height when computing window geometry — Desktop's
  //   TASKBAR_HEIGHT already includes safe-area-inset-bottom. So we just
  //   honor the geometry the parent passes us.
  // ────────────────────────────────────────────────────────────────────────
  const geom: React.CSSProperties = (isMobile || state.maximized) ? {
    left: 0,
    top: 0,
    width: '100vw',
    // Height comes from Desktop which already accounts for safe-area-bottom
    height: 'calc(100vh - 48px - env(safe-area-inset-bottom, 0px))',
  } : {
    left: state.x, top: state.y,
    width: state.width, height: state.height,
  }

  if (state.minimized) {
    return null
  }

  // Title bar gets extra padding-top in mobile/maximized so it clears the
  // notch. In windowed (non-maximized) desktop mode, padding-top is the
  // standard 4px because the user controls placement.
  const titleBarPaddingTop =
    (isMobile || state.maximized)
      ? 'max(4px, calc(env(safe-area-inset-top, 0px) + 4px))'
      : '4px'

  // Title bar height needs to grow to match the larger padding-top
  const titleBarHeight =
    (isMobile || state.maximized)
      ? 'calc(30px + env(safe-area-inset-top, 0px))'
      : '30px'

  return (
    <div
      ref={winRef}
      role="dialog"
      aria-label={appName}
      onMouseDown={onFocus}
      style={{
        position: 'fixed',
        ...geom,
        zIndex: state.zIndex,
        border: '1px solid ' + (isFocused ? '#3a6ea5' : '#7a8a9a'),
        borderRadius: (isMobile || state.maximized) ? 0 : 8,
        background: '#f5f9fd',
        boxShadow: isFocused
          ? '0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.5) inset'
          : '0 4px 16px rgba(0,0,0,0.25)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"Segoe UI", Tahoma, sans-serif',
        transition: state.maximized && !dragging ? 'left 0.12s, top 0.12s, width 0.12s, height 0.12s' : 'none',
      }}
    >
      {/* ── TITLE BAR ─────────────────────────────────────────────────── */}
      <div
        onMouseDown={onTitleMouseDown}
        onDoubleClick={() => !isMobile && onToggleMaximize()}
        onContextMenu={(e) => {
          e.preventDefault()
          onTitleBarContextMenu(e.clientX, e.clientY)
        }}
        style={{
          background: isFocused
            ? 'linear-gradient(to bottom, #d0e4f8 0%, #93b8de 45%, #5a8ac0 100%)'
            : 'linear-gradient(to bottom, #e8eef5 0%, #c8d4df 100%)',
          color: '#1c1c2c',
          paddingTop: titleBarPaddingTop,
          paddingBottom: 4,
          paddingLeft: 'max(8px, env(safe-area-inset-left, 8px))',
          paddingRight: 'max(6px, env(safe-area-inset-right, 6px))',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          borderBottom: '1px solid ' + (isFocused ? '#3a6ea5' : '#9aa8b8'),
          cursor: (isMobile || state.maximized) ? 'default' : (dragging ? 'grabbing' : 'grab'),
          userSelect: 'none',
          flexShrink: 0,
          height: titleBarHeight,
          boxSizing: 'border-box',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
          height: 22,
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: 3,
            background: iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, flexShrink: 0,
            boxShadow: '0 1px 1px rgba(0,0,0,0.25)',
          }}>{appIcon}</div>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            textShadow: '0 1px 0 rgba(255,255,255,0.5)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>{appName}</span>
        </div>

        <div style={{ display: 'flex', gap: 0, height: 22 }}>
          {!isMobile && (
            <>
              <WindowControl kind="min" onClick={onMinimize} title="Minimize" />
              <WindowControl
                kind="max"
                onClick={onToggleMaximize}
                title={state.maximized ? 'Restore Down' : 'Maximize'}
                maximized={state.maximized}
              />
            </>
          )}
          <WindowControl kind="close" onClick={onClose} title="Close" />
        </div>
      </div>

      {/* ── BODY (app content) ────────────────────────────────────────── */}
      {/* v22.1 — `overflow: hidden`, NOT auto. Apps manage their own scroll
          containers. Without this, iOS lets the app's inner content grow
          past the visible window area. */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        background: '#f5f9fd',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {Component ? <Component /> : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '100%', height: '100%', color: '#5a5e6a', fontSize: 12,
          }}>
            App not loaded
          </div>
        )}
      </div>

      {/* ── RESIZE GRIP (bottom-right) ────────────────────────────────── */}
      {!isMobile && !state.maximized && (
        <div
          onMouseDown={onResizeMouseDown}
          style={{
            position: 'absolute',
            right: 0, bottom: 0,
            width: 14, height: 14,
            cursor: 'nwse-resize',
            background: `
              linear-gradient(135deg, transparent 0%, transparent 30%,
                #888 30%, #888 35%, transparent 35%, transparent 55%,
                #888 55%, #888 60%, transparent 60%)
            `,
            opacity: 0.5,
            zIndex: 10,
          }}
        />
      )}
    </div>
  )
}

// =============================================================================
// WINDOW CONTROL — Win7-style min / max / close buttons
// =============================================================================
function WindowControl({
  kind, onClick, title, maximized,
}: {
  kind: 'min' | 'max' | 'close'
  onClick: () => void
  title: string
  maximized?: boolean
}) {
  const isClose = kind === 'close'

  return (
    <div
      data-window-control
      role="button"
      aria-label={title}
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{
        width: 44,
        height: 22,
        marginLeft: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 3,
        cursor: 'pointer',
        background: 'rgba(255,255,255,0.0)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isClose ? '#e81123' : 'rgba(255,255,255,0.45)'
        const glyph = e.currentTarget.querySelector('span')
        if (glyph && isClose) glyph.style.color = 'white'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        const glyph = e.currentTarget.querySelector('span')
        if (glyph) glyph.style.color = '#1c1c2c'
      }}
    >
      <span style={{
        fontSize: kind === 'min' ? 18 : kind === 'max' ? 11 : 14,
        lineHeight: 1,
        fontWeight: kind === 'close' ? 400 : 600,
        color: '#1c1c2c',
        fontFamily: 'system-ui, sans-serif',
        userSelect: 'none',
      }}>
        {kind === 'min' && '_'}
        {kind === 'max' && (maximized ? '❐' : '☐')}
        {kind === 'close' && '✕'}
      </span>
    </div>
  )
}