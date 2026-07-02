'use client'


























const FUTURA = `'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif`

export interface TenantLoginBrandProps {
  brandName: string
  logoUrl?: string | null
  
  linkLabel?: string | null
  
  linkText?: string | null
  
  linkUrl?: string | null
}

function ExternalLinkIcon() {
  
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, marginLeft: 6, transform: 'translateY(0.5px)' }}
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

export default function TenantLoginBrand({
  brandName,
  logoUrl,
  linkLabel,
  linkText,
  linkUrl,
}: TenantLoginBrandProps) {
  const showLink = !!(linkText && linkText.trim() && linkUrl && linkUrl.trim())

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
        fontFamily: FUTURA,
        textAlign: 'center',
      }}
    >
      {/* Logo */}
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${brandName} logo`}
          style={{ maxHeight: 56, maxWidth: 220, objectFit: 'contain' }}
        />
      ) : null}

      {/* Co-branding mark — "<Brand> × DialerSeat", × is fixed/non-removable */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 13,
          letterSpacing: 3,
          fontWeight: 700,
          textTransform: 'uppercase',
        }}
      >
        <span style={{ color: 'var(--brand-on-page-bg, #1a1c24)' }}>{brandName}</span>
        <span
          aria-hidden="true"
          style={{
            color: 'var(--brand-primary, #4a9eff)',
            fontSize: 15,
            fontWeight: 400,
            lineHeight: 1,
            transform: 'translateY(-1px)',
          }}
        >
          ×
        </span>
        <span style={{ color: 'var(--brand-muted-text, #5a5e6a)' }}>DialerSeat</span>
      </div>

      {/* Optional partner link */}
      {showLink && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            marginTop: 2,
          }}
        >
          {linkLabel && linkLabel.trim() ? (
            <div
              style={{
                fontSize: 10,
                letterSpacing: 2,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--brand-muted-text, #5a5e6a)',
              }}
            >
              {linkLabel}
            </div>
          ) : null}

          <a
            href={linkUrl!}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 0.4,
              color: 'var(--brand-primary, #4a9eff)',
              textDecoration: 'none',
              borderBottom: '1px solid color-mix(in srgb, var(--brand-primary, #4a9eff) 45%, transparent)',
              paddingBottom: 1,
              lineHeight: 1.3,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            {linkText}
            <ExternalLinkIcon />
          </a>
        </div>
      )}
    </div>
  )
}