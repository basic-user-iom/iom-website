/* global document, innerWidth, innerHeight, getComputedStyle */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Run from solar-system with the local Vite server running. This never deploys.
const url = process.env.SOLAR_UI_URL ?? 'http://127.0.0.1:5194/demos/solar-system/';
const output = 'docs/reviews/responsive-ui-2026-10-02';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, hasTouch: true, reducedMotion: 'reduce' });
const errors = [];
const results = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

async function inspect(name) {
  const result = await page.evaluate((name) => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
    };
    const canvas = document.querySelector('canvas').getBoundingClientRect();
    return {
      name, viewport: [innerWidth, innerHeight], pageWidth: document.documentElement.scrollWidth,
      canvas: { width: canvas.width, height: canvas.height },
      smallControls: [...document.querySelectorAll('button, select, summary')].filter(visible).filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width < 43.9 || rect.height < 43.9;
      }).map((element) => element.textContent.trim()),
      panelOverflow: [...document.querySelectorAll('.workspace-rail, .workspace-time, .header-actions, .observatory-dialog-content')]
        .filter(visible).filter((element) => element.scrollWidth > element.clientWidth + 2).map((element) => element.className),
    };
  }, name);
  assert.ok(result.pageWidth <= result.viewport[0], `${name}: page overflow`);
  assert.deepEqual(result.smallControls, [], `${name}: small controls`);
  assert.deepEqual(result.panelOverflow, [], `${name}: panel overflow`);
  assert.ok(result.canvas.height >= 60, `${name}: scene lost its space`);
  results.push(result);
}

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.assetState === 'ready', null, { timeout: 120000 });
  await page.addScriptTag({ path: '../public/demos/iom-back.js' });
  assert.equal(await page.locator('#iom-back-link').getAttribute('href'), '/#experiments');
  assert.equal(await page.locator('#iom-back-link').evaluate((element) => getComputedStyle(element).position), 'static');
  await page.getByTestId('navigator-body-saturn').click();
  await page.waitForTimeout(1200);
  await page.locator('#workspace-objects').evaluate((element) => { element.scrollTop = 0; });
  await page.screenshot({ path: `${output}/desktop.png` });
  await inspect('desktop');

  for (const [width, height] of [[360, 800], [390, 844], [768, 1024], [844, 390], [667, 375]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(300);
    await inspect(`${width}x${height}-scene`);
    for (const name of ['objects', 'time', 'view', 'tools']) {
      await page.locator(`#toggle-${name}`).click();
      await page.waitForTimeout(200);
      await inspect(`${width}x${height}-${name}`);
      await page.locator(`#toggle-${name}`).click();
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#toggle-objects').click();
  await page.getByTestId('navigator-body-earth').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${output}/mobile.png` });
  await page.locator('#toggle-view').click();
  await page.screenshot({ path: `${output}/mobile-panel.png` });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${output}/landscape.png` });
  await page.locator('#toggle-tools').click();
  await page.screenshot({ path: `${output}/landscape-tools.png` });
  await page.locator('#toggle-tools').click();

  await page.setViewportSize({ width: 390, height: 600 });
  await inspect('shortened-mobile-browser-viewport');
  const information = page.locator('.canvas-topbar > summary');
  await information.focus();
  await page.keyboard.press('Space');
  assert.equal(await page.locator('.canvas-topbar').evaluate((element) => element.open), true);
  await page.locator('.canvas-quick-picks > summary').click();
  assert.equal(await page.locator('.canvas-topbar').evaluate((element) => element.open), false);
  await page.getByTestId('legend-body-mars').click();
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.selectedBody === 'mars');
  assert.deepEqual(errors, []);
  console.log(`PASS: ${results.length} layouts, Back link, dynamic viewport, keyboard disclosure and planet shortcuts; no console errors.`);
} finally {
  await writeFile(`${output}/final-verification.json`, JSON.stringify({ url, results, errors }, null, 2));
  await browser.close();
}
