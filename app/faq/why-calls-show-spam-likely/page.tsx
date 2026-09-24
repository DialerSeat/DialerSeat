import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'

// =============================================================================
// /faq/why-calls-show-spam-likely — the outside view
// =============================================================================
// The other two number pages explain what DialerSeat does. This one answers
// the question people actually search: why are my calls being labelled? It is
// the page that brings someone in who has never heard of us, so it has to be
// useful even if they never sign up, and every claim in it about how the
// industry works is sourced to the industry:
//
//   STIR/SHAKEN A/B/C         the framework's own definitions, via Telnyx
//   Free Caller Registry      freecallerregistry.com: run by First Orion, Hiya
//                               and TNSI; "does not guarantee redress"; not
//                               used to deliver Caller ID Name
//   Reputation factors        Hiya's published report card
//   CNAM on mobiles           Telnyx: wireless carriers "generally don't use"
//                               the CNAM service
//
// CNAM IS DESCRIBED, NOT CLAIMED. Nothing here says DialerSeat's numbers carry
// one, because the Telnyx audit records that none has been set.
// =============================================================================

const ROUTE = '/faq/why-calls-show-spam-likely'

export const metadata: Metadata = {
  title: 'Why Do My Calls Show “Spam Likely”? How Call Labels Work | DialerSeat',
  description:
    'Spam Likely is a score on your number, not a verdict on you. How carriers and call-protection apps decide, what STIR/SHAKEN does and does not prove, why CNAM rarely shows on mobiles, and what you can actually control.',
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'Why Do My Calls Show “Spam Likely”?',
    description:
      'How call labels actually get decided, what STIR/SHAKEN proves, and what you can control.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Why Do My Calls Show “Spam Likely”?',
    description:
      'How call labels actually get decided, what STIR/SHAKEN proves, and what you can control.',
  },
}

const FAQS = [
  {
    question: 'Why do my outbound calls show up as Spam Likely?',
    answer:
      'Because a call-protection provider scored your number as risky before the phone rang. Those scores are built from how people respond to the number: whether it has an established history, whether people answer, whether they stay on the line, and whether they complain or block it. Heavy volume on one number, low answer rates and complaints are the usual causes.',
  },
  {
    question: 'Does STIR/SHAKEN stop my calls being labelled as spam?',
    answer:
      'No. STIR/SHAKEN proves your caller ID is not spoofed, and A-attestation, the top grade, means your carrier knows you and gave you the number. It says nothing about whether people want the call. A properly signed call from a number with a poor reputation can still be labelled. Low attestation makes labelling more likely; high attestation does not prevent it.',
  },
  {
    question: 'Will CNAM stop my calls showing as spam?',
    answer:
      'Not on most consumer phones. CNAM displays a business name of up to 15 characters, but according to the carrier Telnyx, wireless carriers generally do not use the CNAM service, so it may not show on mobiles at all. It helps on landlines. It is not a spam fix, and the Free Caller Registry states its registration data is not used to deliver caller name either.',
  },
  {
    question: 'What can I do about my calls being marked as spam?',
    answer:
      'Spread volume across enough numbers that none dials heavily, call people who expect to hear from you, scrub against the Do Not Call Registry, keep lists fresh, and register your numbers with the Free Caller Registry. A dialer should handle the carrier and volume side automatically; consent and list quality stay with you.',
  },
]

export default function Page() {
  return (
    <>
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'FAQ', url: '/faq' },
          { name: 'Why calls show Spam Likely', url: ROUTE },
        ])}
      />
      <SiteHeader />
      <GutsShell rail={faqRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">▸ SPAM-FREE NUMBERS</div>
            <h1>
              “Spam Likely” isn’t a verdict on you.
              <span className="second">It’s a score on your number.</span>
            </h1>
            <p>
              Before your call ever rings, something has already decided what the person on the
              other end will see. Here is what that something is, what it looks at, and which
              parts of it you can actually change.
            </p>
          </div>
        </GutsSection>

        <GutsSection icon="phone" title="Who puts the label there">
          <p>
            The label doesn’t come from the person you’re calling, and it usually doesn’t come
            from your own carrier either. It comes from call-protection providers that work with
            the carrier on the <em>receiving</em> end, scoring numbers and flagging the ones that
            look risky.
          </p>
          <p>
            Three of them, First Orion, Hiya and TNS, jointly run the{' '}
            <a href="https://www.freecallerregistry.com" target="_blank" rel="noopener noreferrer">
              Free Caller Registry
            </a>
            , where businesses register their outbound numbers. Registering is worth doing, and
            free. It is not a pass, though: the registry says plainly that each provider still runs
            its own analysis on every call.
          </p>
        </GutsSection>

        <GutsSection icon="shield" title="What STIR/SHAKEN proves, and what it doesn’t">
          <p>
            STIR/SHAKEN is the framework US carriers use to fight caller ID spoofing. Every call is
            signed with a grade that says how much the originating carrier knows about it.
          </p>
          <div className="guts-grid-3">
            <div className="guts-panel">
              <div className="role">ATTESTATION A</div>
              <h3>Full</h3>
              <p>The carrier knows the customer and gave them this number.</p>
            </div>
            <div className="guts-panel">
              <div className="role">ATTESTATION B</div>
              <h3>Partial</h3>
              <p>The carrier knows the customer, but didn’t give them this number.</p>
            </div>
            <div className="guts-panel">
              <div className="role">ATTESTATION C</div>
              <h3>Gateway</h3>
              <p>The call came in from another network and the source can’t be vouched for.</p>
            </div>
          </div>
          <div className="guts-callout">
            <p>
              <strong>A is necessary, not sufficient.</strong> Attestation proves your number isn’t
              spoofed. It says nothing about whether anyone wants your call. A C-grade call is far
              more likely to be labelled, but an A-grade call from a number people keep rejecting
              can still be labelled. Attestation is about identity. The label is about reputation.
            </p>
          </div>
        </GutsSection>

        <GutsSection icon="scale" title="What a number’s reputation is built from">
          <p>
            Reputation is behavioural. Hiya publishes the four factors it grades a number on, each
            from A to D, and they are a useful map of what every provider is watching.
          </p>
          <ul className="guts-list good">
            <li><strong>Maturity.</strong> Does the number have an established calling history, rather than being one of a string of fresh numbers rotated through?</li>
            <li><strong>Connection.</strong> Do the people it calls choose to answer?</li>
            <li><strong>Engagement.</strong> Once they answer, do they stay on the line?</li>
            <li><strong>Sentiment.</strong> Do people rarely complain about it or block it?</li>
          </ul>
        </GutsSection>

        <GutsSection icon="alert" title="The patterns that get a number labelled">
          <p>Put those factors into practice and the usual causes are easy to name.</p>
          <ul className="guts-list warn">
            <li>
              <strong>Too many calls on one number.</strong> Volume concentrated on a single caller
              ID looks like a robocall operation, and it burns through goodwill fast.
            </li>
            <li>
              <strong>Low answer rates.</strong> A number people keep declining is telling the
              providers something, whatever the reason.
            </li>
            <li>
              <strong>Short calls and hang-ups.</strong> Answered calls that end in seconds read as
              unwanted.
            </li>
            <li>
              <strong>Complaints and blocks.</strong> People can report and block numbers in their
              call-protection apps, and those reports count directly.
            </li>
            <li>
              <strong>Constantly swapping numbers.</strong> Burning through fresh numbers to dodge
              labels works against the maturity factor instead of for it.
            </li>
          </ul>
        </GutsSection>

        <GutsSection icon="chat" title="Where CNAM fits, and where it doesn’t">
          <p>
            CNAM is the caller name that can appear under a number: up to 15 characters, like a
            business name. It is often sold as a spam fix. It mostly isn’t.
          </p>
          <p>
            According to the carrier{' '}
            <a
              href="https://support.telnyx.com/en/articles/1130720-caller-id-outbound-vs-cnam"
              target="_blank"
              rel="noopener noreferrer"
            >
              Telnyx
            </a>
            , wireless carriers generally don’t use the CNAM service, so a name may never display on
            a mobile phone. On a consumer list, that is most of the people you call. CNAM helps on
            landlines, and it can make a business line look legitimate there, but it doesn’t change
            how any provider scores the number. The Free Caller Registry also notes that its
            registration data isn’t used to deliver caller name.
          </p>
        </GutsSection>

        <GutsSection icon="check" title="What a dialer should handle, and what’s yours">
          <div className="guts-grid-2">
            <div className="guts-panel">
              <div className="role">THE PLATFORM’S JOB</div>
              <ul className="guts-list good">
                <li>Signing every call at A-attestation</li>
                <li>Registering numbers with the Free Caller Registry</li>
                <li>Capping how much any single number dials</li>
                <li>Spreading volume so no number runs hot</li>
                <li>Spotting a struggling number and easing off it</li>
              </ul>
            </div>
            <div className="guts-panel">
              <div className="role">YOURS</div>
              <ul className="guts-list warn">
                <li>Calling people who expect to hear from you</li>
                <li>Scrubbing against the Do Not Call Registry</li>
                <li>Keeping lists fresh rather than recycled</li>
                <li>Opening in a way people stay on the line for</li>
              </ul>
            </div>
          </div>
          <p style={{ marginTop: 24 }}>
            DialerSeat does everything in the left column automatically, on every plan. How each
            piece works, with the actual numbers, is on{' '}
            <Link href="/faq/how-we-keep-numbers-clean">how we keep our numbers clean</Link>.
          </p>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">GET STARTED →</Link>
            <Link href="/faq/how-we-keep-numbers-clean" className="guts-btn secondary">
              HOW WE DO IT
            </Link>
          </div>
          <p className="guts-note">
            Attestation grades are the STIR/SHAKEN framework’s own definitions. Reputation factors
            are summarised from{' '}
            <a
              href="https://blog.hiya.com/caller-reputation-the-industrys-first-transparent-view-into-spam-labeling"
              target="_blank"
              rel="noopener noreferrer"
            >
              Hiya’s Caller Reputation report card
            </a>
            . Registry details are from the{' '}
            <a href="https://www.freecallerregistry.com" target="_blank" rel="noopener noreferrer">
              Free Caller Registry
            </a>
            .
          </p>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
