import { expect, test } from '@playwright/test';
import sharp from 'sharp';
test('shared camera survives a fresh session and PNG exports real pixels, names and context',async({page,browser},info)=>{
 test.setTimeout(120000);await page.emulateMedia({reducedMotion:'reduce'});await page.goto('./');await expect(page.getByTestId('startup-screen')).toBeHidden({timeout:60000});
 await page.getByTestId('planets-menu-toggle').click();await page.getByTestId('legend-body-earth').click();
 const canvas=page.getByTestId('solar-system-canvas');await expect(canvas).toHaveAttribute('data-camera-target','earth');
 await page.waitForTimeout(900);
 // User orbit creates a pose that cannot be reproduced by the default focus preset alone.
 const b=(await canvas.boundingBox())!;await page.mouse.move(b.x+b.width*.25,b.y+b.height*.3);await page.mouse.down();await page.mouse.move(b.x+b.width*.4,b.y+b.height*.4,{steps:8});await page.mouse.up();await page.waitForTimeout(500);
 await page.getByTestId('share-view').click();const input=page.getByTestId('shared-view-link');const url=await input.inputValue();const before=JSON.parse(decodeURIComponent(new URL(url).hash.slice(6)));
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('clipboard denied'))}}));
 await page.getByRole('button',{name:'Copy link',exact:true}).click();await expect(page.getByTestId('share-dialog').getByRole('status')).toContainText('Select and copy');
 expect(before.camera.selectedBodyId).toBe('earth');expect(before.camera.mode).toBe('free-orbit');
 await page.evaluate(()=>{const texts:string[]=[];(window as unknown as {exportTexts:string[]}).exportTexts=texts;const draw=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,x,y,max){texts.push(t);return max===undefined?draw.call(this,t,x,y):draw.call(this,t,x,y,max);};});
 await page.getByTestId('prepare-scene-image').click();const save=page.getByTestId('download-scene-image');await expect(save).toBeVisible();
 const downloadEvent=page.waitForEvent('download');await save.click();const download=await downloadEvent;const output=info.outputPath('export.png');await download.saveAs(output);
 const stats=await sharp(output).stats();expect(stats.channels.some(c=>c.stdev>10)).toBe(true);
 const texts=await page.evaluate(()=>(window as unknown as {exportTexts:string[]}).exportTexts);expect(texts.some(s=>s.includes('UTC '))).toBe(true);expect(texts.some(s=>s==='Earth')).toBe(true);expect(texts.some(s=>s.includes('True physical scale'))).toBe(true);
 await page.screenshot({path:info.outputPath('share-desktop.png')});
 await page.close();const context=await browser.newContext({reducedMotion:'reduce'});const other=await context.newPage();await other.goto(url);await expect(other.getByTestId('startup-screen')).toBeHidden({timeout:60000});
 await expect(other.locator('.shared-view-notice')).toContainText('Shared view opened');await other.locator('.shared-view-notice button').click();await other.waitForTimeout(500);
 await other.getByTestId('share-view').click();const after=JSON.parse(decodeURIComponent(new URL(await other.getByTestId('shared-view-link').inputValue()).hash.slice(6)));
 await info.attach('view-round-trip',{body:JSON.stringify({before,after},null,2),contentType:'application/json'});
 expect(after.utc).toBe(before.utc);expect(after.jdTdb).toBe(before.jdTdb);expect(after.scale).toBe(before.scale);expect(after.layers).toEqual(before.layers);
 for(const key of ['position','target','up'])for(let i=0;i<3;i++)expect(Math.abs(after.camera[key][i]-before.camera[key][i])).toBeLessThanOrEqual(Math.max(1e-13,Math.abs(before.camera[key][i])*1e-12));
 await other.getByRole('button',{name:'Close: Share & save view'}).click();
 for(const[width,height]of[[360,800],[390,844],[768,1024],[1366,768],[667,320]]){
  await other.setViewportSize({width:width!,height:height!});await other.getByTestId('share-view').click();
  expect(await other.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  const r=await other.getByTestId('share-dialog').boundingBox();expect(r!.x).toBeGreaterThanOrEqual(0);expect(r!.y).toBeGreaterThanOrEqual(0);expect(r!.y+r!.height).toBeLessThanOrEqual(height!+1);
  await other.getByRole('button',{name:'Close: Share & save view'}).click();
 }
 await other.setViewportSize({width:390,height:844});await other.getByTestId('learn-start').click();await other.getByTestId('learn-sizes').click();
 await other.getByTestId('share-view').click();await expect(other.getByTestId('shared-view-link')).toHaveCount(0);await other.getByTestId('prepare-scene-image').click();await expect(other.getByTestId('download-scene-image')).toBeVisible();
 await other.screenshot({path:info.outputPath('share-mobile.png')});await context.close();
});
test('invalid view links recover to an operable observatory',async({page})=>{
 test.setTimeout(90000);await page.goto('./#view=%7Bbad');await expect(page.getByTestId('startup-screen')).toBeHidden({timeout:60000});await expect(page.locator('.shared-view-notice')).toContainText('invalid');await expect(page.getByTestId('learn-start')).toBeEnabled();
});

test('shared links retain Saturn from Earth and Voyager inspection',async({page})=>{
 test.setTimeout(160000);await page.setViewportSize({width:1366,height:768});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('./');await expect(page.getByTestId('startup-screen')).toBeHidden({timeout:60000});
 for(const target of ['saturn-from-earth','voyager-1']){
  if(target==='saturn-from-earth')await page.getByTestId('camera-preset-saturn-from-earth').click();
  else{await page.locator('#body-search').fill('Voyager 1');await page.getByTestId('navigator-catalog-spacecraft-voyager-1').click();}
  await page.waitForTimeout(750);await page.getByTestId('share-view').click();
  const url=await page.getByTestId('shared-view-link').inputValue();const before=JSON.parse(decodeURIComponent(new URL(url).hash.slice(6)));
  await page.goto(url);await expect(page.getByTestId('startup-screen')).toBeHidden({timeout:60000});await expect(page.locator('.shared-view-notice')).toContainText('Shared view opened');await page.getByRole('button',{name:'Dismiss shared view message'}).click();await page.waitForTimeout(500);
  await page.getByTestId('share-view').click();const after=JSON.parse(decodeURIComponent(new URL(await page.getByTestId('shared-view-link').inputValue()).hash.slice(6)));
  expect(after.camera.mode).toBe(before.camera.mode);expect(after.camera.closeUpPresetId).toBe(before.camera.closeUpPresetId);expect(after.auxiliary).toEqual(before.auxiliary);
  for(const key of ['position','target','up'])for(let i=0;i<3;i++)expect(Math.abs(after.camera[key][i]-before.camera[key][i])).toBeLessThanOrEqual(Math.max(1e-13,Math.abs(before.camera[key][i])*1e-12));
  await page.getByRole('button',{name:'Close: Share & save view'}).click();
 }
});

test('a shared date remains readable without WebGL and image export explains its limit',async({page})=>{
 test.setTimeout(90000);
 await page.addInitScript(()=>{Object.assign(window,{shareGraphicsBlocked:true});const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,options?:unknown){return type==='webgl2'&&(window as unknown as {shareGraphicsBlocked:boolean}).shareGraphicsBlocked?null:Reflect.apply(get,this,[type,options]);} as typeof get;});
 const {dateUtcToApproximateTdb}=await import('../src/simulation/core/JulianDate');
 const view={version:1,utc:'2026-06-21T12:00:00.000Z',jdTdb:dateUtcToApproximateTdb(new Date('2026-06-21T12:00:00.000Z')),scale:'true',camera:{selectedBodyId:'earth',mode:'free-orbit',closeUpPresetId:null,position:[0,.001,.002],target:[0,0,0],up:[0,1,0]},origin:[0,0,0],originBodyId:'sun',layers:{orbitLinesVisible:true,bodyLabelsVisible:true,skyBackgroundVisible:true,brightStarsVisible:true,cometsVisible:true,asteroidBeltVisible:false,kuiperBeltVisible:false},venus:'clouds',auxiliary:{moonId:null,spaceObjectId:null}};
 await page.goto('./#view='+encodeURIComponent(JSON.stringify(view)));await expect(page.getByTestId('startup-screen')).toBeHidden({timeout:60000});
 await expect(page.getByTestId('data-mode-panel')).toContainText('2026-06-21');await expect(page.getByLabel('Set UTC date')).toHaveValue(/^2026-06-21/);await expect(page.locator('.shared-view-notice')).toContainText('Shared view opened');
 await page.getByTestId('share-view').click();await expect(page.getByTestId('prepare-scene-image')).toBeDisabled();await expect(page.getByTestId('share-dialog')).toContainText('image needs an available 3D renderer');
 await page.getByRole('button',{name:'Close: Share & save view'}).click();
 await page.getByTestId('data-body-select').selectOption('venus');
 await page.getByLabel('Set UTC date').fill('2026-10-05T12:00');await page.getByRole('button',{name:'Update data',exact:true}).click();
 await page.evaluate(()=>{(window as unknown as {shareGraphicsBlocked:boolean}).shareGraphicsBlocked=false;});await page.getByTestId('retry-graphics').click();
 await expect(page.getByTestId('data-mode-panel')).toBeHidden({timeout:60000});await expect(page.getByTestId('solar-system-canvas')).toHaveAttribute('data-camera-target','venus');
 await page.getByTestId('share-view').click();const latest=JSON.parse(decodeURIComponent(new URL(await page.getByTestId('shared-view-link').inputValue()).hash.slice(6)));expect(latest.utc).toContain('2026-10-05');expect(latest.camera.selectedBodyId).toBe('venus');
});
