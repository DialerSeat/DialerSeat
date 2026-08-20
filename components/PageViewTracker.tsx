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
  const viewIdRef = useRef<string | null>(null)
  const reportedRef = useRef(false)

  useEffect(() => {
    if (!pathname) return
    // React runs effects twice in development. Without this guard every view
    // would be counted twice locally and the numbers would be quietly wrong in
    // a way nobody notices until they stop matching reality.
    if (lastSent.current === pathname) return
    lastSent.current = pathname
    viewIdRef.current = null
    reportedRef.current = false

    // Campaign parameters, read by name. The query string itself is never sent
    // — it can carry search terms, tokens and ids, and only these three are
    // about where the visit came from.
    const q = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams()

    const payload = JSON.stringify({
      path: pathname,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      authed: typeof document !== 'undefined' && document.cookie.includes('__session'),
      utm_source: q.get('utm_source') || undefined,
      utm_medium: q.get('utm_medium') || undefined,
      utm_campaign: q.get('utm_campaign') || undefined,
    })

    // ── THE ENTRY BEACON ──────────────────────────────────────────────────
    // fetch rather than sendBeacon here, because this one needs the row id back
    // so the exit beacon can update it. The exit beacon, which cannot wait for
    // anything, still uses sendBeacon.
    let cancelled = false
    const started = Date.now()
    fetch('/api/analytics/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled) viewIdRef.current = d?.id ?? null })
      .catch(() => {})

    // ── HOW LONG THEY STAYED ──────────────────────────────────────────────
    // Sent when the page is left, which is the only moment the answer exists.
    // sendBeacon because a normal fetch is abandoned when the tab closes, and
    // the longest, most interesting visits are exactly the ones that end that
    // way. visibilitychange rather than unload: iOS never fires unload, so on
    // a phone this would otherwise report nothing at all.
    const report = () => {
      const id = viewIdRef.current
      if (!id || reportedRef.current) return
      reportedRef.current = true
      const ms = Date.now() - started
      try {
        navigator.sendBeacon?.(
          '/api/analytics/pageview',
          new Blob([JSON.stringify({ path: pathname, viewId: id, dwellMs: ms })], {
            type: 'application/json',
          })
        )
      } catch { /* a missing dwell figure is not worth an error */ }
    }

    const onHide = () => { if (document.visibilityState === 'hidden') report() }
    document.addEventListener('visibilitychange', onHide)

    return () => {
      cancelled = true
      // Also on route change — a client-side navigation ends this view just as
      // surely as closing the tab does, and nothing else would notice.
      report()
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [pathname])

  return null
}
