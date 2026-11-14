'use client'

// =============================================================================
// THE CONSOLE SHELL — a left sidebar on every console page
// =============================================================================
// Laid out like the Vercel and Clerk dashboards: the project switcher at the
// top of the sidebar, Find… under it, the Test / Live switch, the main pages,
// then collapsible groups (Configure, Resources) the way Clerk's Configure
// tab nests its sections. The account and theme sit at the bottom.
//
// The sidebar is always there on a computer. On a phone it slides in from the
// menu button in the top bar. Inside the console there is no link back to
// dialerseat.com: that choice was made on the welcome screen.
// =============================================================================

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { Check, ChevronDown, ChevronsUpDown, FlaskConical, Menu, Plus, Radio, Settings, X } from 'lucide-react'
import { CONSOLE_NAV } from '@/lib/developers/consoleNav'
import { DevLink, useDevBase, withBase } from './base'
import { NAV_ICONS, api } from './ui'
import { SearchTrigger } from './SearchPalette'
import { ThemeToggle } from './theme'

export interface ShellPlatform {
  id: string
  name: string
  live_status: string
  tier: string
  setup_done: boolean
}
export interface ShellProject { id: string; name: string; live_status: string }

const MAIN = ['/console', '/console/setup', '/console/seats', '/console/usage', '/console/billing']
const GROUPS: { id: string; label: string; items: string[] }[] = [
  { id: 'configure', label: 'Configure', items: ['/console/api-keys', '/console/webhooks', '/console/miniplayer', '/console/dial-modes', '/console/dispositions', '/console/settings'] },
  { id: 'resources', label: 'Resources', items: ['/docs/quickstart', '/docs/integration-approaches', '/docs/api', '/playground'] },
]
const EXTRA_LABELS: Record<string, { label: string; icon: keyof typeof NAV_ICONS }> = {
  '/docs/integration-approaches': { label: 'Integration guide', icon: 'miniplayer' },
}

function navInfo(href: string) {
  const n = CONSOLE_NAV.find(x => x.href === href)
  if (n) return { label: n.label, icon: n.icon }
  return EXTRA_LABELS[href] || { label: href, icon: 'docs' as const }
}

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

function ProjectMark({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: 6, background: '#2a6eff', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.46, fontWeight: 700, flexShrink: 0, fontFamily: 'var(--dv-sans)' }}>
      {(name.trim()[0] || 'D').toUpperCase()}
    </span>
  )
}

/** The project switcher at the top of the sidebar, like Vercel's team and project menu. */
function ProjectSwitcher({ platform, projects, onNavigate }: { platform: ShellPlatform; projects: ShellProject[]; onNavigate: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const ref = useOutsideClose(open, () => setOpen(false))
  const choose = async (id: string) => {
    if (id === platform.id) { setOpen(false); return }
    setBusy(id)
    try {
      await api('/api/developers/projects/current', { method: 'POST', body: { id } })
      setOpen(false); onNavigate()
      router.refresh()
    } finally { setBusy(null) }
  }
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="dv-proj" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="menu">
        <ProjectMark name={platform.name} />
        <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{platform.name}</span>
          <span className="dv-dim" style={{ display: 'block', fontSize: 12, textTransform: 'capitalize' }}>{platform.tier} · {platform.live_status === 'active' ? 'Live dialing on' : 'Test mode'}</span>
        </span>
        <ChevronsUpDown size={14} color="var(--dv-dim)" style={{ flexShrink: 0 }} />
      </button>
      {open && (
        <div className="dv-menu" role="menu" style={{ left: 0, right: 0, minWidth: 0 }}>
          <div className="dv-dim" style={{ fontSize: 12, padding: '6px 10px 4px' }}>Projects</div>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {projects.map(p => (
              <button key={p.id} type="button" role="menuitemradio" aria-checked={p.id === platform.id} className="dv-menu-item" onClick={() => choose(p.id)} disabled={!!busy}>
                <ProjectMark name={p.name} size={20} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                {busy === p.id ? <span className="dv-dim" style={{ fontSize: 12 }}>…</span> : p.id === platform.id && <Check size={15} color="var(--dv-accent)" />}
              </button>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--dv-border-soft)', marginTop: 6, paddingTop: 6 }}>
            <DevLink href="/new" className="dv-menu-item" role="menuitem" onClick={() => setOpen(false)}><Plus size={15} /> New project</DevLink>
            <DevLink href="/console/settings" className="dv-menu-item" role="menuitem" onClick={() => { setOpen(false); onNavigate() }}><Settings size={15} /> Project settings</DevLink>
          </div>
        </div>
      )}
    </div>
  )
}

/** The Test / Live choice, read by the server (lib/developers/server.ts consoleEnv). */
function saveEnv(e: 'test' | 'live') {
  document.cookie = `dv-env=${e}; path=/; max-age=31536000; samesite=lax`
}

function EnvSwitch({ env, liveOn }: { env: 'test' | 'live'; liveOn: boolean }) {
  const router = useRouter()
  const choose = (e: 'test' | 'live') => { if (e === env) return; saveEnv(e); router.refresh() }
  return (
    <div className="dv-seg" role="tablist" aria-label="Environment" style={{ display: 'flex', width: '100%' }}>
      <button type="button" role="tab" aria-selected={env === 'test'} onClick={() => choose('test')} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <FlaskConical size={13} /> Test
      </button>
      <button type="button" role="tab" aria-selected={env === 'live'} onClick={() => choose('live')} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Radio size={13} /> Live
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: liveOn ? 'var(--dv-green)' : 'var(--dv-dim)' }} aria-label={liveOn ? 'Live dialing on' : 'Live dialing off'} />
      </button>
    </div>
  )
}

function Sidebar({ platform, projects, env, onNavigate }: { platform: ShellPlatform; projects: ShellProject[]; env: 'test' | 'live'; onNavigate: () => void }) {
  const pathname = usePathname()
  const base = useDevBase()
  const is = (h: string) => pathname === withBase(base, h)
  const groupHasCurrent = (items: string[]) => items.some(is)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const toggle = (id: string) => setCollapsed(c => ({ ...c, [id]: !c[id] }))

  const item = (h: string, nested = false) => {
    const n = navInfo(h)
    const Icon = NAV_ICONS[n.icon]
    const external = h === '/playground' || h.startsWith('/docs')
    return (
      <DevLink key={h} href={h} className={`dv-side-item${nested ? ' dv-side-nested' : ''}`} aria-current={is(h) ? 'page' : undefined} onClick={onNavigate}
        {...(external ? { target: '_blank', rel: 'noopener' } : {})}>
        {!nested && <Icon size={16} />}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.label}</span>
        {h === '/console/setup' && !platform.setup_done && <span className="dv-badge dv-badge-blue" style={{ height: 18, fontSize: 10.5 }}>Start here</span>}
      </DevLink>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 10px 10px', display: 'grid', gap: 10 }}>
        <ProjectSwitcher platform={platform} projects={projects} onNavigate={onNavigate} />
        <SearchTrigger />
        <EnvSwitch env={env} liveOn={platform.live_status === 'active'} />
      </div>
      <nav aria-label="Console" style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 12px' }}>
        {MAIN.map(h => item(h))}
        {GROUPS.map(g => {
          const open = !collapsed[g.id] || groupHasCurrent(g.items)
          return (
            <div key={g.id} style={{ marginTop: 14 }}>
              <button type="button" className="dv-side-group-btn" aria-expanded={open} onClick={() => toggle(g.id)}>
                {g.label}
                <ChevronDown size={14} style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
              </button>
              {open && <div className="dv-side-tree">{g.items.map(h => item(h, true))}</div>}
            </div>
          )
        })}
      </nav>
      <div style={{ borderTop: '1px solid var(--dv-border-soft)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <UserButton appearance={{ elements: { avatarBox: { width: 28, height: 28 } } }} />
        <span className="dv-dim" style={{ flex: 1, fontSize: 12.5 }}>Account</span>
        <ThemeToggle />
      </div>
    </div>
  )
}

export function ConsoleShell({ platform, projects, env, children }: { platform: ShellPlatform; projects: ShellProject[]; env: 'test' | 'live'; children: React.ReactNode }) {
  const pathname = usePathname()
  const base = useDevBase()
  const [drawer, setDrawer] = useState(false)
  const current = [...MAIN, ...GROUPS.flatMap(g => g.items)].find(h => pathname === withBase(base, h))
  const title = current ? navInfo(current).label : ''

  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [drawer])

  return (
    <div className="dv-app dv-console" style={{ minHeight: '100vh', background: 'var(--dv-bg)' }}>
      <aside className="dv-console-side" aria-label="Sidebar">
        <Sidebar platform={platform} projects={projects} env={env} onNavigate={() => setDrawer(false)} />
      </aside>

      {drawer && <div className="dv-console-scrim" onClick={() => setDrawer(false)} aria-hidden />}
      <aside className={`dv-console-drawer${drawer ? ' open' : ''}`} aria-label="Menu" aria-hidden={!drawer}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 8px 0' }}>
          <button type="button" className="dv-btn dv-btn-ghost" onClick={() => setDrawer(false)} aria-label="Close menu" style={{ width: 40, padding: 0 }}><X size={18} /></button>
        </div>
        {drawer && <Sidebar platform={platform} projects={projects} env={env} onNavigate={() => setDrawer(false)} />}
      </aside>

      <div className="dv-console-body">
        <header className="dv-console-top">
          <button type="button" className="dv-btn dv-btn-ghost dv-console-menu" onClick={() => setDrawer(true)} aria-label="Open menu" style={{ width: 40, padding: 0 }}><Menu size={18} /></button>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, fontSize: 14 }}>
            <span className="dv-muted dv-console-crumb" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{platform.name}</span>
            {title && <><span className="dv-crumb-sep dv-console-crumb">/</span><span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{title}</span></>}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className={`dv-badge ${env === 'live' ? 'dv-badge-green' : 'dv-badge-amber'}`}><span className="dv-dot" />{env === 'live' ? 'Live' : 'Test'}</span>
            <span className="dv-console-search-compact" style={{ width: 40 }}><SearchTrigger compact shortcuts={false} /></span>
          </span>
        </header>
        <main className="dv-console-main">
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>{children}</div>
        </main>
      </div>

      <style>{`
        .dv-console { --side-w: 260px; }
        .dv-console-side { position: fixed; top: 0; left: 0; bottom: 0; width: var(--side-w); border-right: 1px solid var(--dv-border-soft); background: var(--dv-bg-2); z-index: 30; }
        .dv-console-body { margin-left: var(--side-w); min-width: 0; }
        .dv-console-top { position: sticky; top: 0; z-index: 20; height: 52px; display: flex; align-items: center; gap: 10px; padding: 0 28px; background: var(--dv-header-bg); backdrop-filter: blur(8px); border-bottom: 1px solid var(--dv-border-soft); }
        .dv-console-main { padding: 32px 40px 64px; }
        .dv-console-menu, .dv-console-search-compact { display: none !important; }
        .dv-console-drawer { position: fixed; top: 0; left: 0; bottom: 0; width: min(86vw, 300px); background: var(--dv-bg); border-right: 1px solid var(--dv-border); z-index: 70; transform: translateX(-102%); transition: transform .2s; display: flex; flex-direction: column; }
        .dv-console-drawer.open { transform: none; }
        .dv-console-scrim { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 65; }
        .dv-proj { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px; border-radius: 10px; border: 1px solid var(--dv-border-soft); background: var(--dv-panel); color: var(--dv-text); font: 14px var(--dv-ui); cursor: pointer; }
        .dv-proj:hover { border-color: var(--dv-hover-border); }
        .dv-side-group-btn { display: flex; align-items: center; justify-content: space-between; width: 100%; height: 30px; padding: 0 10px; border: none; background: transparent; color: var(--dv-dim); font: 500 12px var(--dv-ui); cursor: pointer; border-radius: 6px; }
        .dv-side-group-btn:hover { color: var(--dv-text); }
        .dv-side-tree { margin: 2px 0 0 18px; padding-left: 10px; border-left: 1px solid var(--dv-border); }
        .dv-side-nested { height: 32px; }
        @media (max-width: 1000px) {
          .dv-console-side { display: none; }
          .dv-console-body { margin-left: 0; }
          .dv-console-menu, .dv-console-search-compact { display: inline-flex !important; }
          .dv-console-top { padding: 0 12px; }
          .dv-console-main { padding: 22px 16px 56px; }
        }
        @media (max-width: 480px) { .dv-console-crumb { display: none; } }
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
