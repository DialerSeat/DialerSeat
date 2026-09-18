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
export function reachedAHuman(
  amdResult: string | null | undefined,
  connected: boolean,
  isMachine: boolean
): boolean {
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
