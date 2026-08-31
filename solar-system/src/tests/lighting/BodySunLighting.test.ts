import {
  classifyIlluminationRegion,
  createBodySunLightingSample,
  daylightLambertFactor,
  NOMINAL_SOLAR_IRRADIANCE_AT_1_AU_W_M2,
  sampleBodySunLighting,
  smoothTerminatorDayFactor,
  solarIncidenceCosine,
} from '../../simulation/lighting/BodySunLighting';
import { ASTRONOMICAL_UNIT_M } from '../../simulation/core/Units';
import { createVec3d } from '../../simulation/core/Vec3d';

describe('body-local Sun lighting', () => {
  it('derives precise inertial, scene, and body-local directions at one AU', () => {
    const out = createBodySunLightingSample();
    const inertial = out.directionInertial;
    const scene = out.directionScene;
    const local = out.directionBodyLocal;
    const returned = sampleBodySunLighting(
      out,
      createVec3d(ASTRONOMICAL_UNIT_M, 0, 0),
      createVec3d(),
      { x: 0, y: 0, z: 0, w: 1 },
    );

    expect(returned).toBe(out);
    expect(out.directionInertial).toBe(inertial);
    expect(out.directionScene).toBe(scene);
    expect(out.directionBodyLocal).toBe(local);
    expect(out.distanceM).toBe(ASTRONOMICAL_UNIT_M);
    expect(out.relativeIrradianceAtOneAu).toBe(1);
    expect(out.irradianceWm2).toBe(NOMINAL_SOLAR_IRRADIANCE_AT_1_AU_W_M2);
    expect(out.directionInertial.x).toBeCloseTo(-1, 14);
    expect(out.directionInertial.y).toBe(0);
    expect(out.directionInertial.z).toBe(0);
    expect(out.directionScene.x).toBeCloseTo(-1, 14);
    expect(out.directionScene.y).toBe(0);
    expect(Math.abs(out.directionScene.z)).toBe(0);
    expect(out.directionBodyLocal.x).toBeCloseTo(-1, 14);
    expect(out.directionBodyLocal.y).toBe(0);
    expect(out.directionBodyLocal.z).toBe(0);
  });

  it('maps an inertial Sun direction through scene axes and inverse body rotation', () => {
    const halfAngle = Math.PI / 4;
    const out = sampleBodySunLighting(
      createBodySunLightingSample(),
      createVec3d(),
      createVec3d(0, 2 * ASTRONOMICAL_UNIT_M, 0),
      { x: 0, y: 0, z: Math.sin(halfAngle), w: Math.cos(halfAngle) },
    );

    expect(out.directionScene.x).toBeCloseTo(0, 14);
    expect(out.directionScene.y).toBeCloseTo(0, 14);
    expect(out.directionScene.z).toBeCloseTo(-1, 14);
    expect(out.directionBodyLocal.x).toBeCloseTo(1, 14);
    expect(out.directionBodyLocal.y).toBeCloseTo(0, 14);
    expect(out.directionBodyLocal.z).toBeCloseTo(0, 14);
    expect(out.relativeIrradianceAtOneAu).toBeCloseTo(0.25, 14);
  });

  it('provides normalized day, night, and terminator helpers', () => {
    expect(solarIncidenceCosine(createVec3d(20, 0, 0), createVec3d(4, 0, 0))).toBe(1);
    expect(solarIncidenceCosine(createVec3d(0, 2, 0), createVec3d(1, 0, 0))).toBe(0);
    expect(solarIncidenceCosine(
      createVec3d(Number.MAX_VALUE, Number.MAX_VALUE, 0),
      createVec3d(Number.MAX_VALUE, 0, 0),
    )).toBeCloseTo(Math.SQRT1_2, 14);
    expect(daylightLambertFactor(-0.4)).toBe(0);
    expect(daylightLambertFactor(0.4)).toBe(0.4);
    expect(daylightLambertFactor(4)).toBe(1);
    expect(smoothTerminatorDayFactor(-0.02)).toBe(0);
    expect(smoothTerminatorDayFactor(0)).toBe(0.5);
    expect(smoothTerminatorDayFactor(0.02)).toBe(1);
    expect(classifyIlluminationRegion(0.03)).toBe('day');
    expect(classifyIlluminationRegion(0)).toBe('terminator');
    expect(classifyIlluminationRegion(-0.03)).toBe('night');
  });

  it('rejects degenerate and non-finite inputs', () => {
    expect(() => sampleBodySunLighting(
      createBodySunLightingSample(),
      createVec3d(1, 2, 3),
      createVec3d(1, 2, 3),
      { x: 0, y: 0, z: 0, w: 1 },
    )).toThrow(/distinct/);
    expect(() => solarIncidenceCosine(createVec3d(), createVec3d(1, 0, 0))).toThrow(/non-zero/);
    expect(() => smoothTerminatorDayFactor(0, 0)).toThrow(/half-width/);
    expect(() => classifyIlluminationRegion(0, 2)).toThrow(/half-width/);
  });
});
