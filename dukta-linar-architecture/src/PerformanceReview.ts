import * as T from 'three';import type {VisualEffects} from './VisualEffects';
/** Local opt-in ablation controls. Values are restored before each trial. */
export function installPerformanceReview(scene:T.Scene,renderer:T.WebGLRenderer,effects:VisualEffects,render:()=>void){
 let initial:{lights:{l:T.Light;visible:boolean}[];glass:{m:T.MeshPhysicalMaterial;transmission:number}[];ao:boolean;ssr:boolean;dpr:number;transmissionScale:number}|undefined;
 const passes:{name:string;calls:number;triangles:number}[]=[];const original=renderer.render.bind(renderer);
 renderer.render=(s,c)=>{const before={...renderer.info.render};original(s,c);passes.push({name:s===scene?'scene':s.type,calls:renderer.info.render.calls-before.calls,triangles:renderer.info.render.triangles-before.triangles});if(passes.length>30)passes.splice(0,passes.length-30);};
 Object.assign(window,{__perfPasses:()=>passes,__perfControls:(o:Record<string,boolean|number>={})=>{
  if(!initial){const lights:{l:T.Light;visible:boolean}[]=[],glass:{m:T.MeshPhysicalMaterial;transmission:number}[]=[],seen=new Set<T.Material>();scene.traverse(x=>{if(x instanceof T.Light)lights.push({l:x,visible:x.visible});if(x instanceof T.Mesh)for(const m of Array.isArray(x.material)?x.material:[x.material])if(m instanceof T.MeshPhysicalMaterial&&m.transmission>0&&!seen.has(m)){seen.add(m);glass.push({m,transmission:m.transmission});}});initial={lights,glass,ao:effects.ao.enabled,ssr:effects.ssr.enabled,dpr:renderer.getPixelRatio(),transmissionScale:renderer.transmissionResolutionScale};}
  for(const {l,visible} of initial.lights)l.visible=o.localLights===false&&!(l instanceof T.DirectionalLight)&&!(l instanceof T.HemisphereLight)?false:visible;
  for(const {m,transmission} of initial.glass){m.transmission=o.transmission===false?0:transmission;m.needsUpdate=true;}
  effects.ao.enabled=o.ao===false?false:initial.ao;effects.ssr.enabled=o.ssr===false?false:effects.interiorActive;
  // Keep a beauty pass when the SSR renderer is disabled.
  effects.composer.passes[0].enabled=!effects.ssr.enabled;
  renderer.shadowMap.enabled=o.shadows!==false;renderer.shadowMap.needsUpdate=true;
  renderer.transmissionResolutionScale=typeof o.transmissionScale==='number'?o.transmissionScale:initial.transmissionScale;
  const size=renderer.getSize(new T.Vector2());renderer.setPixelRatio(typeof o.dpr==='number'?o.dpr:initial.dpr);renderer.setSize(size.x,size.y,false);effects.resize(size.x,size.y,false);passes.length=0;render();
  return{options:o,lights:initial.lights.map(({l})=>({name:l.name,type:l.type,intensity:l.intensity,visible:l.visible})),glassMaterials:initial.glass.length,passes};
 }});
}
