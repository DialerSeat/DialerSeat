// ── FOURTH PASS: WHOLE SENTENCES, NOT FRAGMENTS ─────────────────────
// node scripts/i18n/wrap-sentences.mjs <file.tsx> [...]
//
// A sentence built from pieces cannot be translated piece by piece: other
// languages put the words in a different order. This pass joins the pieces
// into one string with named placeholders.
//
//  JSX:       {total} TOTAL · {loaded} LOADED
//             → {t("{total} TOTAL · {loaded} LOADED", { total, loaded })}
//  Template:  setError(`Could not remove ${name}`)
//             → setError(t("Could not remove {name}", { name }))
//
// It uses the TypeScript type checker and only takes values that are text,
// numbers, booleans or empty — exactly the things React prints as text — so a
// merged sentence renders the same characters the pieces did. Anything typed
// `any`, an object, or JSX stays where it is.

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const SETTER = /^set[A-Z]\w*(Error|Message|Msg|Notice|Toast|Info|Warning|Success|Text|Hint|Banner|Feedback|Status|Result|Label|Copy)$/
const DIALOGS = new Set(['alert', 'confirm', 'prompt'])
const TEXT_ATTRS = new Set(['title', 'placeholder', 'alt', 'aria-label', 'label'])
const UI_PROPS = new Set(['label', 'title', 'desc', 'description', 'subtitle', 'sub', 'heading', 'text', 'body',
  'message', 'hint', 'tooltip', 'note', 'summary', 'caption', 'cta', 'detail', 'helpText', 'placeholder'])

function jsxTextValue(raw) {
  const lines = raw.split(/\r\n|\n|\r/)
  let lastNonEmpty = 0
  lines.forEach((l, i) => { if (/[^ \t]/.test(l)) lastNonEmpty = i })
  let str = ''
  lines.forEach((line, i) => {
    let s = line.replace(/\t/g, ' ')
    if (i !== 0) s = s.replace(/^[ ]+/, '')
    if (i !== lines.length - 1) s = s.replace(/[ ]+$/, '')
    if (s) { if (i !== lastNonEmpty) s += ' '; str += s }
  })
  return str
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–',
  middot: '·', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', times: '×', bull: '•', rarr: '→', larr: '←' }
function decode(s) {
  let ok = true
  const out = s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
    if (ENT[e] !== undefined) return ENT[e]
    ok = false; return m
  })
  return ok ? out : null
}

function hasJsxOrFn(n) {
  let found = false
  const v = (x) => {
    if (found) return
    if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x) || ts.isFunctionLike(x)) { found = true; return }
    ts.forEachChild(x, v)
  }
  v(n)
  return found
}

function placeholderName(e) {
  if (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e)) return placeholderName(e.expression)
  if (ts.isIdentifier(e)) return e.text
  if (ts.isPropertyAccessExpression(e)) return e.name.text
  if (ts.isElementAccessExpression(e)) return placeholderName(e.expression)
  if (ts.isCallExpression(e)) {
    const c = e.expression
    if (ts.isPropertyAccessExpression(c)) {
      if (/^(toLocaleString|toString|toFixed|toUpperCase|toLowerCase|trim|join)$/.test(c.name.text)) return placeholderName(c.expression)
      return c.name.text.replace(/^(get|format|to)/, '') || 'value'
    }
    if (ts.isIdentifier(c)) {
      if (/^(t|tr|tx|msg|String|Number)$/.test(c.text) && e.arguments[0]) return placeholderName(e.arguments[0])
      return c.text.replace(/^(get|format|to|fmt)/, '') || 'value'
    }
  }
  if (ts.isConditionalExpression(e)) return placeholderName(e.whenTrue) || 'value'
  if (ts.isBinaryExpression(e)) return placeholderName(e.left) || 'value'
  return 'value'
}
const cleanName = (n) => {
  const s = String(n || 'value').replace(/[^A-Za-z0-9_]/g, '')
  const c = s ? s[0].toLowerCase() + s.slice(1) : 'value'
  return /^\d/.test(c) ? 'v' + c : c
}

export function sentenceProgram(files) {
  const cfgPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, 'tsconfig.json')
  const cfg = ts.getParsedCommandLineOfConfigFile(cfgPath, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} })
  return ts.createProgram(files.map((f) => path.resolve(f)), { ...cfg.options, noEmit: true })
}

export function wrapSentencesSource(program, file) {
  const checker = program.getTypeChecker()
  const sf = program.getSourceFile(path.resolve(file))
  const src = sf.getFullText()
  const tImport = src.match(/import \{([^}]*)\} from ['"]@\/lib\/i18n\/(client|server)['"]/)
  let tName = null
  if (tImport) { const m = tImport[1].match(/\bt(?:\s+as\s+(\w+))?\s*(?:,|$)/); if (m) tName = m[1] || 't' }
  if (!tName) return { src, changed: false, count: 0, reason: 'no t import' }

  const printable = (e) => {
    if (hasJsxOrFn(e)) return false
    const type = checker.getTypeAtLocation(e)
    const parts = type.isUnion() ? type.types : [type]
    return parts.every((p) => {
      const f = p.flags
      if (f & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)) return false
      return !!(f & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike |
        ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void))
    })
  }
  // Template spans: String() of a boolean is "true", which React would not
  // print, so templates take text and numbers only (and empty values, which a
  // template prints as "undefined" — showing nothing instead is a fix, not a
  // change anyone relies on).
  const printableInTemplate = (e) => {
    if (hasJsxOrFn(e)) return false
    const type = checker.getTypeAtLocation(e)
    const parts = type.isUnion() ? type.types : [type]
    return parts.every((p) => {
      const f = p.flags
      if (f & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never | ts.TypeFlags.BooleanLike)) return false
      return !!(f & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.Null | ts.TypeFlags.Undefined))
    })
  }
  const isTLiteral = (e) => ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === tName &&
    e.arguments.length === 1 && ts.isStringLiteral(e.arguments[0])

  const edits = []

  const build = (pieces) => {
    // pieces: [{ text } | { expr }]
    const used = new Map()
    let key = ''
    const props = []
    for (const p of pieces) {
      if ('text' in p) { key += p.text; continue }
      const exprText = p.expr.getText(sf)
      let name = used.get(exprText)
      if (!name) {
        let base = cleanName(placeholderName(p.expr)), n = base, i = 2
        while ([...used.values()].includes(n)) n = base + i++
        used.set(exprText, n)
        name = n
        props.push(name === exprText ? name : `${name}: ${exprText}`)
      }
      key += `{${name}}`
    }
    return { key, props }
  }

  // ── JSX runs ──
  const visitJsx = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      const kids = node.children
      let run = []
      const flush = () => {
        // Trim whitespace-only pieces off both ends; they stay as they are.
        while (run.length && run[0].ws) run.shift()
        while (run.length && run[run.length - 1].ws) run.pop()
        const hasT = run.some((r) => r.kind === 't' && /[A-Za-z]{2}/.test(r.text))
        const hasExpr = run.some((r) => r.kind === 'expr')
        const staticText = run.filter((r) => 'text' in r).map((r) => r.text).join('')
        if (hasT && hasExpr && run.length >= 2 && !/[{}]/.test(staticText)) {
          const pieces = run.map((r) => (r.kind === 'expr' ? { expr: r.expr } : { text: r.text }))
          let { key, props } = build(pieces)
          const lead = key.match(/^ */)[0], trail = key.slice(lead.length).match(/ *$/)[0]
          key = key.slice(lead.length, key.length - trail.length)
          const call = `{${tName}(${JSON.stringify(key)}, { ${props.join(', ')} })}`
          edits.push({
            start: ts.isJsxText(run[0].node) ? run[0].node.pos : run[0].node.getStart(sf), end: run[run.length - 1].node.getEnd(),
            text: (lead ? `{${JSON.stringify(lead)}}` : '') + call + (trail ? `{${JSON.stringify(trail)}}` : ''),
          })
        }
        run = []
      }
      for (const k of kids) {
        if (ts.isJsxText(k)) {
          // Raw source range: getText() skips a whitespace-only text node's
          // own content, which would lose the space between two values.
          const v = decode(jsxTextValue(sf.text.slice(k.pos, k.end)))
          if (v === null) { flush(); continue }
          run.push({ node: k, kind: 'text', text: v, ws: !v.trim() })
        } else if (ts.isJsxExpression(k)) {
          const e = k.expression
          if (!e) { run.push({ node: k, kind: 'text', text: '', ws: true }); continue }
          if (isTLiteral(e)) run.push({ node: k, kind: 't', text: e.arguments[0].text, ws: false })
          else if (ts.isStringLiteral(e)) run.push({ node: k, kind: 'text', text: e.text, ws: !e.text.trim() })
          else if (printable(e)) run.push({ node: k, kind: 'expr', expr: e, ws: false })
          else flush()
        } else flush()
      }
      flush()
    }
    ts.forEachChild(node, visitJsx)
  }
  visitJsx(sf)

  // ── Template literals ──
  const inTextContext = (tpl) => {
    let p = tpl.parent
    while (p && (ts.isParenthesizedExpression(p) || ts.isConditionalExpression(p) ||
      (ts.isBinaryExpression(p) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(p.operatorToken.kind)))) p = p.parent
    if (!p) return false
    if (ts.isJsxExpression(p)) {
      const q = p.parent
      return ts.isJsxElement(q) || ts.isJsxFragment(q) || (ts.isJsxAttribute(q) && TEXT_ATTRS.has(q.name.getText(sf)))
    }
    if (ts.isCallExpression(p)) {
      const c = p.expression
      const name = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) && c.expression.getText(sf) === 'window' ? c.name.text : ''
      return SETTER.test(name) || DIALOGS.has(name)
    }
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && UI_PROPS.has(p.name.text)) {
      for (let q = p.parent; q; q = q.parent) if (ts.isFunctionLike(q)) return true
    }
    return false
  }
  const visitTpl = (node) => {
    if (ts.isTemplateExpression(node) && inTextContext(node)) {
      const pieces = [{ text: node.head.text }]
      let ok = true
      for (const span of node.templateSpans) {
        if (!printableInTemplate(span.expression)) { ok = false; break }
        pieces.push({ expr: span.expression }, { text: span.literal.text })
      }
      const staticText = pieces.filter((p) => 'text' in p).map((p) => p.text).join('')
      if (ok && /[A-Za-z]{2,}/.test(staticText) && /\s/.test(staticText.trim()) && !/[{}\n]/.test(staticText)) {
        const { key, props } = build(pieces)
        edits.push({ start: node.getStart(sf), end: node.getEnd(), text: `${tName}(${JSON.stringify(key)}, { ${props.join(', ')} })` })
        return
      }
    }
    ts.forEachChild(node, visitTpl)
  }
  visitTpl(sf)

  if (!edits.length) return { src, changed: false, count: 0 }
  edits.sort((a, b) => a.start - b.start || b.end - a.end)
  const kept = []
  for (const e of edits) { const l = kept[kept.length - 1]; if (l && e.start < l.end) continue; kept.push(e) }
  kept.sort((a, b) => b.start - a.start)
  let out = src
  for (const e of kept) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  return { src: out, changed: true, count: kept.length }
}

if (process.argv[1] && /wrap-sentences\.mjs$/.test(process.argv[1])) {
  const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const program = sentenceProgram(files)
  for (const f of files) {
    const before = fs.readFileSync(f, 'utf8')
    const { src: out, changed, count, reason } = wrapSentencesSource(program, f)
    if (changed) {
      const saved = path.join(process.env.I18N_ORIG || '.i18n-orig', f.split(path.sep).join('/'))
      if (!fs.existsSync(saved)) { fs.mkdirSync(path.dirname(saved), { recursive: true }); fs.writeFileSync(saved, before) }
      fs.writeFileSync(f, out)
    }
    console.log(`${changed ? 'sentence' : 'nothing '} ${String(count).padStart(4)}  ${f}${reason ? '  (' + reason + ')' : ''}`)
  }
}
