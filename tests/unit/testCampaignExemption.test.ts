import { describe, it, expect } from 'vitest'
import {
  qualifiesAsTestCampaign,
  MAX_TEST_CAMPAIGN_NUMBERS,
  TEST_CAMPAIGN_ROW_PROBE,
} from '@/lib/recentDialSuppression'

/**
 * campaigns.is_test exempts a list from the per-number attempt budget, which
 * is the rule that stops a real person being dialled more than six times. The
 * flag states intent; these assertions are the part that makes it safe, and
 * the dialer re-checks them on every dial rather than trusting the column.
 */
describe('qualifiesAsTestCampaign', () => {
  it('accepts the real case: many rows, one number the operator owns', () => {
    expect(qualifiesAsTestCampaign(true, 1)).toBe(true)
  })

  it('allows a couple of test lines', () => {
    expect(qualifiesAsTestCampaign(true, MAX_TEST_CAMPAIGN_NUMBERS)).toBe(true)
  })

  it('refuses a list that dials the public, however it is flagged', () => {
    expect(qualifiesAsTestCampaign(true, MAX_TEST_CAMPAIGN_NUMBERS + 1)).toBe(false)
    expect(qualifiesAsTestCampaign(true, 5_000)).toBe(false)
  })

  it('does nothing without the flag, however small the list', () => {
    expect(qualifiesAsTestCampaign(false, 1)).toBe(false)
  })

  it('refuses an empty campaign rather than exempting nothing at all', () => {
    expect(qualifiesAsTestCampaign(true, 0)).toBe(false)
  })

  it('refuses a count it cannot trust instead of defaulting to exempt', () => {
    // A failed probe must not read as "no numbers, therefore fine".
    expect(qualifiesAsTestCampaign(true, Number.NaN)).toBe(false)
    expect(qualifiesAsTestCampaign(true, -1)).toBe(false)
    expect(qualifiesAsTestCampaign(true, Number.POSITIVE_INFINITY)).toBe(false)
  })

  it('lapses on its own when real leads are added to a flagged campaign', () => {
    // Nobody has to remember to switch the flag off.
    expect(qualifiesAsTestCampaign(true, 1)).toBe(true)
    expect(qualifiesAsTestCampaign(true, 900)).toBe(false)
  })

  it('probes far more rows than a test list could hold', () => {
    // The probe is bounded; it has to be loose enough that a genuine test
    // list is never cut off by it.
    expect(TEST_CAMPAIGN_ROW_PROBE).toBeGreaterThan(100)
  })
})
