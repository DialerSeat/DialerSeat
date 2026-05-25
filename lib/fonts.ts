import { Jost } from 'next/font/google'

// =============================================================================
// FONT LOADERS
// =============================================================================
// Centralized next/font loaders so any component can pull a font without
// re-declaring the loader (which would trigger duplicate fetches at build).
//
// USAGE:
//   import { jost } from '@/lib/fonts'
//   <span className={jost.className}>DialerSeat</span>
//   // or, for inline style:
//   <span style={{ fontFamily: jost.style.fontFamily }}>DialerSeat</span>
// =============================================================================

export const jost = Jost({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-jost',
  display: 'swap',
})