// ── TRANSLATION BATCHES ─────────────────────────────────────────────
// node scripts/i18n/batch.mjs next <locale> [maxChars]
//     Prints the next untranslated catalog strings for <locale>, numbered and
//     grouped under the file they come from (context for the translator), and
//     remembers which strings those numbers mean.
// node scripts/i18n/batch.mjs apply <locale> <translations.json>
//     Takes { "0": "…", "1": "…" } for the last batch, checks every entry, and
//     merges the good ones into lib/i18n/dictionaries/<locale>.json.
// node scripts/i18n/batch.mjs status <locale>
//
// The checks catch the mistakes that matter: a lost or renamed {placeholder},
// a changed DialerSeat name, an empty entry, and — through a length ratio —
// a batch that has slipped out of alignment with its numbers.

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const DIR = 'lib/i18n'
const [cmd, locale, arg] = process.argv.slice(2)
const dictPath = path.join(DIR, 'dictionaries', `${locale}.json`)
const pendingPath = path.join(process.env.I18N_BATCH_DIR || '.', `.i18n-batch-${locale}.json`)
const catalog = JSON.parse(fs.readFileSync(path.join(DIR, 'catalog.json'), 'utf8'))
const dict = fs.existsSync(dictPath) ? JSON.parse(fs.readFileSync(dictPath, 'utf8')) : {}
const NEVER = ['DialerSeat', 'DIALERSEAT', 'Dialerseat', 'dialerseat.com']

// Strings from the same file travel together, in file order.
const ordered = Object.keys(catalog).sort((a, b) => {
  const fa = catalog[a][0], fb = catalog[b][0]
  return fa === fb ? a.localeCompare(b) : fa.localeCompare(fb)
})

if (cmd === 'status') {
  const done = ordered.filter((k) => dict[k]).length
  console.log(`${locale}: ${done}/${ordered.length} translated, ${ordered.length - done} to go`)
} else if (cmd === 'next') {
  const max = Number(arg) || 30000
  const todo = ordered.filter((k) => !dict[k])
  const batch = []
  let chars = 0
  for (const k of todo) {
    if (batch.length && chars + k.length > max) break
    batch.push(k); chars += k.length
  }
  fs.writeFileSync(pendingPath, JSON.stringify(batch))
  let lastFile = null
  batch.forEach((k, i) => {
    const f = catalog[k][0]
    if (f !== lastFile) { console.log(`## ${f}${catalog[k].length > 1 ? ` (+${catalog[k].length - 1} more)` : ''}`); lastFile = f }
    console.log(`${i}\t${JSON.stringify(k)}`)
  })
  console.log(`-- ${batch.length} strings, ${chars} chars; ${todo.length - batch.length} left after this batch`)
} else if (cmd === 'apply') {
  const batch = JSON.parse(fs.readFileSync(pendingPath, 'utf8'))
  const tr = JSON.parse(fs.readFileSync(arg, 'utf8'))
  // Placeholders glued to a word (lead{value}) are English plural endings; a
  // language that does not pluralise by suffix may drop them. See i18n.test.ts.
  const suffix = (en) => new Set([...en.matchAll(/[A-Za-z](\{\w+\})/g)].map((m) => m[1]))
  const vars = (s, en = s) => [...new Set(s.match(/\{\w+\}/g) ?? [])].filter((v) => !suffix(en).has(v)).sort().join(',')
  const count = (s, n) => s.split(n).length - 1
  const problems = []
  let merged = 0
  batch.forEach((en, i) => {
    const t = tr[String(i)]
    if (typeof t !== 'string' || !t.trim()) { problems.push(`${i}: missing`); return }
    if (vars(t, en) !== vars(en) || (t.match(/\{\w+\}/g) ?? []).some((v) => !en.includes(v))) { problems.push(`${i}: placeholders ${vars(en)} → ${vars(t)}  ${JSON.stringify(en).slice(0, 60)}`); return }
    for (const n of NEVER) if (count(t, n) !== count(en, n)) { problems.push(`${i}: brand "${n}"  ${JSON.stringify(en).slice(0, 60)}`); return }
    if (en.length >= 25) {
      const r = t.length / en.length
      // Chinese and Japanese say in one character what English spells in
      // several, so their translations run far shorter.
      const min = locale === 'zh-CN' || locale === 'ja' ? 0.08 : locale === 'he' || locale === 'hi' ? 0.3 : 0.45
      if (r < min || r > 2.6) { problems.push(`${i}: length ratio ${r.toFixed(2)} — misaligned?  ${JSON.stringify(en).slice(0, 50)} → ${JSON.stringify(t).slice(0, 50)}`); return }
    }
    dict[en] = t
    merged++
  })
  const extra = Object.keys(tr).filter((k) => Number(k) >= batch.length)
  if (extra.length) problems.push(`extra keys beyond the batch: ${extra.slice(0, 5).join(', ')}`)
  const sorted = Object.fromEntries(Object.keys(dict).sort((a, b) => a.localeCompare(b, 'en')).map((k) => [k, dict[k]]))
  fs.writeFileSync(dictPath, JSON.stringify(sorted, null, 1) + '\n')
  console.log(`merged ${merged}/${batch.length}`)
  for (const p of problems) console.log('  ✗ ' + p)
  const done = ordered.filter((k) => sorted[k]).length
  console.log(`${locale}: ${done}/${ordered.length} translated`)
  // Keep the browser's subset in step with the full dictionary.
  execFileSync(process.execPath, ['scripts/i18n/client-dicts.mjs'], { stdio: 'ignore' })
} else {
  console.log('usage: batch.mjs next|apply|status <locale> [arg]')
}
