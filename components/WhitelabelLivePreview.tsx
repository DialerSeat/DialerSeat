'use client'

import type { CSSProperties } from 'react'

// =============================================================================
// WHITELABEL LIVE EXACT PREVIEW v4 — header/sidebar split (migration 004)
// =============================================================================
// Adds optional headerBg prop. When provided, the header strip AND the
// logo box (top-left, above the sidebar nav) both use headerBg + auto-
// contrast text. The segmented-control inactive items use onHeaderMuted
// instead of sidebarTextMuted since they sit on the header surface.
//
// Backward compatible: headerBg is optional. If not passed (existing
// 3-color callers), defaults to the sidebar value internally so the
// preview collapses to the current unified look (one dark band across
// the top, logo + header reading as a single chrome surface).
//
// What's rendered (5 readability points visible at once):
//   1. Logo box — uses headerBg + auto-contrast text (when no logo
//      uploaded). When headerBg matches sidebar, looks like the sidebar
//      top. When different, visually groups with the header strip
//      across the top of the layout. Per JC's "logo fit entirely in
//      the top of header" direction — fills the box, no outer padding.
//   2. Sidebar — sidebar bg + auto-contrast text + active nav with
//      primary left border + MANAGER+ pill (primary bg + auto-contrast text)
//   3. Header strip — headerBg + onHeader text. Section label in primary,
//      segmented control (active = primary bg + on-primary text;
//      inactive = onHeaderMuted text).
//   4. Page body — "WELCOME BACK." headline (full on-page-bg) + muted
//      helper paragraph (60/40 mix toward on-page-bg). Demonstrates
//      body-text readability on the user's chosen page bg.
//   5. CTA button — INITIATE DIAL SEQUENCE on sidebar bg with primary
//      top accent and primary text. Demonstrates CTA readability on
//      sidebar bg (which is the dialer page's button bg pattern).
//
// What stays semantic (NEVER themed):
//   - KPI tile top stripes (green for CONVERSIONS, amber for BEST CAMPAIGN)
//   - KPI tile value colors (match their semantic stripe)
//
// Auto-contrast (pickContrastText):
//   Computes WCAG relative luminance, returns true white (#ffffff) for
//   dark colors (L ≤ 0.18) or app-standard near-black (#1a1c24) for
//   lighter colors. Threshold matches ThemeProvider v5 exactly so what
//   the user sees here is what they get on the real dashboard.
//
// Derived tokens (matching ThemeProvider v5's color-mix expressions):
//   card-surface  page-bg shifted 8% toward on-page-bg
//   card-border   page-bg shifted 18% toward on-page-bg
//   muted-text    60% on-page-bg + 40% page-bg
// =============================================================================

const FUTURA = `'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif`
const DEFAULT_PAGE_BG = '#f0f1f4'

interface WhitelabelLivePreviewProps {
  primary: string
  sidebar: string
  headerBg?: string
  pageBg?: string
  brandName: string
  logoUrl: string | null
}

function pickContrastText(hex: string): string {
  const h = (hex || '').replace('#', '').padEnd(6, '0').slice(0, 6)
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return '#1a1c24'
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return luminance > 0.18 ? '#1a1c24' : '#ffffff'
}

export function WhitelabelLivePreview({
  primary,
  sidebar,
  headerBg,
  pageBg = DEFAULT_PAGE_BG,
  brandName,
  logoUrl,
}: WhitelabelLivePreviewProps) {
  // headerBg falls back to sidebar (not a constant) — preserves backward
  // compat for existing callers AND matches the migration 004 backfill
  // behavior in production.
  const resolvedHeaderBg = headerBg ?? sidebar

  const onPrimary = pickContrastText(primary)
  const onSidebar = pickContrastText(sidebar)
  const onHeader = pickContrastText(resolvedHeaderBg)
  const onPageBg = pickContrastText(pageBg)

  // Derived — match ThemeProvider v5 expressions exactly so what the
  // user sees here is what they get on the real dashboard.
  const cardSurface = `color-mix(in srgb, ${pageBg} 92%, ${onPageBg} 8%)`
  const cardBorder = `color-mix(in srgb, ${pageBg} 82%, ${onPageBg} 18%)`
  const mutedText = `color-mix(in srgb, ${onPageBg} 60%, ${pageBg} 40%)`

  // Sidebar derived — same heuristic as ThemeProvider v5
  const sidebarTextMuted =
    onSidebar === '#ffffff' ? 'rgba(255,255,255,0.55)' : 'rgba(26,28,36,0.55)'
  const sidebarActiveBg =
    onSidebar === '#ffffff' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  // Header derived — same heuristic as ThemeProvider v5
  const onHeaderMuted =
    onHeader === '#ffffff' ? 'rgba(255,255,255,0.55)' : 'rgba(26,28,36,0.55)'

  const navItems = [
    { label: 'ANALYTICS', active: true },
    { label: 'DIALER', active: false },
    { label: 'CAMPAIGNS', active: false },
    { label: 'LEADS', active: false },
    { label: 'SETTINGS', active: false },
  ]

  return (
    <div
      style={{
        width: '100%',
        borderRadius: 6,
        border: `1px solid ${cardBorder}`,
        overflow: 'hidden',
        background: pageBg,
        display: 'flex',
        minHeight: 380,
        fontFamily: FUTURA,
        boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
      }}
    >
      {/* ───── SIDEBAR ───── */}
      <div
        style={{
          width: 152,
          background: sidebar,
          color: onSidebar,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {/* Logo box — sits at the top of the sidebar column, but visually
            groups with the header strip via shared headerBg color. Padding 0
            so the logo fills the entire box with no outer space. The
            borderBottom uses sidebarActiveBg so it's invisible when
            headerBg == sidebar (current unified look) and a subtle divider
            when they differ. */}
        <div
          style={{
            height: 64,
            padding: 0,
            overflow: 'hidden',
            background: resolvedHeaderBg,
            borderBottom: `1px solid ${sidebarActiveBg}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={brandName || 'Brand'}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: 'center',
                display: 'block',
              }}
            />
          ) : (
            <div
              style={{
                fontSize: 9,
                letterSpacing: 2,
                color: onHeaderMuted,
                fontWeight: 700,
                textAlign: 'center',
                padding: '0 8px',
                lineHeight: 1.3,
              }}
            >
              {(brandName || 'YOUR BRAND').toUpperCase()}
            </div>
          )}
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, padding: '12px 0' }}>
          {navItems.map((item) => (
            <div
              key={item.label}
              style={{
                padding: '8px 14px',
                background: item.active ? sidebarActiveBg : 'transparent',
                borderLeft: item.active
                  ? `2px solid ${primary}`
                  : '2px solid transparent',
                color: item.active ? onSidebar : sidebarTextMuted,
                fontSize: 9,
                letterSpacing: 2,
                fontWeight: item.active ? 700 : 500,
              }}
            >
              {item.label}
            </div>
          ))}
        </div>

        {/* MANAGER+ pill */}
        <div style={{ padding: 12 }}>
          <div
            style={{
              background: primary,
              color: onPrimary,
              padding: '4px 9px',
              borderRadius: 3,
              fontSize: 8,
              letterSpacing: 2,
              fontWeight: 700,
              display: 'inline-block',
            }}
          >
            MANAGER+
          </div>
        </div>
      </div>

      {/* ───── MAIN AREA ───── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {/* Header strip — now bound to headerBg, independent of sidebar */}
        <div
          style={{
            background: resolvedHeaderBg,
            color: onHeader,
            padding: '10px 16px',
            borderBottom: `2px solid ${primary}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: 3,
              color: primary,
              fontWeight: 700,
            }}
          >
            ANALYTICS OVERVIEW
          </div>
          {/* Segmented control — inactive items use onHeaderMuted since
              they sit on the header surface (was sidebarTextMuted in v3). */}
          <div style={{ display: 'flex', gap: 2 }}>
            {['TODAY', 'WEEK', 'MONTH'].map((label, i) => (
              <div
                key={label}
                style={{
                  padding: '4px 9px',
                  background: i === 1 ? primary : 'transparent',
                  color: i === 1 ? onPrimary : onHeaderMuted,
                  fontSize: 8,
                  letterSpacing: 2,
                  fontWeight: 700,
                  borderRadius: 2,
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Page content on themed page-bg */}
        <div
          style={{
            flex: 1,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* ── Readability demo: body text + muted helper on page-bg ── */}
          <div style={{ marginBottom: 2 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: onPageBg,
                letterSpacing: 1,
                marginBottom: 4,
              }}
            >
              WELCOME BACK.
            </div>
            <div
              style={{
                fontSize: 10,
                color: mutedText,
                lineHeight: 1.5,
                letterSpacing: 0.3,
              }}
            >
              Body text on your chosen background. Auto-contrast keeps it
              readable on any color.
            </div>
          </div>

          {/* KPI tiles — derived card surface, semantic stripes never themed */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div
              style={{
                background: cardSurface,
                border: `1px solid ${cardBorder}`,
                borderTop: '3px solid #1a6a1a',
                borderRadius: 4,
                padding: 9,
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: 7,
                  letterSpacing: 2,
                  color: mutedText,
                  marginBottom: 3,
                  fontWeight: 700,
                }}
              >
                CONVERSIONS
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#1a6a1a',
                  fontFamily: 'monospace',
                }}
              >
                0
              </div>
            </div>
            <div
              style={{
                background: cardSurface,
                border: `1px solid ${cardBorder}`,
                borderTop: '3px solid #8a6a1a',
                borderRadius: 4,
                padding: 9,
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: 7,
                  letterSpacing: 2,
                  color: mutedText,
                  marginBottom: 3,
                  fontWeight: 700,
                }}
              >
                BEST CAMPAIGN
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#8a6a1a',
                  fontFamily: 'monospace',
                }}
              >
                —
              </div>
            </div>
          </div>

          {/* Chart placeholder with AWAITING DATA pill */}
          <div
            style={{
              flex: 1,
              background: cardSurface,
              border: `1px solid ${cardBorder}`,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 50,
            }}
          >
            <div
              style={{
                padding: '6px 14px',
                background: primary,
                color: onPrimary,
                fontSize: 8,
                letterSpacing: 2,
                fontWeight: 700,
                borderRadius: 3,
              }}
            >
              AWAITING DATA
            </div>
          </div>

          {/* Primary CTA button — bg uses sidebar (matches dialer's pattern
              of dark CTA on sidebar bg). If you want CTA on headerBg or
              card-surface, swap accordingly. */}
          <button
            type="button"
            disabled
            style={{
              padding: 11,
              background: sidebar,
              borderTop: `3px solid ${primary}`,
              border: 'none',
              borderRadius: 4,
              color: primary,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 3,
              fontFamily: FUTURA,
              cursor: 'default',
              opacity: 1,
            }}
          >
            INITIATE DIAL SEQUENCE
          </button>
        </div>
      </div>
    </div>
  )
}