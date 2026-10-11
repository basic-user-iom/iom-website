import * as THREE from 'three';

/** Runtime roof reveal. Source geometry, textures and material objects are borrowed. */
export function createGalleryRoof({ galleryModel, scene, onChange = () => {} }) {
  if (!galleryModel || !scene) throw new Error('Roof control requires the gallery and scene.');
  const groups = [], meshes = new Map(), materialCopies = new Map();
  galleryModel.traverse(object => {
    if (object.name === 'roof_structure' || object.name === 'roof_glazing') groups.push(object);
  });
  const groupVisibility = new Map(groups.map(group => [group, group.visible]));
  for (const group of groups) group.traverse(mesh => {
    if (!mesh.isMesh || meshes.has(mesh)) return;
    meshes.set(mesh, {
      material: mesh.material,
      depth: mesh.customDepthMaterial,
      distance: mesh.customDistanceMaterial,
      depthCopy: null,
      distanceCopy: null,
    });
  });
  const state = {
    amount: groups.some(group => group.visible) ? 1 : 0,
    visible: groups.some(group => group.visible),
    fading: false,
    revision: 0,
    groupNames: groups.map(group => group.name),
    meshCount: meshes.size,
    materialCopies: 0,
    disposed: false,
  };
  const coverage = { value: 1 };

  function surfaceCopy(material) {
    if (!materialCopies.has(material)) {
      const copy = material.clone();
      copy.name = `${material.name}_runtime_roof_fade`;
      copy.onBeforeCompile = material.onBeforeCompile;
      copy.customProgramCacheKey = material.customProgramCacheKey.bind(material);
      // Opaque pieces use stable stochastic coverage and continue writing depth.
      // Existing glazing keeps its transparent blend and simply loses opacity.
      if (!material.transparent) { copy.alphaHash = true; copy.transparent = false; }
      materialCopies.set(material, copy);
      state.materialCopies = materialCopies.size;
    }
    return materialCopies.get(material);
  }

  function shadowCopy(mesh, saved, distance) {
    const key = distance ? 'distanceCopy' : 'depthCopy';
    if (saved[key]) return saved[key];
    const source = distance ? saved.distance : saved.depth;
    const material = Array.isArray(saved.material) ? saved.material[0] : saved.material;
    const copy = source?.clone() ?? (distance
      ? new THREE.MeshDistanceMaterial()
      : new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
    copy.name = `${mesh.name}_runtime_roof_${distance ? 'distance' : 'depth'}`;
    copy.alphaHash = true;
    copy.transparent = false;
    if (!source && material) {
      copy.map = material.map;
      copy.alphaMap = material.alphaMap;
      copy.alphaTest = material.alphaTest;
      copy.side = material.side;
      copy.displacementMap = material.displacementMap;
      copy.displacementScale = material.displacementScale;
      copy.displacementBias = material.displacementBias;
    }
    const originalCompile = source?.onBeforeCompile;
    const originalCacheKey = source?.customProgramCacheKey?.bind(source);
    copy.onBeforeCompile = (shader, renderer) => {
      originalCompile?.call(copy, shader, renderer);
      shader.uniforms.iomRoofCoverage = coverage;
      shader.fragmentShader = 'uniform float iomRoofCoverage;\n' + shader.fragmentShader;
      // RGB-packed depth does not otherwise consume Material.opacity.
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphahash_fragment>',
        'diffuseColor.a *= iomRoofCoverage;\n#include <alphahash_fragment>');
    };
    copy.customProgramCacheKey = () => `${originalCacheKey?.() ?? ''}|iom-roof-shadow-fade-v1`;
    saved[key] = copy;
    return copy;
  }

  function invalidateShadows() {
    scene.traverse(object => { if (object.isLight && object.shadow) object.shadow.needsUpdate = true; });
  }

  function setAmount(value) {
    if (state.disposed) return false;
    if (!Number.isFinite(value)) throw new Error('Roof visibility must be finite.');
    const amount = THREE.MathUtils.clamp(value, 0, 1), fading = amount > 0 && amount < 1;
    if (amount === state.amount && state.revision > 0) return true;
    coverage.value = amount;
    for (const group of groups) group.visible = amount > 0;
    for (const [mesh, saved] of meshes) {
      if (fading) {
        const materials = Array.isArray(saved.material) ? saved.material : [saved.material];
        const copies = materials.map(material => {
          const copy = surfaceCopy(material);
          copy.opacity = material.opacity * amount;
          return copy;
        });
        mesh.material = Array.isArray(saved.material) ? copies : copies[0];
        mesh.customDepthMaterial = shadowCopy(mesh, saved, false);
        mesh.customDistanceMaterial = shadowCopy(mesh, saved, true);
      } else {
        mesh.material = saved.material;
        mesh.customDepthMaterial = saved.depth;
        mesh.customDistanceMaterial = saved.distance;
      }
      // The gallery shadow manager owns castShadow / receiveShadow. Keeping
      // those flags untouched allows its opaque-source policy to stay valid.
    }
    state.amount = amount;
    state.visible = amount > 0;
    state.fading = fading;
    state.revision++;
    invalidateShadows();
    onChange(amount);
    return true;
  }

  function capture() { return { amount: state.amount }; }
  function restore(snapshot) {
    if (!snapshot || !Number.isFinite(snapshot.amount)) throw new Error('Invalid roof snapshot.');
    return setAmount(snapshot.amount);
  }
  function dispose() {
    if (state.disposed) return;
    for (const [mesh, saved] of meshes) {
      mesh.material = saved.material;
      mesh.customDepthMaterial = saved.depth;
      mesh.customDistanceMaterial = saved.distance;
      saved.depthCopy?.dispose();
      saved.distanceCopy?.dispose();
    }
    for (const [group, visible] of groupVisibility) group.visible = visible;
    for (const material of materialCopies.values()) material.dispose();
    materialCopies.clear();
    state.materialCopies = 0;
    state.disposed = true;
    state.fading = false;
    invalidateShadows();
  }
  return { state, setAmount, getAmount: () => state.amount, capture, restore, dispose };
}
