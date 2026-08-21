// ─────────────────────────────────────────────────────────────────────────
// WHICH ACCESS MODES MEAN "THE WHOLE TEAM CAN WORK THIS"
//
// team_campaigns.access_mode has two values that both mean open — 'free' and
// 'public' — and three places in the codebase disagreed about that:
//
//   /api/teams/list          'free' OR 'public'    correct
//   /dashboard/teams         'free' only           wrong
//   /api/teams/campaigns/detail  'free' only       wrong
//
// The visible result was a campaign set to 'public' showing "No agents
// assigned" in the sidebar, and a member on it being told the campaign had
// not been opened to them — while the same campaign granted them access
// perfectly well everywhere else, because the third file got it right.
//
// One definition, because the alternative has now been demonstrated twice
// tonight: a comment asking people to keep copies in sync does not work, and
// two of these were written by somebody reading the type's own docstring,
// which said 'free'.
// ─────────────────────────────────────────────────────────────────────────

/** Access modes that grant every active team member the campaign, with no
 *  per-agent grant required. */
export const OPEN_ACCESS_MODES = ['free', 'public'] as const

export function isOpenAccessMode(mode: string | null | undefined): boolean {
  return mode === 'free' || mode === 'public'
}
