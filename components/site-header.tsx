'use client'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function SiteHeader() {
  const { isSignedIn, user, isLoaded } = useUser()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    fetch('/api/admin/check')
      .then((r) => r.json())
      .then((d) => setIsAdmin(!!d.isAdmin))
      .catch(() => setIsAdmin(false))
  }, [isLoaded, isSignedIn])

  const homeHref = isAdmin ? '/dashboard/admin/analytics' : '/dashboard/analytics'
  const imageUrl = user?.imageUrl
  const initials = (
    user?.firstName?.[0] ||
    user?.username?.[0] ||
    user?.emailAddresses?.[0]?.emailAddress?.[0] ||
    '?'
  ).toUpperCase()
  const displayName = user?.firstName || user?.username || 'user'

  return (
    <header className="site-header">
      <style>{`
        .site-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid #d4d7df;
        }
        .site-header-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 14px 24px;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 16px;
        }
        .site-header-left {
          display: flex;
          align-items: center;
          justify-content: flex-start;
        }
        .site-header-center {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .site-header-right {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
        }
        .site-header-brand-link {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
        }
        .site-header-brand-logo {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: linear-gradient(135deg, #4a9eff, #2a6eff);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .site-header-brand-logo-text {
          color: white;
          font-weight: 800;
          font-size: 16px;
          font-family: 'Futura PT', Futura, sans-serif;
        }
        .site-header-brand-text {
          font-family: 'Futura PT', Futura, sans-serif;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 4px;
          color: #1a1c24;
          white-space: nowrap;
        }
        .site-header-home {
          font-family: 'Futura PT', Futura, sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2.5px;
          color: #2a4a8a;
          text-decoration: none;
          padding: 8px 14px;
          background: rgba(74, 158, 255, 0.08);
          border: 1px solid rgba(74, 158, 255, 0.3);
          border-radius: 6px;
          transition: background 0.15s;
        }
        .site-header-home:hover {
          background: rgba(74, 158, 255, 0.16);
        }
        .site-header-login {
          font-family: 'Futura PT', Futura, sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 2px;
          color: #5a5e6a;
          text-decoration: none;
          padding: 8px 14px;
        }
        .site-header-login:hover {
          color: #1a1c24;
        }
        .site-header-signup {
          font-family: 'Futura PT', Futura, sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 2px;
          color: white;
          background: linear-gradient(135deg, #4a9eff, #2a6eff);
          text-decoration: none;
          padding: 9px 18px;
          border-radius: 6px;
          box-shadow: 0 2px 8px rgba(74, 158, 255, 0.25);
        }
        .site-header-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background-size: cover;
          background-position: center;
          background-color: #4a9eff;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 14px;
          font-family: 'Futura PT', Futura, sans-serif;
          flex-shrink: 0;
          overflow: hidden;
          user-select: none;
        }
        @media (max-width: 600px) {
          .site-header-inner { padding: 12px 14px; gap: 8px; }
          .site-header-brand-text { font-size: 13px; letter-spacing: 2.5px; }
          .site-header-brand-logo { width: 30px; height: 30px; }
          .site-header-brand-logo-text { font-size: 14px; }
          .site-header-brand-link { gap: 8px; }
          .site-header-home { padding: 6px 10px; font-size: 10px; letter-spacing: 1.5px; }
          .site-header-login { padding: 6px 8px; font-size: 11px; }
          .site-header-signup { padding: 7px 12px; font-size: 11px; }
          .site-header-avatar { width: 32px; height: 32px; font-size: 13px; }
        }
      `}</style>
      <div className="site-header-inner">
        <div className="site-header-left">
          {isLoaded && isSignedIn && (
            <Link href={homeHref} className="site-header-home">← HOME</Link>
          )}
        </div>

        <div className="site-header-center">
          <Link href="/" className="site-header-brand-link">
            <div className="site-header-brand-logo">
              <span className="site-header-brand-logo-text">D</span>
            </div>
            <span className="site-header-brand-text">DIALERSEAT</span>
          </Link>
        </div>

        <div className="site-header-right">
          {!isLoaded ? null : isSignedIn ? (
            <div
              className="site-header-avatar"
              style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
              title={`Signed in as ${displayName}`}
              aria-label={`Signed in as ${displayName}`}
            >
              {!imageUrl && initials}
            </div>
          ) : (
            <>
              <Link href="/sign-in" className="site-header-login">LOG IN</Link>
              <Link href="/sign-up" className="site-header-signup">SIGN UP</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}