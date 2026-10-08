import fs from 'node:fs';
import { createGltfIO } from './lib/gltf-io.mjs';
import { getBounds } from '@gltf-transform/functions';
const io = await createGltfIO();
const source = 'F:/iom_website/building-viewer/tmp/blender-surface-cleanup/icm-anim-repaired-v2.glb';
const doc = await io.read(source);
const rows = doc.getRoot().listNodes().filter(n => n.getMesh()).map(n => ({name:n.getName(), mesh:n.getMesh().getName(), world:n.getWorldMatrix(), bounds:getBounds(n), vertices:n.getMesh().listPrimitives().reduce((s,p)=>s+p.getAttribute('POSITION').getCount(),0), materials:n.getMesh().listPrimitives().map(p=>p.getMaterial()?.getName()), parents:n.listParents().map(p=>p.getName?.())}));
fs.writeFileSync('../../evidence/placement-v5/named-glb-objects-v5.json',JSON.stringify(rows));
console.log('GLB objects', rows.length);
