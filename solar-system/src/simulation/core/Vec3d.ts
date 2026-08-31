export interface Vec3d {
  x: number;
  y: number;
  z: number;
}
/** Allocation helper for setup code. Hot-loop operations below write to `out`. */
export function createVec3d(x = 0, y = 0, z = 0): Vec3d {
  return { x, y, z };
}

export function setVec3d(out: Vec3d, x: number, y: number, z: number): Vec3d {
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

export function copyVec3d(out: Vec3d, value: Readonly<Vec3d>): Vec3d {
  const x = value.x;
  const y = value.y;
  const z = value.z;
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

export function addVec3d(
  out: Vec3d,
  left: Readonly<Vec3d>,
  right: Readonly<Vec3d>,
): Vec3d {
  const x = left.x + right.x;
  const y = left.y + right.y;
  const z = left.z + right.z;
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

export function subtractVec3d(
  out: Vec3d,
  left: Readonly<Vec3d>,
  right: Readonly<Vec3d>,
): Vec3d {
  const x = left.x - right.x;
  const y = left.y - right.y;
  const z = left.z - right.z;
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

export function scaleVec3d(out: Vec3d, value: Readonly<Vec3d>, scalar: number): Vec3d {
  const x = value.x * scalar;
  const y = value.y * scalar;
  const z = value.z * scalar;
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

export function addScaledVec3d(
  out: Vec3d,
  base: Readonly<Vec3d>,
  value: Readonly<Vec3d>,
  scalar: number,
): Vec3d {
  const x = base.x + value.x * scalar;
  const y = base.y + value.y * scalar;
  const z = base.z + value.z * scalar;
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

export function crossVec3d(
  out: Vec3d,
  left: Readonly<Vec3d>,
  right: Readonly<Vec3d>,
): Vec3d {
  const x = left.y * right.z - left.z * right.y;
  const y = left.z * right.x - left.x * right.z;
  const z = left.x * right.y - left.y * right.x;
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

export function dotVec3d(left: Readonly<Vec3d>, right: Readonly<Vec3d>): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

export function lengthSquaredVec3d(value: Readonly<Vec3d>): number {
  return dotVec3d(value, value);
}

export function lengthVec3d(value: Readonly<Vec3d>): number {
  return Math.sqrt(lengthSquaredVec3d(value));
}

export function distanceSquaredVec3d(left: Readonly<Vec3d>, right: Readonly<Vec3d>): number {
  const x = left.x - right.x;
  const y = left.y - right.y;
  const z = left.z - right.z;
  return x * x + y * y + z * z;
}

export function normalizeVec3d(out: Vec3d, value: Readonly<Vec3d>): Vec3d {
  const length = lengthVec3d(value);
  if (length === 0 || !Number.isFinite(length)) {
    return setVec3d(out, 0, 0, 0);
  }
  return scaleVec3d(out, value, 1 / length);
}

export function isFiniteVec3d(value: Readonly<Vec3d>): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}
