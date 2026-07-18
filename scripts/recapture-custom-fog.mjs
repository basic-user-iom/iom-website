/**
 * Distinct stills for webgpu-custom-fog-scattering:
 * cover = walk-in haze, view-a = look-around, view-b = denser fog / different pose.
 */
import { mkdir, writeFile, copyFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'assets', 'blog', 'webgpu-custom-fog-scattering')
const POSTER = join(__dirname, '..', 'public', 'assets', 'posters', 'webgpu-custom-fog-scattering.jpg')
const TMP = join(tmpdir(), `fog-capture-${Date.now()}`)
const base = (process.argv[2] ?? 'https://iobjectm.com').replace(/\/$/, '')

async function meanAbsDiff(a, b) {
  const size = 64
  const [ra, rb] = await Promise.all([
    sharp(a).resize(size, size, { fit: 'fill' }).raw().toBuffer(),
    sharp(b).resize(size, size, { fit: 'fill' }).raw().toBuffer(),
  ])
  let sum = 0
  for (let i = 0; i < ra.length; i++) sum += Math.abs(ra[i] - rb[i])
  return sum / ra.length
}

async function hideChrome(page) {
  await page.evaluate(() => {
    for (const sel of ['.back-link', '.hint', '#hint', '#status', '.demo-attribution', '.demo-chrome']) {
      document.querySelectorAll(sel).forEach((el) => el.style.setProperty('display', 'none', 'important'))
    }
  })
}

async function waitFog(page) {
  await page.waitForFunction(
    () => {
      const status = document.getElementById('status')
      const okStatus = !status || /WASD|walk|fog/i.test(status.textContent || '')
      const canvas = document.querySelector('canvas')
      if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 32) return false
      const tmp = document.createElement('canvas')
      tmp.width = 24
      tmp.height = 24
      const ctx = tmp.getContext('2d')
      if (!ctx) return false
      ctx.drawImage(canvas, 0, 0, 24, 24)
      const d = ctx.getImageData(0, 0, 24, 24).data
      let s = 0
      for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]
      return okStatus && s / (24 * 24) > 80
    },
    { timeout: 120000 },
  )
}

async function shot(page, name) {
  await hideChrome(page)
  const raw = await page.screenshot({ type: 'jpeg', quality: 92 })
  const buf = await sharp(raw).resize(1280, 800, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer()
  await writeFile(join(TMP, name), buf)
  console.log(`  ${name} ${buf.length}`)
  return buf
}

async function look(page, dx, dy) {
  await page.mouse.move(720, 400)
  await page.mouse.down()
  await page.mouse.move(720 + dx, 400 + dy, { steps: 24 })
  await page.mouse.up()
  await page.waitForTimeout(700)
}

async function walk(page, key, ms = 900) {
  await page.keyboard.down(key)
  await page.waitForTimeout(ms)
  await page.keyboard.up(key)
  await page.waitForTimeout(400)
}

async function setLilNumber(page, labelRe, value) {
  return page.evaluate(
    ({ labelRe, value }) => {
      const re = new RegExp(labelRe, 'i')
      const controllers = document.querySelectorAll('.lil-gui .controller')
      for (const c of controllers) {
        const name = c.querySelector('.name')?.textContent || ''
        if (!re.test(name)) continue
        const input = c.querySelector('input')
        if (!input) continue
        const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
        proto?.set?.call(input, String(value))
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      }
      return false
    },
    { labelRe, value },
  )
}

async function toggleLilCheckbox(page, labelRe) {
  return page.evaluate((labelRe) => {
    const re = new RegExp(labelRe, 'i')
    const controllers = document.querySelectorAll('.lil-gui .controller')
    for (const c of controllers) {
      const name = c.querySelector('.name')?.textContent || ''
      if (!re.test(name)) continue
      const input = c.querySelector('input[type=checkbox]')
      if (!input) continue
      input.click()
      return true
    }
    return false
  }, labelRe)
}

async function seedCrops() {
  if (!existsSync(POSTER)) throw new Error('missing poster')
  await mkdir(OUT, { recursive: true })
  const meta = await sharp(POSTER).metadata()
  const w = meta.width || 1600
  const h = meta.height || 900
  const crops = [
    { left: 0, top: 0, width: Math.floor(w * 0.78), height: Math.floor(h * 0.85) },
    { left: Math.floor(w * 0.22), top: Math.floor(h * 0.05), width: Math.floor(w * 0.78), height: Math.floor(h * 0.85) },
    { left: Math.floor(w * 0.1), top: Math.floor(h * 0.18), width: Math.floor(w * 0.8), height: Math.floor(h * 0.72) },
  ]
  const names = ['cover.jpg', 'view-a.jpg', 'view-b.jpg']
  for (let i = 0; i < 3; i++) {
    const c = crops[i]
    const buf = await sharp(POSTER)
      .extract({
        left: Math.max(0, c.left),
        top: Math.max(0, c.top),
        width: Math.min(c.width, w - c.left),
        height: Math.min(c.height, h - c.top),
      })
      .resize(1280, 800, { fit: 'cover' })
      .jpeg({ quality: 88 })
      .toBuffer()
    await writeFile(join(OUT, names[i]), buf)
    console.log(`  crop ${names[i]} ${buf.length}`)
  }
}

async function main() {
  console.log('custom-fog capture from', base)
  await mkdir(TMP, { recursive: true })
  await mkdir(OUT, { recursive: true })
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--ignore-gpu-blocklist', '--enable-webgl', '--use-gl=angle'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  let ok = false
  try {
    await page.goto(`${base}/demos/webgpu-custom-fog-scattering/`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    })
    await page.waitForTimeout(3000)
    await waitFog(page)
    await page.waitForTimeout(2000)
    // Focus canvas for WASD
    await page.mouse.click(720, 450)
    await page.waitForTimeout(300)

    // Cover — default scattering, mild look
    await setLilNumber(page, 'fog density', 0.11)
    await setLilNumber(page, 'scattering factor', 2)
    await page.waitForTimeout(400)
    const cover = await shot(page, 'cover.jpg')

    // view-a — walk forward + yaw left into denser trunks
    await walk(page, 'KeyW', 1400)
    await look(page, -220, 30)
    await setLilNumber(page, 'fog density', 0.18)
    await page.waitForTimeout(500)
    const viewA = await shot(page, 'view-a.jpg')

    // view-b — turn opposite, lighter fog / scattering contrast
    await look(page, 380, -20)
    await walk(page, 'KeyA', 800)
    await setLilNumber(page, 'fog density', 0.06)
    await setLilNumber(page, 'scattering factor', 4)
    await page.waitForTimeout(500)
    const viewB = await shot(page, 'view-b.jpg')

    const dCA = await meanAbsDiff(cover, viewA)
    const dAB = await meanAbsDiff(viewA, viewB)
    const dCB = await meanAbsDiff(cover, viewB)
    console.log(`  diffs cover↔a=${dCA.toFixed(1)} a↔b=${dAB.toFixed(1)} cover↔b=${dCB.toFixed(1)}`)
    if (cover.length > 40000 && dAB > 8 && dCA > 6) {
      for (const n of ['cover.jpg', 'view-a.jpg', 'view-b.jpg']) {
        await copyFile(join(TMP, n), join(OUT, n))
      }
      ok = true
    } else {
      console.warn('  live angles weak — poster crops')
    }
  } catch (err) {
    console.warn('live failed:', err.message || err)
  } finally {
    await page.close()
    await browser.close()
  }

  if (!ok) await seedCrops()
  console.log('done →', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
