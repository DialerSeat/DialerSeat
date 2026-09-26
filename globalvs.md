# Global VS candidates

Researched 25 Sept 2026. Every figure says whether it came from **the vendor's
own page** (✅) or only from **third parties** (⚠️). That decides whether a page
can ship: a /vs page built on a software directory's guess is one angry email
from being retracted.

---

## What we can actually dial today

Read out of the code, not assumed, because it decides what every page below is
allowed to say.

| Country | Calling window | Caller ID | Can we dial it? |
|---|---|---|---|
| **United States** | Per state, server-side | 21 pool numbers across 11 states, matched to the lead | **Yes**, fully |
| **United Kingdom** | Implemented (`lib/internationalCallingWindow`): Mon–Fri 8–21, Sat 9–21, no Sunday, as industry guidance rather than statute | No UK numbers. A UK mobile would see a US caller ID | **Half.** Windows yes, presence no |
| **Australia** | Implemented: Mon–Fri 9–20, Sat 9–17, no Sunday, per the ACMA Industry Standard 2017 | No AU numbers | **Half** |
| **France** | Implemented: Mon–Fri 10–13 and 14–20, no weekends (décret 2022-1313) | No FR numbers | **Half** |
| **Canada** | **None.** `lib/callingWindow` recognises a Canadian area code and holds the lead back: "Canadian calling rules are not enforced by this dialer" | — | **No, by design** |
| Rest of world | Conservative fallback rule | — | Not really |

Two more things gate the half-built ones: Telnyx rejects any destination not on
the Outbound Voice Profile's whitelist (the D13 path in `placeOutboundCall`), and
the pool is US-only, so an international call goes out with an American caller ID
— the worst possible answer rate.

**So the honest positioning, today, is: DialerSeat dials the US, from anywhere.**
What travels is the agent, at $35 a week whether they sit in Ohio, Manila,
Toronto or Manchester. Every page below has to be written for one of:

1. **A floor outside the US dialing American leads.** Manila, Bogotá, Toronto,
   Lahore. This is real revenue today and [/faq/dialer-for-offshore-agents]
   already speaks to it.
2. **Search demand that does not care where the reader sits.** "Genesys
   pricing", "ipSCAPE alternative", "CloudCall pricing" get searched from
   everywhere, often by Americans.

Never "come dial Britain with us" until there are British numbers in the pool.

> **Product finding from this research.** A Canadian number passes lead import —
> `normalisePhone` accepts any 10 digits, and NANP numbers are 10 digits — and
> is then blocked at dial time, forever. Somebody can upload 5,000 Toronto leads
> and watch none of them dial. Rejecting them at import with the reason would
> cost one lookup against the area-code table.

---

## The argument, once the pool is global

**Not shipped. Nothing below may appear on the site until it is.** Written down
now because it decides which /vs pages are worth building, and because it is a
different argument from the US one.

### The shape of the change

The product does not change. Same four dialing modes, same seat, same price.
What changes is the pool: numbers activate for the countries a campaign's leads
are actually in, and the lead sheet is read for numbers that are not American.
**Every account gets every country.** No regional edition, no international tier,
no add-on.

### The claim nobody else on this list can make

**One seat price, every country, all four modes.** Everyone else treats crossing
a border as a place to price:

| Vendor | What international costs |
|---|---|
| Ringover | Local numbers in 30+ countries, but only on the Business plan |
| CloudCall | "Unlimited" is UK and Ireland only, premium prefixes excluded |
| Voiso | Local caller IDs are in the $52 Pro tier |
| Bitrix24 | Numbers priced **$4–11/month depending on country** |
| Genesys | Seat price, then telco usage billed on top |
| Amazon Connect | $0.045/min + $0.005/communication + telephony, per destination |
| Twilio Flex | Every model is seat-or-hour **plus** usage |
| Talkdesk | $225 Industry Clouds, dialer still unpriced |

### The centrepiece: per-seat wins hardest where per-minute hurts most

This inverts our one real weakness. Domestically a per-minute vendor beats us for
a light dialer — Dialfire is $0.0115 a minute with no seat fee. But that is a
**US** rate. The expensive part of global calling is mobile termination outside
North America, and every per-minute vendor passes it straight to the customer.

A flat weekly seat does not move when the destination does.

| | US-only dialing | International dialing |
|---|---|---|
| Per-minute vendors | Genuinely competitive | Cost climbs with every destination |
| Tiered vendors | Comparable | A higher tier just to dial abroad |
| **DialerSeat** | Mid-pack on price | **The price does not change at all** |

Carrier cost stays ours to manage on the back end. The customer's number is
fixed. The more international the operation, the better we look — and that is
precisely the segment we have nothing to sell today.

### The three that come with it

- **One campaign, mixed countries, no setup.** The lead sheet is the interface:
  a number's country picks the pool number and the legal window. Enterprise
  platforms treat adding a country as a project.
- **Predictive everywhere, not as an upgrade.** Voiso gates it behind Pro,
  Squaretalk behind its predictive plan, Nextiva behind a quoted contact-center
  tier, Talkdesk behind an unpriced add-on. Zoho has no predictive at $74.
- **The smallest purchase in the category stays smallest.** $35 for one seat for
  one week, against $1,080 committed at Squaretalk, $1,692–2,052 at Ringover,
  A$5,004 per seat over ipSCAPE's 36-month term.

### Be honest about where it does not hold

- **Light dialing.** Dialfire is cheaper for a few hours a week and we should say
  so rather than be caught at it.
- **Domestic work in low-cost currencies.** Runo is ₹599 a month. We will not win
  Indian domestic telecalling on price; the pitch there is Indian agents on US
  leads.
- **Omnichannel and workforce management.** Genesys, Talkdesk and NICE do things
  we do not.
- **A company phone system.** Nextiva, RingCentral and CloudCall win that.

### What stands between here and there

Two of these are pool and account work, not product:

1. **Number provisioning is a paperwork queue, not a switch.** Telnyx holds
   carrier licences in 30+ countries and sells numbers in 130+, but many
   countries require the end user's name, address and a valid ID before a number
   activates, and some want proof of local presence such as a utility bill.
   Verification takes working days. "Every country" means every country we have
   cleared.
2. **Telnyx destination whitelisting**, on the Outbound Voice Profile. The dial
   path already detects that rejection and names the fix.

One is a genuine software change, and it is small:

3. **The UK abandon clock.** Ofcom measures 3% per campaign per **24 hours**;
   our engine measures 3% per campaign over **30 days**. A 30-day average of 2%
   can hide a single day at 8% — legal in the US, a breach in Britain. A second
   window on the same counter, not a rewrite. Until it exists, no UK page may say
   compliance is enforced for a UK campaign.

And one is a decision rather than a build: **access to every country is not
permission in every country.** Germany requires documented prior consent for B2C
marketing calls whatever the hour. The consistent position is the one we already
take on DNC scrubbing — give the access, enforce the hours we know, say plainly
whose duty the rest is.

---

## Ranked shortlist: build these first

| # | Vendor | Country | Why | Price |
|---|---|---|---|---|
| 1 | **Dialfire** | Germany | Pure per-minute, no seat fee. The only true cost-per-dial comparison in the category | ✅ |
| 2 | **Amazon Connect** | Global | Per-minute, published to the cent, and the default answer when somebody says "we'll just build it on AWS" | ✅ |
| 3 | **Genesys Cloud CX** | Global | Biggest name that publishes, and it publishes an hourly rate | ✅ |
| 4 | **ipSCAPE** | Australia | A **36-month standard contract** against weekly billing. Writes itself | ✅ |
| 5 | **CloudCall** | UK | Published in pounds, power dialler on the £25 tier | ✅ |
| 6 | **Twilio Flex** | Global | $150 a named user, and you still have to build it | ✅ |
| 7 | **Squaretalk** | Israel | Published *predictive* price, aimed at international outbound | ✅ |
| 8 | **GOautodial** | Philippines | What an offshore floor shortlists beside VICIdial | ⚠️ |

---

## Where outbound dialing actually happens

Researched 26 Sept 2026. Telnyx facts and the named regulations are ✅ sourced
this week. The industry descriptions are trade knowledge, not sourced, and are
marked 🟡 — good enough to rank markets, not good enough to publish.

### Two different markets, and confusing them wastes a year

Every country below is one or both of:

- **A number market** — people there dial their own countrymen. Needs local
  numbers, local law, local presence.
- **An agent market** — floors there dial somebody else's countrymen, nearly
  always Americans or the British. Needs seats and a browser. **Nothing else.**

The Philippines has one of the largest dialing industries on earth and almost no
domestic telemarketing worth selling into. It is an agent market, and we can
serve it today, at $35 a week, with no globalization at all. India is both, and
the two halves have opposite answers. Getting this backwards means buying numbers
for a country whose value to us was its people.

### What Telnyx actually offers ✅

- **Termination: "Telnyx offers termination in every country."** Their words, in
  the help centre. Outbound calling is not the constraint anywhere.
- **Numbers: 108 countries** in the help-centre coverage list; the marketing
  pages claim 140+ and **131 countries with inbound voice**. Carrier licences
  held directly in **30+**.
- **Documentation gates activation.** Name, address and a valid ID for the end
  user; some countries additionally want proof of local presence such as a
  utility bill. **Ten days to supply it or the number is removed**, and
  verification takes working days.
- **India carries a 12-month minimum commitment** on any India number.
- **Their fraud controls are our controls too**: whitelist destinations by
  country or region, cap the maximum destination rate, cap daily spend. Telnyx
  itself blocks revenue-share and toll-pumping prefixes.

### Tier 1 — number markets worth opening, in order

| Country | Why | Telnyx numbers | Rules |
|---|---|---|---|
| **United Kingdom, Ireland** | Mature outbound culture, English, our own agents can serve it 🟡 | ✅ | Ofcom: 3% abandoned per campaign per **24 hours** — the one real code change |
| **Australia, New Zealand** | Real outbound industry, English 🟡 | ✅ | ACMA standard, **already implemented** |
| **Canada** | Adjacent market, shared time zones, NANP 🟡 | ✅ | CRTC: 5% per calendar month, 9:00–21:30 weekdays |
| **Spain, Italy, Portugal** | Large domestic telemarketing, Italy heavily regulated 🟡 | ✅ | National regimes; Italy's registry is strict |
| **Brazil** | One of the biggest domestic telemarketing markets anywhere 🟡 | ✅ | Não Me Perturbe extended to **all** operators from November; the mandatory **0303 telemarketing prefix was abolished in August** because consumers auto-rejected it, in favour of call authentication ✅ |
| **Mexico, Colombia, Chile, Peru, Argentina** | Domestic dialing plus the nearshore floors 🟡 | ✅ | Per-country registries |
| **France** | Real market, hardest hours in the world | ✅ | **Mon–Fri 10–13 and 14–20 only, no weekends**, already implemented |
| **Poland, Romania, Turkey, Greece** | Domestic dialing and outsourcing hubs 🟡 | ✅ | Varies |
| **South Africa** | Domestic plus UK-facing floors 🟡 | ✅ | POPIA |
| **Japan, South Korea, Taiwan** | See below — real markets, hard rules | ✅ | See below |
| **Indonesia, Vietnam, Thailand, Malaysia** | Growing domestic telemarketing 🟡 | ✅ mostly | Not researched |

### Tier 2 — agent markets, where the seat sells and numbers do not

These need no globalization at all. We can sell here **today**, and
[/faq/dialer-for-offshore-agents] is the page that does it.

**Philippines** (the largest), **India**, **Pakistan**, **Bangladesh**, **Sri
Lanka**, **Nepal** · **Mexico**, **Colombia**, **Guatemala**, **El Salvador**,
**Honduras**, **Nicaragua**, **Costa Rica**, **Dominican Republic**, **Jamaica**
· **South Africa**, **Kenya**, **Egypt**, **Morocco**, **Tunisia**, **Ghana** ·
**Poland**, **Romania**, **Bulgaria**, **Serbia**, **North Macedonia**,
**Albania**, **Ukraine**, **Georgia** 🟡

Morocco and Tunisia dial France; South Africa dials Britain; Albania and North
Macedonia dial Italy; the rest overwhelmingly dial the United States.

### Where the agents are — the market that needs no globalization

We sell seats, and a seat is a browser. This list is not about dialers at all:
it is where the **people** are. Every country here can be sold to today, at $35
a week, with the product exactly as it stands.

| Country | Workforce | Serves | Language |
|---|---|---|---|
| **Philippines** | **~1.9M IT-BPM workers**, of which **1.68M in contact centres**, per IBPAP and CCAP, heading for ~1.73M in 2026 ✅ industry-reported | US, AU, UK | English |
| **India** | The other giant. Domestic telecalling plus US/UK voice 🟡 | US, UK | English, Hindi |
| **Colombia** | **600,000+ BPO workers** per the Colombian BPO association ✅ industry-reported. The leading nearshore destination for bilingual voice | US (EN + ES) | Spanish, English |
| **Mexico** | **100,000+ call-centre agents** nearshore ✅ industry-reported; the closest large pool to the US | US, LatAm | Spanish, English |
| **Argentina, Brazil, Chile, Peru** | Large placements share — one report puts Argentina at 21% and Brazil at 14% of LatAm placements ✅ | US, LatAm | Spanish, Portuguese |
| **Guatemala, El Salvador, Honduras, Nicaragua, Costa Rica, Dominican Republic, Jamaica** | The rest of nearshore 🟡 | US | English, Spanish |
| **Pakistan, Bangladesh, Sri Lanka, Nepal** | Cheapest English-capable voice labour anywhere 🟡 | US, UK | English |
| **South Africa, Kenya, Ghana, Nigeria** | South Africa is the established UK-facing pool 🟡 | UK, US | English |
| **Egypt, Morocco, Tunisia** | The francophone pools 🟡 | France, Gulf | French, Arabic, English |
| **Poland, Romania, Bulgaria, Serbia, North Macedonia, Albania, Ukraine, Georgia** | European multilingual outsourcing 🟡 | DACH, Italy, Nordics, UK | German, Italian, Polish, Russian |
| **Malaysia, Vietnam, Indonesia** | Growing, mostly APAC-facing 🟡 | APAC | English, local |

### The economics, and a claim of ours that needs correcting

Nearshore Latin American voice is reported at **$12–18 per agent hour fully
loaded** ✅. A $35 weekly seat across a 40-hour week is **$0.88 an agent hour** —
about 5% of the labour cost. Nobody in that market is deciding on the software
price; they are deciding on whether the software loses them the client.

Further offshore the ratio inverts, and that is where price decides. A Philippine
agent earns roughly **₱18,000–28,000 a month** ✅ — call it $300–500 🟡 at
current rates. A $250-a-month enterprise seat is then **half to four-fifths of
what the person earns**, which is why those floors run VICIdial on a VPS instead.

> **Flag.** /faq/dialer-for-offshore-agents and /faq/teams-how-it-works both say
> that at $95–$250 a seat a month "an offshore floor costs more in software than
> in wages". Against Philippine wages that is an overstatement — it is a large
> fraction, not more. It is true in Pakistan or Bangladesh. Worth narrowing the
> sentence to the countries where it holds, or softening it to "a serious
> fraction of the wage", because it is the one number on those pages a BPO owner
> can check in their head.

### Who actually buys

Three different buyers, and only two of them are ours:

- **The BPO buys its own stack.** Small and mid-size agencies, 2–50 seats.
  **This is our buyer**: they staff up for a campaign, they cannot sign a
  36-month contract against a 90-day client contract, and weekly billing is
  built for exactly that shape.
- **The US client mandates the stack** and often pays for it. Then the sale is
  to the American company, and the offshore floor is just where the seats get
  used. Also ours, through the existing US pages.
- **The enterprise BPO with 5,000 seats** runs Genesys or Avaya under a master
  agreement. Not ours, and never will be.

### The four markets with rules that change the product

**India** — the largest dialing culture on earth, and the one place our core
feature cannot work. Telnyx states that calls terminating to India **bearing a
CLI from India, or no CLI at all, are rejected by local operators**; they
recommend an international caller ID different from the destination country ✅.
Local presence is the thing we are best at, and in India it is prohibited by the
receiving carriers. Add the 12-month number commitment and the TRAI/DLT
registration regime, and India is an **agent market only**. That is not a
disappointment: its agent market is enormous.

**United Arab Emirates** — a serious dialing culture, mostly real estate 🟡, and
the rules are now specific ✅: prior TDRA approval to telemarket at all, calls
only from **numbers registered under the company's own commercial licence**,
9:00–18:00 only, a national Do Not Contact Register, records of every call, and
fines reported up to roughly $41,000. Telemarketing from personal numbers has
been illegal since August 2024. **A shared pool is structurally illegal there** —
the number must belong to the calling company. Closed to us unless we sell
dedicated, customer-owned numbers.

**South Korea** — a large outbound industry, insurance and telco especially 🟡,
under an opt-in regime for mobile since 2005 ✅. Telemarketers must disclose
**how and where they obtained the number**, financial-product calls must be
recorded and retained, and PIPA reaches foreign businesses targeting Korean
consumers. Buildable, but "where did you get my number" has to be answerable per
lead — which our consent fields already carry.

**Japan** — under the Act on Specified Commercial Transactions, the caller must
state, **before soliciting**, the seller's name, the solicitor's name, the
product, and that the purpose of the call is solicitation; re-soliciting anyone
who has declined is prohibited; eight-day cooling off ✅. That is a scripted
opening enforced by law, which is a script feature, not a dialer feature.

**China** — treat as closed. Foreign-operated outbound telemarketing and VoIP
termination are heavily restricted, and nothing here was verified. Do not put it
on a list of supported countries on the strength of a coverage map.

### The underground ones

They exist, they are large, and the answer is no — for a reason that is
architectural rather than moral posturing.

Known concentrations 🟡: **Jamaica** (lottery scams aimed at American seniors),
**India** (tech-support scams, Kolkata and Noida), **Myanmar, Cambodia and Laos**
(trafficking-run scam compounds), **Albania and Kosovo** (Italian-language),
**Nigeria and Ghana**. Every one of these also contains legitimate BPO work,
which is the whole difficulty.

Why we cannot take the revenue:

- **Our pool is shared.** One fraud operation dialing from it burns the answer
  rate and the reputation of every number every other customer dials from. We
  sell against shared pools on /faq/numbers precisely because of this. It is the
  single fastest way to destroy the product.
- **Telnyx polices it and our account is the business.** They block revenue-share
  and toll-pumping prefixes, and a fraud incident risks the account the entire
  platform runs on.
- **STIR/SHAKEN attestation is an identity claim we make.** Attesting for a
  fraud operation is our signature on their call.

**Screen operations, not nationalities.** A country blacklist would cut Manila
and Bogotá, which are our best legitimate markets, while missing a Florida boiler
room entirely. The controls that actually work are signup friction, a real
business identity before predictive is unlocked — which the seller-name gate
already is — and watching the numbers: a floor with a collapsing answer rate
across every number it touches is either incompetent or lying about what it
dials.

---

## Canada

**Nobody is going to out-compete us here on software, because the market runs on
American tools — and the one significant Canadian vendor is one we already
cover.**

| Vendor | Based | Dialer | Published price | Src | Verdict |
|---|---|---|---|---|---|
| **Readymode** (ex-XenCall) | **Vancouver, BC** | Predictive, built-in CRM | Already in our registry | ✅ | **Already published.** Worth saying on a Canada page that the biggest Canadian name in the category is the one we compare against most |
| Five9, Convoso, Talkdesk, Nextiva, Dialpad, RingCentral | US | — | — | — | Already published; all sell into Canada |
| **LeadsRain** | US/India, markets a "Canada predictive dialer" | Predictive | Per-minute plus DID add-ons, not cleanly published | ⚠️ | Low priority |
| **ICTBroadcast**, **XCALLY** | Pakistan / Italy | Predictive, white-label | Licence-based, not per seat | ⚠️ | Skip |
| Telax | Toronto | Contact center | Absorbed into Intermedia; no standalone offer found | ❌ | Skip |

**The rules, if we ever dial Canada** — verified on crtc.gc.ca:

- **5% abandonment cap**, measured per **calendar month**. Looser than the US 3%,
  and on a different clock from both the US (30 days) and the UK (24 hours).
- **Calling hours 9:00 a.m.–9:30 p.m. weekdays, 10:00 a.m.–6:00 p.m. weekends**,
  in the consumer's local time. Note the 9:30 p.m. weekday end — later than the
  US 9 p.m. — and that Canada allows Sunday calls, which the UK and Australia do
  not.
- **Three years** of monthly abandonment records.
- Plus the National DNCL, which is a separate subscription from the US registry.

**Page angle:** "Dialer for Canadian teams calling US leads." Honest, accurate,
and a real market — Canadian agencies selling into the States share time zones
with them, which Manila does not. The page must say we do not dial Canadian
numbers.

---

## United Kingdom

**The UK has the strictest abandoned-call regime of the four, and it is measured
on a clock we do not implement.** Ofcom's policy caps abandoned calls at **3% of
live calls per campaign per 24 hours**, requires that repeat calls the same day
to a number AMD flagged as an answerphone go out only with a live operator
present, and expects an estimate of **AMD false positives to be counted into the
abandoned rate**. Ours is 3% per campaign over 30 days, TSR-style. A 30-day
average can sit at 2% while a single day runs at 8% — legal in the US, a breach
in Britain. That is a product gap, not a copy problem, and no UK page should
imply otherwise.

| Vendor | Dialer | Published price | Src | Verdict |
|---|---|---|---|---|
| **CloudCall** (Leicester) | Power dialler, campaign management, voicemail drop on the Advanced tier | **£12**/user/mo annual, **£14** monthly; Advanced Edition **£25**/licence. Unlimited UK and Ireland landline and mobile, excluding premium prefixes | ✅ | **Build.** The cleanest UK comparison we have, and recruitment-sector heavy, which is a vertical we do not speak to yet |
| **MaxContact** (Manchester) | Predictive | None. The pricing URL 404s; third parties guess £25–35 or ~$80/user/mo | ❌ | No-price page. Their market is UK compliance, so the Ofcom contrast carries it |
| **Primo Dialler** | Predictive, positions as "UK's fastest growing" | Directories say $45/mo pay-as-you-go and $120 all-inclusive, or $35/$80 elsewhere — they disagree, and the UK pricing page 404s | ⚠️ | Verify from the vendor or skip. Two directories contradicting each other is not a price |
| **Vonage Contact Center** (ex-NewVoiceMedia) | Predictive, Salesforce-native | Contact center plans not published; only the VoIP side is | ❌ | Low priority |
| **Hostcomm**, **Ultracomms**, **Noetica**, **Sytel**, **Cirrus**, **Content Guru** | Predictive | Not yet read; Hostcomm publishes small-contact-centre pricing | — | Research next. Hostcomm first |
| Ringover, Aircall, CloudTalk, 3CX, 8x8 | — | — | — | Already published, all strong in the UK |

**Page angle for any UK page:** a British floor dialing American leads, or a US
reader searching a UK vendor's name. Write the Ofcom rules as *theirs*, never as
something we enforce.

---

## Australia

**The best contract contrast on this entire list.** ipSCAPE's own pricing page
states the plans and then, in its FAQ, that **standard contract terms are 36
months**, with 24, 12 and month-to-month available, plus minimum usage
commitments, implementation costs and support charges. Three years against
"cancel any week" is the whole page.

| Vendor | Dialer | Published price | Src | Verdict |
|---|---|---|---|---|
| **ipSCAPE** | Predictive on the middle tier | Connect **A$89**, Converse **A$139** (predictive), Converge **A$159** per user/mo. **36-month standard contract**; minimum usage commitments, implementation and support charges apply | ✅ | **Build.** Highest-value non-US page on the list |
| **MaxContact Australia** | Predictive | Their AU site now redirects to wearekaizn.com | ⚠️ | Verify who owns it before writing a word |
| **Noojee** (Melbourne) | Predictive | None found | ❌ | Skip unless they publish |
| **PCXCom** | Predictive | None found | ❌ | Skip |
| Genesys, Five9, Talkdesk, Dialpad, RingCentral, 8x8 | — | — | — | Already published or listed below; all sell into AU |

**The rules, already in our code** (`lib/internationalCallingWindow`, verified
against donotcall.gov.au): the Telecommunications (Telemarketing and Research
Calls) Industry Standard 2017 sets **Mon–Fri 9:00–20:00, Sat 9:00–17:00, no
Sunday calls**, with ACMA penalties up to **$250,000**. This is real legislation,
unlike the UK's guidance — worth saying, because it is the one place where our
international work is on firm ground.

---

## Global enterprise and per-minute platforms

| Vendor | Dialer | Published price | Src | Verdict |
|---|---|---|---|---|
| **Amazon Connect** | Agentless, progressive and predictive outbound campaigns | **$0.045/min** for campaign voice (against $0.038 standard), plus **$0.005 per communication**, plus telephony | ✅ | **Build.** The "we'll just build it ourselves" answer, priced |
| **Genesys Cloud CX** | Outbound in the voice tiers | GC1 **$75**/mo or **$0.68/hr**, GC2 **$110** or **$0.99/hr**, GC3 **$140** or **$1.26/hr**; Communicate from **$19.99**. Telco on top | ✅ | **Build** |
| **Twilio Flex** | Whatever you build | **$1** per active user hour, **$35** per monthly active user plus usage, or **$150** per named user. 5,000 free hours | ✅ | **Build** |
| **NICE CXone / Mpower** | Predictive | None. Usage-based, quoted | ❌ | No-price page; large search volume |
| **Zoom Contact Center** | Outbound dialers in the mid tiers | Essentials from **$69**/mo; tier detail thin publicly | ⚠️ | Verify the outbound tier, then build |
| **8x8** | Predictive | Mix-and-match, not published | ❌ | Low priority |

## Europe

| Vendor | Country | Dialer | Published price | Src | Verdict |
|---|---|---|---|---|---|
| **Dialfire** | Germany, EU-hosted | Predictive | **$0.0115/min** outbound landline and mobile, **$0.0050/min** inbound, **no monthly fee, unlimited users**, no minimum | ✅ | **Build first.** Their model wins for an hour of dialing a week and loses badly for a full-time agent. That arithmetic is the page |
| **Squaretalk** | Israel, global | Power and predictive | Core **$15**/user/mo annual (3-user minimum), Connect **$25**, predictive from **$30** | ✅ | **Build** |
| **Voiso** | UAE / Singapore | Predictive, progressive, AMD, local caller ID | Core **$24**, Pro **$52** (predictive included). 30% off annual | ✅ | **Build** |
| **Diabolocom** | France | Predictive | Not researched | — | Research next |
| Ringover, Aircall, CloudTalk, 3CX | FR / SK / CY | — | — | — | Already published |

## Asia and India

| Vendor | Dialer | Published price | Src | Verdict |
|---|---|---|---|---|
| **Zoho Voice** | Power dialer; no predictive claim found | Contact Center **$74**/user/mo annual, **$79** monthly; a $49/mo plan bundles 10 agents for existing Zoho customers | ✅ | **Build.** A $74 seat with no predictive dialing is the angle |
| **CallHippo** | Power and parallel dialer, AMD, local presence | Basic **$1**, Starter **$19**, Professional **$29**, Ultimate **$45** per user/mo | ✅ | **Build** |
| **Bitrix24** | Auto dialer in the CRM | Telephony on paid plans only; numbers **$4–11**/mo across 43 countries; SIP connector **$49**/mo. Plan tiers unread | ⚠️ | Research the tiers, then build. Enormous installed base in the EU and LatAm |
| **Ozonetel** | Predictive, progressive, preview | None. Third parties say ₹1,500–3,500/agent/mo | ⚠️ | No-price page or skip |
| **Exotel / Ameyo** | Predictive | None | ❌ | Skip |
| **Runo** | Auto dialer, telecalling CRM | **₹599**/user/mo annual | ✅ | Low priority: no US overlap, pure search volume |
| **NeoDove** | Auto dialer | None | ❌ | Skip |

## Southeast Asia: the offshore wedge

| Vendor | Dialer | Published price | Src | Verdict |
|---|---|---|---|---|
| **GOautodial** (Philippines) | Predictive, VICIdial lineage | GOcloud Starter **$29**/agent/mo, Premium **$34**, 3-agent minimum | ⚠️ | **Build** once confirmed on their portal. The page an offshore floor is actually searching for |
| VICIdial | — | — | — | Already published |

## Latin America

| Vendor | Country | Dialer | Published price | Src | Verdict |
|---|---|---|---|---|---|
| **uContact** (Integra CCS) | Uruguay | Predictive | Voice **$59.99**/user/mo, Omni **$84.99**; implementation reported from $1,000 | ⚠️ | Build once the vendor confirms. The implementation fee is the story |
| **wolkvox** | Colombia | Predictive, 10x pacing | Modular, no per-agent figure. No minimum agents | ❌ | No-price page or skip |
| **3C Plus** | Brazil | Predictive | Has a public pricing page, unread | ⚠️ | Research next |

---

## Rules before any of these ship

- **Verify every ⚠️ against the vendor's own page.** Directories contradict each
  other — Primo Dialler has two different "published" prices in two places, which
  is how you end up retracting a page.
- **Say who the page is for, above the fold.** Every vendor here sells into
  countries we do not dial.
- **Never import their compliance rules as ours.** Ofcom is 3% per campaign per
  24 hours, the CRTC is 5% per calendar month, the TSR is 3% per campaign per 30
  days. We enforce the third one. Writing the others as if we handled them would
  be the worst claim on the site.
- **Keep the pattern.** A new entry in `lib/competitors.ts` feeds the /vs page,
  the sitemap, /md and /llms-full.txt by itself; only `app/vs/<slug>/page.tsx`
  and the hub row in `app/vs/view.tsx` are hand-written.

## Still unpriced, still excluded

Vulcan7 publishes no figure of any kind: three plan names, "no long-term
contract", 20% off annual, no dollar amount. Same shape as dialer.io, so the page
is writable the same way whenever we want it.
