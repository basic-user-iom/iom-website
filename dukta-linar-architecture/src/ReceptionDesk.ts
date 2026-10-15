import * as T from 'three';
import {linarDefaults,type LinarSettings} from './LinarWalls';
import {linarWood} from './LinarWood';
import {routedBridge,tintSolid} from './LinarSolidGeometry';
import {calculateCadCutGeometryMm,derivePatternCompatibleModule,deriveSplitEdgeLamellaLayout} from './linar-reference/linarGeometry';
import {calculateBridgeLengthMm} from './linar-reference/linarData';
import {DEFAULT_LINAR_CONFIG,type LinarMaterialId} from './linar-reference/types';
import {LINAR_MATERIAL_LOOKS,LINAR_VENEER_LOOKS,findMdfColour} from './linar-reference/materialData';

export const deskDefaults:LinarSettings={...linarDefaults,finish:'birch',thicknessMm:9,incision:60,backing:'none',bend:0,sCurve:0};
/** Closed 4 mm lamellae and routed CAD bridges, using the same palette and cut profile as the room panels. */
export function flatDeskPanel(width:number,height:number,s:LinarSettings){
 const id:LinarMaterialId=s.finish==='birch'?'plywood':s.finish==='spruce'?'three-layer-spruce':'mdf',look=s.veneer==='none'?LINAR_MATERIAL_LOOKS[id]:LINAR_VENEER_LOOKS[s.veneer],colour=s.veneer==='none'&&s.finish==='mdf'?(s.mdfVariant==='valchromat'?findMdfColour(s.colour).swatch:'#b99c72'):look.face;
 const material=new T.MeshStandardMaterial({name:'LINAR_Reception_Desk_Finish',color:colour,roughness:look.roughness,side:T.FrontSide,vertexColors:true});if(s.finish!=='mdf'||s.veneer!=='none')linarWood(material);
 const ratio=(v:string)=>{if(s.finish==='mdf'&&s.veneer==='none')return new T.Color(1,1,1);const a=new T.Color(v),b=new T.Color(colour);return new T.Color(a.r/b.r,a.g/b.g,a.b/b.b);},tint=(g:T.BufferGeometry)=>tintSolid(g,ratio(look.cut),ratio(look.end),ratio(look.reverse));
 const group=new T.Group(),thickness=s.thicknessMm/1000,cad=calculateCadCutGeometryMm(s.thicknessMm),config={...DEFAULT_LINAR_CONFIG,material:id,thicknessMm:s.thicknessMm,incisionLengthMm:s.incision},bridge=calculateBridgeLengthMm(config).valueMm/1000,pitch=bridge+s.incision/1000,bridgeHeight=cad.bridgeHeightMm/1000,specs=deriveSplitEdgeLamellaLayout(derivePatternCompatibleModule(width*1000,4,4),4),pivot=new T.Object3D();
 const slats=new T.InstancedMesh(tint(new T.BoxGeometry(1,1,1)),material,specs.length);slats.name='LINAR_Desk_4mm_slats';slats.castShadow=slats.receiveShadow=true;group.add(slats);const profiles=new Map<string,{a:number;b:number;matrices:T.Matrix4[]}>();
 specs.forEach((v,i)=>{pivot.position.set(v.centreMm/1000,height/2,0);pivot.scale.set(v.widthMm/1000,height,thickness);pivot.updateMatrix();slats.setMatrixAt(i,pivot.matrix);if(i===specs.length-1)return;const right=specs[i+1],leftEdge=(v.centreMm+v.widthMm/2)/1000,rightEdge=(right.centreMm-right.widthMm/2)/1000;
  for(let k=-1;k<=Math.ceil(height/pitch)+1;k++){const centre=(i%2)*pitch/2+k*pitch,start=centre-bridge/2,lo=Math.max(0,start),hi=Math.min(height,centre+bridge/2);if(hi-lo<.00035)continue;const a=(lo-start)/bridge,b=(hi-start)/bridge,key=`${a.toFixed(6)}:${b.toFixed(6)}`,profile=profiles.get(key)??{a,b,matrices:[]};pivot.position.set((leftEdge+rightEdge)/2,(lo+hi)/2,-thickness/2+bridgeHeight/2);pivot.scale.set(rightEdge-leftEdge+.00008,hi-lo,bridgeHeight);pivot.updateMatrix();profile.matrices.push(pivot.matrix.clone());profiles.set(key,profile);}
 });
 let index=0;for(const p of profiles.values()){const mesh=new T.InstancedMesh(tint(routedBridge(cad,8,p.a,p.b)),material,p.matrices.length);mesh.name=`LINAR_Desk_routed_bridges_${index++}`;p.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
 group.userData={width,height,thicknessMm:s.thicknessMm,incisionMm:s.incision,slats:specs.length,closedSolids:true,alphaPlanes:0};return group;
}
export class ReceptionDesk{
 readonly root=new T.Group();settings:LinarSettings={...deskDefaults};private bounds:T.Box3|undefined;readonly substrate=new T.MeshStandardMaterial({name:'WEB_Desk_Matte_Charcoal_Substrate',color:'#484b4a',roughness:.94,metalness:0});readonly surfaces:{mesh:string;triangles:number}[]=[];
 constructor(){this.root.name='WEB_Reception_Desk_LINAR';this.root.userData.application='desk';}
 attach(lobby:T.Group){lobby.updateWorldMatrix(true,true);const target=lobby.getObjectByName('AE35_010_reception_04');if(!target)throw new Error('Reception desk wood cladding was not found');this.bounds=new T.Box3().setFromObject(target);const b=this.bounds;
  target.traverse(o=>{if(!(o instanceof T.Mesh))return;const original=o.geometry,g=original.clone(),p=g.getAttribute('position'),idx=g.index,mats=Array.isArray(o.material)?o.material:[o.material],slot=mats.length,groups=original.groups.length?original.groups:[{start:0,count:idx?.count??p.count,materialIndex:0}];g.clearGroups();let start=0,last=-1,selectedCount=0;
   for(let i=0;i<(idx?.count??p.count);i+=3){const points=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(o.matrixWorld)),n=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize(),c=points[0].clone().add(points[1]).add(points[2]).multiplyScalar(1/3),outer=Math.abs(n.y)<.7&&((n.z>.7&&c.z>b.max.z-.012)||(n.x>.7&&c.x>b.max.x-.012)||(n.x<-.7&&c.x<b.min.x+.012)),materialIndex=outer?slot:(Array.isArray(o.material)?(groups.find((v:{start:number;count:number;materialIndex?:number})=>i>=v.start&&i<v.start+v.count)?.materialIndex??0):0);if(outer)selectedCount++;if(materialIndex!==last){if(last>=0)g.addGroup(start,i-start,last);start=i;last=materialIndex;}}
   if(last>=0)g.addGroup(start,(idx?.count??p.count)-start,last);if(selectedCount){o.geometry=g;o.material=[...mats,this.substrate];this.surfaces.push({mesh:o.name,triangles:selectedCount});}else g.dispose();
  });this.rebuild();
 }
 rebuild(){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();this.root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o instanceof T.InstancedMesh)o.dispose();}});this.root.clear();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.root.visible=this.settings.enabled;if(!this.bounds)return;this.settings.thicknessMm=T.MathUtils.clamp(this.settings.thicknessMm,4,15);this.settings.incision=T.MathUtils.clamp(this.settings.incision,40,400);
  const b=this.bounds,gap=.003,t=this.settings.thicknessMm/1000,inset=.001,height=b.max.y-b.min.y-2*inset,frontWidth=b.max.x-b.min.x+2*(gap+t),sideWidth=b.max.z-b.min.z+gap;
  const front=flatDeskPanel(frontWidth,height,this.settings);front.name='LINAR_Desk_Front';front.position.set((b.min.x+b.max.x)/2,b.min.y+inset,b.max.z+gap+t/2);this.root.add(front);
  for(const sign of [-1,1]){const side=flatDeskPanel(sideWidth,height,this.settings);side.name=sign<0?'LINAR_Desk_Left':'LINAR_Desk_Right';side.rotation.y=sign*Math.PI/2;side.position.set((sign<0?b.min.x:b.max.x)+sign*(gap+t/2),b.min.y+inset,(b.min.z+b.max.z+gap)/2);this.root.add(side);}this.root.updateWorldMatrix(true,true);
 }
 reset(){this.settings={...deskDefaults};this.rebuild();}
 inspect(){return{settings:{...this.settings},ready:!!this.bounds,visible:this.root.visible,substrate:{color:this.substrate.color.getHexString(),roughness:this.substrate.roughness,map:this.substrate.map?.name??null,airGapMetres:.003,scope:this.surfaces},surfaces:this.root.children.map(g=>({name:g.name,...g.userData})),sourceBounds:this.bounds?{min:this.bounds.min.toArray(),max:this.bounds.max.toArray()}:null};}
}
