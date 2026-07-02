'use client'

















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