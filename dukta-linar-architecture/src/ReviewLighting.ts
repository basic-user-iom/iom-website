import * as T from 'three';
import type {StreetLighting} from './StreetLighting';
import type {VisualEffects} from './VisualEffects';
/** Opt-in, local review controls. Every trial restores the loaded scene first. */
export function installLightingReview(scene:T.Scene,renderer:T.WebGLRenderer,lighting:StreetLighting,effects:VisualEffects,render:()=>void){
 const saved=new Map<T.MeshStandardMaterial,{map:T.Texture|null;normal:T.Texture|null;rough:T.Texture|null;env:number;metal:number;roughness:number}>();
 let lights:{light:T.Light;intensity:number}[]=[];
 let initial:{bias:number;normalBias:number;env:number;ao:boolean;fillPosition?:T.Vector3;fillHeight?:number}|undefined;
 Object.assign(window,{__reviewLighting:(options:Record<string,number|boolean>={})=>{
  const fill=scene.getObjectByName('REC_Reception_Fill') as T.RectAreaLight|undefined;
  initial??={bias:lighting.sun.shadow.bias,normalBias:lighting.sun.shadow.normalBias,env:scene.environmentIntensity,ao:effects.ao.enabled,fillPosition:fill?.position.clone(),fillHeight:fill?.height};
  if(!lights.length)scene.traverse(o=>{if(o instanceof T.Light)lights.push({light:o,intensity:o.intensity});});
  for(const {light,intensity} of lights)light.intensity=intensity;
  scene.traverse(o=>{if(!(o instanceof T.Mesh))return;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!(m instanceof T.MeshStandardMaterial)||!/wood|road_AE35|pavement_color/.test(m.name))continue;
   if(!saved.has(m))saved.set(m,{map:m.map,normal:m.normalMap,rough:m.roughnessMap,env:m.envMapIntensity,metal:m.metalness,roughness:m.roughness});
   const s=saved.get(m)!;m.map=options.maps===false?null:s.map;m.normalMap=options.normals===false?null:s.normal;m.roughnessMap=options.maps===false?null:s.rough;m.envMapIntensity=options.environment===false?0:s.env;m.metalness=s.metal;m.roughness=s.roughness;
   if(options.wallMatte&&/wood/i.test(m.name)){m.metalness=0;m.roughness=1;m.roughnessMap=null;}
   m.needsUpdate=true;
  }});
  scene.environmentIntensity=options.environment===false?0:initial.env;
  lighting.sun.shadow.intensity=options.shadows===false?0:1;
  lighting.sun.shadow.bias=typeof options.bias==='number'?options.bias:initial.bias;
  lighting.sun.shadow.normalBias=typeof options.normalBias==='number'?options.normalBias:initial.normalBias;
  if(options.sun===false)lighting.sun.intensity=0;
  if(options.lamps===false)for(const {light} of lights)if(light!==lighting.sun&&light!==lighting.ambient)light.intensity=0;
  if(fill){if(initial.fillPosition)fill.position.copy(initial.fillPosition);if(initial.fillHeight!==undefined)fill.height=initial.fillHeight;if(options.fill===false)fill.intensity=0;if(options.originalFill){fill.position.set(31,5.8,-38);fill.height=4;}if(options.moveFill){fill.position.set(31,6.1,-35.5);fill.height=1;}}
  effects.ao.enabled=options.ao===undefined?initial.ao:options.ao!==false;renderer.shadowMap.needsUpdate=true;render();
  return {options,lighting:lighting.inspect(),materials:[...saved].map(([m])=>({name:m.name,metalness:m.metalness,roughness:m.roughness,side:m.side}))};
 }});
}
