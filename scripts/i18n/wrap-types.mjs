// ── FOURTH PASS: STRINGS SHOWN ON MARKETING PAGES, FOUND BY TYPE ────
// node scripts/i18n/wrap-types.mjs            (lists the files it would change)
// node scripts/i18n/wrap-types.mjs --write
//
// wrap-render.mjs chose variables by name ({error}, {title}), which misses the
// shapes the public pages actually use: {w} inside c.wins.map(w => …),
// value={c.pricing}, {f.feature}, {l}. This pass asks the type checker
// instead. On the public pages, and the components they import, any JSX child
// or text attribute (title, alt, placeholder, aria-label) whose expression is
// a plain reference — identifier, property access, element access — and whose
// type is a string becomes t(…).
//
// Scope is deliberately the public site: there, strings come from our own
// data (lib/competitors.ts, lib/canonicalFacts.ts, page-level arrays), never
// from a customer, so passing them through t() cannot alter user data.
// English output is unchanged: t(x) is x in English. verify.mjs proves it.

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { execFileSync } from 'node:child_process'

const WRITE = process.argv.includes('--write')
const TEXT_ATTRS = new Set(['title', 'placeholder', 'alt', 'aria-label'])

// The public pages: everything under app/ that is not the dashboard, an API,
// admin, or auth.
const isPublicPage = (f) => /^app\/.*\.tsx$/.test(f) &&
  !/^app\/(dashboard|api|admin|sign-in|sign-up|onboarding|billing|welcome|join|invite|embed)\b/.test(f) &&
  !/admin-desktop|\/manager\/desktop/.test(f)

const configPath = ts.findConfigFile('.', ts.sys.fileExists, 'tsconfig.json')
const parsed = ts.parseJsonConfigFileContent(ts.readConfigFile(configPath, ts.sys.readFile).config, ts.sys, '.')
const program = ts.createProgram(parsed.fileNames, parsed.options)
const checker = program.getTypeChecker()
const rel = (f) => path.relative(process.cwd(), f).split(path.sep).join('/')

// Public pages plus every component they reach through imports.
const byRel = new Map(program.getSourceFiles().map((s) => [rel(s.fileName), s]))
const scope = new Set()
const queue = [...byRel.keys()].filter(isPublicPage)
while (queue.length) {
  const f = queue.pop()
  if (scope.has(f)) continue
  scope.add(f)
  const sf = byRel.get(f)
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st)) continue
    const spec = st.moduleSpecifier.text
    if (!spec.startsWith('@/components/') && !spec.startsWith('./') && !spec.startsWith('../')) continue
    const resolved = ts.resolveModuleName(spec, sf.fileName, parsed.options, ts.sys).resolvedModule
    if (!resolved) continue
    const r = rel(resolved.resolvedFileName)
    if (r.endsWith('.tsx') && (r.startsWith('components/') || isPublicPage(r))) queue.push(r)
  }
}

const isStringType = (type) => {
  if (type.isUnion()) {
    const parts = type.types.filter((p) => !(p.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)))
    return parts.length > 0 && parts.every(isStringType)
  }
  return !!(type.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLiteral))
}
// Names are proper nouns: a competitor called Close is not the word close.
const isName = (e) => /name$/i.test(e.getText())
const isRef = (e) => ts.isIdentifier(e) || ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)

// Language names are shown in their own language, always; and files nobody
// has committed yet are someone else's work in progress.
const NEVER = new Set(['components/LanguageDropdown.tsx', 'components/LanguagePrompt.tsx', 'components/DialerShowcase.tsx', 'components/LeadQueueShowcase.tsx'])
const tracked = new Set(execFileSync('git', ['ls-files', 'app', 'components'], { encoding: 'utf8' }).split(String.fromCharCode(10)).map((l) => l.trim()))
let total = 0
for (const f of [...scope].sort()) {
  if (NEVER.has(f) || !tracked.has(f)) continue
  const sf = byRel.get(f)
  const src = sf.text
  const edits = []
  let tName = null
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && /@\/lib\/i18n\/(client|server)['"]?$/.test(st.moduleSpecifier.getText(sf).replace(/['"]/g, ''))) {
      const nb = st.importClause?.namedBindings
      if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) if ((el.propertyName ?? el.name).text === 't') tName = el.name.text
    }
  }
  const visit = (n) => {
    let target = null
    if (ts.isJsxExpression(n) && n.expression && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) target = n.expression
    if (ts.isJsxAttribute(n) && n.initializer && ts.isJsxExpression(n.initializer) && n.initializer.expression &&
        TEXT_ATTRS.has(n.name.getText(sf)) && ts.isJsxOpeningLikeElement(n.parent.parent) && /^[a-z]/.test(n.parent.parent.tagName.getText(sf))) target = n.initializer.expression
    if (target && isRef(target) && !isName(target) && isStringType(checker.getTypeAtLocation(target))) {
      edits.push({ pos: target.getStart(sf), end: target.getEnd(), text: target.getText(sf) })
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  if (!edits.length) continue
  total += edits.length
  console.log(`${edits.length}\t${f}${tName ? '' : '\t(adds import)'}`)
  if (!WRITE) continue
  const name = tName || 't'
  let out = src
  for (const e of edits.sort((a, b) => b.pos - a.pos)) out = out.slice(0, e.pos) + `${name}(${e.text})` + out.slice(e.end)
  if (!tName) {
    const client = /^\s*['"]use client['"]/.test(out)
    const imp = `import { t } from '@/lib/i18n/${client ? 'client' : 'server'}'\n`
    const m = out.match(/^(\s*['"]use client['"];?\s*\n)?/)
    out = out.slice(0, m[0].length) + imp + out.slice(m[0].length)
  }
  fs.writeFileSync(f, out)
}
console.log(`${total} expressions in ${scope.size} files scanned`)
