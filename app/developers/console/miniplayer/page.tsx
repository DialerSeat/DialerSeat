import type { Metadata } from 'next'
import { PageHead } from '@/components/developers/ConsoleShell'
import { CodeBlock } from '@/components/developers/ui'
import { OriginsEditor } from '@/components/developers/console/OriginsEditor'
import { MiniplayerPreview } from '@/components/developers/console/MiniplayerPreview'
import { consoleContext } from '@/lib/developers/server'
import { devStore } from '@/lib/developers/store'
import { EMBED_SRC } from '@/lib/developers/catalog'

export const metadata: Metadata = { title: 'Miniplayer' }
export const dynamic = 'force-dynamic'

export default async function MiniplayerPage() {
  const { platform } = await consoleContext()
  const keys = await devStore().listKeys(platform.id)
  const pk = keys.find(k => k.kind === 'publishable' && k.env === 'test' && !k.revoked_at)
  const snippet = `<script src="${EMBED_SRC}" data-key="${pk?.token || 'pk_test_…'}"></script>
<div id="dialer" style="width:380px;height:640px"></div>
<script>
  // SESSION_TOKEN comes from POST /v1/seats/{id}/sessions on your server
  const dialer = DialerSeat.mount('#dialer', {
    session: SESSION_TOKEN,
    campaign: 'your_campaign_id',
    theme: 'dark',
  })
  dialer.on('disposition', (e) => {
    // e.code is your own disposition code, e.lead.external_id your record
  })
</script>`
  return (
    <>
      <PageHead title="Miniplayer" sub="The portable DialerSeat dialer: queue, call controls, script and your disposition picker in one panel on your page. Paste the snippet, allow your origins, and sign each user in with a session." />
      <div className="dv-mini" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: 24, alignItems: 'start' }}>
        <div className="dv-stack">
          <div className="dv-card" id="snippet">
            <div className="dv-card-head"><h2 className="dv-card-title">Embed snippet</h2><p className="dv-card-desc">Your test publishable key is already filled in. Swap in the live one when you go live.</p></div>
            <div className="dv-card-body"><CodeBlock lang="html" title="your-app.html" code={snippet} /></div>
          </div>
          <OriginsEditor initial={platform.allowed_origins} />
          <div className="dv-card">
            <div className="dv-card-head"><h2 className="dv-card-title">What the miniplayer handles</h2></div>
            <div className="dv-card-body">
              <ul className="dv-muted" style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.9 }}>
                <li>Signing the seat in from the session token. No DialerSeat login prompt inside your app.</li>
                <li>Checkout for user-billed seats that have not paid yet, by the week.</li>
                <li>The dial mode your policy allows for this seat and campaign.</li>
                <li>Microphone permission, call audio, mute, hold and hang-up.</li>
                <li>Your disposition list, and your script for the campaign.</li>
              </ul>
            </div>
          </div>
        </div>
        <div style={{ position: 'sticky', top: 80 }}>
          <div className="dv-dim" style={{ fontSize: 12, marginBottom: 8, letterSpacing: .4 }}>PREVIEW · illustrative, nothing here is a real call</div>
          <MiniplayerPreview />
        </div>
      </div>
      <style>{`@media (max-width: 1100px) { .dv-mini { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>
    </>
  )
}
