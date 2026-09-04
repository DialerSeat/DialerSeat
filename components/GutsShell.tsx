'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { SITE } from '@/lib/siteTheme'
import { inter } from '@/lib/fonts'

// =============================================================================
// THE ARTICLE SHELL — the /vs/everyone layout, made the blueprint
// =============================================================================
// A dark navigation rail on the left and one white article card on the right,
// its sections divided by hairlines and each led by a round icon. The text
// inside a section is CENTERED, which is what separates this from
// documentation: centered sections read as an argument taken in top to bottom,
// left-aligned ones read as a reference you work through.
//
// WHY A COMPONENT AND NOT A STYLESHEET. lib/faq-theme and ExplainerStyles are
// both CSS-only, and both hit the same wall: a rail is markup, not paint, so
// every page had to grow one by hand or go without. This owns the chrome —
// rail, card, section rhythm — and takes the page's own content as children.
//
// ON A PHONE the rail stacks above the article, where seventeen links stand
// between the visitor and the first sentence. All of it folds under one
// toggle there and behaves as a plain sidebar at full width.
// =============================================================================

export interface RailLink {
  href: string
  label: string
}

export interface RailGroup {
  label: string
  items: RailLink[]
}

export interface GutsShellProps {
  rail: RailGroup[]
  /** The rail entry for the page you are on. Marked, never linked away from. */
  activeHref?: string
  children: ReactNode
}

const T = {
  bg: SITE.bg,
  surface: SITE.surface,
  surface2: SITE.borderSoft,
  border: SITE.border,
  text: SITE.text,
  muted: SITE.muted,
  accent: SITE.deep,
  blue: SITE.blue,
  royal: '#2a6eff',
  green: SITE.green,
  red: SITE.red,
  amber: SITE.amber,
  rail: '#0d1830',
  railLine: 'rgba(255,255,255,0.10)',
  railMuted: 'rgba(255,255,255,0.52)',
}

export const GUTS_FONT = inter.style.fontFamily

function RailChevron() {
  return (
    <svg className="chev" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </svg>
  )
}

/* ── THE ICON SET ────────────────────────────────────────────────────────
   Named rather than passed as markup, so a page picks a meaning and the shell
   owns how it is drawn. Every one is a 24-grid stroke icon at the same weight;
   mixing stroke widths across sections is what makes an icon set look
   assembled rather than designed. */
const ICONS: Record<string, ReactNode> = {
  info: <><circle cx="12" cy="12" r="8.6" /><path d="M12 7.6v5M12 16.2h.01" /></>,
  price: <><path d="M12 3.4v17.2" /><path d="M16.6 7.2a3.6 3.6 0 0 0-3.4-2.2h-1.9a3.3 3.3 0 0 0 0 6.6h2.4a3.3 3.3 0 0 1 0 6.6h-2.1a3.6 3.6 0 0 1-3.4-2.2" /></>,
  calendar: <><rect x="3.6" y="5" width="16.8" height="15" rx="2.4" /><path d="M3.6 9.8h16.8M8.4 3.4v3.2M15.6 3.4v3.2" /></>,
  alert: <><path d="M10.3 3.9 1.9 18.4a1.9 1.9 0 0 0 1.7 2.9h16.8a1.9 1.9 0 0 0 1.7-2.9L13.7 3.9a1.9 1.9 0 0 0-3.4 0z" /><path d="M12 9.4v4M12 17.2h.01" /></>,
  table: <><rect x="3.4" y="4.4" width="17.2" height="15.2" rx="2.2" /><path d="M3.4 9.6h17.2M9.6 9.6v10" /></>,
  team: <><circle cx="9" cy="8.4" r="3.3" /><path d="M2.8 19.6a6.2 6.2 0 0 1 12.4 0" /><path d="M16.4 5.6a3.3 3.3 0 0 1 0 5.7M17.6 14.2a6.2 6.2 0 0 1 3.6 5.4" /></>,
  swap: <><path d="M3.6 8.2h13.2l-3.4-3.4M20.4 15.8H7.2l3.4 3.4" /></>,
  chat: <><path d="M20.4 14.4a2.2 2.2 0 0 1-2.2 2.2H7.8L3.6 20.4V5.6a2.2 2.2 0 0 1 2.2-2.2h12.4a2.2 2.2 0 0 1 2.2 2.2z" /></>,
  shield: <><path d="M12 3.2 4.6 6.2v5.4c0 4.4 3.1 8.5 7.4 9.5 4.3-1 7.4-5.1 7.4-9.5V6.2z" /><path d="m9.2 12 2 2 3.6-3.8" /></>,
  phone: <><rect x="6.4" y="2.6" width="11.2" height="18.8" rx="2.4" /><path d="M11 18.6h2" /></>,
  check: <><circle cx="12" cy="12" r="8.6" /><path d="m8.4 12.2 2.6 2.6 4.6-5" /></>,
  scale: <><path d="M12 4.2v15.4M7 19.6h10M4.4 7.6h15.2" /><path d="M4.4 7.6 1.9 13.4h5zM19.6 7.6 17.1 13.4h5z" /><circle cx="12" cy="4.2" r="1.5" /></>,
  list: <><path d="M8.6 6.4h11.8M8.6 12h11.8M8.6 17.6h11.8" /><path d="M4.2 6.4h.01M4.2 12h.01M4.2 17.6h.01" /></>,
  book: <><path d="M4.4 4.6h6a3 3 0 0 1 3 3v12a2.2 2.2 0 0 0-2.2-2.2H4.4z" /><path d="M19.6 4.6h-6a3 3 0 0 0-3 3v12a2.2 2.2 0 0 1 2.2-2.2h6.8z" /></>,
}

export type GutsIcon = keyof typeof ICONS

/**
 * One section of the article. Centered, hairline-separated, icon-led.
 *
 * `wide` drops the prose measure for content that is scanned rather than read
 * — a table or a card grid, which a 660px column would squeeze.
 */
export function GutsSection({
  icon,
  title,
  id,
  children,
}: {
  icon?: GutsIcon
  title?: string
  id?: string
  children: ReactNode
}) {
  return (
    <section className="guts-sec" id={id}>
      {icon && (
        <div className="guts-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONS[icon]}
          </svg>
        </div>
      )}
      {title && <h2>{title}</h2>}
      {children}
    </section>
  )
}

export default function GutsShell({ rail, activeHref, children }: GutsShellProps) {
  /**
   * Only consulted below the stacked breakpoint. At full width the rail is a
   * sidebar and is always shown, so this staying false is correct rather than
   * something the desktop layout has to work around.
   */
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <main
      style={{
        background: T.bg,
        minHeight: '100vh',
        fontFamily: GUTS_FONT,
        color: T.text,
      }}
    >
      <style>{`
        .guts * { box-sizing: border-box; }
        .guts { max-width: 1220px; margin: 0 auto; padding: 34px 32px 80px; }
        .guts-grid {
          display: grid;
          grid-template-columns: 290px minmax(0, 1fr);
          gap: 20px;
          align-items: start;
        }

        /* ── THE RAIL ─────────────────────────────────────────────────── */
        .guts-rail {
          background: ${T.rail};
          border-radius: 14px;
          padding: 22px 0 14px;
          position: sticky;
          top: 78px;
        }
        .guts-rail-label {
          padding: 0 20px;
          margin: 0 0 12px;
          font-size: 10px; font-weight: bold; letter-spacing: 2.6px;
          color: ${T.railMuted};
        }
        .guts-rail-group + .guts-rail-group {
          margin-top: 22px; padding-top: 20px;
          border-top: 1px solid ${T.railLine};
        }
        .guts-rail a {
          display: flex; align-items: center; gap: 11px;
          padding: 10px 20px;
          color: rgba(255,255,255,0.86);
          text-decoration: none;
          font-size: 14px;
        }
        .guts-rail a:hover { background: rgba(255,255,255,0.06); color: #fff; }
        .guts-rail a .chev { color: rgba(255,255,255,0.34); flex-shrink: 0; }
        .guts-rail a:hover .chev { color: ${T.blue}; }
        .guts-rail a.here {
          background: ${T.royal};
          color: #fff; font-weight: 700;
          margin: 0 12px; padding: 10px 14px; border-radius: 8px;
        }
        .guts-rail a.here .chev { color: rgba(255,255,255,0.75); }

        .guts-rail-toggle { display: none; }
        .guts-rail-body { display: block; }

        /* ── THE ARTICLE ──────────────────────────────────────────────── */
        .guts-card {
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 14px;
          overflow: hidden;
        }
        .guts-sec {
          padding: 44px 48px;
          border-bottom: 1px solid ${T.surface2};
          text-align: center;
        }
        .guts-sec:last-child { border-bottom: none; }
        .guts-icon {
          width: 52px; height: 52px; margin: 0 auto 18px;
          display: grid; place-items: center;
          border-radius: 999px;
          background: ${T.royal}; color: #fff;
        }
        .guts-sec h2 {
          margin: 0 0 14px;
          font-size: 27px; font-weight: 800; letter-spacing: -0.6px;
          line-height: 1.2;
          color: ${T.text};
        }
        .guts-sec h3 {
          margin: 0 0 8px;
          font-size: 16px; font-weight: 800; letter-spacing: -0.2px;
          color: ${T.text};
        }
        .guts-sec p {
          margin: 0 auto 14px;
          max-width: 660px;
          font-size: 15.5px; line-height: 1.75;
          color: ${T.muted};
        }
        .guts-sec p:last-child { margin-bottom: 0; }
        .guts-sec a:not(.guts-btn) {
          color: ${T.royal}; font-weight: 600;
          text-decoration: underline; text-underline-offset: 3px;
        }
        .guts-eyebrow {
          font-size: 10px; font-weight: bold; letter-spacing: 3px;
          color: ${T.accent};
          margin-bottom: 14px;
        }

        /* ── HERO ─────────────────────────────────────────────────────── */
        .guts-hero { padding: 52px 48px 44px; }
        .guts-hero h1 {
          margin: 0 0 16px;
          font-size: 42px; font-weight: 800; letter-spacing: -1.4px;
          line-height: 1.08;
          color: ${T.text};
        }
        /* The landing page's two-tone headline, on the word that carries the
           meaning of the page. */
        .guts-hero h1 .second { display: block; color: ${T.royal}; }
        .guts-hero h1 .versus { color: ${T.royal}; }
        .guts-stamp { margin-top: 16px; font-size: 12px; color: ${T.muted}; }

        /* ── BUTTONS ──────────────────────────────────────────────────── */
        .guts-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 24px; }
        .guts-btn {
          display: inline-block; padding: 14px 28px; border-radius: 8px;
          font-family: inherit;
          font-size: 12px; font-weight: bold; letter-spacing: 2.6px;
          text-decoration: none; cursor: pointer;
        }
        .guts-btn.primary { background: ${T.royal}; color: #fff; border: none; }
        .guts-btn.primary:hover { background: ${T.accent}; }
        .guts-btn.secondary {
          background: transparent; color: ${T.text};
          border: 1px solid ${T.border}; border-top: 3px solid ${T.text};
        }
        .guts-inline {
          background: none; border: none; padding: 0;
          font: inherit; color: ${T.royal}; font-weight: 600;
          text-decoration: underline; text-underline-offset: 3px;
          cursor: pointer;
        }

        /* ── CARD GRID ────────────────────────────────────────────────── */
        .guts-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 24px; text-align: left; }
        .guts-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 24px; text-align: left; }
        .guts-panel {
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-radius: 10px;
          padding: 20px 22px;
        }
        .guts-panel p { margin: 0; max-width: none; font-size: 13.5px; line-height: 1.65; }
        .guts-panel .role {
          font-size: 9px; font-weight: bold; letter-spacing: 2px;
          color: ${T.muted}; margin-bottom: 12px;
        }
        a.guts-panel { display: block; text-decoration: none; transition: border-color 0.15s, transform 0.15s; }
        a.guts-panel:hover { border-color: ${T.royal}; transform: translateY(-2px); }

        /* ── LISTS ────────────────────────────────────────────────────── */
        .guts-list { list-style: none; margin: 0; padding: 0; text-align: left; }
        .guts-list li {
          position: relative;
          padding-left: 22px;
          margin-bottom: 9px;
          font-size: 13.5px; line-height: 1.6; color: ${T.muted};
        }
        .guts-list li:last-child { margin-bottom: 0; }
        .guts-list li::before {
          position: absolute; left: 0; top: 0;
          font-weight: bold;
        }
        .guts-list.good li::before { content: '✓'; color: ${T.green}; }
        .guts-list.warn li::before { content: '!'; color: ${T.amber}; }

        /* ── TABLES ───────────────────────────────────────────────────── */
        .guts-tablewrap {
          margin-top: 24px;
          border: 1px solid ${T.border};
          border-radius: 10px;
          overflow-x: auto;
          text-align: left;
        }
        .guts-tablewrap table { width: 100%; border-collapse: collapse; }
        .guts-tablewrap th {
          background: ${T.rail};
          color: rgba(255,255,255,0.7);
          padding: 14px 16px;
          text-align: center;
          font-size: 10px; letter-spacing: 2px; font-weight: bold;
          white-space: nowrap;
        }
        .guts-tablewrap th:first-child { text-align: left; }
        .guts-tablewrap th.ds-head { color: ${T.blue}; }
        .guts-tablewrap td {
          padding: 12px 16px;
          border-bottom: 1px solid ${T.surface2};
          text-align: center;
          font-size: 12.5px;
          color: ${T.muted};
        }
        .guts-tablewrap tr:last-child td { border-bottom: none; }
        .guts-tablewrap td:first-child {
          text-align: left; font-weight: 600; color: ${T.text};
          font-size: 13px;
        }
        .guts-tablewrap tr:nth-child(even) td { background: rgba(226,228,234,0.34); }
        .guts-tablewrap td.ds-cell { background: rgba(42,110,255,0.06); color: ${T.royal}; font-weight: bold; }
        .guts-yes { color: ${T.green}; font-size: 17px; font-weight: bold; }
        .guts-no { color: ${T.red}; font-size: 17px; font-weight: bold; }
        .guts-partial { color: ${T.amber}; font-size: 11.5px; }

        /* ── CALLOUT ──────────────────────────────────────────────────── */
        .guts-callout {
          margin-top: 24px;
          background: rgba(42,110,255,0.05);
          border: 1px solid rgba(42,110,255,0.22);
          border-radius: 10px;
          padding: 22px 24px;
          text-align: left;
        }
        .guts-callout p { margin: 0 0 10px; max-width: none; font-size: 14.5px; }
        .guts-callout p:last-child { margin-bottom: 0; }
        .guts-note {
          margin-top: 24px;
          font-size: 12.5px; line-height: 1.7; color: ${T.muted};
          text-align: left;
          padding-top: 18px;
          border-top: 1px solid ${T.surface2};
        }

        /* ── RESPONSIVE ───────────────────────────────────────────────── */
        @media (max-width: 1000px) {
          .guts-grid { grid-template-columns: minmax(0, 1fr); }
          .guts-rail { position: static; padding: 12px 0; }
          .guts-grid-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }

          /* Stacked above the article, the rail is seventeen links standing
             between the visitor and the page's first sentence. */
          .guts-rail-label-wide { display: none; }
          .guts-rail-body { display: none; }
          .guts-rail-body.is-open { display: block; padding-top: 18px; }
          .guts-rail-body.is-open .guts-rail-group:first-child { margin-top: 0; }
          .guts-rail-toggle {
            display: flex; align-items: center; justify-content: space-between;
            width: calc(100% - 24px);
            margin: 0 12px;
            padding: 12px 14px;
            background: rgba(255,255,255,0.06);
            border: 1px solid ${T.railLine};
            border-radius: 8px;
            color: #fff;
            font-family: inherit;
            font-size: 11px; font-weight: bold; letter-spacing: 2.6px;
            cursor: pointer;
          }
          .guts-rail-toggle .caret { transition: transform 0.16s ease; font-size: 13px; }
          .guts-rail-toggle[aria-expanded="true"] { background: ${T.royal}; border-color: ${T.royal}; }
          .guts-rail-toggle[aria-expanded="true"] .caret { transform: rotate(180deg); }
        }
        @media (max-width: 700px) {
          .guts { padding: 20px 16px 56px; }
          .guts-sec { padding: 32px 22px; }
          .guts-hero { padding: 34px 22px 30px; }
          .guts-hero h1 { font-size: 29px; letter-spacing: -0.8px; }
          .guts-sec h2 { font-size: 22px; }
          .guts-grid-2, .guts-grid-3 { grid-template-columns: minmax(0, 1fr); }
          .guts-btn { display: block; width: 100%; text-align: center; }
        }
      `}</style>

      <div className="guts">
        <div className="guts-grid">

          <aside className="guts-rail">
            <button
              type="button"
              className="guts-rail-toggle"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              MAIN MENU
              <span className="caret" aria-hidden>▾</span>
            </button>

            <div className={`guts-rail-body${menuOpen ? ' is-open' : ''}`}>
              {rail.map((group, gi) => (
                <div className="guts-rail-group" key={group.label}>
                  <p className={`guts-rail-label${gi === 0 ? ' guts-rail-label-wide' : ''}`}>
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={item.href === activeHref ? 'here' : undefined}
                    >
                      <RailChevron /> {item.label}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </aside>

          <div className="guts-card">{children}</div>
        </div>
      </div>
    </main>
  )
}
