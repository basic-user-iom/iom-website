import fs from 'node:fs';import assert from 'node:assert/strict';import{chromium}from'playwright';
const dir='../../evidence/teleport-v10';fs.mkdirSync(dir,{recursive:true});const built=process.argv.includes('--built'),tag=built?'built':'dev';
const b=await chromium.launch({channel:'msedge',headless:true}),p=await b.newPage({viewport:{width:1440,height:940}});const errors=[];p.on('pageerror',e=>errors.push(String(e)));await p.addInitScript(()=>sessionStorage.setItem('building-viewer-demo-unlocked','1'));
try{
 await p.goto(built?'http://127.0.0.1:5204/demos/icm-building/index.html':'http://127.0.0.1:5204/');await p.waitForFunction(()=>document.querySelector('.bv-loading')?.classList.contains('hidden')&&!window.__iomBuildingViewer.orbit.isAnimating(),{},{timeout:180000});
 const report=await p.evaluate(()=>{
 const v=window.__iomBuildingViewer,c=v.controller,w=v.collision,t=v.stairTeleports,walk=v.walk;v.cancelThumbnailTask();v.modelAnim.stop();v.mode='orbit';v.orbit.setEnabled(false);w.setPlacementMode(false);const results=[];
 const keyup=code=>window.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));
 const keydown=(code,repeat=false)=>window.dispatchEvent(new KeyboardEvent('keydown',{code,repeat,bubbles:true}));
 const step=()=>{w.beginFrame();w.setFocus(c.position);walk.update(1/60);t.update(true)};
 const start=(portal,speed)=>{
  walk.deactivate();t.update(false);document.activeElement?.blur();const direction=portal.destination.clone().sub(portal.point).setY(0).normalize();
  const approach=portal.point.clone().addScaledVector(direction,-1.25);w.setQueryLayer(speed>2?'icm-ext':'icm-anim-2025');w.setFocus(approach);c.params.walkSpeed=speed;c.setFeetPosition(approach);for(let i=0;i<8;i++)c.update(1/60,direction.clone().set(0,0,0),0);
  walk.activate(false);c.yaw=Math.atan2(-direction.x,-direction.z);walk.presentation.reset(c.position,c.yaw);walk.cameraMode=speed>2?'firstPerson':'thirdPerson';step();
 };
 const travel=(code,destination)=>{keydown(code);let frames=0;for(;frames<220;frames++){step();if(c.position.distanceTo(destination)<.01)break}return frames};
 for(const up of t.portals.filter(p=>p.up))for(const speed of [1.6,6.5]){
  start(up,speed);const active=t.readyPortals.length;const upFrames=travel('KeyW',up.destination);const atTop=c.position.clone();const groundedTop=c.onGround;const pose= v.character.current;
  const cameraError=walk.cameraFocus.distanceTo(c.position);const visualError=v.character.root.position.distanceTo(c.position);
  for(let i=0;i<180;i++){if(i%20===0)keydown('KeyW',true);step()}
  const heldDrift=c.position.distanceTo(atTop);keyup('KeyW');
  // Walk out of the arrival ring, then back in without resetting the gate.
  keydown('KeyW');let exitFrames=0;for(;exitFrames<180;exitFrames++){step();if(c.position.distanceTo(atTop)>1.05)break}keyup('KeyW');
  const exitDistance=c.position.distanceTo(atTop);const downFrames=travel('KeyS',up.point);const atBottom=c.position.clone();const groundedBottom=c.onGround;
  for(let i=0;i<120;i++)step();const bottomDrift=c.position.distanceTo(atBottom);keyup('KeyS');
  results.push({id:up.route.id,speed,active,upFrames,downFrames,topError:atTop.distanceTo(up.destination),bottomError:atBottom.distanceTo(up.point),groundedTop,groundedBottom,pose,cameraError,visualError,heldDrift,exitDistance,bottomDrift});
 }
 // Do not teleport if the target support disappears after marker preparation.
 const portal=t.portals[0];start(portal,1.6);const ray=w.raycastBestGround.bind(w);w.raycastBestGround=(origin,...args)=>Math.hypot(origin.x-portal.destination.x,origin.z-portal.destination.z)<1?null:ray(origin,...args);
 let invalid;try{keydown('KeyW');for(let i=0;i<28;i++)step();keyup('KeyW');invalid={height:c.position.y,blocked:Math.abs(c.position.y-portal.point.y)<.1}}finally{w.raycastBestGround=ray}
 t.update(false);const hiddenInOrbit=!t.root.visible;
 return{results,invalid,hiddenInOrbit,portals:t.readyPortals.map(p=>({id:p.id,point:p.point.toArray(),destination:p.destination.toArray(),radius:p.radius}))};
 });
 fs.writeFileSync(`${dir}/${tag}.json`,JSON.stringify({...report,errors},null,2));console.log(JSON.stringify(report,null,2));
 for(const r of report.results){assert.equal(r.active,16);assert.ok(r.topError<.01&&r.bottomError<.01,JSON.stringify(r));assert.ok(r.groundedTop&&r.groundedBottom);assert.equal(r.pose,'idle');assert.ok(r.cameraError<1e-5&&r.visualError<1e-5);assert.ok(r.heldDrift<1e-5&&r.bottomDrift<1e-5);assert.ok(r.exitDistance>1)}assert.ok(report.invalid.blocked);assert.ok(report.hiddenInOrbit);assert.deepEqual(errors,[]);
 // Verify the production animation loop with real browser key events and pointer lock.
 await p.evaluate(()=>{const v=window.__iomBuildingViewer,c=v.controller,w=v.collision,t=v.stairTeleports;v.walk.deactivate();t.update(false);v.modelAnim.stop();v.orbit.setEnabled(false);document.activeElement?.blur();w.setQueryLayer('icm-anim-2025');w.setFocus(c.position.clone().set(-77.25,0,-29.1));c.setFeetPosition(c.position.clone().set(-77.25,0,-29.1));c.params.walkSpeed=1.6;v.walk.activate(false);v.walk.cameraMode='thirdPerson';c.yaw=-Math.PI/2;v.walk.presentation.reset(c.position,c.yaw);v.mode='walk';v.events.onMode?.('walk');v.cancelThumbnailTask()});
 await p.locator('canvas').click({position:{x:1350,y:750}});await p.waitForFunction(()=>!!document.pointerLockElement);
 await p.keyboard.down('w');await p.waitForFunction(()=>Math.abs(window.__iomBuildingViewer.controller.position.x+60.9)<.01,{},{timeout:15000});
 await p.keyboard.down('w');await p.waitForTimeout(650);
 const held=await p.evaluate(()=>{const c=window.__iomBuildingViewer.controller;return{x:c.position.x,y:c.position.y,grounded:c.onGround}});assert.ok(Math.abs(held.x+60.9)<.01);assert.ok(held.grounded);
 await p.keyboard.up('w');await p.keyboard.down('w');await p.waitForFunction(()=>window.__iomBuildingViewer.controller.position.x>-59.85,{},{timeout:15000});await p.keyboard.up('w');
 await p.keyboard.down('s');await p.waitForFunction(()=>Math.abs(window.__iomBuildingViewer.controller.position.x+76)<.01,{},{timeout:15000});await p.keyboard.up('s');await p.keyboard.press('Escape');
 const returned=await p.evaluate(()=>({feet:window.__iomBuildingViewer.controller.position.toArray(),grounded:window.__iomBuildingViewer.controller.onGround,mode:window.__iomBuildingViewer.getMode()}));assert.ok(returned.grounded);assert.equal(returned.mode,'walk');
 fs.writeFileSync(dir + '/' + tag + '-keyboard.json',JSON.stringify({held,returned,errors},null,2));assert.deepEqual(errors,[]);
 // Actual live-engine render at the bottom and the return circle, without an orbit thumbnail timer.
 for(const[id,end]of [['foyer-east','bottom'],['upper-east','bottom'],['upper-east','top']]){
  await p.evaluate(({id,end})=>{const v=window.__iomBuildingViewer,t=v.stairTeleports,c=v.controller,w=v.collision,portal=t.portals.find(p=>p.route.id===id&&p.up===(end==='bottom'));v.walk.deactivate();t.update(false);v.mode='orbit';v.orbit.setEnabled(false);w.setQueryLayer('icm-anim-2025');const direction=portal.destination.clone().sub(portal.point).setY(0).normalize();const pos=portal.point.clone().addScaledVector(direction,-1.7);w.setFocus(pos);c.setFeetPosition(pos);c.params.walkSpeed=1.6;for(let i=0;i<8;i++)c.update(1/60,direction.clone().set(0,0,0),0);v.walk.activate(false);v.walk.cameraMode='thirdPerson';c.yaw=Math.atan2(-direction.x,-direction.z);v.walk.presentation.reset(c.position,c.yaw);v.walk.keys.clear();v.mode='walk';v.events.onMode?.('walk');v.events.onWalkLock?.(false);v.cancelThumbnailTask()},{id,end});
  await p.waitForTimeout(350);await p.screenshot({path:`${dir}/${tag}-${id}-${end}.png`});
 }
}finally{await b.close()}
