// components/ThemeProvider.tsx
'use client'

import { createContext, useContext, useMemo } from 'react'
import type { TenantBranding } from '@/lib/tenant'

// =============================================================================
// THEME PROVIDER v7 — exact original-spec defaults for the no-tenant case
// =============================================================================
// v7 fixes a class of visual drift: Tier-2 tokens were being computed via
// color-mix() / pickContrastText() even when no tenant branding was
// present. The derivations produced values close to but not identical to
// JC's original palette (e.g. card surface computed as ~#dfe0e3 instead
// of the spec'd #e2e4ea; sidebar muted text as white at 65% alpha instead
// of the spec'd #8888aa; on-primary as #1a1c24 dark instead of #ffffff
// because WCAG pickContrastText returned dark for the default blue).
//
// v7 behavior:
//   - When initialBranding is null (regular dialerseat.com user, signed-
//     out, landing, admin), emit the EXACT hardcoded original-spec values
//     for every Tier-2 token.
//   - When initialBranding is present, derive Tier-2 tokens from Tier-1
//     via the existing color-mix + pickContrastText logic. Same behavior
//     as v6.
//
//   Net effect: default DialerSeat looks pixel-perfect to JC's spec.
//   Branded tenants (Preset 1-4 or custom) render identically to v6.
//
// Original-spec palette (no-tenant defaults):
//   Tier 1:
//     --brand-primary             #4a9eff
//     --brand-sidebar-bg          #111118
//     --brand-header-bg           #1a1a2e
//     --brand-page-bg             #f0f1f4
//   Tier 2 — primary family:
//     --brand-on-primary          #ffffff
//     --brand-primary-hover       (derived) — color-mix(primary 88%, black)
//     --brand-primary-soft        (derived) — primary at 12% alpha
//   Tier 2 — sidebar family:
//     --brand-on-sidebar          #ffffff
//     --brand-on-sidebar-muted    #8888aa
//     --brand-sidebar-active-bg   rgba(255,255,255,0.08)
//     --brand-sidebar-hover-bg    rgba(255,255,255,0.04)
//   Tier 2 — header family:
//     --brand-on-header           #ffffff
//     --brand-on-header-muted     #8888aa
//     --brand-header-top-accent   (= primary, always derived)
//   Tier 2 — page-bg family:
//     --brand-on-page-bg          #1a1c24
//     --brand-card-surface        #e2e4ea
//     --brand-card-border         #c4c8d0
//     --brand-muted-text          #5a5e6a
//
// Primary-hover, primary-soft, and header-top-accent stay derived even in
// the no-tenant case because they're mathematically dependent on primary
// (not specifically spec'd by JC). The derivations produce sensible
// values for #4a9eff.
//
// Header-bg fallback chain unchanged from v6:
//   - branding.header_bg_color valid → use it
//   - branding present but header_bg_color invalid → fall back to sidebar
//     (matches migration 004 backfill semantics)
//   - no branding → use DEFAULT_HEADER_BG
// =============================================================================

// Tier 1 defaults
const DEFAULT_PRIMARY = '#4a9eff'
const DEFAULT_SIDEBAR_BG = '#111118'
const DEFAULT_HEADER_BG = '#1a1a2e'
const DEFAULT_PAGE_BG = '#f0f1f4'

// Tier 2 hardcoded defaults — used only when no tenant branding present.
// Match JC's confirmed original DialerSeat spec exactly.
const DEFAULT_ON_PRIMARY = '#ffffff'
const DEFAULT_ON_SIDEBAR = '#ffffff'
const DEFAULT_ON_SIDEBAR_MUTED = '#8888aa'
const DEFAULT_SIDEBAR_ACTIVE_BG = 'rgba(255,255,255,0.08)'
const DEFAULT_SIDEBAR_HOVER_BG = 'rgba(255,255,255,0.04)'
const DEFAULT_ON_HEADER = '#ffffff'
const DEFAULT_ON_HEADER_MUTED = '#8888aa'
const DEFAULT_ON_PAGE_BG = '#1a1c24'
const DEFAULT_CARD_SURFACE = '#e2e4ea'
const DEFAULT_CARD_BORDER = '#c4c8d0'
const DEFAULT_MUTED_TEXT = '#5a5e6a'

const BrandingContext = createContext<TenantBranding | null>(null)

export function useBranding(): TenantBranding | null {
  return useContext(BrandingContext)
}

function pickContrastText(hex: string): string {
  const clean = (hex || '').replace('#', '').padEnd(6, '0').slice(0, 6)
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const luminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  return luminance > 0.18 ? '#1a1c24' : '#ffffff'
}

function isValidHex(c: string | null | undefined): c is string {
  return !!c && /^#[0-9a-fA-F]{6}$/.test(c)
}

export function ThemeProvider({
  initialBranding,
  children,
}: {
  initialBranding?: TenantBranding | null
  children: React.ReactNode
}) {
  const branding = initialBranding ?? null

  const cssVars = useMemo(() => {
    const hasBranding = !!branding

    // Tier 1 — user-picked, with fallback to defaults
    const primary = isValidHex(branding?.primary_color)
      ? (branding!.primary_color as string)
      : DEFAULT_PRIMARY
    const sidebar = isValidHex(branding?.sidebar_color)
      ? (branding!.sidebar_color as string)
      : DEFAULT_SIDEBAR_BG
    const headerBg = isValidHex(branding?.header_bg_color)
      ? (branding!.header_bg_color as string)
      : (hasBranding ? sidebar : DEFAULT_HEADER_BG)
    const pageBg = isValidHex(branding?.page_bg_color)
      ? (branding!.page_bg_color as string)
      : DEFAULT_PAGE_BG

    // Tier 2 — either derived (branded) or hardcoded original-spec (no branding)
    const onPrimary = hasBranding ? pickContrastText(primary) : DEFAULT_ON_PRIMARY
    const onSidebar = hasBranding ? pickContrastText(sidebar) : DEFAULT_ON_SIDEBAR
    const onHeader = hasBranding ? pickContrastText(headerBg) : DEFAULT_ON_HEADER
    const onPageBg = hasBranding ? pickContrastText(pageBg) : DEFAULT_ON_PAGE_BG

    const onSidebarMutedExpr = hasBranding
      ? `color-mix(in srgb, ${onSidebar} 65%, transparent)`
      : DEFAULT_ON_SIDEBAR_MUTED
    const sidebarActiveBgExpr = hasBranding
      ? `color-mix(in srgb, ${primary} 18%, transparent)`
      : DEFAULT_SIDEBAR_ACTIVE_BG
    const sidebarHoverBgExpr = hasBranding
      ? `color-mix(in srgb, ${primary} 9%, transparent)`
      : DEFAULT_SIDEBAR_HOVER_BG
    const onHeaderMutedExpr = hasBranding
      ? `color-mix(in srgb, ${onHeader} 65%, transparent)`
      : DEFAULT_ON_HEADER_MUTED
    const cardSurfaceExpr = hasBranding
      ? `color-mix(in srgb, ${pageBg} 92%, ${onPageBg} 8%)`
      : DEFAULT_CARD_SURFACE
    const cardBorderExpr = hasBranding
      ? `color-mix(in srgb, ${pageBg} 82%, ${onPageBg} 18%)`
      : DEFAULT_CARD_BORDER
    const mutedTextExpr = hasBranding
      ? `color-mix(in srgb, ${onPageBg} 60%, ${pageBg} 40%)`
      : DEFAULT_MUTED_TEXT

    return `:root {
  /* Tier 1 — user-picked (4) */
  --brand-primary: ${primary};
  --brand-sidebar-bg: ${sidebar};
  --brand-header-bg: ${headerBg};
  --brand-page-bg: ${pageBg};

  /* Tier 2 — primary family */
  --brand-on-primary: ${onPrimary};
  --brand-primary-hover: color-mix(in srgb, ${primary} 88%, black);
  --brand-primary-soft: color-mix(in srgb, ${primary} 12%, transparent);

  /* Tier 2 — sidebar family */
  --brand-on-sidebar: ${onSidebar};
  --brand-on-sidebar-muted: ${onSidebarMutedExpr};
  --brand-sidebar-active-bg: ${sidebarActiveBgExpr};
  --brand-sidebar-hover-bg: ${sidebarHoverBgExpr};

  /* Tier 2 — header family */
  --brand-on-header: ${onHeader};
  --brand-on-header-muted: ${onHeaderMutedExpr};
  --brand-header-top-accent: ${primary};

  /* Tier 2 — page-bg family */
  --brand-on-page-bg: ${onPageBg};
  --brand-card-surface: ${cardSurfaceExpr};
  --brand-card-border: ${cardBorderExpr};
  --brand-muted-text: ${mutedTextExpr};
}`
  }, [
    branding?.primary_color,
    branding?.sidebar_color,
    branding?.header_bg_color,
    branding?.page_bg_color,
  ])

  return (
    <BrandingContext.Provider value={branding}>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      {children}
    </BrandingContext.Provider>
  )
}