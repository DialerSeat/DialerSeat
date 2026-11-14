'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { ArrowLeft, Menu, X } from 'lucide-react'
import { DevLink, useMainSiteUrl } from './base'
import { DevLogo } from './ui'
import { ThemeToggle } from './theme'
import { SALES_EMAIL } from '@/lib/developers/catalog'

const LINKS = [
  { href: '/#how', label: 'How it works' },
  { href: '/#capabilities', label: 'Capabilities' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/docs/quickstart', label: 'Docs' },
  { href: '/docs/api', label: 'API reference' },
  { href: '/playground', label: 'Playground' },
]

export function DevTopNav({ themeToggle = false }: { themeToggle?: boolean }) {
  const { isSignedIn, isLoaded } = useAuth()
  const main = useMainSiteUrl()
  const [open, setOpen] = useState(false)
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--dv-header-bg)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--dv-border-soft)' }}>
      <div style={{ background: 'var(--dv-bg-2)', borderBottom: '1px solid var(--dv-border-soft)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: 34, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
          <a href={main} className="dv-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, paddingRight: 8 }}>
            <ArrowLeft size={13} /> Go back to dialerseat.com
          </a>
          <a href={`mailto:${SALES_EMAIL}`} className="dv-dim dv-hide-sm">{SALES_EMAIL}</a>
        </div>
      </div>
      <nav className="dv-topnav" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: 64, display: 'flex', alignItems: 'center', gap: 28 }}>
        <DevLink href="/" aria-label="DialerSeat for Developers home" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}><DevLogo /></DevLink>
        <div className="dv-nav-links" style={{ display: 'flex', gap: 22, fontSize: 13.5 }}>
          {LINKS.map(l => <DevLink key={l.href} href={l.href} className="dv-muted dv-nav-a">{l.label}</DevLink>)}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {themeToggle && <ThemeToggle />}
          {isLoaded && isSignedIn ? (
            <DevLink href="/console" className="dv-btn dv-btn-primary dv-hide-xs">Open console</DevLink>
          ) : (
            <>
              <DevLink href="/sign-in" className="dv-btn dv-btn-ghost dv-hide-sm">Sign in</DevLink>
              <DevLink href="/sign-up" className="dv-btn dv-btn-primary dv-hide-xs">Start building</DevLink>
            </>
          )}
          <button type="button" className="dv-btn dv-btn-ghost dv-show-sm" aria-label="Menu" onClick={() => setOpen(o => !o)}>{open ? <X size={18} /> : <Menu size={18} />}</button>
        </div>
      </nav>
      {open && (
        <div className="dv-show-sm" style={{ padding: '6px 20px 16px', display: 'grid', gap: 4 }}>
          {LINKS.map(l => <DevLink key={l.href} href={l.href} onClick={() => setOpen(false)} style={{ padding: '12px 0', fontSize: 16 }}>{l.label}</DevLink>)}
          {isSignedIn
            ? <DevLink href="/console" style={{ padding: '10px 0', fontSize: 15, color: 'var(--dv-accent)' }}>Open console</DevLink>
            : <>
                <DevLink href="/sign-in" style={{ padding: '10px 0', fontSize: 15 }}>Sign in</DevLink>
                <DevLink href="/sign-up" style={{ padding: '10px 0', fontSize: 15, color: 'var(--dv-accent)' }}>Start building</DevLink>
              </>}
        </div>
      )}
      <style>{`
        .dv-nav-a:hover { color: var(--dv-text); }
        .dv-show-sm { display: none !important; }
        @media (max-width: 900px) {
          .dv-nav-links { display: none !important; }
          .dv-show-sm { display: inline-flex !important; }
          div.dv-show-sm { display: grid !important; }
          .dv-hide-sm { display: none !important; }
        }
        @media (max-width: 480px) { .dv-hide-xs { display: none !important; } .dv-topnav { gap: 10px !important; padding: 0 12px 0 16px !important; } }
        @media (max-width: 360px) { .dv-logo-suffix { display: none; } }
      `}</style>
    </header>
  )
}

export function DevFooter() {
  const main = useMainSiteUrl()
  const year = new Date().getFullYear()
  const cols = [
    { title: 'Product', links: [['/#how', 'How it works'], ['/#capabilities', 'Capabilities'], ['/#pricing', 'Pricing'], ['/console', 'Console']] },
    { title: 'Docs', links: [['/docs/quickstart', 'Quickstart'], ['/docs/miniplayer', 'Miniplayer'], ['/docs/webhooks', 'Webhooks'], ['/docs/api', 'API reference']] },
    { title: 'Company', links: [[main, 'dialerseat.com'], [`mailto:${SALES_EMAIL}`, 'Talk to sales'], [main === '/' ? '/privacy' : 'https://dialerseat.com/privacy', 'Privacy'], [main === '/' ? '/terms' : 'https://dialerseat.com/terms', 'Terms']] },
  ]
  return (
    <footer style={{ borderTop: '1px solid var(--dv-border-soft)', background: 'var(--dv-bg-2)', marginTop: 40 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 20px 28px', display: 'grid', gridTemplateColumns: 'minmax(220px, 1.4fr) repeat(3, minmax(140px, 1fr))', gap: 32 }} className="dv-foot-grid">
        <div>
          <DevLogo />
          <p className="dv-muted" style={{ fontSize: 13, lineHeight: 1.6, margin: '14px 0 18px', maxWidth: 300 }}>
            The DialerSeat dialer, inside your platform. Same engine, your campaigns, your dispositions.
          </p>
          <a href={main} className="dv-btn"><ArrowLeft size={14} /> Back to dialerseat.com</a>
        </div>
        {cols.map(c => (
          <div key={c.title}>
            <div className="dv-dim" style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>{c.title}</div>
            <div className="dv-foot-links" style={{ display: 'grid', gap: 9, fontSize: 13.5 }}>
              {c.links.map(([href, label]) => /^(https?:|mailto:)/.test(href) || href === '/' || href === '/privacy' || href === '/terms'
                ? <a key={label} href={href} className="dv-muted dv-nav-a">{label}</a>
                : <DevLink key={label} href={href} className="dv-muted dv-nav-a">{label}</DevLink>)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 20px 28px', borderTop: '1px solid var(--dv-border-soft)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, fontSize: 12 }} className="dv-dim">
        <span>© {year} DialerSeat™ · All rights reserved</span>
        <span>Rates are negotiated and subject to change · {SALES_EMAIL}</span>
      </div>
      <style>{`@media (max-width: 760px) { .dv-foot-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } .dv-foot-grid > div:first-child { grid-column: 1 / -1; } .dv-foot-links { gap: 0 !important; } .dv-foot-links a { padding: 8px 0; } }`}</style>
    </footer>
  )
}
