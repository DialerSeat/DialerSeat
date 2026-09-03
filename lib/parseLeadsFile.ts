// ─────────────────────────────────────────────────────────────────────────
// Shared lead-file parsing for the campaigns dashboard drop zones.
//
// Originally this only accepted .csv, parsed with a hand-rolled
// comma/tab-delimited splitter (parseCSVText below — unchanged from the
// original parseCSV in app/dashboard/campaigns/page.tsx). This module adds:
//   - .tsv / .txt: same delimited-text parser, since it already
//     auto-detects comma vs tab.
//   - .xlsx / .xls: parsed with SheetJS (xlsx package), converted to the
//     exact same shape parseCSVText produces (array of row objects when
//     the first row looks like headers, otherwise array of value arrays)
//     so every downstream consumer — csvData, handleUploadMore, the
//     /api/leads/upload payload — needs no changes at all.
//   - Multi-sheet workbooks: someone may well drop in a wider project
//     workbook rather than a single leads sheet. inspectFile() surfaces
//     the sheet names up front so the caller can ask which one to import
//     instead of silently grabbing the first tab. Single-sheet workbooks
//     (and every non-Excel format) skip that step entirely — no picker,
//     no extra click, same one-step flow as before.
//
// SheetJS is dynamically imported so it's only pulled into the bundle the
// moment someone actually drops an Excel file, not on every page load.
// ─────────────────────────────────────────────────────────────────────────

export const ACCEPTED_LEADS_EXTENSIONS = ['.csv', '.tsv', '.txt', '.xlsx', '.xls']
export const ACCEPTED_LEADS_ACCEPT_ATTR = ACCEPTED_LEADS_EXTENSIONS.join(',')

export function isAcceptedLeadsFile(filename: string): boolean {
  const lower = filename.toLowerCase()
  return ACCEPTED_LEADS_EXTENSIONS.some(ext => lower.endsWith(ext))
}

function isExcelFile(filename: string): boolean {
  const lower = filename.toLowerCase()
  return lower.endsWith('.xlsx') || lower.endsWith('.xls')
}

// Unchanged from the original parseCSV — same comma/tab auto-detection,
// same header-detection heuristic (if the first row doesn't look like a
// phone number, treat it as headers).
export function parseCSVText(text: string): any[] {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length === 0) return []
  const firstLine = lines[0]
  const delim = firstLine.includes('\t') ? '\t' : ','
  const first = firstLine.split(delim).map(v => v.trim().replace(/"/g, ''))
  const hasPhone = first.some(v => v.replace(/\D/g, '').length >= 10)
  const hasHeaders = !hasPhone
  if (hasHeaders) {
    const headers = first
    return lines.slice(1).map(line => {
      const vals = line.split(delim).map(v => v.trim().replace(/"/g, ''))
      return headers.reduce((obj: any, h, i) => {
        obj[h] = vals[i] || ''
        return obj
      }, {})
    })
  } else {
    return lines.map(l => l.split(delim).map(v => v.trim().replace(/"/g, '')))
  }
}

// Converts a sheet's rows (as returned by SheetJS's sheet_to_json with
// header:1, i.e. an array of arrays) into the same shape parseCSVText
// produces: array of header-keyed objects if the first row looks like
// headers, otherwise array of value arrays, matching the exact same
// "does the first row look like a phone number" heuristic.
function rowsToLeadsShape(rows: any[][]): any[] {
  const cleaned = rows
    .map(row => row.map(cell => (cell === null || cell === undefined ? '' : String(cell).trim())))
    .filter(row => row.some(cell => cell !== ''))
  if (cleaned.length === 0) return []

  const first = cleaned[0]
  const hasPhone = first.some(v => v.replace(/\D/g, '').length >= 10)
  const hasHeaders = !hasPhone

  if (hasHeaders) {
    const headers = first
    return cleaned.slice(1).map(vals =>
      headers.reduce((obj: any, h, i) => {
        obj[h] = vals[i] || ''
        return obj
      }, {})
    )
  }
  return cleaned
}

// A small in-memory cache of the last-opened workbook, keyed by File
// object identity. inspectFile() opens the workbook once to read sheet
// names; if the caller then immediately calls parseLeadsFile() with a
// chosen sheet, we reuse that same parsed workbook (and the already
// dynamically-imported XLSX module) instead of re-reading and re-parsing
// the file from disk a second time.
let cachedWorkbookFile: File | null = null
let cachedWorkbook: any = null
let cachedXLSX: any = null

async function readWorkbook(file: File): Promise<{ workbook: any; XLSX: any }> {
  if (cachedWorkbookFile === file && cachedWorkbook && cachedXLSX) {
    return { workbook: cachedWorkbook, XLSX: cachedXLSX }
  }
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  cachedWorkbookFile = file
  cachedWorkbook = workbook
  cachedXLSX = XLSX
  return { workbook, XLSX }
}

function parseSheetRows(workbook: any, XLSX: any, sheetName: string): any[] {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' })
  return rowsToLeadsShape(rows)
}

export interface FileInspection {
  /** True when the caller should show a sheet picker before parsing. */
  needsSheetPicker: boolean
  /** All sheet names in the workbook (Excel files only). */
  sheetNames: string[]
}

// Call this first. For non-Excel files, or Excel workbooks with exactly
// one sheet, needsSheetPicker is always false, just call parseLeadsFile()
// directly with no sheetName and you'll get the same one-step behavior as
// before. Only workbooks with 2+ sheets ask for a choice.
export async function inspectFile(file: File): Promise<FileInspection> {
  if (!isExcelFile(file.name)) {
    return { needsSheetPicker: false, sheetNames: [] }
  }
  const { workbook } = await readWorkbook(file)
  const sheetNames: string[] = workbook.SheetNames || []
  return { needsSheetPicker: sheetNames.length > 1, sheetNames }
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve((e.target?.result as string) ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

// Main entry point. For Excel files, pass `sheetName` once the user has
// picked one (or omit it to use the first sheet, e.g. when there's only
// one and inspectFile() already told you no picker is needed). Returns
// the parsed leads array, or throws with a message safe to show the user.
export async function parseLeadsFile(file: File, sheetName?: string): Promise<any[]> {
  if (!isAcceptedLeadsFile(file.name)) {
    throw new Error('Unsupported file type. Please use a CSV, TSV, TXT, or Excel (.xlsx/.xls) file.')
  }
  if (isExcelFile(file.name)) {
    const { workbook, XLSX } = await readWorkbook(file)
    const targetSheet = sheetName || workbook.SheetNames?.[0]
    if (!targetSheet) return []
    return parseSheetRows(workbook, XLSX, targetSheet)
  }
  const text = await readFileAsText(file)
  return parseCSVText(text)
}

