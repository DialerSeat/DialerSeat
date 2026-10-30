'use client'
import { useEffect, useRef, type ReactNode } from 'react'

// =============================================================================
// THE HERO SHOWCASE FILLS THE PHONE'S WIDTH
// =============================================================================
// On a phone the dialer mockup is laid out at 640px and scaled down with CSS
// zoom (app/page.tsx, .ds-showcase-scale). The zoom was a fixed 0.5, which is
// 320px: right for an iPhone, whose content column is about 320-350px, and
// short on a wider Android (412px and up), where it sat left-aligned with a gap
// beside it. This measures the column and sets --ds-showcase-zoom to fill it.
// The CSS keeps 0.5 as the fallback, so the first paint is the old layout and
// nothing jumps if this has not run yet. Above the phone breakpoint the
// variable is unused.
// =============================================================================

/** The width .ds-showcase-scale is laid out at on a phone. */
const LAYOUT_WIDTH = 640

export default function ShowcaseFit({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      const w = el.clientWidth
      if (w > 0) el.style.setProperty('--ds-showcase-zoom', String(Math.min(1, w / LAYOUT_WIDTH)))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return <div className="ds-showcase-shell" ref={ref}>{children}</div>
}
