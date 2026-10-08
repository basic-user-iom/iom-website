import fs from 'node:fs';const path='scripts/qa-stair-teleports-v10.mjs';let s=fs.readFileSync(path,'utf8');s=s.replace('return{results,invalid,hiddenInOrbit};','return{results,invalid,hiddenInOrbit,portals:t.readyPortals.map(p=>({id:p.id,point:p.point.toArray(),destination:p.destination.toArray(),radius:p.radius}))};');
s=s.replace(' // Actual live-engine render',` // Verify the production animation loop with real browser key events and pointer lock.
 await p.evaluate(()=>{const v=window.__iomBuildingViewer,c=v.controller,w=v.collision,t=v.stairTeleports;v.walk.deactivate();t.update(false);v.modelAnim.stop();v.orbit.setEnabled(false);document.activeElement?.blur();w.setQueryLayer('icm-anim-2025');w.setFocus(c.position.clone().set(-77.25,0,-29.1));c.setFeetPosition(c.position.clone().set(-77.25,0,-29.1));c.params.walkSpeed=1.6;v.walk.activate(false);v.walk.cameraMode='thirdPerson';c.yaw=-Math.PI/2;v.walk.presentation.reset(c.position,c.yaw);v.mode='walk';v.events.onMode?.('walk');v.cancelThumbnailTask()});
 await p.locator('canvas').click({position:{x:1350,y:750}});await p.waitForFunction(()=>!!document.pointerLockElement);
 await p.keyboard.down('w');await p.waitForFunction(()=>Math.abs(window.__iomBuildingViewer.controller.position.x+60.9)<.01,{},{timeout:15000});
 await p.keyboard.down('w');await p.waitForTimeout(650);
 const held=await p.evaluate(()=>{const c=window.__iomBuildingViewer.controller;return{x:c.position.x,y:c.position.y,grounded:c.onGround}});assert.ok(Math.abs(held.x+60.9)<.01);assert.ok(held.grounded);
 await p.keyboard.up('w');await p.keyboard.down('w');await p.waitForFunction(()=>window.__iomBuildingViewer.controller.position.x>-59.85,{},{timeout:15000});await p.keyboard.up('w');
 await p.keyboard.down('s');await p.waitForFunction(()=>Math.abs(window.__iomBuildingViewer.controller.position.x+76)<.01,{},{timeout:15000});await p.keyboard.up('s');await p.keyboard.press('Escape');
 const returned=await p.evaluate(()=>({feet:window.__iomBuildingViewer.controller.position.toArray(),grounded:window.__iomBuildingViewer.controller.onGround,mode:window.__iomBuildingViewer.getMode()}));assert.ok(returned.grounded);assert.equal(returned.mode,'walk');
 fs.writeFileSync(dir + '/' + tag + '-keyboard.json',JSON.stringify({held,returned,errors},null,2));assert.deepEqual(errors,[]);
 // Actual live-engine render`);
fs.writeFileSync(path,s);
const views='scripts/qa-teleport-arrival-views-v10.mjs';s=fs.readFileSync(views,'utf8').replace("await p.goto('http://127.0.0.1:5204/')","await p.goto(process.argv.includes('--built')?'http://127.0.0.1:5204/demos/icm-building/index.html':'http://127.0.0.1:5204/')");fs.writeFileSync(views,s);
