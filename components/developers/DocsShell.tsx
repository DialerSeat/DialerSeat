'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronDown, Code2, LayoutDashboard } from 'lucide-react'
import { DOCS } from '@/lib/developers/docs'
import { DevLink, useDevBase, withBase } from './base'
import { DevFooter, DevTopNav } from './MarketingChrome'
import { SearchTrigger } from './SearchPalette'

const GROUPS = ['Start here', 'Build', 'Operate'] as const

export function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const base = useDevBase()
  const [menuOpen, setMenuOpen] = useState(false)
  const on = (href: string) => pathname === withBase(base, href)
  const current = pathname === withBase(base, '/docs/api') ? 'API reference' : DOCS.find(d => on(`/docs/${d.slug}`))?.title || 'Docs'

  const link = (href: string, label: string, icon?: React.ReactNode) => (
    <DevLink key={href} href={href} className="dv-docs-link" aria-current={on(href) ? 'page' : undefined} onClick={() => setMenuOpen(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 8, fontSize: 14, color: on(href) ? 'var(--dv-text)' : 'var(--dv-muted)', background: on(href) ? 'var(--dv-raise)' : 'transparent' }}>
      {icon}{label}
    </DevLink>
  )
  const nav = (
    <>
      {GROUPS.map(g => (
        <div key={g} style={{ marginBottom: 18 }}>
          <div className="dv-dim" style={{ fontSize: 11.5, letterSpacing: .5, padding: '0 10px 6px', textTransform: 'uppercase' }}>{g}</div>
          {DOCS.filter(d => d.group === g).map(d => link(`/docs/${d.slug}`, d.title))}
        </div>
      ))}
      <div className="dv-dim" style={{ fontSize: 11.5, letterSpacing: .5, padding: '0 10px 6px', textTransform: 'uppercase' }}>Reference</div>
      {link('/docs/api', 'API reference', <Code2 size={15} />)}
      {link('/console', 'Open the console', <LayoutDashboard size={15} />)}
    </>
  )

  return (
    <div className="dv-app">
      <DevTopNav themeToggle />
      {/* Phones: search and one collapsible menu, instead of the whole sidebar stacked above every article. */}
      <div className="dv-docs-mobile" style={{ padding: '14px 16px 0', display: 'none' }}>
        <SearchTrigger shortcuts={false} />
        <button type="button" onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen} aria-controls="dv-docs-mobile-nav"
          className="dv-btn" style={{ width: '100%', justifyContent: 'space-between', marginTop: 10, height: 44 }}>
          <span><span className="dv-dim">Browse the docs · </span>{current}</span>
          <ChevronDown size={16} style={{ transform: menuOpen ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} />
        </button>
        {menuOpen && <nav id="dv-docs-mobile-nav" aria-label="Docs" className="dv-card" style={{ marginTop: 8, padding: '14px 8px 8px' }}>{nav}</nav>}
      </div>
      <div className="dv-docs" style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gridTemplateColumns: '240px minmax(0, 1fr)', gap: 40, padding: '0 20px' }}>
        <aside className="dv-docs-side" style={{ position: 'sticky', top: 98, alignSelf: 'start', maxHeight: 'calc(100vh - 110px)', overflowY: 'auto', padding: '28px 0' }}>
          <div style={{ marginBottom: 18 }}><SearchTrigger /></div>
          <nav aria-label="Docs">{nav}</nav>
        </aside>
        <div style={{ minWidth: 0, padding: '36px 0 40px' }} className="dv-docs-content">{children}</div>
      </div>
      <DevFooter />
      <style>{`
        .dv-docs-link:hover { color: var(--dv-text) !important; background: var(--dv-panel-2) !important; }
        @media (max-width: 900px) {
          .dv-docs { grid-template-columns: minmax(0, 1fr) !important; padding: 0 16px !important; }
          .dv-docs-side { display: none; }
          .dv-docs-mobile { display: block !important; }
          .dv-docs-content { padding-top: 24px !important; }
        }
      `}</style>
    </div>
  )
}
