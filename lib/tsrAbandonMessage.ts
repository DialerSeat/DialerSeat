// =============================================================================
// THE RECORDED MESSAGE THAT MAKES MULTI-LINE PREDICTIVE LAWFUL
// =============================================================================
// Predictive at one line is progressive with extra steps. To run more than one
// line you must satisfy ALL of 16 CFR 310.4(b)(4), and the condition nobody
// builds is (iii):
//
//   "whenever a sales representative is not available to speak with the person
//    answering the call within two (2) seconds after the person's completed
//    greeting, the seller or telemarketer must promptly play a recorded message
//    that states the name and telephone number of the seller on whose behalf
//    the call was placed."
//
// That clause is the whole mechanism. Without it every surplus line that
// answers with no agent behind it is an ABANDONED call counted against the 3%
// ceiling; with it, the call is compliant and is not counted. It is why real
// predictive dialers can run 1.5-2 lines per agent and this one could not.
//
// ── WHY IT IS PER CAMPAIGN AND NOT PER PLATFORM ─────────────────────────────
// The rule names "the seller on whose behalf the call was placed". DialerSeat
// is not the seller; its customers are, and a campaign is the thing that
// belongs to one of them. A platform-wide message would announce the wrong
// company and satisfy nothing.
//
// ── WHY A MISSING MESSAGE MUST BLOCK MULTI-LINE, NOT DEGRADE IT ─────────────
// A campaign with no configured seller name and callback number cannot run
// above one line. Not "runs with a warning" — one line, where there is no
// surplus and therefore no abandoned call to excuse. Compliance that depends on
// somebody noticing a warning is not compliance.

export interface TsrSeller {
  /** The seller's name, spoken aloud. Required by 310.4(b)(4)(iii). */
  name: string | null | undefined
  /** A callback number the person can reach the seller on. Required. */
  callbackNumber: string | null | undefined
}

export interface TsrMessageResult {
  ok: boolean
  /** The text to speak. Null when the campaign is not configured for it. */
  text: string | null
  /** Why it cannot be built, for the log and for the UI. */
  reason?: string
}

/** Digits of a NANP number, spoken so a person can write it down. */
function speakableNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (ten.length !== 10) return raw.trim()
  // Grouped with commas so TTS pauses between blocks rather than reading a
  // ten-digit run. A number nobody can transcribe does not satisfy the rule.
  return `${ten.slice(0, 3)}, ${ten.slice(3, 6)}, ${ten.slice(6)}`
}

/**
 * Build the compliant message, or explain why it cannot be built.
 *
 * Deliberately refuses rather than falling back to something generic. A message
 * that omits the seller's name or number does not satisfy 310.4(b)(4)(iii), and
 * playing one anyway would create the false impression of compliance — worse
 * than playing nothing, because it would be evidence of an attempt that fell
 * short rather than an oversight.
 */
export function buildTsrAbandonMessage(seller: TsrSeller): TsrMessageResult {
  const name = (seller.name ?? '').trim()
  const number = (seller.callbackNumber ?? '').trim()

  if (!name) {
    return { ok: false, text: null, reason: 'no seller name configured for this campaign' }
  }
  if (!number) {
    return { ok: false, text: null, reason: 'no callback number configured for this campaign' }
  }
  if (number.replace(/\D/g, '').length < 10) {
    return { ok: false, text: null, reason: `callback number "${number}" is not a full number` }
  }

  // Short on purpose. The rule requires it "promptly", and a long preamble
  // before the name defeats the point for somebody about to hang up.
  return {
    ok: true,
    text:
      `Hello. This is a call from ${name}. ` +
      `We are sorry to have missed you. ` +
      `You can reach us at ${speakableNumber(number)}. ` +
      `Thank you.`,
  }
}

/**
 * Can this campaign lawfully run more than one predictive line?
 *
 * The single question `predictiveController` asks before honouring a line count
 * above 1. See §1y of docs/COST-FINDINGS.md for why the answer gates the
 * feature rather than merely warning about it.
 */
export function canRunMultiLine(seller: TsrSeller): boolean {
  return buildTsrAbandonMessage(seller).ok
}
