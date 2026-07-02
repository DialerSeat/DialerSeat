'use client'

import type { CSSProperties } from 'react'




















const FUTURA = `'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif`
const DEFAULT_PAGE_BG = '#f0f1f4'




const AWAITING_DATA_BG = '#2f2e44'
const AWAITING_DATA_FG = '#ffffff'

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
  const resolvedHeaderBg = headerBg ?? sidebar

  const onPrimary = pickContrastText(primary)
  const onSidebar = pickContrastText(sidebar)
  const onHeader = pickContrastText(resolvedHeaderBg)
  const onPageBg = pickContrastText(pageBg)

  const cardSurface = `color-mix(in srgb, ${pageBg} 92%, ${onPageBg} 8%)`
  const cardBorder = `color-mix(in srgb, ${pageBg} 82%, ${onPageBg} 18%)`
  const mutedText = `color-mix(in srgb, ${onPageBg} 60%, ${pageBg} 40%)`

  const sidebarTextMuted = `color-mix(in srgb, ${onSidebar} 65%, transparent)`
  const sidebarActiveBg = `color-mix(in srgb, ${primary} 18%, transparent)`

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

        <div
          style={{
            flex: 1,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
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

          {/* Chart placeholder with AWAITING DATA pill — v6: pill uses the
              FIXED sitewide empty-state color, NOT the tenant primary, so the
              preview matches the real analytics dashboard for every tenant. */}
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
                background: AWAITING_DATA_BG,
                color: AWAITING_DATA_FG,
                fontSize: 8,
                letterSpacing: 2,
                fontWeight: 700,
                borderRadius: 3,
              }}
            >
              AWAITING DATA
            </div>
          </div>

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