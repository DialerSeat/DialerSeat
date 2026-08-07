import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import JsonLd from '@/components/json-ld'
import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import DialingModeCTA from '@/components/DialingModeCTA'
import ExplainerStyles from '@/components/ExplainerStyles'
import ExplainerCrossLinks from '@/components/ExplainerCrossLinks'

export const metadata: Metadata = {
  title: 'Do I Need 10DLC Registration to Make Outbound Calls? | DialerSeat',
  description:
    '10DLC is an SMS framework. It does not apply to voice calls. The voice equivalents are STIR/SHAKEN attestation and CNAM registration, and DialerSeat handles both. What each one actually does.',
  alternates: { canonical: 'https://dialerseat.com/faq/10dlc-and-outbound-calling' },
  openGraph: {
    title: 'Do I Need 10DLC to Make Outbound Calls?',
    description:
      'No — 10DLC is for text messaging. The voice equivalents are STIR/SHAKEN and CNAM, and they are handled for you.',
    url: 'https://dialerseat.com/faq/10dlc-and-outbound-calling',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Do I Need 10DLC to Make Outbound Calls?',
    description: '10DLC is an SMS framework. For voice, what matters is STIR/SHAKEN attestation and CNAM.',
  },
}

const FAQS = [
  {
    question: 'Do I need 10DLC registration to make outbound calls?',
    answer:
      'No. 10DLC — “10-digit long code” — is a registration framework the US carriers built for application-to-person text messaging. It governs SMS and MMS sent from ordinary ten-digit numbers. It has no bearing on voice calls. If you are dialing leads and not texting them, 10DLC is not something you need to register for.',
  },
  {
    question: 'Then why do people keep telling me to register?',
    answer:
      'Because most platforms that dial also text, and the vendor onboarding flow bundles the two. If a product sells calling and messaging together, its setup checklist will include brand and campaign registration whether or not you intend to send a single message. The advice is not wrong for that product — it is just not about calling.',
  },
  {
    question: 'What is the voice equivalent of 10DLC?',
    answer:
      'There are two, and they do different jobs. STIR/SHAKEN is a cryptographic attestation attached to the call itself, telling the receiving carrier that the network placing the call has verified the caller has the right to use that number. CNAM is the caller-name database that decides what text appears on the handset. Neither is a registration you complete once for your business the way 10DLC is — they are properties of the numbers you dial from.',
  },
  {
    question: 'Does DialerSeat handle STIR/SHAKEN and CNAM?',
    answer:
      'Yes. Numbers in the pool carry A-attestation under STIR/SHAKEN and are CNAM-registered. You do not file anything, and there is no separate fee for it. This is a meaningful part of why a number reaches a handset looking like a real business rather than a suspected robocall.',
  },
  {
    question: 'Will registering for 10DLC stop my calls being flagged as spam?',
    answer:
      'No, and this is the expensive version of the misunderstanding — teams spend weeks on brand registration expecting their answer rate to recover, and nothing changes, because the framework they registered with never touched voice. Call labelling is driven by attestation, by the calling patterns attached to a number, and by how many people decline or report it. What actually helps is A-attestation, rotating across a pool rather than burning one number, and retiring numbers whose answer rate has degraded.',
  },
  {
    question: 'Do I need 10DLC if I also send texts?',
    answer:
      'Yes — if you send application-to-person SMS from a ten-digit US number, you need brand and campaign registration, and unregistered traffic is increasingly filtered or blocked outright. DialerSeat does not send SMS, so this is a question for whichever platform you text from.',
  },
]

export default function Page() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Faq', url: '/faq' },
        { name: 'Do I Need 10DLC Registration for Outbound Calls?', url: '/faq/10dlc-and-outbound-calling' },
      ])} />
      <JsonLd data={faqPageSchema(FAQS)} />
      <SiteHeader />
      <main className="exp-root">
        <ExplainerStyles accent="#2a4a8a" accentBg="#e8eef8" />

        <section className="exp-hero">
          <div className="exp-hero-inner">
            <div className="exp-eyebrow">EXPLAINER · REGISTRATION</div>
            <h1>Do you need 10DLC to make outbound calls?</h1>
            <p className="exp-lead">
              No. 10DLC is a text-messaging framework and it does not apply to
              voice. The confusion is understandable and it costs real teams real
              weeks, so it is worth being precise about what governs what.
            </p>
          </div>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ THE SHORT VERSION</div>
          <h2>10DLC is about texts. Calls are governed by something else.</h2>
          <p>
            10DLC stands for <em>10-digit long code</em> — an ordinary ten-digit
            phone number, as opposed to a short code. The registration framework
            around it exists because carriers wanted accountability for
            application-to-person <strong>text messages</strong> sent from those
            numbers. You register a brand, you register a campaign describing what
            you will send, and your messaging throughput and filtering follow from
            that.
          </p>
          <p>
            None of it touches a voice call. A number can carry perfectly
            registered 10DLC messaging traffic and still be labelled Spam Likely on
            outbound calls, because the two systems do not talk to each other.
          </p>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ WHY EVERYONE SAYS OTHERWISE</div>
          <h2>Most platforms sell both, so the checklist bundles both.</h2>
          <p>
            If a vendor sells calling and texting on the same number, its
            onboarding will walk you through brand and campaign registration
            regardless of which half you intend to use. That is reasonable product
            design and terrible general advice: it leaves people believing 10DLC is
            a prerequisite for dialing.
          </p>
          <p>
            The costly version is a team whose answer rate has fallen, who
            concludes the problem is registration, and who spends a month on brand
            approval waiting for calls to improve. They will not, because the
            framework was never in that path.
          </p>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ WHAT ACTUALLY GOVERNS VOICE</div>
          <h2>Attestation and caller name.</h2>
          <p>
            <strong>STIR/SHAKEN</strong> is a signature travelling with the call.
            The originating carrier attests to how confident it is that the caller
            is entitled to the number they are displaying. A-attestation is the
            strongest level: the carrier knows the customer and knows the number is
            theirs. Terminating carriers weigh that signature when deciding whether
            to label a call.
          </p>
          <p>
            <strong>CNAM</strong> is the caller-name database — what appears under
            the number on the handset. It is a separate system with its own
            registration, and it is why one number shows a business name and
            another shows nothing at all.
          </p>
          <p>
            Neither is a one-off registration for your company. Both are properties
            of the individual numbers you dial from, which is why they are the
            provider&apos;s job rather than yours.
          </p>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ WHAT DIALERSEAT DOES</div>
          <h2>Handled, with nothing to file.</h2>
          <p>
            Numbers in the DialerSeat pool carry A-attestation under STIR/SHAKEN
            and are CNAM-registered. There is no form for you to submit and no
            separate charge.
          </p>
          <p>
            Attestation is necessary and not sufficient. A number that dials
            heavily will eventually accumulate declines and reports regardless of
            how well it is signed, which is why the pool rotates across numbers
            rather than leaning on one, tracks answer rate per number, and retires
            numbers whose delivery has degraded rather than dialing them into the
            ground.{' '}
            <Link href="/faq/numbers">How the number pool works</Link> covers the
            mechanics.
          </p>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ COMMON QUESTIONS</div>
          <h2>Registration, answered.</h2>
          {FAQS.map(f => (
            <div key={f.question} style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 18, marginBottom: 8 }}>{f.question}</h3>
              <p style={{ margin: 0 }}>{f.answer}</p>
            </div>
          ))}
        </section>

        <DialingModeCTA
          headline="Nothing to register. Start dialing."
          description="A-attestation and CNAM come with every number in the pool, at no extra cost and with no forms to file. $35/week per seat."
        />
        <ExplainerCrossLinks current="registration" />
      </main>
      <SiteFooter />
    </>
  )
}
