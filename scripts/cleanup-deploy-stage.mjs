#!/usr/bin/env node
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, resolve, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const target = resolve(process.argv[2] || '')
const tempRoot = `${resolve(tmpdir())}${sep}`

if (!target.startsWith(tempRoot) || !basename(target).startsWith('iom-website-deploy-')) {
  console.error('Refusing to clean a path outside the IOM deployment temp folder.')
  process.exit(1)
}

for (let attempt = 0; attempt < 30; attempt += 1) {
  try {
    await rm(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 })
    process.exit(0)
  } catch (error) {
    if (!['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(error?.code)) throw error
    await delay(1000)
  }
}

console.error(`Could not clean temporary deploy folder: ${target}`)
process.exit(1)
