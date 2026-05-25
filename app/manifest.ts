import type { MetadataRoute } from 'next'

// =============================================================================
// PWA MANIFEST
// =============================================================================
// Served at /manifest.webmanifest. Required for the "Add to Home Screen"
// install prompt on Android Chrome and the proper PWA install experience.
//
// iOS Safari historically allowed "Add to Home Screen" for any site
// regardless of manifest; iOS 16.4+ also honors manifest fields like
// `display: standalone` and `theme_color`. So this manifest improves the
// iOS experience too, just not as dramatically.
//
// Required by Chrome's install criteria:
//   - name + short_name
//   - icons at 192x192 AND 512x512 (we serve both from /public/)
//   - start_url
//   - display: standalone or fullscreen
//   - 200 response served over HTTPS
//
// Optional but recommended:
//   - theme_color matches the dark UI chrome
//   - background_color shown during splash
//   - id for unique install identity
//
// FUTURE: white-label tenants will want their own manifest with their
// branding. When that happens, replace this with a `route.ts` that reads
// the host header and returns tenant-specific manifest. For now, single
// manifest for all hosts.
// =============================================================================

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DialerSeat',
    short_name: 'DialerSeat',
    description:
      'Professional outbound dialer. $35/week per seat. No contracts.',
    start_url: '/',
    id: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0a0a14',
    theme_color: '#0a0a14',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}