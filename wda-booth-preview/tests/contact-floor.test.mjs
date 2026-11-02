import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const threeURL = pathToFileURL(path.join(root, 'public/vendor/three/build/three.module.js')).href;
const THREE = await import(threeURL);
async function importModule(name) {
  const code = (await fs.readFile(path.join(root, `src/${name}.mjs`), 'utf8')).replace("from 'three'", `from '${threeURL}'`);
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
const { createFloorContact } = await importModule('contact-floor');
const { createBoothReflections } = await importModule('reflections');

function wall(width = 2, depth = 0.08, height = 2) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial());
  mesh.position.y = height / 2; return mesh;
}
function fixture(casters = [wall()], settings = {}) {
  const scene = new THREE.Scene();
  const original = new THREE.MeshPhysicalMaterial({ name: 'imported-floor', roughness: 0.68, metalness: 0.04 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50).rotateX(-Math.PI / 2), original);
  scene.add(floor, ...casters); scene.updateMatrixWorld(true);
  const geometry = floor.geometry, uv = geometry.getAttribute('uv').array.slice();
  const contact = createFloorContact({ floors: [floor], casters, resolution: 256, ...settings });
  return { scene, original, floor, geometry, uv, casters, contact };
}
function shader(material) {
  const s = { vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader, uniforms: {} };
  material.onBeforeCompile(s, {}); return s;
}
function sample(fixture, x, z) {
  const s = shader(fixture.floor.material), image = s.uniforms.wdaContactMap.value.image;
  const b = fixture.contact.state.bounds;
  const u = (x - b.minX) / (b.maxX - b.minX), v = (z - b.minZ) / (b.maxZ - b.minZ);
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return 0;
  return image.data[Math.floor(v * image.height) * image.width + Math.floor(u * image.width)] / 255;
}

test('default 512 cache follows actual low geometry, with clear padding and bounded blur', () => {
  const f = fixture([wall()], { resolution: 512 });
  assert.equal(f.contact.state.enabled, true); assert.equal(f.contact.state.builds, 0);
  assert.equal(f.contact.update(), true);
  const s = f.contact.state, texture = shader(f.floor.material).uniforms.wdaContactMap.value;
  assert.equal(s.builds, 1); assert.equal(s.textureAllocations, 1); assert.deepEqual(s.bufferSize, [512, 512]);
  assert.equal(s.casterMeshes, 1); assert.ok(s.nearFloorTriangles > 0); assert.ok(s.projectedTriangles > 0);
  assert.ok(s.bounds.maxX - s.bounds.minX < 3, 'scope must not cover the 50 m background floor');
  assert.ok(s.bounds.maxZ - s.bounds.minZ < 1);
  assert.ok(s.blurRadiusTexels.every(v => v >= 1 && v <= 8));
  assert.equal(texture.format, THREE.RedFormat); assert.equal(texture.colorSpace, THREE.NoColorSpace);
  assert.equal(texture.generateMipmaps, false); assert.equal(texture.flipY, false);
  const p = texture.image.data, n = 512;
  for (let i = 0; i < n; i++) {
    assert.equal(p[i], 0); assert.equal(p[(n - 1) * n + i], 0); assert.equal(p[i * n], 0); assert.equal(p[i * n + n - 1], 0);
  }
  assert.ok(sample(f, 0, 0) > 0.5); assert.equal(sample(f, 0, 0.18), 0);
  assert.deepEqual(s.errors, []); f.contact.dispose();
});

test('rotated footprint and real endcaps leave AABB corners and beyond-wall floor clear', () => {
  const caster = wall(4); caster.rotation.y = Math.PI / 4;
  const group = new THREE.Group(); group.position.set(0.4, 0, -0.2); group.add(caster);
  const f = fixture([], { resolution: 512 }); f.contact.dispose(); f.scene.add(group); f.scene.updateMatrixWorld(true);
  f.contact = createFloorContact({ floors: [f.floor], casters: [caster], resolution: 512 });
  assert.equal(f.contact.update(), true);
  assert.ok(sample(f, 1, -0.8) > 0.4);
  assert.equal(sample(f, 1.3, 0.7), 0, 'rotated AABB corner is not geometry');
  assert.equal(sample(f, 2.05, -1.85), 0, 'contact must stop at actual wall endpoint');
  f.contact.dispose();
});

test('separate low feet retain the open gap instead of painting a continuous border', () => {
  const a = wall(1), b = wall(1); a.position.x = -0.9; b.position.x = 0.9;
  const f = fixture([a, b]); f.contact.update();
  assert.ok(sample(f, -0.9, 0) > 0.5); assert.ok(sample(f, 0.9, 0) > 0.5);
  assert.equal(sample(f, 0, 0), 0); f.contact.dispose();
});

test('raised geometry is height-weighted and geometry above the band cannot enlarge or darken the cache', () => {
  const grounded = wall(1, 0.12), raised = wall(1, 0.12, 0.04), high = wall(12, 12, 0.2);
  grounded.position.x = -1; raised.position.set(1, 0.22, 0); high.position.y = 1;
  const f = fixture([grounded, raised, high]); f.contact.update();
  assert.equal(f.contact.state.casterMeshes, 2); assert.ok(f.contact.state.bounds.maxX < 2);
  assert.ok(sample(f, -1, 0) > 0.8); assert.ok(sample(f, 1, 0) < 0.1); assert.equal(sample(f, 0, 1), 0);
  f.contact.dispose();
});

test('open vertical plane gets conservative contact only along its actual footprint', () => {
  const caster = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }));
  caster.position.y = 1;
  const f = fixture([caster]); assert.equal(f.contact.update(), true);
  assert.ok(f.contact.state.degenerateSegments > 0); assert.ok(sample(f, 0, 0) > 0);
  assert.equal(sample(f, 0, 0.12), 0); assert.equal(sample(f, 1.15, 0), 0);
  f.contact.dispose();
});

test('floor material is isolated; geometry, UVs, source textures and previous shader hook survive', () => {
  const f = fixture(); f.contact.dispose();
  const map = new THREE.Texture(); f.original.map = map; f.original.normalMap = new THREE.Texture();
  let priorCalls = 0; f.original.onBeforeCompile = function (s) { priorCalls++; s.uniforms.prior = { value: this.roughness }; };
  f.original.customProgramCacheKey = () => 'previous-floor';
  const other = wall(); other.material = f.original; f.scene.add(other);
  f.contact = createFloorContact({ floors: [f.floor], casters: f.casters, resolution: 128 }); f.contact.update();
  const s = shader(f.floor.material);
  assert.equal(priorCalls, 1); assert.equal(s.uniforms.prior.value, 0.68); assert.match(f.floor.material.customProgramCacheKey(), /previous-floor\|wda-contact/);
  assert.notEqual(f.floor.material, f.original); assert.equal(other.material, f.original);
  assert.equal(f.floor.material.map, map); assert.equal(f.floor.material.normalMap, f.original.normalMap);
  assert.equal(f.floor.material.roughness, f.original.roughness); assert.equal(f.floor.material.metalness, f.original.metalness);
  assert.equal(f.floor.geometry, f.geometry); assert.deepEqual(f.floor.geometry.getAttribute('uv').array, f.uv);
  assert.match(s.fragmentShader, /reflectedLight.indirectDiffuse\*=1.0-wdaContactOcclusion/);
  assert.doesNotMatch(s.fragmentShader, /reflectedLight\.(?:directDiffuse|directSpecular|indirectSpecular)\s*\*=/);
  assert.match(s.fragmentShader, /#include <aomap_fragment>/); assert.match(s.fragmentShader, /#include <lights_fragment_end>/);
  assert.match(s.fragmentShader, /smoothstep\(vec2\(0.0\),vec2\(wdaContactEdge\),wdaContactUV\)/);
  f.contact.dispose(); assert.equal(f.floor.material, f.original);
});

test('reflection clones compose both r180 shader effects; independent toggles retain contact cache', () => {
  const f = fixture(); f.contact.update(); const contactMaterial = f.floor.material;
  const reflection = createBoothReflections({ renderer: {}, scene: f.scene, camera: new THREE.PerspectiveCamera(), floors: [f.floor] });
  reflection.set({ enabled: true, intensity: 0.33 });
  const s = shader(f.floor.material);
  assert.ok(s.uniforms.wdaContactMap); assert.ok(s.uniforms.wdaFloorReflection);
  assert.match(s.fragmentShader, /radiance=texture2D\(wdaFloorReflection/);
  assert.match(s.fragmentShader, /reflectedLight.indirectDiffuse\*=1.0-wdaContactOcclusion/);
  assert.match(s.vertexShader, /wdaContactWorldXZ=/); assert.match(s.vertexShader, /wdaFloorUV=/);
  assert.equal(s.uniforms.wdaContactStrength.value, 0.28);
  f.contact.set({ enabled: false }); assert.equal(s.uniforms.wdaContactStrength.value, 0);
  f.contact.set({ enabled: true }); assert.equal(s.uniforms.wdaContactStrength.value, 0.28);
  reflection.set({ enabled: false }); assert.equal(f.floor.material, contactMaterial);
  reflection.set({ enabled: true }); assert.ok(shader(f.floor.material).uniforms.wdaContactMap);
  assert.equal(f.contact.update(), false); assert.equal(f.contact.state.builds, 1);
  reflection.dispose(); f.contact.dispose(); assert.equal(f.floor.material, f.original);
});

test('only explicit invalidation rebuilds; toggles, repeated frames and camera changes reuse one texture', () => {
  const f = fixture(); f.contact.update(); const s = shader(f.floor.material), texture = s.uniforms.wdaContactMap.value;
  const camera = new THREE.PerspectiveCamera(); f.scene.add(camera);
  for (let i = 0; i < 10; i++) { camera.position.x += 0.5; assert.equal(f.contact.update(), false); }
  f.contact.set({ enabled: false }); assert.equal(f.contact.update(true), false);
  f.contact.set({ enabled: true, intensity: 0.2 }); assert.equal(f.contact.update(), false);
  assert.equal(f.contact.state.builds, 1); assert.equal(f.contact.state.skippedUnchanged, 11);
  f.casters[0].position.z += 0.5; f.contact.invalidate('caster-edited');
  assert.equal(f.contact.update(), true); assert.equal(f.contact.state.builds, 2);
  assert.equal(s.uniforms.wdaContactMap.value, texture); assert.equal(f.contact.state.textureAllocations, 1);
  assert.equal(sample(f, 0, 0), 0); assert.ok(sample(f, 0, 0.5) > 0.5);
  assert.equal(f.contact.state.lastReason, 'caster-edited'); f.contact.dispose();
});

test('hidden/transmissive/high meshes produce a clear cache; invalid floor and disposal are safe', () => {
  const hidden = wall(), glass = wall(); hidden.visible = false; glass.material = new THREE.MeshPhysicalMaterial({ transmission: 1 });
  const f = fixture([hidden, glass]); assert.equal(f.contact.update(), true);
  assert.equal(f.contact.state.occludedTexels, 0); assert.equal(f.contact.state.maxOcclusion, 0);
  assert.equal(f.contact.set({ intensity: NaN }), false);
  const texture = shader(f.floor.material).uniforms.wdaContactMap.value; let disposed = 0;
  texture.addEventListener('dispose', () => disposed++);
  f.contact.dispose(); f.contact.dispose(); assert.equal(disposed, 1);
  assert.equal(f.contact.update(true), false); assert.equal(f.contact.set({ enabled: true }), false); assert.equal(f.contact.invalidate(), false);
  const bad = createFloorContact({ floors: [wall()], casters: [] });
  assert.equal(bad.state.ready, false); assert.equal(bad.state.enabled, false); assert.equal(bad.update(), false); bad.dispose();
});
