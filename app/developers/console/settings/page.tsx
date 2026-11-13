import type { Metadata } from 'next'
import { PageHead } from '@/components/developers/ConsoleShell'
import { PlatformForm } from '@/components/developers/console/PlatformForm'
import { CopyButton } from '@/components/developers/ui'
import { consoleContext, signedInEmail } from '@/lib/developers/server'

export const metadata: Metadata = { title: 'Settings' }
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const { platform } = await consoleContext()
  const email = await signedInEmail()
  return (
    <>
      <PageHead title="Settings" sub="Your platform's details, and how this account relates to dialerseat.com." />
      <div className="dv-stack">
        <PlatformForm name={platform.name} website={platform.website} />

        <div className="dv-card">
          <div className="dv-card-head"><h2 className="dv-card-title">Platform details</h2></div>
          <div className="dv-card-body" style={{ display: 'grid', gap: 12 }}>
            {[
              ['Platform id', platform.id],
              ['Slug', platform.slug],
              ['Owner', email || '—'],
              ['Developer account since', new Date(platform.activated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })],
            ].map(([k, v]) => (
              <div key={k} className="dv-row" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--dv-border-soft)', paddingBottom: 10, gap: 16 }}>
                <span className="dv-dim" style={{ fontSize: 13 }}>{k}</span>
                <span className="dv-row" style={{ gap: 6 }}><code style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{v}</code>{k === 'Platform id' && <CopyButton text={v} />}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="dv-card" id="independent">
          <div className="dv-card-head"><h2 className="dv-card-title">Your dialerseat.com account</h2></div>
          <div className="dv-card-body dv-muted" style={{ fontSize: 14, lineHeight: 1.7 }}>
            <p style={{ margin: 0 }}>You sign in to both with the same login, but they are separate accounts:</p>
            <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
              <li>A dialerseat.com subscription does not switch on live dialing here.</li>
              <li>This developer account does not give you a dialer on dialerseat.com, and does not change one you already have.</li>
              <li>You can subscribe to your own dialer on dialerseat.com and own your own teams there, as anyone can.</li>
            </ul>
          </div>
        </div>

        <div className="dv-card">
          <div className="dv-card-head"><h2 className="dv-card-title">Close this developer account</h2><p className="dv-card-desc">Email support with your platform id. Keys are revoked and seats disabled. Your dialerseat.com account is not touched.</p></div>
          <div className="dv-card-body"><a className="dv-btn dv-btn-danger" href={`mailto:support@dialerseat.com?subject=${encodeURIComponent('Close developer account ' + platform.id)}`}>Email support to close it</a></div>
        </div>
      </div>
    </>
  )
}
