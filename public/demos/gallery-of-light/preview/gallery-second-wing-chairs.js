import * as THREE from 'three';

const installations=new WeakMap();

/** Copy the existing cinema rows into the opposite wing with shared buffers. */
export function addSecondWingChairs(galleryModel){
  if(installations.has(galleryModel))return installations.get(galleryModel);
  const source=galleryModel.getObjectByName('gallery_chairs');
  if(!source)throw new Error('The original cinema chairs are unavailable.');
  galleryModel.updateMatrixWorld(true);
  const root=new THREE.Group();root.name='runtime_second_wing_chairs';
  (galleryModel.getObjectByName('gallery_root')??galleryModel).add(root);root.updateWorldMatrix(true,false);
  const turn=new THREE.Matrix4().makeRotationY(Math.PI);
  const placement=root.matrixWorld.clone().invert().multiply(turn),matrix=new THREE.Matrix4(),world=new THREE.Matrix4();
  const physical=new Map(),batches=[],copies=[];let triangles=0,instanceBytes=0;
  source.traverse(mesh=>{
    if(!mesh.isInstancedMesh)return;
    const local=new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position),indices=[];
    for(let i=0;i<mesh.count;i++){
      mesh.getMatrixAt(i,matrix);world.multiplyMatrices(mesh.matrixWorld,matrix);
      const box=local.clone().applyMatrix4(world),center=box.getCenter(new THREE.Vector3());
      // The two five-by-five cinema blocks, excluding the six foyer chairs.
      if(center.x>=-10||center.z>=-5.8)continue;
      indices.push(i);box.applyMatrix4(turn);
      if(physical.has(i))physical.get(i).union(box);else physical.set(i,box);
    }
    if(!indices.length)return;
    const copy=new THREE.InstancedMesh(mesh.geometry,mesh.material,indices.length);
    copy.name=`runtime_second_wing_chair_batch_${copies.length+1}`;
    copy.castShadow=true;copy.receiveShadow=true;copy.layers.mask=mesh.layers.mask;copy.renderOrder=mesh.renderOrder;
    for(let i=0;i<indices.length;i++){
      mesh.getMatrixAt(indices[i],matrix);world.multiplyMatrices(mesh.matrixWorld,matrix);
      copy.setMatrixAt(i,placement.clone().multiply(world));
      if(mesh.instanceColor){const color=new THREE.Color();mesh.getColorAt(indices[i],color);copy.setColorAt(i,color);}
    }
    copy.instanceMatrix.needsUpdate=true;copy.computeBoundingBox();copy.computeBoundingSphere();root.add(copy);copies.push(copy);
    const perChair=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;
    triangles+=perChair*indices.length;instanceBytes+=copy.instanceMatrix.array.byteLength+(copy.instanceColor?.array.byteLength??0);
    batches.push({source:mesh.name,name:copy.name,count:indices.length,sourceIndices:indices,trianglesPerChair:perChair});
  });
  if(!copies.length){root.removeFromParent();throw new Error('No original cinema chair rows were found.');}
  root.updateWorldMatrix(true,true);
  const state={ready:true,disposed:false,chairCount:physical.size,batches,triangles,instanceBytes,extraGeometryBytes:0,extraTextures:0,
    bounds:[...physical].map(([sourceIndex,box])=>({sourceIndex,min:box.min.toArray(),max:box.max.toArray()})),
    arrangement:'Two blocks of five rows, facing the second screen; the original central aisle is retained.',rotationY:Math.PI};
  const result={root,state,dispose(){if(state.disposed)return;root.removeFromParent();copies.forEach(copy=>copy.dispose());state.disposed=true;state.ready=false;installations.delete(galleryModel);}};
  installations.set(galleryModel,result);return result;
}
