// ─────────────────────────────────────────────────────────────────────────
// THE TEAMS PAGE REMEMBERS WHERE YOU WERE
//
// Refreshing reset everything: the tree collapsed back to defaults, the panel
// returned to the overview, the date range went back to all-time. On a page
// people keep open all day and refresh constantly — after accepting a request,
// after a seat charge, after anything that changes the roster — that means
// re-opening the same three branches every time.
//
// WRITTEN ON CHANGE, READ ON MOUNT. Not through useState's lazy initialiser:
// the server renders the default and the client would render the restored
// value, which is a hydration mismatch. Restoring in an effect costs one frame
// of the default view and is correct.
//
// EVERYTHING HERE IS DISPOSABLE. It is a convenience about which branches were
// open, not data. Any read failure — disabled storage, private mode, a shape
// from an older version — returns null and the page opens as it always did.
// Nothing is worth a crash, and nothing needs migrating.
// ─────────────────────────────────────────────────────────────────────────

const KEY = 'ds:teams:view:v1'

export interface RememberedTeamsView {
  /** Team ids whose branch is collapsed. */
  collapsedTeams?: string[]
  /** `${teamId}:${campaignId}` keys whose branch is collapsed. */
  collapsedCampaigns?: string[]
  /** The selected scope, stored as-is and validated loosely on read. */
  scope?: unknown
  view?: string
  range?: string
}

export function readTeamsView(): RememberedTeamsView | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as RememberedTeamsView
  } catch {
    return null
  }
}

export function writeTeamsView(patch: RememberedTeamsView): void {
  if (typeof window === 'undefined') return
  try {
    const current = readTeamsView() || {}
    window.localStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }))
  } catch {
    // Storage can be full, disabled, or refused in private mode. None of that
    // is a reason for the page to misbehave.
  }
}
