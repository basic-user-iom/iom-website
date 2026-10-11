import * as THREE from 'three';

const repairs=new WeakMap();

// Complete the existing south opening with the north window's exact components.
// The aperture is measured from Building_B's wall vertices, not inferred from a
// screenshot. Borrowed buffers, textures, and materials remain owned by the GLB.
export function addMatchingGalleryWindow(galleryModel){
  if(repairs.has(galleryModel))return repairs.get(galleryModel);
  const glass=galleryModel.getObjectByName('ai66_Windows_B');
  const frame=galleryModel.getObjectByName('ai66_Windows_Frames_B');
  const buildingA=galleryModel.getObjectByName('ai66_Building_A');
  const buildingB=galleryModel.getObjectByName('ai66_Building_B');
  if(!glass||!frame||!buildingA||!buildingB)throw new Error('Matching gallery window components are unavailable.');
  galleryModel.updateMatrixWorld(true);
  const sourceBounds=new THREE.Box3().setFromObject(frame);
  const northBounds=new THREE.Box3().setFromObject(buildingA);
  const southBounds=new THREE.Box3().setFromObject(buildingB);
  const candidates=[],point=new THREE.Vector3();
  buildingB.traverse(object=>{
    if(!object.isMesh)return;
    const positions=object.geometry.getAttribute('position');
    for(let i=0;i<positions.count;i++){
      point.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);
      if(Math.abs(point.z-southBounds.max.z)<.002&&
        point.x>sourceBounds.min.x-.04&&point.x<sourceBounds.max.x+.04&&
        point.y>sourceBounds.min.y-.03&&point.y<sourceBounds.max.y+.03)candidates.push(point.clone());
    }
  });
  if(!candidates.length)throw new Error('The matching south wall aperture could not be measured.');
  const nearest=(axis,value)=>candidates.reduce((best,p)=>Math.abs(p[axis]-value)<Math.abs(best-value)?p[axis]:best,candidates[0][axis]);
  const aperture={left:nearest('x',sourceBounds.min.x),right:nearest('x',sourceBounds.max.x),bottom:nearest('y',sourceBounds.min.y),top:nearest('y',sourceBounds.max.y),outerZ:southBounds.max.z};
  const sourceSize=sourceBounds.getSize(new THREE.Vector3());
  if(Math.abs(aperture.right-aperture.left-sourceSize.x)>.003||Math.abs(aperture.top-aperture.bottom-sourceSize.y)>.003)throw new Error('The south opening no longer matches the existing window dimensions.');
  const sourceCenter=sourceBounds.getCenter(new THREE.Vector3());
  const targetCenter=new THREE.Vector3((aperture.left+aperture.right)/2,(aperture.bottom+aperture.top)/2,northBounds.min.z+southBounds.max.z-sourceCenter.z);
  // Rotating 180 degrees presents the same outside face at the opposite wall.
  // Align the aperture centers; preserve original dimensions and positive scales.
  const placement=new THREE.Matrix4().makeTranslation(sourceCenter.x+targetCenter.x,targetCenter.y-sourceCenter.y,northBounds.min.z+southBounds.max.z)
    .multiply(new THREE.Matrix4().makeRotationY(Math.PI));
  const root=new THREE.Group();root.name='runtime_matching_south_window';
  const parent=frame.parent;parent.add(root);root.updateWorldMatrix(true,false);
  const parentInverse=root.matrixWorld.clone().invert();
  let triangles=0,meshCount=0;
  for(const [source,label]of [[frame,'frame'],[glass,'glass']]){
    const clone=source.clone(true);clone.name='runtime_south_window_'+label;
    const matrix=parentInverse.clone().multiply(placement).multiply(source.matrixWorld);
    matrix.decompose(clone.position,clone.quaternion,clone.scale);
    clone.traverse(object=>{
      if(!object.isMesh)return;
      if(object!==clone)object.name='runtime_south_window_'+label+'_'+meshCount;
      const materials=Array.isArray(object.material)?object.material:[object.material];
      const opaque=materials.every(material=>material.visible!==false&&(material.opacity??1)>=.999&&(material.transmission??0)<=.001);
      // The source frame group includes a glass primitive as well as metal.
      object.castShadow=opaque;object.receiveShadow=true;
      object.userData={...object.userData,matchingWindowPart:opaque?'frame':'glass'};
      meshCount++;triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;
    });
    root.add(clone);
  }
  root.updateWorldMatrix(true,true);
  const bounds=new THREE.Box3().setFromObject(root);
  const state={ready:true,sourceFrame:frame.name,sourceGlass:glass.name,aperture,
    bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    size:bounds.getSize(new THREE.Vector3()).toArray(),triangles,meshCount,
    sharedGeometry:true,sharedMaterials:true,disposed:false};
  root.userData.matchingWindow=state;
  const result={root,state,dispose(){if(state.disposed)return;root.removeFromParent();state.disposed=true;state.ready=false;repairs.delete(galleryModel);}};
  repairs.set(galleryModel,result);return result;
}
