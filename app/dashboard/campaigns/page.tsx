'use client'
import { useState, useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

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

type AccessTier = 'active' | 'lapsed' | 'new' | null

interface Campaign {
  id: string
  name: string
  total_leads: number
  called_leads: number
  status: string
  created_at: string
  script?: string
}

export default function CampaignsPage() {
  const { user } = useUser()
  const [tier, setTier] = useState<AccessTier>(null)
  const [showModal, setShowModal] = useState(false)
  const [campaignName, setCampaignName] = useState('')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [dragging, setDragging] = useState(false)
  const [csvData, setCsvData] = useState<any[]>([])
  const [csvName, setCsvName] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [scriptModal, setScriptModal] = useState<Campaign | null>(null)
  const [scriptText, setScriptText] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleteTyped, setDeleteTyped] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const isLapsed = tier === 'lapsed' || tier === 'new'

  useEffect(() => {
    if (user) {
      fetchCampaigns()
      fetch('/api/stripe/status')
        .then(r => r.json())
        .then(d => setTier(d.tier || null))
        .catch(() => setTier(null))
    }
  }, [user])

  const fetchCampaigns = async () => {
    setFetching(true)
    try {
      const res = await fetch(`/api/campaigns/list?user_id=${user?.id}`)
      const data = await res.json()
      if (data.success) setCampaigns(data.campaigns)
    } catch (error) {
      console.error(error)
    } finally {
      setFetching(false)
    }
  }

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n').filter(line => line.trim())
    if (lines.length === 0) return []
    const firstLine = lines[0]
    const delimiter = firstLine.includes('\t') ? '\t' : ','
    const firstRowValues = firstLine.split(delimiter).map(v => v.trim().replace(/"/g, ''))
    const hasPhone = firstRowValues.some(v => v.replace(/\D/g, '').length >= 10)
    const hasHeaders = !hasPhone
    if (hasHeaders) {
      const headers = firstRowValues
      return lines.slice(1).map(line => {
        const values = line.split(delimiter).map(v => v.trim().replace(/"/g, ''))
        return headers.reduce((obj: any, header, i) => {
          obj[header] = values[i] || ''
          return obj
        }, {})
      })
    } else {
      return lines.map(line => line.split(delimiter).map(v => v.trim().replace(/"/g, '')))
    }
  }

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) return
    setCsvName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setCsvData(parseCSV(text))
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleCreate = async () => {
    if (!campaignName || !user) return
    setLoading(true)
    try {
      const res = await fetch('/api/campaigns/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: campaignName }),
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
      setShowModal(false)
      fetchCampaigns()
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    setCampaigns(campaigns.map(c => c.id === id ? { ...c, status: newStatus } : c))
    await fetch('/api/campaigns/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
  }

  const handleDelete = async (id: string, leadCount: number) => {
    if (leadCount >= 100 && deleteTyped.toLowerCase().trim() !== 'delete') {
      return
    }
    await fetch('/api/campaigns/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setCampaigns(campaigns.filter(c => c.id !== id))
    setDeleteConfirm(null)
    setDeleteTyped('')
  }

  const handleSaveScript = async () => {
    if (!scriptModal) return
    await fetch('/api/campaigns/script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: scriptModal.id, script: scriptText }),
    })
    setCampaigns(campaigns.map(c => c.id === scriptModal.id ? { ...c, script: scriptText } : c))
    setScriptModal(null)
    setScriptText('')
  }

  const handleUploadMore = async (campaignId: string, file: File) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      const res = await fetch('/api/leads/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, leads: parsed }),
      })
      if (res.status === 403) setTier('lapsed')
      fetchCampaigns()
    }
    reader.readAsText(file)
  }

  const startDelete = (id: string) => {
    setDeleteConfirm(id)
    setDeleteTyped('')
  }

  return (
    <div className="campaigns-root" style={{
      flex: 1,
      background: T.bg,
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
      fontFamily: 'Futura PT, Futura, sans-serif',
    }}>
      <style>{`
        .campaigns-root * { box-sizing: border-box; }
        .campaigns-header {
          background: ${T.dark};
          padding: 12px 20px;
          border-bottom: 2px solid ${T.accent};
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .campaigns-content {
          flex: 1;
          padding: 16px 20px;
          max-width: 1200px;
          width: 100%;
          margin: 0 auto;
          box-sizing: border-box;
        }
        .campaign-row {
          padding: 16px 20px;
          border-radius: 4px;
          background: ${T.surface};
          border: 1px solid ${T.border};
          margin-bottom: 8px;
          transition: border-color 0.2s;
        }
        .campaign-row.active {
          border-left: 3px solid ${T.blue};
        }
        .campaign-row-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }
        .campaign-left { display: flex; align-items: center; gap: 16px; min-width: 0; flex: 1; }
        .campaign-actions { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; }
        .campaign-stat { text-align: center; }
        .campaign-modal {
          width: 100%;
          max-width: 500px;
          padding: 32px;
          border-radius: 4px;
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-top: 3px solid ${T.blue};
          max-height: 90vh;
          overflow-y: auto;
        }

        @media (max-width: 768px) {
          .campaigns-header { padding: 10px 12px; }
          .campaigns-content { padding: 12px; }
          .new-campaign-btn { width: 100%; }
          .campaign-row { padding: 14px; }
          .campaign-row-inner {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }
          .campaign-left { width: 100%; }
          .campaign-actions {
            flex-wrap: wrap;
            gap: 8px;
            justify-content: flex-start;
            width: 100%;
          }
          .campaign-stat { flex: 1; text-align: center; }
          .campaign-stats-row {
            display: flex;
            gap: 12px;
            width: 100%;
            justify-content: space-around;
            padding: 12px 0;
            border-top: 1px solid ${T.border};
            border-bottom: 1px solid ${T.border};
          }
          .campaign-modal {
            padding: 20px !important;
            max-height: 100vh;
            border-radius: 0 !important;
            min-height: 100vh;
          }
          .modal-overlay { padding: 0 !important; }
        }
      `}</style>

      <div className="campaigns-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: T.blue }}>
            CAMPAIGNS
          </span>
          <span style={{
            fontSize: 10, fontFamily: 'monospace', color: '#8888aa', letterSpacing: 1,
          }}>
            {isLapsed ? 'READ-ONLY MODE' : `${campaigns.length} TOTAL · ${campaigns.filter(c => c.status === 'active').length} ACTIVE`}
          </span>
        </div>
        {!isLapsed ? (
          <button onClick={() => setShowModal(true)} className="new-campaign-btn" style={{
            padding: '8px 18px', borderRadius: 6,
            background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
            color: 'white', fontSize: 11, fontWeight: 'bold', letterSpacing: 2,
            border: 'none', cursor: 'pointer',
            fontFamily: 'Futura PT, Futura, sans-serif',
            boxShadow: '0 0 15px rgba(74,158,255,0.25)',
          }}>+ NEW CAMPAIGN</button>
        ) : (
          <Link href="/billing" className="new-campaign-btn" style={{
            padding: '8px 18px', borderRadius: 6,
            background: 'linear-gradient(135deg, #ffaa3e, #ff8a1a)',
            color: 'white', fontSize: 11, fontWeight: 'bold', letterSpacing: 2,
            border: 'none', cursor: 'pointer',
            fontFamily: 'Futura PT, Futura, sans-serif',
            textDecoration: 'none',
            display: 'inline-block',
          }}>↻ RESUBSCRIBE</Link>
        )}
      </div>

      <div className="campaigns-content">

        {isLapsed && (
          <div style={{
            padding: '12px 16px',
            marginBottom: 16,
            background: '#fff8e8',
            border: `1px solid ${T.amber}`,
            borderLeft: `3px solid #ffaa3e`,
            borderRadius: 4,
            fontSize: 12,
            color: T.text,
            letterSpacing: 0.5,
            lineHeight: 1.6,
          }}>
            <strong style={{ color: T.amber, fontSize: 10, letterSpacing: 3, fontWeight: 700 }}>
              ▸ READ-ONLY MODE
            </strong>
            <div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 11 }}>
              Your campaigns are still here. Pause/unpause is allowed; create, delete, import, and dial require an active subscription.
            </div>
          </div>
        )}

        {fetching ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ fontSize: 11, letterSpacing: 3, color: T.muted }}>LOADING CAMPAIGNS...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px', borderRadius: 4,
            background: T.surface, border: `1px solid ${T.border}`,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>📋</div>
            <h2 style={{ fontSize: 13, fontWeight: 'bold', letterSpacing: 4, color: T.text, marginBottom: 12 }}>NO CAMPAIGNS YET</h2>
            <p style={{ fontSize: 12, color: T.muted, marginBottom: 24, lineHeight: 1.7, fontFamily: 'monospace' }}>
              {isLapsed
                ? <>Resubscribe to create your first campaign,<br />upload leads, and start dialing.</>
                : <>Create your first campaign, upload your leads CSV,<br />and start dialing in minutes.</>}
            </p>
            {!isLapsed ? (
              <button onClick={() => setShowModal(true)} style={{
                padding: '12px 28px', borderRadius: 6,
                background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
                color: 'white', fontSize: 11, fontWeight: 'bold',
                letterSpacing: 2, border: 'none', cursor: 'pointer',
                fontFamily: 'Futura PT, Futura, sans-serif',
              }}>CREATE FIRST CAMPAIGN</button>
            ) : (
              <Link href="/billing" style={{
                display: 'inline-block',
                padding: '12px 28px', borderRadius: 6,
                background: 'linear-gradient(135deg, #ffaa3e, #ff8a1a)',
                color: 'white', fontSize: 11, fontWeight: 'bold',
                letterSpacing: 2, border: 'none', cursor: 'pointer',
                fontFamily: 'Futura PT, Futura, sans-serif',
                textDecoration: 'none',
              }}>RESUBSCRIBE — $35/WEEK</Link>
            )}
          </div>
        ) : (
          <div>
            {campaigns.map((campaign) => (
              <div key={campaign.id} className={`campaign-row ${campaign.status === 'active' ? 'active' : ''}`}>
                <div className="campaign-row-inner">
                  <div className="campaign-left">
                    {/* Toggle — kept blue gradient as requested */}
                    <div onClick={() => toggleStatus(campaign.id, campaign.status)} style={{
                      width: 44, height: 24, borderRadius: 12,
                      background: campaign.status === 'active' ? 'var(--accent-blue, #4a9eff)' : T.border,
                      position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', background: 'white',
                        position: 'absolute', top: 3,
                        left: campaign.status === 'active' ? 23 : 3, transition: 'left 0.2s',
                      }} />
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3 style={{
                        fontSize: 13, fontWeight: 'bold', letterSpacing: 1,
                        color: T.text, marginBottom: 3,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {campaign.name}
                      </h3>
                      <p style={{ fontSize: 10, letterSpacing: 1, color: T.muted, fontFamily: 'monospace' }}>
                        CREATED {new Date(campaign.created_at).toLocaleDateString()}
                        {campaign.script ? ' · SCRIPT ADDED' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="campaign-stats-row" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div className="campaign-stat">
                      <div style={{ fontSize: 18, fontWeight: 'bold', color: T.text, fontFamily: 'monospace' }}>
                        {campaign.total_leads.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 8, letterSpacing: 2, color: T.muted, fontWeight: 'bold' }}>LEADS</div>
                    </div>

                    <div className="campaign-stat">
                      <div style={{ fontSize: 18, fontWeight: 'bold', color: T.blue, fontFamily: 'monospace' }}>
                        {campaign.called_leads.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 8, letterSpacing: 2, color: T.muted, fontWeight: 'bold' }}>CALLED</div>
                    </div>

                    <div style={{
                      padding: '4px 10px', borderRadius: 3,
                      background: campaign.status === 'active' ? 'rgba(74,158,255,0.12)' : 'transparent',
                      border: `1px solid ${campaign.status === 'active' ? T.blue : T.border}`,
                      fontSize: 9, letterSpacing: 2, fontWeight: 'bold',
                      color: campaign.status === 'active' ? T.blue : T.muted,
                      whiteSpace: 'nowrap',
                    }}>
                      {campaign.status === 'active' ? '● ACTIVE' : '○ INACTIVE'}
                    </div>
                  </div>

                  <div className="campaign-actions">
                    {!isLapsed && (
                      <button
                        onClick={() => { setScriptModal(campaign); setScriptText(campaign.script || '') }}
                        style={{
                          padding: '6px 12px', borderRadius: 3,
                          background: campaign.script ? 'rgba(74,158,255,0.1)' : 'transparent',
                          border: `1px solid ${campaign.script ? T.blue : T.border}`,
                          color: campaign.script ? T.blue : T.muted,
                          fontSize: 10, letterSpacing: 1, cursor: 'pointer',
                          fontFamily: 'Futura PT, Futura, sans-serif',
                          whiteSpace: 'nowrap', fontWeight: 'bold',
                        }}>
                        📝 {campaign.script ? 'EDIT SCRIPT' : 'ADD SCRIPT'}
                      </button>
                    )}

                    {!isLapsed && (
                      <label style={{
                        padding: '6px 12px', borderRadius: 3,
                        background: 'transparent', border: `1px solid ${T.border}`,
                        color: T.muted, fontSize: 10,
                        letterSpacing: 1, cursor: 'pointer',
                        fontFamily: 'Futura PT, Futura, sans-serif',
                        whiteSpace: 'nowrap', fontWeight: 'bold',
                      }}>
                        + CSV
                        <input type="file" accept=".csv" style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleUploadMore(campaign.id, file)
                          }} />
                      </label>
                    )}

                    {/* DIAL NOW — kept blue gradient as requested */}
                    {!isLapsed ? (
                      <a href="/dashboard/dialer" style={{
                        padding: '6px 16px', borderRadius: 3,
                        background: campaign.status === 'active' ? 'linear-gradient(135deg, #4a9eff, #2a6eff)' : T.surface,
                        border: campaign.status === 'active' ? 'none' : `1px solid ${T.border}`,
                        color: campaign.status === 'active' ? 'white' : T.muted,
                        fontSize: 10, letterSpacing: 1, cursor: 'pointer',
                        fontFamily: 'Futura PT, Futura, sans-serif', textDecoration: 'none',
                        boxShadow: campaign.status === 'active' ? '0 0 10px rgba(74,158,255,0.3)' : 'none',
                        whiteSpace: 'nowrap', fontWeight: 'bold',
                      }}>DIAL NOW</a>
                    ) : (
                      <span style={{
                        padding: '6px 16px', borderRadius: 3,
                        background: T.surface,
                        border: `1px solid ${T.border}`,
                        color: T.muted,
                        fontSize: 10, letterSpacing: 1,
                        fontFamily: 'Futura PT, Futura, sans-serif',
                        whiteSpace: 'nowrap', fontWeight: 'bold',
                        opacity: 0.6,
                      }}>🔒 DIAL LOCKED</span>
                    )}

                    {!isLapsed && (
                      deleteConfirm === campaign.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: campaign.total_leads >= 100 ? 200 : 'auto' }}>
                          {campaign.total_leads >= 100 && (
                            <input
                              type="text"
                              placeholder='type "delete" to confirm'
                              value={deleteTyped}
                              onChange={e => setDeleteTyped(e.target.value)}
                              autoFocus
                              style={{
                                padding: '6px 8px', borderRadius: 3,
                                background: T.bg,
                                border: `1px solid ${T.red}`,
                                color: T.text,
                                fontSize: 10,
                                fontFamily: 'monospace',
                                outline: 'none',
                                letterSpacing: 1,
                              }}
                            />
                          )}
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => handleDelete(campaign.id, campaign.total_leads)}
                              disabled={campaign.total_leads >= 100 && deleteTyped.toLowerCase().trim() !== 'delete'}
                              style={{
                                padding: '6px 12px', borderRadius: 3, border: 'none',
                                background: T.red, color: 'white', fontSize: 10,
                                letterSpacing: 1, fontWeight: 'bold',
                                cursor: campaign.total_leads >= 100 && deleteTyped.toLowerCase().trim() !== 'delete' ? 'not-allowed' : 'pointer',
                                opacity: campaign.total_leads >= 100 && deleteTyped.toLowerCase().trim() !== 'delete' ? 0.4 : 1,
                                fontFamily: 'Futura PT, Futura, sans-serif',
                                flex: 1,
                              }}>CONFIRM</button>
                            <button onClick={() => { setDeleteConfirm(null); setDeleteTyped('') }} style={{
                              padding: '6px 12px', borderRadius: 3,
                              background: 'transparent', border: `1px solid ${T.border}`,
                              color: T.muted, fontSize: 10,
                              letterSpacing: 1, cursor: 'pointer', fontWeight: 'bold',
                              fontFamily: 'Futura PT, Futura, sans-serif',
                            }}>CANCEL</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => startDelete(campaign.id)} style={{
                          padding: '6px 12px', borderRadius: 3,
                          background: 'transparent', border: `1px solid ${T.red}`,
                          color: T.red, fontSize: 10, letterSpacing: 1,
                          cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
                          fontWeight: 'bold',
                        }}>🗑</button>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isLapsed && showModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 16,
        }}>
          <div className="campaign-modal">
            <h2 style={{ fontSize: 14, fontWeight: 'bold', letterSpacing: 4, color: T.blue, marginBottom: 8 }}>+ NEW CAMPAIGN</h2>
            <p style={{ fontSize: 11, letterSpacing: 1, color: T.muted, marginBottom: 24, fontFamily: 'monospace' }}>
              Name your campaign and upload your leads CSV to get started.
            </p>

            <label style={{ display: 'block', fontSize: 9, letterSpacing: 2, color: T.muted, marginBottom: 6, fontWeight: 'bold' }}>CAMPAIGN NAME</label>
            <input
              type="text" placeholder="Medicare Leads May"
              value={campaignName} onChange={(e) => setCampaignName(e.target.value)}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 4,
                background: T.surface, border: `1px solid ${T.border}`,
                color: T.text, fontSize: 13, outline: 'none',
                marginBottom: 20, fontFamily: 'monospace', boxSizing: 'border-box',
              }} />

            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                padding: 32, borderRadius: 4, cursor: 'pointer', marginBottom: 24,
                border: `2px dashed ${dragging || csvData.length > 0 ? T.blue : T.border}`,
                background: dragging ? 'rgba(74,158,255,0.05)' : csvData.length > 0 ? 'rgba(74,158,255,0.03)' : T.surface,
                textAlign: 'center', transition: 'all 0.2s',
              }}>
              <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileInput} />
              {csvData.length > 0 ? (
                <>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>✅</div>
                  <p style={{ fontSize: 13, fontWeight: 'bold', letterSpacing: 2, color: T.blue, marginBottom: 4 }}>
                    {csvData.length.toLocaleString()} LEADS LOADED
                  </p>
                  <p style={{ fontSize: 11, color: T.muted, fontFamily: 'monospace' }}>{csvName}</p>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>📂</div>
                  <p style={{ fontSize: 12, letterSpacing: 2, color: T.muted, marginBottom: 4, fontWeight: 'bold' }}>DROP YOUR CSV HERE</p>
                  <p style={{ fontSize: 10, color: T.muted, opacity: 0.7, fontFamily: 'monospace' }}>or click to browse files</p>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowModal(false); setCampaignName(''); setCsvData([]); setCsvName('') }} style={{
                flex: 1, padding: 12, borderRadius: 4,
                background: 'transparent', border: `1px solid ${T.border}`,
                color: T.muted, fontSize: 11, letterSpacing: 2, fontWeight: 'bold',
                cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
              }}>CANCEL</button>
              <button onClick={handleCreate} disabled={!campaignName || loading} style={{
                flex: 2, padding: 12, borderRadius: 4, border: 'none',
                background: campaignName ? 'linear-gradient(135deg, #4a9eff, #2a6eff)' : T.border,
                color: 'white', fontSize: 11, fontWeight: 'bold', letterSpacing: 2,
                cursor: campaignName ? 'pointer' : 'not-allowed',
                fontFamily: 'Futura PT, Futura, sans-serif',
              }}>{loading ? 'CREATING...' : 'CREATE CAMPAIGN →'}</button>
            </div>
          </div>
        </div>
      )}

      {!isLapsed && scriptModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 16,
        }}>
          <div className="campaign-modal" style={{ maxWidth: 600 }}>
            <h2 style={{ fontSize: 14, fontWeight: 'bold', letterSpacing: 4, color: T.blue, marginBottom: 8 }}>
              CALL SCRIPT
            </h2>
            <p style={{ fontSize: 11, letterSpacing: 1, color: T.muted, marginBottom: 20, fontFamily: 'monospace' }}>
              {scriptModal.name} — This script will appear in the dialer during calls.
            </p>

            <textarea
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder="Hi [Name], my name is [Agent] and I'm calling from..."
              rows={10}
              style={{
                width: '100%', padding: 14, borderRadius: 4, boxSizing: 'border-box',
                background: T.surface, border: `1px solid ${T.border}`,
                color: T.text, fontSize: 13, lineHeight: 1.7,
                outline: 'none', resize: 'vertical', fontFamily: 'monospace',
                marginBottom: 20,
              }} />

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setScriptModal(null); setScriptText('') }} style={{
                flex: 1, padding: 12, borderRadius: 4,
                background: 'transparent', border: `1px solid ${T.border}`,
                color: T.muted, fontSize: 11, letterSpacing: 2, fontWeight: 'bold',
                cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
              }}>CANCEL</button>
              <button onClick={handleSaveScript} style={{
                flex: 2, padding: 12, borderRadius: 4, border: 'none',
                background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
                color: 'white', fontSize: 11, fontWeight: 'bold', letterSpacing: 2,
                cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
              }}>SAVE SCRIPT →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}