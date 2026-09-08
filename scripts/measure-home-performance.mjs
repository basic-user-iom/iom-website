import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

function readArg(name, fallback) {
  const prefix = `--${name}=`
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

const baseUrl = readArg('base-url', 'http://127.0.0.1:4176').replace(/\/$/, '')
const outputPath = readArg('output', '')
const browser = await chromium.launch({ headless: true })
const profiles = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
}

async function readMetrics(page) {
  await page.waitForTimeout(900)
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const resources = performance.getEntriesByType('resource')
    const initialHeavy = resources
      .filter((entry) => /(?:three|MusicSection|musicPlayer|\.mp4(?:\?|$))/i.test(entry.name))
      .map((entry) => entry.name)
    return {
      dclMs: Math.round(nav.domContentLoadedEventEnd),
      loadMs: Math.round(nav.loadEventEnd),
      lcpMs: Math.round(window.__iomQaVitals?.lcp ?? 0),
      cls: Number((window.__iomQaVitals?.cls ?? 0).toFixed(4)),
      longTasks: window.__iomQaVitals?.longTasks ?? 0,
      transferKb: Math.round(resources.reduce((sum, entry) => sum + entry.transferSize, 0) / 1024),
      resourceCount: resources.length,
      initialHeavy,
    }
  })
}

const samples = {}
for (const [profileName, contextOptions] of Object.entries(profiles)) {
  samples[profileName] = { cold: [], warm: [] }
  for (let run = 0; run < 3; run += 1) {
    const context = await browser.newContext(contextOptions)
    const page = await context.newPage()
    await page.addInitScript(() => {
      window.__iomQaVitals = { lcp: 0, cls: 0, longTasks: 0 }
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) window.__iomQaVitals.lcp = entry.startTime
        }).observe({ type: 'largest-contentful-paint', buffered: true })
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) window.__iomQaVitals.cls += entry.value
          }
        }).observe({ type: 'layout-shift', buffered: true })
        new PerformanceObserver((list) => {
          window.__iomQaVitals.longTasks += list.getEntries().length
        }).observe({ type: 'longtask', buffered: true })
      } catch {
        // Older engines may not expose every observer type.
      }
    })
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 40,
      downloadThroughput: 5 * 1024 * 1024 / 8,
      uploadThroughput: 1 * 1024 * 1024 / 8,
      connectionType: 'wifi',
    })
    await page.goto(`${baseUrl}/`, { waitUntil: 'load' })
    samples[profileName].cold.push(await readMetrics(page))
    await page.reload({ waitUntil: 'load' })
    samples[profileName].warm.push(await readMetrics(page))
    await context.close()
  }
}

const summary = {}
for (const [profileName, caches] of Object.entries(samples)) {
  summary[profileName] = {}
  for (const [cacheName, runs] of Object.entries(caches)) {
    summary[profileName][cacheName] = {
      dclMedianMs: median(runs.map((run) => run.dclMs)),
      loadMedianMs: median(runs.map((run) => run.loadMs)),
      lcpMedianMs: median(runs.map((run) => run.lcpMs)),
      clsMedian: median(runs.map((run) => run.cls)),
      transferMedianKb: median(runs.map((run) => run.transferKb)),
      longTasksMedian: median(runs.map((run) => run.longTasks)),
      ranges: {
        lcpMs: [Math.min(...runs.map((run) => run.lcpMs)), Math.max(...runs.map((run) => run.lcpMs))],
        cls: [Math.min(...runs.map((run) => run.cls)), Math.max(...runs.map((run) => run.cls))],
      },
    }
  }
}

const report = { baseUrl, network: '40ms RTT, 5 Mbps down, 1 Mbps up', samples, summary }
const json = `${JSON.stringify(report, null, 2)}\n`
if (outputPath) writeFileSync(resolve(outputPath), json, 'utf8')
console.log(json)
await browser.close()
