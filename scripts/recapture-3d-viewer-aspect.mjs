/**
 * Recapture 3d-viewer blog stills from the local app (localhost:3000).
 *
 * Squash root cause: with the top menu open, #viewer-canvas shrinks to ~1280×276
 * while the camera often keeps the window aspect (~1.6). HTML chrome stays correct;
 * only the WebGL model looks pancaked. Fix by hiding the menu and syncing
 * camera.aspect + renderer.setSize to the canvas CSS box before every shot.
 *
 * Usage: node scripts/recapture-3d-viewer-aspect.mjs [viewerBaseUrl]
 */
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'assets', 'blog', '3d-viewer')
const WIDTH = 1280
const HEIGHT = 800
const viewerBase = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '')

async function syncAspect(page) {
  return page.evaluate(() => {
    const v = window.__viewer || window.sharedViewer
    const c = document.querySelector('#viewer-canvas')
    if (!v?.camera || !v?.renderer || !(c instanceof HTMLCanvasElement)) return null
    const width = Math.max(1, Math.round(c.clientWidth))
    const height = Math.max(1, Math.round(c.clientHeight))
    v.camera.aspect = width / height
    v.camera.updateProjectionMatrix()
    v.renderer.setSize(width, height, false)
    v.postProcessingSystem?.setSize?.(width, height)
    return {
      w: width,
      h: height,
      r: +(width / height).toFixed(3),
      aspect: +v.camera.aspect.toFixed(3),
      buf: c.height,
    }
  })
}

async function clickIncludes(page, reSource) {
  return page.evaluate((source) => {
    const rx = new RegExp(source, 'i')
    const btn = [...document.querySelectorAll('button,[role="button"]')].find((b) =>
      rx.test((b.textContent || '').replace(/\s+/g, ' ').trim()),
    )
    if (!btn) return false
    btn.click()
    return true
  }, reSource)
}

async function hideComingSoon(page) {
  await page.evaluate(() => {
    const canvas = document.querySelector('#viewer-canvas')
    document.querySelectorAll('div').forEach((el) => {
      if (canvas && (el.contains(canvas) || canvas.contains(el))) return
      const t = (el.textContent || '').trim()
      if (/^COMING SOON/i.test(t) && t.length < 180) {
        el.style.setProperty('display', 'none', 'important')
      }
    })
  })
}

async function orbitSpherical(page, azDeg, polDeg, zoom) {
  await page.evaluate(
    ({ azDeg, polDeg, zoom }) => {
      const v = window.__viewer || window.sharedViewer
      const cam = v.camera
      const target = v.controls?.target || { x: 0, y: 0.4, z: 0 }
      const tx = target.x
      const ty = target.y
      const tz = target.z
      const dx = cam.position.x - tx
      const dy = cam.position.y - ty
      const dz = cam.position.z - tz
      const radius = Math.hypot(dx, dy, dz) * (zoom || 1)
      const theta = Math.atan2(dx, dz) + (azDeg * Math.PI) / 180
      let phi =
        Math.acos(Math.min(1, Math.max(-1, dy / Math.max(1e-6, Math.hypot(dx, dy, dz))))) +
        (polDeg * Math.PI) / 180
      phi = Math.min(Math.PI * 0.45, Math.max(0.25, phi))
      cam.position.set(
        tx + radius * Math.sin(phi) * Math.sin(theta),
        ty + radius * Math.cos(phi),
        tz + radius * Math.sin(phi) * Math.cos(theta),
      )
      if (v.controls) v.controls.update()
      else cam.lookAt(tx, ty, tz)
    },
    { azDeg, polDeg, zoom },
  )
  await page.waitForTimeout(400)
  return syncAspect(page)
}

async function saveShot(page, name) {
  const info = await syncAspect(page)
  console.log(`  ${name}`, info)
  if (!info || info.h < 500) throw new Error(`${name}: canvas too short`)
  if (Math.abs(info.r - info.aspect) > 0.05 || Math.abs(info.buf - info.h) > 2) {
    throw new Error(`${name}: aspect mismatch ${JSON.stringify(info)}`)
  }
  const raw = await page.screenshot({ type: 'jpeg', quality: 92, fullPage: false })
  const buf = await sharp(raw)
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 90 })
    .toBuffer()
  const dest = join(OUT, name)
  await writeFile(dest, buf)
  const meta = await sharp(dest).metadata()
  console.log(`  → ${name} ${meta.width}x${meta.height} (${buf.length} bytes)`)
}

async function main() {
  await mkdir(OUT, { recursive: true })
  console.log('Recapture 3d-viewer from', viewerBase, `@ ${WIDTH}x${HEIGHT}`)
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  })
  page.setDefaultTimeout(180000)
  try {
    await page.goto(viewerBase + '/', { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.waitForSelector('#viewer-canvas', { timeout: 120000 })
    await page.waitForTimeout(9000)
    await hideComingSoon(page)
    await clickIncludes(page, 'hide menu')
    await page.waitForTimeout(800)
    console.log('  menu hidden', await syncAspect(page))

    const shots = [
      { name: 'cover.jpg', az: 35, pol: -8, zoom: 0.85 },
      { name: 'view-a.jpg', az: -55, pol: -5, zoom: 0.9 },
      { name: 'view-b.jpg', az: 110, pol: 5, zoom: 0.8 },
    ]

    for (const s of shots) {
      await clickIncludes(page, '^Fit$')
      await page.waitForTimeout(800)
      await orbitSpherical(page, s.az, s.pol, s.zoom)
      await saveShot(page, s.name)
    }
  } finally {
    await page.close()
    await browser.close()
  }
  console.log('done')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
