'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

export default function OnboardingPage() {
  const { user } = useUser()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    company: '',
  })

const handleSubmit = async () => {
  setLoading(true)
  try {
    await user?.update({
      firstName: form.firstName,
      lastName: form.lastName,
    })

    await fetch('/api/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerk_id: user?.id,
        email: user?.emailAddresses[0]?.emailAddress,
        first_name: form.firstName,
        last_name: form.lastName,
        phone: form.phone,
        company: form.company,
      }),
    })

    router.push('/dashboard')
  } catch (error) {
    console.error(error)
  } finally {
    setLoading(false)
  }
}

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
      {/* LOGO */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
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

      {/* CARD */}
      <div style={{
        width: '100%',
        maxWidth: '480px',
        padding: '48px',
        borderRadius: '24px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}>
        <h1 style={{
          fontSize: '22px',
          fontWeight: 'bold',
          letterSpacing: '4px',
          color: 'var(--text-primary)',
          marginBottom: '8px',
        }}>ALMOST THERE</h1>
        <p style={{
          fontSize: '13px',
          letterSpacing: '1px',
          color: 'var(--text-secondary)',
          marginBottom: '40px',
          lineHeight: '1.6',
        }}>
          Tell us a little about yourself to get your account set up.
        </p>

        {/* FIELDS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[
            { label: 'FIRST NAME', key: 'firstName', placeholder: 'John' },
            { label: 'LAST NAME', key: 'lastName', placeholder: 'Smith' },
            { label: 'PHONE NUMBER', key: 'phone', placeholder: '+1 (555) 000-0000' },
            { label: 'COMPANY / AGENCY', key: 'company', placeholder: 'Smith Insurance Group' },
          ].map((field) => (
            <div key={field.key}>
              <label style={{
                display: 'block',
                fontSize: '10px',
                letterSpacing: '3px',
                color: 'var(--text-secondary)',
                marginBottom: '8px',
              }}>{field.label}</label>
              <input
                type="text"
                placeholder={field.placeholder}
                value={form[field.key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: 'Futura PT, Futura, sans-serif',
                }}
              />
            </div>
          ))}
        </div>

        {/* SUBMIT */}
        <button
          onClick={handleSubmit}
          disabled={loading || !form.firstName || !form.lastName}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '12px',
            marginTop: '32px',
            background: loading ? 'var(--border)' : 'linear-gradient(135deg, #4a9eff, #2a6eff)',
            color: 'white',
            fontSize: '13px',
            fontWeight: 'bold',
            letterSpacing: '3px',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 0 30px rgba(74,158,255,0.3)',
            fontFamily: 'Futura PT, Futura, sans-serif',
          }}
        >
          {loading ? 'SETTING UP...' : 'LAUNCH MY ACCOUNT →'}
        </button>
      </div>
    </main>
  )
}