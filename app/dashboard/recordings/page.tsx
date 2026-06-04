'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'

const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
  border: '#c4c8d0',
  dark: '#1a1a2e',
  text: '#1a1c24',
  muted: '#5a5e6a',
  accent: '#2a4a8a',
  blue: 'var(--brand-primary)',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}

const FUTURA = `'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif`

const DISPOSITIONS = [
  'CLOSED', 'APPOINTMENT', 'NOT INTERESTED', 'DO NOT CALL', 'SKIPPED', 'NO_ANSWER',
]

const dispColor = (disp: string | null): string => {
  switch (disp) {
    case 'CLOSED': return T.green
    case 'APPOINTMENT': return '#1a4a8a'
    case 'NOT INTERESTED': return T.amber
    case 'DO NOT CALL': return T.red
    case 'SKIPPED':
    case 'NO_ANSWER':
    default: return T.muted
  }
}

const dispBg = (disp: string | null): string => {
  switch (disp) {
    case 'CLOSED': return '#e8f5e8'
    case 'APPOINTMENT': return '#e8eef8'
    case 'NOT INTERESTED': return '#f8f4e8'
    case 'DO NOT CALL': return '#f8e8e8'
    case 'SKIPPED':
    case 'NO_ANSWER':
    default: return '#f0f0f4'
  }
}

const dispositionTint = (disp: string | null): string => {
  switch (disp) {
    case 'CLOSED': return 'rgba(26, 106, 26, 0.10)'
    case 'APPOINTMENT': return 'rgba(26, 74, 138, 0.10)'
    case 'NOT INTERESTED': return 'rgba(138, 106, 26, 0.10)'
    case 'DO NOT CALL': return 'rgba(138, 26, 26, 0.10)'
    case 'NO_ANSWER': return 'rgba(90, 94, 106, 0.06)'
    case 'SKIPPED': return 'rgba(90, 94, 106, 0.04)'
    default: return T.surface
  }
}

interface Recording {
  id: string
  campaign_id: string
  lead_id: string
  phone_number: string | null
  disposition: string
  duration: number
  recording_url: string
  recording_duration: number
  recording_expires_at: string | null
  created_at: string
  notes?: string | null
  leads: { first_name: string; last_name: string; phone: string; notes?: string | null } | null
  campaigns: { name: string } | null
}

interface Campaign {
  id: string
  name: string
}

function formatDuration(s: number) {
  if (!s) return '0:00'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function formatDateClean(iso: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
  return { date, time }
}

function daysUntilExpire(iso: string | null) {
  if (!iso) return null
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  return days > 0 ? days : 0
}

export default function RecordingsPage() {
  const { user } = useUser()
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignFilter, setCampaignFilter] = useState('all')
  const [dispositionFilter, setDispositionFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [cursor, setCursor] = useState<number | null>(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [disclosureOpen, setDisclosureOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!user) return
    fetch(`/api/campaigns/list?user_id=${user.id}`)
      .then(r => r.json())
      .then(d => { if (d.success) setCampaigns(d.campaigns) })
  }, [user])

  useEffect(() => {
    if (!user) return
    setRecordings([])
    setCursor(0)
    setPlayingId(null)
    setExpandedId(null)
  }, [campaignFilter, dispositionFilter, debouncedSearch, user])

  const fetchMore = useCallback(async () => {
    if (!user || cursor === null || loading) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        user_id: user.id,
        campaign_id: campaignFilter,
        disposition: dispositionFilter,
        search: debouncedSearch,
        cursor: String(cursor),
      })
      const res = await fetch(`/api/recordings/list?${params}`)
      const data = await res.json()
      if (data.success) {
        setRecordings(prev => cursor === 0 ? data.recordings : [...prev, ...data.recordings])
        setTotal(data.total)
        setCursor(data.nextCursor)
      }
    } finally {
      setLoading(false)
    }
  }, [user, cursor, loading, campaignFilter, dispositionFilter, debouncedSearch])

  useEffect(() => {
    if (cursor === 0) fetchMore()
  }, [cursor, fetchMore])

  useEffect(() => {
    if (!sentinelRef.current || cursor === null) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && !loading) fetchMore() },
      { rootMargin: '300px' }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [fetchMore, loading, cursor, recordings.length])

  const handleSync = async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await fetch('/api/recordings/sync', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setSyncMessage(`Synced ${data.synced} new recording${data.synced === 1 ? '' : 's'}.`)
        setRecordings([])
        setCursor(0)
      } else {
        setSyncMessage(`Sync failed: ${data.error}`)
      }
    } catch (err: any) {
      setSyncMessage(`Sync error: ${err.message}`)
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMessage(null), 8000)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch('/api/recordings/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: id }),
      })
      const data = await res.json()
      if (data.success) {
        setRecordings(prev => prev.filter(r => r.id !== id))
        setTotal(t => Math.max(0, t - 1))
        setSyncMessage('Recording deleted.')
        setTimeout(() => setSyncMessage(null), 4000)
      } else {
        setSyncMessage(`Delete failed: ${data.error}`)
        setTimeout(() => setSyncMessage(null), 6000)
      }
    } catch (err: any) {
      setSyncMessage(`Delete error: ${err.message}`)
      setTimeout(() => setSyncMessage(null), 6000)
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const handleDownload = (id: string) => {
    window.location.href = `/api/recordings/play?call_id=${id}&download=1`
  }

  return (
    <div className="rec-root" style={{
      flex: 1,
      background: T.bg,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: FUTURA,
      color: T.text,
    }}>
      <style>{`
        .rec-root * { box-sizing: border-box; }
        .rec-header {
          background: ${T.dark};
          padding: 12px 20px;
          border-bottom: 2px solid ${T.accent};
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .rec-disclosure {
          background: #fff8e8;
          border-bottom: 1px solid #d4b86a;
        }
        .rec-disclosure-summary {
          padding: 8px 20px;
          font-size: 11px;
          color: ${T.amber};
          letter-spacing: 1px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          cursor: pointer;
          user-select: none;
          font-weight: bold;
          font-family: ${FUTURA};
        }
        .rec-disclosure-summary:hover { background: #fdf2d6; }
        .rec-disclosure-summary .chev {
          font-family: monospace;
          font-size: 10px;
          color: ${T.amber};
          transition: transform 0.15s;
        }
        .rec-disclosure-summary.open .chev { transform: rotate(180deg); }
        .rec-disclosure-body {
          padding: 4px 20px 12px 20px;
          font-size: 11px;
          color: ${T.amber};
          letter-spacing: 0.5px;
          line-height: 1.6;
          border-top: 1px dashed #d4b86a;
        }
        .rec-disclosure-body p {
          margin: 8px 0 0 0;
        }
        .rec-disclosure-body p:first-child { margin-top: 6px; }
        .rec-controls {
          padding: 12px 16px;
          background: ${T.surface};
          border-bottom: 1px solid ${T.border};
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 8px;
          align-items: end;
        }
        .rec-controls .field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .rec-controls label {
          font-size: 9px; letter-spacing: 2px; color: ${T.muted}; font-weight: bold;
        }
        .rec-controls input, .rec-controls select {
          padding: 8px 10px;
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-radius: 4px;
          font-family: monospace;
          font-size: 12px;
          color: ${T.text};
          outline: none;
          width: 100%;
          min-width: 0;
        }
        .rec-mobile-toggle { display: none; }
        .rec-list { flex: 1; overflow-y: auto; padding: 12px 16px; }
        .rec-card {
          border: 1px solid ${T.border};
          border-radius: 4px;
          padding: 14px 16px;
          margin-bottom: 6px;
          cursor: pointer;
          transition: border-color 0.1s, background 0.15s;
        }
        .rec-card:hover { border-color: ${T.blue}; }
        .rec-card.expanded { border-color: ${T.blue}; }
        .rec-desktop-row {
          display: grid;
          grid-template-columns: 1.6fr 1.2fr 1fr 1.2fr auto;
          gap: 16px;
          align-items: center;
        }
        .rec-mobile-row { display: none; }
        .rec-name {
          font-weight: bold;
          font-family: monospace;
          color: ${T.text};
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .rec-name-sub {
          font-size: 10px;
          color: ${T.muted};
          font-family: monospace;
          font-weight: normal;
          letter-spacing: 1px;
          margin-top: 2px;
        }
        .rec-phone {
          font-family: monospace;
          color: ${T.accent};
          font-weight: bold;
          font-size: 12px;
          white-space: nowrap;
        }
        .rec-datetime {
          font-family: monospace;
          font-size: 11px;
          color: ${T.text};
          line-height: 1.5;
        }
        .rec-datetime .date {
          font-weight: bold;
          letter-spacing: 0.5px;
        }
        .rec-datetime .time {
          color: ${T.muted};
          font-size: 10px;
          margin-top: 2px;
        }
        .rec-datetime .duration {
          color: ${T.muted};
          font-size: 10px;
          margin-top: 2px;
        }
        .rec-disp-badge {
          display: inline-block;
          padding: 5px 12px;
          border-radius: 3px;
          font-size: 10px;
          letter-spacing: 1px;
          font-weight: bold;
          font-family: ${FUTURA};
          white-space: nowrap;
        }
        .rec-camp {
          font-family: monospace;
          font-size: 11px;
          color: ${T.muted};
          letter-spacing: 0.5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .rec-actions {
          display: flex;
          flex-direction: column;
          gap: 6px;
          align-items: stretch;
          min-width: 130px;
        }
        .rec-actions-row {
          display: flex;
          gap: 4px;
        }
        .rec-btn {
          padding: 7px 12px;
          background: transparent;
          border: 1px solid ${T.blue};
          border-radius: 3px;
          color: ${T.blue};
          font-size: 10px;
          letter-spacing: 1px;
          font-weight: bold;
          cursor: pointer;
          font-family: ${FUTURA};
          flex: 1;
          white-space: nowrap;
        }
        .rec-btn-danger {
          border-color: ${T.red};
          color: ${T.red};
        }
        .rec-btn-active {
          background: ${T.dark};
          color: ${T.blue};
        }
        .rec-expand {
          margin-top: 12px;
          padding: 14px;
          background: ${T.bg};
          border: 1px solid ${T.blue};
          border-radius: 3px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .rec-expand-section-label {
          font-size: 9px;
          letter-spacing: 2px;
          color: ${T.muted};
          font-weight: bold;
          margin-bottom: 6px;
        }
        .rec-expand-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 10px;
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 3px;
          font-size: 11px;
          margin-bottom: 4px;
        }
        .rec-notes-block {
          padding: 12px;
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 3px;
          font-family: monospace;
          font-size: 12px;
          line-height: 1.6;
          color: ${T.text};
          white-space: pre-wrap;
          min-height: 60px;
        }
        .rec-notes-empty {
          color: ${T.muted};
          font-style: italic;
        }
        .rec-player {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid ${T.border};
        }
        .rec-player audio { width: 100%; }
        .rec-sync-msg {
          padding: 8px 16px;
          background: #e8f5e8;
          border-bottom: 1px solid #6abf6a;
          color: ${T.green};
          font-size: 11px;
          letter-spacing: 1px;
        }
        @media (max-width: 768px) {
          .rec-header { padding: 10px 12px; }
          .rec-disclosure-summary { padding: 8px 12px; font-size: 10px; }
          .rec-disclosure-body { padding: 4px 12px 10px 12px; font-size: 10px; }
          .rec-mobile-toggle {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 16px;
            background: ${T.surface};
            border-bottom: 1px solid ${T.border};
            font-size: 11px;
            letter-spacing: 2px;
            color: ${T.text};
            cursor: pointer;
          }
          .rec-controls.closed-mobile { display: none; }
          .rec-controls.open-mobile {
            display: grid;
            grid-template-columns: 1fr;
            padding: 12px;
          }
          .rec-desktop-row { display: none; }
          .rec-mobile-row {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 8px;
            grid-template-areas:
              "name disp"
              "phone phone"
              "meta meta"
              "actions actions";
          }
          .rec-mobile-row .col-name { grid-area: name; }
          .rec-mobile-row .col-phone { grid-area: phone; }
          .rec-mobile-row .col-disp { grid-area: disp; }
          .rec-mobile-row .col-meta {
            grid-area: meta;
            display: flex;
            gap: 12px;
            font-size: 10px;
            color: ${T.muted};
            font-family: monospace;
          }
          .rec-mobile-row .col-actions { grid-area: actions; align-items: stretch; min-width: auto; }
          .rec-mobile-row .rec-actions-row { width: 100%; }
          .rec-list { padding: 8px 12px; }
          .rec-expand { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="rec-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: T.blue }}>
            CALL RECORDINGS
          </span>
          <span style={{
            fontSize: 10, fontFamily: 'monospace', color: '#8888aa', letterSpacing: 1,
          }}>
            {total.toLocaleString()} TOTAL · {recordings.length} LOADED
          </span>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            padding: '6px 14px',
            background: 'transparent',
            border: `1px solid ${T.blue}`,
            borderRadius: 3,
            color: T.blue,
            fontSize: 10,
            letterSpacing: 2,
            fontWeight: 'bold',
            cursor: syncing ? 'wait' : 'pointer',
            fontFamily: 'Futura PT, Futura, sans-serif',
          }}
        >{syncing ? '⟳ SYNCING...' : '⟳ SYNC'}</button>
      </div>

      {syncMessage && (
        <div className="rec-sync-msg">{syncMessage}</div>
      )}

      <div className="rec-disclosure">
        <div
          className={`rec-disclosure-summary ${disclosureOpen ? 'open' : ''}`}
          onClick={() => setDisclosureOpen(v => !v)}
          role="button"
          aria-expanded={disclosureOpen}
        >
          <span>⚠️ DISCLOSURE & 30-DAY RECORDINGS BACKUP:</span>
          <span className="chev">▾</span>
        </div>
        {disclosureOpen && (
          <div className="rec-disclosure-body">
            <p>
              <strong>RECORDING DISCLOSURE:</strong> You must verbally inform the
              other party they are on a recorded line by law in CA, CT, FL, IL, MD,
              MA, MI, MT, NV, NH, PA, WA.
            </p>
            <p>
              <strong>30-DAY BACKUP:</strong> Recordings are kept for 30 days, then
              auto-removed. Click DOWNLOAD to save permanently.
            </p>
          </div>
        )}
      </div>

      <div className="rec-mobile-toggle" onClick={() => setFiltersOpen(v => !v)}>
        <span>{filtersOpen ? '▲ HIDE' : '▼ SHOW'} FILTERS</span>
        <span style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace' }}>
          {total.toLocaleString()} recordings
        </span>
      </div>

      <div className={`rec-controls ${filtersOpen ? 'open-mobile' : 'closed-mobile'}`}>
        <div className="field">
          <label>SEARCH NAME OR PHONE</label>
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="field">
          <label>CAMPAIGN</label>
          <select value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)}>
            <option value="all">[ ALL CAMPAIGNS ]</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>DISPOSITION</label>
          <select value={dispositionFilter} onChange={e => setDispositionFilter(e.target.value)}>
            <option value="all">[ ALL ]</option>
            {DISPOSITIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="rec-list">
        {recordings.length === 0 && !loading && (
          <div style={{
            textAlign: 'center', padding: 60,
            fontSize: 11, letterSpacing: 3, color: T.muted,
          }}>
            NO RECORDINGS YET<br />
            <span style={{ fontSize: 10, marginTop: 8, display: 'inline-block' }}>
              MAKE A CALL — THEN HIT SYNC IF IT DOESN'T APPEAR.
            </span>
          </div>
        )}

        {recordings.map(r => {
          const expDays = daysUntilExpire(r.recording_expires_at)
          const isPlaying = playingId === r.id
          const isExpanded = expandedId === r.id
          const isConfirming = confirmDeleteId === r.id
          const isDeleting = deletingId === r.id

          const hasLead = !!r.leads
          const leadName = hasLead
            ? `${r.leads!.first_name || ''} ${r.leads!.last_name || ''}`.trim() || 'Unnamed Lead'
            : 'Manual Dial'
          const phone = r.leads?.phone || r.phone_number || '—'
          const campName = r.campaigns?.name || (hasLead ? '—' : 'Direct')
          const { date, time } = formatDateClean(r.created_at)
          const dur = formatDuration(r.recording_duration || r.duration)
          const notes = r.leads?.notes || (r as any).notes || ''

          const dispBadgeStyle = r.disposition ? {
            background: dispBg(r.disposition),
            color: dispColor(r.disposition),
            border: `1px solid ${dispColor(r.disposition)}`,
          } : {}

          return (
            <div
              key={r.id}
              className={`rec-card ${isExpanded ? 'expanded' : ''}`}
              style={{ background: dispositionTint(r.disposition) }}
              onClick={(e) => {
                const target = e.target as HTMLElement
                if (target.closest('button, audio, .rec-actions')) return
                setExpandedId(isExpanded ? null : r.id)
              }}
            >
              {/* DESKTOP */}
              <div className="rec-desktop-row">
                <div>
                  <div className="rec-name">{leadName}</div>
                  {!hasLead && (
                    <div className="rec-name-sub">no campaign attached</div>
                  )}
                </div>

                <div className="rec-phone">{phone}</div>

                <div className="rec-datetime">
                  <div className="date">{date}</div>
                  <div className="time">{time}</div>
                  <div className="duration">▸ {dur}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                  <div className="rec-camp">{campName}</div>
                  {r.disposition ? (
                    <span className="rec-disp-badge" style={dispBadgeStyle}>{r.disposition}</span>
                  ) : (
                    <span className="rec-disp-badge" style={{
                      background: '#e8e8ec', color: T.muted,
                      border: `1px solid ${T.border}`,
                    }}>NO DISPOSITION</span>
                  )}
                </div>

                <div className="rec-actions">
                  <div className="rec-actions-row">
                    <button
                      className={`rec-btn ${isPlaying ? 'rec-btn-active' : ''}`}
                      onClick={() => setPlayingId(isPlaying ? null : r.id)}
                    >{isPlaying ? '✕ CLOSE' : '▶ PLAY'}</button>
                    <button
                      className="rec-btn"
                      onClick={() => handleDownload(r.id)}
                    >↓ SAVE</button>
                  </div>
                  <div className="rec-actions-row">
                    {isConfirming ? (
                      <>
                        <button
                          className="rec-btn rec-btn-danger"
                          disabled={isDeleting}
                          onClick={() => handleDelete(r.id)}
                          style={{ background: isDeleting ? 'transparent' : T.red, color: isDeleting ? T.red : '#fff' }}
                        >{isDeleting ? '...' : '✓ CONFIRM'}</button>
                        <button
                          className="rec-btn"
                          disabled={isDeleting}
                          onClick={() => setConfirmDeleteId(null)}
                        >CANCEL</button>
                      </>
                    ) : (
                      <button
                        className="rec-btn rec-btn-danger"
                        onClick={() => setConfirmDeleteId(r.id)}
                        style={{ width: '100%' }}
                      >🗑 DELETE</button>
                    )}
                  </div>
                </div>
              </div>

              {/* MOBILE */}
              <div className="rec-mobile-row">
                <div className="col-name">
                  <div className="rec-name">{leadName}</div>
                  {!hasLead && (
                    <div className="rec-name-sub">no campaign attached</div>
                  )}
                </div>
                <div className="col-disp">
                  {r.disposition ? (
                    <span className="rec-disp-badge" style={dispBadgeStyle}>{r.disposition}</span>
                  ) : (
                    <span className="rec-disp-badge" style={{
                      background: '#e8e8ec', color: T.muted,
                      border: `1px solid ${T.border}`,
                    }}>NO DISP</span>
                  )}
                </div>
                <div className="col-phone rec-phone">{phone}</div>
                <div className="col-meta">
                  <span>{date} · {time}</span>
                  <span>{dur}</span>
                  <span>{campName}</span>
                </div>
                <div className="col-actions rec-actions">
                  <div className="rec-actions-row">
                    <button
                      className={`rec-btn ${isPlaying ? 'rec-btn-active' : ''}`}
                      onClick={() => setPlayingId(isPlaying ? null : r.id)}
                    >{isPlaying ? '✕ CLOSE' : '▶ PLAY'}</button>
                    <button
                      className="rec-btn"
                      onClick={() => handleDownload(r.id)}
                    >↓ SAVE</button>
                  </div>
                  <div className="rec-actions-row">
                    {isConfirming ? (
                      <>
                        <button
                          className="rec-btn rec-btn-danger"
                          disabled={isDeleting}
                          onClick={() => handleDelete(r.id)}
                          style={{ background: isDeleting ? 'transparent' : T.red, color: isDeleting ? T.red : '#fff' }}
                        >{isDeleting ? '...' : '✓ CONFIRM'}</button>
                        <button
                          className="rec-btn"
                          disabled={isDeleting}
                          onClick={() => setConfirmDeleteId(null)}
                        >CANCEL</button>
                      </>
                    ) : (
                      <button
                        className="rec-btn rec-btn-danger"
                        onClick={() => setConfirmDeleteId(r.id)}
                      >🗑 DELETE</button>
                    )}
                  </div>
                </div>
              </div>

              {/* EXPANDED */}
              {isExpanded && (
                <div className="rec-expand">
                  <div>
                    <div className="rec-expand-section-label">CALL DETAILS</div>
                    <div className="rec-expand-row">
                      <span style={{ color: T.muted, fontSize: 9, letterSpacing: 1 }}>DISPOSITION</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: dispColor(r.disposition) }}>
                        {r.disposition || '—'}
                      </span>
                    </div>
                    <div className="rec-expand-row">
                      <span style={{ color: T.muted, fontSize: 9, letterSpacing: 1 }}>CAMPAIGN</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: T.text }}>{campName}</span>
                    </div>
                    <div className="rec-expand-row">
                      <span style={{ color: T.muted, fontSize: 9, letterSpacing: 1 }}>DURATION</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: T.text }}>{dur}</span>
                    </div>
                    <div className="rec-expand-row">
                      <span style={{ color: T.muted, fontSize: 9, letterSpacing: 1 }}>RECORDED</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: T.text }}>{date} · {time}</span>
                    </div>
                    {expDays !== null && (
                      <div className="rec-expand-row">
                        <span style={{ color: T.muted, fontSize: 9, letterSpacing: 1 }}>EXPIRES</span>
                        <span style={{
                          fontFamily: 'monospace', fontWeight: 'bold',
                          color: expDays < 7 ? T.red : T.text,
                        }}>
                          {expDays} day{expDays === 1 ? '' : 's'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="rec-expand-section-label">CALL NOTES</div>
                    <div className={`rec-notes-block ${!notes ? 'rec-notes-empty' : ''}`}>
                      {notes || 'No notes recorded for this call.'}
                    </div>
                  </div>
                </div>
              )}

              {isPlaying && (
                <div className="rec-player">
                  <audio controls autoPlay style={{ width: '100%' }}>
                    <source src={`/api/recordings/play?call_id=${r.id}`} type="audio/mpeg" />
                    Your browser does not support audio playback.
                  </audio>
                  {expDays !== null && (
                    <div style={{
                      marginTop: 6,
                      fontSize: 10,
                      letterSpacing: 1,
                      color: expDays < 7 ? T.red : T.muted,
                      fontFamily: 'monospace',
                    }}>
                      EXPIRES IN {expDays} DAY{expDays === 1 ? '' : 'S'} · DOWNLOAD TO KEEP
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {cursor !== null && (
          <div ref={sentinelRef} style={{
            padding: 20, textAlign: 'center',
            fontSize: 10, letterSpacing: 2, color: T.muted,
          }}>
            {loading ? 'LOADING MORE...' : 'SCROLL TO LOAD MORE'}
          </div>
        )}
        {cursor === null && recordings.length > 0 && (
          <div style={{
            padding: 20, textAlign: 'center',
            fontSize: 10, letterSpacing: 2, color: T.muted,
          }}>END OF LIST · {recordings.length} OF {total.toLocaleString()}</div>
        )}
      </div>
    </div>
  )
}