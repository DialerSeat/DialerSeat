'use client'

import { createContext, useContext, ReactNode } from 'react'
import type { TenantBranding } from '@/lib/tenant'

// =============================================================================
// THEME PROVIDER — CSS variables + React context for tenant branding
// =============================================================================
// Two responsibilities:
//   1. Inject CSS variables (--brand-primary, etc.) at the document root so
//      any component can use them via Tailwind arbitrary values or inline
//      styles. e.g. style={{ background: 'var(--brand-bg)' }}
//   2. Provide BrandingContext so React components can read brand_name,
//      logo_url, etc. via the useBranding() hook.
//
// When no branding is passed (the default DialerSeat experience), the
// provider passes null through the context — components fall back to their
// hardcoded defaults. This means white-label is purely additive: no existing
// component breaks if we never wrap it.
//
// Why a client component:
//   The context provider has to be a client component because useContext
//   only runs on the client. The CSS variable injection happens in the
//   server-rendered HTML stream via the <style> tag, so there's no flash
//   of unstyled content — variables are available before React hydrates.
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
  // No branding → pass-through. Existing DialerSeat behavior unchanged.
  if (!branding) {
    return (
      <BrandingContext.Provider value={null}>
        {children}
      </BrandingContext.Provider>
    )
  }

  // Build the CSS variable block. We use a small set of named tokens so
  // components can opt-in to theming via Tailwind arbitrary values or
  // inline styles. Components that don't reference these tokens get the
  // standard DialerSeat appearance even on a tenant subdomain — which is
  // fine for v1.
  //
  // Variable naming: --brand-* prefix to avoid collisions with any other
  // CSS systems (Tailwind's --color-*, shadcn/ui's --primary, etc.).
  const cssVars = `
    :root {
      --brand-primary: ${branding.primary_color};
      --brand-secondary: ${branding.secondary_color};
      --brand-accent: ${branding.accent_color};
      --brand-bg: ${branding.background_color};
      --brand-text: ${branding.text_color};
    }
  `

  return (
    <>
      {/* Injected as a server-rendered <style> tag so vars are available
          before any client JS runs. No flash, no flicker. */}
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <BrandingContext.Provider value={branding}>
        {children}
      </BrandingContext.Provider>
    </>
  )
}