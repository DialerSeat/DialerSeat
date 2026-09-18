import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isDialableLead, DIALABLE_STATUSES } from '@/lib/dialableLead'

/**
 * The narrow queue payload has to carry every column the dialer's own
 * eligibility check reads.
 *
 * It did not. `status` was dropped when the payload was narrowed to cut
 * Supabase egress, and nothing failed: DialabilityInput.status is optional, so
 * it compiled, and isDialableLead simply returned false for every lead. The
 * queue panel splits on that result and only sorts the dialable group, so with
 * the group empty the rotation had nothing to order and the lead just dialled
 * stayed at the top of the list. Dialing still advanced, because
 * /api/leads/next checks eligibility server-side against full rows.
 *
 * Asserted against the route's source text because the constant is written out
 * there by hand, on purpose — see the comment above it.
 */
const QUEUE_FIELDS_SOURCE = readFileSync(
  join(process.cwd(), 'app/api/leads/list/route.ts'),
  'utf-8'
)

function selectedQueueFields(): string[] {
  const match = QUEUE_FIELDS_SOURCE.match(/const QUEUE_FIELDS\s*=\s*([\s\S]*?)\n\s*const /)
  if (!match) throw new Error('QUEUE_FIELDS not found in app/api/leads/list/route.ts')
  return [...match[1].matchAll(/'([^']*)'/g)]
    .map(m => m[1])
    .join('')
    .split(',')
    .map(f => f.trim())
    .filter(Boolean)
}

describe('narrow queue payload', () => {
  it('carries every column isDialableLead reads', () => {
    // Each of these, if absent, silently makes a lead look undialable.
    for (const column of ['status', 'disposition', 'phone', 'dial_attempts']) {
      expect(selectedQueueFields()).toContain(column)
    }
  })

  it('carries the column queue rotation sorts on', () => {
    expect(selectedQueueFields()).toContain('last_called_at')
  })

  it('a lead shaped like the payload is dialable, not silently excluded', () => {
    // Exactly what the narrow select returns for a fresh lead.
    const fromQueue = {
      id: 'lead-1',
      phone: '+15551234567',
      dial_attempts: 0,
      disposition: null,
      last_called_at: null,
      status: 'uncalled',
    }
    expect(isDialableLead(fromQueue)).toBe(true)
  })

  it('demonstrates the regression: no status means nothing is dialable', () => {
    const withoutStatus = {
      id: 'lead-1',
      phone: '+15551234567',
      dial_attempts: 0,
      disposition: null,
      last_called_at: null,
    }
    expect(isDialableLead(withoutStatus)).toBe(false)
  })

  it('accepts every status the dialer considers dialable', () => {
    for (const status of DIALABLE_STATUSES) {
      expect(isDialableLead({ phone: '+15551234567', dial_attempts: 0, status })).toBe(true)
    }
  })
})
