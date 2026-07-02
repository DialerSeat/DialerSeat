'use client'
import { useEffect, useRef } from 'react'

export interface ContextMenuItem {
  label?: string              // missing → divider
  icon?: string
  disabled?: boolean
  danger?: boolean
  onClick?: () => void
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}










export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  
  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left = x
    let top = y
    if (left + rect.width > vw - 8) left = vw - rect.width - 8
    if (top + rect.height > vh - 8) top = vh - rect.height - 8
    if (left < 8) left = 8
    if (top < 8) top = 8
    el.style.left = `${left}px`
    el.style.top = `${top}px`
  }, [x, y])

  
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        position: 'fixed',
        left: x, top: y,
        minWidth: 180,
        background: '#fafafa',
        border: '1px solid #6b6b6b',
        boxShadow: '3px 3px 10px rgba(0,0,0,0.35)',
        padding: '2px',
        zIndex: 99999,
        fontFamily: '"Segoe UI", Tahoma, sans-serif',
        fontSize: 12,
        color: '#1c1c2c',
        userSelect: 'none',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, idx) => {
        if (!item.label) {
          return (
            <div
              key={`sep-${idx}`}
              style={{
                height: 1, background: '#d0d0d0',
                margin: '3px 6px',
              }}
            />
          )
        }
        return (
          <div
            key={`item-${idx}`}
            onClick={() => {
              if (item.disabled) return
              item.onClick?.()
              onClose()
            }}
            style={{
              padding: '5px 24px 5px 28px',
              cursor: item.disabled ? 'default' : 'pointer',
              color: item.disabled ? '#999' : (item.danger ? '#8a1a1a' : '#1c1c2c'),
              position: 'relative',
              whiteSpace: 'nowrap',
              borderRadius: 2,
            }}
            onMouseEnter={(e) => {
              if (item.disabled) return
              e.currentTarget.style.background = item.danger ? '#e81123' : '#4a9eff'
              e.currentTarget.style.color = 'white'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = item.disabled
                ? '#999'
                : (item.danger ? '#8a1a1a' : '#1c1c2c')
            }}
          >
            {item.icon && (
              <span style={{
                position: 'absolute', left: 6, top: '50%',
                transform: 'translateY(-50%)', fontSize: 13,
              }}>{item.icon}</span>
            )}
            {item.label}
          </div>
        )
      })}
    </div>
  )
}