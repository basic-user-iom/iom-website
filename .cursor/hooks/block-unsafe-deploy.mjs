#!/usr/bin/env node
/**
 * Cursor beforeShellExecution hook — block unsafe deploy/git commands.
 * Allows: npm run deploy / npm run deploy:prod
 * Blocks: bare npx vercel --prod, git stash -u, git reset --hard
 */
import { readFileSync } from 'node:fs'

function readStdin() {
  try {
    return readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}

function respond(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`)
}

function allow() {
  respond({ permission: 'allow' })
  process.exit(0)
}

function deny(userMessage, agentMessage) {
  respond({
    permission: 'deny',
    user_message: userMessage,
    agent_message: agentMessage,
  })
  process.exit(2)
}

let input = {}
try {
  input = JSON.parse(readStdin() || '{}')
} catch {
  allow()
}

const command = String(input.command ?? input.full_command ?? '').trim()
if (!command) allow()

const lower = command.toLowerCase()

// Safe deploy entry points (includes full pipeline with embedded vercel --prod)
if (/\bnpm run deploy(:prod)?\b/.test(lower)) allow()

// Block direct Vercel production deploys outside npm run deploy
if (/\bvercel\b/.test(lower) && /--prod\b/.test(lower)) {
  deny(
    'Production deploy must use: npm run deploy',
    'Do NOT run npx vercel --prod directly. Run `npm run deploy` from F:\\iom_website — it commits checks, builds, pushes master, then deploys. See DEPLOY.md.',
  )
}

// Block destructive git operations that caused the Jul 14 overwrite incident
if (/\bgit stash\b/.test(lower) && /(-u|--include-untracked)\b/.test(lower)) {
  deny(
    'git stash -u is blocked on this repo (it previously wiped uncommitted site work).',
    'Do not run git stash -u or git stash push -u on iom_website. Commit changes instead. See DEPLOY.md.',
  )
}

if (/\bgit reset --hard\b/.test(lower)) {
  deny(
    'git reset --hard is blocked on this repo unless the user explicitly requests it.',
    'Do not run git reset --hard on iom_website without explicit user approval.',
  )
}

allow()
