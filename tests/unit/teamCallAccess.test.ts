import { describe, it, expect } from 'vitest'
import { canAccessCall } from '@/lib/teamCallAccess'

// =============================================================================
// This rule decides whether one person may listen to a recording of another
// person's phone call, so the cases that matter are the ones where it should
// say no.
//
// The rule is membership: the caller owns a team, and the call was made by
// somebody on it. It briefly also required the call's campaign to be attached
// to that team, and the tests below still pin that this is NOT required — see
// the note in lib/teamCallAccess.ts for why the campaign condition was wrong
// for this product rather than merely strict.
//
// The supabase client is faked rather than mocked through a library: the code
// makes two reads and the shape of each is fixed, so a small stand-in is
// clearer than a mocking framework and cannot drift into passing for the wrong
// reason.
// =============================================================================

interface Member { team_id: string; user_id: string | null; status?: string | null; removed_at?: string | null }

function fakeSupabase(world: {
  teams: Array<{ id: string; owner_id: string }>
  members: Member[]
}) {
  return {
    from() {
      return {
        select() {
          return {
            // teams: .eq('owner_id', viewer)
            eq(_col: string, value: string) {
              return Promise.resolve({
                data: world.teams.filter(t => t.owner_id === value).map(t => ({ id: t.id })),
              })
            },
            // members: .in('team_id', ids)
            in(_col: string, ids: string[]) {
              return Promise.resolve({ data: world.members.filter(m => ids.includes(m.team_id)) })
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
const TEAM_CAMPAIGN = 'camp_team'
const OWN_CAMPAIGN = 'camp_personal'

/** One team: OWNER owns it, AGENT is on it. */
const simple = fakeSupabase({
  teams: [{ id: 'team_a', owner_id: OWNER }],
  members: [{ team_id: 'team_a', user_id: AGENT, status: 'active', removed_at: null }],
})

describe('canAccessCall: your own calls', () => {
  it('lets anyone open a call they made themselves', async () => {
    const db = fakeSupabase({ teams: [], members: [] })
    expect(await canAccessCall(db, STRANGER, { user_id: STRANGER, campaign_id: null })).toBe(true)
  })
})

describe('canAccessCall: membership is the test', () => {
  it('lets an owner open their agent’s call', async () => {
    expect(await canAccessCall(simple, OWNER, { user_id: AGENT, campaign_id: TEAM_CAMPAIGN }))
      .toBe(true)
  })

  it('lets an owner open their agent’s call on the agent’s OWN campaign', async () => {
    // The case the campaign condition used to refuse, and the reason it was
    // dropped: across every team on the platform, members' calls were on their
    // own campaigns and never on a team campaign, so this was every call.
    expect(await canAccessCall(simple, OWNER, { user_id: AGENT, campaign_id: OWN_CAMPAIGN }))
      .toBe(true)
  })

  it('lets an owner open their agent’s call with no campaign at all', async () => {
    // A manual keypad dial carries no campaign.
    expect(await canAccessCall(simple, OWNER, { user_id: AGENT, campaign_id: null })).toBe(true)
  })

  it('refuses a call by somebody who is not on the team', async () => {
    expect(await canAccessCall(simple, OWNER, { user_id: STRANGER, campaign_id: TEAM_CAMPAIGN }))
      .toBe(false)
  })

  it('refuses somebody who owns no team at all', async () => {
    expect(await canAccessCall(simple, STRANGER, { user_id: AGENT, campaign_id: TEAM_CAMPAIGN }))
      .toBe(false)
  })

  it('refuses a call with no dialer', async () => {
    expect(await canAccessCall(simple, OWNER, { user_id: null, campaign_id: TEAM_CAMPAIGN }))
      .toBe(false)
  })
})

describe('canAccessCall: members who have left', () => {
  it('refuses a removed member’s calls, by status', async () => {
    const db = fakeSupabase({
      teams: [{ id: 'team_a', owner_id: OWNER }],
      members: [{ team_id: 'team_a', user_id: AGENT, status: 'removed', removed_at: null }],
    })
    expect(await canAccessCall(db, OWNER, { user_id: AGENT, campaign_id: TEAM_CAMPAIGN })).toBe(false)
  })

  it('refuses a removed member’s calls, by removed_at, even if status disagrees', async () => {
    // The two are written together today. Where they disagree the rule has to
    // fall to the side that grants less.
    const db = fakeSupabase({
      teams: [{ id: 'team_a', owner_id: OWNER }],
      members: [{ team_id: 'team_a', user_id: AGENT, status: 'active', removed_at: '2026-09-01T00:00:00Z' }],
    })
    expect(await canAccessCall(db, OWNER, { user_id: AGENT, campaign_id: TEAM_CAMPAIGN })).toBe(false)
  })

  it('allows a pending member, who is dialing on a seat being paid for', async () => {
    const db = fakeSupabase({
      teams: [{ id: 'team_a', owner_id: OWNER }],
      members: [{ team_id: 'team_a', user_id: AGENT, status: 'pending', removed_at: null }],
    })
    expect(await canAccessCall(db, OWNER, { user_id: AGENT, campaign_id: TEAM_CAMPAIGN })).toBe(true)
  })
})

describe('canAccessCall: an owner with more than one team', () => {
  const twoTeams = fakeSupabase({
    teams: [{ id: 'team_a', owner_id: OWNER }, { id: 'team_b', owner_id: OWNER }],
    members: [
      { team_id: 'team_a', user_id: 'adam', status: 'active', removed_at: null },
      { team_id: 'team_b', user_id: 'bob', status: 'active', removed_at: null },
    ],
  })

  it('reaches the agents of every team they own', async () => {
    expect(await canAccessCall(twoTeams, OWNER, { user_id: 'adam', campaign_id: 'camp_a' })).toBe(true)
    expect(await canAccessCall(twoTeams, OWNER, { user_id: 'bob', campaign_id: 'camp_b' })).toBe(true)
  })

  it('still refuses somebody on neither team', async () => {
    expect(await canAccessCall(twoTeams, OWNER, { user_id: STRANGER, campaign_id: 'camp_a' }))
      .toBe(false)
  })
})
