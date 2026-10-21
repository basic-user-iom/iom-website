import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root=path.resolve(import.meta.dirname,'..');
const qa=process.env.MOBO_QA||path.join(root,'qa');
await mkdir(qa,{recursive:true});
const expected=JSON.parse(await readFile(path.join(root,'app/public/assets/finish-materials.json'),'utf8')).finishes;
const channel=process.env.MOBO_BROWSER_CHANNEL;
const browser=await chromium.launch({headless:true,...(channel?{channel}:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']})});
const graphics=channel?`Playwright ${channel}, local WebGL`:'Playwright Chromium, SwiftShader';
const results=[];
const url=process.env.MOBO_URL||'http://127.0.0.1:5284';
const snapshot=p=>p.evaluate(()=>window.__moboStudy());
const ready=async p=>{await p.waitForFunction(()=>window.__moboStudy?.().phase==='ready');if(await p.evaluate(()=>window.__moboStudy().viewMode==='room'))await p.locator('#view-toggle').click();};
const fallback=p=>p.waitForFunction(()=>window.__moboStudy?.().phase==='fallback');
const paint=p=>p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const settle=async p=>{await p.waitForFunction(()=>{const v=window.__moboStudy().viewer;return v.illumination.settling===false&&!v.finishTransition?.active;},{},{timeout:6000});await paint(p);};
const shot=async(p,name)=>{await paint(p);await p.screenshot({path:path.join(qa,name+'.png'),fullPage:true});};
const test=async(name,fn)=>{try{const detail=await fn();results.push({name,status:'passed',detail});console.log('PASS',name);}catch(error){results.push({name,status:'failed',detail:String(error.stack)});console.log('FAIL',name,String(error));}};
const compareFixed=(a,b)=>{for(const name of ['Ceramic_Interior','Bulb_Illustrative'])assert.deepEqual(a.viewer.materials[name],b.viewer.materials[name],name);};
const match=async(p,finish,lit)=>{
 await settle(p);
 const s=await snapshot(p),m=s.viewer.materials.Ceramic_Exterior,source=finish.actualExportedMaterial;
 assert.equal(s.state.finish,finish.id);assert.equal(s.state.lit,lit);
 assert.deepEqual(m.color,source.pbrMetallicRoughness.baseColorFactor.slice(0,3));
 assert.equal(m.roughness,source.pbrMetallicRoughness.roughnessFactor);
 assert.equal(m.metalness,source.pbrMetallicRoughness.metallicFactor);
 assert.equal(m.clearcoat,source.extensions.KHR_materials_clearcoat.clearcoatFactor);
 assert.equal(m.clearcoatRoughness,source.extensions.KHR_materials_clearcoat.clearcoatRoughnessFactor);
 assert.deepEqual(m.normalScale,[source.normalTexture.scale,-source.normalTexture.scale]);
 assert.equal(m.opacity,1);assert.equal(m.transparent,false);assert.equal(m.transmission,0);assert.deepEqual(m.emissive,[0,0,0]);
 assert.equal(s.viewer.light.intensity>0,lit);
 assert.deepEqual(s.viewer.light.position,[0,-.44915664196014404,0]);
 assert(s.viewer.light.target[1]<s.viewer.light.position[1]);
 return s;
};
const posterMatches=async(p,id,lit)=>{
 const img=p.locator('#poster');await img.waitFor({state:'visible'});
 await p.waitForFunction(({id,lit})=>{const i=document.querySelector('#poster');return i.complete&&i.naturalWidth===1024&&i.src.endsWith(`${id}-${lit?'lit':'unlit'}.webp`);},{id,lit});
 assert((await img.getAttribute('alt')).includes(lit?'Light on':'Light off'));
};
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
const errors=[],external=[],modelRequests=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>{if(r.url().endsWith('mobo-study.glb'))modelRequests.push(r.url());if(!r.url().startsWith(url)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
try {
 await test('Initial load: one local GLB, Shell White / Light off',async()=>{await page.goto(url);await ready(page);await match(page,expected[0],false);assert.equal(modelRequests.length,1);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);return {graphics,modelRequests:1};});
 const initial=await snapshot(page);
 await test('All six combinations: exact material data, fixed materials, stable camera, visible light change',async()=>{
  const pixelDifferences=[];
  for(const finish of expected){
   await page.getByRole('button',{name:finish.label,exact:true}).click();
   const buffers=[];
   for(const lit of [false,true]){
    await page.getByRole('button',{name:lit?'Light on':'Light off',exact:true}).click();await paint(page);
    const s=await match(page,finish,lit);compareFixed(initial,s);assert.deepEqual(s.viewer.camera,initial.viewer.camera);
    buffers.push(await page.locator('#stage').screenshot());
    await shot(page,`desktop-${finish.id}-${lit?'lit':'unlit'}`);
   }
   const a=await sharp(buffers[0]).raw().toBuffer(),b=await sharp(buffers[1]).raw().toBuffer();
   let changed=0;for(let i=0;i<a.length;i++)if(Math.abs(a[i]-b[i])>3)changed++;
   assert(changed>200,'Light must change actual rendered pixels');pixelDifferences.push({finish:finish.id,changedChannels:changed});
  }
  assert.equal(modelRequests.length,1);return pixelDifferences;
 });
 await test('Rapid repeated finish and light changes converge to latest selection',async()=>{
  await page.evaluate(()=>{for(let i=0;i<75;i++){document.querySelectorAll('[data-finish]')[i%3].click();document.querySelectorAll('[data-light]')[i%2].click();}document.querySelector('[data-finish="burnt-orange"]').click();document.querySelector('[data-light="lit"]').click();});
  await paint(page);const s=await match(page,expected[1],true);compareFixed(initial,s);assert.equal(modelRequests.length,1);
 });
 await test('Mouse orbit, finish change preserves camera, zoom, clamps and reset',async()=>{
  const box=await page.locator('canvas').boundingBox();
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.53,{steps:8});await page.mouse.up();
  const orbited=await snapshot(page);assert.notDeepEqual(orbited.viewer.camera.position,initial.viewer.camera.position);
  await page.getByRole('button',{name:expected[2].label,exact:true}).click();assert.deepEqual((await snapshot(page)).viewer.camera,orbited.viewer.camera);
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();assert((await snapshot(page)).viewer.camera.zoom>1);
  await page.evaluate(()=>{for(let i=0;i<40;i++){document.querySelector('[data-camera="in"]').click();document.querySelector('[data-camera="right"]').click();}});
  let camera=(await snapshot(page)).viewer.camera;assert(camera.zoom<=1.25);assert(camera.azimuth<=.950001);assert(camera.polar>=1.2&&camera.polar<=1.49);
  await page.getByRole('button',{name:'Reset',exact:true}).click();camera=(await snapshot(page)).viewer.camera;
  assert(Math.abs(camera.zoom-initial.viewer.camera.zoom)<1e-8);assert(camera.position.every((n,i)=>Math.abs(n-initial.viewer.camera.position[i])<1e-8));
 });
 await test('Keyboard only: tab, pressed state, focus ring, camera keys and reset',async()=>{
  await page.locator('canvas').focus();
  assert.equal(await page.evaluate(()=>document.activeElement.tagName),'CANVAS');
  const before=await snapshot(page);await page.keyboard.press('ArrowLeft');await page.keyboard.press('+');assert.notDeepEqual((await snapshot(page)).viewer.camera,before.viewer.camera);
  await page.keyboard.press('Home');await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.finish),'shell-white');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'solid');
  await page.keyboard.press('Tab');await page.keyboard.press('Enter');assert.equal((await snapshot(page)).state.finish,'burnt-orange');
  assert.equal(await page.getByRole('button',{name:expected[1].label,exact:true}).getAttribute('aria-pressed'),'true');
 });
 await test('Switches during delayed initial loading apply the latest state',async()=>{
  const p=await context.newPage();let release;const gate=new Promise(r=>release=r);
  await p.route('**/mobo-study.glb',async route=>{await gate;await route.continue();});
  await p.goto(url);await p.getByRole('button',{name:expected[2].label,exact:true}).click();await p.getByRole('button',{name:'Light on',exact:true}).click();
  assert.equal((await snapshot(p)).phase,'loading');await posterMatches(p,'midnight-green',true);
  release();await ready(p);await match(p,expected[2],true);await p.close();
 });
 await test('Reduced motion, capped DPR, no rendering while idle',async()=>{
  const c=await browser.newContext({reducedMotion:'reduce',deviceScaleFactor:3,viewport:{width:390,height:844}});const p=await c.newPage();await p.goto(url);await ready(p);await settle(p);
  const before=await snapshot(p);await p.waitForTimeout(650);const after=await snapshot(p);
  assert.equal(after.viewer.renders,before.viewer.renders);assert.equal(after.viewer.autoRotate,false);assert.equal(after.viewer.damping,false);assert(after.viewer.pixelRatio<=1.75);assert.deepEqual(before.viewer.camera,after.viewer.camera);
  await c.close();return {idleFrames:after.viewer.renders-before.viewer.renders,pixelRatio:after.viewer.pixelRatio};
 });
 await test('Mobile portrait, narrow portrait and landscape layout; touch tap, drag, pinch; outside scroll',async()=>{
  const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});const p=await c.newPage();await p.goto(url);await ready(p);
  const cdp=await c.newCDPSession(p);
  const layout=async()=>{
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
   const a=await p.locator('#stage').boundingBox(),b=await p.locator('.controls').boundingBox();
   assert(a.x+a.width<=b.x+1||a.y+a.height<=b.y+1,'Stage and controls must not overlap');
  };
  await layout();await p.getByRole('button',{name:expected[1].label,exact:true}).tap();await p.getByRole('button',{name:'Light on',exact:true}).tap();await match(p,expected[1],true);
  const before=await snapshot(p);const box=await p.locator('canvas').boundingBox();const x=box.x+box.width/2,y=box.y+box.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=5;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+i*10,y:y+i*2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.notDeepEqual((await snapshot(p)).viewer.camera.position,before.viewer.camera.position);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-30,y,id:1},{x:x+30,y,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-60,y,id:1},{x:x+60,y,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert((await snapshot(p)).viewer.camera.zoom>before.viewer.camera.zoom);
  await p.getByRole('button',{name:'Reset',exact:true}).tap();await shot(p,'mobile-portrait');
  await p.setViewportSize({width:320,height:740});await layout();await shot(p,'mobile-narrow');
  await p.setViewportSize({width:320,height:600});await p.evaluate(()=>scrollTo(0,0));
  // Keep the gesture well away from the canvas: Chromium touch adjustment snaps the old 5px edge to it.
  await paint(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:160,y:200}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:160,y:50}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(300);assert(await p.evaluate(()=>scrollY>0),'Scroll outside canvas remains available');
  await p.setViewportSize({width:844,height:390});await p.evaluate(()=>scrollTo(0,0));await layout();await shot(p,'mobile-landscape');await c.close();
  return {viewports:['390x844','320x740','844x390'],touch:'Chromium CDP emulation; not a physical phone'};
 });
 await test('Missing GLB: all six matching fallback posters and disabled camera',async()=>{
  const p=await context.newPage();await p.route('**/mobo-study.glb',r=>r.fulfill({status:404,body:'not found'}));await p.goto(url);await fallback(p);
  for(const f of expected)for(const lit of [false,true]){await p.getByRole('button',{name:f.label,exact:true}).click();await p.getByRole('button',{name:lit?'Light on':'Light off',exact:true}).click();await posterMatches(p,f.id,lit);}
  assert(await p.getByRole('button',{name:'Reset',exact:true}).isDisabled());await shot(p,'fallback-missing-model');
  await p.unroute('**/mobo-study.glb');await p.getByRole('button',{name:'Retry 3D view',exact:true}).click();await ready(p);await match(p,expected[2],true);await p.close();
 });
 await test('WebGL unavailable: correct selectable posters',async()=>{
  const p=await context.newPage();await p.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:original.call(this,type,...args);};});
  await p.goto(url);await fallback(p);await p.getByRole('button',{name:expected[1].label,exact:true}).click();await p.getByRole('button',{name:'Light on',exact:true}).click();await posterMatches(p,'burnt-orange',true);await shot(p,'fallback-webgl');await p.close();
 });
 await test('Real WebGL context loss: fallback and retry preserve selected state',async()=>{
  const p=await context.newPage();await p.goto(url);await ready(p);await p.getByRole('button',{name:expected[2].label,exact:true}).click();await p.getByRole('button',{name:'Light on',exact:true}).click();
  await p.evaluate(()=>document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await fallback(p);await posterMatches(p,'midnight-green',true);await p.getByRole('button',{name:'Retry 3D view',exact:true}).click();await ready(p);await match(p,expected[2],true);await p.close();
 });
 await test('Missing selected poster is explicitly labelled; no stale artwork',async()=>{
  const p=await context.newPage();await p.route('**/mobo-study.glb',r=>r.abort());await p.route('**/midnight-green-lit.webp',r=>r.fulfill({status:404,body:'missing'}));await p.goto(url);await fallback(p);
  await p.getByRole('button',{name:expected[2].label,exact:true}).click();await p.getByRole('button',{name:'Light on',exact:true}).click();await p.locator('#poster-unavailable').waitFor({state:'visible'});
  assert(await p.locator('#poster').isHidden());assert((await p.locator('#poster-unavailable').textContent()).includes('09. Midnight Green / Light on'));
  await p.getByRole('button',{name:'Light off',exact:true}).click();await posterMatches(p,'midnight-green',false);await p.close();
 });
 await test('Missing material data falls back without guessed glaze parameters',async()=>{
  const p=await context.newPage();await p.route('**/finish-materials.json',r=>r.fulfill({status:404,body:'missing'}));await p.goto(url);await fallback(p);await posterMatches(p,'shell-white',false);assert.equal(await p.locator('canvas').count(),0);await p.close();
 });
 await test('Normal path has no uncaught errors or external runtime requests',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.equal(modelRequests.length,1);});
} finally {
 await context.close();await browser.close();
 const report={date:new Date().toISOString(),url,browser:graphics,results,not_run:['Physical Android/iOS device and Safari/Firefox tests','Photometric / manufacturer validation','Root full-site build and unrelated project tests (would touch other demos)','Lint: no configured linter in the existing workspace or this subproject']};
 await writeFile(path.join(qa,'browser-results.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length}));
 if(results.some(r=>r.status==='failed'))process.exitCode=1;
}

