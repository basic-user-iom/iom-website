import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.MOBO_QA||'qa/loading-arrival';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'}),context=await browser.newContext({viewport:{width:1440,height:1080},recordVideo:{dir:out+'/video',size:{width:1440,height:1080}}}),page=await context.newPage(),errors=[],audio=[],network=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(r.url().includes('/audio/'))audio.push(r.url());});
const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.clearBrowserCache');
cdp.on('Network.responseReceived',e=>network.push({url:e.response.url,status:e.response.status,fromDiskCache:e.response.fromDiskCache??false}));
let cacheHits=0;cdp.on('Network.requestServedFromCache',()=>cacheHits++);
await page.addInitScript(()=>{window.__arrival=[];const tick=now=>{const el=document.getElementById('scene-loading'),canvas=document.querySelector('canvas'),s=window.__moboStudy?.();window.__arrival.push({now,state:el?.dataset.state,opacity:el?Number(getComputedStyle(el).opacity):null,hidden:el?.hidden,phase:s?.phase,first:s?.viewer?.firstFrameReady,dimensions:canvas?[canvas.width,canvas.height]:null,camera:s?.viewer?.room.camera,intro:s?.intro.active,audio:s?.tour.audio.contextState});if(window.__arrival.length<1500)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
const results=[];
try{
 for(const name of ['cold','return']){
  const netStart=network.length,cacheStart=cacheHits;
  if(name==='cold')await page.goto(process.env.MOBO_URL||'http://127.0.0.1:5288',{waitUntil:'domcontentloaded'});else await page.reload({waitUntil:'domcontentloaded'});
  if(await page.locator('#scene-loading').isVisible())await page.screenshot({path:out+'/'+name+'-loading.png',fullPage:true});
  await page.waitForFunction(()=>window.__moboStudy?.().phase==='ready',{},{timeout:30000});
  await page.screenshot({path:out+'/'+name+'-fade.png',fullPage:true});
  await page.waitForFunction(()=>document.getElementById('scene-loading').hidden);await page.waitForTimeout(150);
  await page.screenshot({path:out+'/'+name+'-intro.png',fullPage:true});
  const trace=await page.evaluate(()=>window.__arrival),s=await page.evaluate(()=>window.__moboStudy());
  const leaving=trace.filter(t=>t.state==='leaving'),ready=trace.filter(t=>t.phase==='ready');
  assert(leaving.length>2);assert(leaving.some(t=>t.opacity>0&&t.opacity<1));assert(leaving.every(t=>t.first&&t.dimensions.every(x=>x>1)));
  assert(ready.length>0);assert(ready.every(t=>JSON.stringify(t.camera)===JSON.stringify(ready[0].camera)),'No camera jump after readiness');
  assert.equal(s.intro.active,true);assert.equal(s.tour.active,false);assert.equal(s.tour.audio.contextState,'none');assert.equal(audio.length,0);
  assert.equal(await page.locator('.controls').evaluate(e=>e.inert),false);assert(await page.locator('#intro-tour').isEnabled());assert(await page.locator('#intro-explore').isEnabled());
  const range=leaving.filter(t=>t.opacity>0&&t.opacity<1),first=leaving[0];
  const result={name,readyMs:first.now,fadeIntermediateFrames:range.length,fadeDuration:leaving.at(-1).now-first.now,finalCamera:ready[0].camera,cacheEvents:cacheHits-cacheStart,diskCachedResponses:network.slice(netStart).filter(r=>r.fromDiskCache).length,audioRequests:audio.length,firstFrameReady:s.viewer.firstFrameReady};results.push(result);
  await writeFile(out+'/'+name+'-trace.json',JSON.stringify(trace,null,2));console.log('PASS '+name+' '+JSON.stringify(result));
  if(name==='cold'){await page.locator('#intro-explore').click();assert.equal((await page.evaluate(()=>window.__moboStudy())).exploring,true);assert.equal(audio.length,0);await page.waitForTimeout(450);}
 }
 await page.locator('#intro-tour').click();await page.waitForFunction(()=>window.__moboStudy().tour.music.status==='playing',{},{timeout:20000});assert(audio.length>=6);await page.locator('#tour-pause').click();
 results.push({name:'Explore is silent; Automatic tour starts music only from its button',status:'passed',audioRequestsAfterGesture:audio.length});assert.deepEqual(errors,[]);
 const hardware=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),userAgent:navigator.userAgent};});
 await writeFile(out+'/results.json',JSON.stringify({results,hardware,errors,network},null,2));
}catch(error){await writeFile(out+'/failure.json',JSON.stringify({results,errors,error:String(error.stack)},null,2));throw error;}
finally{const video=page.video();await context.close();await video.saveAs(out+'/cold-return-arrival.webm');await browser.close();}
