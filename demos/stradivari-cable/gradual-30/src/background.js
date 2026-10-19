import * as THREE from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
// Render an HDR backdrop separately so orthographic inspection and SSR see it too.
// The cable scene.environment, lights, materials and camera are never changed.
export function createBackdrop(scene,renderer,requestRender){
 let active='studio',promise,target,builds=0,rotation=90,intensity=.4,generation=0;
 const sky=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,.1,10);
 const frame=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
 frame.texture.name='Metro background only';
 async function use(name){const id=++generation;if(name==='metro'){
  promise??=new HDRLoader().loadAsync('./assets/metro-vijzelgracht.hdr').then(hdr=>{const pmrem=new THREE.PMREMGenerator(renderer);target=pmrem.fromEquirectangular(hdr);hdr.dispose();pmrem.dispose();builds++;return target.texture});
  const texture=await promise;if(id!==generation)return;sky.background=texture;sky.backgroundRotation.set(0,THREE.MathUtils.degToRad(rotation),0);sky.backgroundIntensity=intensity;sky.backgroundBlurriness=.025;scene.background=frame.texture;
 }else scene.background=null;
 active=name;for(const b of document.querySelectorAll('[data-background]'))b.setAttribute('aria-pressed',String(b.dataset.background===active));requestRender();}
 function adjust(degrees,brightness){rotation=degrees;intensity=brightness;sky.backgroundRotation.y=THREE.MathUtils.degToRad(rotation);sky.backgroundIntensity=intensity;requestRender()}
 function prepare(modelCamera){if(active!=='metro')return;const {width,height}=renderer.domElement;if(frame.width!==width||frame.height!==height){frame.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix()}
  camera.quaternion.copy(modelCamera.quaternion);camera.rotateX(THREE.MathUtils.degToRad(30));camera.updateMatrixWorld();const previous=renderer.getRenderTarget();renderer.setRenderTarget(frame);renderer.render(sky,camera);renderer.setRenderTarget(previous);
 }
 return{use,adjust,prepare,snapshot:()=>({active,rotationDegrees:rotation,intensity,blur:sky.backgroundBlurriness,pmremBuilds:builds,sourceResolution:'2048 x 1024',backgroundOnly:true,loaded:!!target,backgroundFov:60,pitchOffsetDegrees:30}),dispose:()=>{target?.dispose();frame.dispose()}};
}
