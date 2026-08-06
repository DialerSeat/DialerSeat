import { describe, it, expect } from 'vitest'
import { presignedStillValid } from '../../lib/telnyxRecording'

// A real URL shape from the calls table — the thing that was being stored and
// played back hours later. X-Amz-Expires=600 is the whole bug in one param.
const SIGNED_AT = Date.parse('2026-08-05T11:20:18Z')
const url = (params: string) =>
  `https://s3.amazonaws.com/telephony-recorder-prod/abc/2026-08-05/rec.mp3?${params}`

const live = url('X-Amz-Date=20260805T112018Z&X-Amz-Expires=600&X-Amz-Signature=deadbeef')

describe('presignedStillValid', () => {
  it('accepts a URL inside its window', () => {
    expect(presignedStillValid(live, SIGNED_AT + 60_000)).toBe(true)
  })

  it('rejects it once the 10 minutes are up', () => {
    expect(presignedStillValid(live, SIGNED_AT + 601_000)).toBe(false)
  })

  it('rejects inside the 30s safety margin, so nothing dies mid-stream', () => {
    expect(presignedStillValid(live, SIGNED_AT + 580_000)).toBe(false)
  })

  it('rejects the hours-later case that produced 0:00 / 0:00', () => {
    expect(presignedStillValid(live, SIGNED_AT + 6 * 60 * 60 * 1000)).toBe(false)
  })

  it('rejects a URL with no expiry information rather than assuming it works', () => {
    expect(presignedStillValid(url('X-Amz-Signature=deadbeef'), SIGNED_AT)).toBe(false)
  })

  it('rejects garbage instead of throwing', () => {
    expect(presignedStillValid('not-a-url')).toBe(false)
    expect(presignedStillValid(url('X-Amz-Date=nonsense&X-Amz-Expires=600'))).toBe(false)
  })
})
