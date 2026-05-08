import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs';
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL('https://dialerseat.com'),
  title: "DialerSeat — Dial Smarter. Close Faster.",
  description: "The professional outbound dialer built for anyone who lives on the phone. $35/week. No contracts.",
  applicationName: 'DialerSeat',
  keywords: [
    'power dialer',
    'predictive dialer',
    'outbound dialer',
    'sales dialer',
    'insurance dialer',
    'real estate dialer',
    'auto dialer',
    'cold calling software',
    'lead dialer',
    'ReadyMode alternative',
  ],
  authors: [{ name: 'DialerSeat' }],
  creator: 'DialerSeat',
  publisher: 'DialerSeat',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'DialerSeat — Dial Smarter. Close Faster.',
    description: 'The professional outbound dialer built for anyone who lives on the phone. $35/week. No contracts.',
    url: 'https://dialerseat.com',
    siteName: 'DialerSeat',
    images: [
      { url: '/icon.svg', width: 64, height: 64, alt: 'DialerSeat' },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'DialerSeat — Dial Smarter. Close Faster.',
    description: 'The professional outbound dialer. $35/week. No contracts.',
    images: ['/icon.svg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}