// Browser regression: complete flights and their upper/lower landing transitions.
import { resolve } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
const out = resolve(process.argv[3] || 'tmp/qa-primary-stairs')
const baseUrl = process.argv[2] || 'http://127.0.0.1:5192/'
await mkdir(out, {recursive:true})
const browser = await chromium.launch({ headless: true, channel: process.env.IOM_QA_BROWSER_CHANNEL || undefined })
const page = await browser.newPage({viewport:{width:1280,height:800}})
const errors=[];page.on('pageerror',e=>errors.push(e.message))
await page.addInitScript(()=>sessionStorage.setItem('building-viewer-demo-unlocked','1'))
let report
try {
 await page.goto(baseUrl,{waitUntil:'domcontentloaded'})
 await page.waitForFunction(()=>window.__iomBuildingViewer?.collision?.resident?.length,{},{timeout:120000})
 await page.evaluate(async()=>{const v=window.__iomBuildingViewer;await v.ensureLayer('icm-anim-2025',true);await v.ensureLayer('icm-ext',false);v.modelAnim.stop()})
 report=await page.evaluate(()=>{
  const v=window.__iomBuildingViewer,c=v.controller,w=v.collision;
  w.setQueryLayer('icm-anim-2025');w.setPlacementMode(false);
  const routes=[
   {name:'TR_Stufen004-with-landings',a:[-35.96,6.1,31.8],b:[-35.96,10.4,42.1]},
   {name:'TR_Stufen005-with-landings',a:[-74.16,6.1,31.8],b:[-74.16,10.4,42.1]},
   {name:'TR_Stufen004_001',a:[-55.05,6.1,10.2],b:[-55.05,10.04,2.5]},
  ]; const results=[];
  for(const route of routes)for(const speed of [1.6,3.2,6.5])for(const reverse of [false,true]){
   const [a,b]=reverse?[route.b,route.a]:[route.a,route.b];
   const p=c.position.clone().fromArray(a);w.setFocus(p);
   const h=w.raycastBestGround(p.clone().setY(p.y+.6),1.2,c.params.maxSlope);
   if(!h){results.push({name:route.name,speed,reverse,error:'no start ground'});continue}
   p.y=h.point.y;c.setFeetPosition(p);const idle=p.clone().set(0,0,0);
   for(let i=0;i<10;i++)c.update(1/60,idle,0);
   let maxJump=0,airborne=0,stalled=0,frames=0;const samples=[];
   for(;frames<1200;frames++){
    const before=c.position.clone(),d=before.clone().set(b[0]-before.x,0,b[2]-before.z);
    if(d.length()<.12)break;
    w.setFocus(c.position);c.update(1/60,d.normalize(),speed);
    const move=c.position.distanceTo(before);stalled=move<.0001?stalled+1:0;
    if(!c.onGround)airborne++;maxJump=Math.max(maxJump,Math.abs(c.position.y-before.y));
    if(frames%15===0)samples.push(c.position.toArray());
    if(stalled>60||c.position.y<-5)break;
   }
   results.push({name:route.name,speed,reverse,frames,stalled,airborne,maxJump,feet:c.position.toArray(),distance:Math.hypot(b[0]-c.position.x,b[2]-c.position.z),heightError:Math.abs(c.position.y-b[1]),onGround:c.onGround,samples});
  }
  // Verify the narrow support patches coincide with the authored visual slab.
  const root=v.models.getLayer('icm-anim-2025').result.root, ray=v.pegman.raycaster;
  const slabs=[];root.traverse(o=>{if(o.isMesh&&o.parent?.name==='Decke_2OG_A')slabs.push(o)});
  const landings=[];
  for(const x of [-35.96,-74.16])for(const z of [40.65,41.15,41.65]){
    const origin=c.position.clone().set(x,10.8,z);w.setFocus(origin);
    const hit=w.raycastBestGround(origin,1,c.params.maxSlope);
    ray.set(origin,origin.clone().set(0,-1,0));ray.near=0;ray.far=1;
    const visual=ray.intersectObjects(slabs,false)[0];
    landings.push({x,z,y:hit?.point.y,visualY:visual?.point.y,source:hit?.sourceName,
      supported:!!hit&&!!visual&&Math.abs(hit.point.y-visual.point.y)<.002});
  }
  return {results,landings};
 });
 report.errors=errors;
 report.ok=errors.length===0&&report.landings.every(r=>r.supported)&&report.results.every(r=>!r.error&&r.distance<.13&&r.heightError<.15&&r.onGround&&r.airborne===0);
}catch(e){report={ok:false,failure:e.stack,errors}}finally{await browser.close()}
await writeFile(out+'/report.json',JSON.stringify(report,null,2))
console.log(JSON.stringify({...report,results:report.results?.map(({samples,...r})=>r)},null,2))
if(!report.ok)process.exitCode=1
