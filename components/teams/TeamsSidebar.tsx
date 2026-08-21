'use client'

import { useState } from 'react'

// =============================================================================
// TEAMS SIDEBAR — the navigation spine of the Teams page
// =============================================================================
// Three levels of disclosure: TEAM > CAMPAIGN > AGENT. Discord's channel list
// is the reference, and the reason is structural rather than cosmetic — it is
// the one pattern people already know for "several servers, each with several
// rooms, each with people in them", which is exactly the shape of an agency
// running several teams over several campaigns.
//
// What that borrows, specifically:
//   - the whole tree is disclosure, every level collapsible, state remembered
//   - hierarchy is carried by INDENT and TYPE WEIGHT, not by boxes or rules;
//     nothing here is a card
//   - one selected row at a time, marked by a solid rail and a lifted
//     background, never by a border
//   - names sit quiet until hovered; the eye should land on the selection and
//     on what is live, not on every row at once
//
// SELECTION DRIVES THE PAGE. Whatever is selected here is what the analytics
// panel reports on — "Viewing: ALL USERS" is this component's state rendered
// over there. Selecting a campaign scopes to that campaign, an agent to that
// agent, ALL USERS to everything.
//
// Presentational on purpose: it takes data and reports selection, and holds no
// opinion about where either comes from. The backend is being built alongside
// it, and this must not have to change when it lands.
// =============================================================================

export interface SidebarAgent {
  id: string
  /** The team_members row id. Removing someone addresses their MEMBERSHIP,
   *  not the person, so this travels alongside the user id. */
  memberId?: string
  name: string
  /** Dialing right now — rendered as a live dot, the one thing that pulls focus. */
  isLive?: boolean
  /** Who pays for this seat. Shown only to an owner, only on hover. */
  seatPaidBy?: 'owner' | 'agent'
}

export interface SidebarCampaign {
  id: string
  name: string
  /** Open to every member — access_mode 'free' OR 'public', see
   *  lib/campaignAccess. No per-agent grant is needed. This docstring used to
   *  say 'free' alone, and two callers were written from it. */
  openToTeam?: boolean
  agents: SidebarAgent[]
}

export interface SidebarTeam {
  id: string
  name: string
  isOwner?: boolean
  campaigns: SidebarCampaign[]
}

export type TeamsScope =
  | { kind: 'all' }
  | { kind: 'requests' }
  | { kind: 'team'; teamId: string }
  | { kind: 'campaign'; teamId: string; campaignId: string }
  | { kind: 'agent'; teamId: string; campaignId: string; userId: string }

interface Props {
  teams: SidebarTeam[]
  scope: TeamsScope
  onScopeChange: (scope: TeamsScope) => void
  /** Count for the REQUESTS row. Hidden when zero — a badge showing 0 is noise. */
  pendingRequests?: number
  onCreateTeam?: () => void
  onOpenFloor?: () => void
  onCreateCampaign?: () => void
  onOpenTeamMenu?: (teamId: string) => void
  /** Rename whatever is currently selected. Only offered for things the
   *  viewer owns — the endpoints enforce that too, but offering an action
   *  that will be refused is its own kind of broken. */
  onRename?: (kind: 'team' | 'campaign', id: string, currentName: string) => void
  onJoinWithCode?: (code: string) => void
  joining?: boolean
  /** Result of the last join attempt, shown under the code field. */
  joinMessage?: { kind: 'error' | 'success'; text: string } | null
  /** Active agents right now, shown as a count inside the All Users button. */
  activeUserCount?: number
  /** Called with everything ticked when the agent confirms a delete. */
  onDeleteSelection?: (sel: SidebarSelection[]) => Promise<void> | void
}

/** One ticked thing. Kind decides which endpoint the delete has to call, so it
 *  travels with the id rather than being re-derived from the tree later. */
export interface SidebarSelection {
  kind: 'team' | 'campaign' | 'agent'
  id: string
  teamId: string
  campaignId?: string
  /** Present for agents — the team_members row to remove. */
  memberId?: string
  label: string
}

const SURFACE = '#2b2d31'
const SURFACE_RAISED = '#35373c'
const TEXT = '#f2f3f5'
const TEXT_MUTED = '#949ba4'
const TEXT_DIM = '#80848e'
const ACCENT = 'var(--brand-primary, #5865f2)'
const HAIRLINE = '#1f2023'

/** Discord's disclosure caret: rotates rather than swapping glyph, so the
 *  transition reads as the same control moving instead of two states blinking. */
function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none"
      style={{
        transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform 0.15s ease',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function TeamsSidebar({
  teams,
  scope,
  onScopeChange,
  pendingRequests = 0,
  onCreateTeam,
  onOpenFloor,
  onCreateCampaign,
  onOpenTeamMenu,
  onRename,
  onJoinWithCode,
  joining = false,
  joinMessage = null,
  activeUserCount = 0,
  onDeleteSelection,
}: Props) {
  // Everything starts open. An agency with two teams should see its whole
  // shape on load; collapsing is for when the list has outgrown the screen,
  // which is the user's call to make rather than ours to pre-empt.
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set())
  const [collapsedCampaigns, setCollapsedCampaigns] = useState<Set<string>>(new Set())
  const [codeInput, setCodeInput] = useState('')
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Record<string, SidebarSelection>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const selectedList = Object.values(selected)

  // The one ticked thing that can be renamed, or null. Requires exactly one
  // selection, a renameable kind, and ownership — the same three conditions
  // the ⋮ uses, so the two entry points can never disagree about whether an
  // action is available.
  const renameSelection: { kind: 'team' | 'campaign'; id: string; name: string } | null = (() => {
    if (selectedList.length !== 1) return null
    const only = selectedList[0]
    if (only.kind === 'agent') return null
    const team = teams.find(t => t.id === only.teamId)
    if (!team?.isOwner) return null
    return { kind: only.kind, id: only.id, name: only.label }
  })()

  const toggleSelected = (item: SidebarSelection) => {
    setSelected(prev => {
      const next = { ...prev }
      if (next[item.id]) delete next[item.id]
      else next[item.id] = item
      return next
    })
  }

  const leaveSelectMode = () => {
    setSelectMode(false)
    setSelected({})
    setConfirmOpen(false)
    setConfirmText('')
  }

  const toggle = (set: Set<string>, id: string, apply: (s: Set<string>) => void) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    apply(next)
  }

  // What the ⋮ can rename right now, derived from the selection. Null when
  // nothing renameable is selected or the viewer does not own it, which is
  // what hides the row rather than disabling it.
  const renameTarget: { kind: 'team' | 'campaign'; id: string; name: string } | null = (() => {
    if (scope.kind === 'team') {
      const t = teams.find(x => x.id === scope.teamId)
      return t?.isOwner ? { kind: 'team', id: t.id, name: t.name } : null
    }
    if (scope.kind === 'campaign') {
      const t = teams.find(x => x.id === scope.teamId)
      if (!t?.isOwner) return null
      const c = t.campaigns.find(x => x.id === scope.campaignId)
      return c ? { kind: 'campaign', id: c.id, name: c.name } : null
    }
    return null
  })()

  const isSelected = (s: TeamsScope) => {
    if (s.kind !== scope.kind) return false
    if (s.kind === 'all' || s.kind === 'requests') return true
    if (s.kind === 'team' && scope.kind === 'team') return s.teamId === scope.teamId
    if (s.kind === 'campaign' && scope.kind === 'campaign') return s.campaignId === scope.campaignId
    if (s.kind === 'agent' && scope.kind === 'agent') {
      return s.userId === scope.userId && s.campaignId === scope.campaignId
    }
    return false
  }

  const submitCode = () => {
    const trimmed = codeInput.trim()
    if (!trimmed || joining) return
    onJoinWithCode?.(trimmed)
    setCodeInput('')
  }

  return (
    <aside className="ts-sidebar">
      <style>{`
        .ts-sidebar {
          display: flex; flex-direction: column;
          height: 100%; min-height: 0;
          background: ${SURFACE};
          color: ${TEXT};
          font-family: var(--font-futura, ui-sans-serif, system-ui, sans-serif);
          user-select: none;
        }
        /* Every interactive row shares one skeleton so indent is the ONLY
           thing that carries depth. Padding-left is set per level below. */
        .ts-row {
          display: flex; align-items: center; gap: 6px;
          width: 100%; border: 0; background: transparent;
          color: ${TEXT_MUTED};
          text-align: left; cursor: pointer;
          padding: 6px 10px; border-radius: 4px;
          font-size: 14px; line-height: 1.3;
          position: relative;
          transition: background 0.1s ease, color 0.1s ease;
        }
        /* Hover brightens the text and nothing else. The fill and the accent
           rail that used to live here are gone: selection is carried by the
           wrapper now, and having both meant the row was marked twice. */
        @media (hover: hover) and (pointer: fine) {
          .ts-row:hover { color: ${TEXT}; }
        }
        .ts-row-label {
          flex: 1; min-width: 0;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ts-team-row { font-size: 15px; font-weight: 600; color: ${TEXT}; }
        .ts-campaign-row { font-size: 14px; font-weight: 500; padding-left: 22px; }
        .ts-agent-row { font-size: 13.5px; padding-left: 44px; color: ${TEXT_DIM}; }
        .ts-agent-row:hover { color: ${TEXT}; }

        /* Icon buttons in the header stay invisible until the header is
           hovered — Discord's trick for keeping a dense list calm. */
        .ts-head-actions { display: flex; align-items: center; gap: 2px; opacity: 0.55; transition: opacity 0.12s ease; }
        .ts-sidebar:hover .ts-head-actions { opacity: 1; }
        .ts-icon-btn {
          display: grid; place-items: center;
          width: 28px; height: 28px; border-radius: 4px;
          border: 0; background: transparent; color: ${TEXT_MUTED};
          cursor: pointer; font-size: 20px; line-height: 1;
          transition: background 0.1s ease, color 0.1s ease;
        }
        .ts-icon-btn:hover { background: ${SURFACE_RAISED}; color: ${TEXT}; }

        .ts-menu {
          position: absolute; top: calc(100% + 6px); right: 0; z-index: 21;
          min-width: 210px; padding: 6px;
          background: #111214; border: 1px solid ${HAIRLINE};
          border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.45);
          display: flex; flex-direction: column; gap: 2px;
        }
        .ts-menu-item {
          display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
          width: 100%; border: 0; background: transparent; cursor: pointer;
          padding: 8px 10px; border-radius: 4px; text-align: left;
          color: ${TEXT}; font-size: 13.5px; font-family: inherit; font-weight: 500;
          transition: background 0.1s ease;
        }
        .ts-menu-item:hover { background: ${ACCENT}; }
        .ts-menu-hint { font-size: 11px; color: ${TEXT_DIM}; font-weight: 400; }
        .ts-menu-item:hover .ts-menu-hint { color: rgba(255,255,255,0.75); }

        /* The row is a flex strip now: caret, optional bubble, then the label
           button which takes the rest. Indent lives on the WRAPPER so the
           caret of a nested level lines up under the one above it. */
        .ts-row-wrap {
          display: flex; align-items: center; gap: 2px;
          border-radius: 4px; position: relative;
        }
        /* ── A ROW IS TEXT UNTIL IT IS CHOSEN ───────────────────────────────
           No hover fill and no accent rail. The rail marked the same thing the
           background already marked, and a fill on hover meant every row the
           cursor crossed looked momentarily chosen — in a tree this dense that
           is most of them. Hovering now only brightens the text, which is
           enough to show what is targetable.
           A row looks like a button only once it IS the selection. */
        .ts-row-wrap.is-selected { background: ${SURFACE_RAISED}; }
        .ts-row-wrap .ts-row { background: transparent; }
        /* Hover styles only for real pointers. On a touch screen :hover latches
           after a tap and does not clear until you tap elsewhere — which is
           exactly the "row stays highlighted after I hit the arrow" symptom.
           A finger has no hover state, so it should not get hover styling. */
        @media (hover: hover) and (pointer: fine) {
          .ts-row-wrap:hover .ts-row { color: ${TEXT}; }
        }
        /* Nothing about the row reacts to being pressed or focused. Selection
           is the only thing that changes its appearance, and expanding a
           branch is not a selection. */
        .ts-row-wrap .ts-row:hover,
        .ts-row-wrap .ts-row:active,
        .ts-row-wrap .ts-row:focus { background: transparent; }
        .ts-row:focus { outline: none; }
        .ts-row:focus-visible { outline: 1px solid ${TEXT_DIM}; outline-offset: -2px; }
        .ts-indent-1 { padding-left: 16px; }
        .ts-indent-2 { padding-left: 38px; }
        /* Levels below the team no longer need their own text indent — the
           wrapper supplies it — or the two would compound. */
        .ts-campaign-row, .ts-agent-row { padding-left: 4px; }

        .ts-caret-btn {
          display: grid; place-items: center;
          width: 20px; height: 24px; flex-shrink: 0;
          border: 0; background: transparent; color: ${TEXT_MUTED};
          cursor: pointer; padding: 0; border-radius: 3px;
        }
        /* The caret gets no surface of its own, hovered or pressed. It opens a
           branch; it does not select anything, so it must not flash like
           something that did. Colour is the only feedback it needs. */
        @media (hover: hover) and (pointer: fine) {
          .ts-caret-btn:hover { color: ${TEXT}; }
        }
        .ts-caret-btn:active,
        .ts-caret-btn:focus { background: transparent; outline: none; }
        .ts-caret-btn:focus-visible { outline: 1px solid ${TEXT_DIM}; outline-offset: -1px; }

        .ts-bubble {
          width: 14px; height: 14px; flex-shrink: 0; margin: 0 4px 0 2px;
          border-radius: 50%; cursor: pointer; padding: 0;
          border: 2px solid ${TEXT_DIM}; background: transparent;
          transition: background 0.1s ease, border-color 0.1s ease;
        }
        .ts-bubble:hover { border-color: ${TEXT}; }
        .ts-bubble.is-on { background: #da373c; border-color: #da373c; }

        .ts-select-bar {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 12px; flex-shrink: 0;
          background: ${SURFACE_RAISED}; border-top: 1px solid ${HAIRLINE};
          border-bottom: 1px solid ${HAIRLINE};
        }
        .ts-mini-btn {
          border: 1px solid ${HAIRLINE}; background: ${SURFACE};
          color: ${TEXT_MUTED}; border-radius: 4px; cursor: pointer;
          padding: 5px 10px; font-size: 11px; font-family: inherit; font-weight: 600;
          letter-spacing: 0.6px; text-transform: uppercase;
        }
        .ts-mini-btn:hover { color: ${TEXT}; }
        .ts-mini-btn.is-danger { background: #da373c; border-color: #da373c; color: #fff; }
        .ts-mini-btn:disabled { cursor: default; }

        /* Pending work reads as stuck ON the button; a roster count reads as a
           field within it. Different jobs, different treatment. */
        .ts-badge-corner {
          position: absolute; top: -6px; right: -6px;
          min-width: 18px; height: 18px; padding: 0 5px;
          border-radius: 9px; background: #da373c; color: #fff;
          font-size: 10px; font-weight: 700; letter-spacing: 0;
          display: grid; place-items: center;
          border: 2px solid ${SURFACE};
        }
        .ts-count {
          font-size: 11px; font-weight: 700; color: ${TEXT_DIM};
          letter-spacing: 0; flex-shrink: 0;
        }
        .ts-foot-btn { position: relative; }

        .ts-live-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #23a55a; flex-shrink: 0;
          box-shadow: 0 0 0 3px rgba(35,165,90,0.18);
        }
        .ts-tag {
          font-size: 9px; letter-spacing: 0.6px; text-transform: uppercase;
          color: ${TEXT_DIM}; border: 1px solid ${HAIRLINE};
          border-radius: 3px; padding: 1px 5px; flex-shrink: 0;
        }
        .ts-badge {
          min-width: 18px; height: 18px; padding: 0 5px;
          border-radius: 9px; background: #da373c; color: #fff;
          font-size: 11px; font-weight: 700;
          display: grid; place-items: center; flex-shrink: 0;
        }

        .ts-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 8px 12px; }
        .ts-scroll::-webkit-scrollbar { width: 8px; }
        .ts-scroll::-webkit-scrollbar-thumb { background: ${HAIRLINE}; border-radius: 4px; }
        .ts-scroll::-webkit-scrollbar-track { background: transparent; }

        .ts-empty { padding: 6px 10px 10px 44px; font-size: 12.5px; color: ${TEXT_DIM}; font-style: italic; }

        /* ── THESE ARE BUTTONS, AND THEY LOOK LIKE BUTTONS ──────────────────
           They were rows in the same visual language as the tree above, which
           made them read as two more branches rather than as two actions that
           replace the whole panel. Given a face — raised surface, border,
           centred label — they stop competing with the tree and start
           announcing what they do. Pressed state is inset rather than merely
           tinted, so an active view is legible without the button looking
           permanently stuck on. */
        /* ── PLAIN BUTTONS, NO SELECTED STATE ────────────────────────────────
           These open a view; they are not a mode you are in. Marking one as
           selected meant All Users sat lit up permanently, because it is the
           default scope — so the highlight said nothing and just added noise.
           Stacked full width as they were, with a button's face so they read
           as actions rather than as two more branches of the tree above. */
        /* Bottom padding, not zero: the join-code field is the last thing in
           the drawer and it was sitting flush against the home indicator, which
           on a phone means the swipe-up gesture and the tap target overlap. The
           drawer itself carries the safe-area inset; this is the breathing room
           on top of it. */
        .ts-foot { flex-shrink: 0; border-top: 1px solid ${HAIRLINE}; padding: 10px 12px 12px; }
        .ts-foot-buttons { display: flex; flex-direction: column; gap: 6px; }
        .ts-foot-btn {
          display: flex; align-items: center; gap: 8px;
          border: 1px solid ${HAIRLINE}; border-radius: 5px;
          background: ${SURFACE_RAISED}; color: ${TEXT_MUTED};
          cursor: pointer; padding: 10px 12px; width: 100%;
          font-family: inherit; font-size: 11px; font-weight: 700;
          letter-spacing: 1.1px; text-transform: uppercase;
          box-shadow: 0 1px 0 rgba(0,0,0,0.35);
          transition: background 0.1s ease, color 0.1s ease, box-shadow 0.1s ease;
        }
        .ts-foot-btn:hover { background: #3a3c42; color: ${TEXT}; }
        /* Press moves the shadow, never the element — a button that shifts
           under the cursor loses the click. */
        .ts-foot-btn:active { box-shadow: inset 0 2px 4px rgba(0,0,0,0.45); }

        .ts-join { padding: 10px 14px 14px; }
        .ts-join-label { font-size: 12px; color: ${TEXT_MUTED}; margin-bottom: 6px; }
        .ts-join-input {
          width: 100%; box-sizing: border-box;
          padding: 7px 10px; border-radius: 4px;
          border: 1px solid ${HAIRLINE}; background: #1e1f22;
          color: ${TEXT}; font-size: 12.5px; text-align: center;
          font-family: inherit; letter-spacing: 0.5px;
        }
        .ts-join-input::placeholder { color: ${TEXT_DIM}; letter-spacing: 0.3px; }
        .ts-join-input:focus { outline: none; border-color: ${ACCENT}; }
        .ts-join-input:disabled { opacity: 0.6; cursor: progress; }
      `}</style>

      {/* ── HEADER ───────────────────────────────────────────────────────
          flexShrink 0 on all three bands (header, tree, footer) with the tree
          taking the slack. Without it, a long team list pushed the join-code
          field off the bottom of a phone — the footer is the part somebody
          actually came here to use, so it is the part that must never move. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '16px 10px 12px 14px', flexShrink: 0,
      }}>
        <h2 style={{
          flex: 1, margin: 0, fontSize: 22, fontWeight: 400,
          color: TEXT, letterSpacing: 0.2,
        }}>
          My Teams
        </h2>
        <div className="ts-head-actions">
          <div style={{ position: 'relative' }}>
            <button
              className="ts-icon-btn"
              onClick={() => setMoreMenuOpen(o => !o)}
              title="More"
              aria-label="More actions"
              aria-expanded={moreMenuOpen}
            >⋮</button>
            {moreMenuOpen && (
              <>
                <div onClick={() => setMoreMenuOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
                <div className="ts-menu" role="menu">
                  {/* Select turns the tree into a pick-list rather than opening
                      a separate management screen. Deleting is something you do
                      TO things you can see, so it belongs where you can see
                      them. */}
                  {/* ── RENAME WHAT IS SELECTED ────────────────────────
                      Scoped to the current selection rather than opening a
                      picker: the thing you want to rename is the thing you
                      just clicked, and asking again which one would be the
                      product forgetting what it already knows.

                      Hidden entirely when nothing renameable is selected, or
                      when the viewer does not own it. A disabled row here
                      would raise the question of why. */}
                  {renameTarget && (
                    <button
                      className="ts-menu-item"
                      role="menuitem"
                      onClick={() => {
                        setMoreMenuOpen(false)
                        onRename?.(renameTarget.kind, renameTarget.id, renameTarget.name)
                      }}
                    >
                      Rename {renameTarget.kind}
                      <span className="ts-menu-hint">{renameTarget.name}</span>
                    </button>
                  )}
                  <button
                    className="ts-menu-item"
                    role="menuitem"
                    onClick={() => { setMoreMenuOpen(false); setSelectMode(true) }}
                  >
                    Select
                    <span className="ts-menu-hint">Tick teams, campaigns or agents</span>
                  </button>
                  {/* Statements live behind the ⋮ rather than in the tree: they
                      are not a thing you browse, they are a thing you go and
                      fetch when an accountant asks. */}
                  {/* The live floor sits beside statements because both are
                      things you go and look at rather than things you browse
                      to — one during a shift, one at the end of a quarter. */}
                  <button
                    className="ts-menu-item"
                    role="menuitem"
                    onClick={() => { setMoreMenuOpen(false); onOpenFloor?.() }}
                  >
                    The Floor
                    <span className="ts-menu-hint">Who is dialing now, and which seats are idle</span>
                  </button>
                  <a
                    className="ts-menu-item"
                    role="menuitem"
                    href="/dashboard/reports"
                    onClick={() => setMoreMenuOpen(false)}
                    style={{ textDecoration: 'none', display: 'block' }}
                  >
                    Seat Reports
                    <span className="ts-menu-hint">Billing statements for your records</span>
                  </a>
                </div>
              </>
            )}
          </div>
          {/* ── + IS A CHOICE, NOT AN ACTION ─────────────────────────────
              It creates a team OR a campaign, and those are different enough
              that guessing which one was meant is worse than one extra click.
              Anchored to the button and dismissed by clicking anywhere, so it
              never strands the agent with an open menu. */}
          <div style={{ position: 'relative' }}>
            <button
              className="ts-icon-btn"
              onClick={() => setAddMenuOpen(o => !o)}
              title="Create"
              aria-label="Create a team or campaign"
              aria-expanded={addMenuOpen}
            >+</button>
            {addMenuOpen && (
              <>
                <div
                  onClick={() => setAddMenuOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 20 }}
                />
                <div className="ts-menu" role="menu">
                  <button
                    className="ts-menu-item"
                    role="menuitem"
                    onClick={() => { setAddMenuOpen(false); onCreateTeam?.() }}
                  >
                    Create New Team
                    <span className="ts-menu-hint">A new agency or floor</span>
                  </button>
                  <button
                    className="ts-menu-item"
                    role="menuitem"
                    onClick={() => { setAddMenuOpen(false); onCreateCampaign?.() }}
                  >
                    Create New Campaign
                    <span className="ts-menu-hint">A lead list inside a team</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── THE TREE ─────────────────────────────────────────────────────── */}
      <div className="ts-scroll">
        {teams.length === 0 ? (
          <div style={{ padding: '10px 12px', fontSize: 13, color: TEXT_DIM, lineHeight: 1.6 }}>
            No teams yet. Create one with <strong style={{ color: TEXT_MUTED }}>+</strong>,
            or join an existing one with a code below.
          </div>
        ) : teams.map(team => {
          const teamOpen = !collapsedTeams.has(team.id)
          return (
            <div key={team.id} style={{ marginBottom: 2 }}>
              {/* ── DISCLOSURE IS NOT NAVIGATION ─────────────────────────
                  The caret used to be inside the row, so expanding a team also
                  opened it. Two intentions on one target: you could not look
                  inside without leaving where you were. The arrow is its own
                  button now — it opens the branch and nothing else. */}
              <div className={`ts-row-wrap${isSelected({ kind: 'team', teamId: team.id }) ? ' is-selected' : ''}`}>
                <button
                  className="ts-caret-btn"
                  onClick={() => toggle(collapsedTeams, team.id, setCollapsedTeams)}
                  aria-label={teamOpen ? 'Collapse' : 'Expand'}
                  aria-expanded={teamOpen}
                >
                  <Caret open={teamOpen} />
                </button>
                {selectMode && (
                  <button
                    className={`ts-bubble${selected[team.id] ? ' is-on' : ''}`}
                    onClick={() => toggleSelected({
                      kind: 'team', id: team.id, teamId: team.id, label: team.name,
                    })}
                    aria-pressed={!!selected[team.id]}
                    aria-label={`Select ${team.name}`}
                  />
                )}
                <button
                  className="ts-row ts-team-row"
                  onClick={() => onScopeChange({ kind: 'team', teamId: team.id })}
                >
                  <span className="ts-row-label">{team.name}</span>
                  {team.isOwner && <span className="ts-tag">Owner</span>}
                </button>
              </div>

              {teamOpen && team.campaigns.map(campaign => {
                const key = `${team.id}:${campaign.id}`
                // ── THE ROSTER UNDER A CAMPAIGN IS THE OWNER'S TO SEE ──
                // Expanding a campaign lists every agent on it by name. That
                // is a management view: for somebody who merely dials the
                // campaign it is a list of their colleagues and how the floor
                // is staffed, which they were never meant to have and cannot
                // act on.
                //
                // The caret is hidden rather than disabled. A control that
                // does nothing reads as broken, and invites the click that
                // proves it — an absent one says the level simply is not
                // there. A spacer keeps the campaign names aligned with the
                // owner's view so the tree does not shift shape per viewer.
                const canSeeRoster = !!team.isOwner
                const campaignOpen = canSeeRoster && !collapsedCampaigns.has(key)
                return (
                  <div key={campaign.id}>
                    <div className={`ts-row-wrap ts-indent-1${isSelected({ kind: 'campaign', teamId: team.id, campaignId: campaign.id }) ? ' is-selected' : ''}`}>
                      {canSeeRoster ? (
                        <button
                          className="ts-caret-btn"
                          onClick={() => toggle(collapsedCampaigns, key, setCollapsedCampaigns)}
                          aria-label={campaignOpen ? 'Collapse' : 'Expand'}
                          aria-expanded={campaignOpen}
                        >
                          <Caret open={campaignOpen} />
                        </button>
                      ) : (
                        <span className="ts-caret-btn" aria-hidden="true" />
                      )}
                      {selectMode && (
                        <button
                          className={`ts-bubble${selected[campaign.id] ? ' is-on' : ''}`}
                          onClick={() => toggleSelected({
                            kind: 'campaign', id: campaign.id, teamId: team.id,
                            campaignId: campaign.id, label: campaign.name,
                          })}
                          aria-pressed={!!selected[campaign.id]}
                          aria-label={`Select ${campaign.name}`}
                        />
                      )}
                      <button
                        className="ts-row ts-campaign-row"
                        onClick={() => onScopeChange({ kind: 'campaign', teamId: team.id, campaignId: campaign.id })}
                      >
                        <span className="ts-row-label">{campaign.name}</span>
                        {/* An open campaign needs no per-agent grants, which
                            changes how the owner reads the roster under it. */}
                        {campaign.openToTeam && <span className="ts-tag">Open</span>}
                      </button>
                    </div>

                    {campaignOpen && (
                      campaign.agents.length === 0 ? (
                        // ── AN EMPTY LIST MEANS TWO DIFFERENT THINGS ──────
                        // On a campaign open to the whole team there are no
                        // per-agent grants to list, because none are needed —
                        // everyone can already work it. Saying "no agents
                        // assigned" there describes the data structure rather
                        // than the situation, and reads as a warning that
                        // nobody can dial the campaign when the opposite is
                        // true.
                        <div className="ts-empty">
                          {campaign.openToTeam
                            ? 'All team has access'
                            : 'No agents assigned'}
                        </div>
                      ) : campaign.agents.map(agent => (
                        <div
                          key={agent.id}
                          className={`ts-row-wrap ts-indent-2${isSelected({ kind: 'agent', teamId: team.id, campaignId: campaign.id, userId: agent.id }) ? ' is-selected' : ''}`}
                        >
                          {selectMode && (
                            <button
                              className={`ts-bubble${selected[`${campaign.id}:${agent.id}`] ? ' is-on' : ''}`}
                              onClick={() => toggleSelected({
                                kind: 'agent', id: `${campaign.id}:${agent.id}`,
                                teamId: team.id, campaignId: campaign.id,
                                memberId: agent.memberId, label: agent.name,
                              })}
                              aria-pressed={!!selected[`${campaign.id}:${agent.id}`]}
                              aria-label={`Select ${agent.name}`}
                            />
                          )}
                          <button
                            className="ts-row ts-agent-row"
                            onClick={() => onScopeChange({
                              kind: 'agent',
                              teamId: team.id,
                              campaignId: campaign.id,
                              userId: agent.id,
                            })}
                          >
                            {agent.isLive && <span className="ts-live-dot" />}
                            <span className="ts-row-label">{agent.name}</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* ── SELECT MODE BAR ─────────────────────────────────────────────────
          Appears only while selecting, directly above the tree it acts on, and
          says how many are ticked so Delete can never be a surprise. */}
      {selectMode && (
        <div className="ts-select-bar">
          <span style={{ flex: 1, fontSize: 11.5, color: TEXT_MUTED }}>
            {selectedList.length === 0
              ? 'Tick what you want to change'
              : `${selectedList.length} selected`}
          </span>
          <button className="ts-mini-btn" onClick={leaveSelectMode}>Cancel</button>
          {/* ── RENAME LIVES HERE TOO ──────────────────────────────────────
              Ticking a team and finding only Delete makes select mode read as
              a delete mode, and sends somebody who wanted to rename back out
              to look for it elsewhere.

              Exactly one ticked item, and only a team or a campaign: renaming
              is a single-target act with a single text field, and offering it
              for three ticked things would raise a question the dialog cannot
              answer. Agents are not renameable here — their name is their
              own, not a label on somebody's roster. */}
          {renameSelection && (
            <button
              className="ts-mini-btn"
              onClick={() => {
                leaveSelectMode()
                onRename?.(renameSelection.kind, renameSelection.id, renameSelection.name)
              }}
            >Rename</button>
          )}
          {selectedList.length > 0 && (
            <button
              className="ts-mini-btn is-danger"
              onClick={() => { setConfirmText(''); setConfirmOpen(true) }}
            >Delete</button>
          )}
        </div>
      )}

      {/* ── TYPE DELETE ─────────────────────────────────────────────────────
          A confirm button alone is muscle memory. Typing the word is the only
          confirmation that cannot be clicked through by accident, and the
          things listed are named so the agent checks the list rather than the
          count. */}
      {confirmOpen && (
        <div
          onClick={() => !deleting && setConfirmOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 80,
            background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 420, background: '#1e1f22',
              border: `1px solid ${HAIRLINE}`, borderRadius: 8, color: TEXT,
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)', padding: 20,
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 600 }}>
              Delete {selectedList.length} item{selectedList.length === 1 ? '' : 's'}?
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: 12.5, color: TEXT_DIM, lineHeight: 1.6 }}>
              This cannot be undone.
            </p>
            <ul style={{
              margin: '0 0 14px', padding: '10px 12px 10px 26px', maxHeight: 150,
              overflowY: 'auto', background: '#111214', borderRadius: 4,
              fontSize: 12.5, color: TEXT_MUTED, lineHeight: 1.7,
            }}>
              {selectedList.map(s => (
                <li key={s.id}>{s.label} <span style={{ color: TEXT_DIM }}>({s.kind})</span></li>
              ))}
            </ul>
            <label style={{ display: 'block', fontSize: 11.5, color: TEXT_MUTED, marginBottom: 6 }}>
              Type <strong style={{ color: TEXT }}>DELETE</strong> to confirm
            </label>
            <input
              autoFocus
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              disabled={deleting}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '9px 11px',
                borderRadius: 4, border: `1px solid ${HAIRLINE}`, background: '#111214',
                color: TEXT, fontSize: 13.5, fontFamily: 'inherit', letterSpacing: 1,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button
                className="ts-mini-btn"
                disabled={deleting}
                onClick={() => setConfirmOpen(false)}
              >Cancel</button>
              <button
                className="ts-mini-btn is-danger"
                disabled={confirmText !== 'DELETE' || deleting}
                style={{ opacity: confirmText !== 'DELETE' || deleting ? 0.45 : 1 }}
                onClick={async () => {
                  setDeleting(true)
                  try {
                    await onDeleteSelection?.(selectedList)
                    leaveSelectMode()
                  } finally {
                    setDeleting(false)
                  }
                }}
              >{deleting ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── FOOT — SCOPES THAT ARE NOT PART OF THE TREE ──────────────────── */}
      <div className="ts-foot">
        <div className="ts-foot-buttons">
          {/* Requests sits above All Users: it is the one with something
              waiting on a decision, and a queue you must action outranks a
              roster you merely read. */}
          <button
            className="ts-foot-btn"
            onClick={() => onScopeChange({ kind: 'requests' })}
          >
            <span style={{ flex: 1, textAlign: 'left' }}>Requests</span>
            {/* Corner badge, because pending work is an interruption — it
                should read as something stuck to the button rather than a
                field within it. Caps at 99+; past that the exact figure stops
                changing what you do about it. */}
            {pendingRequests > 0 && (
              <span className="ts-badge-corner">
                {pendingRequests > 99 ? '99+' : pendingRequests}
              </span>
            )}
          </button>

          <button
            className="ts-foot-btn"
            onClick={() => onScopeChange({ kind: 'all' })}
          >
            <span style={{ flex: 1, textAlign: 'left' }}>All Users</span>
            {/* Inline count, not a badge: this is a fact about the roster, not
                a task. Blank at zero — "0" is the same information as no
                number, spent on more ink. */}
            {activeUserCount > 0 && (
              <span className="ts-count">{activeUserCount}</span>
            )}
          </button>
        </div>

        {/* Joining is deliberately the last thing, and deliberately always
            visible rather than behind the + menu: the person who needs it is
            usually a new agent who has been sent a code and has no team yet,
            so it must not be hidden inside team-owner tooling. */}
        <div className="ts-join">
          <div className="ts-join-label">Have a Code? Join a Team:</div>
          {/* Enter submits. Blur does NOT — it used to, which meant clicking
              anywhere after typing fired a join attempt nobody asked for. */}
          <input
            className="ts-join-input"
            value={codeInput}
            onChange={e => setCodeInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitCode() }}
            disabled={joining}
            placeholder={joining ? 'Joining…' : 'Enter Team Code Here'}
            aria-label="Team or campaign join code"
          />
          {joinMessage && (
            <div
              role="status"
              style={{
                marginTop: 7, padding: '7px 9px', borderRadius: 4,
                fontSize: 11.5, lineHeight: 1.5,
                background: joinMessage.kind === 'error' ? '#3b1416' : '#12301d',
                border: `1px solid ${joinMessage.kind === 'error' ? '#7f1d1d' : '#1f6b3f'}`,
                color: joinMessage.kind === 'error' ? '#fca5a5' : '#86efac',
              }}
            >{joinMessage.text}</div>
          )}
        </div>
      </div>
    </aside>
  )
}
