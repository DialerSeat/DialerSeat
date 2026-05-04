'use client'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

export default function DashboardPage() {
  const { user } = useUser()

  return (
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
      }} className="ds-stats-grid">
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

      {/* RECENT CAMPAIGNS */}
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

        {/* EMPTY STATE */}
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
      </div>

      {/* MOBILE-ONLY LAYOUT TWEAKS — desktop is unchanged */}
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