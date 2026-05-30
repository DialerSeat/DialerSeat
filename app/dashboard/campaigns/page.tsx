'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

// =============================================================================
// CAMPAIGNS PAGE — v25 DRIVE-STYLE GRID
// =============================================================================
// Replaces the v24 themed-thumbnail grid with a Google Drive-style file
// manager. Cards show a real preview of the campaign's lead list (first
// rows of the actual CSV). Click card → Settings modal (the campaign's
// hub: name, status, mode, script, lead preview, actions). Click the lead
// preview inside Settings → full-screen Sheets-style editor (editable
// cells, add row, delete rows, batch save).
//
// Visual changes from v24:
//   - No mode color-coding on cards
//   - No progress ring
//   - No "+ New Campaign" tile in the grid
//   - Footer: "You modified Xago" + "Last dialed Xago"
//   - Empty state: no emoji, clean text
//   - "+ NEW CAMPAIGN" header button: outlined ghost, not blue gradient
//
// Behavior changes:
//   - Single-click card opens Settings, not the dialer
//   - OPEN IN DIALER button inside Settings auto-activates the campaign if
//     it's currently inactive, then navigates
//   - Lead preview thumbnail in Settings is the entry point to the editor
//   - Full-screen editor: real data, edit any user-data field, add row,
//     delete rows, batch save via /api/leads/bulk-update
// =============================================================================

const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
  surface2: '#d4d7df',
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

type AccessTier = 'active' | 'lapsed' | 'new' | null
type DialerMode = 'preview' | 'power' | 'progressive' | 'predictive'

interface Campaign {
  id: string
  name: string
  total_leads: number
  called_leads: number
  status: string
  created_at: string
  updated_at?: string
  last_dialed_at?: string | null
  script?: string
  dialer_mode?: DialerMode
  amd_enabled?: boolean
  predictive_lines_per_agent?: number
}

interface CampaignScript {
  id: string
  name: string
  body: string
  is_default: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

interface Lead {
  id: string
  campaign_id: string
  first_name: string
  last_name: string
  phone: string
  email?: string | null
  state?: string | null
  city?: string | null
  notes?: string
  extra_data?: Record<string, any>
  disposition?: string | null
  dial_attempts?: number
  last_called_at?: string | null
  created_at?: string
}

const MODE_LABELS: Record<DialerMode, string> = {
  preview: 'Preview',
  power: 'Power',
  progressive: 'Progressive',
  predictive: 'Predictive',
}

// ──────────────────────────────────────────────────────────────────────────
// "Modified X ago" — Google Drive-style relative time
// ──────────────────────────────────────────────────────────────────────────
function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.max(0, now - then)
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

// ──────────────────────────────────────────────────────────────────────────
// LEAD-PREVIEW THUMBNAIL — renders first ~7 rows of leads as a faux
// spreadsheet, the same way Drive renders a Sheets preview. Click handler
// is on the parent in Settings; here we're pure-visual.
// ──────────────────────────────────────────────────────────────────────────
function LeadPreviewThumb({
  leads,
  totalLeads,
  emptyHint = 'No leads uploaded',
  onClick,
  interactive = false,
  height = '100%',
}: {
  leads: Lead[]
  totalLeads: number
  emptyHint?: string
  onClick?: () => void
  interactive?: boolean
  height?: number | string
}) {
  if (!leads || leads.length === 0) {
    return (
      <div
        onClick={onClick}
        style={{
          flex: 1,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: T.muted,
          fontSize: 11,
          letterSpacing: 1,
          background: 'white',
          borderRadius: 4,
          border: `1px solid ${T.border}`,
          cursor: interactive ? 'pointer' : 'default',
        }}
      >
        {emptyHint}
      </div>
    )
  }

  // Pick the columns to show. Always show name + phone + state at minimum.
  // Add a 4th column from extra_data if present.
  const rows = leads.slice(0, 8)
  const extraKey = (() => {
    if (!rows[0]?.extra_data) return null
    const candidates = Object.keys(rows[0].extra_data).filter(k => {
      const v = rows[0].extra_data?.[k]
      return v && String(v).trim() && k.length < 20
    })
    return candidates[0] || null
  })()

  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        height,
        overflow: 'hidden',
        background: 'white',
        borderRadius: 4,
        border: `1px solid ${T.border}`,
        cursor: interactive ? 'pointer' : 'default',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 9,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: T.text,
        tableLayout: 'fixed',
      }}>
        <thead>
          <tr style={{ background: '#f8f9fa', borderBottom: `1px solid ${T.border}` }}>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Phone</th>
            <th style={thStyle}>State</th>
            {extraKey && <th style={thStyle}>{extraKey}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((lead, i) => (
            <tr key={lead.id} style={{
              borderBottom: `1px solid #eef0f3`,
              background: i % 2 === 0 ? 'white' : '#fafbfc',
            }}>
              <td style={tdStyle}>
                {lead.first_name} {lead.last_name}
              </td>
              <td style={tdStyle}>{lead.phone}</td>
              <td style={tdStyle}>{lead.state || ''}</td>
              {extraKey && (
                <td style={tdStyle}>
                  {String(lead.extra_data?.[extraKey] || '').slice(0, 16)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {/* Fade to indicate truncation */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: 28,
        background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 100%)',
        pointerEvents: 'none',
      }} />
      {/* Row count badge bottom-right */}
      <div style={{
        position: 'absolute',
        bottom: 4,
        right: 6,
        fontSize: 9,
        color: T.muted,
        fontFamily: 'monospace',
        letterSpacing: 0.5,
        background: 'rgba(255,255,255,0.85)',
        padding: '1px 5px',
        borderRadius: 2,
      }}>
        {totalLeads.toLocaleString()} {totalLeads === 1 ? 'lead' : 'leads'}
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '4px 6px',
  textAlign: 'left',
  fontSize: 9,
  fontWeight: 600,
  color: T.muted,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  borderRight: `1px solid ${T.border}`,
}

const tdStyle: React.CSSProperties = {
  padding: '3px 6px',
  fontSize: 10,
  borderRight: `1px solid #eef0f3`,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const { user } = useUser()
  const [tier, setTier] = useState<AccessTier>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [fetching, setFetching] = useState(true)

  // Per-campaign cached lead previews. Loaded lazily as cards render.
  const [previews, setPreviews] = useState<Record<string, Lead[]>>({})

  // Create modal state
  const [showCreate, setShowCreate] = useState(false)
  const [campaignName, setCampaignName] = useState('')
  const [createMode, setCreateMode] = useState<DialerMode>('power')
  const [csvData, setCsvData] = useState<any[]>([])
  const [csvName, setCsvName] = useState('')
  const [dragging, setDragging] = useState(false)
  const [creating, setCreating] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Settings modal state (the campaign hub)
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const settingsCampaign = campaigns.find(c => c.id === settingsId) || null
  const [settingsScripts, setSettingsScripts] = useState<CampaignScript[]>([])
  const [scriptsLoading, setScriptsLoading] = useState(false)
  const [activeScriptId, setActiveScriptId] = useState<string | null>(null)
  const [editingScriptName, setEditingScriptName] = useState('')
  const [editingScriptBody, setEditingScriptBody] = useState('')
  const [dirtyScript, setDirtyScript] = useState(false)
  const [savingScript, setSavingScript] = useState(false)

  // Sheets-style editor state
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorLeads, setEditorLeads] = useState<Lead[]>([])
  const [editorLoading, setEditorLoading] = useState(false)
  // Edits accumulate in a map keyed by lead_id with patched fields.
  // Adds are stored separately with __new__ prefixed temporary ids.
  const [editorEdits, setEditorEdits] = useState<Record<string, Partial<Lead>>>({})
  const [editorAdds, setEditorAdds] = useState<Lead[]>([])
  const [editorDeletes, setEditorDeletes] = useState<Set<string>>(new Set())
  const [editorSaving, setEditorSaving] = useState(false)
  const [editorSelected, setEditorSelected] = useState<Set<string>>(new Set())

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleteTyped, setDeleteTyped] = useState('')

  const isLapsed = tier === 'lapsed' || tier === 'new'

  // ───────────────────────────────────────────────────────────────────────
  // Bootstrap
  // ───────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    fetchCampaigns()
    fetch('/api/stripe/status')
      .then(r => r.json())
      .then(d => setTier(d.tier || null))
      .catch(() => setTier(null))
  }, [user])

  const fetchCampaigns = async () => {
    setFetching(true)
    try {
      const res = await fetch(`/api/campaigns/list?user_id=${user?.id}`)
      const data = await res.json()
      if (data.success) setCampaigns(data.campaigns)
    } finally {
      setFetching(false)
    }
  }

  // ─── Load lead preview for a campaign (first 8 rows) ───────────────────
  const loadPreview = useCallback(async (campaignId: string) => {
    if (previews[campaignId]) return  // already cached
    try {
      const params = new URLSearchParams({
        user_id: user?.id || '',
        campaign_id: campaignId,
        cursor: '0',
        sort: 'created_asc',
      })
      const res = await fetch(`/api/leads/list?${params}&limit=8`)
      const data = await res.json()
      if (data.success) {
        setPreviews(prev => ({ ...prev, [campaignId]: data.leads.slice(0, 8) }))
      }
    } catch (err) {
      console.error('preview load failed:', err)
    }
  }, [user, previews])

  // Trigger preview loads after campaigns arrive
  useEffect(() => {
    if (campaigns.length === 0) return
    // Stagger by ~80ms so we don't blast the leads endpoint with 20 parallel
    // requests on page load. Drive-style — thumbnails resolve as they show up.
    campaigns.forEach((c, i) => {
      setTimeout(() => loadPreview(c.id), i * 80)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaigns.map(c => c.id).join(',')])

  // ───────────────────────────────────────────────────────────────────────
  // CSV PARSER (shared between create-modal upload and add-leads-to-existing)
  // ───────────────────────────────────────────────────────────────────────
  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n').filter(l => l.trim())
    if (lines.length === 0) return []
    const firstLine = lines[0]
    const delim = firstLine.includes('\t') ? '\t' : ','
    const first = firstLine.split(delim).map(v => v.trim().replace(/"/g, ''))
    const hasPhone = first.some(v => v.replace(/\D/g, '').length >= 10)
    const hasHeaders = !hasPhone
    if (hasHeaders) {
      const headers = first
      return lines.slice(1).map(line => {
        const vals = line.split(delim).map(v => v.trim().replace(/"/g, ''))
        return headers.reduce((obj: any, h, i) => {
          obj[h] = vals[i] || ''
          return obj
        }, {})
      })
    } else {
      return lines.map(l => l.split(delim).map(v => v.trim().replace(/"/g, '')))
    }
  }

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) return
    setCsvName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      setCsvData(parseCSV(text))
    }
    reader.readAsText(file)
  }

  // ───────────────────────────────────────────────────────────────────────
  // CREATE
  // ───────────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!campaignName || !user) return
    setCreating(true)
    try {
      const amd = createMode === 'progressive' || createMode === 'predictive'
      const res = await fetch('/api/campaigns/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: campaignName, dialer_mode: createMode, amd_enabled: amd }),
      })
      const data = await res.json()
      if (!data.success) {
        if (res.status === 403) setTier('lapsed')
        throw new Error(data.error)
      }
      if (csvData.length > 0) {
        await fetch('/api/leads/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign_id: data.campaign.id, leads: csvData }),
        })
      }
      setCampaignName('')
      setCsvData([])
      setCsvName('')
      setCreateMode('power')
      setShowCreate(false)
      fetchCampaigns()
    } finally {
      setCreating(false)
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // STATUS / MODE
  // ───────────────────────────────────────────────────────────────────────
  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    setCampaigns(cs => cs.map(c => c.id === id ? { ...c, status: newStatus } : c))
    await fetch('/api/campaigns/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
  }

  const updateMode = async (id: string, newMode: DialerMode) => {
    const amd = newMode === 'progressive' || newMode === 'predictive'
    setCampaigns(cs => cs.map(c =>
      c.id === id ? { ...c, dialer_mode: newMode, amd_enabled: amd } : c
    ))
    await fetch('/api/campaigns/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, dialer_mode: newMode, amd_enabled: amd }),
    })
  }

  const updateName = async (id: string, newName: string) => {
    setCampaigns(cs => cs.map(c => c.id === id ? { ...c, name: newName } : c))
    await fetch('/api/campaigns/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: newName }),
    })
  }

  // ───────────────────────────────────────────────────────────────────────
  // OPEN IN DIALER — auto-activates if inactive
  // ───────────────────────────────────────────────────────────────────────
  const openInDialer = async (campaign: Campaign) => {
    if (campaign.status !== 'active') {
      await fetch('/api/campaigns/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: campaign.id, status: 'active' }),
      })
    }
    window.location.href = `/dashboard/dialer?campaignId=${campaign.id}`
  }

  // ───────────────────────────────────────────────────────────────────────
  // DELETE CAMPAIGN
  // ───────────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string, leadCount: number) => {
    if (leadCount >= 100 && deleteTyped.toLowerCase().trim() !== 'delete') return
    await fetch('/api/campaigns/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setCampaigns(cs => cs.filter(c => c.id !== id))
    setDeleteConfirm(null)
    setDeleteTyped('')
    setSettingsId(null)
  }

  // ───────────────────────────────────────────────────────────────────────
  // UPLOAD MORE LEADS TO EXISTING
  // ───────────────────────────────────────────────────────────────────────
  const handleUploadMore = async (campaignId: string, file: File) => {
    const reader = new FileReader()
    reader.onload = async e => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      const res = await fetch('/api/leads/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, leads: parsed }),
      })
      if (res.status === 403) setTier('lapsed')
      // Refresh that campaign's preview + counts
      setPreviews(prev => {
        const { [campaignId]: _, ...rest } = prev
        return rest
      })
      fetchCampaigns()
      loadPreview(campaignId)
    }
    reader.readAsText(file)
  }

  // ───────────────────────────────────────────────────────────────────────
  // SETTINGS MODAL (campaign hub) — scripts loader
  // ───────────────────────────────────────────────────────────────────────
  const openSettings = async (campaign: Campaign) => {
    setSettingsId(campaign.id)
    setScriptsLoading(true)
    setSettingsScripts([])
    setActiveScriptId(null)
    setDirtyScript(false)
    try {
      const res = await fetch(`/api/campaigns/scripts/list?campaign_id=${campaign.id}`)
      const data = await res.json()
      if (data.success) {
        const list = data.scripts || []
        setSettingsScripts(list)
        if (list.length > 0) {
          const def = list.find((s: CampaignScript) => s.is_default) || list[0]
          setActiveScriptId(def.id)
          setEditingScriptName(def.name)
          setEditingScriptBody(def.body)
        }
      }
    } finally {
      setScriptsLoading(false)
    }
  }

  const closeSettings = () => {
    if (dirtyScript && !confirm('Unsaved script changes. Discard?')) return
    setSettingsId(null)
    setSettingsScripts([])
    setActiveScriptId(null)
    setDirtyScript(false)
  }

  const switchScript = (id: string) => {
    if (dirtyScript && !confirm('Unsaved changes on this script. Switch anyway?')) return
    const s = settingsScripts.find(x => x.id === id)
    if (!s) return
    setActiveScriptId(id)
    setEditingScriptName(s.name)
    setEditingScriptBody(s.body)
    setDirtyScript(false)
  }

  const addScript = async () => {
    if (!settingsCampaign) return
    const name = prompt('Script name (e.g. "Cold open", "Voicemail")')
    if (!name?.trim()) return
    setSavingScript(true)
    try {
      const res = await fetch('/api/campaigns/scripts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: settingsCampaign.id, name: name.trim(), body: '' }),
      })
      const data = await res.json()
      if (data.success && data.script) {
        const updated = [...settingsScripts, data.script].sort((a, b) => a.sort_order - b.sort_order)
        setSettingsScripts(updated)
        setActiveScriptId(data.script.id)
        setEditingScriptName(data.script.name)
        setEditingScriptBody(data.script.body)
        setDirtyScript(false)
      }
    } finally {
      setSavingScript(false)
    }
  }

  const saveScript = async () => {
    if (!activeScriptId) return
    setSavingScript(true)
    try {
      const res = await fetch('/api/campaigns/scripts/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeScriptId,
          name: editingScriptName.trim() || 'Untitled',
          body: editingScriptBody,
        }),
      })
      const data = await res.json()
      if (data.success && data.script) {
        setSettingsScripts(prev => prev.map(s => s.id === data.script.id ? data.script : s))
        setDirtyScript(false)
        if (data.script.is_default && settingsCampaign) {
          setCampaigns(prev => prev.map(c =>
            c.id === settingsCampaign.id ? { ...c, script: data.script.body } : c
          ))
        }
      }
    } finally {
      setSavingScript(false)
    }
  }

  const deleteScript = async () => {
    if (!activeScriptId) return
    if (!confirm('Delete this script?')) return
    setSavingScript(true)
    try {
      const res = await fetch('/api/campaigns/scripts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeScriptId }),
      })
      const data = await res.json()
      if (data.success) {
        const remaining = settingsScripts.filter(s => s.id !== activeScriptId)
        setSettingsScripts(remaining)
        if (remaining.length > 0) {
          const next = remaining[0]
          setActiveScriptId(next.id)
          setEditingScriptName(next.name)
          setEditingScriptBody(next.body)
        } else {
          setActiveScriptId(null)
          setEditingScriptName('')
          setEditingScriptBody('')
        }
        setDirtyScript(false)
      }
    } finally {
      setSavingScript(false)
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // SHEETS-STYLE EDITOR
  // ───────────────────────────────────────────────────────────────────────
  const openEditor = async () => {
    if (!settingsCampaign) return
    setEditorOpen(true)
    setEditorLoading(true)
    setEditorEdits({})
    setEditorAdds([])
    setEditorDeletes(new Set())
    setEditorSelected(new Set())
    try {
      // Load up to 500 leads for the editor. For very large campaigns
      // we'd need pagination inside the editor; that's a follow-up.
      const params = new URLSearchParams({
        user_id: user?.id || '',
        campaign_id: settingsCampaign.id,
        cursor: '0',
        sort: 'created_asc',
      })
      const res = await fetch(`/api/leads/list?${params}&limit=500`)
      const data = await res.json()
      if (data.success) setEditorLeads(data.leads)
    } finally {
      setEditorLoading(false)
    }
  }

  const closeEditor = () => {
    const hasChanges =
      Object.keys(editorEdits).length > 0 ||
      editorAdds.length > 0 ||
      editorDeletes.size > 0
    if (hasChanges && !confirm('Unsaved changes will be lost. Close anyway?')) return
    setEditorOpen(false)
    setEditorLeads([])
    setEditorEdits({})
    setEditorAdds([])
    setEditorDeletes(new Set())
    setEditorSelected(new Set())
  }

  const editCell = (leadId: string, field: string, value: any) => {
    // For adds (temporary __new__ ids), mutate the row in editorAdds directly.
    if (leadId.startsWith('__new__')) {
      setEditorAdds(prev => prev.map(l =>
        l.id === leadId ? { ...l, [field]: value } : l
      ))
      return
    }
    setEditorEdits(prev => ({
      ...prev,
      [leadId]: { ...prev[leadId], [field]: value },
    }))
  }

  const addRow = () => {
    const tempId = `__new__${Date.now()}-${editorAdds.length}`
    setEditorAdds(prev => [
      ...prev,
      {
        id: tempId,
        campaign_id: settingsCampaign?.id || '',
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
        state: '',
        city: '',
        notes: '',
        extra_data: {},
      } as Lead,
    ])
  }

  const toggleSelect = (id: string) => {
    setEditorSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const deleteSelected = () => {
    if (editorSelected.size === 0) return
    if (!confirm(`Delete ${editorSelected.size} row${editorSelected.size === 1 ? '' : 's'}? Will commit on Save.`)) return
    const newDeletes = new Set(editorDeletes)
    const newAdds = [...editorAdds]
    editorSelected.forEach(id => {
      if (id.startsWith('__new__')) {
        const idx = newAdds.findIndex(a => a.id === id)
        if (idx >= 0) newAdds.splice(idx, 1)
      } else {
        newDeletes.add(id)
      }
    })
    setEditorDeletes(newDeletes)
    setEditorAdds(newAdds)
    setEditorSelected(new Set())
  }

  const saveEditor = async () => {
    if (!settingsCampaign) return
    setEditorSaving(true)
    try {
      // 1. Deletes
      if (editorDeletes.size > 0) {
        await fetch('/api/leads/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_ids: Array.from(editorDeletes) }),
        })
      }

      // 2. Bulk updates
      const updateList = Object.entries(editorEdits).map(([lead_id, fields]) => ({
        lead_id,
        fields,
      }))
      if (updateList.length > 0) {
        await fetch('/api/leads/bulk-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: updateList }),
        })
      }

      // 3. Adds
      for (const add of editorAdds) {
        const { id, campaign_id, ...fields } = add
        await fetch('/api/leads/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign_id: settingsCampaign.id, ...fields }),
        })
      }

      // 4. Refresh
      setEditorEdits({})
      setEditorAdds([])
      setEditorDeletes(new Set())
      setPreviews(prev => {
        const { [settingsCampaign.id]: _, ...rest } = prev
        return rest
      })
      loadPreview(settingsCampaign.id)
      fetchCampaigns()
      // Reload editor leads to pick up server-generated ids
      const params = new URLSearchParams({
        user_id: user?.id || '',
        campaign_id: settingsCampaign.id,
        cursor: '0',
        sort: 'created_asc',
      })
      const res = await fetch(`/api/leads/list?${params}&limit=500`)
      const data = await res.json()
      if (data.success) setEditorLeads(data.leads)
    } finally {
      setEditorSaving(false)
    }
  }

  const hasEditorChanges =
    Object.keys(editorEdits).length > 0 ||
    editorAdds.length > 0 ||
    editorDeletes.size > 0

  // Effective lead in editor (apply edits over base, exclude deletes, append adds)
  const editorRows = [
    ...editorLeads.filter(l => !editorDeletes.has(l.id)).map(l => ({
      ...l,
      ...(editorEdits[l.id] || {}),
    })),
    ...editorAdds,
  ]

  // ───────────────────────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────────────────────

  return (
    <div className="cmp-root" style={{
      flex: 1,
      padding: '32px 40px 56px',
      overflowY: 'auto',
      background: T.bg,
      minHeight: 'calc(100vh - 64px)',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
      color: T.text,
    }}>
      <style>{`
        .cmp-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 28px; gap: 16px; flex-wrap: wrap;
        }
        .cmp-header h1 {
          font-size: 22px; font-weight: 500; color: ${T.text};
          margin: 0; letter-spacing: -0.2px;
        }
        .cmp-header p { font-size: 13px; color: ${T.muted}; margin: 4px 0 0; }

        /* Outlined ghost "+ New Campaign" button — professional, not blue */
        .cmp-new-btn {
          padding: 9px 18px;
          background: white;
          border: 1px solid ${T.border};
          border-radius: 6px;
          color: ${T.text};
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;
        }
        .cmp-new-btn:hover {
          background: #f8f9fa;
          border-color: ${T.muted};
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        .cmp-new-btn .plus { font-size: 16px; line-height: 1; color: ${T.muted}; }

        /* Grid */
        .cmp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 16px;
        }

        /* Card — Drive-style */
        .cmp-card {
          background: white;
          border: 1px solid ${T.border};
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          transition: box-shadow 0.12s, border-color 0.12s;
          position: relative;
        }
        .cmp-card:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          border-color: ${T.muted};
        }
        .cmp-card.inactive { opacity: 0.78; }
        .cmp-card.inactive:hover { opacity: 1; }

        .cmp-card-preview {
          height: 168px;
          padding: 8px;
          background: #f6f7f8;
          border-bottom: 1px solid ${T.border};
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .cmp-card-status-pin {
          position: absolute;
          top: 12px;
          left: 12px;
          z-index: 2;
          font-size: 9px;
          letter-spacing: 0.8px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 10px;
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(4px);
          border: 1px solid rgba(0,0,0,0.08);
        }

        .cmp-card-footer {
          padding: 10px 14px 12px;
          background: white;
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .cmp-card-icon {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          margin-top: 1px;
          color: ${T.muted};
        }
        .cmp-card-meta {
          flex: 1;
          min-width: 0;
        }
        .cmp-card-name {
          font-size: 13px;
          font-weight: 500;
          color: ${T.text};
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.1px;
        }
        .cmp-card-sub {
          font-size: 11px;
          color: ${T.muted};
          margin: 2px 0 0;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .cmp-card-sub span { white-space: nowrap; }
        .cmp-card-sub .dot { opacity: 0.5; }

        /* Settings modal */
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.55);
          display: flex; align-items: center; justify-content: center;
          z-index: 100; padding: 16px;
          backdrop-filter: blur(6px);
        }
        .settings-modal {
          width: 100%; max-width: 720px;
          max-height: 90vh; max-height: 90dvh;
          background: white;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .settings-head {
          padding: 18px 22px;
          border-bottom: 1px solid ${T.border};
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .settings-name-input {
          flex: 1;
          font-size: 17px;
          font-weight: 500;
          color: ${T.text};
          border: 1px solid transparent;
          background: transparent;
          padding: 6px 10px;
          border-radius: 4px;
          outline: none;
          font-family: inherit;
          letter-spacing: -0.2px;
          min-width: 0;
        }
        .settings-name-input:hover {
          background: #f6f7f8;
        }
        .settings-name-input:focus {
          background: white;
          border-color: ${T.blue};
        }
        .settings-close {
          background: transparent;
          border: none;
          color: ${T.muted};
          width: 32px; height: 32px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 20px;
          display: flex; align-items: center; justify-content: center;
        }
        .settings-close:hover { background: #f0f0f0; color: ${T.text}; }

        .settings-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .settings-section-title {
          font-size: 11px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          font-weight: 600;
          color: ${T.muted};
          margin-bottom: 8px;
        }

        .settings-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
        }
        .settings-row + .settings-row {
          border-top: 1px solid ${T.border};
        }
        .settings-row-label {
          font-size: 13px;
          color: ${T.text};
          flex: 1;
        }
        .settings-row-label small {
          display: block;
          font-size: 11px;
          color: ${T.muted};
          margin-top: 2px;
        }

        .settings-toggle {
          width: 38px; height: 22px;
          border-radius: 12px;
          background: ${T.border};
          position: relative;
          cursor: pointer;
          transition: background 0.15s;
          flex-shrink: 0;
        }
        .settings-toggle.on { background: ${T.green}; }
        .settings-toggle .knob {
          width: 16px; height: 16px;
          border-radius: 50%;
          background: white;
          position: absolute;
          top: 3px; left: 3px;
          transition: left 0.15s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .settings-toggle.on .knob { left: 19px; }

        .settings-mode-select {
          padding: 7px 10px;
          background: white;
          border: 1px solid ${T.border};
          border-radius: 6px;
          font-size: 13px;
          color: ${T.text};
          cursor: pointer;
          font-family: inherit;
          outline: none;
          min-width: 140px;
        }
        .settings-mode-select:hover { border-color: ${T.muted}; }

        .lead-preview-wrap {
          height: 200px;
          position: relative;
        }
        .lead-preview-wrap .open-editor-hint {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(26,26,46,0.92);
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 11px;
          letter-spacing: 1px;
          font-weight: 600;
          opacity: 0;
          transition: opacity 0.15s;
          pointer-events: none;
          z-index: 5;
        }
        .lead-preview-wrap:hover .open-editor-hint { opacity: 1; }
        .lead-preview-wrap:hover > div { border-color: ${T.blue} !important; }

        /* Script editor inside settings */
        .script-tabs {
          display: flex;
          gap: 4px;
          padding-bottom: 8px;
          border-bottom: 1px solid ${T.border};
          overflow-x: auto;
        }
        .script-tab {
          padding: 6px 12px;
          background: #f6f7f8;
          border: 1px solid ${T.border};
          border-bottom: none;
          border-radius: 6px 6px 0 0;
          font-size: 12px;
          color: ${T.muted};
          cursor: pointer;
          white-space: nowrap;
          display: flex; align-items: center; gap: 5px;
          font-family: inherit;
        }
        .script-tab.active {
          background: white;
          color: ${T.blue};
          border-color: ${T.blue};
          margin-bottom: -1px;
        }
        .script-tab .def-mark {
          font-size: 9px;
          padding: 1px 5px;
          background: ${T.green};
          color: white;
          border-radius: 3px;
          letter-spacing: 0.5px;
        }
        .script-add {
          padding: 6px 12px;
          background: transparent;
          border: 1px dashed ${T.border};
          border-bottom: none;
          border-radius: 6px 6px 0 0;
          font-size: 12px;
          color: ${T.muted};
          cursor: pointer;
          font-family: inherit;
        }
        .script-add:hover { color: ${T.blue}; border-color: ${T.blue}; }

        .script-name-input, .script-body-textarea {
          width: 100%;
          padding: 10px 12px;
          background: white;
          border: 1px solid ${T.border};
          border-radius: 6px;
          font-size: 13px;
          color: ${T.text};
          outline: none;
          font-family: inherit;
          box-sizing: border-box;
          margin-bottom: 10px;
        }
        .script-name-input:focus, .script-body-textarea:focus { border-color: ${T.blue}; }
        .script-body-textarea { line-height: 1.6; resize: vertical; }
        .script-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .script-actions button {
          padding: 8px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
          border: 1px solid ${T.border};
          background: white;
          color: ${T.text};
        }
        .script-actions button:hover { background: #f6f7f8; }
        .script-actions button.primary {
          background: ${T.dark};
          color: white;
          border-color: ${T.dark};
        }
        .script-actions button.primary:hover { background: #2a2a4a; }
        .script-actions button.danger { color: ${T.red}; border-color: rgba(138,26,26,0.3); }
        .script-actions button.danger:hover { background: #fae8e8; }
        .script-actions button:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Footer actions */
        .settings-footer {
          padding: 14px 20px;
          background: #f8f9fa;
          border-top: 1px solid ${T.border};
          display: flex;
          gap: 8px;
          justify-content: space-between;
          flex-wrap: wrap;
        }
        .settings-footer-left, .settings-footer-right {
          display: flex; gap: 8px; flex-wrap: wrap;
        }
        .settings-action {
          padding: 9px 16px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
          border: 1px solid ${T.border};
          background: white;
          color: ${T.text};
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .settings-action:hover { background: #f6f7f8; }
        .settings-action.danger {
          color: ${T.red};
          border-color: rgba(138,26,26,0.25);
        }
        .settings-action.danger:hover { background: #fae8e8; }
        .settings-action.primary {
          background: ${T.dark};
          color: white;
          border-color: ${T.dark};
        }
        .settings-action.primary:hover { background: #2a2a4a; }
        .settings-action input[type="file"] { display: none; }

        /* Sheets-style editor — full screen */
        .editor-fullscreen {
          position: fixed; inset: 0;
          background: white;
          z-index: 200;
          display: flex;
          flex-direction: column;
        }
        .editor-toolbar {
          padding: 10px 16px;
          background: #f6f7f8;
          border-bottom: 1px solid ${T.border};
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .editor-toolbar h2 {
          font-size: 14px;
          font-weight: 500;
          color: ${T.text};
          margin: 0;
          flex: 1;
          min-width: 0;
          letter-spacing: -0.1px;
        }
        .editor-tb-btn {
          padding: 7px 12px;
          background: white;
          border: 1px solid ${T.border};
          border-radius: 5px;
          font-size: 12px;
          color: ${T.text};
          cursor: pointer;
          font-family: inherit;
        }
        .editor-tb-btn:hover { background: #f0f0f0; }
        .editor-tb-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .editor-tb-btn.primary {
          background: ${T.dark};
          color: white;
          border-color: ${T.dark};
        }
        .editor-tb-btn.primary:hover { background: #2a2a4a; }
        .editor-tb-btn.primary:disabled { background: ${T.muted}; border-color: ${T.muted}; }
        .editor-tb-btn.danger {
          color: ${T.red};
          border-color: rgba(138,26,26,0.3);
        }
        .editor-tb-btn.danger:hover { background: #fae8e8; }
        .editor-tb-changes {
          font-size: 11px;
          color: ${T.amber};
          letter-spacing: 0.5px;
          font-weight: 500;
          padding: 4px 9px;
          background: #fff8e8;
          border: 1px solid #f0d680;
          border-radius: 4px;
        }

        .editor-grid-wrap {
          flex: 1;
          overflow: auto;
          background: white;
        }
        .editor-grid {
          border-collapse: collapse;
          font-size: 13px;
          font-family: inherit;
        }
        .editor-grid th, .editor-grid td {
          border: 1px solid ${T.border};
          padding: 0;
          background: white;
        }
        .editor-grid th {
          background: #f6f7f8;
          font-weight: 600;
          font-size: 11px;
          color: ${T.muted};
          padding: 6px 10px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          position: sticky;
          top: 0;
          z-index: 2;
          text-align: left;
        }
        .editor-grid th.row-header, .editor-grid td.row-header {
          background: #f6f7f8;
          color: ${T.muted};
          font-size: 11px;
          text-align: center;
          font-weight: 500;
          width: 44px;
          position: sticky;
          left: 0;
          z-index: 3;
        }
        .editor-grid th.row-header { z-index: 4; }
        .editor-grid td.row-header.deleted {
          background: #fae8e8;
          color: ${T.red};
        }
        .editor-cell-input {
          width: 100%;
          padding: 7px 10px;
          border: none;
          background: transparent;
          font-family: inherit;
          font-size: 13px;
          color: ${T.text};
          outline: none;
          box-sizing: border-box;
        }
        .editor-cell-input:focus {
          background: #e8f2ff;
          box-shadow: inset 0 0 0 2px ${T.blue};
        }
        .editor-grid tr.row-edited td { background: #fff8e8; }
        .editor-grid tr.row-new td { background: #f0fae8; }
        .editor-grid tr.row-deleted td { background: #fae8e8; opacity: 0.6; }
        .editor-grid tr.row-selected td:not(.row-header) { background: #d8e8f8; }
        .editor-grid tr.row-deleted td:not(.row-header) { text-decoration: line-through; }
        .editor-grid input[type="checkbox"] {
          margin: 0;
          cursor: pointer;
        }

        .editor-empty {
          padding: 100px 20px;
          text-align: center;
          color: ${T.muted};
          font-size: 14px;
        }

        @media (max-width: 768px) {
          .cmp-root { padding: 20px 16px 48px; }
          .cmp-grid { grid-template-columns: 1fr; gap: 12px; }
          .settings-modal { max-height: 100vh; max-height: 100dvh; border-radius: 0; }
          .modal-overlay { padding: 0; }
          .editor-toolbar { padding: 10px 12px; gap: 8px; }
        }
      `}</style>

      {/* HEADER */}
      <div className="cmp-header">
        <div>
          <h1>Campaigns</h1>
          <p>
            {isLapsed
              ? 'Read-only — resubscribe to create or dial campaigns.'
              : 'Your lead lists and dialing campaigns.'}
          </p>
        </div>
        {!isLapsed ? (
          <button className="cmp-new-btn" onClick={() => setShowCreate(true)}>
            <span className="plus">+</span> New campaign
          </button>
        ) : (
          <Link href="/billing" className="cmp-new-btn" style={{ textDecoration: 'none' }}>
            Resubscribe →
          </Link>
        )}
      </div>

      {/* LAPSED BANNER */}
      {isLapsed && (
        <div style={{
          padding: '14px 18px',
          marginBottom: 20,
          background: 'rgba(255,170,62,0.06)',
          border: '1px solid #8a6a1a',
          borderLeft: '3px solid #ffaa3e',
          borderRadius: 6,
          fontSize: 13,
          color: T.text,
          lineHeight: 1.5,
        }}>
          <strong style={{ color: '#ffaa3e' }}>Read-only mode.</strong>{' '}
          Your campaigns are still here. Creating, deleting, importing, and
          dialing require an active subscription.
        </div>
      )}

      {/* GRID / EMPTY STATE */}
      {fetching ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', fontSize: 13, color: T.muted }}>
          Loading campaigns…
        </div>
      ) : campaigns.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '80px 24px',
          background: 'white',
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          maxWidth: 480,
          margin: '40px auto',
        }}>
          <h2 style={{
            fontSize: 18,
            fontWeight: 500,
            color: T.text,
            margin: '0 0 12px',
            letterSpacing: '-0.2px',
          }}>No campaigns yet</h2>
          <p style={{
            fontSize: 13,
            color: T.muted,
            margin: '0 0 24px',
            lineHeight: 1.6,
          }}>
            {isLapsed
              ? 'Resubscribe to create your first campaign and upload your leads.'
              : 'Create your first campaign, upload a leads CSV, and start dialing.'}
          </p>
          {!isLapsed ? (
            <button className="cmp-new-btn" onClick={() => setShowCreate(true)}>
              <span className="plus">+</span> New campaign
            </button>
          ) : (
            <Link href="/billing" className="cmp-new-btn" style={{ textDecoration: 'none' }}>
              Resubscribe — $35/week
            </Link>
          )}
        </div>
      ) : (
        <div className="cmp-grid">
          {campaigns.map(campaign => {
            const isActive = campaign.status === 'active'
            const leadsForPreview = previews[campaign.id] || []
            const lastModified = campaign.updated_at || campaign.created_at
            const lastDialed = campaign.last_dialed_at || null

            return (
              <div
                key={campaign.id}
                className={`cmp-card ${!isActive ? 'inactive' : ''}`}
                onClick={() => openSettings(campaign)}
              >
                <div className="cmp-card-preview">
                  <span className="cmp-card-status-pin" style={{
                    color: isActive ? T.green : T.muted,
                  }}>
                    {isActive ? '● Active' : '○ Inactive'}
                  </span>
                  <LeadPreviewThumb
                    leads={leadsForPreview}
                    totalLeads={campaign.total_leads}
                    height="100%"
                  />
                </div>

                <div className="cmp-card-footer">
                  <svg className="cmp-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                  </svg>
                  <div className="cmp-card-meta">
                    <h3 className="cmp-card-name">{campaign.name}</h3>
                    <div className="cmp-card-sub">
                      <span>You modified {relativeTime(lastModified)}</span>
                      <span className="dot">·</span>
                      <span>Last dialed {relativeTime(lastDialed)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── CREATE MODAL ───────────────────────────────────────────────── */}
      {!isLapsed && showCreate && (
        <div className="modal-overlay" onClick={() => !creating && setShowCreate(false)}>
          <div className="settings-modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="settings-head">
              <input
                className="settings-name-input"
                type="text"
                placeholder="Campaign name"
                value={campaignName}
                onChange={e => setCampaignName(e.target.value)}
                autoFocus
              />
              <button className="settings-close" onClick={() => setShowCreate(false)}>×</button>
            </div>

            <div className="settings-body">
              <div>
                <div className="settings-section-title">Dialer mode</div>
                <select
                  className="settings-mode-select"
                  value={createMode}
                  onChange={e => setCreateMode(e.target.value as DialerMode)}
                  style={{ width: '100%' }}
                >
                  {(Object.keys(MODE_LABELS) as DialerMode[]).map(m => (
                    <option key={m} value={m}>{MODE_LABELS[m]}</option>
                  ))}
                </select>
                <p style={{ fontSize: 11, color: T.muted, marginTop: 6, marginBottom: 0 }}>
                  Not sure? Start with Power. You can change it anytime.{' '}
                  <Link href="/dialing-modes" target="_blank" rel="noopener" style={{ color: T.blue }}>
                    Compare modes
                  </Link>
                </p>
              </div>

              <div>
                <div className="settings-section-title">Leads CSV (optional)</div>
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => {
                    e.preventDefault()
                    setDragging(false)
                    const f = e.dataTransfer.files[0]
                    if (f) handleFile(f)
                  }}
                  onClick={() => fileRef.current?.click()}
                  style={{
                    padding: 28,
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: `2px dashed ${dragging || csvData.length > 0 ? T.blue : T.border}`,
                    background: dragging ? 'rgba(74,158,255,0.04)' : '#f8f9fa',
                    textAlign: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) handleFile(f)
                    }}
                  />
                  {csvData.length > 0 ? (
                    <>
                      <p style={{ fontSize: 13, fontWeight: 500, color: T.blue, margin: '0 0 4px' }}>
                        {csvData.length.toLocaleString()} leads loaded
                      </p>
                      <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>{csvName}</p>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 13, color: T.muted, margin: '0 0 4px' }}>
                        Drop your CSV here
                      </p>
                      <p style={{ fontSize: 11, color: T.muted, opacity: 0.7, margin: 0 }}>
                        or click to browse
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="settings-footer">
              <div className="settings-footer-left"></div>
              <div className="settings-footer-right">
                <button
                  className="settings-action"
                  onClick={() => {
                    setShowCreate(false)
                    setCampaignName('')
                    setCsvData([])
                    setCsvName('')
                    setCreateMode('power')
                  }}
                >Cancel</button>
                <button
                  className="settings-action primary"
                  onClick={handleCreate}
                  disabled={!campaignName || creating}
                  style={{ opacity: !campaignName || creating ? 0.5 : 1 }}
                >{creating ? 'Creating…' : 'Create campaign'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── SETTINGS MODAL ─────────────────────────────────────────────── */}
      {settingsCampaign && !editorOpen && (
        <div className="modal-overlay" onClick={closeSettings}>
          <div className="settings-modal" onClick={e => e.stopPropagation()}>
            <div className="settings-head">
              <input
                className="settings-name-input"
                type="text"
                value={settingsCampaign.name}
                onChange={e => updateName(settingsCampaign.id, e.target.value)}
                disabled={isLapsed}
              />
              <button className="settings-close" onClick={closeSettings}>×</button>
            </div>

            <div className="settings-body">

              {/* ─── STATUS / MODE row group ─── */}
              <div>
                <div className="settings-section-title">Campaign</div>

                <div className="settings-row">
                  <div className="settings-row-label">
                    Active
                    <small>Inactive campaigns won&apos;t appear in the dialer&apos;s campaign list.</small>
                  </div>
                  <div
                    className={`settings-toggle ${settingsCampaign.status === 'active' ? 'on' : ''}`}
                    onClick={() => !isLapsed && toggleStatus(settingsCampaign.id, settingsCampaign.status)}
                  ><div className="knob" /></div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-label">
                    Dialer mode
                    <small>How this campaign dials. Change anytime — affects future calls only.</small>
                  </div>
                  <select
                    className="settings-mode-select"
                    value={settingsCampaign.dialer_mode || 'power'}
                    onChange={e => updateMode(settingsCampaign.id, e.target.value as DialerMode)}
                    disabled={isLapsed}
                  >
                    {(Object.keys(MODE_LABELS) as DialerMode[]).map(m => (
                      <option key={m} value={m}>{MODE_LABELS[m]}</option>
                    ))}
                  </select>
                </div>

                {settingsCampaign.amd_enabled && (
                  <div className="settings-row">
                    <div className="settings-row-label">
                      Answering Machine Detection
                      <small>On — calls that hit a voicemail are auto-ended.</small>
                    </div>
                  </div>
                )}
              </div>

              {/* ─── LEADS PREVIEW (click to open editor) ─── */}
              <div>
                <div className="settings-section-title">
                  Leads &middot; {settingsCampaign.total_leads.toLocaleString()} total
                  &middot; {settingsCampaign.called_leads.toLocaleString()} called
                </div>
                <div
                  className="lead-preview-wrap"
                  onClick={() => !isLapsed && openEditor()}
                >
                  <div className="open-editor-hint">
                    {isLapsed ? 'Subscribe to edit' : 'Click to open editor'}
                  </div>
                  <LeadPreviewThumb
                    leads={previews[settingsCampaign.id] || []}
                    totalLeads={settingsCampaign.total_leads}
                    interactive={!isLapsed}
                    height="100%"
                  />
                </div>
              </div>

              {/* ─── SCRIPTS ─── */}
              <div>
                <div className="settings-section-title">Call scripts</div>
                {scriptsLoading ? (
                  <div style={{ fontSize: 12, color: T.muted, padding: 20, textAlign: 'center' }}>
                    Loading scripts…
                  </div>
                ) : (
                  <>
                    {settingsScripts.length > 0 && (
                      <div className="script-tabs">
                        {settingsScripts.map(s => (
                          <div
                            key={s.id}
                            className={`script-tab ${activeScriptId === s.id ? 'active' : ''}`}
                            onClick={() => switchScript(s.id)}
                          >
                            {s.name || 'Untitled'}
                            {s.is_default && <span className="def-mark">DEFAULT</span>}
                          </div>
                        ))}
                        {!isLapsed && (
                          <button className="script-add" onClick={addScript} disabled={savingScript}>
                            + Add
                          </button>
                        )}
                      </div>
                    )}

                    {settingsScripts.length === 0 ? (
                      <div style={{
                        padding: '30px 20px',
                        textAlign: 'center',
                        background: '#f8f9fa',
                        border: `1px dashed ${T.border}`,
                        borderRadius: 8,
                      }}>
                        <p style={{ fontSize: 13, color: T.muted, margin: '0 0 12px' }}>
                          No scripts yet. Add one to display during calls.
                        </p>
                        {!isLapsed && (
                          <button
                            onClick={addScript}
                            disabled={savingScript}
                            style={{
                              padding: '7px 14px',
                              background: T.dark,
                              color: 'white',
                              border: 'none',
                              borderRadius: 6,
                              fontSize: 12,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >+ Add a script</button>
                        )}
                      </div>
                    ) : activeScriptId && (
                      <div style={{ marginTop: 12 }}>
                        <input
                          className="script-name-input"
                          type="text"
                          value={editingScriptName}
                          onChange={e => { setEditingScriptName(e.target.value); setDirtyScript(true) }}
                          placeholder="Script name"
                          disabled={isLapsed}
                        />
                        <textarea
                          className="script-body-textarea"
                          value={editingScriptBody}
                          onChange={e => { setEditingScriptBody(e.target.value); setDirtyScript(true) }}
                          placeholder="Hi [Name], my name is [Agent] and I'm calling from…"
                          rows={10}
                          disabled={isLapsed}
                        />
                        <div className="script-actions">
                          {!settingsScripts.find(s => s.id === activeScriptId)?.is_default && !isLapsed && (
                            <button onClick={async () => {
                              if (!activeScriptId) return
                              setSavingScript(true)
                              try {
                                const res = await fetch('/api/campaigns/scripts/update', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: activeScriptId, is_default: true }),
                                })
                                const data = await res.json()
                                if (data.success) {
                                  setSettingsScripts(prev => prev.map(s => ({
                                    ...s, is_default: s.id === activeScriptId,
                                  })))
                                }
                              } finally {
                                setSavingScript(false)
                              }
                            }}>★ Make default</button>
                          )}
                          {!isLapsed && (
                            <button className="danger" onClick={deleteScript} disabled={savingScript}>
                              Delete script
                            </button>
                          )}
                          {!isLapsed && (
                            <button
                              className="primary"
                              onClick={saveScript}
                              disabled={savingScript || !dirtyScript}
                              style={{ marginLeft: 'auto' }}
                            >{savingScript ? 'Saving…' : dirtyScript ? 'Save script' : 'Saved'}</button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

            </div>

            {/* ─── FOOTER ACTIONS ─── */}
            <div className="settings-footer">
              <div className="settings-footer-left">
                {!isLapsed && (
                  <>
                    <label className="settings-action">
                      Upload more leads
                      <input
                        type="file"
                        accept=".csv"
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) handleUploadMore(settingsCampaign.id, f)
                        }}
                      />
                    </label>
                    <button
                      className="settings-action danger"
                      onClick={() => setDeleteConfirm(settingsCampaign.id)}
                    >Delete campaign</button>
                  </>
                )}
              </div>
              <div className="settings-footer-right">
                <button className="settings-action" onClick={closeSettings}>Close</button>
                {!isLapsed && (
                  <button
                    className="settings-action primary"
                    onClick={() => openInDialer(settingsCampaign)}
                  >Open in dialer →</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRMATION ───────────────────────────────────────── */}
      {deleteConfirm && (() => {
        const c = campaigns.find(c => c.id === deleteConfirm)
        if (!c) return null
        return (
          <div className="modal-overlay" onClick={() => { setDeleteConfirm(null); setDeleteTyped('') }}>
            <div className="settings-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
              <div className="settings-head">
                <div style={{ flex: 1, fontSize: 16, fontWeight: 500, color: T.red, padding: '6px 10px' }}>
                  Delete campaign?
                </div>
                <button className="settings-close" onClick={() => { setDeleteConfirm(null); setDeleteTyped('') }}>×</button>
              </div>
              <div className="settings-body">
                <p style={{ fontSize: 13, lineHeight: 1.6, color: T.text, margin: 0 }}>
                  Delete <strong>&quot;{c.name}&quot;</strong>?
                  {c.total_leads >= 100 && (
                    <> It has <strong>{c.total_leads.toLocaleString()} leads.</strong> Type
                    {' '}<code style={{
                      background: '#f0f0f0', padding: '1px 5px', borderRadius: 3,
                      fontFamily: 'monospace', fontSize: 12,
                    }}>delete</code> to confirm.</>
                  )}
                  {c.total_leads < 100 && ' This cannot be undone.'}
                </p>
                {c.total_leads >= 100 && (
                  <input
                    type="text"
                    placeholder='type "delete"'
                    value={deleteTyped}
                    onChange={e => setDeleteTyped(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: `1px solid ${T.border}`,
                      borderRadius: 6,
                      fontSize: 13,
                      fontFamily: 'monospace',
                      outline: 'none',
                      marginTop: 12,
                      boxSizing: 'border-box',
                    }}
                  />
                )}
              </div>
              <div className="settings-footer">
                <div className="settings-footer-left"></div>
                <div className="settings-footer-right">
                  <button
                    className="settings-action"
                    onClick={() => { setDeleteConfirm(null); setDeleteTyped('') }}
                  >Cancel</button>
                  <button
                    className="settings-action danger"
                    onClick={() => handleDelete(c.id, c.total_leads)}
                    disabled={c.total_leads >= 100 && deleteTyped.toLowerCase().trim() !== 'delete'}
                    style={{
                      opacity: c.total_leads >= 100 && deleteTyped.toLowerCase().trim() !== 'delete' ? 0.4 : 1,
                    }}
                  >Delete</button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ─── SHEETS-STYLE EDITOR ───────────────────────────────────────── */}
      {editorOpen && settingsCampaign && (
        <div className="editor-fullscreen">
          <div className="editor-toolbar">
            <h2>{settingsCampaign.name} — Lead editor</h2>
            {hasEditorChanges && (
              <span className="editor-tb-changes">
                {Object.keys(editorEdits).length > 0 && `${Object.keys(editorEdits).length} edit${Object.keys(editorEdits).length === 1 ? '' : 's'}`}
                {Object.keys(editorEdits).length > 0 && (editorAdds.length > 0 || editorDeletes.size > 0) && ' · '}
                {editorAdds.length > 0 && `${editorAdds.length} new`}
                {editorAdds.length > 0 && editorDeletes.size > 0 && ' · '}
                {editorDeletes.size > 0 && `${editorDeletes.size} to delete`}
                {' · unsaved'}
              </span>
            )}
            <button className="editor-tb-btn" onClick={addRow}>+ Add row</button>
            {editorSelected.size > 0 && (
              <button className="editor-tb-btn danger" onClick={deleteSelected}>
                Delete {editorSelected.size} selected
              </button>
            )}
            <button
              className="editor-tb-btn primary"
              onClick={saveEditor}
              disabled={!hasEditorChanges || editorSaving}
            >{editorSaving ? 'Saving…' : 'Save changes'}</button>
            <button className="editor-tb-btn" onClick={closeEditor}>Close</button>
          </div>

          <div className="editor-grid-wrap">
            {editorLoading ? (
              <div className="editor-empty">Loading leads…</div>
            ) : editorRows.length === 0 ? (
              <div className="editor-empty">
                No leads. Click <strong>+ Add row</strong> to create the first one,
                or close and use Upload more leads to import a CSV.
              </div>
            ) : (
              <table className="editor-grid">
                <thead>
                  <tr>
                    <th className="row-header">#</th>
                    <th style={{ width: 40 }}></th>
                    <th>First name</th>
                    <th>Last name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>State</th>
                    <th>City</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {editorRows.map((lead, i) => {
                    const isNew = lead.id.startsWith('__new__')
                    const isDeleted = editorDeletes.has(lead.id)
                    const isEdited = !isNew && !!editorEdits[lead.id]
                    const isSelected = editorSelected.has(lead.id)
                    let cls = ''
                    if (isDeleted) cls = 'row-deleted'
                    else if (isNew) cls = 'row-new'
                    else if (isEdited) cls = 'row-edited'
                    if (isSelected && !isDeleted) cls += ' row-selected'

                    return (
                      <tr key={lead.id} className={cls}>
                        <td className={`row-header ${isDeleted ? 'deleted' : ''}`}>
                          {isDeleted ? '✕' : i + 1}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {!isDeleted && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(lead.id)}
                            />
                          )}
                        </td>
                        <td>
                          <input
                            className="editor-cell-input"
                            value={lead.first_name || ''}
                            onChange={e => editCell(lead.id, 'first_name', e.target.value)}
                            disabled={isDeleted}
                          />
                        </td>
                        <td>
                          <input
                            className="editor-cell-input"
                            value={lead.last_name || ''}
                            onChange={e => editCell(lead.id, 'last_name', e.target.value)}
                            disabled={isDeleted}
                          />
                        </td>
                        <td>
                          <input
                            className="editor-cell-input"
                            value={lead.phone || ''}
                            onChange={e => editCell(lead.id, 'phone', e.target.value)}
                            disabled={isDeleted}
                          />
                        </td>
                        <td>
                          <input
                            className="editor-cell-input"
                            value={lead.email || ''}
                            onChange={e => editCell(lead.id, 'email', e.target.value)}
                            disabled={isDeleted}
                          />
                        </td>
                        <td>
                          <input
                            className="editor-cell-input"
                            value={lead.state || ''}
                            onChange={e => editCell(lead.id, 'state', e.target.value)}
                            disabled={isDeleted}
                            style={{ maxWidth: 80 }}
                          />
                        </td>
                        <td>
                          <input
                            className="editor-cell-input"
                            value={lead.city || ''}
                            onChange={e => editCell(lead.id, 'city', e.target.value)}
                            disabled={isDeleted}
                          />
                        </td>
                        <td>
                          <input
                            className="editor-cell-input"
                            value={lead.notes || ''}
                            onChange={e => editCell(lead.id, 'notes', e.target.value)}
                            disabled={isDeleted}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

    </div>
  )
}