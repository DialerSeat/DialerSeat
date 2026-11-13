import { describe, it, expect } from 'vitest'
import { prepare, search, stem, editDistance } from '@/lib/developers/search'
import { buildSearchEntries } from '@/lib/developers/searchIndex'
import { generateKey, parseKey, checkKey, crc32, keyMatchesHash, hashKey, maskKey, generateWebhookSecret } from '@/lib/developers/keys'

const index = prepare(buildSearchEntries())
const top = (q: string, n = 3) => search(index, q, n).map(r => r.entry.href)
const first = (q: string) => search(index, q, 1)[0]?.entry

describe('stem and edit distance', () => {
  it('joins plural and verb forms', () => {
    expect(stem('keys')).toBe('key')
    expect(stem('dispositions')).toBe('disposition')
    expect(stem('rotating')).toBe('rotate')
    expect(stem('policies')).toBe('policy')
  })
  it('counts typos, including a swapped pair as one', () => {
    expect(editDistance('webhok', 'webhook')).toBe(1)
    expect(editDistance('recieve', 'receive')).toBe(1)
    expect(editDistance('abc', 'xyz', 1)).toBeGreaterThan(1)
  })
})

describe('console search lands obscure queries', () => {
  const cases: [string, string | RegExp][] = [
    ['api keys', '/console/api-keys'],
    ['where do i get my token', /\/console\/api-keys|authentication/],
    ['my secret key leaked', /api-keys#secret|authentication#rotate/],
    ['rotate credentials', /authentication#rotate|api-keys/],
    ['webhok', /webhooks/],
    ['hmac verify', /webhooks#verify|webhooks#endpoints/],
    ['dswh', /webhooks/],
    ['dispostion', /dispositions/],
    ['wrap up codes', /dispositions/],
    ['predictve', /dial-modes|predictive/],
    ['give one team predictive', /dial-modes/],
    ['widget', /miniplayer/],
    ['iframe domains', /miniplayer#origins|miniplayer/],
    ['cors', /miniplayer#origins/],
    ['invoice', /billing/],
    ['how much does it cost', /billing/],
    ['volume discount', /billing#rates|sales/],
    ['go live', /billing#live/],
    ['import contacts', /campaigns-and-leads|leads/],
    ['bulk upload phone numbers', /leads/],
    ['POST /seats/{id}/sessions', /post-seats-id-sessions/],
    ['dsk_live', /authentication|api-keys/],
    ['402', /errors/],
    ['429 too many requests', /errors/],
    ['answering machine', /amd|campaign|answered|dial-modes/],
    ['call.dispositioned', /webhooks/],
    ['tcpa calling hours', /campaigns-and-leads#hours/],
    ['not a developer', /welcome/],
    ['is my subscription linked', /settings#independent|accounts#independent/],
    ['hubspot', /quickstart/],
    ['users', /seats/],
    ['single sign on', /session/],
    ['recording audio', /calls|recording/],
    ['opt out', /dnc/],
  ]
  for (const [q, want] of cases) {
    it(`"${q}"`, () => {
      const hrefs = top(q)
      const ok = hrefs.some(h => typeof want === 'string' ? h === want : want.test(h))
      expect(ok, `top results for "${q}": ${hrefs.join(', ')}`).toBe(true)
    })
  }

  it('puts the exact page first for its own name', () => {
    expect(first('Webhooks')?.href).toBe('/console/webhooks')
    expect(first('Billing')?.href).toBe('/console/billing')
    expect(first('Quickstart')?.href).toBe('/docs/quickstart')
  })

  it('returns nothing for nonsense and for an empty query', () => {
    expect(search(index, '')).toEqual([])
    expect(search(index, 'qqxzv')).toEqual([])
  })
})

describe('API keys', () => {
  it('generates DialerSeat-format keys with a valid checksum', () => {
    const sk = generateKey('secret', 'live')
    expect(sk.key).toMatch(/^dsk_live_[0-9A-Za-z]{34}$/)
    expect(parseKey(sk.key)).toEqual({ kind: 'secret', env: 'live' })
    const pk = generateKey('publishable', 'test')
    expect(pk.key).toMatch(/^dpk_test_[0-9A-Za-z]{28}$/)
    expect(parseKey(pk.key)).toEqual({ kind: 'publishable', env: 'test' })
    expect(sk.last4).toBe(sk.key.slice(-4))
  })
  it('never makes the same key twice', () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateKey('secret', 'test').key))
    expect(seen.size).toBe(500)
  })
  it('matches a key to its hash and nothing else', () => {
    const k = generateKey('secret', 'test')
    expect(k.hash).toBe(hashKey(k.key))
    expect(keyMatchesHash(k.key, k.hash)).toBe(true)
    expect(keyMatchesHash(k.key + 'x', k.hash)).toBe(false)
  })
  it('catches a typo, a short paste and a foreign key from the text alone', () => {
    const k = generateKey('secret', 'live').key
    const i = 15
    const typo = k.slice(0, i) + (k[i] === 'a' ? 'b' : 'a') + k.slice(i + 1)
    expect(checkKey(typo)).toEqual({ ok: false, reason: 'bad_checksum' })
    expect(checkKey(k.slice(0, -1))).toEqual({ ok: false, reason: 'wrong_length' })
    expect(checkKey('sk_live_' + 'a'.repeat(32))).toEqual({ ok: false, reason: 'not_a_key' })
    expect(parseKey('dsk_prod_abc')).toBeNull()
    expect(parseKey('hello')).toBeNull()
    expect(checkKey('  ' + k + '\n')).toEqual({ ok: true, key: { kind: 'secret', env: 'live' } })
  })
  it('the checksum is standard CRC32', () => {
    expect(crc32('123456789')).toBe(0xcbf43926)
  })
  it('masks and makes webhook secrets', () => {
    expect(maskKey('dsk_test_', 'Ab12')).toBe('dsk_test_••••Ab12')
    expect(generateWebhookSecret()).toMatch(/^dswh_[0-9A-Za-z]{32}$/)
  })
})
