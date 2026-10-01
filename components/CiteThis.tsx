'use client'

import { useState } from 'react'

// =============================================================================
// CITE THIS — the attribution box on every data page and tool
// =============================================================================
// A page earns a backlink when someone who wants to use it finds the link
// already written for them. Journalists, bloggers and trainers who quote a
// number or embed a calculator will usually credit the source if crediting it
// is one click; if they have to build the link themselves, most do not.
//
// So every citable page ends with the exact HTML to paste: a plain link for a
// citation, and for the tools an iframe embed whose credit line links back.
// The anchor text is the page's subject, not "DialerSeat", because a link that
// describes what it points to is worth more to the page it points to.
// =============================================================================

function CopyField({ id, label, value }: { id: string; label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard can be refused (older browsers, embedded views). Selecting
      // the text leaves the visitor one keystroke from copying it themselves.
      const el = document.getElementById(id) as HTMLTextAreaElement | null
      el?.select()
    }
  }

  return (
    <div className="cite-field">
      <div className="cite-row">
        <label htmlFor={id}>{label}</label>
        <button type="button" onClick={copy} className="cite-copy">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <textarea id={id} readOnly value={value} rows={value.length > 160 ? 4 : 2} onFocus={(e) => e.currentTarget.select()} />
    </div>
  )
}

export default function CiteThis({
  title,
  path,
  embedPath,
  embedHeight = 620,
}: {
  /** What the page is, used as the link text. */
  title: string
  /** The page's own path, e.g. /data/connect-rates. */
  path: string
  /** For tools: the /embed/... path that renders the tool without site chrome. */
  embedPath?: string
  embedHeight?: number
}) {
  const url = `https://dialerseat.com${path}`
  const link = `<a href="${url}">${title}</a> (DialerSeat)`
  const embed = embedPath
    ? `<iframe src="https://dialerseat.com${embedPath}" title="${title}" width="100%" height="${embedHeight}" style="border:1px solid #d6dbe3;border-radius:10px" loading="lazy"></iframe>\n<p style="font-size:12px">${title} by <a href="${url}">DialerSeat</a></p>`
    : null

  return (
    <div className="cite-box">
      <style>{`
        .cite-box {
          margin-top: 24px; text-align: start; border-radius: 10px; padding: 22px 24px;
          background: rgba(42,110,255,0.05); border: 1px solid rgba(42,110,255,0.22);
        }
        .cite-box h3 { margin: 0 0 6px; font-size: 15px; }
        .cite-copy {
          background: none; border: none; padding: 0; cursor: pointer; font: inherit; font-size: 13px;
          color: #2a6eff; font-weight: 600; text-decoration: underline; text-underline-offset: 3px;
        }
        .cite-box > p { font-size: 13.5px; }
        .cite-field { margin-top: 14px; }
        .cite-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 6px; }
        .cite-row label { font-size: 10px; font-weight: bold; letter-spacing: 2px; color: inherit; opacity: 0.7; }
        .cite-field textarea {
          width: 100%; resize: vertical; font-family: ui-monospace, Menlo, Consolas, monospace;
          font-size: 12px; line-height: 1.5; padding: 10px 12px; border-radius: 8px;
          border: 1px solid rgba(42,110,255,0.25); background: #fff; color: #1a1c24;
        }
      `}</style>
      <h3>{embedPath ? 'Use this tool on your site' : 'Cite this page'}</h3>
      <p>
        Free to quote, link and {embedPath ? 'embed' : 'reference'}. Please credit the source with a
        link. The HTML is ready to paste.
      </p>
      <CopyField id={`cite-link-${path}`} label="LINK" value={link} />
      {embed && <CopyField id={`cite-embed-${path}`} label="EMBED" value={embed} />}
    </div>
  )
}
