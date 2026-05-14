'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

type AccessTier = 'active' | 'lapsed' | 'new' | null

interface Lead {
  id: string
  campaign_id: string
  first_name: string
  last_name: string
  phone: string
  email?: string
  state?: string
  city?: string
  disposition: string | null
  notes: string
  dial_attempts: number
  last_called_at: string | null
  created_at: string
  extra_data: Record<string, any>
}

interface Campaign {
  id: string
  name: string
  status: string
}

const DISPOSITIONS = [
  { label: 'CLOSED', color: '#1a6a1a', bg: '#e8f5e8' },
  { label: 'APPOINTMENT', color: '#1a4a8a', bg: '#e8eef8' },
  { label: 'NOT INTERESTED', color: '#8a6a1a', bg: '#f8f4e8' },
  { label: 'DO NOT CALL', color: '#8a1a1a', bg: '#f8e8e8' },
  { label: 'SKIPPED', color: '#5a5e6a', bg: '#f0f0f4' },
  { label: 'NO_ANSWER', color: '#5a5e6a', bg: '#f0f0f4' },
]

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
  warn: '#ffaa3e',
  amber: '#8a6a1a',
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

export default function LeadsPage() {
  const { user } = useUser()
  const [tier, setTier] = useState<AccessTier>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignFilter, setCampaignFilter] = useState('all')
  const [dispositionFilter, setDispositionFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sort, setSort] = useState('created_desc')
  const [cursor, setCursor] = useState<number | null>(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editDisposition, setEditDisposition] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const isLapsed = tier === 'lapsed' || tier === 'new'

  useEffect(() => {
    if (!user) return
    fetch('/api/stripe/status')
      .then(r => r.json())
      .then(d => setTier(d.tier || null))
      .catch(() => setTier(null))
  }, [user])

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
    setLeads([])
    setCursor(0)
    setExpandedId(null)
  }, [campaignFilter, dispositionFilter, debouncedSearch, sort, user])

  const fetchMore = useCallback(async () => {
    if (!user || cursor === null || loading) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        user_id: user.id,
        campaign_id: campaignFilter,
        disposition: dispositionFilter,
        search: debouncedSearch,
        sort,
        cursor: String(cursor),
      })
      const res = await fetch(`/api/leads/list?${params}`)
      const data = await res.json()
      if (data.success) {
        setLeads(prev => cursor === 0 ? data.leads : [...prev, ...data.leads])
        setTotal(data.total)
        setCursor(data.nextCursor)
      }
    } catch (err) {
      console.error('fetchMore', err)
    } finally {
      setLoading(false)
    }
  }, [user, cursor, loading, campaignFilter, dispositionFilter, debouncedSearch, sort])

  useEffect(() => {
    if (cursor === 0) fetchMore()
  }, [cursor, fetchMore])

  useEffect(() => {
    if (!sentinelRef.current || cursor === null) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !loading) fetchMore()
      },
      { rootMargin: '300px' }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [fetchMore, loading, cursor, leads.length])

  const handleExpand = (lead: Lead) => {
    if (expandedId === lead.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(lead.id)
    setEditDisposition(lead.disposition || '')
    setEditNotes(lead.notes || '')
  }

  const handleSave = async (leadId: string) => {
    if (!user || isLapsed) return
    setSaving(true)
    try {
      const res = await fetch('/api/leads/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          disposition: editDisposition,
          notes: editNotes,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setLeads(prev => prev.map(l =>
          l.id === leadId ? { ...l, disposition: editDisposition || null, notes: editNotes } : l
        ))
        setExpandedId(null)
      } else if (res.status === 403) {
        setTier('lapsed')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleExport = () => {
    if (!user) return
    const params = new URLSearchParams({
      user_id: user.id,
      campaign_id: campaignFilter,
      disposition: dispositionFilter,
      search: debouncedSearch,
    })
    window.location.href = `/api/leads/export?${params}`
  }

  const dispColor = (disp: string | null) => {
    if (!disp) return T.muted
    return DISPOSITIONS.find(d => d.label === disp)?.color || T.muted
  }
  const dispBg = (disp: string | null) => {
    if (!disp) return '#e8e8ec'
    return DISPOSITIONS.find(d => d.label === disp)?.bg || '#e8e8ec'
  }

  const campaignName = (id: string) =>
    campaigns.find(c => c.id === id)?.name || '—'

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="leads-root" style={{
      flex: 1,
      background: T.bg,
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <style>{`
        .leads-root * { box-sizing: border-box; }
        .leads-header {
          background: ${T.dark};
          padding: 12px 20px;
          border-bottom: 2px solid ${T.accent};
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .leads-lapsed-banner {
          padding: 10px 20px;
          background: rgba(255,170,62,0.08);
          border-bottom: 1px solid #8a6a1a;
          font-size: 11px;
          letter-spacing: 2px;
          color: ${T.warn};
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .leads-controls {
          padding: 12px 16px;
          background: ${T.surface};
          border-bottom: 1px solid ${T.border};
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr auto;
          gap: 8px;
          align-items: end;
        }
        .leads-controls .field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .leads-controls label {
          font-size: 9px; letter-spacing: 2px; color: ${T.muted}; font-weight: bold;
        }
        .leads-controls select, .leads-controls input {
          width: 100%;
          padding: 8px 10px;
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-radius: 4px;
          font-family: monospace;
          font-size: 12px;
          color: ${T.text};
          outline: none;
          min-width: 0;
        }
        .leads-mobile-toggle { display: none; }
        .leads-list { flex: 1; overflow-y: auto; padding: 12px 16px; }
        .lead-card {
          border: 1px solid ${T.border};
          border-radius: 4px;
          padding: 12px 14px;
          margin-bottom: 6px;
          display: grid;
          grid-template-columns: 1.7fr 1.3fr 0.6fr 1fr 0.7fr 0.5fr 0.7fr;
          gap: 10px;
          align-items: center;
          cursor: pointer;
          transition: border-color 0.1s, background 0.15s;
          font-size: 12px;
        }
        .lead-card:hover { border-color: ${T.blue}; }
        .lead-card.expanded { border-color: ${T.blue}; }
        .lead-cell { min-width: 0; }
        .lead-name {
          font-weight: bold; font-family: monospace; color: ${T.text};
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .lead-phone {
          font-family: monospace; color: ${T.accent}; font-weight: bold;
        }
        .lead-meta-mobile { display: none; }
        .lead-expand {
          padding: 16px;
          background: ${T.bg};
          border: 1px solid ${T.blue};
          border-top: none;
          border-radius: 0 0 4px 4px;
          margin-top: -7px;
          margin-bottom: 6px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .lead-extra { display: grid; gap: 6px; }
        .lead-extra-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 10px;
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 3px;
          font-size: 11px;
        }
        .lead-edit { display: flex; flex-direction: column; gap: 10px; }
        .disp-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 3px;
          font-size: 9px;
          letter-spacing: 1px;
          font-weight: bold;
          font-family: 'Futura PT', Futura, sans-serif;
          white-space: nowrap;
        }
        .disp-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }
        .disp-btn {
          padding: 8px 4px;
          border-radius: 3px;
          font-size: 9px;
          font-weight: bold;
          letter-spacing: 1px;
          cursor: pointer;
          font-family: 'Futura PT', Futura, sans-serif;
          border: 1px solid ${T.border};
          background: white;
        }
        .disp-btn:disabled { cursor: not-allowed; opacity: 0.5; }

        @media (max-width: 768px) {
          .leads-header { padding: 10px 12px; }
          .leads-header-stats { display: none; }
          .leads-controls { display: grid; grid-template-columns: 1fr 1fr; padding: 12px; }
          .leads-controls.open-mobile { display: grid !important; grid-template-columns: 1fr 1fr !important; padding: 12px !important; }
          .leads-controls.closed-mobile { display: none !important; }
          .leads-controls .search-field { grid-column: span 2; }
          .leads-controls .export-btn-cell { grid-column: span 2; }
          .leads-mobile-toggle {
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
          .lead-card {
            grid-template-columns: 1fr auto;
            grid-template-areas:
              "name attempts"
              "phone phone"
              "meta disp";
            gap: 6px;
            padding: 12px;
          }
          .lead-cell-name { grid-area: name; }
          .lead-cell-phone { grid-area: phone; }
          .lead-cell-state, .lead-cell-campaign, .lead-cell-called {
            display: none;
          }
          .lead-cell-attempts { grid-area: attempts; text-align: right; }
          .lead-cell-disp { grid-area: disp; text-align: right; }
          .lead-meta-mobile {
            grid-area: meta;
            display: flex;
            gap: 12px;
            font-size: 10px;
            color: ${T.muted};
            font-family: monospace;
          }
          .lead-expand {
            grid-template-columns: 1fr;
            padding: 12px;
          }
          .leads-list { padding: 8px 12px; }
        }
      `}</style>

      <div className="leads-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: T.blue }}>
            LEADS DATABASE
          </span>
          <span className="leads-header-stats" style={{
            fontSize: 10, fontFamily: 'monospace', color: '#8888aa', letterSpacing: 1,
          }}>
            {total.toLocaleString()} TOTAL · {leads.length} LOADED
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={handleExport} style={{
            padding: '6px 14px',
            background: 'transparent',
            border: `1px solid ${T.blue}`,
            borderRadius: 3,
            color: T.blue,
            fontSize: 10,
            letterSpacing: 2,
            fontWeight: 'bold',
            cursor: 'pointer',
            fontFamily: 'Futura PT, Futura, sans-serif',
          }}>↓ EXPORT CSV</button>
        </div>
      </div>

      {isLapsed && (
        <div className="leads-lapsed-banner">
          <span>
            <strong style={{ marginRight: 6 }}>▸ READ-ONLY</strong>
            Your leads are still here. Export anytime. Editing disabled until you resubscribe.
          </span>
          <Link href="/billing" style={{
            padding: '5px 12px',
            background: 'linear-gradient(135deg, #ffaa3e, #ff8a1a)',
            color: 'white',
            fontSize: 10,
            letterSpacing: 2,
            fontWeight: 'bold',
            borderRadius: 3,
            textDecoration: 'none',
            fontFamily: 'Futura PT, Futura, sans-serif',
          }}>↻ RESUBSCRIBE</Link>
        </div>
      )}

      <div className="leads-mobile-toggle" onClick={() => setFiltersOpen(v => !v)}>
        <span>{filtersOpen ? '▲ HIDE' : '▼ SHOW'} FILTERS</span>
        <span style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace' }}>
          {total.toLocaleString()} leads
        </span>
      </div>

      <div className={`leads-controls ${filtersOpen ? 'open-mobile' : 'closed-mobile'}`}>
        <div className="field search-field">
          <label>SEARCH NAME OR PHONE</label>
          <input
            type="text"
            placeholder="e.g. Brown, 8033..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label>CAMPAIGN</label>
          <select value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)}>
            <option value="all">[ ALL CAMPAIGNS ]</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>DISPOSITION</label>
          <select value={dispositionFilter} onChange={e => setDispositionFilter(e.target.value)}>
            <option value="all">[ ALL ]</option>
            <option value="uncalled">UNCALLED</option>
            {DISPOSITIONS.map(d => (
              <option key={d.label} value={d.label}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>SORT</label>
          <select value={sort} onChange={e => setSort(e.target.value)}>
            <option value="created_desc">NEWEST FIRST</option>
            <option value="created_asc">OLDEST FIRST</option>
            <option value="last_called_desc">RECENTLY CALLED</option>
            <option value="attempts_desc">MOST ATTEMPTS</option>
          </select>
        </div>
        <div className="field export-btn-cell"></div>
      </div>

      <div className="leads-list">
        {leads.length === 0 && !loading && (
          <div style={{
            textAlign: 'center', padding: 60,
            fontSize: 11, letterSpacing: 3, color: T.muted,
          }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>📋</div>
            NO LEADS MATCH YOUR FILTERS
          </div>
        )}

        {leads.map(lead => {
          const isExpanded = expandedId === lead.id

          return (
            <div key={lead.id}>
              <div
                className={`lead-card ${isExpanded ? 'expanded' : ''}`}
                onClick={() => handleExpand(lead)}
                style={{ background: dispositionTint(lead.disposition) }}
              >
                <div className="lead-cell lead-cell-name">
                  <div className="lead-name">{lead.first_name} {lead.last_name}</div>
                  <div className="lead-meta-mobile">
                    <span>{lead.state || '—'}</span>
                    <span>{campaignName(lead.campaign_id)}</span>
                  </div>
                </div>
                <div className="lead-cell lead-cell-phone">
                  <div className="lead-phone">{lead.phone}</div>
                </div>
                <div className="lead-cell lead-cell-state" style={{
                  fontSize: 11, color: T.muted, fontFamily: 'monospace',
                }}>
                  {lead.state || '—'}
                </div>
                <div className="lead-cell lead-cell-campaign" style={{
                  fontSize: 10, color: T.muted, fontFamily: 'monospace',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {campaignName(lead.campaign_id)}
                </div>
                <div className="lead-cell lead-cell-called" style={{
                  fontSize: 10, color: T.muted, fontFamily: 'monospace',
                }}>
                  {formatDate(lead.last_called_at)}
                </div>
                <div className="lead-cell lead-cell-attempts" style={{
                  fontSize: 11, color: lead.dial_attempts > 0 ? T.accent : T.muted,
                  fontFamily: 'monospace', fontWeight: 'bold',
                }}>
                  {lead.dial_attempts}x
                </div>
                <div className="lead-cell lead-cell-disp">
                  {lead.disposition ? (
                    <span className="disp-badge" style={{
                      background: dispBg(lead.disposition),
                      color: dispColor(lead.disposition),
                      border: `1px solid ${dispColor(lead.disposition)}`,
                    }}>{lead.disposition}</span>
                  ) : (
                    <span className="disp-badge" style={{
                      background: '#e8e8ec', color: T.muted,
                      border: `1px solid ${T.border}`,
                    }}>NEW</span>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="lead-expand">
                  <div className="lead-extra">
                    <div style={{
                      fontSize: 9, letterSpacing: 2, color: T.muted, marginBottom: 4, fontWeight: 'bold',
                    }}>LEAD DATA</div>
                    {Object.entries(lead.extra_data || {})
                      .filter(([k, v]) => v && String(v).trim())
                      .slice(0, 8)
                      .map(([k, v]) => (
                        <div key={k} className="lead-extra-row">
                          <span style={{ color: T.muted, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>{k}</span>
                          <span style={{ fontFamily: 'monospace', color: T.text, fontWeight: 'bold' }}>{String(v).slice(0, 60)}</span>
                        </div>
                      ))}
                    <div className="lead-extra-row">
                      <span style={{ color: T.muted, fontSize: 9, letterSpacing: 1 }}>CALL ATTEMPTS</span>
                      <span style={{ fontFamily: 'monospace', color: T.text, fontWeight: 'bold' }}>{lead.dial_attempts}</span>
                    </div>
                    <div className="lead-extra-row">
                      <span style={{ color: T.muted, fontSize: 9, letterSpacing: 1 }}>LAST CALLED</span>
                      <span style={{ fontFamily: 'monospace', color: T.text, fontWeight: 'bold' }}>
                        {lead.last_called_at ? new Date(lead.last_called_at).toLocaleString() : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="lead-edit">
                    {isLapsed ? (
                      <div style={{
                        padding: 14,
                        background: 'rgba(255,170,62,0.06)',
                        border: '1px solid #8a6a1a',
                        borderLeft: '3px solid #ffaa3e',
                        borderRadius: 3,
                      }}>
                        <div style={{
                          fontSize: 10, letterSpacing: 3, fontWeight: 'bold',
                          color: T.warn, marginBottom: 6,
                        }}>▸ EDITING LOCKED</div>
                        <div style={{
                          fontSize: 11, lineHeight: 1.6, color: T.text,
                          marginBottom: 12,
                        }}>
                          Resubscribe to update dispositions and notes. Your current data is preserved exactly as it was.
                        </div>
                        <Link href="/billing" style={{
                          display: 'block',
                          padding: '10px 14px',
                          background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
                          color: 'white',
                          fontSize: 10,
                          fontWeight: 'bold',
                          letterSpacing: 3,
                          borderRadius: 3,
                          textAlign: 'center',
                          textDecoration: 'none',
                          fontFamily: 'Futura PT, Futura, sans-serif',
                        }}>RESUBSCRIBE — $35/WEEK</Link>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div style={{
                            fontSize: 9, letterSpacing: 2, color: T.muted, marginBottom: 6, fontWeight: 'bold',
                          }}>SET DISPOSITION</div>
                          <div className="disp-grid">
                            {DISPOSITIONS.filter(d => d.label !== 'NO_ANSWER').map(d => (
                              <button
                                key={d.label}
                                className="disp-btn"
                                onClick={() => setEditDisposition(d.label)}
                                style={{
                                  background: editDisposition === d.label ? d.color : d.bg,
                                  color: editDisposition === d.label ? 'white' : d.color,
                                  borderColor: d.color,
                                }}
                              >{d.label}</button>
                            ))}
                            <button
                              className="disp-btn"
                              onClick={() => setEditDisposition('')}
                              style={{
                                background: editDisposition === '' ? T.muted : 'white',
                                color: editDisposition === '' ? 'white' : T.muted,
                                borderColor: T.border,
                              }}
                            >CLEAR</button>
                          </div>
                        </div>

                        <div>
                          <div style={{
                            fontSize: 9, letterSpacing: 2, color: T.muted, marginBottom: 6, fontWeight: 'bold',
                          }}>NOTES</div>
                          <textarea
                            value={editNotes}
                            onChange={e => setEditNotes(e.target.value)}
                            placeholder="Add notes about this lead..."
                            rows={4}
                            style={{
                              width: '100%',
                              padding: 10,
                              border: `1px solid ${T.border}`,
                              borderRadius: 3,
                              fontSize: 12,
                              fontFamily: 'monospace',
                              background: T.surface,
                              color: T.text,
                              outline: 'none',
                              resize: 'vertical',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => setExpandedId(null)}
                            style={{
                              flex: 1, padding: 10,
                              background: 'transparent',
                              border: `1px solid ${T.border}`,
                              borderRadius: 3,
                              color: T.muted,
                              fontSize: 10,
                              letterSpacing: 2,
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              fontFamily: 'Futura PT, Futura, sans-serif',
                            }}>CANCEL</button>
                          <button
                            onClick={() => handleSave(lead.id)}
                            disabled={saving}
                            style={{
                              flex: 2, padding: 10, border: 'none',
                              background: T.dark,
                              borderTop: `3px solid ${T.blue}`,
                              borderRadius: 3,
                              color: T.blue,
                              fontSize: 10,
                              letterSpacing: 2,
                              fontWeight: 'bold',
                              cursor: saving ? 'wait' : 'pointer',
                              fontFamily: 'Futura PT, Futura, sans-serif',
                            }}>{saving ? 'SAVING...' : '▶ SAVE'}</button>
                        </div>
                      </>
                    )}
                  </div>
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
        {cursor === null && leads.length > 0 && (
          <div style={{
            padding: 20, textAlign: 'center',
            fontSize: 10, letterSpacing: 2, color: T.muted,
          }}>END OF LIST · {leads.length} OF {total.toLocaleString()}</div>
        )}
      </div>
    </div>
  )
}