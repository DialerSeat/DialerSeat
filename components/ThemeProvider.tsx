'use client'

import { createContext, useContext, ReactNode } from 'react'
import type { TenantBranding } from '@/lib/tenant'

// =============================================================================
// THEME PROVIDER — v2 (Phase D2 foundation)
// =============================================================================
// Strategy change vs v1:
//
// Previously this component injected --brand-* CSS variables and individual
// pieces of code had to opt-in by writing var(--brand-primary) etc.
//
// Now we lean on globals.css. The semantic tokens (--surface, --background,
// --text-primary, --border, etc.) are ALREADY defined there in terms of
// --brand-* primitives via color-mix. So all we need to do here is override
// the --brand-* values at runtime. Everything else updates automatically.
//
// Result:
//   - No code change needed to existing components that already use
//     --surface, --background, --text-primary, --border, etc.
//   - Components that want direct access to a specific brand color can
//     read --brand-primary, --brand-surface, etc.
//   - Tenant chooses 5 colors in onboarding → those become CSS variables
//     → entire app re-themes.
//
// IMPORTANT: white-label tenants must NEVER override the semantic status
// colors (--color-error, --color-success, --color-warning). Errors are
// always red, success always green. Those stay platform defaults.
// =============================================================================

const BrandingContext = createContext<TenantBranding | null>(null)

export function useBranding(): TenantBranding | null {
  return useContext(BrandingContext)
}

interface ThemeProviderProps {
  branding: TenantBranding | null
  children: ReactNode
}

export function ThemeProvider({ branding, children }: ThemeProviderProps) {
  if (!branding) {
    return (
      <BrandingContext.Provider value={null}>
        {children}
      </BrandingContext.Provider>
    )
  }

  // Map tenant color columns → CSS brand variables.
  // NOTE: the DB schema has `accent_color` which we semantically reinterpret
  // as the SURFACE color in v2. Phase B onboarding originally labeled it
  // "accent" but its actual usage is the dark plate underneath everything.
  // No DB migration needed — only the meaning changed.
  const cssVars = `
    :root {
      --brand-primary: ${branding.primary_color};
      --brand-secondary: ${branding.secondary_color};
      --brand-surface: ${branding.accent_color};
      --brand-bg: ${branding.background_color};
      --brand-text: ${branding.text_color};
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