/**
 * Generate paste-ready Supabase SQL for CRM lead imports.
 *
 * Uses a single dollar-quoted JSON payload + jsonb_to_recordset so apostrophes
 * and newlines in email bodies cannot break SQL quoting.
 *
 * Usage:
 *   node scripts/generate-crm-leads-sql.mjs us-batch2
 *   node scripts/generate-crm-leads-sql.mjs us
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const PRESETS = {
  us: {
    fixture: 'scripts/fixtures/us-crm-leads.json',
    out: 'supabase/crm_import_us_leads.sql',
    title: 'US researched partnership leads (batch 1)',
    expectedCount: 9,
  },
  'us-batch2': {
    fixture: 'scripts/fixtures/us-batch2-crm-leads.json',
    out: 'supabase/crm_import_us_batch2_leads.sql',
    title: '8 US/CA/NL researched partnership leads (batch 2: emails + atlas)',
    expectedCount: 8,
  },
  nl: {
    fixture: 'scripts/fixtures/nl-crm-leads.json',
    out: 'supabase/crm_import_nl_leads.sql',
    title: 'NL/EU researched partnership leads',
    expectedCount: null,
  },
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

const arg = process.argv[2] || 'us-batch2'
const preset = PRESETS[arg]
const fixturePath = path.resolve(root, preset ? preset.fixture : arg)
const outPath = path.resolve(
  root,
  preset ? preset.out : process.argv[3] || 'supabase/crm_import_leads.sql',
)
const title = preset?.title || 'researched CRM leads'
const expectedCount = preset?.expectedCount ?? null

const leads = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))

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

function validate(list) {
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('Expected a non-empty lead array')
  }
  if (expectedCount != null && list.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} leads, got ${list.length}`)
  }
  if (list.some((l) => /artishock/i.test(l.company_name))) {
    throw new Error('ArtiShock must not be in the import set')
  }
  for (const l of list) {
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
      'temperature',
      'status',
      'client_timezone',
      'client_city',
      'client_country',
      'value_emoji',
    ]) {
      if (l[f] == null || String(l[f]).trim() === '') {
        throw new Error(`Missing ${f} on ${l.company_name}`)
      }
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
    if (l.value_emoji !== '🤝') {
      throw new Error(`value_emoji must be 🤝: ${l.company_name}`)
    }
  }
}

validate(leads)

const payload = leads.map((l) => ({
  company_name: l.company_name,
  website: l.website,
  links: Array.isArray(l.links) ? l.links : [],
  contact_name: l.contact_name ?? '',
  contact_role: l.contact_role ?? '',
  email: l.email ?? '',
  emails: normalizeEmails(l.emails),
  phone: l.phone ?? '',
  offer: l.offer,
  notes: l.notes,
  company_focus: l.company_focus,
  initial_email_subject: l.initial_email_subject,
  initial_email_body: l.initial_email_body,
  temperature: 'warm',
  status: 'new',
  value_emoji: l.value_emoji || '🤝',
  atlas_eval: normalizeAtlas(l.atlas_eval),
  client_address: l.client_address ?? '',
  client_timezone: l.client_timezone,
  client_city: l.client_city,
  client_country: l.client_country,
}))

// Unique dollar-quote tag that cannot appear in payload
const tag = 'iomleadjson'
const jsonLiteral = JSON.stringify(payload, null, 2)
if (jsonLiteral.includes(`$${tag}$`)) {
  throw new Error('Dollar-quote tag collision in payload')
}

const companyList = leads
  .map((l) => `'${String(l.company_name).trim().toLowerCase().replace(/'/g, "''")}'`)
  .join(',\n  ')

const domainList = leads
  .map((l) => {
    const d = l.website
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '')
    return `'${d.replace(/'/g, "''")}'`
  })
  .join(',\n  ')

const sql = `-- =============================================================================
-- IOM CRM: import ${title} (${new Date().toISOString().slice(0, 10)})
-- Paste ENTIRE file into Supabase → SQL Editor → Run
-- Project: https://supabase.com/dashboard/project/werfdsobddsijqckymip/sql/new
--
-- Safe / fixed quoting:
--   - Payload is one dollar-quoted JSON blob (no broken apostrophes/newlines)
--   - Skips duplicates by website domain, then company_name
--   - Does NOT modify existing leads
--   - Owner = Mirjan from auth.users (excludes Iva 1dd6199e-...)
--   - Draft timestamps stay NULL; emails are NOT sent
--
-- Regenerated by: node scripts/generate-crm-leads-sql.mjs ${arg}
-- =============================================================================

-- 0) Existing matches (read-only)
select id, company_name, website, owner_email, status
from public.crm_leads
where lower(trim(company_name)) in (
  ${companyList}
)
or lower(regexp_replace(
     regexp_replace(
       regexp_replace(trim(website), '^https?://', '', 'i'),
       '^www\\.', '', 'i'
     ),
     '/+$', ''
   )) in (
  ${domainList}
);

-- 1) Insert non-duplicates from JSON payload
with mirjan as (
  select
    u.id,
    u.email,
    coalesce(u.raw_user_meta_data->>'avatar_url', null) as avatar_url
  from auth.users u
  where u.email ilike '%mirjan%'
    and u.id <> '1dd6199e-25b2-4def-b790-7ce6a372ae53'::uuid
  order by u.created_at asc
  limit 1
),
payload as (
  select $${tag}$${jsonLiteral}$${tag}$::jsonb as data
),
incoming as (
  select
    x.company_name,
    x.website,
    coalesce(x.links, '[]'::jsonb) as links,
    coalesce(x.contact_name, '') as contact_name,
    coalesce(x.contact_role, '') as contact_role,
    coalesce(x.email, '') as email,
    coalesce(x.emails, '[]'::jsonb) as emails,
    coalesce(x.phone, '') as phone,
    coalesce(x.offer, '') as offer,
    coalesce(x.notes, '') as notes,
    coalesce(x.company_focus, '') as company_focus,
    coalesce(x.initial_email_subject, '') as initial_email_subject,
    coalesce(x.initial_email_body, '') as initial_email_body,
    coalesce(x.temperature, 'warm') as temperature,
    coalesce(x.status, 'new') as status,
    coalesce(x.value_emoji, '🤝') as value_emoji,
    coalesce(x.atlas_eval, '{}'::jsonb) as atlas_eval,
    coalesce(x.client_address, '') as client_address,
    coalesce(x.client_timezone, '') as client_timezone,
    coalesce(x.client_city, '') as client_city,
    coalesce(x.client_country, '') as client_country
  from payload p
  cross join lateral jsonb_to_recordset(p.data) as x(
    company_name text,
    website text,
    links jsonb,
    contact_name text,
    contact_role text,
    email text,
    emails jsonb,
    phone text,
    offer text,
    notes text,
    company_focus text,
    initial_email_subject text,
    initial_email_body text,
    temperature text,
    status text,
    value_emoji text,
    atlas_eval jsonb,
    client_address text,
    client_timezone text,
    client_city text,
    client_country text
  )
),
norm as (
  select
    i.*,
    lower(regexp_replace(
      regexp_replace(
        regexp_replace(trim(i.website), '^https?://', '', 'i'),
        '^www\\.', '', 'i'
      ),
      '/+$', ''
    )) as website_domain,
    lower(trim(i.company_name)) as company_key
  from incoming i
),
to_insert as (
  select n.*
  from norm n
  where not exists (
    select 1 from public.crm_leads e
    where lower(regexp_replace(
            regexp_replace(
              regexp_replace(trim(e.website), '^https?://', '', 'i'),
              '^www\\.', '', 'i'
            ),
            '/+$', ''
          )) = n.website_domain
      and n.website_domain <> ''
  )
  and not exists (
    select 1 from public.crm_leads e
    where lower(trim(e.company_name)) = n.company_key
  )
)
insert into public.crm_leads (
  company_name,
  website,
  links,
  contact_name,
  contact_role,
  email,
  emails,
  phone,
  offer,
  notes,
  company_focus,
  initial_email_subject,
  initial_email_body,
  initial_email_drafted_at,
  initial_email_sent_at,
  temperature,
  status,
  next_follow_up,
  estimated_value,
  value_emoji,
  atlas_eval,
  client_address,
  client_timezone,
  client_city,
  client_country,
  client_lat,
  client_lon,
  owner_id,
  owner_email,
  owner_avatar_url
)
select
  t.company_name,
  t.website,
  t.links,
  t.contact_name,
  t.contact_role,
  t.email,
  t.emails,
  t.phone,
  t.offer,
  t.notes,
  t.company_focus,
  t.initial_email_subject,
  t.initial_email_body,
  null,
  null,
  t.temperature,
  t.status,
  null,
  null,
  t.value_emoji,
  t.atlas_eval,
  t.client_address,
  t.client_timezone,
  t.client_city,
  t.client_country,
  null,
  null,
  m.id,
  m.email,
  m.avatar_url
from to_insert t
left join mirjan m on true
returning
  company_name,
  website,
  owner_email,
  status,
  value_emoji,
  jsonb_array_length(emails) as email_count,
  (atlas_eval->>'can_hire_us') as atlas_can_hire,
  initial_email_sent_at;

-- 2) Outcome report
with payload as (
  select $${tag}$${jsonLiteral}$${tag}$::jsonb as data
),
incoming as (
  select x.company_name, x.website
  from payload p
  cross join lateral jsonb_to_recordset(p.data) as x(
    company_name text,
    website text
  )
),
norm as (
  select
    i.company_name,
    i.website,
    lower(regexp_replace(
      regexp_replace(
        regexp_replace(trim(i.website), '^https?://', '', 'i'),
        '^www\\.', '', 'i'
      ),
      '/+$', ''
    )) as website_domain,
    lower(trim(i.company_name)) as company_key
  from incoming i
)
select
  n.company_name,
  n.website,
  case
    when exists (
      select 1 from public.crm_leads e
      where lower(regexp_replace(
              regexp_replace(
                regexp_replace(trim(e.website), '^https?://', '', 'i'),
                '^www\\.', '', 'i'
              ),
              '/+$', ''
            )) = n.website_domain
        and n.website_domain <> ''
    ) then 'present (inserted or prior duplicate skipped)'
    when exists (
      select 1 from public.crm_leads e
      where lower(trim(e.company_name)) = n.company_key
    ) then 'present (company name match)'
    else 'MISSING — insert did not land'
  end as outcome
from norm n
order by n.company_name;
`

fs.writeFileSync(outPath, sql, 'utf8')
console.log(`Wrote ${outPath} (${Buffer.byteLength(sql)} bytes)`)
console.log('Companies:', leads.map((l) => l.company_name).join(', '))
