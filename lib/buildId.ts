// =============================================================================
// WHICH BUILD IS THIS?
// =============================================================================
// One constant, read by both halves of the app, so a dialer tab can say what
// code it is running and the server can compare it to what it is serving.
//
// ── WHY THIS EXISTS ────────────────────────────────────────────────────────
// The dialer is a long-lived page. An agent loads it once and keeps it open for
// a shift, so a client-side fix does not reach them -- they keep running the
// JavaScript they downloaded hours ago. That is why "Reload all dialers" exists
// in Settings.
//
// On 17 Sept that button was pressed for the first time and there was no way to
// tell whether anything had happened. Nothing recorded which build a tab was
// running, and agent_sessions.last_heartbeat is a last-value column, so there
// was no history to reconstruct from either. The reload was pushed hopefully
// and confirmed never.
//
// This is what makes it measurable. Without it the button is a prayer.
//
// ── WHERE THE VALUE COMES FROM ─────────────────────────────────────────────
// Vercel populates VERCEL_GIT_COMMIT_SHA at build time. It is a SERVER
// variable, so next.config.ts copies it into NEXT_PUBLIC_BUILD_SHA through the
// `env` key, which inlines it into the client bundle at build.
//
// Deliberately NOT read from NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA, which Vercel
// also offers: that one depends on "Automatically expose System Environment
// Variables" being switched on in the project dashboard. A telemetry signal
// whose correctness depends on a setting nobody remembers is worse than none,
// because it fails by reporting everyone as stale.
//
// ── OUTSIDE VERCEL ─────────────────────────────────────────────────────────
// Local dev and CI have no commit sha, so this reads 'dev'. Every tab then
// agrees with every other tab and with the server, which is the correct answer
// for a machine where there is only ever one build.

const raw = (process.env.NEXT_PUBLIC_BUILD_SHA || '').trim()

/**
 * Short commit sha of the running build, or 'dev' outside Vercel.
 *
 * Seven characters because that is what a human compares against `git log`,
 * and the full forty carry no extra meaning for this purpose.
 */
export const BUILD_SHA: string = raw ? raw.slice(0, 7) : 'dev'
