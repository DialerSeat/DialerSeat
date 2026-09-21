import { describe, it, expect } from 'vitest'
import {
  recordAgentLegOutcome,
  needsReregister,
  AGENT_LEG_WINDOW,
  AGENT_LEG_STREAK_LIMIT,
} from '@/lib/agentLegHealth'

const F = true, OK = false
const hist = (...v: boolean[]) => v

describe('recordAgentLegOutcome', () => {
  it('keeps only the most recent window', () => {
    let h: boolean[] = []
    for (let i = 0; i < AGENT_LEG_WINDOW + 5; i++) h = recordAgentLegOutcome(h, false)
    expect(h).toHaveLength(AGENT_LEG_WINDOW)
  })

  it('does not mutate what it is given', () => {
    const before = hist(OK)
    recordAgentLegOutcome(before, true)
    expect(before).toEqual([OK])
  })
})

describe('needsReregister', () => {
  it('still catches a registration that died outright', () => {
    expect(needsReregister({ consecutiveFailures: AGENT_LEG_STREAK_LIMIT, history: [] })).toBe(true)
  })

  it('catches the SCATTERED failures a streak never saw', () => {
    // Omar's shape: one in five failing, never two in a row. The streak is
    // cleared by every success between them and stayed at 1 forever.
    const scattered = hist(F, OK, OK, OK, F, OK, OK, OK, F, OK)
    expect(needsReregister({ consecutiveFailures: 1, history: scattered })).toBe(true)
  })

  it('leaves a healthy agent alone', () => {
    // Esteban's shape: 0.7%.
    const healthy = hist(OK, OK, OK, OK, OK, OK, OK, OK, OK, F)
    expect(needsReregister({ consecutiveFailures: 0, history: healthy })).toBe(false)
  })

  it('tolerates ordinary noise at the healthy rate', () => {
    const noisy = hist(OK, F, OK, OK, OK, OK, F, OK, OK, OK)
    expect(needsReregister({ consecutiveFailures: 0, history: noisy })).toBe(false)
  })

  it('does not judge a rate before there is enough to judge', () => {
    // Two failures in the first three dials is not evidence, and firing here
    // would interrupt an agent who is fine.
    expect(needsReregister({ consecutiveFailures: 1, history: hist(F, OK, F) })).toBe(false)
  })

  it('fires once the window has filled and the rate holds', () => {
    expect(needsReregister({ consecutiveFailures: 1, history: hist(F, OK, F, OK, F, OK) })).toBe(true)
  })
})
