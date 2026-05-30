'use client'

// =============================================================================
// CLERK PROFILE APP — v23
// =============================================================================
// Renders Clerk's <UserProfile /> inside a desktop AppWindow so "Manage
// Account" opens a draggable window instead of a modal that gets trapped
// behind the desktop overlay (the old broken behavior).
//
// Opened three ways:
//   1. Tray icon in the Taskbar (👤, left of View Landing)
//   2. StartMenu "Manage Account" item
//   3. Desktop icon (registered in registry.tsx)
//
// The component is self-contained — AppWindow gives it the frame, this
// just fills the body with Clerk's profile UI, scrollable.
// =============================================================================

import { UserProfile } from '@clerk/nextjs'

export default function ClerkProfileApp() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
        background: '#f5f5f7',
        display: 'flex',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <UserProfile
        routing="hash"
        appearance={{
          elements: {
            rootBox: {
              width: '100%',
              maxWidth: 880,
            },
            cardBox: {
              width: '100%',
              boxShadow: 'none',
              border: '1px solid #d0d4d8',
            },
            card: {
              boxShadow: 'none',
            },
          },
        }}
      />
    </div>
  )
}