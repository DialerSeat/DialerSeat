// ── WRAP VISIBLE TEXT IN t() ────────────────────────────────────────
// node scripts/i18n/wrap.mjs <file.tsx> [...]
//
// Mechanical and conservative. It wraps:
//   - JSX text:                <p>Hello</p>        → <p>{t("Hello")}</p>
//   - string literals rendered as JSX children, including both sides of a
//     ternary or the fallback of || / ??
//   - placeholder, title, alt and aria-label string attributes
// and adds the import. Everything else — strings in state, toasts, arrays of
// labels — is left for a hand pass, because only a person can tell a label
// from a key.
//
// It never wraps anything at module scope: a t() call there would run once,
// at import, outside any request, and freeze the language.
//
// English output is unchanged by construction (t() returns its argument for
// English) and checked afterwards by scripts/i18n/verify.mjs, which compiles
// the file before and after and compares what React would render.

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const NEVER = new Set(['DialerSeat', 'DIALERSEAT', 'Dialerseat', 'D', 'dialerseat.com'])
const TEXT_ATTRS = new Set(['placeholder', 'title', 'alt', 'aria-label'])
const SKIP_PARENTS = new Set(['style', 'script', 'code', 'kbd', 'pre'])

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—',
  ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  hellip: '…', middot: '·', bull: '•', times: '×', copy: '©',
  reg: '®', trade: '™', rarr: '→', larr: '←', uarr: '↑',
  darr: '↓', check: '✓', deg: '°', plusmn: '±', cent: '¢',
  pound: '£', euro: '€', laquo: '«', raquo: '»', thinsp: ' ',
  ensp: ' ', emsp: ' ', zwj: '‍', zwnj: '‌', shy: '­',
}

function decodeEntities(s) {
  let ok = true
  const out = s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return String.fromCodePoint(n)
    }
    if (ENTITIES[e] !== undefined) return ENTITIES[e]
    ok = false
    return m
  })
  return ok ? out : null
}

// Babel's JSX whitespace rule, which is what React receives.
function jsxTextValue(raw) {
  const lines = raw.split(/\r\n|\n|\r/)
  let lastNonEmpty = 0
  lines.forEach((l, i) => { if (/[^ \t]/.test(l)) lastNonEmpty = i })
  let str = ''
  lines.forEach((line, i) => {
    let s = line.replace(/\t/g, ' ')
    if (i !== 0) s = s.replace(/^[ ]+/, '')
    if (i !== lines.length - 1) s = s.replace(/[ ]+$/, '')
    if (s) {
      if (i !== lastNonEmpty) s += ' '
      str += s
    }
  })
  return str
}

function worthTranslating(s) {
  const core = s.trim()
  if (!core || !/[A-Za-z]/.test(core)) return false
  if (NEVER.has(core)) return false
  // A lone letter is a plural suffix or an initial ("S", "x"), not text.
  if (core.length < 2) return false
  if (/^(https?:\/\/|www\.)\S+$/.test(core)) return false
  if (/^\S+@\S+\.\S+$/.test(core)) return false
  // Lone code-ish tokens: CSS values, identifiers, file names.
  if (/^[a-z0-9_-]+(\.[a-z0-9]+)+$/i.test(core)) return false
  return true
}

function declaredNames(sf) {
  const names = new Set()
  const visit = (n) => {
    if ((ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isFunctionDeclaration(n) ||
      ts.isBindingElement(n) || ts.isImportSpecifier(n) || ts.isImportClause(n)) && n.name && ts.isIdentifier(n.name)) {
      names.add(n.name.text)
    }
    if (ts.isNamespaceImport(n)) names.add(n.name.text)
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return names
}

function insideFunction(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isFunctionLike(p)) return true
  }
  return false
}

function tagName(el) {
  const open = ts.isJsxElement(el) ? el.openingElement : el
  return open.tagName.getText()
}

export function wrapSource(src, fileName, mode) {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const names = declaredNames(sf)
  // Only an import of t itself counts; a file may import useLocale alone.
  const alreadyImported = /import \{\s*t(?: as \w+)?\s*\} from ['"]@\/lib\/i18n\/(client|server)['"]/.test(src)
  let fn = 't'
  if (!alreadyImported && names.has('t')) fn = names.has('tr') ? 'tx' : 'tr'
  if (alreadyImported) {
    const m = src.match(/import \{\s*t(?: as (\w+))?\s*\} from ['"]@\/lib\/i18n\/(?:client|server)['"]/)
    if (m && m[1]) fn = m[1]
  }
  const call = (s) => `${fn}(${JSON.stringify(s)})`
  const edits = []
  const strings = []

  const wrapLiteral = (lit) => {
    const v = lit.text
    if (!worthTranslating(v) || v !== v.trim()) return
    edits.push({ start: lit.getStart(sf), end: lit.getEnd(), text: call(v) })
    strings.push(v)
  }

  // Literals that end up rendered: the expression itself, both ternary
  // branches, the right side of || ?? &&, through parentheses.
  const wrapRendered = (e) => {
    if (!e) return
    if (ts.isParenthesizedExpression(e)) return wrapRendered(e.expression)
    if (ts.isStringLiteral(e)) return wrapLiteral(e)
    // A multi-line template is preformatted — a formula or a code sample.
    if (ts.isNoSubstitutionTemplateLiteral(e)) return e.text.includes('\n') ? undefined : wrapLiteral(e)
    if (ts.isConditionalExpression(e)) { wrapRendered(e.whenTrue); wrapRendered(e.whenFalse); return }
    if (ts.isBinaryExpression(e)) {
      const k = e.operatorToken.kind
      if (k === ts.SyntaxKind.BarBarToken || k === ts.SyntaxKind.QuestionQuestionToken || k === ts.SyntaxKind.AmpersandAmpersandToken) {
        wrapRendered(e.right)
        if (k !== ts.SyntaxKind.AmpersandAmpersandToken) wrapRendered(e.left)
      }
    }
  }

  const alreadyWrapped = (n) => {
    const p = n.parent
    return p && ts.isCallExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === fn
  }

  const visit = (node) => {
    if (ts.isJsxElement(node) && SKIP_PARENTS.has(tagName(node))) return

    if (ts.isJsxText(node) && insideFunction(node)) {
      const raw = node.getText(sf)
      const value = jsxTextValue(raw)
      const decoded = value && decodeEntities(value)
      if (decoded && worthTranslating(decoded)) {
        // Keep edge spaces exactly: "ONLY  " before a link is two spaces.
        // Only plain spaces count — a &nbsp; at the edge stays in the text.
        const lead = decoded.match(/^ */)[0]
        const trail = decoded.slice(lead.length).match(/ *$/)[0]
        const core = decoded.slice(lead.length, decoded.length - trail.length)
        const text = (lead ? `{${JSON.stringify(lead)}}` : '') + `{${call(core)}}` + (trail ? `{${JSON.stringify(trail)}}` : '')
        edits.push({ start: node.getStart(sf), end: node.getEnd(), text })
        strings.push(core)
      }
    }

    if (ts.isJsxExpression(node) && node.expression && insideFunction(node) &&
      node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      if (!alreadyWrapped(node.expression)) wrapRendered(node.expression)
    }

    if (ts.isJsxAttribute(node) && insideFunction(node)) {
      const name = node.name.getText(sf)
      if (TEXT_ATTRS.has(name) && node.initializer) {
        const init = node.initializer
        if (ts.isStringLiteral(init)) {
          const v = init.text
          if (worthTranslating(v) && v === v.trim() && !/[&]/.test(init.getText(sf))) {
            edits.push({ start: init.getStart(sf), end: init.getEnd(), text: `{${call(v)}}` })
            strings.push(v)
          }
        } else if (ts.isJsxExpression(init) && init.expression && !alreadyWrapped(init.expression)) {
          wrapRendered(init.expression)
        }
      }
    }

    ts.forEachChild(node, visit)
  }
  visit(sf)

  if (!edits.length) return { src, strings, changed: false }

  edits.sort((a, b) => b.start - a.start)
  let out = src
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end)

  if (!alreadyImported) {
    const mod = mode === 'server' ? '@/lib/i18n/server' : '@/lib/i18n/client'
    const spec = fn === 't' ? 't' : `t as ${fn}`
    const imp = `import { ${spec} } from '${mod}'\n`
    // After the last import (and after 'use client', which must stay first).
    const imports = sf.statements.filter(ts.isImportDeclaration)
    if (imports.length) {
      const last = imports[imports.length - 1]
      const at = last.getEnd()
      out = out.slice(0, at) + '\n' + imp.trimEnd() + out.slice(at)
    } else {
      const m = out.match(/^(['"]use client['"];?\s*\n)/)
      out = m ? m[1] + imp + out.slice(m[1].length) : imp + out
    }
  }
  return { src: out, strings, changed: true }
}

if (process.argv[1] && process.argv[1].endsWith('wrap.mjs')) {
  const args = process.argv.slice(2)
  const forced = args.find((a) => a.startsWith('--mode='))?.slice(7)
  for (const f of args.filter((a) => !a.startsWith('--'))) {
    const src = fs.readFileSync(f, 'utf8')
    const isClient = /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(src)
    const mode = forced || (isClient ? 'client' : 'server')
    const { src: out, strings, changed } = wrapSource(src, f, mode)
    if (changed) {
      // Keep the pre-wrap copy for verify.mjs (first wrap only).
      const saved = path.join(process.env.I18N_ORIG || '.i18n-orig', f.split(path.sep).join('/'))
      if (!fs.existsSync(saved)) {
        fs.mkdirSync(path.dirname(saved), { recursive: true })
        fs.writeFileSync(saved, src)
      }
      fs.writeFileSync(f, out)
    }
    console.log(`${changed ? 'wrapped' : 'nothing '} ${String(strings.length).padStart(4)}  ${mode}  ${f}`)
  }
}
