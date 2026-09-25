# Global VS candidates

Researched 25 Sept 2026. Every figure below was read this week, and each row says
whether it came from **the vendor's own page** or only from **third parties**.
That distinction decides whether a page can ship: a /vs page built on a
software-directory's guess is one angry email from being retracted.

---

## The constraint that shapes this whole list

**DialerSeat dials US numbers only.** `lib/leadIngest` rejects anything that is
not a 10-digit US number, the pool is US area codes, and the compliance engine
is TSR and TCPA. What travels is the **agent**: a seat is $35 a week whether the
person sits in Ohio or Manila.

So a global /vs page is never "come dial Germany with us". There are exactly two
honest reasons to publish one:

1. **The offshore floor dialing US leads.** A BPO in Manila, Bogotá or Lahore
   calling American prospects is our customer today, and the tools they compare
   us against are GOautodial, VICIdial, Squaretalk, Voiso and uContact — not
   ReadyMode. This is the wedge, and [/faq/dialer-for-offshore-agents] already
   speaks to it.
2. **Search demand that does not care where the searcher lives.** "Genesys
   pricing", "Twilio Flex cost", "Zoho Voice alternative" are searched from
   everywhere, and the person reading the answer may well be a US agency.

Any page against a vendor whose market we cannot serve has to say who it is for
in the first screen. Selling to somebody we cannot onboard is worse than not
ranking.

---

## Ranked shortlist: build these first

| # | Vendor | Why this one | Price published? |
|---|---|---|---|
| 1 | **Dialfire** (DE) | The only competitor billing purely per minute with no seat fee. It is the one honest cost-per-dial comparison on the internet, and it is the comparison we are strongest in | ✅ vendor |
| 2 | **Genesys Cloud CX** (US/global) | Biggest name in the category that actually publishes prices, including an hourly rate | ✅ vendor |
| 3 | **Twilio Flex** (US/global) | Build-your-own against ready-made. Three published pricing models, all of them more expensive than they look | ✅ vendor |
| 4 | **Squaretalk** (IL/global) | A published *predictive* price, aimed at exactly the international outbound teams we want | ✅ vendor |
| 5 | **GOautodial** (PH) | What an offshore floor actually shortlists next to VICIdial. Our clearest wedge page | ⚠️ third-party |
| 6 | **Voiso** (UAE/SG) | Predictive, AMD and local caller ID in a published $52 tier. Sells hard to global outbound | ✅ vendor |
| 7 | **Zoho Voice** (IN/global) | Enormous brand, published price, power dialer but no predictive claim | ✅ vendor |
| 8 | **NICE CXone** (IL/US) | Publishes nothing. Same page shape as dialer.io: the absence is the story, and the search volume is large | ❌ none |

---

## Europe

| Vendor | Country | Dialer | Published price | Source | Verdict |
|---|---|---|---|---|---|
| **Dialfire** | Germany, EU-hosted | Predictive | **$0.0115/min** outbound landline and mobile, **$0.0050/min** inbound. **No monthly fee, unlimited users**, no minimum | ✅ vendor | **Build first.** Note their per-minute model beats a seat fee for low-volume users and loses badly for a full-time agent — that arithmetic is the page |
| **Squaretalk** | Israel, sells globally | Power + predictive | Core **$15**/user/mo annual (3-user minimum), Connect **$25** (power dialer), predictive from **$30** | ✅ vendor | **Build.** Verify the 3-user minimum on their own pricing page before publishing |
| **Voiso** | UAE / Singapore | Predictive + progressive, AMD, local caller ID | Core **$24**/user/mo, Pro **$52** (predictive included), enterprise custom. 30% off annual | ✅ vendor | **Build** |
| **MaxContact** | UK | Predictive | None. Third parties guess £25–35 or ~$80/user/mo | ⚠️ third-party | Build as a no-price page. The real content is that the UK runs on Ofcom's abandoned-call rules, not the TSR — different rulebook, and we dial the US |
| **Diabolocom** | France | Predictive | Not researched | — | Research next |
| Ringover, Aircall, CloudTalk, 3CX | FR / SK / CY | — | — | — | Already published |

## North America and global enterprise

| Vendor | Dialer | Published price | Source | Verdict |
|---|---|---|---|---|
| **Genesys Cloud CX** | Outbound included in the voice tiers | GC1 **$75**/mo or **$0.68/hr**, GC2 **$110** or **$0.99/hr**, GC3 **$140** or **$1.26/hr**. Communicate from **$19.99**. Telco usage billed on top | ✅ vendor | **Build.** The hourly rate is the interesting bit: it invites a direct per-dialing-hour comparison |
| **Twilio Flex** | Whatever you build | **$1** per active user hour, or **$35** per monthly active user plus usage, or **$150** per named user. 5,000 free hours | ✅ vendor | **Build.** $150 a named user against $35 a week, and ours arrives finished |
| **NICE CXone / Mpower** | Predictive | None published. Usage-based, tiered, quoted | ❌ none | Build as a no-price page |
| **Zoom Contact Center** | Outbound dialers in the mid tiers | Essentials from **$69**/mo; tier detail thin on the public page | ⚠️ partial | Verify the tier that carries outbound, then build |
| **8x8** | Predictive | Contact center is mix-and-match, not published | ❌ none | Low priority |
| Five9, Talkdesk, RingCentral, Dialpad, Aircall | — | — | — | Already published |

## Asia and India

| Vendor | Country | Dialer | Published price | Source | Verdict |
|---|---|---|---|---|---|
| **Zoho Voice** | India, sells globally | Power dialer. No predictive claim found | Contact Center **$74**/user/mo annual, **$79** monthly. A $49/mo Zoho-customer plan bundles 10 agents | ✅ vendor | **Build.** The angle is that a $74 seat still has no predictive dialing |
| **CallHippo** | India / global | Power and parallel dialer, AMD, local presence | Basic **$1**, Starter **$19**, Professional **$29**, Ultimate **$45** per user/mo | ✅ vendor | **Build.** Cheapest published ladder in the category, and useful to compare honestly rather than dismiss |
| **Ozonetel CloudAgent** | India | Predictive, progressive, preview | None. Third parties say ₹1,500–3,500/agent/mo | ⚠️ third-party | Skip or no-price page |
| **Exotel / Ameyo** | India | Predictive | None. "Contact us" | ❌ none | Skip for now |
| **Runo** | India | Auto dialer, telecalling CRM | **₹599**/user/mo annual | ✅ vendor | Low priority: no overlap with US dialing, pure search volume |
| **NeoDove** | India | Auto dialer | Not published | ❌ none | Skip |
| **Bitrix24** | Global, huge in EU and LatAm | Auto dialer inside the CRM | Telephony only on paid plans; numbers **$4–11**/mo in 43 countries; SIP connector **$49**/mo. Plan tiers need verifying | ⚠️ partial | Research the plan tiers, then build — the installed base is enormous |

## Southeast Asia: the offshore wedge

| Vendor | Country | Dialer | Published price | Source | Verdict |
|---|---|---|---|---|---|
| **GOautodial** | Philippines | Predictive (VICIdial lineage) | GOcloud Starter **$29**/agent/mo, Premium **$34** with a 3-agent minimum | ⚠️ third-party | **Build**, after confirming on their own portal. This is the page an offshore floor is actually searching for |
| VICIdial | Global open source | — | — | — | Already published |

## Latin America

| Vendor | Country | Dialer | Published price | Source | Verdict |
|---|---|---|---|---|---|
| **uContact** (Integra CCS) | Uruguay | Predictive | Voice **$59.99**/user/mo, Omni **$84.99**. Implementation reported at $1,000+ | ⚠️ third-party | Build once the vendor confirms. The implementation fee is the story |
| **wolkvox** | Colombia | Predictive, 10x pacing | Modular, no per-agent figure published. No minimum agents | ❌ none | No-price page or skip |
| **3C Plus** | Brazil | Predictive | Has a public pricing page we have not extracted yet | ⚠️ unread | Research next |

## Australia and New Zealand

| Vendor | Country | Dialer | Published price | Source | Verdict |
|---|---|---|---|---|---|
| **ipSCAPE** | Australia | Predictive on the middle tier | Connect **A$89**, Converse **A$139** (predictive), Converge **A$159** per user/mo. Standard contract reported as **36 months** | ⚠️ third-party | **Build** once verified. A 36-month contract against weekly billing writes itself |

---

## Before any of these ship

- **Verify every ⚠️ row against the vendor's own page.** Third-party directories
  are wrong often enough that one bad figure would make the other 29 comparison
  pages look like guesses.
- **Say who the page is for.** Every one of these vendors sells into countries we
  cannot dial. One line near the top: DialerSeat dials the US, from anywhere.
- **Do not import their compliance rules.** Ofcom in the UK, ACMA in Australia
  and the EU's national regimes all cap abandoned calls differently from the
  TSR. We are not subject to them and must not imply otherwise.
- **Keep the pattern.** A new entry in `lib/competitors.ts` feeds the /vs page,
  the sitemap, /md and /llms-full.txt on its own; only `app/vs/<slug>/page.tsx`
  and the hub entry in `app/vs/view.tsx` are written by hand.

## Still unpriced, still excluded

Vulcan7 publishes no figure of any kind — three plan names, "no long-term
contract", 20% off annual, and no dollar amount. Same shape as dialer.io, so the
page is writable the same way whenever we want it.
