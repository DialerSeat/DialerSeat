'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

// =============================================================================
// CAMPAIGNS PAGE — Full dialer color correction
// =============================================================================
// Futura font system-wide (with monospace preserved for data — lead names,
// phone numbers, IDs, script content, sheets editor cells). Terminal palette
// applied across all surfaces, sharp corners, dialer-style buttons and
// section labels. ZERO functional changes from previous version.
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
  blue: 'var(--brand-primary)',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}

const FUTURA = `'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif`

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
  preview: 'PREVIEW',
  power: 'POWER',
  progressive: 'PROGRESSIVE',
  predictive: 'PREDICTIVE',
}

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

function LeadPreviewThumb({
  leads,
  totalLeads,
  emptyHint = 'NO LEADS UPLOADED',
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
          fontSize: 10,
          letterSpacing: 2,
          fontFamily: FUTURA,
          fontWeight: 'bold',
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
        fontFamily: 'monospace',
        color: T.text,
        tableLayout: 'fixed',
      }}>
        <thead>
          <tr style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
            <th style={thStyle}>NAME</th>
            <th style={thStyle}>PHONE</th>
            <th style={thStyle}>STATE</th>
            {extraKey && <th style={thStyle}>{extraKey.toUpperCase()}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((lead, i) => (
            <tr key={lead.id} style={{
              borderBottom: `1px solid ${T.bg}`,
              background: i % 2 === 0 ? 'white' : T.bg,
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
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: 28,
        background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 100%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: 4,
        right: 6,
        fontSize: 9,
        color: 'white',
        fontFamily: 'monospace',
        fontWeight: 'bold',
        letterSpacing: 1,
        background: 'rgba(26, 26, 46, 0.92)',
        padding: '2px 6px',
        borderRadius: 2,
      }}>
        {totalLeads.toLocaleString()} {totalLeads === 1 ? 'LEAD' : 'LEADS'}
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '4px 6px',
  textAlign: 'left',
  fontSize: 8,
  fontWeight: 'bold',
  color: T.muted,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  borderRight: `1px solid ${T.border}`,
  fontFamily: FUTURA,
}

const tdStyle: React.CSSProperties = {
  padding: '3px 6px',
  fontSize: 10,
  borderRight: `1px solid ${T.bg}`,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

export default function CampaignsPage() {
  const { user } = useUser()
  const [tier, setTier] = useState<AccessTier>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [fetching, setFetching] = useState(true)

  const [previews, setPreviews] = useState<Record<string, Lead[]>>({})

  const [showCreate, setShowCreate] = useState(false)
  const [campaignName, setCampaignName] = useState('')
  const [createMode, setCreateMode] = useState<DialerMode>('power')
  const [csvData, setCsvData] = useState<any[]>([])
  const [csvName, setCsvName] = useState('')
  const [dragging, setDragging] = useState(false)
  const [creating, setCreating] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [settingsId, setSettingsId] = useState<string | null>(null)
  const settingsCampaign = campaigns.find(c => c.id === settingsId) || null
  const [settingsScripts, setSettingsScripts] = useState<CampaignScript[]>([])
  const [scriptsLoading, setScriptsLoading] = useState(false)
  const [activeScriptId, setActiveScriptId] = useState<string | null>(null)
  const [editingScriptName, setEditingScriptName] = useState('')
  const [editingScriptBody, setEditingScriptBody] = useState('')
  const [dirtyScript, setDirtyScript] = useState(false)
  const [savingScript, setSavingScript] = useState(false)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorLeads, setEditorLeads] = useState<Lead[]>([])
  const [editorLoading, setEditorLoading] = useState(false)
  const [editorEdits, setEditorEdits] = useState<Record<string, Partial<Lead>>>({})
  const [editorAdds, setEditorAdds] = useState<Lead[]>([])
  const [editorDeletes, setEditorDeletes] = useState<Set<string>>(new Set())
  const [editorSaving, setEditorSaving] = useState(false)
  const [editorSelected, setEditorSelected] = useState<Set<string>>(new Set())

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleteTyped, setDeleteTyped] = useState('')

  const isLapsed = tier === 'lapsed' || tier === 'new'

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

  const loadPreview = useCallback(async (campaignId: string) => {
    if (previews[campaignId]) return
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

  useEffect(() => {
    if (campaigns.length === 0) return
    campaigns.forEach((c, i) => {
      setTimeout(() => loadPreview(c.id), i * 80)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaigns.map(c => c.id).join(',')])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) return
      if (showCreate || settingsId || editorOpen || deleteConfirm) return
      if (creating || savingScript || editorSaving) return
      fetchCampaigns()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreate, settingsId, editorOpen, deleteConfirm, creating, savingScript, editorSaving, user?.id])

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
      setPreviews(prev => {
        const { [campaignId]: _, ...rest } = prev
        return rest
      })
      fetchCampaigns()
      loadPreview(campaignId)
    }
    reader.readAsText(file)
  }

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

  const openEditor = async () => {
    if (!settingsCampaign) return
    setEditorOpen(true)
    setEditorLoading(true)
    setEditorEdits({})
    setEditorAdds([])
    setEditorDeletes(new Set())
    setEditorSelected(new Set())
    try {
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
      if (editorDeletes.size > 0) {
        await fetch('/api/leads/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_ids: Array.from(editorDeletes) }),
        })
      }

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

      for (const add of editorAdds) {
        const { id, campaign_id, ...fields } = add
        await fetch('/api/leads/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign_id: settingsCampaign.id, ...fields }),
        })
      }

      setEditorEdits({})
      setEditorAdds([])
      setEditorDeletes(new Set())
      setPreviews(prev => {
        const { [settingsCampaign.id]: _, ...rest } = prev
        return rest
      })
      loadPreview(settingsCampaign.id)
      fetchCampaigns()
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

  const editorRows = [
    ...editorLeads.filter(l => !editorDeletes.has(l.id)).map(l => ({
      ...l,
      ...(editorEdits[l.id] || {}),
    })),
    ...editorAdds,
  ]

  return (
    <div className="cmp-root" style={{
      flex: 1,
      background: T.bg,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
      fontFamily: FUTURA,
      color: T.text,
    }}>
      <style>{`
        .cmp-root * { box-sizing: border-box; }

        /* ── HEADER (matches analytics / dialer / leads) ──────────────── */
        .cmp-header {
          background: ${T.dark};
          padding: 12px 20px;
          border-bottom: 2px solid ${T.accent};
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .cmp-header-title-block {
          display: flex; flex-direction: column; gap: 3px;
        }
        .cmp-header-title {
          font-size: 11px; font-weight: bold; letter-spacing: 4px;
          color: ${T.blue};
          font-family: ${FUTURA};
        }
        .cmp-header-sub {
          font-size: 10px; font-family: monospace;
          color: #8888aa; letter-spacing: 1px;
        }

        /* ── HEADER BUTTONS — dialer outlined pattern ─────────────────── */
        .cmp-new-btn {
          padding: 6px 14px;
          background: transparent;
          border: 1px solid ${T.blue};
          border-radius: 3px;
          color: ${T.blue};
          font-size: 10px;
          letter-spacing: 2px;
          font-weight: bold;
          cursor: pointer;
          font-family: ${FUTURA};
          text-decoration: none;
          transition: background 0.12s;
        }
        .cmp-new-btn:hover {
          background: rgba(74,158,255,0.10);
        }
        .cmp-new-btn.amber {
          border-color: #ffaa3e;
          color: #ffaa3e;
        }
        .cmp-new-btn.amber:hover {
          background: rgba(255,170,62,0.10);
        }

        /* ── BODY ─────────────────────────────────────────────────────── */
        .cmp-body { padding: 28px 32px 56px; }

        .cmp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 14px;
        }

        /* ── CAMPAIGN CARDS ───────────────────────────────────────────── */
        .cmp-card {
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-top: 3px solid ${T.blue};
          border-radius: 4px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          transition: border-color 0.12s, transform 0.08s;
          position: relative;
        }
        .cmp-card:hover {
          border-color: ${T.muted};
          border-top-color: ${T.blue};
        }
        .cmp-card.inactive {
          border-top-color: ${T.border};
          opacity: 0.82;
        }
        .cmp-card.inactive:hover { opacity: 1; }

        .cmp-card-preview {
          height: 168px;
          padding: 8px;
          background: ${T.bg};
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
          font-size: 8px;
          letter-spacing: 2px;
          font-weight: bold;
          padding: 3px 8px;
          border-radius: 2px;
          background: ${T.surface};
          border: 1px solid ${T.border};
          font-family: ${FUTURA};
        }

        .cmp-card-footer {
          padding: 10px 14px 12px;
          background: ${T.surface};
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
        .cmp-card-meta { flex: 1; min-width: 0; }
        .cmp-card-name {
          font-size: 13px;
          font-weight: bold;
          color: ${T.text};
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: 0.5px;
          font-family: ${FUTURA};
        }
        .cmp-card-sub {
          font-size: 10px;
          color: ${T.muted};
          margin: 3px 0 0;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          font-family: monospace;
          letter-spacing: 0.5px;
        }
        .cmp-card-sub span { white-space: nowrap; }
        .cmp-card-sub .dot { opacity: 0.5; }

        /* ── MODAL ────────────────────────────────────────────────────── */
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center;
          z-index: 100; padding: 16px;
          backdrop-filter: blur(6px);
        }
        .settings-modal {
          width: 100%; max-width: 720px;
          max-height: 90vh; max-height: 90dvh;
          background: white;
          border: 1px solid ${T.border};
          border-radius: 4px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.45);
        }
        .settings-head {
          background: ${T.dark};
          padding: 12px 20px;
          border-bottom: 2px solid ${T.accent};
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .settings-name-input {
          flex: 1;
          font-size: 13px;
          font-weight: bold;
          letter-spacing: 2px;
          color: ${T.blue};
          border: 1px solid transparent;
          background: transparent;
          padding: 6px 10px;
          border-radius: 3px;
          outline: none;
          font-family: ${FUTURA};
          min-width: 0;
        }
        .settings-name-input::placeholder {
          color: #8888aa; letter-spacing: 2px;
        }
        .settings-name-input:hover {
          background: rgba(255,255,255,0.05);
        }
        .settings-name-input:focus {
          background: rgba(255,255,255,0.08);
          border-color: ${T.blue};
        }
        .settings-close {
          background: transparent;
          border: 1px solid #4a4a5e;
          color: #8888aa;
          width: 28px; height: 28px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 16px;
          display: flex; align-items: center; justify-content: center;
          font-family: ${FUTURA};
          padding: 0;
          line-height: 1;
        }
        .settings-close:hover {
          background: rgba(255,255,255,0.05);
          color: white;
        }

        .settings-body {
          flex: 1;
          overflow-y: auto;
          padding: 22px 24px;
          display: flex;
          flex-direction: column;
          gap: 22px;
          background: ${T.bg};
        }

        .settings-section-title {
          font-size: 10px;
          letter-spacing: 3px;
          text-transform: uppercase;
          font-weight: bold;
          color: ${T.muted};
          margin-bottom: 10px;
          font-family: ${FUTURA};
        }

        .settings-section-card {
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 4px;
          padding: 14px 16px;
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
          font-size: 11px;
          letter-spacing: 1.5px;
          color: ${T.text};
          font-weight: bold;
          flex: 1;
          font-family: ${FUTURA};
        }
        .settings-row-label small {
          display: block;
          font-size: 10px;
          color: ${T.muted};
          margin-top: 3px;
          font-weight: normal;
          letter-spacing: 0.5px;
          font-family: monospace;
        }

        /* ── TOGGLE — dialer LIVE/OFFLINE pattern ─────────────────────── */
        .settings-toggle {
          width: 38px; height: 20px;
          border-radius: 10px;
          background: ${T.border};
          position: relative;
          cursor: pointer;
          transition: background 0.15s;
          flex-shrink: 0;
        }
        .settings-toggle.on { background: ${T.blue}; }
        .settings-toggle .knob {
          width: 14px; height: 14px;
          border-radius: 50%;
          background: white;
          position: absolute;
          top: 3px; left: 3px;
          transition: left 0.15s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .settings-toggle.on .knob { left: 21px; }

        .settings-mode-select {
          padding: 6px 10px;
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-radius: 3px;
          font-size: 11px;
          letter-spacing: 1.5px;
          font-weight: bold;
          color: ${T.text};
          cursor: pointer;
          font-family: ${FUTURA};
          outline: none;
          min-width: 150px;
        }
        .settings-mode-select:hover { border-color: ${T.muted}; }
        .settings-mode-select:focus { border-color: ${T.blue}; }

        /* ── LEAD PREVIEW WRAP — clickable thumb in settings ──────────── */
        .lead-preview-wrap {
          height: 200px;
          position: relative;
        }
        .lead-preview-wrap .open-editor-hint {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          background: ${T.dark};
          color: ${T.blue};
          padding: 8px 16px;
          border: 1px solid ${T.blue};
          border-radius: 3px;
          font-size: 10px;
          letter-spacing: 2.5px;
          font-weight: bold;
          opacity: 0;
          transition: opacity 0.15s;
          pointer-events: none;
          z-index: 5;
          font-family: ${FUTURA};
        }
        .lead-preview-wrap:hover .open-editor-hint { opacity: 1; }
        .lead-preview-wrap:hover > div { border-color: ${T.blue} !important; }

        /* ── SCRIPT TABS ──────────────────────────────────────────────── */
        .script-tabs {
          display: flex;
          gap: 4px;
          padding-bottom: 8px;
          border-bottom: 1px solid ${T.border};
          overflow-x: auto;
        }
        .script-tab {
          padding: 6px 12px;
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-bottom: none;
          border-radius: 3px 3px 0 0;
          font-size: 10px;
          letter-spacing: 1.5px;
          font-weight: bold;
          color: ${T.muted};
          cursor: pointer;
          white-space: nowrap;
          display: flex; align-items: center; gap: 5px;
          font-family: ${FUTURA};
          text-transform: uppercase;
        }
        .script-tab.active {
          background: white;
          color: ${T.blue};
          border-color: ${T.blue};
          margin-bottom: -1px;
        }
        .script-tab .def-mark {
          font-size: 8px;
          padding: 1px 5px;
          background: ${T.green};
          color: white;
          border-radius: 2px;
          letter-spacing: 1px;
          font-weight: bold;
        }
        .script-add {
          padding: 6px 12px;
          background: transparent;
          border: 1px dashed ${T.border};
          border-bottom: none;
          border-radius: 3px 3px 0 0;
          font-size: 10px;
          letter-spacing: 1.5px;
          font-weight: bold;
          color: ${T.muted};
          cursor: pointer;
          font-family: ${FUTURA};
        }
        .script-add:hover { color: ${T.blue}; border-color: ${T.blue}; }

        .script-name-input, .script-body-textarea {
          width: 100%;
          padding: 10px 12px;
          background: white;
          border: 1px solid ${T.border};
          border-radius: 3px;
          font-size: 12px;
          color: ${T.text};
          outline: none;
          font-family: ${FUTURA};
          box-sizing: border-box;
          margin-bottom: 10px;
        }
        .script-body-textarea {
          font-family: monospace;
          font-size: 12px;
          line-height: 1.7;
          resize: vertical;
        }
        .script-name-input:focus, .script-body-textarea:focus {
          border-color: ${T.blue};
        }

        .script-actions { display: flex; gap: 8px; flex-wrap: wrap; }

        /* ── BUTTONS — dialer pattern (dark bg + border-top accent) ───── */
        .ds-btn {
          padding: 9px 16px;
          border-radius: 3px;
          font-size: 10px;
          letter-spacing: 2px;
          font-weight: bold;
          cursor: pointer;
          font-family: ${FUTURA};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          text-decoration: none;
          transition: background 0.12s, opacity 0.12s;
          border: 1px solid ${T.border};
          background: ${T.bg};
          color: ${T.text};
          border-top: 3px solid ${T.border};
        }
        .ds-btn:hover { background: ${T.surface}; }
        .ds-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .ds-btn.primary {
          background: ${T.dark};
          border-color: ${T.dark};
          color: ${T.blue};
          border-top: 3px solid ${T.blue};
        }
        .ds-btn.primary:hover { background: #252740; }
        .ds-btn.primary:disabled { background: ${T.muted}; border-color: ${T.muted}; color: white; border-top-color: ${T.muted}; }

        .ds-btn.danger {
          background: #f8e8e8;
          border-color: rgba(138,26,26,0.3);
          color: ${T.red};
          border-top: 3px solid ${T.red};
        }
        .ds-btn.danger:hover { background: #f0d8d8; }

        .ds-btn.amber {
          background: #fdf4e8;
          border-color: rgba(138,106,26,0.3);
          color: ${T.amber};
          border-top: 3px solid ${T.amber};
        }
        .ds-btn.amber:hover { background: #f5ead8; }

        .ds-btn input[type="file"] { display: none; }

        .settings-footer {
          padding: 14px 20px;
          background: ${T.surface};
          border-top: 1px solid ${T.border};
          display: flex;
          gap: 8px;
          justify-content: space-between;
          flex-wrap: wrap;
        }
        .settings-footer-left, .settings-footer-right {
          display: flex; gap: 8px; flex-wrap: wrap;
        }

        /* ── SHEETS EDITOR — fullscreen lead editor ───────────────────── */
        .editor-fullscreen {
          position: fixed; inset: 0;
          background: white;
          z-index: 200;
          display: flex;
          flex-direction: column;
        }
        .editor-toolbar {
          padding: 10px 20px;
          background: ${T.dark};
          border-bottom: 2px solid ${T.accent};
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .editor-toolbar-title {
          font-size: 11px;
          font-weight: bold;
          letter-spacing: 3px;
          color: ${T.blue};
          font-family: ${FUTURA};
          margin: 0;
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .editor-tb-btn {
          padding: 6px 12px;
          background: transparent;
          border: 1px solid #4a4a5e;
          border-radius: 3px;
          font-size: 9px;
          letter-spacing: 2px;
          font-weight: bold;
          color: #8888aa;
          cursor: pointer;
          font-family: ${FUTURA};
          transition: background 0.12s, color 0.12s, border-color 0.12s;
        }
        .editor-tb-btn:hover {
          background: rgba(255,255,255,0.05);
          color: white;
          border-color: #6a6a7e;
        }
        .editor-tb-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .editor-tb-btn.primary {
          background: transparent;
          border-color: ${T.blue};
          color: ${T.blue};
        }
        .editor-tb-btn.primary:hover {
          background: rgba(74,158,255,0.12);
          color: ${T.blue};
        }
        .editor-tb-btn.primary:disabled {
          border-color: #4a4a5e;
          color: #6a6a7e;
        }
        .editor-tb-btn.danger {
          border-color: rgba(255,100,100,0.4);
          color: #ff8888;
        }
        .editor-tb-btn.danger:hover {
          background: rgba(138,26,26,0.18);
          color: #ffaaaa;
        }
        .editor-tb-changes {
          font-size: 9px;
          color: #ffaa3e;
          letter-spacing: 1.5px;
          font-weight: bold;
          padding: 4px 9px;
          background: rgba(255,170,62,0.10);
          border: 1px solid rgba(255,170,62,0.4);
          border-radius: 3px;
          font-family: ${FUTURA};
        }

        .editor-grid-wrap {
          flex: 1;
          overflow: auto;
          background: white;
        }
        .editor-grid {
          border-collapse: collapse;
          font-size: 12px;
          font-family: monospace;
        }
        .editor-grid th, .editor-grid td {
          border: 1px solid ${T.border};
          padding: 0;
          background: white;
        }
        .editor-grid th {
          background: ${T.surface};
          font-weight: bold;
          font-size: 10px;
          color: ${T.muted};
          padding: 7px 10px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          position: sticky;
          top: 0;
          z-index: 2;
          text-align: left;
          font-family: ${FUTURA};
        }
        .editor-grid th.row-header, .editor-grid td.row-header {
          background: ${T.surface};
          color: ${T.muted};
          font-size: 10px;
          text-align: center;
          font-weight: bold;
          width: 44px;
          position: sticky;
          left: 0;
          z-index: 3;
          font-family: monospace;
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
          font-family: monospace;
          font-size: 12px;
          color: ${T.text};
          outline: none;
          box-sizing: border-box;
        }
        .editor-cell-input:focus {
          background: rgba(74,158,255,0.10);
          box-shadow: inset 0 0 0 2px ${T.blue};
        }
        .editor-grid tr.row-edited td { background: rgba(255,170,62,0.10); }
        .editor-grid tr.row-new td { background: rgba(26,106,26,0.08); }
        .editor-grid tr.row-deleted td { background: #fae8e8; opacity: 0.6; }
        .editor-grid tr.row-selected td:not(.row-header) { background: rgba(74,158,255,0.15); }
        .editor-grid tr.row-deleted td:not(.row-header) { text-decoration: line-through; }
        .editor-grid input[type="checkbox"] { margin: 0; cursor: pointer; }

        .editor-empty {
          padding: 100px 20px;
          text-align: center;
          color: ${T.muted};
          font-size: 11px;
          letter-spacing: 3px;
          font-weight: bold;
          font-family: ${FUTURA};
        }

        /* ── EMPTY / LOADING STATES ───────────────────────────────────── */
        .cmp-empty-card {
          text-align: center;
          padding: 60px 24px;
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-top: 3px solid ${T.blue};
          border-radius: 4px;
          max-width: 480px;
          margin: 40px auto;
        }
        .cmp-empty-title {
          font-size: 14px;
          font-weight: bold;
          letter-spacing: 3px;
          color: ${T.text};
          margin: 0 0 12px;
          font-family: ${FUTURA};
        }
        .cmp-empty-sub {
          font-size: 11px;
          color: ${T.muted};
          letter-spacing: 1.5px;
          margin: 0 0 24px;
          line-height: 1.7;
          font-family: monospace;
        }

        /* ── LAPSED BANNER ────────────────────────────────────────────── */
        .cmp-lapsed-banner {
          padding: 12px 16px;
          margin-bottom: 22px;
          background: rgba(255,170,62,0.08);
          border: 1px solid rgba(138,106,26,0.5);
          border-left: 3px solid #ffaa3e;
          border-radius: 4px;
          font-size: 11px;
          letter-spacing: 1px;
          color: ${T.text};
          line-height: 1.7;
          font-family: monospace;
        }
        .cmp-lapsed-banner strong {
          color: #ffaa3e;
          letter-spacing: 2px;
          font-family: ${FUTURA};
        }

        /* ── DROP ZONE (CSV upload in create modal) ───────────────────── */
        .cmp-drop-zone {
          padding: 28px;
          border-radius: 3px;
          cursor: pointer;
          text-align: center;
          transition: all 0.12s;
          font-family: ${FUTURA};
        }

        /* ── HELPER TEXT ──────────────────────────────────────────────── */
        .cmp-helper {
          font-size: 10px;
          color: ${T.muted};
          margin-top: 8px;
          margin-bottom: 0;
          letter-spacing: 1px;
          font-family: monospace;
        }
        .cmp-helper a { color: ${T.blue}; text-decoration: none; }
        .cmp-helper a:hover { text-decoration: underline; }

        /* ── MOBILE ───────────────────────────────────────────────────── */
        @media (max-width: 768px) {
          .cmp-header { padding: 10px 12px; }
          .cmp-header-title { font-size: 10px; letter-spacing: 3px; }
          .cmp-header-sub { font-size: 9px; }
          .cmp-body { padding: 20px 12px 48px; }
          .cmp-grid { grid-template-columns: 1fr; gap: 12px; }
          .settings-modal { max-height: 100vh; max-height: 100dvh; border-radius: 0; }
          .modal-overlay { padding: 0; }
          .editor-toolbar { padding: 10px 12px; gap: 8px; }
          .editor-toolbar-title { font-size: 10px; letter-spacing: 2px; }
        }
      `}</style>

      {/* ─── HEADER ─────────────────────────────────────────────────── */}
      <div className="cmp-header">
        <div className="cmp-header-title-block">
          <span className="cmp-header-title">CAMPAIGNS</span>
          <span className="cmp-header-sub">
            {isLapsed
              ? 'READ-ONLY · RESUBSCRIBE TO RESUME'
              : 'LEAD LISTS · DIALING CAMPAIGNS'}
          </span>
        </div>
        {!isLapsed ? (
          <button className="cmp-new-btn" onClick={() => setShowCreate(true)}>
            + NEW CAMPAIGN
          </button>
        ) : (
          <Link href="/billing" className="cmp-new-btn amber">
            ↻ RESUBSCRIBE
          </Link>
        )}
      </div>

      {/* ─── BODY ─────────────────────────────────────────────────────── */}
      <div className="cmp-body">
        {isLapsed && (
          <div className="cmp-lapsed-banner">
            <strong>READ-ONLY MODE.</strong>{' '}
            Your campaigns are still here. Creating, deleting, importing, and
            dialing require an active subscription.
          </div>
        )}

        {fetching ? (
          <div style={{
            textAlign: 'center', padding: '80px 20px',
            fontSize: 11, letterSpacing: 3, fontWeight: 'bold',
            color: T.muted, fontFamily: FUTURA,
          }}>
            LOADING CAMPAIGNS…
          </div>
        ) : campaigns.length === 0 ? (
          <div className="cmp-empty-card">
            <div className="cmp-empty-title">NO CAMPAIGNS YET</div>
            <div className="cmp-empty-sub">
              {isLapsed
                ? 'RESUBSCRIBE TO CREATE YOUR FIRST CAMPAIGN AND UPLOAD LEADS.'
                : 'CREATE YOUR FIRST CAMPAIGN, UPLOAD A LEADS CSV, AND START DIALING.'}
            </div>
            {!isLapsed ? (
              <button className="cmp-new-btn" onClick={() => setShowCreate(true)}>
                + NEW CAMPAIGN
              </button>
            ) : (
              <Link href="/billing" className="cmp-new-btn amber">
                ↻ RESUBSCRIBE — $35/WEEK
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
                      {isActive ? '● ACTIVE' : '○ INACTIVE'}
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
                        <span>MOD {relativeTime(lastModified)}</span>
                        <span className="dot">·</span>
                        <span>DIAL {relativeTime(lastDialed)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── CREATE MODAL ─────────────────────────────────────────────── */}
      {!isLapsed && showCreate && (
        <div className="modal-overlay" onClick={() => !creating && setShowCreate(false)}>
          <div className="settings-modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="settings-head">
              <input
                className="settings-name-input"
                type="text"
                placeholder="NEW CAMPAIGN NAME"
                value={campaignName}
                onChange={e => setCampaignName(e.target.value)}
                autoFocus
              />
              <button className="settings-close" onClick={() => setShowCreate(false)}>×</button>
            </div>

            <div className="settings-body">
              <div className="settings-section-card">
                <div className="settings-section-title">▸ DIALER MODE</div>
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
                <p className="cmp-helper">
                  Not sure? Start with POWER. Change it anytime.{' '}
                  <Link href="/dialing-modes" target="_blank" rel="noopener">
                    COMPARE MODES
                  </Link>
                </p>
              </div>

              <div className="settings-section-card">
                <div className="settings-section-title">▸ LEADS CSV (OPTIONAL)</div>
                <div
                  className="cmp-drop-zone"
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
                    border: `2px dashed ${dragging || csvData.length > 0 ? T.blue : T.border}`,
                    background: dragging ? 'rgba(74,158,255,0.05)' : T.bg,
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
                      <p style={{
                        fontSize: 12, fontWeight: 'bold', letterSpacing: 2,
                        color: T.blue, margin: '0 0 4px', fontFamily: FUTURA,
                      }}>
                        {csvData.length.toLocaleString()} LEADS LOADED
                      </p>
                      <p style={{
                        fontSize: 10, color: T.muted, margin: 0,
                        fontFamily: 'monospace', letterSpacing: 1,
                      }}>{csvName}</p>
                    </>
                  ) : (
                    <>
                      <p style={{
                        fontSize: 11, color: T.muted, margin: '0 0 4px',
                        letterSpacing: 2, fontWeight: 'bold', fontFamily: FUTURA,
                      }}>
                        DROP YOUR CSV HERE
                      </p>
                      <p style={{
                        fontSize: 9, color: T.muted, opacity: 0.7, margin: 0,
                        letterSpacing: 1.5, fontFamily: FUTURA,
                      }}>
                        OR CLICK TO BROWSE
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
                  className="ds-btn"
                  onClick={() => {
                    setShowCreate(false)
                    setCampaignName('')
                    setCsvData([])
                    setCsvName('')
                    setCreateMode('power')
                  }}
                >CANCEL</button>
                <button
                  className="ds-btn primary"
                  onClick={handleCreate}
                  disabled={!campaignName || creating}
                >{creating ? 'CREATING…' : 'CREATE CAMPAIGN'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── SETTINGS MODAL ───────────────────────────────────────────── */}
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

              <div className="settings-section-card">
                <div className="settings-section-title">▸ CAMPAIGN</div>

                <div className="settings-row">
                  <div className="settings-row-label">
                    ACTIVE
                    <small>Inactive campaigns won't appear in the dialer's campaign list.</small>
                  </div>
                  <div
                    className={`settings-toggle ${settingsCampaign.status === 'active' ? 'on' : ''}`}
                    onClick={() => !isLapsed && toggleStatus(settingsCampaign.id, settingsCampaign.status)}
                  ><div className="knob" /></div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-label">
                    DIALER MODE
                    <small>How this campaign dials. Affects future calls only.</small>
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
                      ANSWERING MACHINE DETECTION
                      <small>ON — calls that hit a voicemail are auto-ended.</small>
                    </div>
                  </div>
                )}
              </div>

              <div className="settings-section-card">
                <div className="settings-section-title">
                  ▸ LEADS · {settingsCampaign.total_leads.toLocaleString()} TOTAL
                  · {settingsCampaign.called_leads.toLocaleString()} CALLED
                </div>
                <div
                  className="lead-preview-wrap"
                  onClick={() => !isLapsed && openEditor()}
                >
                  <div className="open-editor-hint">
                    {isLapsed ? 'SUBSCRIBE TO EDIT' : 'CLICK TO OPEN EDITOR'}
                  </div>
                  <LeadPreviewThumb
                    leads={previews[settingsCampaign.id] || []}
                    totalLeads={settingsCampaign.total_leads}
                    interactive={!isLapsed}
                    height="100%"
                  />
                </div>
              </div>

              <div className="settings-section-card">
                <div className="settings-section-title">▸ CALL SCRIPTS</div>
                {scriptsLoading ? (
                  <div style={{
                    fontSize: 10, letterSpacing: 2, fontWeight: 'bold',
                    color: T.muted, padding: 20, textAlign: 'center',
                    fontFamily: FUTURA,
                  }}>
                    LOADING SCRIPTS…
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
                            {(s.name || 'UNTITLED').toUpperCase()}
                            {s.is_default && <span className="def-mark">DEFAULT</span>}
                          </div>
                        ))}
                        {!isLapsed && (
                          <button className="script-add" onClick={addScript} disabled={savingScript}>
                            + ADD
                          </button>
                        )}
                      </div>
                    )}

                    {settingsScripts.length === 0 ? (
                      <div style={{
                        padding: '32px 20px',
                        textAlign: 'center',
                        background: T.bg,
                        border: `1px dashed ${T.border}`,
                        borderRadius: 3,
                      }}>
                        <p style={{
                          fontSize: 11, letterSpacing: 1.5, color: T.muted,
                          margin: '0 0 14px', fontFamily: 'monospace',
                        }}>
                          No scripts yet. Add one to display during calls.
                        </p>
                        {!isLapsed && (
                          <button
                            className="ds-btn primary"
                            onClick={addScript}
                            disabled={savingScript}
                          >+ ADD A SCRIPT</button>
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
                            <button className="ds-btn" onClick={async () => {
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
                            }}>★ MAKE DEFAULT</button>
                          )}
                          {!isLapsed && (
                            <button className="ds-btn danger" onClick={deleteScript} disabled={savingScript}>
                              DELETE SCRIPT
                            </button>
                          )}
                          {!isLapsed && (
                            <button
                              className="ds-btn primary"
                              onClick={saveScript}
                              disabled={savingScript || !dirtyScript}
                              style={{ marginLeft: 'auto' }}
                            >{savingScript ? 'SAVING…' : dirtyScript ? 'SAVE SCRIPT' : 'SAVED'}</button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

            </div>

            <div className="settings-footer">
              <div className="settings-footer-left">
                {!isLapsed && (
                  <>
                    <label className="ds-btn">
                      ↑ UPLOAD MORE LEADS
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
                      className="ds-btn danger"
                      onClick={() => setDeleteConfirm(settingsCampaign.id)}
                    >DELETE CAMPAIGN</button>
                  </>
                )}
              </div>
              <div className="settings-footer-right">
                <button className="ds-btn" onClick={closeSettings}>CLOSE</button>
                {!isLapsed && (
                  <button
                    className="ds-btn primary"
                    onClick={() => openInDialer(settingsCampaign)}
                  >OPEN IN DIALER →</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRM MODAL ─────────────────────────────────────── */}
      {deleteConfirm && (() => {
        const c = campaigns.find(c => c.id === deleteConfirm)
        if (!c) return null
        return (
          <div className="modal-overlay" onClick={() => { setDeleteConfirm(null); setDeleteTyped('') }}>
            <div className="settings-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
              <div className="settings-head" style={{ borderBottomColor: T.red }}>
                <div style={{
                  flex: 1, fontSize: 11, fontWeight: 'bold', letterSpacing: 3,
                  color: '#ff8888', padding: '6px 10px', fontFamily: FUTURA,
                }}>
                  ⚠ DELETE CAMPAIGN?
                </div>
                <button className="settings-close" onClick={() => { setDeleteConfirm(null); setDeleteTyped('') }}>×</button>
              </div>
              <div className="settings-body">
                <p style={{
                  fontSize: 12, lineHeight: 1.7, color: T.text, margin: 0,
                  letterSpacing: 0.5, fontFamily: 'monospace',
                }}>
                  Delete <strong style={{ color: T.red }}>"{c.name}"</strong>?
                  {c.total_leads >= 100 && (
                    <> It has <strong>{c.total_leads.toLocaleString()} leads.</strong> Type
                    {' '}<code style={{
                      background: T.surface, padding: '2px 6px', borderRadius: 2,
                      fontFamily: 'monospace', fontSize: 11, color: T.text,
                      border: `1px solid ${T.border}`,
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
                      borderRadius: 3,
                      fontSize: 12,
                      fontFamily: 'monospace',
                      outline: 'none',
                      marginTop: 14,
                      boxSizing: 'border-box',
                      background: 'white',
                    }}
                  />
                )}
              </div>
              <div className="settings-footer">
                <div className="settings-footer-left"></div>
                <div className="settings-footer-right">
                  <button
                    className="ds-btn"
                    onClick={() => { setDeleteConfirm(null); setDeleteTyped('') }}
                  >CANCEL</button>
                  <button
                    className="ds-btn danger"
                    onClick={() => handleDelete(c.id, c.total_leads)}
                    disabled={c.total_leads >= 100 && deleteTyped.toLowerCase().trim() !== 'delete'}
                  >DELETE</button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ─── SHEETS EDITOR ────────────────────────────────────────────── */}
      {editorOpen && settingsCampaign && (
        <div className="editor-fullscreen">
          <div className="editor-toolbar">
            <h2 className="editor-toolbar-title">
              {settingsCampaign.name.toUpperCase()} — LEAD EDITOR
            </h2>
            {hasEditorChanges && (
              <span className="editor-tb-changes">
                {Object.keys(editorEdits).length > 0 && `${Object.keys(editorEdits).length} EDIT${Object.keys(editorEdits).length === 1 ? '' : 'S'}`}
                {Object.keys(editorEdits).length > 0 && (editorAdds.length > 0 || editorDeletes.size > 0) && ' · '}
                {editorAdds.length > 0 && `${editorAdds.length} NEW`}
                {editorAdds.length > 0 && editorDeletes.size > 0 && ' · '}
                {editorDeletes.size > 0 && `${editorDeletes.size} TO DELETE`}
                {' · UNSAVED'}
              </span>
            )}
            <button className="editor-tb-btn" onClick={addRow}>+ ADD ROW</button>
            {editorSelected.size > 0 && (
              <button className="editor-tb-btn danger" onClick={deleteSelected}>
                DELETE {editorSelected.size} SELECTED
              </button>
            )}
            <button
              className="editor-tb-btn primary"
              onClick={saveEditor}
              disabled={!hasEditorChanges || editorSaving}
            >{editorSaving ? 'SAVING…' : 'SAVE CHANGES'}</button>
            <button className="editor-tb-btn" onClick={closeEditor}>CLOSE</button>
          </div>

          <div className="editor-grid-wrap">
            {editorLoading ? (
              <div className="editor-empty">LOADING LEADS…</div>
            ) : editorRows.length === 0 ? (
              <div className="editor-empty">
                NO LEADS. CLICK <strong>+ ADD ROW</strong> TO CREATE THE FIRST ONE,
                <br />OR CLOSE AND USE UPLOAD MORE LEADS TO IMPORT A CSV.
              </div>
            ) : (
              <table className="editor-grid">
                <thead>
                  <tr>
                    <th className="row-header">#</th>
                    <th style={{ width: 40 }}></th>
                    <th>FIRST NAME</th>
                    <th>LAST NAME</th>
                    <th>PHONE</th>
                    <th>EMAIL</th>
                    <th>STATE</th>
                    <th>CITY</th>
                    <th>NOTES</th>
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