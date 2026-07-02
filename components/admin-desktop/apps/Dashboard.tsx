'use client'
import { useEffect } from 'react'
















export default function DashboardApp() {
  useEffect(() => {
    window.location.href = '/dashboard'
  }, [])

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--brand-page-bg, #f0f1f4)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12,
      fontFamily: 'Futura PT, Futura, sans-serif', padding: 24,
      boxSizing: 'border-box', textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 'bold', color: 'var(--brand-muted-text, #5a5e6a)' }}>
        RETURNING TO DASHBOARD…
      </div>
    </div>
  )
}