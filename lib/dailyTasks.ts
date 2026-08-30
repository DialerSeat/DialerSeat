// =============================================================================
// THE DAILY LIST — regardless how you feel
// =============================================================================
// Four tasks that do not change, and a streak that counts the days you did
// them. The wording lives here rather than in the database so that rewording a
// task does not require a migration and does not leave the old sentence
// scattered through months of history: the point of a fixed list is that it is
// the same list every morning.
// =============================================================================

export interface CoreTask {
  key: string
  label: string
  /** The one line of context that makes the task specific rather than a mood. */
  detail?: string
}

/**
 * The four. Order is the order of the day, not an order of importance —
 * gratitude before outreach because the first two are what make the second two
 * survivable on a bad morning.
 */
export const CORE_TASKS: CoreTask[] = [
  {
    key: 'core1',
    label: 'Have gratitude',
  },
  {
    key: 'core2',
    label: 'Take time for yourself',
    detail: 'Brush your teeth and do something healthy — regardless what is going on.',
  },
  {
    key: 'core3',
    label: 'Cold DM and email',
    detail: 'The first four hours of dedicated work time. Outreach before anything reactive.',
  },
  {
    key: 'core4',
    label: 'Run the business',
    detail: 'Dialer working properly, Telnyx funded, check stats and follow-ups. Support only AFTER the first four hours. Then a dedicated block to brainstorm marketing and improvement.',
  },
]

export const CORE_KEYS = CORE_TASKS.map(t => t.key)
export const CORE_COUNT = CORE_TASKS.length

/**
 * A calendar day as YYYY-MM-DD in the viewer's OWN timezone.
 *
 * Deliberately not toISOString().slice(0,10), which is UTC: at 1am Eastern
 * that returns tomorrow, which would file a task under a day that has not
 * started and silently break the streak.
 */
export function localDay(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Move a YYYY-MM-DD string by whole days.
 *
 * Runs the arithmetic in UTC on purpose. The input is a bare calendar date
 * with no time in it, so UTC is just a fixed frame to count in — using local
 * time here would make the result depend on whether a DST boundary happened to
 * fall in the middle of the range.
 */
export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + delta)
  return dt.toISOString().slice(0, 10)
}

/**
 * How many days in a row the whole core list was finished.
 *
 * THE TODAY RULE. An unfinished today does not break the streak — it has not
 * failed yet, it is still in progress. So counting starts at today when today
 * is already complete, and at yesterday when it is not. Without that, a
 * hard-won 30-day streak would read 0 every morning until the last box was
 * ticked, which punishes you for the crime of it being 8am.
 *
 * A missed yesterday does end it. That is the whole point of a streak.
 */
export function computeStreak(completeDays: Set<string>, today: string): number {
  let cursor = completeDays.has(today) ? today : shiftDay(today, -1)
  let streak = 0
  // Bounded so a corrupt set can never spin forever; ten years of perfect
  // days is a good problem to have and a bad reason to hang the request.
  while (completeDays.has(cursor) && streak < 3700) {
    streak += 1
    cursor = shiftDay(cursor, -1)
  }
  return streak
}

/** Every YYYY-MM-DD in the given YYYY-MM, in order. */
export function daysInMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number)
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
}
