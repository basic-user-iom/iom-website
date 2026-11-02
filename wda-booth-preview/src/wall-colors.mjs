// Only explicitly supplied wall meshes are changed. A material name is never
// used to discover targets: the client also uses wall_paint on other details.
// Textures and geometry are shared read-only; only owned material clones mutate.
export function createWallColors({ meshes = [], onChange = () => {} } = {}) {
  const originals = new Map(), replacements = new Map(), defaultColors = new Map();
  const isPBR = material => material?.isMeshStandardMaterial || material?.isMeshPhysicalMaterial;
  function replacement(source) {
    if (replacements.has(source)) return replacements.get(source);
    const copy = source.clone();
    copy.name = `${source.name || 'wall'}_WDA_wall_color`;
    // Material.clone/copy intentionally omits these callbacks in Three.js.
    copy.onBeforeCompile = source.onBeforeCompile;
    copy.customProgramCacheKey = source.customProgramCacheKey;
    replacements.set(source, copy); defaultColors.set(copy, source.color.clone());
    return copy;
  }
  for (const mesh of new Set(meshes)) {
    if (!mesh?.isMesh) continue;
    const source = mesh.material, array = Array.isArray(source) ? source : [source];
    if (!array.some(isPBR)) continue;
    originals.set(mesh, source);
    mesh.material = Array.isArray(source)
      ? source.map(material => isPBR(material) ? replacement(material) : material)
      : replacement(source);
  }
  const firstColor = defaultColors.values().next().value;
  const state = {
    ready: originals.size > 0, disposed: false, meshCount: originals.size,
    materialCount: replacements.size, color: firstColor ? `#${firstColor.getHexString()}` : null,
    defaultColor: firstColor ? `#${firstColor.getHexString()}` : null,
    defaultColors: [...defaultColors.values()].map(color => `#${color.getHexString()}`),
    isDefault: true, mixed: false, changes: 0, errors: [],
  };
  function updateState() {
    const colors = [...defaultColors.keys()].map(material => `#${material.color.getHexString()}`);
    state.color = colors[0] ?? null; state.mixed = new Set(colors).size > 1;
    state.isDefault = [...defaultColors].every(([material, color]) => material.color.equals(color));
  }
  function notify() {
    try { onChange({ ...state, defaultColors: [...state.defaultColors], errors: [...state.errors] }); }
    catch (cause) { state.errors.push(`Wall color callback: ${cause?.message || cause}`); }
  }
  updateState();
  function setColor(hex) {
    if (!state.ready || state.disposed || typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return false;
    let changed = false;
    for (const material of defaultColors.keys()) {
      const before = material.color.clone();
      // Hex input is sRGB; Three.js converts to its linear working color space.
      material.color.set(hex);
      changed ||= !before.equals(material.color);
    }
    updateState();
    // A uniform color edit needs neither a shader compile nor new textures.
    if (changed) { state.changes++; notify(); }
    return true;
  }
  function reset() {
    if (!state.ready || state.disposed) return false;
    let changed = false;
    for (const [material, color] of defaultColors) {
      if (!material.color.equals(color)) { material.color.copy(color); changed = true; }
    }
    updateState();
    if (changed) { state.changes++; notify(); }
    return true;
  }
  function dispose() {
    if (state.disposed) return;
    for (const [mesh, original] of originals) mesh.material = original;
    for (const material of replacements.values()) material.dispose();
    originals.clear(); replacements.clear(); defaultColors.clear();
    state.color = state.defaultColor; state.isDefault = true;
    state.mixed = new Set(state.defaultColors).size > 1;
    state.disposed = true; state.ready = false;
    notify();
  }
  return { state, setColor, reset, dispose };
}
