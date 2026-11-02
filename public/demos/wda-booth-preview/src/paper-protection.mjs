import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Explicit source audit, not image recognition or a name-prefix sweep.
const prefix='49017307733_ab59226bc7_c';
export const paperTargets=[
 ...[['.005',17],['.006',25],['.007',33],['.008',1],['.009',9]].map(([suffix,mountStart])=>({source:prefix+suffix,collection:'Mexican Drawings',normal:1,mountStart})),
 ...[['','Box046'],['.001','Box046.001'],['.002','Box046.002']].map(([suffix,frame])=>({source:prefix+suffix,collection:'Artworks',normal:-1,frame}))
];
const installed=new WeakMap();
const bounds=o=>new THREE.Box3().setFromObject(o,true);

// Thin clear-sheet approximation: Fresnel-weighted PBR specular over the
// already rendered art. No transmission framebuffer, refraction or GI claim.
// One front-facing closed surface keeps edge thickness without doubled faces.
function acrylicMaterial(){
 const m=new THREE.MeshPhysicalMaterial({name:'WDA_added_clear_acrylic',color:0x000000,metalness:0,roughness:.095,ior:1.49,specularIntensity:1,transparent:true,opacity:1,depthWrite:false,side:THREE.FrontSide,envMapIntensity:.55});
 m.onBeforeCompile=shader=>{
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>
   float acrylicCos=abs(dot(normalize(normal),normalize(vViewPosition)));
   float acrylicF=0.03873+0.96127*pow(1.0-acrylicCos,5.0);
   gl_FragColor.rgb=outgoingLight/max(acrylicF,0.03873);
   gl_FragColor.a=clamp(acrylicF,0.03873,0.94);
  `);
 };
 m.customProgramCacheKey=()=> 'wda-thin-acrylic-fresnel-v1';
 return m;
}
function rectangle(w,h,holes=[]){
 const shape=new THREE.Shape();shape.moveTo(-w/2,-h/2);shape.lineTo(w/2,-h/2);shape.lineTo(w/2,h/2);shape.lineTo(-w/2,h/2);shape.closePath();
 for(const p of holes){const hole=new THREE.Path();hole.absarc(p.x,p.y,.0033,0,Math.PI*2,true);shape.holes.push(hole);}
 return shape;
}
function plateGeometry(w,h,depth,holes){
 const g=new THREE.ExtrudeGeometry(rectangle(w,h,holes),{depth,steps:1,curveSegments:12,bevelEnabled:true,bevelSize:.00015,bevelThickness:.00015,bevelSegments:1});
 // Bevels stay inside the requested total thickness and outer XY dimensions.
 g.computeBoundingBox();const b=g.boundingBox,s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3());g.translate(-c.x,-c.y,-c.z);g.scale(w/s.x,h/s.y,depth/s.z);return g;
}

export function createPaperProtection({model}={}){
 if(!model?.isObject3D)throw new TypeError('Paper protection requires the loaded model.');
 if(installed.has(model))return installed.get(model);
 model.updateWorldMatrix(true,true);
 const state={enabled:true,disposed:false,artworks:0,unframed:0,framed:0,shiftedCaps:0,entries:[],errors:[],method:'Thin acrylic Fresnel overlay; no refraction pass',acrylicThickness:.003,backingThickness:.002};
 const group=new THREE.Group();group.name='WDA_paper_protection_variant';group.userData.presentationVariant=true;
 // Geometry is constructed in world metres, then attached without changing
 // the model or paper transforms (also supports a transformed model parent).
 group.matrixAutoUpdate=false;group.matrix.copy(model.matrixWorld).invert();model.add(group);
 const glass=acrylicMaterial(),board=new THREE.MeshStandardMaterial({name:'WDA_added_neutral_support_board',color:'#e6e4de',roughness:.9,metalness:0});
 const metal=new THREE.MeshStandardMaterial({name:'WDA_added_mount_spacers',color:'#a9abad',roughness:.4,metalness:.75});
 const gasket=new THREE.MeshStandardMaterial({name:'WDA_added_frame_rebate_spacers',color:'#b8b7b0',roughness:.85});
 const materials=[glass,board,metal,gasket],geometries=[],capOriginals=[],metalParts=[],rebateParts=[];
 const objects=new Map();model.traverse(o=>{if(o.userData.sourceObject)objects.set(o.userData.sourceObject,o);});
 const eligible=paperTargets.filter(t=>{const o=objects.get(t.source);return o?.isMesh&&o.userData.sourceCollections===t.collection;});
 const framedFront=Math.min(...eligible.filter(t=>t.frame).map(t=>bounds(objects.get(t.source)).min.z));
 function meshFor(name,geometry,material,entry,position){
  geometries.push(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.copy(position);mesh.userData={presentationVariant:true,paperSource:entry.source,layer:name.includes('acrylic')?'acrylic':'backing'};
  mesh.castShadow=material!==glass;mesh.receiveShadow=material!==glass;group.add(mesh);return mesh;
 }
 for(const t of eligible){
  const art=objects.get(t.source),ab=bounds(art),ac=ab.getCenter(new THREE.Vector3()),as=ab.getSize(new THREE.Vector3());
  // These inspected source sheets are axis-aligned XY; fail closed if source
  // changes to a different construction rather than protecting an unrelated plane.
  if(as.z>.04||as.x<.05||as.y<.05){state.errors.push('Unsupported paper orientation: '+t.source);continue;}
  const entry={source:t.source,kind:t.frame?'framed':'corner-mounted',artBounds:{min:ab.min.toArray(),max:ab.max.toArray()},normal:t.normal,capSources:[],existingBacking:false};
  let width=as.x+.010,height=as.y+.010,cx=ac.x,cy=ac.y,frontBack=ab.max.z+.0015,backFront=ab.min.z-.0015,holes=[],frameBounds;
  let capParts=[];
  if(t.frame){
   const frame=objects.get(t.frame);let paperFace;
   frame?.traverse(o=>{if(o.isMesh&&!Array.isArray(o.material)&&o.material.name==='paper')paperFace=o;});
   if(!paperFace){state.errors.push('Missing original frame backing: '+t.frame);continue;}
   const fb=bounds(paperFace),fc=fb.getCenter(new THREE.Vector3()),fs=fb.getSize(new THREE.Vector3());frameBounds=bounds(frame);
   width=fs.x-.001;height=fs.y-.001;cx=fc.x;cy=fc.y;entry.existingBacking=true;
   frontBack=framedFront-.0015;backFront=fb.max.z+.00025;
   if(width<as.x||height<as.y){state.errors.push('Paper outside frame opening: '+t.source);continue;}
   // Small neutral rebate extension seats the clear sheet ahead of source paper
   // which protrudes slightly beyond the original wood face. Original frame stays.
   const railDepth=Math.max(.0003,frameBounds.min.z-frontBack),rz=frontBack+railDepth/2;
   for(const [w,h,x,y] of [[width,.0015,cx,cy-height/2+.00075],[width,.0015,cx,cy+height/2-.00075],[.0015,height,cx-width/2+.00075,cy],[.0015,height,cx+width/2-.00075,cy]]){
    const g=new THREE.BoxGeometry(w,h,railDepth);g.translate(x,y,rz);rebateParts.push(g);
   }
  }else{
   for(let k=0;k<8;k+=2){
    const stem=objects.get('Cylinder.'+String(t.mountStart+k).padStart(3,'0')),cap=objects.get('Cylinder.'+String(t.mountStart+k+1).padStart(3,'0'));
    if(!stem?.isMesh||!cap?.isMesh){capParts=[];break;}
    const cb=bounds(cap),cc=cb.getCenter(new THREE.Vector3());holes.push({x:cc.x-cx,y:cc.y-cy});capParts.push({cap,stem,cb,cc});
   }
   if(capParts.length!==4){state.errors.push('Missing original corner mounts: '+t.source);continue;}
  }
  const frontCenter=frontBack+t.normal*.0015,backCenter=backFront-t.normal*.001;
  const acrylic=meshFor('acrylic_'+t.source,plateGeometry(width,height,.003,holes),glass,entry,new THREE.Vector3(cx,cy,frontCenter));
  const backing=meshFor('backing_'+t.source,plateGeometry(width,height,.002,holes),board,entry,new THREE.Vector3(cx,cy,backCenter));
  // Matching 3.3mm holes avoid an opaque plate intersecting existing mount stems.
  for(const {cap,stem,cb,cc} of capParts){
   capOriginals.push({cap,position:cap.position.clone(),matrix:cap.matrix.clone(),matrixAutoUpdate:cap.matrixAutoUpdate});
   const front=frontBack+.003,capBack=front+.00055,delta=capBack-cb.min.z;
   const world=cap.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,0,delta));cap.parent.worldToLocal(world);cap.position.copy(world);cap.updateMatrix();cap.updateWorldMatrix(false,false);
   entry.capSources.push(cap.userData.sourceObject);state.shiftedCaps++;
   const sb=bounds(stem),start=sb.max.z-.0001,end=capBack;
   const shaft=new THREE.CylinderGeometry(.0027,.0027,end-start,12);shaft.rotateX(Math.PI/2);shaft.translate(cc.x,cc.y,(start+end)/2);metalParts.push(shaft);
   const washerShape=new THREE.Shape();washerShape.absarc(0,0,.0044,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,.0027,0,Math.PI*2,true);washerShape.holes.push(hole);
   const washer=new THREE.ExtrudeGeometry(washerShape,{depth:.00045,steps:1,curveSegments:12,bevelEnabled:false});washer.translate(cc.x,cc.y,front+.00005);metalParts.push(washer);
  }
  group.updateWorldMatrix(true,true);
  entry.acrylicBounds={min:bounds(acrylic).min.toArray(),max:bounds(acrylic).max.toArray()};entry.backingBounds={min:bounds(backing).min.toArray(),max:bounds(backing).max.toArray()};entry.width=width;entry.height=height;entry.frontClearance=t.normal===1?entry.acrylicBounds.min[2]-ab.max.z:ab.min.z-entry.acrylicBounds.max[2];entry.backClearance=t.normal===1?ab.min.z-entry.backingBounds.max[2]:entry.backingBounds.min[2]-ab.max.z;
  state.entries.push(entry);state.artworks++;state[t.frame?'framed':'unframed']++;
 }
 for(const [parts,material,name] of [[metalParts,metal,'WDA_mount_extension_hardware'],[rebateParts,gasket,'WDA_frame_rebate_extensions']]){
  if(parts.length){const normalized=parts.map(g=>g.index?g.toNonIndexed():g);const geo=mergeGeometries(normalized,false);new Set([...parts,...normalized]).forEach(g=>g.dispose());if(geo){geometries.push(geo);const m=new THREE.Mesh(geo,material);m.name=name;m.castShadow=true;m.receiveShadow=true;m.userData.presentationVariant=true;group.add(m);}}
 }
 group.updateWorldMatrix(true,true);
 const api={group,state,dispose(){if(state.disposed)return;group.removeFromParent();for(const s of capOriginals){s.cap.position.copy(s.position);s.cap.matrix.copy(s.matrix);s.cap.matrixAutoUpdate=s.matrixAutoUpdate;s.cap.matrixWorldNeedsUpdate=true;}geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());state.disposed=true;state.enabled=false;installed.delete(model);}};
 installed.set(model,api);return api;
}
