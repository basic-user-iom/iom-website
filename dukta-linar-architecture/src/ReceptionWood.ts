import * as T from 'three';

// The reference marks the horizontal desk top and rear cabinet's wood return.
// Other primitives of reception_04 are the desk shell / LINAR substrate.
export function isReceptionWood(layer:string,mesh:string,material:string){
 return layer==='lobby'&&(mesh==='AE35_010_reception_04_1'||mesh==='AE35_010_reception_07')&&material==='AE35_010_reception_05_AE35_010_reception_wood';
}

/** Grade the existing grain in linear light, retaining original texture bytes. */
export function lightReceptionWood(source:T.MeshStandardMaterial){
 const material=new T.MeshPhysicalMaterial();T.MeshStandardMaterial.prototype.copy.call(material,source);if(source instanceof T.MeshPhysicalMaterial)material.copy(source);
 material.name='WEB_Reception_Light_Oak';material.color.set('#ffffff');material.metalness=0;material.roughness=.64;material.clearcoat=0;
 material.roughnessMap=null;material.metalnessMap=null;material.normalMap=null;material.normalScale.set(0,0);material.displacementMap=null;
 // Very shallow grain relief, rather than the appearance of rough sawn boards.
 material.bumpMap=source.map;material.bumpScale=.000035;
 const tone=new T.Color('#c7b99f'),grainWeight=.22;
 material.onBeforeCompile=shader=>{
  shader.uniforms.receptionWoodTone={value:tone};shader.uniforms.receptionWoodGrain={value:grainWeight};
  shader.fragmentShader='uniform vec3 receptionWoodTone;\nuniform float receptionWoodGrain;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   diffuseColor.rgb=mix(receptionWoodTone,diffuseColor.rgb,receptionWoodGrain);`);
 };
 material.customProgramCacheKey=()=> 'reception-light-oak-grain-22-v1';
 material.userData={...source.userData,daylight:true,receptionWood:{scope:'desk worktop and rear cabinet wood return only',sourceMaterial:source.name,sourceTexture:source.map?.name,tone:'#c7b99f',grainWeight,roughness:.64,bumpMetres:.000035,sourceTextureUnchanged:true}};
 return material;
}
