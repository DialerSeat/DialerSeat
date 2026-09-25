// The one function every translation goes through, shared by the server and
// the client. It is deliberately dumb: look the English text up, and if there
// is no entry, give the English back untouched.
//
// That fallback is the whole safety story. English has no dictionary at all,
// so for an English visitor `t("Start dialing")` is literally "Start dialing",
// and a string that has not been translated yet shows in English rather than
// as a blank or a key.

export type Dictionary = Record<string, string>
export type Vars = Record<string, string | number | null | undefined | boolean>

/** Names that are never translated, in any language, by anything. */
export const NEVER_TRANSLATED = ['DialerSeat', 'DIALERSEAT', 'Dialerseat', 'dialerseat.com']

export function translate(dict: Dictionary | null | undefined, text: string, vars?: Vars): string {
  let out = (dict && dict[text]) || text
  if (vars) {
    // {name} placeholders only, and only when values are passed — an English
    // string that happens to contain braces is never touched otherwise.
    // Values render the way React renders a child: null, undefined and
    // booleans show nothing, numbers and strings show as themselves. That is
    // what the sentence showed before it was one translatable string.
    out = out.replace(/\{(\w+)\}/g, (m, k: string) => {
      if (!Object.prototype.hasOwnProperty.call(vars, k)) return m
      const v = vars[k]
      return v == null || typeof v === 'boolean' ? '' : String(v)
    })
  }
  return out
}
