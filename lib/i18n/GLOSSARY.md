# Translation glossary

Rules for every language, then the fixed terms per language. The dictionaries
in `dictionaries/` are keyed by the English text; `scripts/i18n/batch.mjs`
checks placeholders and the brand name on every merge.

## Rules

- **DialerSeat, DIALERSEAT and the blue D are never translated.** A test
  fails if any translation changes them.
- Keep `{placeholders}` exactly, and keep symbols: ▸ · → ✓ ✗ … — /.
- Keep the English casing style: ALL CAPS stays ALL CAPS, Title Case becomes
  the target language's normal capitalisation.
- Money stays US dollars with `$` in front: `$35/week`. The leads are
  American, so US terms stay US: TCPA, DNC, FCC, FTC, STIR/SHAKEN, 10DLC,
  state names, ZIP code, area code.
- Keep product and plan names: DialerSeat, Pro, Manager+, Teams, Lead drip.
- Keep acronyms: AMD, CSV, CRM, API, SIP, CPS, VA.
- Keep competitor and vendor names: ReadyMode, Mojo, VICIdial, Telnyx, Stripe…
- Call scripts are not in the catalog and stay English: agents read them to
  US leads.
- Short UI labels stay short; the dialer's right rail is 280px wide.

## Spanish (es) — Latin American, "tú"

| English | Spanish |
|---|---|
| dialer | marcador |
| auto dialer | marcador automático |
| predictive / progressive / preview / power (modes) | PREDICTIVO / PROGRESIVO / VISTA PREVIA / POWER |
| lead(s) | lead(s) |
| campaign | campaña |
| seat | puesto |
| agent | agente |
| owner | propietario |
| team | equipo |
| floor (dialer floor) | piso |
| disposition | tipificación |
| callback | rellamada |
| voicemail | buzón de voz |
| answering machine detection | detección de contestadora |
| caller ID | identificador de llamada |
| number pool | grupo de números |
| script | guion |
| recording | grabación |
| talk time | tiempo de conversación |
| answer rate / connect rate / abandon rate | tasa de respuesta / de conexión / de abandono |
| Do Not Call | No Llamar |
| white-label | marca blanca |
| billing / subscription | facturación / suscripción |
| week / per week | semana / por semana (`$35/semana`) |
| sign in / sign up | iniciar sesión / registrarse |

## Portuguese (pt-BR) — Brazilian, "você"

Brazilians search "discador" (2.6× more than "dialer"), so it is used everywhere.

| English | Portuguese |
|---|---|
| dialer / auto dialer | discador / discador automático |
| predictive / progressive / preview / power (modes) | PREDITIVO / PROGRESSIVO / PRÉVIA / POWER |
| lead(s) | lead(s) |
| campaign | campanha |
| seat | licença |
| agent | agente |
| owner | dono |
| team | equipe |
| floor (dialer floor) | operação |
| disposition | tabulação |
| callback | retorno |
| voicemail | caixa postal |
| answering machine detection | detecção de caixa postal |
| caller ID | identificador de chamadas |
| number pool | pool de números |
| script | roteiro |
| recording | gravação |
| talk time | tempo de conversa |
| answer rate / connect rate / abandon rate | taxa de atendimento / de conexão / de abandono |
| Do Not Call | Não Ligue |
| white-label | white label |
| billing / subscription | cobrança / assinatura |
| week | semana (`$35/semana`) |
| sign in / sign up | entrar / cadastrar-se |

## French (fr) — neutral international French, "vous"

Written for call-centre agents in Morocco, Tunisia, Senegal, Côte d'Ivoire and
France, so no France-only idioms. "vous" throughout, as in business software.

| English | French |
|---|---|
| dialer / auto dialer | numéroteur / numéroteur automatique |
| predictive / progressive / preview / power (modes) | PRÉDICTIF / PROGRESSIF / APERÇU / POWER |
| lead(s) | lead(s) |
| campaign | campagne |
| seat | licence |
| agent | agent |
| owner | propriétaire |
| team | équipe |
| floor (dialer floor) | plateau |
| disposition | qualification |
| callback | rappel |
| voicemail | messagerie vocale |
| answering machine detection | détection de répondeur |
| caller ID | numéro affiché |
| number pool | pool de numéros |
| script | script |
| recording | enregistrement |
| talk time | temps de conversation |
| answer rate / connect rate / abandon rate | taux de réponse / de connexion / d'abandon |
| Do Not Call | Ne pas appeler |
| white-label | marque blanche |
| billing / subscription | facturation / abonnement |
| week | semaine (`35 $/semaine` is wrong: keep `$35/semaine`) |
| sign in / sign up | se connecter / s'inscrire |

## Arabic (ar) — Modern Standard Arabic, right to left

Written for call-centre agents in Egypt, Jordan, Morocco and the Gulf, so
Modern Standard Arabic (فصحى مبسطة), not a dialect. Address the reader in the singular
("أنت" forms), as most Arabic software does, and keep it consistent. Western digits (0-9),
never Eastern Arabic numerals, because prices, phone numbers and US times must
match what the agent sees in the dialer. Keep `$35` as written; prices stay in
dollars.

Direction: arrows that point along the reading direction flip, so `→` in the
English becomes `←` and `▸` becomes `◂`. Keep brand and product names in Latin
script: DialerSeat, Manager+, Pro, Telnyx, Stripe, HubSpot, TCPA, FTC, DNC, AMD,
STIR/SHAKEN, CNAM, CSV, API. Mode names stay recognisable to agents who already
use English dialers, so each is given in Arabic with no English beside it.

| English | Arabic |
|---|---|
| dialer / auto dialer | برنامج الاتصال / الاتصال الآلي |
| predictive / progressive / preview / power (modes) | تنبؤي / تدريجي / معاينة / متواصل |
| lead(s) | عميل محتمل / عملاء محتملون |
| campaign | حملة |
| seat | مقعد |
| agent | وكيل |
| owner | المالك |
| team | فريق |
| floor (dialer floor) | صالة الاتصال |
| disposition | نتيجة المكالمة |
| callback | معاودة الاتصال |
| voicemail | البريد الصوتي |
| answering machine detection | كشف الرد الآلي |
| caller ID | رقم المتصل |
| number pool | مجموعة الأرقام |
| script | نص المكالمة |
| recording | تسجيل |
| talk time | مدة التحدث |
| answer rate / connect rate / abandon rate | معدل الرد / معدل الاتصال / معدل التخلي |
| Do Not Call | عدم الاتصال |
| white-label | علامة بيضاء |
| billing / subscription | الفوترة / الاشتراك |
| week | أسبوع (`$35/أسبوع`) |
| sign in / sign up | تسجيل الدخول / إنشاء حساب |
| calling window / calling hours | ساعات الاتصال المسموح بها |
| compliance | الامتثال |

## Italian (it) — standard Italian, "tu"

Written for call-centre operators in Italy and in the Italian-language
outsourcing centres of Albania and Romania. "tu" throughout, as in most modern
Italian software, and kept consistent. Italian call centres already say
"dialer", "lead" and "script", so those stay. Keep `$35` as written:
`$35/settimana`, never `35 $`.

| English | Italian |
|---|---|
| dialer / auto dialer | dialer / dialer automatico |
| predictive / progressive / preview / power (modes) | PREDITTIVO / PROGRESSIVO / ANTEPRIMA / POWER |
| lead(s) | lead |
| campaign | campagna |
| seat | postazione |
| agent | operatore |
| owner | titolare |
| team | team |
| floor (dialer floor) | sala |
| disposition | esito |
| callback | richiamata |
| voicemail | segreteria |
| answering machine detection | rilevamento segreteria |
| caller ID | numero chiamante |
| number pool | pool di numeri |
| script | script |
| recording | registrazione |
| talk time | tempo di conversazione |
| answer rate / connect rate / abandon rate | tasso di risposta / di connessione / di abbandono |
| Do Not Call | Non chiamare |
| white-label | white label |
| billing / subscription | fatturazione / abbonamento |
| week | settimana (`$35/settimana`) |
| sign in / sign up | accedi / registrati |
| calling window / calling hours | fascia oraria consentita |
| compliance | conformità |
