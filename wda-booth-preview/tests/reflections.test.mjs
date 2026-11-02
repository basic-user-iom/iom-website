import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const threeURL = pathToFileURL(path.resolve(here, '../public/vendor/three/build/three.module.js')).href;
const THREE = await import(threeURL);
const code = (await fs.readFile(path.resolve(here, '../src/reflections.mjs'), 'utf8')).replace("from 'three'", `from '${threeURL}'`);
const { createBoothReflections, reflectionBufferSize } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

function fixture() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.05, 60);
  camera.position.set(6, 2, 1); camera.lookAt(0, 0.3, 0); camera.updateMatrixWorld();
  const original = new THREE.MeshPhysicalMaterial({ name: 'original-floor', color: 0x777777, roughness: 0.7, metalness: 0 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2), original);
  floor.name = 'Plane'; floor.userData.walkRole = 'floor'; scene.add(floor); scene.updateMatrixWorld();
  const viewport = new THREE.Vector4(5, 7, 900, 600), scissor = new THREE.Vector4(8, 9, 700, 500);
  const renderer = {
    domElement: { clientWidth: 1200 }, xr: { enabled: true }, shadowMap: { autoUpdate: false, needsUpdate: true },
    width: 1600, height: 900, target: null, scissorTest: true, calls: [],
    getDrawingBufferSize(v) { return v.set(this.width, this.height); },
    getRenderTarget() { return this.target; }, setRenderTarget(v) { this.target = v; },
    getViewport(v) { return v.copy(viewport); }, setViewport(v) { viewport.copy(v); },
    getScissor(v) { return v.copy(scissor); }, setScissor(v) { scissor.copy(v); },
    getScissorTest() { return this.scissorTest; }, setScissorTest(v) { this.scissorTest = v; },
    clear() {},
    render(s, c) {
      this.calls.push({ s, c, target: this.target, floorVisible: floor.visible, xr: this.xr.enabled });
      if (this.throwNext) { this.throwNext = false; throw new Error('simulated renderer failure'); }
      this.shadowMap.needsUpdate = false;
    },
  };
  const effect = createBoothReflections({ renderer, scene, camera, floors: [floor] });
  return { scene, camera, original, floor, renderer, effect, viewport, scissor };
}

test('default OFF leaves imported material exact and allocates/renders nothing', () => {
  const f = fixture(); assert.equal(THREE.REVISION, '180');
  assert.equal(f.effect.state.ready, true); assert.equal(f.effect.state.enabled, false);
  assert.equal(f.effect.update(), false); assert.equal(f.effect.resize(), false);
  assert.equal(f.effect.state.targetAllocations, 0); assert.equal(f.renderer.calls.length, 0);
  assert.equal(f.floor.material, f.original); f.effect.dispose();
});

test('first ON capture has one scene and two depth-aware blur passes, no MSAA', () => {
  const f = fixture(); f.effect.set({ enabled: true }); assert.equal(f.effect.update(), true);
  assert.equal(f.renderer.calls.length, 3); assert.equal(f.effect.state.passes, 3);
  assert.equal(f.renderer.calls[0].s, f.scene); assert.equal(f.renderer.calls[0].floorVisible, false);
  assert.equal(f.renderer.calls[0].xr, false); assert.equal(f.renderer.calls[0].target.samples, 0);
  assert.ok(f.renderer.calls[0].target.depthTexture);
  assert.deepEqual(f.effect.state.bufferSize, [512, 288]);
  assert.equal(f.floor.visible, true); assert.equal(f.renderer.xr.enabled, true);
  assert.equal(f.renderer.shadowMap.needsUpdate, false);
  assert.equal(f.renderer.shadowMap.autoUpdate, false);
  assert.equal(f.renderer.target, null); assert.equal(f.renderer.scissorTest, true);
  assert.deepEqual(f.viewport.toArray(), [5, 7, 900, 600]); assert.deepEqual(f.scissor.toArray(), [8, 9, 700, 500]);
  f.effect.dispose();
});

test('unchanged view stays cached; camera move and explicit scene invalidation recapture', () => {
  const f = fixture(); f.effect.set({ enabled: true }); f.effect.update();
  for (let i = 0; i < 20; i++) assert.equal(f.effect.update(), false);
  assert.equal(f.effect.state.renders, 1); assert.equal(f.renderer.calls.length, 3);
  f.camera.position.z += 0.3; assert.equal(f.effect.update(), true);
  assert.equal(f.effect.update(true), true); assert.equal(f.effect.state.renders, 3);
  assert.equal(f.effect.state.targetAllocations, 3); f.effect.dispose();
});

test('camera round-off stays cached while real motion, FOV and scene changes recapture', () => {
  const f=fixture();f.effect.set({enabled:true});f.effect.update();
  for(let i=0;i<10;i++){f.camera.position.x+=1e-12;assert.equal(f.effect.update(),false);}
  assert.equal(f.effect.state.renders,1);
  f.camera.position.x+=1e-5;assert.equal(f.effect.update(),true);
  f.camera.fov+=.01;f.camera.updateProjectionMatrix();assert.equal(f.effect.update(),true);
  assert.equal(f.effect.update(true),true);assert.equal(f.effect.state.renders,4);f.effect.dispose();
});

test('mobile/desktop target caps preserve aspect and repeated resize does not reallocate', () => {
  assert.deepEqual(reflectionBufferSize(1600, 900), [512, 288]);
  assert.deepEqual(reflectionBufferSize(1200, 2400, true), [128, 256]);
  const f = fixture(); f.effect.set({ enabled: true }); f.effect.update();
  f.renderer.domElement.clientWidth = 390; f.renderer.width = 780; f.renderer.height = 1600;
  assert.equal(f.effect.resize(), true); assert.deepEqual(f.effect.state.bufferSize, [125, 256]);
  assert.equal(f.effect.resize(), false); f.effect.update();
  assert.equal(f.effect.state.targetAllocations, 3); f.effect.dispose();
});

test('actual r180 material shader patch retains diffuse/direct hooks and replaces only indirect specular', () => {
  const f = fixture(); f.effect.set({ enabled: true });
  const s = { vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader, uniforms: {} };
  f.floor.material.onBeforeCompile(s, f.renderer);
  assert.match(s.fragmentShader, /radiance=texture2D\(wdaFloorReflection/);
  assert.match(s.fragmentShader, /indirectSpecular \+= multiScattering \* radiance;/);
  assert.match(s.fragmentShader, /reflectedLight.indirectDiffuse \+= diffuse \* cosineWeightedIrradiance;/);
  assert.match(s.fragmentShader, /#include <lights_fragment_begin>/);
  assert.match(s.fragmentShader, /#include <lights_fragment_end>/);
  assert.match(s.vertexShader, /wdaFloorMatrix\*modelMatrix/);
  assert.match(s.vertexShader, /min\(directionalLightShadows\[ i \].shadowNormalBias,0.005\)/);
  assert.equal(f.floor.material.map, f.original.map); assert.equal(f.floor.material.roughness, 0.7);
  assert.ok(s.uniforms.wdaFloorReflection); f.effect.dispose();
});

test('OFF restores the exact original material; re-enable captures even with unchanged camera', () => {
  const f = fixture(); f.effect.set({ enabled: true }); f.effect.update();
  const replacement = f.floor.material;
  assert.notEqual(replacement, f.original); f.effect.set({ enabled: false });
  assert.equal(f.floor.material, f.original); assert.equal(f.effect.update(), false);
  f.effect.set({ enabled: true }); assert.equal(f.floor.material, replacement);
  assert.equal(f.effect.update(), true); f.effect.dispose(); assert.equal(f.floor.material, f.original);
});

test('surface sync keeps existing contact/reflection hooks, updates PBR inputs, and needs no capture', () => {
  const f = fixture();
  const contactUniform = { value: 0.28 };
  f.original.onBeforeCompile = shader => { shader.uniforms.contactSentinel = contactUniform; };
  f.original.customProgramCacheKey = () => 'test-contact';
  f.effect.set({ enabled: true, intensity: 0.33 }); f.effect.update();
  const material = f.floor.material, hook = material.onBeforeCompile, key = material.customProgramCacheKey;
  const maps = ['map', 'normalMap', 'roughnessMap', 'specularIntensityMap', 'specularColorMap'];
  const textures = maps.map((field, index) => {
    const texture = new THREE.Texture(); texture.name = `surface-${field}`; texture.channel = index % 2;
    f.original[field] = texture; return texture;
  });
  f.original.color.set('#c8c3ba'); f.original.roughness = 0.82; f.original.metalness = 0;
  f.original.normalScale.set(0.3, 0.3); f.original.ior = 1.45;
  f.original.specularIntensity = 0.8; f.original.specularColor.set('#e8e8e8');
  const beforeVersion = material.version;
  assert.equal(f.effect.syncSurface(), true);
  assert.equal(f.floor.material, material); assert.equal(material.onBeforeCompile, hook);
  assert.equal(material.customProgramCacheKey, key); assert.equal(material.customProgramCacheKey(), 'test-contact|wda-planar-r180-v1');
  for (const field of maps) assert.equal(material[field], f.original[field]);
  for (const field of ['color', 'normalScale', 'specularColor']) {
    assert.notEqual(material[field], f.original[field]); assert.ok(material[field].equals(f.original[field]));
  }
  for (const field of ['roughness', 'metalness', 'ior', 'specularIntensity']) assert.equal(material[field], f.original[field]);
  assert.equal(material.version, beforeVersion + 1);
  assert.equal(f.effect.state.intensity, 0.33); assert.equal(f.effect.update(), false);
  assert.equal(f.effect.state.renders, 1); assert.equal(f.effect.state.targetAllocations, 3);
  assert.equal(f.effect.syncSurface(), false); assert.equal(material.version, beforeVersion + 1);
  const shader = { vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader, uniforms: {} };
  material.onBeforeCompile(shader, f.renderer);
  assert.equal(shader.uniforms.contactSentinel, contactUniform); assert.ok(shader.uniforms.wdaFloorReflection);
  const disposedTextures = [];
  for (const texture of textures) texture.addEventListener('dispose', () => disposedTextures.push(texture));
  f.effect.dispose(); assert.deepEqual(disposedTextures, []); assert.equal(f.effect.syncSurface(), false);
});

test('surface changes while reflections OFF survive later ON and repeated option switches', () => {
  const f = fixture(); const first = new THREE.Texture(), second = new THREE.Texture();
  f.original.map = first; f.original.roughness = 0.64;
  assert.equal(f.effect.syncSurface(), false, 'no lazy reflection clone is allocated while OFF');
  assert.equal(f.effect.state.targetAllocations, 0); assert.equal(f.floor.material, f.original);
  f.effect.set({ enabled: true }); const reflectionMaterial = f.floor.material;
  assert.equal(reflectionMaterial.map, first); assert.equal(reflectionMaterial.roughness, 0.64);
  f.effect.update(); f.effect.set({ enabled: false });
  f.original.map = second; f.original.roughness = 0.75;
  assert.equal(f.effect.syncSurface(), true); assert.equal(f.floor.material, f.original);
  f.effect.set({ enabled: true }); assert.equal(f.floor.material, reflectionMaterial);
  assert.equal(reflectionMaterial.map, second); assert.equal(reflectionMaterial.roughness, 0.75);
  f.original.map = null; f.original.normalMap = null; f.original.specularIntensityMap = null;
  assert.equal(f.effect.syncSurface(), true); assert.equal(reflectionMaterial.map, null);
  f.effect.set({ enabled: false }); assert.equal(f.floor.material, f.original);
  assert.equal(f.floor.material.map, null); f.effect.dispose();
});

test('failure restores floor visibility and renderer state, disables the optional effect', () => {
  const f = fixture(); f.effect.set({ enabled: true }); f.renderer.throwNext = true;
  assert.equal(f.effect.update(), false); assert.equal(f.effect.state.enabled, false);
  assert.equal(f.floor.visible, true); assert.equal(f.floor.material, f.original);
  assert.equal(f.renderer.target, null); assert.equal(f.renderer.xr.enabled, true);
  assert.equal(f.renderer.shadowMap.needsUpdate, true); assert.equal(f.renderer.scissorTest, true);
  assert.deepEqual(f.effect.state.errors, ['simulated renderer failure']); f.effect.dispose();
});

test('rejects wall geometry and invalid settings; no work after disposal', () => {
  const f = fixture(); assert.equal(f.effect.set({ intensity: NaN }), false);
  assert.equal(f.effect.state.intensity, 0.22);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.5), f.original);
  const bad = createBoothReflections({ renderer: f.renderer, scene: f.scene, camera: f.camera, floors: [wall] });
  assert.equal(bad.state.ready, false); bad.set({ enabled: true }); assert.equal(bad.state.enabled, false);
  assert.equal(bad.update(), false); bad.dispose();
  f.effect.dispose(); assert.equal(f.effect.set({ enabled: true }), false); assert.equal(f.effect.update(true), false);
});
