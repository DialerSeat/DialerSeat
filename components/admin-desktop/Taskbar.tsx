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
  
  onReorderWindows: (dragWindowId: string, targetWindowId: string) => void
  /** Shift-click / middle-click a taskbar button to open another window. */
  onOpenNewInstance?: (appId: WindowState['appId']) => void
}
















export default function Taskbar({
  windows,
  focusedWindowId,
  onStartClick,
  startMenuOpen,
  onTaskbarItemClick,
  onOpenNewInstance,
  onTaskbarItemContextMenu,
  onShowDesktop,
  isMobile,
  onReorderWindows,
}: TaskbarProps) {
  const [now, setNow] = useState<Date>(new Date())

  
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
        // The shell is the strip and nothing else. It used to be 148px tall
        // anchored at bottom:-100 — a 100px overhang painted #0a1020, which is
        // what the dark band under the taskbar on an installed PWA actually
        // was. Not the safe area, not the manifest background: the taskbar's
        // own shell colour, hanging below its own visible strip.
        //
        // Filling that band with taskbar colour instead just turns a black bar
        // into a blue one. The band should not exist, so the overhang is gone
        // and the strip sits on the bottom edge.
        bottom: 0,
        left: 0,
        right: 0,
        background: 'transparent',
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
          {/* One entry per app. Windows groups same-app windows behind a
              single button rather than listing each one. */}
          {windows
            .filter((w, i, arr) => arr.findIndex(x => x.appId === w.appId) === i)
            .map((first) => {
            const group = windows.filter(w => w.appId === first.appId)
            const focusedInGroup = group.find(w => w.id === focusedWindowId && !w.minimized)
            const win = focusedInGroup || group[0]
            const app = getApp(win.appId)
            if (!app) return null
            // Group-level state: the button lights up if ANY window in the
            // group has focus, and only reads as minimized when they ALL are.
            const isFocused = group.some(w => w.id === focusedWindowId && !w.minimized)
            const isMinimized = group.every(w => w.minimized)
            const isDragTarget = group.some(w => w.id === dragOverWindowId)
            // ── WINDOWS-STYLE GROUPING ──────────────────────────────────
            // Windows does not number duplicate windows; it collapses them
            // into ONE button with a stacked edge, and clicking cycles
            // through them. Numbered labels ("User Tracker 2") are a thing
            // Windows deliberately doesn't do — the grouping is the affordance.
            //
            // This renders one button per APP. `win` here is the group's
            // representative: the focused window if one of them has focus,
            // otherwise the first.
            const sameApp = windows.filter(w => w.appId === win.appId)
            const groupCount = sameApp.length
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
                onClick={(e) => {
                  // Shift+click opens a new window, exactly as Windows does.
                  if (e.shiftKey && onOpenNewInstance) {
                    onOpenNewInstance(win.appId)
                    return
                  }
                  // Otherwise cycle: focus the next window in the group, so a
                  // grouped button steps through its windows on repeat clicks.
                  if (groupCount > 1) {
                    const idx = sameApp.findIndex(w => w.id === focusedWindowId)
                    const next = sameApp[(idx + 1) % groupCount]
                    onTaskbarItemClick(next.id)
                    return
                  }
                  onTaskbarItemClick(win.id)
                }}
                onAuxClick={(e) => {
                  // Middle click — the other Windows shortcut for a new window.
                  if (e.button === 1 && onOpenNewInstance) {
                    e.preventDefault()
                    onOpenNewInstance(win.appId)
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  onTaskbarItemContextMenu(win.id, e.clientX, e.clientY)
                }}
                title={
                  groupCount > 1
                    ? `${app.name} — ${groupCount} windows (shift-click for a new one)`
                    : `${app.name} (shift-click for a new window)`
                }
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
                  // A grouped button gets Windows' stacked edge: offset copies
                  // peeking out behind it. That IS the "there are more windows
                  // here" signal — no count badge, no numbered labels.
                  boxShadow: [
                    isFocused ? '0 0 6px rgba(126,192,255,0.5) inset, 0 0 8px rgba(126,192,255,0.3)' : '',
                    groupCount > 1 ? '2px -2px 0 -1px #2a3550, 2px -2px 0 0 #3a4a6a' : '',
                    groupCount > 2 ? '4px -4px 0 -1px #222c44, 4px -4px 0 0 #3a4a6a' : '',
                  ].filter(Boolean).join(', ') || 'none',
                  // Leave room for the stack so it doesn't clip the neighbour.
                  marginRight: groupCount > 2 ? 6 : (groupCount > 1 ? 4 : 0),
                  marginTop: groupCount > 2 ? 6 : (groupCount > 1 ? 4 : 0),
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