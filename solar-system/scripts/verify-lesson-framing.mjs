import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const out='tmp/share-learn';await mkdir(out,{recursive:true});const results=[];
for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch();try{
 for(const [width,height]of [[1366,768],[390,844],[667,320]]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SOLAR_SYSTEM_REVIEW_URL??'http://127.0.0.1:5194/demos/solar-system/');await page.getByTestId('startup-screen').waitFor({state:'hidden',timeout:90000});
  for(const[id,count]of [['sizes',7],['seasons',5],['moon',6]]){
   await page.getByTestId('learn-start').click();await page.getByTestId('learn-'+id).click();
   for(let step=0;step<count;step++){
    await page.waitForTimeout(500);
    const data=await page.locator('canvas').evaluate(c=>({framing:c.dataset.lessonFraming,x:Number(c.dataset.selectedScreenX),y:Number(c.dataset.selectedScreenY),radius:Number(c.dataset.selectedRadiusPx),w:c.clientWidth,h:c.clientHeight}));
    assert.ok(data.w>40&&data.h>40,JSON.stringify(data));assert.ok(Math.abs(data.x/data.w-.5)<.06||id==='moon',JSON.stringify(data));assert.ok(Math.abs(data.y/data.h-.5)<.06||id==='moon',JSON.stringify(data));
    if(data.framing==='body'||data.framing==='seasons')assert.ok(data.radius/Math.min(data.w,data.h)>.24&&data.radius/Math.min(data.w,data.h)<.48,JSON.stringify(data));
    if(id==='moon'){assert.equal(await page.getByTestId('body-label-earth').isVisible(),true);assert.equal(await page.getByTestId('body-label-moon').isVisible(),true);}
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(name==='chromium')await page.screenshot({path:`${out}/${name}-${width}-${id}-${step}.png`});
    if(name==='webkit'&&step===0){await page.getByTestId('share-view').click();await page.getByTestId('prepare-scene-image').click();await page.getByTestId('download-scene-image').waitFor();const d=page.waitForEvent('download');await page.getByTestId('download-scene-image').click();await(await d).saveAs(`${out}/${name}-${width}-${id}-export.png`);await page.getByRole('button',{name:'Close: Share & save view'}).click();}
    results.push({name,width,height,id,step,...data});
    if(step<count-1)await page.getByRole('button',{name:'Next',exact:true}).click();
   }
   await page.getByTestId('lesson-exit').click();await page.getByTestId('learn-start').waitFor();
  }
  assert.deepEqual(errors,[]);await page.close();console.log(name,width,'all lesson frames passed');
 }
 }finally{await browser.close();}
}
await writeFile(`${out}/camera-results.json`,JSON.stringify(results,null,2));
