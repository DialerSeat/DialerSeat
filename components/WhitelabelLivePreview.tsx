'use client'

import type { CSSProperties } from 'react'

// =============================================================================
// WHITELABEL LIVE EXACT PREVIEW v3 — Pass 2 expansion (3-color)
// =============================================================================
// Adds optional pageBg prop. When provided, the outer container bg, card
// surfaces, card borders, body text, and muted text all derive from it
// via auto-contrast + color-mix — matching what ThemeProvider v4 does
// for real dashboard surfaces in production.
//
// Backward compatible: pageBg is optional. If not passed (existing
// 2-color callers), defaults to #f0f1f4 (Pass 2 light dashboard page bg).
//
// What's rendered (4 readability points visible at once):
//   1. Sidebar — sidebar bg + auto-contrast text + active nav with primary
//      left border + MANAGER+ pill (primary bg + auto-contrast text)
//   2. Header strip — sidebar bg with title in primary + segmented control
//      (active button = primary bg + auto-contrast text)
//   3. Page body — NEW: "WELCOME BACK." headline (full on-page-bg) + muted
//      helper paragraph (60/40 mix toward on-page-bg). Demonstrates
//      body-text readability on the user's chosen page bg.
//   4. CTA button — INITIATE DIAL SEQUENCE on sidebar bg with primary top
//      accent and primary text. Demonstrates CTA readability.
//
// What stays semantic (NEVER themed):
//   - KPI tile top stripes (green for CONVERSIONS, amber for BEST CAMPAIGN)
//   - KPI tile value colors (match their semantic stripe)
//   - All status pill colors (handled outside this component)
//
// Auto-contrast (pickContrastText):
//   Computes WCAG relative luminance, returns true white (#ffffff) for
//   dark colors (L ≤ 0.18) or app-standard near-black (#1a1c24) for
//   lighter colors. Threshold tuned for the preset palette so mid-
//   saturation primaries (lavender, forest green, rose) and dark
//   sidebars all correctly get the higher-contrast text choice.
//   Matches ThemeProvider v4 exactly. Per JC: "true white or black".
//
// Derived tokens (matching ThemeProvider v4's color-mix expressions):
//   card-surface  page-bg shifted 8% toward on-page-bg
//   card-border   page-bg shifted 18% toward on-page-bg
//   muted-text    60% on-page-bg + 40% page-bg
// =============================================================================

const FUTURA = `'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif`
const DEFAULT_PAGE_BG = '#f0f1f4'

interface WhitelabelLivePreviewProps {
  primary: string
  sidebar: string
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
  pageBg = DEFAULT_PAGE_BG,
  brandName,
  logoUrl,
}: WhitelabelLivePreviewProps) {
  const onPrimary = pickContrastText(primary)
  const onSidebar = pickContrastText(sidebar)
  const onPageBg = pickContrastText(pageBg)

  // Derived — match ThemeProvider v4 expressions exactly so what the
  // user sees here is what they get on the real dashboard.
  const cardSurface = `color-mix(in srgb, ${pageBg} 92%, ${onPageBg} 8%)`
  const cardBorder = `color-mix(in srgb, ${pageBg} 82%, ${onPageBg} 18%)`
  const mutedText = `color-mix(in srgb, ${onPageBg} 60%, ${pageBg} 40%)`

  // Sidebar derived — same heuristic as ThemeProvider v4
  const sidebarTextMuted =
    onSidebar === '#ffffff' ? 'rgba(255,255,255,0.55)' : 'rgba(26,28,36,0.55)'
  const sidebarActiveBg =
    onSidebar === '#ffffff' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

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
        {/* Logo box — padding 0, fills entire box */}
        <div
          style={{
            height: 64,
            padding: 0,
            overflow: 'hidden',
            background: sidebar,
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
                color: sidebarTextMuted,
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
        {/* Header strip */}
        <div
          style={{
            background: sidebar,
            color: onSidebar,
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
          {/* Segmented control */}
          <div style={{ display: 'flex', gap: 2 }}>
            {['TODAY', 'WEEK', 'MONTH'].map((label, i) => (
              <div
                key={label}
                style={{
                  padding: '4px 9px',
                  background: i === 1 ? primary : 'transparent',
                  color: i === 1 ? onPrimary : sidebarTextMuted,
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

          {/* Primary CTA button */}
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