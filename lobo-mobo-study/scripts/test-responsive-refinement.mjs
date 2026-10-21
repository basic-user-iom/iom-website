import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..'),qa=process.env.MOBO_QA||path.join(root,'qa/refinement-20261021/responsive'),url=process.env.MOBO_URL||'http://127.0.0.1:5288';
await mkdir(qa,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'}),results=[],errors=[];
const allDevices=[{width:1920,height:1080,touch:false},{width:1366,height:768,touch:false},{width:768,height:1024,touch:true},{width:1024,height:768,touch:true},{width:390,height:844,touch:true},{width:360,height:740,touch:true},{width:844,height:390,touch:true}];
const devices=process.env.MOBO_VIEWPORT?allDevices.filter(d=>`${d.width}x${d.height}`===process.env.MOBO_VIEWPORT):allDevices;
const snapshot=p=>p.evaluate(()=>window.__moboStudy());
const paint=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const settle=async p=>{await p.waitForFunction(()=>{const v=window.__moboStudy().viewer;return!v.finishTransition.active&&!v.illumination.settling;},{},{timeout:6000});await paint(p);};
const act=async(p,spec,selector)=>spec.touch?p.locator(selector).tap():p.locator(selector).click();
const test=async(name,fn)=>{try{results.push({name,status:'passed',detail:await fn()});console.log('PASS',name);}catch(error){results.push({name,status:'failed',error:String(error.stack)});console.log('FAIL',name,String(error));}};
const rect=p=>({x:p.x,y:p.y,width:p.width,height:p.height});
async function audit(p,label){
 const data=await p.evaluate(()=>{
  const r=el=>{const b=el.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom};};
  const controls=[...document.querySelectorAll('button,input[type=range]')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').map(e=>({id:e.id||e.dataset.finish||e.dataset.light||e.dataset.camera||e.dataset.time||e.dataset.explore,rect:r(e),disabled:e.disabled}));
  const overflow=controls.filter(c=>c.rect.x<-.5||c.rect.right>innerWidth+.5);
  const stage=r(document.querySelector('#stage')),aside=r(document.querySelector('.controls'));
  return{viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,pageHeight:document.documentElement.scrollHeight,overflow,stage,aside,controls};
 });
 assert(data.documentWidth<=data.viewport.width+1,`${label}: no horizontal document overflow`);assert.equal(data.overflow.length,0,`${label}: controls stay within page width`);
 const a=data.stage,b=data.aside;assert(a.right<=b.x+1||a.bottom<=b.y+1||b.right<=a.x+1,`${label}: stage and controls do not overlap`);
 for(const c of data.controls)assert(c.rect.width>0&&c.rect.height>0,`${label}: ${c.id} has a usable area`);
 return data;
}
async function visibleAfterScroll(p,selector){
 const e=p.locator(selector);await e.scrollIntoViewIfNeeded();const b=await e.boundingBox(),v=p.viewportSize();assert(b&&b.x>=-.5&&b.y>=-.5&&b.x+b.width<=v.width+.5&&b.y+b.height<=v.height+.5,`${selector}: can be scrolled fully into view`);return rect(b);
}
async function touchDrag(p,spec){
 const cdp=await p.context().newCDPSession(p);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
 await p.locator('canvas').scrollIntoViewIfNeeded();const box=await p.locator('canvas').boundingBox(),viewport=p.viewportSize(),x=Math.max(70,Math.min(viewport.width-70,box.x+box.width*.45)),y=Math.max(70,Math.min(viewport.height-100,box.y+Math.min(box.height*.4,180)));
 const before=(await snapshot(p)).viewer.camera;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});for(let i=1;i<=5;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+i*9,y:y+i*2,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await paint(p);
 const after=(await snapshot(p)).viewer.camera;assert.notDeepEqual(after.position,before.position,`${spec.width}: touch drag rotates the isolated lamp`);
 const zoom=after.zoom;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-24,y,id:1},{x:x+24,y,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-45,y,id:1},{x:x+45,y,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await paint(p);assert((await snapshot(p)).viewer.camera.zoom>zoom,`${spec.width}: pinch zoom works`);
 await cdp.detach();return{start:before.position,end:after.position,pinchZoom:(await snapshot(p)).viewer.camera.zoom};
}
try{
 for(const spec of devices){
  await test(`${spec.width}x${spec.height}: ${spec.touch?'touch emulation':'desktop'} intro, help, tour and manual controls`,async()=>{
   const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},deviceScaleFactor:1,isMobile:spec.touch,hasTouch:spec.touch}),p=await context.newPage(),localErrors=[];
   p.on('pageerror',e=>{localErrors.push(String(e));errors.push({viewport:spec,error:String(e)});});p.on('console',m=>{if(m.type()==='error'){localErrors.push(m.text());errors.push({viewport:spec,error:m.text()});}});
   const evidence={},name=`${spec.width}x${spec.height}`;
   try{
    await p.goto(url);await p.waitForFunction(()=>window.__moboStudy?.().phase==='ready',{},{timeout:45000});await settle(p);assert((await snapshot(p)).intro.active);
    evidence.gpu=await p.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
    evidence.intro=await audit(p,'intro');
    const fit=await p.locator('#intro-screen').evaluate(el=>{const a=el.getBoundingClientRect(),b=el.querySelector('.welcome-copy').getBoundingClientRect();return{panel:{x:a.x,y:a.y,width:a.width,height:a.height},content:{x:b.x,y:b.y,width:b.width,height:b.height},fits:b.x>=a.x&&b.y>=a.y&&b.right<=a.right&&b.bottom<=a.bottom};});assert(fit.fits,`${name}: intro contents fit without clipping`);evidence.introFit=fit;
    for(const id of ['#intro-tour','#intro-explore']){const b=await visibleAfterScroll(p,id);assert(b.height>=44&&b.width>=100);}
    await p.screenshot({path:path.join(qa,`${name}-intro.png`),fullPage:true});await act(p,spec,'#intro-explore');await p.waitForFunction(()=>!window.__moboStudy().intro.active);assert((await snapshot(p)).exploring);await p.waitForTimeout(380);
    await act(p,spec,'#explore-room');assert.equal((await snapshot(p)).exploring,false);
    await act(p,spec,'#study-help-toggle');assert(await p.locator('#study-help-panel').isVisible());evidence.help=await audit(p,'help');
    await visibleAfterScroll(p,'#study-help-close');const help=await p.locator('#study-help-panel').boundingBox();assert(help.width<=spec.width&&help.height<=spec.height,`${name}: help panel fits viewport`);await p.screenshot({path:path.join(qa,`${name}-help.png`),fullPage:true});await act(p,spec,'#study-help-close');assert(await p.locator('#study-help-panel').isHidden());
    await act(p,spec,'[data-finish="reference-olive"]');await settle(p);assert.equal((await snapshot(p)).state.finish,'reference-olive');await act(p,spec,'[data-light="lit"]');
    for(const selector of ['#brightness-slider','#cabinet-brightness','#time-slider']){
     await visibleAfterScroll(p,selector);const box=await p.locator(selector).boundingBox();assert(box.width>=80&&box.height>=28,`${name}: ${selector} has room to operate`);
     if(spec.touch)await p.touchscreen.tap(box.x+box.width*.63,box.y+box.height*.5);else await p.mouse.click(box.x+box.width*.63,box.y+box.height*.5);
     await p.locator(selector).focus();await p.keyboard.press('End');
     const s=await snapshot(p);assert.equal(selector==='#brightness-slider'?s.lighting.brightness:selector==='#cabinet-brightness'?s.cabinet.brightness:s.lighting.progress,1);
    }
    await settle(p);evidence.controls=await audit(p,'controls');await p.screenshot({path:path.join(qa,`${name}-room-controls.png`),fullPage:true});
    await act(p,spec,'#view-toggle');assert.equal((await snapshot(p)).viewMode,'lamp');assert.equal(await p.locator('#view-toggle').textContent(),'Back to room');assert(await p.locator('#daynight-controls').isHidden());await visibleAfterScroll(p,'[data-camera="reset"]');
    if(spec.touch)evidence.touch=await touchDrag(p,spec);else{const before=(await snapshot(p)).viewer.camera.position;await p.locator('[data-camera="right"]').click();assert.notDeepEqual((await snapshot(p)).viewer.camera.position,before);}
    await act(p,spec,'[data-camera="reset"]');await act(p,spec,'#view-toggle');
    if((await snapshot(p)).viewMode!=='room'){
     const immediate=await snapshot(p);await p.waitForTimeout(400);const delayed=await snapshot(p);await p.screenshot({path:path.join(qa,`${name}-view-toggle-diagnostic.png`),fullPage:true});
     await writeFile(path.join(qa,`${name}-view-toggle-diagnostic.json`),JSON.stringify({immediate,delayed,viewport:await p.evaluate(()=>({innerWidth,innerHeight,scrollY,visual:{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale}})),button:await p.locator('#view-toggle').boundingBox()},null,2));
    }
    assert.equal((await snapshot(p)).viewMode,'room');
    await act(p,spec,'#tour-start');await p.waitForFunction(()=>window.__moboStudy().tour.playing);await act(p,spec,'#tour-pause');assert.equal((await snapshot(p)).tour.playing,false);await act(p,spec,'#tour-next');assert.equal((await snapshot(p)).tour.index,1);evidence.tour=await audit(p,'tour');
    for(const selector of ['#tour-prev','#tour-pause','#tour-next','#tour-exit']){const b=await visibleAfterScroll(p,selector);assert(b.width>=44&&b.height>=44,`${name}: ${selector} touch size`);}await p.screenshot({path:path.join(qa,`${name}-tour.png`),fullPage:true});
    await act(p,spec,'#tour-pause');assert((await snapshot(p)).tour.playing);await act(p,spec,'[data-light="unlit"]');assert.equal((await snapshot(p)).tour.playing,false);await act(p,spec,'#tour-exit');assert.equal((await snapshot(p)).tour.active,false);
    // Ordinary document scroll remains available away from the interactive canvas.
    await p.evaluate(()=>scrollTo(0,0));const initialScroll=await p.evaluate(()=>scrollY);await p.mouse.move(5,Math.min(spec.height-50,250));await p.mouse.wheel(0,500);await p.waitForTimeout(180);const nextScroll=await p.evaluate(()=>scrollY);assert(nextScroll>initialScroll,`${name}: outside scrolling works`);evidence.scroll={before:initialScroll,after:nextScroll};
    for(const selector of ['#view-toggle','#brightness-slider','#cabinet-brightness','#time-slider','#study-help-toggle'])await visibleAfterScroll(p,selector);
    assert.deepEqual(localErrors,[]);return evidence;
   }finally{await context.close();}
  });
 }
 await test('Reduced motion keeps intro, help and tour operable without discovery pulse',async()=>{
  const c=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce'}),p=await c.newPage();
  try{await p.goto(url);await p.waitForFunction(()=>window.__moboStudy?.().phase==='ready',{},{timeout:45000});await p.locator('#intro-tour').tap();assert.equal((await snapshot(p)).tour.playing,false);assert(await p.locator('#intro-screen').isHidden());await p.locator('#tour-next').tap();assert.equal((await snapshot(p)).tour.index,1);await p.locator('#tour-exit').tap();await p.locator('#study-help-toggle').tap();await p.locator('#study-help-close').tap();const animation=await p.locator('#view-toggle').evaluate(e=>getComputedStyle(e).animationName);assert.equal(animation,'none');await audit(p,'reduced-motion');await p.screenshot({path:path.join(qa,'390x844-reduced-motion.png'),fullPage:true});return{animation,device:'touch emulation',tour:'manual steps'};}finally{await c.close();}
 });
}finally{await browser.close();await writeFile(path.join(qa,process.env.MOBO_VIEWPORT?`responsive-results-recheck-${process.env.MOBO_VIEWPORT}.json`:'responsive-results.json'),JSON.stringify({date:new Date().toISOString(),url,browser:'Local Microsoft Edge, NVIDIA WebGL; phone/tablet input and viewports emulated, not physical devices',testedViewports:devices,results,errors},null,2));}
console.log(JSON.stringify({passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length}));if(results.some(r=>r.status==='failed'))process.exitCode=1;
