import type { ComponentType } from 'react'

























export type AppId =
  | 'dashboard'
  | 'analytics'
  | 'overview'
  | 'teams'
  | 'numbers'
  | 'whitelabel'
  | 'logs'
  | 'support'
  | 'notes'
  | 'gmail'
  | 'clerk-profile'
  | 'browser'
  | 'appstore'




export type AppRole = 'admin' | 'manager'

export interface AppDefinition {
  id: AppId
  name: string                // shown on the desktop icon + taskbar
  shortName?: string          // optional shorter name for taskbar buttons
  icon: string                // emoji or SVG-text label (icon glyph)
  iconSrc?: string            // optional real icon image URL (overrides emoji glyph when set)
  iconBg: string              // background color for the icon tile
  description: string         // tooltip + recent-items subtitle
  
  
  
  visibleTo?: AppRole[]
  
  
  
  
  Component?: ComponentType
  external?: { url: string; target?: '_blank' | '_self' }
  
  defaultSize?: { width: number; height: number }
}



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
  
  preMaximize?: { x: number; y: number; width: number; height: number }
  openedAt: number
}

export interface RecentApp {
  appId: AppId
  closedAt: number
}


export function appVisibleToRole(app: AppDefinition, role: AppRole): boolean {
  const roles = app.visibleTo ?? ['admin']
  return roles.includes(role)
}