// ── PROVE ENGLISH DID NOT CHANGE ────────────────────────────────────
// node scripts/i18n/verify.mjs <file.tsx> [...]
//
// For each file, compiles the committed version (git HEAD) and the working
// copy to plain createElement calls, then normalises the working copy the
// way English rendering does: t("x") becomes "x", adjacent string children
// merge, and the i18n import disappears. If the two print differently, the
// wrap changed something an English visitor would see, and the file fails.

import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import ts from 'typescript'

const ORIG = process.env.I18N_ORIG || '.i18n-orig'

function compile(src, fileName) {
  return ts.transpileModule(src, {
    fileName,
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      removeComments: true,
    },
  }).outputText
}

// One printable shape for "text, value, text, …", however it was written.
function canonicalTemplate(texts, exprs) {
  const f = ts.factory
  if (!exprs.length) return f.createStringLiteral(texts[0])
  const spans = exprs.map((e, i) => f.createTemplateSpan(e,
    i === exprs.length - 1 ? f.createTemplateTail(texts[i + 1]) : f.createTemplateMiddle(texts[i + 1])))
  return f.createTemplateExpression(f.createTemplateHead(texts[0]), spans)
}

function normalise(js, fnNames) {
  const sf = ts.createSourceFile('x.js', js, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const f = ts.factory
  const transformer = (ctx) => {
    const visit = (node) => {
      node = ts.visitEachChild(node, visit, ctx)
      // t("x") → "x"  (English: translate() returns its argument)
      // t(x) and msg(x) → x  (English: both return their argument)
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
        fnNames.has(node.expression.text) && node.arguments.length === 1) {
        const arg = node.arguments[0]
        return ts.isStringLiteral(arg) ? f.createStringLiteral(arg.text) : arg
      }
      // t("a {x} b", { x: e }) → `a ${e} b`  (English: the placeholders are
      // filled in order, which is what the template or the JSX pieces did)
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
        fnNames.has(node.expression.text) && node.arguments.length === 2 &&
        ts.isStringLiteral(node.arguments[0]) && ts.isObjectLiteralExpression(node.arguments[1])) {
        const vars = new Map()
        for (const p of node.arguments[1].properties) {
          if (ts.isPropertyAssignment(p)) vars.set(p.name.text ?? p.name.getText(), p.initializer)
          else if (ts.isShorthandPropertyAssignment(p)) vars.set(p.name.text, f.createIdentifier(p.name.text))
        }
        const texts = [], exprs = []
        let rest = node.arguments[0].text, m
        const re = /\{(\w+)\}/
        while ((m = re.exec(rest)) && vars.has(m[1])) {
          texts.push(rest.slice(0, m.index)); exprs.push(vars.get(m[1])); rest = rest.slice(m.index + m[0].length)
        }
        texts.push(rest)
        return canonicalTemplate(texts, exprs)
      }
      if (ts.isTemplateExpression(node)) {
        return canonicalTemplate([node.head.text, ...node.templateSpans.map((s) => s.literal.text)],
          node.templateSpans.map((s) => s.expression))
      }
      // A backtick string with no ${} is the same string.
      if (ts.isNoSubstitutionTemplateLiteral(node)) return f.createStringLiteral(node.text)
      // Quote style is not output: print every string the same way.
      if (ts.isStringLiteral(node) && node.getSourceFile?.()) return f.createStringLiteral(node.text)
      // React.createElement(tag, props, ...children): a template child is the
      // same text as its pieces; merge adjacent strings; drop empty ones.
      if (ts.isCallExpression(node)) {
        const callee = node.expression
        const isCE = ts.isPropertyAccessExpression(callee) && callee.name.text === 'createElement'
        if (isCE && node.arguments.length > 2) {
          const [tag, props, ...kids] = node.arguments
          const flat = []
          for (const k of kids) {
            if (ts.isTemplateExpression(k)) {
              flat.push(f.createStringLiteral(k.head.text))
              for (const s of k.templateSpans) flat.push(s.expression, f.createStringLiteral(s.literal.text))
            } else flat.push(k)
          }
          const merged = []
          for (const k of flat) {
            if (ts.isStringLiteral(k) && k.text === '') continue
            const prev = merged[merged.length - 1]
            if (prev && ts.isStringLiteral(prev) && ts.isStringLiteral(k)) {
              merged[merged.length - 1] = f.createStringLiteral(prev.text + k.text)
            } else merged.push(k)
          }
          return f.updateCallExpression(node, node.expression, node.typeArguments, [tag, props, ...merged])
        }
      }
      return node
    }
    return (root) => ts.visitNode(root, visit)
  }
  const out = ts.transform(sf, [transformer]).transformed[0]
  const printer = ts.createPrinter({ removeComments: true })
  return printer
    .printFile(out)
    .split('\n')
    .filter((l) => !/from ['"]@\/lib\/i18n\/(client|server|msg)['"]/.test(l))
    // prime.mjs adds these; neither changes what renders.
    .filter((l) => !/^\s*await primeLocale\(\);\s*$/.test(l))
    .map((l) => l.replace(/^export default async function/, 'export default function'))
    .join('\n')
    // Line breaks are the printer's, not the page's.
    .replace(/\s*\n\s*/g, ' ')
}

let failed = 0
for (const file of process.argv.slice(2)) {
  // The copy wrap.mjs saved just before editing, so another agent's
  // uncommitted work in the same file is not mistaken for a change of ours.
  // Falls back to HEAD.
  const rel = file.split(path.sep).join('/')
  const saved = path.join(ORIG, rel)
  let before
  if (fs.existsSync(saved)) before = fs.readFileSync(saved, 'utf8')
  else {
    try {
      before = execFileSync('git', ['show', `HEAD:${rel}`], { encoding: 'utf8', maxBuffer: 64 << 20 })
    } catch {
      console.log(`skip (new file)  ${file}`)
      continue
    }
  }
  const after = fs.readFileSync(file, 'utf8')
  // Each side is normalised with its own i18n names, so a file that already
  // went through wrap.mjs can be checked again after wrap-data.mjs.
  const namesIn = (src) => {
    const names = new Set()
    const imp = src.match(/import \{([^}]*)\} from ['"]@\/lib\/i18n\/(?:client|server)['"]/)
    const m = imp && imp[1].match(/\bt(?:\s+as\s+(\w+))?\s*(?:,|$)/)
    if (m) names.add(m[1] || 't')
    const msgImp = src.match(/import \{\s*msg(?: as (\w+))?\s*\} from ['"]@\/lib\/i18n\/msg['"]/)
    if (msgImp) names.add(msgImp[1] || 'msg')
    return names
  }
  const a = normalise(compile(before, file), namesIn(before))
  const b = normalise(compile(after, file), namesIn(after))
  if (process.env.I18N_DUMP) {
    fs.writeFileSync(path.join(process.env.I18N_DUMP, path.basename(file) + '.before.js'), a)
    fs.writeFileSync(path.join(process.env.I18N_DUMP, path.basename(file) + '.after.js'), b)
  }
  if (a === b) {
    console.log(`same             ${file}`)
  } else {
    failed++
    let i = 0
    while (i < a.length && a[i] === b[i]) i++
    const from = Math.max(0, i - 100)
    console.log(`DIFFERENT        ${file}\n   before: …${a.slice(from, i + 120)}\n   after:  …${b.slice(from, i + 120)}`)
  }
}
process.exit(failed ? 1 : 0)
