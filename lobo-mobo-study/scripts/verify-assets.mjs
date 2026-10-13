import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import sharp from 'sharp';

const source = 'F:/Projects/lobo-mobo-study/reviewfix-20261012-204039-15e58e/output';
const root = path.resolve(import.meta.dirname, '..');
const hash = b => createHash('sha256').update(b).digest('hex');
const json = async p => JSON.parse(await readFile(p, 'utf8'));
const manifestBytes = await readFile(path.join(source, 'asset-manifest.json'));
const integrity = await json(path.join(source, 'asset-manifest-integrity.json'));
assert.equal(hash(manifestBytes), integrity.sha256);
assert.equal(manifestBytes.length, integrity.bytes);
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.buildStatus, 'reviewed_private_concept');
assert.equal(manifest.nextStageAllowed, true);
const files = [];
for (const entry of manifest.files) {
  const bytes = await readFile(path.join(source, entry.path.replace(/^output\//, '')));
  assert.equal(bytes.length, entry.bytes, entry.path);
  assert.equal(hash(bytes), entry.sha256, entry.path);
  files.push({ ...entry, status: 'passed' });
}
const glb = await readFile(path.join(source, 'web/assets/mobo-study.glb'));
assert.equal(glb.readUInt32LE(0), 0x46546c67);
assert.equal(glb.readUInt32LE(4), 2);
assert.equal(glb.readUInt32LE(8), glb.length);
const model = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
assert.deepEqual(model.nodes.map(n => n.name).sort(), ['Light_Origin','MOBO_Bulb','MOBO_Ceramic','MOBO_Cord','MOBO_CordGrip']);
assert.equal(model.meshes.length, 4);
assert.deepEqual(model.materials.map(m => m.name).sort(), ['Bulb_Illustrative','Ceramic_Exterior','Ceramic_Interior','CordGrip_Metal','Cord_Textile']);
assert.deepEqual(model.nodes.find(n => n.name === 'Light_Origin').translation, [0,-0.44915664196014404,0]);
assert(!model.extensionsUsed?.includes('KHR_lights_punctual'));
const triangles = model.meshes.flatMap(m => m.primitives).reduce((n,p) => n + model.accessors[p.indices].count / 3, 0);
assert.equal(triangles, 30272);
for (const m of model.materials.filter(m => m.name.startsWith('Ceramic'))) {
  assert.equal(m.alphaMode ?? 'OPAQUE', 'OPAQUE');
  assert(!m.emissiveFactor?.some(Boolean));
  assert(!m.extensions?.KHR_materials_transmission);
}
const posters = [];
const tiles = [];
for (const [i, entry] of manifest.posters.entries()) {
  const file = path.join(source, entry.path.replace(/^output\//, ''));
  const meta = await sharp(file).metadata();
  const stats = await sharp(file).stats();
  assert.equal(meta.width, 1024); assert.equal(meta.height, 1200);
  assert(stats.channels.some(c => c.stdev > 10), 'Poster pixels must not be blank');
  posters.push({ path: entry.path, width: meta.width, height: meta.height, channels: stats.channels, status: 'passed' });
  tiles.push({ input: await sharp(file).resize(320,375).png().toBuffer(), left: Math.floor(i/2)*320, top: (i%2)*375 });
}
await mkdir(path.join(root, 'qa'), { recursive:true });
await sharp({ create:{ width:960,height:750,channels:3,background:'#eee9e2' } }).composite(tiles).png().toFile(path.join(root,'qa/poster-contact-sheet.png'));
await writeFile(path.join(root,'qa/input-verification.json'), JSON.stringify({ status:'passed', source, manifestSHA256:hash(manifestBytes), files, triangles, nodes:model.nodes, materials:model.materials, images:model.images, posters },null,2));
console.log(JSON.stringify({status:'passed',manifestSHA256:hash(manifestBytes),files:files.length,triangles,images:model.images}));
