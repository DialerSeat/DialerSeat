// =============================================================================
// ADMIN DESKTOP LAYOUT
// =============================================================================
// Route-scoped layout for /dashboard/admin/desktop. Renders children with no
// chrome — no site-header, no sidebar, nothing. The Desktop component owns
// the entire viewport from top to bottom.
//
// We disable scrolling on body via a style tag because the desktop uses
// position: fixed everywhere and any inherited scroll behavior would create
// rubber-banding on mobile.
// =============================================================================

export default function AdminDesktopLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <style>{`
        /* Lock viewport while on the desktop route */
        html, body { margin: 0; padding: 0; overflow: hidden; height: 100%; }
        /* Prevent iOS rubber-band scroll */
        body { overscroll-behavior: none; -webkit-overflow-scrolling: auto; }
        /* Disable text selection on the desktop chrome (apps re-enable it) */
        .ds-admin-desktop-root { user-select: none; -webkit-user-select: none; }
        /* Allow text selection inside open app windows */
        .ds-admin-desktop-root [role="dialog"] { user-select: text; -webkit-user-select: text; }
      `}</style>
      <div className="ds-admin-desktop-root">
        {children}
      </div>
    </>
  )
}