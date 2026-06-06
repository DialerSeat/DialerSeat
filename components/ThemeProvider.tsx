// components/ThemeProvider.tsx
'use client'

import { createContext, useContext, useMemo } from 'react'
import type { TenantBranding } from '@/lib/tenant'

// =============================================================================
// THEME PROVIDER v5 — header/sidebar split (migration 004)
// =============================================================================
// Injects 18 CSS variables onto :root — 4 user-picked + 14 derived.
// Tenant branding is server-fetched in the root layout (via subdomain
// resolution in proxy/middleware) and passed in as initialBranding.
//
// Token tiers:
//
// Tier 1 — user-picked (4, DB-stored):
//   --brand-primary        buttons, accents, focus rings, AWAITING DATA
//                          pill, chart line, MANAGER+ badge, segmented
//                          active state, header top accent
//   --brand-sidebar-bg     sidebar background, primary button background
//   --brand-header-bg      header strip background (NEW v5)
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
//   Header family (NEW v5):
//     --brand-on-header            text/icon color on header strip
//     --brand-on-header-muted      same hue at 65% alpha (low-emphasis)
//     --brand-header-top-accent    primary (semantic: header accent line)
//   Page-bg family:
//     --brand-on-page-bg           body text color, auto-contrast picked
//     --brand-card-surface         page-bg shifted 8% toward on-page-bg
//     --brand-card-border          page-bg shifted 18% toward on-page-bg
//     --brand-muted-text           60% on-page-bg + 40% page-bg (low emphasis)
//
// Contrast picker (pickContrastText):
//   Computes WCAG relative luminance, returns true white (#ffffff) for
//   dark colors (L ≤ 0.18) or app-standard near-black (#1a1c24) for
//   lighter colors. Threshold tuned so mid-saturation primaries like
//   lavender (#b8a3e0), forest green (#5fb87a), and rose (#e8b8c5) all
//   correctly get dark text (the higher-contrast choice).
//
// Per JC's directive: "as long as text is subjected to automation or
// recommendation (true white or black) but if not its still fine" — we
// pick one of two extremes, never a mid-tone. #1a1c24 is the app's
// standard near-black used everywhere else, preserving visual consistency.
//
// Header-bg fallback: if branding.header_bg_color is missing or invalid
// hex (very old cached row from before migration 004), we fall back to
// the user's actual sidebar value — NOT to DEFAULT_SIDEBAR_BG. That
// matches how migration 004 backfilled existing rows (header_bg_color =
// sidebar_color) so unchanged tenants render identically.
// =============================================================================

const DEFAULT_PRIMARY = '#4a9eff'
const DEFAULT_SIDEBAR_BG = '#1a1c24'
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
    // Header-bg falls back to sidebar value (not the constant) if missing —
    // matches the migration 004 backfill behavior.
    const headerBg = isValidHex(branding?.header_bg_color)
      ? (branding!.header_bg_color as string)
      : sidebar
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

  /* Tier 2 — derived: header family (NEW v5) */
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