// Answers the demo's read requests. proxy.ts sends a never-paid account's GETs
// here instead of the real routes, so every real page renders demo data through
// its own code while the database stays out of it.
//
// Analytics, leads, recordings and campaigns are worked out from lib/demo/data.
// The Teams pages have too many views to rebuild by hand, so those replay what
// the real routes answered over this same data (lib/demo/fixtures.json), moved
// forward in time so TODAY is always today.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateDemo, type DemoData } from './data'
import fixtures from './fixtures.json'

const OWNER = '__OWNER__'
const F = fixtures as any
let cache: { stamp: number; data: DemoData } | null = null

function demo(now: number): DemoData {
  // Ten minutes at a time: the numbers hold still while someone looks around.
  const stamp = Math.floor(now / 600000)
  if (!cache || cache.stamp !== stamp) cache = { stamp, data: generateDemo(stamp * 600000, OWNER) }
  return cache.data
}

const CONVERSIONS = ['APPOINTMENT', 'CLOSED']
const CONTACTS = ['APPOINTMENT', 'CLOSED', 'NOT INTERESTED', 'DO NOT CALL']
const round1 = (n: number) => Math.round(n * 10) / 10

function ownCalls(d: DemoData, q: URLSearchParams) {
  const start = q.get('start'), end = q.get('end')
  return d.calls.filter(c => c.user_id === OWNER && (!start || c.created_at >= start) && (!end || c.created_at <= end))
}

function summary(d: DemoData, q: URLSearchParams) {
  const calls = ownCalls(d, q)
  const count = (values: string[]) => calls.filter(c => values.includes(c.disposition)).length
  const reachedCalls = calls.filter(c => c.answered_at || (c.duration || 0) > 0).length
  const contactsReached = count(CONTACTS), conversions = count(CONVERSIONS)
  const totalDuration = calls.reduce((s, c) => s + (c.duration || 0), 0)
  const contactSeconds = calls.filter(c => CONTACTS.includes(c.disposition)).reduce((s, c) => s + (c.duration || 0), 0)
  let best: string | null = null, bestRate = 0
  for (const camp of d.campaigns) {
    const mine = calls.filter(c => c.campaign_id === camp.id)
    const conv = mine.filter(c => CONVERSIONS.includes(c.disposition)).length
    if (mine.length >= 5 && conv > 0 && conv / mine.length > bestRate) { best = camp.name; bestRate = conv / mine.length }
  }
  return {
    success: true,
    summary: {
      totalCalls: calls.length, reachedCalls, contactsReached, conversions,
      closed: count(['CLOSED']), appointments: count(['APPOINTMENT']), dnc: count(['DO NOT CALL']), notInterested: count(['NOT INTERESTED']),
      totalDuration, avgCallLength: contactsReached ? Math.round(contactSeconds / contactsReached) : 0,
      conversionRate: reachedCalls ? round1((conversions / reachedCalls) * 100) : 0,
      contactRate: reachedCalls ? round1((contactsReached / reachedCalls) * 100) : 0,
      bestCampaign: best, bestCampaignRate: round1(bestRate * 100),
    },
    partial: false,
  }
}

function timeseries(d: DemoData, q: URLSearchParams) {
  const hourly = q.get('bucket') === 'hour'
  const buckets = new Map<string, { calls: number; conversions: number; talkTime: number }>()
  for (const c of ownCalls(d, q)) {
    const key = hourly ? c.created_at.slice(0, 13) + ':00' : c.created_at.slice(0, 10)
    const b = buckets.get(key) || { calls: 0, conversions: 0, talkTime: 0 }
    b.calls++
    if (CONVERSIONS.includes(c.disposition)) b.conversions++
    b.talkTime += c.duration || 0
    buckets.set(key, b)
  }
  const series = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, b]) => ({
    label, ...b, conversionRate: b.calls ? round1((b.conversions / b.calls) * 100) : 0,
  }))
  return { success: true, series, partial: false }
}

const DISPOSITION_ROWS = [
  ['NOT INTERESTED', 'Not interested', 'outcome'], ['APPOINTMENT', 'Call Back', 'outcome'], ['CLOSED', 'Closed', 'outcome'],
  ['DO NOT CALL', 'Do not call', 'outcome'], ['NO_ANSWER', 'No answer', 'system'], ['VOICEMAIL', 'Voicemail', 'system'],
]
function dispositions(d: DemoData, q: URLSearchParams) {
  const calls = ownCalls(d, q)
  const breakdown = DISPOSITION_ROWS.map(([disposition, label, group]) => ({ disposition, label, group, count: calls.filter(c => c.disposition === disposition).length })).filter(r => r.count > 0)
  return { success: true, breakdown, partial: false }
}

function campaignStats(d: DemoData, q: URLSearchParams) {
  const calls = ownCalls(d, q)
  const breakdown = d.campaigns.map(camp => {
    const mine = calls.filter(c => c.campaign_id === camp.id)
    const converted = mine.filter(c => CONVERSIONS.includes(c.disposition)).length
    return { campaign_id: camp.id, name: camp.name, total: mine.length, contacted: mine.filter(c => CONTACTS.includes(c.disposition)).length, converted, conversionRate: mine.length ? round1((converted / mine.length) * 100) : 0 }
  }).filter(r => r.total > 0).sort((a, b) => b.total - a.total)
  return { success: true, breakdown, partial: false }
}

function campaignList(d: DemoData) {
  const { id: _id, name: _name, ...template } = F.campaign
  return { success: true, campaigns: [...d.campaigns].reverse().map(c => ({ ...template, ...c })) }
}

function leadList(d: DemoData, q: URLSearchParams) {
  let rows = d.leads
  const single = q.get('id')
  if (single) return { success: true, lead: rows.find(l => l.id === single) || null }
  const campaign = q.get('campaign_id') || 'all', disposition = q.get('disposition') || 'all', search = (q.get('search') || '').trim().toLowerCase()
  if (campaign !== 'all') rows = rows.filter(l => l.campaign_id === campaign)
  if (disposition === 'dialable') rows = rows.filter(l => ['uncalled', 'no_answer', 'called'].includes(l.status))
  else if (disposition === 'uncalled') rows = rows.filter(l => l.status === 'uncalled')
  else if (disposition === 'reached_voicemail') rows = rows.filter(l => l.disposition === 'VOICEMAIL')
  else if (disposition !== 'all') rows = rows.filter(l => l.disposition === disposition)
  if (search) rows = rows.filter(l => `${l.first_name} ${l.last_name} ${l.phone}`.toLowerCase().includes(search))
  const sort = q.get('sort') || 'created_desc'
  const by = sort === 'last_called' ? (l: any) => l.last_called_at || '' : sort === 'attempts' ? (l: any) => String(l.dial_attempts).padStart(3, '0') : (l: any) => l.created_at + l.id
  rows = [...rows].sort((a, b) => (by(a) < by(b) ? 1 : -1))
  // The queue shows who has not been called yet first, as a fresh list would.
  if (disposition === 'dialable') rows.sort((a, b) => a.dial_attempts - b.dial_attempts)
  const cursor = parseInt(q.get('cursor') || '0', 10) || 0
  const size = Number(q.get('page_size')) > 0 ? Number(q.get('page_size')) : 50
  const page = rows.slice(cursor, cursor + size)
  return { success: true, leads: page, total: rows.length, nextCursor: page.length === size ? cursor + size : null }
}

function recordingList(d: DemoData, q: URLSearchParams) {
  const campaign = q.get('campaign_id') || 'all', disposition = q.get('disposition') || 'all', search = (q.get('search') || '').trim().toLowerCase()
  const leads = new Map(d.leads.map(l => [l.id, l])), names = new Map(d.campaigns.map(c => [c.id, c.name]))
  let rows = d.calls.filter(c => c.user_id === OWNER && c.recording_url)
  if (campaign !== 'all') rows = rows.filter(c => c.campaign_id === campaign)
  if (disposition !== 'all') rows = rows.filter(c => c.disposition === disposition)
  const withJoins = rows.map(c => {
    const l: any = leads.get(c.lead_id) || {}
    return { ...c, was_abandoned: false, leads: { first_name: l.first_name, last_name: l.last_name, phone: l.phone, notes: '' }, campaigns: { name: names.get(c.campaign_id) } }
  }).filter(r => !search || `${r.leads.first_name} ${r.leads.last_name} ${r.phone_number}`.toLowerCase().includes(search))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const cursor = parseInt(q.get('cursor') || '0', 10) || 0
  const page = withJoins.slice(cursor, cursor + 50)
  return { success: true, teamView: false, agents: [], recordings: page, total: withJoins.length, nextCursor: page.length === 50 ? cursor + 50 : null }
}

/** The key a Teams answer was captured under; only these parameters change it. */
export function fixtureKey(path: string, q: URLSearchParams) {
  const kept = ['range', 'scope', 'scopeId', 'userId', 'campaignId', 'detail'].filter(k => q.get(k)).map(k => `${k}=${q.get(k)}`)
  return kept.length ? `${path}?${kept.join('&')}` : path
}

function fromFixtures(path: string, query: URLSearchParams, now: number, userId: string): string {
  // Captured under a placeholder owner, so ask for that one.
  const q = new URLSearchParams(query.toString().split(encodeURIComponent(userId)).join(OWNER))
  const t = F.teams as Record<string, string>
  const allTime = new URLSearchParams(q); if (allTime.get('range')) allTime.set('range', 'all')
  const text = t[fixtureKey(path, q)] ?? t[fixtureKey(path, allTime)] ?? t[path] ?? null
  if (text === null) return JSON.stringify({ success: true })
  // Move every date forward by however long ago this was captured.
  const shift = now - F.takenAt
  const days = Math.round(shift / 86400000)
  return text
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, m => new Date(new Date(m).getTime() + shift).toISOString())
    .replace(/"(label|day|date)":"(\d{4}-\d{2}-\d{2})"/g, (_, k, m) => `"${k}":"${new Date(new Date(m + 'T12:00:00Z').getTime() + days * 86400000).toISOString().slice(0, 10)}"`)
}

/** The body of the demo's answer to a GET on /api/<path>. */
export function demoAnswer(path: string, q: URLSearchParams, userId: string, now = Date.now()): string {
  const d = demo(now)
  let body: string
  switch (path) {
    case 'analytics/summary': body = JSON.stringify(summary(d, q)); break
    case 'analytics/timeseries': body = JSON.stringify(timeseries(d, q)); break
    case 'analytics/dispositions': body = JSON.stringify(dispositions(d, q)); break
    case 'analytics/campaigns': body = JSON.stringify(campaignStats(d, q)); break
    case 'campaigns/list': body = JSON.stringify(campaignList(d)); break
    case 'leads/list': body = JSON.stringify(leadList(d, q)); break
    case 'recordings/list': body = JSON.stringify(recordingList(d, q)); break
    default: body = fromFixtures(path, q, now, userId)
  }
  return body.split(OWNER).join(userId)
}
