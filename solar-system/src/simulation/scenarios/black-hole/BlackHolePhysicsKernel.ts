import {
  GRAVITATIONAL_CONSTANT_M3_KG_S2,
  SPEED_OF_LIGHT_MPS,
} from '../../core/Units';
import {
  BLACK_HOLE_ALLOWED_SUBSTEPS_SECONDS,
  BLACK_HOLE_MAX_SUBSTEP_BY_ACCURACY,
  SOLAR_MASS_KG,
} from './BlackHoleConfiguration';
import { CinematicInfallForceProvider } from './CinematicInfallForceProvider';
import type {
  BlackHoleAccuracy,
  BlackHoleCapturedInitialState,
  BlackHoleDiagnostics,
  CinematicInfallParameters,
  ExternalBlackHoleInitialConditions,
} from './BlackHoleTypes';

const CAPTURED_OUTCOME_CODE = 4;
const EJECTED_OUTCOME_CODE = 5;
const MINIMUM_SUBSTEP_SECONDS =
  BLACK_HOLE_ALLOWED_SUBSTEPS_SECONDS.at(-1) ?? 10;

export interface BlackHoleKernelConfiguration {
  readonly accuracy: BlackHoleAccuracy;
  readonly ejectionRadiusM: number;
  readonly captureRadiusMultiple: number;
  readonly physicsSecondsPerScenarioSecond: number;
  /** Null is the hard boundary that keeps artificial forces out of physics mode. */
  readonly cinematicInfall: Readonly<CinematicInfallParameters> | null;
}

export interface BlackHoleKernelState {
  readonly bodyIds: readonly string[];
  readonly bodyCount: number;
  readonly blackHoleIndex: number;
  readonly positionsM: Float64Array;
  readonly velocitiesMps: Float64Array;
  readonly massesKg: Float64Array;
  readonly radiiM: Float64Array;
  readonly outcomeCodes: Uint8Array;
  readonly originM: Float64Array;
  readonly originVelocityMps: Float64Array;
  readonly initialTotalEnergyJ: number;
  readonly initialLinearMomentumMagnitudeKgMps: number;
  readonly initialAngularMomentumMagnitudeKgM2ps: number;
  readonly integratedPhysicalTimeSeconds: number;
  readonly completedSubsteps: number;
  readonly chosenSubstepSeconds: number;
}

export interface BlackHoleKernelAdvanceResult {
  readonly state: BlackHoleKernelState;
  readonly diagnostics: BlackHoleDiagnostics;
}

export function schwarzschildRadiusM(massKg: number): number {
  if (!Number.isFinite(massKg) || massKg <= 0) {
    throw new RangeError('Black-hole mass must be finite and positive.');
  }
  return 2 * GRAVITATIONAL_CONSTANT_M3_KG_S2 * massKg /
    SPEED_OF_LIGHT_MPS ** 2;
}

export function initializeBlackHoleKernel(
  initialState: BlackHoleCapturedInitialState,
  blackHole: ExternalBlackHoleInitialConditions,
): BlackHoleKernelAdvanceResult {
  const bodyCount = initialState.bodyIds.length;
  const count = bodyCount + 1;
  const blackHoleIndex = bodyCount;
  const positionsM = new Float64Array(count * 3);
  const velocitiesMps = new Float64Array(count * 3);
  const massesKg = new Float64Array(count);
  const radiiM = new Float64Array(count);
  positionsM.set(initialState.positionsM);
  velocitiesMps.set(initialState.velocitiesMps);
  massesKg.set(initialState.massesKg);
  radiiM.set(initialState.radiiM);
  positionsM.set(blackHole.initialPositionM, blackHoleIndex * 3);
  velocitiesMps.set(blackHole.initialVelocityMps, blackHoleIndex * 3);
  const blackHoleMassKg = blackHole.massSolarMasses * SOLAR_MASS_KG;
  massesKg[blackHoleIndex] = blackHoleMassKg;
  radiiM[blackHoleIndex] = schwarzschildRadiusM(blackHoleMassKg);
  const originM = new Float64Array(3);
  const originVelocityMps = new Float64Array(3);
  recenterInitialState(
    positionsM,
    velocitiesMps,
    massesKg,
    originM,
    originVelocityMps,
  );

  const provisional: BlackHoleKernelState = {
    bodyIds: Object.freeze([...initialState.bodyIds]),
    bodyCount,
    blackHoleIndex,
    positionsM,
    velocitiesMps,
    massesKg,
    radiiM,
    outcomeCodes: new Uint8Array(bodyCount),
    originM,
    originVelocityMps,
    initialTotalEnergyJ: 0,
    initialLinearMomentumMagnitudeKgMps: 0,
    initialAngularMomentumMagnitudeKgM2ps: 0,
    integratedPhysicalTimeSeconds: 0,
    completedSubsteps: 0,
    chosenSubstepSeconds: BLACK_HOLE_ALLOWED_SUBSTEPS_SECONDS[0],
  };
  const baseline = computeBlackHoleDiagnostics(provisional);
  const state: BlackHoleKernelState = {
    ...provisional,
    initialTotalEnergyJ: baseline.totalEnergyJ,
    initialLinearMomentumMagnitudeKgMps:
      baseline.linearMomentumMagnitudeKgMps,
    initialAngularMomentumMagnitudeKgM2ps:
      baseline.angularMomentumMagnitudeKgM2ps,
  };
  return { state, diagnostics: computeBlackHoleDiagnostics(state) };
}

/** Pure deterministic kernel: the supplied state is never mutated. */
export function advanceBlackHoleKernel(
  source: BlackHoleKernelState,
  configuration: BlackHoleKernelConfiguration,
  physicalDurationSeconds: number,
): BlackHoleKernelAdvanceResult {
  validateKernelAdvance(source, configuration, physicalDurationSeconds);
  const mutable = cloneBlackHoleKernelState(source);
  const forceProvider = configuration.cinematicInfall === null
    ? null
    : new CinematicInfallForceProvider(configuration.cinematicInfall);
  let remainingSeconds = physicalDurationSeconds;
  let elapsedWithinAdvanceSeconds = 0;
  let completedSubsteps = source.completedSubsteps;
  let chosenSubstepSeconds = source.chosenSubstepSeconds;

  while (remainingSeconds > 1e-9) {
    const firstAcceleration = computeAccelerations(mutable, forceProvider);
    chosenSubstepSeconds = selectAdaptiveSubstepSeconds(
      configuration.accuracy,
      firstAcceleration.minimumPairDistanceM,
      firstAcceleration.maximumAccelerationMps2,
      remainingSeconds,
    );
    velocityVerletSubstep(
      mutable,
      configuration,
      firstAcceleration.accelerationsMps2,
      forceProvider,
      chosenSubstepSeconds,
      source.integratedPhysicalTimeSeconds +
        elapsedWithinAdvanceSeconds + chosenSubstepSeconds,
    );
    remainingSeconds -= chosenSubstepSeconds;
    elapsedWithinAdvanceSeconds += chosenSubstepSeconds;
    completedSubsteps += 1;
  }

  const state: BlackHoleKernelState = {
    ...mutable,
    integratedPhysicalTimeSeconds:
      source.integratedPhysicalTimeSeconds + physicalDurationSeconds,
    completedSubsteps,
    chosenSubstepSeconds,
  };
  const diagnostics = computeBlackHoleDiagnostics(state);
  if (!diagnostics.finite) {
    throw new Error('Black-hole kernel produced non-finite state or diagnostics.');
  }
  return { state, diagnostics };
}

export function cloneBlackHoleKernelState(
  state: BlackHoleKernelState,
): BlackHoleKernelState {
  return {
    ...state,
    bodyIds: Object.freeze([...state.bodyIds]),
    positionsM: state.positionsM.slice(),
    velocitiesMps: state.velocitiesMps.slice(),
    massesKg: state.massesKg.slice(),
    radiiM: state.radiiM.slice(),
    outcomeCodes: state.outcomeCodes.slice(),
    originM: state.originM.slice(),
    originVelocityMps: state.originVelocityMps.slice(),
  };
}

export function selectAdaptiveSubstepSeconds(
  accuracy: BlackHoleAccuracy,
  minimumPairDistanceM: number,
  maximumAccelerationMps2: number,
  remainingSeconds = Number.POSITIVE_INFINITY,
): number {
  const maximumConfigured = BLACK_HOLE_MAX_SUBSTEP_BY_ACCURACY[accuracy];
  const encounterTimescaleSeconds =
    maximumAccelerationMps2 > 0 && Number.isFinite(minimumPairDistanceM)
      ? Math.sqrt(Math.max(minimumPairDistanceM, 1) / maximumAccelerationMps2)
      : maximumConfigured / 0.04;
  const targetSeconds = Math.max(
    MINIMUM_SUBSTEP_SECONDS,
    encounterTimescaleSeconds * 0.04,
  );
  for (const candidate of BLACK_HOLE_ALLOWED_SUBSTEPS_SECONDS) {
    if (
      candidate <= maximumConfigured &&
      candidate <= targetSeconds &&
      candidate <= remainingSeconds + 1e-9
    ) {
      return candidate;
    }
  }
  if (remainingSeconds + 1e-9 < MINIMUM_SUBSTEP_SECONDS) {
    throw new RangeError('Kernel advance duration left a non-discrete substep remainder.');
  }
  return MINIMUM_SUBSTEP_SECONDS;
}

export function computeBlackHoleDiagnostics(
  state: BlackHoleKernelState,
): BlackHoleDiagnostics {
  let kineticEnergyJ = 0;
  let potentialEnergyJ = 0;
  const linearMomentum = new Float64Array(3);
  const angularMomentum = new Float64Array(3);
  let minimumPairDistanceM = Number.POSITIVE_INFINITY;
  const totalCount = state.bodyCount + 1;

  for (let index = 0; index < totalCount; index += 1) {
    if (isInactiveBody(state, index)) continue;
    const offset = index * 3;
    const mass = state.massesKg[index] ?? 0;
    const vx = (state.velocitiesMps[offset] ?? 0) + (state.originVelocityMps[0] ?? 0);
    const vy = (state.velocitiesMps[offset + 1] ?? 0) + (state.originVelocityMps[1] ?? 0);
    const vz = (state.velocitiesMps[offset + 2] ?? 0) + (state.originVelocityMps[2] ?? 0);
    const x = (state.positionsM[offset] ?? 0) + (state.originM[0] ?? 0);
    const y = (state.positionsM[offset + 1] ?? 0) + (state.originM[1] ?? 0);
    const z = (state.positionsM[offset + 2] ?? 0) + (state.originM[2] ?? 0);
    kineticEnergyJ += 0.5 * mass * (vx * vx + vy * vy + vz * vz);
    linearMomentum[0] = (linearMomentum[0] ?? 0) + mass * vx;
    linearMomentum[1] = (linearMomentum[1] ?? 0) + mass * vy;
    linearMomentum[2] = (linearMomentum[2] ?? 0) + mass * vz;
    angularMomentum[0] = (angularMomentum[0] ?? 0) + mass * (y * vz - z * vy);
    angularMomentum[1] = (angularMomentum[1] ?? 0) + mass * (z * vx - x * vz);
    angularMomentum[2] = (angularMomentum[2] ?? 0) + mass * (x * vy - y * vx);

    for (let other = index + 1; other < totalCount; other += 1) {
      if (isInactiveBody(state, other)) continue;
      const otherOffset = other * 3;
      const dx = (state.positionsM[otherOffset] ?? 0) - (state.positionsM[offset] ?? 0);
      const dy = (state.positionsM[otherOffset + 1] ?? 0) -
        (state.positionsM[offset + 1] ?? 0);
      const dz = (state.positionsM[otherOffset + 2] ?? 0) -
        (state.positionsM[offset + 2] ?? 0);
      const distance = Math.hypot(dx, dy, dz);
      minimumPairDistanceM = Math.min(minimumPairDistanceM, distance);
      const guardedDistance = Math.max(
        distance,
        (state.radiiM[index] ?? 0) + (state.radiiM[other] ?? 0),
        1,
      );
      potentialEnergyJ -=
        GRAVITATIONAL_CONSTANT_M3_KG_S2 * mass *
        (state.massesKg[other] ?? 0) / guardedDistance;
    }
  }

  if (!Number.isFinite(minimumPairDistanceM)) minimumPairDistanceM = 0;
  const totalEnergyJ = kineticEnergyJ + potentialEnergyJ;
  const linearMomentumMagnitudeKgMps = Math.hypot(...linearMomentum);
  const angularMomentumMagnitudeKgM2ps = Math.hypot(...angularMomentum);
  const relativeEnergyDrift = state.initialTotalEnergyJ === 0
    ? 0
    : (totalEnergyJ - state.initialTotalEnergyJ) /
      Math.max(Math.abs(state.initialTotalEnergyJ), 1);
  const relativeLinearMomentumDrift =
    (linearMomentumMagnitudeKgMps - state.initialLinearMomentumMagnitudeKgMps) /
    Math.max(state.initialLinearMomentumMagnitudeKgMps, 1);
  const relativeAngularMomentumDrift =
    (angularMomentumMagnitudeKgM2ps - state.initialAngularMomentumMagnitudeKgM2ps) /
    Math.max(state.initialAngularMomentumMagnitudeKgM2ps, 1);
  const values = [
    kineticEnergyJ,
    potentialEnergyJ,
    totalEnergyJ,
    ...linearMomentum,
    linearMomentumMagnitudeKgMps,
    ...angularMomentum,
    angularMomentumMagnitudeKgM2ps,
    relativeEnergyDrift,
    relativeLinearMomentumDrift,
    relativeAngularMomentumDrift,
    minimumPairDistanceM,
    state.chosenSubstepSeconds,
    state.completedSubsteps,
    state.integratedPhysicalTimeSeconds,
    ...state.positionsM,
    ...state.velocitiesMps,
    ...state.originM,
    ...state.originVelocityMps,
  ];
  return {
    kineticEnergyJ,
    potentialEnergyJ,
    totalEnergyJ,
    linearMomentumKgMps: vectorFrom(linearMomentum),
    linearMomentumMagnitudeKgMps,
    angularMomentumKgM2ps: vectorFrom(angularMomentum),
    angularMomentumMagnitudeKgM2ps,
    relativeEnergyDrift,
    relativeLinearMomentumDrift,
    relativeAngularMomentumDrift,
    minimumPairDistanceM,
    chosenSubstepSeconds: state.chosenSubstepSeconds,
    completedSubsteps: state.completedSubsteps,
    integratedPhysicalTimeSeconds: state.integratedPhysicalTimeSeconds,
    finite: values.every(Number.isFinite),
  };
}

function velocityVerletSubstep(
  state: BlackHoleKernelState,
  configuration: BlackHoleKernelConfiguration,
  firstAccelerations: Float64Array,
  forceProvider: CinematicInfallForceProvider | null,
  dtSeconds: number,
  physicalTimeAfterSubstepSeconds: number,
): void {
  const totalCount = state.bodyCount + 1;
  const halfDt = dtSeconds * 0.5;
  for (let index = 0; index < totalCount; index += 1) {
    if (isInactiveBody(state, index)) continue;
    const offset = index * 3;
    state.velocitiesMps[offset] =
      (state.velocitiesMps[offset] ?? 0) + (firstAccelerations[offset] ?? 0) * halfDt;
    state.velocitiesMps[offset + 1] =
      (state.velocitiesMps[offset + 1] ?? 0) +
      (firstAccelerations[offset + 1] ?? 0) * halfDt;
    state.velocitiesMps[offset + 2] =
      (state.velocitiesMps[offset + 2] ?? 0) +
      (firstAccelerations[offset + 2] ?? 0) * halfDt;
    state.positionsM[offset] =
      (state.positionsM[offset] ?? 0) + (state.velocitiesMps[offset] ?? 0) * dtSeconds;
    state.positionsM[offset + 1] =
      (state.positionsM[offset + 1] ?? 0) +
      (state.velocitiesMps[offset + 1] ?? 0) * dtSeconds;
    state.positionsM[offset + 2] =
      (state.positionsM[offset + 2] ?? 0) +
      (state.velocitiesMps[offset + 2] ?? 0) * dtSeconds;
  }
  state.originM[0] = (state.originM[0] ?? 0) +
    (state.originVelocityMps[0] ?? 0) * dtSeconds;
  state.originM[1] = (state.originM[1] ?? 0) +
    (state.originVelocityMps[1] ?? 0) * dtSeconds;
  state.originM[2] = (state.originM[2] ?? 0) +
    (state.originVelocityMps[2] ?? 0) * dtSeconds;

  classifyCaptureAndEjection(
    state,
    configuration,
    physicalTimeAfterSubstepSeconds,
  );
  recenterRuntimeState(state);
  const secondAccelerations = computeAccelerations(state, forceProvider).accelerationsMps2;
  for (let index = 0; index < totalCount; index += 1) {
    if (isInactiveBody(state, index)) continue;
    const offset = index * 3;
    state.velocitiesMps[offset] =
      (state.velocitiesMps[offset] ?? 0) + (secondAccelerations[offset] ?? 0) * halfDt;
    state.velocitiesMps[offset + 1] =
      (state.velocitiesMps[offset + 1] ?? 0) +
      (secondAccelerations[offset + 1] ?? 0) * halfDt;
    state.velocitiesMps[offset + 2] =
      (state.velocitiesMps[offset + 2] ?? 0) +
      (secondAccelerations[offset + 2] ?? 0) * halfDt;
  }
  pinCapturedBodiesToBlackHole(state);
}

function computeAccelerations(
  state: BlackHoleKernelState,
  forceProvider: CinematicInfallForceProvider | null,
): {
  readonly accelerationsMps2: Float64Array;
  readonly minimumPairDistanceM: number;
  readonly maximumAccelerationMps2: number;
} {
  const totalCount = state.bodyCount + 1;
  const accelerationsMps2 = new Float64Array(totalCount * 3);
  let minimumPairDistanceM = Number.POSITIVE_INFINITY;
  for (let first = 0; first < totalCount; first += 1) {
    if (isInactiveBody(state, first)) continue;
    const firstOffset = first * 3;
    for (let second = first + 1; second < totalCount; second += 1) {
      if (isInactiveBody(state, second)) continue;
      const secondOffset = second * 3;
      const dx = (state.positionsM[secondOffset] ?? 0) -
        (state.positionsM[firstOffset] ?? 0);
      const dy = (state.positionsM[secondOffset + 1] ?? 0) -
        (state.positionsM[firstOffset + 1] ?? 0);
      const dz = (state.positionsM[secondOffset + 2] ?? 0) -
        (state.positionsM[firstOffset + 2] ?? 0);
      const rawDistance = Math.hypot(dx, dy, dz);
      minimumPairDistanceM = Math.min(minimumPairDistanceM, rawDistance);
      const distance = Math.max(
        rawDistance,
        (state.radiiM[first] ?? 0) + (state.radiiM[second] ?? 0),
        1,
      );
      const inverseDistanceCubed = 1 / distance ** 3;
      const firstScale =
        GRAVITATIONAL_CONSTANT_M3_KG_S2 * (state.massesKg[second] ?? 0) *
        inverseDistanceCubed;
      const secondScale =
        GRAVITATIONAL_CONSTANT_M3_KG_S2 * (state.massesKg[first] ?? 0) *
        inverseDistanceCubed;
      accelerationsMps2[firstOffset] =
        (accelerationsMps2[firstOffset] ?? 0) + dx * firstScale;
      accelerationsMps2[firstOffset + 1] =
        (accelerationsMps2[firstOffset + 1] ?? 0) + dy * firstScale;
      accelerationsMps2[firstOffset + 2] =
        (accelerationsMps2[firstOffset + 2] ?? 0) + dz * firstScale;
      accelerationsMps2[secondOffset] =
        (accelerationsMps2[secondOffset] ?? 0) - dx * secondScale;
      accelerationsMps2[secondOffset + 1] =
        (accelerationsMps2[secondOffset + 1] ?? 0) - dy * secondScale;
      accelerationsMps2[secondOffset + 2] =
        (accelerationsMps2[secondOffset + 2] ?? 0) - dz * secondScale;
    }
  }
  forceProvider?.addAccelerations(state, accelerationsMps2);
  let maximumAccelerationMps2 = 0;
  for (let index = 0; index < totalCount; index += 1) {
    const offset = index * 3;
    maximumAccelerationMps2 = Math.max(
      maximumAccelerationMps2,
      Math.hypot(
        accelerationsMps2[offset] ?? 0,
        accelerationsMps2[offset + 1] ?? 0,
        accelerationsMps2[offset + 2] ?? 0,
      ),
    );
  }
  return {
    accelerationsMps2,
    minimumPairDistanceM: Number.isFinite(minimumPairDistanceM)
      ? minimumPairDistanceM
      : 0,
    maximumAccelerationMps2,
  };
}

function classifyCaptureAndEjection(
  state: BlackHoleKernelState,
  configuration: BlackHoleKernelConfiguration,
  physicalTimeSeconds: number,
): void {
  const bhOffset = state.blackHoleIndex * 3;
  const captureRadiusM = Math.max(
    schwarzschildRadiusM(state.massesKg[state.blackHoleIndex] ?? 1) *
      configuration.captureRadiusMultiple,
    state.radiiM[state.blackHoleIndex] ?? 1,
  );
  for (let index = 0; index < state.bodyCount; index += 1) {
    const currentOutcome = state.outcomeCodes[index] ?? 0;
    if (currentOutcome === CAPTURED_OUTCOME_CODE) continue;
    const offset = index * 3;
    const dx = (state.positionsM[offset] ?? 0) - (state.positionsM[bhOffset] ?? 0);
    const dy = (state.positionsM[offset + 1] ?? 0) -
      (state.positionsM[bhOffset + 1] ?? 0);
    const dz = (state.positionsM[offset + 2] ?? 0) -
      (state.positionsM[bhOffset + 2] ?? 0);
    const distanceToBlackHoleM = Math.hypot(dx, dy, dz);
    if (configuration.cinematicInfall !== null) {
      const rank = cinematicCaptureRank(state.bodyIds, index);
      const scenarioTimeSeconds =
        physicalTimeSeconds / configuration.physicsSecondsPerScenarioSecond;
      const stageProgress = (
        scenarioTimeSeconds -
        configuration.cinematicInfall.stagingStartSeconds -
        rank * configuration.cinematicInfall.stagingIntervalSeconds
      ) / configuration.cinematicInfall.stagingIntervalSeconds;
      if (stageProgress >= 0.8) {
        captureBody(state, index);
      } else if (stageProgress >= 0.5) {
        state.outcomeCodes[index] = 3;
      } else if (stageProgress >= 0.28) {
        state.outcomeCodes[index] = 2;
      } else if (stageProgress > 0) {
        state.outcomeCodes[index] = 1;
      }
      continue;
    }
    if (distanceToBlackHoleM <= captureRadiusM + (state.radiiM[index] ?? 0)) {
      captureBody(state, index);
      continue;
    }
    const distanceFromOriginM = Math.hypot(
      state.positionsM[offset] ?? 0,
      state.positionsM[offset + 1] ?? 0,
      state.positionsM[offset + 2] ?? 0,
    );
    const outwardMotion =
      (state.positionsM[offset] ?? 0) * (state.velocitiesMps[offset] ?? 0) +
      (state.positionsM[offset + 1] ?? 0) * (state.velocitiesMps[offset + 1] ?? 0) +
      (state.positionsM[offset + 2] ?? 0) * (state.velocitiesMps[offset + 2] ?? 0);
    if (distanceFromOriginM >= configuration.ejectionRadiusM && outwardMotion > 0) {
      state.outcomeCodes[index] = EJECTED_OUTCOME_CODE;
      continue;
    }
    const bodyMass = state.massesKg[index] ?? 1;
    const bodyRadius = state.radiiM[index] ?? 1;
    const tidalRadiusM = bodyRadius * Math.cbrt(
      2 * (state.massesKg[state.blackHoleIndex] ?? 1) / bodyMass,
    );
    if (distanceToBlackHoleM <= tidalRadiusM * 0.55) {
      state.outcomeCodes[index] = 3;
    } else if (distanceToBlackHoleM <= tidalRadiusM) {
      state.outcomeCodes[index] = Math.max(currentOutcome, 2);
    } else if (distanceToBlackHoleM <= tidalRadiusM * 2) {
      state.outcomeCodes[index] = Math.max(currentOutcome, 1);
    }
  }
}

function pinCapturedBodiesToBlackHole(state: BlackHoleKernelState): void {
  const bhOffset = state.blackHoleIndex * 3;
  for (let index = 0; index < state.bodyCount; index += 1) {
    if ((state.outcomeCodes[index] ?? 0) !== CAPTURED_OUTCOME_CODE) continue;
    const offset = index * 3;
    for (let axis = 0; axis < 3; axis += 1) {
      state.positionsM[offset + axis] = state.positionsM[bhOffset + axis] ?? 0;
      state.velocitiesMps[offset + axis] = state.velocitiesMps[bhOffset + axis] ?? 0;
    }
  }
}

function recenterInitialState(
  positionsM: Float64Array,
  velocitiesMps: Float64Array,
  massesKg: Float64Array,
  originM: Float64Array,
  originVelocityMps: Float64Array,
): void {
  let totalMass = 0;
  for (let index = 0; index < massesKg.length; index += 1) {
    const mass = massesKg[index] ?? 0;
    totalMass += mass;
    const offset = index * 3;
    for (let axis = 0; axis < 3; axis += 1) {
      originM[axis] = (originM[axis] ?? 0) + (positionsM[offset + axis] ?? 0) * mass;
      originVelocityMps[axis] =
        (originVelocityMps[axis] ?? 0) + (velocitiesMps[offset + axis] ?? 0) * mass;
    }
  }
  for (let axis = 0; axis < 3; axis += 1) {
    originM[axis] = (originM[axis] ?? 0) / totalMass;
    originVelocityMps[axis] = (originVelocityMps[axis] ?? 0) / totalMass;
  }
  for (let index = 0; index < massesKg.length; index += 1) {
    const offset = index * 3;
    for (let axis = 0; axis < 3; axis += 1) {
      positionsM[offset + axis] =
        (positionsM[offset + axis] ?? 0) - (originM[axis] ?? 0);
      velocitiesMps[offset + axis] =
        (velocitiesMps[offset + axis] ?? 0) - (originVelocityMps[axis] ?? 0);
    }
  }
}

function recenterRuntimeState(state: BlackHoleKernelState): void {
  let totalMass = 0;
  const centerPosition = new Float64Array(3);
  const centerVelocity = new Float64Array(3);
  const totalCount = state.bodyCount + 1;
  for (let index = 0; index < totalCount; index += 1) {
    if (isInactiveBody(state, index)) continue;
    const mass = state.massesKg[index] ?? 0;
    totalMass += mass;
    const offset = index * 3;
    for (let axis = 0; axis < 3; axis += 1) {
      centerPosition[axis] =
        (centerPosition[axis] ?? 0) + (state.positionsM[offset + axis] ?? 0) * mass;
      centerVelocity[axis] =
        (centerVelocity[axis] ?? 0) + (state.velocitiesMps[offset + axis] ?? 0) * mass;
    }
  }
  if (totalMass <= 0) return;
  for (let axis = 0; axis < 3; axis += 1) {
    centerPosition[axis] = (centerPosition[axis] ?? 0) / totalMass;
    centerVelocity[axis] = (centerVelocity[axis] ?? 0) / totalMass;
    state.originM[axis] = (state.originM[axis] ?? 0) + (centerPosition[axis] ?? 0);
    state.originVelocityMps[axis] =
      (state.originVelocityMps[axis] ?? 0) + (centerVelocity[axis] ?? 0);
  }
  for (let index = 0; index < totalCount; index += 1) {
    if (isInactiveBody(state, index)) continue;
    const offset = index * 3;
    for (let axis = 0; axis < 3; axis += 1) {
      state.positionsM[offset + axis] =
        (state.positionsM[offset + axis] ?? 0) - (centerPosition[axis] ?? 0);
      state.velocitiesMps[offset + axis] =
        (state.velocitiesMps[offset + axis] ?? 0) - (centerVelocity[axis] ?? 0);
    }
  }
}

function validateKernelAdvance(
  state: BlackHoleKernelState,
  configuration: BlackHoleKernelConfiguration,
  durationSeconds: number,
): void {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new RangeError('Kernel advance duration must be finite and positive.');
  }
  const ticks = durationSeconds / MINIMUM_SUBSTEP_SECONDS;
  if (Math.abs(ticks - Math.round(ticks)) > 1e-9) {
    throw new RangeError('Kernel advance duration must align to the discrete substep set.');
  }
  if (!(configuration.accuracy in BLACK_HOLE_MAX_SUBSTEP_BY_ACCURACY)) {
    throw new RangeError('Kernel accuracy is invalid.');
  }
  if (
    !Number.isFinite(configuration.physicsSecondsPerScenarioSecond) ||
    configuration.physicsSecondsPerScenarioSecond <= 0
  ) {
    throw new RangeError('Kernel scenario-time mapping must be finite and positive.');
  }
  if (state.positionsM.length !== (state.bodyCount + 1) * 3) {
    throw new RangeError('Kernel position storage has an invalid length.');
  }
}

function isInactiveBody(state: BlackHoleKernelState, index: number): boolean {
  return index < state.bodyCount &&
    (state.outcomeCodes[index] ?? 0) === CAPTURED_OUTCOME_CODE;
}

function vectorFrom(values: Float64Array): readonly [number, number, number] {
  return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0];
}

function captureBody(state: BlackHoleKernelState, bodyIndex: number): void {
  state.outcomeCodes[bodyIndex] = CAPTURED_OUTCOME_CODE;
  state.massesKg[state.blackHoleIndex] =
    (state.massesKg[state.blackHoleIndex] ?? 0) +
    (state.massesKg[bodyIndex] ?? 0);
}

function cinematicCaptureRank(bodyIds: readonly string[], bodyIndex: number): number {
  const bodyId = bodyIds[bodyIndex] ?? '';
  if (bodyId === 'sun') return Math.max(0, bodyIds.length - 1);
  let rank = 0;
  for (let index = 0; index < bodyIndex; index += 1) {
    if (bodyIds[index] !== 'sun') rank += 1;
  }
  return rank;
}
