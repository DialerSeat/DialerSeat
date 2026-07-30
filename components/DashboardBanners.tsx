'use client'
import { useEffect, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────
// Sitewide dashboard banners — promo/announcement banner on top, Dialer
// Down emergency banner underneath (always at the bottom when both are
// showing). Both scroll right to left, news-ticker style.
//
// This component is mounted once, in app/dashboard/layout.tsx, directly
// above {children}. That placement is what scopes it to dashboard apps
// only:
//   - app/dashboard/layout.tsx already returns bare `{children}` (no
//     chrome at all) for admin/manager desktop routes, before this
//     component would ever render — so it never appears there.
//   - Nothing on the landing page or any route outside /dashboard ever
//     imports this component, so it structurally cannot appear there.
//
// Both banners are fetched from endpoints that independently re-check
// "signed in + Pro/Manager+" server-side on every request
// (/api/dashboard/dialer-down and /api/dashboard/promo-banner) — so even
// though this component itself doesn't re-derive plan/role, a user who
// doesn't qualify simply gets { enabled: false } back from both calls and
// nothing renders. There is no client-side toggle that can be flipped to
// reveal either banner; the only way either shows is if the corresponding
// admin toggle is on AND the server-side check passes.
// ─────────────────────────────────────────────────────────────────────────

interface PromoState {
  enabled: boolean
  message: string
  textColor: string
  bgColor: string
}

interface DialerDownState {
  enabled: boolean
  message: string
}

function Ticker({ text, bg, color }: { text: string; bg: string; color: string }) {
  return (
    <div style={{ background: bg, overflow: 'hidden', width: '100%' }}>
      <style>{`
        @keyframes ds-banner-ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
      <div
        style={{
          display: 'flex',
          width: 'max-content',
          animation: 'ds-banner-ticker 24s linear infinite',
          padding: '8px 0',
        }}
      >
        {[0, 1].map(i => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              whiteSpace: 'nowrap',
              paddingRight: 72,
              fontSize: 13.5,
              fontWeight: 600,
              letterSpacing: 0.2,
              color,
            }}
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function DashboardBanners() {
  const [promo, setPromo] = useState<PromoState | null>(null)
  const [dialerDown, setDialerDown] = useState<DialerDownState | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/dashboard/promo-banner')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data?.success) return
        setPromo({ enabled: !!data.enabled, message: data.message || '', textColor: data.textColor || '#FFFFFF', bgColor: data.bgColor || '#0A84FF' })
      })
      .catch(() => {})

    fetch('/api/dashboard/dialer-down')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data?.success) return
        setDialerDown({ enabled: !!data.enabled, message: data.message || '' })
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [])

  const showPromo = !!promo?.enabled && !!promo.message
  const showDialerDown = !!dialerDown?.enabled && !!dialerDown.message

  if (!showPromo && !showDialerDown) return null

  return (
    <div>
      {showPromo && (
        <Ticker text={promo!.message} bg={promo!.bgColor} color={promo!.textColor} />
      )}
      {showDialerDown && (
        <Ticker text={`⚠ DIALER DOWN — ${dialerDown!.message}  ⚠`} bg="#FF453A" color="#FFFFFF" />
      )}
    </div>
  )
}
