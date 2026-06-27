# Batch: cleanup + recording retention

## Cleanup (zero runtime risk)
Deleted (provably 0 references):
- components/GoToDesktopButton.tsx
- components/landing-nav-profile.tsx
- app/components/ComingSoon.tsx
- test-call.js, test-sip.js (root debug scripts)
- .env.production.local (gitignored local artifact)
- postcss.config.mjs (redundant; postcss.config.js is the active CommonJS config
  and is a superset — includes autoprefixer)

KEPT lib/fonts.ts: the audit flagged it unused, but the word "fonts" appears in
icon/og routes (false-positive match). The exact-import check found no importer,
but it's tiny and harmless — left alone to keep the product intact. Revisit only
if you want a thorough font-loader audit.

These are file deletions — apply by removing the same files in your repo.

## Recording retention (NEW cron — honors the 30-day promise)
- app/api/cron/recording-retention/route.ts — daily cron. Finds recordings past
  recording_expires_at, deletes the audio from SignalWire (best-effort), then
  clears the recording fields on the calls row but KEEPS the row (analytics
  integrity), setting recording_status='deleted'. Mirrors recordings/delete
  exactly. Bounded to 200/run; CRON_SECRET-auth like the pool crons.
- vercel.json — registered at 03:00 daily (offset from pool crons).

Verified live: 0 recordings currently qualify for deletion (all 16 with expiry
are within retention), so it's harmless today and only acts as recordings age
past 30 days. It can NEVER delete a non-expired recording.

Requires CRON_SECRET in Vercel env (already used by existing crons).
