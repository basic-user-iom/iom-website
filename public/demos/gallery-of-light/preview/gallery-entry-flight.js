import { Box3, Matrix4, Ray, Triangle, Vector3 } from 'three';

const CLEARANCE = .24, SAMPLES = 512;
const clamp = t => Math.max(0, Math.min(1, t));
const ease = value => { const t = clamp(value); return t * t * t * (t * (t * 6 - 15) + 10); };
const lerp = (a, b, t) => a + (b - a) * t;
const vector = values => new Vector3().fromArray(values);
const poseCopy = pose => ({ position: [...pose.position], target: [...pose.target], fov: pose.fov ?? 45, ...(Number.isFinite(pose.aspect) ? { aspect: pose.aspect } : {}) });

/** A verified aerial approach through the opening left by the hidden roof.
 * Fixed connector ceilings, glazing, walls, props and sculptures remain solid.
 * All collision data is private; no source geometry/material/bounds is changed.
 */
export function createGalleryEntryFlight({ galleryModel, sculptureModel }) {
  if (!galleryModel) throw new Error('The entry flight requires loaded gallery geometry.');
  const records = [], geometries = new Map(), bounds = new Box3();
  const scratch = new Vector3(), instance = new Matrix4();
  galleryModel.updateWorldMatrix(true, true);
  sculptureModel?.updateWorldMatrix(true, true);
  galleryModel.traverse(mesh => {
    if (!mesh.isMesh) return;
    for (let node = mesh; node; node = node.parent) if (node.name === 'roof_structure' || node.name === 'roof_glazing') return;
    const local = new Box3().setFromBufferAttribute(mesh.geometry.attributes.position);
    for (let i = 0; i < (mesh.isInstancedMesh ? mesh.count : 1); i++) {
      if (mesh.isInstancedMesh) mesh.getMatrixAt(i, instance);
      const matrix = mesh.isInstancedMesh ? new Matrix4().multiplyMatrices(mesh.matrixWorld, instance) : mesh.matrixWorld.clone();
      const worldBounds = local.clone().applyMatrix4(matrix), inverse = matrix.clone().invert(), e = inverse.elements;
      const inverseScaleBound = Math.sqrt(e[0] ** 2 + e[1] ** 2 + e[2] ** 2 + e[4] ** 2 + e[5] ** 2 + e[6] ** 2 + e[8] ** 2 + e[9] ** 2 + e[10] ** 2);
      records.push({ geometry: mesh.geometry, matrix, inverse, inverseScaleBound, bounds: worldBounds, name: mesh.name });
      bounds.union(worldBounds);
    }
  });
  // Conservative boxes avoid building another large triangle index for the
  // sculptures. They cannot allow a collision with the enclosed source mesh.
  const sculptureBoxes = [];
  sculptureModel?.traverse(object => {
    if (!/^AI66_002_Sculpture_[A-F]\d*$/.test(object.name)&&object.name!=='runtime_Doryphoros'&&!object.userData.galleryExhibitRoot) return;
    const box = new Box3();
    object.traverse(mesh => {
      if (!mesh.isMesh) return;
      const local = new Box3().setFromBufferAttribute(mesh.geometry.attributes.position);
      for (let i = 0; i < (mesh.isInstancedMesh ? mesh.count : 1); i++) {
        if (mesh.isInstancedMesh) mesh.getMatrixAt(i, instance);
        const matrix = mesh.isInstancedMesh ? new Matrix4().multiplyMatrices(mesh.matrixWorld, instance) : mesh.matrixWorld;
        box.union(local.clone().applyMatrix4(matrix));
      }
    });
    sculptureBoxes.push({ bounds: box, name: object.name });
  });
  const state = { ready: true, disposed: false, plans: 0, failures: 0, clearance: CLEARANCE,
    ignoredGroups: ['roof_structure', 'roof_glazing'], instanceCount: records.length,
    indexedGeometries: 0, indexedTriangles: 0, lastRoute: null };

  function geometryIndex(geometry) {
    if (geometries.has(geometry)) return geometries.get(geometry);
    const attribute = geometry.attributes.position, index = geometry.index;
    const count = Math.floor((index?.count ?? attribute.count) / 3), boxes = new Float64Array(count * 6), centers = new Float64Array(count * 3);
    for (let n = 0; n < count; n++) {
      const values = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (let k = 0; k < 3; k++) {
        scratch.fromBufferAttribute(attribute, index ? index.getX(n * 3 + k) : n * 3 + k);
        values[0] = Math.min(values[0], scratch.x); values[1] = Math.min(values[1], scratch.y); values[2] = Math.min(values[2], scratch.z);
        values[3] = Math.max(values[3], scratch.x); values[4] = Math.max(values[4], scratch.y); values[5] = Math.max(values[5], scratch.z);
      }
      boxes.set(values, n * 6);
      for (let axis = 0; axis < 3; axis++) centers[n * 3 + axis] = (values[axis] + values[axis + 3]) / 2;
    }
    const order = Array.from({ length: count }, (_, i) => i);
    function build(start, end) {
      const extents = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (let i = start; i < end; i++) for (let axis = 0; axis < 3; axis++) {
        extents[axis] = Math.min(extents[axis], boxes[order[i] * 6 + axis]);
        extents[axis + 3] = Math.max(extents[axis + 3], boxes[order[i] * 6 + axis + 3]);
      }
      const node = { box: new Box3(vector(extents.slice(0, 3)), vector(extents.slice(3))), start, end };
      if (end - start > 24) {
        const sizes = extents.slice(3).map((v, i) => v - extents[i]), axis = sizes.indexOf(Math.max(...sizes));
        const sorted = order.slice(start, end).sort((a, b) => centers[a * 3 + axis] - centers[b * 3 + axis]);
        for (let i = 0; i < sorted.length; i++) order[start + i] = sorted[i];
        const middle = (start + end) >> 1; node.left = build(start, middle); node.right = build(middle, end);
      }
      return node;
    }
    const result = { tree: build(0, count), order, attribute, index };
    geometries.set(geometry, result); state.indexedGeometries++; state.indexedTriangles += count;
    return result;
  }

  const a = new Vector3(), b = new Vector3(), c = new Vector3(), closest = new Vector3(), hit = new Vector3();
  const ray = new Ray(), triangle = new Triangle(), delta = new Vector3();
  const query = new Box3(), localQuery = new Box3(), localA = new Vector3(), localB = new Vector3();
  function edgeDistanceSquared(p, q, r, s) {
    const ux = q.x - p.x, uy = q.y - p.y, uz = q.z - p.z, vx = s.x - r.x, vy = s.y - r.y, vz = s.z - r.z;
    const wx = p.x - r.x, wy = p.y - r.y, wz = p.z - r.z;
    const aa = ux * ux + uy * uy + uz * uz, ee = vx * vx + vy * vy + vz * vz, ff = vx * wx + vy * wy + vz * wz;
    let ss, tt;
    if (aa < 1e-12 && ee < 1e-12) return wx * wx + wy * wy + wz * wz;
    if (aa < 1e-12) { ss = 0; tt = clamp(ff / ee); }
    else {
      const cc = ux * wx + uy * wy + uz * wz;
      if (ee < 1e-12) { tt = 0; ss = clamp(-cc / aa); }
      else {
        const bb = ux * vx + uy * vy + uz * vz, denominator = aa * ee - bb * bb;
        ss = denominator > 1e-12 ? clamp((bb * ff - cc * ee) / denominator) : 0;
        tt = (bb * ss + ff) / ee;
        if (tt < 0) { tt = 0; ss = clamp(-cc / aa); }
        else if (tt > 1) { tt = 1; ss = clamp((bb - cc) / aa); }
      }
    }
    return (wx + ux * ss - vx * tt) ** 2 + (wy + uy * ss - vy * tt) ** 2 + (wz + uz * ss - vz * tt) ** 2;
  }
  function triangleDistanceSquared(start, end) {
    delta.subVectors(end, start); const length = delta.length();
    if (length > 1e-9) {
      ray.set(start, delta.multiplyScalar(1 / length));
      if (ray.intersectTriangle(a, b, c, false, hit) && hit.distanceToSquared(start) <= length * length + 1e-9) return 0;
    }
    triangle.set(a, b, c);
    let distance = Math.min(triangle.closestPointToPoint(start, closest).distanceToSquared(start), triangle.closestPointToPoint(end, closest).distanceToSquared(end));
    distance = Math.min(distance, edgeDistanceSquared(start, end, a, b), edgeDistanceSquared(start, end, b, c), edgeDistanceSquared(start, end, c, a));
    return distance;
  }
  function segmentClear(start, end, radius = CLEARANCE) {
    query.makeEmpty().expandByPoint(start).expandByPoint(end).expandByScalar(radius);
    for (const obstacle of sculptureBoxes) if (query.intersectsBox(obstacle.bounds)) return false;
    for (const record of records) {
      if (!query.intersectsBox(record.bounds)) continue;
      localA.copy(start).applyMatrix4(record.inverse); localB.copy(end).applyMatrix4(record.inverse);
      localQuery.makeEmpty().expandByPoint(localA).expandByPoint(localB).expandByScalar(radius * record.inverseScaleBound);
      const { tree, order, attribute, index } = geometryIndex(record.geometry), stack = [tree];
      while (stack.length) {
        const node = stack.pop();
        if (!node.box.intersectsBox(localQuery)) continue;
        if (node.left) { stack.push(node.left, node.right); continue; }
        for (let i = node.start; i < node.end; i++) {
          const face = order[i] * 3;
          a.fromBufferAttribute(attribute, index ? index.getX(face) : face).applyMatrix4(record.matrix);
          b.fromBufferAttribute(attribute, index ? index.getX(face + 1) : face + 1).applyMatrix4(record.matrix);
          c.fromBufferAttribute(attribute, index ? index.getX(face + 2) : face + 2).applyMatrix4(record.matrix);
          if (triangleDistanceSquared(start, end) < radius * radius) return false;
        }
      }
    }
    return true;
  }

  function plan(fromPose, toPose) {
    if (state.disposed) return null;
    const started = performance.now(); state.plans++;
    if (![fromPose, toPose].every(pose => pose?.position?.length === 3 && pose?.target?.length === 3 && [...pose.position, ...pose.target, pose.fov ?? 45].every(Number.isFinite))) { state.failures++; return null; }
    const from = poseCopy(fromPose), to = poseCopy(toPose), start = vector(from.position), end = vector(to.position);
    const aspect = from.aspect ?? to.aspect ?? 1;
    if (to.aspect !== undefined && to.aspect !== aspect) to.fov = 360 / Math.PI * Math.atan(Math.tan(to.fov * Math.PI / 360) * Math.min(1, to.aspect) / Math.min(1, aspect));
    from.aspect = to.aspect = aspect;
    if (start.y < bounds.max.y + CLEARANCE || end.y < CLEARANCE) { state.failures++; return null; }
    // A clear vertical approach column is mandatory. The fixed connecting roof
    // is deliberately included, so an endpoint under it cannot be flown through.
    const ceiling = Math.max(bounds.max.y + 1.5, end.y + 4), above = end.clone().setY(ceiling);
    if (!segmentClear(above, end)) { state.failures++; state.lastRoute = { valid: false, reason: 'The destination column is obstructed.' }; return null; }
    let points = null, candidate = 0;
    for (; candidate < 4; candidate++) {
      const p1 = end.clone().setY(Math.max(start.y * .55, ceiling + 8) + candidate * 8);
      const p2 = end.clone().setY(ceiling + candidate * 2), proposed = [];
      for (let i = 0; i <= SAMPLES; i++) {
        const t = i / SAMPLES, u = 1 - t;
        proposed.push(new Vector3().addScaledVector(start, u ** 3).addScaledVector(p1, 3 * u * u * t).addScaledVector(p2, 3 * u * t * t).addScaledVector(end, t ** 3));
      }
      if (proposed.every((point, i) => i === 0 || segmentClear(proposed[i - 1], point))) { points = proposed; break; }
    }
    if (!points) { state.failures++; state.lastRoute = { valid: false, reason: 'No verified aerial approach was found.' }; return null; }
    const lengths = [0]; for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]));
    const length = lengths.at(-1), duration = Math.max(6.5, Math.min(9, length / 19 + 2));
    const look0 = vector(from.target), look1 = vector(to.target);
    function sample(progress) {
      const t = clamp(progress); if (t === 0) return poseCopy(from); if (t === 1) return poseCopy(to);
      const amount = ease(t), distance = amount * length;
      let low = 1, high = lengths.length - 1;
      while (low < high) { const mid = (low + high) >> 1; if (lengths[mid] < distance) low = mid + 1; else high = mid; }
      const i = low, u = (distance - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1), position = points[i - 1].clone().lerp(points[i], u);
      // Follow a landmark inside the room while still high above it. Blending
      // only viewing directions would level the camera too early toward sky.
      const target = look0.clone().lerp(look1, amount);
      return { position: position.toArray(), target: target.toArray(), fov: lerp(from.fov, to.fov, amount), aspect };
    }
    const diagnostics = { valid: true, method: 'Clear vertical entrance column and capsule-checked cubic approach; arc-length sampling with quintic easing', clearance: CLEARANCE, segments: SAMPLES, length, duration, candidate, column: [above.toArray(), end.toArray()], planningMilliseconds: performance.now() - started };
    state.lastRoute = diagnostics;
    const route = { from, to, points: points.map(p => p.toArray()), length, duration, diagnostics, sample,
      reverse() { return { from: poseCopy(to), to: poseCopy(from), points: [...route.points].reverse().map(p => [...p]), length, duration, diagnostics: { ...diagnostics, reversed: true }, sample: t => sample(1 - clamp(t)), reverse: () => route }; } };
    return route;
  }
  return { state, plan, segmentClear: (from, to, radius) => segmentClear(vector(from), vector(to), radius), dispose() { records.length = 0; sculptureBoxes.length = 0; geometries.clear(); state.ready = false; state.disposed = true; } };
}
