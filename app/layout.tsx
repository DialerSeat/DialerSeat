import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs';
import "./globals.css";

export const metadata: Metadata = {
  title: "DialerSeat — Dial Smarter. Close Faster.",
  description: "The professional outbound dialer built for anyone who lives on the phone. $35/week. No contracts.",
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