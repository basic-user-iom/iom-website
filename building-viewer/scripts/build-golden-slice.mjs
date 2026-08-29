/**
 * Build the Phase-1 golden slices (one exterior façade, one interior foyer).
 * Does not overwrite production icm-ext / icm-anim-2025 GLBs.
 *
 *   node building-viewer/scripts/build-golden-slice.mjs
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../..')
const blender = 'C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe'
const python = join(__dirname, 'blender-golden-slice.py')
const extract = join(__dirname, 'extract-golden-slice.mjs')
const tmp = join(repoRoot, 'building-viewer', 'tmp', 'golden-slice')
const publicModels = join(repoRoot, 'public', 'models')

const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1]
  : null

const SLICES = [
  {
    id: 'icm-golden-ext',
    slice: 'golden-ext',
    name: 'Golden slice — exterior façade',
    min: '-35,-1,84',
    max: '-8,12,132',
  },
  {
    id: 'icm-golden-int',
    slice: 'golden-int',
    name: 'Golden slice — interior foyer',
    min: '-65.55,-0.05,-60.75',
    max: '-55.55,3.35,-49.35',
  },
]

function run(cmd, args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', windowsHide: true })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${cmd} exited ${code}`))
    })
  })
}

async function sha256(path) {
  const buf = await readFile(path)
  return createHash('sha256').update(buf).digest('hex').slice(0, 16)
}

await mkdir(tmp, { recursive: true })
const summary = { blender, created: new Date().toISOString(), slices: [] }

for (const slice of SLICES) {
  if (only && slice.slice !== only && slice.id !== only) continue
  const raw = join(tmp, `${slice.slice}-raw.glb`)
  const baked = join(tmp, `${slice.slice}-baked.glb`)
  const lightmap = join(tmp, `${slice.slice}-lightmap.png`)
  const outDir = join(publicModels, slice.id)
  await mkdir(outDir, { recursive: true })

  console.log(`\n=== extract ${slice.slice} ===`)
  await run(process.execPath, [extract, '--slice', slice.slice, '--output', raw], repoRoot)

  console.log(`\n=== blender bake ${slice.slice} ===`)
  await run(
    blender,
    [
      '--background',
      '--python',
      python,
      '--',
      '--input',
      raw,
      '--output',
      baked,
      '--lightmap',
      lightmap,
      '--size',
      '2048',
      '--samples',
      '128',
      `--min=${slice.min}`,
      `--max=${slice.max}`,
      ...(slice.id === 'icm-golden-ext' ? ['--remodel'] : []),
      ...(slice.id === 'icm-golden-int' ? ['--remodel-room'] : []),
    ],
    repoRoot,
  )

  const web = join(outDir, 'model-web.glb')
  const map = join(outDir, 'lightmap.png')
  await copyFile(baked, web)
  await copyFile(lightmap, map)
  const row = {
    id: slice.id,
    name: slice.name,
    glb: `/models/${slice.id}/model-web.glb`,
    lightmap: `/models/${slice.id}/lightmap.png`,
    glbHash: await sha256(web),
    lightmapHash: await sha256(map),
    bytes: (await readFile(web)).byteLength,
  }
  summary.slices.push(row)
  console.log(JSON.stringify(row, null, 2))
}

await writeFile(join(tmp, 'golden-slice-report.json'), JSON.stringify(summary, null, 2))
await writeFile(join(publicModels, 'golden-slice-report.json'), JSON.stringify(summary, null, 2))
console.log('\n[golden] done', summary)
