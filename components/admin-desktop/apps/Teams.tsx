'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useDesktopServices } from '../desktopServices'

// ─────────────────────────────────────────────────────────────────────────
// Admin / manager platform-wide Teams app, with two tabs:
//   Teams      — every team, read + delete, mirrors /api/admin(or manager)/teams
//   Campaigns  — every campaign, set active/inactive, assign to teams
// A campaign belongs to one owner and has its own active/inactive status
// (the same switch the owner sees in their own Campaigns app) — toggling it
// here changes it everywhere. Assigning a campaign to a team is a separate,
// per-team relationship (team_campaigns) and doesn't touch ownership.
// ─────────────────────────────────────────────────────────────────────────

interface TeamMemberRow {
  id: string
  userId: string
  name: string
  email: string | null
  status: 'active' | 'pending' | 'removed'
  acceptedAt: string | null
  removedAt: string | null
}

interface TeamSeatRow {
  id: string
  agentId: string
  agentName: string
  agentEmail: string | null
  amountCents: number
  status: 'paid' | 'pending' | 'failed' | 'voided'
  periodStart: string | null
  periodEnd: string | null
  stripeSubscriptionId: string | null
}

interface AdminTeam {
  id: string
  name: string
  description: string | null
  createdAt: string
  joinCode: string | null
  ownerHasCoupon: boolean
  owner: { id: string; name: string; email: string | null }
  memberCount: number
  pendingMemberCount: number
  activeSeats: number
  pendingSeats: number
  failedSeats: number
  voidedSeats: number
  campaignCount: number
  wrr_cents: number
  mrr_cents: number
  members: TeamMemberRow[]
  seats: TeamSeatRow[]
}

interface PlatformTotals {
  teams: number
  activeSeats: number
  pendingSeats: number
  mrr_cents: number
  wrr_cents: number
}

interface TeamsResponse {
  success: boolean
  teams: AdminTeam[]
  platformTotals: PlatformTotals
  error?: string
}

type TeamSortMode = 'revenue' | 'members' | 'newest' | 'name'

// ── campaigns tab types ─────────────────────────────────────────────────

interface TeamAttachment {
  teamId: string
  teamName: string
  accessMode: 'owner_pays' | 'agent_pays' | 'public' | 'free'
  attachedAt: string
}

interface AdminCampaign {
  id: string
  name: string
  status: string
  totalLeads: number
  calledLeads: number
  dialerMode: string | null
  createdAt: string
  updatedAt: string | null
  owner: { id: string; name: string; email: string | null }
  teams: TeamAttachment[]
}

interface TeamOption { id: string; name: string }

interface CampaignPlatformTotals {
  campaigns: number
  active: number
  inactive: number
  attached: number
}

interface CampaignsResponse {
  success: boolean
  campaigns: AdminCampaign[]
  allTeams: TeamOption[]
  platformTotals: CampaignPlatformTotals
  error?: string
}

type CampaignSortMode = 'newest' | 'leads' | 'name' | 'teams'
type CampaignStatusFilter = 'all' | 'active' | 'inactive'

const ACCESS_MODE_LABELS: Record<TeamAttachment['accessMode'], string> = {
  owner_pays: 'Owner pays', agent_pays: 'Agent pays', public: 'Public', free: 'Free',
}

type TeamsAppTab = 'teams' | 'campaigns'

// ── glass design tokens ─────────────────────────────────────────────────
const G = {
  bgA: '#0a0d14',
  bgB: '#0d1220',
  glow1: 'rgba(94,201,255,0.10)',
  glow2: 'rgba(168,124,255,0.08)',
  card: 'rgba(255,255,255,0.045)',
  cardHover: 'rgba(255,255,255,0.07)',
  cardBorder: 'rgba(255,255,255,0.09)',
  cardBorderHover: 'rgba(255,255,255,0.16)',
  line: 'rgba(255,255,255,0.08)',
  text: '#eef1f8',
  textDim: '#9aa3ba',
  textFaint: '#5c6478',
  accent: '#5ec9ff',
  accentSoft: 'rgba(94,201,255,0.14)',
  teal: '#4ad0c0',
  tealSoft: 'rgba(74,208,192,0.14)',
  blue: '#5ec9ff',
  blueSoft: 'rgba(94,201,255,0.14)',
  amber: '#ffb454',
  amberSoft: 'rgba(255,180,84,0.14)',
  red: '#ff6b6b',
  redSoft: 'rgba(255,107,107,0.14)',
  green: '#5adba0',
  greenSoft: 'rgba(90,219,160,0.14)',
}

const SANS = `-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Helvetica, Arial, sans-serif`


function fmtMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default function TeamsApp() {
  const [tab, setTab] = useState<TeamsAppTab>('teams')
  const [campaignsVisited, setCampaignsVisited] = useState(false)

  useEffect(() => {
    if (tab === 'campaigns' && !campaignsVisited) setCampaignsVisited(true)
  }, [tab, campaignsVisited])

  return (
    <div style={S.root}>
      <style>{`
        @keyframes ts-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-3%, 2%) scale(1.05); }
        }
        .ts-scroll { overflow-y: auto; overflow-x: hidden; }
        .ts-scroll::-webkit-scrollbar { width: 8px; }
        .ts-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 8px; }
        .ts-scroll::-webkit-scrollbar-track { background: transparent; }
        .ts-card {
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
        }
        .ts-card:hover {
          background: ${G.cardHover};
          border-color: ${G.cardBorderHover};
        }
        .ts-row-btn { transition: background 0.12s ease; }
        .ts-row-btn:hover { background: rgba(255,255,255,0.05); }
        .ts-chip-btn { transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease; }
        .ts-toggle { transition: background 0.15s ease; }
        input.ts-search::placeholder { color: ${G.textFaint}; }
      `}</style>

      {/* ambient glow backdrop */}
      <div style={{ ...S.glowBlob, top: -140, left: -100, background: G.glow1, animation: 'ts-drift 22s ease-in-out infinite' }} />
      <div style={{ ...S.glowBlob, bottom: -160, right: -120, background: G.glow2, animation: 'ts-drift 26s ease-in-out infinite reverse' }} />

      {/* tab strip */}
      <div style={S.tabStrip}>
        {([
          { key: 'teams', label: 'Teams' },
          { key: 'campaigns', label: 'Campaigns' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              ...S.tabBtn,
              color: tab === t.key ? G.text : G.textDim,
              borderBottom: tab === t.key ? `2px solid ${t.key === 'teams' ? G.accent : G.teal}` : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: tab === 'teams' ? 'contents' : 'none' }}>
        <TeamsTab />
      </div>
      {campaignsVisited && (
        <div style={{ display: tab === 'campaigns' ? 'contents' : 'none' }}>
          <CampaignsTab />
        </div>
      )}
    </div>
  )
}

function TeamsTab() {
  const services = useDesktopServices()
  const base = services?.role === 'manager' ? '/api/manager/teams' : '/api/admin/teams'

  const [teams, setTeams] = useState<AdminTeam[]>([])
  const [totals, setTotals] = useState<PlatformTotals | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<TeamSortMode>('revenue')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<AdminTeam | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(base, { cache: 'no-store' })
      const d: TeamsResponse = await r.json()
      if (!d.success) throw new Error(d.error || 'Failed to load teams')
      setTeams(d.teams || [])
      setTotals(d.platformTotals || null)
    } catch (e: any) {
      setError(e?.message || 'Failed to load teams')
    } finally {
      setLoading(false)
    }
  }, [base])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = !q ? teams : teams.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.owner.name.toLowerCase().includes(q) ||
      (t.owner.email || '').toLowerCase().includes(q) ||
      (t.joinCode || '').toLowerCase().includes(q)
    )
    list = [...list]
    if (sort === 'revenue') list.sort((a, b) => b.wrr_cents - a.wrr_cents)
    else if (sort === 'members') list.sort((a, b) => b.memberCount - a.memberCount)
    else if (sort === 'newest') list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    else list.sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [teams, query, sort])

  const copyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1400)
    } catch {}
  }

  const openDelete = (t: AdminTeam) => {
    setDeleteTarget(t)
    setDeleteConfirm('')
    setDeleteError(null)
  }

  const submitDelete = async () => {
    if (!deleteTarget) return
    if (deleteConfirm.trim().toLowerCase() !== 'remove') return
    setDeleting(true)
    setDeleteError(null)
    try {
      const r = await fetch(`${base}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: deleteTarget.id, confirm: 'remove' }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || 'Failed to delete team')
      setDeleteTarget(null)
      setDeleteConfirm('')
      await load()
    } catch (e: any) {
      setDeleteError(e?.message || 'Failed to delete team')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {/* header */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
          <span style={S.headerTitle}>Teams</span>
          <span style={S.headerSub}>platform overview</span>
        </div>

        {totals && (
          <div style={S.statRow}>
            <Stat label="Teams" value={String(totals.teams)} />
            <Stat label="Active seats" value={String(totals.activeSeats)} accent={G.green} />
            {totals.pendingSeats > 0 && <Stat label="Pending" value={String(totals.pendingSeats)} accent={G.amber} />}
            <Stat label="WRR" value={fmtMoney(totals.wrr_cents)} accent={G.accent} />
            <Stat label="MRR" value={fmtMoney(totals.mrr_cents)} accent={G.accent} />
          </div>
        )}
      </div>

      {/* toolbar */}
      <div style={S.toolbar}>
        <div style={S.searchWrap}>
          <span style={{ color: G.textFaint, fontSize: 13 }}>⌕</span>
          <input
            className="ts-search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search teams, owners, codes…"
            style={S.searchInput}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {([
            { key: 'revenue', label: 'Revenue' },
            { key: 'members', label: 'Members' },
            { key: 'newest', label: 'Newest' },
            { key: 'name', label: 'A–Z' },
          ] as const).map(o => (
            <button
              key={o.key}
              className="ts-chip-btn"
              onClick={() => setSort(o.key)}
              style={{
                ...S.sortChip,
                background: sort === o.key ? G.accentSoft : 'transparent',
                borderColor: sort === o.key ? 'rgba(94,201,255,0.35)' : G.cardBorder,
                color: sort === o.key ? G.accent : G.textDim,
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button onClick={load} style={S.refreshBtn} title="Refresh">⟳</button>
      </div>

      {/* body */}
      <div className="ts-scroll" style={S.body}>
        {loading && (
          <div style={S.centerMsg}>Loading teams…</div>
        )}

        {!loading && error && (
          <div style={S.errorCard}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: G.red }}>Couldn't load teams</div>
            <div style={{ color: G.textDim, fontSize: 12.5 }}>{error}</div>
            <button onClick={load} style={{ ...S.smallBtn, marginTop: 12 }}>Retry</button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div style={S.centerMsg}>
            {teams.length === 0 ? 'No teams on the platform yet.' : 'No teams match your search.'}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div style={S.grid}>
            {filtered.map(team => (
              <TeamCard
                key={team.id}
                team={team}
                expanded={expandedId === team.id}
                onToggle={() => setExpandedId(id => id === team.id ? null : team.id)}
                onCopyCode={() => team.joinCode && copyCode(team.joinCode, team.id)}
                copied={copiedId === team.id}
                onDelete={() => openDelete(team)}
              />
            ))}
          </div>
        )}
      </div>

      {/* delete confirmation modal */}
      {deleteTarget && (
        <div onClick={() => !deleting && setDeleteTarget(null)} style={S.overlay}>
          <div onClick={e => e.stopPropagation()} style={S.modal}>
            <div style={{ fontSize: 13, fontWeight: 700, color: G.red, marginBottom: 10, letterSpacing: 0.3 }}>
              Delete team
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: G.text, margin: '0 0 8px 0' }}>
              Permanently delete <strong>{deleteTarget.name}</strong>?
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.6, color: G.textDim, margin: '0 0 16px 0' }}>
              {deleteTarget.memberCount} member{deleteTarget.memberCount === 1 ? '' : 's'} lose access
              {deleteTarget.activeSeats > 0 ? `, ${deleteTarget.activeSeats} active seat charge${deleteTarget.activeSeats === 1 ? '' : 's'} orphaned` : ''}.
              This cannot be undone.
            </p>
            <input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder='Type "remove" to confirm'
              autoFocus
              disabled={deleting}
              style={S.modalInput}
            />
            {deleteError && (
              <div style={{ marginTop: 10, fontSize: 12, color: G.red }}>{deleteError}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                style={S.modalCancelBtn}
              >Cancel</button>
              <button
                onClick={submitDelete}
                disabled={deleting || deleteConfirm.trim().toLowerCase() !== 'remove'}
                style={{
                  ...S.modalDeleteBtn,
                  opacity: deleting || deleteConfirm.trim().toLowerCase() !== 'remove' ? 0.45 : 1,
                  cursor: deleting || deleteConfirm.trim().toLowerCase() !== 'remove' ? 'not-allowed' : 'pointer',
                }}
              >{deleting ? 'Deleting…' : 'Delete team'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={S.statCell}>
      <div style={{ fontSize: 15, fontWeight: 700, color: accent || G.text, letterSpacing: 0.2 }}>{value}</div>
      <div style={{ fontSize: 9.5, color: G.textFaint, letterSpacing: 1, textTransform: 'uppercase', marginTop: 1 }}>{label}</div>
    </div>
  )
}

function TeamCard({
  team, expanded, onToggle, onCopyCode, copied, onDelete,
}: {
  team: AdminTeam
  expanded: boolean
  onToggle: () => void
  onCopyCode: () => void
  copied: boolean
  onDelete: () => void
}) {
  const activeMembers = team.members.filter(m => m.status === 'active')
  const pendingMembers = team.members.filter(m => m.status === 'pending')

  return (
    <div className="ts-card" style={{ ...S.card, gridColumn: expanded ? '1 / -1' : undefined }}>
      <button className="ts-row-btn" onClick={onToggle} style={S.cardHead}>
        <div style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          background: G.accentSoft, color: G.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800,
        }}>
          {initials(team.name)}
        </div>

        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: G.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {team.name}
            </span>
            {team.pendingMemberCount > 0 && (
              <span style={{ ...S.badge, background: G.amberSoft, color: G.amber }}>
                {team.pendingMemberCount} pending
              </span>
            )}
            {team.ownerHasCoupon && (
              <span style={{ ...S.badge, background: G.greenSoft, color: G.green }}>discounted</span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: G.textDim, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {team.owner.name}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 18, flexShrink: 0, alignItems: 'center' }}>
          <MiniStat value={String(team.memberCount)} label="members" />
          <MiniStat value={String(team.campaignCount)} label="campaigns" />
          <MiniStat value={fmtMoney(team.wrr_cents)} label="wk" accent={G.accent} />
          <span style={{
            fontSize: 13, color: G.textFaint, transform: expanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.15s ease', width: 14, textAlign: 'center',
          }}>›</span>
        </div>
      </button>

      {expanded && (
        <div style={S.cardBody}>
          <div style={S.metaRow}>
            <MetaItem label="Created" value={fmtDate(team.createdAt)} />
            <MetaItem label="Owner email" value={team.owner.email || '—'} />
            {team.joinCode && (
              <button className="ts-chip-btn" onClick={onCopyCode} style={S.codeChip}>
                <span style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{team.joinCode}</span>
                <span style={{ color: G.textFaint }}>{copied ? '✓ copied' : 'copy'}</span>
              </button>
            )}
            {team.description && (
              <div style={{ fontSize: 12, color: G.textDim, lineHeight: 1.5, flex: '1 1 220px', minWidth: 180 }}>
                {team.description}
              </div>
            )}
          </div>

          {(team.activeSeats > 0 || team.pendingSeats > 0 || team.failedSeats > 0 || team.voidedSeats > 0) && (
            <div style={S.seatSummary}>
              {team.activeSeats > 0 && <SeatPill label="active" count={team.activeSeats} color={G.green} bg={G.greenSoft} />}
              {team.pendingSeats > 0 && <SeatPill label="pending" count={team.pendingSeats} color={G.amber} bg={G.amberSoft} />}
              {team.failedSeats > 0 && <SeatPill label="failed" count={team.failedSeats} color={G.red} bg={G.redSoft} />}
              {team.voidedSeats > 0 && <SeatPill label="voided" count={team.voidedSeats} color={G.textFaint} bg="rgba(255,255,255,0.05)" />}
            </div>
          )}

          <div style={S.twoCol}>
            <div>
              <div style={S.sectionLabel}>Members ({activeMembers.length}{pendingMembers.length > 0 ? ` + ${pendingMembers.length} pending` : ''})</div>
              {activeMembers.length === 0 && pendingMembers.length === 0 ? (
                <EmptyHint text="No members yet." />
              ) : (
                <div style={S.memberList}>
                  {pendingMembers.map(m => (
                    <div key={m.id} style={S.memberRow}>
                      <span style={{ ...S.dot, background: G.amber }} />
                      <span style={S.memberName}>{m.name}</span>
                      <span style={{ ...S.badge, background: G.amberSoft, color: G.amber, marginLeft: 'auto' }}>pending</span>
                    </div>
                  ))}
                  {activeMembers.map(m => (
                    <div key={m.id} style={S.memberRow}>
                      <span style={{ ...S.dot, background: G.green }} />
                      <span style={S.memberName}>{m.name}</span>
                      {m.email && <span style={S.memberEmail}>{m.email}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div style={S.sectionLabel}>Seat charges ({team.seats.length})</div>
              {team.seats.length === 0 ? (
                <EmptyHint text="No seat charges." />
              ) : (
                <div style={S.memberList}>
                  {team.seats.map(s => (
                    <div key={s.id} style={S.memberRow}>
                      <span style={{
                        ...S.dot,
                        background: s.status === 'paid' ? G.green : s.status === 'pending' ? G.amber : s.status === 'failed' ? G.red : G.textFaint,
                      }} />
                      <span style={S.memberName}>{s.agentName}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: G.textDim, fontFamily: 'monospace' }}>
                        {fmtMoney(s.amountCents)}/wk
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={S.cardFooter}>
            <button onClick={onDelete} style={S.deleteBtn}>Delete team</button>
          </div>
        </div>
      )}
    </div>
  )
}

function MiniStat({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: accent || G.text }}>{value}</div>
      <div style={{ fontSize: 9, color: G.textFaint, letterSpacing: 0.5 }}>{label}</div>
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, color: G.textFaint, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: G.text }}>{value}</div>
    </div>
  )
}

function SeatPill({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 20, background: bg, color,
      fontSize: 11, fontWeight: 700,
    }}>
      {count} {label}
    </span>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 10, border: `1px dashed ${G.cardBorder}`,
      color: G.textFaint, fontSize: 11.5,
    }}>{text}</div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Campaigns tab
// ─────────────────────────────────────────────────────────────────────────

function CampaignsTab() {
  const services = useDesktopServices()
  const isManager = services?.role === 'manager'
  const listBase = isManager ? '/api/manager/campaigns' : '/api/admin/campaigns'
  const statusBase = isManager ? '/api/manager/campaigns/status' : '/api/admin/campaigns/status'
  const assignBase = isManager ? '/api/manager/campaigns/assign-team' : '/api/admin/campaigns/assign-team'

  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([])
  const [allTeams, setAllTeams] = useState<TeamOption[]>([])
  const [totals, setTotals] = useState<CampaignPlatformTotals | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<CampaignSortMode>('newest')
  const [statusFilter, setStatusFilter] = useState<CampaignStatusFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [assignPickerFor, setAssignPickerFor] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(listBase, { cache: 'no-store' })
      const d: CampaignsResponse = await r.json()
      if (!d.success) throw new Error(d.error || 'Failed to load campaigns')
      setCampaigns(d.campaigns || [])
      setAllTeams(d.allTeams || [])
      setTotals(d.platformTotals || null)
    } catch (e: any) {
      setError(e?.message || 'Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }, [listBase])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = campaigns.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) ||
        c.owner.name.toLowerCase().includes(q) ||
        (c.owner.email || '').toLowerCase().includes(q) ||
        c.teams.some(t => t.teamName.toLowerCase().includes(q))
    })
    list = [...list]
    if (sort === 'newest') list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    else if (sort === 'leads') list.sort((a, b) => b.totalLeads - a.totalLeads)
    else if (sort === 'teams') list.sort((a, b) => b.teams.length - a.teams.length)
    else list.sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [campaigns, query, sort, statusFilter])

  const toggleStatus = async (c: AdminCampaign) => {
    const nextStatus = c.status === 'active' ? 'inactive' : 'active'
    setBusyId(c.id)
    setActionError(null)
    setCampaigns(cs => cs.map(x => x.id === c.id ? { ...x, status: nextStatus } : x))
    try {
      const r = await fetch(statusBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: c.id, status: nextStatus }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || 'Failed to update status')
    } catch (e: any) {
      setCampaigns(cs => cs.map(x => x.id === c.id ? { ...x, status: c.status } : x))
      setActionError(e?.message || 'Failed to update status')
    } finally {
      setBusyId(null)
    }
  }

  const assignToTeam = async (campaignId: string, teamId: string) => {
    setBusyId(campaignId)
    setActionError(null)
    try {
      const r = await fetch(assignBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, teamId, accessMode: 'owner_pays' }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || 'Failed to assign team')
      setAssignPickerFor(null)
      await load()
    } catch (e: any) {
      setActionError(e?.message || 'Failed to assign team')
    } finally {
      setBusyId(null)
    }
  }

  const unassignFromTeam = async (campaignId: string, teamId: string) => {
    setBusyId(campaignId)
    setActionError(null)
    try {
      const r = await fetch(assignBase, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, teamId }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || 'Failed to remove team')
      await load()
    } catch (e: any) {
      setActionError(e?.message || 'Failed to remove team')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
          <span style={S.headerTitle}>Campaigns</span>
          <span style={S.headerSub}>{isManager ? 'tenant overview' : 'platform overview'}</span>
        </div>

        {totals && (
          <div style={S.statRow}>
            <Stat label="Campaigns" value={String(totals.campaigns)} />
            <Stat label="Active" value={String(totals.active)} accent={G.green} />
            {totals.inactive > 0 && <Stat label="Inactive" value={String(totals.inactive)} accent={G.textFaint} />}
            <Stat label="Team-assigned" value={String(totals.attached)} accent={G.teal} />
          </div>
        )}
      </div>

      <div style={S.toolbar}>
        <div style={S.searchWrap}>
          <span style={{ color: G.textFaint, fontSize: 13 }}>⌕</span>
          <input
            className="ts-search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search campaigns, owners, teams…"
            style={S.searchInput}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {([
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'inactive', label: 'Inactive' },
          ] as const).map(o => (
            <button
              key={o.key}
              className="ts-chip-btn"
              onClick={() => setStatusFilter(o.key)}
              style={{
                ...S.sortChip,
                background: statusFilter === o.key ? G.tealSoft : 'transparent',
                borderColor: statusFilter === o.key ? 'rgba(74,208,192,0.35)' : G.cardBorder,
                color: statusFilter === o.key ? G.teal : G.textDim,
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {([
            { key: 'newest', label: 'Newest' },
            { key: 'leads', label: 'Leads' },
            { key: 'teams', label: 'Teams' },
            { key: 'name', label: 'A–Z' },
          ] as const).map(o => (
            <button
              key={o.key}
              className="ts-chip-btn"
              onClick={() => setSort(o.key)}
              style={{
                ...S.sortChip,
                background: sort === o.key ? G.accentSoft : 'transparent',
                borderColor: sort === o.key ? 'rgba(94,201,255,0.35)' : G.cardBorder,
                color: sort === o.key ? G.accent : G.textDim,
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button onClick={load} style={S.refreshBtn} title="Refresh">⟳</button>
      </div>

      {actionError && (
        <div style={S.actionErrorBar}>
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} style={S.actionErrorClose}>✕</button>
        </div>
      )}

      <div className="ts-scroll" style={S.body}>
        {loading && <div style={S.centerMsg}>Loading campaigns…</div>}

        {!loading && error && (
          <div style={S.errorCard}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: G.red }}>Couldn't load campaigns</div>
            <div style={{ color: G.textDim, fontSize: 12.5 }}>{error}</div>
            <button onClick={load} style={{ ...S.smallBtn, marginTop: 12 }}>Retry</button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div style={S.centerMsg}>
            {campaigns.length === 0 ? 'No campaigns yet.' : 'No campaigns match your search.'}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div style={S.grid}>
            {filtered.map(c => (
              <CampaignCard
                key={c.id}
                campaign={c}
                allTeams={allTeams}
                expanded={expandedId === c.id}
                onToggleExpand={() => setExpandedId(id => id === c.id ? null : c.id)}
                busy={busyId === c.id}
                onToggleStatus={() => toggleStatus(c)}
                assignPickerOpen={assignPickerFor === c.id}
                onOpenAssignPicker={() => setAssignPickerFor(c.id)}
                onCloseAssignPicker={() => setAssignPickerFor(null)}
                onAssign={(teamId) => assignToTeam(c.id, teamId)}
                onUnassign={(teamId) => unassignFromTeam(c.id, teamId)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function CampaignCard({
  campaign, allTeams, expanded, onToggleExpand, busy, onToggleStatus,
  assignPickerOpen, onOpenAssignPicker, onCloseAssignPicker, onAssign, onUnassign,
}: {
  campaign: AdminCampaign
  allTeams: TeamOption[]
  expanded: boolean
  onToggleExpand: () => void
  busy: boolean
  onToggleStatus: () => void
  assignPickerOpen: boolean
  onOpenAssignPicker: () => void
  onCloseAssignPicker: () => void
  onAssign: (teamId: string) => void
  onUnassign: (teamId: string) => void
}) {
  const isActive = campaign.status === 'active'
  const progressPct = campaign.totalLeads > 0 ? Math.min(100, (campaign.calledLeads / campaign.totalLeads) * 100) : 0
  const attachedTeamIds = new Set(campaign.teams.map(t => t.teamId))
  const availableTeams = allTeams.filter(t => !attachedTeamIds.has(t.id))

  return (
    <div className="ts-card" style={{ ...S.campaignCard, gridColumn: expanded ? '1 / -1' : undefined, opacity: isActive ? 1 : 0.72 }}>
      <div style={S.campaignCardHead}>
        <button className="ts-row-btn" onClick={onToggleExpand} style={S.campaignCardHeadBtn}>
          <div style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: isActive ? G.tealSoft : 'rgba(255,255,255,0.05)',
            color: isActive ? G.teal : G.textFaint,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800,
          }}>
            {initials(campaign.name)}
          </div>

          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: G.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {campaign.name}
              </span>
              {campaign.teams.length > 0 && (
                <span style={{ ...S.badge, background: G.accentSoft, color: G.accent }}>
                  {campaign.teams.length} team{campaign.teams.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: G.textDim, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {campaign.owner.name}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 18, flexShrink: 0, alignItems: 'center' }}>
            <MiniStat value={campaign.calledLeads.toLocaleString()} label={`of ${campaign.totalLeads.toLocaleString()}`} />
            <span style={{
              fontSize: 13, color: G.textFaint, transform: expanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.15s ease', width: 14, textAlign: 'center',
            }}>›</span>
          </div>
        </button>

        <StatusToggle isActive={isActive} busy={busy} onClick={onToggleStatus} />
      </div>

      {campaign.totalLeads > 0 && (
        <div style={S.progressTrack}>
          <div style={{ ...S.progressFill, width: `${progressPct}%`, background: isActive ? G.teal : G.textFaint }} />
        </div>
      )}

      {expanded && (
        <div style={S.cardBody}>
          <div style={S.metaRow}>
            <MetaItem label="Created" value={fmtDate(campaign.createdAt)} />
            <MetaItem label="Owner email" value={campaign.owner.email || '—'} />
            <MetaItem label="Dialer mode" value={campaign.dialerMode || '—'} />
            <MetaItem label="Progress" value={`${campaign.calledLeads.toLocaleString()} / ${campaign.totalLeads.toLocaleString()} called`} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={S.sectionLabel}>Assigned teams ({campaign.teams.length})</div>
              <div style={{ position: 'relative' }}>
                <button
                  className="ts-chip-btn"
                  onClick={onOpenAssignPicker}
                  disabled={busy || availableTeams.length === 0}
                  style={{
                    ...S.assignBtn,
                    opacity: availableTeams.length === 0 ? 0.4 : 1,
                    cursor: availableTeams.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                  title={availableTeams.length === 0 ? 'Already assigned to every team' : 'Assign to a team'}
                >
                  + Assign to team
                </button>
                {assignPickerOpen && (
                  <TeamPicker
                    teams={availableTeams}
                    onPick={onAssign}
                    onClose={onCloseAssignPicker}
                  />
                )}
              </div>
            </div>

            {campaign.teams.length === 0 ? (
              <EmptyHint text="Not assigned to any team." />
            ) : (
              <div style={S.memberList}>
                {campaign.teams.map(t => (
                  <div key={t.teamId} style={S.memberRow}>
                    <span style={{ ...S.dot, background: G.accent }} />
                    <span style={S.memberName}>{t.teamName}</span>
                    <span style={{ ...S.badge, background: 'rgba(255,255,255,0.06)', color: G.textDim, marginLeft: 'auto' }}>
                      {ACCESS_MODE_LABELS[t.accessMode]}
                    </span>
                    <button
                      onClick={() => onUnassign(t.teamId)}
                      disabled={busy}
                      style={S.unassignBtn}
                      title="Remove from this team"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusToggle({ isActive, busy, onClick }: { isActive: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      className="ts-toggle"
      onClick={onClick}
      disabled={busy}
      title={isActive ? 'Set inactive' : 'Set active'}
      style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 10px 6px 8px', borderRadius: 20, border: 'none', cursor: busy ? 'wait' : 'pointer',
        background: isActive ? G.greenSoft : 'rgba(255,255,255,0.06)',
        color: isActive ? G.green : G.textFaint, fontFamily: SANS,
        fontSize: 10, fontWeight: 700, letterSpacing: 0.4, opacity: busy ? 0.6 : 1,
      }}
    >
      <span style={{
        width: 26, height: 14, borderRadius: 8, position: 'relative', flexShrink: 0,
        background: isActive ? G.green : 'rgba(255,255,255,0.15)', transition: 'background 0.15s ease',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: isActive ? 14 : 2, width: 10, height: 10, borderRadius: '50%',
          background: '#fff', transition: 'left 0.15s ease',
        }} />
      </span>
      {isActive ? 'ACTIVE' : 'INACTIVE'}
    </button>
  )
}

function TeamPicker({ teams, onPick, onClose }: { teams: TeamOption[]; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
      <div style={S.teamPicker}>
        {teams.map(t => (
          <button key={t.id} onClick={() => onPick(t.id)} style={S.teamPickerItem}>
            {t.name}
          </button>
        ))}
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  root: {
    position: 'relative', display: 'flex', flexDirection: 'column',
    width: '100%', height: '100%', overflow: 'hidden',
    background: `linear-gradient(160deg, ${G.bgA}, ${G.bgB})`,
    color: G.text, fontFamily: SANS,
  },
  glowBlob: {
    position: 'absolute', width: 480, height: 480, borderRadius: '50%',
    filter: 'blur(90px)', pointerEvents: 'none', zIndex: 0,
  },
  header: {
    position: 'relative', zIndex: 1, padding: '18px 22px 14px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, flexWrap: 'wrap', borderBottom: `1px solid ${G.line}`,
  },
  headerTitle: { fontSize: 17, fontWeight: 700, letterSpacing: 0.2, color: G.text },
  headerSub: { fontSize: 11.5, color: G.textFaint, letterSpacing: 0.3 },
  statRow: { display: 'flex', gap: 22, alignItems: 'center' },
  statCell: { textAlign: 'right' },
  tabStrip: {
    position: 'relative', zIndex: 1, display: 'flex', gap: 4, padding: '0 22px',
    borderBottom: `1px solid ${G.line}`, flexShrink: 0,
  },
  tabBtn: {
    padding: '11px 4px', marginBottom: -1, background: 'transparent', border: 'none',
    borderBottom: '2px solid transparent', fontFamily: SANS, fontSize: 12.5, fontWeight: 700,
    letterSpacing: 0.2, cursor: 'pointer', marginRight: 18,
  },
  toolbar: {
    position: 'relative', zIndex: 1, padding: '12px 22px',
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    borderBottom: `1px solid ${G.line}`,
  },
  searchWrap: {
    flex: '1 1 240px', minWidth: 180, display: 'flex', alignItems: 'center', gap: 8,
    background: G.card, border: `1px solid ${G.cardBorder}`, borderRadius: 10,
    padding: '8px 12px',
  },
  searchInput: {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    color: G.text, fontSize: 12.5, fontFamily: SANS,
  },
  sortChip: {
    padding: '7px 12px', borderRadius: 8, border: '1px solid transparent',
    fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: SANS, whiteSpace: 'nowrap',
  },
  refreshBtn: {
    width: 32, height: 32, borderRadius: 8, background: G.card, border: `1px solid ${G.cardBorder}`,
    color: G.textDim, cursor: 'pointer', fontSize: 14, flexShrink: 0,
  },
  body: { position: 'relative', zIndex: 1, flex: 1, padding: '18px 22px 26px', minHeight: 0 },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 12,
  },
  card: {
    background: G.card, border: `1px solid ${G.cardBorder}`, borderRadius: 16,
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    overflow: 'hidden',
  },
  cardHead: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 13,
    padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
    fontFamily: SANS, textAlign: 'left',
  },
  cardBody: {
    padding: '4px 18px 18px', borderTop: `1px solid ${G.line}`,
    display: 'flex', flexDirection: 'column', gap: 14,
  },
  metaRow: {
    display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center', paddingTop: 14,
  },
  codeChip: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
    background: 'rgba(255,255,255,0.04)', border: `1px solid ${G.cardBorder}`, borderRadius: 8,
    color: G.text, fontSize: 11.5, cursor: 'pointer', fontFamily: SANS,
  },
  seatSummary: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 },
  sectionLabel: {
    fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase', color: G.textFaint,
    fontWeight: 700, marginBottom: 8,
  },
  memberList: {
    display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 220, overflowY: 'auto',
    background: 'rgba(0,0,0,0.15)', borderRadius: 10, border: `1px solid ${G.line}`,
  },
  memberRow: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
    borderBottom: `1px solid ${G.line}`, fontSize: 12,
  },
  memberName: { color: G.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  memberEmail: { color: G.textFaint, fontSize: 10.5, marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 },
  dot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  badge: {
    padding: '2px 8px', borderRadius: 20, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3,
    whiteSpace: 'nowrap',
  },
  cardFooter: {
    display: 'flex', justifyContent: 'flex-end', paddingTop: 10, borderTop: `1px solid ${G.line}`,
  },
  deleteBtn: {
    padding: '7px 14px', borderRadius: 8, background: 'transparent',
    border: `1px solid rgba(255,107,107,0.35)`, color: G.red,
    fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: SANS,
  },
  smallBtn: {
    padding: '7px 14px', borderRadius: 8, background: G.card, border: `1px solid ${G.cardBorder}`,
    color: G.text, fontSize: 11.5, cursor: 'pointer', fontFamily: SANS,
  },
  centerMsg: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', color: G.textFaint, fontSize: 13, minHeight: 200,
  },
  errorCard: {
    maxWidth: 420, margin: '40px auto', padding: 20, borderRadius: 14,
    background: G.card, border: `1px solid ${G.cardBorder}`, textAlign: 'center',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(4,6,12,0.65)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20,
  },
  modal: {
    width: '100%', maxWidth: 420, background: '#12162140', backgroundColor: '#141826',
    border: `1px solid ${G.cardBorder}`, borderRadius: 16, padding: 24,
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)', fontFamily: SANS,
  },
  modalInput: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    background: 'rgba(0,0,0,0.25)', border: `1px solid ${G.cardBorder}`,
    color: G.text, fontSize: 13, fontFamily: SANS, outline: 'none', boxSizing: 'border-box',
  },
  modalCancelBtn: {
    flex: 1, padding: '10px', borderRadius: 8, background: 'transparent',
    border: `1px solid ${G.cardBorder}`, color: G.textDim, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: SANS,
  },
  modalDeleteBtn: {
    flex: 1, padding: '10px', borderRadius: 8, background: G.redSoft,
    border: `1px solid rgba(255,107,107,0.4)`, color: G.red, fontSize: 12, fontWeight: 700,
    fontFamily: SANS,
  },

  // ── campaigns tab ──
  campaignCard: {
    background: G.card, border: `1px solid ${G.cardBorder}`, borderRadius: 16,
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    overflow: 'visible',
  },
  campaignCardHead: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 14px 16px',
  },
  campaignCardHeadBtn: {
    flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 13,
    background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: SANS, textAlign: 'left', padding: 0,
  },
  progressTrack: {
    height: 3, background: 'rgba(255,255,255,0.06)', margin: '0 16px 14px', borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  assignBtn: {
    padding: '6px 11px', borderRadius: 8, background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${G.cardBorder}`, color: G.text, fontSize: 10.5, fontWeight: 600,
    fontFamily: SANS,
  },
  teamPicker: {
    position: 'absolute', top: '110%', right: 0, zIndex: 50, minWidth: 200, maxHeight: 220, overflowY: 'auto',
    background: '#141c1a', border: `1px solid ${G.cardBorder}`, borderRadius: 10,
    boxShadow: '0 12px 32px rgba(0,0,0,0.4)', padding: 6,
  },
  teamPickerItem: {
    display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 6,
    background: 'transparent', border: 'none', color: G.text, fontSize: 12, cursor: 'pointer', fontFamily: SANS,
  },
  unassignBtn: {
    background: 'transparent', border: 'none', color: G.textFaint, cursor: 'pointer', fontSize: 11,
    padding: '2px 4px', flexShrink: 0,
  },
  actionErrorBar: {
    position: 'relative', zIndex: 1, margin: '10px 22px 0', padding: '8px 12px', borderRadius: 8,
    background: G.redSoft, border: '1px solid rgba(255,107,107,0.3)', color: G.red,
    fontSize: 11.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  },
  actionErrorClose: {
    background: 'transparent', border: 'none', color: G.red, cursor: 'pointer', fontSize: 12, flexShrink: 0,
  },
}
