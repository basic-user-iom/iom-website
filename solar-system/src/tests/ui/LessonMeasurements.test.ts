import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateLessonMeasurements, geometricDaylightHours, moonPhaseOutline } from '../../learning/LessonMeasurements';
import { dateUtcToApproximateTdb } from '../../simulation/core/JulianDate';
import { GeneratedEphemerisProvider } from '../../simulation/ephemeris/GeneratedEphemerisProvider';
import { createEphemerisStateVector, type GeneratedEphemerisManifest } from '../../simulation/ephemeris/EphemerisTypes';

const manifest = JSON.parse(readFileSync(resolve('src/data/generated/solar-system-ephemeris.manifest.json'), 'utf8')) as GeneratedEphemerisManifest;
const bytes = new Uint8Array(readFileSync(resolve('src/data/generated/solar-system-ephemeris.v1.bin')));
const provider = GeneratedEphemerisProvider.fromBinary(bytes.buffer, manifest);
const measure = (utc: string) => {
  const jd = dateUtcToApproximateTdb(new Date(utc));
  return calculateLessonMeasurements(jd,
    provider.sample('sun', jd, createEphemerisStateVector()).positionM,
    provider.sample('earth', jd, createEphemerisStateVector()).positionM,
    provider.sample('moon', jd, createEphemerisStateVector()).positionM)!;
};

describe('Learning measurements from unchanged ephemerides', () => {
  it('distinguishes new, full and quarter viewing geometry, with waxing/waning handedness', () => {
    const earth = { x: 0, y: 0, z: 0 }, sun = { x: 1e11, y: 0, z: 0 };
    const phase = (x: number, y: number) => calculateLessonMeasurements(2451545, sun, earth, { x, y, z: 0 })!;
    expect(phase(1e8, 0).moonIlluminatedFraction).toBe(0);
    expect(phase(-1e8, 0).moonIlluminatedFraction).toBe(1);
    expect(phase(0, 1e8).moonIlluminatedFraction).toBeCloseTo(0.5, 2);
    expect(phase(0, 1e8).moonElongationDeg).toBeCloseTo(90);
    expect(phase(0, 1e8).waxing).toBe(true);
    expect(phase(0, -1e8).waxing).toBe(false);
  });
  it('gives opposite seasonal day lengths without changing the Earth axis', () => {
    const june = measure('2026-06-21T12:00:00Z');
    const december = measure('2026-12-21T12:00:00Z');
    const march = measure('2026-03-20T12:00:00Z');
    expect(june.solarDeclinationDeg).toBeCloseTo(23.44, 1);
    expect(december.solarDeclinationDeg).toBeCloseTo(-23.44, 1);
    expect(june.northDaylightHours).toBeCloseTo(15.43, 1);
    expect(june.southDaylightHours).toBeCloseTo(8.57, 1);
    expect(december.northDaylightHours).toBeLessThan(9);
    expect(december.southDaylightHours).toBeGreaterThan(15);
    expect(march.northDaylightHours).toBeCloseTo(12, 1);
    expect(june.northDaylightHours + june.southDaylightHours).toBeCloseTo(24, 10);
  });
  it('matches the phase ranges described by the four teaching dates', () => {
    const nearNew = measure('2026-01-18T12:00:00Z');
    const first = measure('2026-01-26T12:00:00Z');
    const full = measure('2026-02-01T12:00:00Z');
    const last = measure('2026-02-09T12:00:00Z');
    expect(nearNew.moonIlluminatedFraction).toBeLessThan(0.02);
    expect(first.moonIlluminatedFraction).toBeGreaterThan(0.45);
    expect(first.moonIlluminatedFraction).toBeLessThan(0.60);
    expect(first.waxing).toBe(true);
    expect(full.moonIlluminatedFraction).toBeGreaterThan(0.98);
    expect(last.moonIlluminatedFraction).toBeGreaterThan(0.4);
    expect(last.moonIlluminatedFraction).toBeLessThan(0.6);
    expect(last.waxing).toBe(false);
  });
  it('renders the requested illuminated area of the disc in both conventions', () => {
    for (const fraction of [0, 0.1, 0.5, 0.9, 1]) for (const waxing of [false, true]) {
      const points = [...moonPhaseOutline(fraction, waxing).matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]);
      let twiceArea = 0;
      for (let i = 0; i < points.length; i++) {
        const a = points[i]!, b = points[(i + 1) % points.length]!;
        twiceArea += a[0]! * b[1]! - b[0]! * a[1]!;
      }
      expect(Math.abs(twiceArea) / (2 * Math.PI * 42 ** 2)).toBeCloseTo(fraction, 3);
    }
  });
  it('handles polar day/night and refuses missing geometry instead of fabricating data', () => {
    expect(geometricDaylightHours(80, 23.4)).toBe(24);
    expect(geometricDaylightHours(-80, 23.4)).toBe(0);
    const zero = { x: 0, y: 0, z: 0 };
    expect(calculateLessonMeasurements(2451545, zero, zero, zero)).toBeNull();
  });
});
