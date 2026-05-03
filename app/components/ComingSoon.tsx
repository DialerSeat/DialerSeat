'use client'
import Link from 'next/link'

interface ComingSoonProps {
  title: string
  description?: string
  icon?: string
}

export default function ComingSoon({ title, description, icon = '\uD83D\uDEE0\uFE0F' }: ComingSoonProps) {
  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--background)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    }}>
      <div style={{
        maxWidth: 480,
        width: '100%',
        padding: 48,
        borderRadius: 16,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 56, marginBottom: 24 }}>{icon}</div>
        <div style={{
          display: 'inline-block',
          padding: '6px 14px',
          borderRadius: 100,
          background: 'rgba(255,170,62,0.1)',
          border: '1px solid rgba(255,170,62,0.3)',
          fontSize: 9,
          letterSpacing: 3,
          fontWeight: 700,
          color: '#ffaa3e',
          marginBottom: 20,
          fontFamily: 'Futura PT, Futura, sans-serif',
        }}>COMING SOON</div>
        <h1 style={{
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: 4,
          color: 'var(--text-primary)',
          marginBottom: 12,
          fontFamily: 'Futura PT, Futura, sans-serif',
        }}>{title}</h1>
        <p style={{
          fontSize: 13,
          lineHeight: 1.7,
          color: 'var(--text-secondary)',
          marginBottom: 32,
        }}>
          {description || `${title} is currently in development. We're shipping fast — check back soon.`}
        </p>
        <Link href="/dashboard" style={{
          display: 'inline-block',
          padding: '12px 32px',
          borderRadius: 10,
          background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
          color: 'white',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 3,
          textDecoration: 'none',
          fontFamily: 'Futura PT, Futura, sans-serif',
        }}>{'\u25C0'} BACK TO DASHBOARD</Link>
      </div>
    </main>
  )
}