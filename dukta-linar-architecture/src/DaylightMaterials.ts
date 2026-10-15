import * as T from 'three';
import {repairRoofTexture} from './RoofTexture';
import {isEntranceFrame,entranceFinish} from './EntranceMetal';
import {isReceptionWood,lightReceptionWood} from './ReceptionWood';

/** Material-only working-copy overrides; all original GLBs remain untouched. */
export class DaylightMaterials{
 private textures=new Map<string,Promise<T.Texture>>();private replacements=new Map<string,T.MeshPhysicalMaterial>();
 readonly bindings:unknown[]=[];
 readonly applied:{name:string;finish:string}[]=[];
 readonly uvAssignments:{mesh:string;tileMetres:number[];channel:string;vertices:number;uvRange:number[][]}[]=[];
 readonly soffits:{mesh:string;triangles:number;heights:number[];tileMetres:number[]}[]=[];
 readonly roofs:NonNullable<ReturnType<typeof repairRoofTexture>>[]=[];
 private map(id:string,kind:string,channel=0){const key=`${id}-${kind}-${channel}`;if(!this.textures.has(key))this.textures.set(key,new T.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}materials/daylight/${id}-${kind}.webp`).then(t=>{t.name=`${id}-${kind}`;t.colorSpace=kind==='Color'?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.channel=channel;t.anisotropy=4;return t;}));return this.textures.get(key)!;}
 private physical(old:T.MeshStandardMaterial){const m=new T.MeshPhysicalMaterial();T.MeshStandardMaterial.prototype.copy.call(m,old);if(old instanceof T.MeshPhysicalMaterial)m.copy(old);m.userData={...old.userData,daylight:true};return m;}
 private metricUV(mesh:T.Mesh,width:number,height:number,channel='uv',horizontal=false){
  const g=mesh.geometry.clone(),a=g.getAttribute('position'),n=g.getAttribute('normal'),uv=new Float32Array(a.count*2),normalMatrix=new T.Matrix3().getNormalMatrix(mesh.matrixWorld);
  for(let i=0;i<a.count;i++){const p=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld),normal=n?new T.Vector3().fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize():new T.Vector3(0,1,0);let u:number,v:number;if(horizontal||Math.abs(normal.y)>.7){u=p.x;v=-p.z;}else if(Math.abs(normal.x)>Math.abs(normal.z)){u=-p.z;v=p.y;}else{u=p.x;v=p.y;}uv[i*2]=u/width;uv[i*2+1]=v/height;}
  g.deleteAttribute('tangent');g.setAttribute(channel,new T.BufferAttribute(uv,2));mesh.geometry=g;mesh.userData.metricUV={tileMetres:[width,height],channel};let u0=Infinity,u1=-Infinity,v0=Infinity,v1=-Infinity;for(let i=0;i<a.count;i++){u0=Math.min(u0,uv[i*2]);u1=Math.max(u1,uv[i*2]);v0=Math.min(v0,uv[i*2+1]);v1=Math.max(v1,uv[i*2+1]);}this.uvAssignments.push({mesh:mesh.name,tileMetres:[width,height],channel,vertices:a.count,uvRange:[[u0,v0],[u1,v1]]});
 }
 async apply(root:T.Group,layer:string){
  if(!['building','lobby','street','lounge'].includes(layer))return;root.updateWorldMatrix(true,true);const meshes:T.Mesh[]=[];root.traverse(o=>{if(o instanceof T.Mesh)meshes.push(o);});
  for(const mesh of meshes){
   if(layer==='building'){const roof=repairRoofTexture(mesh);if(roof)this.roofs.push(roof);}
   if(mesh.name==='AE35_010_building_A_wood_A'&&mesh.material instanceof T.MeshStandardMaterial){
    const concrete=this.physical(mesh.material);concrete.name='WEB_Reception_Matte_Concrete';[concrete.map,concrete.normalMap,concrete.roughnessMap]=await Promise.all(['Color','NormalGL','Roughness'].map(k=>this.map('Concrete034',k)));concrete.color.set('#e1e0db');concrete.roughness=1;concrete.metalness=0;concrete.normalScale.setScalar(.07);concrete.clearcoat=0;
    const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone(),p=g.getAttribute('position'),uv=g.getAttribute('uv').clone();g.clearGroups();let groupStart=0,last=-1,changed=0;
    for(let i=0;i<p.count;i+=3){const pts=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,i+j).applyMatrix4(mesh.matrixWorld));const selected=pts.every(v=>v.z> -37.05&&v.z< -36.8&&v.y<6.7),slot=selected?1:0;if(selected){changed++;pts.forEach((v,j)=>uv.setXY(i+j,v.x/1.1,v.y/.55));}if(last!==slot){if(last>=0)g.addGroup(groupStart,i-groupStart,last);groupStart=i;last=slot;}}
    if(last>=0)g.addGroup(groupStart,p.count-groupStart,last);g.setAttribute('uv',uv);mesh.geometry=g;mesh.material=[mesh.material,concrete];mesh.userData.concreteTriangles=changed;this.applied.push({name:concrete.name,finish:`matte concrete reception face (${changed} triangles)`});
   }
   const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material],next:T.Material[]=[];
   for(const old of mats){if(!(old instanceof T.MeshStandardMaterial)){next.push(old);continue;}const name=old.name;
    const floor=/^AE35_010_Building_A_carpets$/i.test(name),wall=/^AE35_010_building_A_white$/.test(name),pillars=/orange_pillars/.test(name),road=/^AE35_010_road_AE35/.test(name),paint=/^AE35_010_car_B_237$|REC_Carpaint/.test(name),windshield=/^AE35_010_car_B_134$/.test(name),marble=/reception_Marble/.test(name);
    const receptionWood=isReceptionWood(layer,mesh.name,name);
    const entranceMetal=isEntranceFrame(layer,mesh.name,name);
    const elevatorMetal=layer==='lobby'&&/^AE35_010_building_A_elevator_door/.test(mesh.name)&&name==='AE35_010_elevator_door_metal_AE35_010_metal_linear_bump';
    const metricMetal=entranceMetal||elevatorMetal;
    const pavement=/^AE35_010_pavement_color_1$/.test(name),planter=/^AE35_010_concrete_pot_/.test(name),bollard=name==='AE35_010_lamp_pavement_base',bench=/^AE35_010_bench_/.test(name);
    if(![floor,wall,pillars,road,paint,windshield,marble,pavement,planter,bollard,bench,metricMetal,receptionWood].some(Boolean)){next.push(old);continue;}
    if(floor)this.metricUV(mesh,1.1,.55,'uv',true);if(wall)this.metricUV(mesh,1,1);if(pillars)this.metricUV(mesh,.25,.25);if(road)this.metricUV(mesh,2,2,'uv1',true);
    if(pavement)this.metricUV(mesh,1.2,1.2);if(metricMetal)this.metricUV(mesh,.25,.25);
    const key=receptionWood?`reception-wood:${name}`:entranceMetal?`entrance-metal:${name}`:name;let m=this.replacements.get(key);if(!m){m=receptionWood?lightReceptionWood(old):entranceMetal?entranceFinish(old):this.physical(old);

     if(elevatorMetal){for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap','bumpMap'] as const){const oldMap=m[key];if(!oldMap)continue;const texture=oldMap.clone();texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.offset.set(0,0);texture.repeat.set(1,1);texture.center.set(0,0);texture.rotation=0;texture.channel=0;texture.matrixAutoUpdate=true;texture.updateMatrix();texture.needsUpdate=true;m[key]=texture;}m.userData.metricMetal={tileMetres:[.25,.25],sourceFinishPreserved:true,uvSpace:'world metres',channel:0};}
     if(floor){[m.map,m.normalMap,m.roughnessMap]=await Promise.all(['Color','NormalGL','Roughness'].map(k=>this.map('Concrete034',k)));m.color.set('#d8d5cc');m.metalness=0;m.roughness=.55;m.normalScale.setScalar(.16);m.clearcoat=.12;m.clearcoatRoughness=.35;}
     if(wall){[m.map,m.normalMap,m.roughnessMap]=await Promise.all(['Color','NormalGL','Roughness'].map(k=>this.map('Plaster001',k)));m.color.set('#eeeae3');m.metalness=0;m.roughness=.95;m.normalScale.setScalar(.12);}
     if(pillars){m.metalness=0;m.roughness=.38;m.clearcoat=.28;m.clearcoatRoughness=.3;m.roughnessMap=await this.map('Plaster001','Roughness');m.normalMap=await this.map('Plaster001','NormalGL');m.normalScale.setScalar(.025);m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor, 0.32, 0.42);');};m.customProgramCacheKey=()=> 'orange-painted-steel-satin';}
     if(road){m.normalMap=await this.map('Asphalt009','NormalGL',1);m.roughnessMap=await this.map('Asphalt009','Roughness',1);m.normalScale.setScalar(.45);m.roughness=.94;m.metalness=0;}
     if(pavement){[m.map,m.normalMap,m.roughnessMap]=await Promise.all(['Color','NormalGL','Roughness'].map(k=>this.map('Pavers',k)));m.color.set('#ffffff');m.metalness=0;m.roughness=1;m.normalScale.setScalar(.35);}
     if(planter){m.metalness=0;m.roughness=.88;m.clearcoat=0;m.normalScale.setScalar(.35);}
     if(bollard){m.metalness=0;m.roughness=.42;m.clearcoat=0;}
     if(bench){m.metalness=0;m.roughness=.72;m.clearcoat=0;}
     if(paint){m.metalness=.35;m.roughness=.26;m.clearcoat=1;m.clearcoatRoughness=.12;}
     if(windshield){m.color.set('#e0eceb');m.metalness=0;m.roughness=.025;m.transmission=.96;m.thickness=.004;m.ior=1.5;m.transparent=false;m.opacity=1;m.depthWrite=true;m.side=T.FrontSide;}
     if(marble){m.metalness=0;m.roughness=.25;m.clearcoat=.12;m.clearcoatRoughness=.25;}
     m.needsUpdate=true;this.replacements.set(key,m);this.applied.push({name,finish:receptionWood?'light low-contrast natural wood, satin sealed surface':metricMetal?(elevatorMetal?'original elevator metal finish, metric 25 cm UV':'dark bronze satin anodized aluminum entrance frame, uniform roughness'):floor?'polished concrete':wall?'matte plaster':pillars?'orange painted metal':road?'dry asphalt with original markings':paint?'clearcoated car paint':windshield?'thin automotive glass':planter?'dry concrete planter':bollard?'satin powder-coated bollard':bench?'exterior timber bench':pavement?'metric concrete pavers':'honed marble'});
    }next.push(m);
   }mesh.material=Array.isArray(mesh.material)?next:next[0];
   // The slab undersides share the source wall material. Partition only their
   // downward-facing triangles; keep wall faces, transforms and normals intact.
   if(layer==='building'&&mesh.name.startsWith('AE35_010_building_A_walls_interior')&&mesh.material instanceof T.MeshStandardMaterial){
    const g=mesh.geometry,p=g.getAttribute('position'),index=g.getIndex(),keep:number[]=[],underside:number[]=[],heights=new Set<number>();
    for(let i=0;i<(index?.count??p.count);i+=3){const indices=[0,1,2].map(j=>index?index.getX(i+j):i+j),pts=indices.map(j=>new T.Vector3().fromBufferAttribute(p,j).applyMatrix4(mesh.matrixWorld)),n=pts[1].clone().sub(pts[0]).cross(pts[2].clone().sub(pts[0])).normalize(),y=(pts[0].y+pts[1].y+pts[2].y)/3,selected=n.y<-.98&&(Math.abs(y-3.243714)<.01||Math.abs(y-6.589072)<.01);(selected?underside:keep).push(...indices);if(selected)heights.add(Number(y.toFixed(3)));}
    if(underside.length){let concrete=this.replacements.get('WEB_Reception_Concrete_Soffit');if(!concrete){concrete=new T.MeshPhysicalMaterial({name:'WEB_Reception_Concrete_Soffit',color:'#e7e6e1',metalness:0,roughness:.92,clearcoat:0});[concrete.map,concrete.normalMap,concrete.roughnessMap]=await Promise.all(['Color','NormalGL','Roughness'].map(k=>this.map('Concrete034',k,1)));concrete.normalScale.setScalar(.24);concrete.userData.daylight=true;concrete.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = max(roughnessFactor, 0.78);');};concrete.customProgramCacheKey=()=> 'cast-concrete-soffit';this.replacements.set(concrete.name,concrete);this.applied.push({name:concrete.name,finish:'matte concrete slab undersides, existing PBR maps'});}
     this.metricUV(mesh,1.6,.8,'uv1',true);mesh.geometry.setIndex([...keep,...underside]);mesh.geometry.clearGroups();if(keep.length)mesh.geometry.addGroup(0,keep.length,0);mesh.geometry.addGroup(keep.length,underside.length,1);mesh.material=[mesh.material,concrete];this.soffits.push({mesh:mesh.name,triangles:underside.length/3,heights:[...heights],tileMetres:[1.6,.8]});
    }
   }
   this.bindings.push({layer,mesh:mesh.name,materials:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>{const p=m as T.MeshStandardMaterial;return {name:m.name,color:p.color?.toArray(),metalness:p.metalness,roughness:p.roughness,map:p.map?.name,normal:p.normalMap?.name,roughnessMap:p.roughnessMap?.name,metalnessMap:p.metalnessMap?.name,aoMap:p.aoMap?.name,alphaMap:p.alphaMap?.name,opacity:p.opacity,transparent:p.transparent};})});
  }
 }
 inspect(){return {bindings:this.bindings,roofs:this.roofs,applied:this.applied,soffits:this.soffits,uvAssignments:this.uvAssignments,loadedTextures:this.textures.size,materials:[...this.replacements.values()].map(m=>({name:m.name,metalness:m.metalness,roughness:m.roughness,clearcoat:m.clearcoat,clearcoatRoughness:m.clearcoatRoughness,normalScale:m.normalScale.toArray(),transmission:m.transmission,color:m.color.toArray(),map:m.map?.name,normal:m.normalMap?.name,normalChannel:m.normalMap?.channel,roughnessMap:m.roughnessMap?.name,metalnessMap:m.metalnessMap?.name,aoMap:m.aoMap?.name,metalnessColorSpace:m.metalnessMap?.colorSpace,aoColorSpace:m.aoMap?.colorSpace,textureSize:m.map?[(m.map.image as HTMLImageElement).width,(m.map.image as HTMLImageElement).height]:undefined,receptionWood:m.userData.receptionWood,entranceFinish:m.userData.entranceFinish,entranceEnvironment:m.userData.entranceFinish?{bound:!!m.envMap,uuid:m.envMap?.uuid,intensity:m.envMapIntensity,rotation:m.envMapRotation.toArray()}:undefined,scratchedMetal:m.userData.scratchedMetal,metricMetal:m.userData.metricMetal,mapColorSpace:m.map?.colorSpace,normalColorSpace:m.normalMap?.colorSpace,roughnessColorSpace:m.roughnessMap?.colorSpace,anisotropy:m.map?.anisotropy}))};}
}



