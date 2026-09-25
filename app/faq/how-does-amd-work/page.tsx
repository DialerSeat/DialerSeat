import { breadcrumbSchema } from '@/lib/schema'
import JsonLd from '@/components/json-ld'
import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import DialingModeCTA from '@/components/DialingModeCTA'
import ExplainerStyles from '@/components/ExplainerStyles'
import GutsShell from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import ExplainerCrossLinks from '@/components/ExplainerCrossLinks'
import { primeLocale, t } from '@/lib/i18n/server'

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
      'Answering Machine Detection: what it is, how accurate it is, and how DialerSeat handles it.',
    url: 'https://dialerseat.com/faq/how-does-amd-work',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How Does AMD Work?',
    description: 'Answering Machine Detection: what it is, how accurate it is, and how DialerSeat handles it.',
  },
}

export default async function Page() {
  await primeLocale()
  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Faq', url: '/faq' },
        { name: 'How Does AMD Work? Answering Machine Detection Explained', url: '/faq/how-does-amd-work' },
      ])} />
      <>
      <SiteHeader />
      <GutsShell rail={faqRail('/faq/how-does-amd-work')} activeHref="/faq/how-does-amd-work">
      <div className="exp-root">
        <ExplainerStyles accent="#2a4a8a" accentBg="#e8eef8" />

        <section className="exp-hero">
          <div className="exp-hero-inner">            <div className="exp-eyebrow">{t("EXPLAINER · AMD")}</div>
            <span style={{ fontSize: 11, color: "#8888aa", letterSpacing: "2px", display: "block", marginBottom: 16 }}>{t("LAST UPDATED 07/28/2026")}</span>
            <h1>{t("How does AMD work?")}</h1>
            <p className="exp-lead">
              {t("Answering Machine Detection listens to a phone pickup and decides whether you're about to talk to a human or a voicemail. When it works well, it doubles your real talk time per hour.")}</p>
          </div>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">{t("▸ THE SHORT VERSION")}</div>
          <h2>{t("It listens for about a second and a half.")}</h2>
          <p>
            {t("When an outbound call connects, AMD does")}{" "}<em>{t("not")}</em> {t("connect you to the line immediately. Instead, the system holds the audio for roughly 1-2 seconds and analyzes what comes through. Humans tend to answer with a quick \"hello?\" usually under 1.5 seconds of audio, with a clear pause afterward waiting for a response.")}</p>
          <p>
            {t("Voicemail greetings sound different. They're longer, usually 4-15 seconds, run as a continuous monologue, and end with a beep. AMD looks at the duration of the initial speech, the pauses, the frequency profile, and (in modern systems) machine-learned signatures of common voicemail-greeting patterns. When the math says \"machine,\" the call drops before you ever pick up.")}</p>
        </section>

        <section className="exp-section alt">
          <div className="inner">
            <div className="exp-section-label">{t("▸ COMMON QUESTIONS")}</div>
            <h2>{t("The stuff people ask about AMD.")}</h2>

            <div className="exp-qa">
              <details>
                <summary>{t("How accurate is AMD?")}</summary>
                <div className="answer">
                  <p>
                    {t("Modern AMD on a clean carrier path is around 90-95% accurate. The remaining 5-10% splits between two kinds of error:")}{" "}<strong>{t("false positives")}</strong> {t("(AMD thinks a human is a voicemail and drops the call you wanted) and")}{" "}<strong>{t("false negatives")}</strong> {t("(AMD thinks a voicemail is a human and connects you to the greeting).")}</p>
                  <p>
                    {t("False positives are the painful ones, you just missed a connect. False negatives are mildly annoying but survivable; you hang up and the queue advances.")}</p>
                </div>
              </details>

              <details>
                <summary>{t("Doesn't the \"hello? ... hello?\" delay annoy people?")}</summary>
                <div className="answer">
                  <p>
                    {t("Yes, sometimes. There's a noticeable beat between when the human says \"hello\" and when the agent comes on the line, that's AMD doing its work. On lower-quality carrier paths it can be 2+ seconds, which is enough to make people hang up.")}</p>
                  <p>
                    {t("On DialerSeat, AMD runs through Telnyx's native call detection, tuned for speed so the analysis window stays short. That's short enough that most humans wait, but it's never going to be zero. It's a trade-off.")}</p>
                </div>
              </details>

              <details>
                <summary>{t("How does DialerSeat's AMD work specifically?")}</summary>
                <div className="answer">
                  <p>
                    {t("We use Telnyx's native call-detection engine, built on top of their carrier-grade telephony infrastructure. It classifies every pickup as")}{' '}
                    <code>human</code>, <code>machine</code>{t(", or")}{' '}
                    <code>not_sure</code>{t(". Anything classified as")}<code> machine</code> {t("drops server-side, silently and instantly, before your screen ever lights up, no disposition prompt, the dialer just moves on to the next lead. A")}{" "}<code>not_sure</code> {t("result is treated the same as a human pickup, so a call never gets stuck waiting on an ambiguous read.")}</p>
                  <p>
                    {t("Every AMD result is stored on the call record, so you can audit AMD accuracy on your own campaigns later by pulling the analytics.")}</p>
                </div>
              </details>

              <details>
                <summary>{t("When does AMD actually fire on DialerSeat?")}</summary>
                <div className="answer">
                  <p>
                    {t("By default: progressive and predictive modes get AMD on automatically. Power and preview don't, in those modes you're expected to deal with voicemails yourself (and many agents prefer that because they want to leave a voicemail).")}</p>
                  <p>
                    {t("You can override the default per-campaign in campaign settings if you want AMD on for power mode or off for progressive.")}</p>
                </div>
              </details>

              <details>
                <summary>{t("What happens to calls that AMD drops?")}</summary>
                <div className="answer">
                  <p>
                    {t("They get logged with a disposition of")}{" "}<code>NO_ANSWER_AMD</code>
                    {t("and the queue advances to the next lead automatically. Your agent never sees them, that's the whole point.")}</p>
                  <p>
                    {t("The lead doesn't get permanently removed from your list, AMD-dropped calls are typically retried later based on your campaign's retry rules.")}</p>
                </div>
              </details>

              <details>
                <summary>{t("Can I see why a specific call was dropped?")}</summary>
                <div className="answer">
                  <p>
                    {t("Yes. Every call record includes the AMD result (which of the six outcomes triggered) along with timing info. Pull it up in the calls log in your dashboard or export it for analysis.")}</p>
                </div>
              </details>

              <details>
                <summary>{t("Are voicemail drops a separate feature?")}</summary>
                <div className="answer">
                  <p>
                    {t("Different feature, related concept. AMD")}{" "}<em>{t("detects")}</em>
                    {t("voicemails. Voicemail drops")}{" "}<em>{t("play a pre-recorded message into")}</em> {t("one once detected. DialerSeat does not do voicemail drops today. When AMD calls a machine, the call ends and the queue advances nothing is left behind. It is on the list rather than shipped, and we would rather say that than have you plan a campaign around it.")}</p>
                </div>
              </details>

              <details>
                <summary>{t("Is AMD compliant with TCPA / TSR?")}</summary>
                <div className="answer">
                  <p>
                    {t("AMD itself doesn't change your compliance picture. The compliance rules apply to the act of placing the call, not to whether you connect to a human or a machine afterward.")}</p>
                  <p>
                    {t("AMD is, however, what makes")}{" "}<Link href="/faq/what-is-a-progressive-dialer">{t("progressive mode")}</Link> {t("work as a higher-throughput alternative to power, without triggering the FTC's 3% abandon cap. See the")}{" "}<Link href="/faq/why-is-compliance-important">{t("compliance page")}</Link> {t("for more.")}</p>
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
        </div>
      </GutsShell>
      <SiteFooter />
    </>
    </>
  )
}