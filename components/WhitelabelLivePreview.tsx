'use client'

import type { CSSProperties } from 'react'

// =============================================================================
// WHITELABEL LIVE EXACT PREVIEW — Pass 2 Phase B3
// =============================================================================
// Self-contained preview that renders a mini dashboard chunk themed by the
// two colors the user has picked. Drop into onboarding or settings; it
// scopes its CSS variables to its outer container so it doesn't override
// the surrounding page's chrome.
//
// What's rendered:
//   - Sidebar (144px wide): logo box (padding 0, fills entirety) + 5 nav
//     items (one active with primary-colored left border) + MANAGER+ pill
//   - Header strip: title + segmented control with one active button
//   - Page area: 2 KPI tiles (semantic stripes — green & amber, NOT themed),
//     AWAITING DATA pill, primary CTA button
//
// Bindings:
//   --brand-primary, --brand-sidebar-bg + 5 derived tokens, all scoped to
//   this component's outer <div> via inline style. The mini-dashboard JSX
//   binds to those tokens with var(--brand-*) — same bindings the real
//   dashboard will use after Phase C.
//
// What stays semantic:
//   KPI tile stripes (CONVERSIONS green, BEST CAMPAIGN amber) and the
//   #f0f1f4 / #e2e4ea / #c4c8d0 / #5a5e6a Pass 1 page-chrome tokens are
//   hardcoded. Per spec, these are never tenant-themed.
// =============================================================================

const FUTURA = `'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif`

interface WhitelabelLivePreviewProps {
  primary: string
  sidebar: string
  brandName: string
  logoUrl: string | null
}

function pickContrastText(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return '#ffffff'
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return luminance > 0.55 ? '#1a1c24' : '#ffffff'
}

export function WhitelabelLivePreview({
  primary,
  sidebar,
  brandName,
  logoUrl,
}: WhitelabelLivePreviewProps) {
  const onPrimary = pickContrastText(primary)
  const onSidebar = pickContrastText(sidebar)
  const sidebarTextMuted =
    onSidebar === '#ffffff' ? 'rgba(255,255,255,0.55)' : 'rgba(26,28,36,0.55)'
  const sidebarActiveBg =
    onSidebar === '#ffffff' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  // Scoped CSS variable container. Children read these via var(--brand-*).
  const scopedStyle = {
    '--brand-primary': primary,
    '--brand-sidebar-bg': sidebar,
    '--brand-on-primary': onPrimary,
    '--brand-on-sidebar': onSidebar,
    '--brand-on-sidebar-muted': sidebarTextMuted,
    '--brand-sidebar-active-bg': sidebarActiveBg,
    '--brand-header-top-accent': primary,
  } as CSSProperties

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
        ...scopedStyle,
        width: '100%',
        borderRadius: 6,
        border: '1px solid #c4c8d0',
        overflow: 'hidden',
        background: '#f0f1f4',
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
          background: 'var(--brand-sidebar-bg)',
          color: 'var(--brand-on-sidebar)',
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
            background: 'var(--brand-sidebar-bg)',
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
                color: 'var(--brand-on-sidebar-muted)',
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
                background: item.active ? 'var(--brand-sidebar-active-bg)' : 'transparent',
                borderLeft: item.active
                  ? '2px solid var(--brand-primary)'
                  : '2px solid transparent',
                color: item.active
                  ? 'var(--brand-on-sidebar)'
                  : 'var(--brand-on-sidebar-muted)',
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
              background: 'var(--brand-primary)',
              color: 'var(--brand-on-primary)',
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
            background: 'var(--brand-sidebar-bg)',
            color: 'var(--brand-on-sidebar)',
            padding: '10px 16px',
            borderBottom: '2px solid var(--brand-header-top-accent)',
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
              color: 'var(--brand-primary)',
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
                  background: i === 1 ? 'var(--brand-primary)' : 'transparent',
                  color: i === 1 ? 'var(--brand-on-primary)' : 'var(--brand-on-sidebar-muted)',
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

        {/* Page content */}
        <div
          style={{
            flex: 1,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* KPI tiles — semantic stripes, NOT themed per spec */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div
              style={{
                background: '#e2e4ea',
                border: '1px solid #c4c8d0',
                borderTop: '3px solid #1a6a1a', /* semantic green — NOT themed */
                borderRadius: 4,
                padding: 9,
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: 7,
                  letterSpacing: 2,
                  color: '#5a5e6a',
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
                background: '#e2e4ea',
                border: '1px solid #c4c8d0',
                borderTop: '3px solid #8a6a1a', /* semantic amber — NOT themed */
                borderRadius: 4,
                padding: 9,
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: 7,
                  letterSpacing: 2,
                  color: '#5a5e6a',
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
              background: '#e2e4ea',
              border: '1px solid #c4c8d0',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 70,
            }}
          >
            <div
              style={{
                padding: '6px 14px',
                background: 'var(--brand-primary)',
                color: 'var(--brand-on-primary)',
                fontSize: 8,
                letterSpacing: 2,
                fontWeight: 700,
                borderRadius: 3,
              }}
            >
              AWAITING DATA
            </div>
          </div>

          {/* Primary CTA button — canonical Pass 1 shape: dark bg + colored top stripe */}
          <button
            type="button"
            disabled
            style={{
              padding: 11,
              background: 'var(--brand-sidebar-bg)',
              borderTop: '3px solid var(--brand-primary)',
              border: 'none',
              borderRadius: 4,
              color: 'var(--brand-primary)',
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