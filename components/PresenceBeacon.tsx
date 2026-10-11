'use client'
import { useEffect } from 'react'
import { useUser } from '@clerk/nextjs'

// Tells the Map this person is signed in and here, whatever their plan.
// See app/api/presence. Every 30s while the tab is visible, which keeps them
// inside the Map's 90s online window; nothing while it is hidden, so a
// forgotten background tab goes offline instead of looking present forever.
const EVERY_MS = 30_000

export default function PresenceBeacon() {
  const { isSignedIn } = useUser()

  useEffect(() => {
    if (!isSignedIn) return
    const ping = () => {
      if (document.visibilityState !== 'visible') return
      void fetch('/api/presence', { method: 'POST', keepalive: true }).catch(() => {})
    }
    ping()
    const id = setInterval(ping, EVERY_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') ping() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [isSignedIn])

  return null
}
