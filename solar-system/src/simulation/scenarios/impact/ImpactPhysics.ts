import { DeterministicRandom } from '../../core/DeterministicRandom';
import type { Vec3d } from '../../core/Vec3d';
import {
  IMPACT_ENTRY_CONFIGURATION,
  IMPACT_FIXED_STEP_SECONDS,
  IMPACT_MATERIAL_PROFILES,
  IMPACT_TRAJECTORY_SAMPLE_SECONDS,
  validateImpactParameters,
} from './ImpactConfiguration';
import {
  getImpactAtmosphereProfile,
  getImpactTargetProfile,
  impactTargetCollisionRadiusM,
} from './ImpactTargetProfiles';
import { getImpactVisualTuningProfile } from './ImpactVisualProfiles';
import type {
  ImpactAtmosphereProfile,
  ImpactFragmentModel,
  ImpactFrame,
  ImpactOutcomeKind,
  ImpactParameters,
  ImpactPhysicalSummary,
  ImpactSimulationResult,
  ImpactTargetBodyId,
  ImpactTrajectorySample,
  ImpactVisualProfile,
} from './ImpactTypes';

interface ImpactPhysicalOutcome {
  readonly estimatedAirburstAltitudeM?: number;
  readonly reachedSurface: boolean;
  readonly impactMassKg: number;
  readonly impactSpeedMps: number;
  readonly impactEnergyJ: number;
  readonly atmosphericEnergyLossJ: number;
}

/** Target-centered body-local Cartesian integration state, in SI units. */
interface MutableEntryState {
  timeSeconds: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  massKg: number;
}

interface BodyTrajectorySample {
  readonly timeSeconds: number;
  readonly positionBodyLocalM: Readonly<Vec3d>;
  readonly velocityBodyLocalMps: Readonly<Vec3d>;
  readonly altitudeM: number;
  readonly massKg: number;
  readonly dynamicPressurePa: number;
  readonly heatingPowerW: number;
}

const EMPTY_FRAGMENT_MODEL: Readonly<ImpactFragmentModel> = Object.freeze({
  count: 0,
  eventTimeSeconds: null,
  eventAltitudeM: null,
  separationVelocitiesEnuMps: Object.freeze([]),
});

const VISUAL_APPROXIMATION_NOTES = Object.freeze([
  'Educational approximation: crater, ejecta, shockwave, plume, and haze scales are artistically tuned.',
  'Visual effect dimensions do not feed back into the entry trajectory or reported kinetic energy.',
  'Atmospheres use static exponential profiles; weather, winds, lift, chemistry, and terrain are omitted.',
  'Fragmentation is a one-event dynamic-pressure approximation, not a hydrocode or damage forecast.',
]);

export function calculateImpactPhysicalSummary(
  parameters: Readonly<ImpactParameters>,
  outcome: Readonly<ImpactPhysicalOutcome> = Object.freeze({
    reachedSurface: false,
    impactMassKg: 0,
    impactSpeedMps: 0,
    impactEnergyJ: 0,
    atmosphericEnergyLossJ: 0,
  }),
): Readonly<ImpactPhysicalSummary> {
  const normalized = validateImpactParameters(parameters);
  const target = getImpactTargetProfile(normalized.targetBodyId);
  const radiusM = normalized.diameterM / 2;
  const crossSectionAreaM2 = Math.PI * radiusM * radiusM;
  const massKg = (4 / 3) * Math.PI * radiusM ** 3 * normalized.densityKgM3;
  const entrySpeedMps = normalized.entrySpeedKmps * 1_000;
  const kineticEnergyJ = 0.5 * massKg * entrySpeedMps ** 2;
  const tntMegatons = kineticEnergyJ / IMPACT_ENTRY_CONFIGURATION.tntMegatonJoules;
  const airburst = outcome.estimatedAirburstAltitudeM;

  return Object.freeze({
    targetBodyId: target.bodyId,
    targetClass: target.targetClass,
    outcomeKind: classifyImpactOutcome(target.targetClass, outcome.reachedSurface),
    targetRadiusM: impactTargetCollisionRadiusM(target),
    diameterM: normalized.diameterM,
    densityKgM3: normalized.densityKgM3,
    entryAngleRad: normalized.entryAngleDeg * Math.PI / 180,
    radiusM,
    crossSectionAreaM2,
    massKg,
    entrySpeedMps,
    kineticEnergyJ,
    tntMegatons,
    ...(airburst === undefined
      ? {}
      : { estimatedAirburstAltitudeM: Math.max(0, airburst) }),
    reachedSurface: outcome.reachedSurface,
    impactMassKg: outcome.impactMassKg,
    impactSpeedMps: outcome.impactSpeedMps,
    impactEnergyJ: outcome.impactEnergyJ,
    atmosphericEnergyLossJ: outcome.atmosphericEnergyLossJ,
  });
}

/**
 * Density from a versioned educational exponential profile. The default stays
 * Earth-compatible for callers of the original one-argument API.
 */
export function atmosphereDensityAtAltitudeM(
  altitudeM: number,
  atmosphere: ImpactTargetBodyId | Readonly<ImpactAtmosphereProfile> = 'earth',
): number {
  if (!Number.isFinite(altitudeM)) {
    throw new RangeError('Atmosphere altitude must be finite.');
  }
  const profile = typeof atmosphere === 'string'
    ? getImpactAtmosphereProfile(atmosphere)
    : atmosphere;
  if (profile === null || altitudeM >= profile.cutoffAltitudeM) return 0;
  const boundedAltitude = Math.max(0, altitudeM);
  return profile.referenceDensityKgM3 * Math.exp(-boundedAltitude / profile.scaleHeightM);
}

/**
 * Deterministic fixed-step entry in target-centered Cartesian coordinates.
 * Central gravity and a true spherical/cloud-top intersection are used during
 * integration. Public samples are then rebased into ENU at the actual terminal
 * point, not the originally requested latitude/longitude.
 */
export function simulateImpactEntry(
  parameters: Readonly<ImpactParameters>,
): Readonly<ImpactSimulationResult> {
  const normalized = validateImpactParameters(parameters);
  const target = getImpactTargetProfile(normalized.targetBodyId);
  const atmosphere = normalized.atmosphereEnabled
    ? getImpactAtmosphereProfile(target)
    : null;
  const collisionRadiusM = impactTargetCollisionRadiusM(target);
  const initialSummary = calculateImpactPhysicalSummary(normalized);
  const material = IMPACT_MATERIAL_PROFILES[normalized.material];
  const angleRad = initialSummary.entryAngleRad;
  const azimuthRad = normalized.entryAzimuthDeg * Math.PI / 180;
  const initialAltitudeM = atmosphere?.initialAltitudeM ??
    IMPACT_ENTRY_CONFIGURATION.initialAltitudeM;
  const configuredFrame = createImpactFrame(
    normalized.impactLatitudeDeg,
    normalized.impactLongitudeDeg,
  );
  const heading = addScaledVectors(
    configuredFrame.eastBodyLocal,
    Math.sin(azimuthRad),
    configuredFrame.northBodyLocal,
    Math.cos(azimuthRad),
  );
  const horizontalRangeM = initialAltitudeM / Math.tan(angleRad);
  const angularSeparationRad = Math.min(
    horizontalRangeM / collisionRadiusM,
    Math.PI * 0.49,
  );
  const initialNormal = normalizedVector(addScaledVectors(
    configuredFrame.normalBodyLocal,
    Math.cos(angularSeparationRad),
    heading,
    -Math.sin(angularSeparationRad),
  ));
  const forwardTangent = normalizedVector(addScaledVectors(
    configuredFrame.normalBodyLocal,
    Math.sin(angularSeparationRad),
    heading,
    Math.cos(angularSeparationRad),
  ));
  const velocityDirection = normalizedVector(addScaledVectors(
    forwardTangent,
    Math.cos(angleRad),
    initialNormal,
    -Math.sin(angleRad),
  ));
  const state: MutableEntryState = {
    timeSeconds: 0,
    x: initialNormal.x * (collisionRadiusM + initialAltitudeM),
    y: initialNormal.y * (collisionRadiusM + initialAltitudeM),
    z: initialNormal.z * (collisionRadiusM + initialAltitudeM),
    vx: velocityDirection.x * initialSummary.entrySpeedMps,
    vy: velocityDirection.y * initialSummary.entrySpeedMps,
    vz: velocityDirection.z * initialSummary.entrySpeedMps,
    massKg: initialSummary.massKg,
  };
  const bodySamples: BodyTrajectorySample[] = [
    createBodyTrajectorySample(state, collisionRadiusM, 0, 0),
  ];
  const random = new DeterministicRandom(normalized.seed);
  let fragmentation: Readonly<ImpactFragmentModel> = EMPTY_FRAGMENT_MODEL;
  let nextSampleTime = IMPACT_TRAJECTORY_SAMPLE_SECONDS;
  let maximumEnergyLossRateW = 0;
  let maximumEnergyLossAltitudeM = initialAltitudeM;
  let maximumEnergyLossState: MutableEntryState | null = null;
  let atmosphericEnergyLossJ = 0;
  let reachedSurface = false;

  const minimumMassKg = Math.max(
    IMPACT_ENTRY_CONFIGURATION.minimumSurvivingMassKg,
    initialSummary.massKg * IMPACT_ENTRY_CONFIGURATION.minimumSurvivingMassFraction,
  );
  const nominalTravelSeconds = initialAltitudeM /
    Math.max(1, initialSummary.entrySpeedMps * Math.sin(angleRad));
  const maximumDurationSeconds = Math.max(
    IMPACT_ENTRY_CONFIGURATION.maximumEntryDurationSeconds,
    nominalTravelSeconds * 1.5 + 120,
  );

  while (
    state.timeSeconds < maximumDurationSeconds &&
    altitudeAboveTargetM(state, collisionRadiusM) > 0 &&
    state.massKg > minimumMassKg
  ) {
    const previous = { ...state };
    const radialDistanceM = Math.hypot(state.x, state.y, state.z);
    const altitudeM = radialDistanceM - collisionRadiusM;
    const speedMps = Math.hypot(state.vx, state.vy, state.vz);
    const atmosphereDensity = atmosphere === null
      ? 0
      : atmosphereDensityAtAltitudeM(altitudeM, atmosphere);
    const dynamicPressurePa = 0.5 * atmosphereDensity * speedMps ** 2;

    if (
      normalized.fragmentationEnabled &&
      fragmentation.count === 0 &&
      dynamicPressurePa >= material.fragmentationStrengthPa
    ) {
      fragmentation = createFragmentModel(random, state.timeSeconds, altitudeM);
    }

    const fragmentAreaMultiplier = fragmentation.count === 0
      ? 1
      : fragmentation.count ** IMPACT_ENTRY_CONFIGURATION.fragmentationAreaExponent;
    const impactorRadiusM = radiusForMass(state.massKg, normalized.densityKgM3);
    const effectiveAreaM2 = Math.PI * impactorRadiusM ** 2 * fragmentAreaMultiplier;
    const dragAccelerationMps2 = speedMps === 0 || state.massKg <= 0
      ? 0
      : 0.5 * atmosphereDensity * material.dragCoefficient * effectiveAreaM2 *
        speedMps ** 2 / state.massKg;
    const inverseSpeed = speedMps > 0 ? 1 / speedMps : 0;
    const inverseRadius = radialDistanceM > 0 ? 1 / radialDistanceM : 0;
    const gravityMps2 = target.surfaceGravityMps2 *
      (collisionRadiusM / radialDistanceM) ** 2;
    const ax = -gravityMps2 * state.x * inverseRadius -
      dragAccelerationMps2 * state.vx * inverseSpeed;
    const ay = -gravityMps2 * state.y * inverseRadius -
      dragAccelerationMps2 * state.vy * inverseSpeed;
    const az = -gravityMps2 * state.z * inverseRadius -
      dragAccelerationMps2 * state.vz * inverseSpeed;
    const heatingPowerW = 0.5 * material.heatTransferCoefficient *
      atmosphereDensity * effectiveAreaM2 * speedMps ** 3;
    const unconstrainedMassLossKg = heatingPowerW / material.heatOfAblationJkg *
      IMPACT_FIXED_STEP_SECONDS;
    const massLossKg = Math.min(
      unconstrainedMassLossKg,
      state.massKg * IMPACT_ENTRY_CONFIGURATION.maximumAblationFractionPerStep,
    );
    const dragPowerW = dragAccelerationMps2 * state.massKg * speedMps;
    const dissipationPowerW = dragPowerW + 0.5 *
      massLossKg / IMPACT_FIXED_STEP_SECONDS * speedMps ** 2;
    atmosphericEnergyLossJ += dissipationPowerW * IMPACT_FIXED_STEP_SECONDS;
    if (dissipationPowerW > maximumEnergyLossRateW) {
      maximumEnergyLossRateW = dissipationPowerW;
      maximumEnergyLossAltitudeM = Math.max(0, altitudeM);
      maximumEnergyLossState = { ...state };
    }

    state.vx += ax * IMPACT_FIXED_STEP_SECONDS;
    state.vy += ay * IMPACT_FIXED_STEP_SECONDS;
    state.vz += az * IMPACT_FIXED_STEP_SECONDS;
    state.x += state.vx * IMPACT_FIXED_STEP_SECONDS;
    state.y += state.vy * IMPACT_FIXED_STEP_SECONDS;
    state.z += state.vz * IMPACT_FIXED_STEP_SECONDS;
    state.massKg = Math.max(0, state.massKg - massLossKg);
    state.timeSeconds += IMPACT_FIXED_STEP_SECONDS;
    assertFiniteState(state);

    if (altitudeAboveTargetM(state, collisionRadiusM) <= 0) {
      interpolateSphereCrossing(state, previous, collisionRadiusM);
      reachedSurface = state.massKg > minimumMassKg;
    }

    if (
      state.timeSeconds + Number.EPSILON >= nextSampleTime ||
      altitudeAboveTargetM(state, collisionRadiusM) <= 0 ||
      state.massKg <= minimumMassKg
    ) {
      const sampleAltitudeM = altitudeAboveTargetM(state, collisionRadiusM);
      const sampleSpeedMps = Math.hypot(state.vx, state.vy, state.vz);
      const sampleDensity = atmosphere === null
        ? 0
        : atmosphereDensityAtAltitudeM(sampleAltitudeM, atmosphere);
      bodySamples.push(createBodyTrajectorySample(
        state,
        collisionRadiusM,
        0.5 * sampleDensity * sampleSpeedMps ** 2,
        heatingPowerW,
      ));
      while (nextSampleTime <= state.timeSeconds + Number.EPSILON) {
        nextSampleTime += IMPACT_TRAJECTORY_SAMPLE_SECONDS;
      }
    }
  }

  if (bodySamples.at(-1)?.timeSeconds !== state.timeSeconds) {
    const terminalAltitudeM = altitudeAboveTargetM(state, collisionRadiusM);
    const terminalDensity = atmosphere === null
      ? 0
      : atmosphereDensityAtAltitudeM(terminalAltitudeM, atmosphere);
    const terminalSpeed = Math.hypot(state.vx, state.vy, state.vz);
    bodySamples.push(createBodyTrajectorySample(
      state,
      collisionRadiusM,
      0.5 * terminalDensity * terminalSpeed ** 2,
      0,
    ));
  }

  const terminalSpeedMps = Math.hypot(state.vx, state.vy, state.vz);
  const impactMassKg = reachedSurface ? state.massKg : 0;
  const impactSpeedMps = reachedSurface ? terminalSpeedMps : 0;
  const impactEnergyJ = reachedSurface
    ? 0.5 * impactMassKg * impactSpeedMps ** 2
    : 0;
  const physicalSummary = calculateImpactPhysicalSummary(normalized, {
    ...(reachedSurface
      ? {}
      : {
          estimatedAirburstAltitudeM: maximumEnergyLossRateW > 0
            ? maximumEnergyLossAltitudeM
            : Math.max(0, altitudeAboveTargetM(state, collisionRadiusM)),
        }),
    reachedSurface,
    impactMassKg,
    impactSpeedMps,
    impactEnergyJ,
    atmosphericEnergyLossJ: atmosphere === null ? 0 : atmosphericEnergyLossJ,
  });
  const eventState = reachedSurface ? state : maximumEnergyLossState ?? state;
  const terminalNormal = normalizedVector(immutableVec3d(
    eventState.x,
    eventState.y,
    eventState.z,
  ));
  const impactFrame = createImpactFrameFromNormal(
    terminalNormal,
    normalized.impactLongitudeDeg,
  );
  const samples = Object.freeze(bodySamples.map((sample) =>
    rebaseTrajectorySample(sample, impactFrame, collisionRadiusM)));

  return Object.freeze({
    samples,
    physicalSummary,
    fragmentation,
    impactFrame,
    terminalEventTimeSeconds: eventState.timeSeconds,
  });
}

export function deriveImpactVisualProfile(
  summary: Readonly<ImpactPhysicalSummary>,
): Readonly<ImpactVisualProfile> {
  const target = getImpactTargetProfile(summary.targetBodyId);
  const tuning = getImpactVisualTuningProfile(target.visualProfileId);
  const eventEnergyJ = summary.reachedSurface
    ? summary.impactEnergyJ
    : Math.max(summary.atmosphericEnergyLossJ, summary.kineticEnergyJ * 0.01);
  const eventMegatons = Math.max(
    eventEnergyJ / IMPACT_ENTRY_CONFIGURATION.tntMegatonJoules,
    1e-9,
  );
  const logarithmicEnergy = Math.log10(1 + eventMegatons);
  const supportsSurfaceEffects =
    summary.outcomeKind === 'solid-surface-impact' && target.supportsCrater;
  const supportsSurfaceDecal =
    summary.outcomeKind === 'solid-surface-impact' &&
    target.supportsPersistentSurfaceDecal;
  const supportsGroundShockwave =
    summary.outcomeKind === 'solid-surface-impact' &&
    target.supportsGroundShockwave;
  const hasAtmosphericEnergy = summary.atmosphericEnergyLossJ > 0;
  const supportsAtmosphericShockwave =
    hasAtmosphericEnergy && target.supportsAtmosphericShockwave;
  const supportsCloudScar = hasAtmosphericEnergy && target.supportsCloudScar;
  const craterRadiusM = supportsSurfaceEffects
    ? clamp(80 * eventMegatons ** 0.28, 8, 100_000)
    : 0;
  const flashRadiusM = clamp(
    320 * eventMegatons ** 0.2 * tuning.flashRadiusMultiplier,
    12,
    400_000,
  );
  const baseShockwaveSpeedMps = clamp(
    320 + logarithmicEnergy * 180,
    320,
    1_800,
  );
  const groundShockwaveSpeedMps = supportsGroundShockwave
    ? baseShockwaveSpeedMps * tuning.groundShockwaveSpeedMultiplier
    : 0;
  const atmosphericShockwaveSpeedMps = supportsAtmosphericShockwave
    ? baseShockwaveSpeedMps * tuning.atmosphericShockwaveSpeedMultiplier
    : 0;
  const escapeLimitedEjectaSpeedMps = Math.min(
    2_500,
    (target.escapeVelocityMps ?? 12_000) * 0.18,
  );
  const ejectaLaunchSpeedMps = supportsSurfaceEffects
    ? clamp(
        (55 + logarithmicEnergy * 52) * tuning.ejectaLaunchSpeedMultiplier,
        20,
        escapeLimitedEjectaSpeedMps,
      )
    : 0;
  const ejectaLifetimeSeconds = ejectaLaunchSpeedMps > 0
    ? clamp(
        2 * ejectaLaunchSpeedMps / target.surfaceGravityMps2 *
          tuning.ejectaLifetimeMultiplier,
        2,
        120,
      )
    : 0;
  const plumeHeightM = clamp(
    (supportsSurfaceEffects ? Math.max(craterRadiusM, 20) : 100) *
      (10 + logarithmicEnergy * 4) * tuning.plumeHeightMultiplier,
    200,
    400_000,
  );
  const plumeRadiusM = clamp(
    Math.max(flashRadiusM, craterRadiusM * 0.9, 50) *
      tuning.plumeRadiusMultiplier,
    50,
    500_000,
  );
  const cloudScarRadiusM = supportsCloudScar
    ? clamp(
        flashRadiusM * tuning.cloudScarRadiusMultiplier,
        flashRadiusM,
        1_000_000,
      )
    : 0;
  const dustLifetimeSeconds = clamp(
    (30 + logarithmicEnergy * 18) * tuning.dustLifetimeMultiplier,
    24,
    160,
  );

  return Object.freeze({
    flashIntensity: clamp(0.8 + logarithmicEnergy * 1.6, 0.6, 8),
    flashRadiusM,
    flashDurationSeconds: tuning.flashDurationSeconds,
    flashDecaySeconds: tuning.flashDecaySeconds,
    craterRadiusM,
    craterDepthM: supportsSurfaceEffects
      ? craterRadiusM * tuning.craterDepthRatio
      : 0,
    craterFormationSeconds: supportsSurfaceEffects
      ? tuning.craterFormationSeconds
      : 0,
    scorchRadiusM: supportsSurfaceDecal
      ? craterRadiusM * tuning.scorchRadiusMultiplier
      : 0,
    ejectaRadiusM: supportsSurfaceEffects ? craterRadiusM * 8 : 0,
    ejectaLaunchSpeedMps,
    ejectaLifetimeSeconds,
    plumeHeightM,
    plumeRadiusM,
    plumeRiseSeconds: tuning.plumeRiseSeconds,
    plumeLifetimeSeconds: tuning.plumeLifetimeSeconds,
    shockwaveVisualSpeedMps: Math.max(
      groundShockwaveSpeedMps,
      atmosphericShockwaveSpeedMps,
    ),
    groundShockwaveSpeedMps,
    groundShockwaveLifetimeSeconds: supportsGroundShockwave
      ? tuning.groundShockwaveLifetimeSeconds
      : 0,
    atmosphericShockwaveSpeedMps,
    atmosphericShockwaveLifetimeSeconds: supportsAtmosphericShockwave
      ? tuning.atmosphericShockwaveLifetimeSeconds
      : 0,
    cloudScarRadiusM,
    cloudScarGrowthSeconds: supportsCloudScar
      ? tuning.cloudScarGrowthSeconds
      : 0,
    cloudScarLifetimeSeconds: supportsCloudScar
      ? tuning.cloudScarLifetimeSeconds
      : 0,
    cloudScarAdvectionRateRadPerSecond: supportsCloudScar
      ? tuning.cloudScarAdvectionRateRadPerSecond
      : 0,
    dustLifetimeSeconds,
    approximationNotes: VISUAL_APPROXIMATION_NOTES,
  });
}

function classifyImpactOutcome(
  targetClass: ImpactPhysicalSummary['targetClass'],
  reachedSurface: boolean,
): ImpactOutcomeKind {
  if (targetClass === 'gas-giant' || targetClass === 'ice-giant') {
    return 'deep-atmosphere-breakup';
  }
  return reachedSurface ? 'solid-surface-impact' : 'airburst';
}

export function sampleImpactTrajectory(
  simulation: Readonly<ImpactSimulationResult>,
  timeSeconds: number,
): Readonly<ImpactTrajectorySample> {
  if (!Number.isFinite(timeSeconds) || timeSeconds < 0) {
    throw new RangeError('Impact trajectory sample time must be finite and non-negative.');
  }
  const samples = simulation.samples;
  const first = samples[0];
  const last = samples.at(-1);
  if (first === undefined || last === undefined) {
    throw new Error('Impact trajectory contains no samples.');
  }
  if (timeSeconds <= first.timeSeconds) return first;
  if (timeSeconds >= last.timeSeconds) return last;

  let lower = 0;
  let upper = samples.length - 1;
  while (upper - lower > 1) {
    const middle = (lower + upper) >>> 1;
    const candidate = samples[middle];
    if (candidate === undefined) break;
    if (candidate.timeSeconds <= timeSeconds) lower = middle;
    else upper = middle;
  }
  const left = samples[lower];
  const right = samples[upper];
  if (left === undefined || right === undefined) return last;
  const span = right.timeSeconds - left.timeSeconds;
  const alpha = span <= 0 ? 0 : (timeSeconds - left.timeSeconds) / span;
  return Object.freeze({
    timeSeconds,
    positionEnuM: interpolateVec3d(left.positionEnuM, right.positionEnuM, alpha),
    velocityEnuMps: interpolateVec3d(left.velocityEnuMps, right.velocityEnuMps, alpha),
    altitudeM: lerp(left.altitudeM, right.altitudeM, alpha),
    massKg: lerp(left.massKg, right.massKg, alpha),
    dynamicPressurePa: lerp(left.dynamicPressurePa, right.dynamicPressurePa, alpha),
    heatingPowerW: lerp(left.heatingPowerW, right.heatingPowerW, alpha),
  });
}

/** Creates the body-local ENU basis for a configured spherical target point. */
export function createImpactFrame(
  latitudeDeg: number,
  longitudeDeg: number,
): Readonly<ImpactFrame> {
  if (!Number.isFinite(latitudeDeg) || latitudeDeg < -90 || latitudeDeg > 90) {
    throw new RangeError('Impact-frame latitude must be between -90 and 90 degrees.');
  }
  if (!Number.isFinite(longitudeDeg) || longitudeDeg < -180 || longitudeDeg > 180) {
    throw new RangeError('Impact-frame longitude must be between -180 and 180 degrees.');
  }
  const latitudeRad = latitudeDeg * Math.PI / 180;
  const longitudeRad = longitudeDeg * Math.PI / 180;
  const cosLatitude = Math.cos(latitudeRad);
  const normal = immutableVec3d(
    cosLatitude * Math.cos(longitudeRad),
    Math.sin(latitudeRad),
    cosLatitude * Math.sin(longitudeRad),
  );
  return createImpactFrameFromNormal(normal, longitudeDeg);
}

function createImpactFrameFromNormal(
  normalInput: Readonly<Vec3d>,
  fallbackLongitudeDeg: number,
): Readonly<ImpactFrame> {
  const normal = normalizedVector(normalInput);
  const horizontalLength = Math.hypot(normal.x, normal.z);
  const fallbackLongitudeRad = fallbackLongitudeDeg * Math.PI / 180;
  const east = horizontalLength > 1e-12
    ? immutableVec3d(-normal.z / horizontalLength, 0, normal.x / horizontalLength)
    : immutableVec3d(-Math.sin(fallbackLongitudeRad), 0, Math.cos(fallbackLongitudeRad));
  const north = normalizedVector(cross(east, normal));
  return Object.freeze({
    normalBodyLocal: normal,
    eastBodyLocal: east,
    northBodyLocal: north,
  });
}

function createBodyTrajectorySample(
  state: Readonly<MutableEntryState>,
  collisionRadiusM: number,
  dynamicPressurePa: number,
  heatingPowerW: number,
): Readonly<BodyTrajectorySample> {
  return Object.freeze({
    timeSeconds: state.timeSeconds,
    positionBodyLocalM: immutableVec3d(state.x, state.y, state.z),
    velocityBodyLocalMps: immutableVec3d(state.vx, state.vy, state.vz),
    altitudeM: Math.max(0, altitudeAboveTargetM(state, collisionRadiusM)),
    massKg: state.massKg,
    dynamicPressurePa,
    heatingPowerW,
  });
}

function rebaseTrajectorySample(
  sample: Readonly<BodyTrajectorySample>,
  frame: Readonly<ImpactFrame>,
  collisionRadiusM: number,
): Readonly<ImpactTrajectorySample> {
  const origin = scaled(frame.normalBodyLocal, collisionRadiusM);
  const relative = subtract(sample.positionBodyLocalM, origin);
  return Object.freeze({
    timeSeconds: sample.timeSeconds,
    positionEnuM: immutableVec3d(
      dot(relative, frame.eastBodyLocal),
      dot(relative, frame.northBodyLocal),
      dot(relative, frame.normalBodyLocal),
    ),
    velocityEnuMps: immutableVec3d(
      dot(sample.velocityBodyLocalMps, frame.eastBodyLocal),
      dot(sample.velocityBodyLocalMps, frame.northBodyLocal),
      dot(sample.velocityBodyLocalMps, frame.normalBodyLocal),
    ),
    altitudeM: sample.altitudeM,
    massKg: sample.massKg,
    dynamicPressurePa: sample.dynamicPressurePa,
    heatingPowerW: sample.heatingPowerW,
  });
}

function createFragmentModel(
  random: DeterministicRandom,
  eventTimeSeconds: number,
  eventAltitudeM: number,
): Readonly<ImpactFragmentModel> {
  const count = 3 + (random.nextUint32() % 4);
  const velocities: Vec3d[] = [];
  let meanX = 0;
  let meanY = 0;
  let meanZ = 0;
  for (let index = 0; index < count; index += 1) {
    const azimuth = random.range(0, Math.PI * 2);
    const speed = random.range(18, 58);
    const vertical = random.range(-0.25, 0.35) * speed;
    const horizontal = Math.sqrt(Math.max(0, speed ** 2 - vertical ** 2));
    const velocity = {
      x: Math.cos(azimuth) * horizontal,
      y: Math.sin(azimuth) * horizontal,
      z: vertical,
    };
    velocities.push(velocity);
    meanX += velocity.x;
    meanY += velocity.y;
    meanZ += velocity.z;
  }
  meanX /= count;
  meanY /= count;
  meanZ /= count;
  const centered = velocities.map((velocity) => immutableVec3d(
    velocity.x - meanX,
    velocity.y - meanY,
    velocity.z - meanZ,
  ));
  return Object.freeze({
    count,
    eventTimeSeconds,
    eventAltitudeM,
    separationVelocitiesEnuMps: Object.freeze(centered),
  });
}

function interpolateSphereCrossing(
  state: MutableEntryState,
  previous: Readonly<MutableEntryState>,
  collisionRadiusM: number,
): void {
  const dx = state.x - previous.x;
  const dy = state.y - previous.y;
  const dz = state.z - previous.z;
  const coefficientA = dx * dx + dy * dy + dz * dz;
  const coefficientB = 2 * (previous.x * dx + previous.y * dy + previous.z * dz);
  const coefficientC = previous.x ** 2 + previous.y ** 2 + previous.z ** 2 -
    collisionRadiusM ** 2;
  const discriminant = Math.max(0, coefficientB ** 2 - 4 * coefficientA * coefficientC);
  const root = coefficientA <= Number.EPSILON
    ? 1
    : (-coefficientB - Math.sqrt(discriminant)) / (2 * coefficientA);
  const alpha = clamp(root, 0, 1);
  state.timeSeconds = lerp(previous.timeSeconds, state.timeSeconds, alpha);
  state.x = lerp(previous.x, state.x, alpha);
  state.y = lerp(previous.y, state.y, alpha);
  state.z = lerp(previous.z, state.z, alpha);
  const interpolatedRadiusM = Math.hypot(state.x, state.y, state.z);
  const radiusCorrection = interpolatedRadiusM > 0
    ? collisionRadiusM / interpolatedRadiusM
    : 1;
  state.x *= radiusCorrection;
  state.y *= radiusCorrection;
  state.z *= radiusCorrection;
  state.vx = lerp(previous.vx, state.vx, alpha);
  state.vy = lerp(previous.vy, state.vy, alpha);
  state.vz = lerp(previous.vz, state.vz, alpha);
  state.massKg = lerp(previous.massKg, state.massKg, alpha);
}

function altitudeAboveTargetM(
  state: Pick<MutableEntryState, 'x' | 'y' | 'z'>,
  collisionRadiusM: number,
): number {
  return Math.hypot(state.x, state.y, state.z) - collisionRadiusM;
}

function radiusForMass(massKg: number, densityKgM3: number): number {
  return Math.cbrt(3 * Math.max(0, massKg) / (4 * Math.PI * densityKgM3));
}

function interpolateVec3d(
  left: Readonly<Vec3d>,
  right: Readonly<Vec3d>,
  alpha: number,
): Readonly<Vec3d> {
  return immutableVec3d(
    lerp(left.x, right.x, alpha),
    lerp(left.y, right.y, alpha),
    lerp(left.z, right.z, alpha),
  );
}

function addScaledVectors(
  left: Readonly<Vec3d>,
  leftScale: number,
  right: Readonly<Vec3d>,
  rightScale: number,
): Readonly<Vec3d> {
  return immutableVec3d(
    left.x * leftScale + right.x * rightScale,
    left.y * leftScale + right.y * rightScale,
    left.z * leftScale + right.z * rightScale,
  );
}

function subtract(left: Readonly<Vec3d>, right: Readonly<Vec3d>): Readonly<Vec3d> {
  return immutableVec3d(left.x - right.x, left.y - right.y, left.z - right.z);
}

function scaled(vector: Readonly<Vec3d>, scale: number): Readonly<Vec3d> {
  return immutableVec3d(vector.x * scale, vector.y * scale, vector.z * scale);
}

function dot(left: Readonly<Vec3d>, right: Readonly<Vec3d>): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function cross(left: Readonly<Vec3d>, right: Readonly<Vec3d>): Readonly<Vec3d> {
  return immutableVec3d(
    left.y * right.z - left.z * right.y,
    left.z * right.x - left.x * right.z,
    left.x * right.y - left.y * right.x,
  );
}

function normalizedVector(vector: Readonly<Vec3d>): Readonly<Vec3d> {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (!Number.isFinite(length) || length <= Number.EPSILON) {
    throw new RangeError('Impact coordinate direction must be finite and non-zero.');
  }
  return immutableVec3d(vector.x / length, vector.y / length, vector.z / length);
}

function immutableVec3d(x: number, y: number, z: number): Readonly<Vec3d> {
  return Object.freeze({ x, y, z });
}

function assertFiniteState(state: Readonly<MutableEntryState>): void {
  if (
    !Number.isFinite(state.timeSeconds) ||
    !Number.isFinite(state.x) ||
    !Number.isFinite(state.y) ||
    !Number.isFinite(state.z) ||
    !Number.isFinite(state.vx) ||
    !Number.isFinite(state.vy) ||
    !Number.isFinite(state.vz) ||
    !Number.isFinite(state.massKg)
  ) {
    throw new RangeError('Impact entry integration produced a non-finite state.');
  }
}

function lerp(left: number, right: number, alpha: number): number {
  return left + (right - left) * alpha;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
