import * as THREE from 'three';
import { getGalleryQuality } from './gallery-quality.js';

/**
 * Runtime-only, cached whole-gallery shadows using the existing key light.
 * The bundled Three.js PCF implementation supports shadow.radius; PCFSoft was removed.
 * Opaque architecture and props cast shadows; glazing transmits the key light.
 * The studies controller aligns that key with the loaded HDR's dominant source.
 * Source meshes, materials, textures and buffers are borrowed and never disposed.
 */
export function createGalleryShadows({ renderer, scene, galleryModel, sculptureModel, effects, groundReceiver = null }) {
  const key = scene.children.find(object => object.isDirectionalLight);
  if (!key || !renderer || !galleryModel || !sculptureModel || !effects) {
    throw new Error('Gallery shadows require the existing key light, renderer, models and effect state.');
  }
  const state = {
    enabled: true, intensity: 1, softness: 2.5, ready: false, disposed: false,
    mapSize: 0, updates: 0, lightUUID: key.uuid, shadowBounds: null,
    casterCount: 0, receiverCount: 0, casterInstances: 0,
    eligibleCasterCount: 0, excludedTransparentCount: 0, visibleMeshCount: 0,
    fitCount: 0, boundsInstanceCount: 0,
    normalBias: .012,
    groundReceiverBounds: null, groundReceiverFarExtension: 0,
  };
  const originalRenderer = { enabled: renderer.shadowMap.enabled, type: renderer.shadowMap.type };
  const originalKey = { shadow: key.shadow, castShadow: key.castShadow };
  const shadow = key.shadow.clone();
  shadow.autoUpdate = false;
  shadow.needsUpdate = true;
  shadow.intensity = state.intensity;
  shadow.radius = state.softness;
  shadow.bias = -.000035;
  shadow.normalBias = .012;
  key.shadow = shadow;

  const meshesOf = object => {
    const meshes = [];
    object?.traverse(child => { if (child.isMesh) meshes.push(child); });
    return meshes;
  };
  const galleryMeshes = meshesOf(galleryModel), sculptureMeshes = meshesOf(sculptureModel);
  const allMeshes = [...galleryMeshes, ...sculptureMeshes], originals = new Map();
  for (const mesh of [...galleryMeshes, ...sculptureMeshes]) originals.set(mesh, {
    castShadow: mesh.castShadow, receiveShadow: mesh.receiveShadow,
    customDepthMaterial: mesh.customDepthMaterial,
    material: mesh.material,
  });
  const dMeshes = new Set(meshesOf(sculptureModel.getObjectByName('AI66_002_Sculpture_D')));
  const floorMeshes = galleryMeshes.filter(mesh => /^ai66_Floor_[AB]$/.test(mesh.name));
  const floors = new Set(floorMeshes);
  const bMeshes = new Set(meshesOf(sculptureModel.getObjectByName('AI66_002_Sculpture_B001')));
  const fMeshes = new Set(meshesOf(sculptureModel.getObjectByName('AI66_002_Sculpture_F001')).filter(mesh =>
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).some(material => /Marble_Carved/.test(material.name))));
  const depthCopies = new Map();
  let disposed = false, dirty = true, previousSignature = '', previousMatrixSignature = '';
  const sourceBounds = new Map(), instanceBounds = new Map(), worldMeshBounds = new Map();
  const opaqueCasters = new Set();
  const materialArray = material => Array.isArray(material) ? material : [material];
  const isOpaque = material => material && material.visible !== false &&
    (material.opacity ?? 1) >= .999 && (material.transmission ?? 0) <= .001;
  for (const mesh of allMeshes) {
    // GLTFLoader separates the asset's material primitives into individual meshes.
    // Test material properties, not names: some window glass is "Material #602".
    if (materialArray(originals.get(mesh).material).every(isOpaque)) opaqueCasters.add(mesh);
    if (!sourceBounds.has(mesh.geometry)) {
      sourceBounds.set(mesh.geometry, new THREE.Box3().setFromBufferAttribute(mesh.geometry.getAttribute('position')));
    }
  }
  state.eligibleCasterCount = opaqueCasters.size;
  state.excludedTransparentCount = allMeshes.length - opaqueCasters.size;
  const box = new THREE.Box3(), lightBounds = new THREE.Box3(), worldBounds = new THREE.Box3();
  const groundReceiverBounds = new THREE.Box3();
  const position = new THREE.Vector3(), target = new THREE.Vector3(), direction = new THREE.Vector3();
  const corner = new THREE.Vector3(), ground = new THREE.Vector3();
  const instanceMatrix = new THREE.Matrix4();

  function isVisible(mesh) {
    for (let object = mesh; object; object = object.parent) if (!object.visible) return false;
    return true;
  }
  function worldBox(mesh) {
    let local = sourceBounds.get(mesh.geometry);
    if (mesh.isInstancedMesh) {
      let saved = instanceBounds.get(mesh);
      if (!saved || saved.version !== mesh.instanceMatrix.version || saved.count !== mesh.count || saved.geometry !== mesh.geometry) {
        const combined = new THREE.Box3();
        for (let index = 0; index < mesh.count; index++) {
          mesh.getMatrixAt(index, instanceMatrix);
          combined.union(box.copy(local).applyMatrix4(instanceMatrix));
        }
        saved = { version: mesh.instanceMatrix.version, count: mesh.count, geometry: mesh.geometry, bounds: combined };
        instanceBounds.set(mesh, saved);
      }
      local = saved.bounds;
    }
    if (!worldMeshBounds.has(mesh)) worldMeshBounds.set(mesh, new THREE.Box3());
    return worldMeshBounds.get(mesh).copy(local).applyMatrix4(mesh.matrixWorld);
  }

  const strength = id => THREE.MathUtils.clamp(effects.strength?.[id] ?? (effects.enabled?.[id] ? 1 : 0), 0, 1);
  function isDActive() { return Boolean(effects.enabled?.spotlight); }
  function ensureFadeDepth(mesh) {
    if (!depthCopies.has(mesh)) {
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaHash: true });
      depth.name = `${mesh.name}_runtime_shadow_fade`;
      // RGBA-packed depth ignores Material.opacity in Three's stock shader.
      // Apply a dedicated uniform before alpha hashing so both end points and
      // intermediate shadow coverage actually match the surface transition.
      const opacity = { value: 1 };
      depth.userData.shadowFade = opacity;
      depth.onBeforeCompile = shader => {
        shader.uniforms.iomShadowOpacity = opacity;
        shader.fragmentShader = 'uniform float iomShadowOpacity;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <alphahash_fragment>',
          'diffuseColor.a *= iomShadowOpacity;\n#include <alphahash_fragment>');
      };
      depth.customProgramCacheKey = () => 'iom-shadow-opacity-hash-v1';
      depthCopies.set(mesh, depth);
    }
    return depthCopies.get(mesh);
  }
  function restoreFadeDepth(mesh) {
    if (mesh.customDepthMaterial === depthCopies.get(mesh) && depthCopies.has(mesh)) {
      mesh.customDepthMaterial = originals.get(mesh).customDepthMaterial;
    }
  }
  function fitShadow() {
    key.updateWorldMatrix(true, false);
    key.getWorldPosition(position); key.target.getWorldPosition(target);
    direction.subVectors(target, position).normalize();
    shadow.camera.position.copy(position); shadow.camera.lookAt(target); shadow.camera.updateMatrixWorld(true);
    let floorY = 0;
    for (const mesh of floorMeshes) {
      mesh.updateWorldMatrix(true, false);
      floorY = Math.max(floorY, worldBox(mesh).max.y);
    }
    worldBounds.makeEmpty(); lightBounds.makeEmpty();
    let instances = 0;
    // Include both casters and receivers, especially the full floor and wall
    // extents. An instance batch's source primitive alone does not cover its
    // chairs/trusses at their actual positions, so use every instance transform.
    for (const mesh of allMeshes) {
      if (!isVisible(mesh)) continue;
      const meshBox = worldBox(mesh);
      if (meshBox.isEmpty()) continue;
      worldBounds.union(meshBox);
      instances += mesh.isInstancedMesh ? mesh.count : 1;
      for (const x of [meshBox.min.x, meshBox.max.x]) for (const y of [meshBox.min.y, meshBox.max.y]) for (const z of [meshBox.min.z, meshBox.max.z]) {
        corner.set(x, y, z);
        lightBounds.expandByPoint(ground.copy(corner).applyMatrix4(shadow.camera.matrixWorldInverse));
      }
    }
    if (worldBounds.isEmpty()) return;
    const padding = 2, camera = shadow.camera;
    camera.left = lightBounds.min.x - padding; camera.right = lightBounds.max.x + padding;
    camera.bottom = lightBounds.min.y - padding; camera.top = lightBounds.max.y + padding;
    camera.near = Math.max(.1, -lightBounds.max.z - padding * 2);
    camera.far = Math.max(camera.near + 1, -lightBounds.min.z + padding * 2);
    const galleryFar = camera.far;
    state.groundReceiverBounds = null;
    // The exterior ground is a receiver owned by a separate runtime component.
    // Directional rays retain their light-space XY coordinates: including the
    // pad in the lateral fit would waste the existing gallery shadow detail.
    // Only extend depth so projected shadows can reach its lower surface.
    const receiverPositions = groundReceiver?.geometry?.getAttribute('position');
    if (receiverPositions && isVisible(groundReceiver)) {
      groundReceiverBounds.setFromBufferAttribute(receiverPositions).applyMatrix4(groundReceiver.matrixWorld);
      if (!groundReceiverBounds.isEmpty()) {
        state.groundReceiverBounds = { min: groundReceiverBounds.min.toArray(), max: groundReceiverBounds.max.toArray() };
        for (const x of [groundReceiverBounds.min.x, groundReceiverBounds.max.x])
          for (const y of [groundReceiverBounds.min.y, groundReceiverBounds.max.y])
            for (const z of [groundReceiverBounds.min.z, groundReceiverBounds.max.z]) {
              corner.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
              camera.far = Math.max(camera.far, -corner.z + padding * 2);
            }
      }
    }
    state.groundReceiverFarExtension = camera.far - galleryFar;
    camera.updateProjectionMatrix();
    state.fitCount++; state.boundsInstanceCount = instances;
    state.shadowBounds = {
      world: { min: worldBounds.min.toArray(), max: worldBounds.max.toArray() },
      left: camera.left, right: camera.right, bottom: camera.bottom, top: camera.top,
      near: camera.near, far: camera.far, floorY, padding,
    };
  }
  function setQuality() {
    const quality = getGalleryQuality(renderer.domElement);
    const size = Math.min(quality.shadowMapSize, renderer.capabilities.maxTextureSize);
    if (size === state.mapSize) return;
    state.mapSize = size; shadow.mapSize.set(size, size);
    shadow.map?.setSize(size, size); shadow.mapPass?.setSize(size, size);
    dirty = true;
  }
  function updateReceiverBias() {
    const camera = shadow.camera;
    const worldTexel = Math.max(camera.right - camera.left, camera.top - camera.bottom) / state.mapSize;
    // The HDR sun is low above the horizon. A room-wide PCF map needs a small
    // receiver offset proportional to its world texel size; the old sculpture-
    // sized fixed offset produced diagonal self-shadow stripes on smooth walls.
    // Keep depth bias small to avoid shifting contacts along the grazing rays.
    shadow.normalBias = THREE.MathUtils.clamp(worldTexel * 3, .012, .12);
    state.normalBias = shadow.normalBias;
  }
  function reconcileFlags() {
    const globalActive = state.enabled && state.intensity > 0;
    const dActive = isDActive(), wireAmount = strength('wireframe'), glassAmount = strength('caustics');
    // The spotlight shares the same scene geometry. Disabling sunlight shadows
    // must not make opaque walls/roof supports transparent to that spotlight.
    const sceneShadowsActive = globalActive || dActive;
    let casters = 0, receivers = 0, casterInstances = 0, visibleMeshes = 0;
    for (const [mesh, saved] of originals) {
      const visible = isVisible(mesh);
      const amount = bMeshes.has(mesh) ? wireAmount : fMeshes.has(mesh) ? glassAmount : 0;
      const fading = bMeshes.has(mesh) || fMeshes.has(mesh);
      let casts = sceneShadowsActive ? visible && opaqueCasters.has(mesh) : saved.castShadow;
      if (fading && amount === 1) casts = false;
      const receives = saved.receiveShadow || (sceneShadowsActive && visible);
      if (mesh.castShadow !== casts) { mesh.castShadow = casts; dirty = true; }
      mesh.receiveShadow = receives;
      if (sceneShadowsActive && fading && amount > 0 && amount < 1) {
        const depth = ensureFadeDepth(mesh);
        depth.opacity = 1 - amount;
        depth.userData.shadowFade.value = 1 - amount;
        if (mesh.customDepthMaterial !== depth) { mesh.customDepthMaterial = depth; dirty = true; }
      } else restoreFadeDepth(mesh);
      casters += Number(casts); receivers += Number(receives);
      casterInstances += casts ? (mesh.isInstancedMesh ? mesh.count : 1) : 0;
      visibleMeshes += Number(visible);
    }
    state.casterCount = casters; state.receiverCount = receivers;
    state.casterInstances = casterInstances; state.visibleMeshCount = visibleMeshes;
    key.castShadow = globalActive || originalKey.castShadow;
    renderer.shadowMap.enabled = originalRenderer.enabled || globalActive || dActive;
    renderer.shadowMap.type = globalActive || dActive ? THREE.PCFShadowMap : originalRenderer.type;
  }
  function configure(options = {}) {
    if (disposed) return false;
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('Invalid shadow settings.');
    for (const [name, value] of Object.entries(options)) {
      if (name === 'enabled') { if (state.enabled !== Boolean(value)) dirty = true; state.enabled = Boolean(value); }
      else if (name === 'intensity' || name === 'softness') {
        if (!Number.isFinite(value)) throw new Error(`Shadow ${name} must be finite.`);
        state[name] = THREE.MathUtils.clamp(value, name === 'intensity' ? 0 : .5, name === 'intensity' ? 1 : 5);
      } else throw new Error(`Unknown shadow setting: ${name}`);
    }
    shadow.intensity = state.intensity; shadow.radius = state.softness;
    return true;
  }
  let lastUpdate = -Infinity;
  function update() {
    if (disposed) return;
    const now = performance.now();
    if (getGalleryQuality(renderer.domElement).mobile && now - lastUpdate < 50) return;
    lastUpdate = now;
    setQuality();
    // Update matrices before reading the signature: UI visibility/transform edits
    // must affect the shadow in this frame, not one renderer update later.
    galleryModel.updateWorldMatrix(true, true); sculptureModel.updateWorldMatrix(true, true);
    groundReceiver?.updateWorldMatrix(true, false);
    key.updateWorldMatrix(true, false); key.target.updateWorldMatrix(true, false);
    const receiverSignature = groundReceiver ? [Number(isVisible(groundReceiver)), ...groundReceiver.matrixWorld.elements,
      groundReceiver.geometry?.uuid ?? '', groundReceiver.geometry?.getAttribute('position')?.version ?? 0] : [];
    const matrixSignature = [key.matrixWorld.elements, key.target.matrixWorld.elements,
      receiverSignature,
      ...allMeshes.map(mesh => [Number(isVisible(mesh)), ...mesh.matrixWorld.elements,
        mesh.isInstancedMesh ? mesh.instanceMatrix.version : 0, mesh.isInstancedMesh ? mesh.count : 1])].flat().join(',');
    if (matrixSignature !== previousMatrixSignature) {
      previousMatrixSignature = matrixSignature; fitShadow(); dirty = true;
    }
    updateReceiverBias();
    const deform = strength('deform');
    const globalActive = state.enabled && state.intensity > 0;
    const signature = [state.enabled, globalActive, strength('wireframe'), strength('caustics'), deform,
      effects.settings?.deform?.amount ?? 0, effects.enabled?.spotlight ?? false].join('|');
    if (signature !== previousSignature) { previousSignature = signature; dirty = true; }
    reconcileFlags();
    if ((globalActive || isDActive()) && deform > 0 && (effects.settings?.deform?.speed ?? 0) > 0) dirty = true;
    if (dirty && isDActive()) {
      // Its map is cached too: global policy can add/remove casters visible to D.
      const spotlight = scene.getObjectByName('runtime_D_spotlight');
      if (spotlight?.shadow) spotlight.shadow.needsUpdate = true;
    }
    if (globalActive && dirty) {
      if (!shadow.needsUpdate || state.updates === 0) state.updates++;
      shadow.needsUpdate = true;
    }
    dirty = false;
    state.ready = true;
  }
  function dispose() {
    if (disposed) return;
    const dActive = isDActive();
    for (const [mesh, saved] of originals) {
      mesh.castShadow = saved.castShadow || (dActive && dMeshes.has(mesh));
      mesh.receiveShadow = saved.receiveShadow || (dActive && (dMeshes.has(mesh) || floors.has(mesh)));
      restoreFadeDepth(mesh);
    }
    key.shadow = originalKey.shadow; key.castShadow = originalKey.castShadow;
    shadow.dispose();
    for (const depth of depthCopies.values()) depth.dispose();
    depthCopies.clear();
    renderer.shadowMap.enabled = originalRenderer.enabled || dActive;
    renderer.shadowMap.type = dActive ? THREE.PCFShadowMap : originalRenderer.type;
    disposed = true; state.disposed = true; state.ready = false;
  }
  update();
  return { state, configure, update, dispose };
}
