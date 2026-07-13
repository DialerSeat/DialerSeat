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
  type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
  const [resizing, setResizing] = useState<ResizeDir | null>(null)
  const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0, winX: 0, winY: 0 })

  
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

  
  const onResizeMouseDown = useCallback((dir: ResizeDir) => (e: React.MouseEvent) => {
    if (isMobile || state.maximized) return
    if (e.button !== 0) return
    onFocus()
    setResizing(dir)
    resizeStartRef.current = {
      x: e.clientX, y: e.clientY,
      w: state.width, h: state.height,
      winX: state.x, winY: state.y,
    }
    e.preventDefault()
    e.stopPropagation()
  }, [isMobile, state.maximized, state.width, state.height, state.x, state.y, onFocus])

  useEffect(() => {
    if (!resizing) return
    const MIN_W = 360
    const MIN_H = 240
    const onMove_ = (e: MouseEvent) => {
      const start = resizeStartRef.current
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y

      let newW = start.w
      let newX = start.winX
      if (resizing.includes('e')) {
        const maxW = window.innerWidth - start.winX - 8
        newW = Math.max(MIN_W, Math.min(maxW, start.w + dx))
      } else if (resizing.includes('w')) {
        const rawW = Math.max(MIN_W, start.w - dx)
        // Right edge stays put — only the dragged (left) edge moves.
        newX = Math.max(0, start.winX + start.w - rawW)
        newW = start.winX + start.w - newX
      }

      let newH = start.h
      let newY = start.winY
      if (resizing.includes('s')) {
        const maxH = window.innerHeight - start.winY - 60
        newH = Math.max(MIN_H, Math.min(maxH, start.h + dy))
      } else if (resizing.includes('n')) {
        const rawH = Math.max(MIN_H, start.h - dy)
        // Bottom edge stays put — only the dragged (top) edge moves.
        newY = Math.max(0, start.winY + start.h - rawH)
        newH = start.winY + start.h - newY
      }

      if (newX !== state.x || newY !== state.y) onMove(newX, newY)
      onResize(newW, newH)
    }
    const onUp = () => setResizing(null)
    document.addEventListener('mousemove', onMove_)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove_)
      document.removeEventListener('mouseup', onUp)
    }
  }, [resizing, state.x, state.y, onMove, onResize])

  
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

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const geom: React.CSSProperties = (isMobile || state.maximized) ? {
    left: 0,
    top: 0,
    width: '100vw',
    
    height: 'calc(100vh - 48px - env(safe-area-inset-bottom, 0px))',
  } : {
    left: state.x, top: state.y,
    width: state.width, height: state.height,
  }

  if (state.minimized) {
    return null
  }

  
  
  
  const titleBarPaddingTop =
    (isMobile || state.maximized)
      ? 'max(4px, calc(env(safe-area-inset-top, 0px) + 4px))'
      : '4px'

  
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

      {/* ── RESIZE HANDLES — all 4 corners + all 4 edges ────────────────── */}
      {!isMobile && !state.maximized && (
        <>
          <ResizeZone dir="n" onMouseDown={onResizeMouseDown('n')} style={{ top: 0, left: 14, right: 14, height: 6, cursor: 'ns-resize' }} />
          <ResizeZone dir="s" onMouseDown={onResizeMouseDown('s')} style={{ bottom: 0, left: 14, right: 14, height: 6, cursor: 'ns-resize' }} />
          <ResizeZone dir="w" onMouseDown={onResizeMouseDown('w')} style={{ left: 0, top: 14, bottom: 14, width: 6, cursor: 'ew-resize' }} />
          <ResizeZone dir="e" onMouseDown={onResizeMouseDown('e')} style={{ right: 0, top: 14, bottom: 14, width: 6, cursor: 'ew-resize' }} />
          <ResizeZone dir="nw" onMouseDown={onResizeMouseDown('nw')} style={{ top: 0, left: 0, width: 14, height: 14, cursor: 'nwse-resize' }} />
          <ResizeZone dir="ne" onMouseDown={onResizeMouseDown('ne')} style={{ top: 0, right: 0, width: 14, height: 14, cursor: 'nesw-resize' }} />
          <ResizeZone dir="sw" onMouseDown={onResizeMouseDown('sw')} style={{ bottom: 0, left: 0, width: 14, height: 14, cursor: 'nesw-resize' }} />
          <ResizeZone
            dir="se"
            onMouseDown={onResizeMouseDown('se')}
            style={{
              bottom: 0, right: 0, width: 14, height: 14, cursor: 'nwse-resize',
              background: `
                linear-gradient(135deg, transparent 0%, transparent 30%,
                  #888 30%, #888 35%, transparent 35%, transparent 55%,
                  #888 55%, #888 60%, transparent 60%)
              `,
              opacity: 0.5,
            }}
          />
        </>
      )}
    </div>
  )
}




function ResizeZone({
  onMouseDown, style,
}: {
  dir: string
  onMouseDown: (e: React.MouseEvent) => void
  style: React.CSSProperties
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        zIndex: 10,
        ...style,
      }}
    />
  )
}




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