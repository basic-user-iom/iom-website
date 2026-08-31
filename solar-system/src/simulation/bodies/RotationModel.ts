import { J2000_JD_TDB } from '../core/JulianDate';
import { SECONDS_PER_DAY } from '../core/Units';
import { createVec3d, isFiniteVec3d, type Vec3d } from '../core/Vec3d';

/** Body-local to inertial ECLIPTIC rotation quaternion. */
export interface Quaterniond {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface RotationSampleInput {
  readonly jdTdb: number;
  readonly bodyPositionM?: Readonly<Vec3d>;
  readonly parentPositionM?: Readonly<Vec3d>;
  readonly bodyVelocityMps?: Readonly<Vec3d>;
  readonly parentVelocityMps?: Readonly<Vec3d>;
}

export interface RotationState {
  jdTdb: number;
  readonly orientation: Quaterniond;
  /** Inertial ECLIPTIC angular velocity, radians per SI second. */
  readonly angularVelocityRadPerSec: Vec3d;
}

export interface RotationModel {
  readonly id: string;
  readonly bodyId: string;
  readonly kind: 'constant-rate' | 'synchronous';
  readonly approximation: string;
  /** Writes into and returns `out`. */
  sample(input: RotationSampleInput, out: RotationState): RotationState;
}

export interface ConstantRateRotationModelOptions {
  readonly id?: string;
  readonly bodyId: string;
  readonly rotationPeriodSeconds: number;
  readonly retrograde?: boolean;
  readonly axialTiltRad?: number;
  readonly epochJdTdb?: number;
  readonly primeMeridianAtEpochRad?: number;
  readonly approximation?: string;
}

/**
 * Constant-rate seed model. The tilt node is the inertial +X axis until a
 * generated authoritative pole/prime-meridian catalog replaces this model.
 */
export class ConstantRateRotationModel implements RotationModel {
  public readonly id: string;
  public readonly bodyId: string;
  public readonly kind = 'constant-rate' as const;
  public readonly approximation: string;
  public readonly rotationPeriodSeconds: number;
  public readonly retrograde: boolean;
  public readonly axialTiltRad: number;
  public readonly epochJdTdb: number;
  public readonly primeMeridianAtEpochRad: number;

  public constructor(options: ConstantRateRotationModelOptions) {
    assertBodyId(options.bodyId);
    assertPositiveFinite(options.rotationPeriodSeconds, 'rotationPeriodSeconds');
    this.axialTiltRad = options.axialTiltRad ?? 0;
    this.epochJdTdb = options.epochJdTdb ?? J2000_JD_TDB;
    this.primeMeridianAtEpochRad = options.primeMeridianAtEpochRad ?? 0;
    assertFinite(this.axialTiltRad, 'axialTiltRad');
    assertFinite(this.epochJdTdb, 'epochJdTdb');
    assertFinite(this.primeMeridianAtEpochRad, 'primeMeridianAtEpochRad');

    this.bodyId = options.bodyId;
    this.id = options.id ?? `seed-constant-rate:${options.bodyId}`;
    this.rotationPeriodSeconds = options.rotationPeriodSeconds;
    this.retrograde = options.retrograde ?? false;
    this.approximation =
      options.approximation ??
      'Constant sidereal rate with seed axial tilt; authoritative pole and prime-meridian constants pending.';
  }

  public sample(input: RotationSampleInput, out: RotationState): RotationState {
    assertFinite(input.jdTdb, 'Rotation JD TDB');
    const elapsedSeconds = (input.jdTdb - this.epochJdTdb) * SECONDS_PER_DAY;
    assertFinite(elapsedSeconds, 'Rotation elapsed seconds');
    const direction = this.retrograde ? -1 : 1;
    const fractionalTurns =
      elapsedSeconds / this.rotationPeriodSeconds -
      Math.trunc(elapsedSeconds / this.rotationPeriodSeconds);
    const spinAngle =
      this.primeMeridianAtEpochRad + direction * fractionalTurns * Math.PI * 2;
    const halfTilt = this.axialTiltRad / 2;
    const halfSpin = spinAngle / 2;
    const sinTilt = Math.sin(halfTilt);
    const cosTilt = Math.cos(halfTilt);
    const sinSpin = Math.sin(halfSpin);
    const cosSpin = Math.cos(halfSpin);

    // q = qTilt(+X) * qSpin(local +Z).
    setQuaternion(
      out.orientation,
      sinTilt * cosSpin,
      -sinTilt * sinSpin,
      cosTilt * sinSpin,
      cosTilt * cosSpin,
    );
    const angularRate = direction * (Math.PI * 2) / this.rotationPeriodSeconds;
    out.angularVelocityRadPerSec.x = 0;
    out.angularVelocityRadPerSec.y = -Math.sin(this.axialTiltRad) * angularRate;
    out.angularVelocityRadPerSec.z = Math.cos(this.axialTiltRad) * angularRate;
    out.jdTdb = input.jdTdb;
    return out;
  }
}

export interface SynchronousRotationModelOptions {
  readonly id?: string;
  readonly bodyId: string;
  readonly parentBodyId: string;
  readonly nominalRotationPeriodSeconds: number;
}

/**
 * Approximate synchronous orientation: local +X faces the parent and local +Z
 * follows instantaneous orbital angular momentum when velocities are present.
 * Physical libration and authoritative lunar pole terms are intentionally absent.
 */
export class SynchronousRotationModel implements RotationModel {
  public readonly id: string;
  public readonly bodyId: string;
  public readonly parentBodyId: string;
  public readonly kind = 'synchronous' as const;
  public readonly approximation =
    'Line-of-centers synchronous orientation without physical libration or authoritative pole series.';
  public readonly nominalRotationPeriodSeconds: number;

  public constructor(options: SynchronousRotationModelOptions) {
    assertBodyId(options.bodyId);
    assertBodyId(options.parentBodyId);
    if (options.bodyId === options.parentBodyId) {
      throw new RangeError('Synchronous body and parent identifiers must differ.');
    }
    assertPositiveFinite(
      options.nominalRotationPeriodSeconds,
      'nominalRotationPeriodSeconds',
    );
    this.id = options.id ?? `approximate-synchronous:${options.bodyId}`;
    this.bodyId = options.bodyId;
    this.parentBodyId = options.parentBodyId;
    this.nominalRotationPeriodSeconds = options.nominalRotationPeriodSeconds;
  }

  public sample(input: RotationSampleInput, out: RotationState): RotationState {
    assertFinite(input.jdTdb, 'Rotation JD TDB');
    const body = requiredPosition(input.bodyPositionM, 'Synchronous body position');
    const parent = requiredPosition(input.parentPositionM, 'Synchronous parent position');
    const relativeX = body.x - parent.x;
    const relativeY = body.y - parent.y;
    const relativeZ = body.z - parent.z;
    const distanceSquared =
      relativeX * relativeX + relativeY * relativeY + relativeZ * relativeZ;
    if (!Number.isFinite(distanceSquared) || distanceSquared <= 0) {
      throw new RangeError('Synchronous body and parent positions must be distinct.');
    }
    const inverseDistance = 1 / Math.sqrt(distanceSquared);
    // Local +X points from the body toward its parent.
    const xAxisX = -relativeX * inverseDistance;
    const xAxisY = -relativeY * inverseDistance;
    const xAxisZ = -relativeZ * inverseDistance;

    let zAxisX = 0;
    let zAxisY = 0;
    let zAxisZ = 0;
    let hasKinematicNormal = false;
    const bodyVelocity = input.bodyVelocityMps;
    const parentVelocity = input.parentVelocityMps;
    if (bodyVelocity !== undefined && parentVelocity !== undefined) {
      assertFiniteVector(bodyVelocity, 'Synchronous body velocity');
      assertFiniteVector(parentVelocity, 'Synchronous parent velocity');
      const velocityX = bodyVelocity.x - parentVelocity.x;
      const velocityY = bodyVelocity.y - parentVelocity.y;
      const velocityZ = bodyVelocity.z - parentVelocity.z;
      zAxisX = relativeY * velocityZ - relativeZ * velocityY;
      zAxisY = relativeZ * velocityX - relativeX * velocityZ;
      zAxisZ = relativeX * velocityY - relativeY * velocityX;
      const normalLength = Math.hypot(zAxisX, zAxisY, zAxisZ);
      if (Number.isFinite(normalLength) && normalLength > 0) {
        zAxisX /= normalLength;
        zAxisY /= normalLength;
        zAxisZ /= normalLength;
        hasKinematicNormal = true;
      }
    }

    if (!hasKinematicNormal) {
      // Project ecliptic north onto the plane perpendicular to the line of centers.
      const northProjection = xAxisZ;
      zAxisX = -xAxisX * northProjection;
      zAxisY = -xAxisY * northProjection;
      zAxisZ = 1 - xAxisZ * northProjection;
      let normalLength = Math.hypot(zAxisX, zAxisY, zAxisZ);
      if (normalLength < 1e-12) {
        const fallbackProjection = xAxisY;
        zAxisX = -xAxisX * fallbackProjection;
        zAxisY = 1 - xAxisY * fallbackProjection;
        zAxisZ = -xAxisZ * fallbackProjection;
        normalLength = Math.hypot(zAxisX, zAxisY, zAxisZ);
      }
      zAxisX /= normalLength;
      zAxisY /= normalLength;
      zAxisZ /= normalLength;
    }

    // y = z cross x gives a right-handed local basis.
    let yAxisX = zAxisY * xAxisZ - zAxisZ * xAxisY;
    let yAxisY = zAxisZ * xAxisX - zAxisX * xAxisZ;
    let yAxisZ = zAxisX * xAxisY - zAxisY * xAxisX;
    const yLength = Math.hypot(yAxisX, yAxisY, yAxisZ);
    yAxisX /= yLength;
    yAxisY /= yLength;
    yAxisZ /= yLength;
    // Recompute z to remove accumulated projection error.
    zAxisX = xAxisY * yAxisZ - xAxisZ * yAxisY;
    zAxisY = xAxisZ * yAxisX - xAxisX * yAxisZ;
    zAxisZ = xAxisX * yAxisY - xAxisY * yAxisX;

    setQuaternionFromBasis(
      out.orientation,
      xAxisX,
      xAxisY,
      xAxisZ,
      yAxisX,
      yAxisY,
      yAxisZ,
      zAxisX,
      zAxisY,
      zAxisZ,
    );

    if (hasKinematicNormal && bodyVelocity !== undefined && parentVelocity !== undefined) {
      const velocityX = bodyVelocity.x - parentVelocity.x;
      const velocityY = bodyVelocity.y - parentVelocity.y;
      const velocityZ = bodyVelocity.z - parentVelocity.z;
      out.angularVelocityRadPerSec.x =
        (relativeY * velocityZ - relativeZ * velocityY) / distanceSquared;
      out.angularVelocityRadPerSec.y =
        (relativeZ * velocityX - relativeX * velocityZ) / distanceSquared;
      out.angularVelocityRadPerSec.z =
        (relativeX * velocityY - relativeY * velocityX) / distanceSquared;
    } else {
      const rate = Math.PI * 2 / this.nominalRotationPeriodSeconds;
      out.angularVelocityRadPerSec.x = zAxisX * rate;
      out.angularVelocityRadPerSec.y = zAxisY * rate;
      out.angularVelocityRadPerSec.z = zAxisZ * rate;
    }
    out.jdTdb = input.jdTdb;
    return out;
  }
}

export function createRotationState(): RotationState {
  return {
    jdTdb: 0,
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    angularVelocityRadPerSec: createVec3d(),
  };
}

export function rotateBodyLocalVectorToInertial(
  out: Vec3d,
  vector: Readonly<Vec3d>,
  orientation: Readonly<Quaterniond>,
): Vec3d {
  return rotateVectorByQuaternion(out, vector, orientation, false);
}

export function rotateInertialVectorToBodyLocal(
  out: Vec3d,
  vector: Readonly<Vec3d>,
  orientation: Readonly<Quaterniond>,
): Vec3d {
  return rotateVectorByQuaternion(out, vector, orientation, true);
}

function rotateVectorByQuaternion(
  out: Vec3d,
  vector: Readonly<Vec3d>,
  quaternion: Readonly<Quaterniond>,
  inverse: boolean,
): Vec3d {
  assertFiniteVector(vector, 'Rotated vector');
  const norm = Math.hypot(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  if (!Number.isFinite(norm) || norm === 0) {
    throw new RangeError('Rotation quaternion must be finite and non-zero.');
  }
  const inverseNorm = 1 / norm;
  const sign = inverse ? -1 : 1;
  const qx = quaternion.x * inverseNorm * sign;
  const qy = quaternion.y * inverseNorm * sign;
  const qz = quaternion.z * inverseNorm * sign;
  const qw = quaternion.w * inverseNorm;
  const tx = 2 * (qy * vector.z - qz * vector.y);
  const ty = 2 * (qz * vector.x - qx * vector.z);
  const tz = 2 * (qx * vector.y - qy * vector.x);
  out.x = vector.x + qw * tx + (qy * tz - qz * ty);
  out.y = vector.y + qw * ty + (qz * tx - qx * tz);
  out.z = vector.z + qw * tz + (qx * ty - qy * tx);
  return out;
}

function setQuaternion(
  out: Quaterniond,
  x: number,
  y: number,
  z: number,
  w: number,
): void {
  const norm = Math.hypot(x, y, z, w);
  if (!Number.isFinite(norm) || norm === 0) {
    throw new RangeError('Calculated rotation quaternion is invalid.');
  }
  out.x = x / norm;
  out.y = y / norm;
  out.z = z / norm;
  out.w = w / norm;
}

function setQuaternionFromBasis(
  out: Quaterniond,
  xAxisX: number,
  xAxisY: number,
  xAxisZ: number,
  yAxisX: number,
  yAxisY: number,
  yAxisZ: number,
  zAxisX: number,
  zAxisY: number,
  zAxisZ: number,
): void {
  // Basis vectors are columns; matrix components below are row-major.
  const m00 = xAxisX;
  const m01 = yAxisX;
  const m02 = zAxisX;
  const m10 = xAxisY;
  const m11 = yAxisY;
  const m12 = zAxisY;
  const m20 = xAxisZ;
  const m21 = yAxisZ;
  const m22 = zAxisZ;
  const trace = m00 + m11 + m22;
  let x: number;
  let y: number;
  let z: number;
  let w: number;
  if (trace > 0) {
    const scale = Math.sqrt(trace + 1) * 2;
    w = scale / 4;
    x = (m21 - m12) / scale;
    y = (m02 - m20) / scale;
    z = (m10 - m01) / scale;
  } else if (m00 > m11 && m00 > m22) {
    const scale = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / scale;
    x = scale / 4;
    y = (m01 + m10) / scale;
    z = (m02 + m20) / scale;
  } else if (m11 > m22) {
    const scale = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / scale;
    x = (m01 + m10) / scale;
    y = scale / 4;
    z = (m12 + m21) / scale;
  } else {
    const scale = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / scale;
    x = (m02 + m20) / scale;
    y = (m12 + m21) / scale;
    z = scale / 4;
  }
  setQuaternion(out, x, y, z, w);
}

function requiredPosition(
  value: Readonly<Vec3d> | undefined,
  label: string,
): Readonly<Vec3d> {
  if (value === undefined) throw new TypeError(`${label} is required.`);
  assertFiniteVector(value, label);
  return value;
}

function assertFiniteVector(value: Readonly<Vec3d>, label: string): void {
  if (!isFiniteVec3d(value)) throw new RangeError(`${label} must be finite.`);
}

function assertBodyId(bodyId: string): void {
  if (bodyId.trim().length === 0 || bodyId !== bodyId.trim()) {
    throw new RangeError('Rotation model body identifier is invalid.');
  }
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be finite and positive.`);
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`);
}
