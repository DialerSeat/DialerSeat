import type { ReactNode } from 'react'






























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