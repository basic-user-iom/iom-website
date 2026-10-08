import fs from 'node:fs';import assert from 'node:assert/strict';import{chromium}from'playwright';
const dir='../../evidence/teleport-v11.1',routes=JSON.parse(fs.readFileSync(dir+'/candidate-v11-routes.json','utf8'));
const report={date:new Date().toISOString(),mode:'native keyboard, actual rendered frames',results:[],errors:[]};
const save=()=>fs.writeFileSync(dir+'/native-rendered-tests.json',JSON.stringify(report,null,2));
const b=await chromium.launch({channel:'msedge',headless:true}),p=await b.newPage({viewport:{width:1400,height:900}});p.on('pageerror',e=>report.errors.push(String(e)));await p.addInitScript(()=>sessionStorage.setItem('building-viewer-demo-unlocked','1'));
try{
 await p.goto('http://127.0.0.1:5204/demos/icm-building/index.html');await p.waitForFunction(()=>document.querySelector('.bv-loading')?.classList.contains('hidden')&&!window.__iomBuildingViewer.orbit.isAnimating(),{},{timeout:180000});
 for(const route of routes)for(const up of [true,false]){
  const id=route.id+(up?':up':':down'),name=route.label.slice(0,4)+(up?'-up':'-down');
  await p.evaluate(async id=>{
   const v=window.__iomBuildingViewer,c=v.controller,t=v.stairTeleports;v.cancelThumbnailTask();v.exitWalk();v.modelAnim.stop();v.collision.setPlacementMode(false);
   const portal=t.portals.find(p=>p.id===id),start=portal.point.clone();start.x+=Math.sin(portal.approachYaw)*1.4;start.z+=Math.cos(portal.approachYaw)*1.4;
   await v.handlePegmanDrop({ok:true,point:start,layerId:portal.layerId});v.cancelThumbnailTask();c.params.walkSpeed=1;c.yaw=portal.approachYaw;v.walk.cameraMode='thirdPerson';v.walk.presentation.reset(c.position,c.yaw);
   window.qaPortal=portal;window.qaStartTime=performance.now();window.qaTransfers=[];
   const original=v.walk.teleportTo.bind(v.walk);window.qaOriginalTeleport=original;
   v.walk.teleportTo=(feet,yaw)=>{const before=c.position.toArray();original(feet,yaw);window.qaTransfers.push({before,after:c.position.toArray(),velocity:c.velocity.toArray(),onGround:c.onGround,at:performance.now()})};
  },id);
  await p.waitForTimeout(250);if(up)await p.screenshot({path:dir+'/'+name+'-circle.png'});
  await p.mouse.click(980,460);await p.keyboard.down('w');
  await p.waitForFunction(()=>window.__iomBuildingViewer.stairTeleports.effect.active,{},{timeout:15000});
  await p.waitForFunction(()=>{const v=window.__iomBuildingViewer;return window.qaTransfers.length===1&&!v.stairTeleports.effect.active&&v.controller.onGround},{},{timeout:15000});
  const before=await p.evaluate(()=>({feet:window.__iomBuildingViewer.controller.position.toArray(),at:performance.now()}));
  await p.waitForTimeout(2150);
  const standing=await p.evaluate(before=>{const v=window.__iomBuildingViewer,c=v.controller;return {seconds:(performance.now()-before.at)/1000,drift:c.position.distanceTo(c.position.clone().fromArray(before.feet)),onGround:c.onGround,animation:v.modelAnim.getState(),ready:v.stairTeleports.readyPortals.length,feet:c.position.toArray(),floor:v.floorZones.getStats(),materialRestored:v.stairTeleports.effect.saved.length===0,overlayHidden:v.stairTeleports.effect.veil.style.display==='none'}},before);
  await p.keyboard.up('w');await p.screenshot({path:dir+'/'+name+'-arrival.png'});
  await p.keyboard.down('w');await p.waitForFunction(pos=>{const c=window.__iomBuildingViewer.controller;return c.position.distanceTo(c.position.clone().fromArray(pos))>=1.01},before.feet,{timeout:15000});await p.keyboard.up('w');
  const exit=await p.evaluate(before=>{const c=window.__iomBuildingViewer.controller;return{distance:c.position.distanceTo(c.position.clone().fromArray(before.feet)),heightError:Math.abs(c.position.y-before.feet[1]),onGround:c.onGround}},before);
  await p.keyboard.down('s');await p.waitForFunction(()=>{const v=window.__iomBuildingViewer;return window.qaTransfers.length===2&&!v.stairTeleports.effect.active},{},{timeout:15000});await p.keyboard.up('s');
  const returned=await p.evaluate(()=>{const v=window.__iomBuildingViewer;v.walk.teleportTo=window.qaOriginalTeleport;return {error:v.controller.position.distanceTo(window.qaPortal.point),onGround:v.controller.onGround,transfers:window.qaTransfers}});
  report.results.push({id,name,standing,exit,returned});save();console.log(name,standing.seconds,standing.drift,exit.distance,returned.error);
  assert.ok(standing.seconds>=2&&standing.drift<.005&&standing.onGround&&standing.materialRestored&&standing.overlayHidden&&standing.ready===144&&standing.animation.time===0&&!standing.animation.playing);
  assert.ok(exit.distance>=1&&exit.heightError<.02&&exit.onGround&&returned.error<.015&&returned.onGround);
 }
 assert.deepEqual(report.errors,[]);report.passed=true;save();
}finally{save();await b.close()}
