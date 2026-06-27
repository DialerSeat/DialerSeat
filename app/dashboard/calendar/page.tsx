'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useUser } from '@clerk/nextjs'

// =============================================================================
// CALENDAR PAGE — /dashboard/calendar
// =============================================================================
// A full month calendar for the signed-in agent: timed, all-day, and recurring
// events. Click a day to create an event; click an event to edit/delete; search
// jumps to a date. Events also arrive here from dialer dispositions (callback /
// appointment) via the same calendar_events table.
//
// THEMING: all colors come from the tenant-overridable --brand-* CSS variables,
// so the calendar inherits DialerSeat's palette and any white-label override
// with no per-tenant code.
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

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const WEEKDAYS = [
  { code: 'MO', label: 'Mon' }, { code: 'TU', label: 'Tue' }, { code: 'WE', label: 'Wed' },
  { code: 'TH', label: 'Thu' }, { code: 'FR', label: 'Fri' }, { code: 'SA', label: 'Sat' }, { code: 'SU', label: 'Sun' },
]

const TYPE_COLORS: Record<string, string> = {
  event: 'var(--brand-primary)',
  callback: '#d97706',
  appointment: '#2563eb',
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function localInputValue(d: Date): string {
  // For datetime-local inputs: YYYY-MM-DDTHH:MM in local time.
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function CalendarPage() {
  const { user } = useUser()
  const today = useMemo(() => new Date(), [])
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [loading, setLoading] = useState(true)
  const [searchDate, setSearchDate] = useState('')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // Editor modal state
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Occurrence | null>(null)
  const [form, setForm] = useState({
    title: '', description: '', starts_at: '', ends_at: '', all_day: false,
    event_type: 'event' as 'event' | 'callback' | 'appointment',
    repeat: 'none' as 'none' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY',
    byday: [] as string[], recurrence_until: '',
  })
  const [saving, setSaving] = useState(false)

  // ── Fetch the visible window (month +/- buffer) ─────────────────────────
  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const from = new Date(viewYear, viewMonth - 1, 1)
      const to = new Date(viewYear, viewMonth + 2, 0)
      const res = await fetch(`/api/calendar/events?from=${from.toISOString()}&to=${to.toISOString()}`)
      const data = await res.json()
      if (data.success) setOccurrences(data.events)
    } catch {
      // apiError already logged server-side; keep the UI calm.
    } finally {
      setLoading(false)
    }
  }, [viewYear, viewMonth])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  // ── Build the month grid (6 weeks x 7 days) ──────────────────────────────
  const grid = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1)
    const startOffset = first.getDay() // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells: { date: Date; inMonth: boolean }[] = []
    // Leading days from previous month
    for (let i = startOffset - 1; i >= 0; i--) {
      cells.push({ date: new Date(viewYear, viewMonth, -i), inMonth: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(viewYear, viewMonth, d), inMonth: true })
    }
    // Trailing to fill 6 rows (42 cells)
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date
      cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false })
    }
    return cells
  }, [viewYear, viewMonth])

  // Index occurrences by local YMD for fast per-day lookup.
  const byDay = useMemo(() => {
    const map: Record<string, Occurrence[]> = {}
    for (const o of occurrences) {
      const key = ymd(new Date(o.occurrence_start))
      ;(map[key] ||= []).push(o)
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.occurrence_start.localeCompare(b.occurrence_start))
    }
    return map
  }, [occurrences])

  const goMonth = (delta: number) => {
    let m = viewMonth + delta, y = viewYear
    if (m < 0) { m = 11; y-- } else if (m > 11) { m = 0; y++ }
    setViewMonth(m); setViewYear(y)
  }
  const goToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDay(ymd(today)) }

  const handleSearch = () => {
    if (!searchDate) return
    const d = new Date(searchDate + 'T12:00:00')
    if (isNaN(d.getTime())) return
    setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); setSelectedDay(ymd(d))
  }

  // ── Open editor for a new event on a given day ──────────────────────────
  const openCreate = (date: Date) => {
    const start = new Date(date)
    start.setHours(9, 0, 0, 0)
    const end = new Date(date)
    end.setHours(10, 0, 0, 0)
    setEditing(null)
    setForm({
      title: '', description: '',
      starts_at: localInputValue(start), ends_at: localInputValue(end),
      all_day: false, event_type: 'event', repeat: 'none', byday: [], recurrence_until: '',
    })
    setEditorOpen(true)
  }

  // ── Open editor for an existing event ───────────────────────────────────
  const openEdit = (o: Occurrence) => {
    const rule = o.rrule || ''
    const freq = (rule.match(/FREQ=([A-Z]+)/)?.[1] || 'none') as typeof form.repeat
    const byday = (rule.match(/BYDAY=([A-Z,]+)/)?.[1] || '').split(',').filter(Boolean)
    setEditing(o)
    setForm({
      title: o.title, description: o.description || '',
      starts_at: localInputValue(new Date(o.starts_at)),
      ends_at: o.ends_at ? localInputValue(new Date(o.ends_at)) : '',
      all_day: o.all_day,
      event_type: o.event_type,
      repeat: ['DAILY','WEEKLY','MONTHLY','YEARLY'].includes(freq) ? freq : 'none',
      byday,
      recurrence_until: o.recurrence_until ? o.recurrence_until.slice(0, 10) : '',
    })
    setEditorOpen(true)
  }

  const buildRRule = (): string | null => {
    if (form.repeat === 'none') return null
    let rule = `FREQ=${form.repeat}`
    if (form.repeat === 'WEEKLY' && form.byday.length > 0) rule += `;BYDAY=${form.byday.join(',')}`
    return rule
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.starts_at) return
    setSaving(true)
    try {
      const payload: any = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        all_day: form.all_day,
        event_type: form.event_type,
        rrule: buildRRule(),
        recurrence_until: form.recurrence_until ? new Date(form.recurrence_until + 'T23:59:59').toISOString() : null,
      }
      const url = editing ? `/api/calendar/events/${editing.id}` : '/api/calendar/events'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        setEditorOpen(false)
        fetchEvents()
      } else {
        alert(data.error || 'Could not save the event.')
      }
    } catch {
      alert('Could not save the event.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editing) return
    if (!confirm('Delete this event?')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/calendar/events/${editing.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) { setEditorOpen(false); fetchEvents() }
    } finally {
      setSaving(false)
    }
  }

  const todayKey = ymd(today)

  return (
    <div style={{ padding: '20px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1, color: 'var(--brand-on-header, #1a1a2e)', margin: 0 }}>
            {MONTHS[viewMonth]} {viewYear}
          </h1>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => goMonth(-1)} style={navBtn}>‹</button>
            <button onClick={goToday} style={{ ...navBtn, width: 'auto', padding: '0 12px', fontSize: 11, letterSpacing: 1 }}>TODAY</button>
            <button onClick={() => goMonth(1)} style={navBtn}>›</button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)}
            style={searchInput} aria-label="Search a date" />
          <button onClick={handleSearch} style={primaryBtn}>GO</button>
          <button onClick={() => openCreate(selectedDay ? new Date(selectedDay + 'T09:00') : today)} style={primaryBtn}>+ NEW</button>
        </div>
      </div>

      {/* Calendar card — same fitted surface as the analytics boxes
          (--brand-card-surface / --brand-card-border), tenant-overridable, so
          the calendar reads as a solid panel rather than floating cells. */}
      <div style={{
        background: 'var(--brand-card-surface, #e2e4ea)',
        border: '1px solid var(--brand-card-border, #c4c8d0)',
        borderRadius: 12,
        padding: 14,
      }}>
        {/* Weekday header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
          {DOW.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 10, letterSpacing: 2, fontWeight: 700, color: 'var(--brand-on-sidebar-muted, #888)' }}>{d.toUpperCase()}</div>
          ))}
        </div>

        {/* Month grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(96px, 1fr)', gap: 6, opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
        {grid.map(({ date, inMonth }, i) => {
          const key = ymd(date)
          const events = byDay[key] || []
          const isToday = key === todayKey
          const isSelected = key === selectedDay
          return (
            <div key={i}
              onClick={() => setSelectedDay(key)}
              onDoubleClick={() => openCreate(date)}
              style={{
                background: inMonth ? 'var(--brand-page-bg, #fff)' : 'transparent',
                border: `1px solid ${isSelected ? 'var(--brand-primary, #4a9eff)' : 'var(--brand-sidebar-active-bg, #e2e4ea)'}`,
                borderRadius: 8, padding: 6, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden',
                opacity: inMonth ? 1 : 0.4,
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: 12, fontWeight: isToday ? 800 : 600,
                  width: 22, height: 22, lineHeight: '22px', textAlign: 'center', borderRadius: '50%',
                  background: isToday ? 'var(--brand-primary, #4a9eff)' : 'transparent',
                  color: isToday ? '#fff' : 'var(--brand-on-header, #1a1a2e)',
                }}>{date.getDate()}</span>
                {events.length > 0 && (
                  <span style={{ fontSize: 9, color: 'var(--brand-on-sidebar-muted, #888)' }}>{events.length}</span>
                )}
              </div>
              {events.slice(0, 3).map((o, j) => (
                <button key={o.id + j} onClick={(e) => { e.stopPropagation(); openEdit(o) }}
                  style={{
                    textAlign: 'left', border: 'none', borderRadius: 4, cursor: 'pointer',
                    padding: '2px 5px', fontSize: 10, fontWeight: 600, color: '#fff',
                    background: o.color || TYPE_COLORS[o.event_type] || 'var(--brand-primary, #4a9eff)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                  {!o.all_day && <span style={{ opacity: 0.85 }}>{new Date(o.occurrence_start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} </span>}
                  {o.title}
                </button>
              ))}
              {events.length > 3 && (
                <span style={{ fontSize: 9, color: 'var(--brand-on-sidebar-muted, #888)', paddingLeft: 4 }}>+{events.length - 3} more</span>
              )}
            </div>
          )
        })}
        </div>
      </div>

      {/* Day detail — full list of the selected day's events */}
      {selectedDay && (() => {
        const dayEvents = byDay[selectedDay] || []
        const d = new Date(selectedDay + 'T12:00:00')
        return (
          <div style={{
            marginTop: 16, padding: 16, borderRadius: 10,
            background: 'var(--brand-page-bg, #fff)',
            border: '1px solid var(--brand-sidebar-active-bg, #e2e4ea)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1, color: 'var(--brand-on-header, #1a1a2e)' }}>
                {DOW[d.getDay()].toUpperCase()}, {MONTHS[d.getMonth()].toUpperCase()} {d.getDate()}
              </div>
              <button onClick={() => openCreate(d)} style={{ ...primaryBtn, padding: '6px 12px' }}>+ ADD</button>
            </div>

            {dayEvents.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--brand-on-sidebar-muted, #888)', padding: '8px 0' }}>
                No events. Click “+ ADD” to create one.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dayEvents.map((o, i) => (
                  <div key={o.id + i}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12, padding: 10, borderRadius: 8,
                      border: '1px solid var(--brand-sidebar-active-bg, #e2e4ea)',
                      borderLeft: `4px solid ${o.color || TYPE_COLORS[o.event_type] || 'var(--brand-primary, #4a9eff)'}`,
                    }}>
                    <div style={{ minWidth: 84, fontSize: 11, fontWeight: 700, color: 'var(--brand-on-header, #1a1a2e)' }}>
                      {o.all_day ? 'ALL DAY' : new Date(o.occurrence_start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-on-header, #1a1a2e)' }}>{o.title}</span>
                        <span style={{
                          fontSize: 8, letterSpacing: 1, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                          color: '#fff', background: TYPE_COLORS[o.event_type] || 'var(--brand-primary, #4a9eff)',
                        }}>{o.event_type.toUpperCase()}</span>
                        {o.is_recurring_instance && (
                          <span style={{ fontSize: 8, letterSpacing: 1, color: 'var(--brand-on-sidebar-muted, #888)' }}>↻ REPEATS</span>
                        )}
                      </div>
                      {o.description && (
                        <div style={{ fontSize: 11, color: 'var(--brand-on-sidebar-muted, #888)', marginTop: 3 }}>{o.description}</div>
                      )}
                      {o.lead_id && (
                        <a href={`/dashboard/leads`}
                          style={{ fontSize: 10, color: 'var(--brand-primary, #4a9eff)', fontWeight: 700, textDecoration: 'none', marginTop: 3, display: 'inline-block' }}>
                          FROM A LEAD · OPEN LEADS →
                        </a>
                      )}
                    </div>
                    <button onClick={() => openEdit(o)} style={{ ...ghostBtn, padding: '6px 10px', fontSize: 10 }}>EDIT</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Editor modal */}
      {editorOpen && (
        <div onClick={() => setEditorOpen(false)} style={overlay}>
          <div onClick={e => e.stopPropagation()} style={modal}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1, marginBottom: 14, color: 'var(--brand-on-header, #1a1a2e)' }}>
              {editing ? 'EDIT EVENT' : 'NEW EVENT'}
            </div>

            <label style={lbl}>TITLE</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={field} placeholder="Event title" autoFocus />

            <label style={lbl}>NOTES</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...field, minHeight: 56, resize: 'vertical' }} placeholder="Optional notes" />

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 10px', fontSize: 12, color: 'var(--brand-on-header, #1a1a2e)' }}>
              <input type="checkbox" checked={form.all_day} onChange={e => setForm({ ...form, all_day: e.target.checked })} />
              All day
            </label>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>STARTS</label>
                <input type={form.all_day ? 'date' : 'datetime-local'} value={form.all_day ? form.starts_at.slice(0,10) : form.starts_at}
                  onChange={e => setForm({ ...form, starts_at: form.all_day ? e.target.value + 'T00:00' : e.target.value })} style={field} />
              </div>
              {!form.all_day && (
                <div style={{ flex: 1 }}>
                  <label style={lbl}>ENDS</label>
                  <input type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} style={field} />
                </div>
              )}
            </div>

            <label style={lbl}>TYPE</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {(['event','callback','appointment'] as const).map(t => (
                <button key={t} onClick={() => setForm({ ...form, event_type: t })}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: 'pointer',
                    border: `1px solid ${form.event_type === t ? (TYPE_COLORS[t]) : 'var(--brand-sidebar-active-bg, #ccc)'}`,
                    background: form.event_type === t ? TYPE_COLORS[t] : 'transparent',
                    color: form.event_type === t ? '#fff' : 'var(--brand-on-sidebar-muted, #888)',
                  }}>{t.toUpperCase()}</button>
              ))}
            </div>

            <label style={lbl}>REPEAT</label>
            <select value={form.repeat} onChange={e => setForm({ ...form, repeat: e.target.value as typeof form.repeat })} style={field}>
              <option value="none">Does not repeat</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>

            {form.repeat === 'WEEKLY' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                {WEEKDAYS.map(w => {
                  const on = form.byday.includes(w.code)
                  return (
                    <button key={w.code} onClick={() => setForm({ ...form, byday: on ? form.byday.filter(c => c !== w.code) : [...form.byday, w.code] })}
                      style={{
                        padding: '5px 9px', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        border: `1px solid ${on ? 'var(--brand-primary, #4a9eff)' : 'var(--brand-sidebar-active-bg, #ccc)'}`,
                        background: on ? 'var(--brand-primary, #4a9eff)' : 'transparent',
                        color: on ? '#fff' : 'var(--brand-on-sidebar-muted, #888)',
                      }}>{w.label}</button>
                  )
                })}
              </div>
            )}

            {form.repeat !== 'none' && (
              <>
                <label style={lbl}>REPEAT UNTIL (optional)</label>
                <input type="date" value={form.recurrence_until} onChange={e => setForm({ ...form, recurrence_until: e.target.value })} style={field} />
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <div>
                {editing && (
                  <button onClick={handleDelete} disabled={saving}
                    style={{ ...ghostBtn, color: '#dc2626', borderColor: '#dc2626' }}>DELETE</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditorOpen(false)} disabled={saving} style={ghostBtn}>CANCEL</button>
                <button onClick={handleSave} disabled={saving || !form.title.trim()} style={primaryBtn}>
                  {saving ? 'SAVING…' : editing ? 'SAVE' : 'CREATE'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── inline styles (tenant-overridable via --brand-* tokens) ─────────────────
const navBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 6, border: '1px solid var(--brand-sidebar-active-bg, #ccc)',
  background: 'transparent', color: 'var(--brand-on-header, #1a1a2e)', cursor: 'pointer', fontSize: 16, fontWeight: 700,
}
const primaryBtn: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
  background: 'var(--brand-primary, #4a9eff)', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 1,
}
const ghostBtn: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 6, cursor: 'pointer',
  background: 'transparent', border: '1px solid var(--brand-sidebar-active-bg, #ccc)',
  color: 'var(--brand-on-sidebar-muted, #888)', fontSize: 11, fontWeight: 700, letterSpacing: 1,
}
const searchInput: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 6, border: '1px solid var(--brand-sidebar-active-bg, #ccc)',
  background: 'var(--brand-page-bg, #fff)', color: 'var(--brand-on-header, #1a1a2e)', fontSize: 12,
}
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', overflowY: 'auto',
}
const modal: React.CSSProperties = {
  width: '100%', maxWidth: 440, background: 'var(--brand-page-bg, #fff)', borderRadius: 12,
  padding: 20, boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: 9, letterSpacing: 2, fontWeight: 700,
  color: 'var(--brand-on-sidebar-muted, #888)', margin: '8px 0 4px',
}
const field: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6,
  border: '1px solid var(--brand-sidebar-active-bg, #ccc)', background: 'var(--brand-page-bg, #fff)',
  color: 'var(--brand-on-header, #1a1a2e)', fontSize: 13, marginBottom: 4,
}
