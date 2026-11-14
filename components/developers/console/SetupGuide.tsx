'use client'

// =============================================================================
// SETUP — the guided path for one project, from keys to a first test call
// =============================================================================
// Opens straight after the project survey. The secret key made with the
// project is shown here once (handed over through sessionStorage, then
// cleared). The integration approach picked in the survey chooses the code;
// it can be switched here. Each step's tick comes from real data.
// =============================================================================

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, CircleCheck, ExternalLink, KeyRound } from 'lucide-react'
import { APPROACHES } from '@/lib/developers/survey'
import { frontSnippet, needsOrigins, serverSnippet } from '@/lib/developers/snippets'
import type { Approach, ProjectProfile } from '@/lib/developers/store'
import { DevLink, useDevHref } from '../base'
import { CodeBlock, CopyButton, api, useToast } from '../ui'
import { OriginsEditor } from './OriginsEditor'
import { TryMiniplayer } from './TryMiniplayer'
import { NEW_KEYS_STORAGE } from '../ProjectSurvey'

interface State { secretKey: boolean; seat: boolean; call: boolean; webhook: boolean; billing: boolean }

function readNewKeys(projectId: string): { secret_key: string; publishable_key: string } | null {
  try {
    const raw = sessionStorage.getItem(NEW_KEYS_STORAGE)
    if (!raw) return null
    const v = JSON.parse(raw) as { project: string; secret_key: string; publishable_key: string }
    return v.project === projectId ? v : null
  } catch { return null }
}

export function SetupGuide({ project, publishableKey, state }: {
  project: { id: string; name: string; approach: Approach; profile: ProjectProfile; done: boolean; origins: string[] }
  publishableKey: string
  state: State
}) {
  const router = useRouter()
  const href = useDevHref()
  const { toast, toastNode } = useToast()
  const [approach, setApproach] = useState<Approach>(project.approach)
  const [keys, setKeys] = useState<{ secret_key: string; publishable_key: string } | null>(null)
  const [saved, setSaved] = useState(false)

  // The one-time key arrives from the survey through sessionStorage, which only
  // exists in the browser, so it is read after mount.
  useEffect(() => {
    const k = readNewKeys(project.id)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (k) setKeys(k)
  }, [project.id])

  const forget = () => { try { sessionStorage.removeItem(NEW_KEYS_STORAGE) } catch { /* ignore */ } setKeys(null) }

  const choose = async (a: Approach) => {
    setApproach(a)
    try { await api('/api/developers/platform', { method: 'PATCH', body: { integration_approach: a } }) } catch { /* the choice still shows */ }
  }
  const finish = async () => {
    try { await api('/api/developers/platform', { method: 'PATCH', body: { setup_completed: true } }); toast('Setup marked complete'); router.push(href('/console')); router.refresh() }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not save.') }
  }

  const front = frontSnippet(approach, publishableKey)
  const originsNeeded = needsOrigins(approach)
  const billsOnStripe = project.profile.billing === 'stripe_subscription'

  const steps: { id: string; title: string; done: boolean; body: React.ReactNode }[] = [
    {
      id: 'keys', title: 'Your test keys', done: state.secretKey && !keys,
      body: keys ? (
        <div>
          <div className="dv-alert dv-alert-amber" style={{ marginBottom: 12 }}><AlertTriangle size={16} color="var(--dv-amber)" /> Copy the secret key now. It is shown this once and never again.</div>
          <KeyRow label="Secret key (your server only)" value={keys.secret_key} secret />
          <KeyRow label="Publishable key (safe in the browser)" value={keys.publishable_key} />
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, marginTop: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#2a6eff' }} />
            I saved the secret key somewhere safe
          </label>
          <button type="button" className="dv-btn dv-btn-primary" style={{ marginTop: 12 }} disabled={!saved} onClick={forget}>Done, hide it</button>
        </div>
      ) : (
        <p className="dv-muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>
          {state.secretKey ? 'This project has a test secret key. ' : 'This project has no test secret key yet. '}
          Secret keys are shown only when made. Make another any time in <DevLink className="dv-link" href="/console/api-keys">API keys</DevLink>. Put it in your server&apos;s environment as <code className="dv-inline-code">DIALERSEAT_SECRET_KEY</code>.
        </p>
      ),
    },
    {
      id: 'approach', title: 'How the dialer goes into your app', done: true,
      body: (
        <div className="dv-approaches">
          {APPROACHES.map(a => (
            <button key={a.id} type="button" className="dv-approach" aria-pressed={approach === a.id} onClick={() => choose(a.id)}>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontWeight: 600 }}>{a.label}{approach === a.id && <Check size={15} color="var(--dv-accent)" />}</span>
              <span className="dv-muted" style={{ fontSize: 12.5, lineHeight: 1.45 }}>{a.hint}</span>
              <span style={{ fontSize: 12, color: 'var(--dv-accent)' }}>{a.best}</span>
            </button>
          ))}
        </div>
      ),
    },
    {
      id: 'server', title: 'On your server: a seat and a session', done: state.seat,
      body: (
        <>
          <p className="dv-muted" style={{ marginTop: 0, fontSize: 13.5, lineHeight: 1.6 }}>Each of your users who dials gets a seat, keyed on your own user id. Each time the dialer opens, your server makes a one-use session for that seat. Nobody logs in twice.</p>
          <CodeBlock lang="js" title="server.js" code={serverSnippet(approach)} />
        </>
      ),
    },
    {
      id: 'front', title: approach === 'headless' ? 'Receive the results' : 'In your app: open the dialer', done: state.call,
      body: (
        <>
          <p className="dv-muted" style={{ marginTop: 0, fontSize: 13.5, lineHeight: 1.6 }}>{front.note}</p>
          <CodeBlock lang={front.lang} title={front.title} code={front.code} />
        </>
      ),
    },
    ...(originsNeeded ? [{
      id: 'origins', title: 'Allow the sites that load the dialer', done: project.origins.length > 0,
      body: <OriginsEditor initial={project.origins} />,
    }] : []),
    {
      id: 'webhooks', title: 'Get every result back', done: state.webhook,
      body: (
        <p className="dv-muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>
          Add an endpoint and choose events: <code className="dv-inline-code">call.dispositioned</code> carries your own disposition code (<code className="dv-inline-code">SKIP</code> when the agent skipped), and <code className="dv-inline-code">subscription.recorded</code> confirms each seat you billed. <DevLink className="dv-link" href="/console/webhooks">Add a webhook endpoint</DevLink>.
        </p>
      ),
    },
    {
      id: 'billing', title: 'Tell DialerSeat when a user pays you', done: state.billing,
      body: (
        <p className="dv-muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>
          {billsOnStripe
            ? <>You bill on Stripe, so the quickest way is to forward your Stripe webhook: paid invoices activate seats with no code. </>
            : <>Call <code className="dv-inline-code">POST /v1/subscriptions</code> when a user signs up or renews. </>}
          Their seat dials for the period they paid for, and DialerSeat&apos;s cut goes on your balance. <DevLink className="dv-link" href="/console/billing#signups">{billsOnStripe ? 'Connect Stripe' : 'See the call'}</DevLink>, or press Simulate a signup on the Billing page to watch it happen.
        </p>
      ),
    },
    {
      id: 'test', title: 'Make a test call', done: state.call,
      body: (
        <>
          <p className="dv-muted" style={{ marginTop: 0, fontSize: 13.5, lineHeight: 1.6 }}>Nothing is really dialled. The last digit decides what happens: 0 to 6 a person answers, 7 voicemail, 8 no answer, 9 busy.</p>
          <TryMiniplayer />
        </>
      ),
    },
  ]
  const doneCount = steps.filter(s => s.done).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 className="dv-h1">Set up {project.name}</h1>
          <p className="dv-sub">Everything below works in test mode. Nothing dials for real until live dialing is on.</p>
        </div>
        <div style={{ minWidth: 220 }}>
          <div className="dv-dim" style={{ fontSize: 12.5, marginBottom: 6 }}>{doneCount} of {steps.length} done</div>
          <div style={{ height: 6, borderRadius: 999, background: 'var(--dv-border-soft)', overflow: 'hidden' }}>
            <div style={{ width: `${(doneCount / steps.length) * 100}%`, height: '100%', background: 'var(--dv-accent)' }} />
          </div>
        </div>
      </div>

      <ol className="dv-steps">
        {steps.map((s, i) => (
          <li key={s.id} id={s.id} className="dv-step">
            <span className={`dv-step-n${s.done ? ' done' : ''}`} aria-label={s.done ? 'Done' : `Step ${i + 1}`}>{s.done ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
            <div className="dv-card" style={{ flex: 1, minWidth: 0 }}>
              <div className="dv-card-head"><h2 className="dv-card-title">{s.title}</h2></div>
              <div className="dv-card-body">{s.body}</div>
            </div>
          </li>
        ))}
      </ol>

      <div className="dv-card" style={{ marginTop: 20, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <CircleCheck size={22} color={project.done ? 'var(--dv-green)' : 'var(--dv-dim)'} />
          <div>
            <div style={{ fontWeight: 600 }}>{project.done ? 'Setup is complete' : 'Finished?'}</div>
            <div className="dv-muted" style={{ fontSize: 13 }}>Next: request live dialing on the Billing page. The full guide is in the <DevLink className="dv-link" href="/docs/integration-approaches" target="_blank">integration docs <ExternalLink size={12} /></DevLink>.</div>
          </div>
        </div>
        {!project.done && <button type="button" className="dv-btn dv-btn-primary" onClick={finish}>Mark setup complete</button>}
      </div>
      {toastNode}
      <style>{`
        .dv-steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
        .dv-step { display: flex; gap: 14px; align-items: flex-start; }
        .dv-step-n { width: 28px; height: 28px; margin-top: 16px; border-radius: 50%; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; border: 1.5px solid var(--dv-border); color: var(--dv-muted); background: var(--dv-panel); }
        .dv-step-n.done { background: var(--dv-accent); border-color: var(--dv-accent); color: #fff; }
        .dv-approaches { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); gap: 10px; }
        .dv-approach { display: grid; gap: 6px; text-align: left; padding: 14px; border-radius: 10px; border: 1px solid var(--dv-border); background: var(--dv-panel); color: var(--dv-text); font: 14px var(--dv-ui); cursor: pointer; }
        .dv-approach:hover { border-color: var(--dv-hover-border); }
        .dv-approach[aria-pressed="true"] { border-color: var(--dv-accent); background: var(--dv-accent-soft); }
        @media (max-width: 640px) { .dv-step { gap: 8px; } .dv-step-n { width: 24px; height: 24px; margin-top: 14px; } }
      `}</style>
    </div>
  )
}

function KeyRow({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="dv-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><KeyRound size={13} /> {label}</div>
      <div className="dv-inset" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 12px', borderColor: secret ? 'color-mix(in srgb, var(--dv-amber) 40%, transparent)' : undefined }}>
        <code style={{ flex: 1, fontSize: 13, overflowX: 'auto', whiteSpace: 'nowrap' }}>{value}</code>
        <CopyButton text={value} label="Copy" />
      </div>
    </div>
  )
}
