import fs from 'node:fs';import assert from 'node:assert/strict';import{Matrix4,Vector3}from'three';import{createGltfIO}from'./lib/gltf-io.mjs';import{getBounds}from'@gltf-transform/functions';
const evidence='../../evidence/placement-v5/';const rows=JSON.parse(fs.readFileSync(evidence+'original-pack-comparison-v5.json','utf8')).displaced;
const input='integration-assets/icm-anim-2025-review-source-v4.glb',output='integration-assets/icm-anim-2025-review-source-v5.glb';assert.ok(!fs.existsSync(output),'refuse overwrite');
const io=await createGltfIO(),doc=await io.read(input),C=new Matrix4().set(1,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,1),report=[];
for(const row of rows){const matches=doc.getRoot().listNodes().filter(n=>n.getName()===row.name);assert.equal(matches.length,1,row.name);const n=matches[0];assert.ok(n.getMesh());const before=n.getWorldMatrix();assert.ok(before.slice(12,15).every(x=>Math.abs(x)<1e-7));const desired=C.clone().multiply(new Matrix4().set(...row.originalWorld.flat())).multiply(C.clone().invert());
 const rotationError=Math.max(...[0,1,2,4,5,6,8,9,10].map(i=>Math.abs(desired.elements[i]-before[i])));assert.ok(rotationError<1e-6,`${row.name} rotation ${rotationError}`);
 const parents=n.listParents().filter(p=>p.propertyType==='Node');assert.equal(parents.length,1,row.name);const p=parents[0];const localPosition=new Vector3(...row.translation).applyMatrix4(new Matrix4().fromArray(p.getWorldMatrix()).invert());n.setTranslation(localPosition.toArray());
 const after=n.getWorldMatrix();assert.ok(after.slice(12,15).every((x,i)=>Math.abs(x-row.translation[i])<1e-7));
 n.setExtras({...n.getExtras(),iomOriginalPlacement:{source:'ICM_pack.blend',object:row.name,version:5}});
 report.push({name:row.name,translation:row.translation,rotationError,before,after,bounds:getBounds(n)});
}
assert.equal(report.length,18);await io.write(output,doc);fs.writeFileSync(evidence+'restored-source-placement-v5.json',JSON.stringify({input,output,changes:report},null,2));console.log('Restored',report.length,'source placements, with all original rotations preserved.');
