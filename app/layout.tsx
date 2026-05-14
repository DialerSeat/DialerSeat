import type { Metadata, Viewport } from "next";
import { ClerkProvider } from '@clerk/nextjs';
import "./globals.css";
import StructuredData from './components/StructuredData';

export const metadata: Metadata = {
  metadataBase: new URL('https://dialerseat.com'),
  title: "DialerSeat — Dial Smarter. Close Faster.",
  description:
    "The professional outbound dialer built for solo agents up through larger teams. $35/week per seat. No contracts. Cancel anytime. Four dialer modes, automatic voicemail detection, inbound reception, unlimited numbers.",
  applicationName: 'DialerSeat',
  keywords: [
    // core category
    'power dialer',
    'predictive dialer',
    'progressive dialer',
    'preview dialer',
    'outbound dialer',
    'auto dialer',
    'sales dialer',
    'cold calling software',
    'lead dialer',
    'call center software',
    // vertical-specific
    'insurance dialer',
    'real estate dialer',
    'mortgage dialer',
    'solar sales dialer',
    'debt collection dialer',
    'SDR dialer',
    'B2B sales dialer',
    // competitor alternative terms (high-intent SEO)
    'ReadyMode alternative',
    'Mojo Dialer alternative',
    'PhoneBurner alternative',
    'Five9 alternative',
    'CallTools alternative',
    'Vicidial alternative',
    'cheap predictive dialer',
    'low cost dialer',
    'no contract dialer',
    // capability-driven queries
    'automatic voicemail detection',
    'AMD dialer',
    'TCPA compliant dialer',
    'mobile dialer',
    'browser dialer',
    'inbound outbound dialer',
    'team dialer',
    'multi seat dialer',
    'lead vendor dialer',
  ],
  authors: [{ name: 'DialerSeat' }],
  creator: 'DialerSeat',
  publisher: 'DialerSeat',
  manifest: '/manifest.json',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: [
      { url: '/icons/favicon.ico', sizes: 'any' },
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icons/favicon-64x64.png', sizes: '64x64', type: 'image/png' },
      { url: '/icons/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/icons/favicon.ico',
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/icons/apple-touch-icon-57x57.png', sizes: '57x57', type: 'image/png' },
      { url: '/icons/apple-touch-icon-60x60.png', sizes: '60x60', type: 'image/png' },
      { url: '/icons/apple-touch-icon-72x72.png', sizes: '72x72', type: 'image/png' },
      { url: '/icons/apple-touch-icon-76x76.png', sizes: '76x76', type: 'image/png' },
      { url: '/icons/apple-touch-icon-114x114.png', sizes: '114x114', type: 'image/png' },
      { url: '/icons/apple-touch-icon-120x120.png', sizes: '120x120', type: 'image/png' },
      { url: '/icons/apple-touch-icon-144x144.png', sizes: '144x144', type: 'image/png' },
      { url: '/icons/apple-touch-icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/apple-touch-icon-167x167.png', sizes: '167x167', type: 'image/png' },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/icons/safari-pinned-tab.svg',
        color: '#4a9eff',
      },
    ],
  },
  openGraph: {
    title: 'DialerSeat — Dial Smarter. Close Faster.',
    description:
      'The professional outbound dialer for solo agents up through larger teams. $35/week per seat. No contracts.',
    url: 'https://dialerseat.com',
    siteName: 'DialerSeat',
    images: [
      {
        url: '/icons/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DialerSeat — Dial Smarter. Close Faster.',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat — Dial Smarter. Close Faster.',
    description:
      'The professional outbound dialer. $35/week per seat. No contracts. Cancel anytime.',
    images: ['/icons/twitter-image.png'],
  },
  other: {
    // Microsoft tile configuration
    'msapplication-TileColor': '#4a9eff',
    'msapplication-TileImage': '/icons/mstile-144x144.png',
    'msapplication-config': '/browserconfig.xml',
    // Apple PWA hints
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'DialerSeat',
    'mobile-web-app-capable': 'yes',
    // Format detection — keep phone numbers as plain text in marketing copy
    'format-detection': 'telephone=no',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#4a9eff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0f' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

// iOS splash screens — every documented device size + orientation.
// Next.js doesn't have first-class metadata support for these, so we
// emit them via the head as raw <link> tags below.
const IOS_SPLASH_SCREENS: Array<{ w: number; h: number; orient: 'portrait' | 'landscape' }> = [
  { w: 640, h: 1136, orient: 'portrait' },
  { w: 750, h: 1334, orient: 'portrait' },
  { w: 828, h: 1792, orient: 'portrait' },
  { w: 1125, h: 2436, orient: 'portrait' },
  { w: 1170, h: 2532, orient: 'portrait' },
  { w: 1242, h: 2208, orient: 'portrait' },
  { w: 1242, h: 2688, orient: 'portrait' },
  { w: 1284, h: 2778, orient: 'portrait' },
  { w: 1290, h: 2796, orient: 'portrait' },
  { w: 1488, h: 2266, orient: 'portrait' },
  { w: 1536, h: 2048, orient: 'portrait' },
  { w: 1620, h: 2160, orient: 'portrait' },
  { w: 1668, h: 2224, orient: 'portrait' },
  { w: 1668, h: 2388, orient: 'portrait' },
  { w: 2048, h: 2732, orient: 'portrait' },
  // landscape
  { w: 1792, h: 828, orient: 'landscape' },
  { w: 2160, h: 1620, orient: 'landscape' },
  { w: 2208, h: 1242, orient: 'landscape' },
  { w: 2224, h: 1668, orient: 'landscape' },
  { w: 2266, h: 1488, orient: 'landscape' },
  { w: 2388, h: 1668, orient: 'landscape' },
  { w: 2436, h: 1125, orient: 'landscape' },
  { w: 2532, h: 1170, orient: 'landscape' },
  { w: 2688, h: 1242, orient: 'landscape' },
  { w: 2732, h: 2048, orient: 'landscape' },
  { w: 2778, h: 1242, orient: 'landscape' },
  { w: 2796, h: 1290, orient: 'landscape' },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          {/* iOS splash screens — emitted as raw <link> tags with the
              specific media query iOS expects. The `device-width` and
              `device-height` values below correspond to the unscaled
              CSS pixel dimensions of each device. */}
          {IOS_SPLASH_SCREENS.map(({ w, h, orient }) => {
            // iOS expects splash images in physical (retina) pixels, but
            // the media query uses CSS pixels — divide by the device's
            // pixel ratio. For modern devices that's 2x or 3x. We emit
            // the link with the raw retina dimensions in the href and
            // let iOS pick the matching one via the media query below.
            const media =
              `(device-width: ${Math.round(w / 2)}px) and ` +
              `(device-height: ${Math.round(h / 2)}px) and ` +
              `(-webkit-device-pixel-ratio: 2) and ` +
              `(orientation: ${orient})`;
            return (
              <link
                key={`${w}x${h}-${orient}`}
                rel="apple-touch-startup-image"
                href={`/icons/apple-splash-${w}x${h}.png`}
                media={media}
              />
            );
          })}
        </head>
        <body>
          {/* JSON-LD structured data — must be inside <body> in the
              App Router. Google reads it from anywhere on the page. */}
          <StructuredData />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}