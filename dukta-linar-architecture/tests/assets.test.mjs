import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import sharp from 'sharp';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
for(const layer of ['building','lobby','street','context','vegetation','upper-interior'])test(`${layer}: self-contained decodable GLB with bounded payload and textures`,async()=>{
 const path=`public/models/${layer}.glb`,buffer=await readFile(path);
 assert.equal(buffer.toString('ascii',0,4),'glTF');assert.equal(buffer.readUInt32LE(4),2);assert.equal(buffer.readUInt32LE(8),buffer.length);assert.ok(buffer.length<(layer==='context'?20_000_000:8_000_000));
 const json=JSON.parse(buffer.toString('utf8',20,20+buffer.readUInt32LE(12)));assert.ok(json.buffers.every(b=>!b.uri));assert.ok(json.images.every(i=>i.bufferView!==undefined&&!i.uri));
 const doc=await io.read(path);assert.ok(doc.getRoot().listScenes().length===1);assert.ok(doc.getRoot().listNodes().length>(layer==='upper-interior'?5:20));
 for(const mesh of doc.getRoot().listMeshes())for(const prim of mesh.listPrimitives()){const pos=prim.getAttribute('POSITION');assert.ok(pos&&pos.getCount()>0);assert.ok(Array.from(pos.getArray()).every(Number.isFinite));assert.ok(prim.getMaterial());}
 for(const tex of doc.getRoot().listTextures()){const meta=await sharp(Buffer.from(tex.getImage())).metadata();assert.ok(meta.width<=1024&&meta.height<=1024,`${tex.getName()} oversized`);}
 assert.ok((await stat(`source-assets/${layer}.raw.glb`)).size>buffer.length*4);
});
test('all source shell objects remain, including a physically plausible opaque floor',async()=>{
 const doc=await io.read('public/models/building.glb'),names=doc.getRoot().listNodes().map(n=>n.getName()),source=JSON.parse(await readFile('evidence/source-shell-names.json','utf8'));
 assert.deepEqual(source.filter(n=>!names.includes(n)),[]);
 const floor=doc.getRoot().listMaterials().find(m=>/Building_A_carpets/.test(m.getName()));assert.ok(floor);assert.equal(floor.getAlphaMode(),'OPAQUE');assert.ok(floor.getRoughnessFactor()>=.15);assert.ok(Math.max(...floor.getExtension('KHR_materials_specular').getSpecularColorFactor())>.5);
});
