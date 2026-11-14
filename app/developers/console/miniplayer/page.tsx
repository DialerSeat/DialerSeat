import type { Metadata } from 'next'
import { PageHead } from '@/components/developers/ConsoleShell'
import { CodeBlock } from '@/components/developers/ui'
import { OriginsEditor } from '@/components/developers/console/OriginsEditor'
import { TryMiniplayer } from '@/components/developers/console/TryMiniplayer'
import { consoleContext, devBase } from '@/lib/developers/server'
import { devStore } from '@/lib/developers/store'
import { EMBED_SRC } from '@/lib/developers/catalog'

export const metadata: Metadata = { title: 'Miniplayer' }
export const dynamic = 'force-dynamic'

export default async function MiniplayerPage() {
  const { platform } = await consoleContext()
  const base = await devBase()
  const keys = await devStore().listKeys(platform.id)
  const pk = keys.find(k => k.kind === 'publishable' && k.env === 'test' && !k.revoked_at)
  const snippet = `<script src="${EMBED_SRC}" data-key="${pk?.token || 'dpk_test_…'}"></script>
<div id="dialer" style="width:380px;height:640px"></div>
<script>
  // SESSION_TOKEN comes from POST /v1/seats/{id}/sessions on your server
  const dialer = DialerSeat.mount('#dialer', {
    session: SESSION_TOKEN,
    campaign: 'your_campaign_id',
    leads: [{ external_id: 'c_5501', first_name: 'Dana', phone: '+15125550142' }],
    theme: 'dark',
  })
  dialer.on('disposition', (e) => {
    // e.code is your own disposition code, e.lead.external_id your record
  })
</script>`
  return (
    <>
      <PageHead title="Miniplayer" sub="The portable DialerSeat dialer: the lead queue, call controls and your disposition picker in one panel on your page. Paste the snippet, allow your origins, and sign each user in with a session." />
      <div className="dv-stack">
        <TryMiniplayer />
        <p className="dv-help" style={{ marginTop: -4 }}>Want to see every API request too? Open the <a className="dv-link" href={base + '/playground'}>playground</a>.</p>

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
                <li>The lead queue your page passes in, with the dial mode your policy allows for this seat and campaign.</li>
                <li>Call controls (mute, hold, hang up), answering-machine detection, and auto-advance with a pause.</li>
                <li>Your disposition list, with Skip always last, and agent notes, sent back to you by webhook and to your page as an event.</li>
                <li>The right screen when a seat cannot dial yet: its paid days ended, it is waiting for you, or live dialing is off.</li>
              </ul>
            </div>
          </div>
        </div>

    </>
  )
}
