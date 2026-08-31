import {
  ASTRONOMICAL_UNIT_M,
  SECONDS_PER_DAY,
} from '../../core/Units';
import {
  BLACK_HOLE_ACCURACY_LEVELS,
  BLACK_HOLE_REQUIRED_BODY_IDS,
  type BlackHoleAccuracy,
  type BlackHoleCapturedInitialState,
  type BlackHoleEncounterParameters,
  type BlackHoleVector3,
  type CompleteConsumptionParameters,
  type ExternalBlackHoleInitialConditions,
} from './BlackHoleTypes';

export const SOLAR_MASS_KG = 1.988_47e30;
export const BLACK_HOLE_SCENARIO_FIXED_STEP_SECONDS = 1 / 30;
export const BLACK_HOLE_ALLOWED_SUBSTEPS_SECONDS = Object.freeze([
  14_400,
  3_600,
  900,
  300,
  60,
  10,
] as const);

export const BLACK_HOLE_MAX_SUBSTEP_BY_ACCURACY: Readonly<
  Record<BlackHoleAccuracy, number>
> = Object.freeze({
  balanced: 14_400,
  high: 3_600,
  ultra: 900,
});

export function createBlackHoleCapturedInitialState(input: {
  readonly bodyIds: readonly string[];
  readonly positionsM: ArrayLike<number>;
  readonly velocitiesMps: ArrayLike<number>;
  readonly massesKg: ArrayLike<number>;
  readonly radiiM: ArrayLike<number>;
}): BlackHoleCapturedInitialState {
  return validateAndCloneInitialState({
    bodyIds: input.bodyIds,
    positionsM: new Float64Array(input.positionsM),
    velocitiesMps: new Float64Array(input.velocitiesMps),
    massesKg: new Float64Array(input.massesKg),
    radiiM: new Float64Array(input.radiiM),
  });
}

export function createDefaultPhysicsFlybyParameters(
  initialState: BlackHoleCapturedInitialState,
): BlackHoleEncounterParameters {
  const captured = validateAndCloneInitialState(initialState);
  const extentM = Math.max(systemExtentM(captured), 10 * ASTRONOMICAL_UNIT_M);
  const durationSeconds = 36;
  const physicsSecondsPerScenarioSecond = 2 * SECONDS_PER_DAY;
  const closestApproachTimeSeconds =
    durationSeconds * physicsSecondsPerScenarioSecond * 0.5;
  const initialPositionM: BlackHoleVector3 = [
    extentM * 1.35,
    -extentM * 0.18,
    extentM * 0.04,
  ];
  const closestApproachTargetM: BlackHoleVector3 = [0, extentM * 0.08, 0];
  const initialVelocityMps: BlackHoleVector3 = [
    (closestApproachTargetM[0] - initialPositionM[0]) /
      closestApproachTimeSeconds,
    (closestApproachTargetM[1] - initialPositionM[1]) /
      closestApproachTimeSeconds,
    (closestApproachTargetM[2] - initialPositionM[2]) /
      closestApproachTimeSeconds,
  ];
  return validatePhysicsFlybyParameters({
    initialState: captured,
    blackHole: {
      massSolarMasses: 10,
      initialPositionM,
      initialVelocityMps,
      closestApproachTargetM,
      closestApproachTimeSeconds,
      spinVisualization: 0.35,
      accretionDiskEnabled: true,
      captureRadiusMultiple: 8,
    },
    accuracy: 'high',
    durationSeconds,
    physicsSecondsPerScenarioSecond,
    playbackRate: 1,
    seed: 10_031,
    ejectionRadiusM: extentM * 4,
  });
}

export function createDefaultCompleteConsumptionParameters(
  initialState: BlackHoleCapturedInitialState,
): CompleteConsumptionParameters {
  const physics = createDefaultPhysicsFlybyParameters(initialState);
  return validateCompleteConsumptionParameters({
    ...physics,
    blackHole: {
      ...physics.blackHole,
      massSolarMasses: 20,
      spinVisualization: 0.68,
      captureRadiusMultiple: 12,
    },
    durationSeconds: 42,
    seed: 10_032,
    infall: {
      angularMomentumDampingPerPhysicalSecond: 2.4e-7,
      inwardBiasMps2: 0.018,
      stagingStartSeconds: 5,
      stagingIntervalSeconds: 3.4,
    },
  });
}

export function validatePhysicsFlybyParameters(
  parameters: BlackHoleEncounterParameters,
): BlackHoleEncounterParameters {
  const durationSeconds = positiveFinite(parameters.durationSeconds, 'durationSeconds');
  const physicsSecondsPerScenarioSecond = positiveFinite(
    parameters.physicsSecondsPerScenarioSecond,
    'physicsSecondsPerScenarioSecond',
  );
  const physicalSecondsPerTick =
    physicsSecondsPerScenarioSecond * BLACK_HOLE_SCENARIO_FIXED_STEP_SECONDS;
  if (!isMultipleOfMinimumSubstep(physicalSecondsPerTick)) {
    throw new RangeError(
      'physicsSecondsPerScenarioSecond must make each fixed scenario tick a multiple of 10 physical seconds.',
    );
  }
  const playbackRate = inRange(parameters.playbackRate, 0.05, 20, 'playbackRate');
  if (!Number.isSafeInteger(parameters.seed) || parameters.seed < 0) {
    throw new RangeError('seed must be a non-negative safe integer.');
  }
  if (!BLACK_HOLE_ACCURACY_LEVELS.includes(parameters.accuracy)) {
    throw new RangeError(`Unknown black-hole accuracy ${String(parameters.accuracy)}.`);
  }
  return {
    initialState: validateAndCloneInitialState(parameters.initialState),
    blackHole: validateExternalBlackHole(parameters.blackHole),
    accuracy: parameters.accuracy,
    durationSeconds,
    physicsSecondsPerScenarioSecond,
    playbackRate,
    seed: parameters.seed,
    ejectionRadiusM: positiveFinite(parameters.ejectionRadiusM, 'ejectionRadiusM'),
  };
}

export function validateCompleteConsumptionParameters(
  parameters: CompleteConsumptionParameters,
): CompleteConsumptionParameters {
  const base = validatePhysicsFlybyParameters(parameters);
  const stagingStartSeconds = inRange(
    parameters.infall.stagingStartSeconds,
    0,
    base.durationSeconds,
    'infall.stagingStartSeconds',
  );
  const stagingIntervalSeconds = positiveFinite(
    parameters.infall.stagingIntervalSeconds,
    'infall.stagingIntervalSeconds',
  );
  const lastCaptureTime =
    stagingStartSeconds +
    (base.initialState.bodyIds.length - 1) * stagingIntervalSeconds +
    stagingIntervalSeconds * 0.8;
  if (lastCaptureTime >= base.durationSeconds) {
    throw new RangeError('Cinematic staging must capture every body before completion.');
  }
  return {
    ...base,
    infall: {
      angularMomentumDampingPerPhysicalSecond: inRange(
        parameters.infall.angularMomentumDampingPerPhysicalSecond,
        0,
        0.01,
        'infall.angularMomentumDampingPerPhysicalSecond',
      ),
      inwardBiasMps2: inRange(
        parameters.infall.inwardBiasMps2,
        0,
        1_000,
        'infall.inwardBiasMps2',
      ),
      stagingStartSeconds,
      stagingIntervalSeconds,
    },
  };
}

export function cloneCapturedInitialState(
  state: BlackHoleCapturedInitialState,
): BlackHoleCapturedInitialState {
  return {
    bodyIds: Object.freeze([...state.bodyIds]),
    positionsM: state.positionsM.slice(),
    velocitiesMps: state.velocitiesMps.slice(),
    massesKg: state.massesKg.slice(),
    radiiM: state.radiiM.slice(),
  };
}

function validateAndCloneInitialState(
  state: BlackHoleCapturedInitialState,
): BlackHoleCapturedInitialState {
  const count = state.bodyIds.length;
  if (count < BLACK_HOLE_REQUIRED_BODY_IDS.length) {
    throw new RangeError('Black-hole encounters require the Sun and all eight planets.');
  }
  const uniqueIds = new Set(state.bodyIds);
  if (uniqueIds.size !== count || state.bodyIds.some((id) => id.length === 0)) {
    throw new TypeError('Captured black-hole body ids must be non-empty and unique.');
  }
  for (const requiredId of BLACK_HOLE_REQUIRED_BODY_IDS) {
    if (!uniqueIds.has(requiredId)) {
      throw new RangeError(`Captured black-hole state is missing ${requiredId}.`);
    }
  }
  if (state.positionsM.length !== count * 3 || state.velocitiesMps.length !== count * 3) {
    throw new RangeError('Captured position and velocity arrays must contain three values per body.');
  }
  if (state.massesKg.length !== count || state.radiiM.length !== count) {
    throw new RangeError('Captured mass and radius arrays must contain one value per body.');
  }
  assertFiniteArray(state.positionsM, 'positionsM');
  assertFiniteArray(state.velocitiesMps, 'velocitiesMps');
  for (let index = 0; index < count; index += 1) {
    positiveFinite(state.massesKg[index] ?? Number.NaN, `massesKg[${index}]`);
    positiveFinite(state.radiiM[index] ?? Number.NaN, `radiiM[${index}]`);
  }
  return cloneCapturedInitialState(state);
}

function validateExternalBlackHole(
  blackHole: ExternalBlackHoleInitialConditions,
): ExternalBlackHoleInitialConditions {
  return {
    massSolarMasses: inRange(
      blackHole.massSolarMasses,
      0.1,
      1_000_000,
      'blackHole.massSolarMasses',
    ),
    initialPositionM: finiteVector(blackHole.initialPositionM, 'blackHole.initialPositionM'),
    initialVelocityMps: finiteVector(
      blackHole.initialVelocityMps,
      'blackHole.initialVelocityMps',
    ),
    closestApproachTargetM: finiteVector(
      blackHole.closestApproachTargetM,
      'blackHole.closestApproachTargetM',
    ),
    closestApproachTimeSeconds: positiveFinite(
      blackHole.closestApproachTimeSeconds,
      'blackHole.closestApproachTimeSeconds',
    ),
    spinVisualization: inRange(
      blackHole.spinVisualization,
      -1,
      1,
      'blackHole.spinVisualization',
    ),
    accretionDiskEnabled: Boolean(blackHole.accretionDiskEnabled),
    captureRadiusMultiple: inRange(
      blackHole.captureRadiusMultiple,
      1,
      10_000,
      'blackHole.captureRadiusMultiple',
    ),
  };
}

function systemExtentM(state: BlackHoleCapturedInitialState): number {
  let extent = 0;
  for (let index = 0; index < state.positionsM.length; index += 3) {
    extent = Math.max(
      extent,
      Math.hypot(
        state.positionsM[index] ?? 0,
        state.positionsM[index + 1] ?? 0,
        state.positionsM[index + 2] ?? 0,
      ),
    );
  }
  return extent;
}

function isMultipleOfMinimumSubstep(value: number): boolean {
  const minimum = BLACK_HOLE_ALLOWED_SUBSTEPS_SECONDS.at(-1) ?? 10;
  return Math.abs(value / minimum - Math.round(value / minimum)) < 1e-9;
}

function finiteVector(value: BlackHoleVector3, field: string): BlackHoleVector3 {
  if (value.length !== 3 || value.some((component) => !Number.isFinite(component))) {
    throw new RangeError(`${field} must contain three finite components.`);
  }
  return [value[0], value[1], value[2]];
}

function assertFiniteArray(values: Float64Array, field: string): void {
  for (const value of values) {
    if (!Number.isFinite(value)) throw new RangeError(`${field} must be finite.`);
  }
}

function positiveFinite(value: number, field: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${field} must be finite and positive.`);
  }
  return value;
}

function inRange(value: number, minimum: number, maximum: number, field: string): number {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${field} must be in [${minimum}, ${maximum}].`);
  }
  return value;
}
