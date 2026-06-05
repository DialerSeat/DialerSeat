'use client'

import { createContext, useContext, ReactNode } from 'react'
import type { TenantBranding } from '@/lib/tenant'

// =============================================================================
// THEME PROVIDER — v3 (Pass 2 Phase B2)
// =============================================================================
// Pass 2 changes vs v2:
//
//   v2 read 5 brand colors and injected --brand-primary, --brand-secondary,
//   --brand-surface, --brand-bg, --brand-text. Tenants could override all 5.
//
//   v3 reads 2 brand colors and injects 10 tokens total:
//     - 2 user-picked (--brand-primary, --brand-sidebar-bg)
//     - 8 derived (contrast text colors, hover variants, soft overlays)
//
//   The dropped tokens (--brand-secondary, --brand-bg, --brand-text) are
//   no longer overridden — they keep their globals.css defaults, which
//   matters for any landing-page code still binding to them. This is how
//   we honor "landing page stays the exact same" without route-gating.
//
// Token map (when a tenant is active):
//
//   Tier 1 (from DB):
//     --brand-primary               tenant's brand color
//     --brand-sidebar-bg            tenant's sidebar/header/button-bg color
//
//   Tier 2 (derived from Tier 1):
//     --brand-on-primary            contrast pick (white or dark) on primary
//     --brand-primary-hover         88% mix of primary toward black
//     --brand-primary-soft          12% primary on transparent (focus rings)
//     --brand-on-sidebar            contrast pick on sidebar bg
//     --brand-on-sidebar-muted      55% alpha version of on-sidebar
//     --brand-sidebar-active-bg     low-alpha overlay for active nav band
//     --brand-sidebar-hover-bg      half-alpha of active
//     --brand-header-top-accent     equals primary (the 2px accent strip)
//
// What is NEVER injected (kept as globals.css defaults always):
//
//   --brand-secondary, --brand-bg, --brand-text — vestigial Pass 1 tokens
//   that landing-page code may still reference. Pinned to DialerSeat
//   defaults so the landing page renders identically regardless of tenant.
//
//   --color-error, --color-success, --color-warning, all status pill
//   tokens, all disposition tokens, all KPI tile semantic colors — these
//   are GLOBAL by spec. Don't add token plumbing that lets tenants
//   override them.
// =============================================================================

const BrandingContext = createContext<TenantBranding | null>(null)

export function useBranding(): TenantBranding | null {
  return useContext(BrandingContext)
}

interface ThemeProviderProps {
  branding: TenantBranding | null
  children: ReactNode
}

// ─── Pure contrast helper (mirrors the copy in onboarding) ──────────────
// luminance > 0.55 → use dark text; else white text.
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

export function ThemeProvider({ branding, children }: ThemeProviderProps) {
  if (!branding) {
    return (
      <BrandingContext.Provider value={null}>
        {children}
      </BrandingContext.Provider>
    )
  }

  // Defensive defaults — if the underlying tenant_branding view hasn't
  // been updated to expose sidebar_color yet, fall back to Pass 1
  // dialerseat dark navy so the dashboard still renders something
  // sensible. Same safety on primary, even though primary has always
  // been present.
  const primaryColor = branding.primary_color || '#4a9eff'
  const sidebarBg = branding.sidebar_color || '#1a1a2e'

  const onPrimary = pickContrastText(primaryColor)
  const onSidebar = pickContrastText(sidebarBg)

  const sidebarTextMuted =
    onSidebar === '#ffffff' ? 'rgba(255,255,255,0.55)' : 'rgba(26,28,36,0.55)'
  const sidebarActiveBg =
    onSidebar === '#ffffff' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const sidebarHoverBg =
    onSidebar === '#ffffff' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'

  const cssVars = `
    :root {
      /* Tier 1 — user-picked (from DB) */
      --brand-primary: ${primaryColor};
      --brand-sidebar-bg: ${sidebarBg};

      /* Tier 2 — derived from Tier 1 */
      --brand-on-primary: ${onPrimary};
      --brand-primary-hover: color-mix(in srgb, ${primaryColor} 88%, black);
      --brand-primary-soft: color-mix(in srgb, ${primaryColor} 12%, transparent);
      --brand-on-sidebar: ${onSidebar};
      --brand-on-sidebar-muted: ${sidebarTextMuted};
      --brand-sidebar-active-bg: ${sidebarActiveBg};
      --brand-sidebar-hover-bg: ${sidebarHoverBg};
      --brand-header-top-accent: ${primaryColor};
    }
  `

  return (
    <>
      {/* Server-rendered <style> so brand colors are available before any
          client JS runs — no flash of unstyled content. */}
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <BrandingContext.Provider value={branding}>
        {children}
      </BrandingContext.Provider>
    </>
  )
}