import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
const root = new URL('../', import.meta.url);
const dir = new URL('public/assets/export/', root);
const manifest = JSON.parse(fs.readFileSync(new URL('stradivari_amantes_s3_manifest_v05.json',dir),'utf8'));
const buffer = fs.readFileSync(new URL(manifest.assetFile,dir));
assert.equal(buffer.readUInt32LE(0),0x46546c67);
assert.equal(buffer.readUInt32LE(4),2);
assert.equal(buffer.readUInt32LE(8),buffer.length);
assert.equal(crypto.createHash('sha256').update(buffer).digest('hex'),manifest.sha256);
assert.equal(buffer.length,manifest.byteSize);
const gltf = JSON.parse(buffer.toString('utf8',20,20+buffer.readUInt32LE(12)));
assert.equal(gltf.scenes.length,1);
assert.equal(gltf.scenes[0].nodes.length,1);
assert.equal(new Set(gltf.nodes.map(n=>n.name)).size,gltf.nodes.length);
for(const name of manifest.requiredNodes) assert(gltf.nodes.some(n=>n.name===name),name);
assert(!gltf.extensionsRequired?.some(e=>/draco|meshopt|basisu/i.test(e)));
const nodes = gltf.nodes.map(n=>{const o=new THREE.Object3D();o.name=n.name;if(n.matrix)o.applyMatrix4(new THREE.Matrix4().fromArray(n.matrix));else {if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);}return o;});
gltf.nodes.forEach((n,i)=>n.children?.forEach(c=>nodes[i].add(nodes[c])));
const scene=new THREE.Scene();gltf.scenes[0].nodes.forEach(i=>scene.add(nodes[i]));scene.updateMatrixWorld(true);
const product=scene.getObjectByName('SD_Product');
const box=new THREE.Box3();
let triangles=0;
gltf.nodes.forEach((n,i)=>{
 if(n.mesh===undefined)return;
 for(const prim of gltf.meshes[n.mesh].primitives){
  const acc=gltf.accessors[prim.attributes.POSITION];triangles+=(prim.indices!==undefined?gltf.accessors[prim.indices].count:acc.count)/3;
  let parent=nodes[i],inside=false;while(parent){if(parent===product)inside=true;parent=parent.parent;}
  if(inside)box.union(new THREE.Box3(new THREE.Vector3().fromArray(acc.min),new THREE.Vector3().fromArray(acc.max)).applyMatrix4(nodes[i].matrixWorld));
 }
});
assert.equal(triangles,manifest.triangleCount);
for(const [key,actual] of [['min',box.min],['max',box.max]]) assert(actual.distanceTo(new THREE.Vector3().fromArray(manifest.productBounds[key]))<1e-6);
const front=scene.getObjectByName('SD_Tweeter').getWorldPosition(new THREE.Vector3());assert(front.z>0 && front.y>.9);
const r=scene.getObjectByName('SD_Root');assert(r.position.length()<1e-8);assert(r.quaternion.angleTo(new THREE.Quaternion())<1e-8);assert(r.scale.distanceTo(new THREE.Vector3(1,1,1))<1e-8);
const animation=gltf.animations.find(a=>a.name==='SD_ConeMotion');assert(animation);
assert.equal(animation.channels.length,3);
for(const sampler of animation.samplers)assert.equal(gltf.accessors[sampler.input].max[0],2);
const environment=JSON.parse(fs.readFileSync(new URL('research/hdri-monochrome-studio-02.json',root),'utf8'));
const hdr=fs.readFileSync(new URL(environment.localFile,root));
assert.equal(hdr.length,environment.bytes);
assert.equal(crypto.createHash('sha256').update(hdr).digest('hex'),environment.sha256);
const allowed=new Set(['assets/environment/monochrome_studio_02_2k.hdr','assets/export/stradivari_amantes_s3_demo_v05.glb','assets/export/stradivari_amantes_s3_manifest_v05.json','assets/preview/stradivari_amantes_s3_hero_v05_studio02.png','assets/preview/stradivari_amantes_s3_mobile_v05_studio02.png']);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const publicDir=fileURLToPath(new URL('public/',root));for(const file of walk(publicDir))assert(allowed.has(path.relative(publicDir,file).replaceAll('\\','/')),file);
const report={assetVersion:manifest.assetVersion,byteSize:buffer.length,sha256:manifest.sha256,triangles,nodes:gltf.nodes.length,requiredNodes:manifest.requiredNodes.length,up:'+Y',front:'+Z',bounds:{min:box.min.toArray(),max:box.max.toArray()},animation:animation.name,channels:animation.channels.map(c=>({node:gltf.nodes[c.target.node].name,path:c.target.path})),environment:{id:environment.id,byteSize:hdr.length,sha256:environment.sha256},publicAllowlist:'PASS'};
fs.writeFileSync(new URL('qa/asset-verification.json',root),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));


