# Account data export + deletion (data portability / right-to-erasure)

## What shipped (all type-checks clean; nothing executed against live data)

### 1. Full-account EXPORT — app/api/account/export/route.ts  (GET, read-only)
Bundles everything the authenticated user owns into one JSON download:
profile, subscriptions, campaigns, leads, lead_notes, calls, dial_attempts,
scripts, custom_themes, teams_owned, team_memberships, support_submissions,
desktop prefs/icons/windows. Identity from Clerk session only (requireUser) —
no client id trusted (same pattern that fixed the prior export IDOR). All 15
table/column pairs verified to exist. gmail_oauth_tokens deliberately EXCLUDED
(sensitive). users table verified to hold no token/secret columns. Read-only —
cannot break anything.

### 2. Account DELETION — lib/deleteAccount.ts + app/api/account/delete/route.ts
- FK-safe deletion ORDER, derived from the real foreign-key map (verified live):
  leads→campaigns CASCADE, lead_notes→leads CASCADE, subscriptions→users CASCADE,
  team_members→teams CASCADE; calls FKs are SET NULL (calls survive as history).
- DRY-RUN BY DEFAULT: POST with no confirm returns exact per-table counts and
  deletes NOTHING. Only POST { confirm: "DELETE" } executes. Verified the dry-run
  counting against a real 3,233-lead account — mapping sound, deleted nothing.
- BILLING GUARD: refuses to delete an account with a live (active/past_due)
  subscription — caller must cancel in Stripe first, then pass
  allowActiveSubscription. Prevents billing a ghost account.
- call_events EXCLUDED from deletion: it's the append-only forensic log (we
  revoked service_role UPDATE/DELETE for immutability). Re-granting just to
  delete would weaken that guarantee. Its only identifier is the opaque Clerk
  id (no name/email/phone). Documented; purge separately as superuser if ever
  legally required.
- Does NOT delete the Clerk auth user (separate system of record — do from Clerk).

### 3. proxy.ts — read-only allowlist
Added /api/account/export and /api/account/delete to the read-only allowlist so
a non-paying user with data can ALWAYS export and delete their own account, even
while locked out. (Without this the delete POST would have been wrongly blocked.)

## Safety stance
- I did NOT execute any deletion against live data. Export is read-only.
  Deletion defaults to dry-run; you trigger the real delete deliberately.
- No schema changes, no FK/trigger changes, no cascade rules added.

## Follow-up (your call, not done here)
- Wire UI buttons (Export my data / Delete my account) in settings.
- The delete route hard-deletes DB rows but not the Clerk user — add a Clerk
  backend-API call if you want full auth removal in the same action.
