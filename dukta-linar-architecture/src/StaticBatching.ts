import * as T from 'three';
/** Consolidate repeated static meshes and pre-existing batches sharing geometry
 * and materials. Moving cars, selected floors and named diagnostic meshes stay intact. */
export function batchStatic(root:T.Group){
 root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),groups=new Map<string,T.Mesh[]>();
 root.traverse(o=>{if(!(o instanceof T.Mesh)||o instanceof T.SkinnedMesh||!o.visible||o.userData.tourDynamic||o.morphTargetInfluences||/carpets|reception_chair1|reception_06/.test(o.name))return;
  if(o.matrixWorld.determinant()<0)return;
  const mats=Array.isArray(o.material)?o.material:[o.material],key=[o.geometry.uuid,...mats.map(m=>m.uuid),o.castShadow,o.receiveShadow,o.renderOrder,o.layers.mask].join('|');
  const list=groups.get(key)??[];list.push(o);groups.set(key,list);
 });
 let meshesBefore=0,meshesAfter=0,instances=0;const changes=[];
 for(const list of groups.values()){
  meshesBefore+=list.length;if(list.length<2){meshesAfter+=list.length;continue;}
  const matrices:T.Matrix4[]=[];
  for(const mesh of list)if(mesh instanceof T.InstancedMesh){for(let i=0;i<mesh.count;i++){const m=new T.Matrix4();mesh.getMatrixAt(i,m);matrices.push(m.premultiply(mesh.matrixWorld).premultiply(inverse));}}else matrices.push(mesh.matrixWorld.clone().premultiply(inverse));
  if(matrices.some(m=>m.determinant()<0)){meshesAfter+=list.length;continue;}
  const first=list[0],batch=new T.InstancedMesh(first.geometry,first.material,matrices.length);batch.name=`WEB_StaticBatch_${changes.length}`;batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;batch.renderOrder=first.renderOrder;batch.layers.mask=first.layers.mask;
  matrices.forEach((m,i)=>batch.setMatrixAt(i,m));batch.computeBoundingBox();batch.computeBoundingSphere();
  for(const mesh of list){const marker=new T.Group();marker.name=mesh.name;marker.position.copy(mesh.position);marker.quaternion.copy(mesh.quaternion);marker.scale.copy(mesh.scale);marker.userData={...mesh.userData,batched:true};for(const child of [...mesh.children])marker.add(child);mesh.parent?.add(marker);mesh.removeFromParent();}
  root.add(batch);meshesAfter++;instances+=matrices.length;changes.push({sourceMeshes:list.length,instances:matrices.length,geometry:first.geometry.uuid,material:(Array.isArray(first.material)?first.material[0]:first.material).name});
 }
 return{meshesBefore,meshesAfter,drawBatchesSaved:meshesBefore-meshesAfter,instances,changes};
}
