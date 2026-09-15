import { describe, it, expect } from 'vitest'
import { extractCallAudioStats, describeAudioProblem } from '@/lib/webrtcStats'

// =============================================================================
// THE POINT IS TO MAKE "SOUNDS CRAPPY" FALSIFIABLE
// =============================================================================
// Nothing in this codebase recorded anything about media quality, so every
// theory about audio was equally unprovable. These tests pin the arithmetic,
// because a diagnostic that reports the wrong number is worse than none: it
// sends somebody to fix the wrong thing with confidence.

const codec = (id: string, mime: string, clockRate: number) =>
  ({ id, type: 'codec', mimeType: mime, clockRate })

describe('the codec, which is what settles the transcoding question', () => {
  it('reads PCMU and its narrowband clock rate', () => {
    // PCMU at 8k means the browser is speaking the PSTN's own codec, so
    // there is no transcode on the way to the phone.
    const s = extractCallAudioStats([
      codec('c1', 'audio/PCMU', 8000),
      { type: 'inbound-rtp', kind: 'audio', codecId: 'c1' },
    ])
    expect(s.codec).toBe('PCMU')
    expect(s.clockRate).toBe(8000)
  })

  it('reads opus and its wideband clock rate', () => {
    // Opus at 48k on a PSTN-bridged call means Telnyx is transcoding both
    // ways, which is the case worth knowing about.
    const s = extractCallAudioStats([
      codec('c1', 'audio/opus', 48000),
      { type: 'inbound-rtp', kind: 'audio', codecId: 'c1' },
    ])
    expect(s.codec).toBe('opus')
    expect(s.clockRate).toBe(48000)
  })

  it('survives a codec the report never included', () => {
    const s = extractCallAudioStats([
      { type: 'inbound-rtp', kind: 'audio', codecId: 'missing' },
    ])
    expect(s.codec).toBeNull()
    expect(s.clockRate).toBeNull()
  })
})

describe('packet loss is measured against EXPECTED packets', () => {
  it('divides by received + lost, not by received', () => {
    // 90 arrived, 10 were lost: 100 were expected, so 10%. Dividing by
    // received gives 11.1% and overstates exactly when loss is worst.
    const s = extractCallAudioStats([
      { type: 'inbound-rtp', kind: 'audio', packetsReceived: 90, packetsLost: 10 },
    ])
    expect(s.inboundLossPct).toBe(10)
  })

  it('reports a clean call as zero rather than null', () => {
    const s = extractCallAudioStats([
      { type: 'inbound-rtp', kind: 'audio', packetsReceived: 500, packetsLost: 0 },
    ])
    expect(s.inboundLossPct).toBe(0)
  })

  it('reports the direction the PROSPECT hears, from the far side', () => {
    // remote-inbound-rtp is the only window onto our outbound quality. Without
    // it, half the question -- "does the prospect hear us badly?" -- is
    // invisible, which is the half a dialer cares most about.
    const s = extractCallAudioStats([
      { type: 'outbound-rtp', kind: 'audio', packetsSent: 1000 },
      { type: 'remote-inbound-rtp', kind: 'audio', packetsLost: 30, roundTripTime: 0.12 },
    ])
    expect(s.outboundLossPct).toBe(3)
    expect(s.rttMs).toBe(120)
  })

  it('does not divide by zero on a call that sent nothing', () => {
    const s = extractCallAudioStats([
      { type: 'inbound-rtp', kind: 'audio', packetsReceived: 0, packetsLost: 0 },
      { type: 'outbound-rtp', kind: 'audio', packetsSent: 0 },
      { type: 'remote-inbound-rtp', kind: 'audio', packetsLost: 0 },
    ])
    expect(s.inboundLossPct).toBeNull()
    expect(s.outboundLossPct).toBeNull()
  })
})

describe('units, because both of these are reported in seconds', () => {
  it('converts jitter from seconds to milliseconds', () => {
    const s = extractCallAudioStats([
      { type: 'inbound-rtp', kind: 'audio', jitter: 0.045 },
    ])
    expect(s.jitterMs).toBe(45)
  })

  it('converts round trip time from seconds to milliseconds', () => {
    const s = extractCallAudioStats([
      { type: 'candidate-pair', nominated: true, currentRoundTripTime: 0.25 },
    ])
    expect(s.rttMs).toBe(250)
  })
})

describe('how the media path was established', () => {
  it('names a relayed path, which adds latency and a failure point', () => {
    const s = extractCallAudioStats([
      { type: 'candidate-pair', state: 'succeeded', localCandidateId: 'l1' },
      { id: 'l1', type: 'local-candidate', candidateType: 'relay' },
    ])
    expect(s.candidateType).toBe('relay')
  })
})

describe('it fails quiet, because this rides on a live call', () => {
  it('returns all-null for an empty report rather than throwing', () => {
    const s = extractCallAudioStats([])
    expect(s.codec).toBeNull()
    expect(s.inboundLossPct).toBeNull()
    expect(s.rttMs).toBeNull()
  })

  it('ignores malformed entries instead of crashing on them', () => {
    const s = extractCallAudioStats([
      { type: 'inbound-rtp', kind: 'audio', packetsReceived: 'lots', packetsLost: null },
      { type: 'nonsense' },
    ] as unknown as Array<Record<string, unknown>>)
    expect(s.inboundLossPct).toBeNull()
  })

  it('accepts a real RTCStatsReport-shaped Map', () => {
    const m = new Map<string, Record<string, unknown>>([
      ['c1', codec('c1', 'audio/PCMU', 8000)],
      ['i1', { type: 'inbound-rtp', kind: 'audio', codecId: 'c1', packetsReceived: 99, packetsLost: 1 }],
    ])
    const s = extractCallAudioStats(m)
    expect(s.codec).toBe('PCMU')
    expect(s.inboundLossPct).toBe(1)
  })
})

describe('describeAudioProblem only speaks when something is wrong', () => {
  const clean = extractCallAudioStats([
    codec('c1', 'audio/PCMU', 8000),
    { type: 'inbound-rtp', kind: 'audio', codecId: 'c1', packetsReceived: 1000, packetsLost: 2, jitter: 0.008 },
  ])

  it('says nothing about a healthy call', () => {
    expect(describeAudioProblem(clean)).toBeNull()
  })

  it('names inbound loss as what the AGENT hears', () => {
    const s = { ...clean, inboundLossPct: 6 }
    expect(describeAudioProblem(s)).toContain('agent hears')
  })

  it('names outbound loss as what the PROSPECT hears', () => {
    const s = { ...clean, outboundLossPct: 5 }
    expect(describeAudioProblem(s)).toContain('prospect hears')
  })

  it('reports every problem at once rather than only the first', () => {
    const s = { ...clean, inboundLossPct: 5, jitterMs: 60, rttMs: 400 }
    const msg = describeAudioProblem(s) || ''
    expect(msg).toContain('packet loss')
    expect(msg).toContain('jitter')
    expect(msg).toContain('round trip')
  })

  it('stays quiet just under each threshold', () => {
    expect(describeAudioProblem({ ...clean, inboundLossPct: 1.9 })).toBeNull()
    expect(describeAudioProblem({ ...clean, jitterMs: 29 })).toBeNull()
    expect(describeAudioProblem({ ...clean, rttMs: 299 })).toBeNull()
  })
})
