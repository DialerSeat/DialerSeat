# Batch: backend primitives + adoption (factory + error responder)

## Primitives (idempotent — include even if you already have them)
- lib/supabase.ts — adds getServiceClient(tag?) factory: one correctly-configured
  service-role client (persistSession:false / autoRefreshToken:false) instead of
  hand-rolled inline createClient(...). Existing supabaseAdmin import unchanged.
- lib/apiError.ts — apiError(err,{route,status,clientMessage,context}) logs full
  detail server-side + Sentry, returns a GENERIC client message. Same
  {success:false,error} shape. Plus apiUnauthorized().

## Adopted in 21 routes (all type-check clean)
Factory (getServiceClient) replaces bare inline clients; apiError replaces raw
error.message leaks. Routes: admin/users, admin/users/delete, admin/billing,
admin/pool/{seed,import-existing,buy,config,register,release,sync,analytics,list},
leads/{update,next-batch,bulk-update,create}, stripe/{cancel,abandon-billing,
create-subscription,status}, manager/teams.

## DELIBERATELY NOT TOUCHED this pass
- Live call-path routes (calls/hangup, calls/check, calls/incoming-route,
  dialer/*): fragile, get a dedicated isolated pass.
- ~33 bare inline clients and ~74 error.message leaks REMAIN across other routes.
  This was a prioritized pass over money/auth/PII/leads surfaces, not a blind
  sweep — the rest migrate incrementally with the same two primitives.

## Apply
Replace lib/supabase.ts, add lib/apiError.ts, replace the 21 route files.
If your repo already had these primitives from a prior batch, the lib files are
identical (safe to overwrite).
