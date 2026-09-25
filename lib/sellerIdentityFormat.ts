// =============================================================================
// THE TWO DETAILS PREDICTIVE NEEDS: CHECKING AND SHOWING THEM
// =============================================================================
// Pure, so the Settings page, the predictive popup and the server all apply the
// same rule. What makes the details sufficient is decided in one place,
// lib/tsrAbandonMessage (buildTsrAbandonMessage): this file only cleans up what
// a person typed and says what is wrong with it in words they can act on.
// =============================================================================

export const SELLER_NAME_MAX = 80

/** Ten NANP digits, or null when the input cannot be one. */
function tenDigits(raw: string): string | null {
  const all = (raw || '').replace(/\D/g, '')
  const ten = all.length === 11 && all.startsWith('1') ? all.slice(1) : all
  return ten.length === 10 ? ten : null
}

/**
 * The callback number as stored: +1 and ten digits. Null when it is not a
 * number a person could dial back. Area code and exchange must start 2-9, N11
 * codes are services, and a 900 number is refused because the FCC rule says
 * the callback number may not cost more than an ordinary call.
 */
export function normalizeCallbackNumber(raw: string): string | null {
  const ten = tenDigits(raw)
  if (!ten) return null
  const npa = ten.slice(0, 3)
  const nxx = ten.slice(3, 6)
  if (npa[0] === '0' || npa[0] === '1') return null
  if (nxx[0] === '0' || nxx[0] === '1') return null
  if (npa[1] === '1' && npa[2] === '1') return null
  if (npa === '900') return null
  return `+1${ten}`
}

/** (800) 555-1234 for display. Falls back to what was stored. */
export function formatCallbackNumber(stored: string | null | undefined): string {
  if (!stored) return ''
  const ten = tenDigits(stored)
  if (!ten) return stored
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
}

export type SellerIdentityCheck =
  | { ok: true; name: string | null; callbackNumber: string | null }
  | { ok: false; error: string }

/**
 * Clean and check what was typed. Both empty clears them. One without the
 * other is refused rather than half-saved: predictive needs both.
 */
export function checkSellerIdentity(rawName: unknown, rawNumber: unknown): SellerIdentityCheck {
  const name = typeof rawName === 'string' ? rawName.trim().replace(/\s+/g, ' ') : ''
  const number = typeof rawNumber === 'string' ? rawNumber.trim() : ''

  if (!name && !number) return { ok: true, name: null, callbackNumber: null }
  if (!name) return { ok: false, error: 'Enter your business name.' }
  if (!number) return { ok: false, error: 'Enter a callback number.' }
  if (name.length > SELLER_NAME_MAX) {
    return { ok: false, error: `Keep the business name under ${SELLER_NAME_MAX} characters.` }
  }
  const callbackNumber = normalizeCallbackNumber(number)
  if (!callbackNumber) {
    return { ok: false, error: 'Enter a full 10-digit US number people can call back.' }
  }
  return { ok: true, name, callbackNumber }
}
