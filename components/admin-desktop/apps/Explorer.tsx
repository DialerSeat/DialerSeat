'use client'
import { useEffect, useMemo, useRef, useState } from 'react'

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
  team_member_count: number
  is_active_subscription: boolean
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

interface Recording {
  id: string
  campaign_id: string | null
  lead_id: string | null
  phone_number: string | null
  duration: number | null
  disposition: string | null
  recording_url: string | null
  recording_status: string | null
  recording_duration: number | null
  recording_expires_at: string | null
  created_at: string | null
  amd_result: string | null
  leads: { first_name: string | null; last_name: string | null; phone: string } | null
  campaigns: { name: string } | null
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

function fmtDuration(seconds: number | null | undefined): string {
  const s = seconds ?? 0
  if (s <= 0) return '0:00'
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}:${String(rem).padStart(2, '0')}`
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

type Tab = 'users' | 'campaigns' | 'leads' | 'recordings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'users', label: 'USERS' },
  { id: 'campaigns', label: 'CAMPAIGNS' },
  { id: 'leads', label: 'LEADS' },
  { id: 'recordings', label: 'RECORDINGS' },
]

// Sort options per tab. Each maps to a getter so the sort function stays
// generic — "context clues" from the underlying data: dial counts for
// leads/campaigns, created_at for recency, call duration for recordings.
type SortDir = 'asc' | 'desc'
interface SortOption { key: string; label: string; dir: SortDir }

const LEAD_SORTS: SortOption[] = [
  { key: 'attempts_desc', label: 'MOST TIME DIALED', dir: 'desc' },
  { key: 'attempts_asc', label: 'LEAST TIME DIALED', dir: 'asc' },
  { key: 'created_desc', label: 'NEWEST ADDED', dir: 'desc' },
  { key: 'created_asc', label: 'OLDEST ADDED', dir: 'asc' },
  { key: 'lastcalled_desc', label: 'RECENTLY CALLED', dir: 'desc' },
  { key: 'lastcalled_asc', label: 'LEAST RECENTLY CALLED', dir: 'asc' },
]

const CAMPAIGN_SORTS: SortOption[] = [
  { key: 'called_desc', label: 'MOST DIALED', dir: 'desc' },
  { key: 'called_asc', label: 'LEAST DIALED', dir: 'asc' },
  { key: 'created_desc', label: 'NEWEST ADDED', dir: 'desc' },
  { key: 'created_asc', label: 'OLDEST ADDED', dir: 'asc' },
]

const RECORDING_SORTS: SortOption[] = [
  { key: 'duration_desc', label: 'LONGEST CALLS', dir: 'desc' },
  { key: 'duration_asc', label: 'SHORTEST CALLS', dir: 'asc' },
  { key: 'created_desc', label: 'NEWEST FIRST', dir: 'desc' },
  { key: 'created_asc', label: 'OLDEST FIRST', dir: 'asc' },
]

const USER_SORTS: SortOption[] = [
  { key: 'created_desc', label: 'NEWEST JOINED', dir: 'desc' },
  { key: 'created_asc', label: 'OLDEST JOINED', dir: 'asc' },
  { key: 'leads_desc', label: 'MOST LEADS', dir: 'desc' },
  { key: 'leads_asc', label: 'FEWEST LEADS', dir: 'asc' },
]

// One entry in the back/forward history stack. Recreating exactly what was
// visible (tab + which user/campaign were selected) is enough to restore a
// prior screen without re-deriving it from a URL or drill-down chain.
interface NavState {
  tab: Tab
  userId: string | null
  campaignId: string | null
}

export default function ExplorerApp() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const [userSort, setUserSort] = useState<string>('created_desc')

  const [campaignsByUser, setCampaignsByUser] = useState<Record<string, Campaign[]>>({})
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [campaignsError, setCampaignsError] = useState<string | null>(null)
  const [campaignSort, setCampaignSort] = useState<string>('created_desc')

  const [leadsByCampaign, setLeadsByCampaign] = useState<Record<string, Lead[]>>({})
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [leadsError, setLeadsError] = useState<string | null>(null)
  const [leadSearch, setLeadSearch] = useState('')
  const [leadSort, setLeadSort] = useState<string>('created_desc')

  const [recordingsByUser, setRecordingsByUser] = useState<Record<string, Recording[]>>({})
  const [recordingsLoading, setRecordingsLoading] = useState(false)
  const [recordingsError, setRecordingsError] = useState<string | null>(null)
  const [recordingSearch, setRecordingSearch] = useState('')
  const [recordingSort, setRecordingSort] = useState<string>('created_desc')
  const [nowPlayingId, setNowPlayingId] = useState<string | null>(null)

  const [deleteCampaignTarget, setDeleteCampaignTarget] = useState<Campaign | null>(null)
  const [deleteCampaignTyped, setDeleteCampaignTyped] = useState('')
  const [deletingCampaign, setDeletingCampaign] = useState(false)

  const [deleteLeadTarget, setDeleteLeadTarget] = useState<Lead | null>(null)
  const [deletingLead, setDeletingLead] = useState(false)

  // ── NAVIGATION: back/forward history stack, replacing the old drill-down ──
  const [history, setHistory] = useState<NavState[]>([{ tab: 'users', userId: null, campaignId: null }])
  const [historyIndex, setHistoryIndex] = useState(0)
  const current = history[historyIndex]
  const tab = current.tab
  const selectedUserId = current.userId
  const selectedCampaignId = current.campaignId

  const selectedUser = users.find(u => u.clerk_id === selectedUserId) || null
  const campaigns = selectedUserId ? (campaignsByUser[selectedUserId] || []) : []
  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId) || null
  const leads = selectedCampaignId ? (leadsByCampaign[selectedCampaignId] || []) : []
  const recordings = selectedUserId ? (recordingsByUser[selectedUserId] || []) : []

  const canGoBack = historyIndex > 0
  const canGoForward = historyIndex < history.length - 1

  // Pushes a new nav state, truncating any forward history — the standard
  // browser-history convention (navigating after going back discards "redo").
  function navigate(next: Partial<NavState>) {
    const merged: NavState = { ...current, ...next }
    setHistory(prev => [...prev.slice(0, historyIndex + 1), merged])
    setHistoryIndex(i => i + 1)
  }

  function goBack() {
    if (canGoBack) setHistoryIndex(i => i - 1)
  }
  function goForward() {
    if (canGoForward) setHistoryIndex(i => i + 1)
  }

  function switchTab(t: Tab) {
    if (t === tab) return
    navigate({ tab: t })
  }

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

  async function loadCampaigns(userId: string) {
    if (campaignsByUser[userId]) return
    setCampaignsLoading(true)
    setCampaignsError(null)
    try {
      const res = await fetch(`/api/admin/user-data/campaigns?user_id=${encodeURIComponent(userId)}`)
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load campaigns')
      setCampaignsByUser(prev => ({ ...prev, [userId]: data.campaigns || [] }))
    } catch (e: any) {
      setCampaignsError(e.message || 'Failed to load campaigns')
    } finally {
      setCampaignsLoading(false)
    }
  }

  async function loadLeads(campaignId: string) {
    if (leadsByCampaign[campaignId]) return
    setLeadsLoading(true)
    setLeadsError(null)
    try {
      const res = await fetch(`/api/admin/user-data/leads?campaign_id=${encodeURIComponent(campaignId)}`)
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load leads')
      setLeadsByCampaign(prev => ({ ...prev, [campaignId]: data.leads || [] }))
    } catch (e: any) {
      setLeadsError(e.message || 'Failed to load leads')
    } finally {
      setLeadsLoading(false)
    }
  }

  async function loadRecordings(userId: string) {
    if (recordingsByUser[userId]) return
    setRecordingsLoading(true)
    setRecordingsError(null)
    try {
      const res = await fetch(`/api/admin/user-data/recordings?user_id=${encodeURIComponent(userId)}`)
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load recordings')
      setRecordingsByUser(prev => ({ ...prev, [userId]: data.recordings || [] }))
    } catch (e: any) {
      setRecordingsError(e.message || 'Failed to load recordings')
    } finally {
      setRecordingsLoading(false)
    }
  }

  // Fetch whatever the current tab/selection needs, whenever navigation
  // changes (tab switch, back/forward, or picking a different user/campaign).
  useEffect(() => {
    if (tab === 'campaigns' && selectedUserId) loadCampaigns(selectedUserId)
    if (tab === 'leads' && selectedCampaignId) loadLeads(selectedCampaignId)
    if (tab === 'recordings' && selectedUserId) loadRecordings(selectedUserId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedUserId, selectedCampaignId])

  function openUserCampaigns(u: AdminUser) {
    navigate({ tab: 'campaigns', userId: u.clerk_id, campaignId: null })
  }

  function openCampaignLeads(c: Campaign) {
    navigate({ tab: 'leads', campaignId: c.id })
  }

  function pickUserFor(t: Tab, userId: string) {
    navigate({ tab: t, userId, campaignId: null })
  }

  function pickCampaignFor(campaignId: string) {
    navigate({ tab: 'leads', campaignId })
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
      if (selectedUserId) {
        setCampaignsByUser(prev => ({
          ...prev,
          [selectedUserId]: (prev[selectedUserId] || []).filter(c => c.id !== deleteCampaignTarget.id),
        }))
      }
      setDeleteCampaignTarget(null)
      setDeleteCampaignTyped('')
    } catch (e: any) {
      setCampaignsError(e.message || 'Delete failed')
    } finally {
      setDeletingCampaign(false)
    }
  }

  async function confirmDeleteLead() {
    if (!deleteLeadTarget || !selectedCampaignId) return
    setDeletingLead(true)
    try {
      const res = await fetch('/api/admin/user-data/leads/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: deleteLeadTarget.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Delete failed')
      setLeadsByCampaign(prev => ({
        ...prev,
        [selectedCampaignId]: (prev[selectedCampaignId] || []).filter(l => l.id !== deleteLeadTarget.id),
      }))
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

  function playRecording(id: string) {
    setNowPlayingId(id)
  }

  const audioRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    if (nowPlayingId && audioRef.current) {
      audioRef.current.load()
      audioRef.current.play().catch(() => {})
    }
  }, [nowPlayingId])

  const filteredUsers = useMemo(() => {
    let rows = users.filter(u => {
      if (!userSearch.trim()) return true
      const q = userSearch.trim().toLowerCase()
      return nameFor(u).toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    })
    rows = [...rows].sort((a, b) => {
      switch (userSort) {
        case 'created_asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'leads_desc': return b.lead_count - a.lead_count
        case 'leads_asc': return a.lead_count - b.lead_count
        case 'created_desc':
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })
    return rows
  }, [users, userSearch, userSort])

  const sortedCampaigns = useMemo(() => {
    const rows = [...campaigns]
    rows.sort((a, b) => {
      switch (campaignSort) {
        case 'called_desc': return b.called_leads - a.called_leads
        case 'called_asc': return a.called_leads - b.called_leads
        case 'created_asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'created_desc':
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })
    return rows
  }, [campaigns, campaignSort])

  const filteredLeads = useMemo(() => {
    let rows = leads.filter(l => {
      if (!leadSearch.trim()) return true
      const q = leadSearch.trim().toLowerCase()
      return (
        `${l.first_name || ''} ${l.last_name || ''}`.toLowerCase().includes(q) ||
        (l.phone || '').includes(q) ||
        (l.email || '').toLowerCase().includes(q)
      )
    })
    rows = [...rows].sort((a, b) => {
      const aAttempts = a.dial_attempts ?? 0
      const bAttempts = b.dial_attempts ?? 0
      const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0
      const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0
      const aCalled = a.last_called_at ? new Date(a.last_called_at).getTime() : 0
      const bCalled = b.last_called_at ? new Date(b.last_called_at).getTime() : 0
      switch (leadSort) {
        case 'attempts_desc': return bAttempts - aAttempts
        case 'attempts_asc': return aAttempts - bAttempts
        case 'created_asc': return aCreated - bCreated
        case 'lastcalled_desc': return bCalled - aCalled
        case 'lastcalled_asc': return aCalled - bCalled
        case 'created_desc':
        default: return bCreated - aCreated
      }
    })
    return rows
  }, [leads, leadSearch, leadSort])

  const filteredRecordings = useMemo(() => {
    let rows = recordings.filter(r => {
      if (!recordingSearch.trim()) return true
      const q = recordingSearch.trim().toLowerCase()
      const lead = r.leads
      const name = lead ? `${lead.first_name || ''} ${lead.last_name || ''}` : ''
      return (
        name.toLowerCase().includes(q) ||
        (r.phone_number || '').includes(q) ||
        (r.campaigns?.name || '').toLowerCase().includes(q)
      )
    })
    rows = [...rows].sort((a, b) => {
      const aDur = a.recording_duration ?? a.duration ?? 0
      const bDur = b.recording_duration ?? b.duration ?? 0
      const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0
      const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0
      switch (recordingSort) {
        case 'duration_desc': return bDur - aDur
        case 'duration_asc': return aDur - bDur
        case 'created_asc': return aCreated - bCreated
        case 'created_desc':
        default: return bCreated - aCreated
      }
    })
    return rows
  }, [recordings, recordingSearch, recordingSort])

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: T.bg, fontFamily: FUTURA, overflow: 'hidden',
    }}>
      {/* ── TOP BAR: back/forward + tabs ─────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px', background: T.surface, borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={goBack} disabled={!canGoBack} style={navArrowStyle(canGoBack)} title="Back">
            ‹
          </button>
          <button onClick={goForward} disabled={!canGoForward} style={navArrowStyle(canGoForward)} title="Forward">
            ›
          </button>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => switchTab(t.id)} style={tabBtnStyle(tab === t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {tab === 'users' && (
            <>
              <select value={userSort} onChange={e => setUserSort(e.target.value)} style={sortSelectStyle}>
                {USER_SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="SEARCH NAME / EMAIL"
                style={searchInputStyle}
              />
            </>
          )}

          {tab === 'campaigns' && (
            <>
              <select
                value={selectedUserId || ''}
                onChange={e => pickUserFor('campaigns', e.target.value)}
                style={pickerSelectStyle}
              >
                <option value="" disabled>SELECT A USER…</option>
                {users.map(u => (
                  <option key={u.clerk_id} value={u.clerk_id}>{nameFor(u)}</option>
                ))}
              </select>
              {selectedUserId && (
                <select value={campaignSort} onChange={e => setCampaignSort(e.target.value)} style={sortSelectStyle}>
                  {CAMPAIGN_SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              )}
            </>
          )}

          {tab === 'leads' && (
            <>
              <select
                value={selectedCampaignId || ''}
                onChange={e => pickCampaignFor(e.target.value)}
                style={pickerSelectStyle}
              >
                <option value="" disabled>SELECT A CAMPAIGN…</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {selectedCampaignId && (
                <>
                  <select value={leadSort} onChange={e => setLeadSort(e.target.value)} style={sortSelectStyle}>
                    {LEAD_SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <input
                    value={leadSearch}
                    onChange={e => setLeadSearch(e.target.value)}
                    placeholder="SEARCH NAME / PHONE / EMAIL"
                    style={searchInputStyle}
                  />
                  <button onClick={exportCsv} style={toolbarBtnStyle}>⬇ DOWNLOAD CSV</button>
                </>
              )}
            </>
          )}

          {tab === 'recordings' && (
            <>
              <select
                value={selectedUserId || ''}
                onChange={e => pickUserFor('recordings', e.target.value)}
                style={pickerSelectStyle}
              >
                <option value="" disabled>SELECT A USER…</option>
                {users.map(u => (
                  <option key={u.clerk_id} value={u.clerk_id}>{nameFor(u)}</option>
                ))}
              </select>
              {selectedUserId && (
                <>
                  <select value={recordingSort} onChange={e => setRecordingSort(e.target.value)} style={sortSelectStyle}>
                    {RECORDING_SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <input
                    value={recordingSearch}
                    onChange={e => setRecordingSearch(e.target.value)}
                    placeholder="SEARCH NAME / PHONE / CAMPAIGN"
                    style={searchInputStyle}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── CONTEXT STRIP: shows current user/campaign selection as breadcrumb-style info, not navigation ── */}
      {(selectedUser || selectedCampaign) && tab !== 'users' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px',
          background: T.bg, borderBottom: `1px solid ${T.border}`, fontSize: 10.5,
          color: T.muted, letterSpacing: 0.5, flexShrink: 0,
        }}>
          {selectedUser && <span><strong style={{ color: T.text }}>{nameFor(selectedUser)}</strong></span>}
          {selectedCampaign && tab === 'leads' && (
            <>
              <span style={{ opacity: 0.5 }}>›</span>
              <span><strong style={{ color: T.text }}>{selectedCampaign.name}</strong></span>
            </>
          )}
        </div>
      )}

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <div className="dx-scroll" style={{ flex: 1, overflow: 'auto', padding: 16 }}>

        {tab === 'users' && (
          usersLoading ? (
            <div style={emptyStyle}>LOADING USERS…</div>
          ) : usersError ? (
            <div style={{ ...emptyStyle, color: T.red }}>{usersError}</div>
          ) : filteredUsers.length === 0 ? (
            <div style={emptyStyle}>NO USERS MATCH "{userSearch}"</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['', 'NAME', 'EMAIL', 'LEADS', 'TEAM', 'SUBSCRIPTION', 'JOINED', ''].map((h, i) => (
                    <th key={i} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr
                    key={u.clerk_id}
                    onClick={() => openUserCampaigns(u)}
                    style={{ cursor: 'pointer', borderBottom: `1px solid ${T.border}` }}
                    className="dx-row"
                  >
                    <td style={{ ...tdStyle, width: 36 }}>
                      <div style={avatarStyle}>{initials(u)}</div>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 'bold' }}>{nameFor(u)}</td>
                    <td style={{ ...tdStyle, color: T.muted }}>{u.email}</td>
                    <td style={tdStyle}>{u.lead_count.toLocaleString()}</td>
                    <td style={tdStyle}>{u.team_member_count > 0 ? u.team_member_count : '—'}</td>
                    <td style={tdStyle}>
                      <span style={{
                        ...badgeStyle,
                        color: u.is_active_subscription ? T.green : T.muted,
                        borderColor: u.is_active_subscription ? T.green : T.border,
                      }}>
                        {u.is_active_subscription ? '● ACTIVE' : '○ INACTIVE'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: T.muted }}>{fmtDate(u.created_at)}</td>
                    <td style={{ ...tdStyle, color: T.muted }}>OPEN ›</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {tab === 'campaigns' && (
          !selectedUserId ? (
            <div style={emptyStyle}>SELECT A USER ABOVE TO VIEW THEIR CAMPAIGNS.</div>
          ) : campaignsLoading ? (
            <div style={emptyStyle}>LOADING CAMPAIGNS…</div>
          ) : campaignsError ? (
            <div style={{ ...emptyStyle, color: T.red }}>{campaignsError}</div>
          ) : sortedCampaigns.length === 0 ? (
            <div style={emptyStyle}>THIS USER HAS NO CAMPAIGNS.</div>
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14,
            }}>
              {sortedCampaigns.map(c => {
                const isActive = c.status === 'active'
                return (
                  <div key={c.id} className="dx-card" onClick={() => openCampaignLeads(c)}>
                    <div className="dx-card-preview">
                      <span className="dx-card-pin" style={{ color: isActive ? T.green : T.muted }}>
                        {isActive ? '● ACTIVE' : '○ INACTIVE'}
                      </span>
                      {(c.enable_appointments_sub || c.enable_not_interested_sub) && (
                        <div className="dx-card-sub-pins">
                          {c.enable_appointments_sub && <span className="dx-card-sub-pin">+ APPTS</span>}
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

        {tab === 'leads' && (
          !selectedCampaignId ? (
            <div style={emptyStyle}>SELECT A CAMPAIGN ABOVE TO VIEW ITS LEADS.</div>
          ) : leadsLoading ? (
            <div style={emptyStyle}>LOADING LEADS…</div>
          ) : leadsError ? (
            <div style={{ ...emptyStyle, color: T.red }}>{leadsError}</div>
          ) : filteredLeads.length === 0 ? (
            <div style={emptyStyle}>{leads.length === 0 ? 'THIS CAMPAIGN HAS NO LEADS.' : `NO LEADS MATCH "${leadSearch}"`}</div>
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

        {tab === 'recordings' && (
          !selectedUserId ? (
            <div style={emptyStyle}>SELECT A USER ABOVE TO VIEW THEIR CALL RECORDINGS.</div>
          ) : recordingsLoading ? (
            <div style={emptyStyle}>LOADING RECORDINGS…</div>
          ) : recordingsError ? (
            <div style={{ ...emptyStyle, color: T.red }}>{recordingsError}</div>
          ) : filteredRecordings.length === 0 ? (
            <div style={emptyStyle}>{recordings.length === 0 ? 'THIS USER HAS NO CALL RECORDINGS.' : `NO RECORDINGS MATCH "${recordingSearch}"`}</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr>
                  {['NAME', 'PHONE', 'CAMPAIGN', 'DISPOSITION', 'DURATION', 'RECORDED', 'EXPIRES', ''].map((h, i) => (
                    <th key={i} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRecordings.map(r => {
                  const lead = r.leads
                  const isPlaying = nowPlayingId === r.id
                  return (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${T.border}` }} className="dx-row">
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>
                        {lead ? [lead.first_name, lead.last_name].filter(Boolean).join(' ') || '—' : '—'}
                      </td>
                      <td style={tdStyle}>{r.phone_number || lead?.phone || '—'}</td>
                      <td style={{ ...tdStyle, color: T.muted }}>{r.campaigns?.name || '—'}</td>
                      <td style={tdStyle}>
                        {r.disposition ? (
                          <span style={badgeStyle}>{r.disposition.toUpperCase()}</span>
                        ) : (
                          <span style={{ color: T.muted }}>—</span>
                        )}
                      </td>
                      <td style={tdStyle}>{fmtDuration(r.recording_duration ?? r.duration)}</td>
                      <td style={{ ...tdStyle, color: T.muted }}>{relativeTime(r.created_at)}</td>
                      <td style={{ ...tdStyle, color: T.muted }}>
                        {r.recording_expires_at ? fmtDate(r.recording_expires_at) : '—'}
                      </td>
                      <td style={tdStyle}>
                        <button
                          className="dx-card-delete"
                          style={{ borderColor: T.blue, color: T.blue }}
                          onClick={() => playRecording(r.id)}
                        >
                          {isPlaying ? 'PLAYING' : '▸ PLAY'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* ── PERSISTENT PLAYER: stays visible while a recording plays ────── */}
      {nowPlayingId && (
        <div style={{
          flexShrink: 0, padding: '10px 16px', background: T.surface,
          borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 10, letterSpacing: 1, fontWeight: 'bold', color: T.muted }}>NOW PLAYING</span>
          <audio
            ref={audioRef}
            controls
            style={{ flex: 1, height: 32 }}
            src={`/api/admin/user-data/recordings/play?call_id=${encodeURIComponent(nowPlayingId)}`}
          />
          <a
            href={`/api/admin/user-data/recordings/play?call_id=${encodeURIComponent(nowPlayingId)}&download=1`}
            style={{ ...toolbarBtnStyle, textDecoration: 'none', display: 'inline-block' }}
          >
            ⬇ DOWNLOAD
          </a>
          <button onClick={() => setNowPlayingId(null)} style={modalCancelBtnStyle}>CLOSE</button>
        </div>
      )}

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

        /* ── SCROLLBAR ─────────────────────────────────────────────────── */
        .dx-scroll {
          scrollbar-width: thin;
          scrollbar-color: ${T.border} transparent;
        }
        .dx-scroll::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .dx-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .dx-scroll::-webkit-scrollbar-thumb {
          background: ${T.border};
          border-radius: 5px;
          border: 2px solid ${T.bg};
        }
        .dx-scroll::-webkit-scrollbar-thumb:hover {
          background: ${T.muted};
        }
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

function navArrowStyle(enabled: boolean): React.CSSProperties {
  return {
    background: 'transparent',
    border: `1px solid ${T.border}`,
    borderRadius: 3,
    color: enabled ? T.text : T.muted,
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontFamily: FUTURA,
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 1,
    padding: '4px 10px',
    opacity: enabled ? 1 : 0.4,
  }
}

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? T.blue : 'transparent',
    border: `1px solid ${active ? T.blue : T.border}`,
    borderRadius: 3,
    color: active ? 'white' : T.text,
    cursor: 'pointer',
    fontFamily: FUTURA,
    fontSize: 10.5,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    padding: '6px 12px',
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
  width: 200,
}

const pickerSelectStyle: React.CSSProperties = {
  background: T.bg,
  border: `1px solid ${T.border}`,
  borderRadius: 3,
  color: T.text,
  fontFamily: FUTURA,
  fontSize: 11,
  fontWeight: 'bold',
  padding: '6px 10px',
  maxWidth: 200,
}

const sortSelectStyle: React.CSSProperties = {
  background: T.bg,
  border: `1px solid ${T.border}`,
  borderRadius: 3,
  color: T.muted,
  fontFamily: FUTURA,
  fontSize: 10,
  letterSpacing: 0.5,
  padding: '6px 8px',
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
