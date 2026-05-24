'use client'

// =============================================================================
// ADMIN SETTINGS — IE7 cosplay edition
// =============================================================================
// Rebuilt from scratch to provide a literal 2006-era Internet Explorer 7
// chrome around DialerSeat's admin tools. Every Windows Aero element renders:
//
//   - Aero blue gradient title bar with frosted glass effect (CSS only)
//   - DialerSeat gradient D logo + "DialerSeat Admin" title text
//   - Window controls (—, □, X) — X navigates to /dashboard
//   - Menu bar: File / Edit / View / Favorites / Tools / Help (cosplay)
//   - Command bar: Back / Forward / Refresh / Home / Search / Favorites / Tools
//   - Address bar: shows https://admin.dialerseat.com/<active-tab>/
//   - Angled IE7 tab strip with glossy active tab
//   - Status bar: "Done | Internet | 100%"
//
// Top-level tabs (in this order):
//   1. DASHBOARD       — coming soon placeholder
//   2. NUMBERS         — links out to existing /dashboard/admin/numbers page
//   3. WHITE LABEL     — LIVE, has sub-tabs (Tenants, Branding, Billing,
//                                            Demo View, Settings)
//   4. USERS           — coming soon placeholder
//   5. TEAMS           — LIVE, shows every team across platform with drilldown
//   6. BILLING         — coming soon placeholder
//   7. SYSTEM          — coming soon placeholder
//
// White Label sub-tabs (rendered when WHITE LABEL is the active main tab):
//   1. Tenants         — LIVE, CRUD list of all white_label_tenants
//   2. Branding        — LIVE, edit a tenant's brand + live preview
//   3. Billing         — coming soon
//   4. Demo View       — LIVE, impersonation tool ("view as team")
//   5. Settings        — coming soon
//
// API endpoints this page calls (some don't exist yet — sections show a
// notice with the endpoint name and expected response shape when missing):
//
//   GET  /api/admin/tenants                  — list all tenants
//   POST /api/admin/tenants                  — create new tenant
//   PATCH /api/admin/tenants/:id             — update tenant
//   DELETE /api/admin/tenants/:id            — delete tenant
//   GET  /api/admin/teams                    — list all teams platform-wide
//   GET  /api/admin/teams/:id                — team detail with members
//   POST /api/admin/impersonate              — start "view as team" session
// =============================================================================

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ── IE7 / Aero palette (authentic to 2006-2009 Windows + IE) ────────────────
const IE = {
  // Title bar Aero gradient (light blue, frosted)
  titleBarFrom: '#bfdcf5',
  titleBarMid: '#7baeda',
  titleBarTo: '#4f88c4',
  titleBarText: '#1c1c2c',

  // Window border
  windowBorder: '#3a6ea5',
  windowBorderInner: '#a4c3e5',

  // Menu bar
  menuBg: '#f0f4f8',
  menuText: '#1c1c2c',
  menuHover: '#cee2f7',
  menuHoverBorder: '#7ba6db',

  // Command bar / toolbar
  toolbarBgFrom: '#f5f9fd',
  toolbarBgTo: '#dde7f1',
  toolbarBtnHover: '#fff5cc',
  toolbarBtnHoverBorder: '#e0a228',
  toolbarBtnActive: '#fbe399',

  // Address bar
  addrBg: '#ffffff',
  addrBorder: '#7f9db9',
  addrText: '#1c1c2c',

  // Tab strip
  tabStripBg: '#dde7f1',
  tabInactiveFrom: '#e8f0f8',
  tabInactiveTo: '#c0d4e8',
  tabActiveFrom: '#ffffff',
  tabActiveTo: '#dde7f1',
  tabBorder: '#7ba6db',
  tabText: '#1c1c2c',
  tabTextInactive: '#3a4858',

  // Content area
  contentBg: '#f5f9fd',
  contentText: '#1c1c2c',

  // Status bar
  statusBg: '#dde7f1',
  statusBorder: '#a4c3e5',
  statusText: '#3a4858',

  // Accent for live data / DialerSeat brand integration
  brandBlue: '#4a9eff',
  brandDark: '#1a1a2e',
  brandText: '#1a1c24',

  // Status indicators
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
  muted: '#5a5e6a',
  border: '#c4c8d0',
  surface: '#f0f1f4',
  surfaceAlt: '#e2e4ea',
}

// ── Tab definitions ─────────────────────────────────────────────────────────
type MainTabKey =
  | 'dashboard'
  | 'numbers'
  | 'whitelabel'
  | 'users'
  | 'teams'
  | 'billing'
  | 'system'

interface MainTab {
  key: MainTabKey
  label: string
  slug: string // appears in address bar
  status: 'live' | 'coming-soon' | 'external'
  externalHref?: string
}

const MAIN_TABS: MainTab[] = [
  { key: 'dashboard',  label: 'Dashboard',   slug: 'dashboard',   status: 'coming-soon' },
  { key: 'numbers',    label: 'Numbers',     slug: 'numbers',     status: 'external', externalHref: '/dashboard/admin/numbers' },
  { key: 'whitelabel', label: 'White Label', slug: 'whitelabel',  status: 'live' },
  { key: 'users',      label: 'Users',       slug: 'users',       status: 'coming-soon' },
  { key: 'teams',      label: 'Teams',       slug: 'teams',       status: 'live' },
  { key: 'billing',    label: 'Billing',     slug: 'billing',     status: 'coming-soon' },
  { key: 'system',     label: 'System',      slug: 'system',      status: 'coming-soon' },
]

type WLSubTabKey = 'tenants' | 'branding' | 'billing' | 'demoview' | 'settings'

interface WLSubTab {
  key: WLSubTabKey
  label: string
  status: 'live' | 'coming-soon'
}

const WL_SUBTABS: WLSubTab[] = [
  { key: 'tenants',   label: 'Tenants',    status: 'live' },
  { key: 'branding',  label: 'Branding',   status: 'live' },
  { key: 'billing',   label: 'Billing',    status: 'coming-soon' },
  { key: 'demoview',  label: 'Demo View',  status: 'live' },
  { key: 'settings',  label: 'Settings',   status: 'coming-soon' },
]

// ── Types ───────────────────────────────────────────────────────────────────
interface Tenant {
  id: string
  slug: string
  brand_name: string
  owner_clerk_id: string
  status: 'active' | 'suspended' | 'cancelled'
  primary_color: string
  secondary_color: string
  accent_color: string
  background_color: string
  text_color: string
  logo_url: string | null
  favicon_url: string | null
  footer_text: string | null
  support_email: string
  stripe_subscription_id: string | null
  created_at: string
  updated_at: string
}

interface TeamRow {
  id: string
  name: string
  owner_clerk_id: string
  tenant_id: string | null
  tenant_slug: string | null
  member_count: number
  campaign_count: number
  total_calls_30d: number
  status: 'active' | 'inactive'
  created_at: string
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export default function AdminSettingsPage() {
  const router = useRouter()
  const [activeMain, setActiveMain] = useState<MainTabKey>('whitelabel')
  const [activeWLSub, setActiveWLSub] = useState<WLSubTabKey>('tenants')
  const [statusBarText, setStatusBarText] = useState('Done')
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  // Build the address bar URL based on active tab
  const addressBarUrl = (() => {
    const main = MAIN_TABS.find(t => t.key === activeMain)
    if (!main) return 'https://admin.dialerseat.com/'
    if (activeMain === 'whitelabel') {
      return `https://admin.dialerseat.com/${main.slug}/${activeWLSub}/`
    }
    return `https://admin.dialerseat.com/${main.slug}/`
  })()

  const handleTabClick = (tab: MainTab) => {
    if (tab.status === 'external' && tab.externalHref) {
      router.push(tab.externalHref)
      return
    }
    setActiveMain(tab.key)
  }

  // Close menu on outside click
  useEffect(() => {
    if (!openMenu) return
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('.ie7-menu')) setOpenMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [openMenu])

  return (
    <div style={{
      flex: 1,
      background: '#5a7ba8', // Windows 7 desktop blue showing through transparent edges
      minHeight: 'calc(100vh - 64px)',
      padding: 20,
      fontFamily: '"Tahoma", "Geneva", sans-serif', // Authentic Windows font
    }}>
      <style>{`
        /* Authentic IE7/Aero typography */
        .ie7-window * { font-family: "Tahoma", "Geneva", sans-serif; }
        .ie7-window { font-size: 11px; }

        /* IE7 angled tabs — pseudo elements create the diagonal cuts */
        .ie7-tab {
          position: relative;
          padding: 6px 18px 6px 12px;
          margin-right: -8px;
          cursor: pointer;
          z-index: 1;
          color: ${IE.tabTextInactive};
          background: linear-gradient(to bottom, ${IE.tabInactiveFrom}, ${IE.tabInactiveTo});
          border: 1px solid ${IE.tabBorder};
          border-bottom: none;
          border-radius: 4px 8px 0 0;
          font-size: 11px;
          font-weight: normal;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s;
        }
        .ie7-tab:hover {
          background: linear-gradient(to bottom, #ffffff, #d0e0f0);
        }
        .ie7-tab.active {
          z-index: 2;
          background: linear-gradient(to bottom, ${IE.tabActiveFrom}, ${IE.tabActiveTo});
          color: ${IE.tabText};
          font-weight: bold;
          padding-bottom: 7px;
          margin-bottom: -1px;
        }

        /* IE7 toolbar buttons */
        .ie7-toolbar-btn {
          padding: 3px 8px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 3px;
          font-size: 11px;
          color: ${IE.menuText};
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .ie7-toolbar-btn:hover {
          background: ${IE.toolbarBtnHover};
          border-color: ${IE.toolbarBtnHoverBorder};
        }
        .ie7-toolbar-btn:active {
          background: ${IE.toolbarBtnActive};
          border-color: ${IE.toolbarBtnHoverBorder};
        }
        .ie7-toolbar-btn.disabled {
          opacity: 0.4;
          cursor: default;
          pointer-events: none;
        }

        /* Menu items */
        .ie7-menu-item {
          padding: 2px 8px;
          cursor: pointer;
          font-size: 11px;
          color: ${IE.menuText};
          user-select: none;
        }
        .ie7-menu-item:hover,
        .ie7-menu-item.open {
          background: ${IE.menuHover};
          border: 1px solid ${IE.menuHoverBorder};
          padding: 1px 7px;
        }

        /* Menu dropdown */
        .ie7-menu-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          min-width: 180px;
          background: #f5f5f5;
          border: 1px solid #6b6b6b;
          box-shadow: 3px 3px 8px rgba(0,0,0,0.3);
          z-index: 1000;
          padding: 2px;
        }
        .ie7-menu-dropdown-item {
          padding: 4px 24px 4px 28px;
          font-size: 11px;
          color: ${IE.menuText};
          cursor: pointer;
          position: relative;
        }
        .ie7-menu-dropdown-item:hover {
          background: ${IE.brandBlue};
          color: white;
        }
        .ie7-menu-dropdown-item.disabled {
          color: #999;
          cursor: default;
        }
        .ie7-menu-dropdown-item.disabled:hover {
          background: transparent;
          color: #999;
        }
        .ie7-menu-separator {
          height: 1px;
          background: #d0d0d0;
          margin: 2px 4px;
        }

        /* Window controls (—, □, X) */
        .ie7-window-control {
          width: 28px;
          height: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid transparent;
          font-size: 11px;
          color: ${IE.titleBarText};
          cursor: pointer;
          user-select: none;
        }
        .ie7-window-control:hover {
          background: rgba(255,255,255,0.4);
          border-color: rgba(255,255,255,0.6);
        }
        .ie7-window-control.close:hover {
          background: #e81123;
          color: white;
          border-color: #c20013;
        }

        /* Content panel styling */
        .ie7-content {
          background: ${IE.contentBg};
          border: 1px solid ${IE.tabBorder};
          border-top: none;
          padding: 16px;
          min-height: 500px;
          color: ${IE.contentText};
          font-size: 12px;
        }

        /* Tables in content */
        .ie7-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border: 1px solid ${IE.border};
        }
        .ie7-table th {
          background: linear-gradient(to bottom, #f5f9fd, #dde7f1);
          padding: 6px 10px;
          text-align: left;
          font-size: 11px;
          font-weight: bold;
          color: ${IE.brandText};
          border-bottom: 1px solid ${IE.border};
          border-right: 1px solid ${IE.border};
          white-space: nowrap;
        }
        .ie7-table td {
          padding: 6px 10px;
          font-size: 11px;
          border-bottom: 1px solid ${IE.surface};
          border-right: 1px solid ${IE.surface};
          color: ${IE.contentText};
        }
        .ie7-table tr:hover td {
          background: #fffdf0;
        }
        .ie7-table tr.selected td {
          background: ${IE.brandBlue};
          color: white;
        }

        /* Sub-tab strip (inside content) */
        .ie7-subtab-strip {
          display: flex;
          gap: 0;
          border-bottom: 1px solid ${IE.border};
          margin-bottom: 16px;
          padding-bottom: 0;
        }
        .ie7-subtab {
          padding: 6px 16px;
          background: transparent;
          border: 1px solid transparent;
          border-bottom: none;
          font-size: 11px;
          color: ${IE.muted};
          cursor: pointer;
          margin-bottom: -1px;
        }
        .ie7-subtab:hover {
          background: ${IE.surface};
        }
        .ie7-subtab.active {
          background: white;
          border-color: ${IE.border};
          border-bottom-color: white;
          color: ${IE.brandText};
          font-weight: bold;
        }
        .ie7-subtab.coming-soon {
          font-style: italic;
          color: #999;
        }

        /* Coming soon panel */
        .ie7-coming-soon {
          background: white;
          border: 1px solid ${IE.border};
          padding: 60px 20px;
          text-align: center;
          color: ${IE.muted};
        }
        .ie7-coming-soon-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.4;
        }
        .ie7-coming-soon-title {
          font-size: 14px;
          font-weight: bold;
          color: ${IE.brandText};
          margin-bottom: 8px;
          letter-spacing: 1px;
        }
        .ie7-coming-soon-sub {
          font-size: 11px;
          color: ${IE.muted};
          max-width: 400px;
          margin: 0 auto;
          line-height: 1.5;
        }

        /* Form fields */
        .ie7-input {
          padding: 4px 8px;
          font-size: 11px;
          border: 1px solid ${IE.addrBorder};
          background: white;
          color: ${IE.brandText};
          font-family: inherit;
          width: 100%;
          box-sizing: border-box;
        }
        .ie7-input:focus {
          outline: 1px solid ${IE.brandBlue};
          outline-offset: -1px;
        }
        .ie7-label {
          font-size: 11px;
          color: ${IE.brandText};
          margin-bottom: 4px;
          display: block;
        }
        .ie7-btn {
          padding: 5px 14px;
          background: linear-gradient(to bottom, #f5f9fd, #c0d4e8);
          border: 1px solid #7ba6db;
          border-radius: 3px;
          font-size: 11px;
          color: ${IE.brandText};
          cursor: pointer;
          font-family: inherit;
        }
        .ie7-btn:hover {
          background: linear-gradient(to bottom, #ffffff, #d0e0f0);
        }
        .ie7-btn:active {
          background: linear-gradient(to bottom, #c0d4e8, #f5f9fd);
        }
        .ie7-btn.primary {
          background: linear-gradient(to bottom, #5a9eff, #2a6eff);
          color: white;
          border-color: #1a4eaf;
          font-weight: bold;
        }
        .ie7-btn.primary:hover {
          background: linear-gradient(to bottom, #6aaeff, #3a7eff);
        }
        .ie7-btn.danger {
          background: linear-gradient(to bottom, #ff7070, #d04040);
          color: white;
          border-color: #a02020;
        }
        .ie7-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* THE IE7 WINDOW                                                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div
        className="ie7-window"
        style={{
          border: `1px solid ${IE.windowBorder}`,
          borderRadius: 6,
          boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2)',
          overflow: 'hidden',
          background: IE.contentBg,
          maxWidth: 1400,
          margin: '0 auto',
        }}
      >
        {/* ── TITLE BAR (Aero glass gradient) ────────────────────────────── */}
        <div
          style={{
            background: `linear-gradient(to bottom, ${IE.titleBarFrom} 0%, ${IE.titleBarMid} 50%, ${IE.titleBarTo} 100%)`,
            padding: '6px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${IE.windowBorderInner}`,
            color: IE.titleBarText,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Gradient D logo */}
            <div style={{
              width: 16,
              height: 16,
              borderRadius: 3,
              background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: 9 }}>D</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 'bold', textShadow: '0 1px 0 rgba(255,255,255,0.4)' }}>
              DialerSeat Admin — Windows Internet Explorer
            </span>
          </div>

          {/* Window controls — X navigates back to dashboard */}
          <div style={{ display: 'flex', gap: 2 }}>
            <div
              className="ie7-window-control"
              title="Minimize (no-op)"
              onClick={() => { /* cosplay only */ }}
            >−</div>
            <div
              className="ie7-window-control"
              title="Maximize (no-op)"
              onClick={() => { /* cosplay only */ }}
            >□</div>
            <div
              className="ie7-window-control close"
              title="Close (return to dashboard)"
              onClick={() => router.push('/dashboard/analytics')}
            >×</div>
          </div>
        </div>

        {/* ── MENU BAR ───────────────────────────────────────────────────── */}
        <div
          style={{
            background: IE.menuBg,
            padding: '2px 4px',
            display: 'flex',
            gap: 2,
            borderBottom: `1px solid ${IE.windowBorderInner}`,
            position: 'relative',
          }}
        >
          {['File', 'Edit', 'View', 'Favorites', 'Tools', 'Help'].map(menu => {
            const isOpen = openMenu === menu
            return (
              <div key={menu} className="ie7-menu" style={{ position: 'relative' }}>
                <div
                  className={`ie7-menu-item ${isOpen ? 'open' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setOpenMenu(isOpen ? null : menu)
                  }}
                >
                  <u>{menu[0]}</u>{menu.slice(1)}
                </div>
                {isOpen && (
                  <div className="ie7-menu-dropdown">
                    <FakeMenuItems menu={menu} onClose={() => setOpenMenu(null)} router={router} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── COMMAND BAR (back/fwd/refresh/home/search/favs/tools) ──────── */}
        <div
          style={{
            background: `linear-gradient(to bottom, ${IE.toolbarBgFrom}, ${IE.toolbarBgTo})`,
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            borderBottom: `1px solid ${IE.windowBorderInner}`,
          }}
        >
          <button className="ie7-toolbar-btn disabled" title="Back (Alt+Left)">
            <span style={{ fontSize: 14, fontWeight: 'bold' }}>←</span>
          </button>
          <button className="ie7-toolbar-btn disabled" title="Forward (Alt+Right)">
            <span style={{ fontSize: 14, fontWeight: 'bold' }}>→</span>
          </button>
          <button
            className="ie7-toolbar-btn"
            title="Refresh (F5)"
            onClick={() => {
              setStatusBarText('Refreshing...')
              setTimeout(() => setStatusBarText('Done'), 600)
            }}
          >
            <span style={{ fontSize: 13 }}>↻</span>
          </button>
          <button className="ie7-toolbar-btn disabled" title="Stop (Esc)">
            <span style={{ fontSize: 11 }}>✕</span>
          </button>
          <button
            className="ie7-toolbar-btn"
            title="Home"
            onClick={() => setActiveMain('dashboard')}
          >
            <span style={{ fontSize: 12 }}>🏠</span>
          </button>

          <div style={{ width: 1, height: 16, background: IE.windowBorderInner, margin: '0 4px' }} />

          {/* Address bar */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            background: IE.addrBg,
            border: `1px solid ${IE.addrBorder}`,
            borderRadius: 2,
            padding: '2px 6px',
            gap: 6,
          }}>
            <span style={{ fontSize: 10, color: IE.muted }}>Address</span>
            <div style={{
              flex: 1,
              fontSize: 11,
              color: IE.addrText,
              fontFamily: '"Lucida Console", "Courier New", monospace',
              userSelect: 'all',
            }}>
              {addressBarUrl}
            </div>
            <span style={{ fontSize: 10, color: IE.muted }}>▼</span>
          </div>

          <button className="ie7-toolbar-btn disabled" title="Search">
            <span style={{ fontSize: 11 }}>🔍</span>
          </button>
          <button className="ie7-toolbar-btn disabled" title="Favorites">
            <span style={{ fontSize: 11 }}>★</span>
          </button>
          <button className="ie7-toolbar-btn disabled" title="Tools">
            <span style={{ fontSize: 11 }}>⚙</span>
          </button>
        </div>

        {/* ── TAB STRIP ──────────────────────────────────────────────────── */}
        <div
          style={{
            background: IE.tabStripBg,
            padding: '6px 8px 0 8px',
            borderBottom: `1px solid ${IE.tabBorder}`,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 2,
            overflowX: 'auto',
          }}
        >
          {MAIN_TABS.map(tab => {
            const isActive = activeMain === tab.key && tab.status !== 'external'
            return (
              <div
                key={tab.key}
                className={`ie7-tab ${isActive ? 'active' : ''}`}
                onClick={() => handleTabClick(tab)}
                onMouseEnter={() => {
                  if (tab.status === 'external') {
                    setStatusBarText(`Go to ${tab.externalHref}`)
                  } else {
                    setStatusBarText(tab.label)
                  }
                }}
                onMouseLeave={() => setStatusBarText('Done')}
                title={tab.status === 'external' ? `Opens ${tab.externalHref}` : tab.label}
              >
                {tab.label}
                {tab.status === 'coming-soon' && (
                  <span style={{ fontSize: 9, opacity: 0.55, fontStyle: 'italic' }}>(soon)</span>
                )}
                {tab.status === 'external' && (
                  <span style={{ fontSize: 10, opacity: 0.7 }}>↗</span>
                )}
              </div>
            )
          })}
        </div>

        {/* ── CONTENT PANEL ──────────────────────────────────────────────── */}
        <div className="ie7-content">
          {activeMain === 'dashboard' && <ComingSoon
            title="DASHBOARD"
            description="Platform-wide KPIs, alerts, and daily summary. Will surface MRR, churn, agent utilization, abandon rates, and unresolved tickets."
            icon="📊"
          />}
          {activeMain === 'numbers' && <ComingSoon
            title="NUMBERS"
            description="This tab opens the existing /dashboard/admin/numbers page in a new view. Click the NUMBERS tab again to navigate there, or use the link below."
            icon="☎️"
            cta={{ label: 'GO TO NUMBERS', href: '/dashboard/admin/numbers' }}
          />}
          {activeMain === 'whitelabel' && (
            <WhiteLabelTab
              activeSub={activeWLSub}
              onSubChange={setActiveWLSub}
              setStatusBarText={setStatusBarText}
            />
          )}
          {activeMain === 'users' && <ComingSoon
            title="USERS"
            description="User management — search, view, suspend, exclude from analytics. Will absorb the Test Accounts logic from the old admin settings."
            icon="👤"
          />}
          {activeMain === 'teams' && <TeamsTab setStatusBarText={setStatusBarText} />}
          {activeMain === 'billing' && <ComingSoon
            title="BILLING"
            description="Stripe-wide view: subscription health, MRR, churn cohorts, failed payment recovery queue, refund history."
            icon="💵"
          />}
          {activeMain === 'system' && <ComingSoon
            title="SYSTEM"
            description="Service health (Database, Stripe, SignalWire, Clerk), cron job status, feature flag toggles."
            icon="🩺"
          />}
        </div>

        {/* ── STATUS BAR ─────────────────────────────────────────────────── */}
        <div
          style={{
            background: IE.statusBg,
            borderTop: `1px solid ${IE.statusBorder}`,
            padding: '3px 8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 10,
            color: IE.statusText,
          }}
        >
          <span>{statusBarText}</span>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span>🌐 Internet | Protected Mode: Off</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10 }}>🔍</span>
              <span>100%</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// FAKE MENU CONTENT
// =============================================================================
// Pure cosplay — most items are non-functional. A few of them route to real
// places (File > Close → /dashboard, View > Refresh → re-fetch).
// =============================================================================
function FakeMenuItems({ menu, onClose, router }: {
  menu: string
  onClose: () => void
  router: ReturnType<typeof useRouter>
}) {
  const handleClick = (action?: () => void) => () => {
    action?.()
    onClose()
  }

  switch (menu) {
    case 'File':
      return (
        <>
          <div className="ie7-menu-dropdown-item disabled">New Tab          Ctrl+T</div>
          <div className="ie7-menu-dropdown-item disabled">New Window       Ctrl+N</div>
          <div className="ie7-menu-separator" />
          <div className="ie7-menu-dropdown-item disabled">Open...          Ctrl+O</div>
          <div className="ie7-menu-dropdown-item disabled">Save             Ctrl+S</div>
          <div className="ie7-menu-separator" />
          <div className="ie7-menu-dropdown-item disabled">Page Setup...</div>
          <div className="ie7-menu-dropdown-item disabled">Print...         Ctrl+P</div>
          <div className="ie7-menu-separator" />
          <div className="ie7-menu-dropdown-item" onClick={handleClick(() => router.push('/dashboard/analytics'))}>
            Close            Alt+F4
          </div>
        </>
      )
    case 'Edit':
      return (
        <>
          <div className="ie7-menu-dropdown-item disabled">Cut              Ctrl+X</div>
          <div className="ie7-menu-dropdown-item disabled">Copy             Ctrl+C</div>
          <div className="ie7-menu-dropdown-item disabled">Paste            Ctrl+V</div>
          <div className="ie7-menu-separator" />
          <div className="ie7-menu-dropdown-item disabled">Select All       Ctrl+A</div>
          <div className="ie7-menu-dropdown-item disabled">Find on this Page...  Ctrl+F</div>
        </>
      )
    case 'View':
      return (
        <>
          <div className="ie7-menu-dropdown-item" onClick={handleClick(() => window.location.reload())}>
            Refresh          F5
          </div>
          <div className="ie7-menu-dropdown-item disabled">Stop             Esc</div>
          <div className="ie7-menu-separator" />
          <div className="ie7-menu-dropdown-item disabled">Toolbars  ▶</div>
          <div className="ie7-menu-dropdown-item disabled">Status Bar</div>
          <div className="ie7-menu-dropdown-item disabled">Quick Tabs       Ctrl+Q</div>
          <div className="ie7-menu-separator" />
          <div className="ie7-menu-dropdown-item disabled">Text Size  ▶</div>
          <div className="ie7-menu-dropdown-item disabled">Encoding   ▶</div>
          <div className="ie7-menu-separator" />
          <div className="ie7-menu-dropdown-item disabled">Source           Ctrl+U</div>
          <div className="ie7-menu-dropdown-item disabled">Full Screen      F11</div>
        </>
      )
    case 'Favorites':
      return (
        <>
          <div className="ie7-menu-dropdown-item disabled">Add to Favorites...   Ctrl+D</div>
          <div className="ie7-menu-dropdown-item disabled">Organize Favorites...</div>
          <div className="ie7-menu-separator" />
          <div className="ie7-menu-dropdown-item disabled">📁 Microsoft Websites  ▶</div>
          <div className="ie7-menu-dropdown-item disabled">📁 MSN Websites  ▶</div>
        </>
      )
    case 'Tools':
      return (
        <>
          <div className="ie7-menu-dropdown-item disabled">Delete Browsing History...</div>
          <div className="ie7-menu-dropdown-item disabled">Pop-up Blocker  ▶</div>
          <div className="ie7-menu-dropdown-item disabled">Phishing Filter  ▶</div>
          <div className="ie7-menu-separator" />
          <div className="ie7-menu-dropdown-item disabled">Internet Options...</div>
        </>
      )
    case 'Help':
      return (
        <>
          <div className="ie7-menu-dropdown-item disabled">Contents and Index  F1</div>
          <div className="ie7-menu-dropdown-item disabled">Online Support</div>
          <div className="ie7-menu-separator" />
          <div className="ie7-menu-dropdown-item disabled">About Internet Explorer</div>
        </>
      )
    default:
      return null
  }
}

// =============================================================================
// COMING SOON PLACEHOLDER
// =============================================================================
function ComingSoon({ title, description, icon, cta }: {
  title: string
  description: string
  icon: string
  cta?: { label: string; href: string }
}) {
  const router = useRouter()
  return (
    <div className="ie7-coming-soon">
      <div className="ie7-coming-soon-icon">{icon}</div>
      <div className="ie7-coming-soon-title">{title}</div>
      <div className="ie7-coming-soon-sub">{description}</div>
      {cta && (
        <div style={{ marginTop: 20 }}>
          <button className="ie7-btn primary" onClick={() => router.push(cta.href)}>
            {cta.label} →
          </button>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// WHITE LABEL TAB — has its own sub-tab system
// =============================================================================
function WhiteLabelTab({ activeSub, onSubChange, setStatusBarText }: {
  activeSub: WLSubTabKey
  onSubChange: (key: WLSubTabKey) => void
  setStatusBarText: (s: string) => void
}) {
  return (
    <div>
      <div className="ie7-subtab-strip">
        {WL_SUBTABS.map(sub => {
          const isActive = activeSub === sub.key
          return (
            <div
              key={sub.key}
              className={`ie7-subtab ${isActive ? 'active' : ''} ${sub.status === 'coming-soon' ? 'coming-soon' : ''}`}
              onClick={() => onSubChange(sub.key)}
              onMouseEnter={() => setStatusBarText(`White Label > ${sub.label}`)}
              onMouseLeave={() => setStatusBarText('Done')}
            >
              {sub.label}
              {sub.status === 'coming-soon' && <span style={{ marginLeft: 6, fontSize: 9 }}>(soon)</span>}
            </div>
          )
        })}
      </div>

      {activeSub === 'tenants' && <TenantsSubTab setStatusBarText={setStatusBarText} />}
      {activeSub === 'branding' && <BrandingSubTab setStatusBarText={setStatusBarText} />}
      {activeSub === 'billing' && <ComingSoon
        title="WL BILLING"
        description="Per-tenant Stripe subscription view, MRR per tenant, payment health, dunning recovery queue."
        icon="💳"
      />}
      {activeSub === 'demoview' && <DemoViewSubTab setStatusBarText={setStatusBarText} />}
      {activeSub === 'settings' && <ComingSoon
        title="WL SETTINGS"
        description="Per-tenant feature flags, rate limits, custom landing page templates, premium options (custom domain, branded emails)."
        icon="⚙️"
      />}
    </div>
  )
}

// =============================================================================
// TENANTS SUB-TAB — list + create + edit + delete tenants
// =============================================================================
function TenantsSubTab({ setStatusBarText }: { setStatusBarText: (s: string) => void }) {
  const [tenants, setTenants] = useState<Tenant[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<Tenant | null>(null)

  const fetchTenants = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/tenants')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setTenants(Array.isArray(json) ? json : json.tenants ?? [])
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
      setTenants([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTenants() }, [fetchTenants])

  if (loading && tenants === null) {
    return <div style={{ padding: 40, textAlign: 'center', color: IE.muted, fontSize: 11 }}>Loading tenants...</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: IE.brandText, marginBottom: 2 }}>
            White Label Tenants
          </div>
          <div style={{ fontSize: 11, color: IE.muted }}>
            {tenants?.length ?? 0} tenant{tenants?.length === 1 ? '' : 's'} registered
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="ie7-btn" onClick={fetchTenants}>↻ Refresh</button>
          <button className="ie7-btn primary" onClick={() => setShowCreate(true)}>+ New Tenant</button>
        </div>
      </div>

      {error && (
        <div style={{
          background: '#fff4f4', border: '1px solid #c08080', padding: 12,
          fontSize: 11, color: IE.red, marginBottom: 12,
        }}>
          <strong>API not available yet:</strong> {error}<br/>
          <span style={{ color: IE.muted }}>
            Wire up <code>GET /api/admin/tenants</code> to return an array of tenants from <code>white_label_tenants</code>.
          </span>
        </div>
      )}

      {tenants && tenants.length === 0 && !error && (
        <div style={{
          padding: 40, textAlign: 'center', background: 'white',
          border: `1px solid ${IE.border}`, color: IE.muted, fontSize: 11,
        }}>
          No tenants yet. Click <strong>+ New Tenant</strong> to create your first white-label customer.
        </div>
      )}

      {tenants && tenants.length > 0 && (
        <table className="ie7-table">
          <thead>
            <tr>
              <th>Slug</th>
              <th>Brand Name</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map(t => (
              <tr
                key={t.id}
                className={selected?.id === t.id ? 'selected' : ''}
                onClick={() => setSelected(t)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ fontFamily: 'monospace' }}>{t.slug}</td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 12, height: 12, borderRadius: 2,
                      background: t.primary_color, border: '1px solid rgba(0,0,0,0.2)',
                    }} />
                    {t.brand_name}
                  </span>
                </td>
                <td>
                  <span style={{
                    padding: '1px 6px',
                    fontSize: 9,
                    fontWeight: 'bold',
                    color: t.status === 'active' ? IE.green : t.status === 'suspended' ? IE.amber : IE.red,
                    border: `1px solid currentColor`,
                    borderRadius: 2,
                  }}>{t.status.toUpperCase()}</span>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 10, color: IE.muted }}>
                  {t.owner_clerk_id.slice(0, 16)}...
                </td>
                <td style={{ fontSize: 10, color: IE.muted }}>
                  {new Date(t.created_at).toLocaleDateString()}
                </td>
                <td>
                  <a
                    href={`https://${t.slug}.dialerseat.com`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: IE.brandBlue, fontSize: 10, textDecoration: 'underline' }}
                  >
                    visit →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && <CreateTenantModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchTenants() }} />}
      {selected && <TenantDetailPanel tenant={selected} onClose={() => setSelected(null)} onUpdated={fetchTenants} />}
    </div>
  )
}

// =============================================================================
// CREATE TENANT MODAL
// =============================================================================
function CreateTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [slug, setSlug] = useState('')
  const [brandName, setBrandName] = useState('')
  const [ownerClerkId, setOwnerClerkId] = useState('')
  const [supportEmail, setSupportEmail] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#4a9eff')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    setSubmitting(true)
    setErr(null)
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, brand_name: brandName, owner_clerk_id: ownerClerkId,
          support_email: supportEmail, primary_color: primaryColor,
        }),
      })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(body || `HTTP ${res.status}`)
      }
      onCreated()
    } catch (e: any) {
      setErr(e?.message ?? 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell title="New White Label Tenant" onClose={onClose}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div>
          <label className="ie7-label">Slug (subdomain) <span style={{ color: IE.muted }}>e.g. "acme" → acme.dialerseat.com</span></label>
          <input className="ie7-input" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="acme" />
        </div>
        <div>
          <label className="ie7-label">Brand Name</label>
          <input className="ie7-input" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Acme Dialer" />
        </div>
        <div>
          <label className="ie7-label">Owner Clerk ID <span style={{ color: IE.muted }}>(user_...)</span></label>
          <input className="ie7-input" value={ownerClerkId} onChange={(e) => setOwnerClerkId(e.target.value)} placeholder="user_3DEdnNyr7JTifmlBlkJZvr17vE8" style={{ fontFamily: 'monospace' }} />
        </div>
        <div>
          <label className="ie7-label">Support Email</label>
          <input className="ie7-input" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="support@acme.com" />
        </div>
        <div>
          <label className="ie7-label">Primary Color</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ width: 40, height: 26, border: `1px solid ${IE.addrBorder}`, padding: 0, cursor: 'pointer' }} />
            <input className="ie7-input" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ flex: 1, fontFamily: 'monospace' }} />
          </div>
        </div>

        {err && (
          <div style={{ background: '#fff4f4', border: '1px solid #c08080', padding: 8, fontSize: 11, color: IE.red }}>
            {err}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
          <button className="ie7-btn" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="ie7-btn primary" onClick={submit} disabled={submitting || !slug || !brandName || !ownerClerkId || !supportEmail}>
            {submitting ? 'Creating...' : 'Create Tenant'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

// =============================================================================
// TENANT DETAIL PANEL
// =============================================================================
function TenantDetailPanel({ tenant, onClose, onUpdated }: {
  tenant: Tenant
  onClose: () => void
  onUpdated: () => void
}) {
  const [working, setWorking] = useState<string | null>(null)

  const setStatus = async (status: Tenant['status']) => {
    setWorking('status')
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onUpdated()
    } catch (e: any) {
      alert(`Failed: ${e?.message ?? 'unknown'}`)
    } finally {
      setWorking(null)
    }
  }

  const remove = async () => {
    if (!confirm(`Delete tenant "${tenant.slug}"? This cannot be undone.`)) return
    setWorking('delete')
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onUpdated()
      onClose()
    } catch (e: any) {
      alert(`Failed: ${e?.message ?? 'unknown'}`)
    } finally {
      setWorking(null)
    }
  }

  return (
    <ModalShell title={`Tenant: ${tenant.brand_name}`} onClose={onClose}>
      <div style={{ display: 'grid', gap: 10 }}>
        <Field label="ID" value={tenant.id} mono />
        <Field label="Slug" value={tenant.slug} mono />
        <Field label="Brand Name" value={tenant.brand_name} />
        <Field label="Owner" value={tenant.owner_clerk_id} mono />
        <Field label="Support Email" value={tenant.support_email} />
        <Field label="Stripe Subscription" value={tenant.stripe_subscription_id ?? '(none)'} mono />
        <Field label="Status" value={tenant.status} />
        <Field label="Subdomain URL" value={`https://${tenant.slug}.dialerseat.com`} link />

        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          {tenant.status === 'active' && (
            <button className="ie7-btn" onClick={() => setStatus('suspended')} disabled={working !== null}>
              {working === 'status' ? 'Suspending...' : 'Suspend'}
            </button>
          )}
          {tenant.status !== 'active' && (
            <button className="ie7-btn primary" onClick={() => setStatus('active')} disabled={working !== null}>
              {working === 'status' ? 'Activating...' : 'Activate'}
            </button>
          )}
          <a
            href={`https://${tenant.slug}.dialerseat.com`}
            target="_blank"
            rel="noopener noreferrer"
            className="ie7-btn"
            style={{ textDecoration: 'none', display: 'inline-block' }}
          >
            Visit Site ↗
          </a>
          <button className="ie7-btn danger" onClick={remove} disabled={working !== null}>
            {working === 'delete' ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

// =============================================================================
// BRANDING SUB-TAB
// =============================================================================
function BrandingSubTab({ setStatusBarText }: { setStatusBarText: (s: string) => void }) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Tenant | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<Tenant>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/tenants')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const list = Array.isArray(json) ? json : json.tenants ?? []
        setTenants(list)
        if (list.length > 0) {
          setSelected(list[0])
          setDraft(list[0])
        }
      } catch (e: any) {
        setError(e?.message ?? 'Failed')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/tenants/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const updated = await res.json()
      setSelected(updated.tenant ?? updated)
      setDraft(updated.tenant ?? updated)
    } catch (e: any) {
      alert(`Failed: ${e?.message ?? 'unknown'}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: IE.muted, fontSize: 11 }}>Loading...</div>

  if (error || tenants.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: IE.muted, fontSize: 11, background: 'white', border: `1px solid ${IE.border}` }}>
        {error ? <><strong>Error:</strong> {error}</> : 'No tenants to edit. Create one in the Tenants sub-tab first.'}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 280px', gap: 12, minHeight: 400 }}>
      {/* Tenant list (left) */}
      <div style={{ background: 'white', border: `1px solid ${IE.border}`, padding: 6, overflowY: 'auto', maxHeight: 600 }}>
        <div style={{ fontSize: 10, fontWeight: 'bold', color: IE.muted, padding: '4px 6px', borderBottom: `1px solid ${IE.border}` }}>
          TENANTS
        </div>
        {tenants.map(t => (
          <div
            key={t.id}
            onClick={() => { setSelected(t); setDraft(t) }}
            style={{
              padding: 8,
              cursor: 'pointer',
              background: selected?.id === t.id ? IE.brandBlue : 'transparent',
              color: selected?.id === t.id ? 'white' : IE.brandText,
              fontSize: 11,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ width: 10, height: 10, background: t.primary_color, border: '1px solid rgba(0,0,0,0.2)' }} />
            {t.brand_name}
          </div>
        ))}
      </div>

      {/* Editor (middle) */}
      <div style={{ background: 'white', border: `1px solid ${IE.border}`, padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 12 }}>Edit Branding</div>
        {selected && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <label className="ie7-label">Brand Name</label>
              <input className="ie7-input" value={draft.brand_name ?? ''} onChange={(e) => setDraft({ ...draft, brand_name: e.target.value })} />
            </div>
            <div>
              <label className="ie7-label">Logo URL</label>
              <input className="ie7-input" value={draft.logo_url ?? ''} onChange={(e) => setDraft({ ...draft, logo_url: e.target.value || null })} placeholder="https://..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <ColorField label="Primary"    value={draft.primary_color ?? '#4a9eff'}    onChange={(v) => setDraft({ ...draft, primary_color: v })} />
              <ColorField label="Secondary"  value={draft.secondary_color ?? '#2a6eff'}  onChange={(v) => setDraft({ ...draft, secondary_color: v })} />
              <ColorField label="Accent"     value={draft.accent_color ?? '#1a1a2e'}     onChange={(v) => setDraft({ ...draft, accent_color: v })} />
              <ColorField label="Background" value={draft.background_color ?? '#0a0a14'} onChange={(v) => setDraft({ ...draft, background_color: v })} />
              <ColorField label="Text"       value={draft.text_color ?? '#ffffff'}       onChange={(v) => setDraft({ ...draft, text_color: v })} />
            </div>
            <div>
              <label className="ie7-label">Footer Text</label>
              <input className="ie7-input" value={draft.footer_text ?? ''} onChange={(e) => setDraft({ ...draft, footer_text: e.target.value })} placeholder="Powered by DialerSeat" />
            </div>
            <div style={{ marginTop: 8 }}>
              <button className="ie7-btn primary" onClick={save} disabled={saving}>
                {saving ? 'Saving...' : 'Save Branding'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview (right) */}
      <div style={{ background: 'white', border: `1px solid ${IE.border}`, padding: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 'bold', color: IE.muted, marginBottom: 8 }}>LIVE PREVIEW</div>
        <BrandingPreview tenant={{ ...selected!, ...draft } as Tenant} />
      </div>
    </div>
  )
}

function BrandingPreview({ tenant }: { tenant: Tenant }) {
  return (
    <div style={{
      background: tenant.background_color,
      color: tenant.text_color,
      padding: 16,
      borderRadius: 4,
      border: '1px solid #ccc',
      minHeight: 280,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        {tenant.logo_url ? (
          <img src={tenant.logo_url} alt={tenant.brand_name} style={{ width: 24, height: 24, borderRadius: 4 }} />
        ) : (
          <div style={{
            width: 24, height: 24, borderRadius: 4,
            background: `linear-gradient(135deg, ${tenant.primary_color}, ${tenant.secondary_color})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 11, fontWeight: 'bold',
          }}>
            {tenant.brand_name?.[0]?.toUpperCase() ?? 'D'}
          </div>
        )}
        <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 3, color: tenant.primary_color }}>
          {tenant.brand_name?.toUpperCase() ?? 'BRAND NAME'}
        </span>
      </div>
      <div style={{ fontSize: 11, opacity: 0.9, marginBottom: 12, lineHeight: 1.5 }}>
        Welcome back. This is roughly how your dashboard will appear to your downstream customers.
      </div>
      <button style={{
        padding: '6px 12px',
        background: tenant.primary_color,
        color: 'white',
        border: 'none',
        borderRadius: 3,
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 2,
        cursor: 'default',
      }}>
        PRIMARY ACTION
      </button>
      <div style={{
        marginTop: 16, padding: '4px 0', borderTop: `1px solid ${tenant.accent_color}`,
        fontSize: 9, opacity: 0.6, letterSpacing: 1,
      }}>
        {tenant.footer_text || 'Powered by DialerSeat'}
      </div>
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="ie7-label">{label}</label>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 30, height: 22, border: `1px solid ${IE.addrBorder}`, padding: 0, cursor: 'pointer' }} />
        <input className="ie7-input" value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, fontFamily: 'monospace', fontSize: 10 }} />
      </div>
    </div>
  )
}

// =============================================================================
// DEMO VIEW SUB-TAB — impersonate a team
// =============================================================================
function DemoViewSubTab({ setStatusBarText }: { setStatusBarText: (s: string) => void }) {
  const [teams, setTeams] = useState<TeamRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/teams')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        setTeams(Array.isArray(json) ? json : json.teams ?? [])
      } catch (e: any) {
        setError(e?.message ?? 'Failed')
        setTeams([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const startImpersonation = async (team: TeamRow) => {
    setStarting(team.id)
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: team.id }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      // Server returns either a URL to open or a tenant_slug to redirect to
      const url = data.redirect_url
        ?? (team.tenant_slug ? `https://${team.tenant_slug}.dialerseat.com/dashboard/analytics?impersonate=${team.id}` : `/dashboard/analytics?impersonate=${team.id}`)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e: any) {
      alert(`Failed to impersonate: ${e?.message ?? 'unknown'}`)
    } finally {
      setStarting(null)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: IE.muted, fontSize: 11 }}>Loading teams...</div>

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: IE.brandText }}>Demo View / Team Impersonation</div>
        <div style={{ fontSize: 11, color: IE.muted, marginTop: 2 }}>
          Open a new tab as a member of the selected team. The tenant's branding renders and a banner indicates impersonation.
        </div>
      </div>

      {error && (
        <div style={{ background: '#fff4f4', border: '1px solid #c08080', padding: 12, fontSize: 11, color: IE.red, marginBottom: 12 }}>
          <strong>API not available yet:</strong> {error}<br/>
          <span style={{ color: IE.muted }}>
            Wire up <code>GET /api/admin/teams</code> and <code>POST /api/admin/impersonate</code>.
          </span>
        </div>
      )}

      {teams && teams.length > 0 && (
        <table className="ie7-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Tenant</th>
              <th>Members</th>
              <th>Campaigns</th>
              <th>Calls 30d</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {teams.map(t => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.tenant_slug ? <span style={{ fontFamily: 'monospace' }}>{t.tenant_slug}</span> : <span style={{ color: IE.muted }}>(DialerSeat)</span>}</td>
                <td>{t.member_count}</td>
                <td>{t.campaign_count}</td>
                <td>{t.total_calls_30d.toLocaleString()}</td>
                <td>
                  <button
                    className="ie7-btn primary"
                    onClick={() => startImpersonation(t)}
                    disabled={starting === t.id}
                    style={{ fontSize: 10, padding: '3px 10px' }}
                  >
                    {starting === t.id ? 'Opening...' : 'View As →'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {teams && teams.length === 0 && !error && (
        <div style={{ padding: 40, textAlign: 'center', background: 'white', border: `1px solid ${IE.border}`, color: IE.muted, fontSize: 11 }}>
          No teams found.
        </div>
      )}
    </div>
  )
}

// =============================================================================
// TEAMS TAB — full team list with drilldown
// =============================================================================
function TeamsTab({ setStatusBarText }: { setStatusBarText: (s: string) => void }) {
  const [teams, setTeams] = useState<TeamRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [tenantFilter, setTenantFilter] = useState<string>('')
  const [selected, setSelected] = useState<TeamRow | null>(null)

  const fetchTeams = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/teams')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setTeams(Array.isArray(json) ? json : json.teams ?? [])
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? 'Failed')
      setTeams([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTeams() }, [fetchTeams])

  if (loading && !teams) return <div style={{ padding: 40, textAlign: 'center', color: IE.muted, fontSize: 11 }}>Loading teams...</div>

  const tenantSlugs = Array.from(new Set((teams ?? []).map(t => t.tenant_slug).filter(Boolean) as string[]))

  const filtered = (teams ?? []).filter(t => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false
    if (tenantFilter === '__dialerseat__' && t.tenant_slug) return false
    if (tenantFilter && tenantFilter !== '__dialerseat__' && t.tenant_slug !== tenantFilter) return false
    return true
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: IE.brandText, marginBottom: 2 }}>All Teams</div>
          <div style={{ fontSize: 11, color: IE.muted }}>
            {teams?.length ?? 0} team{teams?.length === 1 ? '' : 's'} across platform
          </div>
        </div>
        <button className="ie7-btn" onClick={fetchTeams}>↻ Refresh</button>
      </div>

      {error && (
        <div style={{ background: '#fff4f4', border: '1px solid #c08080', padding: 12, fontSize: 11, color: IE.red, marginBottom: 12 }}>
          <strong>API not available yet:</strong> {error}<br/>
          <span style={{ color: IE.muted }}>
            Wire up <code>GET /api/admin/teams</code> to return rows of {`{ id, name, owner_clerk_id, tenant_id, tenant_slug, member_count, campaign_count, total_calls_30d, status, created_at }`}.
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          className="ie7-input"
          placeholder="Search team name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 240 }}
        />
        <select
          value={tenantFilter}
          onChange={(e) => setTenantFilter(e.target.value)}
          style={{
            padding: '4px 8px',
            fontSize: 11,
            border: `1px solid ${IE.addrBorder}`,
            background: 'white',
            color: IE.brandText,
            fontFamily: 'inherit',
          }}
        >
          <option value="">All tenants</option>
          <option value="__dialerseat__">DialerSeat (default)</option>
          {tenantSlugs.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {filtered.length > 0 ? (
        <table className="ie7-table">
          <thead>
            <tr>
              <th>Team Name</th>
              <th>Tenant</th>
              <th>Owner</th>
              <th>Members</th>
              <th>Campaigns</th>
              <th>Calls (30d)</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr
                key={t.id}
                className={selected?.id === t.id ? 'selected' : ''}
                onClick={() => setSelected(t)}
                style={{ cursor: 'pointer' }}
              >
                <td>{t.name}</td>
                <td>{t.tenant_slug ? <span style={{ fontFamily: 'monospace' }}>{t.tenant_slug}</span> : <span style={{ color: IE.muted }}>DialerSeat</span>}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 10, color: IE.muted }}>{t.owner_clerk_id.slice(0, 16)}...</td>
                <td>{t.member_count}</td>
                <td>{t.campaign_count}</td>
                <td>{t.total_calls_30d.toLocaleString()}</td>
                <td>
                  <span style={{
                    padding: '1px 6px',
                    fontSize: 9,
                    fontWeight: 'bold',
                    color: t.status === 'active' ? IE.green : IE.muted,
                    border: `1px solid currentColor`,
                    borderRadius: 2,
                  }}>{t.status.toUpperCase()}</span>
                </td>
                <td style={{ fontSize: 10, color: IE.muted }}>{new Date(t.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (!error && (
        <div style={{ padding: 40, textAlign: 'center', background: 'white', border: `1px solid ${IE.border}`, color: IE.muted, fontSize: 11 }}>
          {teams?.length === 0 ? 'No teams found.' : 'No teams match your filter.'}
        </div>
      ))}

      {selected && <TeamDetailModal team={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function TeamDetailModal({ team, onClose }: { team: TeamRow; onClose: () => void }) {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/teams/${team.id}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setData(await res.json())
      } catch (e: any) {
        setError(e?.message ?? 'Failed')
      } finally {
        setLoading(false)
      }
    })()
  }, [team.id])

  return (
    <ModalShell title={`Team: ${team.name}`} onClose={onClose}>
      {loading && <div style={{ fontSize: 11, color: IE.muted }}>Loading team details...</div>}
      {error && (
        <div style={{ background: '#fff4f4', border: '1px solid #c08080', padding: 10, fontSize: 11, color: IE.red }}>
          <strong>API not available yet:</strong> {error}<br/>
          <span style={{ color: IE.muted }}>Wire up <code>GET /api/admin/teams/{team.id}</code>.</span>
        </div>
      )}
      {data && (
        <div style={{ display: 'grid', gap: 10 }}>
          <Field label="Team ID" value={team.id} mono />
          <Field label="Name" value={team.name} />
          <Field label="Owner" value={team.owner_clerk_id} mono />
          <Field label="Tenant" value={team.tenant_slug ?? 'DialerSeat (default)'} />
          <Field label="Members" value={String(team.member_count)} />
          <Field label="Active Campaigns" value={String(team.campaign_count)} />
          <Field label="Calls (30d)" value={team.total_calls_30d.toLocaleString()} />
          <Field label="Status" value={team.status} />
          {data.members && (
            <div>
              <label className="ie7-label">Members</label>
              <div style={{ background: '#fafafa', border: `1px solid ${IE.border}`, padding: 8, maxHeight: 200, overflowY: 'auto' }}>
                {data.members.map((m: any) => (
                  <div key={m.clerk_id} style={{ padding: '4px 0', borderBottom: `1px dashed ${IE.border}`, fontSize: 11 }}>
                    <strong>{m.first_name} {m.last_name}</strong> · {m.email}
                    <span style={{ marginLeft: 8, color: IE.muted }}>{m.role}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </ModalShell>
  )
}

// =============================================================================
// SHARED HELPERS
// =============================================================================
function ModalShell({ title, onClose, children }: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 520,
        background: '#f5f9fd',
        border: '1px solid #3a6ea5',
        borderRadius: 6,
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          background: `linear-gradient(to bottom, ${IE.titleBarFrom}, ${IE.titleBarMid}, ${IE.titleBarTo})`,
          padding: '6px 8px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: `1px solid ${IE.windowBorderInner}`,
        }}>
          <span style={{ fontSize: 11, fontWeight: 'bold', color: IE.titleBarText }}>
            {title}
          </span>
          <div className="ie7-window-control close" onClick={onClose} style={{ width: 28, height: 18 }}>×</div>
        </div>
        <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, mono, link }: { label: string; value: string; mono?: boolean; link?: boolean }) {
  return (
    <div>
      <label className="ie7-label">{label}</label>
      {link ? (
        <a
          href={value} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, color: IE.brandBlue, textDecoration: 'underline', fontFamily: mono ? 'monospace' : 'inherit' }}
        >
          {value}
        </a>
      ) : (
        <div style={{
          padding: '4px 8px',
          background: 'white',
          border: `1px solid ${IE.border}`,
          fontSize: 11,
          color: IE.brandText,
          fontFamily: mono ? 'monospace' : 'inherit',
          wordBreak: 'break-all',
        }}>
          {value}
        </div>
      )}
    </div>
  )
}