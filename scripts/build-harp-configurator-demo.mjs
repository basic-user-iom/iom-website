/** Build Harp Configurator → public/demos/harp-configurator-demo/ */
import { access, cp, mkdir, readFile, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const APP = join(ROOT, 'harp-configurator-demo')
const DIST = join(APP, 'dist')
const OUT = join(ROOT, 'public', 'demos', 'harp-configurator-demo')

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function nestedNpmEnv() {
  const env = { ...process.env }
  for (const key of Object.keys(env)) {
    if (/^npm_/i.test(key)) delete env[key]
  }
  return env
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: nestedNpmEnv(),
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

async function main() {
  const packagePath = join(APP, 'package.json')
  if (!(await exists(packagePath))) throw new Error(`Missing ${packagePath}`)
  const appPackage = JSON.parse(await readFile(packagePath, 'utf8'))
  if (appPackage.name !== 'harp-configurator-demo') {
    throw new Error(`Unexpected project package name: ${appPackage.name || '(missing)'}`)
  }
  if (!(await exists(join(APP, 'node_modules', 'vite', 'package.json')))) {
    throw new Error('Missing harp configurator dependencies. Run `npm --prefix harp-configurator-demo ci`.')
  }

  console.log('Building private Harp Configurator demo…')
  run('npm', ['run', 'build'], APP)
  if (!(await exists(join(DIST, 'index.html')))) {
    throw new Error(`Build output missing ${join(DIST, 'index.html')}`)
  }

  await rm(OUT, { recursive: true, force: true })
  await mkdir(dirname(OUT), { recursive: true })
  await cp(DIST, OUT, { recursive: true })
  // Legacy mask/ORM experiments are retained with the source project but are
  // not referenced by the geometry-classified runtime.
  await rm(join(OUT, 'models', 'processed'), { recursive: true, force: true })
  console.log('Done. Harp Configurator → /demos/harp-configurator-demo/')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
