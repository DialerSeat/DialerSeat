'use client'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface DashboardStats {
  callsToday: number
  contactsReached: number
  activeCampaigns: number
  leadsLoaded: number
}

interface RecentCampaign {
  id: string
  name: string
  status: string
  total_leads: number
  called_leads: number
}

export default function DashboardPage() {
  const { user } = useUser()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>({
    callsToday: 0,
    contactsReached: 0,
    activeCampaigns: 0,
    leadsLoaded: 0,
  })
  const [recentCampaigns, setRecentCampaigns] = useState<RecentCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [adminChecked, setAdminChecked] = useState(false)

  // Bounce admins to /dashboard/admin/analytics on first load
  useEffect(() => {
    if (!user) return
    fetch('/api/admin/check')
      .then(r => r.json())
      .then(d => {
        if (d.isAdmin) {
          router.replace('/dashboard/admin/analytics')
        } else {
          setAdminChecked(true)
        }
      })
      .catch(() => setAdminChecked(true))
  }, [user, router])

  useEffect(() => {
    if (!user || !adminChecked) return
    let cancelled = false

    const load = async () => {
      try {
        const campRes = await fetch(`/api/campaigns/list?user_id=${user.id}`)
        const campData = await campRes.json()
        const campaigns: RecentCampaign[] = campData.success ? campData.campaigns : []

        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date()
        endOfDay.setHours(23, 59, 59, 999)

        let callsToday = 0
        let contactsReached = 0
        try {
          const params = new URLSearchParams({
            user_id: user.id,
            start: startOfDay.toISOString(),
            end: endOfDay.toISOString(),
          })
          const sumRes = await fetch(`/api/analytics/summary?${params}`)
          const sumData = await sumRes.json()
          if (sumData.success && sumData.summary) {
            callsToday = sumData.summary.totalCalls ?? 0
            contactsReached = sumData.summary.contactsReached ?? 0
          }
        } catch {
          // ignore
        }

        const activeCampaigns = campaigns.filter(c => c.status === 'active').length
        const leadsLoaded = campaigns.reduce((sum, c) => sum + (c.total_leads || 0), 0)

        const recent = [...campaigns]
          .sort((a: any, b: any) => {
            const ta = new Date(a.created_at || 0).getTime()
            const tb = new Date(b.created_at || 0).getTime()
            return tb - ta
          })
          .slice(0, 5)

        if (!cancelled) {
          setStats({ callsToday, contactsReached, activeCampaigns, leadsLoaded })
          setRecentCampaigns(recent)
          setLoading(false)
        }
      } catch (err) {
        console.error('Dashboard load error:', err)
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user, adminChecked])

  // Toggle campaign active/inactive — same endpoint as the Campaigns page
  const toggleCampaign = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'

    // Optimistic update
    setRecentCampaigns(prev =>
      prev.map(c => (c.id === id ? { ...c, status: newStatus } : c))
    )
    setStats(prev => ({
      ...prev,
      activeCampaigns: prev.activeCampaigns + (newStatus === 'active' ? 1 : -1),
    }))

    try {
      const res = await fetch('/api/campaigns/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Update failed')
    } catch (err) {
      console.error('Toggle failed:', err)
      // Revert on failure
      setRecentCampaigns(prev =>
        prev.map(c => (c.id === id ? { ...c, status: currentStatus } : c))
      )
      setStats(prev => ({
        ...prev,
        activeCampaigns: prev.activeCampaigns + (currentStatus === 'active' ? 1 : -1),
      }))
    }
  }

  // While checking admin status, show a quiet loading shell so we don't flash the user dashboard
  if (!adminChecked) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 64px)',
        color: 'var(--text-secondary)',
        fontSize: 11,
        letterSpacing: 3,
      }}>
        LOADING...
      </div>
    )
  }

  const statCards = [
    {
      label: 'CALLS TODAY',
      value: stats.callsToday.toLocaleString(),
      change: stats.callsToday > 0 ? 'KEEP DIALING' : 'START DIALING',
    },
    {
      label: 'CONTACTS REACHED',
      value: stats.contactsReached.toLocaleString(),
      change: stats.callsToday > 0
        ? `${Math.round((stats.contactsReached / stats.callsToday) * 100)}% CONNECT RATE`
        : 'START DIALING',
    },
    {
      label: 'ACTIVE CAMPAIGNS',
      value: stats.activeCampaigns.toLocaleString(),
      change: stats.activeCampaigns > 0 ? 'RUNNING' : 'CREATE ONE',
    },
    {
      label: 'LEADS LOADED',
      value: stats.leadsLoaded.toLocaleString(),
      change: stats.leadsLoaded > 0 ? 'IN ROTATION' : 'UPLOAD CSV',
    },
  ]

  return (
    <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          letterSpacing: '4px',
          color: 'var(--text-primary)',
          marginBottom: '8px',
        }}>WELCOME BACK{user?.firstName ? `, ${user.firstName.toUpperCase()}` : ''}.</h1>
        <p style={{
          fontSize: '12px',
          letterSpacing: '2px',
          color: 'var(--text-secondary)',
        }}>HERE IS WHAT IS HAPPENING WITH YOUR CAMPAIGNS TODAY.</p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '32px',
      }} className="ds-stats-grid">
        {statCards.map((stat, i) => (
          <div key={i} style={{
            padding: '24px',
            borderRadius: '16px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
          }}>
            <div style={{
              fontSize: '10px',
              letterSpacing: '3px',
              color: 'var(--text-secondary)',
              marginBottom: '12px',
            }}>{stat.label}</div>
            <div style={{
              fontSize: '36px',
              fontWeight: 'bold',
              color: 'var(--text-primary)',
              marginBottom: '8px',
              letterSpacing: '-1px',
            }}>{loading ? '—' : stat.value}</div>
            <div style={{
              fontSize: '10px',
              letterSpacing: '2px',
              color: 'var(--accent-blue)',
            }}>{stat.change}</div>
          </div>
        ))}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        marginBottom: '32px',
      }} className="ds-quick-grid">
        {[
          { icon: '\uD83D\uDCDE', title: 'START DIALING', desc: 'Launch the dialer and start making calls', href: '/dashboard/dialer' },
          { icon: '\uD83D\uDCCB', title: 'NEW CAMPAIGN', desc: 'Create a campaign and upload your leads', href: '/dashboard/campaigns' },
          { icon: '\uD83C\uDFE2', title: 'TEAM', desc: 'Add seats to your campaigns', href: '/dashboard/team' },
        ].map((action, i) => (
          <Link key={i} href={action.href} style={{ textDecoration: 'none' }}>
            <div style={{
              padding: '28px',
              borderRadius: '16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget
              el.style.border = '1px solid var(--accent-blue)'
              el.style.background = 'rgba(74,158,255,0.05)'
              el.style.transform = 'translateY(-2px)'
              el.style.boxShadow = '0 8px 24px rgba(74,158,255,0.15)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.border = '1px solid var(--border)'
              el.style.background = 'var(--surface)'
              el.style.transform = 'translateY(0)'
              el.style.boxShadow = 'none'
            }}>
              <div style={{ fontSize: '28px', marginBottom: '16px' }}>{action.icon}</div>
              <h3 style={{
                fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px',
                color: 'var(--text-primary)', marginBottom: '8px',
              }}>{action.title}</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{action.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <div style={{
        padding: '32px',
        borderRadius: '16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }} className="ds-recent-card">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}>
          <h2 style={{
            fontSize: '12px',
            fontWeight: 'bold',
            letterSpacing: '3px',
            color: 'var(--text-primary)',
          }}>RECENT CAMPAIGNS</h2>
          <Link href="/dashboard/campaigns" style={{
            padding: '8px 20px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
            color: 'white',
            fontSize: '10px',
            fontWeight: 'bold',
            letterSpacing: '2px',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'Futura PT, Futura, sans-serif',
            textDecoration: 'none',
          }}>+ NEW CAMPAIGN</Link>
        </div>

        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            fontSize: '11px',
            letterSpacing: '3px',
            color: 'var(--text-secondary)',
          }}>LOADING...</div>
        ) : recentCampaigns.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>{'\uD83D\uDCCB'}</div>
            <h3 style={{
              fontSize: '13px',
              fontWeight: 'bold',
              letterSpacing: '3px',
              color: 'var(--text-primary)',
              marginBottom: '8px',
            }}>NO CAMPAIGNS YET</h3>
            <p style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              marginBottom: '24px',
            }}>Create your first campaign and upload your leads to get started.</p>
            <Link href="/dashboard/campaigns" style={{
              display: 'inline-block',
              padding: '12px 32px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
              color: 'white',
              fontSize: '11px',
              fontWeight: 'bold',
              letterSpacing: '2px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Futura PT, Futura, sans-serif',
              textDecoration: 'none',
            }}>CREATE FIRST CAMPAIGN</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentCampaigns.map(c => {
              const total = c.total_leads || 0
              const called = c.called_leads || 0
              const pct = total > 0 ? Math.round((called / total) * 100) : 0
              const isActive = c.status === 'active'
              return (
                <div key={c.id} style={{
                  padding: '16px 20px',
                  borderRadius: '10px',
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  transition: 'border-color 0.15s',
                }}>
                  {/* TOGGLE — own click target, doesn't navigate */}
                  <div
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleCampaign(c.id, c.status)
                    }}
                    role="switch"
                    aria-checked={isActive}
                    aria-label={`${isActive ? 'Deactivate' : 'Activate'} ${c.name}`}
                    style={{
                      width: '44px',
                      height: '24px',
                      borderRadius: '12px',
                      background: isActive ? 'var(--accent-blue)' : 'var(--border)',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: 'white',
                      position: 'absolute',
                      top: '3px',
                      left: isActive ? '23px' : '3px',
                      transition: 'left 0.2s',
                    }} />
                  </div>

                  {/* CAMPAIGN INFO — own click target, navigates */}
                  <Link
                    href="/dashboard/campaigns"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textDecoration: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: 'bold',
                        color: 'var(--text-primary)',
                        letterSpacing: '1px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>{c.name}</span>
                      <span style={{
                        fontSize: '8px',
                        fontWeight: 'bold',
                        letterSpacing: '2px',
                        padding: '3px 8px',
                        borderRadius: 3,
                        background: isActive ? 'rgba(74,158,255,0.12)' : 'rgba(140,140,160,0.12)',
                        color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        border: `1px solid ${isActive ? 'rgba(74,158,255,0.3)' : 'var(--border)'}`,
                      }}>{c.status?.toUpperCase() || 'DRAFT'}</span>
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      fontFamily: 'monospace',
                      letterSpacing: '1px',
                    }}>
                      {called.toLocaleString()} / {total.toLocaleString()} CALLED · {pct}%
                    </div>
                    <div style={{
                      marginTop: 8,
                      height: 4,
                      background: 'var(--border)',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #4a9eff, #2a6eff)',
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </Link>

                  <div style={{ fontSize: 18, color: 'var(--text-secondary)', flexShrink: 0 }}>›</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          :global(.ds-stats-grid) {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
          }
          :global(.ds-quick-grid) {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          :global(.ds-recent-card) {
            padding: 20px !important;
          }
        }
        @media (max-width: 768px) {
          div[style*="padding: '40px'"] {
            padding: 20px !important;
          }
        }
      `}</style>
    </div>
  )
}