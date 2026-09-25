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
