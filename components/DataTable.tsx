'use client'

import React from 'react'

// ─────────────────────────────────────────────────────────────────────────
// A TABLE THAT DOES NOT CARE HOW BIG THE DATA IS
//
// Every list in this product was built the same way — fetch everything, render
// everything — which works until it silently does not. Supabase truncates a
// select at 1,000 rows without erroring, and a browser asked to lay out 10,000
// rows of flex containers stops being interactive long before that.
//
// This assumes the opposite: the server holds the rows, this holds a page of
// them. It never sees the full set and never needs to.
//
// SCROLLS SIDEWAYS, NOT THE PAGE. Wide content lives inside its own overflow
// box with a sticky header, so a phone scrolls the table and the page stays
// put. A layout where reading column six moves the whole document is one people
// stop using on a phone entirely.
// ─────────────────────────────────────────────────────────────────────────

export interface Column<T> {
  key: string
  header: string
  /** Right-aligned, tabular figures. Numbers that do not line up cannot be
   *  compared down a column, which is most of why they are in a column. */
  numeric?: boolean
  width?: number
  render: (row: T) => React.ReactNode
}

export interface DataTableProps<T> {
  columns: Array<Column<T>>
  rows: T[]
  rowKey: (row: T) => string
  total: number
  page: number
  pageSize: number
  loading?: boolean
  search?: string
  onSearch?: (value: string) => void
  onPage?: (page: number) => void
  onRowClick?: (row: T) => void
  emptyMessage?: string
  searchPlaceholder?: string
  /** Rendered above the table, right of the search box. */
  actions?: React.ReactNode
  theme?: Partial<typeof DEFAULT_THEME>
}

const DEFAULT_THEME = {
  panel: '#232428',
  hairline: '#1a1b1e',
  text: '#f2f3f5',
  muted: '#949ba4',
  dim: '#80848e',
  accent: '#2563eb',
  surface: '#111214',
}

export default function DataTable<T>({
  columns, rows, rowKey, total, page, pageSize,
  loading, search, onSearch, onPage, onRowClick,
  emptyMessage = 'Nothing here yet.',
  searchPlaceholder = 'Search…',
  actions, theme,
}: DataTableProps<T>) {
  const T_ = { ...DEFAULT_THEME, ...(theme || {}) }
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)
  const minWidth = columns.reduce((n, c) => n + (c.width || 140), 0)

  return (
    <div>
      {(onSearch || actions) && (
        <div style={{
          display: 'flex', gap: 8, marginBottom: 10,
          alignItems: 'center', flexWrap: 'wrap',
        }}>
          {onSearch && (
            <input
              value={search ?? ''}
              onChange={e => onSearch(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                flex: 1, minWidth: 180, background: T_.surface, color: T_.text,
                border: `1px solid ${T_.hairline}`, borderRadius: 4,
                padding: '8px 11px', fontSize: 13, fontFamily: 'inherit',
              }}
            />
          )}
          {actions}
        </div>
      )}

      <div style={{
        border: `1px solid ${T_.hairline}`, borderRadius: 4,
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        background: T_.panel,
      }}>
        <table style={{
          width: '100%', minWidth, borderCollapse: 'separate', borderSpacing: 0,
        }}>
          <thead>
            <tr>
              {columns.map(c => (
                <th
                  key={c.key}
                  style={{
                    // Sticky, so scrolling 200 rows does not lose the labels —
                    // a column of bare numbers with the header scrolled off is
                    // a column of numbers nobody can read.
                    position: 'sticky', top: 0, zIndex: 1,
                    background: T_.surface,
                    textAlign: c.numeric ? 'right' : 'left',
                    fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
                    color: T_.muted, fontWeight: 700, whiteSpace: 'nowrap',
                    padding: '9px 12px', borderBottom: `1px solid ${T_.hairline}`,
                  }}
                >{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ padding: '22px 12px', color: T_.dim, fontSize: 13, textAlign: 'center' }}
                >
                  {loading ? 'Loading…' : emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map(r => (
                <tr
                  key={rowKey(r)}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {columns.map(c => (
                    <td
                      key={c.key}
                      style={{
                        padding: '10px 12px',
                        borderBottom: `1px solid ${T_.hairline}`,
                        fontSize: 13, color: T_.text,
                        textAlign: c.numeric ? 'right' : 'left',
                        fontVariantNumeric: c.numeric ? 'tabular-nums' : undefined,
                        whiteSpace: 'nowrap',
                      }}
                    >{c.render(r)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── ALWAYS SAY HOW MANY ────────────────────────────────────────────
          "1–50 of 8,431" is the difference between a list somebody trusts and
          one they suspect is hiding something. A paged table with no total is
          indistinguishable from a truncated one. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginTop: 10,
        flexWrap: 'wrap', fontSize: 12, color: T_.dim,
      }}>
        <span>
          {total === 0 ? 'No rows' : `${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}`}
        </span>
        <div style={{ flex: 1 }} />
        {onPage && pages > 1 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={() => onPage(Math.max(0, page - 1))}
              disabled={page === 0 || loading}
              style={{
                background: 'transparent', border: `1px solid ${T_.hairline}`,
                color: page === 0 ? T_.dim : T_.muted, borderRadius: 3,
                padding: '5px 11px', fontSize: 12, fontFamily: 'inherit',
                cursor: page === 0 ? 'not-allowed' : 'pointer',
              }}
            >Previous</button>
            <span style={{ color: T_.muted }}>
              {page + 1} / {pages.toLocaleString()}
            </span>
            <button
              onClick={() => onPage(page + 1)}
              disabled={page + 1 >= pages || loading}
              style={{
                background: 'transparent', border: `1px solid ${T_.hairline}`,
                color: page + 1 >= pages ? T_.dim : T_.muted, borderRadius: 3,
                padding: '5px 11px', fontSize: 12, fontFamily: 'inherit',
                cursor: page + 1 >= pages ? 'not-allowed' : 'pointer',
              }}
            >Next</button>
          </div>
        )}
      </div>
    </div>
  )
}
