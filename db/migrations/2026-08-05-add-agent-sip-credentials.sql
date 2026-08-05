-- ---- agent_sip_credentials -------------------------------------------------
-- Per-agent Telnyx SIP identity ("on-demand credentials", in Telnyx's terms).
--
-- WHY: the Telnyx migration shipped with a SINGLE account-wide
-- TELNYX_SIP_USERNAME. Every agent's browser registered to Telnyx as that
-- same SIP user, so when the server dialed sip:<that user>@sip.telnyx.com,
-- Telnyx forked the INVITE to every registered browser at once and whoever
-- answered first got the call. With one agent that is invisible; with two it
-- silently connects an agent to a lead that belongs to someone else, and
-- there is no way for the server to address one specific agent at all —
-- which the team-overflow path fundamentally requires, since its whole job
-- is to route a call to a PARTICULAR claimed agent.
--
-- This table gives every user their own Telnyx credential, so
-- sip:<their username>@sip.telnyx.com addresses exactly one browser. It is
-- the pattern Telnyx's own docs recommend for exactly this use case:
-- generate a credential per agent, then use the Call Control API to dial
-- the specific credential of the agent you want to connect.
--
-- NO SECRET AT REST: sip_password is deliberately NOT stored. Telnyx returns
-- it on GET /v2/telephony_credentials/{id}, so Telnyx stays the single system
-- of record and we fetch it on demand when serving an authenticated agent
-- their own registration details. That also means rotating a credential in
-- Telnyx takes effect here with no migration and no re-sync.
--
-- KEYED BY clerk_id (text), not users.id (uuid), on purpose: the hot path
-- (a user clicking dial -> lib/placeOutboundCall.ts) already holds the Clerk
-- id and nothing else, so keying on it keeps that path join-free. It also
-- matches how calls.user_id already stores a Clerk id. The predictive/
-- overflow paths hold agent_sessions.user_id (a users.id uuid) instead and
-- pay one extra lookup — those paths are already doing several queries, so
-- that is the cheaper side to put the cost on.

CREATE TABLE IF NOT EXISTS public.agent_sip_credentials (
  id                     uuid NOT NULL DEFAULT gen_random_uuid(),
  clerk_id               text NOT NULL,
  telnyx_credential_id   text NOT NULL,
  sip_username           text NOT NULL,
  -- The Telnyx SIP Connection the credential is attached to. Recorded so a
  -- credential can be traced back to (or invalidated alongside) its parent
  -- connection without another Telnyx round trip.
  connection_id          text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  -- Last time this agent's browser successfully fetched its registration
  -- details. Not authoritative presence (agent_sessions.last_heartbeat is),
  -- just a cheap "has this credential ever actually been used" signal for
  -- diagnostics and for spotting orphaned credentials on the Telnyx side.
  last_fetched_at        timestamptz,
  CONSTRAINT agent_sip_credentials_pkey PRIMARY KEY (id)
);

-- One credential per user. This is also the concurrency guard: provisioning
-- is get-or-create, and if two requests for the same brand-new user race,
-- the loser's INSERT fails on this constraint and it re-reads the winner's
-- row instead of creating a second Telnyx credential that nothing would
-- ever dial.
CREATE UNIQUE INDEX IF NOT EXISTS agent_sip_credentials_clerk_id_key
  ON public.agent_sip_credentials (clerk_id);

-- Telnyx generates sip_username, so collisions shouldn't happen — but a
-- duplicate here would mean two agents share an identity, which is the exact
-- bug this table exists to eliminate. Enforce it rather than assume it.
CREATE UNIQUE INDEX IF NOT EXISTS agent_sip_credentials_sip_username_key
  ON public.agent_sip_credentials (sip_username);

CREATE UNIQUE INDEX IF NOT EXISTS agent_sip_credentials_telnyx_id_key
  ON public.agent_sip_credentials (telnyx_credential_id);

-- Server-side only: every read and write goes through the Supabase service
-- role in API routes (lib/agentSipCredentials.ts). No client ever queries
-- this table directly, so RLS is on with no permissive policy — the service
-- role bypasses RLS, everything else gets nothing.
ALTER TABLE public.agent_sip_credentials ENABLE ROW LEVEL SECURITY;
