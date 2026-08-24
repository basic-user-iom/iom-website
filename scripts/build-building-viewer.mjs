/**
 * Build Building Viewer → public/demos/building-viewer/
 *
 * Usage: node scripts/build-building-viewer.mjs
 */
import { access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const APP = join(ROOT, 'building-viewer')
const OUT = join(ROOT, 'public', 'demos', 'building-viewer')

function nestedNpmEnv() {
  const env = { ...process.env }
  for (const key of Object.keys(env)) {
    if (/^npm_/i.test(key)) delete env[key]
  }
  return env
}

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: nestedNpmEnv(),
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function main() {
  if (!(await exists(APP))) {
    console.error(`Missing ${APP}`)
    process.exit(1)
  }

  if (!(await exists(join(APP, 'node_modules', 'three')))) {
    console.log('Installing building-viewer dependencies…')
    run('npm', ['install'], APP)
  }

  console.log('Building Building Viewer…')
  run('npm', ['run', 'build'], APP)

  if (!(await exists(join(OUT, 'index.html')))) {
    console.error(`Build output missing index.html in ${OUT}`)
    process.exit(1)
  }

  console.log('Done. Building Viewer → /demos/building-viewer/')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
