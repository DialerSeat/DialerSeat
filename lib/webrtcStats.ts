// =============================================================================
// WHAT THE CALL ACTUALLY SOUNDED LIKE
// =============================================================================
// "Calls sound kinda crappy" is unfalsifiable, and until now there was no way
// to make it falsifiable: nothing in this codebase recorded a single thing
// about media quality. Not the codec, not packet loss, not jitter. Three
// people can hold three theories and none of them can be wrong.
//
// ── THE CEILING, SO NOBODY CHASES PAST IT ───────────────────────────────────
// A call to a phone is 8 kHz G.711 in both directions. That is the phone
// network, not a setting, and no browser option beats it. So the question is
// never "why isn't this HD", it is "what is making this WORSE than narrowband",
// and there are only a few candidates:
//
//   TRANSCODING   If the browser negotiates Opus, Telnyx must convert to G.711
//                 for the PSTN leg and back. Each conversion costs quality, so
//                 on a PSTN-bridged call the "worse" codec (PCMU) can sound
//                 BETTER, because it passes through untouched. `codec` below
//                 is what settles which of those is happening.
//   PACKET LOSS   Above ~2% is audible as dropouts and robot voice. This is
//                 the agent's network and no codec choice fixes it.
//   JITTER        Above ~30ms the jitter buffer stretches and audio warbles.
//   AGC / NS      Chrome's noise suppression is on by default and is a common
//                 cause of "underwater" voices on a headset mic in a noisy
//                 room. Reported here so it can be correlated rather than
//                 argued about.
//
// ── PURE ON PURPOSE ─────────────────────────────────────────────────────────
// This takes an RTCStatsReport-shaped thing and returns numbers. No browser
// APIs, no network, no React — so it is unit-testable, which the rest of the
// WebRTC path is not. The caller does the sampling and the posting.

export interface CallAudioStats {
  /** Codec actually negotiated for the audio we RECEIVE, e.g. 'opus', 'PCMU'. */
  codec: string | null
  /** Clock rate of that codec. 8000 is narrowband, 48000 is wideband. */
  clockRate: number | null
  /** Inbound packet loss as a percentage of expected packets. */
  inboundLossPct: number | null
  /** Outbound packet loss, as reported by the far side. */
  outboundLossPct: number | null
  /** Inbound jitter in milliseconds. */
  jitterMs: number | null
  /** Round-trip time in milliseconds. */
  rttMs: number | null
  /** Seconds of audio received. Zero on a call that never carried media. */
  inboundSeconds: number | null
  /** How the media path was established: 'host', 'srflx', 'relay'. */
  candidateType: string | null
}

type StatLike = Record<string, unknown>

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * Pull the handful of numbers that matter out of a getStats() report.
 *
 * Tolerant by design: browsers disagree about which fields exist and a missing
 * one must produce null rather than throwing. A diagnostic that can break a
 * live call is worse than no diagnostic.
 */
export function extractCallAudioStats(
  report: Iterable<StatLike> | Map<string, StatLike>
): CallAudioStats {
  const out: CallAudioStats = {
    codec: null, clockRate: null,
    inboundLossPct: null, outboundLossPct: null,
    jitterMs: null, rttMs: null,
    inboundSeconds: null, candidateType: null,
  }

  const all: StatLike[] = []
  try {
    // A real RTCStatsReport is a Map; tests pass a plain array.
    if (report instanceof Map) report.forEach(v => all.push(v))
    else for (const v of report as Iterable<StatLike>) all.push(v)
  } catch {
    return out
  }

  const byId = new Map<string, StatLike>()
  for (const s of all) {
    const id = s.id
    if (typeof id === 'string') byId.set(id, s)
  }

  const inbound = all.find(s => s.type === 'inbound-rtp' && s.kind === 'audio')
  const outbound = all.find(s => s.type === 'outbound-rtp' && s.kind === 'audio')
  const remoteInbound = all.find(s => s.type === 'remote-inbound-rtp' && s.kind === 'audio')
  const pair = all.find(s => s.type === 'candidate-pair' && (s.nominated === true || s.state === 'succeeded'))

  if (inbound) {
    const lost = num(inbound.packetsLost)
    const received = num(inbound.packetsReceived)
    // Denominator is EXPECTED packets (received + lost), not received. Using
    // received alone understates loss exactly when loss is worst.
    if (lost !== null && received !== null && received + lost > 0) {
      out.inboundLossPct = round2((lost / (received + lost)) * 100)
    }
    // jitter is reported in SECONDS by the spec, and read as milliseconds by
    // almost everyone who has ever used it. Converted here, once.
    const j = num(inbound.jitter)
    if (j !== null) out.jitterMs = round2(j * 1000)

    const secs = num(inbound.totalSamplesDuration)
    if (secs !== null) out.inboundSeconds = round2(secs)

    const codecId = inbound.codecId
    if (typeof codecId === 'string') {
      const codec = byId.get(codecId)
      if (codec) {
        const mime = codec.mimeType
        // 'audio/PCMU' -> 'PCMU'
        if (typeof mime === 'string') out.codec = mime.split('/').pop() || mime
        out.clockRate = num(codec.clockRate)
      }
    }
  }

  if (remoteInbound) {
    // The far side's view of what WE sent. The only window onto the direction
    // the prospect hears, which is half the question and is otherwise invisible.
    const lost = num(remoteInbound.packetsLost)
    const sent = outbound ? num(outbound.packetsSent) : null
    if (lost !== null && sent !== null && sent > 0) {
      out.outboundLossPct = round2((lost / sent) * 100)
    }
    const rtt = num(remoteInbound.roundTripTime)
    if (rtt !== null) out.rttMs = round2(rtt * 1000)
  }

  if (pair) {
    if (out.rttMs === null) {
      const rtt = num(pair.currentRoundTripTime)
      if (rtt !== null) out.rttMs = round2(rtt * 1000)
    }
    const localId = pair.localCandidateId
    if (typeof localId === 'string') {
      const cand = byId.get(localId)
      const t = cand?.candidateType
      if (typeof t === 'string') out.candidateType = t
    }
  }

  return out
}

/**
 * Is this call's audio measurably degraded, and in one phrase, why?
 *
 * Returns null when nothing is wrong, so a caller can log only the interesting
 * ones. Thresholds are the conventional audibility points, named here rather
 * than buried in a condition.
 */
export function describeAudioProblem(s: CallAudioStats): string | null {
  const parts: string[] = []
  if (s.inboundLossPct !== null && s.inboundLossPct >= 2) {
    parts.push(`${s.inboundLossPct}% inbound packet loss (agent hears dropouts)`)
  }
  if (s.outboundLossPct !== null && s.outboundLossPct >= 2) {
    parts.push(`${s.outboundLossPct}% outbound packet loss (prospect hears dropouts)`)
  }
  if (s.jitterMs !== null && s.jitterMs >= 30) {
    parts.push(`${s.jitterMs}ms jitter (warbling)`)
  }
  if (s.rttMs !== null && s.rttMs >= 300) {
    parts.push(`${s.rttMs}ms round trip (people talk over each other)`)
  }
  if (s.candidateType === 'relay') {
    // A relayed path means media is going through TURN rather than directly.
    // Adds latency and a failure point; worth knowing when it happens.
    parts.push('media relayed through TURN rather than a direct path')
  }
  return parts.length > 0 ? parts.join('; ') : null
}

function round2(n: number): number { return Math.round(n * 100) / 100 }
