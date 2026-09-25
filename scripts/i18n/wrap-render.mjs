// ── THIRD PASS: TEXT THAT REACHES THE SCREEN THROUGH A VARIABLE ─────
// node scripts/i18n/wrap-render.mjs <file.tsx> [...]
//
// After wrap.mjs and wrap-data.mjs, what is left is English that is written
// in one place and shown in another: an error fallback kept in state, a
// validator's return value, a label map indexed at render time.
//
//  A. Where it is shown: a JSX child (or text attribute) that is a variable
//     whose name says it holds text — {error}, {statusLabel}, {item.title},
//     {LABELS[k]} — becomes {t(…)}. t() passes anything that is not a string
//     straight through, and a string with no translation comes back as it
//     went in, so user data (a lead's name) is never altered.
//
//  B. Where it is written: prose string literals inside functions are marked
//     msg("…"), which returns its argument unchanged. That changes nothing at
//     runtime, compared values and keys included; it only lets the catalog
//     extractor find the text so it can be translated.
//
// Verified by verify.mjs like the other passes (t(x) and msg(x) are x).

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const TEXTY = /(error|err|message|msg|notice|status|label|title|text|copy|hint|warning|info|success|feedback|reason|heading|caption|desc|description|subtitle|headline|cta|note|banner|toast|prompt|verb|noun|word|phrase|summary|detail|explanation|tip|eyebrow|tagline|blurb|lede|empty|placeholder|question|answer|body|name)s?$/i
// …but never these, which are user data or identifiers.
const NOT_TEXT = /^(user|lead|campaign|team|agent|brand|tenant|file|script|first|last|full|display|seller|company|business|owner|member|contact|caller|host|domain|sub|key|class|tag|type|event|field|column|route|path|url|href|id|slug|role|plan|tier)?(name|names|Name|Names)$/
const TEXT_ATTRS = new Set(['title', 'placeholder', 'alt', 'aria-label', 'label'])

const isProse = (v) => {
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

function insideFunction(node) {
  for (let p = node.parent; p; p = p.parent) if (ts.isFunctionLike(p)) return true
  return false
}
function insideMetadata(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) && /^(metadata|baseMetadata|viewport|keywords|KEYWORDS)$/.test(p.name.text)) return true
    if (ts.isFunctionDeclaration(p) && p.name && /^generate(Metadata|Viewport|StaticParams)$/.test(p.name.text)) return true
    if (ts.isPropertyAssignment(p) && /^(keywords|style|sx|className|fontFamily)$/.test(p.name?.text ?? '')) return true
  }
  return false
}

function lastName(e) {
  if (ts.isIdentifier(e)) return e.text
  if (ts.isPropertyAccessExpression(e)) return e.name.text
  if (ts.isNonNullExpression(e)) return lastName(e.expression)
  return null
}
function isTextyRef(e) {
  if (ts.isParenthesizedExpression(e)) return isTextyRef(e.expression)
  if (ts.isNonNullExpression(e)) return isTextyRef(e.expression)
  if (ts.isElementAccessExpression(e)) {
    const base = e.expression
    return ts.isIdentifier(base) && (/^[A-Z][A-Z0-9_]*$/.test(base.text) || TEXTY.test(base.text))
  }
  const n = lastName(e)
  return !!n && TEXTY.test(n) && !NOT_TEXT.test(n)
}

export function wrapRenderSource(src, fileName, mode) {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const tImport = src.match(/import \{([^}]*)\} from ['"]@\/lib\/i18n\/(client|server)['"]/)
  let tName = null
  if (tImport) { const m = tImport[1].match(/\bt(?:\s+as\s+(\w+))?\s*(?:,|$)/); if (m) tName = m[1] || 't' }
  const names = new Set()
  const collectNames = (n) => {
    if ((ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isFunctionDeclaration(n) || ts.isBindingElement(n) ||
      ts.isImportSpecifier(n)) && n.name && ts.isIdentifier(n.name)) names.add(n.name.text)
    ts.forEachChild(n, collectNames)
  }
  collectNames(sf)
  const needT = !tName
  if (!tName) tName = names.has('t') ? (names.has('tr') ? 'tx' : 'tr') : 't'
  const msgImp = src.match(/import \{\s*msg(?: as (\w+))?\s*\} from ['"]@\/lib\/i18n\/msg['"]/)
  const needMsg = !msgImp
  const msgName = msgImp ? (msgImp[1] || 'msg') : (names.has('msg') ? 'msgText' : 'msg')
  const wrappedBy = (n) => {
    const p = n.parent
    return p && ts.isCallExpression(p) && ts.isIdentifier(p.expression) && [tName, msgName, 't', 'tr', 'tx', 'msg'].includes(p.expression.text)
  }

  const edits = []
  let usedT = false, usedMsg = false

  const wrapRef = (e) => {
    if (ts.isParenthesizedExpression(e)) return wrapRef(e.expression)
    if (ts.isConditionalExpression(e)) { wrapRef(e.whenTrue); wrapRef(e.whenFalse); return }
    if (ts.isBinaryExpression(e) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(e.operatorToken.kind)) {
      wrapRef(e.left); wrapRef(e.right); return
    }
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) { wrapRef(e.right); return }
    if (isTextyRef(e) && !wrappedBy(e)) {
      edits.push({ start: e.getStart(sf), end: e.getEnd(), text: `${tName}(${e.getText(sf)})` })
      usedT = true
    }
  }

  const visit = (node) => {
    // A. render sites
    if (ts.isJsxExpression(node) && node.expression && insideFunction(node)) {
      const p = node.parent
      const ok = p && (ts.isJsxElement(p) || ts.isJsxFragment(p) || (ts.isJsxAttribute(p) && TEXT_ATTRS.has(p.name.getText(sf))))
      if (ok && !wrappedBy(node.expression)) wrapRef(node.expression)
    }
    // B. prose literals inside functions → msg()
    if ((ts.isStringLiteral(node) || (ts.isNoSubstitutionTemplateLiteral(node) && !node.text.includes('\n'))) &&
      insideFunction(node) && !insideMetadata(node) && isProse(node.text) && node.text === node.text.trim() && !wrappedBy(node)) {
      const p = node.parent
      const skip =
        ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isCaseClause(p) ||
        (ts.isPropertyAssignment(p) && p.name === node) ||
        (ts.isPropertyAssignment(p) && /^(method|mode|credentials|cache|redirect|headers|contentType|Accept|variant|kind|type|status|code|action|event|state|role)$/.test(p.name.getText(sf))) ||
        (ts.isBinaryExpression(p) && /^(===|!==|==|!=|in|instanceof)$/.test(p.operatorToken.getText(sf))) ||
        ts.isJsxAttribute(p) || ts.isLiteralTypeNode(p) || ts.isElementAccessExpression(p) ||
        (ts.isCallExpression(p) && /^(console\.\w+|fetch|require|import|router\.(push|replace)|searchParams\.(get|set)|localStorage\.\w+|sessionStorage\.\w+|document\.\w+|window\.open|\w+\.(includes|startsWith|endsWith|indexOf|split|replace|replaceAll|match|test|get|has|set|delete|add|querySelector|querySelectorAll|getItem|setItem|removeItem|append))$/.test(p.expression.getText(sf))) ||
        ts.isNewExpression(p) || ts.isTypeReferenceNode(p)
      if (!skip) {
        edits.push({ start: node.getStart(sf), end: node.getEnd(), text: `${msgName}(${JSON.stringify(node.text)})` })
        usedMsg = true
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)

  if (!edits.length) return { src, changed: false, count: 0 }
  // Nested edits (a literal inside a wrapped reference) cannot both apply;
  // keep the outer one.
  edits.sort((a, b) => a.start - b.start || b.end - a.end)
  const kept = []
  for (const e of edits) {
    const last = kept[kept.length - 1]
    if (last && e.start < last.end) continue
    kept.push(e)
  }
  kept.sort((a, b) => b.start - a.start)
  let out = src
  for (const e of kept) out = out.slice(0, e.start) + e.text + out.slice(e.end)

  const imports = []
  if (usedMsg && needMsg) imports.push(`import { msg${msgName === 'msg' ? '' : ' as ' + msgName} } from '@/lib/i18n/msg'`)
  if (usedT && needT) imports.push(`import { t${tName === 't' ? '' : ' as ' + tName} } from '${mode === 'server' ? '@/lib/i18n/server' : '@/lib/i18n/client'}'`)
  if (imports.length) {
    const sf2 = ts.createSourceFile(fileName, out, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const imps = sf2.statements.filter(ts.isImportDeclaration)
    if (imps.length) {
      const at = imps[imps.length - 1].getEnd()
      out = out.slice(0, at) + '\n' + imports.join('\n') + out.slice(at)
    } else {
      const m = out.match(/^(['"]use client['"];?\s*\n)/)
      out = m ? m[1] + imports.join('\n') + '\n' + out.slice(m[1].length) : imports.join('\n') + '\n' + out
    }
  }
  return { src: out, changed: true, count: kept.length }
}

if (process.argv[1] && /wrap-render\.mjs$/.test(process.argv[1])) {
  for (const f of process.argv.slice(2).filter((a) => !a.startsWith('--'))) {
    const src = fs.readFileSync(f, 'utf8')
    const isClient = /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(src) || /dispositionPie|site-footer/.test(f)
    const { src: out, changed, count } = wrapRenderSource(src, f, isClient ? 'client' : 'server')
    if (changed) {
      const saved = path.join(process.env.I18N_ORIG || '.i18n-orig', f.split(path.sep).join('/'))
      if (!fs.existsSync(saved)) { fs.mkdirSync(path.dirname(saved), { recursive: true }); fs.writeFileSync(saved, src) }
      fs.writeFileSync(f, out)
    }
    console.log(`${changed ? 'render ' : 'nothing'} ${String(count).padStart(4)}  ${isClient ? 'client' : 'server'}  ${f}`)
  }
}
