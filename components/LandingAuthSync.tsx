'use client'
import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'



















export default function LandingAuthSync({
  serverThoughtLoggedIn,
}: {
  serverThoughtLoggedIn: boolean
}) {
  const { isLoaded, isSignedIn } = useAuth()
  const reloadedRef = useRef(false)

  useEffect(() => {
    if (!isLoaded || reloadedRef.current) return

    
    
    if (serverThoughtLoggedIn && !isSignedIn) {
      reloadedRef.current = true
      window.location.reload()
      return
    }

    
    
    if (!serverThoughtLoggedIn && isSignedIn) {
      reloadedRef.current = true
      window.location.reload()
    }
  }, [isLoaded, isSignedIn, serverThoughtLoggedIn])

  return null
}