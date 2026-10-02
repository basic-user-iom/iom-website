import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Quaternion, Vector3 } from 'three';
import { EarthRotationModel, greenwichMeanSiderealAngle } from '../../simulation/bodies/EarthRotationModel';
import { getEphemerisRotationModel } from '../../simulation/bodies/RotationModelCatalog';
import { ConstantRateRotationModel, createRotationState, rotateInertialVectorToBodyLocal } from '../../simulation/bodies/RotationModel';
import { dateUtcToApproximateTdb, dateUtcToJulianDateUtc, J2000_JD_TDB } from '../../simulation/core/JulianDate';
import { createVec3d } from '../../simulation/core/Vec3d';
import { GeneratedEphemerisProvider } from '../../simulation/ephemeris/GeneratedEphemerisProvider';
import { createEphemerisStateVector, type GeneratedEphemerisManifest } from '../../simulation/ephemeris/EphemerisTypes';

const model = new EarthRotationModel();
const rad = Math.PI / 180;
const jd = (iso: string) => dateUtcToApproximateTdb(new Date(iso));
const manifest = JSON.parse(readFileSync(resolve('src/data/generated/solar-system-ephemeris.manifest.json'), 'utf8')) as GeneratedEphemerisManifest;
const binary = new Uint8Array(readFileSync(resolve('src/data/generated/solar-system-ephemeris.v1.bin')));
const ephemeris = GeneratedEphemerisProvider.fromBinary(binary.buffer, manifest);
function sunDirection(iso: string, rotation = model): Vector3 {
  const epoch = jd(iso);
  const earth = ephemeris.sample('earth', epoch, createEphemerisStateVector());
  const sun = ephemeris.sample('sun', epoch, createEphemerisStateVector());
  const q = rotation.sample({ jdTdb: epoch }, createRotationState()).orientation;
  const local = rotateInertialVectorToBodyLocal(createVec3d(), {
    x: sun.positionM.x - earth.positionM.x,
    y: sun.positionM.y - earth.positionM.y,
    z: sun.positionM.z - earth.positionM.z,
  }, q);
  return new Vector3(local.x, local.y, local.z).normalize();
}

// Independent low-precision solar declination/equation-of-time reference.
// https://gml.noaa.gov/grad/solcalc/solareqns.PDF
// Does not use GMST, quaternions, Earth orientation or the JPL ephemeris.
function noaaSunDirection(iso: string): Vector3 {
  const date = new Date(iso);
  const year = date.getUTCFullYear();
  const daysInYear = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
  const elapsedDays = (date.getTime() - Date.UTC(year, 0, 1)) / 86400000;
  const gamma = 2 * Math.PI / daysInYear * (elapsedDays - 0.5);
  const equationMinutes = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma)
    - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const longitude = (180 - (utcMinutes + equationMinutes) / 4) * rad;
  return new Vector3(Math.cos(declination) * Math.cos(longitude), Math.cos(declination) * Math.sin(longitude), Math.sin(declination));
}
// USNO solar coordinates provide a tighter independent seasonal reference.
// Equation of time -> geographic subsolar longitude, without Earth quaternions.
// https://aa.usno.navy.mil/faq/sun_approx
function usnoSunDirection(iso: string): Vector3 {
  const date = new Date(iso);
  const d = dateUtcToJulianDateUtc(date) - J2000_JD_TDB;
  const g = (357.529 + 0.98560028 * d) * rad;
  const q = ((280.459 + 0.98564736 * d) % 360) * rad;
  const longitude = q + (1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
  const obliquity = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(obliquity) * Math.sin(longitude), Math.cos(longitude));
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(longitude));
  const equationAngle = q - ra;
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const subsolarLongitude = Math.PI - utcHours * Math.PI / 12 - equationAngle;
  return new Vector3(Math.cos(declination) * Math.cos(subsolarLongitude),
    Math.cos(declination) * Math.sin(subsolarLongitude), Math.sin(declination));
}

const orientation = (epoch: number) => {
  const q = model.sample({ jdTdb: epoch }, createRotationState()).orientation;
  return new Quaternion(q.x, q.y, q.z, q.w);
};

describe('UTC-anchored Earth orientation', () => {
  it('registers Greenwich rotation and recovers the J2000 reference sidereal time', () => {
    expect(getEphemerisRotationModel('earth')).toBeInstanceOf(EarthRotationModel);
    const hours = greenwichMeanSiderealAngle(jd('2000-01-01T12:00:00Z')) * 12 / Math.PI;
    expect(hours).toBeCloseTo(18.697374558, 5);
    const north = new Vector3(0, 0, 1).applyQuaternion(orientation(J2000_JD_TDB));
    expect(north.x).toBeCloseTo(0, 12);
    expect(north.y).toBeCloseTo(Math.sin(23.439291111111 * rad), 12);
    expect(north.z).toBeCloseTo(Math.cos(23.439291111111 * rad), 12);
  });

  it.each(['2000-03-20T06:00:00Z', '2026-06-21T12:00:00Z', '2026-10-02T14:30:33Z',
    '2026-10-02T15:35:00Z', '2026-12-21T18:00:00Z', '2050-09-22T00:00:00Z', '2099-03-20T12:00:00Z'])(
  'agrees with the independent NOAA subsolar direction at %s', iso => {
    const actual = sunDirection(iso);
    const reference = noaaSunDirection(iso);
    expect(actual.angleTo(reference) / rad).toBeLessThan(0.6);
  });

  it.each([2000, 2026, 2050, 2099])('matches USNO solar coordinates through all seasons in %s', year => {
    for (let month = 1; month <= 12; month++) {
      const iso = String(year) + '-' + String(month).padStart(2, '0') + '-15T15:35:00Z';
      expect(sunDirection(iso).angleTo(usnoSunDirection(iso)) / rad).toBeLessThan(0.04);
    }
  });

  it('lights the correct geographic hemisphere at the reported UTC time', () => {
    const iso = '2026-10-02T14:30:33Z';
    const sun = sunDirection(iso);
    const northLatitude = 45 * rad;
    const eastLongitude = 15 * rad;
    const europe = new Vector3(Math.cos(northLatitude) * Math.cos(eastLongitude),
      Math.cos(northLatitude) * Math.sin(eastLongitude), Math.sin(northLatitude));
    expect(Math.asin(europe.dot(sun)) / rad).toBeGreaterThan(20);
    expect(europe.clone().negate().dot(sun)).toBeLessThan(0);
    // The previous arbitrary phase and reversed tilt caused the reported night.
    const old = new ConstantRateRotationModel({ bodyId: 'earth',
      rotationPeriodSeconds: 0.99726968 * 86400, axialTiltRad: 23.439291111111 * rad });
    const epoch = jd(iso);
    const earth = ephemeris.sample('earth', epoch, createEphemerisStateVector());
    const solar = ephemeris.sample('sun', epoch, createEphemerisStateVector());
    const oldQ = old.sample({ jdTdb: epoch }, createRotationState()).orientation;
    const oldSun = rotateInertialVectorToBodyLocal(createVec3d(), {
      x: solar.positionM.x - earth.positionM.x, y: solar.positionM.y - earth.positionM.y,
      z: solar.positionM.z - earth.positionM.z,
    }, oldQ);
    expect(europe.dot(new Vector3(oldSun.x, oldSun.y, oldSun.z).normalize())).toBeLessThan(0);
    console.info('Earth subsolar point at screenshot UTC', {
      latitudeDeg: Math.asin(sun.z) / rad,
      longitudeDeg: Math.atan2(sun.y, sun.x) / rad,
      referenceLatitudeDeg: Math.asin(usnoSunDirection(iso).z) / rad,
    });
  });

  it('has the correct solstice seasons and noon/midnight longitude progression', () => {
    expect(Math.asin(sunDirection('2026-06-21T12:00:00Z').z) / rad).toBeCloseTo(23.44, 1);
    expect(Math.asin(sunDirection('2026-12-21T12:00:00Z').z) / rad).toBeCloseTo(-23.44, 1);
    expect(sunDirection('2026-03-20T12:00:00Z').x).toBeGreaterThan(0.99);
    expect(sunDirection('2026-03-21T00:00:00Z').x).toBeLessThan(-0.99);
  });

  it('is continuous at UTC midnight, reversible and independent of sampling order', () => {
    const midnight = jd('2026-10-03T00:00:00Z');
    const before = orientation(midnight - 0.5 / 86400);
    const after = orientation(midnight + 0.5 / 86400);
    expect(before.angleTo(after)).toBeCloseTo(2 * Math.PI / 86164.1, 6);
    for (const epoch of [jd('2099-12-31T23:59:59Z'), J2000_JD_TDB, midnight]) {
      const initial = orientation(epoch);
      expect(initial.length()).toBeCloseTo(1, 12);
      orientation(epoch + 10);
      expect(orientation(epoch).angleTo(initial)).toBeLessThan(1e-7);
    }
  });

  it('reports angular velocity consistent with the rotation', () => {
    const epoch = jd('2026-10-02T14:30:33Z');
    const step = 10 / 86400;
    const delta = orientation(epoch + step).multiply(orientation(epoch - step).invert());
    if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
    const angle = 2 * Math.atan2(Math.hypot(delta.x, delta.y, delta.z), delta.w);
    const measured = new Vector3(delta.x, delta.y, delta.z).normalize().multiplyScalar(angle / (2 * step * 86400));
    const v = model.sample({ jdTdb: epoch }, createRotationState()).angularVelocityRadPerSec;
    const reported = new Vector3(v.x, v.y, v.z);
    expect(measured.distanceTo(reported) / reported.length()).toBeLessThan(1e-5);
  });

  it('rejects invalid dates', () => {
    expect(() => orientation(NaN)).toThrow(RangeError);
    expect(() => orientation(Infinity)).toThrow(RangeError);
  });
});
