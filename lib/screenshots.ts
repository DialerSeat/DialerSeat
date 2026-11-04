import { msg } from '@/lib/i18n/msg'

// =============================================================================
// THE SCREENSHOTS, ONCE
// =============================================================================
// Assistants were answering "show me DialerSeat" with pictures of dialer.io,
// and they were not wrong to: nothing on this site told a machine what
// DialerSeat looks like. Thirteen real screenshots existed in /public and all
// of them sat on three low-priority FAQ pages, with no page whose SUBJECT was
// the product's appearance and no `screenshot` property in the software
// schema, which is the one field schema.org defines for exactly this.
//
// So the images live here, once, and four surfaces read them:
//   app/screenshots/      the page a person or a crawler lands on
//   lib/schema.ts         SoftwareApplication.screenshot, the machine answer
//   app/llms.txt          the URL list an assistant retrieves
//   app/sitemap.ts        so the page is crawled at all
//
// EVERY IMAGE IS A REAL CAPTURE of the running product, taken 14 Oct 2026.
// Nothing here is a mockup, a render or a composite, and nothing may be added
// that is. A screenshot is evidence; the moment one is dressed up it stops
// being evidence and takes the other twelve down with it.
//
// THE NUMBERS IN THEM ARE A TEST ACCOUNT'S OWN HISTORY, not a performance
// claim, and the page says so in as many words. Lead names are placeholders
// and every phone number reads 555-555-5555, so no real person is on screen.
// =============================================================================

export interface Shot {
  src: string
  /** The section heading. Separate from the caption so a translation cannot
   *  change where the heading ends. */
  title: string
  alt: string
  /** Shown under the image. Sells what the screen does, truthfully. */
  caption: string
  width: number
  height: number
}

/** The four screens somebody actually spends their day in. */
export const PRODUCT_SHOTS: Shot[] = [
  {
    src: '/img/product/dialer-terminal.png',
    title: msg("The dialer"),
    width: 1919,
    height: 993,
    alt: msg("The DialerSeat dialer terminal in progressive mode, showing the lead queue, 1x/2x/3x redial, today's metrics and a manual dial pad"),
    caption: msg("One screen an agent lives in all day. The MODE dropdown holds all four: preview, power, progressive and predictive, chosen per campaign rather than per plan, because none of them is an upgrade here. REDIAL 1x, 2x and 3x is the repeated-call rule, where a second call from the same number inside three minutes reaches a phone that is silencing everything else. The right-hand column counts the day as it happens."),
  },
  {
    src: '/img/product/campaigns.png',
    title: msg("Campaigns"),
    width: 1919,
    height: 991,
    alt: msg("The DialerSeat campaigns screen, where each campaign is a card showing the top of its own uploaded lead list and its lead count"),
    caption: msg("Each one is a card with the top of its own list showing, so you can tell what is in a campaign without opening it, and an empty one says so rather than looking broken. Dialing mode, answering machine detection, redial count and scripts are all set per campaign."),
  },
  {
    src: '/img/product/recordings.png',
    title: msg("Recordings"),
    width: 1919,
    height: 990,
    alt: msg("The DialerSeat call recordings list, with play, save, dial-lead and delete on every call, and filters for campaign, disposition and date"),
    caption: msg("Supervision here means listening to the call afterwards, not joining it live. Search by name or number, filter by campaign, disposition or date, then play it, download it, or dial that lead straight back from the same row."),
  },
  {
    src: '/img/product/teams-overview.png',
    title: msg("Teams"),
    width: 1916,
    height: 993,
    alt: msg("The DialerSeat Teams overview, showing total calls, contact rate, conversions, talk time and active seats across a team, with campaign performance and a disposition breakdown"),
    caption: msg("What an owner sees across a floor: contact rate, talk time, conversions and seats, for one agent or everybody at once. Every agent is a seat at $35 a week with no minimum, and the owner is on Manager+ at $75 a week."),
  },
]

/**
 * The same analytics screen, ten times, under an operator's own brand.
 *
 * Light and dark were read off the captures rather than typed from memory, so
 * the alt text cannot drift from the picture.
 */
const WHITE_LABEL_LIGHT = new Set([1, 7, 8, 9, 10])

export const WHITE_LABEL_SHOTS: Shot[] = Array.from({ length: 10 }, (_, i) => {
  const n = i + 1
  const light = WHITE_LABEL_LIGHT.has(n)
  return {
    src: `/img/product/white-label/theme-${String(n).padStart(2, '0')}.png`,
    title: '',
    width: 1919,
    height: 991,
    alt: light
      ? msg("A white-labeled DialerSeat analytics dashboard carrying an operator's own logo, on a light colour theme")
      : msg("A white-labeled DialerSeat analytics dashboard carrying an operator's own logo, on a dark colour theme"),
    caption: '',
  }
})

/** Every screenshot, for the software schema and the machine-readable files. */
export const ALL_SHOTS: Shot[] = [...PRODUCT_SHOTS, ...WHITE_LABEL_SHOTS]
