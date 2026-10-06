import {chromium,webkit}from'playwright';import assert from'node:assert/strict';import{mkdir,writeFile}from'node:fs/promises';
const base=process.env.IOM_REVIEW_URL??'http://127.0.0.1:5192/';const out=process.env.IOM_REVIEW_OUTPUT??'tmp/gallery-review-2026-10-05';await mkdir(out,{recursive:true});const results=[];
for(const[name,engine]of[['chromium',chromium],['webkit',webkit]]){const browser=await engine.launch();try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.reviewAudio=[];const Original=window.Audio;window.Audio=class extends Original{constructor(...args){super(...args);window.reviewAudio.push(this);}};});
 await page.goto(base+'#night-grid');await page.locator('#night-grid').click();await page.getByRole('dialog',{name:'Night Grid gallery'}).waitFor();await page.locator('.gallery-lightbox-image.is-loaded').waitFor();
 const play=page.getByRole('button',{name:'Play gallery audio',exact:true});if(await play.isEnabled())await play.click();await page.waitForFunction(()=>window.reviewAudio.some(a=>a.src.includes('night-grid')&&!a.paused&&a.currentTime>0),null,{timeout:20000});
 const initial=await page.evaluate(()=>{const a=window.reviewAudio.findLast(a=>a.src.includes('night-grid'));window.activeGalleryAudio=a;return a.currentTime;});
 for(const[width,height]of[[390,844],[844,390],[667,320],[768,1024],[1366,768],[390,844]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(300);
  const layout=await page.evaluate(()=>{const box=e=>{const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{x:r.x,y:r.y,w:r.width,h:r.height,hit:e.contains(hit)}};const wrap=document.querySelector('.gallery-lightbox-image-wrap');const stage=document.querySelector('.gallery-lightbox-stage');return{controls:[...document.querySelectorAll('.gallery-lightbox button')].map(box),image:box(wrap),stage:box(stage),audio:{same:window.reviewAudio.findLast(a=>a.src.includes('night-grid'))===window.activeGalleryAudio,paused:window.activeGalleryAudio.paused,time:window.activeGalleryAudio.currentTime},overflow:document.querySelector('.gallery-lightbox-panel').scrollWidth>document.querySelector('.gallery-lightbox-panel').clientWidth};});
  assert.equal(layout.overflow,false);assert.ok(layout.image.h>100);assert.ok(layout.image.y>=layout.stage.y-1);assert.ok(layout.image.y+layout.image.h<=layout.stage.y+layout.stage.h+1);
  for(const c of layout.controls){assert.ok(c.w>=44&&c.h>=44);assert.ok(c.x>=0&&c.y>=0&&c.x+c.w<=width+1&&c.y+c.h<=height+1);assert.ok(c.hit);}
  assert.equal(layout.audio.same,true);assert.equal(layout.audio.paused,false);assert.ok(layout.audio.time>=initial);
  await page.getByRole('button',{name:'Next image',exact:true}).click();await page.locator('.gallery-lightbox-image.is-loaded').waitFor();await page.getByRole('button',{name:'Previous image',exact:true}).click();await page.locator('.gallery-lightbox-image.is-loaded').waitFor();
  await page.screenshot({path:`${out}/${name}-${width}.png`});results.push({name,width,height,...layout});
 }
 await page.setViewportSize({width:667,height:320});
 const gallery=page.getByRole('dialog',{name:'Night Grid gallery'});
 const savedPageY=await page.evaluate(()=>-parseFloat(document.body.style.top||'0'));
 for(const mode of ['available','denied','missing']) {
  if(mode!=='available')await page.evaluate(mode=>{
   Object.defineProperty(HTMLElement.prototype,'requestFullscreen',{configurable:true,value:mode==='denied'?()=>Promise.reject(new Error('Test fullscreen denial')):undefined});
   Object.defineProperty(HTMLElement.prototype,'webkitRequestFullscreen',{configurable:true,value:undefined});
  },mode);
  const before=await page.locator('.gallery-lightbox-image-wrap').boundingBox();
  await page.getByRole('button',{name:'Open full screen gallery view',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.gallery-lightbox').dataset.expanded==='true'&&!document.querySelector('.gallery-lightbox-fullscreen').disabled);
  const actual=await gallery.getAttribute('data-fullscreen-mode');
  if(mode!=='available')assert.equal(actual,'expanded');
  if(mode==='available'&&name==='chromium')assert.equal(actual,'native');
  const after=await page.locator('.gallery-lightbox-image-wrap').boundingBox();assert.ok(after.height>before.height*1.3);
  if(actual==='expanded') {
   await page.waitForFunction(()=>document.documentElement.classList.contains('is-gallery-scroll-view'));
   assert.ok(await page.evaluate(()=>document.scrollingElement.scrollHeight>innerHeight+100));
   assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('root')).display),'none');
   if(name==='chromium') {
    const cdp=await page.context().newCDPSession(page);
    const r=await page.locator('.gallery-lightbox-image-wrap').boundingBox();const x=r.x+r.width/2,y=r.y+r.height*.7;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*10,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
   } else await page.evaluate(()=>window.scrollTo(0,90));
   await page.waitForFunction(()=>window.scrollY>30);
   const pinned=await gallery.boundingBox();assert.ok(Math.abs(pinned.y)<1,'Expanded photo remains pinned while document scrolls');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:out+'/'+name+'-scroll-view-'+mode+'.png'});
  }

  await page.getByRole('button',{name:'Next image',exact:true}).click();await page.locator('.gallery-lightbox-image.is-loaded').waitFor();
  await page.getByRole('button',{name:'Previous image',exact:true}).click();await page.locator('.gallery-lightbox-image.is-loaded').waitFor();
  const previousSrc=await page.locator('.gallery-lightbox-image').getAttribute('src');
  await page.keyboard.press('ArrowRight');await page.waitForFunction(src=>document.querySelector('.gallery-lightbox-image').getAttribute('src')!==src,previousSrc);
  await page.keyboard.press('ArrowLeft');await page.waitForFunction(src=>document.querySelector('.gallery-lightbox-image').getAttribute('src')===src,previousSrc);
  await page.locator('.gallery-lightbox-image.is-loaded').waitFor();
  assert.ok(await page.evaluate(()=>window.reviewAudio.findLast(a=>a.src.includes('night-grid'))===window.activeGalleryAudio&&!window.activeGalleryAudio.paused));
  await page.screenshot({path:out+'/'+name+'-fullscreen-'+mode+'.png'});
  for(const viewport of [{width:390,height:844},{width:844,height:390}]){
   if(actual==='native'&&name==='chromium'){
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Emulation.setDeviceMetricsOverride',{...viewport,screenWidth:viewport.width,screenHeight:viewport.height,deviceScaleFactor:1,mobile:true});await cdp.detach();
   }else await page.setViewportSize(viewport);
   const exit=page.getByRole('button',{name:'Exit full screen gallery view',exact:true});const r=await exit.boundingBox();
   assert.ok(r.width>=44&&r.height>=44&&r.x>=0&&r.y>=0&&r.x+r.width<=viewport.width+1&&r.y+r.height<=viewport.height+1);
  }
  await page.getByRole('button',{name:'Show gallery controls',exact:true}).click();
  await page.getByRole('button',{name:'Pause gallery audio',exact:true}).click();assert.ok(await page.evaluate(()=>window.activeGalleryAudio.paused));await play.click();
  await page.getByRole('button',{name:'Hide gallery controls',exact:true}).click();
  if(mode==='missing')await page.keyboard.press('Escape');
  else await page.getByRole('button',{name:'Exit full screen gallery view',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.gallery-lightbox').dataset.expanded==='false');
  assert.ok(await gallery.isVisible());assert.ok(await page.evaluate(()=>!document.fullscreenElement));
  assert.ok(await page.evaluate(()=>!document.documentElement.classList.contains('is-gallery-scroll-view')&&getComputedStyle(document.body).position==='fixed'&&getComputedStyle(document.getElementById('root')).display!=='none'));
  await page.setViewportSize({width:667,height:320});
  results.push({name,fullscreen:mode,actual,result:'passed'});
 }
 // Closing directly from the expanded view releases audio and fullscreen ownership.
 await page.getByRole('button',{name:'Open full screen gallery view',exact:true}).click();
 await page.getByRole('button',{name:'Show gallery controls',exact:true}).click();
 await page.getByRole('button',{name:'Pause gallery audio',exact:true}).click();assert.ok(await page.evaluate(()=>window.activeGalleryAudio.paused));await play.click();await page.getByRole('button',{name:'Close gallery',exact:true}).click();await page.getByRole('dialog',{name:'Night Grid gallery'}).waitFor({state:'hidden'});assert.ok(await page.evaluate(()=>window.activeGalleryAudio.paused));assert.deepEqual(errors,[]);
 await page.waitForFunction(y=>Math.abs(scrollY-y)<3,savedPageY);
 assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('is-gallery-scroll-view')),false);
 await page.reload();await page.locator('#night-grid').click();await gallery.waitFor();
 await page.waitForFunction(()=>window.reviewAudio.some(a=>a.src.includes('night-grid')));
 await page.evaluate(()=>{window.reopenedGalleryAudio=window.reviewAudio.findLast(a=>a.src.includes('night-grid'));});
 await page.getByRole('button',{name:'Open full screen gallery view',exact:true}).focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelector('.gallery-lightbox').dataset.expanded==='true'&&!document.querySelector('.gallery-lightbox-fullscreen').disabled);
 await page.getByRole('button',{name:'Next image',exact:true}).focus();await page.keyboard.press('Tab');
 assert.ok(await page.evaluate(()=>document.querySelector('.gallery-lightbox').contains(document.activeElement)));
 await page.getByRole('button',{name:'Close gallery',exact:true}).focus();await page.keyboard.press('Enter');await gallery.waitFor({state:'hidden'});
 assert.ok(await page.evaluate(()=>!document.fullscreenElement&&window.reopenedGalleryAudio.paused&&window.reopenedGalleryAudio.getAttribute('src')===''));
 assert.deepEqual(errors,[]);console.log(name,'gallery resize, native/fallback fullscreen, document scroll, position restore, keyboard, exit and audio continuity passed');
}finally{await browser.close();}}
await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));
