import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const dir='../../evidence/teleport-v11.1';
const activated=process.argv.includes('--activated');
const routes=JSON.parse(fs.readFileSync(dir+'/candidate-v11-routes.json','utf8'));
const handoff=JSON.parse(fs.readFileSync(dir+'/blender-handoff.json','utf8'));
const baseline=JSON.parse(fs.readFileSync(dir+'/original-70-routes.json','utf8'));
const report={phase:activated?'activated':'staged-in-test-browser-only',date:new Date().toISOString(),errors:[],routes:[]};
const save=()=>fs.writeFileSync(dir+`/${activated?'activated':'staged'}-v11-tests.json`,JSON.stringify(report,null,2));
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1400,height:900}});
page.on('pageerror',e=>report.errors.push(String(e)));
await page.addInitScript(()=>sessionStorage.setItem('building-viewer-demo-unlocked','1'));
try {
 await page.goto('http://127.0.0.1:5204/demos/icm-building/index.html');
 await page.waitForFunction(()=>document.querySelector('.bv-loading')?.classList.contains('hidden')&&!window.__iomBuildingViewer.orbit.isAnimating(),{},{timeout:180000});
 report.registry=await page.evaluate(async({routes,activated,baseline})=>{
  const v=window.__iomBuildingViewer;v.cancelThumbnailTask();v.orbit.setEnabled(false);v.modelAnim.stop();v.collision.setPlacementMode(false);
  const originals=v.stairTeleports.portals.filter(p=>p.up).map(p=>p.route);
  const preserved=baseline.every((r,i)=>JSON.stringify(r)===JSON.stringify(originals[i]));
  if(!activated){
   const {ICM_STAIR_TELEPORTS}=await import('/src/controls/stairTeleportRoutes.ts');
   if(ICM_STAIR_TELEPORTS.length!==70)throw Error('Staged QA requires the original 70-route source');
   ICM_STAIR_TELEPORTS.push(...routes);
   const {StairTeleports}=await import('/src/controls/StairTeleports.ts');
   v.stairTeleports.dispose();
   v.stairTeleports=new StairTeleports(v.collision,v.controller,v.walk,id=>v.models.getLayer(id)?.visible===true,v.walk.visual.root,v.renderer.domElement.parentElement);
   v.scene.add(v.stairTeleports.root);
  }
  return {originalCount:originals.length,preserved,originalIds:originals.slice(0,70).map(r=>r.id),testRouteCount:v.stairTeleports.portals.length/2};
 },{routes,activated,baseline});
 save();assert.equal(report.registry.preserved,true);assert.equal(report.registry.testRouteCount,72);
 if(!activated||process.argv.includes('--geometry')){
 report.geometry=await page.evaluate(async(routes)=>{
  const v=window.__iomBuildingViewer,{loadGeometry,soup,padAudit}=await import('/scripts/lib/e276-geometry-audit.ts');
  const entry=v.models.getLayer('icm-anim-2025').entry;
  const visual=await loadGeometry(entry.web),collision=await loadGeometry(entry.collision);
  const vs=soup(visual.gltf.scene),cs=soup(collision.gltf.scene),live=soup(v.models.root);
  const pads=routes.flatMap(r=>[{id:r.id+':lower',center_gltf:r.bottom},{id:r.id+':upper',center_gltf:r.top}]);
  return {assets:[visual.evidence,collision.evidence],visual:pads.map(p=>padAudit(vs.tris,p)),collision:pads.map(p=>padAudit(cs.tris,p)),live:pads.map(p=>padAudit(live.tris,p))};
 },routes);
 save();console.log('GEOMETRY',JSON.stringify(report.geometry));
 assert.ok(['visual','collision','live'].every(k=>report.geometry[k].every(p=>p.ok)));
 }
 for(let ri=0;ri<routes.length;ri++)for(const direction of ['up','down']){
  const r=routes[ri],source=handoff.routes[ri];
  const result=await page.evaluate(async({r,source,direction})=>{
   const v=window.__iomBuildingViewer,c=v.controller,w=v.collision,walk=v.walk,t=v.stairTeleports,V=c.position.constructor;
   v.mode='orbit';walk.deactivate();t.update(false);w.setQueryLayer(r.layerId);document.activeElement?.blur();
   const vec=a=>new V(...a),zero=new V(),down=new V(0,-1,0);
   const visualAt=pos=>{v.models.root.updateMatrixWorld(true);v.pegman.raycaster.near=0;v.pegman.raycaster.far=.3;v.pegman.raycaster.set(pos.clone().add(new V(0,.15,0)),down);const h=v.pegman.raycastVisualSurface();return h?{point:h.point.toArray(),normal:h.normal.toArray(),name:h.objectName,material:h.materialName,layer:h.layerId}:null};
   const supportAt=pos=>{const h=w.raycastBestGround(pos.clone().add(new V(0,.12,0)),.24,.95,r.layerId);return h?{point:h.point.toArray(),normal:h.normal.toArray(),name:h.sourceName,layer:h.layerId}:null};
   const capsule=()=>{const q=c.getCapsule(),h=w.capsuleIntersect(q.start,q.end,q.radius);return {height:c.params.playerHeight,radius:q.radius,penetration:h?{depth:h.depth,normal:h.normal.toArray(),source:h.sourceName}:null}};
   const path=direction==='up'?[...source.lowerApproachFeetWorld].reverse():[vec(r.top).add(new V(...[source.upper.exitDirectionXZ[0]*1.5,0,source.upper.exitDirectionXZ[1]*1.5])).toArray(),r.top];
   const start=vec(path[0]);w.setFocus(start);
   v.seekAnimationNormalized(1);const animatedTime=v.modelAnim.getTime();
   await v.handlePegmanDrop({ok:true,point:start,layerId:r.layerId});v.cancelThumbnailTask();v.orbit.setEnabled(false);
   // This synchronous simulation uses the actual v11 input, controller, gate and fade.
   v.playAnimation();v.seekAnimationNormalized(1);
   const animationAfterEntry=v.modelAnim.getState();
   c.params.walkSpeed=1;walk.cameraMode=direction==='up'?'thirdPerson':'firstPerson';
   const key=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code,bubbles:true}));
   let maxYError=0,maxPenetration=0,airborne=0,walkDistance=0,last=c.position.clone(),commits=[];
   const teleport=walk.teleportTo;
   walk.teleportTo=function(feet,yaw){const before={feet:c.position.toArray(),destinationVisible:visualAt(feet),support:supportAt(feet),focus:w.focus?.toArray?.(),effectOpacity:t.effect.veil.style.opacity};teleport.call(this,feet,yaw);commits.push({...before,after:c.position.toArray(),velocity:c.velocity.toArray(),onGround:c.onGround,capsule:capsule(),floorState:v.floorZones.getStats()})};
   function step(){w.beginFrame();w.setFocus(c.position);walk.update(1/60);t.update(true,1/60);v.floorZones.update(c.position.y,c.position.x,c.position.z,performance.now()+500);}
   step();const active=t.readyPortals.length;
   const startSurface=visualAt(c.position);let reached=true;
   for(const point of path.slice(1)){
    const target=vec(point),dir=target.clone().sub(c.position);dir.y=0;dir.normalize();c.yaw=Math.atan2(-dir.x,-dir.z);key('keydown','KeyW');let frames=0;
    for(;frames<240;frames++){step();if(t.effect.active)break;const d=c.position.distanceTo(last);walkDistance+=d;last.copy(c.position);maxYError=Math.max(maxYError,Math.abs(c.position.y-start.y));if(!c.onGround)airborne++;maxPenetration=Math.max(maxPenetration,capsule().penetration?.depth||0);if(Math.hypot(c.position.x-target.x,c.position.z-target.z)<.018)break;}
    key('keyup','KeyW');if(frames===240)reached=false;if(t.effect.active)break;
   }
   let transitionFrames=0,intermediateCapsuleFrames=0;const origin=c.position.clone();
   for(;t.effect.active&&transitionFrames<150;transitionFrames++){step();if(Math.abs(c.position.y-origin.y)>.02&&Math.abs(c.position.y-(direction==='up'?r.top[1]:r.bottom[1]))>.02)intermediateCapsuleFrames++;}
   walk.teleportTo=teleport;
   const dest=vec(direction==='up'?r.top:r.bottom),arrival=c.position.clone(),onGround=c.onGround;
   const arrivalVisual=visualAt(arrival),arrivalSupport=supportAt(arrival),arrivalCapsule=capsule();
   let standingDrift=0,standingAirborne=0;for(let i=0;i<120;i++){step();standingDrift=Math.max(standingDrift,c.position.distanceTo(arrival));if(!c.onGround)standingAirborne++;}
   const exitStart=c.position.clone();key('keydown','KeyW');let exitAirborne=0,exitMaxYError=0,exitPenetration=0;
   for(let i=0;i<60;i++){step();if(!c.onGround)exitAirborne++;exitMaxYError=Math.max(exitMaxYError,Math.abs(c.position.y-arrival.y));exitPenetration=Math.max(exitPenetration,capsule().penetration?.depth||0)}key('keyup','KeyW');
   const result={id:r.id,direction,active,start:path[0],path,animatedTime,animationAfterEntry,startSurface,reached,entry:{distance:walkDistance,maxYError,maxPenetration,airborne},commits,transitionFrames,intermediateCapsuleFrames,arrival:{feet:arrival.toArray(),error:arrival.distanceTo(dest),onGround,visual:arrivalVisual,support:arrivalSupport,capsule:arrivalCapsule},standing:{seconds:2,frames:120,drift:standingDrift,airborne:standingAirborne},exit:{feet:c.position.toArray(),distance:c.position.distanceTo(exitStart),onGround:c.onGround,airborne:exitAirborne,maxYError:exitMaxYError,maxPenetration:exitPenetration},animationFinal:v.modelAnim.getState(),opacityRestored:t.effect.saved.length===0};
   v.mode='orbit';walk.deactivate();t.update(false);return result;
  },{r,source,direction});
  report.routes.push(result);save();console.log('DIRECTION',JSON.stringify(result));
  assert.equal(result.active,144);assert.equal(result.commits.length,1);assert.equal(result.reached,true);
  assert.ok(result.entry.distance>=1&&result.entry.maxYError<.02&&result.entry.airborne===0);
  assert.ok(result.arrival.error<.015&&result.arrival.onGround&&result.arrival.visual&&result.arrival.support.normal[1]>.99);
  assert.ok(result.standing.drift<.005&&result.standing.airborne===0);
  assert.ok(result.exit.distance>=.999&&result.exit.airborne===0&&result.exit.maxYError<.02);
  assert.ok(result.intermediateCapsuleFrames===0&&result.animationAfterEntry.time===0&&result.animationFinal.time===0&&!result.animationFinal.playing);
  assert.ok(result.commits[0].destinationVisible&&result.commits[0].onGround&&result.commits[0].velocity.every(n=>Math.abs(n)<1e-5));
  assert.ok(result.entry.maxPenetration<.003&&result.exit.maxPenetration<.003&&(!result.arrival.capsule.penetration||result.arrival.capsule.penetration.depth<.003));
 }
 assert.deepEqual(report.errors,[]);report.passed=true;save();
}finally{save();await browser.close()}
