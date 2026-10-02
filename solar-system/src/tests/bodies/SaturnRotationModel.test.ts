import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Quaternion, Vector3 } from 'three';
import { dateUtcToApproximateTdb, J2000_JD_TDB } from '../../simulation/core/JulianDate';
import { SaturnRotationModel, saturnPoleEcliptic } from '../../simulation/bodies/SaturnRotationModel';
import { createRotationState } from '../../simulation/bodies/RotationModel';
import { GeneratedEphemerisProvider } from '../../simulation/ephemeris/GeneratedEphemerisProvider';
import { createEphemerisStateVector, type GeneratedEphemerisManifest } from '../../simulation/ephemeris/EphemerisTypes';
import { getNaturalSatelliteDefinition } from '../../simulation/satellites/NaturalSatelliteCatalog';
import { sampleNaturalSatellite } from '../../simulation/satellites/NaturalSatelliteProvider';

const model = new SaturnRotationModel();
const jd = (date: string) => dateUtcToApproximateTdb(new Date(date));
const vec = (v: { x: number; y: number; z: number }) => new Vector3(v.x, v.y, v.z);
const pole = (epoch: number) => vec(saturnPoleEcliptic(epoch, { x: 0, y: 0, z: 0 }));
const orientation = (epoch: number) => {
  const q = model.sample({ jdTdb: epoch }, createRotationState()).orientation;
  return new Quaternion(q.x, q.y, q.z, q.w);
};
const manifest = JSON.parse(readFileSync(resolve('src/data/generated/solar-system-ephemeris.manifest.json'), 'utf8')) as GeneratedEphemerisManifest;
const binary = new Uint8Array(readFileSync(resolve('src/data/generated/solar-system-ephemeris.v1.bin')));
const ephemeris = GeneratedEphemerisProvider.fromBinary(binary.buffer, manifest);
function opening(date: string): number {
  const epoch = jd(date);
  const earth = ephemeris.sample('earth', epoch, createEphemerisStateVector());
  const saturn = ephemeris.sample('saturn', epoch, createEphemerisStateVector());
  return Math.asin(pole(epoch).dot(vec(earth.positionM).sub(vec(saturn.positionM)).normalize())) * 180 / Math.PI;
}

describe('IAU Saturn orientation in ECLIPJ2000', () => {
  it('recovers the NAIF reference pole in equatorial J2000 axes', () => {
    const equatorial = pole(J2000_JD_TDB).applyAxisAngle(new Vector3(1, 0, 0), 23.439291111111 * Math.PI / 180);
    expect(Math.atan2(equatorial.y, equatorial.x) * 180 / Math.PI).toBeCloseTo(40.589, 9);
    expect(Math.asin(equatorial.z) * 180 / Math.PI).toBeCloseTo(83.537, 9);
  });

  it.each([J2000_JD_TDB, jd('2025-03-23T12:00:00Z'), jd('2100-01-01T00:00:00Z')])('keeps the rendered north axis on the authoritative pole at %s', (epoch) => {
    const q = orientation(epoch);
    expect(q.length()).toBeCloseTo(1, 12);
    expect(new Vector3(0, 0, 1).applyQuaternion(q).distanceTo(pole(epoch))).toBeLessThan(1e-12);
    const initial = orientation(epoch);
    orientation(epoch + 100);
    expect(orientation(epoch).angleTo(initial)).toBeLessThan(1e-7);
  });

  it('reports angular velocity consistent with orientation changes', () => {
    const epoch = J2000_JD_TDB + 1000;
    const step = 1 / 86400;
    const delta = orientation(epoch + step).multiply(orientation(epoch - step).invert());
    if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
    const angle = 2 * Math.atan2(Math.hypot(delta.x, delta.y, delta.z), delta.w);
    const measured = new Vector3(delta.x, delta.y, delta.z).normalize().multiplyScalar(angle / (2 * step * 86400));
    const reported = model.sample({ jdTdb: epoch }, createRotationState()).angularVelocityRadPerSec;
    expect(measured.distanceTo(vec(reported)) / vec(reported).length()).toBeLessThan(1e-5);
  });

  it('matches the 23 March 2025 Earth ring-plane crossing and the subsequent seasonal opening', () => {
    const dates = ['2025-03-22T00:00:00Z', '2025-03-23T12:00:00Z', '2025-03-25T00:00:00Z', '2026-10-02T12:00:00Z', '2032-06-01T12:00:00Z'];
    const angles = dates.map(opening);
    console.info('Saturn geocentric ring opening (deg)', Object.fromEntries(dates.map((date, i) => [date, angles[i]])));
    expect(angles[0]! * angles[2]!).toBeLessThan(0);
    expect(Math.abs(angles[1]!)).toBeLessThan(0.1);
    expect(Math.abs(angles[3]!)).toBeGreaterThan(5);
    expect(Math.abs(angles[4]!)).toBeGreaterThan(25);
    expect(Math.abs(angles[4]!)).toBeLessThan(28);
  });

  it('aligns the ring normal with the anchored inner moons without flattening Iapetus', () => {
    const epoch = jd('2026-10-02T12:00:00Z');
    const inclinations: Record<string, number> = {};
    for (const id of ['enceladus', 'dione', 'rhea', 'titan', 'iapetus']) {
      const definition = getNaturalSatelliteDefinition(id);
      expect(definition).toBeDefined();
      const state = sampleNaturalSatellite(definition!, epoch);
      expect(state.source).toBe('JPL_HORIZONS_ANCHORED');
      const normal = vec(state.positionM).cross(vec(state.velocityMps)).normalize();
      inclinations[id] = normal.angleTo(pole(epoch)) * 180 / Math.PI;
      if (id === 'iapetus') expect(inclinations[id]).toBeGreaterThan(10);
      else expect(inclinations[id]).toBeLessThan(1);
    }
    console.info('Saturn moon inclination to ring plane (deg)', inclinations);
  });

  it('rejects nonfinite epochs', () => {
    expect(() => orientation(Number.NaN)).toThrow(RangeError);
    expect(() => orientation(Infinity)).toThrow(RangeError);
  });
});
