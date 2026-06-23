'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

// =============================================================================
// LEADS PAGE — Pass 2 Phase C6 (page header strip → header-bg)
// =============================================================================
// C6 changes vs C5 — surgical rebind so the page header strip reads as page
// chrome, not sidebar chrome:
//
//   .leads-header background     T.dark → var(--brand-header-bg)
//   .leads-header-stats color    on-sidebar-muted → on-header-muted
//
// What stays the same (intentional — button chrome, not page header):
//   T.dark stays as var(--brand-sidebar-bg). All card-internal CTAs keep
//   their dark-button-with-primary-top-accent pattern:
//     - ▶ SAVE button in lead-edit
//     - ▶ ADD LEAD modal submit button
//     - ▶ DELETE FOREVER modal danger button
//     - Resubscribe link in lapsed lead-edit notice
//
// T constant unchanged. All structural code byte-for-byte from C5.
//
// =============================================================================
// Original C5 binding sweep (preserved):
// Themable T tokens rebound at source.
//
// What's themed:
//   T.bg      → var(--brand-page-bg)
//   T.surface → var(--brand-card-surface)
//   T.border  → var(--brand-card-border)
//   T.dark    → var(--brand-sidebar-bg)  (CTA button chrome)
//   T.text    → var(--brand-on-page-bg)
//   T.muted   → var(--brand-muted-text)
//   T.blue    → var(--brand-primary)
//
// What stays semantic (NEVER themed):
//   T.accent  (#2a4a8a) — phone number color AND attempted-call indicator
//                         color (dial_attempts > 0). Same role as recordings.
//   T.green / T.red / T.amber — disposition palette (CLOSED/DO NOT CALL/
//                               NOT INTERESTED) + delete buttons + danger
//                               modal accents.
//   T.warn    (#ffaa3e) — lapsed banner accent, lapsed editing-locked notice.
//   DISPOSITIONS array hex palette (label/color/bg) — semantic, untouched.
//   dispositionTint() rgba per-row card-bg tints — semantic, untouched.
//   '#e8e8ec' NEW badge bg, '#f8e8e8' modal-error bg — semantic.
//   'white' disp-btn UI affordances — semantic active/inactive contrast.
//   'rgba(0,0,0,0.55)' modal overlay — semantic.
//   Header bottom accent rebinds to var(--brand-header-top-accent) directly.
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
  { label: 'CLOSED', color: '#16a34a', bg: '#dcfce7' },
  { label: 'APPOINTMENT', color: '#2563eb', bg: '#dbeafe' },
  { label: 'NOT INTERESTED', color: '#d97706', bg: '#fef3c7' },
  { label: 'DO NOT CALL', color: '#dc2626', bg: '#fee2e2' },
  { label: 'SKIPPED', color: '#64748b', bg: '#f1f5f9' },
  { label: 'NO_ANSWER', color: '#64748b', bg: '#f1f5f9' },
]

const T = {
  bg: 'var(--brand-page-bg)',
  surface: 'var(--brand-card-surface)',
  border: 'var(--brand-card-border)',
  dark: 'var(--brand-sidebar-bg)',
  text: 'var(--brand-on-page-bg)',
  muted: 'var(--brand-muted-text)',
  accent: '#2a4a8a',
  blue: 'var(--brand-primary)',
  green: '#1a6a1a',
  red: '#8a1a1a',
  warn: '#ffaa3e',
  amber: '#8a6a1a',
}

const FUTURA = `'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif`

const dispositionTint = (disp: string | null): string => {
  switch (disp) {
    case 'CLOSED': return 'rgba(22, 163, 74, 0.12)'
    case 'APPOINTMENT': return 'rgba(37, 99, 235, 0.12)'
    case 'NOT INTERESTED': return 'rgba(217, 119, 6, 0.12)'
    case 'DO NOT CALL': return 'rgba(220, 38, 38, 0.12)'
    case 'NO_ANSWER': return 'rgba(100, 116, 139, 0.07)'
    case 'SKIPPED': return 'rgba(100, 116, 139, 0.05)'
    default: return T.surface
  }
}

interface NewLeadDraft {
  campaign_id: string
  first_name: string
  last_name: string
  phone: string
  email: string
  state: string
  city: string
  notes: string
}

const EMPTY_NEW_LEAD: NewLeadDraft = {
  campaign_id: '',
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  state: '',
  city: '',
  notes: '',
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

  const [showAddModal, setShowAddModal] = useState(false)
  const [newLead, setNewLead] = useState<NewLeadDraft>(EMPTY_NEW_LEAD)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [deleteConfirmLead, setDeleteConfirmLead] = useState<Lead | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

  // ── Silent refetch on tab visibility ──────────────────────────────────
  // When the user comes back to this tab after editing leads elsewhere
  // (e.g. campaigns editor), silently refresh the first page and merge
  // into the existing list. New leads appear at top, removed leads drop
  // out. The user's pagination state past page 1 and scroll position are
  // preserved. Skipped if any modal is open or any operation is in flight
  // so unsaved edits aren't lost.
  const silentRefetch = useCallback(async () => {
    if (!user) return
    try {
      const params = new URLSearchParams({
        user_id: user.id,
        campaign_id: campaignFilter,
        disposition: dispositionFilter,
        search: debouncedSearch,
        sort,
        cursor: '0',
      })
      const res = await fetch(`/api/leads/list?${params}`)
      const data = await res.json()
      if (data.success) {
        setLeads(prev => {
          const newIds = new Set<string>(data.leads.map((l: Lead) => l.id))
          const tail = prev.filter(l => !newIds.has(l.id))
          return [...data.leads, ...tail]
        })
        setTotal(data.total)
      }
    } catch {
      // silent — focus refetches must never disrupt the user
    }
  }, [user, campaignFilter, dispositionFilter, debouncedSearch, sort])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) return
      // Skip refetch if anything's in-flight or any modal is open.
      // Don't want to nuke the user's draft new lead, delete confirm,
      // or unsaved disposition edits.
      if (showAddModal || deleteConfirmLead || adding || deleting || saving) return
      silentRefetch()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [silentRefetch, showAddModal, deleteConfirmLead, adding, deleting, saving])

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

  const openAddModal = () => {
    if (isLapsed || campaigns.length === 0) return
    setNewLead({
      ...EMPTY_NEW_LEAD,
      campaign_id: campaignFilter !== 'all' ? campaignFilter : campaigns[0]?.id || '',
    })
    setAddError(null)
    setShowAddModal(true)
  }

  const closeAddModal = () => {
    if (adding) return
    setShowAddModal(false)
    setAddError(null)
  }

  const handleAdd = async () => {
    if (!newLead.campaign_id) {
      setAddError('Pick a campaign.')
      return
    }
    if (!newLead.phone.trim()) {
      setAddError('Phone number is required.')
      return
    }
    setAdding(true)
    setAddError(null)
    try {
      const res = await fetch('/api/leads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: newLead.campaign_id,
          first_name: newLead.first_name.trim(),
          last_name: newLead.last_name.trim(),
          phone: newLead.phone.trim(),
          email: newLead.email.trim() || null,
          state: newLead.state.trim() || null,
          city: newLead.city.trim() || null,
          notes: newLead.notes.trim() || '',
        }),
      })
      const data = await res.json()
      if (!data.success) {
        if (res.status === 403) {
          setTier('lapsed')
          setAddError('Subscription required to add leads.')
        } else {
          setAddError(data.error || 'Failed to add lead.')
        }
        setAdding(false)
        return
      }
      setShowAddModal(false)
      setNewLead(EMPTY_NEW_LEAD)
      setLeads([])
      setCursor(0)
      setExpandedId(null)
    } catch (err: any) {
      setAddError(err.message || 'Failed to add lead.')
    } finally {
      setAdding(false)
    }
  }

  const requestDelete = (lead: Lead) => {
    setDeleteError(null)
    setDeleteConfirmLead(lead)
  }

  const cancelDelete = () => {
    if (deleting) return
    setDeleteConfirmLead(null)
    setDeleteError(null)
  }

  const handleDelete = async () => {
    if (!deleteConfirmLead) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/leads/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_ids: [deleteConfirmLead.id] }),
      })
      const data = await res.json()
      if (!data.success) {
        if (res.status === 403) {
          setTier('lapsed')
          setDeleteError('Subscription required to delete leads.')
        } else {
          setDeleteError(data.error || 'Failed to delete lead.')
        }
        setDeleting(false)
        return
      }
      setLeads(prev => prev.filter(l => l.id !== deleteConfirmLead.id))
      setTotal(prev => Math.max(0, prev - 1))
      setExpandedId(null)
      setDeleteConfirmLead(null)
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete lead.')
    } finally {
      setDeleting(false)
    }
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
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: FUTURA,
      color: T.text,
    }}>
      <style>{`
        .leads-root * { box-sizing: border-box; }
        /* C6: page header strip bound to var(--brand-header-bg) */
        .leads-header {
          background: var(--brand-header-bg);
          padding: 12px 20px;
          border-bottom: 2px solid var(--brand-header-top-accent);
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
          font-family: ${FUTURA};
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
          font-family: ${FUTURA};
          border: 1px solid ${T.border};
          background: white;
        }
        .disp-btn:disabled { cursor: not-allowed; opacity: 0.5; }

        .leads-modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.55);
          display: flex; align-items: center; justify-content: center;
          z-index: 200; padding: 16px;
        }
        .leads-modal {
          width: 100%; max-width: 480px;
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-top: 3px solid ${T.blue};
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          max-height: 92vh;
          font-family: ${FUTURA};
        }
        .leads-modal.danger { border-top-color: ${T.red}; }
        .leads-modal-head {
          padding: 16px 20px;
          border-bottom: 1px solid ${T.border};
          display: flex; align-items: center; justify-content: space-between;
        }
        .leads-modal-title {
          font-size: 12px; font-weight: bold;
          letter-spacing: 3px;
          color: ${T.blue};
        }
        .leads-modal-title.danger { color: ${T.red}; }
        .leads-modal-close {
          background: transparent; border: none; color: ${T.muted};
          font-size: 18px; cursor: pointer; padding: 4px 8px;
          font-family: inherit;
        }
        .leads-modal-body {
          padding: 18px 20px;
          overflow-y: auto;
          display: flex; flex-direction: column; gap: 12px;
        }
        .leads-modal-field { display: flex; flex-direction: column; gap: 4px; }
        .leads-modal-label {
          font-size: 9px; letter-spacing: 2px; color: ${T.muted};
          font-weight: bold;
        }
        .leads-modal-input, .leads-modal-select, .leads-modal-textarea {
          width: 100%;
          padding: 9px 11px;
          background: white;
          border: 1px solid ${T.border};
          border-radius: 3px;
          font-family: monospace;
          font-size: 12px;
          color: ${T.text};
          outline: none;
          box-sizing: border-box;
        }
        .leads-modal-input:focus,
        .leads-modal-select:focus,
        .leads-modal-textarea:focus { border-color: ${T.blue}; }
        .leads-modal-textarea { resize: vertical; min-height: 60px; }
        .leads-modal-row-2 {
          display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
        }
        .leads-modal-error {
          padding: 8px 12px;
          background: #f8e8e8;
          border: 1px solid ${T.red};
          border-left: 3px solid ${T.red};
          border-radius: 3px;
          font-size: 11px;
          color: ${T.red};
          letter-spacing: 0.5px;
          line-height: 1.5;
        }
        .leads-modal-footer {
          padding: 14px 20px;
          border-top: 1px solid ${T.border};
          display: flex; gap: 8px; justify-content: flex-end;
          flex-wrap: wrap;
        }

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
          .leads-modal-row-2 { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="leads-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: T.blue }}>
            LEADS DATABASE
          </span>
          <span className="leads-header-stats" style={{
            fontSize: 10, fontFamily: 'monospace', color: 'var(--brand-on-header-muted)', letterSpacing: 1,
          }}>
            {total.toLocaleString()} TOTAL · {leads.length} LOADED
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={openAddModal}
            disabled={isLapsed || campaigns.length === 0}
            title={
              isLapsed ? 'Subscription required'
              : campaigns.length === 0 ? 'Create a campaign first'
              : 'Add a new lead'
            }
            style={{
              padding: '6px 14px',
              background: 'transparent',
              border: `1px solid ${T.blue}`,
              borderRadius: 3,
              color: T.blue,
              fontSize: 10,
              letterSpacing: 2,
              fontWeight: 'bold',
              cursor: (isLapsed || campaigns.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (isLapsed || campaigns.length === 0) ? 0.5 : 1,
              fontFamily: FUTURA,
            }}
          >+ ADD LEAD</button>
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
            fontFamily: FUTURA,
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
            background: 'transparent',
            border: `1px solid ${T.warn}`,
            borderRadius: 3,
            color: T.warn,
            fontSize: 10,
            letterSpacing: 2,
            fontWeight: 'bold',
            textDecoration: 'none',
            fontFamily: FUTURA,
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
                          background: T.dark,
                          border: `1px solid ${T.dark}`,
                          borderTop: `3px solid ${T.blue}`,
                          color: T.blue,
                          fontSize: 10,
                          fontWeight: 'bold',
                          letterSpacing: 3,
                          borderRadius: 3,
                          textAlign: 'center',
                          textDecoration: 'none',
                          fontFamily: FUTURA,
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
                            onClick={() => requestDelete(lead)}
                            disabled={saving}
                            style={{
                              flex: 1, padding: 10,
                              background: 'transparent',
                              border: `1px solid ${T.red}`,
                              borderRadius: 3,
                              color: T.red,
                              fontSize: 10,
                              letterSpacing: 2,
                              fontWeight: 'bold',
                              cursor: saving ? 'not-allowed' : 'pointer',
                              opacity: saving ? 0.5 : 1,
                              fontFamily: FUTURA,
                            }}>DELETE</button>
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
                              fontFamily: FUTURA,
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
                              fontFamily: FUTURA,
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

      {showAddModal && (
        <div className="leads-modal-overlay" onClick={closeAddModal}>
          <div className="leads-modal" onClick={e => e.stopPropagation()}>
            <div className="leads-modal-head">
              <span className="leads-modal-title">+ ADD LEAD</span>
              <button className="leads-modal-close" onClick={closeAddModal}>×</button>
            </div>
            <div className="leads-modal-body">
              <div className="leads-modal-field">
                <label className="leads-modal-label">CAMPAIGN *</label>
                <select
                  className="leads-modal-select"
                  value={newLead.campaign_id}
                  onChange={e => setNewLead(l => ({ ...l, campaign_id: e.target.value }))}
                  disabled={adding}
                >
                  <option value="">— Select a campaign —</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="leads-modal-row-2">
                <div className="leads-modal-field">
                  <label className="leads-modal-label">FIRST NAME</label>
                  <input
                    className="leads-modal-input"
                    type="text"
                    value={newLead.first_name}
                    onChange={e => setNewLead(l => ({ ...l, first_name: e.target.value }))}
                    disabled={adding}
                    maxLength={64}
                  />
                </div>
                <div className="leads-modal-field">
                  <label className="leads-modal-label">LAST NAME</label>
                  <input
                    className="leads-modal-input"
                    type="text"
                    value={newLead.last_name}
                    onChange={e => setNewLead(l => ({ ...l, last_name: e.target.value }))}
                    disabled={adding}
                    maxLength={64}
                  />
                </div>
              </div>

              <div className="leads-modal-field">
                <label className="leads-modal-label">PHONE *</label>
                <input
                  className="leads-modal-input"
                  type="tel"
                  placeholder="+18005551234"
                  value={newLead.phone}
                  onChange={e => setNewLead(l => ({ ...l, phone: e.target.value }))}
                  disabled={adding}
                  maxLength={32}
                />
              </div>

              <div className="leads-modal-field">
                <label className="leads-modal-label">EMAIL</label>
                <input
                  className="leads-modal-input"
                  type="email"
                  value={newLead.email}
                  onChange={e => setNewLead(l => ({ ...l, email: e.target.value }))}
                  disabled={adding}
                  maxLength={128}
                />
              </div>

              <div className="leads-modal-row-2">
                <div className="leads-modal-field">
                  <label className="leads-modal-label">STATE</label>
                  <input
                    className="leads-modal-input"
                    type="text"
                    value={newLead.state}
                    onChange={e => setNewLead(l => ({ ...l, state: e.target.value.toUpperCase() }))}
                    disabled={adding}
                    maxLength={4}
                  />
                </div>
                <div className="leads-modal-field">
                  <label className="leads-modal-label">CITY</label>
                  <input
                    className="leads-modal-input"
                    type="text"
                    value={newLead.city}
                    onChange={e => setNewLead(l => ({ ...l, city: e.target.value }))}
                    disabled={adding}
                    maxLength={64}
                  />
                </div>
              </div>

              <div className="leads-modal-field">
                <label className="leads-modal-label">NOTES</label>
                <textarea
                  className="leads-modal-textarea"
                  value={newLead.notes}
                  onChange={e => setNewLead(l => ({ ...l, notes: e.target.value }))}
                  disabled={adding}
                  rows={3}
                  placeholder="Anything you want to remember about this lead..."
                />
              </div>

              {addError && (
                <div className="leads-modal-error">{addError}</div>
              )}
            </div>

            <div className="leads-modal-footer">
              <button
                onClick={closeAddModal}
                disabled={adding}
                style={{
                  padding: '9px 16px',
                  background: 'transparent',
                  border: `1px solid ${T.border}`,
                  borderRadius: 3,
                  color: T.muted,
                  fontSize: 10,
                  letterSpacing: 2,
                  fontWeight: 'bold',
                  cursor: adding ? 'not-allowed' : 'pointer',
                  fontFamily: FUTURA,
                }}
              >CANCEL</button>
              <button
                onClick={handleAdd}
                disabled={adding || !newLead.campaign_id || !newLead.phone.trim()}
                style={{
                  padding: '9px 18px',
                  background: T.dark,
                  border: 'none',
                  borderTop: `3px solid ${T.blue}`,
                  borderRadius: 3,
                  color: T.blue,
                  fontSize: 10,
                  letterSpacing: 2,
                  fontWeight: 'bold',
                  cursor: adding ? 'wait' : 'pointer',
                  opacity: (adding || !newLead.campaign_id || !newLead.phone.trim()) ? 0.5 : 1,
                  fontFamily: FUTURA,
                }}
              >{adding ? 'ADDING...' : '▶ ADD LEAD'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmLead && (
        <div className="leads-modal-overlay" onClick={cancelDelete}>
          <div className="leads-modal danger" onClick={e => e.stopPropagation()}>
            <div className="leads-modal-head">
              <span className="leads-modal-title danger">DELETE LEAD</span>
              <button className="leads-modal-close" onClick={cancelDelete}>×</button>
            </div>
            <div className="leads-modal-body">
              <div style={{
                fontSize: 13, lineHeight: 1.6, color: T.text, letterSpacing: 0.3,
              }}>
                Permanently delete <strong style={{ fontFamily: 'monospace' }}>
                  {deleteConfirmLead.first_name} {deleteConfirmLead.last_name}
                </strong> ({deleteConfirmLead.phone})?
              </div>
              <div style={{
                fontSize: 11, color: T.muted, lineHeight: 1.6, marginTop: 4,
              }}>
                This removes the lead and all its dial history. Cannot be undone.
              </div>
              {deleteError && (
                <div className="leads-modal-error">{deleteError}</div>
              )}
            </div>
            <div className="leads-modal-footer">
              <button
                onClick={cancelDelete}
                disabled={deleting}
                style={{
                  padding: '9px 16px',
                  background: 'transparent',
                  border: `1px solid ${T.border}`,
                  borderRadius: 3,
                  color: T.muted,
                  fontSize: 10,
                  letterSpacing: 2,
                  fontWeight: 'bold',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontFamily: FUTURA,
                }}
              >CANCEL</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '9px 18px',
                  background: T.dark,
                  border: 'none',
                  borderTop: `3px solid ${T.red}`,
                  borderRadius: 3,
                  color: T.red,
                  fontSize: 10,
                  letterSpacing: 2,
                  fontWeight: 'bold',
                  cursor: deleting ? 'wait' : 'pointer',
                  opacity: deleting ? 0.5 : 1,
                  fontFamily: FUTURA,
                }}
              >{deleting ? 'DELETING...' : '▶ DELETE FOREVER'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}