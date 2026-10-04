import { EarthRotationModel } from '../simulation/bodies/EarthRotationModel';
import { createRotationState, rotateInertialVectorToBodyLocal } from '../simulation/bodies/RotationModel';
import { createVec3d, dotVec3d, lengthVec3d, subtractVec3d, type Vec3d } from '../simulation/core/Vec3d';

const earthRotation = new EarthRotationModel();
const DEG = 180 / Math.PI;
const clampUnit = (value: number) => Math.min(1, Math.max(-1, value));
export interface LessonMeasurements {
  readonly jdTdb: number;
  readonly solarDeclinationDeg: number;
  readonly northDaylightHours: number;
  readonly southDaylightHours: number;
  readonly moonIlluminatedFraction: number;
  readonly moonElongationDeg: number;
  readonly moonEclipticLatitudeDeg: number;
  readonly waxing: boolean;
}

/** Geometric horizon, point Sun, fixed declination; deliberately not a sunrise forecast. */
export function geometricDaylightHours(latitudeDeg: number, declinationDeg: number): number {
  const latitude = latitudeDeg / DEG;
  const declination = declinationDeg / DEG;
  const cosineHourAngle = -Math.tan(latitude) * Math.tan(declination);
  return 24 * Math.acos(clampUnit(cosineHourAngle)) / Math.PI;
}

/** Inputs are the existing physical ECLIPJ2000 vectors, before renderer axis mapping. */
export function calculateLessonMeasurements(
  jdTdb: number, sun: Readonly<Vec3d>, earth: Readonly<Vec3d>, moon: Readonly<Vec3d>,
): LessonMeasurements | null {
  const earthToSun = subtractVec3d(createVec3d(), sun, earth);
  const earthToMoon = subtractVec3d(createVec3d(), moon, earth);
  const moonToSun = subtractVec3d(createVec3d(), sun, moon);
  const sunDistance = lengthVec3d(earthToSun);
  const moonDistance = lengthVec3d(earthToMoon);
  const moonSunDistance = lengthVec3d(moonToSun);
  if (!Number.isFinite(jdTdb) || ![sunDistance, moonDistance, moonSunDistance].every(n => Number.isFinite(n) && n > 0)) return null;
  const orientation = earthRotation.sample({ jdTdb }, createRotationState()).orientation;
  const localSun = rotateInertialVectorToBodyLocal(createVec3d(), earthToSun, orientation);
  const solarDeclinationDeg = Math.asin(clampUnit(localSun.z / sunDistance)) * DEG;
  const phaseCosine = clampUnit(-dotVec3d(moonToSun, earthToMoon) / (moonSunDistance * moonDistance));
  const longitudeDifference = (Math.atan2(earthToMoon.y, earthToMoon.x) - Math.atan2(earthToSun.y, earthToSun.x) + Math.PI * 2) % (Math.PI * 2);
  return {
    jdTdb, solarDeclinationDeg,
    northDaylightHours: geometricDaylightHours(45, solarDeclinationDeg),
    southDaylightHours: geometricDaylightHours(-45, solarDeclinationDeg),
    moonIlluminatedFraction: (1 + phaseCosine) / 2,
    moonElongationDeg: Math.acos(clampUnit(dotVec3d(earthToSun, earthToMoon) / (sunDistance * moonDistance))) * DEG,
    moonEclipticLatitudeDeg: Math.asin(clampUnit(earthToMoon.z / moonDistance)) * DEG,
    waxing: longitudeDifference < Math.PI,
  };
}

/** Orthographic illuminated disc; orientation is a teaching convention, not a sky position angle. */
export function moonPhaseOutline(fraction: number, waxing: boolean, radius = 42): string {
  const cosine = 1 - 2 * Math.max(0, Math.min(1, fraction));
  const side = waxing ? 1 : -1;
  const limb: string[] = [], terminator: string[] = [];
  for (let i = 0; i <= 64; i++) {
    const angle = -Math.PI / 2 + Math.PI * i / 64;
    const x = radius * Math.cos(angle), y = radius * Math.sin(angle);
    limb.push(`${(side * x).toFixed(3)},${y.toFixed(3)}`);
    terminator.unshift(`${(side * cosine * x).toFixed(3)},${y.toFixed(3)}`);
  }
  return `M${[...limb, ...terminator].join(' L')} Z`;
}
