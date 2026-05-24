'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { APPS, getApp } from './registry'
import AppWindow from './AppWindow'
import Taskbar from './Taskbar'
import StartMenu from './StartMenu'
import ContextMenu, { type ContextMenuItem } from './ContextMenu'
import type { AppId, WindowState, RecentApp } from './types'

// =============================================================================
// DESKTOP — root shell component
// =============================================================================
// Manages:
//   - List of open windows (state)
//   - Z-index ordering (focused window is on top)
//   - Open / close / minimize / maximize / move / resize
//   - Recent-items memory (for Start menu jump list)
//   - Mobile detection (auto-fullscreen + disable drag)
//   - Right-click context menus for desktop, icons, windows, taskbar items
//
// Window IDs are generated as `${appId}-${timestamp}-${random}` so multiple
// instances of the same app are theoretically possible (we don't enable that
// in v1 — clicking an icon focuses the existing window if open).
// =============================================================================

const MOBILE_BREAKPOINT = 768
const TASKBAR_HEIGHT = 48

interface RightClickState {
  type: 'desktop' | 'icon' | 'taskbar-item' | 'titlebar'
  x: number
  y: number
  payload?: any  // appId for icon, windowId for taskbar-item / titlebar
}

export default function Desktop() {
  const router = useRouter()
  const [windows, setWindows] = useState<WindowState[]>([])
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [topZ, setTopZ] = useState(100)
  const [startMenuOpen, setStartMenuOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<RightClickState | null>(null)
  const [recentApps, setRecentApps] = useState<RecentApp[]>([])
  const [isMobile, setIsMobile] = useState(false)
  const [bootedAnalytics, setBootedAnalytics] = useState(false)

  // ── MOBILE DETECTION ─────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  // ── OPEN APP ─────────────────────────────────────────────────────────────
  const openApp = useCallback((appId: AppId) => {
    const app = getApp(appId)
    if (!app) return

    // External apps don't open a window — they fire the URL and bail
    if (app.external) {
      window.open(app.external.url, app.external.target ?? '_blank', 'noopener,noreferrer')
      return
    }

    // If app already open and not minimized, just focus it
    // If minimized, restore it
    setWindows(prev => {
      const existing = prev.find(w => w.appId === appId)
      if (existing) {
        const newZ = topZ + 1
        setTopZ(newZ)
        setFocusedId(existing.id)
        return prev.map(w => w.id === existing.id ? { ...w, minimized: false, zIndex: newZ } : w)
      }

      // Otherwise spawn new window
      const newZ = topZ + 1
      setTopZ(newZ)
      const id = `${appId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const defaultSize = app.defaultSize || { width: 900, height: 600 }

      // Center-ish initial position with cascade offset
      const offset = (prev.length % 6) * 28
      const w = Math.min(defaultSize.width, window.innerWidth - 40)
      const h = Math.min(defaultSize.height, window.innerHeight - TASKBAR_HEIGHT - 40)
      const x = Math.max(0, Math.round((window.innerWidth - w) / 2)) + offset - (3 * 28)
      const y = Math.max(0, Math.round((window.innerHeight - TASKBAR_HEIGHT - h) / 2)) + offset - (3 * 28)

      const newWindow: WindowState = {
        id,
        appId,
        x: Math.max(0, x),
        y: Math.max(0, y),
        width: w,
        height: h,
        zIndex: newZ,
        minimized: false,
        maximized: false,
        openedAt: Date.now(),
      }
      setFocusedId(id)
      return [...prev, newWindow]
    })
  }, [topZ])

  // ── ANALYTICS AUTO-OPEN ON FIRST RENDER ──────────────────────────────────
  useEffect(() => {
    if (bootedAnalytics) return
    setBootedAnalytics(true)
    // Tiny delay so initial paint is the desktop, then analytics opens on top
    const id = setTimeout(() => openApp('analytics'), 250)
    return () => clearTimeout(id)
  }, [bootedAnalytics, openApp])

  // ── CLOSE WINDOW (adds to recent list) ───────────────────────────────────
  const closeWindow = useCallback((windowId: string) => {
    setWindows(prev => {
      const closing = prev.find(w => w.id === windowId)
      if (closing) {
        setRecentApps(r => {
          const filtered = r.filter(item => item.appId !== closing.appId)
          return [{ appId: closing.appId, closedAt: Date.now() }, ...filtered].slice(0, 10)
        })
      }
      const next = prev.filter(w => w.id !== windowId)
      // If the closed window was focused, focus the topmost remaining window
      if (focusedId === windowId) {
        const topmost = next.reduce<WindowState | null>((acc, w) =>
          (!acc || w.zIndex > acc.zIndex) && !w.minimized ? w : acc, null)
        setFocusedId(topmost?.id ?? null)
      }
      return next
    })
  }, [focusedId])

  // ── MINIMIZE / RESTORE ──────────────────────────────────────────────────
  const toggleMinimize = useCallback((windowId: string) => {
    setWindows(prev => {
      const target = prev.find(w => w.id === windowId)
      if (!target) return prev
      const willBeMinimized = !target.minimized
      if (willBeMinimized && focusedId === windowId) {
        // Focus next topmost window
        const topmost = prev
          .filter(w => w.id !== windowId && !w.minimized)
          .reduce<WindowState | null>((acc, w) =>
            (!acc || w.zIndex > acc.zIndex) ? w : acc, null)
        setFocusedId(topmost?.id ?? null)
      }
      return prev.map(w => w.id === windowId ? { ...w, minimized: willBeMinimized } : w)
    })
  }, [focusedId])

  // ── MAXIMIZE / RESTORE ──────────────────────────────────────────────────
  const toggleMaximize = useCallback((windowId: string) => {
    setWindows(prev => prev.map(w => {
      if (w.id !== windowId) return w
      if (w.maximized) {
        // Restore
        const restore = w.preMaximize
        return {
          ...w, maximized: false,
          x: restore?.x ?? w.x, y: restore?.y ?? w.y,
          width: restore?.width ?? w.width, height: restore?.height ?? w.height,
          preMaximize: undefined,
        }
      } else {
        // Maximize
        return {
          ...w, maximized: true,
          preMaximize: { x: w.x, y: w.y, width: w.width, height: w.height },
          x: 0, y: 0,
          width: window.innerWidth,
          height: window.innerHeight - TASKBAR_HEIGHT,
        }
      }
    }))
  }, [])

  // ── FOCUS (bring to front) ──────────────────────────────────────────────
  const focusWindow = useCallback((windowId: string) => {
    if (focusedId === windowId) return
    const newZ = topZ + 1
    setTopZ(newZ)
    setFocusedId(windowId)
    setWindows(prev => prev.map(w => w.id === windowId ? { ...w, zIndex: newZ } : w))
  }, [focusedId, topZ])

  // ── MOVE / RESIZE ───────────────────────────────────────────────────────
  const moveWindow = useCallback((windowId: string, x: number, y: number) => {
    setWindows(prev => prev.map(w => w.id === windowId ? { ...w, x, y } : w))
  }, [])
  const resizeWindow = useCallback((windowId: string, width: number, height: number) => {
    setWindows(prev => prev.map(w => w.id === windowId ? { ...w, width, height } : w))
  }, [])

  // ── TASKBAR ITEM CLICK ──────────────────────────────────────────────────
  // Win7 behavior: if minimized → restore; if focused → minimize; if open but
  // not focused → focus.
  const onTaskbarItemClick = useCallback((windowId: string) => {
    setWindows(prev => {
      const win = prev.find(w => w.id === windowId)
      if (!win) return prev
      if (win.minimized) {
        const newZ = topZ + 1
        setTopZ(newZ)
        setFocusedId(windowId)
        return prev.map(w => w.id === windowId ? { ...w, minimized: false, zIndex: newZ } : w)
      }
      if (focusedId === windowId) {
        // Minimize
        const topmost = prev
          .filter(w => w.id !== windowId && !w.minimized)
          .reduce<WindowState | null>((acc, w) =>
            (!acc || w.zIndex > acc.zIndex) ? w : acc, null)
        setFocusedId(topmost?.id ?? null)
        return prev.map(w => w.id === windowId ? { ...w, minimized: true } : w)
      }
      // Just focus
      const newZ = topZ + 1
      setTopZ(newZ)
      setFocusedId(windowId)
      return prev.map(w => w.id === windowId ? { ...w, zIndex: newZ } : w)
    })
  }, [focusedId, topZ])

  // ── CONTEXT MENU OPENING ────────────────────────────────────────────────
  const onDesktopContextMenu = (e: React.MouseEvent) => {
    // Only open if the target IS the desktop (not an icon, not a window)
    if (e.target !== e.currentTarget) return
    e.preventDefault()
    setContextMenu({ type: 'desktop', x: e.clientX, y: e.clientY })
  }

  const onIconContextMenu = (e: React.MouseEvent, appId: AppId) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ type: 'icon', x: e.clientX, y: e.clientY, payload: appId })
  }

  const onTaskbarContextMenu = (windowId: string, x: number, y: number) => {
    setContextMenu({ type: 'taskbar-item', x, y, payload: windowId })
  }

  const onTitleBarContextMenu = (windowId: string, x: number, y: number) => {
    setContextMenu({ type: 'titlebar', x, y, payload: windowId })
  }

  // ── BUILD CONTEXT MENU ITEMS ────────────────────────────────────────────
  const contextMenuItems: ContextMenuItem[] = (() => {
    if (!contextMenu) return []

    if (contextMenu.type === 'desktop') {
      return [
        { label: 'View', icon: '👁', disabled: true },
        { label: 'Sort by', icon: '↕', disabled: true },
        { label: 'Refresh', icon: '↻', onClick: () => window.location.reload() },
        {},
        { label: 'Personalize', icon: '🎨', disabled: true },
        { label: 'Screen resolution', disabled: true },
        {},
        { label: 'Back to Dashboard', icon: '←', onClick: () => router.push('/dashboard/analytics') },
      ]
    }

    if (contextMenu.type === 'icon') {
      const appId = contextMenu.payload as AppId
      const app = getApp(appId)
      const alreadyOpen = windows.find(w => w.appId === appId)
      return [
        { label: 'Open', icon: '▶', onClick: () => openApp(appId) },
        { label: 'Open in new window', disabled: true },
        {},
        { label: alreadyOpen ? 'Already running' : 'Properties', disabled: true },
      ]
    }

    if (contextMenu.type === 'taskbar-item' || contextMenu.type === 'titlebar') {
      const windowId = contextMenu.payload as string
      const win = windows.find(w => w.id === windowId)
      if (!win) return []
      return [
        { label: win.minimized ? 'Restore' : 'Minimize', onClick: () => toggleMinimize(windowId) },
        { label: win.maximized ? 'Restore down' : 'Maximize', onClick: () => toggleMaximize(windowId) },
        {},
        { label: 'Close', icon: '✕', danger: true, onClick: () => closeWindow(windowId) },
      ]
    }

    return []
  })()

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: `
          radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.15) 0%, transparent 50%),
          radial-gradient(ellipse at 70% 80%, rgba(255,255,255,0.08) 0%, transparent 60%),
          linear-gradient(180deg, #1a3a6a 0%, #4a7ab0 50%, #82a6cf 100%)
        `,
        overflow: 'hidden',
        fontFamily: '"Segoe UI", Tahoma, sans-serif',
        userSelect: 'none',
      }}
    >
      {/* ── DESKTOP AREA (above taskbar) ───────────────────────────────── */}
      <div
        onContextMenu={onDesktopContextMenu}
        onClick={() => {
          if (startMenuOpen) setStartMenuOpen(false)
          if (contextMenu) setContextMenu(null)
        }}
        style={{
          position: 'absolute',
          inset: 0,
          bottom: TASKBAR_HEIGHT,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Desktop icon grid */}
        <div style={{
          padding: isMobile ? 12 : 20,
          display: 'grid',
          gridTemplateColumns: isMobile
            ? 'repeat(auto-fill, minmax(80px, 1fr))'
            : 'repeat(auto-fill, 96px)',
          gap: isMobile ? 8 : 14,
          alignContent: 'start',
          maxWidth: isMobile ? '100%' : 540,
        }}>
          {APPS.map(app => {
            const isOpen = !!windows.find(w => w.appId === app.id)
            return (
              <DesktopIcon
                key={app.id}
                name={app.name}
                icon={app.icon}
                iconBg={app.iconBg}
                isOpen={isOpen}
                onDoubleClick={() => openApp(app.id)}
                onContextMenu={(e) => onIconContextMenu(e, app.id)}
                isMobile={isMobile}
              />
            )
          })}
        </div>
      </div>

      {/* ── WINDOWS ─────────────────────────────────────────────────────── */}
      {windows.map(win => {
        const app = getApp(win.appId)
        if (!app) return null
        return (
          <AppWindow
            key={win.id}
            state={win}
            appName={app.name}
            appIcon={app.icon}
            iconBg={app.iconBg}
            Component={app.Component}
            isFocused={focusedId === win.id}
            isMobile={isMobile}
            onFocus={() => focusWindow(win.id)}
            onClose={() => closeWindow(win.id)}
            onMinimize={() => toggleMinimize(win.id)}
            onToggleMaximize={() => toggleMaximize(win.id)}
            onMove={(x, y) => moveWindow(win.id, x, y)}
            onResize={(w, h) => resizeWindow(win.id, w, h)}
            onTitleBarContextMenu={(x, y) => onTitleBarContextMenu(win.id, x, y)}
          />
        )
      })}

      {/* ── TASKBAR ─────────────────────────────────────────────────────── */}
      <Taskbar
        windows={windows}
        focusedWindowId={focusedId}
        recentApps={recentApps.map(r => getApp(r.appId)).filter((a): a is NonNullable<typeof a> => !!a)}
        onStartClick={() => setStartMenuOpen(o => !o)}
        startMenuOpen={startMenuOpen}
        onTaskbarItemClick={onTaskbarItemClick}
        onTaskbarItemContextMenu={onTaskbarContextMenu}
        isMobile={isMobile}
      />

      {/* ── START MENU ──────────────────────────────────────────────────── */}
      {startMenuOpen && (
        <StartMenu
          onClose={() => setStartMenuOpen(false)}
          onLaunchApp={openApp}
          recent={recentApps}
        />
      )}

      {/* ── CONTEXT MENU ────────────────────────────────────────────────── */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

// =============================================================================
// DESKTOP ICON
// =============================================================================
// Glossy tile + label below. Double-click opens. Single-click selects (we
// render a subtle outline). Right-click opens icon context menu.
// =============================================================================
function DesktopIcon({
  name, icon, iconBg, isOpen, onDoubleClick, onContextMenu, isMobile,
}: {
  name: string
  icon: string
  iconBg: string
  isOpen: boolean
  onDoubleClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  isMobile: boolean
}) {
  const [selected, setSelected] = useState(false)
  // On mobile, single-tap should launch (no double-tap on touch)
  const lastTapRef = useRef<number>(0)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isMobile) {
      const now = Date.now()
      if (now - lastTapRef.current < 400) {
        // double-tap
        onDoubleClick()
        return
      }
      lastTapRef.current = now
      // Single tap on mobile also opens the app — desktop convention is double,
      // but on touch we go faster
      onDoubleClick()
      return
    }
    setSelected(true)
  }

  // Click-away to deselect
  useEffect(() => {
    if (!selected) return
    const onAway = () => setSelected(false)
    document.addEventListener('mousedown', onAway)
    return () => document.removeEventListener('mousedown', onAway)
  }, [selected])

  return (
    <div
      onClick={handleClick}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick() }}
      onContextMenu={onContextMenu}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: 6,
        borderRadius: 4,
        cursor: 'pointer',
        background: selected ? 'rgba(74,158,255,0.25)' : 'transparent',
        border: '1px solid ' + (selected ? 'rgba(126,192,255,0.6)' : 'transparent'),
      }}
    >
      <div style={{
        width: isMobile ? 48 : 56,
        height: isMobile ? 48 : 56,
        borderRadius: 8,
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: isMobile ? 26 : 30,
        boxShadow: '0 3px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.4)',
        border: '1px solid rgba(0,0,0,0.2)',
        position: 'relative',
      }}>
        {icon}
        {isOpen && (
          <div style={{
            position: 'absolute',
            bottom: -4, left: '50%',
            transform: 'translateX(-50%)',
            width: 6, height: 6,
            background: '#7ec0ff',
            borderRadius: '50%',
            boxShadow: '0 0 6px rgba(126,192,255,0.9)',
          }} />
        )}
      </div>
      <div style={{
        fontSize: 11,
        color: 'white',
        textAlign: 'center',
        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
        fontWeight: 500,
        maxWidth: 84,
        wordBreak: 'break-word',
        lineHeight: 1.25,
      }}>{name}</div>
    </div>
  )
}