import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabaseAdmin: {} }))

import { bareConnectionId, isAgentCredentialConnection } from '@/lib/agentLegConnection'

// agent_sip_credentials stores the id with Telnyx's "connection:" prefix; the
// webhook payload carries it bare.
const AGENTS = new Set([bareConnectionId('connection:3010785211936933233')])

describe('isAgentCredentialConnection', () => {
  it("recognises the browser side of our own agent leg by the agents' connection", () => {
    // The 26 Sept misfire: this leg arrived as 'incoming' on every dial.
    expect(isAgentCredentialConnection('3010785211936933233', AGENTS)).toBe(true)
    expect(isAgentCredentialConnection('connection:3010785211936933233', AGENTS)).toBe(true)
  })

  it('leaves a call on any other connection to the inbound handler', () => {
    // The Call Control application our numbers ring through.
    expect(isAgentCredentialConnection('3010874004966737730', AGENTS)).toBe(false)
  })

  it('treats a missing connection as not ours, so nothing changes when unsure', () => {
    expect(isAgentCredentialConnection(undefined, AGENTS)).toBe(false)
    expect(isAgentCredentialConnection('', AGENTS)).toBe(false)
    expect(isAgentCredentialConnection('3010785211936933233', new Set())).toBe(false)
  })
})
