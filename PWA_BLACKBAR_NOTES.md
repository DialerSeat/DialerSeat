# Welcome PWA black-bar fix

## Cause
iOS standalone PWA + apple-mobile-web-app-status-bar-style: black-translucent
+ viewport-fit=cover. With black-translucent, iOS does NOT reserve the status-bar
area — your page is supposed to paint behind it. The welcome screen's root is
position:fixed; inset:0, which on iOS sits at the safe-area boundary and leaves
the top inset UNPAINTED → black bar. It "disappears while scrolling" because the
rubber-band momentarily shifts content up into that region, then snaps back.

## Fix (two complementary, surgical changes in app/welcome/Showcase.tsx)
1. .sw-root::before — a fixed bar that paints exactly env(safe-area-inset-top)
   at the top in the page's own background color. Fills the previously-black inset.
2. html, body { background: var(--brand-sidebar-bg) } scoped to the welcome route
   (via its <style> tag) — covers any rubber-band overscroll gutter so it matches
   too. Reverts automatically when navigating away.

No layout math touched (the tuned transforms/safe-area paddings are untouched).
Type-checks clean.

## Verify on device
Open /welcome as an installed PWA on iPhone: the top status-bar area should now
match the dark page background (no black bar), and stay matched while scrolling.
If you ever want the status bar to be a SOLID color instead of translucent,
the alternative is switching apple-mobile-web-app-status-bar-style to 'default'
or 'black' in app/layout.tsx — but that reserves space and changes the edge-to-edge
look, so the paint-the-inset approach above keeps the current design.
