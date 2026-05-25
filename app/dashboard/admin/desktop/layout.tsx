import type { ReactNode } from 'react'

// =============================================================================
// /dashboard/admin/desktop — Layout
// =============================================================================
// The Win7-style admin shell takes over the full viewport. This layout
// explicitly removes any chrome that might bleed in from parent layouts:
//
//   1. <SiteHeader> is bypassed because this route is OUTSIDE the
//      <SiteHeader>-rendering parent (we render <main> only, no header).
//   2. v21 FIX: on mobile, the site-header was still showing through —
//      because something higher up the React tree (probably app/layout.tsx
//      or a Clerk/ClerkProvider wrapper) renders <SiteHeader> globally and
//      this layout never explicitly counteracted it.
//
//   The fix: this layout injects a <style> block that hard-hides any
//   element with class `site-header` whenever the desktop route is mounted.
//   The selector targets the existing component's outer <header className
//   ="site-header"> defined in components/site-header.tsx — so we can hide
//   it without modifying that component (which is shared with the rest of
//   the site, where it SHOULD render).
//
//   Same trick hides any `.ds-nav` or `.ds-nav-3col` from app/page.tsx in
//   case someone ever lands here via /?view=landing then back-navigates
//   into the admin and the nav stuck around.
//
//   3. We also lock body/html height + overflow so the desktop's fixed
//      taskbar + window manager get a true 100vh playground without the
//      mobile address bar reshape problem.
// =============================================================================

export default function AdminDesktopLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        /* Hide every flavor of site chrome whenever this layout is mounted */
        body > .site-header,
        body header.site-header,
        .site-header,
        body .ds-nav,
        body .ds-nav-3col {
          display: none !important;
        }

        /* Lock the viewport so the Win7 desktop owns the screen */
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          height: 100% !important;
          overflow: hidden !important;
          overscroll-behavior: none !important;
        }
        body {
          /* Prevent iOS Safari bounce that lets you see header behind */
          position: fixed !important;
          top: 0; left: 0; right: 0; bottom: 0;
          width: 100% !important;
        }
        #__next, [data-nextjs-scroll-focus-boundary] {
          height: 100% !important;
          overflow: hidden !important;
        }

        /* Belt-and-suspenders: hide ALL <header> tags at this layout level */
        body > header,
        #__next > header {
          display: none !important;
        }
      `}</style>
      {children}
    </>
  )
}