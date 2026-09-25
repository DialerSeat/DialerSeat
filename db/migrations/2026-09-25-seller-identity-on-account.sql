-- =============================================================================
-- THE PREDICTIVE MESSAGE'S TWO DETAILS LIVE ON THE ACCOUNT
-- =============================================================================
-- When two people answer at once and no agent is free, 16 CFR 310.4(b)(4)(iii)
-- and 47 CFR 64.1200(a)(7)(i) require a short recorded message naming the
-- seller and a number to call back. The seller is the business, so the two
-- details belong to the account, not to each campaign (Joshua, 25 Sept 2026:
-- "not something for individual campaigns"). A team campaign uses its owner's.
--
-- Predictive is gated on them: /api/campaigns/update and /create refuse
-- predictive without them, /api/dialer/arm refuses to start, and the
-- controller will not dial. The dialer asks for them in a popup.
--
-- campaigns.tsr_seller_name / tsr_callback_number are no longer read. Every
-- campaign had both NULL when this shipped, so there was nothing to carry over.
-- =============================================================================

alter table public.users
  add column if not exists tsr_seller_name text,
  add column if not exists tsr_callback_number text;

comment on column public.users.tsr_seller_name is
  'Business name spoken in the predictive abandon message (16 CFR 310.4(b)(4)(iii)). Set in Settings.';
comment on column public.users.tsr_callback_number is
  'Callback number spoken in the predictive abandon message, E.164. Set in Settings.';

-- Predictive runs 2 or 3 lines per agent (Joshua, 25 Sept 2026: "either 2
-- lines or 3 lines. not 1"). The platform ceiling was 2, which made 3
-- unreachable. The law still decides below that: lib/predictive/pacing.
update public.platform_config set predictive_line_ceiling = 3
  where predictive_line_ceiling < 3;
