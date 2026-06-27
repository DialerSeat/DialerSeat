'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useUser } from '@clerk/nextjs'

// =============================================================================
// CALENDAR PAGE — /dashboard/calendar
// =============================================================================
// A full calendar for the signed-in agent, modeled on the best calendar apps:
//   - Month / Week / Day views with structured time navigation (step by the
//     active period, jump-to-date picker, TODAY).
//   - A rich event composer: all-day toggle, quick-duration chips, color picker,
//     a full recurrence builder (interval, weekdays, end-by) with a live
//     human-readable summary, type, location, notes.
// Events come from manual creation AND dialer dispositions (callback/appointment).
// All colors use tenant-overridable --brand-* tokens.
// =============================================================================

interface Occurrence {
  id: string
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  all_day: boolean
  rrule: string | null
  recurrence_until: string | null
  source: 'manual' | 'disposition'
  event_type: 'event' | 'callback' | 'appointment'
  lead_id: string | null
  call_id: string | null
  color: string | null
  occurrence_start: string
  occurrence_end: string | null
  is_recurring_instance: boolean
}

type ViewMode = 'month' | 'week' | 'day'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const WEEKDAYS = [
  { code: 'MO', label: 'Mon', idx: 1 }, { code: 'TU', label: 'Tue', idx: 2 },
  { code: 'WE', label: 'Wed', idx: 3 }, { code: 'TH', label: 'Thu', idx: 4 },
  { code: 'FR', label: 'Fri', idx: 5 }, { code: 'SA', label: 'Sat', idx: 6 },
  { code: 'SU', label: 'Sun', idx: 0 },
]
const TYPE_COLORS: Record<string, string> = {
  event: 'var(--brand-primary)', callback: '#d97706', appointment: '#2563eb',
}
const PALETTE = [
  { name: 'Brand', value: '' }, { name: 'Blue', value: '#2563eb' }, { name: 'Green', value: '#16a34a' },
  { name: 'Amber', value: '#d97706' }, { name: 'Red', value: '#dc2626' }, { name: 'Purple', value: '#7c3aed' },
  { name: 'Pink', value: '#db2777' }, { name: 'Teal', value: '#0d9488' }, { name: 'Slate', value: '#475569' },
]
const HOURS = Array.from({ length: 24 }, (_, h) => h)

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function pad(n: number) { return String(n).padStart(2, '0') }
function localInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function startOfWeek(d: Date): Date { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0,0,0,0); return x }
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function fmtTime(d: Date): string { return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }

// Build a human-readable recurrence summary ("Every 2 weeks on Mon, Wed").
function describeRecurrence(repeat: string, interval: number, byday: string[], until: string): string {
  if (repeat === 'none') return 'Does not repeat'
  const n = interval > 1 ? `${interval} ` : ''
  let base = ''
  if (repeat === 'DAILY') base = `Every ${n}${interval > 1 ? 'days' : 'day'}`
  else if (repeat === 'WEEKLY') {
    base = `Every ${n}${interval > 1 ? 'weeks' : 'week'}`
    if (byday.length > 0) {
      const labels = WEEKDAYS.filter(w => byday.includes(w.code)).map(w => w.label)
      base += ` on ${labels.join(', ')}`
    }
  } else if (repeat === 'MONTHLY') base = `Every ${n}${interval > 1 ? 'months' : 'month'}`
  else if (repeat === 'YEARLY') base = `Every ${n}${interval > 1 ? 'years' : 'year'}`
  if (until) {
    const u = new Date(until + 'T00:00:00')
    base += ` until ${MONTHS_SHORT[u.getMonth()]} ${u.getDate()}, ${u.getFullYear()}`
  }
  return base
}

export default function CalendarApp({ embedded = false }: { embedded?: boolean }) {
  const { user } = useUser()
  const today = useMemo(() => new Date(), [])
  const [view, setView] = useState<ViewMode>('month')
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d }) // anchor date for the current view
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [jumpOpen, setJumpOpen] = useState(false)
  const jumpRef = useRef<HTMLDivElement | null>(null)

  // Editor modal state
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Occurrence | null>(null)
  const [form, setForm] = useState({
    title: '', description: '', location: '',
    starts_at: '', ends_at: '', all_day: false,
    event_type: 'event' as 'event' | 'callback' | 'appointment',
    color: '',
    repeat: 'none' as 'none' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY',
    interval: 1, byday: [] as string[], recurrence_until: '',
  })
  const [saving, setSaving] = useState(false)

  // ── The visible window depends on the view ──────────────────────────────
  const windowRange = useMemo(() => {
    if (view === 'day') {
      const from = new Date(cursor); from.setHours(0,0,0,0)
      const to = new Date(cursor); to.setHours(23,59,59,999)
      return { from, to }
    }
    if (view === 'week') {
      const from = startOfWeek(cursor)
      const to = addDays(from, 6); to.setHours(23,59,59,999)
      return { from, to }
    }
    // month (with a buffer so recurring expansions land)
    const from = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 2, 0)
    return { from, to }
  }, [view, cursor])

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/calendar/events?from=${windowRange.from.toISOString()}&to=${windowRange.to.toISOString()}`)
      const data = await res.json()
      if (data.success) setOccurrences(data.events)
    } catch {
      // apiError logged server-side; keep UI calm.
    } finally {
      setLoading(false)
    }
  }, [windowRange])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  // Close jump-to dropdown on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (jumpRef.current && !jumpRef.current.contains(e.target as Node)) setJumpOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Index occurrences by local YMD
  const byDay = useMemo(() => {
    const map: Record<string, Occurrence[]> = {}
    for (const o of occurrences) {
      const key = ymd(new Date(o.occurrence_start))
      ;(map[key] ||= []).push(o)
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.occurrence_start.localeCompare(b.occurrence_start))
    return map
  }, [occurrences])

  // ── Navigation that steps by the active period ───────────────────────────
  const step = (dir: number) => {
    setCursor(prev => {
      const d = new Date(prev)
      if (view === 'day') d.setDate(d.getDate() + dir)
      else if (view === 'week') d.setDate(d.getDate() + dir * 7)
      else d.setMonth(d.getMonth() + dir)
      return d
    })
  }
  const goToday = () => { const d = new Date(); d.setHours(0,0,0,0); setCursor(d); setSelectedDay(ymd(d)) }
  const jumpTo = (dateStr: string) => {
    if (!dateStr) return
    const d = new Date(dateStr + 'T12:00:00')
    if (isNaN(d.getTime())) return
    d.setHours(0,0,0,0); setCursor(d); setSelectedDay(ymd(d)); setJumpOpen(false)
  }

  // Range label adapts to the view
  const rangeLabel = useMemo(() => {
    if (view === 'day') return `${DOW[cursor.getDay()]}, ${MONTHS[cursor.getMonth()]} ${cursor.getDate()}, ${cursor.getFullYear()}`
    if (view === 'week') {
      const s = startOfWeek(cursor), e = addDays(s, 6)
      if (s.getMonth() === e.getMonth()) return `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`
      if (s.getFullYear() === e.getFullYear()) return `${MONTHS_SHORT[s.getMonth()]} ${s.getDate()} – ${MONTHS_SHORT[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`
      return `${MONTHS_SHORT[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()} – ${MONTHS_SHORT[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`
    }
    return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
  }, [view, cursor])

  // ── Month grid cells ─────────────────────────────────────────────────────
  const monthCells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const startOffset = first.getDay()
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
    const cells: { date: Date; inMonth: boolean }[] = []
    for (let i = startOffset - 1; i >= 0; i--) cells.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), -i), inMonth: false })
    for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), d), inMonth: true })
    while (cells.length < 42) { const last = cells[cells.length - 1].date; cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false }) }
    return cells
  }, [cursor])

  const weekDays = useMemo(() => { const s = startOfWeek(cursor); return Array.from({ length: 7 }, (_, i) => addDays(s, i)) }, [cursor])

  // ── Event composer ───────────────────────────────────────────────────────
  const openCreate = (date: Date, hour?: number) => {
    const start = new Date(date)
    start.setHours(hour ?? 9, 0, 0, 0)
    const end = new Date(start.getTime() + 30 * 60 * 1000)
    setEditing(null)
    setForm({
      title: '', description: '', location: '',
      starts_at: localInputValue(start), ends_at: localInputValue(end),
      all_day: false, event_type: 'event', color: '',
      repeat: 'none', interval: 1, byday: [WEEKDAYS.find(w => w.idx === start.getDay())?.code || 'MO'], recurrence_until: '',
    })
    setEditorOpen(true)
  }
  const openEdit = (o: Occurrence) => {
    const rule = o.rrule || ''
    const freq = (rule.match(/FREQ=([A-Z]+)/)?.[1] || 'none') as typeof form.repeat
    const interval = parseInt(rule.match(/INTERVAL=(\d+)/)?.[1] || '1')
    const byday = (rule.match(/BYDAY=([A-Z,]+)/)?.[1] || '').split(',').filter(Boolean)
    setEditing(o)
    setForm({
      title: o.title, description: o.description || '', location: '',
      starts_at: localInputValue(new Date(o.starts_at)),
      ends_at: o.ends_at ? localInputValue(new Date(o.ends_at)) : '',
      all_day: o.all_day, event_type: o.event_type, color: o.color || '',
      repeat: ['DAILY','WEEKLY','MONTHLY','YEARLY'].includes(freq) ? freq : 'none',
      interval: interval > 0 ? interval : 1,
      byday: byday.length ? byday : [WEEKDAYS.find(w => w.idx === new Date(o.starts_at).getDay())?.code || 'MO'],
      recurrence_until: o.recurrence_until ? o.recurrence_until.slice(0, 10) : '',
    })
    setEditorOpen(true)
  }

  const buildRRule = (): string | null => {
    if (form.repeat === 'none') return null
    let rule = `FREQ=${form.repeat}`
    if (form.interval > 1) rule += `;INTERVAL=${form.interval}`
    if (form.repeat === 'WEEKLY' && form.byday.length > 0) rule += `;BYDAY=${form.byday.join(',')}`
    return rule
  }

  const setDuration = (minutes: number) => {
    if (!form.starts_at) return
    const s = new Date(form.starts_at)
    setForm({ ...form, ends_at: localInputValue(new Date(s.getTime() + minutes * 60000)) })
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.starts_at) return
    setSaving(true)
    try {
      const desc = [form.description.trim(), form.location.trim() ? `📍 ${form.location.trim()}` : '']
        .filter(Boolean).join('\n') || null
      const payload: any = {
        title: form.title.trim(),
        description: desc,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.all_day ? null : (form.ends_at ? new Date(form.ends_at).toISOString() : null),
        all_day: form.all_day,
        event_type: form.event_type,
        color: form.color || null,
        rrule: buildRRule(),
        recurrence_until: form.recurrence_until ? new Date(form.recurrence_until + 'T23:59:59').toISOString() : null,
      }
      const url = editing ? `/api/calendar/events/${editing.id}` : '/api/calendar/events'
      const res = await fetch(url, { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (data.success) { setEditorOpen(false); fetchEvents() }
      else alert(data.error || 'Could not save the event.')
    } catch { alert('Could not save the event.') }
    finally { setSaving(false) }
  }
  const handleDelete = async () => {
    if (!editing || !confirm('Delete this event?')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/calendar/events/${editing.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) { setEditorOpen(false); fetchEvents() }
    } finally { setSaving(false) }
  }

  const todayKey = ymd(today)

  return (
    <div style={{ padding: embedded ? '0' : '20px', maxWidth: 1180, margin: '0 auto' }}>
      {/* ── Top navigation bar ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => step(-1)} style={navBtn} aria-label="Previous">‹</button>
            <button onClick={goToday} style={{ ...navBtn, width: 'auto', padding: '0 14px', fontSize: 11, letterSpacing: 1 }}>TODAY</button>
            <button onClick={() => step(1)} style={navBtn} aria-label="Next">›</button>
          </div>
          {/* Jump-to-date */}
          <div ref={jumpRef} style={{ position: 'relative' }}>
            <button onClick={() => setJumpOpen(v => !v)} style={{ ...rangeBtn }}>
              {rangeLabel} <span style={{ opacity: 0.6, fontSize: 10 }}>▾</span>
            </button>
            {jumpOpen && (
              <div style={jumpPanel}>
                <div style={{ fontSize: 9, letterSpacing: 2, fontWeight: 700, color: 'var(--brand-on-sidebar-muted, #888)', marginBottom: 6 }}>JUMP TO DATE</div>
                <input type="date" defaultValue={ymd(cursor)} onChange={e => jumpTo(e.target.value)} style={field} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {MONTHS_SHORT.map((m, i) => (
                    <button key={m} onClick={() => { const d = new Date(cursor); d.setMonth(i); d.setDate(1); setCursor(d); setJumpOpen(false) }}
                      style={{ ...chip, background: cursor.getMonth() === i ? 'var(--brand-primary, #4a9eff)' : 'transparent', color: cursor.getMonth() === i ? '#fff' : 'var(--brand-on-sidebar-muted, #888)' }}>{m}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <button onClick={() => { const d = new Date(cursor); d.setFullYear(d.getFullYear() - 1); setCursor(d) }} style={chip}>‹ {cursor.getFullYear() - 1}</button>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand-on-header, #1a1a2e)' }}>{cursor.getFullYear()}</span>
                  <button onClick={() => { const d = new Date(cursor); d.setFullYear(d.getFullYear() + 1); setCursor(d) }} style={chip}>{cursor.getFullYear() + 1} ›</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* View switcher */}
          <div style={{ display: 'flex', background: 'var(--brand-card-surface, #e2e4ea)', border: '1px solid var(--brand-card-border, #c4c8d0)', borderRadius: 8, padding: 2 }}>
            {(['month','week','day'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                  background: view === v ? 'var(--brand-primary, #4a9eff)' : 'transparent',
                  color: view === v ? '#fff' : 'var(--brand-on-sidebar-muted, #888)',
                }}>{v}</button>
            ))}
          </div>
          <button onClick={() => openCreate(selectedDay ? new Date(selectedDay + 'T09:00') : cursor)} style={primaryBtn}>+ NEW</button>
        </div>
      </div>

      {/* ── The calendar surface (fitted box, analytics-matching) ────────── */}
      <div style={{ background: 'var(--brand-card-surface, #e2e4ea)', border: '1px solid var(--brand-card-border, #c4c8d0)', borderRadius: 12, padding: 14, opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
        {view === 'month' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
              {DOW.map(d => <div key={d} style={dowHead}>{d.toUpperCase()}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(96px, 1fr)', gap: 6 }}>
              {monthCells.map(({ date, inMonth }, i) => {
                const key = ymd(date); const events = byDay[key] || []
                const isToday = key === todayKey; const isSelected = key === selectedDay
                return (
                  <div key={i} onClick={() => setSelectedDay(key)} onDoubleClick={() => openCreate(date)}
                    style={{
                      background: inMonth ? 'var(--brand-page-bg, #fff)' : 'transparent',
                      border: `1px solid ${isSelected ? 'var(--brand-primary, #4a9eff)' : 'var(--brand-sidebar-active-bg, #e2e4ea)'}`,
                      borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden', opacity: inMonth ? 1 : 0.4,
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 600, width: 22, height: 22, lineHeight: '22px', textAlign: 'center', borderRadius: '50%', background: isToday ? 'var(--brand-primary, #4a9eff)' : 'transparent', color: isToday ? '#fff' : 'var(--brand-on-header, #1a1a2e)' }}>{date.getDate()}</span>
                      {events.length > 0 && <span style={{ fontSize: 9, color: 'var(--brand-on-sidebar-muted, #888)' }}>{events.length}</span>}
                    </div>
                    {events.slice(0, 3).map((o, j) => (
                      <button key={o.id + j} onClick={(e) => { e.stopPropagation(); openEdit(o) }}
                        style={{ textAlign: 'left', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '2px 5px', fontSize: 10, fontWeight: 600, color: '#fff', background: o.color || TYPE_COLORS[o.event_type] || 'var(--brand-primary, #4a9eff)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {!o.all_day && <span style={{ opacity: 0.85 }}>{fmtTime(new Date(o.occurrence_start))} </span>}{o.title}
                      </button>
                    ))}
                    {events.length > 3 && <span style={{ fontSize: 9, color: 'var(--brand-on-sidebar-muted, #888)', paddingLeft: 4 }}>+{events.length - 3} more</span>}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {(view === 'week' || view === 'day') && (
          <TimeGrid
            days={view === 'week' ? weekDays : [cursor]}
            byDay={byDay} todayKey={todayKey}
            onSlot={(date, hour) => openCreate(date, hour)}
            onEvent={openEdit}
          />
        )}
      </div>

      {/* ── Day detail (month + day views) ─────────────────────────────── */}
      {selectedDay && view !== 'week' && (() => {
        const dayEvents = byDay[selectedDay] || []
        const d = new Date(selectedDay + 'T12:00:00')
        return (
          <div style={{ marginTop: 16, padding: 16, borderRadius: 10, background: 'var(--brand-page-bg, #fff)', border: '1px solid var(--brand-sidebar-active-bg, #e2e4ea)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1, color: 'var(--brand-on-header, #1a1a2e)' }}>
                {DOW[d.getDay()].toUpperCase()}, {MONTHS[d.getMonth()].toUpperCase()} {d.getDate()}
              </div>
              <button onClick={() => openCreate(d)} style={{ ...primaryBtn, padding: '6px 12px' }}>+ ADD</button>
            </div>
            {dayEvents.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--brand-on-sidebar-muted, #888)', padding: '8px 0' }}>No events. Click “+ ADD” to create one.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dayEvents.map((o, i) => (
                  <div key={o.id + i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 10, borderRadius: 8, border: '1px solid var(--brand-sidebar-active-bg, #e2e4ea)', borderLeft: `4px solid ${o.color || TYPE_COLORS[o.event_type] || 'var(--brand-primary, #4a9eff)'}` }}>
                    <div style={{ minWidth: 84, fontSize: 11, fontWeight: 700, color: 'var(--brand-on-header, #1a1a2e)' }}>{o.all_day ? 'ALL DAY' : fmtTime(new Date(o.occurrence_start))}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-on-header, #1a1a2e)' }}>{o.title}</span>
                        <span style={{ fontSize: 8, letterSpacing: 1, fontWeight: 700, padding: '2px 6px', borderRadius: 3, color: '#fff', background: TYPE_COLORS[o.event_type] || 'var(--brand-primary, #4a9eff)' }}>{o.event_type.toUpperCase()}</span>
                        {o.is_recurring_instance && <span style={{ fontSize: 8, letterSpacing: 1, color: 'var(--brand-on-sidebar-muted, #888)' }}>↻ REPEATS</span>}
                      </div>
                      {o.description && <div style={{ fontSize: 11, color: 'var(--brand-on-sidebar-muted, #888)', marginTop: 3, whiteSpace: 'pre-line' }}>{o.description}</div>}
                      {o.lead_id && <a href={`/dashboard/leads`} style={{ fontSize: 10, color: 'var(--brand-primary, #4a9eff)', fontWeight: 700, textDecoration: 'none', marginTop: 3, display: 'inline-block' }}>FROM A LEAD · OPEN LEADS →</a>}
                    </div>
                    <button onClick={() => openEdit(o)} style={{ ...ghostBtn, padding: '6px 10px', fontSize: 10 }}>EDIT</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Event composer modal ───────────────────────────────────────── */}
      {editorOpen && (
        <div onClick={() => setEditorOpen(false)} style={overlay}>
          <div onClick={e => e.stopPropagation()} style={modal}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1, marginBottom: 14, color: 'var(--brand-on-header, #1a1a2e)' }}>{editing ? 'EDIT EVENT' : 'NEW EVENT'}</div>

            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={{ ...field, fontSize: 16, fontWeight: 600 }} placeholder="Add a title" autoFocus />

            {/* type pills */}
            <div style={{ display: 'flex', gap: 6, margin: '10px 0' }}>
              {(['event','callback','appointment'] as const).map(t => (
                <button key={t} onClick={() => setForm({ ...form, event_type: t })}
                  style={{ flex: 1, padding: '8px', borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: 'pointer', border: `1px solid ${form.event_type === t ? TYPE_COLORS[t] : 'var(--brand-sidebar-active-bg, #ccc)'}`, background: form.event_type === t ? TYPE_COLORS[t] : 'transparent', color: form.event_type === t ? '#fff' : 'var(--brand-on-sidebar-muted, #888)' }}>{t.toUpperCase()}</button>
              ))}
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 10px', fontSize: 12, color: 'var(--brand-on-header, #1a1a2e)' }}>
              <input type="checkbox" checked={form.all_day} onChange={e => setForm({ ...form, all_day: e.target.checked })} /> All day
            </label>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>STARTS</label>
                <input type={form.all_day ? 'date' : 'datetime-local'} value={form.all_day ? form.starts_at.slice(0,10) : form.starts_at} onChange={e => setForm({ ...form, starts_at: form.all_day ? e.target.value + 'T00:00' : e.target.value })} style={field} />
              </div>
              {!form.all_day && (
                <div style={{ flex: 1 }}>
                  <label style={lbl}>ENDS</label>
                  <input type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} style={field} />
                </div>
              )}
            </div>

            {/* quick duration chips */}
            {!form.all_day && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {[{ m: 15, l: '15m' }, { m: 30, l: '30m' }, { m: 60, l: '1h' }, { m: 90, l: '1.5h' }, { m: 120, l: '2h' }].map(d => (
                  <button key={d.m} onClick={() => setDuration(d.m)} style={chip}>{d.l}</button>
                ))}
              </div>
            )}

            <label style={lbl}>LOCATION</label>
            <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} style={field} placeholder="Add location (optional)" />

            {/* color picker */}
            <label style={lbl}>COLOR</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {PALETTE.map(c => {
                const on = form.color === c.value
                const swatch = c.value || 'var(--brand-primary, #4a9eff)'
                return (
                  <button key={c.name} onClick={() => setForm({ ...form, color: c.value })} title={c.name}
                    style={{ width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', background: swatch, border: on ? '3px solid var(--brand-on-header, #1a1a2e)' : '2px solid transparent', boxShadow: on ? '0 0 0 1px #fff inset' : 'none' }} />
                )
              })}
            </div>

            {/* recurrence builder */}
            <label style={lbl}>REPEAT</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <select value={form.repeat} onChange={e => setForm({ ...form, repeat: e.target.value as typeof form.repeat })} style={{ ...field, flex: 1, marginBottom: 0 }}>
                <option value="none">Does not repeat</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
              {form.repeat !== 'none' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--brand-on-sidebar-muted, #888)' }}>every</span>
                  <input type="number" min={1} max={99} value={form.interval} onChange={e => setForm({ ...form, interval: Math.max(1, parseInt(e.target.value) || 1) })} style={{ ...field, width: 56, marginBottom: 0, textAlign: 'center' }} />
                </div>
              )}
            </div>

            {form.repeat === 'WEEKLY' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {WEEKDAYS.map(w => {
                  const on = form.byday.includes(w.code)
                  return (
                    <button key={w.code} onClick={() => setForm({ ...form, byday: on ? form.byday.filter(c => c !== w.code) : [...form.byday, w.code] })}
                      style={{ width: 38, height: 32, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1px solid ${on ? 'var(--brand-primary, #4a9eff)' : 'var(--brand-sidebar-active-bg, #ccc)'}`, background: on ? 'var(--brand-primary, #4a9eff)' : 'transparent', color: on ? '#fff' : 'var(--brand-on-sidebar-muted, #888)' }}>{w.label[0]}</button>
                  )
                })}
              </div>
            )}

            {form.repeat !== 'none' && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>ENDS ON (optional)</label>
                  <input type="date" value={form.recurrence_until} onChange={e => setForm({ ...form, recurrence_until: e.target.value })} style={{ ...field, marginBottom: 0 }} />
                </div>
              </div>
            )}

            {form.repeat !== 'none' && (
              <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--brand-primary, #4a9eff)', marginBottom: 10, padding: '6px 10px', background: 'var(--brand-primary-soft, #eef4ff)', borderRadius: 6 }}>
                ↻ {describeRecurrence(form.repeat, form.interval, form.byday, form.recurrence_until)}
              </div>
            )}

            <label style={lbl}>NOTES</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...field, minHeight: 56, resize: 'vertical' }} placeholder="Optional notes" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <div>{editing && <button onClick={handleDelete} disabled={saving} style={{ ...ghostBtn, color: '#dc2626', borderColor: '#dc2626' }}>DELETE</button>}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditorOpen(false)} disabled={saving} style={ghostBtn}>CANCEL</button>
                <button onClick={handleSave} disabled={saving || !form.title.trim()} style={primaryBtn}>{saving ? 'SAVING…' : editing ? 'SAVE' : 'CREATE'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// TimeGrid — week/day hour grid with positioned events (Google-Calendar style)
// =============================================================================
function TimeGrid({ days, byDay, todayKey, onSlot, onEvent }: {
  days: Date[]
  byDay: Record<string, Occurrence[]>
  todayKey: string
  onSlot: (date: Date, hour: number) => void
  onEvent: (o: Occurrence) => void
}) {
  const HOUR_PX = 48
  return (
    <div style={{ display: 'flex', maxHeight: '64vh', overflowY: 'auto', border: '1px solid var(--brand-sidebar-active-bg, #e2e4ea)', borderRadius: 8 }}>
      {/* hour gutter */}
      <div style={{ width: 56, flexShrink: 0, borderRight: '1px solid var(--brand-sidebar-active-bg, #e2e4ea)' }}>
        <div style={{ height: 28 }} />
        {HOURS.map(h => (
          <div key={h} style={{ height: HOUR_PX, fontSize: 9, color: 'var(--brand-on-sidebar-muted, #888)', textAlign: 'right', paddingRight: 6, transform: 'translateY(-6px)' }}>
            {h === 0 ? '' : `${((h % 12) || 12)} ${h < 12 ? 'AM' : 'PM'}`}
          </div>
        ))}
      </div>
      {/* day columns */}
      {days.map((day, di) => {
        const key = ymd(day)
        const events = (byDay[key] || []).filter(o => !o.all_day)
        const allDay = (byDay[key] || []).filter(o => o.all_day)
        const isToday = key === todayKey
        return (
          <div key={di} style={{ flex: 1, minWidth: 0, borderRight: di < days.length - 1 ? '1px solid var(--brand-sidebar-active-bg, #e2e4ea)' : 'none', position: 'relative' }}>
            {/* day header */}
            <div style={{ height: 28, textAlign: 'center', fontSize: 10, fontWeight: 700, position: 'sticky', top: 0, background: 'var(--brand-card-surface, #e2e4ea)', zIndex: 2, color: isToday ? 'var(--brand-primary, #4a9eff)' : 'var(--brand-on-header, #1a1a2e)', borderBottom: '1px solid var(--brand-sidebar-active-bg, #e2e4ea)' }}>
              {DOW[day.getDay()].toUpperCase()} {day.getDate()}
            </div>
            {allDay.length > 0 && (
              <div style={{ padding: 2, display: 'flex', flexDirection: 'column', gap: 2, borderBottom: '1px solid var(--brand-sidebar-active-bg, #e2e4ea)' }}>
                {allDay.map((o, i) => (
                  <button key={o.id + i} onClick={() => onEvent(o)} style={{ textAlign: 'left', border: 'none', borderRadius: 3, cursor: 'pointer', padding: '2px 5px', fontSize: 9, fontWeight: 600, color: '#fff', background: o.color || TYPE_COLORS[o.event_type] || 'var(--brand-primary, #4a9eff)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.title}</button>
                ))}
              </div>
            )}
            {/* hour slots */}
            <div style={{ position: 'relative' }}>
              {HOURS.map(h => (
                <div key={h} onClick={() => onSlot(day, h)} style={{ height: HOUR_PX, borderBottom: '1px solid var(--brand-sidebar-active-bg, #eee)', cursor: 'pointer' }} />
              ))}
              {/* positioned timed events */}
              {events.map((o, i) => {
                const s = new Date(o.occurrence_start)
                const e = o.occurrence_end ? new Date(o.occurrence_end) : new Date(s.getTime() + 30 * 60000)
                const top = (s.getHours() + s.getMinutes() / 60) * HOUR_PX
                const height = Math.max(18, ((e.getTime() - s.getTime()) / 3600000) * HOUR_PX)
                return (
                  <button key={o.id + i} onClick={() => onEvent(o)}
                    style={{ position: 'absolute', top, height, left: 2, right: 2, textAlign: 'left', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '2px 5px', fontSize: 9, fontWeight: 600, color: '#fff', background: o.color || TYPE_COLORS[o.event_type] || 'var(--brand-primary, #4a9eff)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                    <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.title}</div>
                    <div style={{ opacity: 0.85 }}>{fmtTime(s)}</div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── styles ──────────────────────────────────────────────────────────────────
const navBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: 6, border: '1px solid var(--brand-sidebar-active-bg, #ccc)', background: 'var(--brand-page-bg, #fff)', color: 'var(--brand-on-header, #1a1a2e)', cursor: 'pointer', fontSize: 16, fontWeight: 700 }
const rangeBtn: React.CSSProperties = { padding: '7px 14px', borderRadius: 8, border: '1px solid var(--brand-sidebar-active-bg, #ccc)', background: 'var(--brand-page-bg, #fff)', color: 'var(--brand-on-header, #1a1a2e)', cursor: 'pointer', fontSize: 15, fontWeight: 800, letterSpacing: 0.5 }
const primaryBtn: React.CSSProperties = { padding: '8px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--brand-primary, #4a9eff)', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 1 }
const ghostBtn: React.CSSProperties = { padding: '8px 14px', borderRadius: 6, cursor: 'pointer', background: 'transparent', border: '1px solid var(--brand-sidebar-active-bg, #ccc)', color: 'var(--brand-on-sidebar-muted, #888)', fontSize: 11, fontWeight: 700, letterSpacing: 1 }
const chip: React.CSSProperties = { padding: '5px 9px', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--brand-sidebar-active-bg, #ccc)', background: 'transparent', color: 'var(--brand-on-sidebar-muted, #888)' }
const dowHead: React.CSSProperties = { textAlign: 'center', fontSize: 10, letterSpacing: 2, fontWeight: 700, color: 'var(--brand-on-sidebar-muted, #888)' }
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', overflowY: 'auto' }
const modal: React.CSSProperties = { width: '100%', maxWidth: 460, background: 'var(--brand-page-bg, #fff)', borderRadius: 12, padding: 20, boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 9, letterSpacing: 2, fontWeight: 700, color: 'var(--brand-on-sidebar-muted, #888)', margin: '8px 0 4px' }
const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--brand-sidebar-active-bg, #ccc)', background: 'var(--brand-page-bg, #fff)', color: 'var(--brand-on-header, #1a1a2e)', fontSize: 13, marginBottom: 4 }
const jumpPanel: React.CSSProperties = { position: 'absolute', top: '110%', left: 0, zIndex: 50, width: 280, background: 'var(--brand-page-bg, #fff)', border: '1px solid var(--brand-sidebar-active-bg, #ccc)', borderRadius: 10, padding: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }
