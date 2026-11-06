// ── LOOK AROUND BEFORE PAYING ─────────────────────────────────────────────
// A brand-new account (access tier 'new': never subscribed) gets into the
// dashboard read-only instead of being sent to /welcome, with demo data on
// every page until the first payment. Anything that would dial, upload or
// save opens the paywall instead. proxy.ts enforces the read-only part on
// the server; this is the browser's half.
//
// On unless NEXT_PUBLIC_PREVIEW_ONBOARDING is set to 0, which puts a never-paid
// account back on the old /welcome then /billing path after a redeploy.
export const PREVIEW_BEFORE_PAYMENT = process.env.NEXT_PUBLIC_PREVIEW_ONBOARDING !== '0'

export const PAYWALL_EVENT = 'ds:paywall'

export type PaywallReason = { eyebrow: string; line: string; source: string }

/** Opens the activate-your-seat popup over whatever page is showing. */
export function openPaywall(reason: PaywallReason) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PAYWALL_EVENT, { detail: reason }))
}

/** True for an unpaid account that is looking around. */
export function isPreviewTier(tier: string | null | undefined) {
  return PREVIEW_BEFORE_PAYMENT && tier === 'new'
}
