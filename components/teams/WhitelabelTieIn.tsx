'use client'

interface TenantInfo {
  id: string
  slug: string
  brand_name: string | null
  logo_url: string | null
  primary_color: string | null
  custom_domain: string | null
  status: string
  is_active: boolean
}

const FUTURA = "'Futura PT', Futura, sans-serif"
const T = {
  bg: 'var(--brand-page-bg, #f0f1f4)',
  surface: 'var(--brand-card-surface, #e2e4ea)',
  border: 'var(--brand-card-border, #c4c8d0)',
  text: 'var(--brand-on-page-bg, #1a1c24)',
  muted: 'var(--brand-muted-text, #5a5e6a)',
  primary: 'var(--brand-primary, #2a4a8a)',
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

export default function WhitelabelTieIn({ tenant }: { tenant: TenantInfo | null }) {
  if (!tenant) return null

  const brandName = tenant.brand_name || tenant.slug
  const subdomainUrl = `https://${tenant.slug}.dialerseat.com`

  return (
    <div style={{
      fontFamily: FUTURA, color: T.text, background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 6, padding: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
        background: tenant.primary_color || T.primary, color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800,
      }}>
        {tenant.logo_url
          ? <img src={tenant.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initials(brandName)}
      </div>

      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 'bold', color: T.muted }}>
          THIS TEAM IS SCOPED TO
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{brandName}</div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
          Every agent who joins through a seat link sees this brand, not default DialerSeat.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
        <a
          href={subdomainUrl}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 11, color: T.primary, textDecoration: 'underline' }}
        >{tenant.slug}.dialerseat.com ↗</a>
        {tenant.custom_domain && (
          <span style={{ fontSize: 10, color: T.muted }}>+ {tenant.custom_domain}</span>
        )}
      </div>
    </div>
  )
}
