import { Color, LinearSRGBColorSpace, MeshPhysicalMaterial } from 'three';

export const finishes = [
  { id: 'shell-white', label: '02. Shell White' },
  { id: 'burnt-orange', label: '07. Burnt Orange' },
  { id: 'midnight-green', label: '09. Midnight Green' },
  { id: 'reference-white', label: 'White · photo reference' },
  { id: 'reference-black', label: 'Black · photo reference' },
  { id: 'reference-olive', label: 'Olive · photo reference' },
  { id: 'reference-terracotta', label: 'Terracotta · photo reference' }
] as const;
export type FinishId = typeof finishes[number]['id'];
export type StudyState = { finish: FinishId; lit: boolean };
export interface ExportedFinish {
  id: FinishId; label: string; materialName: string;
  actualExportedMaterial: {
    name: string;
    pbrMetallicRoughness: { baseColorFactor: [number,number,number,number]; metallicFactor: number; roughnessFactor: number };
    normalTexture: { scale: number };
    extensions: { KHR_materials_clearcoat: { clearcoatFactor: number; clearcoatRoughnessFactor: number } };
  };
}
export function validateFinishes(value: unknown): ExportedFinish[] {
  const data = value as { appliesOnlyTo?:string; finishes?:ExportedFinish[] };
  if (data.appliesOnlyTo !== 'Ceramic_Exterior' || !Array.isArray(data.finishes) || data.finishes.length !== 3) throw new Error('Material data does not match the reviewed contract.');
  data.finishes.forEach((f,i) => {
    if (f.id !== finishes[i].id || f.label !== finishes[i].label || f.materialName !== 'Ceramic_Exterior') throw new Error('Unexpected finish.');
    const m = f.actualExportedMaterial;
    const p = m.pbrMetallicRoughness;
    const coat = m.extensions.KHR_materials_clearcoat;
    if (m.name !== 'Ceramic_Exterior' || p.baseColorFactor.length !== 4 || p.baseColorFactor[3] !== 1 || ![...p.baseColorFactor,p.metallicFactor,p.roughnessFactor,m.normalTexture.scale,coat.clearcoatFactor,coat.clearcoatRoughnessFactor].every(n => Number.isFinite(n) && n >= 0 && n <= 1)) throw new Error('Invalid material parameters.');
  });
  const references:[FinishId,string,number,number,number,number][]=[
    ['reference-white','#efeeeb',.39,.10,.30,.12],
    ['reference-black','#171819',.20,.32,.15,.34],
    ['reference-olive','#65704b',.22,.32,.16,.29],
    ['reference-terracotta','#b65330',.34,.15,.27,.18]
  ];
  return [...data.finishes,...references.map(([id,color,roughness,coat,coatRoughness,normal])=>{
    const c=new Color(color);return{id,label:finishes.find(f=>f.id===id)!.label,materialName:'Ceramic_Exterior',actualExportedMaterial:{name:'Ceramic_Exterior',pbrMetallicRoughness:{baseColorFactor:[c.r,c.g,c.b,1] as [number,number,number,number],metallicFactor:0,roughnessFactor:roughness},normalTexture:{scale:normal},extensions:{KHR_materials_clearcoat:{clearcoatFactor:coat,clearcoatRoughnessFactor:coatRoughness}}}};
  })];
}
export function applyFinish(material:MeshPhysicalMaterial, finish:ExportedFinish) {
  const source = finish.actualExportedMaterial;
  const pbr = source.pbrMetallicRoughness;
  material.color.setRGB(pbr.baseColorFactor[0], pbr.baseColorFactor[1], pbr.baseColorFactor[2], LinearSRGBColorSpace);
  material.metalness = pbr.metallicFactor;
  material.roughness = pbr.roughnessFactor;
  material.clearcoat = source.extensions.KHR_materials_clearcoat.clearcoatFactor;
  material.clearcoatRoughness = source.extensions.KHR_materials_clearcoat.clearcoatRoughnessFactor;
  // GLTFLoader preserves the embedded normal map and the glTF Y convention.
  material.normalScale.set(source.normalTexture.scale, -source.normalTexture.scale);
  material.opacity = 1; material.transparent = false; material.transmission = 0;
  material.emissive.setRGB(0,0,0); material.emissiveIntensity = 0;
}
