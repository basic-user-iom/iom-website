#!/usr/bin/env node
/**
 * Apply baseline + hardening SQL to the Preview Supabase project.
 *
 * Usage (PowerShell):
 *   $env:PREVIEW_DB_PASSWORD = 'your-db-password'
 *   node scripts/apply-preview-sql.mjs
 *
 * Or full URL:
 *   $env:PREVIEW_DATABASE_URL = 'postgresql://postgres.ijjnstbwvuwwznfagxut:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'
 *   node scripts/apply-preview-sql.mjs
 *
 * Password: Supabase → iom-website-preview → Project Settings → Database → Database password
 * (or Connect → URI, Session/Transaction pooler)
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const ref = process.env.PREVIEW_PROJECT_REF || 'ijjnstbwvuwwznfagxut'

const files = [
  'supabase/schema.sql',
  'supabase/crm_lead_messages_migration.sql',
  'supabase/crm_research_notes_migration.sql',
  'supabase/crm_useful_links_migration.sql',
  'supabase/crm_lead_emails_migration.sql',
  'supabase/crm_lead_contact_priority_migration.sql',
  'supabase/crm_lead_scheduled_send_migration.sql',
  'supabase/crm_lead_atlas_eval_migration.sql',
  'supabase/crm_recordings_migration.sql',
  'supabase/blog_migration.sql',
  'supabase/blog_status_pending_hidden.sql',
  'supabase/artist_globe_migration.sql',
  'supabase/site_analytics_migration.sql',
  'supabase/site_analytics_geo_migration.sql',
  'supabase/site_analytics_engagement_migration.sql',
  'supabase/security_hardening_rate_limits.sql',
  'supabase/security_hardening_artist_invites.sql',
  'supabase/security_hardening_staff_rls.sql',
  'supabase/security_hardening_client_tenancy_foundation.sql',
  'supabase/security_hardening_client_scoped_rls.sql',
  'supabase/security_hardening_client_board_read.sql',
  'supabase/security_hardening_analytics_and_members.sql',
  'supabase/security_hardening_staff_roles.sql',
  'supabase/security_hardening_staff_aal2.sql',
]

function buildUrl() {
  if (process.env.PREVIEW_DATABASE_URL?.trim()) {
    return process.env.PREVIEW_DATABASE_URL.trim()
  }
  const password = process.env.PREVIEW_DB_PASSWORD?.trim()
  if (!password) {
    console.error(`
Missing PREVIEW_DB_PASSWORD (or PREVIEW_DATABASE_URL).

In Supabase → iom-website-preview → Project Settings → Database:
  copy the database password (or reset it), then:

  PowerShell:
    $env:PREVIEW_DB_PASSWORD = 'paste-password-here'
    node scripts/apply-preview-sql.mjs
`)
    process.exit(1)
  }
  const enc = encodeURIComponent(password)
  // Session pooler (IPv4-friendly). Region may vary; override with PREVIEW_DATABASE_URL if needed.
  const host =
    process.env.PREVIEW_DB_HOST ||
    `aws-1-eu-west-2.pooler.supabase.com`
  return `postgresql://postgres.${ref}:${enc}@${host}:6543/postgres`
}

const startFrom = process.env.PREVIEW_SQL_FROM?.trim() || ''


async function main() {
  const connectionString = buildUrl()
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  console.log(`Connected → preview project ${ref}\n`)

  let skipping = Boolean(startFrom)
  for (const rel of files) {
    if (skipping) {
      if (rel === startFrom || rel.endsWith(startFrom)) skipping = false
      else {
        console.log(`· skip (resume) ${rel}`)
        continue
      }
    }
    const path = join(root, rel)
    if (!existsSync(path)) {
      console.warn(`skip missing ${rel}`)
      continue
    }
    const sql = readFileSync(path, 'utf8')
    process.stdout.write(`→ ${rel} … `)
    try {
      await client.query(sql)
      console.log('ok')
    } catch (err) {
      console.log('FAILED')
      console.error(err.message || err)
      await client.end()
      process.exit(1)
    }
  }

  console.log('\nDone. Next: create Auth user, bootstrap admin, run verify_status.sql')
  await client.end()
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
