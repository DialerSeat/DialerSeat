import type { ComponentType } from 'react'

// =============================================================================
// ADMIN DESKTOP — shared types
// =============================================================================
// The desktop is a window manager. It maintains a list of "open windows," each
// of which references one app from the registry. Apps are React components
// that mount inside an AppWindow shell — they don't know about the desktop
// itself, they just render their content.
// =============================================================================

export type AppId =
  | 'analytics'
  | 'overview'
  | 'teams'
  | 'numbers'
  | 'whitelabel'
  | 'view-landing'

export interface AppDefinition {
  id: AppId
  name: string                // shown on the desktop icon + taskbar
  shortName?: string          // optional shorter name for taskbar buttons
  icon: string                // emoji or SVG-text label (icon glyph)
  iconBg: string              // background color for the icon tile
  description: string         // tooltip + recent-items subtitle
  // The actual content component. Receives no props — apps are self-contained.
  // Some apps (view-landing) don't render anything and just trigger a side
  // effect (open new tab); those provide `external` instead.
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