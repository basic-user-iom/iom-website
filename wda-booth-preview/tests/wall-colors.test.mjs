import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THREE = await import(pathToFileURL(path.join(root, 'public/vendor/three/build/three.module.js')).href);
const {createWallColors} = await import('../src/wall-colors.mjs');

function fixture() {
  const material = new THREE.MeshPhysicalMaterial({name: 'wall_paint', color: '#dfded8', roughness: 0.82, metalness: 0.02});
  const texture = new THREE.Texture(); material.normalMap = texture; material.roughnessMap = texture;
  material.normalScale.set(0.4, -0.7); material.envMapIntensity = 0.55;
  const hook = () => {}, cacheKey = () => 'existing-wall-program';
  material.onBeforeCompile = hook; material.customProgramCacheKey = cacheKey;
  const geometry = new THREE.BoxGeometry(5, 3.5, 0.05);
  const wall = new THREE.Mesh(geometry, material), secondWall = new THREE.Mesh(geometry, material);
  const artwork = new THREE.Mesh(geometry, material), floor = new THREE.Mesh(geometry, material), detail = new THREE.Mesh(geometry, material);
  const changes = [], disposedTextures = [];
  texture.addEventListener('dispose', () => disposedTextures.push(texture));
  const effect = createWallColors({meshes: [wall, secondWall, wall], onChange: state => changes.push(state)});
  return {material, texture, geometry, wall, secondWall, artwork, floor, detail, changes, disposedTextures, hook, cacheKey, effect};
}

test('only explicit wall mesh references clone shared PBR material; art, floor and details stay unchanged', () => {
  const f = fixture(), original = f.material.color.clone();
  assert.notEqual(f.wall.material, f.material); assert.equal(f.wall.material, f.secondWall.material);
  assert.equal(f.effect.state.meshCount, 2); assert.equal(f.effect.state.materialCount, 1);
  assert.equal(f.effect.setColor('#405f80'), true);
  assert.equal(f.wall.material.color.getHexString(), '405f80');
  for (const mesh of [f.artwork, f.floor, f.detail]) {
    assert.equal(mesh.material, f.material); assert.ok(mesh.material.color.equals(original));
  }
  assert.ok(f.material.color.equals(original)); assert.equal(f.changes.length, 1);
  f.effect.dispose();
});

test('maps, geometry, PBR properties, shader callbacks and program version remain intact across edits', () => {
  const f = fixture(), copy = f.wall.material, version = copy.version;
  const uv = f.geometry.getAttribute('uv').array.slice();
  for (const hex of ['#123456', '#ffffff', '#000000', '#bac3cb']) assert.equal(f.effect.setColor(hex), true);
  assert.equal(copy.normalMap, f.texture); assert.equal(copy.roughnessMap, f.texture);
  assert.equal(copy.roughness, 0.82); assert.equal(copy.metalness, 0.02); assert.equal(copy.envMapIntensity, 0.55);
  assert.deepEqual(copy.normalScale.toArray(), [0.4, -0.7]);
  assert.equal(copy.onBeforeCompile, f.hook); assert.equal(copy.customProgramCacheKey, f.cacheKey);
  assert.equal(copy.version, version); assert.equal(f.wall.geometry, f.geometry);
  assert.deepEqual(f.geometry.getAttribute('uv').array, uv); assert.deepEqual(f.disposedTextures, []);
  f.effect.dispose();
});

test('reset restores exact linear colors, uses no new clones and idempotent edits do not request rendering', () => {
  const f = fixture(), copy = f.wall.material, original = f.material.color.clone();
  assert.equal(f.effect.reset(), true); assert.equal(f.changes.length, 0);
  assert.equal(f.effect.setColor('#ABCDEF'), true); assert.equal(f.effect.state.color, '#abcdef');
  assert.equal(f.effect.state.isDefault, false);
  assert.equal(f.effect.setColor('#abcdef'), true); assert.equal(f.changes.length, 1);
  assert.equal(f.effect.reset(), true); assert.equal(f.changes.length, 2);
  assert.ok(copy.color.equals(original)); assert.equal(f.effect.state.isDefault, true); assert.equal(f.wall.material, copy);
  assert.equal(f.effect.reset(), true); assert.equal(f.changes.length, 2);
  f.effect.dispose();
});

test('array material targets clone only PBR entries and reset each distinct default independently', () => {
  const a = new THREE.MeshStandardMaterial({color: '#c5a588'}), b = new THREE.MeshPhysicalMaterial({color: '#809090'});
  const nonPBR = new THREE.MeshBasicMaterial({color: '#00ff00'}), array = [a, nonPBR, b];
  const wall = new THREE.Mesh(new THREE.BoxGeometry(), array), other = new THREE.Mesh(wall.geometry, a);
  const effect = createWallColors({meshes: [wall]});
  assert.notEqual(wall.material, array); assert.equal(wall.material[1], nonPBR);
  assert.equal(effect.state.materialCount, 2); assert.equal(effect.state.mixed, true);
  assert.equal(effect.setColor('#ddeeff'), true); assert.equal(effect.state.mixed, false);
  assert.equal(other.material, a); assert.equal(a.color.getHexString(), 'c5a588');
  assert.equal(effect.reset(), true); assert.equal(effect.state.mixed, true);
  assert.ok(wall.material[0].color.equals(a.color)); assert.ok(wall.material[2].color.equals(b.color));
  effect.dispose(); assert.equal(wall.material, array);
});

test('invalid colors and ineligible inputs cause no changes, no errors and no global scene discovery', () => {
  const f = fixture(), current = f.wall.material.color.clone();
  for (const value of ['red', '#fff', '#12345678', '#gg0000', 'rgba(0,0,0,1)', 0xffffff, null, {}]) {
    assert.equal(f.effect.setColor(value), false);
  }
  assert.ok(f.wall.material.color.equals(current)); assert.equal(f.changes.length, 0);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  const empty = createWallColors({meshes: [mesh, null, {}, new THREE.Object3D()]});
  assert.equal(empty.state.ready, false); assert.equal(empty.state.meshCount, 0);
  assert.equal(empty.setColor('#112233'), false); assert.equal(empty.reset(), false);
  empty.dispose(); f.effect.dispose();
});

test('dispose restores exact material identities and disposes owned clones once without touching textures', () => {
  const f = fixture(), copy = f.wall.material;
  let disposed = 0; copy.addEventListener('dispose', () => disposed++);
  f.effect.setColor('#335577'); f.effect.dispose(); f.effect.dispose();
  assert.equal(f.wall.material, f.material); assert.equal(f.secondWall.material, f.material);
  assert.equal(disposed, 1); assert.deepEqual(f.disposedTextures, []);
  assert.equal(f.effect.state.disposed, true); assert.equal(f.effect.state.ready, false);
  assert.equal(f.effect.setColor('#ffffff'), false); assert.equal(f.effect.reset(), false);
});
