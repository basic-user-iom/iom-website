/**
 * Import researched CRM leads from a JSON fixture (service role or staff login).
 *
 * Usage:
 *   node scripts/import-crm-leads.mjs us
 *   node scripts/import-crm-leads.mjs us --dry-run
 *   node scripts/import-crm-leads.mjs scripts/fixtures/us-crm-leads.json
 *
 * Auth (one of):
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   CRM_EMAIL=... CRM_PASSWORD=...
 *
 * Without auth, prefer paste-ready SQL:
 *   supabase/crm_import_us_leads.sql → Supabase SQL Editor → Run
 *   node scripts/generate-crm-leads-sql.mjs us
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dryRun = process.argv.includes('--dry-run')

const PRESETS = {
  us: 'scripts/fixtures/us-crm-leads.json',
  'us-batch2': 'scripts/fixtures/us-batch2-crm-leads.json',
  nl: 'scripts/fixtures/nl-crm-leads.json',
}

const ATLAS_KEYS = [
  'can_hire_us',
  'thinks_like_us',
  'commercial_potential',
  'creative_compatibility',
  'technical_compatibility',
  'relationship_potential',
  'strategic_value',
]

function loadEnv() {
  const envPath = path.join(root, '.env')
  if (!fs.existsSync(envPath)) return {}
  return Object.fromEntries(
    fs
      .readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      }),
  )
}

function normalizeDomain(website) {
  return String(website ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
}

function normalizeCompany(name) {
  return String(name ?? '').trim().toLowerCase()
}

function normalizeEmails(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  const seen = new Set()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const label = String(item.label ?? '').trim()
    const email = String(item.email ?? '').trim()
    if (!email) continue
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ label: label || 'General', email })
  }
  return out
}

function normalizeAtlas(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const out = {}
  for (const k of ATLAS_KEYS) {
    const n = Number(src[k] ?? 0)
    out[k] = Number.isFinite(n) ? Math.max(0, Math.min(5, Math.round(n))) : 0
  }
  return out
}

function validate(leads) {
  if (!Array.isArray(leads) || leads.length === 0) {
    throw new Error(`Expected a non-empty lead array, got ${leads?.length}`)
  }
  if (leads.some((l) => /artishock/i.test(l.company_name))) {
    throw new Error('ArtiShock must not be in the import set')
  }
  for (const l of leads) {
    for (const f of [
      'company_name',
      'website',
      'contact_name',
      'contact_role',
      'email',
      'offer',
      'company_focus',
      'notes',
      'initial_email_subject',
      'initial_email_body',
    ]) {
      if (!String(l[f] ?? '').trim()) throw new Error(`Missing ${f} on ${l.company_name}`)
    }
    if (!Array.isArray(l.emails) || l.emails.length === 0) {
      throw new Error(`Missing emails[] on ${l.company_name}`)
    }
    if (!l.atlas_eval || typeof l.atlas_eval !== 'object') {
      throw new Error(`Missing atlas_eval on ${l.company_name}`)
    }
    if (l.initial_email_sent_at != null) {
      throw new Error(`Must not mark email sent: ${l.company_name}`)
    }
    if (l.status !== 'new' || l.temperature !== 'warm') {
      throw new Error(`status/temperature must be new/warm: ${l.company_name}`)
    }
  }
}

function toRow(lead) {
  return {
    company_name: lead.company_name,
    website: lead.website,
    links: Array.isArray(lead.links) ? lead.links : [],
    contact_name: lead.contact_name ?? '',
    contact_role: lead.contact_role ?? '',
    email: lead.email ?? '',
    emails: normalizeEmails(lead.emails),
    phone: lead.phone ?? '',
    offer: lead.offer,
    notes: lead.notes,
    company_focus: lead.company_focus,
    initial_email_subject: lead.initial_email_subject,
    initial_email_body: lead.initial_email_body,
    initial_email_drafted_at: null,
    initial_email_sent_at: null,
    temperature: 'warm',
    status: 'new',
    next_follow_up: null,
    estimated_value: null,
    value_emoji: lead.value_emoji || '🤝',
    atlas_eval: normalizeAtlas(lead.atlas_eval),
    client_address: lead.client_address ?? '',
    client_timezone: lead.client_timezone,
    client_city: lead.client_city,
    client_country: lead.client_country,
    client_lat: null,
    client_lon: null,
  }
}

async function main() {
  const env = { ...loadEnv(), ...process.env }
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY
  if (!url) throw new Error('Missing VITE_SUPABASE_URL')

  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'))
  const arg = args[0] || 'us'
  const fixtureRel = PRESETS[arg] || arg
  const fixturePath = path.resolve(root, fixtureRel)
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Fixture not found: ${fixturePath}`)
  }
  const leads = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
  validate(leads)

  console.log(`Validated ${leads.length} leads from ${fixtureRel}`)
  console.log('Companies:', leads.map((l) => l.company_name).join(', '))

  let supabase
  let authMode
  if (serviceKey) {
    supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    authMode = 'service_role'
  } else if (env.CRM_EMAIL && env.CRM_PASSWORD && anonKey) {
    supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await supabase.auth.signInWithPassword({
      email: env.CRM_EMAIL,
      password: env.CRM_PASSWORD,
    })
    if (error) throw new Error(`Staff login failed: ${error.message}`)
    authMode = `authenticated:${data.user?.email ?? env.CRM_EMAIL}`
  } else {
    console.error(`
No auth for REST insert (RLS requires authenticated or service role).

Run SQL instead:
  supabase/crm_import_us_batch2_leads.sql  → Supabase SQL Editor → Run
  node scripts/generate-crm-leads-sql.mjs us-batch2

Or:
  set SUPABASE_SERVICE_ROLE_KEY=...   → node scripts/import-crm-leads.mjs us-batch2
  set CRM_EMAIL=... CRM_PASSWORD=...  → node scripts/import-crm-leads.mjs us-batch2
`)
    if (dryRun) {
      console.log('Dry-run: local validation OK (live dedupe requires auth or SQL).')
      return
    }
    process.exit(2)
  }

  const { data: existing, error: listErr } = await supabase
    .from('crm_leads')
    .select('id, company_name, website, owner_email')
  if (listErr) throw new Error(`List leads failed: ${listErr.message}`)

  const domains = new Set(
    (existing ?? []).map((r) => normalizeDomain(r.website)).filter(Boolean),
  )
  const names = new Set((existing ?? []).map((r) => normalizeCompany(r.company_name)))

  const toInsert = []
  const skipped = []
  for (const lead of leads) {
    const domain = normalizeDomain(lead.website)
    const company = normalizeCompany(lead.company_name)
    if ((domain && domains.has(domain)) || names.has(company)) {
      skipped.push(lead.company_name)
      continue
    }
    toInsert.push(lead)
    if (domain) domains.add(domain)
    names.add(company)
  }

  console.log(`Auth mode: ${authMode}`)
  console.log(`Would insert ${toInsert.length}, skip ${skipped.length}`)
  if (skipped.length) console.log('Skipped:', skipped.join(', '))
  if (toInsert.length) console.log('Insert:', toInsert.map((l) => l.company_name).join(', '))

  if (dryRun || toInsert.length === 0) {
    console.log(dryRun ? 'Dry-run complete.' : 'Nothing to insert.')
    return
  }

  let owner = { owner_id: null, owner_email: null, owner_avatar_url: null }
  if (authMode.startsWith('authenticated:')) {
    const { data: userData } = await supabase.auth.getUser()
    const u = userData?.user
    if (u) {
      owner = {
        owner_id: u.id,
        owner_email: u.email ?? null,
        owner_avatar_url: u.user_metadata?.avatar_url ?? null,
      }
    }
  } else {
    const { data: profiles } = await supabase
      .from('crm_staff_profiles')
      .select('id, email, avatar_url')
      .ilike('email', '%mirjan%')
      .limit(1)
    if (profiles?.[0]) {
      owner = {
        owner_id: profiles[0].id,
        owner_email: profiles[0].email,
        owner_avatar_url: profiles[0].avatar_url ?? null,
      }
    } else {
      console.warn('Mirjan profile not found — inserting with null owner_id.')
    }
  }

  const rows = toInsert.map((l) => ({ ...toRow(l), ...owner }))
  const { data: inserted, error: insertErr } = await supabase
    .from('crm_leads')
    .insert(rows)
    .select('company_name, website, owner_email, initial_email_sent_at')

  if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`)
  console.log(`Inserted ${inserted?.length ?? 0} leads.`)
  for (const row of inserted ?? []) {
    console.log(`  - ${row.company_name} (owner ${row.owner_email ?? 'null'})`)
  }
  console.log('Emails sent: 0')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
