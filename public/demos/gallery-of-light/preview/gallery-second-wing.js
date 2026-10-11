import * as THREE from 'three';

const installations=new WeakMap();

/** Reuse original furniture in the opposite wing, without touching the GLB. */
export function addSecondWingFixtures(galleryModel){
  if(installations.has(galleryModel))return installations.get(galleryModel);
  const sourceBenches=galleryModel.getObjectByName('gallery_benches');
  const sourceScreen=galleryModel.getObjectByName('ai66_Ceiling_Screen');
  if(!sourceBenches||!sourceScreen)throw new Error('Original gallery benches or screen are unavailable.');
  galleryModel.updateMatrixWorld(true);
  const root=new THREE.Group();root.name='runtime_second_wing_fixtures';
  (galleryModel.getObjectByName('gallery_root')??galleryModel).add(root);root.updateWorldMatrix(true,false);
  const inverse=root.matrixWorld.clone().invert(),turn=new THREE.Matrix4().makeRotationY(Math.PI);
  const placement=inverse.clone().multiply(turn),matrix=new THREE.Matrix4(),world=new THREE.Matrix4();
  const benches=new THREE.Group();benches.name='runtime_second_wing_benches';root.add(benches);
  const physicalBounds=new Map(),batches=[],newInstances=[];
  let triangles=0,instanceBytes=0;
  sourceBenches.traverse(source=>{
    if(!source.isInstancedMesh)return;
    const localBounds=new THREE.Box3().setFromBufferAttribute(source.geometry.attributes.position),indices=[];
    for(let i=0;i<source.count;i++){
      source.getMatrixAt(i,matrix);world.multiplyMatrices(source.matrixWorld,matrix);
      const box=localBounds.clone().applyMatrix4(world);
      // Only copy source-wing instances. Future objects already in the second
      // wing must not be reflected back into the original exhibition.
      if(box.getCenter(new THREE.Vector3()).z>=0)continue;
      indices.push(i);const mirrored=box.clone().applyMatrix4(turn);
      if(!physicalBounds.has(i))physicalBounds.set(i,mirrored);else physicalBounds.get(i).union(mirrored);
    }
    if(!indices.length)return;
    const copy=new THREE.InstancedMesh(source.geometry,source.material,indices.length);
    copy.name=`runtime_second_wing_bench_batch_${batches.length+1}`;
    copy.castShadow=true;copy.receiveShadow=true;copy.renderOrder=source.renderOrder;copy.layers.mask=source.layers.mask;
    for(let i=0;i<indices.length;i++){
      source.getMatrixAt(indices[i],matrix);world.multiplyMatrices(source.matrixWorld,matrix);
      copy.setMatrixAt(i,placement.clone().multiply(world));
      if(source.instanceColor){const color=new THREE.Color();source.getColorAt(indices[i],color);copy.setColorAt(i,color);}
    }
    copy.instanceMatrix.needsUpdate=true;copy.computeBoundingBox();copy.computeBoundingSphere();
    benches.add(copy);newInstances.push(copy);instanceBytes+=copy.instanceMatrix.array.byteLength+(copy.instanceColor?.array.byteLength??0);
    const count=(source.geometry.index?.count??source.geometry.attributes.position.count)/3;
    triangles+=count*indices.length;
    batches.push({source:source.name,name:copy.name,instances:indices.length,sourceIndices:indices,trianglesPerBench:count});
  });
  if(!batches.length){root.removeFromParent();throw new Error('No source-wing bench instances were found.');}
  const screen=sourceScreen.clone(true);screen.name='runtime_second_wing_screen';
  placement.clone().multiply(sourceScreen.matrixWorld).decompose(screen.position,screen.quaternion,screen.scale);
  let screenMeshes=0;
  screen.traverse(object=>{
    if(!object.isMesh)return;
    object.name=`runtime_second_wing_screen_part_${++screenMeshes}`;
    object.castShadow=true;object.receiveShadow=true;
    triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;
  });
  root.add(screen);root.updateWorldMatrix(true,true);
  const box=new THREE.Box3().setFromObject(screen);
  const state={ready:true,disposed:false,benchCount:physicalBounds.size,benchBatches:batches,
    benchBounds:[...physicalBounds].map(([sourceIndex,bounds])=>({sourceIndex,min:bounds.min.toArray(),max:bounds.max.toArray(),center:bounds.getCenter(new THREE.Vector3()).toArray()})),
    screen:{name:screen.name,bounds:{min:box.min.toArray(),max:box.max.toArray()},size:box.getSize(new THREE.Vector3()).toArray(),frontNormal:[-1,0,0],meshes:screenMeshes},
    triangles,extraInstanceBytes:instanceBytes,extraGeometryBytes:0,extraTextures:0,sharedGeometry:true,sharedMaterials:true,
    rotation:'180 degrees around world Y; positive scale; no reflection',chairsAdded:0};
  root.userData.secondWingFixtures=state;
  const result={root,screen,benches,state,dispose(){if(state.disposed)return;root.removeFromParent();newInstances.forEach(mesh=>mesh.dispose());state.ready=false;state.disposed=true;installations.delete(galleryModel);}};
  installations.set(galleryModel,result);return result;
}
