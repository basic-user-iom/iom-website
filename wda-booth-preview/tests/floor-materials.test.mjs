import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const threeURL = pathToFileURL(path.join(root, 'public/vendor/three/build/three.module.js')).href;
const THREE = await import(threeURL);
const code = (await fs.readFile(path.join(root, 'src/floor-materials.mjs'), 'utf8')).replace("from 'three'", `from '${threeURL}'`);
const { createFloorMaterials } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const variants = ['a', 'b'].map(id => ({ id, label: `Floor ${id}`, maps: {
  map: `${id}-color.webp`, normalMap: `${id}-normal.webp`, roughnessMap: `${id}-roughness.webp`,
}, repeat: [1.5, 1.5], normalScale: [0.22, 0.22], roughness: 1 }));
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(options = {}) {
  const material = new THREE.MeshPhysicalMaterial({ color: '#928d80', roughness: 0.65, metalness: 0.08 });
  material.normalScale.set(0.7, -0.8); material.envMapIntensity = 0.55;
  const sourceTextures = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'specularIntensityMap', 'aoMap'].map(field => {
    const texture = new THREE.Texture(); texture.name = `source-${field}`; texture.repeat.set(2, 3);
    material[field] = texture; return texture;
  });
  const originalFields = Object.fromEntries(['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'specularIntensityMap', 'aoMap'].map(field => [field, material[field]]));
  const originalColor = material.color.clone(), originalNormalScale = material.normalScale.clone();
  const hook = () => {}, key = () => 'contact-sentinel'; material.onBeforeCompile = hook; material.customProgramCacheKey = key;
  const jobs = new Map(), delivered = [], disposed = [], statuses = [], changes = [];
  const loader = url => new Promise((resolve, reject) => jobs.set(url, { resolve, reject }));
  const effect = createFloorMaterials({ materials: [material], variants, anisotropy: 4, loader,
    onStatus: value => statuses.push(value), onChange: value => { changes.push(value); options.onChange?.(value); }, ...options });
  function resolve(url, texture = new THREE.Texture()) {
    texture.addEventListener('dispose', () => disposed.push(texture)); delivered.push(texture);
    jobs.get(url).resolve(texture); return texture;
  }
  function complete(id) { for (const url of Object.values(variants.find(v => v.id === id).maps)) resolve(url); }
  return { material, sourceTextures, originalFields, originalColor, originalNormalScale, hook, key,
    effect, jobs, delivered, disposed, statuses, changes, resolve, complete };
}

test('original is zero-network and initial source maps and callbacks remain untouched', async () => {
  const f = fixture(); assert.equal(await f.effect.select('original'), true);
  assert.equal(f.jobs.size, 0); assert.equal(f.effect.state.active, 'original'); assert.equal(f.effect.state.requests, 0);
  assert.equal(f.changes.length, 0); assert.equal(f.material.onBeforeCompile, f.hook);
  assert.equal(f.material.customProgramCacheKey, f.key); assert.equal(f.effect.state.activeTextureCount, 0);
  f.effect.dispose(); assert.deepEqual(f.disposed, []);
});

test('PBR selection commits all maps atomically with correct color/data handling and UV scale', async () => {
  const f = fixture(), pending = f.effect.select('a'); await tick();
  assert.equal(f.effect.state.loading, true); assert.equal(f.effect.state.active, 'original');
  f.resolve('a-color.webp'); await tick(); assert.equal(f.material.map, f.originalFields.map);
  f.resolve('a-normal.webp'); f.resolve('a-roughness.webp'); assert.equal(await pending, true);
  assert.equal(f.effect.state.active, 'a'); assert.equal(f.effect.state.loading, false);
  assert.equal(f.material.map.colorSpace, THREE.SRGBColorSpace);
  for (const field of ['normalMap', 'roughnessMap']) assert.equal(f.material[field].colorSpace, THREE.NoColorSpace);
  for (const texture of f.delivered) {
    assert.equal(texture.flipY, false); assert.equal(texture.wrapS, THREE.RepeatWrapping);
    assert.equal(texture.wrapT, THREE.RepeatWrapping); assert.equal(texture.anisotropy, 4);
    assert.equal(texture.channel, 0); assert.deepEqual(texture.repeat.toArray(), [1.5, 1.5]);
  }
  assert.equal(f.material.metalnessMap, null); assert.equal(f.material.specularIntensityMap, null);
  assert.equal(f.material.aoMap, null); assert.equal(f.material.roughness, 1); assert.equal(f.material.metalness, 0);
  assert.equal(f.material.color.getHex(), 0xffffff); assert.deepEqual(f.material.normalScale.toArray(), [0.22, 0.22]);
  assert.equal(f.material.envMapIntensity, 0.55); assert.equal(f.material.onBeforeCompile, f.hook);
  assert.equal(f.material.customProgramCacheKey, f.key); assert.equal(f.effect.state.activeTextureCount, 3);
  assert.equal(await f.effect.select('a'), true); assert.equal(f.effect.state.requests, 1);
  f.effect.dispose();
});

test('Original restores exact texture references/scalars before replacement texture disposal', async () => {
  const f = fixture(); const pending = f.effect.select('a'); await tick(); f.complete('a'); await pending;
  let oldMapsStillAlive = false;
  const oldMaps = [...f.delivered];
  for (const texture of oldMaps) texture.addEventListener('dispose', () => {
    assert.equal(f.material.map, f.originalFields.map);
    oldMapsStillAlive = f.changes.at(-1).active === 'original';
  });
  assert.equal(await f.effect.select('original'), true); assert.equal(oldMapsStillAlive, true);
  for (const [field, value] of Object.entries(f.originalFields)) assert.equal(f.material[field], value);
  assert.ok(f.material.color.equals(f.originalColor)); assert.ok(f.material.normalScale.equals(f.originalNormalScale));
  assert.equal(f.material.roughness, 0.65); assert.equal(f.material.metalness, 0.08);
  assert.equal(f.effect.state.activeTextureCount, 0); assert.equal(f.disposed.length, 3);
  assert.equal(f.effect.state.texturesDisposed, 3); assert.equal(f.effect.state.requests, 1);
  for (const texture of f.sourceTextures) assert.deepEqual(texture.repeat.toArray(), [2, 3]);
  f.effect.dispose(); assert.equal(f.disposed.length, 3);
});

test('latest requested variant wins and stale successful maps are released', async () => {
  const f = fixture(); const a = f.effect.select('a'); await tick(); const b = f.effect.select('b'); await tick();
  f.complete('b'); assert.equal(await b, true); const current = f.material.map;
  f.complete('a'); assert.equal(await a, false);
  assert.equal(f.effect.state.active, 'b'); assert.equal(f.effect.state.requested, 'b');
  assert.equal(f.material.map, current); assert.equal(f.disposed.length, 3); assert.equal(f.changes.length, 1);
  f.effect.dispose(); assert.equal(f.disposed.length, 6);
});

test('failure keeps current surface and releases successful siblings including late arrivals', async () => {
  const f = fixture(); const a = f.effect.select('a'); await tick(); f.complete('a'); await a;
  const current = f.material.map, b = f.effect.select('b'); await tick();
  f.jobs.get('b-normal.webp').reject(new Error('missing normal')); f.resolve('b-color.webp'); await tick();
  assert.equal(f.effect.state.loading, true); assert.equal(f.material.map, current);
  f.resolve('b-roughness.webp'); assert.equal(await b, false);
  assert.equal(f.effect.state.active, 'a'); assert.equal(f.material.map, current);
  assert.match(f.effect.state.error, /missing normal/); assert.equal(f.effect.state.loading, false);
  assert.equal(f.disposed.length, 2); assert.equal(f.effect.state.activeTextureCount, 3);
  f.effect.dispose(); assert.equal(f.disposed.length, 5);
});

test('Original cancels an in-flight selection and disposes its eventual arrivals', async () => {
  const f = fixture(); const a = f.effect.select('a'); await tick();
  assert.equal(await f.effect.select('original'), true); assert.equal(f.effect.state.loading, false);
  f.complete('a'); assert.equal(await a, false); assert.equal(f.effect.state.active, 'original');
  assert.equal(f.material.map, f.originalFields.map); assert.equal(f.disposed.length, 3);
  assert.equal(f.changes.length, 0); f.effect.dispose();
});

test('dispose restores originals, cancels pending work, and releases each owned texture once', async () => {
  const f = fixture(); const a = f.effect.select('a'); await tick(); f.complete('a'); await a;
  const b = f.effect.select('b'); await tick(); f.effect.dispose();
  assert.equal(f.material.map, f.originalFields.map); assert.equal(f.disposed.length, 3);
  f.complete('b'); assert.equal(await b, false); assert.equal(f.disposed.length, 6);
  f.effect.dispose(); assert.equal(f.disposed.length, 6); assert.equal(await f.effect.select('a'), false);
  assert.equal(f.effect.state.disposed, true); assert.equal(f.effect.state.activeTextureCount, 0);
});

test('a cached loader source texture is cloned instead of modifying or disposing the original', async () => {
  const material = new THREE.MeshPhysicalMaterial(), texture = new THREE.Texture();
  texture.repeat.set(7, 9); texture.flipY = true; texture.colorSpace = THREE.NoColorSpace;
  material.map = texture; let disposed = 0; texture.addEventListener('dispose', () => disposed++);
  const effect = createFloorMaterials({ materials: [material], variants, loader: async () => texture });
  assert.equal(await effect.select('a'), true);
  assert.notEqual(material.map, texture); assert.notEqual(material.normalMap, material.map);
  assert.deepEqual(texture.repeat.toArray(), [7, 9]); assert.equal(texture.flipY, true);
  assert.equal(texture.colorSpace, THREE.NoColorSpace); effect.dispose(); assert.equal(disposed, 0);
  assert.equal(material.map, texture);
});

test('live controls clamp finite values and preserve maps, hooks, environment and material version', () => {
  const f = fixture(), version = f.material.version;
  assert.deepEqual(f.effect.getSurface(), { metalness: 0.08, roughness: 0.65, normalStrength: 1 });
  assert.deepEqual(f.effect.state.surfaceDefaults, f.effect.getSurface());
  assert.equal(f.effect.setSurface({ metalness: 2, roughness: -1, normalStrength: 3 }), true);
  assert.deepEqual(f.effect.getSurface(), { metalness: 1, roughness: 0, normalStrength: 2 });
  assert.deepEqual(f.material.normalScale.toArray(), [1.4, -1.6]);
  assert.equal(f.effect.setSurface({ normalStrength: 0.5 }), true);
  assert.deepEqual(f.material.normalScale.toArray(), [0.35, -0.4], 'normal edits always multiply baseline, never previous edit');
  for (const [field, texture] of Object.entries(f.originalFields)) assert.equal(f.material[field], texture);
  assert.equal(f.material.version, version); assert.equal(f.material.envMapIntensity, 0.55);
  assert.equal(f.material.onBeforeCompile, f.hook); assert.equal(f.material.customProgramCacheKey, f.key);
  assert.equal(f.jobs.size, 0); assert.equal(f.effect.state.texturesLoaded, 0); assert.deepEqual(f.disposed, []);
  const copy = f.effect.getSurface(); copy.roughness = 0.99;
  assert.equal(f.effect.getSurface().roughness, 0, 'returned values are isolated');
  const changes = f.changes.length;
  assert.equal(f.effect.setSurface({ roughness: NaN }), false);
  assert.equal(f.effect.setSurface({ metalness: Infinity }), false);
  assert.equal(f.effect.setSurface({ roughness: '0.5' }), false);
  assert.equal(f.effect.setSurface({}), false); assert.equal(f.changes.length, changes);
  assert.equal(f.effect.resetSurface(), true);
  assert.deepEqual(f.effect.getSurface(), { metalness: 0.08, roughness: 0.65, normalStrength: 1 });
  assert.ok(f.material.normalScale.equals(f.originalNormalScale)); assert.equal(f.material.version, version);
  f.effect.dispose(); assert.equal(f.effect.setSurface({ roughness: 0.5 }), false); assert.equal(f.effect.resetSurface(), false);
});

test('repeated edits and reset on selected material never load, dispose or recompile textures/materials', async () => {
  const f = fixture(), load = f.effect.select('a'); await tick(); f.complete('a'); await load;
  const version = f.material.version, maps = ['map', 'normalMap', 'roughnessMap'].map(field => f.material[field]);
  const counts = { requests: f.effect.state.requests, loaded: f.effect.state.texturesLoaded, disposed: f.effect.state.texturesDisposed };
  for (let i = 0; i < 10; i++) assert.equal(f.effect.setSurface({ metalness: i / 10, roughness: 0.2 + i / 20, normalStrength: i / 10 }), true);
  assert.deepEqual(f.effect.state.surfaceDefaults, { metalness: 0, roughness: 1, normalStrength: 1 });
  assert.equal(f.effect.resetSurface(), true);
  assert.deepEqual(f.effect.getSurface(), { metalness: 0, roughness: 1, normalStrength: 1 });
  assert.deepEqual(f.material.normalScale.toArray(), [0.22, 0.22]);
  assert.equal(f.material.version, version);
  for (const [index, field] of ['map', 'normalMap', 'roughnessMap'].entries()) assert.equal(f.material[field], maps[index]);
  assert.deepEqual({ requests: f.effect.state.requests, loaded: f.effect.state.texturesLoaded, disposed: f.effect.state.texturesDisposed }, counts);
  assert.equal(f.effect.state.activeTextureCount, 3); assert.deepEqual(f.disposed, []);
  const changes = f.changes.length; assert.equal(f.effect.resetSurface(), true); assert.equal(f.changes.length, changes, 'already-reset surface needs no new frame');
  f.effect.dispose();
});

test('same selection preserves edits, each new selection resets controls to its own baseline', async () => {
  const f = fixture(), a = f.effect.select('a'); await tick(); f.complete('a'); await a;
  f.effect.setSurface({ metalness: 0.4, roughness: 0.3, normalStrength: 0.7 });
  assert.equal(await f.effect.select('a'), true);
  assert.deepEqual(f.effect.getSurface(), { metalness: 0.4, roughness: 0.3, normalStrength: 0.7 });
  const b = f.effect.select('b'); await tick(); f.complete('b'); await b;
  assert.deepEqual(f.effect.getSurface(), { metalness: 0, roughness: 1, normalStrength: 1 });
  f.effect.setSurface({ roughness: 0.2 }); assert.equal(await f.effect.select('original'), true);
  assert.deepEqual(f.effect.getSurface(), { metalness: 0.08, roughness: 0.65, normalStrength: 1 });
  assert.ok(f.material.normalScale.equals(f.originalNormalScale)); f.effect.dispose();
});

test('loading rejects slider edits; Reset cancels pending selection without losing current maps', async () => {
  const f = fixture(), a = f.effect.select('a'); await tick(); f.complete('a'); await a;
  f.effect.setSurface({ metalness: 0.6, roughness: 0.4, normalStrength: 1.5 });
  const currentMap = f.material.map, currentVersion = f.material.version, b = f.effect.select('b'); await tick();
  assert.equal(f.effect.setSurface({ roughness: 0.1 }), false); assert.equal(f.effect.getSurface().roughness, 0.4);
  assert.equal(f.effect.resetSurface(), true); assert.equal(f.effect.state.loading, false);
  assert.equal(f.effect.state.active, 'a'); assert.equal(f.effect.state.requested, 'a');
  assert.deepEqual(f.effect.getSurface(), { metalness: 0, roughness: 1, normalStrength: 1 });
  assert.equal(f.material.map, currentMap); assert.equal(f.material.version, currentVersion); assert.deepEqual(f.disposed, []);
  f.complete('b'); assert.equal(await b, false);
  assert.equal(f.material.map, currentMap); assert.equal(f.effect.state.activeTextureCount, 3);
  assert.equal(f.disposed.length, 3); assert.ok(!f.disposed.includes(currentMap)); f.effect.dispose();
});

test('Original reset restores each material scalar and signed normal baseline independently', () => {
  const first = new THREE.MeshStandardMaterial({ metalness: 0.1, roughness: 0.65 }); first.normalScale.set(0.7, -0.8);
  const second = new THREE.MeshPhysicalMaterial({ metalness: 0.2, roughness: 0.8 }); second.normalScale.set(-0.4, 0.3);
  const versions = [first.version, second.version];
  const effect = createFloorMaterials({ materials: [first, second], variants });
  assert.equal(effect.setSurface({ normalStrength: 2 }), true);
  assert.equal(second.roughness, 0.8, 'editing normal strength preserves heterogeneous roughness');
  assert.deepEqual(second.normalScale.toArray(), [-0.8, 0.6]);
  assert.equal(effect.setSurface({ metalness: 0.9, roughness: 0.1 }), true);
  assert.equal(effect.resetSurface(), true);
  assert.equal(first.metalness, 0.1); assert.equal(first.roughness, 0.65);
  assert.equal(second.metalness, 0.2); assert.equal(second.roughness, 0.8);
  assert.deepEqual(first.normalScale.toArray(), [0.7, -0.8]); assert.deepEqual(second.normalScale.toArray(), [-0.4, 0.3]);
  assert.deepEqual([first.version, second.version], versions); effect.dispose();
});
