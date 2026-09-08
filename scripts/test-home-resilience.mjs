import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

function readArg(name, fallback) {
  const prefix = `--${name}=`
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

const BASE_URL = readArg('base-url', 'http://127.0.0.1:4176').replace(/\/$/, '')
const OUT_DIR = resolve(readArg('out-dir', 'codex-artifacts/f01-f03-qa-20260908/latest'))
mkdirSync(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const results = []

async function run(name, test) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  page.setDefaultTimeout(12000)
  const diagnostics = []
  page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      diagnostics.push(`${message.type()}: ${message.text()}`)
    }
  })

  try {
    const details = await test(page, context)
    results.push({ name, status: 'PASS', details, diagnostics })
  } catch (error) {
    results.push({ name, status: 'FAIL', error: error.stack ?? String(error), diagnostics })
  } finally {
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    await context.close()
  }
}

await run('F01 delayed stylesheet keeps the static first paint', async (page) => {
  let markCssRequested
  const cssRequested = new Promise((resolveRequested) => { markCssRequested = resolveRequested })
  await page.route(/\/assets\/main-[^/]+\.css(?:\?|$)/, async (route) => {
    markCssRequested()
    const response = await route.fetch()
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 3000))
    await route.fulfill({ response })
  })

  await page.goto(`${BASE_URL}/`, { waitUntil: 'commit' })
  await Promise.race([
    cssRequested,
    new Promise((_, reject) => setTimeout(() => reject(new Error('main CSS was not requested')), 5000)),
  ])
  await page.waitForTimeout(500)
  const duringDelay = await page.evaluate(() => ({
    appReady: document.documentElement.classList.contains('app-ready'),
    cssReady: document.documentElement.classList.contains('css-ready'),
    cssMarker: getComputedStyle(document.documentElement).getPropertyValue('--iom-css-loaded').trim(),
    bootHeader: Boolean(document.querySelector('[data-boot-header]')),
    bootShell: Boolean(document.getElementById('boot-shell')),
    reactHeader: Boolean(document.querySelector('#root > .site-header:not([data-boot-header])')),
  }))
  await page.screenshot({ path: resolve(OUT_DIR, 'f01-css-delay-500ms.png') })
  await page.waitForLoadState('domcontentloaded')
  await page.waitForSelector('#root > .site-header:not([data-boot-header])')
  const afterLoad = await page.evaluate(() => ({
    cssMarker: getComputedStyle(document.documentElement).getPropertyValue('--iom-css-loaded').trim(),
    bootHeader: Boolean(document.querySelector('[data-boot-header]')),
    hero: Boolean(document.querySelector('.hero')),
  }))
  assert.equal(duringDelay.appReady, false)
  assert.equal(duringDelay.cssReady, false)
  assert.equal(duringDelay.cssMarker, '')
  assert.equal(duringDelay.bootHeader, true)
  assert.equal(duringDelay.bootShell, true)
  assert.equal(duringDelay.reactHeader, false)
  assert.equal(afterLoad.cssMarker, '1')
  assert.equal(afterLoad.bootHeader, false)
  assert.equal(afterLoad.hero, true)
  return { duringDelay, afterLoad }
})

await run('F01 missing stylesheet retains a usable static shell', async (page) => {
  await page.route(/\/assets\/main-[^/]+\.css(?:\?|$)/, (route) => route.abort('failed'))
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  const state = await page.evaluate(() => ({
    bootHeader: Boolean(document.querySelector('[data-boot-header]')),
    bootShell: Boolean(document.getElementById('boot-shell')),
    finalHeader: Boolean(document.querySelector('#root > .site-header:not([data-boot-header])')),
    title: document.querySelector('#boot-shell h1')?.textContent?.trim(),
  }))
  await page.screenshot({ path: resolve(OUT_DIR, 'f01-css-missing.png') })
  assert.equal(state.bootHeader, true)
  assert.equal(state.bootShell, true)
  assert.equal(state.finalHeader, false)
  assert.match(state.title ?? '', /Interactive/)
  return state
})

await run('F02 first Music click mounts and aligns the deferred section', async (page) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#root > .site-header:not([data-boot-header])')
  const startY = await page.evaluate(() => window.scrollY)
  await page.locator('.header-nav a[href$="#music"]').first().click()
  await page.waitForSelector('section#music:not([aria-busy]) #music-heading')
  await page.waitForFunction(() => !document.documentElement.classList.contains('is-hash-scrolling'))
  await page.waitForSelector('.music-player-visual-mount[data-visualizer-kind="fft-ocean"] canvas')
  const state = await page.evaluate(() => {
    const header = document.querySelector('.site-header')?.getBoundingClientRect()
    const music = document.querySelector('section#music:not([aria-busy])')?.getBoundingClientRect()
    return {
      hash: location.hash,
      top: music?.top ?? null,
      headerBottom: header?.bottom ?? null,
      busy: document.querySelector('section#music')?.getAttribute('aria-busy'),
      visualizerKind: document.querySelector('.music-player-visual-mount')?.getAttribute('data-visualizer-kind'),
    }
  })
  await page.screenshot({ path: resolve(OUT_DIR, 'f02-first-music-click.png') })
  assert.ok(startY < 40)
  assert.equal(state.hash, '#music')
  assert.equal(state.busy, null)
  assert.equal(state.visualizerKind, 'fft-ocean')
  assert.ok(state.top != null && state.headerBottom != null)
  assert.ok(Math.abs(state.top - state.headerBottom) <= 6, JSON.stringify(state))
  return { startY, ...state }
})

await run('F02 direct hash, repeat click, history and wheel cancellation remain stable', async (page) => {
  await page.goto(`${BASE_URL}/#music`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('section#music:not([aria-busy]) #music-heading')
  await page.waitForFunction(() => !document.documentElement.classList.contains('is-hash-scrolling'))

  await page.locator('.header-nav a[href$="#software"]').first().click()
  await page.waitForFunction(() => location.hash === '#software' && !document.documentElement.classList.contains('is-hash-scrolling'))
  await page.goBack()
  await page.waitForFunction(() => location.hash === '#music' && !document.documentElement.classList.contains('is-hash-scrolling'))
  await page.goForward()
  await page.waitForFunction(() => location.hash === '#software' && !document.documentElement.classList.contains('is-hash-scrolling'))

  await page.locator('.header-nav a[href$="#music"]').first().click()
  await page.waitForFunction(() => location.hash === '#music' && !document.documentElement.classList.contains('is-hash-scrolling'))
  await page.locator('.header-nav a[href$="#music"]').first().click()
  await page.waitForFunction(() => !document.documentElement.classList.contains('is-hash-scrolling'))

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#root > .site-header:not([data-boot-header])')
  await page.waitForSelector('section#music:not([aria-busy]) #music-heading')
  await page.locator('.header-nav a[href$="#software"]').first().click()
  await page.waitForTimeout(100)
  await page.mouse.wheel(0, 180)
  await page.evaluate(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 180 })))
  await page.waitForTimeout(100)
  const state = await page.evaluate(() => ({
    hash: location.hash,
    scrolling: document.documentElement.classList.contains('is-hash-scrolling'),
    musicReady: Boolean(document.querySelector('section#music:not([aria-busy])')),
  }))
  assert.equal(state.hash, '#software')
  assert.equal(state.scrolling, false)
  assert.equal(state.musicReady, true)
  return state
})

await run('F03 no WebGL falls back without losing controls or navigation', async (page) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === 'webgl' || type === 'webgl2' || type === 'webgpu') return null
      return original.call(this, type, ...args)
    }
  })
  await page.goto(`${BASE_URL}/#music`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.music-player-visual-fallback')
  const state = await page.evaluate(() => ({
    header: Boolean(document.querySelector('.site-header')),
    musicHeading: document.getElementById('music-heading')?.textContent?.trim(),
    controls: Boolean(document.getElementById('music-player-controls')),
    fallback: document.querySelector('.music-player-visual-fallback')?.textContent?.trim(),
  }))
  await page.screenshot({ path: resolve(OUT_DIR, 'f03-no-webgl.png') })
  assert.equal(state.header, true)
  assert.equal(state.controls, true)
  assert.match(state.musicHeading ?? '', /Music/i)
  assert.match(state.fallback ?? '', /Audio controls remain available/i)
  return state
})

await run('F03 failed visualizer import falls back locally', async (page) => {
  await page.route(/\/assets\/createMusicPlayerVisualizer-[^/]+\.js(?:\?|$)/, (route) => route.abort('failed'))
  await page.goto(`${BASE_URL}/#music`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.music-player-visual-fallback')
  const state = await page.evaluate(() => ({
    header: Boolean(document.querySelector('.site-header')),
    controls: Boolean(document.getElementById('music-player-controls')),
    fallback: Boolean(document.querySelector('.music-player-visual-fallback')),
  }))
  assert.deepEqual(state, { header: true, controls: true, fallback: true })
  return state
})

await run('Hero chunk failure returns to the poster with navigation intact', async (page) => {
  await page.route(/\/assets\/HeroSceneMount-[^/]+\.js(?:\?|$)/, (route) => route.abort('failed'))
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })
  await page.locator('.hero-start-btn').click()
  await page.waitForSelector('.hero-scene-fallback')
  const state = await page.evaluate(() => ({
    header: Boolean(document.querySelector('.site-header')),
    posterVisible: Boolean(document.querySelector('#lcp-poster:not([hidden])')),
    fallback: document.querySelector('.hero-scene-fallback')?.textContent?.trim(),
  }))
  assert.equal(state.header, true)
  assert.equal(state.posterVisible, true)
  assert.match(state.fallback ?? '', /static preview remains available/i)
  return state
})

await run('Lazy route chunk failure keeps fallback navigation', async (page) => {
  await page.route(/\/assets\/BlogApp-[^/]+\.js(?:\?|$)/, (route) => route.abort('failed'))
  await page.goto(`${BASE_URL}/blog`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.app-load-error')
  const state = await page.evaluate(() => ({
    header: Boolean(document.querySelector('.site-header')),
    nav: document.querySelector('.header-nav')?.textContent?.replace(/\s+/g, ' ').trim(),
    error: document.querySelector('.app-load-error')?.textContent?.replace(/\s+/g, ' ').trim(),
  }))
  assert.equal(state.header, true)
  assert.match(state.nav ?? '', /Software.*Music.*About.*Contact/)
  assert.match(state.error ?? '', /could not finish loading/i)
  return state
})

await browser.close()
console.log(JSON.stringify({ baseUrl: BASE_URL, results }, null, 2))
if (results.some((result) => result.status === 'FAIL')) process.exitCode = 1
