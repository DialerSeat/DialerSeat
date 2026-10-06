import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

// =============================================================================
// /faq/how-we-keep-numbers-clean — the number-health system, end to end
// =============================================================================
// Every figure on this page is read out of the code that enforces it, not
// remembered from a pitch:
//
//   60 hard cap, 40 soft cap     lib/numberPool.ts  DEFAULT_DAILY_CAP, SOFT_DAILY_CAP
//   3-day window, 40-call bar,   app/api/cron/number-health/route.ts
//     40% of median, 15/day        WINDOW_DAYS, MIN_CALLS_FOR_JUDGEMENT,
//     throttle, 25% ceiling        RELATIVE_FLOOR, THROTTLED_DAILY_CAP,
//                                  MAX_REST_FRACTION
//   A-attestation                Telnyx: a call from a number OWNED on the
//                                  account is signed A. Every pool number is
//                                  bought on Telnyx, and the import tool only
//                                  accepts numbers already owned there.
//
// If any of those constants change, this page is wrong until it is edited.
// That is the cost of publishing real numbers instead of adjectives, and it is
// worth paying: "we monitor number health" is unfalsifiable, "we throttle any
// number answering below 40% of the pool median" is a claim a buyer can hold
// us to.
//
// DELIBERATELY ABSENT: CNAM. The site claims it elsewhere, but the Telnyx
// audit (lib/telnyxNumberAudit.ts) records that nothing has ever set it. It
// goes on this page when it is actually on the numbers.
// =============================================================================

const ROUTE = '/faq/how-we-keep-numbers-clean'

const baseMetadata: Metadata = {
  title: 'How DialerSeat Keeps Its Numbers From Getting Flagged | DialerSeat',
  description:
    'A hard cap of 60 calls per number per day, load spread before any number runs hot, every number checked daily against its peers, and a struggling number slowed down rather than pulled. The whole system, with the numbers.',
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'How DialerSeat Keeps Its Numbers From Getting Flagged',
    description:
      'Daily caps, load spreading, peer-relative health checks, and throttling instead of resting. The whole system, with the numbers.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How DialerSeat Keeps Its Numbers From Getting Flagged',
    description:
      'Daily caps, load spreading, peer-relative health checks, and throttling instead of resting.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("How does DialerSeat stop its numbers getting flagged as spam?"),
    answer:
      msg("Four layers. Every call is signed with STIR/SHAKEN A-attestation, because every number is owned on our carrier account. No number places more than 60 calls a day, and load starts spreading across the pool at 40. Every number is checked daily against the rest of the pool, and one answering far below its peers is slowed to 15 calls a day until it recovers. Numbers are also registered with the Free Caller Registry."),
  },
  {
    question: msg("How many calls does each DialerSeat number make per day?"),
    answer:
      msg("At most 60. Past 40, a number drops to the back of the queue however good its area-code match is, so load spreads across the whole pool before any single number gets hot. The pool averages around 39 calls a number a day."),
  },
  {
    question: msg("What happens when one of your numbers starts getting flagged?"),
    answer:
      msg("It is slowed down, not removed. A number answering below 40% of the pool median over three days is capped at 15 calls a day and stays in the pool, then goes back to full volume automatically once it recovers. Our own data found that resting a flagged number made it worse, while cutting its volume let it recover within days."),
  },
  {
    question: msg("Can DialerSeat guarantee my numbers never get flagged?"),
    answer:
      msg("No, and nobody honestly can. Carriers and call-analytics apps score numbers on how people respond to them, including complaints and blocks, so list quality, consent and the call itself still matter. What the platform controls is every carrier-level and volume-level cause of flagging, and it handles those automatically."),
  },
]

export default async function Page() {
  await primeLocale()
  return (
    <>
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("FAQ"), url: '/faq' },
          { name: msg("How we keep numbers clean"), url: ROUTE },
        ])}
      />
      <SiteHeader />
      <GutsShell rail={faqRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ SPAM-FREE NUMBERS")}</div>
            <h1>
              {t("No number dials itself into the ground.")}<span className="second">{t("Here’s how we make sure.")}</span>
            </h1>
            <p>
              {t("A flagged caller ID doesn’t cost a fraction of a cent. It costs every conversation it would have carried. So our number pool is run on answer rate, not on how many calls a number can physically place.")}</p>
            <div className="guts-btns">
              <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
              <Link href="/faq/why-calls-show-spam-likely" className="guts-btn secondary">
                {t("WHY “SPAM LIKELY” HAPPENS")}</Link>
            </div>
          </div>
        </GutsSection>

        <GutsSection icon="shield" title={t("Every call is signed at the highest level")}>
          <p>
            {t("STIR/SHAKEN is the carrier framework that stops caller ID spoofing. Every call carries a signature, graded A, B or C, saying how much the originating carrier knows about who placed it. A is the top grade: the carrier knows the customer and gave them the number.")}</p>
          <p>
            {t("Our carrier signs a call from a number owned on our account with A. Every number in the DialerSeat pool is bought and owned there, and the tool that brings an existing number into the pool only accepts one that is already owned. So there is no path for a B or C signature to reach your calls.")}</p>
          <p>
            {t("Numbers are also registered with the")}{' '}
            <a href="https://www.freecallerregistry.com" target="_blank" rel="noopener noreferrer">
              {t("Free Caller Registry")}</a>
            {t(", run jointly by call-protection providers First Orion, Hiya and TNS so they can identify legitimate business numbers. It helps, but it isn’t a pass: each provider still runs its own analysis on every call.")}</p>
          <div className="guts-callout">
            <p>
              <strong>{t("What attestation does not do.")}</strong> {t("It proves your number is not spoofed. It says nothing about whether anyone wants the call. A perfectly signed call from a number people keep rejecting can still be labelled. That is what the rest of this page is about.")}</p>
          </div>
        </GutsSection>

        <GutsSection icon="calendar" title={t("A hard cap of 60 calls per number, per day")}>
          <p>
            {t("The more calls one number places in a day, the faster carriers start treating it as spam. So no number in the pool places more than 60.")}</p>
          <p>
            {t("That number came from our own calls. Two separate analyses in September both found that numbers dialing lightly were answered roughly 1.8 to 1.9 times as often as numbers dialing heavily. The heaviest days partly overlapped with a period when the dialer itself had problems, so treat the size of the gap with some caution. The direction held both times.")}</p>
          <p>
            <strong>{t("We scale by adding numbers, not by raising the cap.")}</strong> {t("Raising it would trade answer rate for capacity, which is backwards: numbers are the cheap input, and the conversation is the expensive output.")}</p>
        </GutsSection>

        <GutsSection icon="swap" title={t("Load spreads before any number runs hot")}>
          <p>
            {t("A hard cap on its own still lets one number carry 59 calls while its neighbours sit idle. So there is a second, lower line. Past 40 calls in a day, a number drops to the back of the queue, however well its area code matches the lead.")}</p>
          <p>
            {t("Forty is roughly the pool’s average, which means load starts spreading across every number before any single one gets hot, rather than after. The hard cap then only has to catch the rare outlier.")}</p>
          <p>
            <strong>{t("Local presence works the same way.")}</strong> {t("A number in the lead’s own area code or state is preferred, but that is an ordering, not a filter. If a state runs out of fresh numbers, the dialer falls back to the rest of the pool with a slightly worse match. It never stops dialing because one area code is busy.")}</p>
        </GutsSection>

        <GutsSection icon="scale" title={t("Every number is checked against its peers, daily")}>
          <p>
            {t("Once a day, every number’s answer rate over the last three days is compared with the rest of the pool. A number answering below 40% of the pool median is treated as struggling.")}</p>
          <p>
            <strong>{t("Why compare against the pool instead of a fixed target?")}</strong> {t("Because answer rates swing enormously by industry, time of day and list quality. Twelve percent is excellent on aged internet leads and poor on fresh inbound. What is never normal is one number answering far below the others dialing the same lists on the same days. That is a property of the number, not of your campaign.")}</p>
          <p>
            {t("A number needs at least 40 calls in the window before it is judged at all, so a quiet day or a single bad hour can’t condemn it.")}</p>
        </GutsSection>

        <GutsSection icon="alert" title={t("A struggling number is slowed down, not pulled")}>
          <p>
            {t("When a number falls behind, its daily cap drops from 60 to 15. It stays in the pool and keeps calling, just far less. When its answer rate recovers, the same daily check puts it back to full volume on its own.")}</p>
          <p>
            {t("That is the opposite of the usual advice, which is to pull a flagged number and let it cool off. We did that, and the numbers came back worse. The full story, with our data, is on")}{' '}
            <Link href="/faq/why-we-dont-rest-flagged-numbers">
              {t("why we slow a flagged number down instead of resting it")}</Link>.
          </p>
        </GutsSection>

        <GutsSection icon="info" title={t("Built so a glitch can’t become an outage")}>
          <p>
            {t("A health check that acts on bad data is worse than none. So this one has limits.")}</p>
          <ul className="guts-list good">
            <li>
              {t("It never slows down more than a quarter of the pool at once. If a quarter of the pool looks bad on the same day, the likeliest cause is something platform-wide, like answered calls briefly going unrecorded, and throttling everything would turn a reporting problem into a capacity problem.")}</li>
            <li>{t("It never buys or releases a number on its own. It adjusts volume, nothing else.")}</li>
            <li>
              {t("It lets a number back up on a lower bar than it takes to slow one down, so the penalty can never quietly become permanent. If it restores one too early, the next check is a day away.")}</li>
          </ul>
        </GutsSection>

        <GutsSection icon="chat" title={t("What’s still on you")}>
          <p>
            {t("No infrastructure makes a number permanently immune. Call-analytics apps also score numbers on how the people you call respond, including complaints and blocks. The platform removes every carrier-level and volume-level cause of flagging; these are the ones only you control.")}</p>
          <ul className="guts-list warn">
            <li>{t("Call people who expect to hear from you. Consent is the single biggest factor.")}</li>
            <li>
              {t("Scrub against the National Do Not Call Registry. That stays the seller’s responsibility, covered on")}{' '}
              <Link href="/faq/how-we-keep-compliance">{t("how we keep compliance")}</Link>.
            </li>
            <li>{t("Keep lists fresh. Stale, recycled data is what gets hung up on and reported.")}</li>
            <li>{t("Open well. People who stay on the line are a signal that you are worth answering.")}</li>
          </ul>
        </GutsSection>

        <GutsSection icon="check" title={t("You never manage any of this")}>
          <p>
            {t("There is no number dashboard to babysit and no setting to tune. Caps, load spreading, daily checks and throttling all run on their own, on every plan, at $35 per seat per week.")}</p>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
            <Link href="/faq/numbers" className="guts-btn secondary">{t("PHONE NUMBERS & CALLER ID")}</Link>
          </div>
          <p className="guts-note">
            {t("Attestation behaviour is from")}{' '}
            <a
              href="https://developers.telnyx.com/docs/voice/stir-shaken/attestation-behavior"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("Telnyx’s STIR/SHAKEN documentation")}</a>
            {t(". Caps, thresholds and windows are the values the dialer enforces today.")}</p>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
