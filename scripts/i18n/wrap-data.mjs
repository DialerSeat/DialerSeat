// ── SECOND PASS: TEXT THAT LIVES IN DATA AND STATE ──────────────────
// node scripts/i18n/wrap-data.mjs <file.tsx> [...]
//
// wrap.mjs handles text written in JSX. This handles the two other places
// visible text lives:
//
//  1. Labels in data: { label: 'LEADS', href: '/dashboard/leads' }.
//     The string is marked with msg() — an identity function, so the value is
//     still the English text everywhere it is compared or used as a key — and
//     the place it is rendered, {item.label}, becomes {t(item.label)}.
//     msg() is what the catalog extractor looks for; t() is what translates.
//
//  2. Messages set through state or shown in dialogs:
//     setError('Could not save') → setError(t('Could not save')), and the same
//     for alert() and confirm(). Only calls inside functions, only strings that
//     read as prose, and never a string the file also compares against.
//
// Verified the same way as wrap.mjs: verify.mjs treats msg(x) and t(x) as x.

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const UI_PROPS = new Set([
  'label', 'title', 'desc', 'description', 'subtitle', 'sub', 'heading', 'text',
  'body', 'q', 'a', 'question', 'answer', 'cta', 'caption', 'hint', 'tooltip',
  'note', 'summary', 'blurb', 'tagline', 'eyebrow', 'detail', 'details', 'message',
  'empty', 'emptyText', 'help', 'helpText', 'placeholder', 'short', 'long',
  'headline', 'lede', 'lead', 'intro', 'tldr', 'verdict', 'why', 'what', 'how',
  'pro', 'con', 'ours', 'theirs', 'value', 'feature', 'benefit', 'reason',
  'tip', 'warning', 'info', 'subLabel', 'sublabel', 'badge', 'tag', 'unit',
])
const SETTER = /^set[A-Z]\w*(Error|Message|Msg|Notice|Toast|Info|Warning|Success|Text|Hint|Banner|Feedback|Status|Result|Label|Copy)$/
const DIALOGS = new Set(['alert', 'confirm', 'prompt'])

const isProse = (v) => {
  const s = v.trim()
  if (s.length < 2 || !/[A-Za-z]/.test(s)) return false
  if (['DialerSeat', 'DIALERSEAT', 'Dialerseat'].includes(s)) return false
  if (/^(https?:|mailto:|tel:|\/|#|\.|rgba?\(|var\(--|hsl)/.test(s)) return false
  if (/[{};<>]|=>|\$\{/.test(s)) return false
  if (/^[a-z0-9_.:-]+$/.test(s)) return false // keys, slugs, enums, css
  if (/^[A-Z0-9_]+$/.test(s) && s.includes('_')) return false // CONSTANT_KEYS
  if (/\b\d+(px|em|rem|%|ms|s)\b|\b(solid|dashed|flex|auto|inherit|bold|normal|none)\b/.test(s)) return false
  if (/^['"]?[A-Z][\w ]*['"]?, ?(['"]?[\w -]+['"]?, ?)*(sans-serif|serif|monospace)$/.test(s)) return false // font stacks
  return true
}

// Page metadata (titles, descriptions, Open Graph) is localised separately,
// from the metadata object itself, so it is left exactly as written.
function insideMetadata(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) && /^(metadata|baseMetadata|viewport)$/.test(p.name.text)) return true
    if (ts.isFunctionDeclaration(p) && p.name && /^generate(Metadata|Viewport)$/.test(p.name.text)) return true
  }
  return false
}

function insideFunction(node) {
  for (let p = node.parent; p; p = p.parent) if (ts.isFunctionLike(p)) return true
  return false
}

function declaredNames(sf) {
  const names = new Set()
  const visit = (n) => {
    if ((ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isFunctionDeclaration(n) ||
      ts.isBindingElement(n) || ts.isImportSpecifier(n) || ts.isImportClause(n)) && n.name && ts.isIdentifier(n.name)) {
      names.add(n.name.text)
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return names
}

export function wrapDataSource(src, fileName, mode) {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const names = declaredNames(sf)
  const mod = mode === 'server' ? '@/lib/i18n/server' : '@/lib/i18n/client'

  // Reuse whatever name wrap.mjs gave t in this file.
  const tImport = src.match(/import \{([^}]*)\} from ['"]@\/lib\/i18n\/(client|server)['"]/)
  let tName = null
  if (tImport) {
    const m = tImport[1].match(/\bt(?:\s+as\s+(\w+))?\b/)
    if (m) tName = m[1] || 't'
  }
  const needT = !tName
  if (!tName) tName = names.has('t') ? (names.has('tr') ? 'tx' : 'tr') : 't'
  const msgName = names.has('msg') ? 'msgText' : 'msg'

  // Literals the file compares against stay untouched in setters: wrapping
  // setMsg('Saved') would break a later `msg === 'Saved'`.
  const compared = new Set()
  const collect = (n) => {
    if (ts.isBinaryExpression(n) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
      ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(n.operatorToken.kind)) {
      for (const side of [n.left, n.right]) if (ts.isStringLiteral(side)) compared.add(side.text)
    }
    if (ts.isCaseClause(n) && ts.isStringLiteral(n.expression)) compared.add(n.expression.text)
    ts.forEachChild(n, collect)
  }
  collect(sf)

  const edits = []
  const markedProps = new Set()
  let usedMsg = false, usedT = false
  const isCall = (n, name) => n.parent && ts.isCallExpression(n.parent) && ts.isIdentifier(n.parent.expression) && n.parent.expression.text === name

  const visit = (node) => {
    // 1a. { label: 'LEADS' } → { label: msg('LEADS') }
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && UI_PROPS.has(node.name.text) && !insideMetadata(node)) {
      const v = node.initializer
      if ((ts.isStringLiteral(v) || (ts.isNoSubstitutionTemplateLiteral(v) && !v.text.includes('\n'))) && isProse(v.text) && v.text === v.text.trim()) {
        if (!isCall(v, msgName) && !isCall(v, tName)) {
          edits.push({ start: v.getStart(sf), end: v.getEnd(), text: `${msgName}(${JSON.stringify(v.text)})` })
          usedMsg = true
          markedProps.add(node.name.text)
        }
      }
    }
    // 2. setError('…'), alert('…'), confirm('…')
    if (ts.isCallExpression(node) && insideFunction(node) && node.arguments.length >= 1) {
      const callee = node.expression
      const name = ts.isIdentifier(callee) ? callee.text
        : ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'window' ? callee.name.text : null
      if (name && (SETTER.test(name) || DIALOGS.has(name))) {
        const arg = node.arguments[0]
        const lits = []
        const pick = (e) => {
          if (ts.isParenthesizedExpression(e)) return pick(e.expression)
          if (ts.isStringLiteral(e)) lits.push(e)
          else if (ts.isConditionalExpression(e)) { pick(e.whenTrue); pick(e.whenFalse) }
          else if (ts.isBinaryExpression(e) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(e.operatorToken.kind)) pick(e.right)
        }
        pick(arg)
        for (const lit of lits) {
          if (isProse(lit.text) && lit.text === lit.text.trim() && !compared.has(lit.text) && !isCall(lit, tName)) {
            edits.push({ start: lit.getStart(sf), end: lit.getEnd(), text: `${tName}(${JSON.stringify(lit.text)})` })
            usedT = true
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)

  // 1b. Render sites: {item.label} → {t(item.label)}, for the props marked
  // in this file. Only JSX children and text attributes, only inside
  // functions, and only a bare property access (a call or ternary is left
  // alone). tsc then tells us if any of them was not a string.
  const renderVisit = (node) => {
    if (ts.isJsxExpression(node) && node.expression && insideFunction(node)) {
      const e = node.expression
      const parentOk = node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent) ||
        (ts.isJsxAttribute(node.parent) && ['title', 'placeholder', 'alt', 'aria-label', 'label'].includes(node.parent.name.getText(sf))))
      if (parentOk && ts.isPropertyAccessExpression(e) && markedProps.has(e.name.text)) {
        edits.push({ start: e.getStart(sf), end: e.getEnd(), text: `${tName}(${e.getText(sf)})` })
        usedT = true
      }
    }
    ts.forEachChild(node, renderVisit)
  }
  if (markedProps.size) renderVisit(sf)

  if (!edits.length) return { src, changed: false, count: 0 }
  edits.sort((a, b) => b.start - a.start)
  let out = src
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end)

  const imports = []
  if (usedMsg) imports.push(`import { msg${msgName === 'msg' ? '' : ' as ' + msgName} } from '@/lib/i18n/msg'`)
  if (usedT && needT) imports.push(`import { t${tName === 't' ? '' : ' as ' + tName} } from '${mod}'`)
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
  return { src: out, changed: true, count: edits.length }
}

if (process.argv[1] && /wrap-data\.mjs$/.test(process.argv[1])) {
  const args = process.argv.slice(2)
  for (const f of args.filter((a) => !a.startsWith('--'))) {
    const src = fs.readFileSync(f, 'utf8')
    const isClient = /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(src)
    const mode = isClient ? 'client' : 'server'
    const { src: out, changed, count } = wrapDataSource(src, f, mode)
    if (changed) {
      const saved = path.join(process.env.I18N_ORIG || '.i18n-orig', f.split(path.sep).join('/'))
      if (!fs.existsSync(saved)) {
        fs.mkdirSync(path.dirname(saved), { recursive: true })
        fs.writeFileSync(saved, src)
      }
      fs.writeFileSync(f, out)
    }
    console.log(`${changed ? 'data   ' : 'nothing'} ${String(count).padStart(4)}  ${mode}  ${f}`)
  }
}
