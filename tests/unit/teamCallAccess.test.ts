import { describe, it, expect } from 'vitest'
import { canAccessCall } from '@/lib/teamCallAccess'

// =============================================================================
// This rule decides whether one person may listen to a recording of another
// person's phone call, so the cases that matter are the ones where it should
// say no. Each test names the condition being removed.
//
// The supabase client is faked rather than mocked through a library: the code
// makes exactly three reads and the shape of each is fixed, so a small stand-in
// is clearer than a mocking framework and cannot drift into passing for the
// wrong reason.
// =============================================================================

interface Member { team_id: string; user_id: string | null; status?: string | null; removed_at?: string | null }
interface Attach { team_id: string; campaign_id: string | null }

function fakeSupabase(world: {
  teams: Array<{ id: string; owner_id: string }>
  members: Member[]
  campaigns: Attach[]
}) {
  return {
    from(table: string) {
      return {
        select() {
          return {
            // teams: .eq('owner_id', viewer)
            eq(_col: string, value: string) {
              return Promise.resolve({
                data: world.teams.filter(t => t.owner_id === value).map(t => ({ id: t.id })),
              })
            },
            // members and campaigns: .in('team_id', ids)
            in(_col: string, ids: string[]) {
              const rows = table === 'team_members'
                ? world.members.filter(m => ids.includes(m.team_id))
                : world.campaigns.filter(c => ids.includes(c.team_id))
              return Promise.resolve({ data: rows })
            },
          }
        },
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

const OWNER = 'user_owner'
const AGENT = 'user_agent'
const STRANGER = 'user_stranger'
const CAMPAIGN = 'camp_team'
const OTHER_CAMPAIGN = 'camp_personal'

/** One team: OWNER owns it, AGENT dials for it, CAMPAIGN is attached. */
const simple = fakeSupabase({
  teams: [{ id: 'team_a', owner_id: OWNER }],
  members: [{ team_id: 'team_a', user_id: AGENT, status: 'active', removed_at: null }],
  campaigns: [{ team_id: 'team_a', campaign_id: CAMPAIGN }],
})

describe('canAccessCall: your own calls', () => {
  it('lets anyone open a call they made themselves', async () => {
    const db = fakeSupabase({ teams: [], members: [], campaigns: [] })
    expect(await canAccessCall(db, STRANGER, { user_id: STRANGER, campaign_id: null }))
      .toBe(true)
  })
})

describe('canAccessCall: the three conditions', () => {
  it('lets an owner open their agent’s call on the team’s campaign', async () => {
    expect(await canAccessCall(simple, OWNER, { user_id: AGENT, campaign_id: CAMPAIGN }))
      .toBe(true)
  })

  it('refuses when the campaign is not the team’s', async () => {
    // The agent's own personal campaign. Theirs, not the team's business.
    expect(await canAccessCall(simple, OWNER, { user_id: AGENT, campaign_id: OTHER_CAMPAIGN }))
      .toBe(false)
  })

  it('refuses when the dialer is not a member of the team', async () => {
    // A stranger who happened to dial the team's campaign.
    expect(await canAccessCall(simple, OWNER, { user_id: STRANGER, campaign_id: CAMPAIGN }))
      .toBe(false)
  })

  it('refuses somebody who owns no team at all', async () => {
    expect(await canAccessCall(simple, STRANGER, { user_id: AGENT, campaign_id: CAMPAIGN }))
      .toBe(false)
  })
})

describe('canAccessCall: members who have left', () => {
  it('refuses a removed member’s calls, by status', async () => {
    const db = fakeSupabase({
      teams: [{ id: 'team_a', owner_id: OWNER }],
      members: [{ team_id: 'team_a', user_id: AGENT, status: 'removed', removed_at: null }],
      campaigns: [{ team_id: 'team_a', campaign_id: CAMPAIGN }],
    })
    expect(await canAccessCall(db, OWNER, { user_id: AGENT, campaign_id: CAMPAIGN })).toBe(false)
  })

  it('refuses a removed member’s calls, by removed_at, even if status disagrees', async () => {
    // The two are written together today. Where they disagree the rule has to
    // fall to the side that grants less.
    const db = fakeSupabase({
      teams: [{ id: 'team_a', owner_id: OWNER }],
      members: [{ team_id: 'team_a', user_id: AGENT, status: 'active', removed_at: '2026-09-01T00:00:00Z' }],
      campaigns: [{ team_id: 'team_a', campaign_id: CAMPAIGN }],
    })
    expect(await canAccessCall(db, OWNER, { user_id: AGENT, campaign_id: CAMPAIGN })).toBe(false)
  })

  it('allows a pending member, who is dialing on a seat being paid for', async () => {
    const db = fakeSupabase({
      teams: [{ id: 'team_a', owner_id: OWNER }],
      members: [{ team_id: 'team_a', user_id: AGENT, status: 'pending', removed_at: null }],
      campaigns: [{ team_id: 'team_a', campaign_id: CAMPAIGN }],
    })
    expect(await canAccessCall(db, OWNER, { user_id: AGENT, campaign_id: CAMPAIGN })).toBe(true)
  })
})

describe('canAccessCall: an owner with more than one team', () => {
  // The case the flat version got wrong. One account on this platform owns
  // five teams, so this is reachable rather than hypothetical.
  const twoTeams = fakeSupabase({
    teams: [{ id: 'team_a', owner_id: OWNER }, { id: 'team_b', owner_id: OWNER }],
    members: [
      { team_id: 'team_a', user_id: 'adam', status: 'active', removed_at: null },
      { team_id: 'team_b', user_id: 'bob', status: 'active', removed_at: null },
    ],
    campaigns: [
      { team_id: 'team_a', campaign_id: 'camp_a' },
      { team_id: 'team_b', campaign_id: 'camp_b' },
    ],
  })

  it('allows each team’s own pairing', async () => {
    expect(await canAccessCall(twoTeams, OWNER, { user_id: 'adam', campaign_id: 'camp_a' })).toBe(true)
    expect(await canAccessCall(twoTeams, OWNER, { user_id: 'bob', campaign_id: 'camp_b' })).toBe(true)
  })

  it('refuses a pairing neither team makes', async () => {
    // Adam is in team A, camp_b belongs to team B. Merging the two teams into
    // flat sets of agents and campaigns would have allowed this.
    expect(await canAccessCall(twoTeams, OWNER, { user_id: 'adam', campaign_id: 'camp_b' })).toBe(false)
    expect(await canAccessCall(twoTeams, OWNER, { user_id: 'bob', campaign_id: 'camp_a' })).toBe(false)
  })
})

describe('canAccessCall: incomplete calls', () => {
  it('refuses a call with no campaign, which cannot be tied to a team', async () => {
    expect(await canAccessCall(simple, OWNER, { user_id: AGENT, campaign_id: null })).toBe(false)
  })

  it('refuses a call with no dialer', async () => {
    expect(await canAccessCall(simple, OWNER, { user_id: null, campaign_id: CAMPAIGN })).toBe(false)
  })
})
