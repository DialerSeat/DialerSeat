/**
 * Did this call reach an actual person?
 *
 * The repeat setting hangs off this one question. 1x/2x/3x exist to chase
 * people who did not answer; a conversation ends the sequence whatever the
 * setting says, and a voicemail does not.
 *
 * It has been got wrong in both directions. First by not asking at all, so a
 * lead the agent had just spoken to was dialled straight back on 2x. Then by
 * treating "the call connected" as the answer — but a voicemail ANSWERS. The
 * carrier connects, the client stamps its call-start, and AMD returns its
 * machine verdict only afterwards, so every AMD-detected voicemail looked
 * like a conversation and 2x and 3x silently behaved like 1x for the one
 * outcome they are actually for.
 *
 * The machine verdict is therefore decisive and is checked first. The robot
 * vocabulary is not repeated here — the caller passes the verdict in, so this
 * cannot drift out of step with the AMD result list the way a second copy
 * would.
 */
/**
 * Our own plumbing failing is not the prospect answering.
 *
 * The server writes AGENT_LEG_FAILED when the call never reached the agent's
 * headset. The lead's phone may genuinely have been answered — the client can
 * see the call connect and stamp its call-start — but there was nobody on our
 * end, so it is not a pickup and the repeat sequence must not treat it as one.
 * lib/recentDialSuppression already refuses to spend one of the prospect's six
 * attempts on these; this is the same judgement applied to the repeat setting.
 */
export function agentLegFailed(disposition: string | null | undefined): boolean {
  return disposition === 'AGENT_LEG_FAILED'
}

export function reachedAHuman(
  amdResult: string | null | undefined,
  connected: boolean,
  isMachine: boolean,
  disposition?: string | null
): boolean {
  // Nobody was on our end, so nobody was reached.
  if (agentLegFailed(disposition)) return false
  // A machine is not a person however long it talked, and however cleanly the
  // media connected.
  if (isMachine) return false
  // Telnyx saying so is sufficient on its own.
  if (amdResult === 'human') return true
  // Otherwise fall back to what this client observed. A call that never
  // reached a verdict and never connected is the no-answer case, and that is
  // exactly what should be redialled.
  return connected
}

/**
 * Should this lead be dialled again rather than rotated away?
 *
 * `alreadyQueued` is the interlock that stops two ending paths both queueing
 * a redial for the same lead; without it a single call could chain two.
 */
export function shouldRedial(params: {
  reachedAHuman: boolean
  alreadyQueued: boolean
  attemptsSoFar: number
  maxAttempts: number
}): boolean {
  if (params.reachedAHuman) return false
  if (params.alreadyQueued) return false
  return params.attemptsSoFar < params.maxAttempts
}

/**
 * A lead handed back immediately is the same pass, not a new one.
 *
 * ── WHY 2x PRODUCED FOUR DIALS ─────────────────────────────────────────
 * The attempt counter was reset unconditionally every time fetchNextLead
 * returned. When rotation fails and the server hands back the lead just
 * worked, that reset starts its budget over: two attempts, sequence ends
 * without rotating, same lead returned, two more. Four dials in 69 seconds on
 * a campaign set to 2x, with the lead's dial_attempts still reading 1.
 *
 * /api/leads/next names this exact shape in its own comments — client retries
 * multiplying against server passes — and says it has to be fixed where the
 * multiplication happens. This is that place.
 *
 * The counter is therefore reset when the queue moves on to somebody else, or
 * when enough time has passed that this is genuinely a later pass over the
 * list. Time matters because of the small-queue case: a queue holding one
 * dialable lead legitimately serves it again, and keying only on identity
 * would refuse it for the rest of the shift.
 */
export const SAME_PASS_WINDOW_MS = 2 * 60 * 1000

export function shouldResetAttemptCount(params: {
  leadId: string
  lastServedLeadId: string | null
  /** When this lead was last dialled, ms since epoch. 0 if never. */
  lastDialedAt: number
  /**
   * Defaults to the current time. Read here rather than at the call site so
   * the caller stays free of a clock read — the dialer's callers live in the
   * component body, where react-hooks/purity rejects one — while tests still
   * pin it explicitly.
   */
  now?: number
  windowMs?: number
}): boolean {
  const now = params.now ?? Date.now()
  const windowMs = params.windowMs ?? SAME_PASS_WINDOW_MS
  // A different lead is unambiguously a new sequence.
  if (params.leadId !== params.lastServedLeadId) return true
  // Same lead, never dialled by this session — nothing to continue.
  if (!params.lastDialedAt) return true
  // Same lead, and long enough ago to be a real second pass rather than the
  // queue handing back what it just gave us.
  return now - params.lastDialedAt >= windowMs
}
