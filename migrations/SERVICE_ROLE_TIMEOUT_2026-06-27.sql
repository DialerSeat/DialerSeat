-- ============================================================================
-- service_role statement timeout — applied live to ajknvwdojwrtxzrikpak
-- Date: 2026-06-27
-- ============================================================================
-- service_role had NO statement_timeout (anon=3s, authenticated=8s were already
-- set). A pathological query from any server route could run unbounded and
-- exhaust the connection pool. 30s is a generous ceiling — far above any
-- legitimate server query (a representative analytics aggregation runs in ~4ms)
-- but short enough to abort a true runaway. Applies to EVERY service-role query
-- (factory + inline clients) with zero code changes.
ALTER ROLE service_role SET statement_timeout = '30s';
NOTIFY pgrst, 'reload config';   -- PostgREST caches role settings; reload now.
