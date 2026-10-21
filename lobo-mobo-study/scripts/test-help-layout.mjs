import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const qa=process.env.MOBO_QA||path.join(root,'qa/refinement-20261021/help-layout');
const url=process.env.MOBO_URL||'http://127.0.0.1:5288';
const before=process.argv.includes('--before');
await mkdir(qa,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'});
const ready=page=>page.waitForFunction(()=>window.__moboStudy?.().phase==='ready',{},{timeout:45000});
const snap=page=>page.evaluate(()=>window.__moboStudy());
const results=[],errors=[];
let gpu;
const shot=(page,name)=>page.screenshot({path:path.join(qa,name+'.png'),fullPage:true});
const test=async(name,fn)=>{try{results.push({name,status:'passed',detail:await fn()});console.log('PASS',name);}catch(error){results.push({name,status:'failed',error:String(error.stack)});console.log('FAIL',name,String(error));}};
const boxes=page=>page.evaluate(()=>{const box=s=>{const e=document.querySelector(s);return e&&!e.hidden?e.getBoundingClientRect().toJSON():null;};return{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,stage:box('#stage'),canvas:box('#canvas-host'),status:box('#status'),retry:box('#retry'),help:box('#study-help-toggle'),row:document.querySelector('#study-help-toggle').parentElement.getBoundingClientRect().toJSON(),controls:box('.controls'),panel:box('#study-help-panel')};});
const intersects=(a,b)=>a&&b&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5;
async function uncovered(page,selector){return page.locator(selector).evaluate(el=>{const b=el.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return el===hit||el.contains(hit);});}
async function panelFits(page){const b=await boxes(page);assert(b.panel,'Open panel exists');assert(b.panel.left>=-.5&&b.panel.right<=b.width+.5,'Help panel fits viewport horizontally');assert(b.panel.top>=-.5&&b.panel.bottom<=b.height+.5,`Help panel fits visible viewport vertically: ${JSON.stringify(b)}`);assert(b.scrollWidth<=b.width+1,'Help does not create horizontal overflow');return b.panel;}
async function layout(page){const b=await boxes(page);assert(b.help.width>=44&&b.help.height>=44,'Help minimum touch target is 44px');assert(b.help.top>=b.stage.bottom+8,'Help is spaced below the canvas');assert(b.help.top>=b.status.bottom+8,'Help is spaced below the status');for(const key of ['canvas','status','retry','controls'])assert(!intersects(b.help,b[key]),`Help does not overlap ${key}`);assert(b.help.left>=0&&b.help.right<=b.width+1,'Help fits viewport width');assert(b.scrollWidth<=b.width+1,'No horizontal overflow');assert(await page.locator('#study-help-toggle').evaluate(el=>!el.closest('.stage-bottom')),'Help has its own utility row outside status bar');assert.match((await page.locator('#study-help-toggle').textContent()).trim(),/Help/);return b;}
async function newPage(viewport={width:1366,height:768},observeErrors=true){const page=await browser.newPage({viewport}),requests=[];page.on('request',r=>{if(r.url().includes('/audio/'))requests.push(r.url());});if(observeErrors){page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});}return{page,requests};}
async function explore(page){await page.goto(url);await ready(page);await page.locator('#intro-explore').click();await page.waitForFunction(()=>document.getElementById('intro-screen').hidden);}
const invariant=s=>({state:s.state,lighting:s.lighting,cabinet:s.cabinet,viewMode:s.viewMode,exploring:s.exploring,dofEnabled:s.dofEnabled,materials:s.viewer.materials,camera:s.viewer.room.camera,tourActive:s.tour.active,audioState:s.tour.audio.contextState});
const controls=page=>page.locator('.controls button,.controls input').evaluateAll(els=>els.map(el=>({id:el.id,finish:el.dataset.finish,light:el.dataset.light,time:el.dataset.time,camera:el.dataset.camera,pressed:el.getAttribute('aria-pressed'),disabled:el.disabled,value:el.value,text:el.textContent})));
try{
 if(before){
  for(const[width,height]of [[1366,768],[390,844],[844,390]]){
   const page=await browser.newPage({viewport:{width,height}});
   try{
    await page.goto(url);await ready(page);await page.locator('#intro-explore').click();
    await page.waitForFunction(()=>document.getElementById('intro-screen').hidden);
    await page.locator('#study-help-toggle').scrollIntoViewIfNeeded();
    await shot(page,`before-${width}x${height}`);
    results.push({width,height,toggle:await page.locator('#study-help-toggle').evaluate(el=>({text:el.textContent,rect:el.getBoundingClientRect().toJSON()}))});
   }finally{await page.close();}
  }
  await writeFile(path.join(qa,'before-layout.json'),JSON.stringify(results,null,2));
 }else{
  for(const[width,height]of [[1920,1080],[1366,768],[768,1024],[1024,768],[390,844],[360,740],[844,390]])await test(`Help utility row and visible panel at ${width}x${height}`,async()=>{
   const{page,requests}=await newPage({width,height});try{
    await explore(page);await page.locator('#study-help-toggle').scrollIntoViewIfNeeded();const closed=await layout(page);assert(await uncovered(page,'#study-help-toggle'),'Help is reachable');
    if(!gpu)gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION)};});
    await shot(page,`after-closed-${width}x${height}`);await page.locator('#study-help-toggle').click();assert.equal(await page.locator('#study-help-toggle').getAttribute('aria-expanded'),'true');const panel=await panelFits(page);assert(await uncovered(page,'#study-help-close'),'Close is visible and reachable');
    await shot(page,`after-open-${width}x${height}`);await page.screenshot({path:path.join(qa,`after-viewport-${width}x${height}.png`)});
    const content=await page.locator('#study-help-panel').evaluate(el=>{el.scrollTop=el.scrollHeight;return{scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,scrollTop:el.scrollTop};});assert(content.scrollHeight<=content.clientHeight+1||content.scrollTop>0,'Long help content can scroll');
    await page.keyboard.press('Escape');assert(await page.locator('#study-help-panel').isHidden());assert.equal(await page.evaluate(()=>document.activeElement.id),'study-help-toggle');assert.equal(requests.length,0);await page.locator('#study-help-toggle').focus();await page.keyboard.press('Enter');await panelFits(page);await page.locator('#study-help-close').click();assert(await page.locator('#study-help-panel').isHidden());assert.equal(await page.evaluate(()=>document.activeElement.id),'study-help-toggle');
    return{closed,panel,audioRequests:requests.length};
   }finally{await page.close();}
  });
  await test('Help preserves nondefault study, camera, light, material, audio and control settings',async()=>{
   const{page,requests}=await newPage();try{
    await explore(page);await page.locator('[data-finish="reference-olive"]').click();await page.locator('[data-light="lit"]').click();await page.locator('#brightness-slider').fill('87');await page.locator('#cabinet-brightness').fill('68');await page.locator('#dof-toggle').click();
    await page.waitForFunction(()=>{const v=window.__moboStudy().viewer;return !v.finishTransition.active&&!v.illumination.settling;});const state=invariant(await snap(page)),beforeControls=await controls(page);
    await page.locator('#study-help-toggle').click();assert.deepEqual(invariant(await snap(page)),state);assert.deepEqual(await controls(page),beforeControls);await page.keyboard.press('Escape');assert.deepEqual(invariant(await snap(page)),state);assert.deepEqual(await controls(page),beforeControls);assert.equal(requests.length,0);
    return{finish:state.state.finish,brightness:state.lighting.brightness,cabinet:state.cabinet,dofEnabled:state.dofEnabled,unchanged:true};
   }finally{await page.close();}
  });
  for(const[width,height]of [[1366,768],[844,390]])await test(`Help Escape preserves active tour and music at ${width}x${height}`,async()=>{
   const{page}=await newPage({width,height});try{await page.goto(url);await ready(page);await page.locator('#intro-tour').click();await page.waitForFunction(()=>window.__moboStudy().tour.music.status==='playing',{},{timeout:30000});await page.locator('#study-help-toggle').click();await panelFits(page);let s=await snap(page);assert(s.tour.active&&s.tour.playing);assert.equal(s.tour.music.status,'playing');await page.keyboard.press('Escape');s=await snap(page);assert(s.tour.active&&s.tour.playing);assert.equal(s.tour.music.status,'playing');assert(await page.locator('#study-help-panel').isHidden());assert.equal(await page.evaluate(()=>document.activeElement.id),'study-help-toggle');await page.locator('#tour-exit').click();return{active:true,playing:true,music:'playing'};}finally{await page.close();}
  });
  for(const[width,height]of [[390,844],[844,390]])await test(`Loading, fallback and Retry stay clear at ${width}x${height}`,async()=>{
   const{page}=await newPage({width,height},false);let release;const gate=new Promise(resolve=>release=resolve);try{
    await page.route('**/mobo-study.glb',async route=>{await gate;await route.continue();});await page.goto(url);await page.waitForFunction(()=>window.__moboStudy?.().phase==='loading');await page.locator('#study-help-toggle').scrollIntoViewIfNeeded();assert(await page.locator('#intro-screen').isHidden());await layout(page);await page.locator('#status').scrollIntoViewIfNeeded();assert(await uncovered(page,'#status'));await shot(page,`loading-${width}x${height}`);
    await page.locator('#study-help-toggle').click();await panelFits(page);await page.keyboard.press('Escape');release();await ready(page);await page.unroute('**/mobo-study.glb');await page.route('**/mobo-study.glb',route=>route.fulfill({status:404,body:'test missing model'}));await page.reload();await page.waitForFunction(()=>window.__moboStudy?.().phase==='fallback',{},{timeout:30000});await page.locator('#study-help-toggle').scrollIntoViewIfNeeded();await layout(page);assert(await page.locator('#intro-screen').isHidden());assert(await page.locator('#retry').isEnabled());await page.locator('#retry').scrollIntoViewIfNeeded();assert(await uncovered(page,'#retry'));await shot(page,`fallback-${width}x${height}`);
    await page.locator('#study-help-toggle').click();await panelFits(page);await page.keyboard.press('Escape');await page.unroute('**/mobo-study.glb');await page.locator('#retry').click();await ready(page);return{loadingClear:true,fallbackClear:true,retryRecovered:true};
   }finally{release?.();await page.close();}
  });
  await test('Normal Help paths have no browser errors',async()=>assert.deepEqual(errors,[]));
 }
}finally{await browser.close();if(!before)await writeFile(path.join(qa,'help-layout-results.json'),JSON.stringify({date:new Date().toISOString(),url,gpu,results,errors},null,2));}
console.log(JSON.stringify({mode:before?'before':'after',results},null,2));
if(results.some(r=>r.status==='failed'))process.exitCode=1;
