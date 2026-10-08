import fs from 'node:fs';import assert from 'node:assert/strict';import{chromium}from'playwright';
const dir='../../evidence/dropdowns-v9-1';fs.mkdirSync(dir,{recursive:true});
const before=process.argv.includes('--before'),built=process.argv.includes('--built');
const label=before?'before':built?'built':'after';
const browser=await chromium.launch({channel:'msedge',headless:true});const p=await browser.newPage({viewport:{width:1400,height:900}});const errors=[];p.on('pageerror',e=>errors.push(String(e)));
await p.addInitScript(()=>sessionStorage.setItem('building-viewer-demo-unlocked','1'));
try{
 await p.goto(before||built?'http://127.0.0.1:5204/demos/icm-building/index.html':'http://127.0.0.1:5204/');
 await p.waitForFunction(()=>document.querySelector('.bv-loading')?.classList.contains('hidden')&&!window.__iomBuildingViewer.orbit.isAnimating(),{},{timeout:180000});
 const labels=['Seat LOD','Foot placement','Walking speed','Review location'];
 const hits=await p.locator('#viewer-ui select').evaluateAll(ss=>ss.slice(0,4).map(s=>{const r=s.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{label:s.getAttribute('aria-label'),pointerEvents:getComputedStyle(s).pointerEvents,hit:hit?.tagName,hitId:hit?.id,reachable:hit===s}}));
 console.log('Hit testing',hits);
 if(before){assert.ok(hits.every(h=>!h.reachable&&h.pointerEvents==='none'));fs.writeFileSync(`${dir}/${label}.json`,JSON.stringify({hits,errors},null,2));}
 else{
 assert.ok(hits.every(h=>h.reachable&&h.pointerEvents==='auto'));
 assert.equal(await p.evaluate(()=>window.__iomBuildingViewer.controller.params.walkSpeed),1.6);
 await p.evaluate(()=>{const v=window.__iomBuildingViewer;v.cancelThumbnailTask();v.modelAnim.stop();v.orbit.setEnabled(false);v.controller.setFeetPosition(v.controller.position.clone().set(-55,6,38),0);v.collision.setPlacementMode(false);v.collision.setQueryLayer('icm-anim-2025');v.walk.activate(false);v.controller.yaw=0;v.mode='walk';for(let i=0;i<60;i++)v.walk.update(1/60);window.__menuClicks=[];document.addEventListener('pointerdown',e=>window.__menuClicks.push({tag:e.target.tagName,label:e.target.getAttribute('aria-label')}),true)});
 await p.locator('canvas').click({position:{x:1250,y:730}});
 await p.waitForFunction(()=>!!document.pointerLockElement);
 await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.pointerLockElement);
 const selections=[];
 for(const name of labels){
 const select=p.getByLabel(name,{exact:true});
 await select.click();await p.keyboard.press('Home');await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');
 const state=await p.evaluate(()=>{const v=window.__iomBuildingViewer;return{active:document.activeElement?.getAttribute('aria-label'),values:[...document.querySelectorAll('#viewer-ui select')].slice(0,4).map(s=>s.value),seatMode:v.reviewSeats.mode,footIK:v.character.footIKEnabled,speed:v.controller.params.walkSpeed,mode:v.mode,locked:!!document.pointerLockElement}});
 assert.equal(state.active,name);assert.equal(state.locked,false);
 if(name==='Seat LOD')assert.equal(state.seatMode,'lod0');
 if(name==='Foot placement')assert.equal(state.footIK,false);
 if(name==='Walking speed')assert.equal(state.speed,.35);
 if(name==='Review location'){assert.equal(state.values[3],'1');assert.equal(state.mode,'orbit');}
 else{
  const start=await p.evaluate(()=>window.__iomBuildingViewer.controller.position.toArray());
  await p.keyboard.down('w');await p.waitForTimeout(300);await p.keyboard.up('w');
  const movement=await p.evaluate(start=>{const v=window.__iomBuildingViewer;return{delta:v.controller.position.distanceTo(v.controller.position.clone().fromArray(start)),keys:[...v.walk.keys]}},start);
  assert.ok(movement.delta<1e-5,JSON.stringify(movement));assert.equal(movement.keys.length,0);state.movement=movement;
 }
 selections.push({name,...state});
 }
 const clicks=await p.evaluate(()=>window.__menuClicks);for(const name of labels)assert.ok(clicks.some(c=>c.tag==='SELECT'&&c.label===name));
 await p.screenshot({path:`${dir}/${label}.png`});assert.deepEqual(errors,[]);
 fs.writeFileSync(`${dir}/${label}.json`,JSON.stringify({hits,selections,clicks,errors},null,2));console.log(JSON.stringify({selections,errors},null,2));
 }
}finally{await browser.close()}
