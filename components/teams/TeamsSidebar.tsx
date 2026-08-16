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
  name: string
  /** Dialing right now — rendered as a live dot, the one thing that pulls focus. */
  isLive?: boolean
  /** Who pays for this seat. Shown only to an owner, only on hover. */
  seatPaidBy?: 'owner' | 'agent'
}

export interface SidebarCampaign {
  id: string
  name: string
  /** Open to every member (team_campaigns.access_mode = 'free'), so no
   *  per-agent grant is needed. Marked, because it changes who can work it. */
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
  onCreateCampaign?: () => void
  onOpenTeamMenu?: (teamId: string) => void
  onJoinWithCode?: (code: string) => void
  joining?: boolean
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
  onCreateCampaign,
  onOpenTeamMenu,
  onJoinWithCode,
  joining = false,
}: Props) {
  // Everything starts open. An agency with two teams should see its whole
  // shape on load; collapsing is for when the list has outgrown the screen,
  // which is the user's call to make rather than ours to pre-empt.
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set())
  const [collapsedCampaigns, setCollapsedCampaigns] = useState<Set<string>>(new Set())
  const [codeInput, setCodeInput] = useState('')
  const [addMenuOpen, setAddMenuOpen] = useState(false)

  const toggle = (set: Set<string>, id: string, apply: (s: Set<string>) => void) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    apply(next)
  }

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
        .ts-row:hover { background: ${SURFACE_RAISED}; color: ${TEXT}; }
        .ts-row.is-selected { background: ${SURFACE_RAISED}; color: ${TEXT}; }
        /* The selection rail. A left bar rather than a border or an outline —
           it marks the row without changing its geometry, so nothing shifts
           when selection moves. */
        .ts-row.is-selected::before {
          content: ''; position: absolute; left: 0; top: 50%;
          transform: translateY(-50%);
          width: 3px; height: 60%; border-radius: 0 3px 3px 0;
          background: ${ACCENT};
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

        .ts-foot { flex-shrink: 0; border-top: 1px solid ${HAIRLINE}; }
        .ts-foot-row {
          display: flex; align-items: center; gap: 8px;
          width: 100%; border: 0; background: transparent;
          color: ${TEXT_MUTED}; cursor: pointer;
          padding: 9px 14px; font-size: 12px;
          letter-spacing: 1.2px; text-transform: uppercase; font-weight: 600;
          transition: background 0.1s ease, color 0.1s ease;
        }
        .ts-foot-row:hover { background: ${SURFACE_RAISED}; color: ${TEXT}; }
        .ts-foot-row.is-selected { background: ${SURFACE_RAISED}; color: ${TEXT}; }

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

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
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
          <button
            className="ts-icon-btn"
            onClick={() => onOpenTeamMenu?.(teams[0]?.id ?? '')}
            title="Team settings"
            aria-label="Team settings"
          >⋮</button>
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
              <button
                className={`ts-row ts-team-row${isSelected({ kind: 'team', teamId: team.id }) ? ' is-selected' : ''}`}
                onClick={() => {
                  // One click does both: reveals the level below and scopes the
                  // page to it. Making disclosure and selection separate targets
                  // in a list this dense means missing one of them constantly.
                  toggle(collapsedTeams, team.id, setCollapsedTeams)
                  onScopeChange({ kind: 'team', teamId: team.id })
                }}
              >
                <Caret open={teamOpen} />
                <span className="ts-row-label">{team.name}</span>
                {team.isOwner && <span className="ts-tag">Owner</span>}
              </button>

              {teamOpen && team.campaigns.map(campaign => {
                const key = `${team.id}:${campaign.id}`
                const campaignOpen = !collapsedCampaigns.has(key)
                return (
                  <div key={campaign.id}>
                    <button
                      className={`ts-row ts-campaign-row${isSelected({ kind: 'campaign', teamId: team.id, campaignId: campaign.id }) ? ' is-selected' : ''}`}
                      onClick={() => {
                        toggle(collapsedCampaigns, key, setCollapsedCampaigns)
                        onScopeChange({ kind: 'campaign', teamId: team.id, campaignId: campaign.id })
                      }}
                    >
                      <Caret open={campaignOpen} />
                      <span className="ts-row-label">{campaign.name}</span>
                      {/* An open campaign needs no per-agent grants, which
                          changes how the owner reads the roster under it. */}
                      {campaign.openToTeam && <span className="ts-tag">Open</span>}
                    </button>

                    {campaignOpen && (
                      campaign.agents.length === 0 ? (
                        <div className="ts-empty">No agents assigned</div>
                      ) : campaign.agents.map(agent => (
                        <button
                          key={agent.id}
                          className={`ts-row ts-agent-row${isSelected({ kind: 'agent', teamId: team.id, campaignId: campaign.id, userId: agent.id }) ? ' is-selected' : ''}`}
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
                      ))
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* ── FOOT — SCOPES THAT ARE NOT PART OF THE TREE ──────────────────── */}
      <div className="ts-foot">
        <button
          className={`ts-foot-row${scope.kind === 'all' ? ' is-selected' : ''}`}
          onClick={() => onScopeChange({ kind: 'all' })}
        >
          <span style={{ flex: 1 }}>All Users</span>
        </button>

        <button
          className={`ts-foot-row${scope.kind === 'requests' ? ' is-selected' : ''}`}
          onClick={() => onScopeChange({ kind: 'requests' })}
        >
          <span style={{ flex: 1 }}>Requests</span>
          {pendingRequests > 0 && <span className="ts-badge">{pendingRequests}</span>}
        </button>

        {/* Joining is deliberately the last thing, and deliberately always
            visible rather than behind the + menu: the person who needs it is
            usually a new agent who has been sent a code and has no team yet,
            so it must not be hidden inside team-owner tooling. */}
        <div className="ts-join">
          <div className="ts-join-label">Have a Code? Join a Team:</div>
          <input
            className="ts-join-input"
            value={codeInput}
            onChange={e => setCodeInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitCode() }}
            onBlur={submitCode}
            disabled={joining}
            placeholder={joining ? 'Joining…' : 'Enter Team Code Here'}
            aria-label="Team or campaign join code"
          />
        </div>
      </div>
    </aside>
  )
}
