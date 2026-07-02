'use client'
import { createContext, useContext } from 'react'
import type { AppId, AppRole } from './types'






























export const APP_STORE_ID = 'appstore' as AppId









export const STORE_APP_IDS: AppId[] = ['notes']








export const BASE_APP_OVERRIDES_BY_ROLE: Record<AppRole, AppId[]> = {
  admin: ['notes'],
  manager: [],
}



export const UNINSTALL_WARN_APP_IDS: AppId[] = ['notes']



export const DEFAULT_HIDDEN_APP_IDS: AppId[] = ['clerk-profile']




export function isBaseApp(id: AppId, role?: AppRole): boolean {
  if (!STORE_APP_IDS.includes(id)) return true
  if (role && BASE_APP_OVERRIDES_BY_ROLE[role]?.includes(id)) return true
  return false
}

export function uninstallWarns(id: AppId): boolean {
  return UNINSTALL_WARN_APP_IDS.includes(id)
}




export interface DesktopServices {
  role: AppRole              // which desktop this is — gates app visibility
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