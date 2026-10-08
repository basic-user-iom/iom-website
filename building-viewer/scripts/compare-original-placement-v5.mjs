import fs from 'node:fs';
const dir='../../evidence/placement-v5/';
const blend=JSON.parse(fs.readFileSync(dir+'original-pack-objects-v5.json','utf8'));
const glb=JSON.parse(fs.readFileSync(dir+'named-glb-objects-v5.json','utf8'));
const index=new Map(blend.map(x=>[x.name,x]));
const convert=([x,y,z])=>[x,z,-y];
const center=b=>b.min.map((x,i)=>(x+b.max[i])/2);
const size=b=>b.min.map((x,i)=>b.max[i]-x);
const rows=[];
for(const g of glb){
 const b=index.get(g.name);if(!b?.bounds)continue;
 const bc=convert(center(b.bounds)),gc=center(g.bounds),bs=size(b.bounds),gs=size(g.bounds),extentError=Math.max(...[bs[0]-gs[0],bs[2]-gs[1],bs[1]-gs[2]].map(Math.abs));
 const translation=convert(b.world.map(r=>r[3]).slice(0,3)),delta=bc.map((x,i)=>x-gc[i]);
 const deltaError=Math.max(...delta.map((x,i)=>Math.abs(x-translation[i])));
 const sourceTranslation=g.world.slice(12,15);
 const centered=sourceTranslation.every(x=>Math.abs(x)<1e-4);
 rows.push({name:g.name,translation,sourceTranslation,delta,extentError,deltaError,centered,originalWorld:b.world,sourceWorld:g.world,originalBounds:b.bounds,sourceBounds:g.bounds,collections:b.collections});
}
const displaced=rows.filter(r=>r.centered&&Math.hypot(...r.translation)>.1&&r.extentError<.02&&r.deltaError<.02);
const targets=rows.filter(r=>/FluchtWeg015|TR_Stufen013/.test(r.name));
const aligned=rows.filter(r=>Math.hypot(...r.delta)<.002&&r.extentError<.002);
const report={matched:rows.length,alignedCount:aligned.length,alignedAnchors:aligned.slice(0,20),displaced,targets};
fs.writeFileSync(dir+'original-pack-comparison-v5.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({matched:rows.length,aligned:aligned.length,displaced:displaced.map(r=>({name:r.name,translation:r.translation,extentError:r.extentError,deltaError:r.deltaError})),targets},null,2));
