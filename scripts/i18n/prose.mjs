// Does this string literal read like text a person sees, rather than a key,
// a class name, a URL or a CSS value? The same test wrap-render.mjs uses;
// the catalog extractor shares it from here.

export const isProse = (v) => {
  const s = v.trim()
  if (s.length < 2 || !/[A-Za-z]{2}/.test(s)) return false
  if (['DialerSeat', 'DIALERSEAT', 'Dialerseat', 'use client', 'use server'].includes(s)) return false
  if (/^(https?:|mailto:|tel:|\/|#|\.|rgba?\(|var\(--|hsl|color-mix|linear-gradient|calc\()/.test(s)) return false
  if (/[{};<>`]|=>|\$\{|\\n/.test(s)) return false
  if (/^[a-z0-9_.:\-/]+$/.test(s)) return false
  if (/^[A-Za-z0-9_]+$/.test(s) && /_/.test(s)) return false
  if (/\b\d+(px|em|rem|vh|vw|ms|s|deg)\b|\b(solid|dashed|dotted|flex|grid|auto|inherit|bold|normal|none|nowrap|pointer|absolute|relative|fixed|sticky|center|uppercase)\b/.test(s)) return false
  if (/(sans-serif|serif|monospace)\s*$/.test(s)) return false
  if (/^[\w.-]+@[\w.-]+\.\w+$/.test(s)) return false
  // HTTP verbs, currency and zone codes, and other all-caps tokens that are
  // protocol, not prose.
  if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|USD|EUR|GBP|UTC|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT|AM|PM|OK|ID|API|URL|CSV|PDF|JSON|SIP|DNC|TCPA|AMD|SMS|CPS)$/.test(s)) return false
  // One lowercase word is almost always a key; ALL-CAPS words and anything
  // with a space or capital are how this codebase writes visible text.
  if (/^[a-z]+$/.test(s)) return false
  if (!/\s/.test(s) && !/^[A-Z][A-Z]+[!?.]?$/.test(s) && !/^[A-Z][a-z]+[!?.]?$/.test(s)) return false
  return true
}
