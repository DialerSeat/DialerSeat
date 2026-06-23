-- =============================================================================
-- MIGRATION: Global scripts library + per-campaign enablement
-- Applied to project ajknvwdojwrtxzrikpak (DialerSeat) on 2026-06-23.
-- This file is a record for version control; the schema is already live.
-- =============================================================================

-- 1) Global per-user script library. Team-provided scripts carry team_id and
--    surface in every member's library (read-only for members).
CREATE TABLE IF NOT EXISTS public.scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT 'Untitled Script',
  body text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scripts_user_id_idx ON public.scripts(user_id);
CREATE INDEX IF NOT EXISTS scripts_team_id_idx ON public.scripts(team_id);

-- 2) Per-campaign enablement + ordering of library scripts.
CREATE TABLE IF NOT EXISTS public.campaign_script_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  script_id uuid NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, script_id)
);
CREATE INDEX IF NOT EXISTS campaign_script_links_campaign_idx ON public.campaign_script_links(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_script_links_script_idx ON public.campaign_script_links(script_id);

ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_script_links ENABLE ROW LEVEL SECURITY;
-- Access is via service-role API routes (same pattern as the rest of the app);
-- no anon/auth RLS policies are defined intentionally.

-- 3) One-time data move: copy each existing campaign_scripts row into the
--    global library and link it back to its origin campaign (1:1).
--    (Run once; campaign_scripts is left intact as a backup.)
ALTER TABLE public.scripts ADD COLUMN IF NOT EXISTS _migrate_old_id uuid;

INSERT INTO public.scripts (user_id, team_id, name, body, sort_order, _migrate_old_id)
SELECT c.user_id, NULL,
       COALESCE(NULLIF(cs.name,''),'Untitled Script'),
       COALESCE(cs.body,''),
       cs.sort_order,
       cs.id
FROM public.campaign_scripts cs
JOIN public.campaigns c ON c.id = cs.campaign_id;

INSERT INTO public.campaign_script_links (campaign_id, script_id, sort_order)
SELECT cs.campaign_id, s.id, cs.sort_order
FROM public.scripts s
JOIN public.campaign_scripts cs ON cs.id = s._migrate_old_id;

ALTER TABLE public.scripts DROP COLUMN IF EXISTS _migrate_old_id;
