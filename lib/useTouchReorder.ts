'use client'
import { useRef } from 'react'

type TouchReorderOpts = {
  attr: string
  onStart: (id: string) => void
  onOver?: (id: string) => void
  onDrop: (dragId: string, targetId: string) => void
  onEnd?: () => void
  holdMs?: number
}

type DragState = {
  id: string | null
  active: boolean
  timer: ReturnType<typeof setTimeout> | null
  startX: number
  startY: number
  overId: string | null
  el: HTMLElement | null
  move: ((e: TouchEvent) => void) | null
  end: ((e: TouchEvent) => void) | null
}

const idle = (): DragState => ({
  id: null,
  active: false,
  timer: null,
  startX: 0,
  startY: 0,
  overId: null,
  el: null,
  move: null,
  end: null,
})

export default function useTouchReorder({
  attr,
  onStart,
  onOver,
  onDrop,
  onEnd,
  holdMs = 250,
}: TouchReorderOpts) {
  const ref = useRef<DragState>(idle())

  const cleanup = () => {
    const s = ref.current
    if (s.timer) clearTimeout(s.timer)
    if (s.el) {
      if (s.move) s.el.removeEventListener('touchmove', s.move)
      if (s.end) {
        s.el.removeEventListener('touchend', s.end)
        s.el.removeEventListener('touchcancel', s.end)
      }
    }
    ref.current = idle()
  }

  return (id: string) => ({
    [attr]: id,
    onTouchStart: (e: React.TouchEvent<HTMLElement>) => {
      if (e.touches.length !== 1) return
      cleanup()
      const t = e.touches[0]
      const el = e.currentTarget as HTMLElement
      const s = ref.current
      s.id = id
      s.el = el
      s.startX = t.clientX
      s.startY = t.clientY
      s.overId = id
      s.move = (ev: TouchEvent) => {
        const st = ref.current
        if (!st.id) return
        const tt = ev.touches[0]
        if (!tt) return
        if (!st.active) {
          if (Math.abs(tt.clientX - st.startX) > 8 || Math.abs(tt.clientY - st.startY) > 8) {
            cleanup()
          }
          return
        }
        ev.preventDefault()
        const hit = document.elementFromPoint(tt.clientX, tt.clientY)?.closest(`[${attr}]`)
        const over = hit ? hit.getAttribute(attr) : null
        if (over && over !== st.overId) {
          st.overId = over
          if (onOver) onOver(over)
        }
      }
      s.end = (ev: TouchEvent) => {
        const st = ref.current
        const wasActive = st.active
        const dragId = st.id
        const overId = st.overId
        if (wasActive && ev.cancelable) ev.preventDefault()
        cleanup()
        if (wasActive) {
          if (dragId && overId && overId !== dragId) onDrop(dragId, overId)
          if (onEnd) onEnd()
        }
      }
      el.addEventListener('touchmove', s.move, { passive: false })
      el.addEventListener('touchend', s.end, { passive: false })
      el.addEventListener('touchcancel', s.end, { passive: false })
      s.timer = setTimeout(() => {
        const st = ref.current
        if (st.id !== id) return
        st.active = true
        onStart(id)
        try {
          ;(navigator as Navigator & { vibrate?: (ms: number) => void }).vibrate?.(10)
        } catch {}
      }, holdMs)
    },
  })
}
