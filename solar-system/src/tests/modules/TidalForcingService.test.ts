import { ConstantRateRotationModel } from '../../simulation/bodies/RotationModel';
import { J2000_JD_TDB } from '../../simulation/core/JulianDate';
import {
  GRAVITATIONAL_CONSTANT_M3_KG_S2,
  SECONDS_PER_DAY,
} from '../../simulation/core/Units';
import { createVec3d, setVec3d, type Vec3d } from '../../simulation/core/Vec3d';
import type { EphemerisProvider } from '../../simulation/ephemeris/EphemerisProvider';
import type {
  EphemerisCoverage,
  EphemerisStateVector,
} from '../../simulation/ephemeris/EphemerisTypes';
import type { DataProvenance } from '../../simulation/bodies/DataProvenance';
import {
  EphemerisTidalForcingService,
  createTidalForcingSample,
  createTidalPotentialComponents,
  quadrupoleTidalPotential,
  type TidalPerturberId,
} from '../../simulation/modules/TidalForcingService';

type PositionTuple = readonly [number, number, number];

class FixedEphemerisProvider implements EphemerisProvider {
  public readonly id = 'fixed-tidal-test';
  public readonly bodyIds: readonly string[];
  readonly #positions: Readonly<Record<string, PositionTuple>>;

  public constructor(positions: Readonly<Record<string, PositionTuple>>) {
    this.#positions = positions;
    this.bodyIds = Object.keys(positions);
  }

  public hasBody(bodyId: string): boolean {
    return this.#positions[bodyId] !== undefined;
  }

  public getCoverage(bodyId: string): EphemerisCoverage | undefined {
    if (!this.hasBody(bodyId)) return undefined;
    return undefined;
  }

  public getProvenance(bodyId: string): DataProvenance | undefined {
    if (!this.hasBody(bodyId)) return undefined;
    return undefined;
  }

  public sample(
    bodyId: string,
    jdTdb: number,
    out: EphemerisStateVector,
  ): EphemerisStateVector {
    const position = this.#positions[bodyId];
    if (position === undefined) throw new RangeError(`Unknown body "${bodyId}".`);
    out.jdTdb = jdTdb;
    setVec3d(out.positionM, position[0], position[1], position[2]);
    setVec3d(out.velocityMps, 0, 0, 0);
    return out;
  }
}

const EARTH_RADIUS_M = 6_000_000;
const MOON_DISTANCE_M = 400_000_000;
const SUN_DISTANCE_M = 150_000_000_000;
const MOON_MASS_KG = 2e20;
const SUN_MASS_KG = 3e30;

function createService(
  provider: EphemerisProvider = new FixedEphemerisProvider({
    earth: [0, 0, 0],
    moon: [MOON_DISTANCE_M, 0, 0],
    sun: [0, SUN_DISTANCE_M, 0],
  }),
): EphemerisTidalForcingService {
  return new EphemerisTidalForcingService({
    ephemerisProvider: provider,
    earthRotationModel: new ConstantRateRotationModel({
      bodyId: 'earth',
      rotationPeriodSeconds: SECONDS_PER_DAY,
      epochJdTdb: J2000_JD_TDB,
    }),
    earthRadiusM: EARTH_RADIUS_M,
    moonMassKg: MOON_MASS_KG,
    sunMassKg: SUN_MASS_KG,
  });
}

function expectRelativeClose(actual: number, expected: number, tolerance = 1e-12): void {
  const scale = Math.max(Math.abs(actual), Math.abs(expected), Number.MIN_VALUE);
  expect(Math.abs(actual - expected) / scale).toBeLessThanOrEqual(tolerance);
}

describe('EphemerisTidalForcingService', () => {
  it('derives Earth-fixed subpoints, component potentials, and a trace-free tensor', () => {
    const service = createService();
    const out = createTidalForcingSample();
    const moonPosition = out.moonPositionEarthFixedM;
    const sunPosition = out.sunPositionEarthFixedM;
    const tensor = out.tidalTensorEarthFixed;
    const returned = service.sampleEarth(J2000_JD_TDB, out);

    expect(returned).toBe(out);
    expect(out.moonPositionEarthFixedM).toBe(moonPosition);
    expect(out.sunPositionEarthFixedM).toBe(sunPosition);
    expect(out.tidalTensorEarthFixed).toBe(tensor);
    expect(out.moonPositionEarthFixedM).toEqual(createVec3d(MOON_DISTANCE_M, 0, 0));
    expect(out.sunPositionEarthFixedM).toEqual(createVec3d(0, SUN_DISTANCE_M, 0));
    expect(out.lunarDistanceM).toBe(MOON_DISTANCE_M);
    expect(out.solarDistanceM).toBe(SUN_DISTANCE_M);
    expect(out.sublunarLatRad).toBe(0);
    expect(out.sublunarLonRad).toBe(0);
    expect(out.subsolarLatRad).toBe(0);
    expect(out.subsolarLonRad).toBeCloseTo(Math.PI / 2, 14);

    const lunarPotential =
      GRAVITATIONAL_CONSTANT_M3_KG_S2 *
      MOON_MASS_KG *
      EARTH_RADIUS_M ** 2 /
      MOON_DISTANCE_M ** 3;
    const solarPotential =
      -0.5 *
      GRAVITATIONAL_CONSTANT_M3_KG_S2 *
      SUN_MASS_KG *
      EARTH_RADIUS_M ** 2 /
      SUN_DISTANCE_M ** 3;
    expectRelativeClose(out.lunarPotential, lunarPotential);
    expectRelativeClose(out.solarPotential, solarPotential);
    expectRelativeClose(out.combinedPotential, lunarPotential + solarPotential);

    const lunarTensorScale =
      GRAVITATIONAL_CONSTANT_M3_KG_S2 * MOON_MASS_KG / MOON_DISTANCE_M ** 3;
    const solarTensorScale =
      GRAVITATIONAL_CONSTANT_M3_KG_S2 * SUN_MASS_KG / SUN_DISTANCE_M ** 3;
    expectRelativeClose(out.lunarTidalTensorScaleS2, lunarTensorScale);
    expectRelativeClose(out.solarTidalTensorScaleS2, solarTensorScale);
    expect(Number.isFinite(out.lunarTidalTensorScaleS2)).toBe(true);
    expect(Number.isFinite(out.solarTidalTensorScaleS2)).toBe(true);
    expect(out.lunarTidalTensorScaleS2).toBeGreaterThanOrEqual(0);
    expect(out.solarTidalTensorScaleS2).toBeGreaterThanOrEqual(0);
    expectRelativeClose(tensor[0] ?? Number.NaN, 2 * lunarTensorScale - solarTensorScale);
    expectRelativeClose(tensor[4] ?? Number.NaN, -lunarTensorScale + 2 * solarTensorScale);
    expectRelativeClose(tensor[8] ?? Number.NaN, -lunarTensorScale - solarTensorScale);
    for (const index of [1, 2, 3, 5, 6, 7]) {
      expect(tensor[index]).toBe(0);
    }
    const trace = (tensor[0] ?? 0) + (tensor[4] ?? 0) + (tensor[8] ?? 0);
    expect(Math.abs(trace)).toBeLessThan(
      1e-12 * Math.max(lunarTensorScale, solarTensorScale),
    );
  });

  it('rotates inertial Moon and Sun geometry into reusable Earth-fixed subpoints', () => {
    const service = createService();
    const out = createTidalForcingSample();
    const moonPosition = out.moonPositionEarthFixedM;
    const sunPosition = out.sunPositionEarthFixedM;
    const tensor = out.tidalTensorEarthFixed;

    service.sampleEarth(J2000_JD_TDB + 0.25, out);

    expect(out.moonPositionEarthFixedM).toBe(moonPosition);
    expect(out.sunPositionEarthFixedM).toBe(sunPosition);
    expect(out.tidalTensorEarthFixed).toBe(tensor);
    expect(out.moonPositionEarthFixedM.x / out.lunarDistanceM).toBeCloseTo(0, 14);
    expect(out.moonPositionEarthFixedM.y / out.lunarDistanceM).toBeCloseTo(-1, 14);
    expect(out.moonPositionEarthFixedM.z / out.lunarDistanceM).toBeCloseTo(0, 14);
    expect(out.sunPositionEarthFixedM.x / out.solarDistanceM).toBeCloseTo(1, 14);
    expect(out.sunPositionEarthFixedM.y / out.solarDistanceM).toBeCloseTo(0, 14);
    expect(out.sunPositionEarthFixedM.z / out.solarDistanceM).toBeCloseTo(0, 14);
    expect(out.sublunarLatRad).toBeCloseTo(0, 14);
    expect(out.sublunarLonRad).toBeCloseTo(-Math.PI / 2, 14);
    expect(out.subsolarLatRad).toBeCloseTo(0, 14);
    expect(out.subsolarLonRad).toBeCloseTo(0, 14);

    expectSubpointMatchesDirection(
      out.sublunarLatRad,
      out.sublunarLonRad,
      out.moonPositionEarthFixedM,
      out.lunarDistanceM,
    );
    expectSubpointMatchesDirection(
      out.subsolarLatRad,
      out.subsolarLonRad,
      out.sunPositionEarthFixedM,
      out.solarDistanceM,
    );
  });

  it('evaluates separate and combined equilibrium potential at any fixed point', () => {
    const service = createService();
    const out = createTidalPotentialComponents();
    const point = createVec3d(0, EARTH_RADIUS_M, 0);
    const returned = service.equilibriumPotentialAtEarthFixedPoint(
      point,
      J2000_JD_TDB,
      out,
    );

    expect(returned).toBe(out);
    expect(out.lunarPotential).toBe(
      quadrupoleTidalPotential(
        point,
        createVec3d(MOON_DISTANCE_M, 0, 0),
        MOON_MASS_KG,
      ),
    );
    expect(out.solarPotential).toBe(
      quadrupoleTidalPotential(
        point,
        createVec3d(0, SUN_DISTANCE_M, 0),
        SUN_MASS_KG,
      ),
    );
    expect(out.combinedPotential).toBe(out.lunarPotential + out.solarPotential);
    expect(quadrupoleTidalPotential(createVec3d(), point, MOON_MASS_KG)).toBe(0);
  });

  it('returns exact point-minus-center differential acceleration without allocation', () => {
    const service = createService();
    const point = createVec3d(EARTH_RADIUS_M, 0, 0);
    const out: Vec3d = createVec3d();
    const returned = service.differentialAccelerationAtEarthFixedPoint(
      point,
      'moon',
      J2000_JD_TDB,
      out,
    );
    const gravitationalParameter = GRAVITATIONAL_CONSTANT_M3_KG_S2 * MOON_MASS_KG;
    const expectedX =
      gravitationalParameter / (MOON_DISTANCE_M - EARTH_RADIUS_M) ** 2 -
      gravitationalParameter / MOON_DISTANCE_M ** 2;

    expect(returned).toBe(out);
    expectRelativeClose(out.x, expectedX);
    expect(out.y).toBe(0);
    expect(out.z).toBe(0);
  });

  it('rejects missing inputs, invalid points, and unknown runtime perturbers', () => {
    expect(() => createService(new FixedEphemerisProvider({
      earth: [0, 0, 0],
      moon: [MOON_DISTANCE_M, 0, 0],
    }))).toThrow(/missing "sun"/);

    const service = createService();
    expect(() => service.equilibriumPotentialAtEarthFixedPoint(
      createVec3d(Number.NaN, 0, 0),
      J2000_JD_TDB,
    )).toThrow(/finite/);
    expect(() => service.differentialAccelerationAtEarthFixedPoint(
      createVec3d(),
      'jupiter' as TidalPerturberId,
      J2000_JD_TDB,
    )).toThrow(/Unknown tidal perturber/);
  });
});

function expectSubpointMatchesDirection(
  latitudeRad: number,
  longitudeRad: number,
  positionEarthFixedM: Readonly<Vec3d>,
  distanceM: number,
): void {
  const cosLatitude = Math.cos(latitudeRad);
  expect(cosLatitude * Math.cos(longitudeRad)).toBeCloseTo(
    positionEarthFixedM.x / distanceM,
    14,
  );
  expect(cosLatitude * Math.sin(longitudeRad)).toBeCloseTo(
    positionEarthFixedM.y / distanceM,
    14,
  );
  expect(Math.sin(latitudeRad)).toBeCloseTo(positionEarthFixedM.z / distanceM, 14);
}
