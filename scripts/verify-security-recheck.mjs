#!/usr/bin/env node
/**
 * Static regression checks for SECURITY_RECHECK_REPORT SEC-R1/R2/R3.
 * Does not need live DB credentials.
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** @type {{ name: string, ok: boolean, detail: string }[]} */
const results = []

function record(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

const activeSql = read('supabase/security_hardening_client_active_and_tasks.sql')
const foundation = read('supabase/security_hardening_client_tenancy_foundation.sql')
const board = read('supabase/security_hardening_client_board_read.sql')
const mfaReset = read('api/crm-mfa-reset.js')
const login = read('src/crm/CrmLogin.tsx')
const helpers = read('api/_lib/blog-helpers.js')

record(
  'SEC-R1 active SQL joins crm_client_accounts',
  /crm_client_accounts/.test(activeSql) && /a\.active/.test(activeSql),
  'security_hardening_client_active_and_tasks.sql',
)

record(
  'SEC-R1 foundation joins active accounts',
  /join public\.crm_client_accounts a/.test(foundation) &&
    /m\.active/.test(foundation) &&
    /a\.active/.test(foundation),
)

record(
  'SEC-R2 task policy requires client_visible',
  /client_visible = true/.test(activeSql) && /client_visible = true/.test(board),
)

record(
  'SEC-R2 columns gated by visible tasks',
  /from public\.crm_tasks t/.test(activeSql) &&
    /t\.client_visible = true/.test(activeSql),
)

record(
  'SEC-R3 mfa-reset requires aal2 (default requireStaffUser)',
  /requireStaffUser\(req\)/.test(mfaReset) &&
    !/requireMfa:\s*false/.test(mfaReset),
)

record(
  'SEC-R3 login challenge does not call reset API',
  /mfaResetContactAdmin/.test(login) && !/resetOwnMfaFactors/.test(login),
)

record(
  'Staff identity RPC preferred for API staff gate',
  /is_crm_staff_identity/.test(helpers),
)

record(
  'Preview apply list includes active_and_tasks',
  read('scripts/apply-preview-sql.mjs').includes(
    'security_hardening_client_active_and_tasks.sql',
  ),
)

record(
  'Preview apply list includes board migration',
  read('scripts/apply-preview-sql.mjs').includes('crm_workspace_board_migration.sql'),
)

record(
  'Board migration creates crm_tasks',
  /create table if not exists public\.crm_tasks/.test(
    read('supabase/crm_workspace_board_migration.sql'),
  ),
)

const failed = results.filter((r) => !r.ok)
console.log(
  `\n${results.length - failed.length}/${results.length} passed` +
    (failed.length ? `; ${failed.length} failed` : '') +
    '\n',
)
if (failed.length) process.exitCode = 1
