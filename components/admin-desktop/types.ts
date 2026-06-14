import type { ComponentType } from 'react'

// =============================================================================
// ADMIN DESKTOP — shared types
// =============================================================================
// The desktop is a window manager. It maintains a list of "open windows," each
// of which references one app from the registry. Apps are React components
// that mount inside an AppWindow shell — they don't know about the desktop
// itself, they just render their content.
//
// v3 changes vs v2:
// - Added AppRole ('admin' | 'manager') and AppDefinition.visibleTo.
//   ONE desktop, ONE registry, ONE copy of every app, driven by a role prop.
//   visibleTo declares WHICH roles see an app at all (e.g. logs = admin-only).
//   Data scoping (what an app SHOWS per role) is handled in each app's API,
//   not here. Omitting visibleTo = admin-only by default (safe: a new app
//   never leaks to managers until explicitly opted in).
//
// v2 changes vs v1:
// - Added 'appstore' to the AppId union (App Store base app, Desktop v24).
// =============================================================================

export type AppId =
  | 'analytics'
  | 'overview'
  | 'teams'
  | 'numbers'
  | 'whitelabel'
  | 'logs'
  | 'notes'
  | 'gmail'
  | 'clerk-profile'
  | 'browser'
  | 'appstore'

// Which desktop a user is on. The same Desktop component is mounted with a
// role; the role both filters the registry (visibleTo) and is passed to apps
// so their APIs return correctly-scoped data.
export type AppRole = 'admin' | 'manager'

export interface AppDefinition {
  id: AppId
  name: string                // shown on the desktop icon + taskbar
  shortName?: string          // optional shorter name for taskbar buttons
  icon: string                // emoji or SVG-text label (icon glyph)
  iconSrc?: string            // optional real icon image URL (overrides emoji glyph when set)
  iconBg: string              // background color for the icon tile
  description: string         // tooltip + recent-items subtitle
  // Which roles can SEE this app. Omitted = ['admin'] (admin-only) so a new
  // app never appears on the manager desktop until explicitly opted in.
  // This governs VISIBILITY only — data scoping per role lives in the app API.
  visibleTo?: AppRole[]
  // The actual content component. Receives no props — apps are self-contained.
  // Some apps don't render anything and just trigger a side effect (open new
  // tab); those provide `external` instead. v20 removed view-landing from
  // the registry — it's now a system-tray icon in the taskbar instead.
  Component?: ComponentType
  external?: { url: string; target?: '_blank' | '_self' }
  // Default window size in pixels. Falls back to 900x600 if omitted.
  defaultSize?: { width: number; height: number }
}

// One open window on the desktop. `id` is a per-open instance id so the user
// can theoretically open the same app twice (though we don't enable that yet).
export interface WindowState {
  id: string                  // instance id (uuid-ish)
  appId: AppId
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  minimized: boolean
  maximized: boolean
  // Pre-maximize geometry, so unmaximize can restore the previous position
  preMaximize?: { x: number; y: number; width: number; height: number }
  openedAt: number
}

export interface RecentApp {
  appId: AppId
  closedAt: number
}

// Helper: does an app show for a given role? Default (no visibleTo) = admin.
export function appVisibleToRole(app: AppDefinition, role: AppRole): boolean {
  const roles = app.visibleTo ?? ['admin']
  return roles.includes(role)
}