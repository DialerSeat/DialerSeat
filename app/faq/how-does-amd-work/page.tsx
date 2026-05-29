import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import DialingModeCTA from '@/components/DialingModeCTA'
import ExplainerStyles from '@/components/ExplainerStyles'
import ExplainerCrossLinks from '@/components/ExplainerCrossLinks'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'How Does AMD Work? Answering Machine Detection Explained | DialerSeat',
  description:
    'AMD listens to the pickup of an outbound call and decides whether it\'s a human or a voicemail greeting. Done right, it can double your talk time per hour. Here\'s how DialerSeat\'s AMD works.',
  alternates: { canonical: 'https://dialerseat.com/faq/how-does-amd-work' },
  openGraph: {
    title: 'How Does AMD Work?',
    description:
      'Answering Machine Detection — what it is, how accurate it is, and how DialerSeat handles it.',
    url: 'https://dialerseat.com/faq/how-does-amd-work',
    type: 'article',
  },
}

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="exp-root">
        <ExplainerStyles accent="#2a4a8a" accentBg="#e8eef8" />

        <section className="exp-hero">
          <div className="exp-hero-inner">
            <Link href="/faq" className="exp-breadcrumb">← BACK TO FAQ</Link>
            <div className="exp-eyebrow">EXPLAINER · AMD</div>
            <h1>How does AMD work?</h1>
            <p className="exp-lead">
              Answering Machine Detection listens to a phone pickup and
              decides whether you&apos;re about to talk to a human or a
              voicemail. When it works well, it doubles your real talk
              time per hour.
            </p>
          </div>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ THE SHORT VERSION</div>
          <h2>It listens for about a second and a half.</h2>
          <p>
            When an outbound call connects, AMD does <em>not</em> connect
            you to the line immediately. Instead, the system holds the
            audio for roughly 1–2 seconds and analyzes what comes through.
            Humans tend to answer with a quick &quot;hello?&quot; — usually
            under 1.5 seconds of audio, with a clear pause afterward
            waiting for a response.
          </p>
          <p>
            Voicemail greetings sound different. They&apos;re longer,
            usually 4–15 seconds, run as a continuous monologue, and end
            with a beep. AMD looks at the duration of the initial speech,
            the pauses, the frequency profile, and (in modern systems)
            machine-learned signatures of common voicemail-greeting
            patterns. When the math says &quot;machine,&quot; the call
            drops before you ever pick up.
          </p>
        </section>

        <section className="exp-section alt">
          <div className="inner">
            <div className="exp-section-label">▸ COMMON QUESTIONS</div>
            <h2>The stuff people ask about AMD.</h2>

            <div className="exp-qa">
              <details>
                <summary>How accurate is AMD?</summary>
                <div className="answer">
                  <p>
                    Modern AMD on a clean carrier path is around 90–95%
                    accurate. The remaining 5–10% splits between two kinds
                    of error: <strong>false positives</strong> (AMD thinks
                    a human is a voicemail and drops the call you wanted)
                    and <strong>false negatives</strong> (AMD thinks a
                    voicemail is a human and connects you to the
                    greeting).
                  </p>
                  <p>
                    False positives are the painful ones — you just missed
                    a connect. False negatives are mildly annoying but
                    survivable; you hang up and the queue advances.
                  </p>
                </div>
              </details>

              <details>
                <summary>Doesn&apos;t the &quot;hello? ... hello?&quot; delay annoy people?</summary>
                <div className="answer">
                  <p>
                    Yes, sometimes. There&apos;s a noticeable beat between
                    when the human says &quot;hello&quot; and when the
                    agent comes on the line — that&apos;s AMD doing its
                    work. On lower-quality carrier paths it can be 2+
                    seconds, which is enough to make people hang up.
                  </p>
                  <p>
                    On DialerSeat, AMD runs through SignalWire&apos;s
                    native detection, which is tuned for speed and gets
                    most calls to about 1.2 seconds of analysis. That&apos;s
                    short enough that most humans wait, but it&apos;s never
                    going to be zero. It&apos;s a trade-off.
                  </p>
                </div>
              </details>

              <details>
                <summary>How does DialerSeat&apos;s AMD work specifically?</summary>
                <div className="answer">
                  <p>
                    We use SignalWire&apos;s native AMD, which is built on
                    top of their carrier-grade telephony infrastructure. It
                    classifies every pickup into one of six outcomes:
                    <code> machine_start</code>, <code>machine_end_beep</code>,
                    <code> machine_end_silence</code>, <code>machine_end_other</code>,
                    <code> fax</code>, or <code>unknown</code>. Anything
                    classified as machine drops server-side; your screen
                    never lights up.
                  </p>
                  <p>
                    Every AMD result is stored on the call record — so you
                    can audit AMD accuracy on your own campaigns later by
                    pulling the analytics.
                  </p>
                </div>
              </details>

              <details>
                <summary>When does AMD actually fire on DialerSeat?</summary>
                <div className="answer">
                  <p>
                    By default: progressive and predictive modes get AMD
                    on automatically. Power and preview don&apos;t — in
                    those modes you&apos;re expected to deal with
                    voicemails yourself (and many agents prefer that
                    because they want to leave a voicemail).
                  </p>
                  <p>
                    You can override the default per-campaign in campaign
                    settings if you want AMD on for power mode or off for
                    progressive.
                  </p>
                </div>
              </details>

              <details>
                <summary>What happens to calls that AMD drops?</summary>
                <div className="answer">
                  <p>
                    They get logged with a disposition of <code>NO_ANSWER_AMD</code>
                    and the queue advances to the next lead automatically.
                    Your agent never sees them — that&apos;s the whole
                    point.
                  </p>
                  <p>
                    The lead doesn&apos;t get permanently removed from
                    your list — AMD-dropped calls are typically retried
                    later based on your campaign&apos;s retry rules.
                  </p>
                </div>
              </details>

              <details>
                <summary>Can I see why a specific call was dropped?</summary>
                <div className="answer">
                  <p>
                    Yes. Every call record includes the AMD result (which
                    of the six outcomes triggered) along with timing
                    info. Pull it up in the calls log in your dashboard
                    or export it for analysis.
                  </p>
                </div>
              </details>

              <details>
                <summary>Are voicemail drops a separate feature?</summary>
                <div className="answer">
                  <p>
                    Yes — different feature, related concept. AMD <em>detects</em>
                    voicemails. Voicemail drops <em>play a pre-recorded
                    message into</em> a voicemail once detected. We support
                    voicemail drops as an opt-in per-campaign setting.
                    By default it&apos;s off because, well, it&apos;s an
                    aggressive practice that doesn&apos;t suit every
                    industry.
                  </p>
                </div>
              </details>

              <details>
                <summary>Is AMD compliant with TCPA / TSR?</summary>
                <div className="answer">
                  <p>
                    AMD itself doesn&apos;t change your compliance picture.
                    The compliance rules apply to the act of placing the
                    call, not to whether you connect to a human or a
                    machine afterward.
                  </p>
                  <p>
                    AMD is, however, what makes <Link href="/faq/what-is-a-progressive-dialer">progressive
                    mode</Link> work as a higher-throughput alternative
                    to power, without triggering the FTC&apos;s 3% abandon
                    cap. See the <Link href="/faq/why-is-compliance-important">compliance
                    page</Link> for more.
                  </p>
                </div>
              </details>
            </div>
          </div>
        </section>

        <ExplainerCrossLinks current="amd" />

        <DialingModeCTA
          headline="Stop listening to voicemail greetings."
          description="AMD filters out machines before they reach your headset. Run progressive or predictive on a noisy list and feel the difference. $35/week per seat."
        />
      </main>
      <SiteFooter />
    </>
  )
}