'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

// =============================================================================
// LEADS PAGE — v25
// =============================================================================
// Visual refresh to match the new Drive-style campaigns aesthetic:
//   - System sans-serif throughout (no monospace tracking on labels)
//   - Clean white surfaces, subtle borders, soft hover states
//   - Light header bar instead of the dark terminal header
//   - Filters bar with proper labels, no all-caps spaced-out chrome
//   - Lead rows: white cards with hover lift, expand inline to edit
//   - Disposition badges: soft fills, not the heavy colored borders
//   - Lapsed banner kept (amber)
//   - Mobile: filters collapse via a clean toggle
//
// Functional changes: NONE. Same endpoints, same query params, same
// infinite scroll, same expand-and-edit-disposition flow.
// =============================================================================

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
  blue: 'var(--brand-primary)',
  green: '#1a6a1a',
  red: '#8a1a1a',
  warn: '#ffaa3e',
  amber: '#8a6a1a',
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
    if (!disp) return '#eef0f3'
    return DISPOSITIONS.find(d => d.label === disp)?.bg || '#eef0f3'
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
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
      color: T.text,
    }}>
      <style>{`
        .leads-root * { box-sizing: border-box; }

        /* Top header — light + clean, no more dark terminal */
        .leads-header {
          background: white;
          padding: 18px 28px;
          border-bottom: 1px solid ${T.border};
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .leads-header-title h1 {
          font-size: 22px;
          font-weight: 500;
          color: ${T.text};
          margin: 0;
          letter-spacing: -0.2px;
        }
        .leads-header-title p {
          font-size: 12px;
          color: ${T.muted};
          margin: 3px 0 0;
        }
        .leads-export-btn {
          padding: 8px 16px;
          background: white;
          border: 1px solid ${T.border};
          border-radius: 6px;
          color: ${T.text};
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background 0.12s, border-color 0.12s;
        }
        .leads-export-btn:hover {
          background: #f8f9fa;
          border-color: ${T.muted};
        }

        .leads-lapsed-banner {
          padding: 12px 28px;
          background: rgba(255,170,62,0.06);
          border-bottom: 1px solid #d4b86a;
          font-size: 13px;
          color: ${T.text};
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .leads-lapsed-banner strong { color: ${T.warn}; }
        .leads-lapsed-banner a {
          padding: 6px 12px;
          background: linear-gradient(135deg, #ffaa3e, #ff8a1a);
          color: white;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          text-decoration: none;
        }

        /* Filters bar — clean white surface with bordered inputs */
        .leads-controls {
          padding: 14px 28px;
          background: white;
          border-bottom: 1px solid ${T.border};
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 12px;
          align-items: end;
        }
        .leads-controls .field {
          display: flex; flex-direction: column; gap: 5px; min-width: 0;
        }
        .leads-controls label {
          font-size: 11px;
          color: ${T.muted};
          font-weight: 500;
          letter-spacing: 0.2px;
        }
        .leads-controls input, .leads-controls select {
          width: 100%;
          padding: 8px 11px;
          background: white;
          border: 1px solid ${T.border};
          border-radius: 6px;
          font-size: 13px;
          color: ${T.text};
          outline: none;
          font-family: inherit;
          min-width: 0;
          transition: border-color 0.12s, box-shadow 0.12s;
        }
        .leads-controls input:focus, .leads-controls select:focus {
          border-color: ${T.blue};
          box-shadow: 0 0 0 3px rgba(74,158,255,0.12);
        }

        .leads-mobile-toggle { display: none; }

        /* Counter strip */
        .leads-counter {
          padding: 8px 28px;
          font-size: 11px;
          color: ${T.muted};
          background: #f8f9fa;
          border-bottom: 1px solid ${T.border};
        }

        /* List body */
        .leads-list {
          flex: 1;
          overflow-y: auto;
          padding: 14px 24px 24px;
        }

        .lead-card {
          background: white;
          border: 1px solid ${T.border};
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 6px;
          display: grid;
          grid-template-columns: 1.7fr 1.3fr 0.6fr 1fr 0.7fr 0.5fr 0.9fr;
          gap: 14px;
          align-items: center;
          cursor: pointer;
          transition: border-color 0.12s, box-shadow 0.12s;
          font-size: 13px;
        }
        .lead-card:hover {
          border-color: ${T.muted};
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }
        .lead-card.expanded {
          border-color: ${T.blue};
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        }

        .lead-cell { min-width: 0; }
        .lead-name {
          font-weight: 500;
          color: ${T.text};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 13px;
        }
        .lead-phone {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          color: ${T.accent};
          font-weight: 500;
          font-size: 12px;
        }
        .lead-meta-light {
          font-size: 11px;
          color: ${T.muted};
          margin-top: 2px;
        }
        .lead-meta-mobile { display: none; }

        .disp-badge {
          display: inline-block;
          padding: 3px 9px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.3px;
          white-space: nowrap;
        }

        /* Expanded edit panel */
        .lead-expand {
          background: white;
          border: 1px solid ${T.blue};
          border-top: none;
          border-radius: 0 0 8px 8px;
          margin: -7px 0 6px;
          padding: 16px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .lead-section-title {
          font-size: 10px;
          color: ${T.muted};
          font-weight: 600;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .lead-extra-row {
          display: flex;
          justify-content: space-between;
          padding: 7px 12px;
          background: #f8f9fa;
          border: 1px solid #eef0f3;
          border-radius: 5px;
          font-size: 12px;
          margin-bottom: 4px;
        }
        .lead-extra-row .key {
          color: ${T.muted};
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .lead-extra-row .val {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          color: ${T.text};
          font-weight: 500;
          font-size: 12px;
          text-align: right;
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .disp-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }
        .disp-btn {
          padding: 8px 6px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.3px;
          cursor: pointer;
          font-family: inherit;
          border: 1px solid ${T.border};
          background: white;
          color: ${T.text};
          transition: background 0.12s, border-color 0.12s;
        }
        .disp-btn:hover { background: #f8f9fa; }

        .lead-notes-textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid ${T.border};
          border-radius: 6px;
          font-size: 13px;
          font-family: inherit;
          background: white;
          color: ${T.text};
          outline: none;
          resize: vertical;
          box-sizing: border-box;
          transition: border-color 0.12s, box-shadow 0.12s;
        }
        .lead-notes-textarea:focus {
          border-color: ${T.blue};
          box-shadow: 0 0 0 3px rgba(74,158,255,0.12);
        }

        .lead-edit-actions {
          display: flex; gap: 8px;
        }
        .lead-edit-actions button {
          flex: 1;
          padding: 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
        }
        .lead-edit-actions .cancel {
          background: white;
          border: 1px solid ${T.border};
          color: ${T.muted};
        }
        .lead-edit-actions .cancel:hover { background: #f8f9fa; }
        .lead-edit-actions .save {
          flex: 2;
          background: ${T.dark};
          border: 1px solid ${T.dark};
          color: white;
        }
        .lead-edit-actions .save:hover { background: #2a2a4a; }
        .lead-edit-actions .save:disabled { opacity: 0.6; cursor: not-allowed; }

        @media (max-width: 768px) {
          .leads-header { padding: 14px 16px; }
          .leads-header-title h1 { font-size: 18px; }
          .leads-counter { padding: 6px 16px; }
          .leads-lapsed-banner { padding: 10px 16px; }
          .leads-list { padding: 10px 14px 24px; }

          .leads-controls {
            grid-template-columns: 1fr 1fr;
            padding: 12px 16px;
          }
          .leads-controls.closed-mobile { display: none; }
          .leads-controls.open-mobile {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
          }
          .leads-controls .field.search-field { grid-column: span 2; }

          .leads-mobile-toggle {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: white;
            border-bottom: 1px solid ${T.border};
            font-size: 13px;
            color: ${T.text};
            cursor: pointer;
            font-weight: 500;
          }
          .leads-mobile-toggle .chev { color: ${T.muted}; font-size: 11px; }

          .lead-card {
            grid-template-columns: 1fr auto;
            grid-template-areas:
              "name disp"
              "phone phone"
              "meta meta";
            gap: 4px;
          }
          .lead-cell-name { grid-area: name; }
          .lead-cell-phone { grid-area: phone; }
          .lead-cell-disp { grid-area: disp; text-align: right; }
          .lead-cell-state, .lead-cell-campaign, .lead-cell-called, .lead-cell-attempts {
            display: none;
          }
          .lead-meta-mobile {
            grid-area: meta;
            display: flex;
            gap: 10px;
            font-size: 11px;
            color: ${T.muted};
            margin-top: 2px;
          }
          .lead-expand {
            grid-template-columns: 1fr;
            padding: 14px;
          }
        }
      `}</style>

      {/* HEADER */}
      <div className="leads-header">
        <div className="leads-header-title">
          <h1>Leads</h1>
          <p>
            {isLapsed
              ? 'Read-only — your data is preserved, editing locked until you resubscribe.'
              : 'Search, filter, and update any lead in your database.'}
          </p>
        </div>
        <button className="leads-export-btn" onClick={handleExport}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </button>
      </div>

      {isLapsed && (
        <div className="leads-lapsed-banner">
          <span>
            <strong>Read-only mode.</strong> Your leads are still here. Export
            anytime. Editing is disabled until you resubscribe.
          </span>
          <Link href="/billing">Resubscribe →</Link>
        </div>
      )}

      {/* COUNTER */}
      <div className="leads-counter">
        {total.toLocaleString()} total · {leads.length.toLocaleString()} loaded
      </div>

      {/* MOBILE FILTERS TOGGLE */}
      <div className="leads-mobile-toggle" onClick={() => setFiltersOpen(v => !v)}>
        <span>Filters &amp; sort</span>
        <span className="chev">{filtersOpen ? '▲' : '▼'}</span>
      </div>

      {/* FILTERS */}
      <div className={`leads-controls ${filtersOpen ? 'open-mobile' : 'closed-mobile'}`}>
        <div className="field search-field">
          <label>Search name or phone</label>
          <input
            type="text"
            placeholder="e.g. Brown, 8033…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Campaign</label>
          <select value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)}>
            <option value="all">All campaigns</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Disposition</label>
          <select value={dispositionFilter} onChange={e => setDispositionFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="uncalled">Uncalled</option>
            {DISPOSITIONS.map(d => (
              <option key={d.label} value={d.label}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Sort</label>
          <select value={sort} onChange={e => setSort(e.target.value)}>
            <option value="created_desc">Newest first</option>
            <option value="created_asc">Oldest first</option>
            <option value="last_called_desc">Recently called</option>
            <option value="attempts_desc">Most attempts</option>
          </select>
        </div>
      </div>

      {/* LIST */}
      <div className="leads-list">
        {leads.length === 0 && !loading && (
          <div style={{
            textAlign: 'center',
            padding: '80px 20px',
            color: T.muted,
            fontSize: 13,
          }}>
            No leads match your filters.
          </div>
        )}

        {leads.map(lead => {
          const isExpanded = expandedId === lead.id

          return (
            <div key={lead.id}>
              <div
                className={`lead-card ${isExpanded ? 'expanded' : ''}`}
                onClick={() => handleExpand(lead)}
              >
                <div className="lead-cell lead-cell-name">
                  <div className="lead-name">{lead.first_name} {lead.last_name}</div>
                  <div className="lead-meta-mobile">
                    <span>{lead.state || '—'}</span>
                    <span>·</span>
                    <span>{campaignName(lead.campaign_id)}</span>
                  </div>
                </div>
                <div className="lead-cell lead-cell-phone">
                  <div className="lead-phone">{lead.phone}</div>
                </div>
                <div className="lead-cell lead-cell-state" style={{
                  fontSize: 12, color: T.muted,
                }}>
                  {lead.state || '—'}
                </div>
                <div className="lead-cell lead-cell-campaign" style={{
                  fontSize: 12, color: T.muted,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {campaignName(lead.campaign_id)}
                </div>
                <div className="lead-cell lead-cell-called" style={{
                  fontSize: 11, color: T.muted,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}>
                  {formatDate(lead.last_called_at)}
                </div>
                <div className="lead-cell lead-cell-attempts" style={{
                  fontSize: 12, color: lead.dial_attempts > 0 ? T.accent : T.muted,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontWeight: 500,
                }}>
                  {lead.dial_attempts}×
                </div>
                <div className="lead-cell lead-cell-disp">
                  {lead.disposition ? (
                    <span className="disp-badge" style={{
                      background: dispBg(lead.disposition),
                      color: dispColor(lead.disposition),
                    }}>{lead.disposition}</span>
                  ) : (
                    <span className="disp-badge" style={{
                      background: '#eef0f3', color: T.muted,
                    }}>New</span>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="lead-expand">

                  <div>
                    <div className="lead-section-title">Lead data</div>
                    {Object.entries(lead.extra_data || {})
                      .filter(([k, v]) => v && String(v).trim())
                      .slice(0, 8)
                      .map(([k, v]) => (
                        <div key={k} className="lead-extra-row">
                          <span className="key">{k.replace(/_/g, ' ')}</span>
                          <span className="val">{String(v).slice(0, 60)}</span>
                        </div>
                      ))}
                    <div className="lead-extra-row">
                      <span className="key">Call attempts</span>
                      <span className="val">{lead.dial_attempts}</span>
                    </div>
                    <div className="lead-extra-row">
                      <span className="key">Last called</span>
                      <span className="val">
                        {lead.last_called_at ? new Date(lead.last_called_at).toLocaleString() : '—'}
                      </span>
                    </div>
                  </div>

                  <div>
                    {isLapsed ? (
                      <div style={{
                        padding: 16,
                        background: 'rgba(255,170,62,0.06)',
                        border: '1px solid #d4b86a',
                        borderLeft: `3px solid ${T.warn}`,
                        borderRadius: 6,
                      }}>
                        <div style={{
                          fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
                          color: T.warn, marginBottom: 8, textTransform: 'uppercase',
                        }}>Editing locked</div>
                        <div style={{
                          fontSize: 13, lineHeight: 1.55, color: T.text, marginBottom: 14,
                        }}>
                          Resubscribe to update dispositions and notes. Your
                          current data is preserved exactly as it was.
                        </div>
                        <Link href="/billing" style={{
                          display: 'block',
                          padding: '10px 14px',
                          background: T.dark,
                          color: 'white',
                          fontSize: 12,
                          fontWeight: 500,
                          letterSpacing: 0.5,
                          borderRadius: 6,
                          textAlign: 'center',
                          textDecoration: 'none',
                        }}>Resubscribe — $35/week</Link>
                      </div>
                    ) : (
                      <>
                        <div className="lead-section-title">Set disposition</div>
                        <div className="disp-grid">
                          {DISPOSITIONS.filter(d => d.label !== 'NO_ANSWER').map(d => (
                            <button
                              key={d.label}
                              className="disp-btn"
                              onClick={() => setEditDisposition(d.label)}
                              style={{
                                background: editDisposition === d.label ? d.color : d.bg,
                                color: editDisposition === d.label ? 'white' : d.color,
                                borderColor: editDisposition === d.label ? d.color : d.bg,
                              }}
                            >{d.label}</button>
                          ))}
                          <button
                            className="disp-btn"
                            onClick={() => setEditDisposition('')}
                            style={{
                              background: editDisposition === '' ? T.muted : 'white',
                              color: editDisposition === '' ? 'white' : T.muted,
                              borderColor: editDisposition === '' ? T.muted : T.border,
                            }}
                          >Clear</button>
                        </div>

                        <div className="lead-section-title" style={{ marginTop: 16 }}>Notes</div>
                        <textarea
                          className="lead-notes-textarea"
                          value={editNotes}
                          onChange={e => setEditNotes(e.target.value)}
                          placeholder="Add notes about this lead…"
                          rows={4}
                        />

                        <div className="lead-edit-actions" style={{ marginTop: 12 }}>
                          <button
                            className="cancel"
                            onClick={() => setExpandedId(null)}
                          >Cancel</button>
                          <button
                            className="save"
                            onClick={() => handleSave(lead.id)}
                            disabled={saving}
                          >{saving ? 'Saving…' : 'Save changes'}</button>
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
            padding: 24, textAlign: 'center',
            fontSize: 12, color: T.muted,
          }}>
            {loading ? 'Loading more…' : 'Scroll to load more'}
          </div>
        )}
        {cursor === null && leads.length > 0 && (
          <div style={{
            padding: 24, textAlign: 'center',
            fontSize: 12, color: T.muted,
          }}>
            End of list · {leads.length.toLocaleString()} of {total.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  )
}