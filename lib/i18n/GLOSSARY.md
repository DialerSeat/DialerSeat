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

## German (de) — standard German, "du"

Written for call-centre agents in Germany, Austria and Switzerland. "du"
throughout, as modern German SaaS does, and kept consistent; never mix in
"Sie". German call centres already say "Dialer", "Lead" and "Skript", so
those stay. Keep `$35` as written: `$35/Woche`, never `35 $`. Long compounds
are fine in sentences; in buttons and tracked capitals prefer the shorter word.

| English | German |
|---|---|
| dialer / auto dialer | Dialer / automatischer Dialer |
| predictive / progressive / preview / power (modes) | PREDICTIVE / PROGRESSIVE / PREVIEW / POWER (mode names stay; prose: prädiktiv, progressiv, Vorschau) |
| lead(s) | Lead(s) |
| campaign | Kampagne |
| seat | Platz (Plätze) |
| agent | Agent |
| owner | Inhaber |
| team | Team |
| floor (dialer floor) | Callcenter-Team / Floor |
| disposition | Ergebnis |
| callback | Rückruf |
| voicemail | Mailbox |
| answering machine detection | Anrufbeantworter-Erkennung (AMD) |
| caller ID | Rufnummer / Anrufer-ID |
| number pool | Nummernpool |
| script | Skript |
| recording | Aufzeichnung |
| talk time | Gesprächszeit |
| answer rate / connect rate / abandon rate | Annahmequote / Verbindungsquote / Abbruchquote |
| Do Not Call | Nicht anrufen |
| white-label | White Label |
| billing / subscription | Abrechnung / Abo |
| week | Woche (`$35/Woche`) |
| sign in / sign up | anmelden / registrieren |
| calling window / calling hours | erlaubte Anrufzeiten |
| compliance | Compliance |

## Chinese (zh-CN) — Mandarin, simplified characters

Written for mainland China and Singapore. Neutral, plain business Chinese;
address the reader as "你" (not "您") throughout, as Chinese SaaS does. Use
full-width punctuation（，。：？！“”） in Chinese sentences, but keep `$35`,
numbers, percentages and product names in half-width Latin. No space between
Chinese characters; a space either side of a Latin word or number is optional
and should follow what reads naturally (`DialerSeat 的`, `$35/周`). Mode names
in tracked capitals stay English in labels, with Chinese in prose.

| English | Chinese |
|---|---|
| dialer / auto dialer | 拨号器 / 自动拨号器 |
| predictive / progressive / preview / power (modes) | 预测式 / 渐进式 / 预览式 / 功率式 (labels may keep PREDICTIVE etc.) |
| lead(s) | 线索 |
| campaign | 活动 |
| seat | 席位 |
| agent | 坐席 |
| owner | 所有者 |
| team | 团队 |
| floor (dialer floor) | 呼叫团队 |
| disposition | 通话结果 |
| callback | 回拨 |
| voicemail | 语音信箱 |
| answering machine detection | 答录机检测 (AMD) |
| caller ID | 来电显示号码 |
| number pool | 号码池 |
| script | 话术 |
| recording | 录音 |
| talk time | 通话时长 |
| answer rate / connect rate / abandon rate | 接听率 / 接通率 / 放弃率 |
| Do Not Call | 谢绝来电 (Do Not Call) |
| white-label | 白标 |
| billing / subscription | 账单 / 订阅 |
| week | 周 (`$35/周`) |
| sign in / sign up | 登录 / 注册 |
| calling window / calling hours | 允许拨打时段 |
| compliance | 合规 |

## Hebrew (he) — modern Israeli Hebrew, right to left

Same layout rules as Arabic: the page never mirrors, only the text runs right
to left. Address the reader in the masculine-plural-neutral imperative common
in Israeli software ("לחץ", "התחל") and keep it consistent. Israeli call
centres say "דיילר", "ליד" and "קמפיין", so those stay as loanwords. Keep `$35`
as written with Latin digits.

| English | Hebrew |
|---|---|
| dialer / auto dialer | חייגן / חייגן אוטומטי |
| predictive / progressive / preview / power (modes) | חיזוי / פרוגרסיבי / תצוגה מקדימה / פאוור |
| lead(s) | ליד(ים) |
| campaign | קמפיין |
| seat | עמדה (עמדות) |
| agent | נציג |
| owner | בעלים |
| team | צוות |
| floor (dialer floor) | מוקד |
| disposition | תוצאת שיחה |
| callback | שיחה חוזרת |
| voicemail | תא קולי |
| answering machine detection | זיהוי משיבון (AMD) |
| caller ID | מספר מזוהה |
| number pool | מאגר מספרים |
| script | תסריט |
| recording | הקלטה |
| talk time | זמן שיחה |
| answer rate / connect rate / abandon rate | שיעור מענה / שיעור חיבור / שיעור נטישה |
| Do Not Call | רשימת "אל תתקשר" (Do Not Call) |
| white-label | white label |
| billing / subscription | חיוב / מנוי |
| week | שבוע (`$35 לשבוע`) |
| sign in / sign up | התחברות / הרשמה |
| calling window / calling hours | שעות חיוג מותרות |
| compliance | ציות |

## Japanese (ja) — standard Japanese, polite です/ます

Polite です/ます in sentences; buttons and labels are short noun forms
(「開始」「保存」). Full-width Japanese punctuation（、。「」）in Japanese
sentences; `$35`, numbers and product names stay half-width. Japanese call
centres use katakana loanwords, so those stay.

| English | Japanese |
|---|---|
| dialer / auto dialer | ダイヤラー / オートダイヤラー |
| predictive / progressive / preview / power (modes) | プレディクティブ / プログレッシブ / プレビュー / パワー |
| lead(s) | リード |
| campaign | キャンペーン |
| seat | シート |
| agent | エージェント |
| owner | オーナー |
| team | チーム |
| floor (dialer floor) | コールセンター |
| disposition | 通話結果 |
| callback | コールバック |
| voicemail | 留守番電話 |
| answering machine detection | 留守番電話検出 (AMD) |
| caller ID | 発信者番号 |
| number pool | 番号プール |
| script | トークスクリプト |
| recording | 録音 |
| talk time | 通話時間 |
| answer rate / connect rate / abandon rate | 応答率 / 接続率 / 放棄率 |
| Do Not Call | 電話勧誘拒否リスト (Do Not Call) |
| white-label | ホワイトラベル |
| billing / subscription | 請求 / サブスクリプション |
| week | 週 (`$35/週`) |
| sign in / sign up | ログイン / 登録 |
| calling window / calling hours | 発信可能時間帯 |
| compliance | コンプライアンス |

## Filipino (fil) — Tagalog-based Filipino as spoken in call centres

Filipino agents work in English all day, so everyday call-centre English stays
English where Filipinos themselves use it ("Taglish" register, not deep
Tagalog). Natural, friendly "ikaw/ka" address; "po" only in customer-facing
scripts.

| English | Filipino | Note |
|---|---|---|
| lead | lead | keep; used as-is on Philippine floors |
| campaign | campaign | keep |
| dialer | dialer | keep |
| seat | seat | keep; "puwesto" reads as a physical desk |
| agent | agent | keep |
| call / calls | tawag | |
| dial | i-dial / mag-dial | |
| disposition | disposition | keep |
| voicemail | voicemail | keep |
| predictive / power / progressive / preview | keep in English | mode names |
| team | team | keep |
| owner | may-ari | |
| week / weekly | linggo / lingguhan | |
| cancel anytime | i-cancel kahit kailan | |
| compliance | compliance | keep |
| sign in / sign up | Mag-sign in / Mag-sign up | |

## Hindi (hi) — standard Hindi in Devanagari, "आप"

Formal-friendly "आप". Industry terms that Indian BPO staff use in English are
transliterated (लीड, कैंपेन, डायलर), not replaced with Sanskritised coinages
nobody on a floor would say. US legal terms (TCPA, DNC, FTC) stay in Latin
letters.

| English | Hindi | Note |
|---|---|---|
| lead | लीड | |
| campaign | कैंपेन | |
| dialer | डायलर | |
| seat | सीट | |
| agent | एजेंट | |
| call | कॉल | |
| dial | डायल करें | |
| disposition | डिस्पोज़िशन | |
| voicemail | वॉइसमेल | |
| predictive / power / progressive / preview | प्रेडिक्टिव / पावर / प्रोग्रेसिव / प्रीव्यू | |
| team | टीम | |
| owner | मालिक | |
| week / weekly | हफ़्ता / साप्ताहिक | |
| cancel anytime | कभी भी रद्द करें | |
| compliance | अनुपालन | |
| sign in / sign up | साइन इन / साइन अप | |
