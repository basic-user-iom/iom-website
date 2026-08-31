import type { Quaterniond } from '../bodies/RotationModel';
import { rotateInertialVectorToBodyLocal } from '../bodies/RotationModel';
import { ASTRONOMICAL_UNIT_M } from '../core/Units';
import { createVec3d, isFiniteVec3d, type Vec3d } from '../core/Vec3d';

/** Nominal total solar irradiance at 1 AU, suitable for browser lighting readouts. */
export const NOMINAL_SOLAR_IRRADIANCE_AT_1_AU_W_M2 = 1_361;

export interface BodySunLightingSample {
  distanceM: number;
  relativeIrradianceAtOneAu: number;
  irradianceWm2: number;
  /** Unit vector from the body toward the Sun in inertial ECLIPTIC axes. */
  readonly directionInertial: Vec3d;
  /** Same unit vector mapped to scene axes: (x, z, -y). */
  readonly directionScene: Vec3d;
  /** Same unit vector in the body's local orientation frame. */
  readonly directionBodyLocal: Vec3d;
}

export function createBodySunLightingSample(): BodySunLightingSample {
  return {
    distanceM: 0,
    relativeIrradianceAtOneAu: 0,
    irradianceWm2: 0,
    directionInertial: createVec3d(),
    directionScene: createVec3d(),
    directionBodyLocal: createVec3d(),
  };
}

/** Allocation-free body-local lighting sample from Float64 physical positions. */
export function sampleBodySunLighting(
  out: BodySunLightingSample,
  bodyPositionM: Readonly<Vec3d>,
  sunPositionM: Readonly<Vec3d>,
  bodyOrientation: Readonly<Quaterniond>,
): BodySunLightingSample {
  assertFiniteVector(bodyPositionM, 'Body position');
  assertFiniteVector(sunPositionM, 'Sun position');
  const x = sunPositionM.x - bodyPositionM.x;
  const y = sunPositionM.y - bodyPositionM.y;
  const z = sunPositionM.z - bodyPositionM.z;
  const distanceM = Math.hypot(x, y, z);
  if (!Number.isFinite(distanceM) || distanceM <= 0) {
    throw new RangeError('Body and Sun positions must be finite and distinct.');
  }
  const inverseDistance = 1 / distanceM;
  out.directionInertial.x = x * inverseDistance;
  out.directionInertial.y = y * inverseDistance;
  out.directionInertial.z = z * inverseDistance;
  out.directionScene.x = out.directionInertial.x;
  out.directionScene.y = out.directionInertial.z;
  out.directionScene.z = -out.directionInertial.y;
  rotateInertialVectorToBodyLocal(
    out.directionBodyLocal,
    out.directionInertial,
    bodyOrientation,
  );
  const relativeIrradiance = (ASTRONOMICAL_UNIT_M / distanceM) ** 2;
  if (!Number.isFinite(relativeIrradiance)) {
    throw new RangeError('Body-to-Sun distance produces non-finite irradiance.');
  }
  out.distanceM = distanceM;
  out.relativeIrradianceAtOneAu = relativeIrradiance;
  out.irradianceWm2 = NOMINAL_SOLAR_IRRADIANCE_AT_1_AU_W_M2 * relativeIrradiance;
  return out;
}

/** Cosine of the local solar zenith angle, clamped to [-1, 1]. */
export function solarIncidenceCosine(
  surfaceNormalBodyLocal: Readonly<Vec3d>,
  sunDirectionBodyLocal: Readonly<Vec3d>,
): number {
  assertFiniteVector(surfaceNormalBodyLocal, 'Surface normal');
  assertFiniteVector(sunDirectionBodyLocal, 'Sun direction');
  const normalScale = Math.max(
    Math.abs(surfaceNormalBodyLocal.x),
    Math.abs(surfaceNormalBodyLocal.y),
    Math.abs(surfaceNormalBodyLocal.z),
  );
  const sunScale = Math.max(
    Math.abs(sunDirectionBodyLocal.x),
    Math.abs(sunDirectionBodyLocal.y),
    Math.abs(sunDirectionBodyLocal.z),
  );
  if (normalScale === 0 || sunScale === 0) {
    throw new RangeError('Surface normal and Sun direction must be non-zero.');
  }
  const normalX = surfaceNormalBodyLocal.x / normalScale;
  const normalY = surfaceNormalBodyLocal.y / normalScale;
  const normalZ = surfaceNormalBodyLocal.z / normalScale;
  const sunX = sunDirectionBodyLocal.x / sunScale;
  const sunY = sunDirectionBodyLocal.y / sunScale;
  const sunZ = sunDirectionBodyLocal.z / sunScale;
  const inverseNormalLength = 1 / Math.hypot(normalX, normalY, normalZ);
  const inverseSunLength = 1 / Math.hypot(sunX, sunY, sunZ);
  const cosine =
    (normalX * sunX + normalY * sunY + normalZ * sunZ) *
    inverseNormalLength *
    inverseSunLength;
  return clamp(cosine, -1, 1);
}

/** Lambertian direct-light factor; zero throughout the night side. */
export function daylightLambertFactor(solarCosine: number): number {
  assertFinite(solarCosine, 'Solar incidence cosine');
  return clamp(solarCosine, 0, 1);
}

/**
 * Smooth day mask across a declared cosine half-width around the terminator.
 * Returns zero at night, one in daylight, and 0.5 on the geometric terminator.
 */
export function smoothTerminatorDayFactor(
  solarCosine: number,
  cosineHalfWidth = 0.02,
): number {
  assertFinite(solarCosine, 'Solar incidence cosine');
  if (!Number.isFinite(cosineHalfWidth) || cosineHalfWidth <= 0 || cosineHalfWidth > 1) {
    throw new RangeError('Terminator cosine half-width must be in (0, 1].');
  }
  const normalized = clamp(
    (solarCosine + cosineHalfWidth) / (2 * cosineHalfWidth),
    0,
    1,
  );
  return normalized * normalized * (3 - 2 * normalized);
}

export function classifyIlluminationRegion(
  solarCosine: number,
  terminatorCosineHalfWidth = 0.02,
): 'day' | 'terminator' | 'night' {
  assertFinite(solarCosine, 'Solar incidence cosine');
  if (
    !Number.isFinite(terminatorCosineHalfWidth) ||
    terminatorCosineHalfWidth < 0 ||
    terminatorCosineHalfWidth > 1
  ) {
    throw new RangeError('Terminator classification half-width must be in [0, 1].');
  }
  if (solarCosine > terminatorCosineHalfWidth) return 'day';
  if (solarCosine < -terminatorCosineHalfWidth) return 'night';
  return 'terminator';
}

function assertFiniteVector(value: Readonly<Vec3d>, label: string): void {
  if (!isFiniteVec3d(value)) throw new RangeError(`${label} must be finite.`);
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
