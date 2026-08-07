import type { CallabilityCode } from '@/lib/callingWindow'

// =============================================================================
// QUEUE DIAGNOSIS
// =============================================================================
// Turns "nothing is dialable" into a sentence that says WHY, with numbers.
//
// The dialer used to report the first refusal it happened to meet while
// scanning candidates, which produced two specific, common lies:
//
//   - A queue of malformed phone numbers reported "outside their local calling
//     window", sending the agent away to wait for a window that would never
//     help, because the numbers were never dialable at any hour.
//
//   - A queue that was genuinely 90% outside hours and 10% broken reported
//     whichever it met first, so the actionable 10% stayed invisible.
//
// Counting every candidate and reporting the breakdown costs one pass over a
// list we have already loaded, and it is the difference between "try again
// later" and "412 of these have no state and will never dial".
// =============================================================================

export interface Tally {
  code: CallabilityCode
  count: number
  /** A real example from the data, so the user can go and look at it. */
  example?: string
}

export interface QueueDiagnosis {
  /** Total candidates examined. */
  examined: number
  /** One entry per distinct reason, largest first. */
  reasons: Tally[]
  /** A single sentence for the agent, already prioritised. */
  summary: string
  /**
   * True when at least one lead is only blocked by the clock. Drives whether
   * the UI says "dialing will resume" — which is a promise we should not make
   * about leads with broken numbers.
   */
  waitingOnClock: boolean
}

const LABELS: Record<CallabilityCode, string> = {
  no_number: 'have no phone number',
  invalid_number: 'have an invalid phone number',
  impossible_number: 'are not dialable US numbers and no carrier can route them',
  unknown_area: 'have an area code we cannot place, so their calling window is unknown',
  too_early: 'are before their local calling window opens',
  too_late: 'are past their local calling window',
  sunday: 'are in states that prohibit Sunday calls',
  international: 'are outside US calling rules',
  other: 'cannot be dialed right now',
}

/** Codes that resolve on their own with time. Everything else needs a human. */
const CLOCK_CODES = new Set<CallabilityCode>(['too_early', 'too_late', 'sunday'])

export class QueueDiagnosisBuilder {
  private counts = new Map<CallabilityCode, { count: number; example?: string }>()
  private examined = 0

  add(code: CallabilityCode | undefined, example?: string): void {
    this.examined++
    const key = code ?? 'other'
    const entry = this.counts.get(key) ?? { count: 0, example }
    entry.count++
    if (!entry.example && example) entry.example = example
    this.counts.set(key, entry)
  }

  build(): QueueDiagnosis {
    const reasons: Tally[] = [...this.counts.entries()]
      .map(([code, v]) => ({ code, count: v.count, example: v.example }))
      .sort((a, b) => b.count - a.count)

    const waitingOnClock = reasons.some(r => CLOCK_CODES.has(r.code))

    let summary: string
    if (reasons.length === 0) {
      summary = 'No leads left to dial in this campaign.'
    } else {
      // Lead with the largest group, then name the rest. The biggest group is
      // usually the real story, but a small group of broken numbers is the
      // part someone can actually fix today, so it must not be dropped.
      const parts = reasons.map(r => `${r.count.toLocaleString()} ${LABELS[r.code]}`)
      const head = parts[0]
      const tail = parts.slice(1)
      summary =
        `Nothing is dialable right now — of ${this.examined.toLocaleString()} leads checked, ${head}` +
        (tail.length > 0 ? `; ${tail.join('; ')}` : '') + '.'

      // The fixable reasons deserve an instruction, not just a count.
      const fixable = reasons.find(r =>
        r.code === 'unknown_area' || r.code === 'invalid_number' ||
        r.code === 'no_number' || r.code === 'impossible_number')
      if (fixable) {
        summary +=
          fixable.code === 'unknown_area'
            ? ' Adding a state column to those leads makes them dialable.'
            : ' Those numbers need correcting in the Leads tab before they can be dialed.'
      }
    }

    return { examined: this.examined, reasons, summary, waitingOnClock }
  }
}
