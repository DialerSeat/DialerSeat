// =============================================================================
// PHONE NORMALIZATION — E.164 (provider-agnostic, unchanged)
// =============================================================================
// See prior version's header comment for the full rationale (the historical
// double-country-code bug this fixes). Logic itself is unchanged — Telnyx
// requires the same strict E.164 format SignalWire did.
// =============================================================================
export function normalizeToE164(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null

  const trimmed = String(raw).trim()
  if (!trimmed) return null

  // Reject outright if the raw value contains anything other than digits,
  // and the small set of characters a real phone number can legitimately
  // be formatted with (+, spaces, dashes, dots, parens, x for extensions).
  // Letters are the tell — no real phone number contains them, so their
  // presence means this value is contaminated (e.g. a name or state that
  // got concatenated into the phone field during a bad CSV import — this
  // is a real, confirmed pattern in actual uploaded lead data, e.g. a
  // phone/initials/phone-again/state string all merged into one field).
  // This catches contamination directly rather than relying on it
  // coincidentally pushing the digit count out of the valid E.164 range —
  // stripping non-digits from a letter-contaminated string can still land
  // in a plausible-looking digit count purely by chance.
  if (/[a-zA-Z]/.test(trimmed)) return null

  const hadPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')

  if (!digits) return null

  // E.164 (the actual ITU-T standard, not a made-up limit) caps a phone
  // number at 15 digits total, INCLUDING the country code — no real,
  // dialable phone number is longer than that. An earlier version had no
  // upper bound at all: any digit string over 11 characters got a bare "+"
  // prepended and was treated as valid, which is how genuinely malformed
  // data (e.g. a 12-digit value ending in a run of zeros, confirmed present
  // in real uploaded lead data) reached Telnyx's API instead of being
  // caught here — Telnyx correctly rejected it downstream with a generic
  // "must be in +E164 format" error that gave no hint WHICH lead or WHY,
  // several layers removed from the actual bad data. Catching it here
  // means the failure is attributable to a specific lead immediately.
  const MAX_E164_DIGITS = 15
  const MIN_E164_DIGITS = 8 // shortest real-world numbers (some small-country lines) are ~8 digits

  if (digits.length > MAX_E164_DIGITS) return null

  if (hadPlus) {
    return digits.length >= MIN_E164_DIGITS ? `+${digits}` : null
  }

  if (digits.length === 10) {
    return `+1${digits}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }
  if (digits.length > 11 && digits.length <= MAX_E164_DIGITS) {
    return `+${digits}`
  }

  return null
}
