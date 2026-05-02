import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--background)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>D</span>
          </div>
          <span style={{
            fontSize: '18px',
            fontWeight: 'bold',
            letterSpacing: '6px',
            color: 'var(--text-primary)',
          }}>DIALERSEAT</span>
        </div>
        <p style={{ fontSize: '12px', letterSpacing: '3px', color: 'var(--text-secondary)' }}>
          CREATE YOUR ACCOUNT
        </p>
      </div>
      <SignUp />
    </main>
  )
}