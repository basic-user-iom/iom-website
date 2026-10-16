/** Stable across rotation: a phone does not become a desktop in landscape. */
export const mobileProfile=matchMedia('(pointer: coarse)').matches&&Math.min(innerWidth,innerHeight)<=800;
export const assetDiagnostics={profile:mobileProfile?'mobile':'desktop',fallbacks:[] as string[]};
export async function loadAsset<T>(path:string,load:(url:string)=>Promise<T>):Promise<T>{
 const base=import.meta.env.BASE_URL;
 if(mobileProfile&&mobileAssets.has(path)){try{return await load(base+'mobile/'+path);}catch{assetDiagnostics.fallbacks.push(path);}}
 return load(base+path);
}
export function renderPixelRatio(interior:boolean,high:boolean,width:number,height:number,native=devicePixelRatio){
 if(!mobileProfile)return interior?2:Math.min(native,high?2:1);
 const cap=high?1.75:1.5,budget=high?1_300_000:900_000;
 return Math.min(native,cap,Math.sqrt(budget/Math.max(1,width*height)));
}

const mobileAssets=new Set(["models/building.glb","models/lobby.glb","materials/daylight/Asphalt009-Color.webp","materials/daylight/Asphalt009-NormalGL.webp","materials/daylight/Asphalt009-Roughness.webp","materials/daylight/Concrete034-Color.webp","materials/daylight/Concrete034-NormalGL.webp","materials/daylight/Concrete034-Roughness.webp","materials/daylight/Pavers-Color.webp","materials/daylight/Pavers-NormalGL.webp","materials/daylight/Pavers-Roughness.webp","materials/daylight/Plaster001-Color.webp","materials/daylight/Plaster001-NormalGL.webp","materials/daylight/Plaster001-Roughness.webp","materials/daylight/ScratchedMetal-AO.webp","materials/daylight/ScratchedMetal-Color.webp","materials/daylight/ScratchedMetal-Metalness.webp","materials/daylight/ScratchedMetal-NormalGL.webp","materials/daylight/ScratchedMetal-Roughness.webp","materials/foliage/TreeC-ColorAlpha.webp"]);
