import fs from 'node:fs';function edit(f,fn){const s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');fs.writeFileSync(f,fn(s))}function replace(s,a,b){if(!s.includes(a))throw Error(a);return s.replace(a,b)}
edit('src/collision/icmMissingFloorSupports.ts',s=>{
s=replace(s,'export function buildIcmMissingFloorSupports(root: Object3D): CollisionChunkSource[] {',`export function buildIcmMissingFloorSupports(root: Object3D): CollisionChunkSource[] {
  return buildExactFloorSupports(root, false)
}
// The exterior paving audit found a 5 cm offset under cobbles and an omitted
// raised paving patch. Copy their authored top faces without shifting the model.
export function buildIcmExteriorPavingSupports(root: Object3D): CollisionChunkSource[] {
  return buildExactFloorSupports(root, true)
}
const PAVING_MATERIALS = new Set(['kopfstein_strasse', 'mnschner_001'])
function buildExactFloorSupports(root: Object3D, exterior: boolean): CollisionChunkSource[] {`);
s=replace(s,`    const owner = floorOwner(mesh, root)
    if (!owner) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]`,`    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const owner = exterior
      ? materials.some(m => PAVING_MATERIALS.has(m.name) && !m.transparent) ? mesh.name : null
      : floorOwner(mesh, root)
    if (!owner) return
    const eligible = (name: string) => exterior ? PAVING_MATERIALS.has(name) : eligibleMaterial(owner, name)`);
s=replace(s,"if (!eligibleMaterial(owner, materials[materialIndex]?.name ?? '')) continue", "if (!eligible(materials[materialIndex]?.name ?? '')) continue");
s=replace(s,'name: `exact-floor:${owner}:${mesh.name}:${level}`','name: `${exterior ? \'exact-paving\' : \'exact-floor\'}:${owner}:${mesh.name}:${level}`');return s});
edit('src/ViewerEngine.ts',s=>{s=replace(s,"import { buildIcmMissingFloorSupports }", "import { buildIcmMissingFloorSupports, buildIcmExteriorPavingSupports }");s=replace(s,'? buildIcmMissingFloorSupports(layer.root) : []',"? buildIcmMissingFloorSupports(layer.root)\n      : layer.id === 'icm-ext' ? buildIcmExteriorPavingSupports(layer.root) : []");return s});
// Keep the original paving audit as before evidence.
fs.copyFileSync('../../evidence/textures-v9/paving-grid.json','../../evidence/textures-v9/paving-grid-before.json');
console.log('Exact exterior paving supports added');
