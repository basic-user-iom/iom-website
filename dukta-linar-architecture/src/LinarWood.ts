import * as T from 'three';
/** Shared restrained, metre-scaled birch grain for routed panels and lettering. */
export function linarWood(material:T.MeshStandardMaterial){
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vLinarWood;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vLinarWood=position;
   #ifdef USE_INSTANCING
    vLinarWood=(instanceMatrix*vec4(position,1.0)).xyz;
   #endif`);
  shader.fragmentShader='varying vec3 vLinarWood;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float grainPhase=vLinarWood.x*1900.0+sin(vLinarWood.y*8.0+vLinarWood.x*31.0)*2.0;
   float grainAA=1.0-smoothstep(0.6,2.8,fwidth(grainPhase));
   float grain=sin(grainPhase)*0.045*grainAA+sin(vLinarWood.x*173.0+sin(vLinarWood.y*3.0))*0.025;
   diffuseColor.rgb*=1.0+grain;`);
 };
 material.customProgramCacheKey=()=> 'linar-metric-birch-grain';return material;
}
