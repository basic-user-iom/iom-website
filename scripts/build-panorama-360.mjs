/**
 * Build the 360° panorama tour editor from the 3D Viewer repo and copy into public/demos/panorama-360/.
 *
 * Usage: node scripts/build-panorama-360.mjs
 */
import { cp, mkdir, rm, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const VIEWER_ROOT = join(ROOT, '..', '3d-viever-backup', 'v3.18')
const VIEWER_DIST = join(VIEWER_ROOT, 'dist', 'panorama-360')
const OUT_DIR = join(ROOT, 'public', 'demos', 'panorama-360')

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
  const prebuiltIndex = join(OUT_DIR, 'index.html')

  if (!(await exists(VIEWER_ROOT))) {
    if (await exists(prebuiltIndex)) {
      console.log('3D Viewer repo not found — using prebuilt public/demos/panorama-360/')
      return
    }
    console.error(`3D Viewer repo not found at ${VIEWER_ROOT} and no prebuilt demo at ${OUT_DIR}`)
    process.exit(1)
  }

  if (!(await exists(join(VIEWER_ROOT, 'node_modules')))) {
    console.log('Installing 3D Viewer dependencies…')
    run('npm', ['install'], VIEWER_ROOT)
  }

  console.log('Building panorama 360 tour editor…')
  run('npx', ['vite', 'build', '--config', 'vite.panorama.config.ts'], VIEWER_ROOT)

  if (!(await exists(VIEWER_DIST))) {
    console.error(`Build output missing: ${VIEWER_DIST}`)
    process.exit(1)
  }

  console.log(`Copying build → ${OUT_DIR}`)
  await mkdir(join(ROOT, 'public', 'demos'), { recursive: true })
  await rm(OUT_DIR, { recursive: true, force: true })
  await cp(VIEWER_DIST, OUT_DIR, { recursive: true })

  const builtHtml = join(OUT_DIR, 'panorama-index.html')
  const indexHtml = join(OUT_DIR, 'index.html')
  if (await exists(builtHtml)) {
    const { rename } = await import('node:fs/promises')
    await rename(builtHtml, indexHtml)
  }

  // Re-apply SEO meta (vite build may strip or reset head tags)
  run('node', [join(ROOT, 'scripts', 'patch-demo-seo.mjs')], ROOT)

  // Click-to-start gate: static poster until interaction (build overwrites index.html)
  await patchPanoramaClickToStart(indexHtml)

  console.log('Done. Serve at /demos/panorama-360/')
}

async function patchPanoramaClickToStart(indexHtml) {
  const { readFile, writeFile } = await import('node:fs/promises')
  if (!(await exists(indexHtml))) return

  let html = await readFile(indexHtml, 'utf8')
  if (html.includes('iomDemoAwaitStart')) {
    console.log('· panorama-360 click-to-start already present')
    return
  }

  const jsMatch = html.match(/src="(\/demos\/panorama-360\/assets\/[^"]+\.js)"/)
  const cssMatch = html.match(/href="(\/demos\/panorama-360\/assets\/[^"]+\.css)"/)
  if (!jsMatch || !cssMatch) {
    console.warn('⚠ panorama-360: could not find built asset URLs — skipped click-to-start patch')
    return
  }

  const jsSrc = jsMatch[1]
  const cssHref = cssMatch[1]

  html = html.replace(
    /\s*<script type="module"[^>]*src="\/demos\/panorama-360\/assets\/[^"]+\.js"[^>]*><\/script>\s*/i,
    '\n',
  )

  if (!html.includes(cssHref)) {
    html = html.replace('</style>', `</style>\n    <link rel="stylesheet" crossorigin href="${cssHref}">`)
  }

  html = html.replace(
    /<body>\s*<div id="root"><\/div>\s*<\/body>/i,
    `<body>
    <div id="root"></div>
    <script src="/demos/iom-click-to-start.js"></script>
    <script type="module">
      await window.iomDemoAwaitStart({
        poster: '/assets/posters/panorama-360-tour.webp',
        label: 'Start 360° tour editor',
      })
      await import('${jsSrc}')
    </script>
  </body>`,
  )

  await writeFile(indexHtml, html, 'utf8')
  console.log('✓ panorama-360 click-to-start gate applied')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
