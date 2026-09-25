// node scripts/i18n/client-dicts.mjs
//
// The browser only needs the strings client components render: the ones in
// 'use client' files, plus API error messages (shown through t(error)) and the
// shared FAQ rail data. Server components translate on the server from the
// full dictionary and send finished text. So each language gets a client
// subset, lib/i18n/dictionaries/client/<locale>.json — about 40% of the full
// file — and that is all the browser ever downloads.
//
// Run after extract.mjs and after merging translations (batch.mjs apply runs
// it automatically).

import fs from 'node:fs'
import path from 'node:path'

const DIR = 'lib/i18n'
const catalog = JSON.parse(fs.readFileSync(path.join(DIR, 'catalog.json'), 'utf8'))
const ALWAYS_CLIENT = new Set(['components/site-footer.tsx', 'components/analytics/dispositionPie.tsx', 'lib/gutsRail.ts'])
const clientFile = new Map()
const isClient = (f) => {
  if (!clientFile.has(f)) {
    let c = ALWAYS_CLIENT.has(f) || f.startsWith('app/api/')
    if (!c) {
      try { c = /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(fs.readFileSync(f, 'utf8')) } catch { c = false }
    }
    clientFile.set(f, c)
  }
  return clientFile.get(f)
}
const clientKeys = Object.keys(catalog).filter((k) => catalog[k].some(isClient))

fs.mkdirSync(path.join(DIR, 'dictionaries', 'client'), { recursive: true })
for (const file of fs.readdirSync(path.join(DIR, 'dictionaries')).filter((f) => f.endsWith('.json'))) {
  const dict = JSON.parse(fs.readFileSync(path.join(DIR, 'dictionaries', file), 'utf8'))
  const sub = {}
  for (const k of clientKeys) if (dict[k]) sub[k] = dict[k]
  fs.writeFileSync(path.join(DIR, 'dictionaries', 'client', file), JSON.stringify(sub) + '\n')
  console.log(`${file}: ${Object.keys(sub).length} client strings`)
}
