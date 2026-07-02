


























import { createClient } from '@supabase/supabase-js'
import { encrypt, isEncrypted } from '../lib/tokenCrypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!process.env.GMAIL_TOKEN_ENCRYPTION_KEY) {
  console.error('Missing GMAIL_TOKEN_ENCRYPTION_KEY — set it before running.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  console.log('Fetching gmail_oauth_tokens rows...')
  const { data, error } = await supabase
    .from('gmail_oauth_tokens')
    .select('id, clerk_id, access_token, refresh_token')

  if (error) {
    console.error('Failed to fetch rows:', error.message)
    process.exit(1)
  }
  if (!data || data.length === 0) {
    console.log('No rows found. Nothing to do.')
    return
  }

  console.log(`Found ${data.length} row(s). Checking which need encryption...`)

  let encrypted = 0
  let skipped = 0
  let failed = 0

  for (const row of data) {
    const accessNeedsEnc = row.access_token && !isEncrypted(row.access_token)
    const refreshNeedsEnc = row.refresh_token && !isEncrypted(row.refresh_token)

    if (!accessNeedsEnc && !refreshNeedsEnc) {
      skipped++
      continue
    }

    const patch: Record<string, string> = {}
    if (accessNeedsEnc) patch.access_token = encrypt(row.access_token)
    if (refreshNeedsEnc) patch.refresh_token = encrypt(row.refresh_token)

    const { error: updErr } = await supabase
      .from('gmail_oauth_tokens')
      .update(patch)
      .eq('id', row.id)

    if (updErr) {
      console.error(`  FAILED row ${row.id} (clerk ${row.clerk_id}):`, updErr.message)
      failed++
    } else {
      console.log(`  encrypted row ${row.id} (clerk ${row.clerk_id})`)
      encrypted++
    }
  }

  console.log('\n--- Migration summary ---')
  console.log(`  encrypted: ${encrypted}`)
  console.log(`  skipped (already encrypted): ${skipped}`)
  console.log(`  failed: ${failed}`)
  console.log('-------------------------')

  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error('Migration crashed:', e)
  process.exit(1)
})










