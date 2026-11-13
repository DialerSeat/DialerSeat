import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Info } from 'lucide-react'
import { DOCS, docBySlug, type Block } from '@/lib/developers/docs'
import { DevLink } from '@/components/developers/base'
import { CodeBlock } from '@/components/developers/ui'

export function generateStaticParams() {
  return DOCS.map(d => ({ slug: d.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = docBySlug((await params).slug)
  if (!d) return {}
  return { title: d.title, description: d.summary, alternates: { canonical: `https://dev.dialerseat.com/docs/${d.slug}` } }
}

/** Inline `code` in prose becomes a code span; everything else is plain text. */
function Prose({ text }: { text: string }) {
  const parts = text.split(/(\b(?:GET|POST|PATCH|DELETE) \/[\w/{}.-]+|\b(?:sk|pk)_(?:test|live)_\b|\b[a-z]+\.[a-z_]+\b(?=[:\s,.]|$)|\bDialerSeat-Signature\b|\bAuthorization\b|\bIdempotency-Key\b|\bexternal_(?:user_)?id\b|\bbilled_to\b)/g)
  return <>{parts.map((p, i) => (i % 2 === 1 ? <code key={i} className="dv-inline-code">{p}</code> : <span key={i}>{p}</span>))}</>
}

function Render({ b }: { b: Block }) {
  switch (b.t) {
    case 'h': return <h2 id={b.id} style={{ fontSize: 21, fontWeight: 600, margin: '38px 0 12px', scrollMarginTop: 110 }}>{b.text}</h2>
    case 'p': return <p style={{ fontSize: 15.5, lineHeight: 1.75, color: '#c8c8dc', margin: '0 0 16px' }}><Prose text={b.text} /></p>
    case 'list': return <ul style={{ fontSize: 15, lineHeight: 1.75, color: '#c8c8dc', margin: '0 0 16px', paddingLeft: 20 }}>{b.items.map(i => <li key={i} style={{ marginBottom: 6 }}><Prose text={i} /></li>)}</ul>
    case 'code': return <div style={{ margin: '0 0 18px' }}><CodeBlock code={b.code} lang={b.lang} title={b.title} /></div>
    case 'note': return <div className="dv-alert dv-alert-blue" style={{ margin: '0 0 16px' }}><Info size={16} color="var(--dv-accent)" style={{ flexShrink: 0, marginTop: 2 }} /><span><Prose text={b.text} /></span></div>
  }
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const doc = docBySlug(slug)
  if (!doc) notFound()
  const i = DOCS.indexOf(doc)
  const prev = DOCS[i - 1]
  const next = DOCS[i + 1]
  const headings = doc.blocks.filter((b): b is Extract<Block, { t: 'h' }> => b.t === 'h')

  return (
    <div className="dv-doc" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 200px', gap: 40 }}>
      <article style={{ minWidth: 0, maxWidth: 760 }}>
        <div style={{ fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: 'var(--dv-accent)', marginBottom: 10 }}>{doc.group}</div>
        <h1 style={{ fontSize: 34, fontWeight: 600, margin: '0 0 12px', letterSpacing: '-.4px' }}>{doc.title}</h1>
        <p className="dv-muted" style={{ fontSize: 17, lineHeight: 1.6, margin: '0 0 28px' }}>{doc.summary}</p>
        <hr className="dv-sep" style={{ marginBottom: 28 }} />
        {doc.blocks.map((b, k) => <Render key={k} b={b} />)}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 48, borderTop: '1px solid var(--dv-border-soft)', paddingTop: 24 }}>
          {prev ? <DevLink href={`/docs/${prev.slug}`} className="dv-card" style={{ padding: '14px 18px', flex: 1 }}><span className="dv-dim" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={13} /> Previous</span><span style={{ fontSize: 15 }}>{prev.title}</span></DevLink> : <span style={{ flex: 1 }} />}
          {next ? <DevLink href={`/docs/${next.slug}`} className="dv-card" style={{ padding: '14px 18px', flex: 1, textAlign: 'right' }}><span className="dv-dim" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>Next <ArrowRight size={13} /></span><span style={{ fontSize: 15 }}>{next.title}</span></DevLink>
            : <DevLink href="/docs/api" className="dv-card" style={{ padding: '14px 18px', flex: 1, textAlign: 'right' }}><span className="dv-dim" style={{ fontSize: 12 }}>Next</span><div style={{ fontSize: 15 }}>API reference</div></DevLink>}
        </div>
      </article>
      {headings.length > 0 && (
        <nav className="dv-toc" aria-label="On this page" style={{ position: 'sticky', top: 110, alignSelf: 'start', fontSize: 13 }}>
          <div className="dv-dim" style={{ fontSize: 11.5, letterSpacing: .5, textTransform: 'uppercase', marginBottom: 10 }}>On this page</div>
          <div style={{ display: 'grid', gap: 8, borderLeft: '1px solid var(--dv-border-soft)', paddingLeft: 12 }}>
            {headings.map(h => <a key={h.id} href={`#${h.id}`} className="dv-muted dv-docs-link" style={{ lineHeight: 1.4 }}>{h.text.replace(/^\d+\.\s*/, '')}</a>)}
          </div>
        </nav>
      )}
      <style>{`@media (max-width: 1150px) { .dv-doc { grid-template-columns: minmax(0, 1fr) !important; } .dv-toc { display: none; } }`}</style>
    </div>
  )
}
