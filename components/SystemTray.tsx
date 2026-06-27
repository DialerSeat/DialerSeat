'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import CalendarApp from '@/components/CalendarApp'

// =============================================================================
// SystemTray — Windows-style bottom-right tray (admin / manager+ only)
// =============================================================================
// A persistent bottom-right cluster:
//   • A LIVE clock (time + date) that ticks every second. Clicking it opens the
//     CALENDAR as a full in-flow app surface (themed like DialerSeat — NOT a
//     small popup). For admin/manager+ this clock is the ONLY way into the
//     calendar (they have no sidebar calendar entry).
//   • A VIEW DESKTOP control to its right (the Windows "show desktop" corner),
//     which navigates to the role's desktop.
//
// Rendered only when the user is admin or manager+. All colors use the
// tenant-overridable --brand-* tokens.
// =============================================================================

export default function SystemTray({
  isAdmin,
  hasManagerPlus,
}: {
  isAdmin: boolean
  hasManagerPlus: boolean
}) {
  const router = useRouter()
  const [now, setNow] = useState<Date | null>(null)
  const [calOpen, setCalOpen] = useState(false)

  // Tick every second. Start null to avoid hydration mismatch, set on mount.
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Only admin / manager+ get the tray.
  if (!isAdmin && !hasManagerPlus) return null

  const desktopHref = isAdmin ? '/dashboard/admin/desktop' : '/dashboard/manager/desktop'

  const timeStr = now
    ? now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    : '—'
  const dateStr = now
    ? now.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <>
      {/* ── The tray cluster, fixed bottom-right ─────────────────────────── */}
      <div
        className="ds-system-tray"
        style={{
          position: 'fixed',
          right: 0,
          bottom: 0,
          zIndex: 120,
          display: 'flex',
          alignItems: 'stretch',
          height: 40,
          pointerEvents: 'none', // children re-enable; lets the corner stay clickable-through elsewhere
        }}
      >
        {/* Clock — opens the calendar app */}
        <button
          onClick={() => setCalOpen(true)}
          title="Open calendar"
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 1,
            padding: '0 14px',
            height: '100%',
            border: 'none',
            borderLeft: '1px solid var(--brand-sidebar-active-bg, #d4d7de)',
            borderTop: '1px solid var(--brand-sidebar-active-bg, #d4d7de)',
            background: calOpen ? 'var(--brand-primary-soft, #eef4ff)' : 'var(--brand-header-bg, #fff)',
            color: 'var(--brand-on-header, #1a1a2e)',
            cursor: 'pointer',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700 }}>{timeStr}</span>
          <span style={{ fontSize: 10, color: 'var(--brand-on-sidebar-muted, #888)' }}>{dateStr}</span>
        </button>

        {/* View Desktop — the Windows "show desktop" sliver to the right */}
        <button
          onClick={() => router.push(desktopHref)}
          title="View desktop"
          aria-label="View desktop"
          style={{
            pointerEvents: 'auto',
            width: 12,
            height: '100%',
            border: 'none',
            borderLeft: '1px solid var(--brand-sidebar-active-bg, #d4d7de)',
            borderTop: '1px solid var(--brand-sidebar-active-bg, #d4d7de)',
            background: 'var(--brand-header-bg, #fff)',
            cursor: 'pointer',
            padding: 0,
          }}
          onMouseEnter={e => { (e.currentTarget.style.background = 'var(--brand-primary, #4a9eff)') }}
          onMouseLeave={e => { (e.currentTarget.style.background = 'var(--brand-header-bg, #fff)') }}
        />
      </div>

      {/* ── Calendar app surface (full, themed — not a popup) ────────────── */}
      {calOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 130,
            background: 'var(--brand-page-bg, #f0f1f4)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* App title bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 18px',
              background: 'var(--brand-header-bg, #fff)',
              borderBottom: '1px solid var(--brand-sidebar-active-bg, #d4d7de)',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: 2,
                color: 'var(--brand-on-header, #1a1a2e)',
              }}
            >
              CALENDAR
            </span>
            <button
              onClick={() => setCalOpen(false)}
              aria-label="Close calendar"
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                border: '1px solid var(--brand-sidebar-active-bg, #ccc)',
                background: 'transparent',
                color: 'var(--brand-on-header, #1a1a2e)',
                cursor: 'pointer',
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              ✕
            </button>
          </div>

          {/* The calendar itself, embedded */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px' }}>
            <CalendarApp embedded />
          </div>
        </div>
      )}
    </>
  )
}
