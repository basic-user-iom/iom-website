import {chromium} from 'playwright';
import {Color} from 'three';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..'),qa=process.env.MOBO_QA||path.join(root,'qa/refinement-20261021/finish');
const url=process.env.MOBO_URL||'http://127.0.0.1:5288';
await mkdir(qa,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage({viewport:{width:1440,height:1080}});
const errors=[],results=[];let gpu;
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const snap=()=>page.evaluate(()=>window.__moboStudy());
const paint=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const settle=async()=>{await page.waitForFunction(()=>{const v=window.__moboStudy().viewer;return v.finishTransition&&!v.finishTransition.active&&!v.illumination.settling;},{},{timeout:6000});await paint();};
const choose=async id=>{await page.locator(`[data-finish="${id}"]`).click();await settle();};
const test=async(name,fn)=>{try{results.push({name,status:'passed',detail:await fn()});console.log('PASS',name);}catch(error){results.push({name,status:'failed',error:String(error.stack)});console.log('FAIL',name,String(error));}};
const colorsEqual=(a,b)=>a.every((value,index)=>Math.abs(value-b[index])<1e-12);
const originals=JSON.parse(await readFile(path.join(root,'app/public/assets/finish-materials.json'),'utf8')).finishes;
const expected=originals.map(f=>({id:f.id,color:f.actualExportedMaterial.pbrMetallicRoughness.baseColorFactor.slice(0,3),roughness:f.actualExportedMaterial.pbrMetallicRoughness.roughnessFactor,metalness:f.actualExportedMaterial.pbrMetallicRoughness.metallicFactor,clearcoat:f.actualExportedMaterial.extensions.KHR_materials_clearcoat.clearcoatFactor,clearcoatRoughness:f.actualExportedMaterial.extensions.KHR_materials_clearcoat.clearcoatRoughnessFactor,normalScale:[f.actualExportedMaterial.normalTexture.scale,-f.actualExportedMaterial.normalTexture.scale]}));
for(const [id,color,roughness,clearcoat,clearcoatRoughness,normal] of [['reference-white','#efeeeb',.39,.10,.30,.12],['reference-black','#171819',.20,.32,.15,.34],['reference-olive','#65704b',.22,.32,.16,.29],['reference-terracotta','#b65330',.34,.15,.27,.18]])expected.push({id,color:new Color(color).toArray(),roughness,metalness:0,clearcoat,clearcoatRoughness,normalScale:[normal,-normal]});
function match(s,id){
 const e=expected.find(f=>f.id===id),m=s.viewer.materials.Ceramic_Exterior,c=s.viewer.cordTextile,white=id==='shell-white'||id==='reference-white',black=id==='reference-black';
 assert.equal(s.state.finish,id);assert.equal(s.viewer.finishTransition.target,id);assert.equal(s.viewer.finishTransition.active,false);
 for(const key of ['color','roughness','metalness','clearcoat','clearcoatRoughness','normalScale']){
  // Reference hex colors are converted by browser and Node Math.pow, which may
  // differ at the last floating-point bit. Authored exported arrays remain exact.
  if(key==='color'&&id.startsWith('reference-'))assert(colorsEqual(m.color,e.color),`${id}: linear reference color`);
  else assert.deepEqual(m[key],e[key],`${id}: exact ${key}`);
 }
 assert.equal(m.opacity,1);assert.equal(m.transparent,false);assert.equal(m.transmission,0);assert.deepEqual(m.emissive,[0,0,0]);
 assert.equal(c.color,white?'f3f1ee':'b3a08a');assert.equal(c.grip.color,white?'e6e6e6':black?'151619':'c3a265');assert.equal(c.grip.metalness,white?.98:black?.8:.85);assert.equal(c.grip.roughness,white?.13:black?.17:.22);
 assert(c.triangleCountPreserved);assert(s.viewer.room.sharedReviewedGeometry);assert(s.viewer.room.sharedGlaze);assert.equal(c.maps.length,3);
 return {finish:id,material:m,cord:c.color,grip:c.grip};
}
async function trace(target,interruptions=[]){
 return page.evaluate(async({target,interruptions})=>{
  const read=ms=>{const s=window.__moboStudy();return{ms,target:s.state.finish,transition:s.viewer.finishTransition,material:s.viewer.materials.Ceramic_Exterior,cord:s.viewer.cordTextile,light:s.viewer.light,illumination:s.viewer.illumination,camera:s.viewer.camera,roomCamera:s.viewer.room.camera};};
  const select=id=>document.querySelector(`[data-finish="${id}"]`).click();
  const before=read(0);select(target);const immediate=read(0),frames=[],changes=[],start=performance.now();let index=0;
  await new Promise(resolve=>{function tick(now){const ms=now-start;if(index<interruptions.length&&ms>=interruptions[index].ms){const before=read(ms);select(interruptions[index].id);changes.push({before,after:read(ms)});index++;}frames.push(read(ms));if(ms>=1100)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);});
  return{before,immediate,frames,changes};
 },{target,interruptions});
}
const image=async buffer=>sharp(buffer).removeAlpha().raw().toBuffer({resolveWithObject:true});
function difference(a,b){assert.deepEqual(a.info,b.info);let total=0,changed=0;for(let i=0;i<a.data.length;i++){const d=Math.abs(a.data[i]-b.data[i]);total+=d;if(d>3)changed++;}return{mean:total/a.data.length,changed};}
try{
 await page.goto(url);await page.waitForFunction(()=>window.__moboStudy?.().phase==='ready',{},{timeout:45000});await settle();
 gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION)};});
 await test('Seven finishes settle to exact reviewed ceramic, cord and grip values',async()=>{const rows=[];for(const e of expected){await choose(e.id);rows.push(match(await snap(),e.id));}return rows;});
 await test('Finish choice blends through visible intermediate materials without changing camera or lighting',async()=>{
  await choose('reference-white');const t=await trace('reference-black');assert.deepEqual(t.immediate.material,t.before.material);assert.deepEqual(t.immediate.cord,t.before.cord);assert(t.immediate.transition.active);assert.equal(t.immediate.transition.target,'reference-black');
  const end=t.frames.at(-1),middle=t.frames.filter(r=>r.transition.active&&r.ms>60&&r.ms<450);assert(middle.length>=3,'Several material values are displayed during the half-second fade');
  for(const r of middle){assert(!colorsEqual(r.material.color,t.before.material.color));assert(!colorsEqual(r.material.color,end.material.color));for(let i=0;i<3;i++)assert(r.material.color[i]>end.material.color[i]&&r.material.color[i]<t.before.material.color[i]);assert.equal(r.material.opacity,1);assert.equal(r.material.transparent,false);}
  for(const r of t.frames){assert.deepEqual(r.light,t.before.light);assert.deepEqual(r.illumination,t.before.illumination);assert.deepEqual(r.camera,t.before.camera);assert.deepEqual(r.roomCamera,t.before.roomCamera);}
  const lastMoving=t.frames.findLast(r=>r.transition.active);assert(lastMoving.ms>=350&&lastMoving.ms<650,'Transition takes roughly half a second');await writeFile(path.join(qa,'finish-frame-trace.json'),JSON.stringify(t,null,2));await settle();match(await snap(),'reference-black');return{frames:t.frames.length,intermediateFrames:middle.length,lastMovingMs:lastMoving.ms,duration:t.immediate.transition.duration};
 });
 await test('Interrupted rapid choices continue from displayed appearance and converge to the newest target',async()=>{
  await choose('reference-white');const t=await trace('reference-black',[{ms:150,id:'reference-olive'},{ms:280,id:'reference-terracotta'}]);
  assert.equal(t.changes.length,2);for(const change of t.changes){assert.deepEqual(change.after.material,change.before.material);assert.deepEqual(change.after.cord,change.before.cord);assert(change.after.transition.active);}
  await settle();match(await snap(),'reference-terracotta');await page.evaluate(()=>{const buttons=[...document.querySelectorAll('[data-finish]')];for(let i=0;i<75;i++)buttons[i%buttons.length].click();document.querySelector('[data-finish="midnight-green"]').click();});await settle();match(await snap(),'midnight-green');await page.waitForTimeout(650);match(await snap(),'midnight-green');await writeFile(path.join(qa,'finish-retarget-trace.json'),JSON.stringify(t,null,2));return{interruptions:t.changes.map(c=>({ms:c.after.ms,target:c.after.target,color:c.after.material.color})),final:'midnight-green'};
 });
 await test('Actual rendered midpoint differs from both endpoints without geometry disappearance',async()=>{
  if((await snap()).viewMode==='room')await page.locator('#view-toggle').click();await choose('reference-white');
  const beforeBuffer=await page.locator('canvas').screenshot({path:path.join(qa,'finish-white.png')}),before=await image(beforeBuffer);
  await page.locator('[data-finish="reference-black"]').click();await page.waitForFunction(()=>{const t=window.__moboStudy().viewer.finishTransition;return t.active&&t.progress>=.3&&t.progress<=.75;},{},{timeout:2000,polling:'raf'});
  const middleState=await snap(),middleBuffer=await page.locator('canvas').screenshot({path:path.join(qa,'finish-midpoint.png')}),middle=await image(middleBuffer);await settle();const afterBuffer=await page.locator('canvas').screenshot({path:path.join(qa,'finish-black.png')}),after=await image(afterBuffer);
  const first=difference(before,middle),last=difference(middle,after);assert(first.changed>1000&&last.changed>1000,'Both halves produce a real image change');assert.equal(middleState.viewer.materials.Ceramic_Exterior.opacity,1);assert.equal(middleState.viewer.materials.Ceramic_Exterior.transparent,false);assert(middleState.viewer.room.sharedReviewedGeometry);return{progress:middleState.viewer.finishTransition.progress,beforeToMiddle:first,middleToAfter:last};
 });
 await test('Reset, mode switching and repeated selections preserve finish and rendering settles idle',async()=>{
  await choose('reference-olive');const s=await snap();await page.locator('[data-camera="right"]').click();await page.locator('[data-camera="reset"]').click();match(await snap(),'reference-olive');await page.locator('#view-toggle').click();await page.locator('#view-toggle').click();await settle();const now=await snap();match(now,'reference-olive');assert.deepEqual(now.viewer.memory,s.viewer.memory);await page.waitForTimeout(150);const renders=(await snap()).viewer.renders;await page.waitForTimeout(400);assert.equal((await snap()).viewer.renders,renders);assert.equal(await page.locator('canvas').count(),1);return{renders,geometryShared:now.viewer.room.sharedReviewedGeometry};
 });
 await test('No browser errors',async()=>assert.deepEqual(errors,[]));
}finally{await browser.close();await writeFile(path.join(qa,'finish-results.json'),JSON.stringify({date:new Date().toISOString(),url,gpu,results,errors},null,2));}
console.log(JSON.stringify({passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length}));if(results.some(r=>r.status==='failed'))process.exitCode=1;
