'use client'

// =============================================================================
// THE CONSOLE SHELL — laid out like the developer dashboards it sits beside
// =============================================================================
// Top bar: platform menu / environment switch, then search, docs, theme and
// account. Under it a tab row. Configure pages get the left sidebar with its
// own Find…, the way Clerk lays out its settings. Light by default; the
// switch in the top bar flips it, and the choice is remembered.
// =============================================================================

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { ArrowLeft, BookOpen, Check, ChevronsUpDown, FlaskConical, Radio, Settings } from 'lucide-react'
import { CONSOLE_NAV } from '@/lib/developers/consoleNav'
import { DevLink, useDevBase, useDevHref, useMainSiteUrl, withBase } from './base'
import { NAV_ICONS } from './ui'
import { SearchTrigger } from './SearchPalette'
import { ThemeToggle } from './theme'

export interface ShellPlatform {
  name: string
  live_status: string
  tier: string
}

const CONFIGURE = [
  { group: 'Developers', items: ['/console/api-keys', '/console/webhooks', '/console/miniplayer'] },
  { group: 'Dialing', items: ['/console/dial-modes', '/console/dispositions'] },
  { group: 'Platform', items: ['/console/settings'] },
]
const CONFIGURE_PATHS = CONFIGURE.flatMap(g => g.items)

const TABS = [
  { href: '/console', label: 'Overview' },
  { href: '/console/seats', label: 'Seats' },
  { href: '/console/usage', label: 'Usage & logs' },
  { href: '/console/billing', label: 'Billing' },
  { href: '/console/api-keys', label: 'Configure', configure: true },
]

const navItem = (href: string) => CONSOLE_NAV.find(n => n.href === href)!

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, close])
  return ref
}

function PlatformMenu({ platform }: { platform: ShellPlatform }) {
  const [open, setOpen] = useState(false)
  const ref = useOutsideClose(open, () => setOpen(false))
  const main = useMainSiteUrl()
  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0 }}>
      <button type="button" className="dv-switcher" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="menu" style={{ maxWidth: '100%' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{platform.name}</span>
        <span className="dv-badge dv-hide-narrow" style={{ height: 20, textTransform: 'capitalize' }}>{platform.tier}</span>
        <ChevronsUpDown size={14} color="var(--dv-dim)" style={{ flexShrink: 0 }} />
      </button>
      {open && (
        <div className="dv-menu" role="menu">
          <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid var(--dv-border-soft)', marginBottom: 6 }}>
            <div style={{ fontWeight: 600 }}>{platform.name}</div>
            <div className="dv-dim" style={{ fontSize: 12.5, marginTop: 2, textTransform: 'capitalize' }}>{platform.tier} tier</div>
          </div>
          <DevLink href="/console/settings" className="dv-menu-item" role="menuitem" onClick={() => setOpen(false)}><Settings size={15} /> Platform settings</DevLink>
          <DevLink href="/docs/quickstart" className="dv-menu-item" role="menuitem" onClick={() => setOpen(false)}><BookOpen size={15} /> Docs</DevLink>
          <a href={main} className="dv-menu-item" role="menuitem"><ArrowLeft size={15} /> Go back to dialerseat.com</a>
        </div>
      )}
    </div>
  )
}

/** The Test / Live choice, read by the server (lib/developers/server.ts consoleEnv). */
function saveEnv(e: 'test' | 'live') {
  document.cookie = `dv-env=${e}; path=/; max-age=31536000; samesite=lax`
}

/** Test or live, like a dashboard's Development / Production switch. */
function EnvSwitcher({ env, liveStatus }: { env: 'test' | 'live'; liveStatus: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useOutsideClose(open, () => setOpen(false))
  const choose = (e: 'test' | 'live') => {
    saveEnv(e)
    setOpen(false)
    router.refresh()
  }
  const liveOn = liveStatus === 'active'
  const dot = env === 'test' ? 'var(--dv-amber)' : liveOn ? 'var(--dv-green)' : 'var(--dv-dim)'
  const options: { id: 'test' | 'live'; label: string; desc: string; icon: React.ReactNode }[] = [
    { id: 'test', label: 'Test', desc: 'Test keys and data. Calls are simulated.', icon: <FlaskConical size={15} /> },
    { id: 'live', label: 'Live', desc: liveOn ? 'Live keys and data. Live dialing is on.' : 'Live keys and data. Live dialing is not on yet.', icon: <Radio size={15} /> },
  ]
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="dv-switcher" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="menu">
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />
        {env === 'test' ? 'Test' : 'Live'}
        <ChevronsUpDown size={14} color="var(--dv-dim)" />
      </button>
      {open && (
        <div className="dv-menu" role="menu" style={{ minWidth: 280 }}>
          {options.map(o => (
            <button key={o.id} type="button" role="menuitemradio" aria-checked={env === o.id} className="dv-menu-item" onClick={() => choose(o.id)} style={{ alignItems: 'flex-start' }}>
              <span style={{ marginTop: 2 }}>{o.icon}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 500 }}>{o.label}</span>
                <span className="dv-dim" style={{ display: 'block', fontSize: 12.5, marginTop: 2 }}>{o.desc}</span>
              </span>
              {env === o.id && <Check size={15} color="var(--dv-accent)" style={{ marginTop: 2 }} />}
            </button>
          ))}
          {!liveOn && <DevLink href="/console/billing#live" className="dv-menu-item" onClick={() => setOpen(false)} style={{ color: 'var(--dv-accent)', borderTop: '1px solid var(--dv-border-soft)', marginTop: 6, borderRadius: 0, paddingTop: 12 }}>Activate live dialing</DevLink>}
        </div>
      )}
    </div>
  )
}

export function ConsoleShell({ platform, env, children }: { platform: ShellPlatform; env: 'test' | 'live'; children: React.ReactNode }) {
  const pathname = usePathname()
  const base = useDevBase()
  const href = useDevHref()
  const router = useRouter()
  const main = useMainSiteUrl()
  const is = (h: string) => pathname === withBase(base, h)
  const inConfigure = CONFIGURE_PATHS.some(is)

  // On a phone the tab row scrolls sideways; keep the current tab in view.
  useEffect(() => {
    document.querySelector('.dv-tab[aria-current="page"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [pathname])

  return (
    <div className="dv-app" style={{ minHeight: '100vh', background: 'var(--dv-bg)' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 40 }}>
        <header className="dv-top">
          <DevLink href="/console" aria-label="Console home" style={{ display: 'inline-flex', flexShrink: 0 }}>
            <span style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #4a9eff, #2a6eff)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'var(--dv-sans)' }}>D</span>
          </DevLink>
          <span className="dv-crumb-sep dv-hide-narrow">/</span>
          <span className="dv-hide-narrow" style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>Developers</span>
          <span className="dv-crumb-sep">/</span>
          <PlatformMenu platform={platform} />
          <span className="dv-crumb-sep">/</span>
          <EnvSwitcher env={env} liveStatus={platform.live_status} />

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Configure pages have Find… in the sidebar (as Clerk does); elsewhere it lives here. */}
            {!inConfigure && <div className="dv-top-search" style={{ width: 240 }}><SearchTrigger /></div>}
            <div className="dv-top-search-compact" style={{ width: 36 }}><SearchTrigger compact shortcuts={false} /></div>
            <DevLink href="/docs/quickstart" className="dv-btn dv-btn-ghost dv-hide-narrow" style={{ color: 'var(--dv-muted)' }}><BookOpen size={15} /> Docs</DevLink>
            <a href={main} className="dv-btn dv-btn-ghost dv-hide-medium" style={{ color: 'var(--dv-muted)' }}><ArrowLeft size={15} /> dialerseat.com</a>
            <ThemeToggle />
            <span style={{ display: 'inline-flex', marginLeft: 4 }}><UserButton appearance={{ elements: { avatarBox: { width: 28, height: 28 } } }} /></span>
          </div>
        </header>
        <nav className="dv-tabs" aria-label="Console">
          {TABS.map(t => {
            const active = t.configure ? inConfigure : is(t.href)
            return <DevLink key={t.label} href={t.href} className="dv-tab" aria-current={active ? 'page' : undefined}>{t.label}</DevLink>
          })}
        </nav>
      </div>

      {inConfigure ? (
        <div className="dv-config" style={{ display: 'grid', gridTemplateColumns: '264px minmax(0, 1fr)', minHeight: 'calc(100vh - 101px)' }}>
          <aside className="dv-side dv-config-side" style={{ borderRight: '1px solid var(--dv-border-soft)', position: 'sticky', top: 101, alignSelf: 'start', height: 'calc(100vh - 101px)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0 2px 6px' }}><SearchTrigger /></div>
            <nav aria-label="Configure" style={{ flex: 1 }}>
              {CONFIGURE.map(g => (
                <div key={g.group}>
                  <div className="dv-side-group">{g.group}</div>
                  {g.items.map(h => {
                    const n = navItem(h)
                    const Icon = NAV_ICONS[n.icon]
                    return <DevLink key={h} href={h} className="dv-side-item" aria-current={is(h) ? 'page' : undefined}><Icon size={16} />{n.label}</DevLink>
                  })}
                </div>
              ))}
            </nav>
            <a href={main} className="dv-side-item" style={{ marginTop: 16, borderTop: '1px solid var(--dv-border-soft)', borderRadius: 0, height: 44 }}><ArrowLeft size={15} /> Go back to dialerseat.com</a>
          </aside>
          <main className="dv-console-main" style={{ padding: '32px 40px 64px', minWidth: 0 }}>
            {/* Phones: the configure sections as one picker instead of the sidebar. */}
            <label className="dv-config-picker" style={{ display: 'none', marginBottom: 20 }}>
              <span className="dv-label">Configure</span>
              <select className="dv-select" value={CONFIGURE_PATHS.find(is) || ''} onChange={e => router.push(href(e.target.value))}>
                {CONFIGURE.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.items.map(h => <option key={h} value={h}>{navItem(h).label}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <div style={{ maxWidth: 1040, margin: '0 auto' }}>{children}</div>
          </main>
        </div>
      ) : (
        <main className="dv-console-main" style={{ padding: '32px 40px 64px' }}>
          <div style={{ maxWidth: 1160, margin: '0 auto' }}>{children}</div>
        </main>
      )}

      <style>{`
        .dv-top-search-compact { display: none; }
        @media (max-width: 1180px) { .dv-hide-medium { display: none !important; } }
        @media (max-width: 1000px) {
          .dv-top-search { display: none; }
          .dv-top-search-compact { display: block; }
          .dv-config { grid-template-columns: minmax(0, 1fr) !important; }
          .dv-config-side { display: none !important; }
          .dv-config-picker { display: block !important; }
        }
        @media (max-width: 760px) {
          .dv-hide-narrow { display: none !important; }
          .dv-top { padding: 0 10px 0 12px !important; gap: 4px !important; }
          .dv-tabs { padding: 0 8px !important; }
          .dv-console-main { padding: 20px 16px 48px !important; }
          .dv-menu { position: fixed !important; left: 12px !important; right: 12px !important; top: 60px !important; min-width: 0 !important; }
        }
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
