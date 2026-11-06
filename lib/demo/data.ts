// ─────────────────────────────────────────────────────────────────────────
// THE DEMO'S DATA. What an account that has never paid sees while it looks
// around: built here from a fixed seed, on request, and never written to the
// database. Nothing in the real tables is touched and nothing here can reach
// the platform's numbers.
//
// Every figure is a placeholder, and every page carries the DEMO DATA banner.
// Phone numbers are 555-01xx, the range set aside for fiction, so none of them
// can ring a real phone.
// ─────────────────────────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */

const FIRST = ['Maria', 'James', 'Linda', 'Robert', 'Patricia', 'Michael', 'Barbara', 'William', 'Elizabeth', 'David', 'Jennifer', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Karen', 'Charles', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Sandra', 'Mark', 'Donna', 'Steven', 'Carol', 'Paul']
const LAST = ['Holloway', 'Alvarez', 'Okafor', 'Whitfield', 'Nguyen', 'Brennan', 'Abernathy', 'Castillo', 'Pruitt', 'Delgado', 'Hargrove', 'Mendez', 'Sutton', 'Ellison', 'Ramos', 'Kowalski', 'Bishop', 'Fontaine', 'Greer', 'Lam', 'Ortega', 'Pierce', 'Quinn', 'Rowland']
const AREAS: [string, string, string][] = [['336', 'NC', 'Greensboro'], ['713', 'TX', 'Houston'], ['404', 'GA', 'Atlanta'], ['602', 'AZ', 'Phoenix'], ['214', 'TX', 'Dallas'], ['215', 'PA', 'Philadelphia'], ['615', 'TN', 'Nashville'], ['702', 'NV', 'Las Vegas'], ['317', 'IN', 'Indianapolis'], ['919', 'NC', 'Raleigh'], ['704', 'NC', 'Charlotte'], ['813', 'FL', 'Tampa']]

function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 } }

// No predictive campaign: it asks for a business name and callback number
// before it will run, and that dialog would sit on top of the demo dialer.
const CAMPAIGNS = [
  { name: 'Lead Batch 1', leads: 120, mode: 'progressive' },
  { name: 'Lead Batch 08/12', leads: 95, mode: 'progressive' },
  { name: 'Lead Gen 14', leads: 80, mode: 'power' },
  { name: 'Lead Batch 2', leads: 110, mode: 'progressive' },
  { name: 'Lead Batch 08/26', leads: 60, mode: 'preview' },
  { name: 'Lead Gen 15', leads: 75, mode: 'progressive' },
  { name: 'Lead Batch 3', leads: 90, mode: 'power' },
  { name: 'Lead Batch 09/03', leads: 70, mode: 'progressive' },
  { name: 'Lead Gen 16', leads: 85, mode: 'progressive' },
  { name: 'Lead Batch 4', leads: 65, mode: 'preview' },
  { name: 'Lead Batch 09/18', leads: 100, mode: 'progressive' },
  { name: 'Lead Gen 17', leads: 55, mode: 'power' },
  { name: 'Lead Batch 5', leads: 80, mode: 'progressive' },
  { name: 'Lead Batch 10/02', leads: 70, mode: 'progressive' },
  { name: 'Lead Gen 18', leads: 90, mode: 'power' },
  { name: 'Lead Batch 10/16', leads: 75, mode: 'progressive' },
]
const TOTAL_LEADS = CAMPAIGNS.reduce((n, c) => n + c.leads, 0)
// Calls across every campaign on an ordinary day, before that day's multiplier.
const BASE_CALLS_PER_DAY = 75
const DAYS = 35
const DAY = 86400000
// Deliberately exaggerated and in no pattern: anywhere from about 30 calls to
// over 1,000. Three days ago is always a big one, so WEEK always shows a spike.
const VOLUMES = [0.4, 0.45, 0.55, 0.7, 0.9, 1.2, 1.6, 2.2, 3, 4, 5.5, 7.5, 10, 13.5, 16]

// The scripts from the welcome showcase, written out in full.
const SCRIPTS = [
  { name: 'LIFE', body: "Hi (client), this is (agent) reaching out about the life coverage you looked into. Did I catch you at an okay time?\n\nPerfect, this only takes a couple of minutes. Most people I talk to want two things: their family taken care of, and a payment that actually fits the budget. Does that sound about right for you?\n\nWho would you want this coverage to protect, if something happened tomorrow?\n\nThat makes sense. And roughly how much would you want to leave them: enough for final expenses, or enough to cover the mortgage and bills too?\n\nGot it. I work with several carriers, so my job is to shop this for you instead of pushing one company. A few quick health questions will tell us what you qualify for, and many of these plans have no medical exam.\n\nHave you used any tobacco in the last twelve months? Any major health changes in the last few years?\n\nThanks for being straight with me. Based on that, let me show you two options, and you tell me which one feels comfortable. If neither one fits, that's okay, we just won't move forward." },
  { name: 'HEALTH', body: "Hi (client), this is (agent), you requested help finding a health plan. Is now a good time?\n\nGreat. So I can point you in the right direction, are you covered right now, or are you looking to get coverage started?\n\nWhat made you start looking: the price, the deductible, or a doctor who isn't in your network?\n\nThat's the most common one I hear. Let me ask you a few things so I'm not wasting your time.\n\nWho needs to be covered, just you or the family too? What's your zip code? And are there any doctors or prescriptions you absolutely need to keep?\n\nPerfect. What are you paying a month now, and what would feel like a comfortable number?\n\nOkay. I'm going to compare what's available in your area and walk you through what each plan really covers: the deductible, the copays, and the most you could pay in a year, so nothing surprises you later.\n\nHere are the two that fit best. Which one is closer to what you had in mind?" },
  { name: 'REAL ESTATE', body: "Hi (client), this is (agent), I saw you were curious what your home might be worth. Did I catch you at a bad time?\n\nGreat, I'll be quick. Homes around you have been moving, so I can get you a real number today instead of an online guess.\n\nWhat got you curious about the value: are you thinking about selling, refinancing, or just keeping an eye on it?\n\nMakes sense. If you did decide to move, where would you be headed next, and is there a timeline you have in mind?\n\nHave you made any updates since you bought it? A new roof, kitchen, or bathrooms can change the number quite a bit.\n\nThanks, that helps. Here's what I'd suggest: I'll put together a short report with what similar homes nearby actually sold for, and what you could expect to walk away with after costs.\n\nThere's no obligation. It just gives you real numbers to make a decision with.\n\nI can go over it with you in about ten minutes. Does later today or tomorrow morning work better?" },
  { name: 'SOLAR', body: "Hi (client), this is (agent), did I catch you at an okay time?\n\nGreat. You asked about cutting your power bill with solar, so I wanted to get you a quick free estimate. It only takes a couple of minutes.\n\nFirst, do you own the home? And roughly what's your electric bill in a typical month, and in the summer?\n\nWow, okay. Is that bill getting higher each year, or has it stayed about the same?\n\nHow's your roof: mostly open sun, or a lot of shade from trees? And do you know about how old it is?\n\nPerfect. Here's how this works. We look at your actual usage and your roof, and we work out whether solar would really save you money. If the numbers don't work for your home, I'll tell you that, and you've lost nothing.\n\nIf they do work, you'll see what the system costs, what you'd pay each month, and how that compares with your bill today, side by side.\n\nOne of our specialists can walk you through it. Would you want your spouse or anyone else on that call? What day works best for you both?" },
]

export type DemoData = {
  campaigns: any[]; leads: any[]; calls: any[]; scripts: any[]; links: any[]
  team: any; teamCampaigns: any[]; agents: any[]; members: any[]
}

/** Same seed, same demo. `now` only moves it in time, so TODAY is always today. */
export function generateDemo(now: number, ownerId: string): DemoData {
  const r = rng(20261104)
  // Ids depend only on what kind of row it is and which one, so the Teams answers
  // in fixtures.json keep matching these campaigns.
  const counters = new Map<string, number>()
  const id = (kind: string) => {
    const next = (counters.get(kind) || 0) + 1
    counters.set(kind, next)
    return `${kind}000000-0000-4000-8000-${next.toString(16).padStart(12, '0')}`
  }
  const pick = (a: number[]) => a[Math.floor(r() * a.length)]
  let li = 0

  // One plan per day, shared by every campaign, so the swings add up instead of
  // averaging out: big days, dead days, and hot and cold hours inside each.
  const plan = Array.from({ length: DAYS }, (_, d) => {
    const midnight = new Date(now); midnight.setHours(0, 0, 0, 0)
    const start = new Date(now - d * DAY); start.setHours(9, 0, 0, 0)
    // Past days: a 9-to-5 shift. Today: the hours just before now, so TODAY looks
    // like a day already under way whenever they arrive.
    const from = d === 0 ? Math.max(midnight.getTime(), now - 8 * 3600000) : start.getTime()
    // Hours worked so far today; always eight slots, so the rest of the seed
    // comes out the same whatever time it is.
    const hours = d === 0 ? Math.max(1, Math.ceil((now - from) / 3600000)) : 8
    return {
      from, hours,
      volume: d === 0 ? 2.6 : d === 3 ? 14 + r() * 3 : pick(VOLUMES) * (1 + r() * 0.3),
      heat: pick([0.35, 0.6, 0.8, 1, 1.3, 1.7, 2.2]),
      // What share of the people reached book or close, so the rate swings too.
      conv: pick([0.15, 0.25, 0.35, 0.5, 0.65, 0.8, 0.95]),
      slots: Array.from({ length: 8 }, () => ({ weight: pick([0.1, 0.2, 0.6, 1, 2, 4]), heat: pick([0.3, 0.7, 1, 1.5, 2.3]) })),
    }
  })

  const scripts = SCRIPTS.map((s, i) => ({ id: id('d1'), user_id: ownerId, name: s.name, body: s.body, sort_order: i }))
  const out: DemoData = { campaigns: [], leads: [], calls: [], scripts, links: [], team: null, teamCampaigns: [], agents: [], members: [] }

  for (const [ci, c] of CAMPAIGNS.entries()) {
    const campaignId = id('d2')
    const created = new Date(now - (DAYS + 2 - ci) * DAY).toISOString()
    const leads: any[] = []
    for (let i = 0; i < c.leads; i++, li++) {
      const a = AREAS[li % AREAS.length]
      leads.push({
        id: id('d3'), campaign_id: campaignId, user_id: ownerId,
        first_name: FIRST[li % FIRST.length], last_name: LAST[(li * 7) % LAST.length],
        phone: `+1${a[0]}55501${String(li % 100).padStart(2, '0')}`, city: a[2], state: a[1],
        email: null, created_at: created, status: 'uncalled', dial_attempts: 0, call_count: 0,
        disposition: null, last_called_at: null, last_called: null, last_call_disposition: null, last_call_at: null,
        extra_data: {}, notes: '',
      })
    }

    let called = 0
    for (let d = DAYS - 1; d >= 0; d--) {
      const p = plan[d]
      const perDay = Math.round((c.leads / TOTAL_LEADS) * BASE_CALLS_PER_DAY * p.volume)
      const totalWeight = p.slots.reduce((sum, s) => sum + s.weight, 0)
      for (let k = 0; k < perDay; k++) {
        // The last third is never called, so the lead queue has leads waiting.
        const lead = leads[Math.floor(r() * Math.ceil(leads.length * 0.67))]
        let roll = r() * totalWeight, slot = 0
        while (slot < p.slots.length - 1 && roll > p.slots[slot].weight) { roll -= p.slots[slot].weight; slot++ }
        const t = Math.min(now - 60000, Math.round(p.from + ((slot % p.hours) + r()) * 3600000))
        const x = r()
        let disposition: string, duration = 0, answered: string | null = null
        // About 1 in 4 dials reaches a person on an average hour, much more on a
        // hot one and far fewer on a cold one. A good share book or close.
        const reach = Math.min(0.75, 0.28 * p.heat * p.slots[slot].heat)
        const missed = 1 - reach
        if (x < missed / 2) { disposition = 'NO_ANSWER' }
        else if (x < missed) { disposition = 'VOICEMAIL'; duration = 3 + Math.floor(r() * 6); answered = new Date(t + 9000).toISOString() }
        else {
          const y = r()
          disposition = y < p.conv ? (r() < 0.58 ? 'APPOINTMENT' : 'CLOSED') : y < p.conv + (1 - p.conv) * 0.85 ? 'NOT INTERESTED' : 'DO NOT CALL'
          duration = disposition === 'CLOSED' ? 420 + Math.floor(r() * 600) : disposition === 'APPOINTMENT' ? 150 + Math.floor(r() * 300) : 25 + Math.floor(r() * 120)
          answered = new Date(t + 8000).toISOString()
        }
        const human = !!answered && disposition !== 'VOICEMAIL'
        out.calls.push({
          id: id('d4'), user_id: ownerId, campaign_id: campaignId, lead_id: lead.id, phone_number: lead.phone,
          duration, disposition, created_at: new Date(t).toISOString(), answered_at: answered,
          talk_seconds: human ? duration : null,
          amd_result: disposition === 'VOICEMAIL' ? 'machine' : answered ? 'human' : null,
          dialer_mode: c.mode, recording_status: human ? 'completed' : 'skipped',
          recording_duration: human ? duration : 0,
          hangup_cause: 'normal_clearing',
          // Display only: the recordings page lists these; there is no audio behind them.
          recording_url: human ? 'demo-recording' : null,
          recording_id: human ? 'demo' : null,
        })
        const status = disposition === 'CLOSED' ? 'closed' : disposition === 'APPOINTMENT' ? 'appointment' : disposition === 'DO NOT CALL' ? 'dnc' : disposition === 'NO_ANSWER' ? 'no_answer' : 'called'
        if (lead.status === 'uncalled') called++
        lead.status = status; lead.disposition = disposition; lead.call_count++
        lead.last_called_at = new Date(t).toISOString(); lead.last_called = lead.last_called_at
        lead.last_call_disposition = disposition; lead.last_call_at = lead.last_called_at
      }
    }
    // Eleven thousand calls over a thousand leads would put every lead at the cap.
    for (const l of leads) { if (l.call_count) { l.dial_attempts = l.call_count = 1 + Math.floor(r() * 5) } }

    out.campaigns.push({
      id: campaignId, user_id: ownerId, name: c.name, status: 'active', dialer_mode: c.mode,
      amd_enabled: c.mode !== 'power', total_leads: c.leads, called_leads: called, created_at: created,
      updated_at: new Date(now - (ci + 1) * 3 * 3600000).toISOString(), last_dialed_at: new Date(now - (ci + 1) * 40 * 60000).toISOString(),
    })
    out.leads.push(...leads)
    scripts.forEach((s, i) => out.links.push({ id: id('d5'), campaign_id: campaignId, script_id: s.id, sort_order: i }))
  }

  // A demo team with two placeholder agents, so the Teams page is not empty.
  const teamId = id('d6')
  const first = out.campaigns[0]
  out.team = { id: teamId, owner_id: ownerId, name: 'Demo Team', created_at: new Date(now - 30 * DAY).toISOString() }
  out.teamCampaigns.push({ id: id('d7'), team_id: teamId, campaign_id: first.id })
  for (const k of ['1', '2']) {
    const agentId = `demo_agent_${k}`
    out.agents.push({ clerk_id: agentId, first_name: 'Demo', last_name: `Agent ${k}`, email: null, username: `demo_agent_${k}` })
    out.members.push({ id: id('d8'), team_id: teamId, user_id: agentId, status: 'active', accepted_at: new Date(now - 30 * DAY).toISOString() })
    // Their own dials on the team's campaign, so the team numbers are not just the owner's.
    const pool = out.leads.filter(l => l.campaign_id === first.id)
    for (let i = 0; i < 140; i++) {
      const lead = pool[Math.floor(r() * pool.length)]
      const t = now - Math.floor(r() * 4 * DAY)
      const x = r()
      const disposition = x < 0.36 ? 'NO_ANSWER' : x < 0.72 ? 'VOICEMAIL' : x < 0.83 ? 'NOT INTERESTED' : x < 0.91 ? 'APPOINTMENT' : x < 0.98 ? 'CLOSED' : 'DO NOT CALL'
      const duration = disposition === 'NO_ANSWER' ? 0 : disposition === 'VOICEMAIL' ? 3 + Math.floor(r() * 6) : 60 + Math.floor(r() * 500)
      out.calls.push({
        id: id('d4'), user_id: agentId, team_id: teamId, campaign_id: first.id, lead_id: lead.id, phone_number: lead.phone,
        duration, disposition, created_at: new Date(t).toISOString(), answered_at: disposition === 'NO_ANSWER' ? null : new Date(t + 8000).toISOString(),
        recording_status: 'skipped',
      })
    }
  }
  return out
}
