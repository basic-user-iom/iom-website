import * as THREE from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
const originalLights=[
 {intensity:4,width:180,height:55,position:[0,110,85],target:[0,0,0],color:0xfffaf3},
 {intensity:.65,width:100,height:100,position:[150,35,65],target:[45,0,0],color:0xffffff},
 {intensity:1.3,width:150,height:90,position:[-35,50,-100],target:[-10,0,0],color:0xe9efff}
];
export const profiles={
 Metro:{label:'Metro HDR reflections',hdr:'./assets/metro-vijzelgracht.hdr',rotation:90,intensity:.5,exposure:1.10,hemisphere:.14,lights:originalLights},

};
export const selectedProfile='Metro';
export function createLighting(scene,renderer){
 RectAreaLightUniformsLib.init();
 const group=new THREE.Group();scene.add(group);
 const hemi=new THREE.HemisphereLight(0xffffff,0x253044,0);group.add(hemi);
 const areas=Array.from({length:3},()=>{const l=new THREE.RectAreaLight();group.add(l);return l});
 const cache=new Map(),builds={};let active=null;
 async function use(name){
  const p=profiles[name];if(!p)throw new Error('Unknown lighting profile');
  if(!cache.has(p.hdr)){
   const hdr=await new HDRLoader().loadAsync(p.hdr),pmrem=new THREE.PMREMGenerator(renderer);
   const target=pmrem.fromEquirectangular(hdr);cache.set(p.hdr,target);builds[p.hdr]=(builds[p.hdr]||0)+1;hdr.dispose();pmrem.dispose();
  }
  scene.environment=cache.get(p.hdr).texture;scene.environmentRotation.y=THREE.MathUtils.degToRad(p.rotation);scene.environmentIntensity=p.intensity;renderer.toneMappingExposure=p.exposure;hemi.intensity=p.hemisphere;
  areas.forEach((l,i)=>{const a=p.lights[i];l.visible=!!a;if(!a)return;l.color.setHex(a.color);l.intensity=a.intensity;l.width=a.width;l.height=a.height;l.position.set(...a.position);l.lookAt(...a.target)});
  active=name;
 }
 return {use,snapshot:()=>({profile:active,pmremBuilds:{...builds},environmentCacheSize:cache.size,areaLights:areas.filter(l=>l.visible).length,shadowMapEnabled:renderer.shadowMap.enabled,exposure:renderer.toneMappingExposure,environmentIntensity:scene.environmentIntensity,rotationDegrees:THREE.MathUtils.radToDeg(scene.environmentRotation.y)}),dispose:()=>{for(const target of cache.values())target.dispose();cache.clear()}};
}
