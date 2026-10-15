import * as T from 'three';

/** Three coherent samples break the visible grid without new texture memory.
 * Colour and roughness use the same hash, rotation, weights and UV domain. */
export function nonRepeatingRoofMaterial(source:T.MeshStandardMaterial){
 const material=source.clone();material.name='WEB_Roof_NonRepeating';
 material.onBeforeCompile=shader=>{
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
vec3 roofHash(vec2 p) {
 return fract(sin(vec3(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)),dot(p,vec2(419.2,371.9))))*43758.5453);
}
vec2 roofRotate(vec2 p, float r) {
 if(r<1.0)return p;
 if(r<2.0)return vec2(-p.y,p.x);
 if(r<3.0)return -p;
 return vec2(p.y,-p.x);
}
vec4 roofTap(sampler2D tex,vec2 uv,vec2 dx,vec2 dy,vec2 id) {
 vec3 h=roofHash(id);float r=floor(h.z*4.0);
 return textureGrad(tex,roofRotate(uv,r)+h.xy*19.0,roofRotate(dx,r),roofRotate(dy,r));
}
vec4 roofSample(sampler2D tex,vec2 uv) {
 vec2 grid=vec2(uv.x-uv.y*0.577350269,uv.y*1.154700538),cell=floor(grid),f=fract(grid);
 vec2 a,b,c;vec3 w;
 if(f.x+f.y<1.0){a=cell;b=cell+vec2(1,0);c=cell+vec2(0,1);w=vec3(1.0-f.x-f.y,f.x,f.y);}
 else {a=cell+vec2(1,1);b=cell+vec2(0,1);c=cell+vec2(1,0);w=vec3(f.x+f.y-1.0,1.0-f.x,1.0-f.y);}
 w*=w;w*=w;w/=w.x+w.y+w.z;
 vec2 dx=dFdx(uv),dy=dFdy(uv);
 return roofTap(tex,uv,dx,dy,a)*w.x+roofTap(tex,uv,dx,dy,b)*w.y+roofTap(tex,uv,dx,dy,c)*w.z;
}`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
 diffuseColor *= roofSample(map,vMapUv);
 #endif`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`float roughnessFactor=roughness;
 #ifdef USE_ROUGHNESSMAP
 roughnessFactor *= roofSample(roughnessMap,vMapUv).g;
 #endif
 roughnessFactor=max(roughnessFactor,0.38);`);
 };
 material.customProgramCacheKey=()=> 'roof-coherent-stochastic-v1';material.userData.roofSampling={samplesPerMap:3,newTextures:0,rotation:'quarter turns',sharedColourRoughnessTransform:true};return material;
}
