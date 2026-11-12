'use client'

import Link from '@/components/LocaleLink'
import { Children, cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from 'react'
import { SITE } from '@/lib/siteTheme'
import { inter } from '@/lib/fonts'
import { t } from '@/lib/i18n/client'

// =============================================================================
// THE ARTICLE SHELL, SECOND LOOK — /faq, /vs, /tools and /dialing-modes
// =============================================================================
// Approved from a local demo on 12 Nov 2026 and rolled out to the article
// families only. Pricing, features, the legal pages and the data pages still
// run on GutsShellClassic until the owner says otherwise. Pages import
// components/GutsShell, which picks between the two by address; nothing
// imports this file directly.
//
// Same bones as the classic shell: dark rail on the left, one white article
// card on the right, hairline-divided sections, centered headings over
// left-aligned prose. Every class name a page already uses still works, so a
// page gets this look without a line of its copy or markup changing.
//
// WHAT CHANGED, AND WHY EACH ONE IS THERE
//   1. Numbered section tabs replace the identical blue circles. Seven equal
//      circles gave a long page no sense of place; "03" does. The number square
//      is the homepage's own (HOW IT WORKS, 01-04).
//   2. An ON THIS PAGE index under the hero, built from the section titles the
//      page already passes. Nobody reads a 2,000 word answer top to bottom;
//      they look for their part of it.
//   3. Lists carry weight: real check marks, and cautions sit in an amber
//      panel instead of a row of small exclamation marks.
//   4. The questions are cards, left-aligned, all visible (the FAQ markup rule:
//      a question only counts if it is on the page).
//   5. The rail fits the screen and keeps the price and GET STARTED in view
//      the whole way down. FAQ articles had no sign-up button above the fold.
//   6. A closing band with the homepage's own line and button, for the reader
//      who made it to the end.
//
// No new copy beyond the three words ON THIS PAGE. Everything else on the band
// and the rail is a string the homepage already carries in all twelve
// languages.
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
  /** The closing sign-up band. On by default; legal pages turn it off. */
  cta?: boolean
  children: ReactNode
}

const T = {
  bg: SITE.bg,
  surface: SITE.surface,
  surface2: SITE.borderSoft,
  border: SITE.border,
  text: SITE.text,
  /** Running prose. Darker than `muted`, which was thin at paragraph length. */
  body: '#3d414e',
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
const FUTURA = `'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif`

const CHECK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231a6a1a' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m5.5 12.6 4.3 4.3 8.7-9.6'/%3E%3C/svg%3E")`

function RailChevron() {
  return (
    <svg className="chev" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </svg>
  )
}

/* ── THE ICON SET ────────────────────────────────────────────────────────
   Unchanged from GutsShell: named, 24-grid, one stroke weight. */
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
 * One section of the article. Centered, hairline-separated, led by a numbered
 * tab. The number is a CSS counter, so it is right on every page without any
 * page passing one.
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
      {title && (
        <div className="guts-badge" aria-hidden="true">
          <span className="n" />
          {icon && (
            <span className="i">
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[icon]}
              </svg>
            </span>
          )}
        </div>
      )}
      {title && <h2>{t(title)}</h2>}
      {children}
    </section>
  )
}

interface TocEntry { id: string; title: string }

/**
 * Read the section titles off the children the page already passes, and give
 * each titled section an id to jump to. Done during render, not in an effect,
 * so the index is in the served HTML and the hero does not grow after load.
 */
function withToc(children: ReactNode): { nodes: ReactNode[]; toc: TocEntry[] } {
  const toc: TocEntry[] = []
  const nodes = Children.toArray(children).map((child) => {
    if (!isValidElement(child)) return child
    const props = (child as ReactElement<{ title?: string; id?: string }>).props
    if (typeof props?.title !== 'string' || !props.title) return child
    const id = props.id || `part-${toc.length + 1}`
    toc.push({ id, title: props.title })
    return props.id ? child : cloneElement(child as ReactElement<{ id?: string }>, { id })
  })
  return { nodes, toc }
}

export default function GutsShell({ rail, activeHref, cta = true, children }: GutsShellProps) {
  /**
   * Only consulted below the stacked breakpoint. At full width the rail is a
   * sidebar and is always shown.
   */
  const [menuOpen, setMenuOpen] = useState(false)
  const { nodes, toc } = withToc(children)
  /* Three parts or fewer is a page you can see whole; an index of it is noise.
     And it belongs under a hero: a page whose first block is already a titled
     section has nowhere sensible to put one. */
  const first = nodes[0]
  const opensWithHero = !(isValidElement(first) && typeof (first as ReactElement<{ title?: string }>).props?.title === 'string')
  const showToc = toc.length >= 4 && opensWithHero
  const half = Math.ceil(toc.length / 2)

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
        .guts { max-width: 1240px; margin: 0 auto; padding: 34px 32px 80px; }
        .guts-grid {
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
          gap: 22px;
          align-items: start;
        }

        /* ── THE RAIL ───────────────────────────────────────────────────
           Fits the screen. The links scroll inside it and the price and the
           button stay put underneath, so the way to sign up is in view from
           the first line of the article to the last. */
        .guts-rail {
          background: ${T.rail};
          border-radius: 16px;
          position: sticky;
          top: 78px;
          max-height: calc(100vh - 98px);
          display: flex; flex-direction: column;
          overflow: hidden;
          box-shadow: 0 18px 40px -22px rgba(13,24,48,0.55);
        }
        .guts-rail-body {
          display: block;
          flex: 1 1 auto; min-height: 0;
          overflow-y: auto;
          padding: 22px 0 14px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.18) transparent;
        }
        .guts-rail-label {
          padding: 0 20px;
          margin: 0 0 10px;
          font-size: 10px; font-weight: bold; letter-spacing: 2.6px;
          color: ${T.railMuted};
        }
        .guts-rail-group + .guts-rail-group {
          margin-top: 18px; padding-top: 18px;
          border-top: 1px solid ${T.railLine};
        }
        .guts-rail-body a {
          display: flex; align-items: center; gap: 11px;
          padding: 9px 20px;
          color: rgba(255,255,255,0.84);
          text-decoration: none;
          font-size: 13.5px;
          transition: background 0.12s ease, color 0.12s ease;
        }
        .guts-rail-body a:hover { background: rgba(255,255,255,0.06); color: #fff; }
        .guts-rail-body a .chev { color: rgba(255,255,255,0.30); flex-shrink: 0; transition: transform 0.12s ease, color 0.12s ease; }
        .guts-rail-body a:hover .chev { color: ${T.blue}; transform: translateX(2px); }
        .guts-rail-body a.here {
          background: ${T.royal};
          color: #fff; font-weight: 700;
          margin: 0 12px; padding: 9px 14px; border-radius: 8px;
        }
        .guts-rail-body a.here .chev { color: rgba(255,255,255,0.75); }

        .guts-rail-cta {
          flex-shrink: 0;
          padding: 16px 16px 16px;
          border-top: 1px solid ${T.railLine};
          background: linear-gradient(180deg, rgba(74,158,255,0.10), rgba(74,158,255,0.02));
        }
        .guts-rail-price {
          display: flex; align-items: baseline; gap: 9px;
          margin: 0 4px 12px;
        }
        .guts-rail-price .amt {
          font-family: ${FUTURA};
          font-size: 30px; font-weight: bold; letter-spacing: -0.5px; line-height: 1;
          color: ${T.blue};
        }
        .guts-rail-price .per {
          font-size: 10px; font-weight: bold; letter-spacing: 2.4px;
          color: ${T.railMuted};
        }
        .guts-rail-btn {
          display: block; text-align: center;
          padding: 13px 14px; border-radius: 9px;
          background: ${T.royal}; color: #fff;
          font-size: 11.5px; font-weight: bold; letter-spacing: 2.4px;
          text-decoration: none;
          transition: background 0.12s ease, transform 0.12s ease;
        }
        .guts-rail-btn:hover { background: #3f7dff; transform: translateY(-1px); }

        .guts-rail-toggle { display: none; }

        /* ── THE ARTICLE ──────────────────────────────────────────────── */
        .guts-card {
          background: ${T.surface};
          border: 1px solid #d3d7e0;
          border-radius: 16px;
          overflow: hidden;
          counter-reset: gsec;
          box-shadow: 0 1px 2px rgba(13,24,48,0.04), 0 22px 44px -28px rgba(13,24,48,0.22);
        }
        .guts-sec {
          padding: 56px 48px;
          border-bottom: 1px solid ${T.surface2};
          text-align: center;
          scroll-margin-top: 78px;
        }
        .guts-sec:last-child { border-bottom: none; }

        /* The numbered tab. Navy number, blue icon: the page's two colours,
           once per section. */
        .guts-badge {
          counter-increment: gsec;
          display: inline-flex; align-items: stretch;
          height: 38px; margin: 0 auto 20px;
          border-radius: 10px; overflow: hidden;
          box-shadow: 0 8px 18px -10px rgba(13,24,48,0.55);
        }
        .guts-badge .n {
          display: grid; place-items: center;
          min-width: 42px; padding: 0 12px;
          background: ${T.rail}; color: ${T.blue};
          font-family: ${FUTURA};
          font-size: 13px; font-weight: bold; letter-spacing: 1px;
        }
        .guts-badge .n::before { content: counter(gsec, decimal-leading-zero); }
        .guts-badge .i {
          display: grid; place-items: center;
          padding: 0 11px;
          background: ${T.royal}; color: #fff;
        }
        /* Pages that still draw the old round icon keep it, restyled to match. */
        .guts-icon {
          width: 44px; height: 44px; margin: 0 auto 18px;
          display: grid; place-items: center;
          border-radius: 12px;
          background: ${T.royal}; color: #fff;
        }

        .guts-sec h2 {
          margin: 0 auto 18px;
          max-width: 720px;
          font-size: 29px; font-weight: 800; letter-spacing: -0.8px;
          line-height: 1.18;
          color: ${T.text};
          text-wrap: balance;
        }
        .guts-sec h3 {
          margin: 0 0 8px;
          font-size: 16px; font-weight: 800; letter-spacing: -0.2px;
          color: ${T.text};
        }
        /* Centered column, left-aligned prose, as before. */
        .guts-sec p {
          margin: 0 auto 16px;
          max-width: 660px;
          font-size: 16px; line-height: 1.75;
          color: ${T.body};
          text-align: start;
        }
        .guts-sec p:last-child { margin-bottom: 0; }
        .guts-sec strong { color: ${T.text}; }
        .guts-sec a:not(.guts-btn) {
          color: ${T.royal}; font-weight: 600;
          text-decoration: underline; text-decoration-color: rgba(42,110,255,0.35);
          text-underline-offset: 3px;
        }
        .guts-sec a:not(.guts-btn):hover { text-decoration-color: ${T.royal}; }
        .guts-sec ul, .guts-sec ol { text-align: start; max-width: 660px; margin-inline-start: auto; margin-inline-end: auto; }
        .guts-sec table { text-align: start; }

        .guts-eyebrow {
          display: inline-block;
          padding: 7px 14px;
          border-radius: 999px;
          background: rgba(42,110,255,0.07);
          border: 1px solid rgba(42,110,255,0.18);
          font-size: 10px; font-weight: bold; letter-spacing: 2.6px;
          color: ${T.accent};
          margin-bottom: 20px;
        }

        /* ── HERO ───────────────────────────────────────────────────────
           The hero sat inside a section and got both paddings. It owns its
           own now, and a wash of the brand blue so the page opens on colour
           rather than on a blank card. */
        .guts-sec:has(> .guts-hero) { padding: 0; }
        .guts-hero {
          padding: 60px 48px 48px;
          background:
            radial-gradient(900px 340px at 50% -80px, rgba(42,110,255,0.13), rgba(42,110,255,0) 70%),
            linear-gradient(180deg, #f6f9ff 0%, #ffffff 78%);
          border-top: 3px solid ${T.royal};
        }
        .guts-hero h1 {
          margin: 0 auto 20px;
          max-width: 760px;
          font-size: 48px; font-weight: 800; letter-spacing: -1.8px;
          line-height: 1.06;
          color: ${T.text};
          text-wrap: balance;
        }
        .guts-hero h1 .second { display: block; color: ${T.royal}; }
        .guts-hero h1 .versus { color: ${T.royal}; }
        /* The direct answer. The one paragraph most visitors read, so it is
           set a size up and in full ink. */
        .guts-hero p {
          text-align: center;
          max-width: 680px;
          font-size: 17.5px; line-height: 1.7;
          color: #2c303b;
        }
        .guts-stamp { margin-top: 22px; font-size: 12px; color: ${T.muted}; }

        /* ── ON THIS PAGE ─────────────────────────────────────────────── */
        .guts-sec:has(> .guts-hero):has(+ .guts-toc) { border-bottom: none; }
        .guts-toc {
          padding: 0 48px 48px;
          border-bottom: 1px solid ${T.surface2};
        }
        .guts-toc-inner {
          max-width: 820px; margin: 0 auto;
          background: #f5f6f9;
          border: 1px solid ${T.surface2};
          border-radius: 14px;
          padding: 18px 14px 12px;
        }
        .guts-toc-label {
          padding: 0 10px 12px;
          font-size: 10px; font-weight: bold; letter-spacing: 2.6px;
          color: ${T.muted};
          text-align: start;
        }
        .guts-toc ol {
          list-style: none; margin: 0; padding: 0;
          display: grid;
          grid-auto-flow: column;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 2px 12px;
        }
        .guts-toc a {
          display: flex; align-items: center; gap: 12px;
          padding: 8px 10px;
          border-radius: 9px;
          color: ${T.text};
          font-size: 14px; font-weight: 600; line-height: 1.35;
          text-decoration: none; text-align: start;
          transition: background 0.12s ease, box-shadow 0.12s ease;
        }
        .guts-toc a:hover { background: #fff; box-shadow: 0 0 0 1px ${T.border}; }
        .guts-toc .n {
          flex-shrink: 0;
          width: 30px; height: 28px;
          display: grid; place-items: center;
          border-radius: 7px;
          background: ${T.rail}; color: ${T.blue};
          font-family: ${FUTURA};
          font-size: 11.5px; font-weight: bold; letter-spacing: 0.6px;
        }
        .guts-toc a:hover .n { background: ${T.royal}; color: #fff; }

        /* ── BUTTONS ──────────────────────────────────────────────────── */
        .guts-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 28px; }
        .guts-btn {
          display: inline-block; padding: 15px 28px; border-radius: 10px;
          font-family: inherit;
          font-size: 12px; font-weight: bold; letter-spacing: 2.6px;
          text-decoration: none; cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease, border-color 0.12s ease;
        }
        .guts-btn.primary {
          background: ${T.royal}; color: #fff; border: none;
          box-shadow: 0 10px 22px -10px rgba(42,110,255,0.75);
        }
        .guts-btn.primary:hover { background: #1f5fe8; transform: translateY(-1px); }
        .guts-btn.secondary {
          background: #fff; color: ${T.text};
          border: 1px solid ${T.border}; border-top: 3px solid ${T.text};
        }
        .guts-btn.secondary:hover { border-color: ${T.royal}; border-top-color: ${T.royal}; color: ${T.royal}; transform: translateY(-1px); }
        .guts-inline {
          background: none; border: none; padding: 0;
          font: inherit; color: ${T.royal}; font-weight: 600;
          text-decoration: underline; text-underline-offset: 3px;
          cursor: pointer;
        }

        /* ── CARD GRID ────────────────────────────────────────────────── */
        .guts-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 26px; text-align: start; }
        .guts-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 26px; text-align: start; }
        .guts-panel {
          background: #f7f8fa;
          border: 1px solid ${T.surface2};
          border-radius: 12px;
          padding: 22px 24px;
        }
        .guts-panel p { margin: 0; max-width: none; font-size: 14px; line-height: 1.65; }
        .guts-panel .role {
          font-size: 9px; font-weight: bold; letter-spacing: 2px;
          color: ${T.muted}; margin-bottom: 12px;
        }
        a.guts-panel { display: block; text-decoration: none; transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s; }
        a.guts-panel:hover { border-color: ${T.royal}; transform: translateY(-2px); box-shadow: 0 14px 26px -18px rgba(42,110,255,0.6); }

        /* ── LISTS ──────────────────────────────────────────────────────
           The same two lists, given the weight of the points they make. */
        .guts-list { list-style: none; margin: 22px auto 0; padding: 0; text-align: start; }
        .guts-sec > .guts-list:first-child, .guts-sec > h2 + .guts-list { margin-top: 0; }
        .guts-list li {
          position: relative;
          padding-inline-start: 36px;
          margin-bottom: 13px;
          font-size: 15px; line-height: 1.65; color: ${T.body};
        }
        .guts-list li:last-child { margin-bottom: 0; }
        .guts-list li::before {
          content: '';
          position: absolute; inset-inline-start: 0; top: 1px;
          width: 22px; height: 22px; border-radius: 999px;
          display: grid; place-items: center;
          font-size: 12.5px; font-weight: 800; line-height: 1;
        }
        .guts-list.good li::before {
          background: rgba(26,106,26,0.11) ${CHECK} center / 12px 12px no-repeat;
        }
        .guts-list.warn {
          background: #fdf8ea;
          border: 1px solid #ecdfb6;
          border-radius: 12px;
          padding: 18px 20px;
        }
        .guts-list.warn li::before {
          content: '!';
          background: rgba(138,106,26,0.16); color: ${T.amber};
        }
        /* Inside a panel a list is already in a box: no second box, and the
           smaller size the panel sets. */
        .guts-panel .guts-list { margin-top: 0; }
        .guts-panel .guts-list.warn { background: none; border: none; border-radius: 0; padding: 0; }
        .guts-panel .guts-list li { font-size: 13.5px; padding-inline-start: 32px; margin-bottom: 10px; }

        /* ── TABLES ───────────────────────────────────────────────────── */
        .guts-tablewrap {
          margin-top: 26px;
          border: 1px solid ${T.border};
          border-radius: 12px;
          overflow-x: auto;
          text-align: start;
          box-shadow: 0 16px 30px -26px rgba(13,24,48,0.5);
        }
        .guts-tablewrap table { width: 100%; border-collapse: collapse; }
        .guts-tablewrap th {
          background: ${T.rail};
          color: rgba(255,255,255,0.7);
          padding: 15px 16px;
          text-align: center;
          font-size: 10px; letter-spacing: 2px; font-weight: bold;
          white-space: nowrap;
        }
        .guts-tablewrap th:first-child { text-align: start; }
        .guts-tablewrap th.ds-head { color: ${T.blue}; box-shadow: inset 0 3px 0 ${T.royal}; }
        .guts-tablewrap td {
          padding: 13px 16px;
          border-bottom: 1px solid ${T.surface2};
          text-align: center;
          font-size: 13px;
          color: ${T.body};
        }
        .guts-tablewrap tr:last-child td { border-bottom: none; }
        .guts-tablewrap td:first-child {
          text-align: start; font-weight: 600; color: ${T.text};
          font-size: 13.5px;
        }
        .guts-tablewrap tr:nth-child(even) td { background: rgba(226,228,234,0.30); }
        .guts-tablewrap td.ds-cell { background: rgba(42,110,255,0.07); color: ${T.royal}; font-weight: bold; }
        .guts-tablewrap tr:nth-child(even) td.ds-cell { background: rgba(42,110,255,0.10); }
        .guts-yes { color: ${T.green}; font-size: 17px; font-weight: bold; }
        .guts-no { color: ${T.red}; font-size: 17px; font-weight: bold; }
        .guts-partial { color: ${T.amber}; font-size: 11.5px; }

        /* ── CALLOUT AND NOTE ─────────────────────────────────────────── */
        .guts-callout {
          margin-top: 26px;
          background: rgba(42,110,255,0.05);
          border: 1px solid rgba(42,110,255,0.22);
          border-radius: 12px;
          padding: 22px 24px;
          text-align: start;
        }
        .guts-callout p { margin: 0 0 10px; max-width: none; font-size: 15px; }
        .guts-callout p:last-child { margin-bottom: 0; }
        /* The aside. Was a hairline and smaller type, which read as a
           footnote; these are usually the honest caveat, so it is marked. */
        .guts-sec .guts-note {
          margin-top: 22px;
          padding: 16px 20px;
          border: none;
          border-inline-start: 3px solid ${T.royal};
          border-radius: 0 10px 10px 0;
          background: rgba(42,110,255,0.045);
          font-size: 14.5px; line-height: 1.7; color: ${T.body};
          text-align: start;
        }

        /* ── THE QUESTIONS ──────────────────────────────────────────────
           A heading and its answer, wrapped by the page in a bare div. Drawn
           as a card and aligned left: a centered question over a left-aligned
           answer never lined up. */
        .guts-sec > div:has(> h3:first-child + p:last-child) {
          max-width: 760px;
          margin: 0 auto 12px !important;
          padding: 20px 24px;
          text-align: start;
          background: #f9fafc;
          border: 1px solid ${T.surface2};
          border-inline-start: 3px solid ${T.royal};
          border-radius: 4px 12px 12px 4px;
        }
        .guts-sec > div:has(> h3:first-child + p:last-child):last-of-type { margin-bottom: 0 !important; }
        .guts-sec > div:has(> h3:first-child + p:last-child) h3 { font-size: 16.5px; line-height: 1.4; margin-bottom: 8px !important; }
        .guts-sec > div:has(> h3:first-child + p:last-child) p { max-width: none; font-size: 15px; line-height: 1.7; }

        /* ── RELATED ──────────────────────────────────────────────────── */
        .guts-sec:has(> .related-links) { padding: 34px 48px 38px; background: #f9fafc; }
        .guts-sec:has(> .related-links) h2 {
          font-size: 10px; font-weight: bold; letter-spacing: 2.6px;
          text-transform: uppercase;
          color: ${T.muted};
          margin-bottom: 16px;
        }
        .guts-sec .related-links a:not(.guts-btn) { font-weight: 500; transition: border-color 0.12s ease, color 0.12s ease; }
        .guts-sec .related-links a:not(.guts-btn):hover { color: ${T.royal}; }

        /* ── THE CLOSING BAND ───────────────────────────────────────────
           The one dark panel in the article, where the ask is. The line and
           the button are the homepage's. */
        .guts-cta {
          padding: 54px 48px 56px;
          text-align: center;
          color: #fff;
          background:
            radial-gradient(700px 260px at 50% 0%, rgba(42,110,255,0.34), rgba(42,110,255,0) 72%),
            ${T.rail};
        }
        /* A page that closes on its own band keeps its own line; two dark
           panels stacked is one ask said twice. */
        .guts-card:has(.faq-cta, .why-cta, .tfaq-cta) > .guts-cta { display: none; }
        .guts-cta-eyebrow {
          font-size: 10.5px; font-weight: bold; letter-spacing: 3px;
          color: ${T.blue};
          margin-bottom: 18px;
        }
        .guts-cta-line {
          margin: 0 0 26px;
          font-family: ${FUTURA};
          font-size: 44px; font-weight: bold; letter-spacing: -1.6px; line-height: 1.04;
          color: #fff;
        }
        .guts-cta-line span { display: block; color: ${T.blue}; }
        .guts-cta .guts-btns { margin-top: 0; }
        .guts-cta .guts-btn.secondary {
          background: transparent; color: #fff;
          border: 1px solid rgba(255,255,255,0.28); border-top: 3px solid #fff;
        }
        .guts-cta .guts-btn.secondary:hover { border-color: ${T.blue}; color: ${T.blue}; }

        /* ── THE DIALER-MODE EXPLAINERS ─────────────────────────────────
           Eight pages (/dialing-modes/* and /faq/what-is-a-*-dialer) carry a
           private .dm- stylesheet each. They were written with a dark hero,
           and four of them kept the white headline after the hero went
           transparent, so the h1 was white on a white card. Painted here once
           rather than in eight stylesheets. */
        .guts-card .dm-root { counter-reset: dmsec; }
        .guts-card .dm-hero {
          padding: 60px 48px 48px;
          color: ${T.text};
          border-top: 3px solid ${T.royal};
          background:
            radial-gradient(900px 340px at 50% -80px, rgba(42,110,255,0.13), rgba(42,110,255,0) 70%),
            linear-gradient(180deg, #f6f9ff 0%, #ffffff 78%);
        }
        .guts-card .dm-hero h1 {
          color: ${T.text};
          font-size: 48px; letter-spacing: -1.8px; line-height: 1.06;
          text-wrap: balance;
        }
        .guts-card .dm-hero .dm-lead { color: #2c303b; max-width: 680px; font-size: 17.5px; line-height: 1.7; }
        .guts-card .dm-eyebrow { border-radius: 999px; color: ${T.accent}; }
        .guts-card .dm-section { padding: 56px 48px; scroll-margin-top: 78px; }
        .guts-card .dm-section h2 { font-size: 29px; letter-spacing: -0.8px; line-height: 1.18; text-wrap: balance; }
        .guts-card .dm-section h2::before {
          counter-increment: dmsec;
          content: counter(dmsec, decimal-leading-zero);
          display: grid; place-items: center;
          width: 46px; height: 38px;
          margin: 0 auto 20px;
          border-radius: 10px;
          background: ${T.rail}; color: ${T.blue};
          font-family: ${FUTURA};
          font-size: 13px; font-weight: bold; letter-spacing: 1px; line-height: 1;
          box-shadow: 0 8px 18px -10px rgba(13,24,48,0.55);
        }
        @media (max-width: 700px) {
          .guts-card .dm-hero { padding: 38px 20px 32px; }
          .guts-card .dm-hero h1 { font-size: 31px; letter-spacing: -1px; }
          .guts-card .dm-hero .dm-lead { font-size: 16px; }
          .guts-card .dm-section { padding: 38px 20px; }
          .guts-card .dm-section h2 { font-size: 23px; letter-spacing: -0.5px; }
        }

        /* ── LEGACY ARTICLE ROOTS ─────────────────────────────────────── */
        .guts-card > [class*="-root"] {
          background: transparent;
          min-height: 0;
          max-width: none;
          margin: 0;
        }

        /* ── RESPONSIVE ───────────────────────────────────────────────── */
        @media (max-width: 1000px) {
          .guts-grid { grid-template-columns: minmax(0, 1fr); }
          .guts-rail { position: static; max-height: none; display: block; padding: 12px 0; }
          .guts-grid-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }

          .guts-rail-label-wide { display: none; }
          .guts-rail-body { display: none; overflow: visible; padding: 0; }
          .guts-rail-body.is-open { display: block; padding-top: 18px; }
          .guts-rail-body.is-open .guts-rail-group:first-child { margin-top: 0; }
          /* The site header carries the sign-up button on a phone. */
          .guts-rail-cta { display: none; }
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
          .guts { padding: 16px 12px 56px; }
          .guts-sec { padding: 38px 20px; }
          .guts-hero { padding: 38px 20px 32px; }
          .guts-hero h1 { font-size: 31px; letter-spacing: -1px; }
          .guts-hero p { font-size: 16px; }
          .guts-sec h2 { font-size: 23px; letter-spacing: -0.5px; }
          .guts-sec p { font-size: 15.5px; }
          .guts-toc { padding: 0 14px 30px; }
          .guts-toc ol { grid-auto-flow: row; grid-template-columns: minmax(0, 1fr); grid-template-rows: none !important; }
          .guts-grid-2, .guts-grid-3 { grid-template-columns: minmax(0, 1fr); }
          .guts-btn { display: block; width: 100%; text-align: center; }
          .guts-list.warn { padding: 16px; }
          .guts-sec > div:has(> h3:first-child + p:last-child) { padding: 16px 16px; }
          .guts-sec:has(> .related-links) { padding: 28px 20px 30px; }
          .guts-cta { padding: 40px 20px 42px; }
          .guts-cta-line { font-size: 31px; letter-spacing: -1px; }
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
              {t("MAIN MENU")}<span className="caret" aria-hidden>▾</span>
            </button>

            <div className={`guts-rail-body${menuOpen ? ' is-open' : ''}`}>
              {rail.map((group, gi) => (
                <div className="guts-rail-group" key={group.label}>
                  <p className={`guts-rail-label${gi === 0 ? ' guts-rail-label-wide' : ''}`}>
                    {t(group.label)}
                  </p>
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={item.href === activeHref ? 'here' : undefined}
                    >
                      <RailChevron /> {t(item.label)}
                    </Link>
                  ))}
                </div>
              ))}
            </div>

            <div className="guts-rail-cta">
              <div className="guts-rail-price">
                <span className="amt">$35</span>
                <span className="per">{t("PER WEEK")}</span>
              </div>
              <Link href="/sign-up" className="guts-rail-btn">{t("GET STARTED →")}</Link>
            </div>
          </aside>

          <div className="guts-card">
            {nodes[0]}

            {showToc && (
              <nav className="guts-toc" aria-labelledby="guts-toc-label">
                <div className="guts-toc-inner">
                  <div className="guts-toc-label" id="guts-toc-label">{t("▸ ON THIS PAGE")}</div>
                  <ol style={{ gridTemplateRows: `repeat(${half}, auto)` }}>
                    {toc.map((entry, i) => (
                      <li key={entry.id}>
                        <a href={`#${entry.id}`}>
                          <span className="n">{String(i + 1).padStart(2, '0')}</span>
                          {t(entry.title)}
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
              </nav>
            )}

            {nodes.slice(1)}

            {cta && (
              <div className="guts-cta">
                <div className="guts-cta-eyebrow">{t("$35/WEEK · NO CONTRACTS · CANCEL ANYTIME")}</div>
                <p className="guts-cta-line">
                  {t("DIAL SMARTER.")}
                  <span>{t("CLOSE FASTER.")}</span>
                </p>
                <div className="guts-btns">
                  <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
                  <Link href="/vs" className="guts-btn secondary">{t("SEE HOW WE COMPARE")}</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
