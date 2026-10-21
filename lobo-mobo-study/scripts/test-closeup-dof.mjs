import {chromium} from 'playwright';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const url=process.env.MOBO_URL||'http://127.0.0.1:5284',out=process.env.MOBO_QA||'qa/closeup-dof';await mkdir(out,{recursive:true});
const browser=await chromium.launch(process.env.MOBO_CHANNEL?{headless:true,channel:process.env.MOBO_CHANNEL}:{headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1080}}),results=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
const snap=()=>page.evaluate(()=>window.__moboStudy()),paint=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const test=async(name,fn)=>{try{const detail=await fn();results.push({name,status:'passed',detail});console.log('PASS',name);}catch(error){results.push({name,status:'failed',error:String(error.stack)});console.log('FAIL',name,String(error));}};
try{
 await page.goto(url);await page.waitForFunction(()=>window.__moboStudy?.().phase==='ready',{}, {timeout:45000});
 await test('Room-tour approach gradually narrows focus around the featured pendant',async()=>{
  await page.evaluate(()=>{window.__closeupDofTrace=[];window.__closeupDofTracing=true;const sample=()=>{if(!window.__closeupDofTracing)return;const s=window.__moboStudy();window.__closeupDofTrace.push({mode:s.viewer.mode,dof:s.viewer.depthOfField});requestAnimationFrame(sample);};requestAnimationFrame(sample);});
  await page.locator('#tour-start').click();await page.waitForFunction(()=>{const t=window.__moboStudy().tour;return t.index===1&&t.elapsed>=7;},{},{timeout:30000});await page.locator('#tour-pause').click();
  const rows=await page.evaluate(()=>{window.__closeupDofTracing=false;return window.__closeupDofTrace;});assert(rows.every(r=>r.mode==='room'));assert.equal(rows[0].dof.approach,0);assert(rows.at(-1).dof.approach>.99);assert(rows.at(-1).dof.focusRange[1]<3);assert(rows.at(-1).dof.maxRadiusCss<=3.2);
  let largestChange=0;for(let i=1;i<rows.length;i++)largestChange=Math.max(largestChange,Math.abs(rows[i].dof.maxRadiusCss-rows[i-1].dof.maxRadiusCss));assert(largestChange<.2);await writeFile(out+'/approach.json',JSON.stringify(rows));return{frames:rows.length,largestRadiusChange:largestChange};
 });
 await test('Paused room closeup filters real background pixels while leaving the ceramic sharp',async()=>{
  const before=await snap(),on=await page.locator('canvas').screenshot({path:out+'/closeup-on.png'});await page.locator('#dof-toggle').click();await paint();assert.equal((await snap()).viewer.depthOfField.active,false);const off=await page.locator('canvas').screenshot({path:out+'/closeup-off.png'});assert.deepEqual((await snap()).viewer.room.camera,before.viewer.room.camera);
  const a=await sharp(on).removeAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(off).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const difference=([x,y,w,h])=>{let sum=0,n=0;for(let py=Math.floor(y*a.info.height);py<Math.floor((y+h)*a.info.height);py++)for(let px=Math.floor(x*a.info.width);px<Math.floor((x+w)*a.info.width);px++)for(let c=0;c<3;c++){const i=(py*a.info.width+px)*3+c;sum+=Math.abs(a.data[i]-b.data[i]);n++;}return sum/n;};
  const ceramic=difference([.4,.4,.15,.13]),background=difference([.74,.44,.22,.25]);assert(ceramic<.5);assert(background>.5);await page.locator('#dof-toggle').click();await paint();assert((await snap()).viewer.depthOfField.active);assert.equal((await snap()).tour.playing,false);return{ceramicMeanDifference:ceramic,backgroundMeanDifference:background};
 });
 await test('Free fly disables DOF; reset and explicit tour exit recover the wide room',async()=>{
  await page.locator('#explore-room').click();await paint();assert.equal((await snap()).viewer.depthOfField.active,false);await page.locator('#explore-room').click();await paint();assert((await snap()).viewer.depthOfField.active);assert.equal((await snap()).viewer.depthOfField.approach,0);await page.locator('#tour-exit').click();await paint();assert.equal((await snap()).tour.active,false);
 });
 await test('Reduced-motion mobile closeup stays sharp and controls remain usable',async()=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});await page.locator('#tour-start').click();await page.locator('#tour-next').click();await paint();const s=await snap();assert.equal(s.tour.playing,false);assert.equal(s.tour.reducedMotion,true);assert.equal(s.viewer.mode,'room');assert(s.viewer.depthOfField.active);assert(s.viewer.depthOfField.approach>.99);assert(s.viewer.depthOfField.maxRadiusCss<=2.1);await page.screenshot({path:out+'/mobile-closeup.png',fullPage:true});await page.keyboard.press('Escape');await paint();assert.equal((await snap()).tour.active,false);assert.equal((await snap()).viewer.depthOfField.approach,0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 });
 await test('No browser errors',async()=>assert.deepEqual(errors,[]));
}finally{await browser.close();await writeFile(out+'/results.json',JSON.stringify({url,results,errors},null,2));}
if(results.some(r=>r.status==='failed'))process.exitCode=1;
