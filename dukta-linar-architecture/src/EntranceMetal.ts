import * as T from 'three';

/** Restrict the override to reception entry frames, including adjacent mullions. */
export function isEntranceFrame(layer:string,mesh:string,material:string){
 return layer==='building'&&/^AE35_010_window_(?:E_01$|F_02|CF_|C_corner)/.test(mesh)&&/^AE35_010_window_[CEF]_frame_/.test(material);
}

/** A satin microfacet finish; never mutate the shared source material or maps. */
export function entranceFinish(source:T.MeshStandardMaterial){
 const material=new T.MeshPhysicalMaterial();
 T.MeshStandardMaterial.prototype.copy.call(material,source);
 if(source instanceof T.MeshPhysicalMaterial)material.copy(source);
 material.name=`WEB_Entrance_Dark_Bronze__${source.name}`;
 for(const key of ['map','normalMap','bumpMap','roughnessMap','metalnessMap','aoMap','displacementMap','alphaMap','clearcoatMap','clearcoatNormalMap','clearcoatRoughnessMap'] as const)material[key]=null;
 material.color.set('#51483d');material.metalness=1;material.roughness=.24;material.clearcoat=0;material.envMapIntensity=.55;
 material.normalScale.set(0,0);material.bumpScale=0;material.displacementScale=0;
 material.vertexColors=false;material.transparent=false;material.opacity=1;material.alphaTest=0;material.transmission=0;
 material.userData={...source.userData,daylight:true,entranceFinish:{type:'dark bronze satin anodized aluminum',sourceMaterial:source.name,coarseMapsRemoved:true,environmentIntensity:.55,finish:'uniform microfacet roughness',colourIsIllustrative:true}};
 return material;
}
