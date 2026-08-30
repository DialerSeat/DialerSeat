import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/requireAdmin'
import { apiError } from '@/lib/apiError'
import { CORE_TASKS, CORE_KEYS, CORE_COUNT, computeStreak, localDay } from '@/lib/dailyTasks'

const supabase = getServiceClient('admin/daily-tasks')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// /api/admin/daily-tasks
// =============================================================================
// THE DAY COMES FROM THE CLIENT, ON PURPOSE. A server in UTC and a person in
// Eastern disagree about what day it is for five hours out of every
// twenty-four, and every one of those hours is a chance to file a finished task
// under tomorrow and break a streak that was never actually broken. The browser
// knows which day the person is living in; the server does not, so it is told
// rather than left to guess.
//
// Only ever the caller's own rows: owner_clerk_id comes from the auth gate and
// never from the request body.
// =============================================================================

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/

interface Row {
  id: string
  day: string
  task_key: string
  label: string | null
  done: boolean
  sort_order: number
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

  try {
    const url = new URL(req.url)
    const dayParam = url.searchParams.get('day') || ''
    const monthParam = url.searchParams.get('month') || ''
    // A malformed day would file rows on a date the person never sees again,
    // so it is refused rather than coerced into something plausible.
    if (dayParam && !DAY_RE.test(dayParam)) {
      return NextResponse.json({ error: 'day must be YYYY-MM-DD' }, { status: 400 })
    }
    if (monthParam && !MONTH_RE.test(monthParam)) {
      return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 })
    }
    const today = dayParam || localDay()
    const targetMonth = monthParam || today.slice(0, 7)

    // Every day this owner has ever completed, so the streak can walk backwards
    // past the edge of whichever month is on screen. Only core rows count: a
    // custom errand is not part of the promise, and a day should not become a
    // streak day because you remembered to buy milk.
    const { data: doneRows, error: doneError } = await supabase
      .from('admin_daily_tasks')
      .select('day')
      .eq('owner_clerk_id', gate.clerkId)
      .eq('done', true)
      .in('task_key', CORE_KEYS)
      .limit(20000)
    if (doneError) throw doneError

    const perDayCoreDone = new Map<string, number>()
    for (const r of doneRows ?? []) {
      perDayCoreDone.set(r.day, (perDayCoreDone.get(r.day) ?? 0) + 1)
    }
    const completeDays = new Set<string>()
    for (const [d, n] of perDayCoreDone) {
      if (n >= CORE_COUNT) completeDays.add(d)
    }

    // The displayed month plus the selected day in one read. The day is usually
    // inside the month, but not when you are looking at October in September to
    // write down a trip.
    const monthStart = `${targetMonth}-01`
    const monthEnd = `${targetMonth}-31`
    const { data: rows, error } = await supabase
      .from('admin_daily_tasks')
      .select('id, day, task_key, label, done, sort_order')
      .eq('owner_clerk_id', gate.clerkId)
      .or(`and(day.gte.${monthStart},day.lte.${monthEnd}),day.eq.${today}`)
      .order('sort_order', { ascending: true })
      .limit(5000)
    if (error) throw error

    const all = (rows ?? []) as Row[]
    const forToday = all.filter(r => r.day === today)
    const doneToday = new Set(forToday.filter(r => r.done).map(r => r.task_key))

    // Core tasks are rebuilt from code on every read, so rewording one shows the
    // new wording on every past day too. There is no stored copy to go stale,
    // which is the entire reason they are not rows.
    const core = CORE_TASKS.map(t => ({
      key: t.key,
      label: t.label,
      detail: t.detail ?? null,
      done: doneToday.has(t.key),
    }))

    const custom = forToday
      .filter(r => !CORE_KEYS.includes(r.task_key))
      .map(r => ({
        id: r.id,
        key: r.task_key,
        label: r.label ?? '',
        done: r.done,
        sort: r.sort_order,
      }))
      .sort((a, b) => a.sort - b.sort)

    // Per-day summary for the calendar. customTotal is tracked separately so a
    // future day holding only "dentist, 2pm" renders as planned rather than as
    // a day you failed.
    const monthDays: Record<string, {
      coreDone: number; customDone: number; customTotal: number; complete: boolean
    }> = {}
    for (const r of all) {
      if (r.day < monthStart || r.day > monthEnd) continue
      const e = monthDays[r.day] ?? { coreDone: 0, customDone: 0, customTotal: 0, complete: false }
      if (CORE_KEYS.includes(r.task_key)) {
        if (r.done) e.coreDone += 1
      } else {
        e.customTotal += 1
        if (r.done) e.customDone += 1
      }
      e.complete = e.coreDone >= CORE_COUNT
      monthDays[r.day] = e
    }

    return NextResponse.json({
      ok: true,
      today,
      month: targetMonth,
      core,
      custom,
      monthDays,
      streak: computeStreak(completeDays, today),
      coreCount: CORE_COUNT,
    })
  } catch (err) {
    return apiError(err, { route: 'admin/daily-tasks' })
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '')
    const day = String(body.day || '')
    if (!DAY_RE.test(day)) {
      return NextResponse.json({ error: 'day must be YYYY-MM-DD' }, { status: 400 })
    }

    if (action === 'toggle') {
      const taskKey = String(body.taskKey || '')
      if (!taskKey) return NextResponse.json({ error: 'taskKey required' }, { status: 400 })
      const done = body.done === true

      // Upsert rather than update. A core task has no row until the first time
      // it is ticked, so on day one there is nothing to update — ticking it is
      // what brings the row into existence.
      const { error } = await supabase
        .from('admin_daily_tasks')
        .upsert({
          owner_clerk_id: gate.clerkId,
          day,
          task_key: taskKey,
          done,
          done_at: done ? new Date().toISOString() : null,
        }, { onConflict: 'owner_clerk_id,day,task_key' })
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (action === 'add') {
      const label = String(body.label || '').trim()
      if (!label) return NextResponse.json({ error: 'label required' }, { status: 400 })
      if (label.length > 300) {
        return NextResponse.json({ error: 'label too long' }, { status: 400 })
      }
      // Sorted after everything already on that day, core included.
      const { data: existing } = await supabase
        .from('admin_daily_tasks')
        .select('sort_order')
        .eq('owner_clerk_id', gate.clerkId)
        .eq('day', day)
        .order('sort_order', { ascending: false })
        .limit(1)
      const nextSort = (existing?.[0]?.sort_order ?? 0) + 1

      const { data, error } = await supabase
        .from('admin_daily_tasks')
        .insert({
          owner_clerk_id: gate.clerkId,
          day,
          task_key: `custom:${crypto.randomUUID()}`,
          label,
          sort_order: nextSort,
        })
        .select('id, task_key, label, done, sort_order')
        .single()
      if (error) throw error
      return NextResponse.json({ ok: true, task: data })
    }

    if (action === 'remove') {
      const id = String(body.id || '')
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      // Scoped to the owner, and to custom rows only: a core task is part of
      // the fixed list, and deleting one would quietly shorten the promise.
      const { error } = await supabase
        .from('admin_daily_tasks')
        .delete()
        .eq('id', id)
        .eq('owner_clerk_id', gate.clerkId)
        .like('task_key', 'custom:%')
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  } catch (err) {
    return apiError(err, { route: 'admin/daily-tasks' })
  }
}
