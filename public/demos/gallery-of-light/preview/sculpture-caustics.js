import * as THREE from 'three';

/** A bounded, cached two-surface photon projection for the F1 glass study.
 * Samples the actual sculpture and its smooth normals. Snell refraction is traced
 * on the CPU only when IOR changes, not during animation. This approximates a
 * single local light, without dispersion, internal bounces or global transport.
 * All acceleration data, textures and geometry belong to this runtime helper.
 */
export function createSculptureCaustics({ stoneMeshes, opaqueMeshes, floorY, floorBounds, light, runtime, ior = 1.45 }) {
  const resolution = 384, sampleSide = 256;
  const state = {
    method: 'Cached geometry-sampled two-surface refraction, with opaque-pedestal blocking; approximate single-light floor projection.',
    samples: sampleSide * sampleSide, surfaceSamples: 0, tracedRays: 0, floorHits: 0,
    blockedByPedestal: 0, missedExit: 0, totalInternalReflection: 0,
    rebuilds: 0, buildMilliseconds: 0, textureSize: resolution,
    ior, requestedIOR: ior, pending: false, footprint: null, disposed: false,
    compositing: 'Bounded additive incident-light approximation; concentrated density, no tiled or animated water pattern.',
  };
  const bounds = new THREE.Box3();
  const blockers = opaqueMeshes.map(mesh => {
    mesh.updateWorldMatrix(true, false);
    return new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position).applyMatrix4(mesh.matrixWorld);
  });
  const trianglePositions = [], triangleNormals = [];
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const n = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (const mesh of stoneMeshes) {
    mesh.updateWorldMatrix(true, false);
    const geometry = mesh.geometry, positions = geometry.attributes.position, normals = geometry.attributes.normal;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    const count = geometry.index ? geometry.index.count : positions.count;
    for (let offset = 0; offset < count; offset += 3) {
      for (let corner = 0; corner < 3; corner++) {
        const index = geometry.index ? geometry.index.getX(offset + corner) : offset + corner;
        v[corner].fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld);
        bounds.expandByPoint(v[corner]);
        if (normals) n[corner].fromBufferAttribute(normals, index).applyMatrix3(normalMatrix).normalize();
      }
      if (!normals) {
        n[0].subVectors(v[1], v[0]).cross(new THREE.Vector3().subVectors(v[2], v[0])).normalize();
        n[1].copy(n[0]); n[2].copy(n[0]);
      }
      for (let corner = 0; corner < 3; corner++) {
        trianglePositions.push(v[corner].x, v[corner].y, v[corner].z);
        triangleNormals.push(n[corner].x, n[corner].y, n[corner].z);
      }
    }
  }
  const positions = new Float32Array(trianglePositions), normals = new Float32Array(triangleNormals);
  const triangleCount = positions.length / 9;
  const centers = new Float32Array(triangleCount * 3);
  for (let triangle = 0; triangle < triangleCount; triangle++) for (let axis = 0; axis < 3; axis++) {
    const i = triangle * 9 + axis;
    centers[triangle * 3 + axis] = (positions[i] + positions[i + 3] + positions[i + 6]) / 3;
  }
  function buildTree(indices) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    const cmin = [...min], cmax = [...max];
    for (const triangle of indices) for (let axis = 0; axis < 3; axis++) {
      const i = triangle * 9 + axis, c = centers[triangle * 3 + axis];
      min[axis] = Math.min(min[axis], positions[i], positions[i + 3], positions[i + 6]);
      max[axis] = Math.max(max[axis], positions[i], positions[i + 3], positions[i + 6]);
      cmin[axis] = Math.min(cmin[axis], c); cmax[axis] = Math.max(cmax[axis], c);
    }
    if (indices.length <= 12) return { min, max, indices };
    const extent = cmax.map((value, axis) => value - cmin[axis]);
    const axis = extent.indexOf(Math.max(...extent));
    indices.sort((a, b) => centers[a * 3 + axis] - centers[b * 3 + axis]);
    const split = indices.length >> 1;
    return { min, max, left: buildTree(indices.slice(0, split)), right: buildTree(indices.slice(split)) };
  }
  const tree = buildTree(Array.from({ length: triangleCount }, (_, index) => index));
  function boxDistance(min, max, origin, direction, limit) {
    let near = 0, far = limit;
    for (let axis = 0; axis < 3; axis++) {
      const o = origin.getComponent(axis), d = direction.getComponent(axis);
      if (Math.abs(d) < 1e-10) { if (o < min[axis] || o > max[axis]) return Infinity; continue; }
      let a = (min[axis] - o) / d, b = (max[axis] - o) / d;
      if (a > b) [a, b] = [b, a];
      near = Math.max(near, a); far = Math.min(far, b);
      if (far < near) return Infinity;
    }
    return near;
  }
  function blocked(origin, direction, distance) {
    return blockers.some(box => boxDistance(box.min.toArray(), box.max.toArray(), origin, direction, distance) < distance - 0.001);
  }
  function trace(origin, direction, limit = 30) {
    const pending = [tree]; let result = null, closest = limit;
    while (pending.length) {
      const node = pending.pop();
      if (boxDistance(node.min, node.max, origin, direction, closest) >= closest) continue;
      if (!node.indices) { pending.push(node.left, node.right); continue; }
      for (const triangle of node.indices) {
        const i = triangle * 9;
        const ax = positions[i], ay = positions[i + 1], az = positions[i + 2];
        const e1x = positions[i + 3] - ax, e1y = positions[i + 4] - ay, e1z = positions[i + 5] - az;
        const e2x = positions[i + 6] - ax, e2y = positions[i + 7] - ay, e2z = positions[i + 8] - az;
        const px = direction.y * e2z - direction.z * e2y, py = direction.z * e2x - direction.x * e2z, pz = direction.x * e2y - direction.y * e2x;
        const determinant = e1x * px + e1y * py + e1z * pz;
        if (Math.abs(determinant) < 1e-10) continue;
        const inverse = 1 / determinant, tx = origin.x - ax, ty = origin.y - ay, tz = origin.z - az;
        const u = (tx * px + ty * py + tz * pz) * inverse;
        if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
        const w = (direction.x * qx + direction.y * qy + direction.z * qz) * inverse;
        if (w < 0 || u + w > 1) continue;
        const distance = (e2x * qx + e2y * qy + e2z * qz) * inverse;
        if (distance <= 0.0003 || distance >= closest) continue;
        closest = distance; result = { triangle, distance, u, w };
      }
    }
    if (!result) return null;
    const i = result.triangle * 9, { u, w } = result, a = 1 - u - w;
    result.point = origin.clone().addScaledVector(direction, result.distance);
    result.normal = new THREE.Vector3(
      normals[i] * a + normals[i + 3] * u + normals[i + 6] * w,
      normals[i + 1] * a + normals[i + 4] * u + normals[i + 7] * w,
      normals[i + 2] * a + normals[i + 5] * u + normals[i + 8] * w,
    ).normalize();
    return result;
  }
  function refract(direction, normal, ratio) {
    const facing = normal.clone();
    if (facing.dot(direction) > 0) facing.negate();
    const cosine = -facing.dot(direction), k = 1 - ratio * ratio * (1 - cosine * cosine);
    return k < 0 ? null : direction.clone().multiplyScalar(ratio).addScaledVector(facing, ratio * cosine - Math.sqrt(k)).normalize();
  }
  const origin = light.getWorldPosition(new THREE.Vector3());
  state.lightPosition = origin.toArray();
  state.opaqueBounds = blockers.map(box => ({ min: box.min.toArray(), max: box.max.toArray() }));
  const center = bounds.getCenter(new THREE.Vector3()), direction = center.clone().sub(origin).normalize();
  const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, direction).normalize();
  let left = Infinity, bottom = Infinity, rightEdge = -Infinity, top = -Infinity;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const corner = new THREE.Vector3(x, y, z).sub(center);
    left = Math.min(left, corner.dot(right)); rightEdge = Math.max(rightEdge, corner.dot(right));
    bottom = Math.min(bottom, corner.dot(up)); top = Math.max(top, corner.dot(up));
  }
  // Cache entry intersections. IOR changes only require tracing the internal ray.
  const entries = [];
  for (let y = 0; y < sampleSide; y++) for (let x = 0; x < sampleSide; x++) {
    // Deterministic stratification prevents a regular projected sampling grid.
    const jitterX = ((x * 73 + y * 199) % 997) / 997;
    const jitterY = ((x * 269 + y * 47) % 991) / 991;
    const aperture = center.clone().addScaledVector(right, left + (x + jitterX) / sampleSide * (rightEdge - left))
      .addScaledVector(up, bottom + (y + jitterY) / sampleSide * (top - bottom));
    const incoming = aperture.sub(origin).normalize(), entry = trace(origin, incoming);
    if (!entry || blocked(origin, incoming, entry.distance)) continue;
    // Schlick transmission at entrance; no invented luminance on missed geometry.
    entry.incoming = incoming;
    entry.cosine = Math.abs(incoming.dot(entry.normal));
    entries.push(entry);
  }
  state.surfaceSamples = entries.length;
  const data = new Uint8Array(resolution * resolution * 4);
  const texture = new THREE.DataTexture(data, resolution, resolution, THREE.RGBAFormat);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.NoColorSpace;
  const uniforms = { uCausticMap: { value: texture }, uTime: { value: 0 }, uIntensity: { value: 0 }, uOpticalContrast: { value: 1 } };
  const material = new THREE.ShaderMaterial({
    name: 'runtime_F001_geometry_sampled_caustic', uniforms,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D uCausticMap;
      uniform float uIntensity;
      uniform float uTime;
      uniform float uOpticalContrast;
      varying vec2 vUv;
      void main() {
        float flux = texture2D(uCausticMap, vUv).r;
        // Only a subtle source fluctuation: a solid sculpture is not moving water.
        float shimmer = 0.985 + 0.015 * cos(uTime * 0.7);
        // A caustic adds concentrated incident light; alpha-over would replace
        // the textured floor with a faint blue wash, lost under the evening sky.
        // Suppress the low-density tail while retaining the traced ray ridges.
        float focusedFlux = pow(flux, 1.5);
        float alpha = clamp(focusedFlux * uIntensity * uOpticalContrast * 0.65 * shimmer, 0.0, 0.55);
        if (alpha < 0.0001) discard;
        gl_FragColor = vec4(vec3(0.78, 0.89, 1.0), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    side: THREE.FrontSide, toneMapped: false,
  });
  const geometry = new THREE.PlaneGeometry(1, 1);
  const projection = new THREE.Mesh(geometry, material);
  projection.name = 'runtime_F001_caustic_floor_projection';
  projection.rotation.x = -Math.PI / 2;
  projection.renderOrder = 2; projection.visible = false;
  projection.userData.approximation = true;
  projection.userData.caustics = state;
  runtime.add(projection);
  const nominal = center.clone().addScaledVector(direction, (floorY - center.y) / direction.y);
  const cache = new Map();
  let rebuildTimer = null;
  function rebuild(value) {
    const begin = performance.now(), hits = [];
    state.ior = value;
    state.blockedByPedestal = 0; state.missedExit = 0; state.totalInternalReflection = 0;
    const reflectance = Math.pow((value - 1) / (value + 1), 2);
    for (const entry of entries) {
      const internal = refract(entry.incoming, entry.normal, 1 / value);
      const exit = internal && trace(entry.point.clone().addScaledVector(internal, 0.0005), internal);
      if (!exit) { state.missedExit++; continue; }
      const outgoing = refract(internal, exit.normal, value);
      if (!outgoing) { state.totalInternalReflection++; continue; }
      if (outgoing.y > -0.12) continue;
      const distance = (floorY - exit.point.y) / outgoing.y;
      if (distance <= 0 || distance > 12) continue;
      if (blocked(entry.point, internal, exit.distance) || blocked(exit.point, outgoing, distance)) {
        state.blockedByPedestal++; continue;
      }
      const point = exit.point.clone().addScaledVector(outgoing, distance);
      if (blockers.some(box => point.x >= box.min.x - 0.025 && point.x <= box.max.x + 0.025 && point.z >= box.min.z - 0.025 && point.z <= box.max.z + 0.025)) {
        state.blockedByPedestal++; continue;
      }
      if (floorBounds && (point.x < floorBounds.min.x || point.x > floorBounds.max.x || point.z < floorBounds.min.z || point.z > floorBounds.max.z)) continue;
      // Limit grazing rays to the local exhibit instead of painting adjacent rooms.
      if (Math.hypot(point.x - nominal.x, point.z - nominal.z) > 3.25) continue;
      const entrance = 1 - (reflectance + (1 - reflectance) * Math.pow(1 - entry.cosine, 5));
      const exitCosine = Math.abs(internal.dot(exit.normal));
      const leaving = 1 - (reflectance + (1 - reflectance) * Math.pow(1 - exitCosine, 5));
      const weight = entrance * leaving * Math.exp(-exit.distance * 0.11);
      hits.push({ x: point.x, z: point.z, weight });
    }
    state.tracedRays = entries.length; state.floorHits = hits.length;
    const xs = hits.map(hit => hit.x).sort((a, b) => a - b), zs = hits.map(hit => hit.z).sort((a, b) => a - b);
    const quantile = (values, fraction, fallback) => values.length ? values[Math.floor((values.length - 1) * fraction)] : fallback;
    const footprint = {
      minX: quantile(xs, 0.01, nominal.x - 1) - 0.18, maxX: quantile(xs, 0.99, nominal.x + 1) + 0.18,
      minZ: quantile(zs, 0.01, nominal.z - 1) - 0.18, maxZ: quantile(zs, 0.99, nominal.z + 1) + 0.18,
    };
    const width = footprint.maxX - footprint.minX, depth = footprint.maxZ - footprint.minZ;
    const density = new Float32Array(resolution * resolution);
    const sigma = Math.max(1.15, 0.027 * resolution / Math.max(width, depth)), radius = Math.ceil(sigma * 2.5);
    for (const hit of hits) {
      const px = (hit.x - footprint.minX) / width * (resolution - 1);
      const py = (footprint.maxZ - hit.z) / depth * (resolution - 1);
      if (px < 0 || px >= resolution || py < 0 || py >= resolution) continue;
      for (let y = Math.max(0, Math.floor(py) - radius); y <= Math.min(resolution - 1, Math.ceil(py) + radius); y++) {
        for (let x = Math.max(0, Math.floor(px) - radius); x <= Math.min(resolution - 1, Math.ceil(px) + radius); x++) {
          const distance = ((x - px) ** 2 + (y - py) ** 2) / (2 * sigma * sigma);
          density[y * resolution + x] += hit.weight * Math.exp(-distance);
        }
      }
    }
    const positive = Array.from(density).filter(value => value > 0.005).sort((a, b) => a - b);
    const exposure = 1 / Math.max(0.5, quantile(positive, 0.985, 1));
    const bytes = new Uint8Array(data.length);
    for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
      const worldX = footprint.minX + x / (resolution - 1) * width;
      const worldZ = footprint.maxZ - y / (resolution - 1) * depth;
      const beneathOpaque = blockers.some(box => worldX >= box.min.x - 0.015 && worldX <= box.max.x + 0.015 && worldZ >= box.min.z - 0.015 && worldZ <= box.max.z + 0.015);
      const edge = Math.min(x, y, resolution - 1 - x, resolution - 1 - y) / 12;
      // Compress high concentration gently; retain narrow overlapping ray ridges.
      const flux = beneathOpaque ? 0 : Math.pow(1 - Math.exp(-density[y * resolution + x] * exposure * 1.7), 1.25) * Math.min(1, edge);
      const i = (y * resolution + x) * 4;
      bytes[i] = bytes[i + 1] = bytes[i + 2] = Math.round(flux * 255); bytes[i + 3] = 255;
    }
    state.rebuilds++; state.buildMilliseconds = Math.round((performance.now() - begin) * 10) / 10;
    const saved = { bytes, footprint, diagnostics: {
      floorHits: state.floorHits, blockedByPedestal: state.blockedByPedestal,
      missedExit: state.missedExit, totalInternalReflection: state.totalInternalReflection,
    } };
    cache.set(value, saved);
    if (cache.size > 5) cache.delete(cache.keys().next().value);
    return saved;
  }
  function applyIOR(key) {
    if (state.disposed) return;
    const saved = cache.get(key) ?? rebuild(key);
    state.ior = key; state.footprint = { ...saved.footprint }; Object.assign(state, saved.diagnostics);
    state.pending = false;
    // IOR 1 is optically neutral: do not invent focusing through invisible glass.
    uniforms.uOpticalContrast.value = Math.min(1, Math.max(0, (key - 1) * 5));
    data.set(saved.bytes); texture.needsUpdate = true;
    const f = saved.footprint;
    projection.scale.set(f.maxX - f.minX, f.maxZ - f.minZ, 1);
    projection.position.set((f.minX + f.maxX) / 2, floorY + 0.006, (f.minZ + f.maxZ) / 2);
  }
  function configure(value) {
    if (state.disposed) return;
    // Coalesce slider events; unchanged tour settings never schedule extra work.
    const key = Math.round(THREE.MathUtils.clamp(value, 1, 2) * 1000) / 1000;
    if (state.requestedIOR === key && (state.footprint || state.pending)) return;
    state.requestedIOR = key;
    clearTimeout(rebuildTimer);
    if (!state.footprint || cache.has(key)) { applyIOR(key); return; }
    state.pending = true;
    rebuildTimer = setTimeout(() => { rebuildTimer = null; applyIOR(key); }, 120);
  }
  configure(ior);
  return {
    state, projection, uniforms, configure,
    dispose() {
      if (state.disposed) return;
      clearTimeout(rebuildTimer);
      projection.removeFromParent(); texture.dispose(); material.dispose(); geometry.dispose();
      cache.clear(); state.pending = false; state.disposed = true;
    },
  };
}
