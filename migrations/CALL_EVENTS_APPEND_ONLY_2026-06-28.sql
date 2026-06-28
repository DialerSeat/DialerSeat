-- Make call_events truly append-only at the privilege level (applied live).
REVOKE UPDATE, DELETE, TRUNCATE ON public.call_events FROM service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.call_events FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.call_events FROM authenticated;
-- Result: service_role = INSERT+SELECT only; anon/authenticated = SELECT only;
-- postgres retains full control for retention/maintenance.
