import * as THREE from 'three';

// Static, local contact occlusion from the imported geometry. This is a CPU
// height-band raster, not an extra light, GPU bake, or screen-space effect.
// Install before createBoothReflections; dispose reflections before contact.

const clamp = THREE.MathUtils.clamp;
const EPS = 1e-8;

function visible(mesh) {
  for (let node = mesh; node; node = node.parent) if (!node.visible) return false;
  return true;
}

function solid(material) {
  return material && material.visible !== false && material.opacity >= 0.9 && !(material.transmission > 0.5);
}

function clipHeight(polygon, height, above) {
  const result = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const insideA = above ? a.y >= height : a.y <= height;
    const insideB = above ? b.y >= height : b.y <= height;
    if (insideA) result.push(a);
    if (insideA !== insideB) result.push(a.clone().lerp(b, (height - a.y) / (b.y - a.y)));
  }
  return result;
}

function triangleRanges(mesh) {
  const geometry = mesh.geometry;
  const count = geometry.index?.count ?? geometry.getAttribute('position').count;
  const start = Math.max(0, geometry.drawRange.start);
  const end = Math.min(count, start + geometry.drawRange.count);
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const groups = Array.isArray(mesh.material) ? geometry.groups : [{ start: 0, count, materialIndex: 0 }];
  return groups.filter(g => solid(materials[g.materialIndex ?? 0])).map(g => [
    Math.max(start, g.start), Math.min(end, g.start + g.count),
  ]);
}

function lowTriangles(casters, floorY, maxHeight, floorBounds, state) {
  const result = [], point = new THREE.Vector3(), box = new THREE.Box3();
  const lower = floorY - 0.003, upper = floorY + maxHeight;
  state.casterMeshes = 0; state.nearFloorTriangles = 0;
  for (const mesh of casters) {
    if (!visible(mesh) || mesh.isSkinnedMesh || mesh.isInstancedMesh) continue;
    mesh.updateWorldMatrix(true, false);
    box.setFromBufferAttribute(mesh.geometry.getAttribute('position')).applyMatrix4(mesh.matrixWorld);
    if (box.max.y < lower || box.min.y > upper || box.max.x < floorBounds.min.x || box.min.x > floorBounds.max.x ||
      box.max.z < floorBounds.min.z || box.min.z > floorBounds.max.z) continue;
    let used = false;
    for (const [start, end] of triangleRanges(mesh)) for (let i = start; i + 2 < end; i += 3) {
      const triangle = [];
      for (let j = 0; j < 3; j++) {
        const index = mesh.geometry.index ? mesh.geometry.index.getX(i + j) : i + j;
        mesh.getVertexPosition(index, point);
        triangle.push(point.clone().applyMatrix4(mesh.matrixWorld));
      }
      if (triangle.some(p => !Number.isFinite(p.x + p.y + p.z))) continue;
      if (Math.min(...triangle.map(p => p.y)) > upper || Math.max(...triangle.map(p => p.y)) < lower) continue;
      let polygon = clipHeight(triangle, lower, true);
      polygon = clipHeight(polygon, upper, false);
      if (polygon.length < 3) continue;
      state.nearFloorTriangles++; used = true;
      for (let j = 1; j < polygon.length - 1; j++) result.push([polygon[0], polygon[j], polygon[j + 1]]);
    }
    if (used) state.casterMeshes++;
  }
  return result;
}

function gaussianBlur(input, size, radiusX, radiusZ) {
  const scratch = new Float32Array(input.length), result = new Float32Array(input.length);
  function pass(source, target, radius, horizontal) {
    const sigma = Math.max(0.65, radius / 2.5), weights = [];
    let total = 0;
    for (let i = -radius; i <= radius; i++) { const w = Math.exp(-i * i / (2 * sigma * sigma)); weights.push(w); total += w; }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const sx = horizontal ? x + k : x, sy = horizontal ? y : y + k;
        // Outside is clear. Never replicate an occupied border texel.
        if (sx >= 0 && sx < size && sy >= 0 && sy < size) sum += source[sy * size + sx] * weights[k + radius];
      }
      target[y * size + x] = sum / total;
    }
  }
  pass(input, scratch, radiusX, true); pass(scratch, result, radiusZ, false);
  return result;
}

function raster(triangles, size, bounds, floorY, maxHeight, state) {
  const mask = new Float32Array(size * size), sx = size / (bounds.maxX - bounds.minX), sz = size / (bounds.maxZ - bounds.minZ);
  const attenuation = y => Math.pow(1 - clamp((y - floorY) / maxHeight, 0, 1), 2);
  const edge = (a, b, x, z) => (x - a.x) * (b.z - a.z) - (z - a.z) * (b.x - a.x);
  const put = (x, z, value) => { const index = z * size + x; mask[index] = Math.max(mask[index], value); };
  state.projectedTriangles = 0; state.degenerateSegments = 0;
  for (const triangle of triangles) {
    const t = triangle.map(p => ({ x: (p.x - bounds.minX) * sx - 0.5, z: (p.z - bounds.minZ) * sz - 0.5, y: p.y }));
    const [a, b, c] = t, area = edge(a, b, c.x, c.z);
    const minX = Math.max(0, Math.floor(Math.min(...t.map(p => p.x)) - 0.65));
    const maxX = Math.min(size - 1, Math.ceil(Math.max(...t.map(p => p.x)) + 0.65));
    const minZ = Math.max(0, Math.floor(Math.min(...t.map(p => p.z)) - 0.65));
    const maxZ = Math.min(size - 1, Math.ceil(Math.max(...t.map(p => p.z)) + 0.65));
    if (Math.abs(area) > EPS) state.projectedTriangles++;
    else state.degenerateSegments++;
    for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
      if (Math.abs(area) > EPS) {
        const wa = edge(b, c, x, z) / area, wb = edge(c, a, x, z) / area, wc = 1 - wa - wb;
        if (wa >= 0 && wb >= 0 && wc >= 0) put(x, z, attenuation(wa * a.y + wb * b.y + wc * c.y));
      }
      // Conservative subpixel coverage of actual mesh edges also retains open
      // vertical walls whose XZ projection is a line. No box edges are stamped.
      for (let j = 0; j < 3; j++) {
        const p = t[j], q = t[(j + 1) % 3], dx = q.x - p.x, dz = q.z - p.z;
        const length2 = dx * dx + dz * dz;
        const k = length2 > EPS ? clamp(((x - p.x) * dx + (z - p.z) * dz) / length2, 0, 1) : 0;
        const distance = Math.hypot(x - p.x - dx * k, z - p.z - dz * k);
        if (distance < 0.65) put(x, z, attenuation(p.y + (q.y - p.y) * k) * (1 - distance / 0.65));
      }
    }
  }
  return mask;
}

export function createFloorContact({ floors = [], casters = [], resolution = 512, maxHeight = 0.25,
  intensity = 0.28, radius = 0.07, enabled = true } = {}) {
  if (![resolution, maxHeight, intensity, radius].every(Number.isFinite)) throw new TypeError('Contact settings must be finite.');
  resolution = Math.round(clamp(resolution, 64, 512));
  maxHeight = clamp(maxHeight, 0.03, 0.35); radius = clamp(radius, 0.005, 0.12); intensity = clamp(intensity, 0, 0.6);
  const state = {
    ready: false, enabled: Boolean(enabled), dirty: true, disposed: false,
    method: 'Cached geometry height-band contact; floor indirect diffuse only',
    resolution, bufferSize: [resolution, resolution], intensity, maxHeight, radius,
    builds: 0, skippedUnchanged: 0, textureAllocations: 0, floorY: null, floorMeshes: 0,
    casterMeshes: 0, nearFloorTriangles: 0, projectedTriangles: 0, degenerateSegments: 0,
    bounds: null, texelMeters: [0, 0], blurRadiusTexels: [0, 0], occludedTexels: 0, maxOcclusion: 0,
    lastReason: 'initial', errors: [],
  };
  const originals = new Map(), replacements = new Map(), floorBounds = new THREE.Box3();
  for (const mesh of new Set(floors)) {
    if (!mesh?.isMesh || !mesh.geometry?.getAttribute('position')) continue;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!materials.every(m => m?.isMeshStandardMaterial || m?.isMeshPhysicalMaterial)) continue;
    mesh.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromBufferAttribute(mesh.geometry.getAttribute('position')).applyMatrix4(mesh.matrixWorld);
    if (box.max.y - box.min.y > 0.025 || (state.floorY !== null && Math.abs(box.max.y - state.floorY) > 0.025)) {
      state.errors.push(`Rejected non-coplanar contact floor: ${mesh.name || mesh.uuid}`); continue;
    }
    floorBounds.union(box); state.floorY = box.max.y; originals.set(mesh, mesh.material);
  }
  state.floorMeshes = originals.size; state.ready = originals.size > 0;
  if (!state.ready) { state.enabled = false; state.errors.push('No valid explicit horizontal PBR floor meshes.'); }
  const sources = [...new Set(casters)].filter(m => m?.isMesh && m.geometry?.getAttribute('position') && !originals.has(m));
  const uniforms = {
    wdaContactMap: { value: null }, wdaContactBounds: { value: new THREE.Vector4() },
    wdaContactStrength: { value: 0 }, wdaContactEdge: { value: 2 / resolution },
  };
  let texture = null;
  function replacement(source) {
    if (replacements.has(source)) return replacements.get(source);
    const copy = source.clone(), priorCompile = source.onBeforeCompile, priorKey = source.customProgramCacheKey;
    copy.name = `${source.name}_WDA_contact`;
    copy.onBeforeCompile = function (shader, renderer) {
      priorCompile.call(this, shader, renderer);
      if (!shader.vertexShader.includes('#include <project_vertex>') || !shader.fragmentShader.includes('#include <aomap_fragment>')) {
        throw new Error('Unsupported floor contact shader hooks.');
      }
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = 'varying vec2 wdaContactWorldXZ;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\nwdaContactWorldXZ=(modelMatrix*vec4(transformed,1.0)).xz;');
      shader.fragmentShader = `uniform sampler2D wdaContactMap; uniform vec4 wdaContactBounds;
        uniform float wdaContactStrength; uniform float wdaContactEdge; varying vec2 wdaContactWorldXZ;\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <aomap_fragment>', `
        #include <aomap_fragment>
        vec2 wdaContactUV=(wdaContactWorldXZ-wdaContactBounds.xy)*wdaContactBounds.zw;
        vec2 wdaContactFade=smoothstep(vec2(0.0),vec2(wdaContactEdge),wdaContactUV)
          *(1.0-smoothstep(vec2(1.0-wdaContactEdge),vec2(1.0),wdaContactUV));
        float wdaContactOcclusion=texture2D(wdaContactMap,clamp(wdaContactUV,0.0,1.0)).r
          *wdaContactFade.x*wdaContactFade.y*wdaContactStrength;
        reflectedLight.indirectDiffuse*=1.0-wdaContactOcclusion;`);
    };
    copy.customProgramCacheKey = () => `${priorKey.call(source)}|wda-contact-r180-v1`;
    replacements.set(source, copy); return copy;
  }
  for (const [mesh, original] of originals) mesh.material = Array.isArray(original) ? original.map(replacement) : replacement(original);
  function sync() { uniforms.wdaContactStrength.value = state.ready && state.enabled && texture ? state.intensity : 0; }
  function invalidate(reason = 'geometry-change') {
    if (state.disposed) return false;
    state.dirty = true; state.lastReason = String(reason); return true;
  }
  function set(options = {}) {
    if (state.disposed || !options || typeof options !== 'object') return false;
    if ('intensity' in options && !Number.isFinite(options.intensity)) return false;
    if ('enabled' in options) state.enabled = Boolean(options.enabled) && state.ready;
    if ('intensity' in options) state.intensity = clamp(options.intensity, 0, 0.6);
    sync(); return true;
  }
  function update(force = false) {
    if (state.disposed || !state.ready || !state.enabled) return false;
    if (!force && !state.dirty) { state.skippedUnchanged++; return false; }
    try {
      const triangles = lowTriangles(sources, state.floorY, state.maxHeight, floorBounds, state);
      const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
      for (const triangle of triangles) for (const point of triangle) {
        bounds.minX = Math.min(bounds.minX, point.x); bounds.maxX = Math.max(bounds.maxX, point.x);
        bounds.minZ = Math.min(bounds.minZ, point.z); bounds.maxZ = Math.max(bounds.maxZ, point.z);
      }
      // Ample clear padding isolates the normalized texture edge from contacts.
      // Scope follows low geometry, never the 50 m imported background floor.
      const padding = Math.max(0.16, state.radius * 3);
      if (!triangles.length) Object.assign(bounds, { minX: -padding, maxX: padding, minZ: -padding, maxZ: padding });
      else { bounds.minX -= padding; bounds.maxX += padding; bounds.minZ -= padding; bounds.maxZ += padding; }
      state.bounds = bounds;
      state.texelMeters = [(bounds.maxX - bounds.minX) / resolution, (bounds.maxZ - bounds.minZ) / resolution];
      state.blurRadiusTexels = state.texelMeters.map(v => clamp(Math.ceil(state.radius / v), 1, 8));
      const mask = raster(triangles, resolution, bounds, state.floorY, state.maxHeight, state);
      const soft = gaussianBlur(mask, resolution, ...state.blurRadiusTexels);
      const pixels = new Uint8Array(soft.length); state.occludedTexels = 0; state.maxOcclusion = 0;
      for (let i = 0; i < pixels.length; i++) {
        pixels[i] = Math.round(clamp(soft[i], 0, 1) * 255);
        if (pixels[i]) state.occludedTexels++;
        state.maxOcclusion = Math.max(state.maxOcclusion, pixels[i] / 255);
      }
      if (!texture) {
        texture = new THREE.DataTexture(pixels, resolution, resolution, THREE.RedFormat, THREE.UnsignedByteType);
        texture.name = 'WDA_geometry_floor_contact'; texture.colorSpace = THREE.NoColorSpace;
        texture.minFilter = texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false;
        texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping; texture.flipY = false;
        state.textureAllocations++;
      } else texture.image.data = pixels;
      texture.needsUpdate = true;
      uniforms.wdaContactMap.value = texture;
      uniforms.wdaContactBounds.value.set(bounds.minX, bounds.minZ, 1 / (bounds.maxX - bounds.minX), 1 / (bounds.maxZ - bounds.minZ));
      state.builds++; state.dirty = false; sync(); return true;
    } catch (error) {
      state.errors.push(String(error?.message || error)); state.enabled = false; sync(); return false;
    }
  }
  function dispose() {
    if (state.disposed) return;
    uniforms.wdaContactStrength.value = 0;
    for (const [mesh, original] of originals) mesh.material = original;
    for (const material of replacements.values()) material.dispose();
    texture?.dispose(); replacements.clear();
    state.disposed = true; state.ready = false; state.enabled = false;
  }
  return { state, set, update, invalidate, dispose };
}
