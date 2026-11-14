'use client'

// =============================================================================
// NEW PROJECT — a name, then one question per screen as a grid of bubbles
// =============================================================================
// The answers are stored on the project (dev_platforms.profile) and decide
// what setup shows first: the integration approach picks the code, the dial
// modes picked become the project's allowed modes, and the billing answer
// decides whether setup leads with the Stripe hookup or the API call.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, TriangleAlert } from 'lucide-react'
import { SURVEY, type SurveyQuestion } from '@/lib/developers/survey'
import { DevLink, useDevHref } from './base'
import { DevLogo, api } from './ui'
import { ThemeToggle } from './theme'

type Answers = Record<string, string | string[]>

/** Where the setup page picks up the one-time secret key after the redirect. */
export const NEW_KEYS_STORAGE = 'dv-new-project-keys'

export function ProjectSurvey({ first }: { first: boolean }) {
  const router = useRouter()
  const href = useDevHref()
  const [step, setStep] = useState(0) // 0 = name, 1..SURVEY.length = questions
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [answers, setAnswers] = useState<Answers>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A click that lands just after a question changes belongs to the last
  // question (a quick double click), so it is ignored.
  const shownAt = useRef(0)
  useEffect(() => { shownAt.current = performance.now() }, [step])
  const settled = () => performance.now() - shownAt.current > 250

  const total = SURVEY.length + 1
  const q: SurveyQuestion | null = step > 0 ? SURVEY[step - 1] : null
  const last = step === SURVEY.length
  const picked = q ? answers[q.key] : undefined
  const hasAnswer = q ? (Array.isArray(picked) ? picked.length > 0 : !!picked) : name.trim().length > 0

  const toggle = (id: string) => {
    if (!q) return
    setAnswers(a => {
      if (!q.multi) return { ...a, [q.key]: id }
      const cur = Array.isArray(a[q.key]) ? (a[q.key] as string[]) : []
      return { ...a, [q.key]: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] }
    })
  }

  const create = async () => {
    setBusy(true); setError(null)
    try {
      const r = await api<{ project: { id: string }; secret_key: string; publishable_key: string }>('/api/developers/projects', { method: 'POST', body: { name, website, answers } })
      try { sessionStorage.setItem(NEW_KEYS_STORAGE, JSON.stringify({ project: r.project.id, secret_key: r.secret_key, publishable_key: r.publishable_key })) } catch { /* setup offers a new key instead */ }
      router.push(href('/console/setup'))
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setBusy(false)
    }
  }

  const next = () => {
    if (step === 0 && !name.trim()) return
    if (last) void create()
    else setStep(s => s + 1)
  }

  // Single-choice questions move on as soon as a bubble is picked.
  const pickSingle = (id: string) => {
    toggle(id)
    if (q && !q.multi && !last) setTimeout(() => setStep(s => s + 1), 220)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement) && hasAnswer && !busy) { e.preventDefault(); next() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const pct = useMemo(() => Math.round((step / total) * 100), [step, total])

  return (
    <main className="dv-app" style={{ minHeight: '100vh', background: 'var(--dv-bg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--dv-border-soft)' }}>
        <DevLogo />
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ThemeToggle />
          {!first && <DevLink href="/console" className="dv-btn dv-btn-ghost dv-btn-sm">Cancel</DevLink>}
        </span>
      </header>
      <div style={{ height: 3, background: 'var(--dv-border-soft)' }} aria-hidden>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--dv-accent)', transition: 'width .25s' }} />
      </div>

      <div style={{ flex: 1, width: '100%', maxWidth: 860, margin: '0 auto', padding: 'clamp(28px, 6vw, 64px) 16px 48px' }}>
        <div className="dv-dim" style={{ fontSize: 13, marginBottom: 10 }}>
          {first ? 'Your first project' : 'New project'} · Step {step + 1} of {total}
        </div>

        {step === 0 ? (
          <form onSubmit={e => { e.preventDefault(); next() }}>
            <h1 className="dv-survey-title">Name your project</h1>
            <p className="dv-sub" style={{ marginBottom: 28 }}>One project per product or client. Each has its own keys, seats, calls and billing. You can rename it later.</p>
            <div className="dv-grid-2">
              <div>
                <label className="dv-label" htmlFor="pname">Project name</label>
                <input id="pname" className="dv-input" value={name} onChange={e => setName(e.target.value)} placeholder="Acme CRM" maxLength={80} autoFocus required />
              </div>
              <div>
                <label className="dv-label" htmlFor="pweb">Website <span className="dv-dim">(optional)</span></label>
                <input id="pweb" className="dv-input" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://acme.com" maxLength={200} />
              </div>
            </div>
          </form>
        ) : q && (
          <div>
            <h1 className="dv-survey-title">{q.title}</h1>
            <p className="dv-sub" style={{ marginBottom: 28 }}>{q.sub}{q.multi ? ' Pick as many as you like.' : ''}</p>
            <div className="dv-bubbles" role={q.multi ? 'group' : 'radiogroup'} aria-label={q.title}>
              {q.options.map(o => {
                const on = Array.isArray(picked) ? picked.includes(o.id) : picked === o.id
                const best = (o as { best?: string }).best
                return (
                  <button key={o.id} type="button" className="dv-bubble" aria-pressed={on} role={q.multi ? undefined : 'radio'} aria-checked={q.multi ? undefined : on}
                    onClick={() => { if (settled()) { if (q.multi) toggle(o.id); else pickSingle(o.id) } }}>
                    <span className="dv-bubble-check" aria-hidden>{on && <Check size={12} strokeWidth={3} />}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 500 }}>{o.label}</span>
                      {o.hint && <span className="dv-dim" style={{ display: 'block', fontSize: 12.5, marginTop: 3, lineHeight: 1.45 }}>{o.hint}</span>}
                      {best && <span style={{ display: 'block', fontSize: 12, marginTop: 6, color: 'var(--dv-accent)' }}>{best}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {error && <div className="dv-alert dv-alert-amber" style={{ marginTop: 20 }}><TriangleAlert size={16} color="var(--dv-amber)" />{error}</div>}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
          <button type="button" className="dv-btn dv-btn-ghost" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0 || busy} style={{ visibility: step === 0 ? 'hidden' : undefined }}>
            <ArrowLeft size={15} /> Back
          </button>
          <span style={{ display: 'flex', gap: 8 }}>
            {step > 0 && !hasAnswer && !last && <button type="button" className="dv-btn dv-btn-ghost" onClick={() => setStep(s => s + 1)}>Skip</button>}
            <button type="button" className="dv-btn dv-btn-primary dv-btn-lg" onClick={next} disabled={busy || (step === 0 && !name.trim())}>
              {last ? (busy ? 'Creating…' : <>Create project <ArrowRight size={16} /></>) : <>Continue <ArrowRight size={16} /></>}
            </button>
          </span>
        </div>
      </div>
      <style>{`
        .dv-survey-title { font-size: clamp(24px, 3.4vw, 32px); font-weight: 600; letter-spacing: -.3px; margin: 0; }
        .dv-bubbles { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr)); gap: 10px; }
        .dv-bubble { display: flex; align-items: flex-start; gap: 12px; text-align: left; padding: 14px 16px; min-height: 56px; border-radius: 12px; border: 1px solid var(--dv-border); background: var(--dv-panel); color: var(--dv-text); font: 14px var(--dv-ui); cursor: pointer; transition: border-color .12s, background .12s; }
        .dv-bubble:hover { border-color: var(--dv-hover-border); background: var(--dv-panel-2); }
        .dv-bubble[aria-pressed="true"] { border-color: var(--dv-accent); background: var(--dv-accent-soft); }
        .dv-bubble-check { flex-shrink: 0; width: 18px; height: 18px; margin-top: 1px; border-radius: 50%; border: 1.5px solid var(--dv-border); display: inline-flex; align-items: center; justify-content: center; color: #fff; }
        .dv-bubble[aria-pressed="true"] .dv-bubble-check { background: var(--dv-accent); border-color: var(--dv-accent); }
      `}</style>
    </main>
  )
}
