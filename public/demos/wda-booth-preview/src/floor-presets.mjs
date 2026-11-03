// Derived from the user's existing D:/3dmodels-all/Materials library, local only.
// Source floor UVs span one repeat per 3.625146 m; geometry is not changed.
const sourceTileMeters = 3.6251461880746487;
function preset(id, label, tileMeters, normalStrength, surface = {}) {
 const base = `./assets/floors/${id}/`;
 return {id,label,tileMeters,repeat:[sourceTileMeters/tileMeters,sourceTileMeters/tileMeters],
  normalScale:[normalStrength,normalStrength],roughness:1,...surface,
  maps:{map:base+'color.webp',normalMap:base+'normal.webp',roughnessMap:base+'roughness.webp'}};
}
export const floorPresets=[
 preset('light-concrete','Light concrete slabs',3.2,.7),
 preset('grey-concrete','Dark concrete slabs',3.2,.7),
 preset('fine-concrete','Fine aggregate concrete',1,.24),
 preset('oak-regular-parquet','Oak regular parquet · 63_74',1.8,.35,{metalness:.2,roughness:.4}),
];
export const defaultFloor='oak-regular-parquet';
