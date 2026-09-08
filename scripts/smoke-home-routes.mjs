import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

function readArg(name, fallback) {
  const prefix = `--${name}=`
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

const baseUrl = readArg('base-url', 'http://127.0.0.1:4177').replace(/\/$/, '')
const outputDir = resolve(readArg('out-dir', 'codex-artifacts/f01-f03-qa-20260908/smoke'))
mkdirSync(outputDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const layout = []
const widths = [320, 390, 768, 900, 901, 1200, 1201, 1440]
for (const width of widths) {
  const context = await browser.newContext({ viewport: { width, height: width <= 480 ? 844 : 900 } })
  const page = await context.newPage()
  const response = await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' })
  assert.equal(response?.status(), 200)
  await page.waitForSelector('#root > .site-header:not([data-boot-header])')
  const state = await page.evaluate(() => {
    const viewer = document.querySelector('.hero-viewer')?.getBoundingClientRect()
    const content = document.querySelector('.hero-content')?.getBoundingClientRect()
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      overflowers: [...document.querySelectorAll('body *')]
        .map((element) => {
          const rect = element.getBoundingClientRect()
          return {
            element: element.tagName.toLowerCase(),
            className: typeof element.className === 'string' ? element.className : '',
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          }
        })
        .filter(({ left, right }) => left < -1 || right > window.innerWidth + 1)
        .slice(0, 10),
      viewerTop: Math.round(viewer?.top ?? -1),
      viewerLeft: Math.round(viewer?.left ?? -1),
      contentTop: Math.round(content?.top ?? -1),
      contentRight: Math.round(content?.right ?? -1),
      posterCount: document.querySelectorAll('#lcp-poster').length,
      posterAdopted: Boolean(document.querySelector('.hero-poster-slot > #lcp-poster')),
    }
  })
  assert.ok(state.overflow <= 1, `${width}px has ${state.overflow}px horizontal overflow`)
  assert.equal(state.posterCount, 1)
  assert.equal(state.posterAdopted, true)
  if (width <= 1200) assert.ok(state.viewerTop < state.contentTop, `${width}px viewer order regressed`)
  else assert.ok(state.viewerLeft >= state.contentRight, `${width}px columns overlap`)
  if ([390, 901, 1200, 1201, 1440].includes(width)) {
    await page.screenshot({ path: resolve(outputDir, `home-${width}.png`), fullPage: false })
  }
  layout.push({ width, ...state })
  await context.close()
}

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#root > .site-header:not([data-boot-header])')
const navIds = ['software', '3d', 'photography', 'music', 'experiments', 'about', 'engage-iom', 'contact']
const navigation = []
for (const id of navIds) {
  const selector = id === 'contact'
    ? `.header-tools a[href$="#${id}"]`
    : `.header-nav a[href$="#${id}"]`
  await page.locator(selector).first().click()
  await page.waitForFunction(
    (targetId) => {
      if (location.hash !== `#${targetId}`) return false
      if (document.documentElement.classList.contains('is-hash-scrolling')) return false
      const target = [...document.querySelectorAll(`[id="${targetId}"]`)].find(
        (element) => element.getAttribute('aria-busy') !== 'true' && !element.classList.contains('section-block--pending'),
      )
      const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 72
      return Boolean(target && Math.abs(target.getBoundingClientRect().top - headerBottom) <= 7)
    },
    id,
  )
  const aligned = await page.evaluate((targetId) => {
    const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 72
    const target = [...document.querySelectorAll(`[id="${targetId}"]`)].find(
      (element) => element.getAttribute('aria-busy') !== 'true' && !element.classList.contains('section-block--pending'),
    )
    const top = target?.getBoundingClientRect().top ?? Number.NaN
    return { id: targetId, top, headerBottom, delta: Math.round(top - headerBottom) }
  }, id)
  assert.ok(Number.isFinite(aligned.top), `${id} target missing`)
  assert.ok(Math.abs(aligned.delta) <= 7, `${id} alignment ${JSON.stringify(aligned)}`)
  navigation.push(aligned)
}

const initialTrackTitle = await page.locator('.music-player-track.is-active .music-player-track-title').textContent()
const trackButtons = page.locator('.music-player-track')
assert.ok(await trackButtons.count() > 1, 'music track switching requires at least two tracks')
await trackButtons.nth(1).click()
await page.waitForFunction(
  (previousTitle) => document.querySelector('.music-player-track.is-active .music-player-track-title')?.textContent !== previousTitle,
  initialTrackTitle,
)
assert.equal(await page.locator('.music-player-visual-mount').getAttribute('data-visualizer-kind'), 'fft-ocean')

const inlineControls = page.locator('#music-player-controls')
const volume = inlineControls.locator('.music-player-volume-slider')
await volume.fill('37')
assert.equal(await volume.inputValue(), '37')
const mute = inlineControls.locator('button[aria-label="Mute"]')
await mute.click()
assert.equal(await inlineControls.locator('button[aria-label="Unmute"]').getAttribute('aria-pressed'), 'true')
await inlineControls.locator('button[aria-label="Unmute"]').click()
assert.equal(await inlineControls.locator('button[aria-label="Mute"]').getAttribute('aria-pressed'), 'false')

await inlineControls.locator('button[aria-label="Play"]').click()
await page.waitForSelector('.music-player-visual.is-live')
await page.waitForFunction(() => !document.querySelector('#music-player-controls .music-player-scrubber')?.disabled)
const scrubber = inlineControls.locator('.music-player-scrubber')
await scrubber.fill('1')
assert.ok(Number(await scrubber.inputValue()) >= 0.9)
await inlineControls.locator('button[aria-label="Pause"]').click()
await page.waitForFunction(() => !document.querySelector('.music-player-visual')?.classList.contains('is-live'))

await page.locator('.music-player-visual-fs-btn').click()
await page.waitForSelector('.music-player-visual-wrap--fs-active')
const musicFullscreen = await page.evaluate(() => ({
  native: Boolean(document.fullscreenElement),
  pseudo: Boolean(document.querySelector('.music-player-visual-wrap--pseudo-fs')),
  lock: document.body.classList.contains('music-player-fs-lock'),
}))
assert.equal(musicFullscreen.native || musicFullscreen.pseudo, true)
assert.equal(musicFullscreen.lock, musicFullscreen.pseudo)
await page.locator('.music-player-visual-fs-btn').click()
await page.waitForFunction(() => !document.querySelector('.music-player-visual-wrap--fs-active'))

await page.locator('.header-brand').click()
await page.waitForTimeout(1000)
if (await page.locator('.hero-start-btn').count()) {
  await page.locator('.hero-start-btn').click()
  await page.waitForFunction(() => !document.querySelector('.hero-start-btn'))
}
await page.locator('.viewer-fullscreen-btn').click()
await page.waitForSelector('.hero-canvas-wrap--pseudo-fs')
assert.equal(await page.evaluate(() => document.body.classList.contains('hero-viewer-fs-lock')), true)
await page.keyboard.press('Escape')
await page.waitForFunction(() => !document.body.classList.contains('hero-viewer-fs-lock'))
await context.close()

const reducedContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
})
const reducedPage = await reducedContext.newPage()
await reducedPage.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' })
await reducedPage.waitForSelector('#root > .site-header:not([data-boot-header])')
assert.equal(await reducedPage.locator('.hero-start-btn').count(), 0)
await reducedPage.locator('.nav-toggle').focus()
await reducedPage.keyboard.press('Enter')
await reducedPage.waitForSelector('.header-nav.is-open')
await reducedPage.keyboard.press('Escape')
await reducedContext.close()

const routeContext = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const routePage = await routeContext.newPage()
const routes = [
  '/de/',
  '/blog',
  '/case-studies/3d-viewer',
  '/project-costs/',
  '/crm-demo',
  '/client-login',
  '/demos/dukta-linar-concept/',
  '/demos/dukta/',
  '/demos/kelly-kettle/',
  '/demos/precision-object/',
  '/demos/floating-stone/',
]
const routeStatuses = []
for (const route of routes) {
  const response = await routePage.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' })
  routeStatuses.push({ route, status: response?.status() ?? 0 })
  assert.equal(response?.status(), 200, route)
  assert.equal(await routePage.locator('body').isVisible(), true, route)
}
await routeContext.close()

await browser.close()
console.log(JSON.stringify({ baseUrl, layout, navigation, routeStatuses }, null, 2))
