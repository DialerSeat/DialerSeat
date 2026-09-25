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

function normalise(js, fnNames) {
  const sf = ts.createSourceFile('x.js', js, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const f = ts.factory
  const transformer = (ctx) => {
    const visit = (node) => {
      node = ts.visitEachChild(node, visit, ctx)
      // t("x") → "x"  (English: translate() returns its argument)
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
        fnNames.has(node.expression.text) && node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])) {
        return f.createStringLiteral(node.arguments[0].text)
      }
      // Quote style is not output: print every string the same way.
      if (ts.isStringLiteral(node) && node.getSourceFile?.()) return f.createStringLiteral(node.text)
      // React.createElement(tag, props, ...children): merge adjacent strings.
      if (ts.isCallExpression(node)) {
        const callee = node.expression
        const isCE = ts.isPropertyAccessExpression(callee) && callee.name.text === 'createElement'
        if (isCE && node.arguments.length > 2) {
          const [tag, props, ...kids] = node.arguments
          const merged = []
          for (const k of kids) {
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
    .filter((l) => !/from ['"]@\/lib\/i18n\/(client|server)['"]/.test(l))
    // prime.mjs adds these; neither changes what renders.
    .filter((l) => !/^\s*await primeLocale\(\);\s*$/.test(l))
    .map((l) => l.replace(/^export default async function/, 'export default function'))
    .join('\n')
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
  const imp = after.match(/import \{[^}]*?\bt(?: as (\w+))?\s*[,}][^;]*?from ['"]@\/lib\/i18n\/(?:client|server)['"]/)
  const fnNames = new Set([imp?.[1] || 't'])
  const a = normalise(compile(before, file), new Set())
  const b = normalise(compile(after, file), fnNames)
  if (process.env.I18N_DUMP) {
    fs.writeFileSync(path.join(process.env.I18N_DUMP, path.basename(file) + '.before.js'), a)
    fs.writeFileSync(path.join(process.env.I18N_DUMP, path.basename(file) + '.after.js'), b)
  }
  if (a === b) {
    console.log(`same             ${file}`)
  } else {
    failed++
    const al = a.split('\n'), bl = b.split('\n')
    let i = 0
    while (i < al.length && al[i] === bl[i]) i++
    console.log(`DIFFERENT        ${file}\n   before: ${al[i]?.trim()}\n   after:  ${bl[i]?.trim()}`)
  }
}
process.exit(failed ? 1 : 0)
