'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { ArrowLeft, ChevronRight, Menu, X } from 'lucide-react'
import { CONSOLE_NAV, type NavItem } from '@/lib/developers/consoleNav'
import { DevLink, useDevBase, useMainSiteUrl, withBase } from './base'
import { DevLogo, NAV_ICONS } from './ui'
import { SearchTrigger } from './SearchPalette'

export interface ShellPlatform {
  name: string
  live_status: string
  tier: string
}

const GROUPS: NavItem['group'][] = ['Platform', 'Configure', 'Account', 'Docs']

const LIVE_BADGE: Record<string, { cls: string; text: string }> = {
  not_activated: { cls: 'dv-badge', text: 'Test mode · live dialing off' },
  requested: { cls: 'dv-badge dv-badge-amber', text: 'Live dialing requested' },
  active: { cls: 'dv-badge dv-badge-green', text: 'Live dialing active' },
  past_due: { cls: 'dv-badge dv-badge-red', text: 'Live dialing: payment due' },
  paused: { cls: 'dv-badge dv-badge-amber', text: 'Live dialing paused' },
}

export function Sidebar({ items, onNavigate, title }: { items: NavItem[]; onNavigate?: () => void; title?: string }) {
  const pathname = usePathname()
  const base = useDevBase()
  const main = useMainSiteUrl()
  const isActive = (href: string) => {
    const full = withBase(base, href)
    if (href === '/console') return pathname === full
    return pathname === full || pathname.startsWith(full + '/')
  }
  return (
    <aside style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 12px' }}>
      <DevLink href="/" style={{ padding: '4px 8px 18px', display: 'block' }} onClick={onNavigate}><DevLogo size={26} /></DevLink>
      <div style={{ padding: '0 4px 14px' }}><SearchTrigger /></div>
      <nav style={{ flex: 1, overflowY: 'auto' }} aria-label={title || 'Console'}>
        {GROUPS.map(g => {
          const groupItems = items.filter(i => i.group === g)
          if (!groupItems.length) return null
          return (
            <div key={g} style={{ marginBottom: 14 }}>
              <div className="dv-dim" style={{ fontSize: 11.5, letterSpacing: .4, padding: '8px 10px 6px' }}>{g}</div>
              {groupItems.map(item => {
                const Icon = NAV_ICONS[item.icon]
                const on = isActive(item.href)
                return (
                  <DevLink key={item.href} href={item.href} onClick={onNavigate} aria-current={on ? 'page' : undefined}
                    className="dv-side-link"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, height: 34, padding: '0 10px', borderRadius: 8, fontSize: 14, color: on ? 'var(--dv-text)' : 'var(--dv-muted)', background: on ? 'var(--dv-raise)' : 'transparent' }}>
                    <Icon size={16} color={on ? 'var(--dv-accent)' : undefined} />
                    {item.label}
                  </DevLink>
                )
              })}
            </div>
          )
        })}
      </nav>
      <div style={{ borderTop: '1px solid var(--dv-border-soft)', paddingTop: 12, marginTop: 8 }}>
        <a href={main} className="dv-side-link" style={{ display: 'flex', alignItems: 'center', gap: 10, height: 34, padding: '0 10px', borderRadius: 8, fontSize: 13.5, color: 'var(--dv-muted)' }}>
          <ArrowLeft size={15} /> Go back to dialerseat.com
        </a>
      </div>
      <style>{`.dv-side-link:hover { background: var(--dv-panel-2); color: var(--dv-text) !important; }`}</style>
    </aside>
  )
}

export function ConsoleShell({ platform, children }: { platform: ShellPlatform; children: React.ReactNode }) {
  const pathname = usePathname()
  const base = useDevBase()
  const [drawer, setDrawer] = useState(false)

  const current = [...CONSOLE_NAV].sort((a, b) => b.href.length - a.href.length)
    .find(n => pathname === withBase(base, n.href) || pathname.startsWith(withBase(base, n.href) + '/'))
  const badge = LIVE_BADGE[platform.live_status] || LIVE_BADGE.not_activated

  return (
    <div className="dv-console" style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', minHeight: '100vh' }}>
      <div className="dv-console-side" style={{ position: 'sticky', top: 0, height: '100vh', borderRight: '1px solid var(--dv-border-soft)', background: 'var(--dv-bg-2)' }}>
        <Sidebar items={CONSOLE_NAV} />
      </div>

      {drawer && (
        <div onClick={() => setDrawer(false)} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.6)' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 280, height: '100%', background: 'var(--dv-bg-2)', borderRight: '1px solid var(--dv-border)' }}>
            <Sidebar items={CONSOLE_NAV} onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 40, height: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', borderBottom: '1px solid var(--dv-border-soft)', background: 'rgba(7,7,13,.85)', backdropFilter: 'blur(14px)' }}>
          <button type="button" className="dv-btn dv-btn-ghost dv-btn-sm dv-console-burger" aria-label="Open menu" onClick={() => setDrawer(true)}>{drawer ? <X size={18} /> : <Menu size={18} />}</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, minWidth: 0 }}>
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{platform.name}</span>
            <span className="dv-badge" style={{ textTransform: 'capitalize' }}>{platform.tier}</span>
            {current && <><ChevronRight size={14} color="var(--dv-dim)" /><span className="dv-muted dv-crumb">{current.label}</span></>}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <DevLink href="/console/billing#live" className={badge.cls + ' dv-live-badge'}><span className="dv-dot" />{badge.text}</DevLink>
            <UserButton appearance={{ elements: { avatarBox: { width: 30, height: 30 } } }} />
          </div>
        </header>
        <main style={{ padding: '32px 32px 64px', maxWidth: 1180, width: '100%' }} className="dv-console-main">{children}</main>
      </div>

      <style>{`
        .dv-console-burger { display: none !important; }
        @media (max-width: 960px) {
          .dv-console { grid-template-columns: minmax(0, 1fr) !important; }
          .dv-console-side { display: none; }
          .dv-console-burger { display: inline-flex !important; }
          .dv-console-main { padding: 22px 16px 48px !important; }
          .dv-crumb { display: none; }
        }
        @media (max-width: 560px) { .dv-live-badge { display: none !important; } }
      `}</style>
    </div>
  )
}

/** Page title block used at the top of every console page. */
export function PageHead({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
      <div>
        <h1 className="dv-h1">{title}</h1>
        {sub && <p className="dv-sub">{sub}</p>}
      </div>
      {actions}
    </div>
  )
}
