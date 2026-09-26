import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const out='tmp/scenario-review-other';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}});
page.setDefaultTimeout(90000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const shots=[];
try {
 await page.goto('http://127.0.0.1:5194/demos/solar-system/');
 await page.getByTestId('ephemeris-provider-badge').waitFor();
 await page.evaluate(async()=>{
 const url=performance.getEntriesByType('resource').find(r=>r.name.includes('/src/rendering/DebugSolarSystemRenderer.ts')).name;
 const {DebugSolarSystemRenderer}=await import(url);const fn=DebugSolarSystemRenderer.prototype.setBlackHoleRenderState;
 DebugSolarSystemRenderer.prototype.setBlackHoleRenderState=function(...args){window.review=this;return fn.apply(this,args)};
 });
 await page.getByTestId('black-hole-encounter-drawer-toggle').click();
 for(const mode of ['physics','cinematic']){
 const prefix='black-hole-'+mode;
 await page.getByTestId(prefix+'-start').click();await page.getByTestId(prefix+'-confirm').click();
 await page.getByTestId(prefix+'-pause').click();
 for(let i=0;i<(mode==='physics'?3:5);i++){
 await page.waitForTimeout(1200);
 const stage=await page.getByTestId('solar-system-app').getAttribute('data-black-hole-stage');
 await page.getByTestId('viewport-fullscreen-toggle').click();await page.waitForTimeout(600);
 const file=mode+'-'+stage+'.png';await page.screenshot({path:out+'/'+file});shots.push(file);
 await page.getByTestId('viewport-fullscreen-toggle').click();
 assert.equal(await page.evaluate(()=>window.review.referenceGrid.visible),false);
 if(await page.getByTestId(prefix+'-skip').isVisible())await page.getByTestId(prefix+'-skip').click();else break;
 }
 await page.getByTestId(prefix+'-reset').click();
 await page.waitForTimeout(400);
 assert.equal(await page.evaluate(()=>window.review.referenceGrid.visible),true);
 }
 await writeFile(out+'/results.json',JSON.stringify({shots,errors},null,2));
 console.log({shots,errors});assert.deepEqual(errors,[]);
}finally{await browser.close()}
