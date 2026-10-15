import * as T from 'three';
import {canopyDiffuser} from './CanopyDiffuser';
import {linarWood} from './LinarWood';
import {makeInstallationBendState} from './linar-reference/installationBend';
import {calculateCadCutGeometryMm,derivePatternCompatibleModule,deriveSplitEdgeLamellaLayout} from './linar-reference/linarGeometry';
import {arrangeModules,installationPoint} from './LinarArrangement';
import {routedBridge,bridgeContact,tintSolid} from './LinarSolidGeometry';
import {LinarSolidVisibility} from './LinarSolidVisibility';
import {LinarLayoutTransition} from './LinarLayoutTransition';
import {calculateBridgeLengthMm,resolveLinarTech} from './linar-reference/linarData';
import {DEFAULT_LINAR_CONFIG,type LinarApplication,type LinarMaterialId,type LinarBacking,type LinarVeneerId,type LinarMdfColourId,type LinarFeltColourId,type LinarFleeceColourId} from './linar-reference/types';
import {LINAR_MATERIAL_LOOKS,LINAR_VENEER_LOOKS,findMdfColour,findFeltColour,findFleeceColour,backingVisualProfile} from './linar-reference/materialData';
export type Application=LinarApplication;
export type LinarSettings={enabled:boolean;finish:'birch'|'spruce'|'mdf';width:number;height:number;curve:number;coverage:'both'|'front';bend:number;sCurve:number;panels:number;veneer:LinarVeneerId;mdfVariant:'natural'|'valchromat';colour:LinarMdfColourId;backing:LinarBacking;fleeceColour:LinarFleeceColourId;feltColour:LinarFeltColourId;incision:number;thicknessMm:number};
export const linarDefaults:LinarSettings={enabled:true,finish:'birch',width:2.4,height:2.8,curve:.2,coverage:'both',bend:-8,sCurve:0,panels:2,veneer:'none',mdfVariant:'natural',colour:'grey',backing:'acoustic-fleece',fleeceColour:'black',feltColour:'raw-white',incision:60,thicknessMm:9};
export const defaults:Record<Application,LinarSettings>={wall:{...linarDefaults},freestanding:{...linarDefaults,width:4.8,height:2.8,curve:.7,bend:100,sCurve:50,panels:4,thicknessMm:15,backing:'none',finish:'mdf',mdfVariant:'valchromat',colour:'mint-green'},ceiling:{...linarDefaults,width:3.6,height:2.4,curve:.45,bend:-7,sCurve:65,panels:3,backing:'none',feltColour:'granite',finish:'birch'}};
const ids:Application[]=['wall','freestanding','ceiling'];
function resolvedBend(s:LinarSettings,id:Application,referenceRadiusMm:number|null){
 const moduleCount=id==='wall'?1:s.panels,moduleWidth=s.width/moduleCount;
 const sample=(control:number)=>{const state=makeInstallationBendState(control,moduleCount,moduleWidth,referenceRadiusMm,moduleWidth,s.sCurve,s.thicknessMm/2000+(s.backing==='none'?0:.0022)),placements=arrangeModules(moduleCount,moduleWidth,state);let min=Infinity,max=-Infinity;for(let i=0;i<=1024;i++){const z=installationPoint((i/1024-.5)*s.width,moduleCount,moduleWidth,state,placements).z;min=Math.min(min,z);max=Math.max(max,z);}return{state,placements,min,max};};
 let shape=sample(s.bend),effective=s.bend;if(shape.max-shape.min>s.curve){let low=0,high=Math.abs(s.bend);for(let i=0;i<18;i++){const mid=(low+high)/2,test=sample(Math.sign(s.bend)*mid);if(test.max-test.min>s.curve)high=mid;else low=mid;}effective=Math.sign(s.bend)*low;shape=sample(effective);}
 return{shape,effective};
}
/** Uses unchanged client palette and C/S math. Room envelopes are visual limits. */
export class LinarWalls{
 readonly canopyLight=new T.SpotLight(0xffe5bc,600,12,.34,.12,2);
 canopyLightEnabled=true;receptionEnabled=true;
 readonly metrics:{id:string;totalMs:number;shapeMs:number;solidsMs:number;finishMs:number}[]=[];
 private solids=new LinarSolidVisibility();
 private layout?:LinarLayoutTransition;
 beginLayout(id:Application){this.finishLayout();const old=this.root.children.find(g=>g.userData.application===id);if(!old){this.rebuild(id);return;}const geometries=this.solids.remove(id);old.traverse(o=>{if(o instanceof T.Mesh)geometries.add(o.geometry);});old.removeFromParent();this.deformers.delete(id);this.rebuild(id);const target=this.root.children.find(g=>g.userData.application===id)!;
  this.layout=new LinarLayoutTransition(old,target,()=>{const materials=new Set<T.Material>();old.traverse(o=>{if(o instanceof T.Mesh){if(o instanceof T.InstancedMesh)o.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());});
 }
 updateLayout(progress:number){this.layout?.update(progress);}
 finishLayout(){this.layout?.finish();this.layout=undefined;}
 inspectLayout(){return this.layout?.inspect()??null;}
 private deformers=new Map<Application,{key:string;apply:(started:number)=>void}>();

 readonly root=new T.Group();selected:Application='wall';states:Record<Application,LinarSettings>=structuredClone(defaults);
 get settings(){return this.states[this.selected];}set settings(value:LinarSettings){this.states[this.selected]=value;}
 constructor(){this.root.name='WEB_LINAR_Installations';const light=this.canopyLight;light.name='LINAR_Canopy_Ambient_Proxy';light.angle=1.2;light.penumbra=1;light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.camera.near=.02;light.shadow.camera.far=12;light.shadow.bias=-.00001;light.shadow.normalBias=.0005;this.root.add(light,light.target);this.rebuildAll();}
 setReceptionEnabled(enabled:boolean){this.receptionEnabled=enabled;this.setCanopyLight(this.canopyLightEnabled);}
 setCanopyLight(enabled:boolean){this.canopyLightEnabled=enabled;const active=enabled&&this.receptionEnabled&&this.states.ceiling.enabled;this.canopyLight.visible=active;this.canopyLight.intensity=active?2:0;const diffuser=this.root.getObjectByName('LINAR_Curved_LED_Diffuser') as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial[]>|undefined;if(diffuser)diffuser.material[4].emissiveIntensity=active?3:0;}
 private dispose(group:T.Object3D){const geometries=this.solids.remove(group.userData.application),materials=new Set<T.Material>(),textures=new Set<T.Texture>();group.traverse(o=>{if(o instanceof T.Mesh){if(o instanceof T.InstancedMesh)o.dispose();geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);if(m instanceof T.MeshStandardMaterial&&m.map)textures.add(m.map);if(o.userData.faceMaterial)materials.add(o.userData.faceMaterial);}}});geometries.forEach(g=>g.dispose());materials.forEach(m=>{if(m!==this.solids.shadowMaterial)m.dispose();});textures.forEach(t=>t.dispose());group.removeFromParent();}
 reset(all=false){if(all||this.selected==='ceiling')this.canopyLightEnabled=true;if(all){this.states=structuredClone(defaults);this.rebuildAll();}else{this.states[this.selected]=structuredClone(defaults[this.selected]);this.rebuild();}}
 effectiveBend(id:Application,settings:LinarSettings){const material:LinarMaterialId=settings.finish==='birch'?'plywood':settings.finish==='spruce'?'three-layer-spruce':'mdf',tech=resolveLinarTech({...DEFAULT_LINAR_CONFIG,material,thicknessMm:settings.thicknessMm,incisionLengthMm:settings.incision,backing:settings.backing});return resolvedBend(settings,id,tech.referenceMinimumRadiusMm).effective;}
 rebuildAll(){for(const id of ids)this.rebuild(id);}
 rebuild(id:Application=this.selected){
  this.finishLayout();
  const started=performance.now();
  let s=this.states[id];if(id==='ceiling')s.backing='none';s.width=T.MathUtils.clamp(s.width,1.2,id==='wall'?2.6:4.8);s.height=T.MathUtils.clamp(s.height,id==='wall'?1.5:1.2,id==='wall'?3.6:id==='freestanding'?2.8:2.8);s.bend=T.MathUtils.clamp(s.bend,-100,100);s.sCurve=T.MathUtils.clamp(s.sCurve,0,100);s.curve=T.MathUtils.clamp(s.curve,0,id==='wall'?.2:id==='freestanding'?.7:.45);s.incision=T.MathUtils.clamp(s.incision,40,400);s.thicknessMm=T.MathUtils.clamp(s.thicknessMm,4,15);
  const {bend:_bend,sCurve:_sCurve,curve:_curve,enabled:_enabled,...topology}=s,key=JSON.stringify(topology),cached=this.deformers.get(id);if(cached?.key===key){cached.apply(started);return;}
  const old=this.root.children.find(g=>g.userData.application===id);if(old)this.dispose(old);this.deformers.delete(id);
  const installation=new T.Group();installation.name=`LINAR_${id}`;installation.userData.application=id;installation.visible=s.enabled;this.root.add(installation);
  const materialId:LinarMaterialId=s.finish==='birch'?'plywood':s.finish==='spruce'?'three-layer-spruce':'mdf',look=s.veneer==='none'?LINAR_MATERIAL_LOOKS[materialId]:LINAR_VENEER_LOOKS[s.veneer];
  const colour=s.veneer==='none'&&s.finish==='mdf'?(s.mdfVariant==='valchromat'?findMdfColour(s.colour).swatch:'#b99c72'):look.face;
  const thickness=s.thicknessMm/1000,config={...DEFAULT_LINAR_CONFIG,material:materialId,thicknessMm:s.thicknessMm,incisionLengthMm:s.incision,backing:s.backing},tech=resolveLinarTech(config),cad=calculateCadCutGeometryMm(s.thicknessMm),bridge=calculateBridgeLengthMm(config).valueMm/1000,bridgeHeight=cad.bridgeHeightMm/1000,incision=s.incision/1000,bridgePitch=bridge+incision;
  const moduleCount=id==='wall'?1:s.panels,moduleWidth=s.width/moduleCount;
  let {shape,effective}=resolvedBend(s,id,tech.referenceMinimumRadiusMm);
  const shapeDone=performance.now();
  let zOffset=id==='freestanding'?-(shape.min+shape.max)/2:-shape.min;
  const point=(x:number)=>{const p=installationPoint(x,moduleCount,moduleWidth,shape.state,shape.placements);p.z+=zOffset;return p;};
  const material=new T.MeshStandardMaterial({color:colour,roughness:look.roughness,side:T.FrontSide,vertexColors:true});if(s.finish!=='mdf'||s.veneer!=='none')linarWood(material);
  const ratio=(value:string)=>{if(s.finish==='mdf'&&s.veneer==='none')return new T.Color(1,1,1);const c=new T.Color(value),base=new T.Color(colour);return new T.Color(c.r/base.r,c.g/base.g,c.b/base.b);};
  const tint=(g:T.BufferGeometry)=>tintSolid(g,ratio(look.cut),ratio(look.end),ratio(look.reverse));
  const group=new T.Group();group.name='LINAR_panel_module';const pivot=new T.Object3D(),specs=deriveSplitEdgeLamellaLayout(derivePatternCompatibleModule(s.width*1000,4,4),4),count=specs.length;
  const slats=new T.InstancedMesh(tint(new T.BoxGeometry(1,1,1)),material,count);slats.name='LINAR_4mm_slats';slats.castShadow=slats.receiveShadow=true;group.add(slats);
  slats.userData.layoutColumns=specs.map((_,i)=>i);slats.userData.layoutColumnCount=count;
  const profiles=new Map<string,{start:number;end:number;matrices:T.Matrix4[];columns:number[]}>(),poses=specs.map(v=>point(v.centreMm/1000));let minimumContact=Infinity;
  for(let i=0;i<count;i++){const p=poses[i];pivot.position.set(p.x,s.height/2,p.z);pivot.rotation.set(0,p.rotY,0);pivot.scale.set(specs[i].widthMm/1000,s.height,thickness);pivot.updateMatrix();slats.setMatrixAt(i,pivot.matrix);
   if(i===count-1)continue;const contact=bridgeContact(p,poses[i+1],thickness,bridgeHeight,specs[i].widthMm/1000,specs[i+1].widthMm/1000);minimumContact=Math.min(minimumContact,contact.width-.00008);
   for(let k=-1;k<=Math.ceil(s.height/bridgePitch)+1;k++){const center=(i%2)*bridgePitch/2+k*bridgePitch,start=center-bridge/2,bottom=Math.max(0,start),top=Math.min(s.height,center+bridge/2);if(top-bottom<.00035)continue;const a=(bottom-start)/bridge,b=(top-start)/bridge,key=`${a.toFixed(6)}:${b.toFixed(6)}`;
    const profile=profiles.get(key)??{start:a,end:b,matrices:[],columns:[]};pivot.position.set(contact.x,(bottom+top)/2,contact.z);pivot.rotation.set(0,contact.rotation,0);pivot.scale.set(contact.width,top-bottom,bridgeHeight);pivot.updateMatrix();profile.matrices.push(pivot.matrix.clone());profile.columns.push(i);profiles.set(key,profile);
   }
  }
  const variants=new Map<string,T.BufferGeometry[]>([[slats.name,[slats.geometry]]]);let profileIndex=0;
  for(const p of profiles.values()){const lods=[2,4,16].map(steps=>tint(routedBridge(cad,steps,p.start,p.end))),mesh=new T.InstancedMesh(lods[0],material,p.matrices.length);mesh.name=`LINAR_routed_bridges_${profileIndex++}`;mesh.userData.layoutColumns=p.columns;mesh.userData.layoutColumnCount=count;p.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);variants.set(mesh.name,lods);}
  const solidsDone=performance.now();
  let backingMesh:T.Mesh|undefined,backingRest:Float32Array|undefined;
  // Backings also have their reference thickness: fleece 0.3 mm, felt 2 mm.
  if(s.backing!=='none'){const profile=backingVisualProfile(s.backing,s.fleeceColour),backColour=s.backing==='felt'?findFeltColour(s.feltColour).swatch:findFleeceColour(s.fleeceColour).swatch,backThickness=profile.thicknessMm/1000,g=new T.BoxGeometry(s.width,s.height,backThickness,256,1,1),a=g.getAttribute('position'),center=-thickness/2-.0001-backThickness/2;backingRest=new Float32Array(a.array);for(let i=0;i<a.count;i++){const p=point(a.getX(i)),offset=center+a.getZ(i);a.setXYZ(i,p.x+Math.sin(p.rotY)*offset,a.getY(i),p.z+Math.cos(p.rotY)*offset);}g.computeVertexNormals();const m=new T.MeshStandardMaterial({color:backColour,roughness:1,side:T.FrontSide,transparent:profile.opacity<1,opacity:profile.opacity,depthWrite:profile.opacity===1}),back=new T.Mesh(g,m);backingMesh=back;back.name='LINAR_backing';back.position.y=s.height/2;back.castShadow=profile.castShadow;back.receiveShadow=true;group.add(back);}
  installation.add(group);
  if(id==='wall'){group.position.set(27,.5,-36.915);if(s.coverage==='both'){const right=group.clone(true);right.position.x=35;installation.add(right);}}
  // The reference divider meets the floor directly, without projecting feet or clamps.
  if(id==='freestanding'){group.position.set(40.2,.30035,-33.4);group.rotation.y=Math.PI/2;}
  if(id==='ceiling'){group.add(canopyDiffuser(s.width,s.height,thickness,point));const center=point(0);this.canopyLight.position.set(31.055+center.x,5.6-center.z+.4,-35.35);this.canopyLight.target.position.set(31.055+center.x,.30035,-35.35);group.position.set(31.055,5.6,-35.35-s.height/2);group.rotation.x=Math.PI/2;const cable=new T.InstancedMesh(new T.CylinderGeometry(.003,.003,1,5),new T.MeshStandardMaterial({color:'#626461',metalness:.7,roughness:.5}),4);cable.name='LINAR_Ceiling_Cables';const anchors=new T.InstancedMesh(new T.CylinderGeometry(.025,.025,.016,8),cable.material,4);anchors.name='LINAR_Ceiling_Anchors';let index=0;for(const x of [-s.width*.3,s.width*.3])for(const z of [-s.height*.35,s.height*.35]){const anchor=point(x),length=.981+anchor.z;pivot.position.set(31.055+anchor.x,6.581-length/2,-35.35+z);pivot.rotation.set(0,0,0);pivot.scale.set(1,length,1);pivot.updateMatrix();cable.setMatrixAt(index,pivot.matrix);pivot.position.y=6.581;pivot.scale.set(1,1,1);pivot.updateMatrix();anchors.setMatrixAt(index++,pivot.matrix);}installation.add(cable,anchors);}
  this.setCanopyLight(this.canopyLightEnabled);installation.userData.shape={requested:s.bend,effective,roomLimited:Math.abs(effective-s.bend)>.01,depth:shape.max-shape.min,minimumLocalRadiusMm:shape.state.minimumLocalRadiusMm,source:'Existing configurator makeInstallationBendState, tangent-connected module placement and CAD three-arc bridge profile',referenceRadiusMm:tech.referenceMinimumRadiusMm,colour,thicknessMm:s.thicknessMm,topCutDepthMm:cad.topCutDepthMm,bridgeHeightMm:cad.bridgeHeightMm,bridgeSpanMm:cad.bridgeSpanMm,moduleCount,moduleWidth,unfoldedWidth:s.width,moduleHeight:s.height,placements:shape.placements,closedSolidGeometry:true,flatAlphaPlaneCount:0,distantLOD:'Opaque closed routed solids on both faces at every distance; only arc tessellation changes',profileSteps:[2,4,16],minimumBridgeContactMm:minimumContact*1000};this.root.updateWorldMatrix(true,true);
  installation.traverse(o=>{if(o instanceof T.InstancedMesh&&variants.has(o.name))this.solids.register(id,o,variants.get(o.name)!);});
  // Shape-only edits retain the exact routed solids, GPU buffers and materials.
  // All complete transforms are restored before refreshing visibility/collision bounds.
  const sources=new Map<string,{values:Float32Array;columns?:number[]}>();sources.set(slats.name,{values:new Float32Array(slats.instanceMatrix.array)});
  [...profiles.values()].forEach((p,i)=>{const mesh=group.getObjectByName(`LINAR_routed_bridges_${i}`) as T.InstancedMesh;sources.set(mesh.name,{values:new Float32Array(mesh.instanceMatrix.array),columns:p.columns});});
  this.deformers.set(id,{key,apply:(begin)=>{
   s=this.states[id];({shape,effective}=resolvedBend(s,id,tech.referenceMinimumRadiusMm));zOffset=id==='freestanding'?-(shape.min+shape.max)/2:-shape.min;
   const shapeEnd=performance.now(),nextPoses=specs.map(v=>point(v.centreMm/1000)),contacts=nextPoses.slice(0,-1).map((p,i)=>bridgeContact(p,nextPoses[i+1],thickness,bridgeHeight,specs[i].widthMm/1000,specs[i+1].widthMm/1000));minimumContact=Math.min(...contacts.map(c=>c.width-.00008));
   const transform=(x:number,z:number,angle:number,w:number,t:number)=>{const c=Math.cos(angle),sin=Math.sin(angle);return[c*w,-sin*w,sin*t,c*t,x,z];},slatTransforms=nextPoses.map((p,i)=>transform(p.x,p.z,p.rotY,specs[i].widthMm/1000,thickness)),bridgeTransforms=contacts.map(p=>transform(p.x,p.z,p.rotation,p.width,bridgeHeight));
   for(const [name,source] of sources){const a=source.values;for(let i=0;i<a.length/16;i++){const p=source.columns?bridgeTransforms[source.columns[i]]:slatTransforms[i],j=i*16;a[j]=p[0];a[j+2]=p[1];a[j+8]=p[2];a[j+10]=p[3];a[j+12]=p[4];a[j+14]=p[5];}
    installation.traverse(o=>{if(o instanceof T.InstancedMesh&&o.name===name){o.instanceMatrix.array.set(a);o.count=a.length/16;o.instanceMatrix.needsUpdate=true;}});
   }
   if(backingMesh&&backingRest){const a=backingMesh.geometry.getAttribute('position'),backThickness=backingVisualProfile(s.backing,s.fleeceColour).thicknessMm/1000,center=-thickness/2-.0001-backThickness/2;for(let i=0;i<a.count;i++){const p=point(backingRest[i*3]),offset=center+backingRest[i*3+2];a.setXYZ(i,p.x+Math.sin(p.rotY)*offset,backingRest[i*3+1],p.z+Math.cos(p.rotY)*offset);}a.needsUpdate=true;backingMesh.geometry.computeVertexNormals();backingMesh.geometry.computeBoundingBox();backingMesh.geometry.computeBoundingSphere();}
   if(id==='ceiling'){
    const diffuser=group.getObjectByName('LINAR_Curved_LED_Diffuser') as T.Mesh;const next=canopyDiffuser(s.width,s.height,thickness,point);diffuser.geometry.dispose();diffuser.geometry=next.geometry;for(const m of next.material)m.dispose();const center=point(0);this.canopyLight.position.set(31.055+center.x,5.6-center.z+.4,-35.35);this.canopyLight.target.position.set(31.055+center.x,.30035,-35.35);
    const cable=installation.getObjectByName('LINAR_Ceiling_Cables') as T.InstancedMesh,anchors=installation.getObjectByName('LINAR_Ceiling_Anchors') as T.InstancedMesh;let index=0;for(const x of [-s.width*.3,s.width*.3])for(const z of [-s.height*.35,s.height*.35]){const anchor=point(x),length=.981+anchor.z;pivot.position.set(31.055+anchor.x,6.581-length/2,-35.35+z);pivot.rotation.set(0,0,0);pivot.scale.set(1,length,1);pivot.updateMatrix();cable.setMatrixAt(index,pivot.matrix);pivot.position.y=6.581;pivot.scale.set(1,1,1);pivot.updateMatrix();anchors.setMatrixAt(index++,pivot.matrix);}for(const m of [cable,anchors]){m.instanceMatrix.needsUpdate=true;m.computeBoundingBox();m.computeBoundingSphere();}
   }
   const solidEnd=performance.now();installation.visible=s.enabled;this.setCanopyLight(this.canopyLightEnabled);Object.assign(installation.userData.shape,{requested:s.bend,effective,roomLimited:Math.abs(effective-s.bend)>.01,depth:shape.max-shape.min,minimumLocalRadiusMm:shape.state.minimumLocalRadiusMm,placements:shape.placements,minimumBridgeContactMm:minimumContact*1000});this.root.updateWorldMatrix(true,true);this.solids.refresh(id);
   const end=performance.now();this.metrics.push({id,totalMs:end-begin,shapeMs:shapeEnd-begin,solidsMs:solidEnd-shapeEnd,finishMs:end-solidEnd});if(this.metrics.length>120)this.metrics.shift();
  }});
  const finished=performance.now();this.metrics.push({id,totalMs:finished-started,shapeMs:shapeDone-started,solidsMs:solidsDone-shapeDone,finishMs:finished-solidsDone});if(this.metrics.length>120)this.metrics.shift();

 }
 update(camera:T.Camera,shadowRefresh=false){this.solids.update(camera,shadowRefresh);}


 inspect(){return{solidBatches:this.solids.inspect(),canopyLight:{enabled:this.canopyLightEnabled,intensity:this.canopyLight.intensity,position:this.canopyLight.position.toArray(),target:this.canopyLight.target.position.toArray(),mapSize:this.canopyLight.shadow.mapSize.toArray(),backingBlocks:false,diffuser:this.root.getObjectByName('LINAR_Curved_LED_Diffuser')?.userData,emission:(this.root.getObjectByName('LINAR_Curved_LED_Diffuser') as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial[]>|undefined)?.material[4].emissiveIntensity,illuminationModel:'Emissive curved diffuser with a broad shadowed ambient proxy; concept visualization'},selected:this.selected,settings:{...this.states.wall},conceptOnly:true,ceiling:true,applications:Object.fromEntries(ids.map(id=>{const g=this.root.children.find(o=>o.userData.application===id)!;const b=new T.Box3().setFromObject(g);return[id,{settings:{...this.states[id]},shape:g.userData.shape,components:g.children.map(o=>o.name),visible:g.visible,bounds:{min:b.min.toArray(),max:b.max.toArray()}}];})),bounds:this.root.children.filter(g=>g.userData.application).flatMap(g=>g.children.filter(o=>o.name==='LINAR_panel_module').map(o=>{const b=new T.Box3().setFromObject(o);return{name:g.name,min:b.min.toArray(),max:b.max.toArray()};}))};}
}






