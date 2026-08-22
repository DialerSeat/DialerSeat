'use client'
import { useEffect, useState } from 'react'

const T = {
  bg: 'var(--brand-page-bg)',
  surface: 'var(--brand-card-surface)',
  border: 'var(--brand-card-border)',
  text: 'var(--brand-on-page-bg)',
  muted: 'var(--brand-muted-text)',
  blue: 'var(--brand-primary)',
  accent: '#4a9eff',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}
const FUTURA = `'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif`

interface AdminUser {
  clerk_id: string
  email: string
  first_name: string | null
  last_name: string | null
  created_at: string
  lead_count: number
  /** Calls with a stored recording_url — real playable recordings, not just
   *  calls that had recording enabled. */
  recording_count: number
  team_member_count: number
  is_active_subscription: boolean
  /** The seats this person holds — which team, the code they redeemed, and
   *  who is paying. An agent on an owner-paid seat has no subscription of
   *  their own, so without this the row reads INACTIVE for somebody who is
   *  dialing perfectly well. */
  seats?: Array<{
    team_id: string
    team_name: string
    status: string
    joined_via_code: string | null
    code_type: string | null
    payer: 'owner' | 'agent' | null
    suspended: boolean
    suspend_reason: string | null
    joined_at: string | null
  }>
  owner_funded_seat?: boolean
}

interface PreviewLead {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string
  email?: string | null
  state?: string | null
  city?: string | null
  extra_data?: Record<string, any> | null
}

interface Campaign {
  id: string
  name: string
  status: string
  total_leads: number
  called_leads: number
  created_at: string
  dialer_mode: string
  amd_enabled: boolean
  predictive_lines_per_agent: number
  enable_appointments_sub: boolean
  enable_not_interested_sub: boolean
  preview_leads: PreviewLead[]
}

interface Lead {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string
  email?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  disposition?: string | null
  dial_attempts?: number | null
  last_called_at?: string | null
  notes?: string | null
  extra_data?: Record<string, any> | null
  consent_date?: string | null
  consent_source?: string | null
  created_at?: string | null
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  const diff = Math.max(0, Date.now() - then)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  const wk = Math.floor(day / 7)
  if (wk < 4) return `${wk}w ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo ago`
  const yr = Math.floor(day / 365)
  return `${yr}y ago`
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function nameFor(u: { first_name: string | null; last_name: string | null; email: string }): string {
  const n = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  return n || u.email
}

function initials(u: { first_name: string | null; last_name: string | null; email: string }): string {
  const n = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  if (!n) return u.email.slice(0, 2).toUpperCase()
  const parts = n.split(' ').filter(Boolean)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : n.slice(0, 2).toUpperCase()
}

// ── NAVIGATION MODEL ────────────────────────────────────────────────────────
// There used to be four sibling views — 'users' | 'campaigns' | 'leads' |
// 'recordings' — which meant a user's campaigns and a user's recordings were
// mutually exclusive SCREENS. Opening a person showed campaigns and nothing
// else; seeing their recordings meant going back to the user list and
// clicking a separate per-row button, which then replaced the whole screen
// again. Two halves of the same person's data, never visible from the same
// place, each reached by a different gesture.
//
// Now there is one 'user' view holding both as tabs, so opening a person is a
// single click and everything about them is one tab away. 'campaigns' and
// 'recordings' are no longer views at all — they're panels inside 'user'.
type View = 'users' | 'user' | 'leads'

/** Which panel of the user view is showing. */
type UserTab = 'campaigns' | 'recordings'

interface Recording {
  id: string
  user_id: string
  phone_number: string | null
  disposition: string | null
  amd_result: string | null
  recording_url: string | null
  recording_duration: number | null
  created_at: string
  campaigns: { name: string } | null
  leads: { first_name: string | null; last_name: string | null; phone: string | null; notes: string | null } | null
}

export default function ExplorerApp() {
  const [view, setView] = useState<View>('users')

  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [userSearch, setUserSearch] = useState('')

  const [userTab, setUserTab] = useState<UserTab>('campaigns')
  // Recordings load lazily on first visit to the tab, then stay cached for
  // this user — switching tabs back and forth shouldn't refetch.
  const [recordingsLoadedFor, setRecordingsLoadedFor] = useState<string | null>(null)

  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [campaignsError, setCampaignsError] = useState<string | null>(null)

  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [leadsError, setLeadsError] = useState<string | null>(null)
  const [leadSearch, setLeadSearch] = useState('')

  const [recordings, setRecordings] = useState<Recording[]>([])
  const [recordingsLoading, setRecordingsLoading] = useState(false)
  const [recordingsError, setRecordingsError] = useState<string | null>(null)
  const [recordingsCursor, setRecordingsCursor] = useState<number | null>(null)
  const [nowPlaying, setNowPlaying] = useState<string | null>(null)

  const [deleteCampaignTarget, setDeleteCampaignTarget] = useState<Campaign | null>(null)
  const [deleteCampaignTyped, setDeleteCampaignTyped] = useState('')
  const [deletingCampaign, setDeletingCampaign] = useState(false)

  const [deleteLeadTarget, setDeleteLeadTarget] = useState<Lead | null>(null)
  const [deletingLead, setDeletingLead] = useState(false)

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    setUsersLoading(true)
    setUsersError(null)
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load users')
      setUsers(data.users || [])
    } catch (e: any) {
      setUsersError(e.message || 'Failed to load users')
    } finally {
      setUsersLoading(false)
    }
  }

  async function openUser(u: AdminUser) {
    setSelectedUser(u)
    setSelectedCampaign(null)
    setView('user')
    setUserTab('campaigns')
    // Drop the previous user's recordings so their tab doesn't briefly show
    // someone else's audio while the new fetch is in flight.
    setRecordings([])
    setRecordingsCursor(null)
    setRecordingsLoadedFor(null)
    setCampaignsLoading(true)
    setCampaignsError(null)
    try {
      const res = await fetch(`/api/admin/user-data/campaigns?user_id=${encodeURIComponent(u.clerk_id)}`)
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load campaigns')
      setCampaigns(data.campaigns || [])
    } catch (e: any) {
      setCampaignsError(e.message || 'Failed to load campaigns')
    } finally {
      setCampaignsLoading(false)
    }
  }

  /**
   * Load (or page) a user's recordings. No longer navigates anywhere — it
   * fills the recordings panel of whichever user is already open.
   */
  async function loadRecordings(u: AdminUser, cursor = 0) {
    setRecordingsLoading(true)
    setRecordingsError(null)
    try {
      const res = await fetch(`/api/admin/recordings/list?user_id=${encodeURIComponent(u.clerk_id)}&cursor=${cursor}`)
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load recordings')
      setRecordings(prev => cursor === 0 ? (data.recordings || []) : [...prev, ...(data.recordings || [])])
      setRecordingsCursor(data.nextCursor)
      setRecordingsLoadedFor(u.clerk_id)
    } catch (e: any) {
      setRecordingsError(e.message || 'Failed to load recordings')
    } finally {
      setRecordingsLoading(false)
    }
  }

  /** Switch panels, fetching recordings the first time they're asked for. */
  function selectUserTab(tab: UserTab) {
    setUserTab(tab)
    if (tab === 'recordings' && selectedUser && recordingsLoadedFor !== selectedUser.clerk_id) {
      void loadRecordings(selectedUser, 0)
    }
  }

  async function openCampaign(c: Campaign) {
    setSelectedCampaign(c)
    setView('leads')
    setLeadSearch('')
    setLeadsLoading(true)
    setLeadsError(null)
    try {
      const res = await fetch(`/api/admin/user-data/leads?campaign_id=${encodeURIComponent(c.id)}`)
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load leads')
      setLeads(data.leads || [])
    } catch (e: any) {
      setLeadsError(e.message || 'Failed to load leads')
    } finally {
      setLeadsLoading(false)
    }
  }

  function backToUsers() {
    setView('users')
    setSelectedUser(null)
    setSelectedCampaign(null)
    setCampaigns([])
    setLeads([])
    setRecordings([])
    setRecordingsCursor(null)
    setRecordingsLoadedFor(null)
  }

  /** Back out of a campaign's leads to the user, landing on the tab they came from. */
  function backToUser() {
    setView('user')
    setSelectedCampaign(null)
    setLeads([])
  }

  async function confirmDeleteCampaign() {
    if (!deleteCampaignTarget || deleteCampaignTyped.trim().toLowerCase() !== 'delete') return
    setDeletingCampaign(true)
    try {
      const res = await fetch('/api/admin/user-data/campaigns/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: deleteCampaignTarget.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Delete failed')
      setCampaigns(prev => prev.filter(c => c.id !== deleteCampaignTarget.id))
      setDeleteCampaignTarget(null)
      setDeleteCampaignTyped('')
    } catch (e: any) {
      setCampaignsError(e.message || 'Delete failed')
    } finally {
      setDeletingCampaign(false)
    }
  }

  async function confirmDeleteLead() {
    if (!deleteLeadTarget) return
    setDeletingLead(true)
    try {
      const res = await fetch('/api/admin/user-data/leads/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: deleteLeadTarget.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Delete failed')
      setLeads(prev => prev.filter(l => l.id !== deleteLeadTarget.id))
      setDeleteLeadTarget(null)
    } catch (e: any) {
      setLeadsError(e.message || 'Delete failed')
    } finally {
      setDeletingLead(false)
    }
  }

  function exportCsv() {
    if (!selectedCampaign) return
    window.open(`/api/admin/user-data/leads/export?campaign_id=${encodeURIComponent(selectedCampaign.id)}`, '_blank')
  }

  const filteredUsers = users.filter(u => {
    if (!userSearch.trim()) return true
    const q = userSearch.trim().toLowerCase()
    return nameFor(u).toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  const filteredLeads = leads.filter(l => {
    if (!leadSearch.trim()) return true
    const q = leadSearch.trim().toLowerCase()
    return (
      `${l.first_name || ''} ${l.last_name || ''}`.toLowerCase().includes(q) ||
      (l.phone || '').includes(q) ||
      (l.email || '').toLowerCase().includes(q)
    )
  })

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: T.bg, fontFamily: FUTURA, overflow: 'hidden',
    }}>
      {/* ── BREADCRUMB HEADER ───────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        padding: '12px 16px', background: T.surface, borderBottom: `1px solid ${T.border}`,
        fontSize: 11, letterSpacing: 1, fontWeight: 'bold', flexShrink: 0,
      }}>
        <button onClick={backToUsers} style={crumbBtnStyle(view === 'users')}>
          ALL USERS
        </button>
        {selectedUser && (
          <>
            <span style={{ color: T.muted }}>›</span>
            <button onClick={backToUser} style={crumbBtnStyle(view === 'user')}>
              {nameFor(selectedUser).toUpperCase()}
            </button>
          </>
        )}
        {selectedCampaign && (
          <>
            <span style={{ color: T.muted }}>›</span>
            <span style={{ ...crumbBtnStyle(true), cursor: 'default' }}>
              {selectedCampaign.name.toUpperCase()}
            </span>
          </>
        )}

        {view === 'leads' && selectedCampaign && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={leadSearch}
              onChange={e => setLeadSearch(e.target.value)}
              placeholder="SEARCH NAME / PHONE / EMAIL"
              style={searchInputStyle}
            />
            <button onClick={exportCsv} style={toolbarBtnStyle}>
              ⬇ DOWNLOAD CSV
            </button>
          </div>
        )}
        {view === 'users' && (
          <div style={{ marginLeft: 'auto' }}>
            <input
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              placeholder="SEARCH NAME / EMAIL"
              style={searchInputStyle}
            />
          </div>
        )}
      </div>

      {/* ── USER TABS ────────────────────────────────────────────────────── */}
      {/* Campaigns and recordings side by side, so a person's data is one
          click apart instead of two navigations and a screen swap. Counts sit
          on the tabs so "does this user have recordings at all" is answerable
          without opening the panel. */}
      {view === 'user' && selectedUser && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '0 16px', background: T.surface,
          borderBottom: `1px solid ${T.border}`, flexShrink: 0,
        }}>
          {([
            { key: 'campaigns' as const, label: 'CAMPAIGNS', count: campaignsLoading ? null : campaigns.length },
            {
              key: 'recordings' as const,
              label: 'RECORDINGS',
              count: recordingsLoadedFor === selectedUser.clerk_id ? recordings.length : null,
            },
          ]).map(tab => {
            const active = userTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => selectUserTab(tab.key)}
                style={{
                  position: 'relative',
                  padding: '11px 16px 10px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: FUTURA,
                  fontSize: 11,
                  fontWeight: 'bold',
                  letterSpacing: 1.2,
                  color: active ? T.text : T.muted,
                  borderBottom: `2px solid ${active ? T.accent : 'transparent'}`,
                  transition: 'color 0.15s ease, border-color 0.15s ease',
                }}
              >
                {tab.label}
                {tab.count !== null && (
                  <span style={{
                    marginLeft: 7,
                    padding: '1px 6px',
                    borderRadius: 9,
                    fontSize: 9.5,
                    background: active ? T.accent : 'transparent',
                    color: active ? '#fff' : T.muted,
                    border: `1px solid ${active ? T.accent : T.border}`,
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>

        {view === 'users' && (
          usersLoading ? (
            <div style={emptyStyle}>LOADING USERS…</div>
          ) : usersError ? (
            <div style={{ ...emptyStyle, color: T.red }}>{usersError}</div>
          ) : filteredUsers.length === 0 ? (
            <div style={emptyStyle}>NO USERS MATCH “{userSearch}”</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['', 'NAME', 'EMAIL', 'LEADS', 'RECORDINGS', 'TEAM', 'SUBSCRIPTION', 'JOINED', ''].map((h, i) => (
                    <th key={i} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr
                    key={u.clerk_id}
                    onClick={() => openUser(u)}
                    style={{ cursor: 'pointer', borderBottom: `1px solid ${T.border}` }}
                    className="dx-row"
                  >
                    <td style={{ ...tdStyle, width: 36 }}>
                      <div style={avatarStyle}>{initials(u)}</div>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 'bold' }}>{nameFor(u)}</td>
                    <td style={{ ...tdStyle, color: T.muted }}>{u.email}</td>
                    <td style={tdStyle}>{u.lead_count.toLocaleString()}</td>
                    <td style={tdStyle}>
                      {u.recording_count > 0
                        ? u.recording_count.toLocaleString()
                        : <span style={{ color: T.muted }}>—</span>}
                    </td>
                    <td style={tdStyle}>
                      {(() => {
                        const seats = u.seats || []
                        if (seats.length === 0) return <span style={{ color: T.muted }}>—</span>
                        const first = seats[0]
                        return (
                          <div style={{ lineHeight: 1.35 }}>
                            <div>
                              {first.team_name}
                              {seats.length > 1 && (
                                <span style={{ color: T.muted }}> +{seats.length - 1}</span>
                              )}
                            </div>
                            <div style={{ fontSize: 9, color: T.muted, letterSpacing: '0.06em' }}>
                              {first.joined_via_code
                                ? `VIA ${first.joined_via_code}`
                                : 'ADDED DIRECTLY'}
                              {first.payer === 'owner'
                                ? ' · OWNER PAYS'
                                : first.payer === 'agent'
                                ? ' · SELF PAYS'
                                : ''}
                            </div>
                          </div>
                        )
                      })()}
                    </td>
                    <td style={tdStyle}>
                      {(() => {
                        // Three states, not two. A suspended owner-paid seat is
                        // its own case: the owner stopped covering them, so they
                        // are locked out and the reason is not "never paid".
                        const suspended = (u.seats || []).some(sm => sm.payer === 'owner' && sm.suspended)
                        if (u.is_active_subscription) {
                          return (
                            <span style={{ ...badgeStyle, color: T.green, borderColor: T.green }}>
                              ● ACTIVE
                            </span>
                          )
                        }
                        if (u.owner_funded_seat) {
                          return (
                            <span style={{ ...badgeStyle, color: '#4a9eff', borderColor: '#4a9eff' }}>
                              ● SEAT · OWNER PAID
                            </span>
                          )
                        }
                        if (suspended) {
                          return (
                            <span style={{ ...badgeStyle, color: '#ffaa3e', borderColor: '#ffaa3e' }}>
                              ○ SEAT SUSPENDED
                            </span>
                          )
                        }
                        return (
                          <span style={{ ...badgeStyle, color: T.muted, borderColor: T.border }}>
                            ○ INACTIVE
                          </span>
                        )
                      })()}
                    </td>
                    <td style={{ ...tdStyle, color: T.muted }}>{fmtDate(u.created_at)}</td>
                    {/* The separate "▶ RECORDINGS" button that used to live
                        here is gone. It was a second, competing way into the
                        same person — and the only way to reach their
                        recordings at all. Recordings are now a tab inside the
                        user view, so the row has exactly one meaning: open
                        this user. */}
                    <td style={{ ...tdStyle, color: T.muted }}>OPEN ›</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {view === 'user' && userTab === 'campaigns' && (
          campaignsLoading ? (
            <div style={emptyStyle}>LOADING CAMPAIGNS…</div>
          ) : campaignsError ? (
            <div style={{ ...emptyStyle, color: T.red }}>{campaignsError}</div>
          ) : campaigns.length === 0 ? (
            <div style={emptyStyle}>THIS USER HAS NO CAMPAIGNS.</div>
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14,
            }}>
              {campaigns.map(c => {
                const isActive = c.status === 'active'
                return (
                  <div key={c.id} className="dx-card" onClick={() => openCampaign(c)}>
                    <div className="dx-card-preview">
                      <span className="dx-card-pin" style={{ color: isActive ? T.green : T.muted }}>
                        {isActive ? '● ACTIVE' : '○ INACTIVE'}
                      </span>
                      {(c.enable_appointments_sub || c.enable_not_interested_sub) && (
                        <div className="dx-card-sub-pins">
                          {c.enable_appointments_sub && <span className="dx-card-sub-pin">+ CALL BACKS</span>}
                          {c.enable_not_interested_sub && <span className="dx-card-sub-pin">+ NOT INT</span>}
                        </div>
                      )}
                      <LeadPreviewThumb leads={c.preview_leads} />
                    </div>
                    <div className="dx-card-footer">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 className="dx-card-name">{c.name}</h3>
                        <div className="dx-card-sub">
                          <span>{(c.dialer_mode || '').toUpperCase()}</span>
                          <span className="dot">·</span>
                          <span>{c.called_leads}/{c.total_leads} DIALED</span>
                          <span className="dot">·</span>
                          <span>MADE {relativeTime(c.created_at)}</span>
                        </div>
                      </div>
                      <button
                        title="Delete campaign"
                        className="dx-card-delete"
                        onClick={e => { e.stopPropagation(); setDeleteCampaignTarget(c); setDeleteCampaignTyped('') }}
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {view === 'leads' && (
          leadsLoading ? (
            <div style={emptyStyle}>LOADING LEADS…</div>
          ) : leadsError ? (
            <div style={{ ...emptyStyle, color: T.red }}>{leadsError}</div>
          ) : filteredLeads.length === 0 ? (
            <div style={emptyStyle}>{leads.length === 0 ? 'THIS CAMPAIGN HAS NO LEADS.' : `NO LEADS MATCH “${leadSearch}”`}</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr>
                  {['#', 'NAME', 'PHONE', 'EMAIL', 'CITY / STATE', 'DISPOSITION', 'ATTEMPTS', 'LAST CALLED', 'CONSENT', 'NOTES', ''].map((h, i) => (
                    <th key={i} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((l, i) => (
                  <tr key={l.id} style={{ borderBottom: `1px solid ${T.border}` }} className="dx-row">
                    <td style={{ ...tdStyle, color: T.muted }}>{i + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 'bold' }}>
                      {[l.first_name, l.last_name].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td style={tdStyle}>{l.phone || '—'}</td>
                    <td style={{ ...tdStyle, color: T.muted }}>{l.email || '—'}</td>
                    <td style={{ ...tdStyle, color: T.muted }}>
                      {[l.city, l.state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td style={tdStyle}>
                      {l.disposition ? (
                        <span style={badgeStyle}>{l.disposition.toUpperCase()}</span>
                      ) : (
                        <span style={{ color: T.muted }}>—</span>
                      )}
                    </td>
                    <td style={tdStyle}>{l.dial_attempts ?? 0}</td>
                    <td style={{ ...tdStyle, color: T.muted }}>{relativeTime(l.last_called_at)}</td>
                    <td style={tdStyle} title={l.consent_source || ''}>
                      {l.consent_date ? (
                        <span style={{ color: T.green }}>✓ {fmtDate(l.consent_date)}</span>
                      ) : (
                        <span style={{ color: T.amber }}>— NONE</span>
                      )}
                    </td>
                    <td
                      style={{ ...tdStyle, color: T.muted, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={l.notes || ''}
                    >
                      {l.notes || '—'}
                    </td>
                    <td style={tdStyle}>
                      <button
                        title="Delete lead"
                        className="dx-card-delete"
                        onClick={() => setDeleteLeadTarget(l)}
                      >
                        DELETE
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {view === 'user' && userTab === 'recordings' && (
          recordingsLoading && recordings.length === 0 ? (
            <div style={emptyStyle}>LOADING RECORDINGS…</div>
          ) : recordingsError ? (
            <div style={{ ...emptyStyle, color: T.red }}>{recordingsError}</div>
          ) : recordings.length === 0 ? (
            <div style={emptyStyle}>NO RECORDINGS FOUND FOR THIS USER.</div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <thead>
                  <tr>
                    {['DATE', 'CAMPAIGN', 'LEAD', 'PHONE', 'DISPOSITION', 'ANSWERED BY', 'DURATION', 'PLAY', ''].map((h, i) => (
                      <th key={i} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recordings.map((r) => {
                    const leadName = r.leads ? [r.leads.first_name, r.leads.last_name].filter(Boolean).join(' ') : ''
                    const mins = Math.floor((r.recording_duration || 0) / 60)
                    const secs = (r.recording_duration || 0) % 60
                    return (
                      <tr key={r.id} style={{ borderBottom: `1px solid ${T.border}` }} className="dx-row">
                        <td style={{ ...tdStyle, color: T.muted }}>{fmtDate(r.created_at)}</td>
                        <td style={tdStyle}>{r.campaigns?.name || '—'}</td>
                        <td style={{ ...tdStyle, fontWeight: 'bold' }}>{leadName || '—'}</td>
                        <td style={{ ...tdStyle, color: T.muted }}>{r.phone_number || '—'}</td>
                        <td style={tdStyle}>
                          {r.disposition ? <span style={badgeStyle}>{r.disposition.toUpperCase()}</span> : <span style={{ color: T.muted }}>—</span>}
                        </td>
                        <td style={{ ...tdStyle, color: T.muted }}>
                          {r.amd_result === 'human' ? <span style={{ color: T.green }}>PERSON</span>
                            : r.amd_result === 'machine_start' || r.amd_result === 'machine_end_beep' ? 'MACHINE'
                            : r.amd_result === 'unknown' ? 'UNCLEAR'
                            : '—'}
                        </td>
                        <td style={{ ...tdStyle, color: T.muted }}>{mins}:{secs.toString().padStart(2, '0')}</td>
                        <td style={{ ...tdStyle, minWidth: 220 }}>
                          {nowPlaying === r.id ? (
                            <audio
                              controls
                              autoPlay
                              src={`/api/admin/user-data/recordings/play?call_id=${r.id}`}
                              style={{ height: 28, width: 200 }}
                              onEnded={() => setNowPlaying(null)}
                            />
                          ) : (
                            <button style={{ ...crumbBtnStyle(false), fontSize: 10 }} onClick={() => setNowPlaying(r.id)}>
                              ▶ PLAY
                            </button>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <a
                            href={`/api/admin/user-data/recordings/play?call_id=${r.id}&download=1`}
                            style={{ ...crumbBtnStyle(false), fontSize: 10, textDecoration: 'none', display: 'inline-block' }}
                          >
                            ⬇ DOWNLOAD
                          </a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {recordingsCursor !== null && (
                <div style={{ padding: 16, textAlign: 'center' }}>
                  <button
                    onClick={() => selectedUser && loadRecordings(selectedUser, recordingsCursor)}
                    disabled={recordingsLoading}
                    style={crumbBtnStyle(false)}
                  >
                    {recordingsLoading ? 'LOADING…' : 'LOAD MORE'}
                  </button>
                </div>
              )}
            </>
          )
        )}
      </div>

      {/* ── DELETE CAMPAIGN CONFIRM ─────────────────────────────────────── */}
      {deleteCampaignTarget && (
        <div style={overlayStyle} onClick={() => !deletingCampaign && setDeleteCampaignTarget(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={modalTitleStyle}>DELETE CAMPAIGN</div>
            <p style={modalBodyTextStyle}>
              This permanently deletes <strong>{deleteCampaignTarget.name}</strong> and all{' '}
              <strong>{deleteCampaignTarget.total_leads.toLocaleString()}</strong> lead{deleteCampaignTarget.total_leads === 1 ? '' : 's'} in it,
              on {selectedUser ? nameFor(selectedUser) : 'this user'}&apos;s behalf. This cannot be undone.
            </p>
            <div style={{ fontSize: 10, letterSpacing: 1, color: T.muted, marginBottom: 6 }}>
              TYPE &quot;DELETE&quot; TO CONFIRM
            </div>
            <input
              value={deleteCampaignTyped}
              onChange={e => setDeleteCampaignTyped(e.target.value)}
              autoFocus
              style={{ ...searchInputStyle, width: '100%', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                style={modalCancelBtnStyle}
                onClick={() => setDeleteCampaignTarget(null)}
                disabled={deletingCampaign}
              >CANCEL</button>
              <button
                style={{
                  ...modalConfirmBtnStyle,
                  opacity: deleteCampaignTyped.trim().toLowerCase() !== 'delete' || deletingCampaign ? 0.4 : 1,
                  cursor: deleteCampaignTyped.trim().toLowerCase() !== 'delete' || deletingCampaign ? 'not-allowed' : 'pointer',
                }}
                onClick={confirmDeleteCampaign}
                disabled={deleteCampaignTyped.trim().toLowerCase() !== 'delete' || deletingCampaign}
              >{deletingCampaign ? 'DELETING…' : 'DELETE PERMANENTLY'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE LEAD CONFIRM ──────────────────────────────────────────── */}
      {deleteLeadTarget && (
        <div style={overlayStyle} onClick={() => !deletingLead && setDeleteLeadTarget(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={modalTitleStyle}>DELETE LEAD</div>
            <p style={modalBodyTextStyle}>
              Permanently delete{' '}
              <strong>{[deleteLeadTarget.first_name, deleteLeadTarget.last_name].filter(Boolean).join(' ') || deleteLeadTarget.phone}</strong>{' '}
              from this campaign? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button style={modalCancelBtnStyle} onClick={() => setDeleteLeadTarget(null)} disabled={deletingLead}>
                CANCEL
              </button>
              <button style={modalConfirmBtnStyle} onClick={confirmDeleteLead} disabled={deletingLead}>
                {deletingLead ? 'DELETING…' : 'DELETE PERMANENTLY'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .dx-row:hover { background: rgba(74,158,255,0.06); }

        .dx-card {
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-top: 3px solid ${T.blue};
          border-radius: 4px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          transition: border-color 0.12s;
          position: relative;
        }
        .dx-card:hover { border-color: ${T.muted}; border-top-color: ${T.blue}; }

        .dx-card-preview {
          height: 130px;
          padding: 8px;
          background: ${T.bg};
          border-bottom: 1px solid ${T.border};
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .dx-card-pin {
          position: absolute;
          top: 10px; left: 10px;
          z-index: 2;
          font-size: 8px;
          letter-spacing: 2px;
          font-weight: bold;
          padding: 3px 8px;
          border-radius: 2px;
          background: ${T.surface};
          border: 1px solid ${T.border};
        }
        .dx-card-sub-pins {
          position: absolute;
          top: 10px; right: 10px;
          z-index: 2;
          display: flex;
          flex-direction: column;
          gap: 3px;
          align-items: flex-end;
        }
        .dx-card-sub-pin {
          font-size: 7px;
          letter-spacing: 1.5px;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 2px;
          background: rgba(74,158,255,0.12);
          border: 1px solid ${T.blue};
          color: ${T.blue};
        }
        .dx-card-footer {
          padding: 10px 12px;
          background: ${T.surface};
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .dx-card-name {
          font-size: 12.5px;
          font-weight: bold;
          color: ${T.text};
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: 0.5px;
        }
        .dx-card-sub {
          font-size: 9.5px;
          color: ${T.muted};
          margin: 3px 0 0;
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          font-family: monospace;
        }
        .dx-card-sub .dot { opacity: 0.5; }
        .dx-card-delete {
          flex-shrink: 0;
          font-size: 9px;
          letter-spacing: 1px;
          font-weight: bold;
          padding: 4px 8px;
          border-radius: 3px;
          border: 1px solid ${T.red};
          color: ${T.red};
          background: transparent;
          cursor: pointer;
        }
        .dx-card-delete:hover { background: rgba(138,26,26,0.1); }
      `}</style>
    </div>
  )
}

function LeadPreviewThumb({ leads }: { leads: PreviewLead[] }) {
  if (!leads || leads.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: T.muted, fontSize: 9, letterSpacing: 2, fontWeight: 'bold',
        background: 'white', borderRadius: 4, border: `1px solid ${T.border}`,
      }}>
        NO LEADS
      </div>
    )
  }
  return (
    <div style={{
      flex: 1, overflow: 'hidden', background: 'white', borderRadius: 4,
      border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8.5 }}>
        <tbody>
          {leads.slice(0, 6).map(l => (
            <tr key={l.id} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '2px 6px', color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {[l.first_name, l.last_name].filter(Boolean).join(' ') || '—'}
              </td>
              <td style={{ padding: '2px 6px', color: '#666', whiteSpace: 'nowrap' }}>{l.phone}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function crumbBtnStyle(active: boolean): React.CSSProperties {
  return {
    background: 'transparent',
    border: 'none',
    color: active ? T.blue : T.muted,
    cursor: 'pointer',
    fontFamily: FUTURA,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    padding: 0,
  }
}

const searchInputStyle: React.CSSProperties = {
  background: T.bg,
  border: `1px solid ${T.border}`,
  borderRadius: 3,
  color: T.text,
  fontFamily: FUTURA,
  fontSize: 11,
  padding: '6px 10px',
  width: 220,
}

const toolbarBtnStyle: React.CSSProperties = {
  background: T.blue,
  border: 'none',
  borderRadius: 3,
  color: 'white',
  cursor: 'pointer',
  fontFamily: FUTURA,
  fontSize: 10,
  fontWeight: 'bold',
  letterSpacing: 1,
  padding: '7px 12px',
}

const emptyStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  height: 200, color: T.muted, fontSize: 12, letterSpacing: 1, fontWeight: 'bold',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  fontSize: 9.5,
  letterSpacing: 1,
  color: T.muted,
  borderBottom: `2px solid ${T.border}`,
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  color: T.text,
  verticalAlign: 'middle',
}

const avatarStyle: React.CSSProperties = {
  width: 22, height: 22, borderRadius: '50%',
  background: T.blue, color: 'white',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 8.5, fontWeight: 'bold',
}

const badgeStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: 1,
  fontWeight: 'bold',
  padding: '3px 7px',
  borderRadius: 2,
  border: `1px solid ${T.border}`,
  whiteSpace: 'nowrap',
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
}

const modalStyle: React.CSSProperties = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 6,
  padding: 20,
  width: 380,
  maxWidth: '90vw',
  fontFamily: FUTURA,
}

const modalTitleStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 'bold', letterSpacing: 1, color: T.red, marginBottom: 10,
}

const modalBodyTextStyle: React.CSSProperties = {
  fontSize: 12, color: T.text, lineHeight: 1.5, marginBottom: 14,
}

const modalCancelBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${T.border}`,
  borderRadius: 3,
  color: T.text,
  cursor: 'pointer',
  fontFamily: FUTURA,
  fontSize: 11,
  fontWeight: 'bold',
  letterSpacing: 1,
  padding: '8px 14px',
}

const modalConfirmBtnStyle: React.CSSProperties = {
  background: T.red,
  border: 'none',
  borderRadius: 3,
  color: 'white',
  cursor: 'pointer',
  fontFamily: FUTURA,
  fontSize: 11,
  fontWeight: 'bold',
  letterSpacing: 1,
  padding: '8px 14px',
  opacity: 1,
}
