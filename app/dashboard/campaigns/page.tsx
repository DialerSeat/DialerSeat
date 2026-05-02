'use client'
import { useState, useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'

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
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) fetchCampaigns()
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
        body: JSON.stringify({ user_id: user.id, name: campaignName }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      if (csvData.length > 0) {
        await fetch('/api/leads/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign_id: data.campaign.id, user_id: user.id, leads: csvData }),
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

  const handleDelete = async (id: string) => {
    await fetch('/api/campaigns/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setCampaigns(campaigns.filter(c => c.id !== id))
    setDeleteConfirm(null)
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
      await fetch('/api/leads/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, user_id: user?.id, leads: parsed }),
      })
      fetchCampaigns()
    }
    reader.readAsText(file)
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex' }}>

      {/* SIDEBAR */}
      <div style={{
        width: '260px', minHeight: '100vh', background: 'var(--surface)',
        borderRight: '1px solid var(--border)', display: 'flex',
        flexDirection: 'column', padding: '32px 0', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 24px', marginBottom: '48px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>D</span>
          </div>
          <span style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '4px', color: 'var(--text-primary)' }}>DIALERSEAT</span>
        </div>

        <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[
            { icon: '📊', label: 'DASHBOARD', href: '/dashboard' },
            { icon: '📞', label: 'DIALER', href: '/dashboard/dialer' },
            { icon: '📋', label: 'CAMPAIGNS', href: '/dashboard/campaigns', active: true },
            { icon: '👥', label: 'LEADS', href: '/dashboard/leads' },
            { icon: '📈', label: 'ANALYTICS', href: '/dashboard/analytics' },
            { icon: '🏢', label: 'TEAM', href: '/dashboard/team' },
            { icon: '⚙️', label: 'SETTINGS', href: '/dashboard/settings' },
          ].map((item) => (
            <a key={item.label} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
              borderRadius: '10px', cursor: 'pointer', textDecoration: 'none',
              background: item.active ? 'rgba(74,158,255,0.1)' : 'transparent',
              border: item.active ? '1px solid rgba(74,158,255,0.2)' : '1px solid transparent',
            }}>
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              <span style={{
                fontSize: '11px', letterSpacing: '2px', fontWeight: 'bold',
                color: item.active ? 'var(--accent-blue)' : 'var(--text-secondary)',
              }}>{item.label}</span>
            </a>
          ))}
        </nav>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', letterSpacing: '4px', color: 'var(--text-primary)', marginBottom: '8px' }}>CAMPAIGNS</h1>
            <p style={{ fontSize: '12px', letterSpacing: '2px', color: 'var(--text-secondary)' }}>MANAGE YOUR LEAD LISTS AND DIALING CAMPAIGNS.</p>
          </div>
          <button onClick={() => setShowModal(true)} style={{
            padding: '14px 28px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
            color: 'white', fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px',
            border: 'none', cursor: 'pointer', boxShadow: '0 0 20px rgba(74,158,255,0.3)',
            fontFamily: 'Futura PT, Futura, sans-serif',
          }}>+ NEW CAMPAIGN</button>
        </div>

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
              Create your first campaign, upload your leads CSV,<br />and start dialing in minutes.
            </p>
            <button onClick={() => setShowModal(true)} style={{
              padding: '14px 36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
              color: 'white', fontSize: '11px', fontWeight: 'bold',
              letterSpacing: '2px', border: 'none', cursor: 'pointer',
              fontFamily: 'Futura PT, Futura, sans-serif',
            }}>CREATE FIRST CAMPAIGN</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {campaigns.map((campaign) => (
              <div key={campaign.id} style={{
                padding: '24px 28px', borderRadius: '16px', background: 'var(--surface)',
                border: `1px solid ${campaign.status === 'active' ? 'rgba(74,158,255,0.3)' : 'var(--border)'}`,
                transition: 'border-color 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    {/* TOGGLE */}
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

                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {campaign.name}
                      </h3>
                      <p style={{ fontSize: '11px', letterSpacing: '1px', color: 'var(--text-secondary)' }}>
                        CREATED {new Date(campaign.created_at).toLocaleDateString()}
                        {campaign.script ? ' · SCRIPT ADDED' : ''}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '2px' }}>
                        {campaign.total_leads.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '9px', letterSpacing: '2px', color: 'var(--text-secondary)' }}>LEADS</div>
                    </div>

                    <div style={{ textAlign: 'center' }}>
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
                    }}>
                      {campaign.status === 'active' ? '● ACTIVE' : '○ INACTIVE'}
                    </div>

                    {/* SCRIPT BUTTON */}
                    <button
                      onClick={() => { setScriptModal(campaign); setScriptText(campaign.script || '') }}
                      style={{
                        padding: '8px 16px', borderRadius: '8px',
                        background: campaign.script ? 'rgba(74,158,255,0.1)' : 'transparent',
                        border: `1px solid ${campaign.script ? 'var(--accent-blue)' : 'var(--border)'}`,
                        color: campaign.script ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        fontSize: '10px', letterSpacing: '2px', cursor: 'pointer',
                        fontFamily: 'Futura PT, Futura, sans-serif',
                      }}>
                      📝 {campaign.script ? 'EDIT SCRIPT' : 'ADD SCRIPT'}
                    </button>

                    {/* UPLOAD CSV */}
                    <label style={{
                      padding: '8px 16px', borderRadius: '8px',
                      background: 'transparent', border: '1px solid var(--border)',
                      color: 'var(--text-secondary)', fontSize: '10px',
                      letterSpacing: '2px', cursor: 'pointer',
                      fontFamily: 'Futura PT, Futura, sans-serif',
                    }}>
                      + CSV
                      <input type="file" accept=".csv" style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleUploadMore(campaign.id, file)
                        }} />
                    </label>

                    {/* DIAL NOW */}
                    <a href="/dashboard/dialer" style={{
                      padding: '8px 20px', borderRadius: '8px',
                      background: campaign.status === 'active' ? 'linear-gradient(135deg, #4a9eff, #2a6eff)' : 'var(--surface-2)',
                      border: 'none', color: campaign.status === 'active' ? 'white' : 'var(--text-secondary)',
                      fontSize: '10px', letterSpacing: '2px', cursor: 'pointer',
                      fontFamily: 'Futura PT, Futura, sans-serif', textDecoration: 'none',
                      boxShadow: campaign.status === 'active' ? '0 0 15px rgba(74,158,255,0.3)' : 'none',
                    }}>DIAL NOW</a>

                    {/* DELETE */}
                    {deleteConfirm === campaign.id ? (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleDelete(campaign.id)} style={{
                          padding: '8px 14px', borderRadius: '8px', border: 'none',
                          background: '#ff4444', color: 'white', fontSize: '10px',
                          letterSpacing: '2px', cursor: 'pointer',
                          fontFamily: 'Futura PT, Futura, sans-serif',
                        }}>CONFIRM</button>
                        <button onClick={() => setDeleteConfirm(null)} style={{
                          padding: '8px 14px', borderRadius: '8px',
                          background: 'transparent', border: '1px solid var(--border)',
                          color: 'var(--text-secondary)', fontSize: '10px',
                          letterSpacing: '2px', cursor: 'pointer',
                          fontFamily: 'Futura PT, Futura, sans-serif',
                        }}>CANCEL</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(campaign.id)} style={{
                        padding: '8px 14px', borderRadius: '8px',
                        background: 'transparent', border: '1px solid rgba(255,68,68,0.3)',
                        color: '#ff4444', fontSize: '10px', letterSpacing: '2px',
                        cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
                      }}>🗑</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE CAMPAIGN MODAL */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, backdropFilter: 'blur(10px)',
        }}>
          <div style={{
            width: '100%', maxWidth: '500px', padding: '48px', borderRadius: '24px',
            background: 'var(--surface)', border: '1px solid var(--border)',
          }}>
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

      {/* SCRIPT MODAL */}
      {scriptModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, backdropFilter: 'blur(10px)',
        }}>
          <div style={{
            width: '100%', maxWidth: '600px', padding: '48px', borderRadius: '24px',
            background: 'var(--surface)', border: '1px solid var(--border)',
          }}>
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
    </main>
  )
}