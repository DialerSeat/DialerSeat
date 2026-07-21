'use client'
import dynamic from 'next/dynamic'
import type { AppDefinition } from './types'













































const DashboardApp = dynamic(() => import('./apps/Dashboard'), {
  loading: () => <AppLoading />,
  ssr: false,
})
const AnalyticsApp = dynamic(() => import('./apps/Analytics'), {
  loading: () => <AppLoading />,
  ssr: false,
})
const OverviewApp = dynamic(() => import('./apps/Overview'), {
  loading: () => <AppLoading />,
  ssr: false,
})
const UserTrackerApp = dynamic(() => import('./apps/UserTracker'), {
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
const LogsApp = dynamic(() => import('./apps/Logs'), {
  loading: () => <AppLoading />,
  ssr: false,
})
const SupportApp = dynamic(() => import('./apps/Support'), {
  loading: () => <AppLoading />,
  ssr: false,
})
const NotesApp = dynamic(() => import('./apps/Notes'), {
  loading: () => <AppLoading />,
  ssr: false,
})
const GmailApp = dynamic(() => import('./apps/Gmail'), {
  loading: () => <AppLoading />,
  ssr: false,
})
const ClerkProfileApp = dynamic(() => import('./apps/ClerkProfile'), {
  loading: () => <AppLoading />,
  ssr: false,
})
const BrowserApp = dynamic(() => import('./apps/Browser'), {
  loading: () => <AppLoading />,
  ssr: false,
})
const AppStoreApp = dynamic(() => import('./apps/AppStore'), {
  loading: () => <AppLoading />,
  ssr: false,
})
const ExplorerApp = dynamic(() => import('./apps/Explorer'), {
  loading: () => <AppLoading />,
  ssr: false,
})
const SettingsApp = dynamic(() => import('./apps/Settings'), {
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
    
    
    
    id: 'dashboard',
    name: 'Dashboard',
    icon: '🏠',
    iconBg: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
    description: 'Return to your main dashboard',
    visibleTo: ['manager'],
    Component: DashboardApp,
    defaultSize: { width: 480, height: 320 },
  },
  {
    id: 'analytics',
    name: 'Analytics',
    icon: '📊',
    iconBg: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
    description: 'Business KPIs, revenue, signups, churn',
    visibleTo: ['admin', 'manager'],
    Component: AnalyticsApp,
    defaultSize: { width: 1080, height: 720 },
  },
  {
    id: 'overview',
    name: 'Overview',
    icon: '👥',
    iconBg: 'linear-gradient(135deg, #5ad17a, #1a6a1a)',
    description: 'All platform users with status and delete',
    visibleTo: ['admin'],
    Component: OverviewApp,
    defaultSize: { width: 1000, height: 720 },
  },
  {
    id: 'user-tracker',
    name: 'User Tracker',
    shortName: 'Tracker',
    icon: '📈',
    iconBg: 'linear-gradient(135deg, #8a7bff, #6d5bf7)',
    description: 'Per-user usage analytics — ranked, filterable, with platform-wide overview',
    visibleTo: ['admin'],
    Component: UserTrackerApp,
    defaultSize: { width: 1120, height: 760 },
  },
  {
    id: 'teams',
    name: 'Teams',
    icon: '🏢',
    iconBg: 'linear-gradient(135deg, #ffaa3e, #d07020)',
    description: 'Every team on the platform with members and seats',
    visibleTo: ['admin', 'manager'],
    Component: TeamsApp,
    defaultSize: { width: 1100, height: 720 },
  },
  {
    id: 'numbers',
    name: 'Numbers',
    icon: '☎️',
    iconBg: 'linear-gradient(135deg, #b478ff, #6a30d0)',
    description: 'Outbound number pool, buy, register, release',
    visibleTo: ['admin'],
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
    visibleTo: ['admin'],
    Component: WhiteLabelApp,
    defaultSize: { width: 1200, height: 760 },
  },
  {
    id: 'logs',
    name: 'Logs',
    icon: '🧾',
    iconBg: 'linear-gradient(135deg, #ffd96a, #c48a1a)',
    description: 'Purchases, renewals, and cancels across all customers',
    visibleTo: ['admin'],
    Component: LogsApp,
    defaultSize: { width: 1000, height: 700 },
  },
  {
    
    
    
    id: 'support',
    name: 'Support',
    icon: '🎧',
    iconBg: 'linear-gradient(135deg, #4a9eff, #6a4aff)',
    description: 'User support queries, bug reports, and exit feedback',
    visibleTo: ['admin'],
    Component: SupportApp,
    defaultSize: { width: 1100, height: 720 },
  },
  {
    id: 'notes',
    name: 'Notes',
    icon: '📝',
    iconBg: 'linear-gradient(135deg, #ffe27a, #d4a020)',
    description: 'Private scratchpad — auto-saved. Only you can see its data.',
    visibleTo: ['admin', 'manager'],
    Component: NotesApp,
    defaultSize: { width: 1000, height: 700 },
  },
  {
    id: 'gmail',
    name: 'Gmail',
    icon: '✉',
    iconBg: 'linear-gradient(135deg, #ea4335, #b8281a)',
    description: 'Read, send, and manage your DialerSeat business inbox',
    visibleTo: ['admin'],
    Component: GmailApp,
    defaultSize: { width: 1100, height: 720 },
  },
  {
    id: 'browser',
    name: 'Browser',
    icon: '🌐',
    iconBg: 'linear-gradient(135deg, #5dd5d5, #2a8a8a)',
    description: 'Open web pages (embeds where allowed, opens in tab otherwise)',
    visibleTo: ['admin'],
    Component: BrowserApp,
    defaultSize: { width: 1024, height: 720 },
  },
  {
    
    
    id: 'clerk-profile',
    name: 'Account',
    icon: '👤',
    iconBg: 'linear-gradient(135deg, #b478ff, #6a30d0)',
    description: 'Manage your DialerSeat account',
    visibleTo: ['admin', 'manager'],
    Component: ClerkProfileApp,
    defaultSize: { width: 920, height: 720 },
  },
  {
    
    
    
    id: 'appstore',
    name: 'App Store',
    icon: '🛍️',
    iconBg: 'linear-gradient(135deg, #2a4a8a, #4a9eff)',
    description: 'Browse, download, and manage desktop apps',
    visibleTo: ['admin', 'manager'],
    Component: AppStoreApp,
    defaultSize: { width: 880, height: 620 },
  },
  {
    id: 'explorer',
    name: 'Data Explorer',
    shortName: 'Explorer',
    icon: '🔍',
    iconBg: 'linear-gradient(135deg, #ff6ec7, #c2185b)',
    description: 'Users, campaigns, leads, and call recordings in tabs — sortable, filterable, back/forward navigation. Research, CSV export, delete or play back on a user\'s behalf.',
    visibleTo: ['admin'],
    Component: ExplorerApp,
    defaultSize: { width: 1120, height: 760 },
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: '⚙️',
    iconBg: 'linear-gradient(135deg, #8E8E93, #48484A)',
    description: 'Admin preferences, including which Logs events send a notification',
    visibleTo: ['admin'],
    Component: SettingsApp,
    defaultSize: { width: 760, height: 720 },
  },
]

export function getApp(id: string): AppDefinition | undefined {
  return APPS.find(a => a.id === id)
}