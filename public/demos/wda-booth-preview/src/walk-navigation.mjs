// Small-room navigation for the WDA walkthrough. World coordinates are metres.
// Circle/rectangle sweeps preserve clearance even when a frame is delayed.
const EPS = 1e-9;
const sq = value => value * value;
export const WALK_HEIGHT = 1.7;
export const WALK_SPEED = 2.2;
export const WALK_MAX_FRAME = .1;
const finitePoint = value => Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(Number.isFinite);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

function pointSegmentSq(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = dx * dx + dz * dz;
  const t = len > EPS ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len, 0, 1) : 0;
  return sq(p[0] - a[0] - t * dx) + sq(p[1] - a[1] - t * dz);
}
function segmentIntersectsBox(a, b, box) {
  let lo = 0, hi = 1;
  for (const [axis, min, max] of [[0, box.minX, box.maxX], [1, box.minZ, box.maxZ]]) {
    const direction = b[axis] - a[axis];
    if (Math.abs(direction) < EPS) { if (a[axis] < min || a[axis] > max) return false; continue; }
    let near = (min - a[axis]) / direction, far = (max - a[axis]) / direction;
    if (near > far) [near, far] = [far, near];
    lo = Math.max(lo, near); hi = Math.min(hi, far);
    if (lo > hi + EPS) return false;
  }
  return true;
}
function pointBoxSq(p, box) {
  return sq(p[0] - clamp(p[0], box.minX, box.maxX)) + sq(p[1] - clamp(p[1], box.minZ, box.maxZ));
}
function sweepBoxSq(a, b, box) {
  if (segmentIntersectsBox(a, b, box)) return 0;
  // For disjoint convex segments/rectangle, the minimum is attained at either
  // segment endpoint or a rectangle vertex projected onto the segment.
  return Math.min(pointBoxSq(a, box), pointBoxSq(b, box), ...[
    [box.minX, box.minZ], [box.minX, box.maxZ], [box.maxX, box.minZ], [box.maxX, box.maxZ],
  ].map(corner => pointSegmentSq(corner, a, b)));
}

export function createBoothNavigation({ bounds, boxes = [], radius = .24, eyeHeight = WALK_HEIGHT,
  floorY = 0, bodyBottom = .15, bodyTop = 1.95 } = {}) {
  if (!bounds || !['minX', 'maxX', 'minZ', 'maxZ'].every(k => Number.isFinite(bounds[k])) ||
    !(bounds.maxX > bounds.minX + radius * 2 && bounds.maxZ > bounds.minZ + radius * 2) ||
    !Number.isFinite(radius) || radius <= 0 || !Number.isFinite(eyeHeight) || !Number.isFinite(floorY))
    throw new TypeError('Navigation requires finite floor bounds and positive visitor clearance.');
  const room = { ...bounds }, obstacles = [];
  for (const box of boxes) {
    if (!finitePoint(box.min) || !finitePoint(box.max) || box.min.some((n, i) => n > box.max[i]))
      throw new TypeError(`Invalid collision box: ${box.id ?? 'unnamed'}`);
    if (box.max[1] <= floorY + bodyBottom || box.min[1] >= floorY + bodyTop) continue;
    obstacles.push({ id: box.id, minX: box.min[0], maxX: box.max[0], minZ: box.min[2], maxZ: box.max[2] });
  }
  const clearanceSq = radius * radius;
  const state = { ready: true, eyeHeight, floorY, radius, obstacleCount: obstacles.length,
    method: 'Swept visitor circle against measured wall/furniture boxes' };
  function contains(point) {
    if (!state.ready || !finitePoint(point)) return false;
    const [x, , z] = point;
    if (x < room.minX + radius || x > room.maxX - radius || z < room.minZ + radius || z > room.maxZ - radius) return false;
    return obstacles.every(box => pointBoxSq([x, z], box) >= clearanceSq - EPS);
  }
  function segmentClear(from, to) {
    if (!contains(from) || !contains(to)) return false;
    const a = [from[0], from[2]], b = [to[0], to[2]];
    return obstacles.every(box => sweepBoxSq(a, b, box) >= clearanceSq - EPS);
  }
  function visitorPose(pose) {
    if (!pose || !finitePoint(pose.position) || !finitePoint(pose.target)) return null;
    const position = [pose.position[0], floorY + eyeHeight, pose.position[2]];
    if (!contains(position)) return null;
    const dy = position[1] - pose.position[1];
    return { ...pose, position, target: [pose.target[0], pose.target[1] + dy, pose.target[2]] };
  }
  return { state, contains, segmentClear, visitorPose, bounds: Object.freeze(room),
    boxes: obstacles.map(box => Object.freeze({ ...box })) };
}

// Pure movement integration shared by UI and unit tests. Updates the provided
// state, capping stalls and sweeping each attempted move before accepting it.
export function advanceWalk(motion, input, elapsed, navigation, { speed = WALK_SPEED,
  response = 10, reducedMotion = false } = {}) {
  if (!motion || !finitePoint(motion.position) || !navigation?.contains || !navigation?.segmentClear)
    throw new TypeError('A valid walker and navigation adapter are required.');
  const dt = Math.min(WALK_MAX_FRAME, Math.max(0, Number.isFinite(elapsed) ? elapsed : 0));
  motion.vx = Number.isFinite(motion.vx) ? motion.vx : 0;
  motion.vz = Number.isFinite(motion.vz) ? motion.vz : 0;
  motion.distance = Number.isFinite(motion.distance) ? motion.distance : 0;
  motion.blocked = false;
  let forward = Number(input?.forward || 0), right = Number(input?.right || 0);
  const length = Math.hypot(forward, right);
  if (length > 1) { forward /= length; right /= length; }
  const yaw = Number.isFinite(motion.yaw) ? motion.yaw : 0, sx = Math.sin(yaw), cz = Math.cos(yaw);
  const wantedX = (forward * sx - right * cz) * speed, wantedZ = (forward * cz + right * sx) * speed;
  const count = Math.max(1, Math.ceil(dt * 90)), step = dt / count;
  for (let i = 0; i < count && step > 0; i++) {
    const gain = reducedMotion ? 1 : 1 - Math.exp(-response * step);
    motion.vx += (wantedX - motion.vx) * gain; motion.vz += (wantedZ - motion.vz) * gain;
    if (Math.abs(motion.vx) < .0001) motion.vx = 0;
    if (Math.abs(motion.vz) < .0001) motion.vz = 0;
    const from = [...motion.position], dx = motion.vx * step, dz = motion.vz * step;
    const to = [from[0] + dx, from[1], from[2] + dz];
    const valid = (a, b) => navigation.contains(b) && navigation.segmentClear(a, b);
    if (valid(from, to)) motion.position = to;
    else {
      motion.blocked = true;
      for (const axis of Math.abs(dx) >= Math.abs(dz) ? [0, 2] : [2, 0]) {
        const a = [...motion.position], b = [...a]; b[axis] += axis === 0 ? dx : dz;
        if (valid(a, b)) motion.position = b;
        else motion[axis === 0 ? 'vx' : 'vz'] = 0;
      }
    }
    motion.distance += Math.hypot(motion.position[0] - from[0], motion.position[2] - from[2]);
  }
  motion.speed = Math.hypot(motion.vx, motion.vz);
  return { moved: motion.speed > 0 && dt > 0, needsFrame: !!length || motion.speed > 0,
    dt, blocked: motion.blocked };
}
