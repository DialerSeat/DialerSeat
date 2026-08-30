'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { localDay, shiftDay } from '@/lib/dailyTasks'

// =============================================================================
// Daily Tasks — regardless how you feel
// =============================================================================
// The list opens first and the calendar is the second view, because the
// question this app exists to answer is "what do I do today", not "how have I
// been doing". The calendar is for looking back at the streak and for writing
// something onto a day that has not arrived yet.
//
// Four tasks recur every day and cannot be deleted. Anything else belongs to
// one specific date — a dentist appointment, a flight — and can be added to a
// future day from the calendar, which is the only reason the calendar accepts
// input at all.
// =============================================================================

const FONT = 'Futura PT, Futura, sans-serif'
const GREEN = '#1a6a1a'
const RED = '#8a1a1a'
const AMBER = '#8a6a1a'

interface CoreItem {
  key: string
  label: string
  detail: string | null
  done: boolean
}

interface CustomItem {
  id: string
  key: string
  label: string
  done: boolean
  sort: number
}

interface DaySummary {
  coreDone: number
  customDone: number
  customTotal: number
  complete: boolean
}

interface Payload {
  ok: boolean
  today: string
  month: string
  core: CoreItem[]
  custom: CustomItem[]
  monthDays: Record<string, DaySummary>
  streak: number
  coreCount: number
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** "Friday, 29 August" — the selected day, spelled out rather than numeric. */
function prettyDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const dt = new Date(y, m - 1 + delta, 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}

export default function DailyTasksApp() {
  // The list is the startup view. Deliberate: opening on a calendar would make
  // the first thing you see a record of the past rather than the work at hand.
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [day, setDay] = useState<string>(() => localDay())
  const [month, setMonth] = useState<string>(() => localDay().slice(0, 7))
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const realToday = useMemo(() => localDay(), [])
  const isFuture = day > realToday
  const isPast = day < realToday

  // Bumped by every mutation to re-run the read below. A plain counter rather
  // than an awaited reload function: the fetch belongs in the effect that owns
  // its cancellation, and a handler should not be able to leave a response
  // landing after the day has already been switched out from under it.
  const [reloadTick, setReloadTick] = useState(0)
  const reload = useCallback(() => setReloadTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/daily-tasks?day=${day}&month=${month}`)
      .then(r => r.json())
      .then((json: Payload & { error?: string }) => {
        if (cancelled) return
        if (!json.ok) { setError(json.error || 'Could not load'); return }
        setError(null)
        setData(json)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load')
      })
    return () => { cancelled = true }
  }, [day, month, reloadTick])

  const post = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch('/api/admin/daily-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!json.ok) throw new Error(json.error || 'Could not save')
    return json
  }, [])

  const toggle = async (taskKey: string, next: boolean) => {
    if (isFuture) return
    setBusy(taskKey)
    // Optimistic: a checkbox that waits on a round trip feels broken, and this
    // is a list you tick while doing something else.
    setData(prev => prev && ({
      ...prev,
      core: prev.core.map(c => c.key === taskKey ? { ...c, done: next } : c),
      custom: prev.custom.map(c => c.key === taskKey ? { ...c, done: next } : c),
    }))
    try {
      await post({ action: 'toggle', day, taskKey, done: next })
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
      reload()
    } finally {
      setBusy(null)
    }
  }

  const addTask = async () => {
    const label = draft.trim()
    if (!label) return
    setBusy('add')
    try {
      await post({ action: 'add', day, label })
      setDraft('')
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add')
    } finally {
      setBusy(null)
    }
  }

  const removeTask = async (id: string) => {
    setBusy(id)
    try {
      await post({ action: 'remove', day, id })
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove')
    } finally {
      setBusy(null)
    }
  }

  const coreDone = data ? data.core.filter(c => c.done).length : 0
  const coreTotal = data?.coreCount ?? 4
  const allCoreDone = coreDone >= coreTotal

  // ── CALENDAR GRID ────────────────────────────────────────────────────────
  // Leading blanks so the 1st lands on its real weekday. Built from local
  // Date on purpose: the grid is a picture of the viewer's own calendar.
  const grid = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    const first = new Date(y, m - 1, 1)
    const count = new Date(y, m, 0).getDate()
    const lead = first.getDay()
    const cells: (string | null)[] = Array.from({ length: lead }, () => null)
    for (let i = 1; i <= count; i++) {
      cells.push(`${month}-${String(i).padStart(2, '0')}`)
    }
    return cells
  }, [month])

  return (
    <div style={{
      height: '100%', overflowY: 'auto', fontFamily: FONT,
      background: 'var(--brand-page-bg)', color: 'var(--brand-on-page-bg)',
      padding: '18px 20px 28px',
    }}>
      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 'bold', letterSpacing: 4,
            color: 'var(--brand-primary)',
          }}>
            DAILY TASKS
          </div>
          <div style={{
            fontSize: 12, letterSpacing: 1.2, color: 'var(--brand-muted-text)',
            marginTop: 4, fontStyle: 'italic',
          }}>
            Regardless how you feel.
          </div>
        </div>

        {/* The streak is the loudest thing on the screen on purpose — it is
            the only number here that rewards not breaking the chain. */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: 34, fontWeight: 'bold', lineHeight: 1,
            color: (data?.streak ?? 0) > 0 ? GREEN : 'var(--brand-muted-text)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {data?.streak ?? '—'}
          </div>
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--brand-muted-text)', marginTop: 3 }}>
            DAY STREAK
          </div>
        </div>
      </div>

      {/* ── VIEW SWITCH ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, margin: '18px 0 16px' }}>
        {(['list', 'calendar'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '6px 14px', cursor: 'pointer', fontFamily: FONT,
              fontSize: 9.5, letterSpacing: 1.8, textTransform: 'uppercase',
              background: view === v ? 'var(--brand-primary)' : 'transparent',
              color: view === v ? 'var(--brand-page-bg)' : 'var(--brand-primary)',
              border: '1px solid var(--brand-primary)', borderRadius: 3,
            }}
          >{v}</button>
        ))}
      </div>

      {error && (
        <div style={{
          padding: '9px 12px', marginBottom: 14, borderRadius: 3,
          background: 'rgba(138,26,26,0.08)', border: `1px solid ${RED}`,
          color: RED, fontSize: 11, letterSpacing: 0.5,
        }}>{error}</div>
      )}

      {view === 'list' && (
        <>
          {/* ── WHICH DAY ─────────────────────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap',
          }}>
            <button
              onClick={() => setDay(d => shiftDay(d, -1))}
              style={navBtn}
              aria-label="Previous day"
            >‹</button>
            <div style={{ fontSize: 13, letterSpacing: 1, minWidth: 0 }}>
              {prettyDay(day)}
            </div>
            <button
              onClick={() => setDay(d => shiftDay(d, 1))}
              style={navBtn}
              aria-label="Next day"
            >›</button>
            {day !== realToday && (
              <button onClick={() => { setDay(realToday); setMonth(realToday.slice(0, 7)) }} style={{
                ...navBtn, width: 'auto', padding: '0 10px', fontSize: 9, letterSpacing: 1.5,
              }}>TODAY</button>
            )}
          </div>

          <div style={{
            fontSize: 10, letterSpacing: 1.4, color: 'var(--brand-muted-text)', marginBottom: 16,
          }}>
            {isFuture
              ? 'A day ahead — add what you already know about it. The four cannot be ticked before they arrive.'
              : `${coreDone} of ${coreTotal} core ${allCoreDone ? '· done' : 'done'}${isPast ? ' · past day' : ''}`}
          </div>

          {/* ── THE FOUR ──────────────────────────────────────────────── */}
          {data?.core.map((t, i) => (
            <TaskRow
              key={t.key}
              index={i + 1}
              label={t.label}
              detail={t.detail}
              done={t.done}
              disabled={isFuture || busy === t.key}
              onToggle={() => toggle(t.key, !t.done)}
            />
          ))}

          {/* ── THIS DAY ONLY ─────────────────────────────────────────── */}
          <div style={{
            fontSize: 9.5, letterSpacing: 2, color: 'var(--brand-muted-text)',
            margin: '22px 0 8px',
          }}>
            JUST FOR THIS DAY
          </div>

          {data && data.custom.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--brand-muted-text)', marginBottom: 10 }}>
              Nothing extra.
            </div>
          )}

          {data?.custom.map(t => (
            <TaskRow
              key={t.id}
              label={t.label}
              done={t.done}
              disabled={isFuture || busy === t.key}
              onToggle={() => toggle(t.key, !t.done)}
              onRemove={() => removeTask(t.id)}
            />
          ))}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void addTask() }}
              placeholder={isFuture ? 'Doctor at 2pm, flight, deadline…' : 'Add something for this day…'}
              maxLength={300}
              style={{
                flex: 1, minWidth: 0, padding: '8px 10px', fontFamily: FONT, fontSize: 12,
                background: 'var(--brand-card-surface)', color: 'var(--brand-on-page-bg)',
                border: '1px solid var(--brand-muted-text)', borderRadius: 3,
              }}
            />
            <button
              onClick={() => void addTask()}
              disabled={!draft.trim() || busy === 'add'}
              style={{
                ...navBtn, width: 'auto', padding: '0 14px', fontSize: 9.5, letterSpacing: 1.5,
                opacity: draft.trim() ? 1 : 0.4,
              }}
            >ADD</button>
          </div>
        </>
      )}

      {view === 'calendar' && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
          }}>
            <button onClick={() => setMonth(m => shiftMonth(m, -1))} style={navBtn}>‹</button>
            <div style={{ fontSize: 13, letterSpacing: 1.5 }}>{monthLabel(month)}</div>
            <button onClick={() => setMonth(m => shiftMonth(m, 1))} style={navBtn}>›</button>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, maxWidth: 460,
          }}>
            {WEEKDAYS.map((w, i) => (
              <div key={i} style={{
                textAlign: 'center', fontSize: 9, letterSpacing: 1,
                color: 'var(--brand-muted-text)', paddingBottom: 4,
              }}>{w}</div>
            ))}

            {grid.map((cell, i) => {
              if (!cell) return <div key={`b${i}`} />
              const s = data?.monthDays[cell]
              const complete = !!s?.complete
              const partial = !complete && (s?.coreDone ?? 0) > 0
              const planned = !complete && !partial && (s?.customTotal ?? 0) > 0
              const isToday = cell === realToday
              const selected = cell === day
              return (
                <button
                  key={cell}
                  onClick={() => { setDay(cell); setView('list') }}
                  title={
                    complete ? 'All four done'
                      : partial ? `${s?.coreDone} of ${coreTotal} done`
                        : planned ? `${s?.customTotal} planned` : 'Nothing recorded'
                  }
                  style={{
                    aspectRatio: '1', cursor: 'pointer', fontFamily: FONT,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 2,
                    fontSize: 12, borderRadius: 3,
                    background: complete ? GREEN : 'var(--brand-card-surface)',
                    color: complete ? '#fff' : 'var(--brand-on-page-bg)',
                    border: selected
                      ? '2px solid var(--brand-primary)'
                      : isToday
                        ? '1px dashed var(--brand-primary)'
                        : `1px solid ${partial ? AMBER : 'transparent'}`,
                    opacity: cell > realToday && !planned ? 0.55 : 1,
                  }}
                >
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {Number(cell.slice(-2))}
                  </span>
                  {/* A dot for a day that has something written on it but no
                      core progress — usually a future plan. Without it, an
                      upcoming trip is invisible until you land on the day. */}
                  {planned && (
                    <span style={{
                      width: 4, height: 4, borderRadius: '50%',
                      background: 'var(--brand-primary)',
                    }} />
                  )}
                </button>
              )
            })}
          </div>

          <div style={{
            display: 'flex', gap: 14, flexWrap: 'wrap',
            fontSize: 9.5, letterSpacing: 1, color: 'var(--brand-muted-text)', marginTop: 14,
          }}>
            <Legend swatch={GREEN} text="all four done" />
            <Legend swatch="transparent" border={AMBER} text="partial" />
            <Legend dot text="something planned" />
          </div>

          <div style={{
            fontSize: 10.5, color: 'var(--brand-muted-text)',
            marginTop: 16, lineHeight: 1.65, maxWidth: 460,
          }}>
            Pick any day to open its list — including one that has not arrived,
            so a trip or an appointment can be written down when it is booked
            rather than remembered on the morning.
          </div>
        </>
      )}
    </div>
  )
}

const navBtn: React.CSSProperties = {
  width: 26, height: 26, lineHeight: 1, cursor: 'pointer', fontFamily: FONT,
  background: 'transparent', color: 'var(--brand-primary)',
  border: '1px solid var(--brand-primary)', borderRadius: 3, fontSize: 13,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
}

function Legend({ swatch, border, dot, text }: {
  swatch?: string; border?: string; dot?: boolean; text: string
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {dot ? (
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--brand-primary)' }} />
      ) : (
        <span style={{
          width: 11, height: 11, borderRadius: 2, background: swatch,
          border: border ? `1px solid ${border}` : '1px solid var(--brand-muted-text)',
        }} />
      )}
      {text}
    </span>
  )
}

function TaskRow({ index, label, detail, done, disabled, onToggle, onRemove }: {
  index?: number
  label: string
  detail?: string | null
  done: boolean
  disabled?: boolean
  onToggle: () => void
  onRemove?: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 11,
      padding: '11px 12px', marginBottom: 6, borderRadius: 4,
      background: 'var(--brand-card-surface)',
      opacity: disabled ? 0.55 : 1,
    }}>
      <button
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={done}
        style={{
          width: 20, height: 20, flexShrink: 0, marginTop: 1, borderRadius: 3,
          cursor: disabled ? 'default' : 'pointer',
          background: done ? GREEN : 'transparent',
          border: `1.5px solid ${done ? GREEN : 'var(--brand-muted-text)'}`,
          color: '#fff', fontSize: 12, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >{done ? '✓' : ''}</button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5, letterSpacing: 0.4,
          textDecoration: done ? 'line-through' : 'none',
          color: done ? 'var(--brand-muted-text)' : 'var(--brand-on-page-bg)',
        }}>
          {index ? <span style={{ color: 'var(--brand-muted-text)' }}>{index}. </span> : null}
          {label}
        </div>
        {detail && (
          <div style={{
            fontSize: 10.5, color: 'var(--brand-muted-text)', marginTop: 3, lineHeight: 1.55,
          }}>{detail}</div>
        )}
      </div>

      {onRemove && (
        <button
          onClick={onRemove}
          title="Remove"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--brand-muted-text)', fontSize: 14, lineHeight: 1, padding: 2,
          }}
        >×</button>
      )}
    </div>
  )
}
