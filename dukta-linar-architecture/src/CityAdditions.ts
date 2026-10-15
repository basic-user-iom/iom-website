import * as T from 'three';
import bedMeasurements from './plantingBeds.json';

const materialList=(m:T.Mesh)=>Array.isArray(m.material)?m.material:[m.material];
const boundsOf=(mesh:T.Mesh,matrix:T.Matrix4)=>{mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox!.clone().applyMatrix4(matrix);};
const transforms=(mesh:T.Mesh)=>{if(!(mesh instanceof T.InstancedMesh))return [mesh.matrixWorld.clone()];return Array.from({length:mesh.count},(_,i)=>{const m=new T.Matrix4();mesh.getMatrixAt(i,m);return m.premultiply(mesh.matrixWorld);});};

/** Reuse the smallest existing street tree. Only instance transforms are new. */
export function addStreetTrees(vegetation:T.Group){
 vegetation.updateWorldMatrix(true,true);
 let template:T.Object3D|undefined;
 vegetation.traverse(o=>{if(o instanceof T.Mesh&&materialList(o).some(m=>/tree_A_leaf_diff/.test(m.name)))template=o.parent??o;});
 if(!template)throw new Error('Existing tree A template was not found.');
 const parts:T.Mesh[]=[];template.traverse(o=>{if(o instanceof T.Mesh)parts.push(o);});
 const candidates=transforms(parts[0]);let sourceIndex=0,distance=Infinity;
 candidates.forEach((m,i)=>{const c=boundsOf(parts[0],m).getCenter(new T.Vector3()),d=Math.abs(c.z+16.55);if(d<distance){distance=d;sourceIndex=i;}});
 const sourceParts=parts.map(p=>({mesh:p,matrix:transforms(p)[sourceIndex]}));
 // The trunk is split between bark and gradient primitives. Measure actual
 // transformed vertices across every part; a rotated AABB is not a trunk foot.
 const sourceBounds=new T.Box3(),foot=new T.Box3();
 for(const part of sourceParts){const a=part.mesh.geometry.getAttribute('position');for(let i=0;i<a.count;i++)sourceBounds.expandByPoint(new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(part.matrix));}
 for(const part of sourceParts){const a=part.mesh.geometry.getAttribute('position');for(let i=0;i<a.count;i++){const p=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(part.matrix);if(p.y<sourceBounds.min.y+.08)foot.expandByPoint(p);}}
 if(foot.isEmpty())throw new Error('Existing tree root could not be measured.');
 const sourceBase=foot.getCenter(new T.Vector3());sourceBase.y=sourceBounds.min.y;
 const root=new T.Group();root.name='WEB_Added_Street_Trees';
 // The original cutouts expose the HDR background, with no raycastable soil.
 // Add a thin soil surface strictly inside each existing opening at its lower curb edge.
 let soilMap:T.Texture|null=null;vegetation.traverse(o=>{if(o instanceof T.Mesh)for(const m of materialList(o))if(/flower_dirt/.test(m.name)&&m instanceof T.MeshStandardMaterial)soilMap=m.map;});
 const soilMaterial=new T.MeshStandardMaterial({name:'WEB_Existing_Bed_Soil',map:soilMap,color:soilMap?'#8d8071':'#51483b',roughness:1});
 const soils=new T.InstancedMesh(new T.BoxGeometry(1,1,1),soilMaterial,bedMeasurements.length);soils.name='WEB_Planting_Soil';soils.receiveShadow=true;
 const placements=bedMeasurements.map((b,i)=>{
  const scale=[.96,1.03,.92,1.06,1,.98][i%6],angle=(i*2.399963+0.3)%(Math.PI*2),base=new T.Vector3(b.center[0],.05,b.center[2]);
  const m=new T.Matrix4().compose(base,new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),angle),new T.Vector3(.92,scale,.92)).multiply(new T.Matrix4().makeTranslation(-sourceBase.x,-sourceBase.y,-sourceBase.z));
  soils.setMatrixAt(i,new T.Matrix4().compose(new T.Vector3(base.x,.035,base.z),new T.Quaternion(),new T.Vector3(b.max[0]-b.min[0]-.04,.03,b.max[1]-b.min[1]-.04)));
  return {id:b.id,base:base.toArray(),bounds:[b.min,b.max],scale,angle,matrix:m};
 });root.add(soils);
 for(const [i,p] of sourceParts.entries()){
  const batch=new T.InstancedMesh(p.mesh.geometry,p.mesh.material,placements.length);batch.name=`WEB_Tree_A_Part_${i}`;
  placements.forEach((v,j)=>batch.setMatrixAt(j,v.matrix.clone().multiply(p.matrix)));root.add(batch);
 }
 root.userData.report={count:placements.length,west:placements.filter(p=>p.id.startsWith('west')).length,eastFront:2,source:'AE35_010_tree_A_01',sourceBase:sourceBase.toArray(),sharedGeometry:true,sharedMaterials:true,treeBatches:sourceParts.length,soilBatches:1,placements:placements.map(({matrix,...p})=>({...p,trunkBase:sourceBase.clone().applyMatrix4(matrix).toArray(),crownBounds:[sourceBounds.clone().applyMatrix4(matrix).min.toArray(),sourceBounds.clone().applyMatrix4(matrix).max.toArray()]}))};
 vegetation.add(root);return root;
}

/** Existing C and B blocks, placed beyond the occupied street/sidewalk footprints. */
export function addCityBackground(context:T.Group){
 context.updateWorldMatrix(true,true);const root=new T.Group();root.name='WEB_City_Background';
 const plans=[
  {id:'west-continuation-C',sourceMin:[-40,-1,-78],sourceMax:[-21,23,-37],offset:[0,0,96],core:[-31,.3,-57,10,17,34]},
  {id:'west-continuation-B',sourceMin:[-46,-1,-137],sourceMax:[-21,24,-95],offset:[0,0,200],core:[-34,.3,-116,16,21.2,34]},
  {id:'rear-gap-B',sourceMin:[-46,-1,-137],sourceMax:[-21,24,-95],offset:[-24,0,84],core:[-34,.3,-116,16,21.2,34]},
 ];
 const records=plans.map(p=>({...p,bounds:new T.Box3(),parts:0}));
 const meshes:T.Mesh[]=[];context.traverse(o=>{if(!(o instanceof T.Mesh)||o.name.startsWith('WEB_'))return;const names=[o.name,o.parent?.name??'',...materialList(o).map(m=>m.name)].join(' ');if(/curtain|interior_|props_blind/i.test(names))return;meshes.push(o);});
 for(const mesh of meshes){const copies:T.Matrix4[]=[];
  for(const world of transforms(mesh)){
   const b=boundsOf(mesh,world);
   for(const p of records){const region=new T.Box3(new T.Vector3(...p.sourceMin),new T.Vector3(...p.sourceMax));if(!region.containsBox(b))continue;
    const matrix=new T.Matrix4().makeTranslation(...p.offset as [number,number,number]).multiply(world);copies.push(matrix);p.bounds.union(boundsOf(mesh,matrix));p.parts++;
   }
  }
  if(!copies.length)continue;
  const copy=new T.InstancedMesh(mesh.geometry,mesh.material,copies.length);copy.name=`WEB_Background_${mesh.name||root.children.length}`;copies.forEach((m,i)=>copy.setMatrixAt(i,m));root.add(copy);
 }
 const coreMaterial=new T.MeshStandardMaterial({name:'WEB_Background_Interior_Core',color:'#777168',roughness:1});
 const cores=new T.InstancedMesh(new T.BoxGeometry(1,1,1),coreMaterial,plans.length);cores.name='WEB_Background_Closed_Cores';
 plans.forEach((p,i)=>{const [x,y,z,w,h,d]=p.core;cores.setMatrixAt(i,new T.Matrix4().compose(new T.Vector3(x+p.offset[0],y+h/2,z+p.offset[2]),new T.Quaternion(),new T.Vector3(w,h,d)));});root.add(cores);
 root.userData.report={count:plans.length,sharedGeometry:true,sharedMaterials:true,newTextures:0,buildings:records.map(p=>({id:p.id,offset:p.offset,parts:p.parts,bounds:[p.bounds.min.toArray(),p.bounds.max.toArray()]})),batches:root.children.length};
 context.add(root);return root;
}

export function inspectCityAdditions(scene:T.Scene){return {trees:scene.getObjectByName('WEB_Added_Street_Trees')?.userData.report??null,background:scene.getObjectByName('WEB_City_Background')?.userData.report??null};}
