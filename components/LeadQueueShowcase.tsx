'use client'

/**
 * LeadQueueShowcase
 * ----------------------------------------------------------------------
 * A small, self-contained, animated mockup of the dialer's Lead Queue panel
 * for marketing pages — the counterpart to DialerShowcase (which mocks the
 * lead-profile/script view).
 *
 * It DEMONSTRATES the real queue behaviour rather than just looping a pretty
 * animation, because the behaviour is the selling point:
 *
 *   1. The queue is worked strictly TOP-DOWN.
 *   2. The lead being dialed holds the top slot and pulses, with a ring timer
 *      running at real speed.
 *   3. It stays there for its full repeat count (1x / 2x / 3x), showing the
 *      attempt counter climb — it does not hand over mid-sequence.
 *   4. Once attempts are exhausted it drops to the BOTTOM of the list with
 *      its outcome, and the next lead rises into the top slot.
 *   5. The STATE filter narrows the queue, and dialing follows the filter —
 *      which is the real panel's rule ("only leads matching this filter will
 *      be dialed"), and the part visitors ask about most.
 *
 * Point 4 is the one people get wrong about dialers: leads rotate, they don't
 * disappear. Mirrors the rotation in app/dashboard/dialer's visibleQueuedLeads
 * (sort by last_called_at, nulls first).
 *
 * DELIBERATELY FAKE: no network, no props, no real numbers. Everything is a
 * local state machine on a timer, so it can't break, can't leak data, and
 * renders identically for every visitor. Phone numbers use 555 prefixes,
 * which are reserved for fiction.
 *
 * Dark by design — it reads as "the product" against light marketing sections.
 *
 * MOBILE: fluid, not zoom-scaled. The hero's DialerShowcase is wrapped in
 * .ds-showcase-scale (fixed 640px + zoom: 0.5) because its internal layout is
 * fixed-width; this panel reflows instead, so it keeps full-size type on a
 * phone rather than rendering at half scale. See the narrow-viewport block in
 * the <style> below.
 */

import { useState, useEffect } from 'react'

const FUTURA = 'Futura PT, Futura, "Trebuchet MS", sans-serif'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

// Fixed palette rather than brand CSS vars: this panel is meant to look like
// the dark dialer terminal on any background, including whitelabel tenants
// whose brand vars would otherwise recolour it into something unrecognisable.
const D = {
  shell: '#0e0e16',
  bar: '#15151f',
  row: '#191922',
  border: '#262633',
  borderActive: '#4a9eff',
  text: '#f2f3f7',
  muted: '#7d7f92',
  accent: '#4a9eff',
  green: '#4ade80',
  amber: '#fbbf24',
}

type Outcome = 'no-answer' | 'voicemail' | 'connected'

interface Row {
  id: number
  name: string
  phone: string
  state: string
  /** Attempts used so far in the current pass. */
  attempts: number
  /** Set once the lead has been worked and rotated to the bottom. */
  outcome?: Outcome
}

/**
 * The pool is deliberately DEEPER than what's on screen. The panel shows a
 * window onto the top of it, exactly like the real one does against a campaign
 * of hundreds — so as leads rotate to the bottom, genuinely different names and
 * numbers rise into view instead of the same handful cycling. Area codes are
 * spread across the six states so the state filter has something to bite on.
 */
const POOL: Row[] = [
  { id: 1,  name: 'A. HOLLOWAY',  phone: '336-555-0142', state: 'NC', attempts: 0 },
  { id: 2,  name: 'M. ALVAREZ',   phone: '713-555-0198', state: 'TX', attempts: 0 },
  { id: 3,  name: 'D. OKAFOR',    phone: '404-555-0176', state: 'GA', attempts: 0 },
  { id: 4,  name: 'S. WHITFIELD', phone: '602-555-0133', state: 'AZ', attempts: 0 },
  { id: 5,  name: 'R. NGUYEN',    phone: '214-555-0107', state: 'TX', attempts: 0 },
  { id: 6,  name: 'T. BRENNAN',   phone: '215-555-0121', state: 'PA', attempts: 0 },
  { id: 7,  name: 'N. ABERNATHY', phone: '305-555-0148', state: 'FL', attempts: 0 },
  { id: 8,  name: 'C. RIVERA',    phone: '704-555-0188', state: 'NC', attempts: 0 },
  { id: 9,  name: 'P. IBRAHIM',   phone: '480-555-0154', state: 'AZ', attempts: 0 },
  { id: 10, name: 'B. TANAKA',    phone: '512-555-0163', state: 'TX', attempts: 0 },
  { id: 11, name: 'L. FONTAINE',  phone: '678-555-0119', state: 'GA', attempts: 0 },
  { id: 12, name: 'G. VASQUEZ',   phone: '813-555-0172', state: 'FL', attempts: 0 },
  { id: 13, name: 'K. DELGADO',   phone: '412-555-0190', state: 'PA', attempts: 0 },
  { id: 14, name: 'H. MARCHETTI', phone: '904-555-0136', state: 'FL', attempts: 0 },
]

/** How many of the pool are on screen at once. */
const VISIBLE_ROWS = 6

/** Repeat count on display — matches the dialer's 1x/2x/3x control. */
const REPEAT = 2

/**
 * Ring length in SECONDS, per outcome — these are how long the real thing
 * actually takes, which is why they differ:
 *
 *   - a human picks up in the first few rings
 *   - a machine answers on a fixed timer, a little later
 *   - a no-answer has to burn the carrier's full ring cycle before giving up
 *
 * The visible ring timer climbing in step with them is what keeps a long wait
 * reading as a live call rather than a stalled animation.
 *
 * These sit at the SHORT end of the real range on purpose. A no-answer lead is
 * dialed REPEAT times, so its ring length is paid twice before the queue moves
 * on — at a carrier-typical 20s that lead alone would hold the panel for most
 * of a minute. 13s is still a genuine no-answer, and halves the dwell.
 */
const RING_SECONDS: Record<Outcome, number> = {
  connected: 6,
  voicemail: 9,
  'no-answer': 13,
}

/** How long the outcome tag stays up before the queue moves on. */
const RESULT_MS = 1200

const OUTCOME_COPY: Record<Outcome, { label: string; color: string }> = {
  'no-answer': { label: 'NO ANSWER', color: D.muted },
  voicemail:   { label: 'VOICEMAIL', color: D.amber },
  connected:   { label: 'CONNECTED', color: D.green },
}

// Scripted so the demo always shows one of each result rather than random
// noise — a viewer should see a connect, a voicemail skip, and a no-answer.
// Ordered connect-first so the quickest, best-looking beat is the one a
// visitor lands on.
const OUTCOME_CYCLE: Outcome[] = ['connected', 'voicemail', 'no-answer']

/** Filter chips, derived from the pool so the two can never drift apart. */
const STATES = [...new Set(POOL.map(r => r.state))]

type Phase = 'dialing' | 'result'

interface QueueState {
  rows: Row[]
  phase: Phase
  outcomeIdx: number
  dials: number
  /** Seconds elapsed on the current ring. Drives the visible timer. */
  ringSec: number
}

const INITIAL: QueueState = { rows: POOL, phase: 'dialing', outcomeIdx: 0, dials: 31, ringSec: 0 }

function mmss(total: number): string {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export default function LeadQueueShowcase() {
  const [q, setQ] = useState<QueueState>(INITIAL)
  const [stateFilter, setStateFilter] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)

  useEffect(() => {
    // RESULT beat: hold the outcome tag briefly, then resolve the lead —
    // redial it in place if it has attempts left, otherwise rotate it out.
    if (q.phase === 'result') {
      const t = setTimeout(() => {
        setQ(prev => {
          const visible = stateFilter ? prev.rows.filter(r => r.state === stateFilter) : prev.rows
          const top = visible[0]
          // Nothing to resolve. Must still leave the result phase: returning
          // prev unchanged would stop the effect re-running (its deps wouldn't
          // change) and the panel would freeze on a result tag forever.
          if (!top) return { ...prev, phase: 'dialing', ringSec: 0 }

          const outcome = OUTCOME_CYCLE[prev.outcomeIdx % OUTCOME_CYCLE.length]
          const attempts = top.attempts + 1

          // A connect, or an exhausted repeat count, ends the lead's turn. A
          // voicemail or no-answer with attempts left keeps it in the top slot,
          // which is the behaviour the panel exists to demonstrate.
          if (outcome !== 'connected' && attempts < REPEAT) {
            return {
              ...prev,
              phase: 'dialing',
              ringSec: 0,
              rows: prev.rows.map(r => (r.id === top.id ? { ...r, attempts } : r)),
            }
          }

          return {
            ...prev,
            phase: 'dialing',
            ringSec: 0,
            // Rotate to the bottom carrying its outcome — never removed. The
            // scripted outcome only advances when a lead actually finished, so
            // a mid-sequence redial doesn't change what the next result is.
            rows: [...prev.rows.filter(r => r.id !== top.id), { ...top, attempts: 0, outcome }],
            outcomeIdx: prev.outcomeIdx + 1,
          }
        })
      }, RESULT_MS)
      return () => clearTimeout(t)
    }

    // DIALING beat: one interval ticking the ring timer. It runs to the ring
    // length for whichever outcome is scripted next, so the wait a viewer sits
    // through matches the result they're about to see.
    const iv = setInterval(() => {
      setQ(prev => {
        const target = RING_SECONDS[OUTCOME_CYCLE[prev.outcomeIdx % OUTCOME_CYCLE.length]]
        const ringSec = prev.ringSec + 1
        if (ringSec >= target) {
          return { ...prev, phase: 'result', ringSec, dials: prev.dials + 1 }
        }
        return { ...prev, ringSec }
      })
    }, 1000)
    return () => clearInterval(iv)
    // Deliberately keyed on phase only: the interval must survive its own
    // ringSec updates rather than being torn down and re-armed every second.
  }, [q.phase, stateFilter])

  // The filter's controls are hidden under the mobile breakpoint, so its STATE
  // must not survive into that layout: a visitor who filters at desktop width
  // and then narrows the window would otherwise be left with a silently
  // narrowed queue and nothing on screen to widen it again.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(max-width: 560px)')
    const sync = () => {
      if (!mq.matches) return
      setFilterOpen(false)
      // Returning prev unchanged when already null keeps this from looping.
      setStateFilter(prev => (prev === null ? prev : null))
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // Changing the filter restarts the beat so a result tag from the previous
  // top lead can't linger on a different row.
  function applyFilter(next: string | null) {
    setStateFilter(next)
    setQ(prev => ({ ...prev, phase: 'dialing', ringSec: 0 }))
  }

  // `matching` is the whole queue the dialer would work; `visible` is only the
  // top of it. Rotation happens in the full list, so a lead leaving the top
  // slot is replaced by one that wasn't on screen a moment ago.
  const matching = stateFilter ? q.rows.filter(r => r.state === stateFilter) : q.rows
  const visible = matching.slice(0, VISIBLE_ROWS)
  const hiddenCount = matching.length - visible.length
  const active = visible[0]
  const currentOutcome = OUTCOME_CYCLE[q.outcomeIdx % OUTCOME_CYCLE.length]

  return (
    <div
      style={{
        width: '100%',
        background: D.shell,
        border: `1px solid ${D.border}`,
        borderRadius: 8,
        overflow: 'hidden',
        fontFamily: FUTURA,
        color: D.text,
        boxShadow: '0 18px 50px rgba(0,0,0,0.38)',
      }}
    >
      <style>{`
        @keyframes lq-pulse {
          0%, 100% { background: rgba(74,158,255,0.08); }
          50%      { background: rgba(74,158,255,0.18); }
        }
        @keyframes lq-blink { 0%, 100% { opacity: 1 } 50% { opacity: 0.25 } }
        @keyframes lq-rise {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .lq-bar {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; background: ${D.bar};
        }
        .lq-strip {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 12px; flex-wrap: wrap;
        }
        .lq-row {
          display: grid;
          grid-template-columns: 1.15fr 1fr 34px 86px;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border: 1px solid ${D.border};
          border-left: 3px solid transparent;
          border-radius: 4px;
          background: ${D.row};
          font-size: 11px;
          transition: background .25s ease, border-color .25s ease;
        }
        .lq-row.is-active {
          border-color: ${D.borderActive};
          border-left-color: ${D.borderActive};
          animation: lq-pulse 1.5s ease-in-out infinite;
        }
        .lq-row.is-done { opacity: .55; }
        .lq-list { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px 14px; }
        .lq-tag {
          font-size: 8.5px; font-weight: 700; letter-spacing: 1.2px;
          padding: 2px 6px; border-radius: 3px; text-align: center; white-space: nowrap;
        }
        .lq-chip {
          font-size: 9.5px; font-weight: 700; letter-spacing: 1px;
          padding: 4px 9px; border-radius: 3px; cursor: pointer;
          background: transparent; color: ${D.muted};
          border: 1px solid ${D.border};
          font-family: inherit;
        }
        .lq-chip.is-on {
          border-color: ${D.accent}; color: ${D.accent};
          background: rgba(74,158,255,0.14);
        }

        .lq-name {
          font-weight: 700; letter-spacing: .4px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        /* Narrow viewports. This panel is fluid rather than zoom-scaled, so the
           job here is to shed what stops fitting — the type stays at full size.
           The STATE column goes rather than the phone number: the area code
           already tells you the state (336 NC, 713 TX, 404 GA...), so dropping
           the number would lose the only thing on the row that isn't derivable
           from what's left.

           The filter goes entirely on mobile. It's a demo control, not the
           product, and a row of tap targets competing with the queue is worse
           than not having it — the animation is what a phone visitor is here
           for. Its state is reset when it's hidden (see the effect above) so
           the queue can't be left silently narrowed by a resize. */
        @media (max-width: 560px) {
          .lq-row {
            grid-template-columns: minmax(0, 1fr) auto 74px;
            gap: 6px;
            padding: 8px 9px;
          }
          .lq-state, .lq-help, .lq-footnote { display: none; }
          .lq-phone { font-size: 10px; }
          .lq-bar, .lq-strip { padding: 8px 9px; gap: 7px; }
          .lq-list { padding: 8px 9px 11px; }
          .lq-spacer { display: none; }
          .lq-filter-btn, .lq-filter-tray { display: none; }
        }
      `}</style>

      {/* ── TITLE BAR ─────────────────────────────────────────────────── */}
      <div className="lq-bar" style={{ borderBottom: `1px solid ${D.border}` }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 2, color: D.muted }}>
          LEAD QUEUE
        </span>
        <span
          style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 1.4, color: D.accent,
            animation: 'lq-blink 1.4s ease-in-out infinite', whiteSpace: 'nowrap',
          }}
        >
          ● DIALING 1 LINE
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 9, letterSpacing: 1.2, color: D.muted, fontFamily: MONO, whiteSpace: 'nowrap' }}>
          {q.dials} DIALS
        </span>
      </div>

      {/* ── CONTROLS STRIP — repeat count + the FILTER control ────────── */}
      <div className="lq-strip" style={{ borderBottom: `1px solid ${D.border}` }}>
        {[1, 2, 3].map(n => (
          <span
            key={n}
            style={{
              fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 3,
              border: `1px solid ${n === REPEAT ? D.accent : D.border}`,
              background: n === REPEAT ? 'rgba(74,158,255,0.14)' : 'transparent',
              color: n === REPEAT ? D.accent : D.muted,
            }}
          >
            {n}x
          </span>
        ))}
        <span className="lq-help" style={{ fontSize: 9, letterSpacing: 1, color: D.muted, marginLeft: 4 }}>
          REDIAL BEFORE MOVING ON
        </span>
        <div className="lq-spacer" style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setFilterOpen(v => !v)}
          className={`lq-chip lq-filter-btn${stateFilter ? ' is-on' : ''}`}
        >
          ▾ FILTER{stateFilter ? ' •' : ''}
        </button>
      </div>

      {/* ── FILTER TRAY ───────────────────────────────────────────────────
          In-flow rather than an absolutely-positioned dropdown like the real
          panel's: this sits inside marketing page flow where an overlay would
          have to fight for stacking context, and wrapping chips survive a
          320px viewport that a fixed-width popover would not. */}
      {filterOpen && (
        <div className="lq-strip lq-filter-tray" style={{ background: D.bar, borderBottom: `1px solid ${D.border}` }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: D.muted, marginRight: 2 }}>
            STATE
          </span>
          <button
            type="button"
            onClick={() => applyFilter(null)}
            className={`lq-chip${stateFilter === null ? ' is-on' : ''}`}
          >
            ALL
          </button>
          {STATES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => applyFilter(s)}
              className={`lq-chip${stateFilter === s ? ' is-on' : ''}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {stateFilter && (
        <div
          style={{
            padding: '7px 12px', fontSize: 9, letterSpacing: 1.1, color: D.accent,
            borderBottom: `1px solid ${D.border}`, background: 'rgba(74,158,255,0.06)',
          }}
        >
          {matching.length} OF {q.rows.length} MATCH {stateFilter} &middot; ONLY THESE ARE DIALED
        </div>
      )}

      {/* ── ROWS ──────────────────────────────────────────────────────── */}
      <div className="lq-list">
        {visible.map((r, i) => {
          const isActive = i === 0
          const showResult = isActive && q.phase === 'result'
          const oc = r.outcome ? OUTCOME_COPY[r.outcome] : null

          return (
            <div
              key={r.id}
              className={`lq-row${isActive ? ' is-active' : ''}${r.outcome ? ' is-done' : ''}`}
              style={{ animation: 'lq-rise .3s ease' }}
            >
              <span className="lq-name">{r.name}</span>
              <span className="lq-phone" style={{ fontFamily: MONO, color: D.muted, fontSize: 10.5 }}>
                {r.phone}
              </span>
              <span className="lq-state" style={{ color: D.muted, fontSize: 10 }}>{r.state}</span>

              {isActive ? (
                showResult ? (
                  <span
                    className="lq-tag"
                    style={{
                      color: OUTCOME_COPY[currentOutcome].color,
                      border: `1px solid ${OUTCOME_COPY[currentOutcome].color}`,
                    }}
                  >
                    {OUTCOME_COPY[currentOutcome].label}
                  </span>
                ) : (
                  <span
                    className="lq-tag"
                    style={{ color: D.accent, border: `1px solid ${D.accent}`, fontFamily: MONO }}
                  >
                    {/* Ring timer plus attempt counter: the timer proves the
                        call is live, the counter proves the lead holds the slot
                        across its full repeat count. */}
                    {mmss(q.ringSec)} &middot; {r.attempts + 1}/{REPEAT}
                  </span>
                )
              ) : oc ? (
                <span className="lq-tag" style={{ color: oc.color, border: `1px solid ${oc.color}` }}>
                  {oc.label}
                </span>
              ) : (
                <span className="lq-tag" style={{ color: D.muted, border: `1px solid ${D.border}` }}>
                  QUEUED
                </span>
              )}
            </div>
          )
        })}

        {/* The queue is deeper than the window. Saying so is what makes the
            rotation legible: without it, a lead dropping off the bottom and a
            new name arriving at the top looks like leads being discarded. */}
        {hiddenCount > 0 && (
          <div
            style={{
              padding: '5px 4px 0', fontSize: 8.5, letterSpacing: 1.4,
              color: D.muted, textAlign: 'center',
            }}
          >
            + {hiddenCount} MORE BELOW
          </div>
        )}
      </div>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '8px 12px', borderTop: `1px solid ${D.border}`,
          background: D.bar, fontSize: 9, letterSpacing: 1.1, color: D.muted,
        }}
      >
        WORKED TOP-DOWN
        <span className="lq-footnote"> &middot; DIALED LEADS ROTATE TO THE BOTTOM, NEVER REMOVED</span>
        {active ? <> &middot; NEXT: {active.name}</> : null}
      </div>
    </div>
  )
}
