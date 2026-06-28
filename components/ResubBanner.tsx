'use client'
import { useEffect, useState } from 'react'

// Shown across the dashboard whenever the account is not on an active paid sub.
// The dashboard is read-only in that state (enforced in proxy.ts); this banner
// is the persistent "resubscribe" call-to-action the user sees on every page.

export default function ResubBanner() {
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/stripe/status')
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        // Not active (no trials; past_due and canceled are both locked) → show.
        if (d && d.isActive === false) {
          setShow(true)
          setStatus(d.status ?? null)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!show) return null

  const message =
    status === 'past_due'
      ? 'Your payment didn’t go through, so your account is read-only. Update your payment to restore full access.'
      : 'Your subscription isn’t active, so your account is read-only. Resubscribe to make changes again.'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        flexWrap: 'wrap',
        padding: '10px 16px',
        background: 'var(--brand-primary, #4a9eff)',
        color: 'var(--brand-on-primary, #fff)',
        fontSize: 13,
        fontWeight: 600,
        textAlign: 'center',
      }}
    >
      <span>{message}</span>
      <a
        href="/billing"
        style={{
          background: 'var(--brand-on-primary, #fff)',
          color: 'var(--brand-primary, #4a9eff)',
          padding: '6px 16px',
          borderRadius: 6,
          fontWeight: 800,
          letterSpacing: 1,
          textDecoration: 'none',
          fontSize: 12,
          whiteSpace: 'nowrap',
        }}
      >
        RESUBSCRIBE
      </a>
    </div>
  )
}
