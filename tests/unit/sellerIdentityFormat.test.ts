import { describe, it, expect } from 'vitest'
import {
  normalizeCallbackNumber,
  formatCallbackNumber,
  checkSellerIdentity,
} from '@/lib/sellerIdentityFormat'
import { canRunMultiLine } from '@/lib/tsrAbandonMessage'

describe('normalizeCallbackNumber', () => {
  it('accepts ten digits in any common format', () => {
    expect(normalizeCallbackNumber('(800) 555-1234')).toBe('+18005551234')
    expect(normalizeCallbackNumber('800.555.1234')).toBe('+18005551234')
    expect(normalizeCallbackNumber('+1 800 555 1234')).toBe('+18005551234')
    expect(normalizeCallbackNumber('18005551234')).toBe('+18005551234')
  })

  it('refuses what nobody could call back', () => {
    expect(normalizeCallbackNumber('555-1234')).toBeNull()
    expect(normalizeCallbackNumber('(100) 555-1234')).toBeNull() // area code starts 1
    expect(normalizeCallbackNumber('(800) 055-1234')).toBeNull() // exchange starts 0
    expect(normalizeCallbackNumber('(411) 555-1234')).toBeNull() // N11 service code
    expect(normalizeCallbackNumber('(900) 555-1234')).toBeNull() // premium rate
    expect(normalizeCallbackNumber('')).toBeNull()
  })
})

describe('formatCallbackNumber', () => {
  it('shows a stored number the way people write it', () => {
    expect(formatCallbackNumber('+18005551234')).toBe('(800) 555-1234')
    expect(formatCallbackNumber(null)).toBe('')
  })
})

describe('checkSellerIdentity', () => {
  it('saves a complete pair, cleaned up', () => {
    const r = checkSellerIdentity('  Acme   Insurance ', '800-555-1234')
    expect(r).toEqual({ ok: true, name: 'Acme Insurance', callbackNumber: '+18005551234' })
  })

  it('clears when both are empty', () => {
    expect(checkSellerIdentity('', '')).toEqual({ ok: true, name: null, callbackNumber: null })
  })

  it('refuses half a pair', () => {
    expect(checkSellerIdentity('Acme', '').ok).toBe(false)
    expect(checkSellerIdentity('', '8005551234').ok).toBe(false)
  })

  it('refuses a name too long to say', () => {
    expect(checkSellerIdentity('x'.repeat(81), '8005551234').ok).toBe(false)
  })

  it('stores exactly what the message builder accepts', () => {
    const r = checkSellerIdentity('Acme Insurance', '(800) 555-1234')
    if (!r.ok) throw new Error('expected ok')
    expect(canRunMultiLine({ name: r.name, callbackNumber: r.callbackNumber })).toBe(true)
  })
})
