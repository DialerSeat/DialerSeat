'use client'

import { useState } from 'react'
import { t, useLocale } from '@/lib/i18n/client'
import { msg } from '@/lib/i18n/msg'
import { PACKS, buildColdCallScript, buildVoicemails, type Industry } from '@/lib/tools/scriptPacks'
import { ToolStyles, SelectField, TextField, CopyButton } from './kit'

// =============================================================================
// COLD CALL SCRIPT + SALES VOICEMAIL GENERATORS
// =============================================================================
// The page around the templates in lib/tools/scriptPacks.ts. Labels and advice
// are translated; the script stays in English, because it is read to US leads.
// =============================================================================

function useInputs() {
  const [industry, setIndustry] = useState<Industry>('real_estate')
  const [name, setName] = useState('Alex')
  const [company, setCompany] = useState('Northside Realty')
  const [area, setArea] = useState('Austin')
  const [result, setResult] = useState('book more qualified meetings')
  return { industry, setIndustry, name, setName, company, setCompany, area, setArea, result, setResult }
}

function Inputs(p: ReturnType<typeof useInputs>) {
  return (
    <div className="tk-grid">
      <SelectField id="sg-ind" label={msg("Industry")} value={p.industry} onChange={p.setIndustry}
        options={(Object.keys(PACKS) as Industry[]).map((k) => ({ value: k, label: PACKS[k].label }))} />
      <TextField id="sg-name" label={msg("Your first name")} value={p.name} onChange={p.setName} />
      <TextField id="sg-co" label={msg("Company")} value={p.company} onChange={p.setCompany} />
      <TextField id="sg-area" label={msg("Area or market")} value={p.area} onChange={p.setArea} />
      {(p.industry === 'b2b' || p.industry === 'general') && (
        <TextField id="sg-res" label={msg("What you help with")} value={p.result} onChange={p.setResult} />
      )}
    </div>
  )
}

/** Only on a translated page: why the text below is not in that language. */
function EnglishNote() {
  const { locale } = useLocale()
  if (locale === 'en') return null
  return <p className="tk-foot">{t("The script itself stays in English, because you read it to the person you are calling in the US.")}</p>
}

export function ColdCallScriptGenerator() {
  const s = useInputs()
  const script = buildColdCallScript(s)
  return (
    <div className="tk">
      <ToolStyles />
      <Inputs {...s} />
      <div className="tk-row"><CopyButton text={script} label={msg("COPY SCRIPT")} /></div>
      <EnglishNote />
      <div className="tk-out" lang="en">{script}</div>
      <p className="tk-foot">{t("Read it out loud before the first call and change anything that doesn't sound like you. Put your own words in the brackets, and say only what is true of the person you're calling: if the reason for the call doesn't fit your list, change it.")}</p>
    </div>
  )
}

export function VoicemailScriptGenerator() {
  const s = useInputs()
  const [callback, setCallback] = useState('(512) 555-0100')
  const mails = buildVoicemails(s, callback)
  const all = mails.map((m) => `${m.plain}\n${m.body}`).join('\n\n')
  return (
    <div className="tk">
      <ToolStyles />
      <Inputs {...s} />
      <div className="tk-grid" style={{ marginTop: 12, ['--cols' as string]: 2 }}>
        <TextField id="vm-cb" label={msg("Callback number")} value={callback} onChange={setCallback} />
      </div>
      <div className="tk-row"><CopyButton text={all} label={msg("COPY ALL THREE")} /></div>
      <EnglishNote />
      {mails.map((m) => {
        const words = m.body.split(/\s+/).length
        const secs = Math.round((words / 150) * 60)
        return (
          <div key={m.plain} className="tk-out">
            <h4>{t(m.heading)} · {t("{w} words, about {s} seconds", { w: words, s: secs })}</h4>
            <span lang="en">{m.body}</span>
          </div>
        )
      })}
      <p className="tk-foot">{t("Under 30 seconds each at a normal speaking pace (about 150 words a minute). Say the number twice, slowly. Three messages is enough: after that, a voicemail stops being a reminder and starts being a reason to block you.")}</p>
    </div>
  )
}
