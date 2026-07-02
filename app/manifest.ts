import type { MetadataRoute } from 'next'






























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