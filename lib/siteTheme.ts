// =============================================================================
// THE MARKETING SITE'S DESIGN TOKENS, TAKEN FROM THE LANDING PAGE
// =============================================================================
// Every value here was read out of app/page.tsx rather than invented, because
// the landing page is the design that exists and the rest of the site is what
// drifted from it.
//
// THE DRIFT WAS NOT SUBTLE. The landing page is LIGHT — #f0f1f4 ground, near
// black type — and /vs and /faq were built dark, #0a0a14 with white type. Not
// a different accent or a looser grid: the inverse. A visitor going from the
// homepage to /vs/readymode was not moving through one site, and no amount of
// matching the spacing would have hidden that.
//
// The one thing already shared was the accent blue, #4a9eff, on both sides.
// Everything else inverts.
//
// WHY A MODULE AND NOT A STYLESHEET. These are consumed inside template
// literals in `<style>` blocks (`${T.text}`), which is how every page on this
// site already writes CSS. A .css file would mean two systems.
// =============================================================================

export const SITE = {
  /** Page ground. `--brand-page-bg` falls back to this for white-label tenants. */
  bg: '#f0f1f4',
  /** Cards, panels, anything raised off the ground. */
  surface: '#ffffff',
  /** Hairlines and card edges. */
  border: '#c4c8d0',
  /** The softer of the two borders — dividers rather than containers. */
  borderSoft: '#e2e4ea',
  /** Body and headline type. Near black, never pure. */
  text: '#1a1c24',
  /** Secondary type. Everything that is not the point of the sentence. */
  muted: '#5a5e6a',
  /** The accent. Buttons, links, numbers worth looking at. */
  blue: '#4a9eff',
  /**
   * The deep blue the landing page uses for the SECOND line of a headline.
   *
   * This is the site's one real signature move — "DIAL SMARTER." in near black
   * over "CLOSE FASTER." in deep blue. Two-tone headlines are why the homepage
   * reads as designed rather than assembled, and they are the single most
   * worthwhile thing to carry onto every other page.
   */
  deep: '#2a4a8a',
  /** Caution, tier-gating, "we could not confirm this". */
  amber: '#8a6a1a',
  green: '#1a6a1a',
  red: '#8a1a1a',
  /**
   * Dark contrast panels INSIDE a light page — the stat bar under the hero.
   * Used sparingly and on purpose; it is the exception that makes the light
   * ground read as deliberate rather than default.
   */
  ink: '#0e0e16',
  inkText: '#ffffff',
} as const

/**
 * Type scale, matching the :root custom properties on the landing page.
 * Article pages step down from the hero sizes — an 86px headline is right
 * above a product showcase and wrong above a paragraph of prose.
 */
export const SITE_TYPE = {
  hero: '86px',
  section: '48px',
  cta: '52px',
  /** Article h1. Large, but not landing-hero large. */
  articleH1: '52px',
  articleH2: '32px',
  articleH3: '20px',
  body: '16.5px',
} as const

/**
 * The button treatment, which is the landing page's other signature.
 *
 * A 1px border all round with a 3px top edge. It reads as a physical key and
 * it is instantly recognisable, so any button elsewhere on the site that omits
 * it looks like it came from a different product.
 */
export const SITE_BUTTON = {
  borderWidth: '1px',
  topBorderWidth: '3px',
  radius: '6px',
  padding: '13px 26px',
  fontSize: '12px',
  letterSpacing: '3px',
} as const

/** Section rhythm. `.ds-section { padding: 90px 60px }` on the landing page. */
export const SITE_SPACE = {
  sectionY: '90px',
  sectionX: '60px',
  sectionYMobile: '56px',
  sectionXMobile: '20px',
  /** Prose measure. Narrower than the landing grid: this is reading, not scanning. */
  articleWidth: '860px',
  /** Comparison pages, which are tables scanned across rather than prose. */
  wideWidth: '1080px',
} as const
