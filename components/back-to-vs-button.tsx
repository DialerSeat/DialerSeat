'use client'
import Link from 'next/link'

/**
 * Floating button placed at top-left of each individual /vs/<slug> page.
 * Returns the user to /vs — the hub showing all comparison pages as cards.
 *
 * Positioned `fixed` so it stays visible while scrolling.
 * Sits below the SiteHeader (~64px tall) so it doesn't overlap.
 *
 * Usage in any /vs view:
 *   import BackToVsButton from '@/components/back-to-vs-button'
 *   <BackToVsButton />
 *
 * Do NOT include this on /vs itself — that page IS the hub.
 *
 * HISTORY: Earlier version pointed to /vs/everyone (a comparison page,
 * not the hub). Updated to /vs once the proper VsHubView component shipped.
 */
export default function BackToVsButton() {
  return (
    <Link
      href="/vs"
      style={{
        position: 'fixed',
        top: 80,
        left: 16,
        zIndex: 40,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        background: 'rgba(255, 255, 255, 0.92)',
        border: '1px solid rgba(0, 0, 0, 0.12)',
        borderRadius: 100,
        color: '#1a1c24',
        fontSize: 11,
        letterSpacing: 2,
        fontWeight: 'bold',
        textDecoration: 'none',
        fontFamily: 'Futura PT, Futura, sans-serif',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        transition: 'all 0.15s ease',
      }}
      className="back-to-vs-btn"
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>←</span>
      ALL COMPARISONS
      <style>{`
        .back-to-vs-btn:hover {
          background: rgba(255, 255, 255, 1) !important;
          border-color: rgba(74, 158, 255, 0.5) !important;
          color: #2a4a8a !important;
        }
        @media (max-width: 768px) {
          .back-to-vs-btn {
            top: 72px !important;
            left: 10px !important;
            padding: 6px 11px !important;
            font-size: 10px !important;
          }
        }
      `}</style>
    </Link>
  )
}