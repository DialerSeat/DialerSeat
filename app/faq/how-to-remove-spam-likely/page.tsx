import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import PageStamp from '@/components/PageStamp'
import { faqRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { pageDate } from '@/lib/pageDates'
import { primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

// =============================================================================
// /faq/how-to-remove-spam-likely — the fix, not the explanation
// =============================================================================
// /faq/why-calls-show-spam-likely answers "why is this happening". It is a good
// page and it is not this page. The 4 Nov demand pass found the failure search
// that it does not serve: people type "how to remove spam likely from my
// number", "my number is showing up as scam likely", "phone number flagged as
// spam" — and they want steps, in order, today.
//
// WHAT IS SOURCED, AND FROM WHERE. Everything procedural here was read off the
// primary source on 5 Nov 2026, never off a remediation vendor's blog, because
// the firms selling removal are the ones with the strongest reason to overstate
// what removal is:
//
//   Free Caller Registry   freecallerregistry.com: one free form, fanned out to
//                            First Orion, Hiya and TNS; "over 400M wireless
//                            subscribers"; "registration does not guarantee
//                            that your calls will never be blocked or labeled";
//                            no need to register a number more than once.
//   Remediation pipeline   developers.telnyx.com/docs/number-reputation/
//                            remediation — our own carrier's documented API, so
//                            the outcome vocabulary on this page is the real
//                            one: remediated, not_flagged, requires_review,
//                            ineligible, refused. Telnyx states both that
//                            submitting does not guarantee removal and that a
//                            successfully remediated number can still be
//                            blocked or labelled downstream.
//
// NO TURNAROUND TIMES. Every "7–14 days" figure in circulation traces back to
// a company selling remediation. Neither the registry nor the carrier publishes
// one, so this page does not either (no-fabricated-numbers rule).
//
// NO CNAM CLAIM, per the 4 Nov sweep: CNAM is described as not being the fix,
// and nothing here says our numbers carry one.
// =============================================================================

const ROUTE = '/faq/how-to-remove-spam-likely'
const UPDATED = pageDate(ROUTE)

const baseMetadata: Metadata = {
  title: 'How to Remove “Spam Likely” From Your Number: The Actual Steps',
  description:
    'Your number is labelled Spam Likely or Scam Likely and you want it gone. You cannot delete the label yourself: you register once for free, file a re-evaluation, and fix the calling pattern that caused it. What each step really does, what nobody can promise you, and what does not work.',
  keywords: [
    'how to remove spam likely from my number',
    'my number is showing up as scam likely',
    'phone number flagged as spam',
    'remove scam likely label',
    'business number marked spam fix',
    'free caller registry',
  ],
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'How to Remove “Spam Likely” From Your Number',
    description:
      'Register once, ask for a re-evaluation, then fix the pattern that caused it. The steps, the limits, and what does not work.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How to Remove “Spam Likely” From Your Number',
    description:
      'Register once, ask for a re-evaluation, then fix the pattern that caused it. The steps, the limits, and what does not work.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("How do I remove the Spam Likely label from my phone number?"),
    answer: msg("There is no button that deletes it, and nobody can remove it on demand. Three steps, in order: register the number free at the Free Caller Registry, which sends it to First Orion, Hiya and TNS in one go; ask those networks to re-evaluate the number; then change the calling pattern that got it labelled, because the label is a score that is recalculated continuously and will come back if the behaviour does not change."),
  },
  {
    question: msg("Does registering with the Free Caller Registry remove a spam label?"),
    answer: msg("No, and the registry says so itself: registration does not guarantee that your calls will never be blocked or labelled. What it does is establish the number as belonging to a real business rather than a bad actor, and it reaches all three call-protection providers in one free submission that covers over 400 million US wireless subscribers. It is worth doing first and it is not a fix on its own."),
  },
  {
    question: msg("How long does it take to get a spam label removed?"),
    answer: msg("Neither the registry nor the carriers publish a turnaround time. Every specific figure in circulation comes from a company selling remediation, so treat it as marketing rather than a timetable. A re-evaluation can come back as remediated, as still needing review, or as refused, and a number that was recently submitted can be ineligible to go again while it is in a cooldown window."),
  },
  {
    question: msg("Why did my number get flagged again after it was cleared?"),
    answer: msg("Because the label is a behaviour score, not a record. Getting a number re-evaluated resets the verdict, not the cause. If the same volume per number, the same unanswered calls and the same short calls continue, the score returns to where it was. The pattern is what has to change: fewer calls per number per day, lists people expect calls from, and an opening they stay on the line for."),
  },
  {
    question: msg("Will a new phone number fix Spam Likely?"),
    answer: msg("Only until the new number is burned the same way, which is usually quick. Reputation systems grade maturity, so a string of fresh numbers rotated through looks worse than one number with an established history. We have measured this on our own pool: resting a flagged number did not heal it, and cutting the volume on it did, within days."),
  },
  {
    question: msg("Does CNAM or a caller name fix a spam label?"),
    answer: msg("No. CNAM is a name lookup, not a reputation signal, and it does not change how any analytics provider scores a number. Wireless carriers generally do not use the CNAM service at all, so on a consumer list most of the people you call would never see the name. The Free Caller Registry also notes that its registration data is not used to deliver caller name."),
  },
]

export default async function Page() {
  await primeLocale()

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("FAQ"), url: '/faq' },
          { name: msg("How to remove Spam Likely"), url: ROUTE },
        ])}
      />
      <JsonLd data={faqPageSchema(FAQS)} />
      <SiteHeader />
      <GutsShell rail={faqRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ REMOVING A SPAM LABEL")}</div>
            <h1>
              {t("How to get “Spam Likely”")}
              <span className="second">{t("off your number.")}</span>
            </h1>
            {/* The direct answer, self-contained, right under the H1. */}
            <p>
              {t("There is no button that deletes it. The label is a score three analytics companies keep on your number, recalculated from how your calls go. Removing it is three steps: register the number free, ask for a re-evaluation, and change the calling pattern that caused the score. Skip the third and it comes back.")}
            </p>
            <div className="guts-btns">
              <Link href="/faq/why-calls-show-spam-likely" className="guts-btn secondary">{t("WHY IT HAPPENS")}</Link>
              <Link href="/faq/how-we-keep-numbers-clean" className="guts-btn secondary">{t("HOW WE KEEP NUMBERS CLEAN")}</Link>
            </div>
            <PageStamp>{t("Updated {uPDATED}", { uPDATED: UPDATED })}</PageStamp>
          </div>
        </GutsSection>

        {/* ── BEFORE YOU PAY ANYBODY ─────────────────────────────────────── */}
        <GutsSection icon="info" title={t("First, find out what you are actually dealing with")}>
          <p>
            {t("There is no single label and no single list. Three companies score numbers for the US carriers, each carrier uses one of them, and the call-screening apps people install run their own on top. So the same number can be clean on one network and labelled on another, and a fix on one provider does not clear the others.")}
          </p>
          <ul className="guts-list good">
            <li>{t("Call your own number from a phone on each network that matters to you, and write down the exact wording you see. Spam Likely, Scam Likely, Potential Spam and Telemarketer are different labels from different systems.")}</li>
            <li>{t("Ask two or three people you actually call what they see. The label shown to a stranger is the one costing you money.")}</li>
            <li>{t("Do this before you pay anyone. A remediation service that charges you to submit the same free form is selling you the form.")}</li>
          </ul>
        </GutsSection>

        {/* ── STEP 1 ─────────────────────────────────────────────────────── */}
        <GutsSection icon="list" title={t("Step one: register the number, once, for free")}>
          <p>
            {t("The three providers jointly run the")}{' '}
            <a href="https://www.freecallerregistry.com" target="_blank" rel="noopener noreferrer">
              {t("Free Caller Registry")}</a>
            {t(". One form submits your numbers and your business details to First Orion, Hiya and Transaction Network Services at the same time, and the registry says that reaches over 400 million US wireless subscribers. There is no need to register a number more than once, and it costs nothing.")}
          </p>
          <p className="guts-note">
            {t("Read what it promises carefully, because it is unusually honest: registration does not guarantee that your calls will never be blocked or labelled. What it does is establish the number as belonging to a legitimate business rather than a bad actor, which is a data point each provider feeds into its own analysis. It is the right first step and it is not the fix.")}
          </p>
        </GutsSection>

        {/* ── STEP 2 ─────────────────────────────────────────────────────── */}
        <GutsSection icon="swap" title={t("Step two: ask for a re-evaluation")}>
          <p>
            {t("Registering says who you are. A remediation request asks the analytics networks to look at a specific number again. You submit the numbers with a plain description of what you use them for, your carrier forwards the request, and each number comes back with its own verdict rather than a single yes or no.")}
          </p>
          <p>
            {t("Our carrier is Telnyx, and its published remediation documentation names the five outcomes, which is the clearest public description of what actually happens to one of these requests:")}
          </p>
          <ul className="guts-list good">
            <li><strong>{t("Remediated.")}</strong> {t("The network re-evaluated the number and cleared it.")}</li>
            <li><strong>{t("Not flagged.")}</strong> {t("That network had nothing on it to begin with, which is how you learn the label was coming from somewhere else.")}</li>
            <li><strong>{t("Requires review.")}</strong> {t("Not cleared automatically, and now in front of a person.")}</li>
            <li><strong>{t("Refused.")}</strong> {t("Looked at, and left flagged.")}</li>
            <li><strong>{t("Ineligible.")}</strong> {t("Not submitted at all, typically because the number is inside a cooldown window from a previous request. Filing repeatedly does not speed anything up.")}</li>
          </ul>
          <ul className="guts-list warn" style={{ marginTop: 18 }}>
            <li>{t("Telnyx states plainly that submitting a remediation request does not guarantee a number will be removed from any spam or block list.")}</li>
            <li>{t("It also states that even after a number is successfully remediated, calls from it can still be blocked or labelled by downstream filters and carriers, which are outside its control.")}</li>
            <li>{t("Nobody publishes a turnaround time. Every specific number of days you will read comes from a firm selling removal.")}</li>
          </ul>
        </GutsSection>

        {/* ── STEP 3, THE ONE THAT DECIDES IT ────────────────────────────── */}
        <GutsSection icon="scale" title={t("Step three: change what got it labelled")}>
          <p>
            {t("This is the step people skip, and it is the one that decides whether the label stays off. A re-evaluation resets the verdict. It does not reset the cause. The score is recalculated from how your calls keep going, so the same pattern rebuilds the same score.")}
          </p>
          <p>
            {t("We have measured this on our own number pool rather than repeating industry advice, and the result was the opposite of what the advice says. Resting a flagged number did not heal it: numbers came back from rest worse than new ones. Cutting the volume on the number recovered it, in days.")}
          </p>
          <ul className="guts-list good">
            <li><strong>{t("Fewer calls per number per day.")}</strong> {t("Volume on a single number is the fastest way to burn it. Spreading the same campaign across more numbers costs less than remediation does.")}</li>
            <li><strong>{t("Call people who expect it.")}</strong> {t("Answer rate and how long people stay on the line are both graded. A list nobody recognises scores you down twice.")}</li>
            <li><strong>{t("Stop dialling a number that is already struggling.")}</strong> {t("Easing off early is recoverable. Running it hot until the label lands is not.")}</li>
            <li><strong>{t("Scrub against the Do Not Call Registry.")}</strong> {t("Complaints are a direct input, and the people most likely to complain are the ones who asked not to be called.")}</li>
          </ul>
          <div className="guts-btns">
            <Link href="/faq/why-we-dont-rest-flagged-numbers" className="guts-btn secondary">{t("WHAT WE MEASURED")}</Link>
            <Link href="/faq/how-to-scrub-the-do-not-call-registry" className="guts-btn secondary">{t("HOW TO SCRUB DNC")}</Link>
          </div>
        </GutsSection>

        {/* ── WHAT DOES NOT WORK ─────────────────────────────────────────── */}
        <GutsSection icon="alert" title={t("What does not work")}>
          <ul className="guts-list warn">
            <li><strong>{t("Buying a new number and carrying on.")}</strong> {t("Reputation systems grade maturity, so a run of fresh numbers rotated through reads worse than one number with a history. You buy a few weeks and a worse starting position.")}</li>
            <li><strong>{t("Setting a caller name.")}</strong> {t("CNAM is a name lookup, not a reputation signal. It changes nothing about the score, wireless carriers generally do not use it, and the registry itself notes that its data is not used to deliver caller name.")}</li>
            <li><strong>{t("Paying for guaranteed removal.")}</strong> {t("The carriers do not guarantee it, so nobody reselling access to them can. A service doing this honestly is filing the free form and chasing it for you, which is a real service at a fair price and not a guarantee.")}</li>
            <li><strong>{t("Filing again and again.")}</strong> {t("A number already in a request cannot be resubmitted, and one inside a cooldown window comes back ineligible. Repeat filings cost you the wait, not less of it.")}</li>
          </ul>
        </GutsSection>

        {/* ── WHAT WE DO ─────────────────────────────────────────────────── */}
        <GutsSection icon="check" title={t("What a dialer should be doing for you")}>
          <p>
            {t("Most of the steps above are things software can do once and keep doing, which is the argument for having the dialer handle numbers rather than bringing your own and managing the labels yourself.")}
          </p>
          <ul className="guts-list good">
            <li>{t("Every number in our pool is registered with all three providers, confirmed rather than just submitted.")}</li>
            <li>{t("No number places more than 60 calls a day, so volume never burns a caller ID in the first place.")}</li>
            <li>{t("Every number is checked daily against the rest of the pool, and one that starts slipping is slowed down automatically until it recovers.")}</li>
            <li>{t("Every call is signed at A-attestation where the carrier supports it.")}</li>
          </ul>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
            <Link href="/faq/numbers" className="guts-btn secondary">{t("NUMBERS & CALLER ID")}</Link>
          </div>
        </GutsSection>

        {/* ── THE QUESTIONS, VISIBLE ─────────────────────────────────────── */}
        <GutsSection icon="chat" title={t("Questions people ask about this")}>
          {FAQS.map((faq) => (
            <div key={faq.question} style={{ marginBottom: 22 }}>
              <h3 style={{ margin: '0 0 8px' }}>{t(faq.question)}</h3>
              <p style={{ margin: 0 }}>{t(faq.answer)}</p>
            </div>
          ))}
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
