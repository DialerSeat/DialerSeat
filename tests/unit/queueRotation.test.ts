import { describe, it, expect } from 'vitest'
import {
  rotationKey,
  sinkDialedLeads,
  recordDial,
  type DialLog,
} from '@/lib/queueRotation'

const T0 = Date.parse('2026-09-18T15:00:00Z')
const lead = (id: string, last_called_at: string | null = null) => ({ id, last_called_at })

describe('rotationKey', () => {
  it('is 0 for a lead nothing has ever called', () => {
    expect(rotationKey(lead('a'), {})).toBe(0)
  })

  it('uses the server stamp when this session has not dialled it', () => {
    expect(rotationKey(lead('a', '2026-09-17T12:00:00Z'), {}))
      .toBe(Date.parse('2026-09-17T12:00:00Z'))
  })

  it('uses this session’s dial when the server never recorded one', () => {
    // The voicemail case: no disposition is ever written, so the column stays
    // null no matter how many times the lead was actually dialled.
    expect(rotationKey(lead('a', null), { a: T0 })).toBe(T0)
  })

  it('takes the later of the two', () => {
    expect(rotationKey(lead('a', '2026-09-17T12:00:00Z'), { a: T0 })).toBe(T0)
  })

  it('ignores an unparseable server stamp rather than sorting on NaN', () => {
    expect(rotationKey(lead('a', 'not a date'), {})).toBe(0)
  })
})

describe('sinkDialedLeads', () => {
  it('sends the lead just dialled to the bottom and nothing else moves', () => {
    expect(sinkDialedLeads([lead('a'), lead('b'), lead('c')], { a: T0 }).map(l => l.id))
      .toEqual(['b', 'c', 'a'])
  })

  it('starts the next lead: after dialling the top one, the top is a new lead', () => {
    const log = recordDial({}, 'a', T0)
    expect(sinkDialedLeads([lead('a'), lead('b'), lead('c')], log)[0].id).toBe('b')
  })

  it('drops nothing — a dialled lead stays in the queue and comes back round', () => {
    let log: DialLog = {}
    log = recordDial(log, 'a', T0)
    log = recordDial(log, 'b', T0 + 1000)
    const after = sinkDialedLeads([lead('a'), lead('b')], log)
    expect(after).toHaveLength(2)
    // Least-recently dialled first, so the queue cycles rather than stalling.
    expect(after.map(l => l.id)).toEqual(['a', 'b'])
  })

  it('a queue refetch that nulls last_called_at cannot un-sink the lead', () => {
    // The regression this was written for. disposeLead refreshes the whole
    // list; on the voicemail path the server has nothing to return, so the
    // optimistic local stamp is wiped and the lead used to jump back to top.
    const log = recordDial({}, 'a', T0)
    expect(sinkDialedLeads([lead('a', new Date(T0).toISOString()), lead('b')], log).map(l => l.id))
      .toEqual(['b', 'a'])
    expect(sinkDialedLeads([lead('a', null), lead('b')], log).map(l => l.id))
      .toEqual(['b', 'a'])
  })

  it('is stable, so an active shuffle survives among never-dialled leads', () => {
    expect(sinkDialedLeads([lead('c'), lead('a'), lead('b')], {}).map(l => l.id))
      .toEqual(['c', 'a', 'b'])
  })

  it('holds a lead at the top for its whole repeat sequence', () => {
    // The log is written once, when the sequence ends — never as a call goes
    // out. A 2x lead is dialled, rings out, and is dialled again, and must
    // stay on the top row the agent is watching for both attempts. Recording
    // at dial time dropped it to the bottom between them.
    const queue = [lead('a'), lead('b'), lead('c')]
    const midSequence: DialLog = {}
    expect(sinkDialedLeads(queue, midSequence)[0].id).toBe('a')

    // Second attempt on the same lead: still nothing recorded, still on top.
    expect(sinkDialedLeads(queue, midSequence)[0].id).toBe('a')

    // Sequence over. Now it sinks and the next lead comes up.
    const afterSequence = recordDial(midSequence, 'a', T0)
    expect(sinkDialedLeads(queue, afterSequence).map(l => l.id)).toEqual(['b', 'c', 'a'])
  })

  it('works through a 1x pass over the whole queue without repeating a lead', () => {
    // Walk the queue the way the dialer does: take the top, dial it, sink it.
    let log: DialLog = {}
    const queue = [lead('a'), lead('b'), lead('c')]
    const dialled: string[] = []
    for (let i = 0; i < 3; i++) {
      const next = sinkDialedLeads(queue, log)[0]
      dialled.push(next.id)
      log = recordDial(log, next.id, T0 + i * 1000)
    }
    expect(dialled).toEqual(['a', 'b', 'c'])
    // Fourth pass comes back to the first lead — rotation, not exclusion.
    expect(sinkDialedLeads(queue, log)[0].id).toBe('a')
  })
})

describe('recordDial', () => {
  it('does not mutate the log it is given', () => {
    const before: DialLog = {}
    const after = recordDial(before, 'a', T0)
    expect(before).toEqual({})
    expect(after).toEqual({ a: T0 })
  })

  it('keeps only the most recent dial for a lead', () => {
    let log = recordDial({}, 'a', T0)
    log = recordDial(log, 'a', T0 + 800)
    expect(log).toEqual({ a: T0 + 800 })
  })
})
