import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import { signPayload, sampleEvent, validateWebhookUrl, isKnownEvent } from '@/lib/developers/webhooks'
import { DOCS } from '@/lib/developers/docs'
import { WEBHOOK_EVENTS } from '@/lib/developers/catalog'

// The verify() a developer copies out of the webhooks docs, run against the
// signer we deliver with. If either changes alone, this fails.
function docsVerifier(): (raw: string, header: string, secret: string) => boolean {
  const page = DOCS.find(d => d.slug === 'webhooks')!
  const block = page.blocks.find(b => b.t === 'code') as { code: string }
  const body = block.code.replace("import crypto from 'node:crypto'", '').replace('function verify', 'return function verify')
  return new Function('crypto', body)(crypto)
}

describe('webhook signatures', () => {
  const verify = docsVerifier()
  const secret = 'whsec_testsecretvalue0123456789abcd'

  it('a delivery verifies with the code in the docs', () => {
    const body = JSON.stringify(sampleEvent('call.dispositioned', 'p1'))
    expect(verify(body, signPayload(secret, body), secret)).toBe(true)
  })
  it('a changed body, a wrong secret or an old timestamp fails', () => {
    const body = JSON.stringify({ a: 1 })
    expect(verify(body + ' ', signPayload(secret, body), secret)).toBe(false)
    expect(verify(body, signPayload(secret, body), secret + 'x')).toBe(false)
    expect(verify(body, signPayload(secret, body, Math.floor(Date.now() / 1000) - 600), secret)).toBe(false)
  })
  it('every documented event has a sample payload', () => {
    for (const e of WEBHOOK_EVENTS) {
      const ev = sampleEvent(e.type, 'p1')
      expect(ev.type).toBe(e.type)
      expect(ev.livemode).toBe(false)
      expect(Object.keys(ev.data).length).toBeGreaterThan(0)
      expect(isKnownEvent(e.type)).toBe(true)
    }
    expect(isKnownEvent('call.made_up')).toBe(false)
  })
})

describe('webhook URLs', () => {
  it('accepts https and refuses everything we should not send to', () => {
    expect(validateWebhookUrl('https://api.acme.com/hooks')).toEqual({ url: 'https://api.acme.com/hooks' })
    expect('error' in validateWebhookUrl('http://acme.com/h')).toBe(true)
    expect('error' in validateWebhookUrl('https://192.168.1.5/h')).toBe(true)
    expect('error' in validateWebhookUrl('https://169.254.169.254/latest')).toBe(true)
    expect('error' in validateWebhookUrl('not a url')).toBe(true)
  })
})
