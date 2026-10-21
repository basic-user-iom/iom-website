import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root=path.resolve(import.meta.dirname,'..');
const qa=process.env.MOBO_QA||path.join(root,'qa/refinement-20261021/lighting');
const url=process.env.MOBO_URL||'http://127.0.0.1:5288';
const baselineRoot=process.env.MOBO_BASELINE_ROOT;
await mkdir(qa,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'});
const page=await browser.newPage({viewport:{width:1440,height:1080}});
const errors=[],results=[];
let gpu;
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const snap=()=>page.evaluate(()=>window.__moboStudy());
const paint=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const settle=async()=>{await page.waitForFunction(()=>window.__moboStudy().viewer.illumination.settling===false,{},{timeout:6000});await paint();};
const slider=async(id,value)=>page.locator(id).evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
const light=async on=>page.locator(`[data-light="${on?'lit':'unlit'}"]`).click();
const cabinet=async on=>{if((await snap()).cabinet.enabled!==on)await page.locator('#cabinet-toggle').click();};
const shot=async name=>page.locator('#stage').screenshot({path:path.join(qa,`${name}.png`)});
const image=async input=>sharp(input).removeAlpha().raw().toBuffer({resolveWithObject:true});
const canvasImage=async()=>image(await page.locator('canvas').screenshot());
const luminance=(r,g,b)=>.2126*r+.7152*g+.0722*b;
function imageStats(im){
 const values=[];
 for(let i=0;i<im.data.length;i+=im.info.channels)values.push(luminance(im.data[i],im.data[i+1],im.data[i+2]));
 values.sort((a,b)=>a-b);
 return {mean:values.reduce((a,b)=>a+b,0)/values.length,median:values[Math.floor(values.length/2)],blackFraction:values.filter(v=>v<5).length/values.length,clippedFraction:values.filter(v=>v>250).length/values.length};
}
function patch(im,ndc,offset={x:0,y:0,width:im.info.width,height:im.info.height}){
 const x=Math.round(offset.x+(ndc[0]+1)/2*offset.width),y=Math.round(offset.y+(1-ndc[1])/2*offset.height);
 assert(x>15&&y>8&&x<im.info.width-15&&y<im.info.height-8,'The table sample is inside the rendered image');
 const values=[];
 for(let yy=y-6;yy<=y+6;yy++)for(let xx=x-13;xx<=x+13;xx++){
  const i=(yy*im.info.width+xx)*im.info.channels;
  values.push(luminance(im.data[i],im.data[i+1],im.data[i+2]));
 }
 return {x,y,mean:values.reduce((a,b)=>a+b,0)/values.length,clippedFraction:values.filter(v=>v>250).length/values.length};
}
async function test(name,fn){
 try{results.push({name,status:'passed',detail:await fn()});console.log('PASS',name);}
 catch(error){results.push({name,status:'failed',error:String(error.stack)});console.log('FAIL',name,String(error));}
}
async function trace({action,duration=1700,interruptAt=null,interruptAction=null}){
 return page.evaluate(async({action,duration,interruptAt,interruptAction})=>{
  const perform=a=>{
   if(a.selector)document.querySelector(a.selector).click();
   else{const el=document.querySelector(a.slider);el.value=String(a.value);el.dispatchEvent(new Event('input',{bubbles:true}));}
  };
  const read=now=>{const s=window.__moboStudy(),i=s.viewer.illumination;return {ms:now,power:i.power,target:i.targetPower,cabinet:i.cabinetPower,cabinetTarget:i.cabinetTargetPower,spot:s.viewer.room.lights,isolated:s.viewer.light.intensity,glow:i.glow,reflections:i.lights.filter(l=>l.name.includes('Table_Reflection')).map(l=>l.intensity),strip:s.viewer.cabinet.stripIntensity,diffuser:s.viewer.cabinet.diffuserIntensity,settling:i.settling};};
  const before=read(0);perform(action);const immediate=read(0),start=performance.now(),frames=[];let interrupted=false;
  await new Promise(resolve=>{
   function tick(now){
    const ms=now-start;
    if(!interrupted&&interruptAt!==null&&ms>=interruptAt){const previous=read(ms);perform(interruptAction);frames.push({interruption:true,before:previous,after:read(ms)});interrupted=true;}
    frames.push(read(ms));if(ms>=duration)resolve();else requestAnimationFrame(tick);
   }
   requestAnimationFrame(tick);
  });
  return {before,immediate,frames};
 },{action,duration,interruptAt,interruptAction});
}
function synchronized(rows,field,keys){
 const actual=rows.filter(r=>!r.interruption&&r[field]>1e-5);
 assert(actual.length>3,'Several intermediate brightness levels are rendered');
 for(const key of keys){
  const value=r=>key==='spot'?r.spot[0]:key==='reflections'?r.reflections[0]:key==='glow'?r.glow?.[0]:r[key];
  assert(Number.isFinite(value(actual[0])),`${key} is observable`);
  const ratio=value(actual[0])/actual[0][field];assert(ratio>0,`${key} contributes light`);
  for(const r of actual)assert(Math.abs(value(r)/r[field]-ratio)<1e-7,`${key} stays synchronized with ${field}`);
 }
}
function gentle(t,field,direction=1){
 assert.equal(t.immediate[field],t.before[field],'A requested change does not jump rendered power');
 const frames=t.frames.filter(r=>!r.interruption);
 const midway=frames.find(r=>r.ms>=180);
 assert(midway&&midway[field]>0&&midway[field]<1,'Light passes through visible intermediate power');
 for(let i=1;i<frames.length;i++){
  const dt=(frames[i].ms-frames[i-1].ms)/1000,delta=frames[i][field]-frames[i-1][field];
  assert(delta*direction>=-1e-6,'A settled on/off fade remains monotonic');
  assert(Math.abs(delta)<=Math.max(.08,dt*4),'No abrupt frame jump');
 }
 return {samples:frames.length,at180ms:midway[field],first:frames[0],last:frames.at(-1)};
}
try{
 await test('Dimmer response is independent of 30/60/144 Hz frame partition and interrupted fades settle exactly',async()=>{
  const source=await readFile(path.join(root,'app/src/smooth-dimmer.ts'),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  const {SmoothDimmer}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
  const rows=[];
  for(const seconds of [.4,.8,1.2]){
   const values=[30,60,144].map(hz=>{const d=new SmoothDimmer();d.setTarget(1);let remaining=seconds;while(remaining>1e-10){const dt=Math.min(1/hz,remaining);d.advance(dt);remaining-=dt;}return{hz,value:d.value};});
   assert(Math.max(...values.map(x=>x.value))-Math.min(...values.map(x=>x.value))<1e-12);rows.push({seconds,values});
  }
  const d=new SmoothDimmer();d.setTarget(1);d.advance(.25);const current=d.value;d.setTarget(0);assert.equal(d.value,current);d.advance(.01);assert(Math.abs(d.value-current)<.04);
  for(let i=0;i<240;i++)d.advance(1/60);assert.equal(d.value,0);assert.equal(d.moving,false);d.advance(10);assert.equal(d.value,0);
  return {rows,interruptedFrom:current,settled:d.value,moving:d.moving};
 });
 await page.goto(url);await page.waitForFunction(()=>window.__moboStudy?.().phase==='ready',{},{timeout:45000});await settle();
 gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION)};});
 await page.locator('[data-finish="reference-white"]').click();await cabinet(false);await settle();
 await test('Physical pendant pool grows across 0, 25, 50 and 100 percent with fixed exposure and readable surface detail',async()=>{
  const scenes=[];
  for(const time of [0,100]){
   await slider('#time-slider',time);
   const rows=[];
   for(const power of [0,25,50,100]){
    await light(power>0);await slider('#brightness-slider',power);await settle();
    const s=await snap(),im=await canvasImage(),patches=s.viewer.tableHits.map(h=>patch(im,h.targetNdc));
    assert.equal(s.viewer.illumination.exposure,1);assert.equal(s.viewer.illumination.power,power/100);assert.equal(s.viewer.illumination.targetPower,power/100);
    assert(s.viewer.tableHits.every(h=>h.point&&Math.abs(h.point[1]-s.viewer.illumination.table.top)<.015),'Both beams reach the actual table');
    const name=`room-${time?'night':'day'}-${power}`;await shot(name);
    rows.push({name,power,patches,image:imageStats(im),state:s});
   }
   for(let lamp=0;lamp<2;lamp++){
    for(let i=1;i<rows.length;i++)assert(rows[i].patches[lamp].mean>rows[i-1].patches[lamp].mean+.5,`Lamp ${lamp+1}: ${rows[i].power}% is visibly brighter on the table`);
    assert(rows[3].patches[lamp].mean-rows[0].patches[lamp].mean>8,'Pendant changes table pixels clearly');
    assert(rows[3].patches[lamp].clippedFraction<.1,'The brightest table pool retains tonal detail');
   }
   scenes.push({time,rows});
  }
  await writeFile(path.join(qa,'pool-states.json'),JSON.stringify(scenes,null,2));
  if(baselineRoot){
   const baseline=JSON.parse(await readFile(path.join(baselineRoot,'states.json'),'utf8'));
   const canvas=await page.locator('canvas').boundingBox(),stage=await page.locator('#stage').boundingBox();
   const offset={x:canvas.x-stage.x,y:canvas.y-stage.y,width:canvas.width,height:canvas.height};
   const comparison=[];
   for(const scene of scenes){
    const row=scene.rows[3],old=baseline.states.find(s=>s.name===row.name);
    assert(old,`Baseline ${row.name} is available`);
    const im=await image(await readFile(path.join(baselineRoot,`${row.name}.png`)));
    const previous=old.state.viewer.tableHits.map(h=>patch(im,h.targetNdc,offset));
    for(let j=0;j<2;j++)assert(row.patches[j].mean>previous[j].mean+1,`Lamp ${j+1} full-power pool is stronger than before at ${scene.time}% night`);
    comparison.push({name:row.name,before:previous,after:row.patches});
   }
   return {scenes:scenes.map(s=>({time:s.time,rows:s.rows.map(({state,...r})=>r)})),comparison};
  }
  return {scenes:scenes.map(s=>({time:s.time,rows:s.rows.map(({state,...r})=>r)})),baseline:'Not supplied; set MOBO_BASELINE_ROOT for before/after assertions.'};
 });
 await test('Night exterior/fill reveals the room without losing day/night distinction or changing exposure',async()=>{
  const rows=[];
  for(const time of [0,35,50,75,100]){
   await slider('#time-slider',time);await light(false);await cabinet(false);await settle();
   const s=await snap(),stats=imageStats(await canvasImage());assert.equal(s.viewer.illumination.exposure,1);
   rows.push({time,stats,illumination:s.viewer.illumination,moon:s.viewer.moonlight});
  }
  assert.equal(rows[0].moon.intensity,0);assert(rows[4].moon.intensity>.45,'Night exterior source is stronger than the previous .45');
  assert(rows[4].stats.mean>10&&rows[4].stats.median>5,'Night room remains readable with both artificial light groups off');
  assert(rows[0].stats.mean>rows[4].stats.mean+15,'Day remains clearly brighter than night');
  assert.equal(rows[4].illumination.lights.find(l=>l.name==='Room_Sun').intensity,0,'Day sun still fades out');
  assert(rows[4].illumination.lights.some(l=>/fill|bounce/i.test(l.name)&&l.intensity>0),'A restrained night fill remains available');
  if(baselineRoot){const old=imageStats(await image(await readFile(path.join(baselineRoot,'room-night-0.png'))));assert(rows[4].stats.mean>old.mean+3,'Night is visibly brighter than baseline');rows[4].baseline=old;}
  await shot('moon-and-fill-only');return rows;
 });
 await test('Pendant switch fades actual light, reflection and emissive surfaces together, then settles exactly off',async()=>{
  await slider('#brightness-slider',100);await light(false);await settle();
  const on=await trace({action:{selector:'[data-light="lit"]'}}),onDetail=gentle(on,'power');synchronized(on.frames,'power',['spot','isolated','reflections','glow']);await settle();assert.equal((await snap()).viewer.illumination.power,1);
  const off=await trace({action:{selector:'[data-light="unlit"]'}}),offDetail=gentle(off,'power',-1);synchronized(off.frames,'power',['spot','isolated','reflections','glow']);await settle();const s=await snap();
  assert.equal(s.state.lit,false);assert.equal(s.viewer.illumination.power,0);assert.equal(s.viewer.light.intensity,0);assert(s.viewer.room.lights.every(v=>v===0));assert(s.viewer.illumination.glow.every(v=>v===0));
  await writeFile(path.join(qa,'pendant-fade-trace.json'),JSON.stringify({on,off},null,2));return {on:onDetail,off:offDetail};
 });
 await test('Interrupted pendant and brightness changes restart continuously from current power',async()=>{
  await light(false);await slider('#brightness-slider',100);await settle();
  const reverse=await trace({action:{selector:'[data-light="lit"]'},interruptAt:220,interruptAction:{selector:'[data-light="unlit"]'}});
  const turn=reverse.frames.find(r=>r.interruption);assert(turn&&turn.before.power>0&&turn.before.power<1);assert.equal(turn.before.power,turn.after.power,'Reversal does not reset to zero');await settle();assert.equal((await snap()).viewer.illumination.power,0);
  await light(true);await settle();
  const dimmer=await trace({action:{slider:'#brightness-slider',value:20},interruptAt:220,interruptAction:{slider:'#brightness-slider',value:65}});
  const change=dimmer.frames.find(r=>r.interruption);assert(change&&change.before.power>.2&&change.before.power<1);assert.equal(change.before.power,change.after.power);await settle();assert.equal((await snap()).viewer.illumination.power,.65);
  await writeFile(path.join(qa,'interruption-trace.json'),JSON.stringify({reverse,dimmer},null,2));return {switchAt:turn,brightnessAt:change};
 });
 await test('Cabinet light and diffuser fade together while the existing pendant intensity remains unchanged',async()=>{
  await cabinet(false);await slider('#cabinet-brightness',100);await settle();const pendant=(await snap()).viewer.illumination.power;
  const on=await trace({action:{selector:'#cabinet-toggle'}}),onDetail=gentle(on,'cabinet');synchronized(on.frames,'cabinet',['strip','diffuser']);for(const f of on.frames)assert.equal(f.power,pendant);
  await settle();assert.equal((await snap()).viewer.illumination.cabinetPower,1);
  const off=await trace({action:{selector:'#cabinet-toggle'}}),offDetail=gentle(off,'cabinet',-1);synchronized(off.frames,'cabinet',['strip','diffuser']);await settle();const s=await snap();
  assert.equal(s.viewer.illumination.cabinetPower,0);assert.equal(s.viewer.cabinet.stripIntensity,0);assert.equal(s.viewer.cabinet.diffuserIntensity,0);assert.equal(s.viewer.illumination.power,pendant);
  return {on:onDetail,off:offDetail,retainedPendantPower:pendant};
 });
 await test('Manual lamp controls, mode changes, reset and mobile framing survive dimmer updates',async()=>{
  await page.locator('#view-toggle').click();const before=await snap();await page.locator('[data-camera="right"]').click();await page.locator('[data-camera="in"]').click();const moved=await snap();assert.notDeepEqual(moved.viewer.camera,before.viewer.camera);
  await slider('#brightness-slider',42);await settle();assert.deepEqual((await snap()).viewer.camera,moved.viewer.camera);
  await page.locator('#view-toggle').click();await page.locator('[data-camera="reset"]').click();assert.equal((await snap()).lighting.brightness,.42);await page.locator('#view-toggle').click();assert.deepEqual((await snap()).viewer.camera,moved.viewer.camera);
  await page.locator('[data-camera="reset"]').click();assert.deepEqual((await snap()).viewer.camera,before.viewer.camera);await page.locator('#view-toggle').click();
  for(const [width,height] of [[390,844],[844,390]]){
   await page.setViewportSize({width,height});await paint();const s=await snap();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));for(const corners of s.viewer.room.projectedLamps)for(const p of corners)assert(Math.abs(p[0])<1&&Math.abs(p[1])<1,'Both lamps remain in frame');await page.screenshot({path:path.join(qa,`mobile-${width}x${height}.png`),fullPage:true});
  }
  await settle();const count=(await snap()).viewer.renders;await page.waitForTimeout(400);assert.equal((await snap()).viewer.renders,count,'Settled scene stops scheduling frames');
  return {idleFrames:(await snap()).viewer.renders-count};
 });
 await test('No browser errors',async()=>assert.deepEqual(errors,[]));
}finally{
 await browser.close();await writeFile(path.join(qa,'lighting-results.json'),JSON.stringify({date:new Date().toISOString(),url,gpu,results,errors},null,2));
}
console.log(JSON.stringify({passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length}));
if(results.some(r=>r.status==='failed'))process.exitCode=1;
