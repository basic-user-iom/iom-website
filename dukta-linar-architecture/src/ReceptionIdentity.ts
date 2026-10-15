import * as T from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import placement from './exteriorSignPlacement.json';
import {linarLettering,type LetteringSettings} from './LinarLettering';
const bindings=new WeakMap<T.Object3D,(settings:LetteringSettings)=>void>();
export function syncReceptionSign(root:T.Object3D,settings:LetteringSettings){const sign=root.getObjectByName('WEB_LINAR_Reception_Sign');if(sign)bindings.get(sign)?.(settings);}
let fontPromise:ReturnType<FontLoader['loadAsync']>|undefined;
/** Exterior identity belongs to the initially loaded building, not lazy lobby. */
export async function addExteriorSign(root:T.Group){return replaceReceptionSigns(root,root,true);}
export async function replaceReceptionSigns(root:T.Group,woodRoot?:T.Object3D,exteriorOnly=false){
 const font=await (fontPromise??=new FontLoader().loadAsync(`${import.meta.env.BASE_URL}fonts/helvetiker_regular.typeface.json`)),report=[];
 let wood:T.MeshStandardMaterial|undefined;
 woodRoot?.traverse(o=>{if(o instanceof T.Mesh&&o.name==='AE35_010_building_A_wood_A')wood=(Array.isArray(o.material)?o.material:[o.material]).find(m=>m instanceof T.MeshStandardMaterial&&!!m.map&&!m.name.includes('Concrete')) as T.MeshStandardMaterial|undefined;});
 root.updateWorldMatrix(true,true);
 if(!exteriorOnly)root.getObjectByName('AE35_010_reception_logo2')?.removeFromParent();
 for(const name of exteriorOnly?['AE35_010_reception_logo2']:['AE35_010_reception_logo']){
  const old=root.getObjectByName(name);if(!old&&!exteriorOnly)continue;const b=exteriorOnly?new T.Box3(new T.Vector3(...placement.min),new T.Vector3(...placement.max)):new T.Box3().setFromObject(old!),center=b.getCenter(new T.Vector3()),exterior=exteriorOnly;
  let geometry:T.BufferGeometry=new TextGeometry('L I N A R',{font,size:1,depth:.024,curveSegments:5,bevelEnabled:false});geometry.computeBoundingBox();const g=geometry.boundingBox!,width=exterior?b.max.z-b.min.z:b.max.x-b.min.x,height=b.max.y-b.min.y;
  geometry.translate(-(g.min.x+g.max.x)/2,-g.min.y,-g.min.z);geometry.scale(width/(g.max.x-g.min.x),height/(g.max.y-g.min.y),1);
  let material:T.Material|T.Material[]=new T.MeshStandardMaterial({color:'#72716a',metalness:.8,roughness:.32});
  if(exterior&&wood){
   material.dispose();const face=wood.clone();face.name='WEB_LINAR_Exterior_Wood';face.metalness=0;face.roughness=.72;face.roughnessMap=null;face.normalScale.setScalar(.18);if(face instanceof T.MeshPhysicalMaterial)face.clearcoat=0;
   const edge=face.clone();edge.name='WEB_LINAR_Exterior_Wood_Edges';edge.color.multiplyScalar(.86);edge.roughness=.82;
   const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
   // Continuous vertical grain across the letters, at the facade timber scale.
   for(let i=0;i<p.count;i++){const top=Math.abs(n.getY(i))>.7,side=Math.abs(n.getX(i))>.7;uv.setXY(i,(top?p.getZ(i):p.getY(i))/2.8,(side?p.getZ(i):p.getX(i))/1.2);}material=[face,edge];
  }
  let slotCount=0;if(!exterior){const letters=linarLettering(font,width,height);geometry.dispose();geometry=letters.geometry;(material as T.Material).dispose();material=letters.material;slotCount=letters.slots;}
  const sign=new T.Mesh(geometry,material);sign.name=exterior?'WEB_LINAR_Exterior_Sign':'WEB_LINAR_Reception_Sign';sign.position.set(exterior?b.min.x:center.x,b.min.y,exterior?center.z:b.max.z);
  let wallZ:number|undefined,wallObject:string|undefined;
  if(!exterior){const ray=new T.Raycaster(new T.Vector3(center.x,center.y,b.max.z+.1),new T.Vector3(0,0,-1),0,1);const hit=ray.intersectObject(root,true).find(h=>h.object instanceof T.Mesh&&(Array.isArray(h.object.material)?h.object.material:[h.object.material]).some(m=>/reception_Marble/.test(m.name)));if(hit){wallZ=hit.point.z;wallObject=hit.object.name;sign.position.z=wallZ+.001;}}
  if(exterior)sign.rotation.y=-Math.PI/2;sign.castShadow=true;sign.receiveShadow=true;old?.removeFromParent();root.add(sign);sign.updateWorldMatrix(true,false);const bounds=new T.Box3().setFromObject(sign),entry={name:sign.name,text:'LINAR',width,height,finish:exterior&&wood?'existing facade wood':'slotted LINAR birch',slots:slotCount,thicknessMm:exterior?24:9,incisionMm:exterior?undefined:60,bridgeSpanMm:exterior?undefined:geometry.userData.bridgeSpanMm,sourceMaterial:exterior?wood?.name:undefined,sharedColourMap:exterior&&wood?((material as T.Material[])[0] as T.MeshStandardMaterial).map===wood.map:false,grain:exterior?'vertical, 1.2 x 2.8 m tile':undefined,wallZ,wallObject,wallGapMm:wallZ===undefined?undefined:1,geometryId:geometry.uuid,materialIds:(Array.isArray(material)?material:[material]).map(m=>m.uuid),faceColour:exterior?undefined:(material as T.MeshStandardMaterial[])[0].color.getHexString(),revision:0,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};report.push(entry);
  if(!exterior){let previous='';bindings.set(sign,s=>{const key=JSON.stringify([s.incision,s.thicknessMm,s.finish,s.veneer,s.mdfVariant,s.colour]);if(key===previous)return;previous=key;const next=linarLettering(font,width,height,s),oldGeometry=sign.geometry,oldMaterial=sign.material;sign.geometry=next.geometry;sign.material=next.material;oldGeometry.dispose();(Array.isArray(oldMaterial)?oldMaterial:[oldMaterial]).forEach(m=>m.dispose());const box=new T.Box3().setFromObject(sign);Object.assign(entry,{finish:`slotted LINAR ${s.finish}`,slots:next.slots,thicknessMm:s.thicknessMm,incisionMm:s.incision,bridgeSpanMm:next.geometry.userData.bridgeSpanMm,geometryId:next.geometry.uuid,materialIds:next.material.map(m=>m.uuid),faceColour:next.material[0].color.getHexString(),revision:entry.revision+1,bounds:{min:box.min.toArray(),max:box.max.toArray()}});});}
 }return report;
}
