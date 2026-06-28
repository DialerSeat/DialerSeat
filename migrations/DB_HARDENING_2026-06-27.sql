-- ============================================================================
-- DB hardening pass — applied live to ajknvwdojwrtxzrikpak — 2026-06-27
-- Cleared every remaining security advisor WARN. Result: 0 ERROR, 0 WARN;
-- only safe INFO (rls_enabled_no_policy = deny-all, the correct state) remains.
-- ============================================================================

-- 1) Pin search_path on all flagged functions (function_search_path_mutable).
ALTER FUNCTION public.increment_called_leads(uuid)            SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_subscriptions_updated_at()       SET search_path = public, pg_catalog;
ALTER FUNCTION public.phone_numbers_set_updated_at()          SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_campaign_scripts_updated_at()    SET search_path = public, pg_catalog;
ALTER FUNCTION public.mark_user_has_data(text)                SET search_path = public, pg_catalog;
ALTER FUNCTION public.preserve_user_from_campaign()           SET search_path = public, pg_catalog;
ALTER FUNCTION public.preserve_user_from_lead()               SET search_path = public, pg_catalog;
ALTER FUNCTION public.preserve_user_from_call()               SET search_path = public, pg_catalog;
ALTER FUNCTION public.preserve_user_from_team()               SET search_path = public, pg_catalog;
ALTER FUNCTION public.preserve_user_from_team_member()        SET search_path = public, pg_catalog;
ALTER FUNCTION public.trg_mark_user_has_data()                SET search_path = public, pg_catalog;
ALTER FUNCTION public.mark_stale_agents_offline()             SET search_path = public, pg_catalog;
ALTER FUNCTION public.increment_pacing_metric(uuid,text,integer) SET search_path = public, pg_catalog;
ALTER FUNCTION public.gmail_oauth_tokens_touch_updated_at()   SET search_path = public, pg_catalog;
ALTER FUNCTION public.set_updated_at()                        SET search_path = public, pg_catalog;
ALTER FUNCTION public.custom_themes_set_updated_at()          SET search_path = public, pg_catalog;
ALTER FUNCTION public.claim_team_code_use(uuid)               SET search_path = public, pg_catalog;

-- 2) Stop anonymous enumeration of the public tenant-assets bucket.
DROP POLICY IF EXISTS "tenant_assets_public_read" ON storage.objects;
