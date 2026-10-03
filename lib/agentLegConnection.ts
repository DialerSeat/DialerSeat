import { supabaseAdmin } from '@/lib/supabase'

// =============================================================================
// IS THIS THE BROWSER SIDE OF ONE OF OUR OWN AGENT CALLS?
// =============================================================================
// Every agent leg we dial goes to an agent's SIP URI on the agents' SIP
// credential connection, and Telnyx reports that side's call.initiated as
// direction 'incoming', with no client_state of ours on it. The inbound
// handler in app/api/calls/events took it for a stranger calling in and sent
// `answer`, on every dial: 45 dials on 26 Sept, 45 refusals from Telnyx,
// "Can not issue an answer command on an outbound call". Harmless, since
// Telnyx refused each one, but a wasted round trip and an error per dial.
//
// A person ringing one of our numbers arrives on that number's connection,
// never on the agents' credential connection, so the connection is a positive
// sign of our own leg: the kind of test the 14 Sept note in the events route
// asks for, instead of reading direction alone.
// =============================================================================

export function bareConnectionId(id: string): string {
  return String(id).replace(/^connection:/, '')
}

export function isAgentCredentialConnection(
  connectionId: string | null | undefined,
  agentConnectionIds: ReadonlySet<string>
): boolean {
  if (!connectionId) return false
  return agentConnectionIds.has(bareConnectionId(connectionId))
}

const CACHE_MS = 10 * 60 * 1000
let cache: { ids: Set<string>; expires: number } | null = null

/**
 * Unknown counts as not ours: a failed read leaves the caller doing exactly
 * what it did before this existed.
 */
export async function isOwnAgentLegConnection(connectionId: string | null | undefined): Promise<boolean> {
  if (!connectionId) return false
  if (!cache || cache.expires < Date.now()) {
    const { data, error } = await supabaseAdmin.from('agent_sip_credentials').select('connection_id')
    if (error) {
      console.error('[agentLegConnection] could not read the agents\' credential connections', error)
      return false
    }
    const ids = new Set<string>()
    for (const row of (data || []) as Array<{ connection_id: string | null }>) {
      if (row.connection_id) ids.add(bareConnectionId(row.connection_id))
    }
    cache = { ids, expires: Date.now() + CACHE_MS }
  }
  return isAgentCredentialConnection(connectionId, cache.ids)
}
