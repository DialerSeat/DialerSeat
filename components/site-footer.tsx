'use client'

import Link from 'next/link'
import { t } from '@/lib/i18n/client'
import { msg } from '@/lib/i18n/msg'

/** The data pages and tools, linked from every page's footer. */
const FOOTER_RESOURCES = [
  { href: '/pricing', label: msg('PRICING') },
  { href: '/data/dialer-pricing', label: msg('DIALER PRICING INDEX') },
  { href: '/data/calling-rules-by-country', label: msg('CALLING RULES BY COUNTRY') },
  { href: '/data/connect-rates', label: msg('CONNECT RATES') },
  { href: '/tools/dialer-cost-calculator', label: msg('COST CALCULATOR') },
  { href: '/tools/abandon-rate-calculator', label: msg('ABANDON RATE CALCULATOR') },
  { href: '/faq/what-is-an-auto-dialer', label: msg('WHAT IS AN AUTO DIALER') },
  { href: '/resources', label: msg('RESOURCES') },
  { href: '/about', label: msg('ABOUT') },
]

























export default function SiteFooter() {
  return (
    <footer
      style={{
        padding: '48px 20px 40px',
        textAlign: 'center',
        borderTop: '1px solid #c4c8d0',
        background: '#0a0a14',
        color: 'rgba(255,255,255,0.5)',
        fontFamily: 'Futura PT, Futura, sans-serif',
      }}
    >
      {/* Logo row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>D</span>
        </div>
        <span
          style={{
            fontSize: 14,
            fontWeight: 'bold',
            letterSpacing: 6,
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          DIALERSEAT
        </span>
      </div>

      {/* Links row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 16,
          fontSize: 11,
          letterSpacing: 3,
        }}
      >
        <Link
          href="/privacy"
          style={{
            color: 'rgba(255,255,255,0.7)',
            textDecoration: 'none',
            padding: '4px 10px',
          }}
        >
          {t("PRIVACY")}</Link>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
        <Link
          href="/terms"
          style={{
            color: 'rgba(255,255,255,0.7)',
            textDecoration: 'none',
            padding: '4px 10px',
          }}
        >
          {t("TERMS")}</Link>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
        <Link
          href="/faq"
          style={{
            color: 'rgba(255,255,255,0.7)',
            textDecoration: 'none',
            padding: '4px 10px',
          }}
        >
          {t("FAQ")}</Link>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
        <Link
          href="/vs"
          style={{
            color: 'rgba(255,255,255,0.7)',
            textDecoration: 'none',
            padding: '4px 10px',
          }}
        >
          {t("COMPARISONS")}</Link>
      </div>

      {/* Resources row. Every page carries this footer, so these are the links
          that tell a crawler the data pages and tools matter, and the way a
          visitor on any page finds the things worth citing. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          flexWrap: 'wrap',
          marginBottom: 16,
          fontSize: 10,
          letterSpacing: 2,
        }}
      >
        {FOOTER_RESOURCES.map((r, i) => (
          <span key={r.href} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && <span style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>}
            <Link href={r.href} style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', padding: '4px 8px' }}>
              {t(r.label)}
            </Link>
          </span>
        ))}
      </div>

      {/* Copyright row */}
      <p
        style={{
          fontSize: 11,
          letterSpacing: 3,
          color: 'rgba(255,255,255,0.4)',
          margin: 0,
        }}
      >{t("© {fullYear} DIALERSEAT™ · ALL RIGHTS RESERVED", { fullYear: new Date().getFullYear() })}</p>
    </footer>
  )
}