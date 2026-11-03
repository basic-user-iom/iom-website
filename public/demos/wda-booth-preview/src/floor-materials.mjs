import * as THREE from 'three';

// Surface-only choices for the stable, contact-shaded floor materials. Install
// after contact; reflection.syncSurface() belongs in the caller's onChange.
// Textures are fetched only on selection. Source GLB textures are never owned.
const MAP_FIELDS = [
  'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap',
  'emissiveMap', 'alphaMap', 'lightMap', 'displacementMap',
  'specularIntensityMap', 'specularColorMap', 'clearcoatMap',
  'clearcoatNormalMap', 'clearcoatRoughnessMap', 'iridescenceMap',
  'iridescenceThicknessMap', 'sheenColorMap', 'sheenRoughnessMap',
  'transmissionMap', 'thicknessMap', 'anisotropyMap',
];
const VALUE_FIELDS = ['roughness', 'metalness', 'normalMapType'];
const VECTOR_FIELDS = ['color', 'normalScale'];

function snapshot(material) {
  const result = {};
  for (const field of [...MAP_FIELDS, ...VALUE_FIELDS]) if (field in material) result[field] = material[field];
  for (const field of VECTOR_FIELDS) if (material[field]?.clone) result[field] = material[field].clone();
  return result;
}
function restore(material, data) {
  for (const [field, value] of Object.entries(data)) {
    if (VECTOR_FIELDS.includes(field)) material[field].copy(value);
    else material[field] = value;
  }
  material.needsUpdate = true;
}

export function createFloorMaterials({ materials = [], variants = [], anisotropy = 1,
  loader = new THREE.TextureLoader(), onChange = () => {}, onStatus = () => {} } = {}) {
  const surfaces = [...new Set(materials)].filter(m => m?.isMeshStandardMaterial || m?.isMeshPhysicalMaterial);
  if (!surfaces.length) throw new TypeError('Floor materials require at least one stable PBR material.');
  const loadTexture = typeof loader === 'function' ? loader : loader?.loadAsync?.bind(loader);
  if (!loadTexture) throw new TypeError('Floor texture loader must be a function or expose loadAsync.');
  const choices = new Map();
  for (const variant of variants) {
    if (!variant?.id || variant.id === 'original' || choices.has(variant.id)) throw new TypeError('Floor variant IDs must be unique and cannot be original.');
    if (!['map', 'normalMap', 'roughnessMap'].every(field => typeof variant.maps?.[field] === 'string' && variant.maps[field])) {
      throw new TypeError(`Floor ${variant.id} needs color, normal, and roughness map URLs.`);
    }
    const repeat = variant.repeat ?? [1, 1], normalScale = variant.normalScale ?? [1, 1];
    if (repeat.length !== 2 || !repeat.every(v => Number.isFinite(v) && v > 0) ||
      normalScale.length !== 2 || !normalScale.every(Number.isFinite) ||
      (variant.roughness !== undefined && !Number.isFinite(variant.roughness)) ||
      (variant.metalness !== undefined && !Number.isFinite(variant.metalness))) {
      throw new TypeError(`Invalid floor scale or roughness: ${variant.id}`);
    }
    choices.set(variant.id, { ...variant, maps: { ...variant.maps }, repeat: [...repeat], normalScale: [...normalScale] });
  }
  anisotropy = Math.max(1, Math.floor(Number(anisotropy) || 1));
  const originals = new Map(surfaces.map(material => [material, snapshot(material)]));
  const protectedTextures = new Set([...originals.values()].flatMap(data => MAP_FIELDS.map(field => data[field])).filter(Boolean));
  const surfaceSnapshot = material => ({ metalness: material.metalness, roughness: material.roughness, normalScale: material.normalScale.clone() });
  let surfaceBaselines = new Map(surfaces.map(material => [material, surfaceSnapshot(material)]));
  const defaults = () => ({ metalness: surfaces[0].metalness, roughness: surfaces[0].roughness, normalStrength: 1 });
  const state = {
    active: 'original', requested: 'original', loading: false, disposed: false,
    errors: [], error: null, requests: 0, switches: 0,
    texturesLoaded: 0, texturesDisposed: 0, activeTextureCount: 0,
    surface: defaults(), surfaceDefaults: defaults(),
  };
  let generation = 0, activeTextures = new Set(), pending = null;
  function report() { return { ...state, errors: [...state.errors], surface: { ...state.surface }, surfaceDefaults: { ...state.surfaceDefaults } }; }
  function captureSurfaceDefaults() {
    surfaceBaselines = new Map(surfaces.map(material => [material, surfaceSnapshot(material)]));
    state.surfaceDefaults = defaults(); state.surface = { ...state.surfaceDefaults };
  }
  function error(message) {
    state.error = String(message); state.errors.push(state.error);
    if (state.errors.length > 12) state.errors.shift();
  }
  function status() {
    try { onStatus(report()); } catch (cause) { error(`Floor status callback: ${cause.message || cause}`); }
  }
  function release(textures) {
    for (const texture of new Set(textures)) {
      if (!texture?.isTexture || protectedTextures.has(texture) || activeTextures.has(texture)) continue;
      texture.dispose(); state.texturesDisposed++;
    }
  }
  function applyOriginal() { for (const [material, data] of originals) restore(material, data); }
  function applyVariant(variant, maps) {
    for (const material of surfaces) {
      for (const field of MAP_FIELDS) if (field in material) material[field] = null;
      Object.assign(material, maps);
      material.color.set(variant.color ?? 0xffffff);
      material.roughness = THREE.MathUtils.clamp(variant.roughness ?? 1, 0, 1);
      material.metalness = THREE.MathUtils.clamp(variant.metalness ?? 0, 0, 1); material.normalMapType = THREE.TangentSpaceNormalMap;
      material.normalScale.fromArray(variant.normalScale); material.needsUpdate = true;
    }
  }
  function commit(id, variant, maps, textures) {
    const before = new Map(surfaces.map(material => [material, snapshot(material)]));
    const previousTextures = activeTextures, previousID = state.active;
    const previousBaselines = surfaceBaselines, previousSurface = state.surface, previousDefaults = state.surfaceDefaults;
    try {
      if (id === 'original') applyOriginal(); else applyVariant(variant, maps);
      state.active = id; state.activeTextureCount = textures.size;
      captureSurfaceDefaults();
      // Reflection clones must release their old references before disposal.
      onChange(report());
      activeTextures = textures;
      release(previousTextures); state.switches++; return true;
    } catch (cause) {
      for (const [material, data] of before) restore(material, data);
      state.active = previousID; state.activeTextureCount = previousTextures.size;
      surfaceBaselines = previousBaselines; state.surface = previousSurface; state.surfaceDefaults = previousDefaults;
      try { onChange(report()); } catch { /* Preserve the actual failure below. */ }
      activeTextures = previousTextures; release(textures);
      error(`Floor switch failed: ${cause.message || cause}`); return false;
    }
  }
  async function select(id) {
    if (state.disposed) return false;
    if (id !== 'original' && !choices.has(id)) {
      error(`Unknown floor material: ${id}`); status(); return false;
    }
    if (state.loading && state.requested === id) return pending;
    const ticket = ++generation;
    state.requested = id; state.error = null;
    if (id === state.active) {
      state.loading = false; status(); return true;
    }
    if (id === 'original') {
      state.loading = false;
      const success = commit(id, null, null, new Set()); status(); return success;
    }
    const variant = choices.get(id);
    state.loading = true; state.requests++; status();
    pending = (async () => {
      const fields = ['map', 'normalMap', 'roughnessMap'];
      // Wait for every sibling even if one fails, so successful late arrivals
      // cannot leak after a partial failure or superseding user selection.
      const results = await Promise.allSettled(fields.map(field => Promise.resolve().then(() => loadTexture(variant.maps[field]))));
      const arrived = results.filter(r => r.status === 'fulfilled').map(r => r.value);
      state.texturesLoaded += arrived.length;
      const failure = results.find(r => r.status === 'rejected');
      if (state.disposed || ticket !== generation) { release(arrived); return false; }
      if (failure || arrived.some(texture => !texture?.isTexture)) {
        release(arrived.filter(texture => texture?.isTexture));
        state.loading = false; error(`Could not load ${variant.label || id}: ${failure?.reason?.message || failure?.reason || 'Invalid texture'}`);
        status(); return false;
      }
      // A custom loader may return cached source/active maps. Clone those before
      // configuring: neither original GLB maps nor the visible choice may mutate.
      const maps = {}, textures = new Set(), seen = new Set();
      for (let i = 0; i < fields.length; i++) {
        const raw = arrived[i];
        const texture = protectedTextures.has(raw) || activeTextures.has(raw) || seen.has(raw) ? raw.clone() : raw;
        seen.add(raw); textures.add(texture);
        texture.name = `WDA_floor_${id}_${fields[i]}`;
        texture.flipY = false; texture.colorSpace = fields[i] === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.channel = 0; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.fromArray(variant.repeat); texture.offset.set(0, 0); texture.center.set(0, 0); texture.rotation = 0;
        texture.matrixAutoUpdate = true; texture.anisotropy = anisotropy; texture.needsUpdate = true;
        maps[fields[i]] = texture;
      }
      state.loading = false;
      const success = commit(id, variant, maps, textures); status(); return success;
    })();
    return pending;
  }
  // Uniform-only edits: map references, feature flags, shader hooks and material
  // versions stay unchanged. Normal strength multiplies each preset's signed
  // normalScale so an original Y orientation is never accidentally flipped.
  function editSurface(values, reset = false) {
    const before = new Map(surfaces.map(material => [material, surfaceSnapshot(material)]));
    const previousSurface = state.surface;
    let changed = false;
    for (const material of surfaces) {
      const baseline = surfaceBaselines.get(material);
      for (const field of ['metalness', 'roughness']) if (reset || field in values) {
        const value = reset ? baseline[field] : values[field];
        if (material[field] !== value) { material[field] = value; changed = true; }
      }
      if (reset || 'normalStrength' in values) {
        const strength = reset ? 1 : values.normalStrength;
        const x = baseline.normalScale.x * strength, y = baseline.normalScale.y * strength;
        if (material.normalScale.x !== x || material.normalScale.y !== y) {
          material.normalScale.set(x, y); changed = true;
        }
      }
    }
    state.surface = { metalness: surfaces[0].metalness, roughness: surfaces[0].roughness,
      normalStrength: reset ? 1 : values.normalStrength ?? state.surface.normalStrength };
    state.error = null;
    if (changed) {
      try { onChange(report()); }
      catch (cause) {
        for (const [material, saved] of before) {
          material.metalness = saved.metalness; material.roughness = saved.roughness;
          material.normalScale.copy(saved.normalScale);
        }
        state.surface = previousSurface;
        try { onChange(report()); } catch { /* Preserve the actual failure. */ }
        error(`Floor surface update failed: ${cause.message || cause}`); status(); return false;
      }
    }
    status(); return true;
  }
  function setSurface(options = {}) {
    if (state.disposed || state.loading || !options || typeof options !== 'object') return false;
    const values = {};
    for (const field of ['metalness', 'roughness', 'normalStrength']) if (field in options) {
      if (!Number.isFinite(options[field])) return false;
      values[field] = THREE.MathUtils.clamp(options[field], 0, field === 'normalStrength' ? 2 : 1);
    }
    if (!Object.keys(values).length) return false;
    return editSurface(values);
  }
  function resetSurface() {
    if (state.disposed) return false;
    // Reset operates on the visible floor; it cancels a pending selection while
    // letting the loader safely dispose any maps that arrive afterwards.
    generation++; pending = null; state.loading = false; state.requested = state.active;
    return editSurface({}, true);
  }
  function getSurface() { return { ...state.surface }; }
  function dispose() {
    if (state.disposed) return;
    generation++; state.loading = false; state.requested = 'original';
    applyOriginal(); state.active = 'original'; state.activeTextureCount = 0;
    captureSurfaceDefaults();
    // Keep the same order as normal switching for composed reflection clones.
    try { onChange(report()); } catch (cause) { error(`Floor restore failed: ${cause.message || cause}`); }
    const previousTextures = activeTextures; activeTextures = new Set(); release(previousTextures);
    state.disposed = true; status();
  }
  return { state, select, setSurface, resetSurface, getSurface, dispose };
}
