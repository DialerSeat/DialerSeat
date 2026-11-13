-- =============================================================================
-- agent_sessions is state, not a log: stop asking retention to prune it
-- =============================================================================
-- THE ALERT. "Retention halted: 1 critical issue(s). ephemeral table cascades
-- into another table (agent_sessions -> predictive_batch). Nothing was
-- deleted." Every day since 24 Sept 2026, when predictive v2 added
-- predictive_batch with ON DELETE CASCADE from agent_sessions. The check was
-- right to stop: a prune of the parent would have taken the child with it.
--
-- WHY THE FIX IS THE POLICY AND NOT THE CHECK. The obvious repair is to teach
-- retention_invariants() that a cascade between two prunable tables is fine.
-- That would have restarted a prune that should never have been running.
--
-- agent_sessions was classified ephemeral on 20 Aug ("Live dialing state. A
-- month-old session is dead by definition"), pruned at 30 days on created_at.
-- It has since become ONE ROW PER AGENT: user_id is unique, and
-- /api/dialer/heartbeat upserts the same row for as long as the agent exists.
-- created_at is the day an agent first dialed, so "older than 30 days" means
-- "every agent who has been a customer for more than a month". On 12 Nov that
-- was 13 of the 17 rows, including an agent who was ready in progressive mode
-- the same day. Deleting a live row drops the agent's call and seat state
-- mid-session, cascades into their predictive_batch, and nulls
-- calls.dial_group_id (ON DELETE SET NULL) on every call that pointed at it.
--
-- The halt had been masking that for seven weeks. Before it, the prune really
-- was deleting agents' rows as they turned 30 days old; the heartbeat put them
-- back, which is why nobody saw it.
--
-- So: kept. The table is bounded by the number of agents, not by time, the
-- same shape as agent_predictive_prefs, and there is nothing to gain by
-- pruning seventeen rows. With the parent no longer prunable, the cascade
-- into predictive_batch is no longer a back door, and the check passes
-- without being weakened.
--
-- WHAT RESUMES. The other twelve ephemeral tables go back to their declared
-- windows on the next run of /api/cron/data-retention. Overdue on 12 Nov:
-- about 540 stripe_events past 30 days and up to 397 agent_online
-- admin_notifications past 45 days. Nothing else had anything overdue.
--
-- NOT DONE HERE. predictive_batch itself is still unclassified, along with
-- twelve other tables; unclassified means kept, and classifying them is the
-- owner's call.
-- =============================================================================

update public.retention_policy
set retention_class = 'evidence',
    keep_days = null,
    notes = 'One row per agent (unique user_id), rewritten by every heartbeat. State, not a log: bounded by the number of agents. Was ephemeral at 30 days on created_at, which deleted live agents'' rows and cascaded into predictive_batch.',
    updated_at = now()
where table_name = 'agent_sessions';
