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
  blue: '#4a9eff',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}

const DISPOSITIONS = [
  'CLOSED', 'APPOINTMENT', 'NOT INTERESTED', 'DO NOT CALL', 'SKIPPED', 'NO_ANSWER',
]

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
  leads: { first_name: string; last_name: string; phone: string } | null
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
  const [filtersOpen, setFiltersOpen] = useState(false)
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

  return (
    <div className="rec-root" style={{
      flex: 1,
      background: T.bg,
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
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
        .rec-banner {
          background: #fff8e8;
          border-bottom: 1px solid #d4b86a;
          padding: 10px 20px;
          font-size: 11px;
          color: ${T.amber};
          letter-spacing: 1px;
          line-height: 1.5;
        }
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
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 4px;
          padding: 14px 16px;
          margin-bottom: 8px;
        }

        /* DESKTOP LAYOUT — action column far right, DELETE under date/time */
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
          padding: 4px 10px;
          border-radius: 3px;
          font-size: 9px;
          letter-spacing: 1px;
          font-weight: bold;
          font-family: 'Futura PT', Futura, sans-serif;
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
          font-family: 'Futura PT', Futura, sans-serif;
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
          .rec-banner { padding: 8px 12px; font-size: 10px; }
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

      <div className="rec-banner">
        ⚠ <strong>RECORDING DISCLOSURE:</strong> You must verbally inform the other party they are on a recorded line by law in CA, CT, FL, IL, MD, MA, MI, MT, NV, NH, PA, WA. ·
        <strong> 30-DAY RETENTION:</strong> Recordings auto-delete after 30 days. Click DOWNLOAD to save permanently.
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
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>🎙️</div>
            NO RECORDINGS YET<br />
            <span style={{ fontSize: 10, marginTop: 8, display: 'inline-block' }}>
              MAKE A CALL — THEN HIT SYNC IF IT DOESN'T APPEAR.
            </span>
          </div>
        )}

        {recordings.map(r => {
          const expDays = daysUntilExpire(r.recording_expires_at)
          const isPlaying = playingId === r.id
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

          const dispBadgeStyle = r.disposition ? {
            background:
              r.disposition === 'CLOSED' ? '#e8f5e8' :
              r.disposition === 'APPOINTMENT' ? '#e8eef8' :
              r.disposition === 'DO NOT CALL' ? '#f8e8e8' :
              r.disposition === 'NOT INTERESTED' ? '#f8f4e8' :
              '#f0f0f4',
            color:
              r.disposition === 'CLOSED' ? T.green :
              r.disposition === 'APPOINTMENT' ? T.accent :
              r.disposition === 'DO NOT CALL' ? T.red :
              r.disposition === 'NOT INTERESTED' ? T.amber :
              T.muted,
            border: `1px solid ${
              r.disposition === 'CLOSED' ? T.green :
              r.disposition === 'APPOINTMENT' ? T.accent :
              r.disposition === 'DO NOT CALL' ? T.red :
              r.disposition === 'NOT INTERESTED' ? T.amber :
              T.border
            }`,
          } : {}

          return (
            <div key={r.id} className="rec-card">
              {/* DESKTOP — name | phone | datetime+duration | campaign+disp | actions far right */}
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <div className="rec-camp">{campName}</div>
                  {r.disposition && (
                    <span className="rec-disp-badge" style={dispBadgeStyle}>{r.disposition}</span>
                  )}
                </div>

                <div className="rec-actions">
                  <div className="rec-actions-row">
                    <button
                      className={`rec-btn ${isPlaying ? 'rec-btn-active' : ''}`}
                      onClick={() => setPlayingId(isPlaying ? null : r.id)}
                    >{isPlaying ? '✕ CLOSE' : '▶ PLAY'}</button>
                    <a
                      className="rec-btn"
                      href={`/api/recordings/play?call_id=${r.id}&download=1`}
                      style={{ textDecoration: 'none', textAlign: 'center' }}
                    >↓ SAVE</a>
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

              {/* MOBILE — stacked layout */}
              <div className="rec-mobile-row">
                <div className="col-name">
                  <div className="rec-name">{leadName}</div>
                  {!hasLead && (
                    <div className="rec-name-sub">no campaign attached</div>
                  )}
                </div>
                <div className="col-disp">
                  {r.disposition && (
                    <span className="rec-disp-badge" style={dispBadgeStyle}>{r.disposition}</span>
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
                    <a
                      className="rec-btn"
                      href={`/api/recordings/play?call_id=${r.id}&download=1`}
                      style={{ textDecoration: 'none', textAlign: 'center' }}
                    >↓ SAVE</a>
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