-- Display-only phone mask, for filming ads on a demo account.
--
-- When set, every phone number that account sees on screen reads
-- 555-555-5555 (components/DemoPhoneMask). Nothing stored changes: leads,
-- calls, recordings and pool numbers keep their real values, and every other
-- account is unaffected. Turned on for John Doe (pro@dialerseat.com), the
-- internal test account, on 12 Oct 2026. To turn it off:
--   update users set demo_phone_mask = false where clerk_id = '...';

alter table public.users add column if not exists demo_phone_mask boolean not null default false;
update public.users set demo_phone_mask = true where clerk_id = 'user_3DJJGeuXcG0KuKWBMX8KuR85X4M';
