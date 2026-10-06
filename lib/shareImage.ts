import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

// =============================================================================
// SHARE IMAGES — the picture in a link preview, one per page and language
// =============================================================================
// Before this, 141 of 143 English pages declared a large-image card and gave
// no image: a page's own openGraph object replaces the layout's, images and
// all, and none of the pages set one. The homepage's file-based image 404'd
// behind the auth middleware. So a DialerSeat link pasted into an Instagram
// DM, iMessage, LinkedIn or X previewed as bare text. For a business whose
// sales start in DMs, that preview is the first thing a prospect sees.
//
// Every page now gets an image at /og carrying its own title. The title rides
// in the URL, so it is signed: /og renders the title only when the signature
// matches, and the plain brand card otherwise. Without that, anyone could mint
// dialerseat.com images saying whatever they liked.
//
// Arabic gets the brand card: the image font has no Arabic glyphs, and the
// image renderer does not shape right-to-left script.
// =============================================================================

const APEX = 'https://dialerseat.com'

function secret(): string | null {
  return process.env.OG_IMAGE_SECRET || process.env.CRON_SECRET || null
}

/** "Mojo Dialer Alternative: Pricing | DialerSeat" → "Mojo Dialer Alternative: Pricing". */
export function shareTitle(title: string): string {
  return title
    .replace(/\s*[|·–—-]\s*DialerSeat\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

export function signShareTitle(title: string): string | null {
  const s = secret()
  if (!s) return null
  return createHmac('sha256', s).update(`og:${title}`).digest('base64url').slice(0, 22)
}

export function verifyShareTitle(title: string, sig: string): boolean {
  const expected = signShareTitle(title)
  if (!expected || expected.length !== sig.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
}

/** Absolute URL of the share image for a page title in a language. */
export function shareImageUrl(title: string | null | undefined, locale = 'en'): string {
  if (!title || locale === 'ar') return `${APEX}/og`
  const t = shareTitle(title)
  const sig = t ? signShareTitle(t) : null
  if (!t || !sig) return `${APEX}/og`
  return `${APEX}/og?t=${encodeURIComponent(t)}&s=${sig}`
}
