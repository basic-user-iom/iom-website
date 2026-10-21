import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..'),qa=process.env.MOBO_QA||path.join(root,'qa/refinement-20261021/intro');
const url=process.env.MOBO_URL||'http://127.0.0.1:5288';
await mkdir(qa,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'}),results=[],errors=[];
let gpu;
const snap=page=>page.evaluate(()=>window.__moboStudy());
const ready=page=>page.waitForFunction(()=>window.__moboStudy?.().phase==='ready',{},{timeout:45000});
const test=async(name,fn)=>{try{results.push({name,status:'passed',detail:await fn()});console.log('PASS',name);}catch(error){results.push({name,status:'failed',error:String(error.stack)});console.log('FAIL',name,String(error));}};
async function newPage(options={},observeErrors=true){
 const page=await browser.newPage({viewport:{width:1440,height:1080},...options}),requests=[];
 page.on('request',r=>{if(r.url().includes('/audio/'))requests.push(r.url());});
 if(observeErrors){page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});}
 return{page,requests};
}
async function choiceState(page){
 const s=await snap(page);assert.equal(s.intro.active,true);assert.equal(s.intro.dismissed,false);
 assert(await page.locator('#intro-screen').isVisible());
 assert.equal(await page.locator('#intro-tour').textContent(),'Automatic tour');assert.equal(await page.locator('#intro-explore').textContent(),'Explore freely');
 assert(await page.locator('#intro-tour').isEnabled());assert(await page.locator('#intro-explore').isEnabled());
 return s;
}
const waitDismissed=page=>page.waitForFunction(()=>document.getElementById('intro-screen').hidden,{},{timeout:2000});
const shot=(page,name)=>page.screenshot({path:path.join(qa,name+'.png'),fullPage:true});
async function uncovered(page,selector){return page.locator(selector).evaluate(el=>{const b=el.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return el===hit||el.contains(hit);});}
try{
 await test('Welcome appears only when ready, with two choices and no automatic audio',async()=>{
  const {page,requests}=await newPage();try{await page.goto(url);await ready(page);const s=await choiceState(page);assert.equal(s.tour.active,false);assert.equal(s.tour.audio.contextState,'none');assert.equal(requests.length,0);assert.equal(s.exploring,false);
   gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION)};});
   await shot(page,'welcome-desktop');return{gpu,audioRequests:requests.length,phase:s.phase};
  }finally{await page.close();}
 });
 await test('Automatic tour uses the trusted gesture, fades the welcome and retains pause, mute, exit and restart',async()=>{
  const {page,requests}=await newPage();try{await page.goto(url);await ready(page);await choiceState(page);await page.locator('#intro-tour').click();
   const fade=await page.evaluate(async()=>{const e=document.getElementById('intro-screen'),samples=[],start=performance.now();await new Promise(resolve=>{const tick=now=>{samples.push({ms:now-start,opacity:Number(getComputedStyle(e).opacity),hidden:e.hidden,pointerEvents:getComputedStyle(e).pointerEvents});if(now-start>500)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});return samples;});
   assert(fade.some(s=>!s.hidden&&s.opacity>0&&s.opacity<1),'Welcome fades through intermediate opacity');assert(fade.every(s=>s.hidden||s.pointerEvents==='none'),'Leaving welcome cannot intercept input');await waitDismissed(page);
   await page.waitForFunction(()=>window.__moboStudy().tour.music.status==='playing',{},{timeout:30000});let s=await snap(page);assert.equal(s.intro.choice,'tour');assert.equal(s.tour.active,true);assert.equal(s.tour.playing,true);assert.equal(s.viewMode,'room');assert.equal(s.exploring,false);assert(requests.length>=6);assert(s.tour.audio.media.every(m=>m.readyState>=3));await shot(page,'automatic-tour');
   await page.locator('#tour-mute').click();assert.equal((await snap(page)).tour.music.muted,true);await page.locator('#tour-pause').click();assert.equal((await snap(page)).tour.playing,false);await page.waitForTimeout(350);assert((await snap(page)).tour.audio.media.every(m=>m.paused));
   await page.locator('#tour-pause').click();await page.waitForFunction(()=>window.__moboStudy().tour.playing);assert.equal((await snap(page)).tour.music.muted,true);await page.locator('#tour-exit').click();assert.equal((await snap(page)).tour.active,false);assert(await page.locator('#tour-start').isVisible());assert.equal((await snap(page)).intro.active,false);
   await page.locator('#tour-start').click();assert.equal((await snap(page)).tour.active,true);assert.equal((await snap(page)).tour.music.muted,true);await page.locator('#tour-exit').click();await writeFile(path.join(qa,'intro-fade-trace.json'),JSON.stringify(fade,null,2));return{audioRequests:requests.length,fadeIntermediateFrames:fade.filter(s=>!s.hidden&&s.opacity>0&&s.opacity<1).length};
  }finally{await page.close();}
 });
 await test('Keyboard Explore freely enters manual room flight without audio or a focus trap',async()=>{
  const {page,requests}=await newPage();try{await page.goto(url);await ready(page);await choiceState(page);await page.locator('#intro-tour').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'intro-explore');await page.keyboard.press('Tab');assert(!await page.evaluate(()=>document.getElementById('intro-screen').contains(document.activeElement)),'Tab can leave the welcome');
   await page.locator('#intro-explore').focus();await page.keyboard.press('Enter');await waitDismissed(page);let s=await snap(page);assert.equal(s.intro.choice,'explore');assert.equal(s.exploring,true);assert.equal(s.viewer.inspection.enabled,true);assert.equal(s.viewMode,'room');assert.equal(s.tour.active,false);assert.equal(s.tour.audio.contextState,'none');assert.equal(requests.length,0);assert.equal(await page.evaluate(()=>document.activeElement.tagName),'CANVAS');
   const initial=s.viewer.room.camera;await page.keyboard.press('w');assert.notDeepEqual((await snap(page)).viewer.room.camera,initial);await page.locator('[data-camera="reset"]').click();assert.deepEqual((await snap(page)).viewer.room.camera,initial);await shot(page,'explore-freely');assert.equal(requests.length,0);
   await page.locator('#tour-start').click();assert.equal((await snap(page)).tour.active,true);assert.equal((await snap(page)).exploring,false);await page.locator('#tour-exit').click();assert.equal((await snap(page)).exploring,true);return{audioRequestsBeforeTour:0,focusAfterChoice:'CANVAS',resetRestored:true};
  }finally{await page.close();}
 });
 await test('Existing tour and manual controls can dismiss the welcome without blocking navigation',async()=>{
  const {page}=await newPage();try{await page.goto(url);await ready(page);await page.locator('[data-finish="reference-olive"]').click();await waitDismissed(page);let s=await snap(page);assert.equal(s.state.finish,'reference-olive');assert.equal(s.intro.active,false);assert.equal(s.tour.active,false);assert.equal(s.tour.audio.contextState,'none');
   await page.reload();await ready(page);await page.locator('#tour-start').click();await waitDismissed(page);s=await snap(page);assert(s.tour.active);await page.locator('#tour-exit').click();return{manualChoice:'reference-olive',existingTourStart:true};
  }finally{await page.close();}
 });
 await test('Loading and fallback remain unobscured, including the retry action',async()=>{
  const {page}=await newPage({},false);let release;const gate=new Promise(r=>release=r);try{
   await page.route('**/mobo-study.glb',async route=>{await gate;await route.continue();});await page.goto(url);await page.waitForFunction(()=>window.__moboStudy?.().phase==='loading');assert(await page.locator('#intro-screen').isHidden());assert(await page.locator('#status').isVisible());assert((await page.locator('#status').textContent()).includes('Loading'));await shot(page,'loading-unobscured');release();await ready(page);await choiceState(page);await page.unroute('**/mobo-study.glb');
   await page.route('**/mobo-study.glb',route=>route.fulfill({status:404,body:'test missing model'}));await page.reload();await page.waitForFunction(()=>window.__moboStudy?.().phase==='fallback',{},{timeout:30000});assert(await page.locator('#intro-screen').isHidden());assert(await page.locator('#status').isVisible());assert(await page.locator('#retry').isVisible());assert(await page.locator('#retry').isEnabled());await page.locator('#retry').scrollIntoViewIfNeeded();assert(await uncovered(page,'#retry'));await shot(page,'fallback-unobscured');
   await page.unroute('**/mobo-study.glb');await page.locator('#retry').click();await ready(page);await choiceState(page);return{loadingIntroHidden:true,fallbackIntroHidden:true,retryRecovered:true};
  }finally{release?.();await page.close();}
 });
 await test('Help opens and closes without changing study state or interrupting an active tour',async()=>{
  const {page,requests}=await newPage();try{await page.goto(url);await ready(page);await page.locator('#intro-explore').click();await waitDismissed(page);
   await page.waitForFunction(()=>{const v=window.__moboStudy().viewer;return !v.finishTransition.active&&!v.illumination.settling;});
   const before=await snap(page);await page.locator('#study-help-toggle').click();assert(await page.locator('#study-help-panel').isVisible());assert.equal(await page.locator('#study-help-toggle').getAttribute('aria-expanded'),'true');
   let after=await snap(page);for(const key of ['state','lighting','cabinet','viewMode','exploring'])assert.deepEqual(after[key],before[key]);assert.deepEqual(after.viewer.materials,before.viewer.materials);assert.deepEqual(after.viewer.room.camera,before.viewer.room.camera);assert.equal(requests.length,0);
   await page.keyboard.press('Escape');assert(await page.locator('#study-help-panel').isHidden());assert.equal(await page.evaluate(()=>document.activeElement.id),'study-help-toggle');assert.equal((await snap(page)).exploring,true);
   await page.locator('#study-help-toggle').click();await page.locator('#study-help-close').click();assert(await page.locator('#study-help-panel').isHidden());assert.equal(await page.evaluate(()=>document.activeElement.id),'study-help-toggle');
   await page.locator('#tour-start').click();await page.waitForFunction(()=>window.__moboStudy().tour.music.status==='playing',{},{timeout:30000});assert.equal((await snap(page)).tour.playing,true);await page.locator('#study-help-toggle').click();assert.equal((await snap(page)).tour.playing,true);await page.keyboard.press('Escape');after=await snap(page);assert.equal(after.tour.active,true);assert.equal(after.tour.playing,true);assert.equal(after.tour.music.status,'playing');assert(await page.locator('#study-help-panel').isHidden());await page.locator('#tour-exit').click();return{studyStatePreserved:true,escapePreservedActiveTour:true,focusReturned:true};
  }finally{await page.close();}
 });
 await test('View discovery pulse is finite, stops on engagement and is absent during the tour',async()=>{
  const {page}=await newPage();try{await page.goto(url);await ready(page);await page.locator('#intro-explore').click();await waitDismissed(page);
   const pulse=await page.locator('#view-toggle').evaluate(el=>({active:el.classList.contains('view-discovery-pulse'),iterations:getComputedStyle(el).animationIterationCount,duration:getComputedStyle(el).animationDuration}));assert(pulse.active);assert.equal(pulse.iterations,'3');assert(parseFloat(pulse.duration)>0&&parseFloat(pulse.duration)<=2.5);
   await page.locator('#view-toggle').focus();assert(!await page.locator('#view-toggle').evaluate(el=>el.classList.contains('view-discovery-pulse')));await page.locator('#tour-start').click();assert(!await page.locator('#view-toggle').evaluate(el=>el.classList.contains('view-discovery-pulse')));await page.locator('#tour-exit').click();return pulse;
  }finally{await page.close();}
 });
 await test('Mobile choices fit, retain touch targets and support reduced-motion dismissal',async()=>{
  const rows=[];for(const [width,height]of [[390,844],[320,740]]){
   const {page,requests}=await newPage({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});try{await page.goto(url);await ready(page);await choiceState(page);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    for(const id of ['#intro-tour','#intro-explore']){const b=await page.locator(id).boundingBox();assert(b.width>=44&&b.height>=44);assert(b.x>=0&&b.x+b.width<=width+1);assert(b.y>=0&&b.y+b.height<=height+1,'Both choices are visible without scrolling');}
    await shot(page,`welcome-${width}x${height}`);await page.locator('#intro-explore').tap();await waitDismissed(page);const s=await snap(page);assert(s.exploring);assert.equal(requests.length,0);assert.equal(s.tour.audio.contextState,'none');assert.equal(await page.locator('#view-toggle').evaluate(el=>getComputedStyle(el).animationName),'none');
    const helpBox=await page.locator('#study-help-toggle').boundingBox();assert(helpBox.width>=44&&helpBox.height>=44);assert(helpBox.x>=0&&helpBox.x+helpBox.width<=width+1);await page.locator('#study-help-toggle').tap();assert(await page.locator('#study-help-panel').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot(page,`help-${width}x${height}`);await page.locator('#study-help-close').tap();rows.push({width,height,exploring:s.exploring,audioRequests:requests.length,reducedMotionAnimation:'none'});
   }finally{await page.close();}
  }return rows;
 });
 await test('Normal intro and entry paths have no browser errors',async()=>assert.deepEqual(errors,[]));
}finally{await browser.close();await writeFile(path.join(qa,'intro-results.json'),JSON.stringify({date:new Date().toISOString(),url,gpu,results,errors},null,2));}
console.log(JSON.stringify({passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length}));if(results.some(r=>r.status==='failed'))process.exitCode=1;
