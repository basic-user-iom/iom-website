import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';

const evidence = '../../evidence/placement-v5';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
await page.addInitScript(() => sessionStorage.setItem('building-viewer-demo-unlocked', '1'));
const views = [
  ['west1', [-160, 2.7, -39], [-164, 2.3, -20]],
  ['west2', [-160, 2.7, 27], [-164, 2.3, 13]],
  ['bt3', [-8, 3, -41], [-16, 2.5, -60]],
  ['foyer', [-90, 3, -88], [-88, 2.5, -67]],
];
try {
  await page.goto('http://127.0.0.1:5204');
  await page.waitForFunction(() => document.querySelector('.bv-loading')?.classList.contains('hidden'), {}, { timeout: 180000 });
  await page.waitForFunction(() => !window.__iomBuildingViewer.orbit.isAnimating());
  const cameras = [];
  for (const [name, position, target] of views) {
    await page.evaluate(({ position, target }) => {
      const v = window.__iomBuildingViewer;
      v.modelAnim.stop();
      v.orbit.setEnabled(false);
      v.camera.position.set(...position);
      v.orbit.controls.target.set(...target);
      v.camera.lookAt(...target);
      v.camera.fov = 50;
      v.camera.updateProjectionMatrix();
    }, { position, target });
    await page.waitForTimeout(500);
    const actual = await page.evaluate(() => window.__iomBuildingViewer.camera.position.toArray());
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(position[i] - actual[i]) < 1e-6, 'camera moved');
    cameras.push({ name, position, target, actual });
    await page.screenshot({ path: `${evidence}/glass-${name}-final-v5.png` });
  }
  const rows = await page.evaluate(() => {
    const root = window.__iomBuildingViewer.models.getLayer('icm-anim-2025').result.root;
    const result = [];
    root.traverse(o => {
      if (!o.isMesh) return;
      const names = [];
      for (let q = o; q; q = q.parent) names.push(q.name);
      if (!names.some(n => /^Verbindung[_ ]?West|^Glas00|^BT_3_Fassade|^Nord_Glass|^Fassade_Glass/.test(n))) return;
      result.push({ name: o.name, path: names.join('/'), glass: o.userData.glassSurface, renderOrder: o.renderOrder,
        mats: (Array.isArray(o.material) ? o.material : [o.material]).map(m => ({
          name: m.name, opacity: m.opacity, transparent: m.transparent, side: m.side,
          depthWrite: m.depthWrite, transmission: m.transmission,
        })),
      });
    });
    return result;
  });
  await writeFile(`${evidence}/glass-runtime-final-v5.json`, JSON.stringify(rows, null, 2));
  const before = JSON.parse(await readFile(`${evidence}/glass-runtime-materials.json`, 'utf8'));
  const changes = [];
  let glassChecked = 0;
  for (const old of before) {
    const row = rows.find(r => r.path.split('/').slice(1).join('/') === old.path.split('/').slice(1).join('/') && r.mats.some(m => old.mats.some(o => o.name === m.name)));
    assert.ok(row, `missing ${old.path}`);
    old.mats.forEach((mat, i) => {
      const current = row.mats[i];
      if (/paint/i.test(mat.name)) {
        assert.equal(current.opacity, 1);
        assert.equal(current.transparent, false);
        assert.equal(current.depthWrite, true);
        changes.push({ path: row.path, before: mat, after: current });
      } else if (/glass/i.test(mat.name)) {
        assert.deepEqual(current, mat, `actual glass changed: ${row.path}`);
        glassChecked++;
      }
    });
  }
  assert.equal(changes.length, 3);
  assert.ok(glassChecked >= 3);
  assert.deepEqual(errors, []);
  const report = { passed: true, changedPaintParts: changes.length, actualGlassUnchanged: glassChecked, rows: rows.length, changes, cameras, errors };
  await writeFile(`${evidence}/glass-browser-final-v5.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: true, changedPaintParts: changes.length, actualGlassUnchanged: glassChecked, rows: rows.length, errors }));
} finally {
  await browser.close();
}
