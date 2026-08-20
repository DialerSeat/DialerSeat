'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// ─────────────────────────────────────────────────────────────────────────
// ONE BEACON PER PAGE VIEW
//
// Mounted once in the root layout so it covers the whole site — marketing
// pages, sign-up, dashboard, everything — rather than needing to be remembered
// on each new route.
//
// Fires on pathname change, which in an app-router SPA is what a "page view"
// actually is: a full reload happens once, and every navigation after it is a
// client transition that no server log would ever see.
// ─────────────────────────────────────────────────────────────────────────

export default function PageViewTracker() {
  const pathname = usePathname()
  const lastSent = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname) return
    // React runs effects twice in development. Without this guard every view
    // would be counted twice locally and the numbers would be quietly wrong in
    // a way nobody notices until they stop matching reality.
    if (lastSent.current === pathname) return
    lastSent.current = pathname

    const payload = JSON.stringify({
      path: pathname,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      authed: typeof document !== 'undefined' && document.cookie.includes('__session'),
    })

    // sendBeacon survives the page being closed mid-navigation, which a normal
    // fetch does not — the last view of a session is exactly the one a plain
    // fetch tends to lose. fetch with keepalive is the fallback.
    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/pageview', new Blob([payload], { type: 'application/json' }))
        return
      }
    } catch { /* fall through */ }

    fetch('/api/analytics/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  }, [pathname])

  return null
}
