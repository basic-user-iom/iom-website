import {
  ASTRONOMICAL_UNIT_M,
  GRAVITATIONAL_CONSTANT_M3_KG_S2,
} from '../../../simulation/core/Units';
import {
  createBlackHoleCapturedInitialState,
  createDefaultCompleteConsumptionParameters,
  createDefaultPhysicsFlybyParameters,
  SOLAR_MASS_KG,
  type BlackHoleCapturedInitialState,
  type BlackHoleEncounterParameters,
  type CompleteConsumptionParameters,
} from '../../../simulation/scenarios/black-hole';

const BODY_FIXTURES = Object.freeze([
  ['sun', SOLAR_MASS_KG, 695_700_000, 0],
  ['mercury', 3.301_03e23, 2_439_700, 0.387],
  ['venus', 4.867_31e24, 6_051_800, 0.723],
  ['earth', 5.972_17e24, 6_371_008.4, 1],
  ['mars', 6.416_91e23, 3_389_500, 1.524],
  ['jupiter', 1.898_125e27, 69_911_000, 5.203],
  ['saturn', 5.683_17e26, 58_232_000, 9.537],
  ['uranus', 8.680_99e25, 25_362_000, 19.191],
  ['neptune', 1.024_092e26, 24_622_000, 30.069],
] as const);

export function solarSystemInitialState(): BlackHoleCapturedInitialState {
  const positions = new Float64Array(BODY_FIXTURES.length * 3);
  const velocities = new Float64Array(BODY_FIXTURES.length * 3);
  const masses = new Float64Array(BODY_FIXTURES.length);
  const radii = new Float64Array(BODY_FIXTURES.length);
  for (let index = 0; index < BODY_FIXTURES.length; index += 1) {
    const fixture = BODY_FIXTURES[index];
    if (fixture === undefined) continue;
    const [, massKg, radiusM, distanceAu] = fixture;
    const distanceM = distanceAu * ASTRONOMICAL_UNIT_M;
    positions[index * 3] = distanceM;
    if (distanceM > 0) {
      velocities[index * 3 + 1] = Math.sqrt(
        GRAVITATIONAL_CONSTANT_M3_KG_S2 * SOLAR_MASS_KG / distanceM,
      );
    }
    masses[index] = massKg;
    radii[index] = radiusM;
  }
  return createBlackHoleCapturedInitialState({
    bodyIds: BODY_FIXTURES.map(([bodyId]) => bodyId),
    positionsM: positions,
    velocitiesMps: velocities,
    massesKg: masses,
    radiiM: radii,
  });
}
export function fastPhysicsParameters(): BlackHoleEncounterParameters {
  const defaults = createDefaultPhysicsFlybyParameters(solarSystemInitialState());
  return {
    ...defaults,
    durationSeconds: 3,
    physicsSecondsPerScenarioSecond: 300,
  };
}

export function fastCinematicParameters(): CompleteConsumptionParameters {
  const defaults = createDefaultCompleteConsumptionParameters(solarSystemInitialState());
  return {
    ...defaults,
    durationSeconds: 3,
    physicsSecondsPerScenarioSecond: 300,
    infall: {
      ...defaults.infall,
      stagingStartSeconds: 0.1,
      stagingIntervalSeconds: 0.3,
    },
  };
}
