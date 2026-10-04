import { expect, test } from '@playwright/test';
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
test('lesson restores UTC, time settings, selection, scale and the camera after exit and re-entry', async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  const canvas=page.getByTestId('solar-system-canvas');
  await expect(canvas).toHaveAttribute('data-asset-state','ready',{timeout:60_000});
  await expect(page.getByTestId('startup-screen')).toBeHidden();
  await page.locator('#toggle-view').tap();
  await page.getByRole('button',{name:'Presentation',exact:true}).tap();
  await page.getByRole('button',{name:'Close view',exact:true}).tap();
  await page.locator('#toggle-time').tap();
  await page.locator('#exact-utc-time').fill('2026-06-21T12:00');
  await page.getByRole('button',{name:'Set UTC',exact:true}).tap();
  await page.locator('#time-preset').selectOption({label:'60x'});
  await page.getByRole('button',{name:'Pause simulation',exact:true}).tap();
  await page.getByRole('button',{name:'Reverse',exact:true}).tap();
  await page.getByRole('button',{name:'Close time controls'}).tap();
  await page.getByTestId('planets-menu-toggle').tap();await page.getByTestId('legend-body-saturn').tap();
  await expect(canvas).toHaveAttribute('data-camera-target','saturn');
  await page.waitForTimeout(400);
  const capture=()=>page.evaluate(()=>{
    const c=document.querySelector('canvas')!;
    return{date:(document.querySelector('#exact-utc-time') as HTMLInputElement).value,
      paused:document.querySelector('[aria-label="Run simulation"]')!==null,
      speed:document.querySelector('output[for="log-speed"]')?.textContent,
      direction:document.querySelector('[data-direction]')?.getAttribute('data-direction'),
      selected:c.dataset.cameraTarget,
      scale:document.querySelector('[data-testid="render-scale-controls"] [aria-pressed="true"]')?.textContent,
      mode:(document.querySelector('[data-testid="camera-mode-select"]') as HTMLSelectElement).value,
      position:c.dataset.cameraPosition,target:c.dataset.cameraWorldTarget};
  });
  const before=await capture();
  await page.getByTestId('learn-start').tap();await page.getByTestId('learn-sizes').tap();
  await page.getByRole('button',{name:'Play time · 1 day/s',exact:true}).tap();
  await expect(page.getByTestId('lesson-panel')).toContainText('Teaching playback');
  await page.waitForTimeout(500);
  await page.getByRole('button',{name:'Pause time',exact:true}).tap();
  await expect(page.getByTestId('lesson-panel')).toContainText('Lesson time paused');
  for(let i=0;i<6;i++)await page.getByRole('button',{name:'Next',exact:true}).tap();
  await page.getByTestId('lesson-answer-0-0').tap();await expect(page.getByTestId('lesson-panel')).toContainText('Not quite.');
  await page.getByTestId('lesson-answer-0-1').tap();await page.getByTestId('lesson-answer-1-0').tap();
  await page.getByTestId('viewport-fullscreen-toggle').tap();await page.getByTestId('lesson-exit').tap();await page.getByTestId('viewport-fullscreen-toggle').tap();
  await page.waitForTimeout(500);
  const after=await capture();console.log(JSON.stringify({before,after}));
  expect(after).toEqual(before);
  expect(before.selected).toBe("saturn");
  await page.getByTestId('learn-start').tap();await page.getByTestId('learn-sizes').tap();await page.getByRole('button',{name:'Next',exact:true}).tap();await page.getByRole('button',{name:'Restart',exact:true}).tap();
  await expect(page.getByTestId('lesson-step-title')).toHaveText('One system, two kinds of scale');
  await page.getByTestId('lesson-exit').tap();
  await page.locator('#toggle-time').tap();
  await page.getByRole('button',{name:'Run simulation',exact:true}).tap();
  await page.getByRole('button',{name:'Close time controls'}).tap();
  await page.getByTestId('learn-start').tap();await page.getByTestId('learn-sizes').tap();
  await page.getByTestId('lesson-exit').tap();
  await expect(page.getByRole('button',{name:'Pause simulation',exact:true,includeHidden:true})).toHaveCount(1);
  expect(await page.locator('output[for="log-speed"]').textContent()).toBe(before.speed);
});

test('lesson restores close spacecraft and moon inspection with their navigation bounds', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expect(page.getByTestId('startup-screen')).toBeHidden({ timeout: 60_000 });
  const canvas = page.getByTestId('solar-system-canvas');
  const capture = () => canvas.evaluate(c => ({ position: c.dataset.cameraPosition, target: c.dataset.cameraWorldTarget, trackedBody: c.dataset.cameraTarget, spacecraft: c.dataset.spaceObjectDetailedInspection, moon: c.dataset.naturalSatelliteSelected, ratio: c.dataset.spaceObjectFocusDistanceRatio }));
  for (const [search, id] of [['Voyager 1', 'spacecraft-voyager-1'], ['Io', 'natural-satellite-io']]) {
    await page.locator('#body-search').fill(search!);
    await page.getByTestId('navigator-catalog-' + id).click();
    await page.waitForTimeout(800);
    const before = await capture();
    await page.getByTestId('learn-start').click();await page.getByTestId('learn-sizes').click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByTestId('lesson-exit').click();
    await page.waitForTimeout(700);
    expect(await capture()).toEqual(before);
    if (search === 'Voyager 1') {
      await expect(canvas).toHaveAttribute('data-space-object-detailed-inspection', 'voyager-1');
      const b = (await canvas.boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.wheel(0, -200);
      await expect.poll(async () => Number(await canvas.getAttribute('data-space-object-focus-distance-ratio'))).toBeLessThan(Number(before.ratio));
    } else await expect(canvas).toHaveAttribute('data-natural-satellite-selected-on-screen', 'true');
  }
});
