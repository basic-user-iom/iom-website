/**
 * Build Automotive Studio → public/demos/automotive-studio/
 *
 * Usage: node scripts/build-automotive-studio.mjs
 * Does not modify Volume Lighting or projects.ts.
 */
import { access, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const APP = join(ROOT, 'automotive-studio')
const OUT = join(ROOT, 'public', 'demos', 'automotive-studio')

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
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
    console.log('Installing automotive-studio dependencies…')
    run('npm', ['install'], APP)
  }

  console.log('Building Automotive Studio (Studio + Presentation entries)…')
  run('npm', ['run', 'build'], APP)

  if (!(await exists(join(OUT, 'index.html')))) {
    console.error(`Build output missing index.html in ${OUT}`)
    process.exit(1)
  }
  if (!(await exists(join(OUT, 'presentation.html')))) {
    console.error(`Build output missing presentation.html in ${OUT}`)
    process.exit(1)
  }

  await writeFile(
    join(OUT, 'ACCESS.txt'),
    [
      'IOM Automotive Studio — access policy (Phase 0/1)',
      '',
      '- Route: /demos/automotive-studio/',
      '- Presentation: /demos/automotive-studio/presentation.html',
      '- Access: local-only / access-controlled until edge auth exists',
      '- Lixiang asset: prototype only — not cleared for public/client branding',
      '- Force WebGL2: append ?forceWebGL2=1',
      '- Volume Lighting remains at /demos/volume-lighting/ (unchanged)',
      '',
    ].join('\n'),
    'utf8',
  )

  console.log(`Done. Studio → /demos/automotive-studio/`)
  console.log(`     Presentation → /demos/automotive-studio/presentation.html`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
