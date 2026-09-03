import { Jost, Inter } from 'next/font/google'














export const jost = Jost({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-jost',
  display: 'swap',
})

// =============================================================================
// INTER — the directory hubs (/vs, /faq)
// =============================================================================
// The site asks for 'Futura PT' and never loads it. There is no @font-face
// anywhere in the repo and no stylesheet link, so the only visitors who have
// ever seen Futura are the ones with it installed locally — designers with
// Adobe CC, and nobody else. Every other visitor has been reading the bare
// `sans-serif` fallback: Arial on Windows, Helvetica on a Mac.
//
// That is why the mockup for these pages does not look like the rest of the
// site. It was rendered on a machine without Futura, so it shows what the site
// actually ships. Inter is that fallback done deliberately — the same
// neo-grotesque proportions, self-hosted by next/font so it renders the same
// for everybody, on the same 400–900 range the hubs use.
//
// Scoped to /vs and /faq on purpose. Loading it site-wide is a bigger decision
// than a layout rebuild should make quietly.
// =============================================================================
export const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
})