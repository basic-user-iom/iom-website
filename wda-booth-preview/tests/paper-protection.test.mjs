import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const threeURL=pathToFileURL(path.join(root,'public/vendor/three/build/three.module.js')).href;
const THREE=await import(threeURL);
const asURL=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const mergeURL=asURL((await fs.readFile(path.join(root,'public/vendor/three/addons/utils/BufferGeometryUtils.js'),'utf8')).replace("from 'three'",`from '${threeURL}'`));
const source=(await fs.readFile(path.join(root,'src/paper-protection.mjs'),'utf8')).replace("from 'three'",`from '${threeURL}'`).replace("from 'three/addons/utils/BufferGeometryUtils.js'",`from '${mergeURL}'`);
const {createPaperProtection,paperTargets}=await import(asURL(source));
const prefix='49017307733_ab59226bc7_c';
const close=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const box=o=>new THREE.Box3().setFromObject(o,true);

function fixture({all=false,translation=[0,0,0]}={}){
 const model=new THREE.Group();model.position.fromArray(translation);
 const texture=new THREE.Texture(),paper=new THREE.MeshStandardMaterial({name:'source_art',color:'#f4e8d8',roughness:.87,map:texture,normalMap:texture});
 const metal=new THREE.MeshStandardMaterial({name:'magnet',roughness:.42});
 const mounts=[],arts=[],frames=[],originalMeshes=[];
 const targets=all?paperTargets:[paperTargets[0]];
 for(const [i,t] of targets.entries()){
  const art=new THREE.Mesh(new THREE.BoxGeometry(t.frame?.496:.449,t.frame?.688:.388,t.frame?.002:.008),paper);
  art.name='runtime_'+i;art.userData={sourceObject:t.source,sourceCollections:t.collection};art.position.set(i*.8,1.84,t.frame?2.473:-2.481);model.add(art);arts.push(art);originalMeshes.push(art);
  if(t.frame){
   const frame=new THREE.Group();frame.userData={sourceObject:t.frame,sourceCollections:'Frames'};
   const face=new THREE.Mesh(new THREE.PlaneGeometry(.6364,.8541),new THREE.MeshStandardMaterial({name:'paper',color:'#ffffff'}));face.position.set(i*.8,1.84,2.474878);
   const wood=new THREE.Mesh(new THREE.BoxGeometry(.7232,.9409,.0267),new THREE.MeshStandardMaterial({name:'wood',color:'#997144'}));wood.position.set(i*.8,1.84,2.485755);
   frame.add(face,wood);model.add(frame);frames.push({frame,face,wood});originalMeshes.push(face,wood);
  }else{
   for(let k=0;k<4;k++){
    const x=i*.8+(k%2?1:-1)*.213,y=1.84+(k<2?1:-1)*.182;
    for(const isCap of [false,true]){
     const n=t.mountStart+k*2+(isCap?1:0),length=isCap?.00393:.01584;
     const geometry=new THREE.CylinderGeometry(.0031,.0031,length,12).rotateX(Math.PI/2);
     const mount=new THREE.Mesh(geometry,metal);mount.name='runtime_mount_'+n;mount.userData={sourceObject:'Cylinder.'+String(n).padStart(3,'0'),sourceCollections:'magnets'};mount.position.set(x,y,isCap?-2.480947:-2.49173);model.add(mount);mounts.push({mesh:mount,isCap});originalMeshes.push(mount);
    }
   }
  }
 }
 const canvas=new THREE.Mesh(new THREE.BoxGeometry(2.72,1.46,.02),paper);canvas.userData={sourceObject:'SMS_Canvas',sourceCollections:'Artworks'};model.add(canvas);originalMeshes.push(canvas);
 const unknown=new THREE.Mesh(new THREE.BoxGeometry(.3,.5,.005),paper);unknown.userData={sourceObject:prefix+'.099',sourceCollections:'Mexican Drawings'};model.add(unknown);originalMeshes.push(unknown);
 model.updateMatrixWorld(true);
 return {model,texture,paper,metal,mounts,arts,frames,canvas,unknown,originalMeshes};
}
function snapshot(mesh){return {geometry:mesh.geometry,material:mesh.material,position:Array.from(mesh.geometry.attributes.position.array),uv:Array.from(mesh.geometry.attributes.uv.array),normal:Array.from(mesh.geometry.attributes.normal.array),matrix:mesh.matrix.toArray()};}
function verifyUnchanged(mesh,before){assert.equal(mesh.geometry,before.geometry);assert.equal(mesh.material,before.material);assert.deepEqual(Array.from(mesh.geometry.attributes.position.array),before.position);assert.deepEqual(Array.from(mesh.geometry.attributes.uv.array),before.uv);assert.deepEqual(Array.from(mesh.geometry.attributes.normal.array),before.normal);assert.deepEqual(mesh.matrix.toArray(),before.matrix);}

test('exact audited paper scope protects all eight sheets and preserves art, canvas, frames and shared material maps',()=>{
 const f=fixture({all:true}),before=new Map(f.originalMeshes.map(o=>[o,snapshot(o)]));
 const color=f.paper.color.toArray(),uvMaps=[f.paper.map,f.paper.normalMap],version=f.paper.version;
 const effect=createPaperProtection({model:f.model});assert.equal(effect.state.artworks,8);assert.equal(effect.state.unframed,5);assert.equal(effect.state.framed,3);assert.equal(effect.state.shiftedCaps,20);assert.deepEqual(effect.state.errors,[]);
 assert.deepEqual(effect.state.entries.map(e=>e.source).sort(),['', '.001','.002','.005','.006','.007','.008','.009'].map(s=>prefix+s).sort());
 const caps=new Set(f.mounts.filter(o=>o.isCap).map(o=>o.mesh));
 for(const [mesh,s]of before)if(!caps.has(mesh))verifyUnchanged(mesh,s);
 assert.deepEqual(f.paper.color.toArray(),color);assert.deepEqual([f.paper.map,f.paper.normalMap],uvMaps);assert.equal(f.paper.version,version);
 assert.ok(effect.state.entries.filter(e=>e.kind==='framed').every(e=>e.existingBacking));
 for(const {face}of f.frames){assert.ok(face.parent);assert.equal(face.geometry.index.count,6);}
 effect.dispose();
});

test('layers have physical thickness, clear both wavy paper extremes, and fit frame backing without stacking a second original face',()=>{
 const f=fixture({all:true}),effect=createPaperProtection({model:f.model});
 for(const entry of effect.state.entries){
  const front=entry.acrylicBounds,back=entry.backingBounds,art=entry.artBounds;
  close(front.max[2]-front.min[2],.003);close(back.max[2]-back.min[2],.002);
  assert.ok(entry.frontClearance>=.00149);assert.ok(entry.backClearance>0);
  if(entry.normal===1){assert.ok(front.min[2]>art.max[2]);assert.ok(back.max[2]<art.min[2]);assert.ok(entry.width>art.max[0]-art.min[0]);}
  else{assert.ok(front.max[2]<art.min[2]);assert.ok(back.min[2]>art.max[2]);const face=f.frames.find(({frame})=>frame.userData.sourceObject===paperTargets.find(t=>t.source===entry.source).frame).face;const b=box(face);assert.ok(back.min[2]>b.max.z);assert.ok(entry.width<=b.max.x-b.min.x);}
  const acrylic=effect.group.children.find(o=>o.userData.paperSource===entry.source&&o.userData.layer==='acrylic');
  assert.equal(acrylic.castShadow,false);assert.equal(acrylic.material.depthWrite,false);assert.equal(acrylic.material.transparent,true);assert.equal(acrylic.material.transmission,0);
 }
 effect.dispose();
});

test('corner caps move only forward, preserve XY and have open drilled clearance through both protective plates',()=>{
 const f=fixture(),before=new Map(f.mounts.map(m=>[m.mesh,box(m.mesh)]));const effect=createPaperProtection({model:f.model}),entry=effect.state.entries[0];
 const layers=effect.group.children.filter(o=>o.userData.paperSource===entry.source);assert.equal(layers.length,2);
 const hardware=effect.group.getObjectByName('WDA_mount_extension_hardware');assert.ok(hardware?.isMesh,'new sleeve/washer hardware must survive geometry merging');assert.ok(hardware.geometry.attributes.position.count>0);
 for(const {mesh,isCap}of f.mounts){const old=before.get(mesh),now=box(mesh);close(old.min.x,now.min.x);close(old.min.y,now.min.y);close(old.max.x,now.max.x);close(old.max.y,now.max.y);
  if(isCap){close(now.max.z-now.min.z,old.max.z-old.min.z);assert.ok(now.min.z>entry.acrylicBounds.max[2]);assert.ok(now.min.z>old.min.z);const c=now.getCenter(new THREE.Vector3());
   for(const layer of layers){const ray=new THREE.Raycaster(new THREE.Vector3(c.x,c.y,-2.3),new THREE.Vector3(0,0,-1));assert.equal(ray.intersectObject(layer,false).length,0,'mount hole must pass through the plate');}
  }else{close(old.min.z,now.min.z);close(old.max.z,now.max.z);}
 }
 const center=new THREE.Vector3(...entry.artBounds.min).add(new THREE.Vector3(...entry.artBounds.max)).multiplyScalar(.5);const ray=new THREE.Raycaster(new THREE.Vector3(center.x,center.y,-2.3),new THREE.Vector3(0,0,-1));assert.ok(ray.intersectObject(layers.find(o=>o.userData.layer==='acrylic'),false).length>0);
 effect.dispose();
});

test('translated model parent keeps world-scale plate clearances and reversibly adjusts cap transforms',()=>{
 const f=fixture({translation:[3,.4,1.2]}),before=new Map(f.mounts.map(({mesh})=>[mesh,snapshot(mesh)]));const effect=createPaperProtection({model:f.model});
 const entry=effect.state.entries[0],art=box(f.arts[0]);close(entry.artBounds.min[0],art.min.x);close(entry.acrylicBounds.min[2]-art.max.z,.0015);close(entry.acrylicBounds.max[2]-entry.acrylicBounds.min[2],.003);
 effect.dispose();f.model.updateMatrixWorld(true);for(const [mesh,s]of before)verifyUnchanged(mesh,s);
});

test('repeated installation is idempotent and disposal releases only owned resources while restoring source mounts',()=>{
 const f=fixture(),before=new Map(f.originalMeshes.map(o=>[o,snapshot(o)]));let sourceDisposals=0;
 for(const o of f.originalMeshes){o.geometry.addEventListener('dispose',()=>sourceDisposals++);o.material.addEventListener('dispose',()=>sourceDisposals++);}f.texture.addEventListener('dispose',()=>sourceDisposals++);
 const effect=createPaperProtection({model:f.model}),childCount=f.model.children.length;assert.equal(createPaperProtection({model:f.model}),effect);assert.equal(f.model.children.length,childCount);assert.equal(effect.state.shiftedCaps,4);
 const ownedGeometry=new Set(),ownedMaterial=new Set();effect.group.traverse(o=>{if(o.isMesh){ownedGeometry.add(o.geometry);ownedMaterial.add(o.material);}});let geometryDisposals=0,materialDisposals=0;
 for(const g of ownedGeometry)g.addEventListener('dispose',()=>geometryDisposals++);for(const m of ownedMaterial)m.addEventListener('dispose',()=>materialDisposals++);
 effect.dispose();effect.dispose();assert.equal(sourceDisposals,0);assert.equal(geometryDisposals,ownedGeometry.size);assert.equal(materialDisposals,ownedMaterial.size);assert.equal(effect.group.parent,null);assert.equal(effect.state.disposed,true);
 for(const [mesh,s]of before)verifyUnchanged(mesh,s);
 const renewed=createPaperProtection({model:f.model});assert.notEqual(renewed,effect);assert.equal(renewed.state.artworks,1);renewed.dispose();
});

test('unverified collections and incomplete mount or frame constructions fail closed without moving source meshes',()=>{
 const wrong=fixture();wrong.arts[0].userData.sourceCollections='Unverified';const a=createPaperProtection({model:wrong.model});assert.equal(a.state.artworks,0);assert.equal(a.state.shiftedCaps,0);a.dispose();
 const missing=fixture();missing.mounts[0].mesh.removeFromParent();const before=missing.mounts.map(({mesh})=>snapshot(mesh));const b=createPaperProtection({model:missing.model});assert.equal(b.state.artworks,0);assert.equal(b.state.shiftedCaps,0);assert.match(b.state.errors[0],/Missing original corner mounts/);missing.mounts.forEach(({mesh},i)=>verifyUnchanged(mesh,before[i]));b.dispose();
 const incompleteFrame=fixture({all:true});incompleteFrame.frames[1].face.removeFromParent();const c=createPaperProtection({model:incompleteFrame.model});assert.equal(c.state.artworks,7);assert.equal(c.state.framed,2);assert.match(c.state.errors[0],/Missing original frame backing/);c.dispose();
 assert.throws(()=>createPaperProtection({model:null}),/loaded model/);
});
