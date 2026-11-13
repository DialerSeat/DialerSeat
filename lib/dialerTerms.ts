// =============================================================================
// lib/dialerTerms.ts: the contract-terms study behind /data/dialer-contract-terms
// =============================================================================
// Five questions asked of every dialer in lib/competitors.ts, answered only from
// the vendor's own pricing page or FAQ, read on TERMS_CHECKED:
//
//   price      does the site show a price, or only a quote or demo form?
//   shortest   the shortest commitment it sells
//   yearCheaper does paying for a year buy a lower price?
//   minimum    the smallest number of seats a published plan allows
//   fee        a one-time fee the page says is required
//
// A field the page does not state stays null and renders as "Not stated". An
// absence is never filled in from a review site, a reseller or memory: the
// study is built to be checked, and every row links the page it came from.
//
// Two dialers in the registry are left out, and the page says why: DialedIn
// has no vendor site we could find, and VICIdial is free software whose
// hosting nobody publishes a price for.
//
// The headline counts on the page are computed from these rows, never typed.
// =============================================================================

import { msg } from '@/lib/i18n/msg'

export const TERMS_CHECKED = '2026-11-13'

export type Shortest = 'month' | 'three-months' | 'year' | 'quote'

export interface DialerTerms {
  slug: string
  price: 'published' | 'quote'
  /** null when the page does not say. */
  shortest: Shortest | null
  /** true when paying a year up front buys a lower rate; null when not stated. */
  yearCheaper: boolean | null
  /** Smallest seat count on a published plan; null when not stated. */
  minimum: number | null
  /** A required one-time fee, as the page states it; null when none is stated. */
  fee: string | null
  /** One sentence a reader can check on the source page. */
  note: string
  source: string
}

export const SHORTEST_LABEL: Record<Shortest, string> = {
  month: msg("A month"),
  'three-months': msg("Three months"),
  year: msg("A year"),
  quote: msg("Set in the quote"),
}

export const LEFT_OUT = [
  { name: 'DialedIn', why: msg("No vendor site we could find; the address that carries its name is an unrelated newsletter.") },
  { name: 'VICIdial', why: msg("Free, open-source software. VICIhost, its official host, publishes no price on its site.") },
]

export const DIALER_TERMS: DialerTerms[] = [
  { slug: 'readymode', price: 'published', shortest: 'month', yearCheaper: true, minimum: 1, fee: null,
    note: msg("Setup fee waived. Annual plans are paid up front for 12 months and renew automatically."),
    source: 'https://readymode.com/demo/pricing-readymode/' },
  { slug: 'mojo', price: 'published', shortest: 'month', yearCheaper: false, minimum: 1, fee: null,
    note: msg("Prepaid monthly, with no long-term contract, setup fee or cancellation penalty."),
    source: 'https://www.mojosells.com/pricing/' },
  { slug: 'phoneburner', price: 'published', shortest: 'month', yearCheaper: true, minimum: 1, fee: null,
    note: msg("Standard is $165 a user billed monthly, or $140 a month billed annually."),
    source: 'https://www.phoneburner.com/pricing' },
  { slug: 'five9', price: 'published', shortest: null, yearCheaper: null, minimum: 50, fee: null,
    note: msg("Core is $159 per concurrent seat per month, with a minimum of 50 seats."),
    source: 'https://www.five9.com/products/pricing' },
  { slug: 'convoso', price: 'quote', shortest: 'quote', yearCheaper: true, minimum: null, fee: null,
    note: msg("Its pricing FAQ says it primarily sells annual plans, currently 20% off."),
    source: 'https://www.convoso.com/pricing/' },
  { slug: 'batchdialer', price: 'published', shortest: 'month', yearCheaper: true, minimum: 1, fee: null,
    note: msg("Starter is $119 a month per agent, or $95 a month when the year is paid up front."),
    source: 'https://batchdialer.com/pricing' },
  { slug: 'wavv', price: 'published', shortest: 'month', yearCheaper: true, minimum: 1, fee: null,
    note: msg("Sold monthly, quarterly or annually, with discounts from five seats."),
    source: 'https://www.wavv.com/plans' },
  { slug: 'kixie', price: 'quote', shortest: 'quote', yearCheaper: null, minimum: null, fee: null,
    note: msg("No price on its plans page; it offers a 7-day free trial."),
    source: 'https://www.kixie.com/pricing/' },
  { slug: 'orum', price: 'quote', shortest: null, yearCheaper: null, minimum: 9, fee: null,
    note: msg("Its pricing page states a nine-seat minimum and asks you to request a price."),
    source: 'https://www.orum.com/pricing' },
  { slug: 'justcall', price: 'published', shortest: 'month', yearCheaper: true, minimum: 2, fee: null,
    note: msg("At least two licences; Team is $39 a user billed monthly, $29 billed annually."),
    source: 'https://justcall.io/pricing/' },
  { slug: 'cloudtalk', price: 'published', shortest: 'month', yearCheaper: true, minimum: 1, fee: null,
    note: msg("Starter and Essential can be bought one seat at a time; Expert needs at least three licences."),
    source: 'https://www.cloudtalk.io/pricing/' },
  { slug: 'aircall', price: 'published', shortest: 'month', yearCheaper: true, minimum: 3, fee: null,
    note: msg("Essentials and Professional need at least three users; paying annually saves 25%."),
    source: 'https://aircall.io/pricing/' },
  { slug: 'dialpad', price: 'published', shortest: 'month', yearCheaper: true, minimum: 1, fee: null,
    note: msg("Monthly or annual; its contact-center Premium plan is sold annually only."),
    source: 'https://www.dialpad.com/pricing/' },
  { slug: 'ringcentral', price: 'published', shortest: 'month', yearCheaper: true, minimum: 1, fee: null,
    note: msg("Paying annually saves up to 33%; RingCX, where the dialer is, starts at $65 a user."),
    source: 'https://www.ringcentral.com/office/plansandpricing.html' },
  { slug: 'smrtphone', price: 'published', shortest: 'month', yearCheaper: true, minimum: 1, fee: null,
    note: msg("Yearly billing gives two months free; the dialer is an add-on."),
    source: 'https://www.smrtphone.io/pricing/' },
  { slug: 'aloware', price: 'published', shortest: 'month', yearCheaper: true, minimum: 5, fee: null,
    note: msg("Its plan cards state minimums of 10 users on iPro and 5 on uPro and xPro."),
    source: 'https://aloware.com/pricing' },
  { slug: 'ytel', price: 'quote', shortest: 'quote', yearCheaper: null, minimum: null, fee: null,
    note: msg("Its pricing links lead to booking a demo."),
    source: 'https://www.ytel.com/' },
  { slug: '3cx', price: 'published', shortest: 'year', yearCheaper: null, minimum: 1, fee: null,
    note: msg("One flat annual licence for the whole system, priced by simultaneous calls."),
    source: 'https://www.3cx.com/ordering/pricing/' },
  { slug: 'dialer-io', price: 'quote', shortest: 'three-months', yearCheaper: null, minimum: null, fee: null,
    note: msg("Its FAQ requires an initial three-month commitment, then month to month."),
    source: 'https://www.dialer.io/faq' },
  { slug: 'close', price: 'published', shortest: 'month', yearCheaper: true, minimum: 1, fee: null,
    note: msg("No contract; paying annually saves up to 50%."),
    source: 'https://www.close.com/pricing' },
  { slug: 'gohighlevel', price: 'published', shortest: 'month', yearCheaper: true, minimum: 1, fee: null,
    note: msg("Month to month with no long-term contract; Starter is $97 a month or $970 a year."),
    source: 'https://www.gohighlevel.com/pricing' },
  { slug: 'hubspot', price: 'published', shortest: 'month', yearCheaper: true, minimum: 1,
    fee: msg("$1,500 onboarding on Professional, $3,500 on Enterprise"),
    note: msg("Starter commits monthly; Professional is billed monthly but commits you to a year."),
    source: 'https://www.hubspot.com/pricing/sales' },
  { slug: 'calltools', price: 'quote', shortest: 'quote', yearCheaper: null, minimum: null, fee: null,
    note: msg("Its pricing page is a form; a specialist then sends a quote."),
    source: 'https://calltools.com/pricing/' },
  { slug: 'redx', price: 'published', shortest: 'month', yearCheaper: true, minimum: 1, fee: null,
    note: msg("Monthly or annual; the annual bundles cost less per month."),
    source: 'https://www.theredx.com/pricing/' },
  { slug: 'ringover', price: 'published', shortest: 'year', yearCheaper: true, minimum: 3, fee: null,
    note: msg("Both published plans carry a 12-month commitment and a three-user minimum."),
    source: 'https://www.ringover.com/pricing' },
  { slug: 'talkdesk', price: 'published', shortest: null, yearCheaper: null, minimum: null, fee: null,
    note: msg("Prices are published; terms are not, except Talkdesk Express, which needs no commitment."),
    source: 'https://www.talkdesk.com/pricing/' },
  { slug: 'nextiva', price: 'published', shortest: 'month', yearCheaper: true, minimum: 1, fee: null,
    note: msg("Its annual prices require a paid term of 12 months or longer."),
    source: 'https://www.nextiva.com/pricing' },
]

/** The headline counts, computed so the page can never disagree with its own table. */
export function termCounts() {
  const all = DIALER_TERMS
  const published = all.filter((d) => d.price === 'published')
  return {
    total: all.length,
    weekly: 0 as number, // no row has a weekly option; SHORTEST has no weekly value to count
    quote: all.filter((d) => d.price === 'quote').length,
    published: published.length,
    yearForLowest: published.filter((d) => d.yearCheaper === true || d.shortest === 'year').length,
    longerThanMonth: all.filter((d) => d.shortest === 'three-months' || d.shortest === 'year').length,
    seatMinimum: all.filter((d) => (d.minimum ?? 1) > 1).length,
    largestMinimum: Math.max(...all.map((d) => d.minimum ?? 1)),
    oneTimeFee: all.filter((d) => d.fee).length,
  }
}
