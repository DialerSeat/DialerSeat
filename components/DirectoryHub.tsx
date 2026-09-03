'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { SITE } from '@/lib/siteTheme'
import { inter } from '@/lib/fonts'
import SuggestionModal from '@/components/SuggestionModal'

// =============================================================================
// THE DIRECTORY HUB — the shared template behind /vs and /faq
// =============================================================================
// /vs and /faq are the same page with different nouns. Both answer "show me
// everything you have on this subject, and let me find the one I came for."
// They had drifted into two separately hand-written layouts, which meant every
// change had to be made twice and got made slightly differently each time.
//
// This is that layout, once:
//
//   HERO           two-tone headline, the site's one signature move
//   TOP PICKS      the ten-second path for someone who knows what they want
//   SEARCH         the ten-second path for someone who doesn't
//   THREE COLUMNS  site nav · the full index · what shipped most recently
//
// WHY THE SEARCH IS REAL. A search box that only decorates a page is worse
// than no search box, because the visitor stops scanning and starts typing.
// This one filters the index live, matches on aliases as well as titles, and
// navigates straight through when the query resolves to exactly one page.
//
// WHY "RECENTLY ADDED" IS DATED, NOT CURATED. Every item carries the date its
// page actually went live, read out of git rather than picked. A recently-added
// list somebody maintains by hand stops being true in about a month.
// =============================================================================

export interface HubItem {
  href: string
  label: string
  /**
   * A one-line description of the page. Searched, not rendered — the index
   * columns are single-line lists, and a second line under twenty-three rows
   * turns a column somebody scans into a column somebody reads.
   */
  note?: string
  /** ISO date the page went live. Items without one never reach Recently Added. */
  added?: string
  /** Aliases a visitor might type instead of the label. Searched, never shown. */
  keywords?: string
}

export interface DirectoryHubProps {
  /** Line one of the headline. Near-black. */
  headlineTop: string
  /** Line two. Royal blue — the landing page's two-tone headline. */
  headlineBottom: string
  /** A word inside headlineBottom to draw the hand-inked swash under. */
  underline?: string
  /** The one link under the hero, pointing at the page worth reading first. */
  leadHref: string
  leadLabel: string

  picksLabel: string
  picks: HubItem[]

  searchPlaceholder: string
  /** Describes the index for screen readers: "comparisons", "answers". */
  searchNoun: string

  requestTitle: string
  requestLabel: string
  /** Intro line shown inside the Ask-us box. */
  requestPrompt: string

  navTitle: string
  navDivider: string
  navItems: HubItem[]

  allTitle: string
  allItems: HubItem[]
  allCta: string

  recentTitle: string
}

/** How many rows a column shows before it asks to be expanded. */
/**
 * How many index rows a phone shows before it offers to expand.
 *
 * Only a phone. On a desktop the full index IS the page — collapsing it behind
 * a button hides the one thing the visitor came to scan, and the column has the
 * room to show everything. The clamp is pure CSS below, so the rows are always
 * in the DOM and always crawlable.
 */
const CHUNK = 12

/** Recently Added is a fixed window, not a browsable list. */
const RECENT_MAX = 25

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.4 12 3.5l9 6.9" />
      <path d="M5.4 9.6V20h13.2V9.6" />
      <path d="M9.8 20v-5.6h4.4V20" />
    </svg>
  )
}

function IconScales() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4.2v15.4" />
      <path d="M7 19.6h10" />
      <path d="M4.4 7.6h15.2" />
      <path d="M4.4 7.6 1.9 13.4h5z" />
      <path d="M19.6 7.6 17.1 13.4h5z" />
      <circle cx="12" cy="4.2" r="1.5" />
    </svg>
  )
}

function IconStar() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
      <path d="M12 3.6l2.5 5.3 5.6.8-4.1 4 1 5.7-5-2.7-5 2.7 1-5.7-4.1-4 5.6-.8z" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.4" />
      <path d="m15.6 15.6 4 4" />
    </svg>
  )
}

function IconQuestion() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.6" />
      <path d="M9.7 9.4a2.4 2.4 0 1 1 3.2 2.3c-.6.2-.9.8-.9 1.4v.5" />
      <path d="M12 16.6h.01" />
    </svg>
  )
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </svg>
  )
}

/**
 * Draws the headline's second line with a hand-inked swash under one word.
 *
 * The swash is an SVG path rather than text-decoration because a straight 1px
 * rule under an 800-weight headline reads as a link, not as emphasis.
 */
function Underlined({ text, word }: { text: string; word?: string }) {
  if (!word) return <>{text}</>
  const at = text.indexOf(word)
  if (at === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <span className="hub-swash">
        {word}
        <svg viewBox="0 0 120 14" preserveAspectRatio="none" aria-hidden="true">
          <path d="M3,9.6 C22,4.2 44,11.4 63,6.6 C82,1.9 100,9.1 117,4.4" />
        </svg>
      </span>
      {text.slice(at + word.length)}
    </>
  )
}

/** Every typed word has to appear somewhere in the row. Order does not matter. */
function matches(item: HubItem, query: string): boolean {
  const hay = [item.label, item.note, item.keywords, item.href]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return query.split(/\s+/).filter(Boolean).every((word) => hay.includes(word))
}

export default function DirectoryHub(props: DirectoryHubProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [askOpen, setAskOpen] = useState(false)

  const q = query.trim().toLowerCase()

  const filtered = useMemo(
    () => (q ? props.allItems.filter((item) => matches(item, q)) : props.allItems),
    [props.allItems, q],
  )

  // Newest first, and only pages that actually carry a date.
  const recent = useMemo(
    () =>
      props.allItems
        .filter((item) => item.added)
        .slice()
        .sort((a, b) => (a.added! < b.added! ? 1 : a.added! > b.added! ? -1 : 0)),
    [props.allItems],
  )

  // Every match is rendered. What a phone actually shows is clamped in CSS, so
  // "show all" is a mobile affordance rather than a gate on the content.
  const visibleRecent = recent.slice(0, RECENT_MAX)

  // The Search button has to do something the live filter has not already done,
  // or it is a button that lies. When the query resolves to exactly one page,
  // it takes you there.
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (filtered.length === 1) router.push(filtered[0].href)
  }

  return (
    <div className="hub">
      <style>{`
        .hub * { box-sizing: border-box; }
        .hub {
          --hub-blue: ${SITE.blue};
          --hub-royal: #2a6eff;
          --hub-green: #1a6a4a;
          --hub-line: ${SITE.borderSoft};
          --hub-rowline: #f0f2f6;
          font-family: ${inter.style.fontFamily};
          color: ${SITE.text};
        }
        .hub-inner { max-width: 1180px; margin: 0 auto; padding: 0 32px 88px; }

        /* ── HERO ─────────────────────────────────────────────────────── */
        .hub-hero { text-align: center; padding: 72px 32px 34px; }
        .hub-hero h1 {
          margin: 0;
          font-size: 54px;
          font-weight: 800;
          line-height: 1.06;
          letter-spacing: -1.6px;
        }
        .hub-hero h1 .l1 { display: block; color: ${SITE.text}; }
        .hub-hero h1 .l2 { display: block; color: var(--hub-royal); }
        .hub-swash { position: relative; display: inline-block; white-space: nowrap; }
        .hub-swash svg {
          position: absolute;
          left: -2%; bottom: -0.15em;
          width: 104%; height: 0.28em;
          overflow: visible;
        }
        .hub-swash path {
          fill: none;
          stroke: rgba(74,158,255,0.6);
          stroke-width: 4;
          stroke-linecap: round;
          vector-effect: non-scaling-stroke;
        }
        .hub-lead {
          display: inline-flex; align-items: center; gap: 7px;
          margin-top: 20px;
          font-size: 15px; font-weight: 600;
          color: var(--hub-royal);
          text-decoration: underline;
          text-underline-offset: 4px;
          text-decoration-thickness: 1.5px;
        }
        .hub-lead:hover { color: ${SITE.deep}; }

        /* ── TOP PICKS ────────────────────────────────────────────────── */
        .hub-picks {
          display: flex; align-items: center; flex-wrap: wrap;
          row-gap: 10px;
          background: ${SITE.surface};
          border: 1px solid ${SITE.border};
          border-radius: 12px;
          padding: 14px 18px;
        }
        .hub-picks-label {
          flex-shrink: 0;
          background: var(--hub-royal);
          color: #fff;
          font-size: 10px; font-weight: bold; letter-spacing: 2.5px;
          padding: 9px 14px;
          border-radius: 6px;
          margin-right: 16px;
        }
        .hub-pick {
          padding: 4px 18px;
          font-size: 14.5px; font-weight: 600;
          color: var(--hub-royal);
          text-decoration: none;
          border-right: 1px solid var(--hub-line);
          white-space: nowrap;
        }
        .hub-pick:last-child { border-right: none; }
        .hub-pick:hover { color: ${SITE.deep}; text-decoration: underline; text-underline-offset: 3px; }

        /* ── SEARCH ROW ───────────────────────────────────────────────── */
        .hub-searchrow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 18px;
          margin: 22px 0 26px;
        }
        .hub-search {
          display: flex; align-items: center; gap: 12px;
          background: ${SITE.surface};
          border: 1px solid ${SITE.border};
          border-radius: 12px;
          padding: 12px 12px 12px 20px;
        }
        .hub-search:focus-within { border-color: var(--hub-royal); }
        .hub-search-icon { color: #9aa2b2; display: flex; flex-shrink: 0; }
        .hub-search input {
          flex: 1; min-width: 0;
          border: none; outline: none; background: transparent;
          font-family: inherit; font-size: 16px; color: ${SITE.text};
          padding: 8px 0;
        }
        .hub-search input::placeholder { color: #9aa2b2; }
        .hub-search button {
          flex-shrink: 0;
          background: var(--hub-royal);
          color: #fff;
          border: none; border-radius: 8px;
          font-family: inherit; font-size: 14px; font-weight: bold;
          letter-spacing: 0.3px;
          padding: 13px 30px;
          cursor: pointer;
        }
        .hub-search button:hover { background: ${SITE.deep}; }

        /* Looks like the link it replaced, because it does what that link only
           promised — a mailto: works for people with a desktop mail client
           configured, which is most of nobody, and leaves no record either way. */
        .hub-ask {
          padding: 0; border: none; background: none;
          font-family: inherit; font-size: inherit; font-weight: 600;
          color: var(--hub-royal);
          text-decoration: underline; text-underline-offset: 3px;
          cursor: pointer;
        }
        .hub-ask:hover { color: ${SITE.deep}; }

        .hub-request {
          display: flex; align-items: center; gap: 14px;
          background: ${SITE.surface};
          border: 1px solid ${SITE.border};
          border-radius: 12px;
          padding: 16px 20px;
        }
        .hub-request-icon {
          flex-shrink: 0;
          width: 38px; height: 38px;
          display: grid; place-items: center;
          border-radius: 999px;
          background: #eaf1ff;
          border: 1px solid #cfe0ff;
          color: var(--hub-royal);
        }
        .hub-request-title { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
        .hub-request-body { font-size: 14px; color: ${SITE.muted}; }
        .hub-request-body a { color: var(--hub-royal); font-weight: 600; }

        /* ── THREE COLUMNS ────────────────────────────────────────────── */
        .hub-grid {
          display: grid;
          grid-template-columns: 280px minmax(0, 1.3fr) minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }
        .hub-card {
          background: ${SITE.surface};
          border: 1px solid ${SITE.border};
          border-radius: 12px;
          overflow: hidden;
        }
        .hub-card-head {
          position: relative;
          display: flex; align-items: center; gap: 13px;
          padding: 18px 20px;
          border-bottom: 1px solid var(--hub-line);
        }
        .hub-card-head h2 {
          margin: 0;
          font-size: 17px; font-weight: 800; letter-spacing: -0.2px;
          color: ${SITE.text};
        }
        .hub-card-count {
          margin-left: auto;
          font-size: 11px; font-weight: bold; letter-spacing: 1.5px;
          color: ${SITE.muted};
          background: ${SITE.bg};
          border: 1px solid var(--hub-line);
          border-radius: 999px;
          padding: 4px 10px;
        }
        .hub-badge {
          flex-shrink: 0;
          width: 34px; height: 34px;
          display: grid; place-items: center;
          border-radius: 9px;
        }
        .hub-badge.blue { background: var(--hub-royal); color: #fff; }
        .hub-badge.green { background: #16875a; color: #fff; border-radius: 999px; }
        .hub-badge.plain { color: var(--hub-royal); }

        /* The left column marks where you are, the way a sidebar does. */
        .hub-card-head.here::before {
          content: '';
          position: absolute; left: 0; top: 12px; bottom: 12px;
          width: 3px; border-radius: 0 3px 3px 0;
          background: var(--hub-royal);
        }
        .hub-card-head.here h2 { color: var(--hub-royal); }

        .hub-divider {
          padding: 14px 20px 10px;
          font-size: 10px; font-weight: bold; letter-spacing: 3px;
          color: ${SITE.muted};
          border-bottom: 1px solid var(--hub-line);
        }

        .hub-row {
          display: flex; align-items: center; gap: 12px;
          padding: 13px 20px;
          font-size: 14.5px;
          color: var(--hub-royal);
          text-decoration: none;
          border-bottom: 1px solid var(--hub-rowline);
          transition: background 0.14s ease, color 0.14s ease;
        }
        .hub-row:last-of-type { border-bottom: none; }
        .hub-row:hover { background: #f4f8ff; }
        .hub-row-label { flex: 1; min-width: 0; }
        .hub-chev { color: #b6bcc8; flex-shrink: 0; transition: transform 0.14s ease, color 0.14s ease; }
        .hub-row:hover .hub-chev { color: var(--hub-royal); transform: translateX(3px); }
        .hub-chev-left { color: #b6bcc8; flex-shrink: 0; transition: color 0.14s ease; }
        .hub-row:hover .hub-chev-left { color: var(--hub-royal); }
        .hub-dot {
          flex-shrink: 0;
          width: 7px; height: 7px; border-radius: 999px;
          background: #16875a;
        }
        .hub-empty {
          margin: 0;
          padding: 26px 20px;
          font-size: 14px; line-height: 1.65; color: ${SITE.muted};
        }
        .hub-empty a { color: var(--hub-royal); font-weight: 600; }

        /* The expander is a phone affordance only. On anything wider the full
           index is shown, because scanning it is the reason the page exists. */
        .hub-foot-phone { display: none; }

        .hub-foot { padding: 14px 16px; border-top: 1px solid var(--hub-line); }
        .hub-foot button {
          width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          border: none; border-radius: 8px;
          font-family: inherit; font-size: 13px; font-weight: bold; letter-spacing: 0.4px;
          padding: 13px 14px;
          cursor: pointer;
        }
        .hub-foot button.blue { background: #eaf1ff; color: var(--hub-royal); }
        .hub-foot button.blue:hover { background: #dbe8ff; }
        .hub-foot button.green { background: #e6f4ec; color: var(--hub-green); }
        .hub-foot button.green:hover { background: #d6ecdf; }

        /* ── RESPONSIVE ───────────────────────────────────────────────── */
        @media (max-width: 1040px) {
          .hub-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
          .hub-card-nav { grid-column: 1 / -1; }
          .hub-searchrow { grid-template-columns: minmax(0, 1fr); }

          /* The pipe dividers dangle at the end of every wrapped row once the
             bar folds past two lines, so narrower screens get chips instead.
             Full width keeps the mockup's divided list. */
          .hub-picks { padding: 12px; gap: 8px; }
          .hub-picks-label { margin-right: 2px; }
          .hub-pick {
            padding: 8px 12px;
            border-right: none;
            border: 1px solid #dde6fb;
            border-radius: 6px;
            background: #f5f8ff;
          }
        }
        @media (max-width: 760px) {
          /* Twenty-three rows is a lot of thumb on a phone, so the index
             collapses to CHUNK until asked. Every row stays in the DOM. */
          .hub-foot-phone { display: block; }
          .hub-card-index:not(.is-expanded) a.hub-row:nth-of-type(n + ${CHUNK + 1}) { display: none; }
          .hub-card-index:not(.is-expanded) a.hub-row:nth-of-type(${CHUNK}) { border-bottom: none; }

          .hub-inner { padding: 0 20px 64px; }
          .hub-hero { padding: 48px 20px 26px; }
          .hub-hero h1 { font-size: 34px; letter-spacing: -0.9px; }
          .hub-grid { grid-template-columns: minmax(0, 1fr); }
          .hub-pick { font-size: 13.5px; }
          .hub-search { padding: 10px; flex-wrap: wrap; }
          .hub-search button { width: 100%; }
        }
      `}</style>

      {/* ── HERO ── */}
      <section className="hub-hero">
        <h1>
          <span className="l1">{props.headlineTop}</span>
          <span className="l2">
            <Underlined text={props.headlineBottom} word={props.underline} />
          </span>
        </h1>
        <Link href={props.leadHref} className="hub-lead">
          {props.leadLabel} <span aria-hidden>→</span>
        </Link>
      </section>

      <div className="hub-inner">

        {/* ── TOP PICKS ── */}
        <nav className="hub-picks" aria-label={props.picksLabel}>
          <span className="hub-picks-label">{props.picksLabel}</span>
          {props.picks.map((item) => (
            <Link key={item.href} href={item.href} className="hub-pick">
              {item.label}
            </Link>
          ))}
        </nav>

        {/* ── SEARCH + REQUEST ── */}
        <div className="hub-searchrow">
          <form className="hub-search" onSubmit={onSubmit} role="search">
            <span className="hub-search-icon"><IconSearch /></span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={props.searchPlaceholder}
              aria-label={`Search ${props.searchNoun}`}
            />
            <button type="submit">Search</button>
          </form>

          <div className="hub-request">
            <span className="hub-request-icon"><IconQuestion /></span>
            <div>
              <div className="hub-request-title">{props.requestTitle}</div>
              <div className="hub-request-body">
                <button type="button" className="hub-ask" onClick={() => setAskOpen(true)}>
                  {props.requestLabel}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── THREE COLUMNS ── */}
        <div className="hub-grid">

          {/* SITE NAV */}
          <aside className="hub-card hub-card-nav">
            <div className="hub-card-head here">
              <span className="hub-badge plain"><IconHome /></span>
              <h2>{props.navTitle}</h2>
            </div>
            <div className="hub-divider">{props.navDivider}</div>
            {props.navItems.map((item) => (
              <Link key={item.href} href={item.href} className="hub-row">
                <Chevron className="hub-chev-left" />
                <span className="hub-row-label">{item.label}</span>
              </Link>
            ))}
          </aside>

          {/* THE FULL INDEX — every row, always. Clamped only on a phone. */}
          <section className={`hub-card hub-card-index${showAll || q ? ' is-expanded' : ''}`}>
            <div className="hub-card-head">
              <span className="hub-badge blue"><IconScales /></span>
              <h2>{q ? 'Search results' : props.allTitle}</h2>
              {q && <span className="hub-card-count">{filtered.length}</span>}
            </div>

            {filtered.map((item) => (
              <Link key={item.href} href={item.href} className="hub-row">
                <span className="hub-row-label">{item.label}</span>
                <Chevron className="hub-chev" />
              </Link>
            ))}

            {filtered.length === 0 && (
              <p className="hub-empty">
                Nothing here matches &ldquo;{query.trim()}&rdquo;.{' '}
                <button type="button" className="hub-ask" onClick={() => setAskOpen(true)}>
                  {props.requestLabel}
                </button>{' '}
                and we&apos;ll write it.
              </p>
            )}

            {!q && filtered.length > CHUNK && (
              <div className="hub-foot hub-foot-phone">
                <button type="button" className="blue" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'Show fewer' : props.allCta}{' '}
                  <span aria-hidden>{showAll ? '↑' : '→'}</span>
                </button>
              </div>
            )}
          </section>

          {/* RECENTLY ADDED — a fixed window of the newest 25. No expander. */}
          <section className="hub-card">
            <div className="hub-card-head">
              <span className="hub-badge green"><IconStar /></span>
              <h2>{props.recentTitle}</h2>
            </div>

            {visibleRecent.map((item) => (
              <Link key={item.href} href={item.href} className="hub-row">
                <span className="hub-dot" aria-hidden />
                <span className="hub-row-label">{item.label}</span>
                <Chevron className="hub-chev" />
              </Link>
            ))}
          </section>

        </div>
      </div>

      <SuggestionModal
        open={askOpen}
        onClose={() => setAskOpen(false)}
        title={props.requestTitle}
        intro={props.requestPrompt}
      />
    </div>
  )
}
