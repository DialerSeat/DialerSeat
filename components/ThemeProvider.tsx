// components/ThemeProvider.tsx
'use client'

import { createContext, useContext, useMemo } from 'react'
import type { TenantBranding } from '@/lib/tenant'

// =============================================================================
// THEME PROVIDER v6 — restore original DialerSeat default palette
// =============================================================================
// Injects 18 CSS variables onto :root — 4 user-picked + 14 derived.
// Tenant branding is server-fetched in the root layout (via subdomain
// resolution in proxy/middleware) and passed in as initialBranding.
//
// Token tiers:
//
// Tier 1 — user-picked (4, DB-stored):
//   --brand-primary        buttons, accents, focus rings, MANAGER+ badge,
//                          segmented active state, header top accent
//   --brand-sidebar-bg     sidebar background, primary button background,
//                          analytics AWAITING DATA pills
//   --brand-header-bg      header strip background (the bar at top of each
//                          dashboard page, distinct from sidebar)
//   --brand-page-bg        dashboard page body bg
//
// Tier 2 — derived (14, computed here):
//   Primary family:
//     --brand-on-primary           text/icon color on primary surfaces
//     --brand-primary-hover        primary mixed 88% with black
//     --brand-primary-soft         primary mixed 12% with transparent
//   Sidebar family:
//     --brand-on-sidebar           text/icon color on sidebar
//     --brand-on-sidebar-muted     same hue at 65% alpha (low-emphasis)
//     --brand-sidebar-active-bg    primary at 18% over sidebar (active nav)
//     --brand-sidebar-hover-bg     primary at 9% over sidebar (hover)
//   Header family:
//     --brand-on-header            text/icon color on header strip
//     --brand-on-header-muted      same hue at 65% alpha (low-emphasis)
//     --brand-header-top-accent    primary (semantic: header accent line)
//   Page-bg family:
//     --brand-on-page-bg           body text color, auto-contrast picked
//     --brand-card-surface         page-bg shifted 8% toward on-page-bg
//     --brand-card-border          page-bg shifted 18% toward on-page-bg
//     --brand-muted-text           60% on-page-bg + 40% page-bg (low emphasis)
//
// v6 — DEFAULT VALUES RESTORED (vs v5):
//   DEFAULT_SIDEBAR_BG  #1a1c24 → #111118  (the original darker sidebar)
//   DEFAULT_HEADER_BG   NEW = #1a1a2e      (distinct from sidebar)
//
// Header-bg fallback semantics:
//   - branding has valid header_bg_color → use it
//   - branding present but header_bg_color invalid/missing → fall back to
//     sidebar (preserves migration 004 backfill, which set
//     header_bg_color = sidebar_color on every existing tenant row so they
//     keep looking like they did before the 4-color split)
//   - branding null (no tenant — landing, signed-out, admin) → use
//     DEFAULT_HEADER_BG so default DialerSeat shows the two-shade chrome
//
// Contrast picker (pickContrastText): WCAG relative luminance, returns
// #ffffff for dark colors (L ≤ 0.18) or #1a1c24 (app near-black) for
// lighter ones. Threshold tuned so mid-saturation primaries like lavender
// (#b8a3e0), forest (#5fb87a), rose (#e8b8c5) correctly get dark text.
// =============================================================================

const DEFAULT_PRIMARY = '#4a9eff'
const DEFAULT_SIDEBAR_BG = '#111118'  // v6 — was '#1a1c24', restored to original
const DEFAULT_HEADER_BG = '#1a1a2e'   // v6 — NEW; distinct from sidebar default
const DEFAULT_PAGE_BG = '#f0f1f4'

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
    const primary = isValidHex(branding?.primary_color)
      ? (branding!.primary_color as string)
      : DEFAULT_PRIMARY
    const sidebar = isValidHex(branding?.sidebar_color)
      ? (branding!.sidebar_color as string)
      : DEFAULT_SIDEBAR_BG
    // Header-bg fallback chain:
    //   1. Use branding.header_bg_color if valid
    //   2. Else if branding object is present (tenant active but header_bg
    //      somehow missing — shouldn't happen post-migration-004 backfill,
    //      but defensive), use sidebar to preserve their look
    //   3. Else (no tenant at all), use DEFAULT_HEADER_BG — restores the
    //      two-shade DialerSeat default chrome (#111118 sidebar /
    //      #1a1a2e header)
    const headerBg = isValidHex(branding?.header_bg_color)
      ? (branding!.header_bg_color as string)
      : (branding ? sidebar : DEFAULT_HEADER_BG)
    const pageBg = isValidHex(branding?.page_bg_color)
      ? (branding!.page_bg_color as string)
      : DEFAULT_PAGE_BG

    const onPrimary = pickContrastText(primary)
    const onSidebar = pickContrastText(sidebar)
    const onHeader = pickContrastText(headerBg)
    const onPageBg = pickContrastText(pageBg)

    return `:root {
  /* Tier 1 — user-picked (4) */
  --brand-primary: ${primary};
  --brand-sidebar-bg: ${sidebar};
  --brand-header-bg: ${headerBg};
  --brand-page-bg: ${pageBg};

  /* Tier 2 — derived: primary family */
  --brand-on-primary: ${onPrimary};
  --brand-primary-hover: color-mix(in srgb, ${primary} 88%, black);
  --brand-primary-soft: color-mix(in srgb, ${primary} 12%, transparent);

  /* Tier 2 — derived: sidebar family */
  --brand-on-sidebar: ${onSidebar};
  --brand-on-sidebar-muted: color-mix(in srgb, ${onSidebar} 65%, transparent);
  --brand-sidebar-active-bg: color-mix(in srgb, ${primary} 18%, transparent);
  --brand-sidebar-hover-bg: color-mix(in srgb, ${primary} 9%, transparent);

  /* Tier 2 — derived: header family */
  --brand-on-header: ${onHeader};
  --brand-on-header-muted: color-mix(in srgb, ${onHeader} 65%, transparent);
  --brand-header-top-accent: ${primary};

  /* Tier 2 — derived: page-bg family */
  --brand-on-page-bg: ${onPageBg};
  --brand-card-surface: color-mix(in srgb, ${pageBg} 92%, ${onPageBg} 8%);
  --brand-card-border: color-mix(in srgb, ${pageBg} 82%, ${onPageBg} 18%);
  --brand-muted-text: color-mix(in srgb, ${onPageBg} 60%, ${pageBg} 40%);
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