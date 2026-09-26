import { describe, it, expect } from 'vitest'
import { stillOnTheCall } from '@/lib/openCallGuard'

const open = { amd_result: null, ended_by_agent_at: null, was_abandoned: null }

describe('stillOnTheCall', () => {
  it('counts a live conversation, which is what the guard is for', () => {
    expect(stillOnTheCall(open)).toBe(true)
    expect(stillOnTheCall({ ...open, amd_result: 'human' })).toBe(true)
    expect(stillOnTheCall({ ...open, amd_result: 'not_sure' })).toBe(true)
  })

  it('does not count a voicemail sitting out its compliance hold', () => {
    // The 25 Sept regression: /api/calls/check had already told the dialer
    // this call was over, and refusing the redial made it skip lead after lead.
    expect(stillOnTheCall({ ...open, amd_result: 'machine' })).toBe(false)
    expect(stillOnTheCall({ ...open, amd_result: 'fax_detected' })).toBe(false)
  })

  it('does not count a call the agent hung up or skipped', () => {
    expect(stillOnTheCall({ ...open, ended_by_agent_at: '2026-09-25T23:48:50Z' })).toBe(false)
  })

  it('does not count a predictive leg left to its recorded message', () => {
    expect(stillOnTheCall({ ...open, was_abandoned: true })).toBe(false)
    expect(stillOnTheCall({ ...open, was_abandoned: false })).toBe(true)
  })
})
