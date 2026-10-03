import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ensureSipUriCallingEnabled,
  readSipUriCallingPreference,
  resetSipUriCallingCache,
  FAILED_RECHECK_MS,
} from '@/lib/telnyxSipUriCalling'

const CONNECTION = 'connection:3010785211936933233'
const URL = 'https://api.telnyx.com/v2/credential_connections/3010785211936933233'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('SIP URI calling check', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    resetSipUriCallingCache()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('reads the documented /v2 credential connection, not the portal endpoint that now 401s', async () => {
    fetchMock.mockResolvedValue(json(200, { data: { sip_uri_calling_preference: 'internal' } }))
    expect(await readSipUriCallingPreference(CONNECTION, 'key')).toBe('internal')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(URL)
  })

  it('leaves an enabled connection alone', async () => {
    fetchMock.mockResolvedValue(json(200, { data: { sip_uri_calling_preference: 'unrestricted' } }))
    expect(await ensureSipUriCallingEnabled(CONNECTION, 'key')).toBe('already-enabled')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('turns a disabled connection to internal with a PATCH on the same resource', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { data: { sip_uri_calling_preference: 'disabled' } }))
      .mockResolvedValueOnce(json(200, { data: { sip_uri_calling_preference: 'internal' } }))
    expect(await ensureSipUriCallingEnabled(CONNECTION, 'key')).toBe('enabled')
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe(URL)
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ sip_uri_calling_preference: 'internal' })
  })

  it('remembers a success for the life of the process', async () => {
    fetchMock.mockResolvedValue(json(200, { data: { sip_uri_calling_preference: 'internal' } }))
    await ensureSipUriCallingEnabled(CONNECTION, 'key')
    await ensureSipUriCallingEnabled(CONNECTION, 'key')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not re-check a failure on every dial, only after the recheck window', async () => {
    // The 26 Sept regression: a refused check re-ran in front of every agent leg.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-26T18:41:00Z'))
    fetchMock.mockResolvedValue(json(401, { errors: [{ code: '10009' }] }))

    expect(await ensureSipUriCallingEnabled(CONNECTION, 'key')).toBe('failed')
    expect(await ensureSipUriCallingEnabled(CONNECTION, 'key')).toBe('failed')
    expect(await ensureSipUriCallingEnabled(CONNECTION, 'key')).toBe('failed')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date(Date.now() + FAILED_RECHECK_MS + 1))
    fetchMock.mockResolvedValue(json(200, { data: { sip_uri_calling_preference: 'internal' } }))
    expect(await ensureSipUriCallingEnabled(CONNECTION, 'key')).toBe('already-enabled')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
