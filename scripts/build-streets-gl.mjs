/**
 * Clone (if needed), build, and optionally copy Streets GL into public/demos/streets-gl/app/.
 *
 * Default mode copies the webpack build for self-hosted serving at /demos/streets-gl/app/.
 * Note: upstream resources.json uses root-absolute paths (/textures, /models, …), so the
 * self-hosted copy only works when those paths are also served at site root (e.g. via reverse
 * proxy). The IOM demo page embeds https://streets.gl/ instead — this script is for local dev
 * and future full self-host.
 *
 * Usage:
 *   node scripts/build-streets-gl.mjs           # clone + npm ci + build (vendor only)
 *   node scripts/build-streets-gl.mjs --copy    # also copy build → public/demos/streets-gl/app
 */
import { cp, mkdir, rm, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const VENDOR = join(ROOT, 'vendor', 'streets-gl')
const OUT_APP = join(ROOT, 'public', 'demos', 'streets-gl', 'app')
const REPO = 'https://github.com/StrandedKitty/streets-gl.git'
const copy = process.argv.includes('--copy')

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
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
  await mkdir(join(ROOT, 'vendor'), { recursive: true })

  if (!(await exists(join(VENDOR, '.git')))) {
    console.log('Cloning streets-gl…')
    run('git', ['clone', '--depth', '1', REPO, VENDOR], ROOT)
  } else {
    console.log('vendor/streets-gl already present — skipping clone')
  }

  if (!(await exists(join(VENDOR, 'node_modules')))) {
    console.log('Installing streets-gl dependencies…')
    run('npm', ['install'], VENDOR)
  }

  console.log('Building streets-gl (webpack production)…')
  run('npm', ['run', 'build'], VENDOR)

  if (copy) {
    console.log(`Copying build → ${OUT_APP}`)
    await rm(OUT_APP, { recursive: true, force: true })
    await cp(join(VENDOR, 'build'), OUT_APP, { recursive: true })
    console.log('Done. Serve at /demos/streets-gl/app/ (requires root path rewrites for assets).')
  } else {
    console.log('Build complete in vendor/streets-gl/build')
    console.log('Run locally: cd vendor/streets-gl && npm run dev  (webpack-dev-server)')
    console.log('Or: cd vendor/streets-gl && npm start  (http-server on :8080)')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
