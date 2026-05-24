'use client'
import dynamic from 'next/dynamic'
import type { AppDefinition } from './types'

// =============================================================================
// APP REGISTRY
// =============================================================================
// Single source of truth for what apps exist on the desktop. The Desktop
// component reads this to render icons; the WindowManager reads it to mount
// the right component when a window opens.
//
// Components are lazy-loaded via next/dynamic so the desktop shell itself
// stays small. Each app file lives in its own folder under apps/.
//
// ADDING A NEW APP:
//   1. Create components/admin-desktop/apps/<name>/index.tsx with default export
//   2. Import lazily here
//   3. Add an APP entry below
//   That's it — the desktop picks it up automatically.
// =============================================================================

const AnalyticsApp = dynamic(() => import('./apps/Analytics'), {
  loading: () => <AppLoading />,
  ssr: false,
})
const OverviewApp = dynamic(() => import('./apps/Overview'), {
  loading: () => <AppLoading />,
  ssr: false,
})
const TeamsApp = dynamic(() => import('./apps/Teams'), {
  loading: () => <AppLoading />,
  ssr: false,
})
const NumbersApp = dynamic(() => import('./apps/Numbers'), {
  loading: () => <AppLoading />,
  ssr: false,
})
const WhiteLabelApp = dynamic(() => import('./apps/WhiteLabel'), {
  loading: () => <AppLoading />,
  ssr: false,
})

function AppLoading() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '100%', height: '100%',
      background: '#f5f9fd',
      fontFamily: '"Segoe UI", Tahoma, sans-serif',
      fontSize: 12, color: '#5a5e6a', letterSpacing: 1,
    }}>
      Loading...
    </div>
  )
}

export const APPS: AppDefinition[] = [
  {
    id: 'analytics',
    name: 'Analytics',
    icon: '📊',
    iconBg: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
    description: 'Business KPIs, revenue, signups, churn',
    Component: AnalyticsApp,
    defaultSize: { width: 1080, height: 720 },
  },
  {
    id: 'overview',
    name: 'Overview',
    icon: '👥',
    iconBg: 'linear-gradient(135deg, #5ad17a, #1a6a1a)',
    description: 'All platform users with status and delete',
    Component: OverviewApp,
    defaultSize: { width: 1000, height: 720 },
  },
  {
    id: 'teams',
    name: 'Teams',
    icon: '🏢',
    iconBg: 'linear-gradient(135deg, #ffaa3e, #d07020)',
    description: 'Every team on the platform with members and seats',
    Component: TeamsApp,
    defaultSize: { width: 1100, height: 720 },
  },
  {
    id: 'numbers',
    name: 'Numbers',
    icon: '☎️',
    iconBg: 'linear-gradient(135deg, #b478ff, #6a30d0)',
    description: 'Outbound number pool, buy, register, release',
    Component: NumbersApp,
    defaultSize: { width: 1180, height: 760 },
  },
  {
    id: 'whitelabel',
    name: 'White Label',
    shortName: 'WL',
    icon: '🏷️',
    iconBg: 'linear-gradient(135deg, #ff6464, #c02020)',
    description: 'Tenant CRUD, branding editor, team impersonation',
    Component: WhiteLabelApp,
    defaultSize: { width: 1200, height: 760 },
  },
  {
    id: 'view-landing',
    name: 'View Landing',
    shortName: 'Landing',
    icon: '🌐',
    iconBg: 'linear-gradient(135deg, #5dd5d5, #2a8a8a)',
    description: 'Open dialerseat.com landing page in a new tab',
    external: { url: '/', target: '_blank' },
  },
]

export function getApp(id: string): AppDefinition | undefined {
  return APPS.find(a => a.id === id)
}