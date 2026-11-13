'use client'

import { usePathname } from 'next/navigation'
import { Code2, LayoutDashboard } from 'lucide-react'
import { DOCS } from '@/lib/developers/docs'
import { DevLink, useDevBase, withBase } from './base'
import { DevFooter, DevTopNav } from './MarketingChrome'
import { SearchTrigger } from './SearchPalette'

const GROUPS = ['Start here', 'Build', 'Operate'] as const

export function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const base = useDevBase()
  const on = (href: string) => pathname === withBase(base, href)
  const link = (href: string, label: string, icon?: React.ReactNode) => (
    <DevLink key={href} href={href} className="dv-docs-link" aria-current={on(href) ? 'page' : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, fontSize: 14, color: on(href) ? 'var(--dv-text)' : 'var(--dv-muted)', background: on(href) ? 'var(--dv-raise)' : 'transparent' }}>
      {icon}{label}
    </DevLink>
  )
  return (
    <>
      <DevTopNav />
      <div className="dv-docs" style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gridTemplateColumns: '240px minmax(0, 1fr)', gap: 40, padding: '0 20px' }}>
        <aside className="dv-docs-side" style={{ position: 'sticky', top: 98, alignSelf: 'start', maxHeight: 'calc(100vh - 110px)', overflowY: 'auto', padding: '28px 0' }}>
          <div style={{ marginBottom: 18 }}><SearchTrigger /></div>
          {GROUPS.map(g => (
            <div key={g} style={{ marginBottom: 18 }}>
              <div className="dv-dim" style={{ fontSize: 11.5, letterSpacing: .5, padding: '0 10px 6px', textTransform: 'uppercase' }}>{g}</div>
              {DOCS.filter(d => d.group === g).map(d => link(`/docs/${d.slug}`, d.title))}
            </div>
          ))}
          <div className="dv-dim" style={{ fontSize: 11.5, letterSpacing: .5, padding: '0 10px 6px', textTransform: 'uppercase' }}>Reference</div>
          {link('/docs/api', 'API reference', <Code2 size={15} />)}
          {link('/console', 'Open the console', <LayoutDashboard size={15} />)}
        </aside>
        <div style={{ minWidth: 0, padding: '36px 0 40px' }}>{children}</div>
      </div>
      <DevFooter />
      <style>{`
        .dv-docs-link:hover { color: var(--dv-text) !important; background: var(--dv-panel-2) !important; }
        @media (max-width: 900px) { .dv-docs { grid-template-columns: minmax(0, 1fr) !important; } .dv-docs-side { position: static !important; max-height: none !important; padding-bottom: 0 !important; border-bottom: 1px solid var(--dv-border-soft); } }
      `}</style>
    </>
  )
}
