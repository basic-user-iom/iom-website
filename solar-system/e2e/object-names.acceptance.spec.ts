import { expect, test } from '@playwright/test';
test.use({viewport:{width:390,height:844},hasTouch:true});
test('compact names prefer Earth over its unresolved Moon; master switch preserves bodies and dots',async({page}, testInfo)=>{
 test.setTimeout(120000);await page.emulateMedia({reducedMotion:'reduce'});await page.goto('./');
 await expect(page.getByTestId('startup-screen')).toBeHidden({timeout:60000});
 await page.getByTestId('planets-menu-toggle').tap();await page.getByTestId('legend-body-sun').tap();await page.getByTestId('system-overview').tap();
 const c=page.getByTestId('solar-system-canvas');const box=(await c.boundingBox())!;
 await page.mouse.move(box.x+box.width*.15,box.y+box.height*.15);
 await page.keyboard.down('Shift');for(let i=0;i<10;i++){if(testInfo.project.use.isMobile){
   // Mobile WebKit has no native wheel automation; this only arranges the test view.
   await c.dispatchEvent('wheel',{deltaY:-140,deltaMode:0,shiftKey:true,clientX:box.x+box.width*.15,clientY:box.y+box.height*.15,bubbles:true,cancelable:true});
  }else await page.mouse.wheel(0,-140);await page.waitForTimeout(250);if(await page.getByTestId('body-label-earth').isVisible())break;}await page.keyboard.up('Shift');
 await expect(page.getByTestId('body-label-earth')).toBeVisible();
 await expect(page.getByTestId('body-label-moon')).toBeHidden();
 const all=await page.locator('.body-screen-label').evaluateAll(es=>es.filter(e=>getComputedStyle(e).visibility==='visible').map(e=>({id:(e as HTMLElement).dataset.bodyId,rect:e.getBoundingClientRect().toJSON(),bg:getComputedStyle(e).backgroundColor})));
 for(let i=0;i<all.length;i++){
  expect(all[i]!.bg).toBe('rgba(0, 0, 0, 0)');const a=all[i]!.rect;expect(a.width).toBeGreaterThanOrEqual(44);expect(a.height).toBeGreaterThanOrEqual(44);
  for(let j=i+1;j<all.length;j++){const b=all[j]!.rect;expect(a.left>=b.right||a.right<=b.left||a.top>=b.bottom||a.bottom<=b.top).toBe(true);}
 }
 await page.screenshot({path:'tmp/labels/'+testInfo.project.name+'-mobile-after.png'});
 const toggle=page.getByTestId('object-names-toggle');await toggle.tap();await expect(toggle).toHaveAttribute('aria-pressed','false');
 await expect(page.getByTestId('body-label-earth')).toBeHidden();
 expect(await page.locator('.natural-satellite-screen-label,.space-object-screen-label').evaluateAll(es=>es.every(e=>getComputedStyle(e).visibility==='hidden'))).toBe(true);
 await expect(page.getByTestId('body-location-earth')).toHaveCSS('opacity','1');
 await page.screenshot({path:'tmp/labels/'+testInfo.project.name+'-mobile-names-off.png'});
 await page.reload();await expect(page.getByTestId('startup-screen')).toBeHidden({timeout:60000});await expect(toggle).toHaveAttribute('aria-pressed','false');
 await toggle.focus();await page.keyboard.press('Enter');await expect(toggle).toHaveAttribute('aria-pressed','true');
 await page.locator('#toggle-objects').tap();await expect(page.getByLabel('Screen-space labels',{exact:true})).toBeChecked();await page.getByRole('button',{name:'Close objects',exact:true}).tap();
 await page.locator('#toggle-view').tap();await page.getByTestId('camera-earth-moon-system').tap();await page.getByRole('button',{name:'Close view',exact:true}).tap();
 await expect(page.getByTestId('body-label-moon')).toBeVisible();await page.getByTestId('body-label-moon').locator('span').tap();
 await expect(c).toHaveAttribute('data-camera-target','moon');
 await page.getByTestId('body-label-moon').focus();await page.keyboard.press('Enter');await expect(c).toHaveAttribute('data-camera-target','moon');
 for(const [width,height] of [[320,568],[360,800],[768,1024],[1366,768],[844,390]]){
  await page.setViewportSize({width:width!,height:height!});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  const rects=await page.locator('.viewport-toolbar > button').evaluateAll(es=>es.filter(e=>e.getClientRects().length>0).map(e=>e.getBoundingClientRect().toJSON()));
  for(let i=0;i<rects.length;i++){
   const a=rects[i]!;expect(a.width).toBeGreaterThanOrEqual(44);expect(a.height).toBeGreaterThanOrEqual(44);expect(a.x).toBeGreaterThanOrEqual(0);expect(a.right).toBeLessThanOrEqual(width!);
   for(let j=i+1;j<rects.length;j++){const b=rects[j]!;expect(a.left>=b.right||a.right<=b.left||a.top>=b.bottom||a.bottom<=b.top).toBe(true);}
  }
 }
});
