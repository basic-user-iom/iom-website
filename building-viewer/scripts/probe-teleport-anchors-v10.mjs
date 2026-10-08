import fs from 'node:fs';import{chromium}from'playwright';
const dir='../../evidence/teleport-v10';fs.mkdirSync(dir,{recursive:true});
const routes=[
{id:'foyer-east',a:[-76,0,-29.1],b:[-60.9,6,-29.1]},
{id:'foyer-west-a',a:[-97.2,0,-29.07],b:[-115.6,6,-29.07]},
{id:'foyer-west-b',a:[-97.2,0,-26.65],b:[-115.6,6,-26.65]},
{id:'foyer-far-west-a',a:[-144.8,0,-29.07],b:[-126.3,6,-29.07]},
{id:'foyer-far-west-b',a:[-144.8,0,-26.65],b:[-126.3,6,-26.65]},
{id:'upper-east',a:[-36.25,6,31.2],b:[-36.25,10.4,43.3]},
{id:'upper-west',a:[-73.88,6,31.2],b:[-73.88,10.4,43.3]},
{id:'upper-center',a:[-55.05,6.1,10.9],b:[-55.05,10.04,1.3]},
];
const b=await chromium.launch({channel:'msedge',headless:true}),p=await b.newPage({viewport:{width:1280,height:800}});await p.addInitScript(()=>sessionStorage.setItem('building-viewer-demo-unlocked','1'));
try{await p.goto('http://127.0.0.1:5204/');await p.waitForFunction(()=>document.querySelector('.bv-loading')?.classList.contains('hidden')&&!window.__iomBuildingViewer.orbit.isAnimating(),{},{timeout:180000});
const results=await p.evaluate(async routes=>{
 const v=window.__iomBuildingViewer,w=v.collision;const {Vector3}=await import('/node_modules/three/build/three.module.js');const {isValidSpawnPoint}=await import('/src/collision/CharacterController.ts');v.modelAnim.stop();v.cancelThumbnailTask();w.setQueryLayer(null);w.setPlacementMode(true);
 return routes.map(r=>({...r,ends:[r.a,r.b].map(pos=>{
 const origin=new Vector3(...pos).add(new Vector3(0,.5,0));const hit=w.raycastBestGround(origin,1,.95);if(!hit)return{pos,error:'no support'};const ground={point:hit.point.clone(),normal:hit.normal.clone(),source:hit.sourceName,layer:hit.layerId};
 const validation=isValidSpawnPoint(w,ground.point,ground.normal,v.controller.params);const head=w.raycast(ground.point.clone().add(new Vector3(0,.12,0)),new Vector3(0,1,0),1.8);
 const ring=[];for(let i=0;i<8;i++){const angle=i*Math.PI/4;const h=w.raycastBestGround(ground.point.clone().add(new Vector3(Math.cos(angle)*.7,.2,Math.sin(angle)*.7)),.4,.95);ring.push(h?+h.point.y.toFixed(3):null)}
 v.pegman.raycaster.near=0;v.pegman.raycaster.far=1;v.pegman.raycaster.set(ground.point.clone().add(new Vector3(0,.4,0)),new Vector3(0,-1,0));const visual=v.pegman.raycastVisualSurface();
 return{pos,point:ground.point.toArray(),source:ground.source,layer:ground.layer,valid:validation,head:head?{distance:head.distance,source:head.sourceName}:null,ring,visual:visual?{point:visual.point.toArray(),name:visual.objectName,material:visual.materialName}:null};})}));
},routes);fs.writeFileSync(`${dir}/anchor-probes.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await b.close()}
