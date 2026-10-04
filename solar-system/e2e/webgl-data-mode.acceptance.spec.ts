import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
for (const failure of ['capability', 'renderer'] as const) {
 test(`WebGL ${failure} failure leaves data and lessons usable; retries clean up`, async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let binaryRequests = 0;
  page.on('request', r => { if (r.url().includes('ephemeris.v1') && r.url().includes('.bin')) binaryRequests++; });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(failure => {
    const diagnostics = { blocked: true, frameHandles: new Set<number>(), listeners: [] as {target: EventTarget; type: string; listener: EventListenerOrEventListenerObject | null}[] };
    Object.assign(window, { graphicsTest: diagnostics });
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(this: HTMLCanvasElement, type: string, options?: unknown) {
      if (type === 'webgl2' && diagnostics.blocked && (failure==='capability' || this.dataset.testid==='solar-system-canvas')) return null;
      return Reflect.apply(original, this, [type, options]);
    } as typeof original;
    const raf=window.requestAnimationFrame.bind(window), cancel=window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame=callback=>{ const id=raf(t=>{diagnostics.frameHandles.delete(id);callback(t);});diagnostics.frameHandles.add(id);return id; };
    window.cancelAnimationFrame=id=>{diagnostics.frameHandles.delete(id);cancel(id);};
    const add=EventTarget.prototype.addEventListener, remove=EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener=function(type,listener,options){
      if((this===window||this===document)&&['pointermove','pointerup','pointercancel','visibilitychange','resize'].includes(type)&&!diagnostics.listeners.some(l=>l.target===this&&l.type===type&&l.listener===listener))diagnostics.listeners.push({target:this,type,listener});
      add.call(this,type,listener,options);
    };
    EventTarget.prototype.removeEventListener=function(type,listener,options){diagnostics.listeners=diagnostics.listeners.filter(l=>l.target!==this||l.type!==type||l.listener!==listener);remove.call(this,type,listener,options);};
  },failure);
  await page.goto('./');
  await expect(page.getByTestId('data-mode-panel')).toBeVisible({timeout:60_000});
  await expect(page.getByTestId('startup-screen')).toBeHidden();
  await expect(page.locator('#iom-back-link')).toBeVisible();
  await expect(page.getByTestId('learn-start')).toBeEnabled({timeout:60_000});
  const requestBaseline=binaryRequests;
  const metrics=()=>page.evaluate(()=>{const d=(window as unknown as {graphicsTest:{frameHandles:Set<number>;listeners:unknown[]}}).graphicsTest;return {raf:d.frameHandles.size,listeners:d.listeners.length};});
  const baseline=await metrics();expect(baseline.raf).toBe(0);
  await page.getByTestId('data-body-select').selectOption('jupiter');
  await expect(page.getByTestId('data-mode-panel')).toContainText('69,911 km');
  await expect(page.getByTestId('system-overview')).toBeDisabled();
  await page.getByTestId('learn-start').tap();await page.getByTestId('learn-sizes').tap();
  for(let i=0;i<6;i++)await page.getByRole('button',{name:'Next',exact:true}).tap();
  await page.getByTestId('lesson-answer-0-1').tap();await page.getByTestId('lesson-answer-1-0').tap();
  await page.getByTestId('lesson-exit').tap();
  for(let i=0;i<3;i++){
    await page.getByTestId('retry-graphics').tap();
    await expect(page.getByTestId('retry-graphics')).toBeEnabled();
    await expect.poll(metrics).toEqual(baseline);
  }
  expect(binaryRequests).toBe(requestBaseline);
  await page.evaluate(()=>{(window as unknown as {graphicsTest:{blocked:boolean}}).graphicsTest.blocked=false;});
  await page.getByTestId('retry-graphics').tap();
  await expect(page.getByTestId('data-mode-panel')).toBeHidden({timeout:30_000});
  await expect(page.getByTestId('solar-system-canvas')).toHaveAttribute('data-asset-state', 'ready',{timeout:60_000});
  await expect(page.getByTestId('startup-screen')).toBeHidden();
  await expect.poll(async()=>(await metrics()).raf).toBe(1);
  expect(errors).toEqual([]);
 });
}

test('catalog facts and text lesson survive an independent orbital-data download failure', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, options?: unknown) {
      return type === 'webgl2' ? null : Reflect.apply(original, this, [type, options]);
    } as typeof original;
  });
  await page.route('**/*ephemeris.v1*.bin', route => route.abort('failed'));
  await page.goto('./');
  await expect(page.getByTestId('startup-screen')).toBeHidden();
  await expect(page.getByTestId('data-mode-panel')).toContainText('Orbital data unavailable');
  await expect(page.getByRole('button', { name: 'Update data', exact: true })).toBeDisabled();
  await page.getByTestId('data-body-select').selectOption('earth');
  await expect(page.getByTestId('data-mode-panel')).toContainText('6,371.008 km');
  await page.getByTestId('learn-start').tap();await page.getByTestId('learn-sizes').tap();
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Next', exact: true }).tap();
  await expect(page.getByTestId('lesson-panel')).toContainText('Data unavailable');
  await page.getByTestId('lesson-exit').tap();
  await expect(page.getByTestId('data-mode-panel')).toBeVisible();
});
