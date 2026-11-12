// =============================================================================
// OUTBOUND CALLING RULES BY COUNTRY
// =============================================================================
// The dataset behind /data/calling-rules-by-country and its markdown mirror.
//
// WHY IT EXISTS: a single page that answers "what are the telemarketing rules
// in <country>" with dates and primary sources is the kind of page other sites
// link to when they need to cite a rule. Every dialer vendor writes a US-only
// TCPA post; almost nobody keeps a multi-country table current. That gap is
// the backlink.
//
// THE RULE THIS FILE KEEPS: every statement has a source in `sources`, and a
// field we could not verify is left out rather than filled with a plausible
// guess. A wrong calling hour on a page built to be cited is worse than a
// missing one, because it will be repeated. Checked 2026-09-25; `checked` is
// printed on the page and should move whenever a row is re-verified.
//
// NOT LEGAL ADVICE, and the page says so. It summarises what each rule
// requires of a caller; it does not interpret edge cases.
// =============================================================================

export const RULES_CHECKED = '2026-09-25'

export interface CountryRule {
  code: string
  name: string
  /** Opt-out register and how it is used. */
  dnc?: string
  /** When marketing calls may be placed. */
  hours?: string
  /** Consent regime for marketing calls. */
  consent?: string
  /** Rules aimed at dialers specifically: abandonment, ring time, redial. */
  dialer?: string
  /** Caller ID, prefix and number-type rules. */
  callerId?: string
  /** What a carrier asks for before issuing a local number (Twilio's published rules). */
  localNumber?: string
  penalties?: string
  /** When this row was last checked against its sources, if later than RULES_CHECKED. */
  checked?: string
  /** The most recent material change, with its date. */
  changed?: string
  sources: { label: string; url: string }[]
}

export const COUNTRY_RULES: CountryRule[] = [
  {
    code: 'US',
    name: 'United States',
    dnc: 'National Do Not Call Registry plus state lists. Your copy of the registry must be no more than 31 days old.',
    hours: '8 a.m. to 9 p.m. in the recipient’s local time under federal rules. Several states set narrower windows.',
    consent:
      'Prior express written consent for prerecorded or artificial-voice marketing calls, and for marketing calls made with an autodialer to mobile numbers (TCPA). Live calls to numbers not on the registry do not need consent.',
    dialer:
      'Abandoned calls may not exceed 3% of calls answered by a person, per campaign, measured over each 30-day period. The caller must connect within 2 seconds of the greeting or play a recorded message with the seller’s name and number. Unanswered calls must ring for at least 15 seconds or four rings (FTC Telemarketing Sales Rule).',
    callerId: 'Caller ID must be transmitted on every telemarketing call. Carriers authenticate calls with STIR/SHAKEN.',
    localNumber: 'No address requirement for a US local number.',
    penalties: 'TCPA private suits: $500 to $1,500 per call.',
    changed: 'The FCC’s “revoke all” consent-revocation rule is delayed to January 31, 2027.',
    sources: [
      { label: 'FTC Telemarketing Sales Rule, 16 CFR 310', url: 'https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-310' },
      { label: 'FCC consent revocation waiver (Wiley)', url: 'https://www.wiley.law/alert-FCC-Extends-Limited-Waiver-for-Part-of-the-TCPA-Consent-Revocation-Rule' },
      { label: 'Calling hours by state (DialerSeat)', url: 'https://dialerseat.com/faq/calling-hours' },
    ],
  },
  {
    code: 'CA',
    name: 'Canada',
    dnc: 'National Do Not Call List (DNCL). The version used must have been downloaded no more than 31 days before the call. A request to be put on a telemarketer’s own do not call list must be acted on within 14 days.',
    hours: 'Weekdays 9:00 a.m. to 9:30 p.m.; weekends 10:00 a.m. to 6:00 p.m., recipient’s local time.',
    consent:
      'A number on the list may still be called with express consent (a written, electronic or online form, or verbal permission that is recorded or verified by an independent third party) or an existing business relationship: a purchase, lease or rental in the last 18 months, a contract in force or ended in the last 18 months, or an inquiry in the last 6 months. Calls to businesses are outside the list, as are calls by registered charities, political parties, surveys and newspapers selling subscriptions.',
    dialer:
      'Predictive dialers may abandon no more than 5% of calls in a calendar month. A call is abandoned if no live agent is on the line within 2 seconds of the answer.',
    localNumber: 'No regulatory requirements published for Canadian local numbers.',
    sources: [
      { label: 'CRTC Unsolicited Telecommunications Rules', url: 'https://crtc.gc.ca/eng/phone/telemarketing/tobligations/rules-regles.htm' },
      { label: 'CRTC telemarketing rules text', url: 'https://www.crtc.gc.ca/eng/trules-reglest.htm' },
      { label: 'National DNCL: who can still call you', url: 'https://lnnte-dncl.gc.ca/en/Consumer/Who-Can-Still-Call-You' },
      { label: 'CRTC: 14 days to honour internal list requests (2014)', url: 'https://www.canada.ca/en/news/archive/2014/03/crtc-continuing-protect-canadians-against-nuisance-telemarketing-calls.html' },
    ],
    checked: '2026-11-12',
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    dnc: 'Telephone Preference Service (TPS) for individuals and Corporate TPS (CTPS) for companies. A number listed for 28 days or more cannot be called for marketing without consent.',
    hours: 'No statutory calling hours.',
    consent:
      'Automated calls that play a recorded message need specific prior consent. Live calls need no consent unless the number is on TPS or CTPS or the person has objected; claims-management and pension calls need consent (PECR).',
    dialer:
      'Ofcom’s persistent-misuse policy: abandoned calls no more than 3% of live calls per campaign per 24 hours, with no safe harbour since 2017; unanswered calls ring at least 15 seconds; an abandoned number is not redialled by an automated system for 72 hours.',
    callerId: 'A valid caller ID that can be called back must be presented on every call.',
    localNumber: 'A UK address and ID or business details. Mobile and toll-free numbers accept an address anywhere.',
    sources: [
      { label: 'ICO: telephone marketing under PECR', url: 'https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/telephone-marketing/' },
      { label: 'Ofcom persistent misuse policy', url: 'https://www.ofcom.org.uk/phones-and-broadband/unwanted-calls-and-messages/persistent_misuse' },
      { label: 'Twilio UK number requirements', url: 'https://www.twilio.com/en-us/guidelines/gb/regulatory' },
    ],
  },
  {
    code: 'AU',
    name: 'Australia',
    dnc: 'Do Not Call Register. Calls to a newly listed number must stop within 30 days, and listing is permanent.',
    hours: 'Monday to Friday 9 a.m. to 8 p.m.; Saturday 9 a.m. to 5 p.m.; no calls on Sundays or national public holidays.',
    dialer:
      'The caller must give their own name, the business they represent and the purpose of the call at the start (Telemarketing and Research Calls Industry Standard 2017).',
    callerId: 'Calling line identification must be provided.',
    localNumber: 'An Australian address (no PO Box) and Australian ID, or ASIC/ABN company documents. Business mobile numbers accept an address anywhere.',
    penalties: 'ACMA penalties up to A$250,000.',
    sources: [
      { label: 'Do Not Call Register industry standards', url: 'https://www.donotcall.gov.au/industry/industry-overview/industry-standards' },
      { label: 'Twilio Australia number requirements', url: 'https://www.twilio.com/en-us/guidelines/au/regulatory' },
    ],
  },
  {
    code: 'ZA',
    name: 'South Africa',
    dnc: 'Opt-out requests must be honoured, and numbers checked against a do-not-contact registry.',
    consent:
      'Direct marketing through automatic calling machines needs the person’s consent, unless they are an existing customer (POPIA section 69).',
    localNumber: 'A South African address in the prefix area and ID. National and toll-free numbers accept an address anywhere.',
    sources: [
      { label: 'POPIA section 69', url: 'https://popia.co.za/section-69-direct-marketing-by-means-of-unsolicited-electronic-communications/' },
      { label: 'Twilio South Africa number requirements', url: 'https://www.twilio.com/en-us/guidelines/za/regulatory' },
    ],
  },
  {
    code: 'MX',
    name: 'Mexico',
    dnc: 'REPEP, run by Profeco. Callers have up to 30 days to stop calling a registered number. Collections, surveys, political and charity calls are not covered.',
    localNumber: 'An address in the prefix area and ID or a tax status certificate. Toll-free numbers accept an address anywhere.',
    sources: [
      { label: 'REPEP frequently asked questions (Profeco)', url: 'https://repep.profeco.gob.mx/preguntasfrecuentes.jsp' },
      { label: 'Twilio Mexico number requirements', url: 'https://www.twilio.com/en-us/guidelines/mx/regulatory' },
    ],
  },
  {
    code: 'CO',
    name: 'Colombia',
    hours: 'Monday to Friday 7 a.m. to 7 p.m.; Saturday 8 a.m. to 3 p.m.; no Sundays or public holidays. Applies to collections and commercial contact.',
    dialer: 'A person may be contacted at most once a day, and through only one channel in a week (Ley 2300 de 2023).',
    localNumber: 'A Colombian address in the prefix area. Toll-free numbers accept an address anywhere.',
    changed: 'Ley 2300 in force since October 2023.',
    sources: [
      { label: 'Ley 2300 de 2023 (Función Pública)', url: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=213990' },
      { label: 'Twilio Colombia number requirements', url: 'https://www.twilio.com/en-us/guidelines/co/regulatory' },
    ],
  },
  {
    code: 'CL',
    name: 'Chile',
    callerId:
      'Automated or mass calls must come from the +56 600 prefix (calls the person asked for) or +56 809 (unsolicited). Other numbers may not be used for them.',
    localNumber: 'A Chilean address for every number type.',
    changed: 'Prefix rule in force since August 2025.',
    sources: [{ label: 'Twilio Chile number requirements', url: 'https://www.twilio.com/en-us/guidelines/cl/regulatory' }],
  },
  {
    code: 'BR',
    name: 'Brazil',
    dnc: 'Não Me Perturbe, the national opt-out list for telemarketing.',
    callerId:
      'The 0303 telemarketing prefix became optional in August 2025 for companies using Chamada Verificada (STIR/SHAKEN with name and logo on screen). Companies placing more than 500,000 calls a month must authenticate them; carriers must deploy verification by April 2028.',
    dialer: 'Anatel blocks senders placing more than 100,000 abusive calls a day, where abusive means dropped on answer or within 3 seconds.',
    localNumber: 'A Brazilian company (CNPJ) and a Brazilian address. Individuals can get mobile numbers only.',
    changed: '0303 made optional, August 2025.',
    sources: [
      { label: 'Anatel revokes mandatory 0303 (Agência Brasil)', url: 'https://agenciabrasil.ebc.com.br/geral/noticia/2025-08/anatel-revoga-obrigatoriedade-do-uso-do-prefixo-0303-em-ligacoes' },
      { label: 'Anatel: telemarketing prefix 0303', url: 'https://www.gov.br/anatel/pt-br/regulado/numeracao/telemarketing-ativo-prefixo-0303' },
      { label: 'Twilio Brazil number requirements', url: 'https://www.twilio.com/en-us/guidelines/br/regulatory' },
    ],
  },
  {
    code: 'ES',
    name: 'Spain',
    consent:
      'Commercial calls need the person’s prior consent or another legal basis under GDPR, such as legitimate interest (Ley 11/2022, article 66.1.b, in force since June 29, 2023).',
    callerId: 'From October 17, 2026, commercial calls must come from numbers in the 400 range. Carriers block commercial calls from any other numbering.',
    localNumber: 'A Spanish address and a NIF/NIE (individuals) or CIF (companies), for every number type.',
    changed: '400 prefix mandatory from October 17, 2026.',
    sources: [
      { label: 'La Moncloa: 400 prefix for commercial calls', url: 'https://www.lamoncloa.gob.es/serviciosdeprensa/notasprensa/transformacion-digital-y-funcion-publica/paginas/2026/160426-prefijo-400-llamadas-comerciales.aspx' },
      { label: 'BOE: Circular 1/2023 on article 66.1.b', url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2023-15071' },
      { label: 'Twilio Spain number requirements', url: 'https://www.twilio.com/en-us/guidelines/es/regulatory' },
    ],
  },
  {
    code: 'FR',
    name: 'France',
    consent:
      'Since August 11, 2026, a commercial call to a consumer needs their prior, express consent (opt-in), and the caller must be able to prove it. Bloctel, the old opt-out list, has ended.',
    localNumber: 'A French address. Twilio does not allow automated outbound calling or telemarketing on French local, mobile or national numbers.',
    penalties: 'Administrative fines up to €375,000 for a company, and contracts signed on a non-consented call are void.',
    changed: 'Opt-in regime in force August 11, 2026 (law 2025-594).',
    sources: [
      { label: 'Opt-in from August 11, 2026 (Touitou Avocats)', url: 'https://touitou.law/demarchage-telephonique-consentement-11-aout-2026/' },
      { label: 'Twilio France number requirements', url: 'https://www.twilio.com/en-us/guidelines/fr/regulatory' },
    ],
  },
  {
    code: 'DE',
    name: 'Germany',
    consent:
      'Marketing calls to consumers need their prior, explicit consent (UWG §7). The consent must be documented when given and kept for five years (UWG §7a).',
    localNumber: 'Business registration and an address in the locality. Local and mobile numbers are not issued to individuals.',
    penalties: 'Up to €50,000 for failing to document or keep consent.',
    sources: [
      { label: 'Bundesnetzagentur: proof of consent (§7a UWG)', url: 'https://www.bundesnetzagentur.de/DE/Fachthemen/Telekommunikation/Unternehmenspflichten/Telefonwerbung/artikel.html' },
      { label: 'Twilio Germany number requirements', url: 'https://www.twilio.com/en-us/guidelines/de/regulatory' },
    ],
  },
  {
    code: 'IT',
    name: 'Italy',
    dnc:
      'Registro Pubblico delle Opposizioni, covering landlines and mobiles. Registering cancels earlier marketing consents, except those given after registration or within an active contract.',
    localNumber: 'An address in the prefix area. Mobile numbers accept an address anywhere.',
    changed: 'Mobiles added to the register in July 2022.',
    sources: [
      { label: 'Registro Pubblico delle Opposizioni', url: 'https://registrodelleopposizioni.it/' },
      { label: 'Twilio Italy number requirements', url: 'https://www.twilio.com/en-us/guidelines/it/regulatory' },
    ],
  },
  {
    code: 'PH',
    name: 'Philippines',
    dnc: 'No national Do Not Call list. A bill to create one is before Congress.',
    consent: 'The Data Privacy Act requires consent to use personal data for marketing. Callers must identify themselves and offer an opt-out.',
    localNumber: 'A Philippine address in the prefix area. Toll-free numbers accept an address anywhere.',
    sources: [
      { label: 'Philippine telemarketing rules (Outsource Accelerator)', url: 'https://www.outsourceaccelerator.com/articles/philippine-telemarketing/' },
      { label: 'Twilio Philippines number requirements', url: 'https://www.twilio.com/en-us/guidelines/ph/regulatory' },
    ],
  },
  {
    code: 'IN',
    name: 'India',
    dnc: 'TRAI Do Not Disturb preferences.',
    callerId: 'Promotional calls must come from 140-series numbers; service and transactional calls from the 1600 series (TRAI TCCCPR).',
    penalties: '₹2 lakh for a first violation, ₹5 lakh for a second, ₹10 lakh for each repeat, and up to two years’ blacklisting from telecom resources.',
    changed: 'TCCCPR amendments finalised February 2025.',
    sources: [
      { label: 'TRAI 2025 amendment (Securiti)', url: 'https://securiti.ai/india-spam-rules-trai-latest-amendment/' },
      { label: 'Twilio India number requirements', url: 'https://www.twilio.com/en-us/guidelines/in/regulatory' },
    ],
  },
  {
    code: 'IE',
    name: 'Ireland',
    dnc:
      'The National Directory Database (NDD) opt-out register. A landline recorded on it may not be called for marketing; the rule applies from 28 days after the number is recorded. Ex-directory numbers are on it automatically.',
    consent:
      'A marketing call to a mobile needs the person’s consent, given to you or recorded in the NDD. An automated marketing call to an individual needs their consent on any line. Anyone who has told you they do not want marketing calls may not be called (S.I. 336 of 2011, regulation 13).',
    dialer:
      'Every marketing call must give the caller’s name and, when calling for someone else, theirs. An automated call must also give an address and a phone number (regulation 13(10)).',
    localNumber: 'An address with an Eircode in the area the number’s prefix covers. No PO Box.',
    sources: [
      { label: 'S.I. 336 of 2011, regulation 13 (Irish Statute Book)', url: 'https://www.irishstatutebook.ie/eli/2011/si/336/made/en/print' },
      { label: 'Data Protection Commission: NDD FAQs', url: 'https://www.dataprotection.ie/en/organisations/rules-electronic-and-direct-marketing/ndd-faqs' },
      { label: 'Twilio Ireland number requirements', url: 'https://www.twilio.com/en-us/guidelines/ie/regulatory' },
    ],
    checked: '2026-11-12',
  },
  {
    code: 'NL',
    name: 'Netherlands',
    consent:
      'Consumers and other individuals, including sole traders and partnerships, may only be called with their consent, unless you had a customer relationship with them in the last 3 years and call about the same kind of product of your own. Charities, lotteries that give to charity and newspaper and magazine publishers may call without consent. You need proof, per person, that you were allowed to call. Tell them on every call that they can object, and remove their number at once when they do.',
    callerId: 'Call from your real number: visible, and reachable for free or at normal call rates. No anonymous numbers.',
    localNumber: 'An address in the area the number’s prefix covers. No PO Box.',
    sources: [
      { label: 'ACM: selling by telemarketing', url: 'https://www.acm.nl/nl/verkoop-aan-consumenten/reclame-en-verleiden/verkoop-telemarketing' },
      { label: 'Twilio Netherlands number requirements', url: 'https://www.twilio.com/en-us/guidelines/nl/regulatory' },
    ],
    checked: '2026-11-12',
  },
  {
    code: 'AR',
    name: 'Argentina',
    dnc:
      'Registro Nacional “No Llame”, run by the AAIP. Nobody registered may be called, and callers must check the register every 30 days; a newly registered number must stop being called within 30 days (Ley 26.951, article 7). Exceptions include public-service campaigns, emergencies, election campaigns and calls about an existing contract made at a reasonable time (article 8).',
    penalties: 'The sanctions of the personal data law, Ley 25.326 (article 11).',
    localNumber: 'An address in the area the number’s prefix covers. No PO Box.',
    sources: [
      { label: 'Ley 26.951 (Argentina.gob.ar)', url: 'https://www.argentina.gob.ar/normativa/nacional/norma-233066/texto' },
      { label: 'Registro Nacional No Llame, plain-language guide', url: 'https://www.argentina.gob.ar/justicia/derechofacil/leysimple/registro-no-llame' },
      { label: 'Twilio Argentina number requirements', url: 'https://www.twilio.com/en-us/guidelines/ar/regulatory' },
    ],
    checked: '2026-11-12',
  },
  {
    code: 'SG',
    name: 'Singapore',
    dnc:
      'The Do Not Call Registry, run by the PDPC, has a No Voice Call Register. Check it before a marketing call to a Singapore number (PDPA section 43). Every number checked is charged, and a result is only valid for a limited period, after which you check again.',
    callerId: 'The calling line identity must not be concealed or withheld (PDPA section 45).',
    localNumber: 'Identity documents (NRIC, FIN or passport) or business registration. The address can be anywhere in the world.',
    sources: [
      { label: 'DNC Registry business rules (PDPC)', url: 'https://www.dnc.gov.sg/org_more.html' },
      { label: 'Personal Data Protection Act 2012, Part 9', url: 'https://sso.agc.gov.sg/Act/PDPA2012' },
      { label: 'Twilio Singapore number requirements', url: 'https://www.twilio.com/en-us/guidelines/sg/regulatory' },
    ],
    checked: '2026-11-12',
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    dnc: 'The Do Not Call Register (DNCR), run by the TDRA. Numbers registered on it may not be called for marketing.',
    hours: '9 a.m. to 6 p.m.',
    dialer:
      'If the consumer turns the offer down on the first call, do not call again. If they do not answer or end the call, call back at most once a day and twice a week. Marketing calls must be recorded, with the consumer told at the start.',
    callerId: 'Call from local numbers issued by licensed UAE telecom companies and registered to the licensed company, and state the company’s identity.',
    penalties: '18 kinds of violation, with fines from AED 10,000 to AED 150,000.',
    localNumber: 'Twilio offers only toll-free UAE numbers, while the rules above require local numbers from a licensed UAE carrier.',
    changed: 'Cabinet Resolutions 56 and 57 of 2024 set these rules.',
    sources: [
      { label: 'UAE Ministry of Economy: telemarketing regulations', url: 'https://www.moet.gov.ae/en/-/ministry-of-economy-and-telecommunications-and-digital-government-regulatory-authority-review-regulatory-legislations-in-organizing-operational-mechanisms-for-telemarketing-companies-in-the-uae-and-enhancing-consumer-protection-in-line-with-best-practices' },
      { label: 'Twilio UAE number requirements', url: 'https://www.twilio.com/en-us/guidelines/ae/regulatory' },
    ],
    checked: '2026-11-12',
  },
]
