import {
  ConstantRateRotationModel,
  SynchronousRotationModel,
  createRotationState,
  rotateBodyLocalVectorToInertial,
  rotateInertialVectorToBodyLocal,
} from '../../simulation/bodies/RotationModel';
import {
  EPHEMERIS_ROTATION_MODELS,
  getEphemerisRotationModel,
} from '../../simulation/bodies/RotationModelCatalog';
import { EPHEMERIS_BODY_IDS } from '../../simulation/bodies/EphemerisBodyCatalog';
import { J2000_JD_TDB } from '../../simulation/core/JulianDate';
import { SECONDS_PER_DAY } from '../../simulation/core/Units';
import { createVec3d, type Vec3d } from '../../simulation/core/Vec3d';

function expectVectorClose(
  actual: Readonly<Vec3d>,
  expected: readonly [number, number, number],
  precision = 10,
): void {
  expect(actual.x).toBeCloseTo(expected[0], precision);
  expect(actual.y).toBeCloseTo(expected[1], precision);
  expect(actual.z).toBeCloseTo(expected[2], precision);
}

describe('constant-rate rotation models', () => {
  it('preserves the Earth seed tilt and advances at its sidereal rate', () => {
    const earth = getEphemerisRotationModel('earth');
    if (!(earth instanceof ConstantRateRotationModel)) {
      throw new Error('Earth must use a constant-rate rotation model.');
    }
    const state = createRotationState();
    const originalOrientation = state.orientation;
    const originalAngularVelocity = state.angularVelocityRadPerSec;
    const returned = earth.sample({ jdTdb: J2000_JD_TDB }, state);
    const spinAxis = rotateBodyLocalVectorToInertial(
      createVec3d(),
      createVec3d(0, 0, 1),
      state.orientation,
    );

    expect(returned).toBe(state);
    expect(state.orientation).toBe(originalOrientation);
    expect(state.angularVelocityRadPerSec).toBe(originalAngularVelocity);
    expectVectorClose(spinAxis, [0, -Math.sin(earth.axialTiltRad), Math.cos(earth.axialTiltRad)]);
    expect(Math.acos(spinAxis.z)).toBeCloseTo(earth.axialTiltRad, 12);
    expect(Math.hypot(
      state.angularVelocityRadPerSec.x,
      state.angularVelocityRadPerSec.y,
      state.angularVelocityRadPerSec.z,
    )).toBeCloseTo(Math.PI * 2 / earth.rotationPeriodSeconds, 15);
    expect(Math.hypot(
      state.orientation.x,
      state.orientation.y,
      state.orientation.z,
      state.orientation.w,
    )).toBeCloseTo(1, 14);

    earth.sample(
      {
        jdTdb:
          J2000_JD_TDB + earth.rotationPeriodSeconds / (4 * SECONDS_PER_DAY),
      },
      state,
    );
    const primeMeridian = rotateBodyLocalVectorToInertial(
      createVec3d(),
      createVec3d(1, 0, 0),
      state.orientation,
    );
    expectVectorClose(
      primeMeridian,
      [0, Math.cos(earth.axialTiltRad), Math.sin(earth.axialTiltRad)],
      8,
    );
  });

  it('represents Venus as a slowly retrograde rotator', () => {
    const venus = getEphemerisRotationModel('venus');
    if (!(venus instanceof ConstantRateRotationModel)) {
      throw new Error('Venus must use a constant-rate rotation model.');
    }
    const state = createRotationState();
    venus.sample({ jdTdb: J2000_JD_TDB }, state);

    expect(venus.retrograde).toBe(true);
    expect(state.angularVelocityRadPerSec.z).toBeLessThan(0);
    expect(Math.abs(state.angularVelocityRadPerSec.z)).toBeCloseTo(
      Math.PI * 2 / venus.rotationPeriodSeconds,
      15,
    );

    venus.sample(
      {
        jdTdb:
          J2000_JD_TDB + venus.rotationPeriodSeconds / (4 * SECONDS_PER_DAY),
      },
      state,
    );
    const localX = rotateBodyLocalVectorToInertial(
      createVec3d(),
      createVec3d(1, 0, 0),
      state.orientation,
    );
    expectVectorClose(localX, [0, -1, 0], 8);
  });

  it('uses Uranus\'s greater-than-90-degree pole as the single retrograde convention', () => {
    const uranus = getEphemerisRotationModel('uranus');
    if (!(uranus instanceof ConstantRateRotationModel)) {
      throw new Error('Uranus must use a constant-rate rotation model.');
    }
    const state = createRotationState();
    uranus.sample({ jdTdb: J2000_JD_TDB }, state);
    const spinAxis = rotateBodyLocalVectorToInertial(
      createVec3d(),
      createVec3d(0, 0, 1),
      state.orientation,
    );

    expect(uranus.axialTiltRad).toBeGreaterThan(Math.PI / 2);
    expect(uranus.retrograde).toBe(false);
    expect(spinAxis.z).toBeLessThan(0);
    expect(state.angularVelocityRadPerSec.z).toBeLessThan(0);
  });

  it('registers an explicit model for every ephemeris body', () => {
    expect(EPHEMERIS_ROTATION_MODELS.size).toBe(EPHEMERIS_BODY_IDS.length);
    for (const bodyId of EPHEMERIS_BODY_IDS) {
      expect(getEphemerisRotationModel(bodyId).bodyId).toBe(bodyId);
    }
    expect(getEphemerisRotationModel('moon')).toBeInstanceOf(SynchronousRotationModel);
  });
});
describe('synchronous rotation models', () => {
  const model = new SynchronousRotationModel({
    bodyId: 'moon',
    parentBodyId: 'earth',
    nominalRotationPeriodSeconds: 27.321_661 * SECONDS_PER_DAY,
  });

  it('points lunar local +X at Earth and follows the orbital normal', () => {
    const distanceM = 384_400_000;
    const tangentialSpeedMps = 1_022;
    const state = createRotationState();
    model.sample(
      {
        jdTdb: J2000_JD_TDB,
        bodyPositionM: createVec3d(distanceM, 0, 0),
        parentPositionM: createVec3d(),
        bodyVelocityMps: createVec3d(0, tangentialSpeedMps, 0),
        parentVelocityMps: createVec3d(),
      },
      state,
    );
    const earthFacing = rotateBodyLocalVectorToInertial(
      createVec3d(),
      createVec3d(1, 0, 0),
      state.orientation,
    );
    const orbitNorth = rotateBodyLocalVectorToInertial(
      createVec3d(),
      createVec3d(0, 0, 1),
      state.orientation,
    );

    expectVectorClose(earthFacing, [-1, 0, 0]);
    expectVectorClose(orbitNorth, [0, 0, 1]);
    expectVectorClose(state.angularVelocityRadPerSec, [0, 0, tangentialSpeedMps / distanceM], 15);
    expect(Math.hypot(
      state.orientation.x,
      state.orientation.y,
      state.orientation.z,
      state.orientation.w,
    )).toBeCloseTo(1, 14);

    const localAgain = rotateInertialVectorToBodyLocal(
      createVec3d(),
      earthFacing,
      state.orientation,
    );
    expectVectorClose(localAgain, [1, 0, 0]);
  });

  it('uses a deterministic ecliptic-north fallback without velocity data', () => {
    const state = createRotationState();
    model.sample(
      {
        jdTdb: J2000_JD_TDB,
        bodyPositionM: createVec3d(0, 0, 10),
        parentPositionM: createVec3d(),
      },
      state,
    );
    const earthFacing = rotateBodyLocalVectorToInertial(
      createVec3d(),
      createVec3d(1, 0, 0),
      state.orientation,
    );

    expectVectorClose(earthFacing, [0, 0, -1]);
    expect(Math.hypot(
      state.angularVelocityRadPerSec.x,
      state.angularVelocityRadPerSec.y,
      state.angularVelocityRadPerSec.z,
    )).toBeCloseTo(Math.PI * 2 / model.nominalRotationPeriodSeconds, 15);
  });

  it('rejects missing, coincident, and non-finite geometry', () => {
    const state = createRotationState();
    expect(() => model.sample({ jdTdb: J2000_JD_TDB }, state)).toThrow(/required/);
    expect(() => model.sample(
      {
        jdTdb: J2000_JD_TDB,
        bodyPositionM: createVec3d(1, 2, 3),
        parentPositionM: createVec3d(1, 2, 3),
      },
      state,
    )).toThrow(/distinct/);
    expect(() => rotateBodyLocalVectorToInertial(
      createVec3d(),
      createVec3d(1, 0, 0),
      { x: 0, y: 0, z: 0, w: 0 },
    )).toThrow(/quaternion/);
  });
});
