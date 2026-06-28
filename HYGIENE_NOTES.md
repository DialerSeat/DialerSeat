# Batch: DB hardening + admin-gate consolidation

## A) Database hardening — APPLIED LIVE (migrations/DB_HARDENING_2026-06-27.sql)
Cleared every remaining security advisor WARN. Result: 0 ERROR, 0 WARN; only the
safe INFO "rls_enabled_no_policy" notices remain (RLS on + no policy = deny-all,
the correct posture; the app reaches these tables via service-role).
  1. Pinned search_path on 17 functions (none SECURITY DEFINER; all reference
     only public + built-ins, so behavior-preserving). Verified a trigger still
     fires via a rolled-back UPDATE.
  2. Dropped the broad public-listing SELECT policy on the tenant-assets bucket.
     Public URL fetches still work (served via CDN, no policy needed) and all app
     access is server-side service-role (bypasses RLS); only anonymous
     enumeration of bucket contents is removed.

## B) Admin-gate consolidation — CODE (type-checks clean)
The audit found ~9 admin routes that each RE-IMPLEMENTED the admin check inline
(auth() -> query users.is_admin -> 403). None were unprotected, but the inline
copies varied subtly (.single() vs .maybeSingle(), some not checking the query
error -> theoretical fail-open). Consolidated them all onto the ONE canonical,
fail-closed gate in lib/requireAdmin.ts.

Migrated to `requireAdmin()` GateResult:
  - pool/buy, pool/list, pool/release, pool/config, pool/seed,
    pool/import-existing, pool/sync, teams

Left as-is on purpose:
  - support/submit — intentionally open to ANY signed-in user (it's a submission
    endpoint, only physically located under /api/admin). NOT admin-gated.
  - lib/admin.ts — reframed from "temporary shim, delete later" to a permanent,
    deliberate throwing-adapter over the same canonical gate. Both import paths
    resolve to one fail-closed implementation; forcing the remaining try/catch
    routes to restructure carried real fail-OPEN risk for no security gain.

RESULT: every admin route (25/26) now uses the single canonical gate; the lone
exception is auth-only by design. One source of truth for "is this user admin",
product-wide.

## How to apply
- DB: already live. The .sql is for your version control.
- Code: replace the 8 listed route files + lib/admin.ts with the versions here.
