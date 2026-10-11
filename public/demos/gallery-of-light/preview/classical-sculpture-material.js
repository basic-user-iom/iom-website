import * as THREE from 'three';

const DEFAULT_URL=new URL('../assets/textures/sculpture-plaster/plaster-packed.webp',import.meta.url).href;
const vertexPars=`
varying vec3 vCastPosition;
varying vec3 vCastObjectNormal;
`;
const fragmentPars=`
uniform sampler2D castPlasterMap;
uniform float castPlasterReady;
uniform float castPlasterScale;
uniform float castPlasterBump;
varying vec3 vCastPosition;
varying vec3 vCastObjectNormal;
vec3 castPlasterSurface() {
  vec3 weights=pow(abs(normalize(vCastObjectNormal)),vec3(4.0));
  weights/=max(dot(weights,vec3(1.0)),0.00001);
  vec3 p=vCastPosition*castPlasterScale;
  return texture2D(castPlasterMap,p.yz).rgb*weights.x
       + texture2D(castPlasterMap,p.zx).rgb*weights.y
       + texture2D(castPlasterMap,p.xy).rgb*weights.z;
}
vec3 castPlasterNormal(vec3 surfacePosition,vec3 surfaceNormal,float height,float faceDirection) {
  // Screen derivatives of object-anchored height keep the micro-relief attached
  // to the cast. The surface derivative carries world scale: bump is in metres.
  vec3 dx=dFdx(surfacePosition),dy=dFdy(surfacePosition);
  vec3 r1=cross(dy,surfaceNormal),r2=cross(surfaceNormal,dx);
  float determinant=dot(dx,r1)*faceDirection;
  vec3 gradient=sign(determinant)*(dFdx(height)*r1+dFdy(height)*r2);
  return normalize(max(abs(determinant),1e-10)*surfaceNormal-gradient);
}
`;

/** Shared fine plaster for explicitly selected cast meshes, without changing UVs. */
export function createClassicalSculptureMaterial({renderer,url=DEFAULT_URL,timeoutMs=15000}={}){
  const originals=new Map(),owned=new Set();let disposed=false,loadedTexture=null,resolveReady;
  const state={status:'loading',ready:false,textureReady:false,source:'ambientCG Plaster001',
    sourceURL:'https://ambientcg.com/view?id=Plaster001',license:'CC0 1.0',textureURL:url,
    resolution:[512,512],mapping:'Object-space triplanar',maps:['albedo variation','roughness','micro-height'],
    textureCount:1,samplesPerFragment:3,tileSizeM:.28,bumpDepthM:.00020,
    appliedMeshes:[],materialCount:0,error:null,disposed:false};
  const neutral=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1,THREE.RGBAFormat);
  neutral.colorSpace=THREE.NoColorSpace;neutral.needsUpdate=true;
  const uniforms={castPlasterMap:{value:neutral},castPlasterReady:{value:0},castPlasterScale:{value:1/state.tileSizeM},castPlasterBump:{value:state.bumpDepthM}};
  const ready=new Promise(resolve=>{resolveReady=resolve;});
  let settled=false;
  function settle(status,error=null){
    if(settled)return;settled=true;clearTimeout(timer);state.status=status;state.ready=true;state.error=error;resolveReady(state);
  }
  const timer=setTimeout(()=>settle('fallback','The plaster texture took too long to load. Plain plaster is retained.'),timeoutMs);
  new THREE.TextureLoader().load(url,texture=>{
    if(disposed||settled){texture.dispose();return;}
    texture.name='cast_plaster_shared_packed';texture.colorSpace=THREE.NoColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;
    texture.anisotropy=Math.min(4,renderer?.capabilities?.getMaxAnisotropy?.()??1);texture.needsUpdate=true;
    loadedTexture=texture;uniforms.castPlasterMap.value=texture;uniforms.castPlasterReady.value=1;state.textureReady=true;settle('ready');
  },undefined,()=>settle('fallback','The plaster texture is unavailable. Plain plaster is retained.'));

  function apply(mesh){
    if(disposed||!mesh?.isMesh||!mesh.geometry?.attributes.position||!mesh.geometry?.attributes.normal)return null;
    if(originals.has(mesh))return originals.get(mesh).material;
    const original=mesh.material,reference=Array.isArray(original)?original[0]:original;
    const material=new THREE.MeshStandardMaterial({name:`cast_plaster_${mesh.name}`,color:new THREE.Color(.70,.678,.635),roughness:.83,metalness:0,
      side:reference?.side??THREE.FrontSide,envMapIntensity:reference?.envMapIntensity??1});
    material.userData.castPlaster={source:state.source,mapping:state.mapping,textureURL:url,resolution:[512,512],tileSizeM:state.tileSizeM,bumpDepthM:state.bumpDepthM};
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+vertexPars)
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvCastPosition=position;\nvCastObjectNormal=normal;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+fragmentPars)
        .replace('#include <map_fragment>','#include <map_fragment>\nvec3 castSurface=castPlasterSurface();\ndiffuseColor.rgb*=mix(1.0,0.92+0.16*castSurface.r,castPlasterReady);')
        .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+castPlasterReady*(castSurface.g-0.5)*0.10,0.74,0.94);')
        .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=castPlasterNormal(-vViewPosition,normal,castSurface.b*castPlasterBump*castPlasterReady,faceDirection);');
    };
    material.customProgramCacheKey=()=> 'iom-cast-plaster-packed-v1';
    originals.set(mesh,{original,material});owned.add(material);mesh.material=material;
    state.appliedMeshes.push(mesh.name);state.materialCount=owned.size;return material;
  }
  function dispose(){
    if(disposed)return;disposed=true;state.disposed=true;clearTimeout(timer);
    for(const[mesh,entry]of originals)if(mesh.material===entry.material)mesh.material=entry.original;
    originals.clear();owned.forEach(material=>material.dispose());owned.clear();neutral.dispose();loadedTexture?.dispose();
    state.materialCount=0;state.textureReady=false;uniforms.castPlasterReady.value=0;
    if(!settled)settle('disposed');state.status='disposed';state.ready=false;
  }
  return{apply,ready,state,dispose};
}
