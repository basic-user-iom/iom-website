import * as THREE from 'three';

// SMK KAS11 is a museum plaster cast, digitized from the collection object.
// The separately loaded derivative has no textures and uses ordinary opaque PBR.
export async function createDoryphoros({loader,url='../assets/sculptures/doryphoros.glb'}){
  if(!loader?.loadAsync)throw new Error('A configured glTF/Draco loader is required for Doryphoros.');
  const started=performance.now(),gltf=await loader.loadAsync(url),asset=gltf.scene;
  const mesh=asset.getObjectByName('Doryphoros_sculpture');
  if(!mesh?.isMesh)throw new Error('The Doryphoros sculpture mesh is missing.');
  // The repaired ai66_Floor_B surface is at world Y=0 (verified by a floor ray).
  const root=new THREE.Group();root.name='runtime_Doryphoros';root.position.set(0,0,12.8);
  root.userData.sculptureId='Doryphoros';
  asset.updateMatrixWorld(true);
  const rawBounds=new THREE.Box3().setFromObject(asset),rawSize=rawBounds.getSize(new THREE.Vector3());
  if(!Number.isFinite(rawSize.y)||rawSize.y<=0)throw new Error('Doryphoros has invalid dimensions.');
  const height=2.13,plinthHeight=.10,scale=height/rawSize.y;
  asset.scale.multiplyScalar(scale);asset.rotation.y=Math.PI;
  asset.position.y=plinthHeight-rawBounds.min.y*scale;
  // Source front is +Z; rotate toward the connecting corridor at the north side.
  asset.position.x=(rawBounds.min.x+rawBounds.max.x)*scale/2;
  asset.position.z=(rawBounds.min.z+rawBounds.max.z)*scale/2;
  root.add(asset);
  const plinthGeometry=new THREE.CylinderGeometry(.57,.60,plinthHeight,48);
  const plinthMaterial=new THREE.MeshStandardMaterial({name:'doryphoros_plinth_mineral',color:'#bcb9af',metalness:0,roughness:.84});
  const plinth=new THREE.Mesh(plinthGeometry,plinthMaterial);plinth.name='Doryphoros_plinth';plinth.position.y=plinthHeight/2;root.add(plinth);
  let triangles=0,meshCount=0;root.traverse(object=>{if(!object.isMesh)return;object.castShadow=true;object.receiveShadow=true;object.userData.sculptureId='Doryphoros';meshCount++;triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;});
  root.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(root),bounds={min:box.min.toArray(),max:box.max.toArray()};
  const preset={id:'Doryphoros',name:'Doryphoros_sculpture',label:'Doryphoros · The Spear Bearer',
    position:[1.25,1.7,9.35],target:[0,1.1,12.8],fov:46,aspectChecked:1.25,
    portrait:{position:[1.15,1.7,9.35],target:[0,1.1,12.8],fov:49,aspectChecked:.8},bounds};
  const state={ready:true,id:'Doryphoros',title:preset.label,description:'A digitized plaster cast in the collection of SMK, National Gallery of Denmark.',
    source:'SMK KAS11',material:'Plaster cast',heightM:height,plinthHeightM:plinthHeight,position:root.position.toArray(),bounds,triangles,meshCount,
    loadMs:performance.now()-started,assetURL:url,disposed:false};
  return{root,preset,bounds,state,dispose(){
    if(state.disposed)return;state.disposed=true;state.ready=false;root.removeFromParent();
    const geometries=new Set(),materials=new Set();root.traverse(object=>{if(object.isMesh){geometries.add(object.geometry);for(const material of(Array.isArray(object.material)?object.material:[object.material]))materials.add(material);}});
    for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();
  }};
}
