import * as THREE from 'three';
import {CLASSICAL_ARTWORKS} from './classical-artworks.js';

export async function loadClassicalSculptures({loader}){
  const results=await Promise.allSettled(CLASSICAL_ARTWORKS.map(async entry=>{
    const started=performance.now(),url=`../assets/sculptures/${entry.file}`;let bytes=0;
    const gltf=await loader.loadAsync(url,event=>{bytes=Math.max(bytes,event.loaded??0,event.total??0);});
    const asset=gltf.scene;
    if(!asset.getObjectByName(entry.mesh)?.isMesh)throw new Error(`${entry.title} geometry is unavailable.`);
    const root=new THREE.Group();root.name=`runtime_${entry.id}`;root.position.fromArray(entry.position);
    root.userData.sculptureId=entry.id;root.userData.galleryExhibitRoot=true;
    const raw=new THREE.Box3().setFromObject(asset),rawSize=raw.getSize(new THREE.Vector3());
    if(!Number.isFinite(rawSize.y)||rawSize.y<=0)throw new Error(`${entry.title} has invalid dimensions.`);
    // Asset origin is normalized by the export, then recentered defensively.
    const pivot=new THREE.Group(),scale=entry.heightM/rawSize.y;
    asset.scale.multiplyScalar(scale);
    asset.position.set(-(raw.min.x+raw.max.x)*scale/2,-raw.min.y*scale,-(raw.min.z+raw.max.z)*scale/2);
    pivot.add(asset);pivot.rotation.y=entry.rotationY;pivot.position.y=.10;root.add(pivot);
    const radius=Math.max(.52,Math.hypot(rawSize.x*scale,rawSize.z*scale)/2+.06);
    const geometry=new THREE.CylinderGeometry(radius,radius+.025,.10,48);
    const material=new THREE.MeshStandardMaterial({name:`${entry.id}_mineral_plinth`,color:'#bcb9af',roughness:.84,metalness:0});
    const plinth=new THREE.Mesh(geometry,material);plinth.name=`${entry.id}_plinth`;plinth.position.y=.05;root.add(plinth);
    let triangles=0,meshCount=0;root.traverse(object=>{if(!object.isMesh)return;object.castShadow=true;object.receiveShadow=true;object.userData.sculptureId=entry.id;meshCount++;triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;});
    root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),bounds={min:box.min.toArray(),max:box.max.toArray()};
    const target=[entry.position[0],.10+entry.heightM*.5,entry.position[2]];
    const preset={id:entry.id,name:root.name,label:entry.title,position:[...entry.camera],target,fov:entry.fov??48,aspectChecked:1.2,
      portrait:{position:[...entry.camera],target:[...target],fov:(entry.fov??48)+4,aspectChecked:.8},bounds};
    const state={ready:true,id:entry.id,title:entry.title,assetURL:url,bytes,heightM:entry.heightM,plinthHeightM:.10,plinthRadiusM:radius,
      position:root.position.toArray(),rotationY:entry.rotationY,bounds,triangles,meshCount,loadMs:performance.now()-started,disposed:false};
    return{root,preset,state,dispose(){
      if(state.disposed)return;state.disposed=true;state.ready=false;root.removeFromParent();
      const geometries=new Set(),materials=new Set();root.traverse(object=>{if(object.isMesh){geometries.add(object.geometry);for(const m of(Array.isArray(object.material)?object.material:[object.material]))materials.add(m);}});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
    }};
  }));
  return{loaded:results.filter(r=>r.status==='fulfilled').map(r=>r.value),
    failed:results.flatMap((r,i)=>r.status==='rejected'?[{id:CLASSICAL_ARTWORKS[i].id,title:CLASSICAL_ARTWORKS[i].title,error:String(r.reason)}]:[])};
}
