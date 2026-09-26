// node scripts/i18n/logical-props.mjs [--dry]
//
// Right-to-left support. Rewrites physical left/right spacing, borders and
// text alignment to their logical equivalents (inline-start / inline-end), in
// inline style objects and in CSS. In a left-to-right page the logical
// property IS the physical one, so English renders exactly as before; under
// <html dir="rtl"> the same rule mirrors itself with no Arabic-specific CSS.
//
// Deliberately NOT touched:
//  - left/right/top positioning. Most of it is drag coordinates or centring
//    (left: 50% + translateX(-50%)) that must stay physical.
//  - four-value shorthands (margin: '0 8px 0 0'), which have no logical form.
//  - components/admin-desktop, the internal admin panel.
//  - assignments to DOM style objects (el.style.marginLeft = ...): the regexes
//    only match a key followed by a colon.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DRY = process.argv.includes('--dry')
const ROOTS = ['app', 'components']
const SKIP = [path.join('components', 'admin-desktop')]

const side = { Left: 'Start', Right: 'End', left: 'start', right: 'end' }

const RULES = [
  // Inline style objects (JS keys). Optional marks keep TS types untouched.
  [/\b(margin|padding)(Left|Right)(\s*):/g, (_, p, s, sp) => `${p}Inline${side[s]}${sp}:`],
  [/\bborder(Left|Right)(Width|Color|Style)?(\s*):/g, (_, s, sub = '', sp) => `borderInline${side[s]}${sub}${sp}:`],
  [/\btextAlign(\s*):(\s*)(['"])(left|right)\3/g, (_, a, b, q, v) => `textAlign${a}:${b}${q}${side[v]}${q}`],
  // CSS (stylesheets, <style> blocks, styled template strings).
  [/(^|[\s;{"'`])(margin|padding)-(left|right)(\s*):/gm, (_, pre, p, s, sp) => `${pre}${p}-inline-${side[s]}${sp}:`],
  [/(^|[\s;{"'`])border-(left|right)(-width|-color|-style)?(\s*):/gm, (_, pre, s, sub = '', sp) => `${pre}border-inline-${side[s]}${sub}${sp}:`],
  [/\btext-align(\s*):(\s*)(left|right)\b/g, (_, a, b, v) => `text-align${a}:${b}${side[v]}`],
]

/** Apply every rule to one file's text. Returns [text, replacements]. */
export function transform(src) {
  let out = src
  let n = 0
  for (const [re, fn] of RULES) out = out.replace(re, (...a) => { n++; return fn(...a) })
  return [out, n]
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

const files = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (SKIP.some((s) => p.startsWith(s))) continue
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p) }
    else if (/\.(tsx|ts|css)$/.test(e.name)) files.push(p)
  }
}
if (isMain) ROOTS.forEach(walk)

let total = 0
const changed = []
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const [out, n] = transform(src)
  // Skip TS type members like `marginLeft?: number` (the ? precedes the colon, so
  // they never match), and never touch a file that ends up identical.
  if (out !== src) {
    total += n
    changed.push([f, n])
    if (!DRY) fs.writeFileSync(f, out)
  }
}
if (isMain) for (const [f, n] of changed) console.log(String(n).padStart(4), f)
if (isMain) console.log(`${total} replacements in ${changed.length} files${DRY ? ' (dry run)' : ''}`)
