-- ============================================================================
-- DialerSeat security pass — applied live to project ajknvwdojwrtxzrikpak
-- Date: 2026-06-26
-- ============================================================================
-- These migrations were applied to the live database. Kept here for your
-- records / version control.

-- 1) Close the critical hole: users table had an "Allow all operations" policy
--    (USING(true)) granted to public, letting anyone with the anon key
--    read/modify/delete every user row. App uses service-role (bypasses RLS),
--    so dropping it has zero app impact. Browser admin check moved to
--    /api/users/me (server-side).
DROP POLICY IF EXISTS "Allow all operations on users" ON public.users;

-- 2) campaign_abandon_rate_30d was SECURITY DEFINER (bypassed RLS for any
--    caller). Read only server-side via service-role, so make it respect the
--    caller's permissions.
ALTER VIEW public.campaign_abandon_rate_30d SET (security_invoker = true);

-- 3) Lock lead-claim + rls_auto_enable functions to server-side only. They were
--    executable by anon/authenticated via PUBLIC over the REST RPC endpoint.
REVOKE EXECUTE ON FUNCTION public.claim_next_leads_for_campaign(uuid, uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_lead_claim(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_stale_lead_claims() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_leads_for_campaign(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_lead_claim(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_stale_lead_claims() TO service_role;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;

-- ============================================================================
-- NOT done in this pass (deliberately deferred — see notes):
--   - tenant_branding SECURITY DEFINER view: exposes only public branding;
--     converting needs an anon RLS policy on white_label_tenants + branding
--     flow testing.
--   - ~30 rls_enabled_no_policy INFO notices: these are the SAFE state (deny
--     all anon access); not vulnerabilities.
--   - ~18 function_search_path_mutable WARNs: low risk; pin search_path later.
--   - tenant-assets bucket listing WARN: low severity.
-- ============================================================================
