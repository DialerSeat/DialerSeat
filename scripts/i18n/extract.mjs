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

const sorted = [...catalog.keys()].sort((a, b) => a.localeCompare(b, 'en'))
const out = {}
for (const k of sorted) out[k] = [...catalog.get(k)].sort()
fs.writeFileSync('lib/i18n/catalog.json', JSON.stringify(out, null, 1) + '\n')
const words = sorted.reduce((n, s) => n + s.split(/\s+/).length, 0)
console.log(`${sorted.length} strings, ${words} words, from ${new Set(sorted.flatMap((k) => out[k])).size} files`)
