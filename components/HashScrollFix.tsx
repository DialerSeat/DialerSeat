'use client'

import { useEffect } from 'react'

/**
 * Re-applies an inbound #hash scroll once the page has finished laying out.
 *
 * Landing on dialerseat.com/#features directly (a shared link, a bookmark, a
 * hard reload) scrolls before everything above the anchor has settled. The
 * client showcases mount and the webfont swaps in, content above the anchor
 * grows, and the scroll that was correct when it happened now lands ~115px
 * short — leaving the demo panel on screen under a section the visitor asked
 * to see the features of. Clicking the nav link is fine; only the initial
 * load is wrong, which is why it went unnoticed.
 *
 * Several passes rather than one, because there are several independent
 * things that move the anchor and they finish at different times: the second
 * paint, the webfont, and the load event. scrollIntoView honours the target's
 * scroll-margin-top, so the sticky nav is accounted for without repeating its
 * height here.
 *
 * It stops the moment the visitor scrolls for themselves. A page that yanks
 * itself back while someone is reading is worse than one that lands slightly
 * off, so the correction only ever applies to a position nobody chose.
 */
export default function HashScrollFix() {
  useEffect(() => {
    const hash = window.location.hash
    if (!hash || hash.length < 2) return

    let target: Element | null
    try {
      target = document.querySelector(hash)
    } catch {
      return // Not a valid selector — a hash that isn't an element id.
    }
    if (!target) return

    let done = false
    const timers: number[] = []

    const stop = () => {
      if (done) return
      done = true
      timers.forEach(clearTimeout)
      try { history.scrollRestoration = priorRestoration } catch { /* unsupported */ }
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchstart', stop)
      window.removeEventListener('keydown', stop)
    }

    const settle = () => {
      if (done || !target) return
      // Already within a pixel or two of where it belongs — leave it alone
      // rather than issuing a scroll that does nothing.
      const off = target.getBoundingClientRect().top
      const want = parseFloat(getComputedStyle(target).scrollMarginTop) || 0
      if (Math.abs(off - want) < 2) return
      target.scrollIntoView()
    }

    // Any deliberate scroll input hands control back to the visitor.
    window.addEventListener('wheel', stop, { passive: true })
    window.addEventListener('touchstart', stop, { passive: true })
    window.addEventListener('keydown', stop)

    // The browser's own scroll restoration re-fires late on this page and
    // lands ~145px above the anchor, undoing a correction that had already
    // run. Taking it off automatic for the duration of the correction is the
    // only way to win that race deterministically; it goes back on when we
    // stop, so normal back/forward restoration is unaffected.
    const priorRestoration = history.scrollRestoration
    try { history.scrollRestoration = 'manual' } catch { /* unsupported */ }

    requestAnimationFrame(() => requestAnimationFrame(settle))
    window.addEventListener('load', settle, { once: true })
    document.fonts?.ready.then(settle).catch(() => {})
    // Passes spread across the window in which things are still moving, then
    // hand the page over for good.
    timers.push(
      window.setTimeout(settle, 400),
      window.setTimeout(settle, 900),
      window.setTimeout(settle, 1500),
      window.setTimeout(settle, 2200),
      window.setTimeout(stop, 2600),
    )

    return stop
  }, [])

  return null
}
