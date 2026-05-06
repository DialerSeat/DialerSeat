'use client'
import { useState, useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

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
    // Toggle is allowed for everyone, including lapsed users — pausing your own
    // campaign isn't a mutation that costs money.
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    setCampaigns(campaigns.map(c => c.id === id ? { ...c, status: newStatus } : c))
    await fetch('/api/campaigns/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
  }

  const handleDelete = async (id: string, leadCount: number) => {
    // For 100+ lead campaigns, require typed confirmation
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
    <div className="campaigns-root" style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
      <style>{`
        .campaigns-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 40px; gap: 16px; flex-wrap: wrap; }
        .campaign-row {
          padding: 24px 28px;
          border-radius: 16px;
          background: var(--surface);
          transition: border-color 0.2s;
        }
        .campaign-row-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }
        .campaign-left { display: flex; align-items: center; gap: 20px; min-width: 0; flex: 1; }
        .campaign-actions { display: flex; align-items: center; gap: 20px; flex-wrap: nowrap; }
        .campaign-stat { text-align: center; }
        .campaign-modal {
          width: 100%;
          max-width: 500px;
          padding: 48px;
          border-radius: 24px;
          background: var(--surface);
          border: 1px solid var(--border);
          max-height: 90vh;
          overflow-y: auto;
        }

        @media (max-width: 768px) {
          .campaigns-root { padding: 20px !important; }
          .campaigns-header h1 { font-size: 20px !important; letter-spacing: 3px !important; }
          .new-campaign-btn { width: 100%; }
          .campaign-row { padding: 16px !important; border-radius: 12px !important; }
          .campaign-row-inner {
            flex-direction: column;
            align-items: stretch;
            gap: 14px;
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
            border-top: 1px solid var(--border);
            border-bottom: 1px solid var(--border);
          }
          .campaign-modal {
            padding: 24px !important;
            border-radius: 16px !important;
            max-height: 100vh;
            border-radius: 0 !important;
            min-height: 100vh;
          }
          .modal-overlay { padding: 0 !important; }
        }
      `}</style>

      {/* HEADER */}
      <div className="campaigns-header">
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', letterSpacing: '4px', color: 'var(--text-primary)', marginBottom: '8px' }}>CAMPAIGNS</h1>
          <p style={{ fontSize: '12px', letterSpacing: '2px', color: 'var(--text-secondary)' }}>
            {isLapsed ? 'READ-ONLY · RESUBSCRIBE TO CREATE OR DIAL' : 'MANAGE YOUR LEAD LISTS AND DIALING CAMPAIGNS.'}
          </p>
        </div>
        {!isLapsed ? (
          <button onClick={() => setShowModal(true)} className="new-campaign-btn" style={{
            padding: '14px 28px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
            color: 'white', fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px',
            border: 'none', cursor: 'pointer', boxShadow: '0 0 20px rgba(74,158,255,0.3)',
            fontFamily: 'Futura PT, Futura, sans-serif',
          }}>+ NEW CAMPAIGN</button>
        ) : (
          <Link href="/billing" className="new-campaign-btn" style={{
            padding: '14px 28px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #ffaa3e, #ff8a1a)',
            color: 'white', fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px',
            border: 'none', cursor: 'pointer',
            fontFamily: 'Futura PT, Futura, sans-serif',
            textDecoration: 'none',
            display: 'inline-block',
          }}>↻ RESUBSCRIBE</Link>
        )}
      </div>

      {/* LAPSED BANNER */}
      {isLapsed && (
        <div style={{
          padding: '16px 20px',
          marginBottom: 24,
          background: 'rgba(255,170,62,0.06)',
          border: '1px solid #8a6a1a',
          borderLeft: '3px solid #ffaa3e',
          borderRadius: 6,
          fontSize: 12,
          color: 'var(--text-primary)',
          letterSpacing: 1,
          lineHeight: 1.6,
        }}>
          <strong style={{ color: '#ffaa3e', fontSize: 11, letterSpacing: 3, fontWeight: 700 }}>
            ▸ READ-ONLY MODE
          </strong>
          <div style={{ marginTop: 6 }}>
            Your campaigns are still here. You can pause or unpause them, but creating, deleting, importing, and dialing require an active subscription.
          </div>
        </div>
      )}

      {/* CAMPAIGNS LIST */}
      {fetching ? (
        <div style={{ textAlign: 'center', padding: '100px 20px' }}>
          <p style={{ fontSize: '12px', letterSpacing: '3px', color: 'var(--text-secondary)' }}>LOADING CAMPAIGNS...</p>
        </div>
      ) : campaigns.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '100px 20px', borderRadius: '20px',
          background: 'var(--surface)', border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: '56px', marginBottom: '20px' }}>📋</div>
          <h2 style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '4px', color: 'var(--text-primary)', marginBottom: '12px' }}>NO CAMPAIGNS YET</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: '1.7' }}>
            {isLapsed
              ? <>Resubscribe to create your first campaign,<br />upload leads, and start dialing.</>
              : <>Create your first campaign, upload your leads CSV,<br />and start dialing in minutes.</>}
          </p>
          {!isLapsed ? (
            <button onClick={() => setShowModal(true)} style={{
              padding: '14px 36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
              color: 'white', fontSize: '11px', fontWeight: 'bold',
              letterSpacing: '2px', border: 'none', cursor: 'pointer',
              fontFamily: 'Futura PT, Futura, sans-serif',
            }}>CREATE FIRST CAMPAIGN</button>
          ) : (
            <Link href="/billing" style={{
              display: 'inline-block',
              padding: '14px 36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #ffaa3e, #ff8a1a)',
              color: 'white', fontSize: '11px', fontWeight: 'bold',
              letterSpacing: '2px', border: 'none', cursor: 'pointer',
              fontFamily: 'Futura PT, Futura, sans-serif',
              textDecoration: 'none',
            }}>RESUBSCRIBE — $35/WEEK</Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="campaign-row" style={{
              border: `1px solid ${campaign.status === 'active' ? 'rgba(74,158,255,0.3)' : 'var(--border)'}`,
            }}>
              <div className="campaign-row-inner">
                <div className="campaign-left">
                  <div onClick={() => toggleStatus(campaign.id, campaign.status)} style={{
                    width: '48px', height: '26px', borderRadius: '13px',
                    background: campaign.status === 'active' ? 'var(--accent-blue)' : 'var(--border)',
                    position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                  }}>
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '50%', background: 'white',
                      position: 'absolute', top: '3px',
                      left: campaign.status === 'active' ? '25px' : '3px', transition: 'left 0.2s',
                    }} />
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3 style={{
                      fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px',
                      color: 'var(--text-primary)', marginBottom: '4px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {campaign.name}
                    </h3>
                    <p style={{ fontSize: '11px', letterSpacing: '1px', color: 'var(--text-secondary)' }}>
                      CREATED {new Date(campaign.created_at).toLocaleDateString()}
                      {campaign.script ? ' · SCRIPT ADDED' : ''}
                    </p>
                  </div>
                </div>

                <div className="campaign-stats-row" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div className="campaign-stat">
                    <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '2px' }}>
                      {campaign.total_leads.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '9px', letterSpacing: '2px', color: 'var(--text-secondary)' }}>LEADS</div>
                  </div>

                  <div className="campaign-stat">
                    <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--accent-blue)', marginBottom: '2px' }}>
                      {campaign.called_leads.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '9px', letterSpacing: '2px', color: 'var(--text-secondary)' }}>CALLED</div>
                  </div>

                  <div style={{
                    padding: '6px 14px', borderRadius: '20px',
                    background: campaign.status === 'active' ? 'rgba(74,158,255,0.1)' : 'var(--surface-2)',
                    border: `1px solid ${campaign.status === 'active' ? 'var(--accent-blue)' : 'var(--border)'}`,
                    fontSize: '10px', letterSpacing: '2px', fontWeight: 'bold',
                    color: campaign.status === 'active' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                  }}>
                    {campaign.status === 'active' ? '● ACTIVE' : '○ INACTIVE'}
                  </div>
                </div>

                <div className="campaign-actions">
                  {/* Script — active only */}
                  {!isLapsed && (
                    <button
                      onClick={() => { setScriptModal(campaign); setScriptText(campaign.script || '') }}
                      style={{
                        padding: '8px 16px', borderRadius: '8px',
                        background: campaign.script ? 'rgba(74,158,255,0.1)' : 'transparent',
                        border: `1px solid ${campaign.script ? 'var(--accent-blue)' : 'var(--border)'}`,
                        color: campaign.script ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        fontSize: '10px', letterSpacing: '2px', cursor: 'pointer',
                        fontFamily: 'Futura PT, Futura, sans-serif',
                        whiteSpace: 'nowrap',
                      }}>
                      📝 {campaign.script ? 'EDIT SCRIPT' : 'ADD SCRIPT'}
                    </button>
                  )}

                  {/* CSV upload — active only */}
                  {!isLapsed && (
                    <label style={{
                      padding: '8px 16px', borderRadius: '8px',
                      background: 'transparent', border: '1px solid var(--border)',
                      color: 'var(--text-secondary)', fontSize: '10px',
                      letterSpacing: '2px', cursor: 'pointer',
                      fontFamily: 'Futura PT, Futura, sans-serif',
                      whiteSpace: 'nowrap',
                    }}>
                      + CSV
                      <input type="file" accept=".csv" style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleUploadMore(campaign.id, file)
                        }} />
                    </label>
                  )}

                  {/* Dial Now — active only */}
                  {!isLapsed ? (
                    <a href="/dashboard/dialer" style={{
                      padding: '8px 20px', borderRadius: '8px',
                      background: campaign.status === 'active' ? 'linear-gradient(135deg, #4a9eff, #2a6eff)' : 'var(--surface-2)',
                      border: 'none', color: campaign.status === 'active' ? 'white' : 'var(--text-secondary)',
                      fontSize: '10px', letterSpacing: '2px', cursor: 'pointer',
                      fontFamily: 'Futura PT, Futura, sans-serif', textDecoration: 'none',
                      boxShadow: campaign.status === 'active' ? '0 0 15px rgba(74,158,255,0.3)' : 'none',
                      whiteSpace: 'nowrap',
                    }}>DIAL NOW</a>
                  ) : (
                    <span style={{
                      padding: '8px 20px', borderRadius: '8px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                      fontSize: '10px', letterSpacing: '2px',
                      fontFamily: 'Futura PT, Futura, sans-serif',
                      whiteSpace: 'nowrap',
                      opacity: 0.6,
                    }}>🔒 DIAL LOCKED</span>
                  )}

                  {/* Delete — active only */}
                  {!isLapsed && (
                    deleteConfirm === campaign.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: campaign.total_leads >= 100 ? 200 : 'auto' }}>
                        {campaign.total_leads >= 100 && (
                          <input
                            type="text"
                            placeholder='type "delete" to confirm'
                            value={deleteTyped}
                            onChange={e => setDeleteTyped(e.target.value)}
                            autoFocus
                            style={{
                              padding: '6px 8px', borderRadius: '4px',
                              background: 'var(--surface-2)',
                              border: '1px solid #ff4444',
                              color: 'var(--text-primary)',
                              fontSize: '10px',
                              fontFamily: 'monospace',
                              outline: 'none',
                              letterSpacing: 1,
                            }}
                          />
                        )}
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => handleDelete(campaign.id, campaign.total_leads)}
                            disabled={campaign.total_leads >= 100 && deleteTyped.toLowerCase().trim() !== 'delete'}
                            style={{
                              padding: '8px 14px', borderRadius: '8px', border: 'none',
                              background: '#ff4444', color: 'white', fontSize: '10px',
                              letterSpacing: '2px',
                              cursor: campaign.total_leads >= 100 && deleteTyped.toLowerCase().trim() !== 'delete' ? 'not-allowed' : 'pointer',
                              opacity: campaign.total_leads >= 100 && deleteTyped.toLowerCase().trim() !== 'delete' ? 0.4 : 1,
                              fontFamily: 'Futura PT, Futura, sans-serif',
                              flex: 1,
                            }}>CONFIRM</button>
                          <button onClick={() => { setDeleteConfirm(null); setDeleteTyped('') }} style={{
                            padding: '8px 14px', borderRadius: '8px',
                            background: 'transparent', border: '1px solid var(--border)',
                            color: 'var(--text-secondary)', fontSize: '10px',
                            letterSpacing: '2px', cursor: 'pointer',
                            fontFamily: 'Futura PT, Futura, sans-serif',
                          }}>CANCEL</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => startDelete(campaign.id)} style={{
                        padding: '8px 14px', borderRadius: '8px',
                        background: 'transparent', border: '1px solid rgba(255,68,68,0.3)',
                        color: '#ff4444', fontSize: '10px', letterSpacing: '2px',
                        cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
                      }}>🗑</button>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE CAMPAIGN MODAL — active only */}
      {!isLapsed && showModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, backdropFilter: 'blur(10px)', padding: 16,
        }}>
          <div className="campaign-modal">
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '4px', color: 'var(--text-primary)', marginBottom: '8px' }}>NEW CAMPAIGN</h2>
            <p style={{ fontSize: '12px', letterSpacing: '1px', color: 'var(--text-secondary)', marginBottom: '32px' }}>
              Name your campaign and upload your leads CSV to get started.
            </p>

            <label style={{ display: 'block', fontSize: '10px', letterSpacing: '3px', color: 'var(--text-secondary)', marginBottom: '8px' }}>CAMPAIGN NAME</label>
            <input
              type="text" placeholder="e.g. Medicare Leads May"
              value={campaignName} onChange={(e) => setCampaignName(e.target.value)}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: '10px',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                marginBottom: '24px', fontFamily: 'Futura PT, Futura, sans-serif', boxSizing: 'border-box',
              }} />

            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                padding: '40px', borderRadius: '12px', cursor: 'pointer', marginBottom: '32px',
                border: `2px dashed ${dragging ? 'var(--accent-blue)' : csvData.length > 0 ? 'var(--accent-blue)' : 'var(--border)'}`,
                background: dragging ? 'rgba(74,158,255,0.05)' : csvData.length > 0 ? 'rgba(74,158,255,0.03)' : 'var(--surface-2)',
                textAlign: 'center', transition: 'all 0.2s',
              }}>
              <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileInput} />
              {csvData.length > 0 ? (
                <>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
                  <p style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '2px', color: 'var(--accent-blue)', marginBottom: '4px' }}>
                    {csvData.length.toLocaleString()} LEADS LOADED
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{csvName}</p>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>📂</div>
                  <p style={{ fontSize: '12px', letterSpacing: '2px', color: 'var(--text-secondary)', marginBottom: '4px' }}>DROP YOUR CSV HERE</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.6 }}>or click to browse files</p>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setShowModal(false); setCampaignName(''); setCsvData([]); setCsvName('') }} style={{
                flex: 1, padding: '14px', borderRadius: '10px',
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', fontSize: '11px', letterSpacing: '2px',
                cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
              }}>CANCEL</button>
              <button onClick={handleCreate} disabled={!campaignName || loading} style={{
                flex: 2, padding: '14px', borderRadius: '10px', border: 'none',
                background: campaignName ? 'linear-gradient(135deg, #4a9eff, #2a6eff)' : 'var(--border)',
                color: 'white', fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px',
                cursor: campaignName ? 'pointer' : 'not-allowed',
                fontFamily: 'Futura PT, Futura, sans-serif',
              }}>{loading ? 'CREATING...' : 'CREATE CAMPAIGN →'}</button>
            </div>
          </div>
        </div>
      )}

      {/* SCRIPT MODAL — active only */}
      {!isLapsed && scriptModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, backdropFilter: 'blur(10px)', padding: 16,
        }}>
          <div className="campaign-modal" style={{ maxWidth: 600 }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '4px', color: 'var(--text-primary)', marginBottom: '8px' }}>
              CALL SCRIPT
            </h2>
            <p style={{ fontSize: '12px', letterSpacing: '1px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              {scriptModal.name} — This script will appear in the dialer during calls.
            </p>

            <textarea
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder="Hi [Name], my name is [Agent] and I'm calling from..."
              rows={10}
              style={{
                width: '100%', padding: '16px', borderRadius: '12px', boxSizing: 'border-box',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.7',
                outline: 'none', resize: 'vertical', fontFamily: 'Futura PT, Futura, sans-serif',
                marginBottom: '24px',
              }} />

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setScriptModal(null); setScriptText('') }} style={{
                flex: 1, padding: '14px', borderRadius: '10px',
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', fontSize: '11px', letterSpacing: '2px',
                cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
              }}>CANCEL</button>
              <button onClick={handleSaveScript} style={{
                flex: 2, padding: '14px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
                color: 'white', fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px',
                cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
              }}>SAVE SCRIPT →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}