'use client'
import { createContext, useContext } from 'react'
import type { AppId } from './types'

// =============================================================================
// DESKTOP SERVICES — catalog + shell context
// =============================================================================
// v1.2 changes vs v1.1:
// - Added DEFAULT_HIDDEN_APP_IDS: apps installed (base) but NOT shown on the
//   desktop by default. Currently just 'clerk-profile' (Account). Enforced in
//   three places: migration 014 backfilled existing prefs rows, the
//   desktop-prefs GET route (v3) returns it as the default for users with no
//   row yet, and Desktop's initial client state uses it when there's no
//   localStorage cache. ADD TO DESKTOP in the App Store removes it from the
//   user's hidden_apps and persists — explicit user choice always wins.
//
// CATALOG RULES:
// - BASE apps: everything in registry APPS that is NOT listed in STORE_APP_IDS.
//   Base apps cannot be uninstalled. They CAN be removed from the homescreen
//   (hidden) and re-added from the App Store's INSTALLED tab or launched from
//   the Start menu.
// - STORE apps: ids listed in STORE_APP_IDS. They must ALSO exist in the
//   registry (APPS) with a Component — the store doesn't fetch code, it just
//   gates visibility. Store apps start uninstalled, can be downloaded,
//   uninstalled, and redownloaded freely.
// - The App Store itself ('appstore') is a BASE app: removable from the
//   homescreen, never uninstallable, always pinned in the Start menu.
//
// TO ADD A NEW DOWNLOADABLE APP LATER:
//   1. Build the component in apps/, register it in registry.tsx as usual
//   2. Add its id to STORE_APP_IDS below
// =============================================================================

export const APP_STORE_ID = 'appstore' as AppId

// Downloadable (non-default) apps. Empty for now — every current registry app
// is a base app until ids are added here.
export const STORE_APP_IDS: AppId[] = []

// Base apps hidden from the desktop by default (still installed, still in the
// Start menu and App Store INSTALLED tab).
export const DEFAULT_HIDDEN_APP_IDS: AppId[] = ['clerk-profile']

export function isBaseApp(id: AppId): boolean {
  return !STORE_APP_IDS.includes(id)
}

// ── SHELL CONTEXT ────────────────────────────────────────────────────────────
// Desktop.tsx provides this; apps rendered inside AppWindow consume it via
// useDesktopServices(). Null when a component renders outside the desktop.
export interface DesktopServices {
  installedAppIds: string[]
  hiddenAppIds: string[]
  installApp: (id: AppId) => void
  uninstallApp: (id: AppId) => void
  addToDesktop: (id: AppId) => void
  removeFromDesktop: (id: AppId) => void
  openApp: (id: AppId) => void
}

export const DesktopServicesContext = createContext<DesktopServices | null>(null)

export function useDesktopServices(): DesktopServices | null {
  return useContext(DesktopServicesContext)
}