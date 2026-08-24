// ─────────────────────────────────────────────────────────────────────────
// WHAT A CALL ENDED AS — ONE LIST
//
// Disposition strings were declared independently in a dozen files, in three
// different shapes, and that has produced real bugs: the Not Interested
// sub-queue matched nothing for its entire existence because two files agreed
// on 'NOT_INTERESTED' while the dialer writes 'NOT INTERESTED', and a member's
// campaign stats read zero for the same reason.
//
// WHY THE SPELLINGS DIFFER. Two eras. Underscored values (NO_ANSWER,
// TCPA_BLOCKED) come from the SignalWire build; spaced ones (NOT INTERESTED,
// DO NOT CALL) are what the current dialer writes. Neither is wrong, both are
// in the database, and normalising the stored data would rewrite call history
// to make a naming choice tidier — which is not worth it. So the canonical
// form is what the dialer writes TODAY, and every read accepts the older
// spelling alongside it.
//
// AGENT vs SYSTEM. An agent picks from AGENT_DISPOSITIONS. The rest are facts
// the system records about what happened to the call, and no agent should be
// offered them: nobody tags a call "abandoned".
// ─────────────────────────────────────────────────────────────────────────

export interface DispositionDef {
  /** Stored value written by the current dialer. */
  value: string
  /** Older spellings that mean the same thing and must still match on read. */
  aliases: string[]
  /** Sentence case for the UI. Screens should never print the raw value. */
  label: string
  /** An agent chose this, rather than the system recording it. */
  agentChosen: boolean
  /** The lead was actually spoken to by a person. */
  contact: boolean
  /** Counts toward conversions. */
  conversion: boolean
  /** Kept out of the disposition breakdown. Not hidden data — these are
   *  dialer mechanics rather than call outcomes, and on real traffic they
   *  outnumber the outcomes by an order of magnitude, so a chart containing
   *  them is a chart about the dialer instead of about the calls. */
  hideFromBreakdown?: boolean
}

export const DISPOSITIONS: DispositionDef[] = [
  // ── Agent outcomes ────────────────────────────────────────────────────
  // Called a CALL BACK on every screen. The stored value stays 'APPOINTMENT'
  // deliberately: it is written on hundreds of existing rows, matched by the
  // sub-queue filters and counted by the analytics, and renaming it would
  // rewrite call history to change a word people read. The label is the only
  // part anybody sees, so the label is the part that changes.
  { value: 'APPOINTMENT', aliases: ['APPOINTMENT_SET'], label: 'Call Back',
    agentChosen: true, contact: true, conversion: true },
  { value: 'CLOSED', aliases: [], label: 'Closed',
    agentChosen: true, contact: true, conversion: true },
  { value: 'NOT INTERESTED', aliases: ['NOT_INTERESTED'], label: 'Not interested',
    agentChosen: true, contact: true, conversion: false },
  { value: 'DO NOT CALL', aliases: ['DNC', 'DO_NOT_CALL'], label: 'Do not call',
    agentChosen: true, contact: true, conversion: false },

  // ── System outcomes ───────────────────────────────────────────────────
  // Answering machine. Previously these were written as nothing at all: the
  // machine path hung up and moved on, so 196 calls sat with a null
  // disposition and the breakdown read "No disposition · 88%". A voicemail is
  // a real, useful outcome — it says the number is live and someone may call
  // back — and it is the single most common thing that happens on a dial.
  { value: 'VOICEMAIL', aliases: ['NO_ANSWER_AMD', 'MACHINE', 'machine'], label: 'Voicemail',
    agentChosen: false, contact: false, conversion: false },
  { value: 'NO_ANSWER', aliases: ['NO ANSWER'], label: 'No answer',
    agentChosen: false, contact: false, conversion: false },
  // Skipped is the dialer moving on - a lead outside calling hours, a queue
  // advancing, an agent passing. It is the largest bucket by far and says
  // nothing about how a conversation went.
  // ── SKIPPED IS NOT A DISPOSITION, IT IS THE ABSENCE OF ONE ────────────
  // Reads as "No disposition" everywhere, because that is what it means:
  // nobody judged this lead. Four unrelated events write it — an agent
  // passing in preview, an agent skipping a live call, an unusable phone
  // number, and a dial that failed to place — and not one of them is an
  // opinion about the person on the other end.
  //
  // The VALUE stays, and is not written as null, because it does mechanical
  // work: `calls` finds the row to close with `.is('disposition', null)`, so
  // a null here would leave every skipped call permanently open and matchable
  // by the next disposition that came along.
  { value: 'SKIPPED', aliases: [], label: 'No disposition',
    agentChosen: false, contact: false, conversion: false, hideFromBreakdown: true },
  { value: 'ABANDONED', aliases: [], label: 'Abandoned',
    agentChosen: false, contact: false, conversion: false },
  { value: 'TCPA_BLOCKED', aliases: ['TCPA BLOCKED'], label: 'Outside calling hours',
    agentChosen: false, contact: false, conversion: false },
]

/** Every spelling that means this disposition — for `.in()` filters. */
export function formsOf(value: string): string[] {
  const def = DISPOSITIONS.find(d => d.value === value)
  return def ? [def.value, ...def.aliases] : [value]
}

/** Canonical value for anything stored, including legacy spellings. Returns
 *  the input untouched when it is not one we know, so unexpected data shows
 *  as itself rather than being silently folded into something else. */
export function canonical(stored: string | null | undefined): string | null {
  if (!stored) return null
  const hit = DISPOSITIONS.find(
    d => d.value === stored || d.aliases.includes(stored)
  )
  return hit ? hit.value : stored
}

/** Human label. Falls back to the raw value so a legacy or unexpected string
 *  is still readable rather than blank. */
export function labelFor(stored: string | null | undefined): string {
  if (!stored) return 'No disposition'
  const hit = DISPOSITIONS.find(
    d => d.value === stored || d.aliases.includes(stored)
  )
  return hit ? hit.label : stored
}

export const AGENT_DISPOSITIONS = DISPOSITIONS.filter(d => d.agentChosen)

/** Values counting as having reached a person — every spelling of each. */
export const CONTACT_FORMS = DISPOSITIONS
  .filter(d => d.contact)
  .flatMap(d => [d.value, ...d.aliases])

/** Values counting as a conversion — every spelling of each. */
export const CONVERSION_FORMS = DISPOSITIONS
  .filter(d => d.conversion)
  .flatMap(d => [d.value, ...d.aliases])

/** Values that belong in the disposition breakdown. Everything else in this
 *  list still counts everywhere else — this only decides what the chart is
 *  about. */
export const BREAKDOWN_FORMS = new Set(
  DISPOSITIONS
    .filter(d => !d.hideFromBreakdown)
    .flatMap(d => [d.value, ...d.aliases])
)

/** Call STATUSES that leaked into the disposition column in the SignalWire
 *  era — 'completed', 'failed'. They are not dispositions, nothing writes
 *  them today, and they exist only in old rows. Named explicitly rather than
 *  filtered by a shape rule, so a real disposition can never be swept up by
 *  accident the way an allow-list used to sweep up TCPA_BLOCKED. */
export const LEGACY_STATUS_VALUES = new Set(['completed', 'failed'])
