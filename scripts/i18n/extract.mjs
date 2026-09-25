// ── THE CATALOG: EVERY ENGLISH STRING THE SITE CAN SHOW ─────────────
// node scripts/i18n/extract.mjs
//
// Writes lib/i18n/catalog.json: every string passed to t() or msg() in the
// customer-facing code, plus the error messages API routes send back (the
// dashboard shows those through t(error)), each with the files it appears in
// so a translator can see the context.
//
// A language is enabled only when its dictionary covers every key here;
// tests/unit/i18nCoverage.test.ts enforces that. Re-run this after changing
// any visible text, then translate the new keys.

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { isProse } from './prose.mjs'

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'app', 'components', 'lib'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter((f) => /\.(tsx?|mjs)$/.test(f))
  .filter((f) => !/admin-desktop|^app\/api\/admin\/|^app\/dashboard\/admin\/|^app\/dashboard\/manager\/desktop|^lib\/i18n\//.test(f))

const catalog = new Map() // text → Set(files)
const add = (text, file) => {
  if (!text || !/[A-Za-z]/.test(text)) return
  if (!catalog.has(text)) catalog.set(text, new Set())
  catalog.get(text).add(file)
}

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  const isApi = file.startsWith('app/api/')
  if (!isApi && !/@\/lib\/i18n\/(client|server|msg|metadata)/.test(src) && file !== 'lib/gutsRail.ts') continue
  const names = new Set()
  for (const m of src.matchAll(/import \{([^}]*)\} from ['"]@\/lib\/i18n\/(?:client|server|msg)['"]/g)) {
    for (const part of m[1].split(',')) {
      const [orig, alias] = part.trim().split(/\s+as\s+/)
      if (orig === 't' || orig === 'msg') names.add(alias || orig)
    }
  }
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const visit = (n) => {
    // Page metadata that localizeMetadata() translates: title, description,
    // and the Open Graph / Twitter copies of them.
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'baseMetadata' && n.initializer) {
      const walk = (o) => {
        if (!ts.isObjectLiteralExpression(o)) return
        for (const p of o.properties) {
          if (!ts.isPropertyAssignment(p) || !ts.isIdentifier(p.name)) continue
          const k = p.name.text, v = p.initializer
          if (/^(title|description|default|absolute)$/.test(k) && (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v))) add(v.text, file)
          else if (/^(title|openGraph|twitter)$/.test(k)) walk(v)
        }
      }
      walk(n.initializer)
    }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && names.has(n.expression.text) && n.arguments[0]) {
      const a = n.arguments[0]
      if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) add(a.text, file)
    }
    // API routes: { error: 'Something readable' } in a JSON response.
    if (isApi && ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && /^(error|message|detail)$/.test(n.name.text)) {
      const v = n.initializer
      if ((ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v)) && /\s/.test(v.text) && /^[A-Z]/.test(v.text)) add(v.text, file)
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
}

// ── TEXT THE PUBLIC PAGES SHOW WITHOUT A LITERAL t("…") ─────────────
// The public pages pass text around: headline="…" into a shared call to action,
// arrays of facts rendered as {t(item)}, and the competitor and product facts
// in lib/competitors.ts, lib/competitorFeatures.ts and lib/canonicalFacts.ts,
// which stay free of i18n calls because the markdown mirrors and llms-full.txt
// read them too. The places that show them go through t() (wrap-types.mjs),
// so the text itself belongs here: prose string literals that are JSX
// attribute values, object property values or array elements, in the public
// pages, the components they import, and those three data files.
const DATA_FILES = ['lib/competitors.ts', 'lib/competitorFeatures.ts', 'lib/canonicalFacts.ts']
const isPublicPage = (f) => /^app\/.*\.tsx$/.test(f) &&
  !/^app\/(dashboard|api|admin|sign-in|sign-up|onboarding|billing|welcome|join|invite|embed)\b/.test(f) &&
  !/admin-desktop|\/manager\/desktop/.test(f)
// Keys and attributes whose values are never shown as text.
const NOT_TEXT_KEY = /^(className|class|href|src|srcSet|id|key|slug|icon|color|colour|background|style|sx|url|path|segment|as|type|variant|tone|opens|rel|target|fill|stroke|d|viewBox|role|name|method|action|lang|dir|htmlFor|fontFamily|keywords|sameAs|logo|image|images|email|telephone|width|height|size|mode|value|defaultValue|pattern|autoComplete|inputMode|activeHref|rail|canonical|locale|code|hash|query|matchup)$/
// Never translated: the dialer demos show an English call script on purpose
// (agents read it to US leads), and language names stay in their own language.
const KEEP_ENGLISH = new Set(['components/DialerShowcase.tsx', 'components/LeadQueueShowcase.tsx', 'components/LanguageDropdown.tsx', 'components/LanguagePrompt.tsx'])
const NEVER_ALONE = new Set(['DialerSeat', 'DIALERSEAT', 'Dialerseat'])
// isProse was written to mark code, so it rejects anything with a semicolon or
// a CSS word ("auto-dials", "fixed fee"). In data, a sentence of four or more
// words that starts like a sentence is a sentence.
const looksProse = (s) => isProse(s) || (
  s.split(/\s+/).length >= 4 && /^[A-Z0-9$~+"(‘“]/.test(s) &&
  !/[{}<>`\\]|=>|\$\{/.test(s) && !/\b\d+(px|em|rem|vh|vw|ms|deg)\b|rgba?\(|var\(--/.test(s))

const publicScope = new Set()
{
  const queue = files.filter(isPublicPage)
  while (queue.length) {
    const f = queue.pop()
    if (publicScope.has(f) || !fs.existsSync(f)) continue
    publicScope.add(f)
    const src = fs.readFileSync(f, 'utf8')
    for (const m of src.matchAll(/from ['"](@\/components\/[^'"]+|\.{1,2}\/[^'"]+)['"]/g)) {
      const spec = m[1].startsWith('@/') ? m[1].slice(2) : path.posix.join(path.posix.dirname(f), m[1])
      for (const cand of [spec + '.tsx', spec + '/index.tsx']) {
        if (fs.existsSync(cand) && (cand.startsWith('components/') || isPublicPage(cand))) queue.push(cand)
      }
    }
  }
}

const literalText = (e) => {
  if (ts.isParenthesizedExpression(e)) return literalText(e.expression)
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const l = literalText(e.left), r = literalText(e.right)
    return l != null && r != null ? l + r : null
  }
  return null
}

for (const file of [...publicScope, ...DATA_FILES].sort()) {
  if (KEEP_ENGLISH.has(file)) continue
  const src = fs.readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const visit = (n) => {
    // Styles are not text; metadata is handled above; keywords are never shown.
    if (ts.isPropertyAssignment(n) && /^(style|sx|keywords|openGraph|twitter|alternates|robots|icons)$/.test(n.name.getText(sf))) return
    if (ts.isJsxAttribute(n) && /^(style|className)$/.test(n.name.getText(sf))) return
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return
    let text = null
    let prop = false
    if (ts.isJsxAttribute(n) && n.initializer && !NOT_TEXT_KEY.test(n.name.getText(sf))) {
      const init = ts.isJsxExpression(n.initializer) ? n.initializer.expression : n.initializer
      if (init) text = literalText(init)
      // Passed into a component: that component may render in the browser.
      prop = /^[A-Z]/.test(n.parent.parent.tagName.getText(sf))
    } else if (ts.isPropertyAssignment(n) && !NOT_TEXT_KEY.test(n.name.getText(sf).replace(/['"]/g, ''))) {
      text = literalText(n.initializer)
    } else if (n.parent && ts.isArrayLiteralExpression(n.parent) && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isBinaryExpression(n))) {
      text = literalText(n)
    }
    if (text != null && looksProse(text.trim()) && !NEVER_ALONE.has(text.trim())) add(text, prop ? file + '#prop' : file)
    ts.forEachChild(n, visit)
  }
  visit(sf)
}

const sorted = [...catalog.keys()].sort((a, b) => a.localeCompare(b, 'en'))
const out = {}
for (const k of sorted) out[k] = [...catalog.get(k)].sort()
fs.writeFileSync('lib/i18n/catalog.json', JSON.stringify(out, null, 1) + '\n')
const words = sorted.reduce((n, s) => n + s.split(/\s+/).length, 0)
console.log(`${sorted.length} strings, ${words} words, from ${new Set(sorted.flatMap((k) => out[k])).size} files`)
