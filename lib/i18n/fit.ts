// Headline sizing for translated landing copy.
//
// The landing headlines are set at one font size, tuned for the English words.
// "CLOSE FASTER." fits its column on one line; "FECHE MAIS RÁPIDO." at the same
// size wraps to two and pushes the whole hero down. These helpers return a
// multiplier for the font size so a translation takes up the same space the
// English does. Worked out on the server from the strings themselves, so the
// page renders at the right size and never reflows after load.

// Rough advance width of one character, in ems, for a bold display face.
function glyph(ch: string): number {
  const c = ch.codePointAt(0) ?? 0
  if (ch === ' ') return 0.28
  if (/[.,·:;!'"’“”「」。、，]/.test(ch)) return c > 0x2fff ? 1 : 0.3
  if (c >= 0x2e80) return 1 // CJK, kana, hangul, fullwidth
  if (c >= 0x0590 && c <= 0x06ff) return 0.55 // Hebrew, Arabic
  if (/[0-9]/.test(ch)) return 0.58
  if (ch === ch.toLowerCase() && ch !== ch.toUpperCase()) return 0.52
  if (/[MWÆŒ]/.test(ch)) return 0.9
  if (/[IJ]/.test(ch)) return 0.32
  return 0.66
}

function width(s: string): number {
  let w = 0
  for (const ch of s) w += glyph(ch)
  return w
}

/** Lines that must each stay on one line, like DIAL SMARTER. / CLOSE FASTER. */
export function lineFitScale(translated: string[], english: string[]): number {
  const en = Math.max(...english.map(width))
  const tr = Math.max(...translated.map(width))
  if (!tr || tr <= en * 1.1) return 1
  return Math.max(0.45, (en * 1.1) / tr)
}

/** A heading that wraps: keep it to roughly the English number of lines. */
export function blockFitScale(translated: string, english: string): number {
  const en = width(english)
  const tr = width(translated)
  if (!tr || tr <= en * 1.08) return 1
  return Math.max(0.6, Math.sqrt((en * 1.08) / tr))
}

/** CSS font-size for a base size variable scaled by `scale`. */
export function scaledSize(cssVar: string, scale: number): string {
  return scale >= 1 ? `var(${cssVar})` : `calc(var(${cssVar}) * ${scale.toFixed(3)})`
}
