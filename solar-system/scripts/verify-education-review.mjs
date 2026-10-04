/* global HTMLCanvasElement, document, innerWidth, innerHeight */
import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';

const baseUrl = process.env.SOLAR_SYSTEM_REVIEW_URL ?? 'http://127.0.0.1:5198/demos/solar-system/';
const out = process.env.REVIEW_OUTPUT_DIR ?? 'tmp/education';
const viewports = JSON.parse(process.env.REVIEW_VIEWPORTS ?? '[[1366,768],[768,1024],[360,800],[390,844],[844,390]]');
await mkdir(out, { recursive: true });
const rows = [];
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch();
  try {
    for (const blocked of [false, true]) for (const [width, height] of viewports) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 1000, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      // Preservation is for WebKit screenshot readback only, never a production change.
      await page.addInitScript(({ blocked, preserve }) => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, options) {
          if (type === 'webgl2') {
            if (blocked) return null;
            if (preserve) options = { ...options, preserveDrawingBuffer: true };
          }
          return original.call(this, type, options);
        };
      }, { blocked, preserve: name === 'webkit' });
      await page.goto(baseUrl);
      await page.waitForFunction(() => {
        const b = document.querySelector('[data-testid="learn-start"]');
        return b && !b.disabled && !document.querySelector('[data-testid="startup-screen"]');
      }, null, { timeout: 90000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (blocked) await page.screenshot({ path: `${out}/${name}-fallback-${width}x${height}.png` });
      for (const [id, steps] of [['sizes', 7], ['seasons', 5], ['moon', 6]]) {
        await page.getByTestId('learn-start').click();
        const picker = page.getByTestId('lesson-picker');
        await picker.waitFor();
        assert.equal(await picker.evaluate(p => p.contains(document.activeElement)), true);
        if (id === 'sizes') await page.screenshot({ path: `${out}/${name}-picker-${width}x${height}.png` });
        await page.getByTestId(`learn-${id}`).click();
        await page.getByTestId('lesson-panel').waitFor();
        const audit = () => page.evaluate(() => {
          const panel = document.querySelector('.lesson-panel');
          const box = panel.getBoundingClientRect();
          const buttons = [...document.querySelectorAll('.lesson-navigation button,[data-testid="lesson-exit"]')].filter(b => b.getClientRects().length > 0);
          return { unreadable: panel.querySelector('.lesson-scroll').clientHeight < 60, overflow: document.documentElement.scrollWidth > innerWidth,
            outside: box.x < 0 || box.right > innerWidth + 1 || box.y < 0 || box.bottom > innerHeight + 1,
            badButtons: buttons.flatMap(b => { const r = b.getBoundingClientRect(); return r.width < 44 || r.height < 44 || r.x < 0 || r.right > innerWidth + 1 || r.y < 0 || r.bottom > innerHeight + 1 ? [{ text: b.textContent, rect: r.toJSON() }] : []; }) };
        });
        const verifyLayout = async () => {
          const result = await audit();
          assert.deepEqual(result, { unreadable: false, overflow: false, outside: false, badButtons: [] }, JSON.stringify({ name, blocked, width, height, id, result }));
        };
        await verifyLayout();
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${out}/${name}-${blocked ? 'text' : '3d'}-${id}-${width}x${height}.png` });
        if (id !== 'sizes') {
          await page.getByTestId(id === 'moon' ? 'moon-readout' : 'season-readout').scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${out}/${name}-${blocked ? 'text' : '3d'}-${id}-measurements-${width}x${height}.png` });
        }
        if (name === 'webkit' && !blocked) {
          const encoded = await page.locator('canvas').evaluate(c => c.toDataURL('image/png').split(',')[1]);
          await writeFile(`${out}/webkit-canvas-${id}-${width}x${height}.png`, Buffer.from(encoded, 'base64'));
        }
        await page.getByRole('button', { name: 'Previous', exact: true }).click();
        for (let i = 0; i < steps - 1; i++) await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.getByTestId('lesson-answer-0-1').click();
        await page.getByTestId('lesson-answer-1-0').click();
        assert.equal(await page.getByRole('status').filter({ hasText: 'Correct.' }).count(), 2);
        await page.getByTestId('viewport-fullscreen-toggle').click();
        await verifyLayout();
        await page.getByRole('button', { name: 'Previous', exact: true }).click();
        await page.getByTestId('lesson-exit').click();
        await page.getByTestId('lesson-panel').waitFor({ state: 'hidden' });
        await page.getByTestId('viewport-fullscreen-toggle').click();
        await page.getByTestId('learn-start').click();
        await page.getByTestId(`learn-${id}`).click();
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.getByRole('button', { name: 'Restart', exact: true }).click();
        await page.setViewportSize({ width: width === 360 ? 390 : Math.max(320, width - 20), height });
        await verifyLayout();
        await page.getByTestId('lesson-exit').click();
        await page.setViewportSize({ width, height });
        const row = { browser: name, version: browser.version(), blocked, width, height, lesson: id, passed: true, errors };
        rows.push(row); console.log(JSON.stringify(row));
        assert.deepEqual(errors, []);
      }
      await page.close();
    }
  } finally { await browser.close(); }
}
await writeFile(`${out}/browser-matrix.json`, JSON.stringify(rows, null, 2));
