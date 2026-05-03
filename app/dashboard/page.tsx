'use client'
import { useUser, UserButton } from '@clerk/nextjs'

export default function DashboardPage() {
  const { user } = useUser()

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--background)',
      display: 'flex',
    }}>

      {/* SIDEBAR */}
      <div style={{
        width: '260px',
        minHeight: '100vh',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 0',
        flexShrink: 0,
      }}>
        {/* LOGO */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 24px',
          marginBottom: '48px',
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>D</span>
          </div>
          <span style={{
            fontSize: '14px',
            fontWeight: 'bold',
            letterSpacing: '4px',
            color: 'var(--text-primary)',
          }}>DIALERSEAT</span>
        </div>

        {/* NAV ITEMS */}
        <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[
            { icon: '📊', label: 'DASHBOARD', active: true },
            { icon: '📞', label: 'DIALER', active: false },
            { icon: '📋', label: 'CAMPAIGNS', active: false },
            { icon: '👥', label: 'LEADS', active: false },
            { icon: '📈', label: 'ANALYTICS', active: false },
            { icon: '🏢', label: 'TEAM', active: false },
            { icon: '⚙️', label: 'SETTINGS', active: false },
          ].map((item) => (
            <div key={item.label} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              background: item.active ? 'rgba(74,158,255,0.1)' : 'transparent',
              border: item.active ? '1px solid rgba(74,158,255,0.2)' : '1px solid transparent',
            }}>
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              <span style={{
                fontSize: '11px',
                letterSpacing: '2px',
                fontWeight: 'bold',
                color: item.active ? 'var(--accent-blue)' : 'var(--text-secondary)',
              }}>{item.label}</span>
            </div>
          ))}
        </nav>

        {/* USER SECTION */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <UserButton />
          <div>
            <div style={{
              fontSize: '12px',
              fontWeight: 'bold',
              color: 'var(--text-primary)',
              letterSpacing: '1px',
            }}>{user?.firstName} {user?.lastName}</div>
            <div style={{
              fontSize: '10px',
              color: 'var(--text-secondary)',
              letterSpacing: '1px',
            }}>PRO PLAN</div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>

        {/* HEADER */}
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

        {/* STATS CARDS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '32px',
        }}>
          {[
            { label: 'CALLS TODAY', value: '0', change: 'START DIALING' },
            { label: 'CONTACTS REACHED', value: '0', change: 'START DIALING' },
            { label: 'ACTIVE CAMPAIGNS', value: '0', change: 'CREATE ONE' },
            { label: 'LEADS LOADED', value: '0', change: 'UPLOAD CSV' },
          ].map((stat, i) => (
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
              }}>{stat.value}</div>
              <div style={{
                fontSize: '10px',
                letterSpacing: '2px',
                color: 'var(--accent-blue)',
              }}>{stat.change}</div>
            </div>
          ))}
        </div>

       {/* QUICK ACTIONS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginBottom: '32px',
        }}>
          {[
            { icon: '📞', title: 'START DIALING', desc: 'Launch the dialer and start making calls', href: '/dashboard/dialer' },
            { icon: '📋', title: 'NEW CAMPAIGN', desc: 'Create a campaign and upload your leads', href: '/dashboard/campaigns' },
            { icon: '🏢', title: 'TEAM', desc: 'Add seats to your campaigns', href: '/dashboard/team' },
          ].map((action, i) => (
            <a key={i} href={action.href} style={{ textDecoration: 'none' }}>
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
            </a>
          ))}
        </div>

        {/* RECENT CAMPAIGNS */}
        <div style={{
          padding: '32px',
          borderRadius: '16px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }}>
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
            <button style={{
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
            }}>+ NEW CAMPAIGN</button>
          </div>

          {/* EMPTY STATE */}
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
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
            <button style={{
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
            }}>CREATE FIRST CAMPAIGN</button>
          </div>
        </div>
      </div>
    </main>
  )
}