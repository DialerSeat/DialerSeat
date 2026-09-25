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
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const baseMetadata: Metadata = {
  title: 'How We Keep Compliance | DialerSeat',
  description:
    'The exact mechanisms DialerSeat uses to enforce TCPA and FTC TSR rules in software: calling-time windows, abandon-rate monitoring, auto-degrade, AMD, STIR/SHAKEN, and record retention.',
  alternates: { canonical: 'https://dialerseat.com/faq/how-we-keep-compliance' },
  openGraph: {
    title: 'How We Keep Compliance',
    description:
      'The compliance enforcement layer of DialerSeat, explained without marketing fluff. What runs in software, what falls on the seller, and how the auto-degrade controller actually works.',
    url: 'https://dialerseat.com/faq/how-we-keep-compliance',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How We Keep Compliance',
    description: 'The compliance enforcement layer of DialerSeat, explained without marketing fluff. What runs in software, what falls on the seller, and how the auto-degrade controller actually works.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

export default async function Page() {
  await primeLocale()
  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: msg("Home"), url: '/' },
        { name: msg("Faq"), url: '/faq' },
        { name: msg("How We Keep Compliance"), url: '/faq/how-we-keep-compliance' },
      ])} />
      <>
      <SiteHeader />
      <GutsShell rail={faqRail('/faq/how-we-keep-compliance')} activeHref="/faq/how-we-keep-compliance">
      <div className="exp-root">
        <ExplainerStyles accent="#8a6a1a" accentBg="#fdf4e8" />

        <section className="exp-hero">
          <div className="exp-hero-inner">            <div className="exp-eyebrow">{t("COMPLIANCE · HOW IT WORKS")}</div>
            <span style={{ fontSize: 11, color: "#8888aa", letterSpacing: "2px", display: "block", marginBottom: 16 }}>{t("LAST UPDATED 09/25/2026")}</span>
            <h1>{t("How we keep compliance.")}</h1>
            <p className="exp-lead">
              {t("The exact mechanisms DialerSeat uses to enforce TCPA and FTC TSR rules in software. The receipts page for the \"we take compliance seriously\" claim.")}</p>
          </div>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">{t("▸ THE PRINCIPLE")}</div>
          <h2>{t("Compliance is the floor, not a feature.")}</h2>
          <p>
            {t("Most dialers treat compliance settings the way airlines treat seat selection: technically available, but inconveniently buried, and you can opt out for any reason. We took the opposite approach. Every rule on this page is enforced at the")}<em> {t("architecture")}</em> {t("level, which means it's not a checkbox in a settings panel that someone can disable at 11 PM on a quarter-end deadline. It just happens.")}</p>
          <p>
            {t("That principle is the whole point. If you'd like the broader context: why these rules exist, who wrote them, and why so many incumbents treat the fines as a cost of doing business, read")}{" "}<Link href="/faq/why-is-compliance-important">
            {t("why is compliance important?")}</Link> {t("first.")}</p>
          <div className="exp-pullquote">
            {t("The right way to evaluate a dialer's compliance posture isn't to ask whether it")}{" "}<em>{t("can")}</em> {t("be configured safely. It's to ask whether it")}{" "}<em>{t("can")}</em> {t("be configured unsafely. The fewer footguns the platform offers, the safer you are.")}</div>
        </section>

        <section className="exp-section alt">
          <div className="inner">
            <div className="exp-section-label">{t("▸ THE MECHANISMS")}</div>
            <h2>{t("Every rule, every enforcement point.")}</h2>

            <h3>{t("1. Calling-time window enforcement")}</h3>
            <p>
              {t("The TCPA prohibits outbound calls before 8 AM or after 9 PM in the called party's local time zone. DialerSeat dials 9 AM to 9 PM, an hour inside the federal start. Before every dial, we resolve the lead to its time zone (from its state, or its area code when the state is missing) and check the current local time at that lead's location.")}</p>
            <p>
              {t("If the lead is currently outside its calling window, the dial doesn't fire. The skip is logged against the lead as")}<code>TCPA_BLOCKED</code> {t("with the timestamp, the lead stays in the queue for when its window opens, and the campaign engine advances to the next eligible lead automatically. The agent doesn't have to think about it, and there's no setting to disable this.")}</p>
            <p>
              {t("Florida is stricter, and we hold Florida leads to Florida law: calls end at 8 PM their time, and no number gets more than three calls in 24 hours (Fla. Stat. 501.616(6)). A Florida lead that has had its three waits until the 24 hours are up.")}</p>

            <h3>{t("2. Predictive abandon-rate monitoring")}</h3>
            <p>
              {t("For predictive campaigns, the abandon rate is the number that matters. The FTC TSR caps abandoned calls at 3% of answered calls, measured on a rolling 30-day window. Cross that line and the safe harbor evaporates.")}</p>
            <p>
              {t("Our pacing controller computes each campaign's 30-day abandon rate from its own call records before every round it dials, and sets the number of lines from it: as many as keep the projected rate at or under 2%. The live rate is displayed on the agent terminal so nobody has to log into an admin panel to see where they stand.")}</p>

            <h3>{t("3. Auto-degrade at 2.5%")}</h3>
            <p>
              {t("The legal cap is 3%, but waiting until you're at 3% to intervene is too late. When the rolling rate hits")}<strong> 2.5%</strong>{t(", the controller automatically degrades the campaign to 1× lines per agent (effectively progressive mode). One line can't abandon anyone. A line only comes back when the 30-day record, plus what that line could add, is projected to stay under")}{" "}<strong> 2.0%</strong>{t(", and the campaign climbs back toward the configured multiplier as its record allows.")}</p>
            <p>
              {t("That 0.5% buffer is deliberate. It means a sudden answer- rate spike: caused by a bad list, a great script, or a statistical fluke, gets caught at 2.5% rather than at 3.1%. You should never see your campaign cross the legal threshold even under abnormal conditions.")}</p>

            <h3>{t("4. The multi-line gate")}</h3>
            <p>
              {t("Every extra line is a chance that two people answer at once, and only one of them can reach the agent. So a second line has to be earned. A new campaign dials one line per agent, which can't abandon anyone, and adds lines only when its own 30-day record can absorb a surplus answer and still be projected under 2%. The more people a campaign has already reached, the more lines it can carry.")}</p>
            <p>
              {t("Predictive also needs your business name and callback number, entered once in Settings (the dialer asks the first time you pick predictive), because the recorded notice below can't be played without them. Until both are set, predictive doesn't run. Agents pick 2 or 3 lines. When the dialer runs fewer lines than you asked for, it says which rule is holding it, so nobody is surprised.")}</p>

            <h3>{t("5. AMD on progressive and predictive")}</h3>
            <p>
              {t("Answering Machine Detection runs on every progressive and predictive call by default, via Telnyx's native call detection, with the same settings in both modes. Calls connect the moment they're answered, so a real person never waits in silence while a detector decides. When it hears a machine, the agent is released to the next lead and the call drops server-side. Machines never count as answered, which means the abandon-rate math isn't polluted by phantom \"answered\" calls that are just voicemail greetings.")}</p>
            <p>
              {t("The AMD result is stored on every call record.")}{" "}<Link href="/faq/how-does-amd-work">
              {t("How AMD works")}</Link> {t("has the full breakdown.")}</p>

            <h3>{t("6. Ring duration ≥ 15 seconds")}</h3>
            <p>
              {t("Per § 310.4(b)(4)(ii) of the TSR safe harbor, and the FCC's rule at 47 CFR 64.1200(a)(6), an unanswered call must ring for at least 15 seconds (or 4 rings) before being treated as no-answer. Our outbound calls are configured to honor this duration: predictive lines ring for 20 seconds, progressive for 30 to 43, preview and power for up to 60. A predictive line is never hung up while it rings, not even when you press stop.")}</p>

            <h3>{t("7. Recorded notice on abandoned calls")}</h3>
            <p>
              {t("When a person answers and their agent is already on a call, a teammate who is running predictive on the same team campaign and is free takes them instead. When an abandoned call")}<em>{t("does")}</em> {t("occur, meaning a human answered and no agent was available within 2 seconds, the TSR safe harbor requires a brief recorded notice with the seller's name and phone number, per § 310.4(b)(4)(iii), and the FCC adds that it must say the call is telemarketing and offer an automated opt-out. Ours names your business, says it's a telemarketing call, gives your callback number, and offers press 9 to be added to your do-not-call list. Pressing 9 adds the number and ends the call. The notice is built from the business name and callback number in your Settings (the team owner's, on a team campaign), with no generic fallback.")}</p>

            <h3>{t("8. STIR/SHAKEN attestation")}</h3>
            <p>
              {t("Outbound calls placed through DialerSeat go through Telnyx, which attests calls at the A level where the call path supports it. This is the carrier-level proof-of-identity that downstream carriers use to decide whether to label your call as spam, \"Likely Scam,\" etc. A-level attestation doesn't eliminate spam-labeling risk, and attestation level can vary by number, route, or downstream carrier, it's the strongest level available, not a guarantee for every call.")}</p>

            <h3>{t("9. Records: no expiry, exportable")}</h3>
            <p>
              {t("Every dial attempt, AMD result, agent assignment, disposition, abandon event, and calling-window skip is stored with no expiry: nothing in the platform ages them out while your account is open. The TSR asks sellers to keep call records for five years (§ 310.5). Call records export to CSV from your dashboard's Compliance tab, a year at a time, for compliance audits, internal QA, or any other reason you need them.")}</p>
            <p>
              <strong>{t("Call recordings are the one exception:")}</strong> {t("they're retained for 30 days, then automatically deleted (see our")}{' '}
              <Link href="/privacy#data-retention">{t("Privacy Policy")}</Link>{t("). Download recordings before the 30-day window closes if you need to keep them longer: the surrounding call record (disposition, duration, AMD result, timestamps) stays in your dashboard regardless.")}</p>
          </div>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">{t("▸ HONEST DISCLOSURE")}</div>
          <h2>{t("What we don't do for you.")}</h2>
          <p>
            {t("Compliance is a layered problem. The list above covers the dialer-side layers, the parts that have to happen during the call itself, on the platform that places the call. There are other compliance layers that fall on you, the campaign owner, and which no dialer software can fully automate:")}</p>
          <div className="exp-cards">
            <div className="exp-card">
              <h3>{t("CONSENT RECORDS")}</h3>
              <p>{t("The seller is responsible for prior express written consent. We store consent metadata per-lead so you can show it on demand, but you supply the consent itself.")}</p>
            </div>
            <div className="exp-card">
              <h3>{t("NATIONAL DNC SCRUBBING")}</h3>
              <p>{t("You are responsible for scrubbing your list against the National DNC Registry before upload. We're evaluating commercial DNC integrations; not in yet.")}</p>
            </div>
            <div className="exp-card">
              <h3>{t("LITIGATOR SCRUBBING")}</h3>
              <p>{t("Commercial databases of known TCPA plaintiffs exist. Scrubbing against them is industry best practice for high-volume dialers. Not integrated yet.")}</p>
            </div>
            <div className="exp-card">
              <h3>{t("STATE-SPECIFIC RULES")}</h3>
              <p>{t("The 8 AM-9 PM window is federal. We dial 9 AM-9 PM everywhere, and hold Florida to its 8 PM end and three calls a day. Other states' stricter rules (call frequency caps, holiday restrictions, registration requirements) are on you.")}</p>
            </div>
          </div>
          <p style={{ marginTop: 24 }}>
            {t("We list these openly because that's how we'd want a platform to talk to us. A dialer that claims to handle every layer of compliance for you is either lying or charging you a lot more than $35/week.")}</p>
        </section>

        <section className="exp-section alt">
          <div className="inner">
            <div className="exp-section-label">{t("▸ IN PRACTICE")}</div>
            <h2>{t("Three scenarios.")}</h2>

            <h3>{t("Scenario A: You upload a list at 11 AM ET")}</h3>
            <p>
              {t("Your list contains 5,000 leads across all four U.S. time zones. When dialing starts, the system filters in real-time: leads currently in their local 9 AM-9 PM window are eligible, leads outside it are skipped with")}{" "}<code>TCPA_BLOCKED</code> {t("and re- queued for when they enter their window. By 2 PM Pacific you'll have called a different mix than you did at 11 AM Eastern. The agent never thinks about it.")}</p>

            <h3>{t("Scenario B: Predictive abandon rate spikes")}</h3>
            <p>
              {t("You're running predictive at 2.0× with 6 agents. A campaign on a Tuesday afternoon hits an unusually high answer rate, maybe a fresh batch of warm leads dropped in and your in-flight calls outpace agents being free. The 30-day rolling abandon rate ticks up to 2.51%. Before its next round, the controller cuts you back to 1.0× lines. You keep dialing, but as progressive, not predictive. When the 30-day average works its way back down, far enough that a second line is projected to keep you under 2.0%, you resume 2.0× automatically.")}</p>

            <h3>{t("Scenario C: You get an audit request")}</h3>
            <p>
              {t("An attorney asks for records of every call placed to a specific phone number over the last 12 months. You export the campaign's calls from the Compliance tab to CSV, filter it to that number, and see every dial timestamp, AMD result, agent who took the call, disposition, and whether it was abandoned. Hand it over. You did the right things, you have the proof.")}</p>
          </div>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">{t("▸ THE BOTTOM LINE")}</div>
          <h2>{t("The platform should make doing the right thing the default.")}</h2>
          <p>
            {t("That's the design philosophy. Compliance shouldn't require expert knowledge of 16 CFR 310. It shouldn't require remembering to flip a switch. It shouldn't require trusting that your agents will check the lead's time zone before every dial. It should just be how the platform behaves.")}</p>
          <p>
            {t("We obviously can't guarantee your compliance, that depends on what you actually do with the platform, what consent you have, what state you're calling into. But we can guarantee that the dialer itself won't be the reason you end up in trouble. That's the line we drew, and we held it.")}</p>
        </section>

        <ExplainerCrossLinks current="compliance-how" />

        <DialingModeCTA
          headline="Compliance you don't have to babysit."
          description="The 3% cap, the 9 AM-9 PM window, AMD, STIR/SHAKEN, records with no expiry: enforced in software, not in policy docs. $35/week per seat, every mode included."
        />
        </div>
      </GutsShell>
      <SiteFooter />
    </>
    </>
  )
}