import type { Metadata } from 'next'
import Link from 'next/link'
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
// /faq/local-presence-dialing
// =============================================================================
// The order below is the ORDER BY of claim_pool_number as it runs in the live
// database (read 25 Sept 2026), with the arguments lib/numberPool
// pickNumberForLead passes it:
//
//   1. under the soft cap        SOFT_DAILY_CAP = 40; past it a number goes to
//                                  the back however good its match
//   2. locality                  area code, then state, then region, then the
//                                  rest. pool_default_strategy = 'locality' and
//                                  pool_experiment_pct = 0, so this is every
//                                  dial, every mode, predictive included
//   3. registered numbers        is_registered first
//   4. fewest calls today        daily_call_count
//   5. longest idle              last_called_at
//
//   state beats area code        when the lead's state contradicts their area
//                                  code, the area code is dropped from the match
//   same number on a redial      lib/placeOutboundCall looks back 3 minutes and
//                                  asks for the same number first, falling back
//                                  to the order above if it is capped or busy
//   Apple's rule                 support.apple.com iph21d43af5b: Allow Repeated
//                                  Calls, same person within three minutes. It
//                                  is a setting the phone's owner turns on, so
//                                  the page does not claim it always applies
//
// DELIBERATELY NOT HERE: pool size, coverage by state, or any answer-rate lift
// from locality. None is a number we can stand behind on a public page.
// =============================================================================

const ROUTE = '/faq/local-presence-dialing'

const baseMetadata: Metadata = {
  title: 'Local Presence Dialing: How DialerSeat Picks Your Caller ID | DialerSeat',
  description:
    'Local presence dialing shows each prospect a caller ID from their own area. How DialerSeat picks a number for every call: area code, then state, then region, spread across the pool so no number gets burned, on every plan and every dialing mode.',
  keywords: [
    'local presence dialing',
    'local presence dialer',
    'local caller ID dialer',
    'area code matching dialer',
    'local number dialing',
    'what is local presence',
  ],
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'Local Presence Dialing: How DialerSeat Picks Your Caller ID',
    description:
      'Area code, then state, then region, spread across the pool so no single number burns out.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Local Presence Dialing on DialerSeat',
    description: 'Area code, then state, then region, spread across the pool so no single number burns out.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("What is local presence dialing?"),
    answer:
      msg("Local presence dialing means calling each prospect from a phone number local to them, so the caller ID shows a familiar area code instead of an out-of-state one. Many people are more willing to answer a call that looks local."),
  },
  {
    question: msg("Does DialerSeat do local presence dialing?"),
    answer:
      msg("Yes, on every call, in every dialing mode including predictive, with no add-on. For each call DialerSeat picks a number from its pool that matches the prospect’s area code, then their state, then their region, and only then any number with capacity."),
  },
  {
    question: msg("What if a lead has moved and kept their old number?"),
    answer:
      msg("If the lead’s state in your list disagrees with their area code, DialerSeat matches their state instead. Someone who moved to Florida and kept a New York mobile number gets a Florida caller ID, because that is what looks local to them now."),
  },
  {
    question: msg("Does local presence burn out numbers faster?"),
    answer:
      msg("It can, if every call to one area goes out on one number. DialerSeat prevents that. Once a number has made 40 calls in a day it moves to the back of the queue however good its match, so calls spread across the pool, and no number places more than 60 calls a day."),
  },
  {
    question: msg("Does a redial use the same caller ID?"),
    answer:
      msg("Yes, when it comes within three minutes. On an iPhone with Allow Repeated Calls switched on in Focus, a second call from the same caller within three minutes is let through, so DialerSeat redials from the number the prospect just saw. After three minutes it goes back to ordinary local matching."),
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
          { name: msg("Local presence dialing"), url: ROUTE },
        ])}
      />
      <SiteHeader />
      <GutsShell rail={faqRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ NUMBERS")}</div>
            <h1>
              {t("A local number on every call.")}<span className="second">{t("Without burning one out.")}</span>
            </h1>
            <p>
              {t("Local presence dialing means calling each prospect from a number in their own area. DialerSeat does it on every call, in every dialing mode, with no add-on. Here is exactly how it picks the number.")}</p>
          </div>
        </GutsSection>

        <GutsSection icon="info" title={t("Why local matters")}>
          <p>
            {t("People decide whether to answer from a glance at the caller ID. An area code they recognise looks like someone nearby. One from across the country looks like a call center, and often gets ignored.")}</p>
          <p>
            {t("Many dialers sell local presence as an add-on. On DialerSeat it is simply how every number is chosen.")}</p>
        </GutsSection>

        <GutsSection icon="list" title={t("How a number is picked, in order")}>
          <p>{t("For every single call, the pool is sorted like this and the top number is used.")}</p>
          <div className="guts-grid-2">
            <div className="guts-panel">
              <div className="role">{t("1. SHARE THE LOAD")}</div>
              <h3>{t("Under 40 calls today")}</h3>
              <p>
                {t("A number that has already made 40 calls today goes to the back of the queue, however good its match. This comes first on purpose, so one number never carries a whole area.")}</p>
            </div>
            <div className="guts-panel">
              <div className="role">{t("2. MATCH THE PROSPECT")}</div>
              <h3>{t("Area code, state, region")}</h3>
              <p>
                {t("Same area code first. Then the same state. Then the same part of the country. Then any number with room.")}</p>
            </div>
            <div className="guts-panel">
              <div className="role">{t("3. REGISTERED FIRST")}</div>
              <h3>{t("Numbers on the registry")}</h3>
              <p>
                {t("Among equal matches, numbers registered with the")}{' '}
                <Link href="/faq/how-we-keep-numbers-clean">{t("Free Caller Registry")}</Link> {t("go first.")}</p>
            </div>
            <div className="guts-panel">
              <div className="role">{t("4. SPREAD EVENLY")}</div>
              <h3>{t("Least used, longest idle")}</h3>
              <p>
                {t("Then the number with the fewest calls today, and among those the one that has rested longest.")}</p>
            </div>
          </div>
          <p style={{ marginTop: 24 }}>
            {t("No number places more than 60 calls a day. Once it reaches its limit, it rests until the next day.")}</p>
        </GutsSection>

        <GutsSection icon="swap" title={t("Where they live beats where they got their number")}>
          <p>
            {t("Mobile numbers don’t move when people do. Someone who moved from New York to Florida may keep their 212 number for years, but a New York caller ID no longer looks local to them.")}</p>
          <p>
            {t("So when the state in your lead list disagrees with the lead’s area code, DialerSeat matches the")}{" "}<strong>{t("state")}</strong>{t(", and falls back to that state’s region. When the two agree, or your list has no state, the area code decides, because it pins a city rather than a whole state.")}</p>
        </GutsSection>

        <GutsSection icon="phone" title={t("One exception: the quick redial")}>
          <p>
            {t("On an iPhone with")}{" "}<strong>{t("Allow Repeated Calls")}</strong> {t("switched on in Focus, a second call from the same caller within three minutes gets through even when the phone is silencing calls. That is a big part of what 2x and 3x dialing is for.")}</p>
          <p>
            {t("It only works if the second call comes from the same number. So when DialerSeat redials a lead within three minutes, it asks for the number that lead just saw. If that number is busy or at its limit, the redial goes out on the next best local number instead, because a redial from a different number is still better than no redial.")}</p>
          <p className="guts-note">
            {t("Apple’s description of the setting is in its")}{' '}
            <a
              href="https://support.apple.com/guide/iphone/allow-or-silence-notifications-for-a-focus-iph21d43af5b/ios"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("iPhone user guide")}</a>
            .
          </p>
        </GutsSection>

        <GutsSection icon="check" title={t("Every mode, every plan")}>
          <ul className="guts-list good">
            <li>{t("Preview, power, progressive and predictive all match locally.")}</li>
            <li>
              {t("Predictive included. Each call in a predictive round is its own call to its own lead, so each gets its own local number.")}</li>
            <li>{t("No add-on and no separate fee. It is part of every seat.")}</li>
          </ul>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
            <Link href="/faq/why-calls-show-spam-likely" className="guts-btn secondary">
              {t("WHY CALLS SHOW SPAM LIKELY")}</Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
