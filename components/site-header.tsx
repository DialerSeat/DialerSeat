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
  const firstName = user?.firstName || user?.username || 'You'
  const initials = (
    user?.firstName?.[0] ||
    user?.username?.[0] ||
    user?.emailAddresses?.[0]?.emailAddress?.[0] ||
    '?'
  ).toUpperCase()

  return (
    <header className="site-header">
      <style>{`
        .site-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: white;
          border-bottom: 1px solid #d4d7df;
          backdrop-filter: blur(8px);
          background-color: rgba(255, 255, 255, 0.95);
        }
        .site-header-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 14px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .site-header-left {
          display: flex;
          align-items: center;
          gap: 18px;
        }
        .site-header-brand {
          font-family: 'Futura PT', Futura, sans-serif;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 2px;
          color: #1a1c24;
          text-decoration: none;
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
        .site-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
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
        .site-header-profile {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          padding: 6px 12px 6px 6px;
          border-radius: 22px;
          border: 1px solid #d4d7df;
          background: #f0f1f4;
          transition: background 0.15s;
        }
        .site-header-profile:hover {
          background: #e2e4ea;
        }
        .site-header-avatar {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4a9eff, #2a4a8a);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 13px;
          font-family: 'Futura PT', Futura, sans-serif;
        }
        .site-header-name {
          font-family: 'Futura PT', Futura, sans-serif;
          font-size: 13px;
          font-weight: 700;
          color: #1a1c24;
        }
        .site-header-admin-badge {
          font-size: 9px;
          letter-spacing: 1.5px;
          color: #2a4a8a;
          background: rgba(42, 74, 138, 0.1);
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: 800;
          margin-left: 6px;
        }
        @media (max-width: 600px) {
          .site-header-inner { padding: 12px 16px; gap: 8px; }
          .site-header-brand { font-size: 16px; letter-spacing: 1.5px; }
          .site-header-home { padding: 6px 10px; font-size: 10px; letter-spacing: 1.5px; }
          .site-header-login { padding: 6px 10px; font-size: 11px; }
          .site-header-signup { padding: 7px 12px; font-size: 11px; }
          .site-header-name { display: none; }
        }
      `}</style>
      <div className="site-header-inner">
        <div className="site-header-left">
          {isLoaded && isSignedIn ? (
            <>
              <Link href="/" className="site-header-brand">DIALERSEAT</Link>
              <Link href={homeHref} className="site-header-home">← HOME</Link>
            </>
          ) : (
            <Link href="/" className="site-header-brand">DIALERSEAT</Link>
          )}
        </div>
        <div className="site-header-right">
          {!isLoaded ? null : isSignedIn ? (
            <Link href="/dashboard/settings" className="site-header-profile">
              <div className="site-header-avatar">{initials}</div>
              <span className="site-header-name">
                {firstName}
                {isAdmin && <span className="site-header-admin-badge">ADMIN</span>}
              </span>
            </Link>
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