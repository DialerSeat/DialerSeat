import Link from 'next/link'

interface ComingSoonProps {
  title: string
  description?: string
  icon?: string
}

export default function ComingSoon({ title, description, icon = '🚧' }: ComingSoonProps) {
  return (
    <div style={{
      flex: 1,
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '480px',
        width: '100%',
      }}>
        <div style={{ fontSize: '64px', marginBottom: '24px' }}>{icon}</div>

        <div style={{
          display: 'inline-block',
          padding: '6px 16px',
          borderRadius: '100px',
          background: 'rgba(74,158,255,0.1)',
          border: '1px solid var(--accent-blue)',
          fontSize: '10px',
          letterSpacing: '3px',
          color: 'var(--accent-blue)',
          marginBottom: '20px',
          fontWeight: 'bold',
        }}>
          COMING SOON
        </div>

        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          letterSpacing: '6px',
          color: 'var(--text-primary)',
          marginBottom: '16px',
          fontFamily: 'Futura PT, Futura, sans-serif',
        }}>{title}</h1>

        {description && (
          <p style={{
            fontSize: '14px',
            lineHeight: '1.7',
            color: 'var(--text-secondary)',
            marginBottom: '32px',
            letterSpacing: '0.5px',
          }}>{description}</p>
        )}

        <Link href="/dashboard" style={{
          display: 'inline-block',
          padding: '12px 28px',
          borderRadius: '10px',
          background: 'transparent',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          fontSize: '11px',
          fontWeight: 'bold',
          letterSpacing: '2px',
          textDecoration: 'none',
          fontFamily: 'Futura PT, Futura, sans-serif',
        }}>← BACK TO DASHBOARD</Link>
      </div>
    </div>
  )
}