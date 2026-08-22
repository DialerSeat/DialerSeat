'use client'

import { useRef, useState, useEffect } from 'react'

// =============================================================================
// DRAG THE SIDEBAR INTO THE ORDER YOU WORK IN
// =============================================================================
// The tree was sorted by created_at — the order things happened to be made in,
// which has nothing to do with how anybody works. An owner running six teams
// wants today's team at the top and the seasonal one at the bottom, and no
// amount of renaming gets that.
//
// A SEPARATE PANEL, NOT DRAG HANDLES BOLTED ONTO THE TREE. The tree row is
// already a navigation target, a disclosure caret, a selection checkbox in
// select mode and a hover menu. Making it a drag source too means every press
// has to be disambiguated from a drag, and on a phone that reads as a list
// that sometimes ignores taps. Arranging is a mode you enter, do, and leave.
//
// POINTER EVENTS, NOT HTML5 DRAG AND DROP. dragstart/dragover do not fire for
// touch at all, so a draggable tree is a desktop-only feature dressed up as a
// general one. Pointer events are one code path for mouse, touch and pen —
// which is the entire reason they exist — and `touch-action: none` on the
// handle is what stops the page scrolling out from under a drag.
//
// ONLY THE HANDLE STARTS A DRAG. The row itself stays inert, so a list of
// twelve teams can still be scrolled with a thumb anywhere except the grip.
// =============================================================================

export interface ArrangeCampaign {
  id: string
  name: string
}

export interface ArrangeTeam {
  id: string
  name: string
  campaigns: ArrangeCampaign[]
}

interface DragState {
  kind: 'team' | 'campaign'
  id: string
  /** Which team's campaign list this belongs to. Campaigns never move between
   *  teams here — that is attaching a campaign, a different act with different
   *  consequences (access grants, seat payers) and its own screen. */
  teamId?: string
}

export default function ArrangePanel({
  teams,
  onClose,
  onReorderTeams,
  onReorderCampaigns,
  colors,
}: {
  teams: ArrangeTeam[]
  onClose: () => void
  onReorderTeams: (ids: string[]) => Promise<void> | void
  onReorderCampaigns: (teamId: string, ids: string[]) => Promise<void> | void
  colors: {
    text: string
    muted: string
    dim: string
    surface: string
    raised: string
    accent: string
    hairline: string
  }
}) {
  const C = colors

  const [order, setOrder] = useState<ArrangeTeam[]>(teams)
  const [drag, setDrag] = useState<DragState | null>(null)

  // A local copy, because the drag rewrites it many times a second and the
  // parent only needs the answer.
  //
  // Re-seeded from a SIGNATURE rather than from the array's identity. The
  // parent builds this list inline, so it is a new array on every one of its
  // renders — and the teams page refreshes on a timer. Keyed on identity, a
  // poll landing mid-drag would reset the order under the pointer and throw
  // away what the owner was in the middle of doing.
  //
  // And never while a drag is in flight, for the same reason from the other
  // direction: the save itself triggers a refresh, and that refresh must not
  // interrupt a drag that has already started on the next row.
  const signature = teams
    .map(t => `${t.id}:${t.campaigns.map(c => c.id).join(',')}`)
    .join('|')
  useEffect(() => {
    if (drag) return
    setOrder(teams)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const [saving, setSaving] = useState(false)

  // id -> row element, so a move can be decided from where things actually
  // ARE rather than from an assumed row height. Rows are different heights
  // once a name wraps, and assuming otherwise makes the drop land a row off.
  const rowRefs = useRef(new Map<string, HTMLDivElement | null>())
  const setRowRef = (id: string) => (el: HTMLDivElement | null) => {
    rowRefs.current.set(id, el)
  }

  /**
   * Where in a sibling list a pointer at this Y belongs.
   *
   * The dragged row is EXCLUDED from the count, which makes this the
   * insertion index among the rows that are staying put. Counting itself
   * would mean the pointer sitting on its own row scores a boundary value,
   * and the item twitches between two positions on the smallest movement.
   */
  const indexForPointer = (siblingIds: string[], draggedId: string, clientY: number): number => {
    let index = 0
    for (const id of siblingIds) {
      if (id === draggedId) continue
      const el = rowRefs.current.get(id)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      // Past the midpoint counts as past the row. Using the top edge instead
      // makes the item refuse to move down past its immediate neighbour,
      // because the neighbour's top is never reached while they are adjacent.
      if (clientY > rect.top + rect.height / 2) index++
    }
    return index
  }

  const move = <T,>(list: T[], from: number, to: number): T[] => {
    const next = list.slice()
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    return next
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return
    e.preventDefault()

    if (drag.kind === 'team') {
      const ids = order.map(t => t.id)
      const from = ids.indexOf(drag.id)
      if (from < 0) return
      const to = Math.min(indexForPointer(ids, drag.id, e.clientY), ids.length - 1)
      if (to !== from) setOrder(prev => move(prev, from, to))
      return
    }

    const team = order.find(t => t.id === drag.teamId)
    if (!team) return
    const ids = team.campaigns.map(c => c.id)
    const from = ids.indexOf(drag.id)
    if (from < 0) return
    const to = Math.min(indexForPointer(ids, drag.id, e.clientY), ids.length - 1)
    if (to === from) return
    setOrder(prev =>
      prev.map(t =>
        t.id === team.id ? { ...t, campaigns: move(t.campaigns, from, to) } : t
      )
    )
  }

  const endDrag = async () => {
    if (!drag) return
    const finished = drag
    setDrag(null)

    // Saved on drop rather than behind a Save button. There is no draft state
    // worth protecting here and nothing destructive to confirm — an order is
    // its own preview, and a button would only add a way to lose the work.
    setSaving(true)
    try {
      if (finished.kind === 'team') {
        await onReorderTeams(order.map(t => t.id))
      } else if (finished.teamId) {
        const team = order.find(t => t.id === finished.teamId)
        if (team) await onReorderCampaigns(team.id, team.campaigns.map(c => c.id))
      }
    } finally {
      setSaving(false)
    }
  }

  const startDrag = (state: DragState) => (e: React.PointerEvent) => {
    // Capture on the handle so the drag survives the pointer leaving it —
    // which it does immediately, because the rows move out from under it.
    // currentTarget, not target: the press often lands on one of the grip's
    // three bars, and capturing on that leaves the capture attached to a
    // 12px sliver. The wrapper is the thing that owns the gesture.
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag(state)
  }

  const Grip = ({ active }: { active: boolean }) => (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex', flexDirection: 'column', gap: 2,
        padding: '2px 2px', flexShrink: 0,
        cursor: 'grab', touchAction: 'none',
      }}
    >
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            display: 'block', width: 12, height: 1.5, borderRadius: 1,
            background: active ? C.accent : C.dim,
          }}
        />
      ))}
    </span>
  )

  return (
    <div
      className="ts-scroll"
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{ padding: '8px 10px' }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, marginBottom: 10,
      }}>
        <span style={{ fontSize: 11, letterSpacing: 1.4, color: C.muted, fontWeight: 700 }}>
          REARRANGE
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent', border: `1px solid ${C.hairline}`,
            borderRadius: 3, color: C.text, fontSize: 11.5, fontFamily: 'inherit',
            padding: '4px 10px', cursor: 'pointer',
          }}
        >{saving ? 'Saving…' : 'Done'}</button>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: 11, color: C.dim, lineHeight: 1.6 }}>
        Drag the grips. Teams move among teams, campaigns within their own team.
        Saved as you drop.
      </p>

      {order.length === 0 && (
        <div style={{ fontSize: 12, color: C.dim }}>
          Nothing to arrange — you do not own any teams yet.
        </div>
      )}

      {order.map(team => {
        const teamDragging = drag?.kind === 'team' && drag.id === team.id
        return (
          <div key={team.id} style={{ marginBottom: 6 }}>
            <div
              ref={setRowRef(team.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 8px', borderRadius: 4,
                background: teamDragging ? C.accent : C.raised,
                border: `1px solid ${teamDragging ? C.accent : C.hairline}`,
                opacity: teamDragging ? 0.92 : 1,
                color: teamDragging ? '#fff' : C.text,
                fontSize: 13, fontWeight: 600,
                userSelect: 'none',
              }}
            >
                      <span
                onPointerDown={startDrag({ kind: 'team', id: team.id })}
                style={{ touchAction: 'none', display: 'inline-flex', cursor: 'grab' }}
              >
                <Grip active={teamDragging} />
              </span>
              <span style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{team.name}</span>
            </div>

            {team.campaigns.map(c => {
              const campDragging = drag?.kind === 'campaign' && drag.id === c.id
              return (
                <div
                  key={c.id}
                  ref={setRowRef(c.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    margin: '4px 0 0 18px', padding: '6px 8px', borderRadius: 4,
                    background: campDragging ? C.accent : C.surface,
                    border: `1px solid ${campDragging ? C.accent : 'transparent'}`,
                    color: campDragging ? '#fff' : C.muted,
                    fontSize: 12.5, userSelect: 'none',
                  }}
                >
                  <span
                    onPointerDown={startDrag({ kind: 'campaign', id: c.id, teamId: team.id })}
                    style={{ touchAction: 'none', display: 'inline-flex', cursor: 'grab' }}
                  >
                    <Grip active={campDragging} />
                  </span>
                  <span style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{c.name}</span>
                </div>
              )
            })}

            {team.campaigns.length === 0 && (
              <div style={{
                margin: '4px 0 0 18px', fontSize: 11, color: C.dim,
              }}>No campaigns on this team.</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
