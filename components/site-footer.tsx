import Link from 'next/link'

























export default function SiteFooter() {
  return (
    <footer
      style={{
        padding: '48px 20px 40px',
        textAlign: 'center',
        borderTop: '1px solid #c4c8d0',
        background: '#0a0a14',
        color: 'rgba(255,255,255,0.5)',
        fontFamily: 'Futura PT, Futura, sans-serif',
      }}
    >
      {/* Logo row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>D</span>
        </div>
        <span
          style={{
            fontSize: 14,
            fontWeight: 'bold',
            letterSpacing: 6,
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          DIALERSEAT
        </span>
      </div>

      {/* Links row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 16,
          fontSize: 11,
          letterSpacing: 3,
        }}
      >
        <Link
          href="/privacy"
          style={{
            color: 'rgba(255,255,255,0.7)',
            textDecoration: 'none',
            padding: '4px 10px',
          }}
        >
          PRIVACY
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
        <Link
          href="/terms"
          style={{
            color: 'rgba(255,255,255,0.7)',
            textDecoration: 'none',
            padding: '4px 10px',
          }}
        >
          TERMS
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
        <Link
          href="/faq"
          style={{
            color: 'rgba(255,255,255,0.7)',
            textDecoration: 'none',
            padding: '4px 10px',
          }}
        >
          FAQ
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
        <Link
          href="/vs"
          style={{
            color: 'rgba(255,255,255,0.7)',
            textDecoration: 'none',
            padding: '4px 10px',
          }}
        >
          COMPARISONS
        </Link>
      </div>

      {/* Copyright row */}
      <p
        style={{
          fontSize: 11,
          letterSpacing: 3,
          color: 'rgba(255,255,255,0.4)',
          margin: 0,
        }}
      >
        © {new Date().getFullYear()} DIALERSEAT™ · ALL RIGHTS RESERVED
      </p>
    </footer>
  )
}