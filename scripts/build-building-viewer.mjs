/**
 * Build Building Viewer → public/demos/icm-building/
 *
 * Usage: node scripts/build-building-viewer.mjs
 */
import { access, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const APP = join(ROOT, 'building-viewer')
const OUT = join(ROOT, 'public', 'demos', 'icm-building')

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

  const packagePath = join(APP, 'package.json')
  if (!(await exists(packagePath))) {
    console.error(`Missing ${packagePath}; refusing to let npm walk up to the site package.`)
    process.exit(1)
  }

  const appPackage = JSON.parse(await readFile(packagePath, 'utf8'))
  if (appPackage.name !== 'iom-building-viewer') {
    console.error(`Unexpected building-viewer package name: ${appPackage.name || '(missing)'}`)
    process.exit(1)
  }

  const requiredPackages = [
    ...Object.keys(appPackage.dependencies || {}),
    ...Object.keys(appPackage.devDependencies || {}),
  ]
  const missingPackages = []
  for (const packageName of requiredPackages) {
    if (!(await exists(join(APP, 'node_modules', packageName, 'package.json')))) {
      missingPackages.push(packageName)
    }
  }
  if (missingPackages.length) {
    console.error(`Missing building-viewer dependencies: ${missingPackages.join(', ')}`)
    console.error('Run `npm --prefix building-viewer ci` before building.')
    process.exit(1)
  }

  console.log('Building Building Viewer…')
  run('npm', ['run', 'build'], APP)

  if (!(await exists(join(OUT, 'index.html')))) {
    console.error(`Build output missing index.html in ${OUT}`)
    process.exit(1)
  }

  console.log('Done. Building Viewer → /demos/icm-building/')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
