/* global HTMLCanvasElement, document, devicePixelRatio, requestAnimationFrame */
import {chromium,webkit} from 'playwright';
import {writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
const rows=[]; await mkdir('tmp/learning',{recursive:true});
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch();try{
 for(const blocked of [false,true])for(const [width,height] of [[1366,768],[768,1024],[360,800],[844,390]]){
 const page=await browser.newPage({viewport:{width,height},hasTouch:width<1000,reducedMotion:'reduce'});
 if(blocked)await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,o){return t==='webgl2'?null:get.call(this,t,o)}});
 const start=performance.now();await page.goto(process.env.SOLAR_SYSTEM_REVIEW_URL ?? 'http://127.0.0.1:5198/demos/solar-system/');
 await page.waitForFunction(()=>{const l=document.querySelector('[data-testid="learn-start"]');return l&&!l.disabled&&!document.querySelector('[data-testid="startup-screen"]')},null,{timeout:90000});
 const loadMs=Math.round(performance.now()-start);
 await page.getByTestId('learn-start').click();await page.getByTestId('learn-sizes').click(); await page.getByRole('button',{name:'Next',exact:true}).click();
 await page.waitForTimeout(500);
 const sample=await page.evaluate(async blocked=>{
 const c=document.querySelector('canvas'),gl=blocked?null:c.getContext('webgl2');const ext=gl?.getExtension('WEBGL_debug_renderer_info');
 const gpu=gl?(ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)):null;
 const deltas=[];let prev=null;const start=performance.now();
 await new Promise(resolve=>{function frame(t){if(prev!==null)deltas.push(t-prev);prev=t;if(t-start<2500)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame)});
 deltas.sort((a,b)=>a-b);return {gpu,frameSamples:deltas.length,medianFrameMs:deltas[Math.floor(deltas.length*.5)],p95FrameMs:deltas[Math.floor(deltas.length*.95)],dpr:devicePixelRatio};
 },blocked);
 const row={browser:name,browserVersion:browser.version(),width,height,blocked,loadMs,...sample};rows.push(row);console.log(JSON.stringify(row));await page.close();
 }
 }finally{await browser.close()}
}
await writeFile('tmp/learning/production-performance.json',JSON.stringify({host:{cpu:os.cpus()[0].model,platform:os.platform(),release:os.release()},note:'One cold browser context per case; localhost production build; no throttling; headless; DPR1; 2.5 second rAF interval sample in paused Earth lesson; no drawing-buffer override.',rows},null,2));
