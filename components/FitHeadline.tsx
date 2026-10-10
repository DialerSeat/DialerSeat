'use client'

import { useLayoutEffect, useRef } from 'react'

// The landing headline: two lines that must each stay on one line, in every
// language, at the largest size that fits the column. The server already sets
// a size estimated from the text (lib/i18n/fit.ts), so the first paint is
// close; this measures the real glyph widths after load and settles on the
// exact size, then keeps it right when the window is resized.
export default function FitHeadline({ className, style, lines, baseVar }: {
  className?: string
  style: React.CSSProperties
  lines: Array<{ text: string; color: string }>
  /** CSS variable holding the English size, the ceiling for every language. */
  baseVar: string
}) {
  const ref = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    const h = ref.current
    if (!h) return
    const fit = () => {
      const base = parseFloat(getComputedStyle(h).getPropertyValue(baseVar))
      if (!base) return
      h.style.fontSize = `${base}px`
      const spans = Array.from(h.querySelectorAll('span'))
      const widest = Math.max(...spans.map((s) => s.scrollWidth))
      const room = h.clientWidth
      if (widest > room && room > 0) h.style.fontSize = `${Math.floor(base * (room / widest) * 0.98)}px`
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(h.parentElement ?? h)
    document.fonts?.ready.then(fit).catch(() => {})
    return () => ro.disconnect()
  }, [baseVar])

  return (
    <h1 ref={ref} className={className} style={{ ...style, width: '100%' }}>
      {lines.map((l, i) => (
        <span key={i} style={{ color: l.color, display: 'block', whiteSpace: 'nowrap' }}>
          {l.text}
        </span>
      ))}
    </h1>
  )
}
