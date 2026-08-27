// =============================================================================
// WHAT KIND OF DEVICE IS THIS
// =============================================================================
// One definition, because there are now two callers and this codebase has a
// long record of what happens to the second copy. page_views.device and
// agent_sessions.device must mean the same thing — otherwise "mobile" on the
// traffic report and "mobile" on Live Ops are two different claims, and the
// day they disagree is the day somebody draws a conclusion from comparing
// them.
//
// Deliberately coarse. Three buckets answer the questions actually being
// asked — "is this agent on a phone", "does the marketing site get read on
// mobile" — and a fuller parse would need a maintained device database to
// stay honest about the long tail.
//
// Order matters: iPad's user agent contains neither "Mobi" nor "iPhone" but
// tablets must not fall through to desktop, so the tablet test runs first.
// =============================================================================

export function deviceFrom(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/iPad|Tablet/i.test(ua)) return 'tablet'
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile'
  return 'desktop'
}
