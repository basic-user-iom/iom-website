import { chromium } from 'playwright'
import fs from 'fs'

const targets = [
  'applyShareState',
  'applyDefaultShareState',
  'rebuildMaterialsPanel',
  'rebuildObjectsPanel',
  'setMaterialsPanelCollapsed',
  'setObjectsPanelCollapsed',
  'refreshGlassState',
  'refreshShareInspectorControls',
  'captureModelBaselines',
  'setNavigationMode',
  'updateSceneControlAvailability',
  'updateTransformGizmo',
  'resetPlayerSpawn',
  'onPickMaterialsToggle',
  'onGizmoEnabledToggle',
]

let html = fs.readFileSync('public/demos/ssr-denoise/index.html', 'utf8')

const wrapBlock = targets
  .map((fn) => {
    return `
  ;(function() {
    const __orig = ${fn};
    ${fn} = function traced_${fn}(...args) {
      if (!window.__calls) window.__calls = [];
      window.__calls.push('${fn}');
      if (window.__calls.length > 120) {
        window.__overflow = window.__calls.slice(-60);
        throw new Error('TRACE_OVERFLOW at ${fn}');
      }
      try {
        return __orig.apply(this, args);
      } finally {
        window.__calls.pop();
      }
    };
  })();`
  })
  .join('\n')

const matched = /init\(\)\.catch\(\(error\) => \{/.test(html)
if (!matched) {
  console.error('Could not find init().catch injection point')
  process.exit(1)
}

html = html.replace(
  /init\(\)\.catch\(\(error\) => \{/,
  `${wrapBlock}
init().catch((error) => {
  window.__initStack = error?.stack;
  window.__initMsg = error?.message;`,
)

const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan,WebGPU',
    '--use-angle=vulkan',
    '--ignore-gpu-blocklist',
  ],
})

const page = await browser.newPage()
page.on('pageerror', (err) => {
  console.error('PAGEERROR:', err.message)
  console.error(err.stack?.split('\n').slice(0, 30).join('\n'))
})
const localHtml = html
await page.route('**/demos/ssr-denoise/index.html', async (route) => {
  await route.fulfill({ contentType: 'text/html', body: localHtml })
})

await page.goto('http://127.0.0.1:4173/demos/ssr-denoise/', {
  waitUntil: 'domcontentloaded',
  timeout: 90000,
})
await page.waitForTimeout(25000)

const data = await page.evaluate(() => ({
  msg: window.__initMsg ?? null,
  stack: window.__initStack ?? null,
  overflow: window.__overflow ?? null,
  tail: window.__calls ?? null,
  fb: document.getElementById('fallback')?.querySelector('p')?.textContent ?? null,
}))

console.log(JSON.stringify(data, null, 2))
await browser.close()
