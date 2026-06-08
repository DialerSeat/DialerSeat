'use client'

import type { CSSProperties } from 'react'

// =============================================================================
// WHITELABEL LIVE EXACT PREVIEW v5 — logo on sidebar + derivations aligned
// =============================================================================
// v5 changes vs v4:
//
//   1. Logo box background: resolvedHeaderBg → sidebar. The top of the
//      sidebar column is now part of the sidebar, NOT the header strip.
//      Matches dashboard layout C3 and JC's explicit rule: "the entire
//      sidebar should be a solid color. The tenant logo at the top of the
//      sidebar is sidebar, not header." Dragging the header slider in
//      onboarding no longer changes the top of the sidebar in the preview.
//
//   2. Logo box borderBottom removed. The actual deployed layout has no
//      divider between the logo and the nav — just marginBottom: 24 on
//      the logo Link. The preview's 1px border was creating a visual
//      seam that doesn't exist in production.
//
//   3. Brand-name fallback text color: onHeaderMuted → sidebarTextMuted.
//      Now that the logo box sits on the sidebar, the fallback text is on
//      sidebar bg, so it should use the sidebar-context muted color.
//
//   4. Tier-2 alpha derivations aligned with ThemeProvider v7's branded math:
//        sidebarTextMuted / onHeaderMuted   0.55 → 0.65 alpha
//          (matches color-mix(${on*} 65%, transparent))
//        sidebarActiveBg                    rgba(255,255,255,0.08) →
//          color-mix(${primary} 18%, transparent)
//          (matches primary-tinted active state in branded layouts)
//
// What's rendered (5 readability points visible at once):
//   1. Logo box — sits on the sidebar (sidebar bg + auto-contrast text).
//      Header changes don't affect it. Per JC's "logo fits entirely in
//      the top of the sidebar" direction — fills the box, no outer padding.
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
//   lighter colors. Threshold matches ThemeProvider v7's branded behavior
//   exactly so what the user sees here is what they get on the real
//   dashboard.
//
// Derived tokens (matching ThemeProvider v7's branded color-mix expressions):
//   card-surface       page-bg shifted 8% toward on-page-bg
//   card-border        page-bg shifted 18% toward on-page-bg
//   muted-text         60% on-page-bg + 40% page-bg
//   sidebar-text-muted on-sidebar at 65% alpha
//   sidebar-active-bg  primary at 18% alpha
//   on-header-muted    on-header at 65% alpha
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

  // Derived — match ThemeProvider v7 branded expressions exactly so what
  // the user sees here is what they get on the real dashboard.
  const cardSurface = `color-mix(in srgb, ${pageBg} 92%, ${onPageBg} 8%)`
  const cardBorder = `color-mix(in srgb, ${pageBg} 82%, ${onPageBg} 18%)`
  const mutedText = `color-mix(in srgb, ${onPageBg} 60%, ${pageBg} 40%)`

  // Sidebar derived — match ThemeProvider v7 branded math (65% alpha,
  // primary at 18% for active state)
  const sidebarTextMuted = `color-mix(in srgb, ${onSidebar} 65%, transparent)`
  const sidebarActiveBg = `color-mix(in srgb, ${primary} 18%, transparent)`

  // Header derived — same heuristic as ThemeProvider v7
  const onHeaderMuted = `color-mix(in srgb, ${onHeader} 65%, transparent)`

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
        {/* Logo box — sits at the top of the sidebar column AS PART OF the
            sidebar. v5: background changed from resolvedHeaderBg to sidebar
            so the entire sidebar reads as one solid color. Header slider
            changes no longer affect this region. */}
        <div
          style={{
            height: 64,
            padding: 0,
            overflow: 'hidden',
            background: sidebar,
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
        {/* Header strip — bound to headerBg, independent of sidebar */}
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
              they sit on the header surface. */}
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
              of dark CTA on sidebar bg). */}
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