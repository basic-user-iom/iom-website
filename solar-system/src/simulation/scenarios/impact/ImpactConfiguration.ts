import type {
  ImpactCameraMode,
  ImpactMaterial,
  ImpactParameters,
  ImpactTargetBodyId,
} from './ImpactTypes';
import {
  IMPACT_CAMERA_MODES,
  IMPACT_MATERIALS,
  IMPACT_TARGET_BODY_IDS,
} from './ImpactTypes';

export const IMPACT_MODEL_VERSION = 'impact-target-sphere-v2';
export const IMPACT_FIXED_STEP_SECONDS = 1 / 120;
export const IMPACT_TRAJECTORY_SAMPLE_SECONDS = 1 / 30;

export const IMPACT_PARAMETER_LIMITS = Object.freeze({
  diameterM: Object.freeze({ minimum: 1, maximum: 5_000 }),
  densityKgM3: Object.freeze({ minimum: 300, maximum: 9_000 }),
  entrySpeedKmps: Object.freeze({ minimum: 5, maximum: 72 }),
  entryAngleDeg: Object.freeze({ minimum: 5, maximum: 90 }),
  entryAzimuthDeg: Object.freeze({ minimum: 0, maximum: 360 }),
  impactLatitudeDeg: Object.freeze({ minimum: -90, maximum: 90 }),
  impactLongitudeDeg: Object.freeze({ minimum: -180, maximum: 180 }),
  playbackRate: Object.freeze({ minimum: 0.05, maximum: 4 }),
});

export interface ImpactMaterialProfile {
  readonly dragCoefficient: number;
  readonly fragmentationStrengthPa: number;
  readonly heatOfAblationJkg: number;
  readonly heatTransferCoefficient: number;
}

/**
 * Versioned educational entry constants. Fragment strengths and ablation
 * coefficients are representative display-model values, not specimen tests.
 */
export const IMPACT_MATERIAL_PROFILES: Readonly<
  Record<ImpactMaterial, Readonly<ImpactMaterialProfile>>
> = Object.freeze({
  'porous-rock': Object.freeze({
    dragCoefficient: 1.05,
    fragmentationStrengthPa: 250_000,
    heatOfAblationJkg: 5_000_000,
    heatTransferCoefficient: 1.8e-4,
  }),
  stone: Object.freeze({
    dragCoefficient: 1,
    fragmentationStrengthPa: 2_000_000,
    heatOfAblationJkg: 8_000_000,
    heatTransferCoefficient: 1e-4,
  }),
  iron: Object.freeze({
    dragCoefficient: 0.9,
    fragmentationStrengthPa: 12_000_000,
    heatOfAblationJkg: 6_300_000,
    heatTransferCoefficient: 6e-5,
  }),
});

export const IMPACT_ENTRY_CONFIGURATION = Object.freeze({
  earthMeanRadiusM: 6_371_008.4,
  seaLevelGravityMps2: 9.80665,
  seaLevelAtmosphereDensityKgM3: 1.225,
  atmosphereScaleHeightM: 8_500,
  atmosphereCutoffAltitudeM: 120_000,
  initialAltitudeM: 160_000,
  maximumEntryDurationSeconds: 300,
  minimumSurvivingMassFraction: 1e-7,
  minimumSurvivingMassKg: 0.05,
  maximumAblationFractionPerStep: 0.03,
  fragmentationAreaExponent: 1 / 3,
  tntMegatonJoules: 4.184e15,
});

export const DEFAULT_IMPACT_PARAMETERS: Readonly<ImpactParameters> = Object.freeze({
  targetBodyId: 'earth',
  diameterM: 100,
  densityKgM3: 3_000,
  entrySpeedKmps: 20,
  entryAngleDeg: 35,
  entryAzimuthDeg: 90,
  impactLatitudeDeg: 20,
  impactLongitudeDeg: -30,
  material: 'stone',
  fragmentationEnabled: true,
  atmosphereEnabled: true,
  cameraMode: 'orbital',
  seed: 0x1a2b_3c4d,
});

export function validateImpactParameters(
  parameters: Readonly<ImpactParameters>,
): Readonly<ImpactParameters> {
  requireRange(parameters.diameterM, 'diameterM', IMPACT_PARAMETER_LIMITS.diameterM);
  requireRange(parameters.densityKgM3, 'densityKgM3', IMPACT_PARAMETER_LIMITS.densityKgM3);
  requireRange(
    parameters.entrySpeedKmps,
    'entrySpeedKmps',
    IMPACT_PARAMETER_LIMITS.entrySpeedKmps,
  );
  requireRange(
    parameters.entryAngleDeg,
    'entryAngleDeg',
    IMPACT_PARAMETER_LIMITS.entryAngleDeg,
  );
  requireRange(
    parameters.entryAzimuthDeg,
    'entryAzimuthDeg',
    IMPACT_PARAMETER_LIMITS.entryAzimuthDeg,
  );
  requireRange(
    parameters.impactLatitudeDeg,
    'impactLatitudeDeg',
    IMPACT_PARAMETER_LIMITS.impactLatitudeDeg,
  );
  requireRange(
    parameters.impactLongitudeDeg,
    'impactLongitudeDeg',
    IMPACT_PARAMETER_LIMITS.impactLongitudeDeg,
  );
  requireMember(parameters.material, IMPACT_MATERIALS, 'material');
  requireMember(parameters.cameraMode, IMPACT_CAMERA_MODES, 'cameraMode');
  requireMember(parameters.targetBodyId, IMPACT_TARGET_BODY_IDS, 'targetBodyId');
  if (typeof parameters.fragmentationEnabled !== 'boolean') {
    throw new TypeError('Impact fragmentationEnabled must be boolean.');
  }
  if (typeof parameters.atmosphereEnabled !== 'boolean') {
    throw new TypeError('Impact atmosphereEnabled must be boolean.');
  }
  if (
    !Number.isSafeInteger(parameters.seed) ||
    parameters.seed < 0 ||
    parameters.seed > 0xffff_ffff
  ) {
    throw new RangeError('Impact seed must be an unsigned 32-bit integer.');
  }

  return Object.freeze({
    targetBodyId: parameters.targetBodyId,
    diameterM: parameters.diameterM,
    densityKgM3: parameters.densityKgM3,
    entrySpeedKmps: parameters.entrySpeedKmps,
    entryAngleDeg: parameters.entryAngleDeg,
    entryAzimuthDeg: parameters.entryAzimuthDeg === 360 ? 0 : parameters.entryAzimuthDeg,
    impactLatitudeDeg: parameters.impactLatitudeDeg,
    impactLongitudeDeg: parameters.impactLongitudeDeg,
    material: parameters.material,
    fragmentationEnabled: parameters.fragmentationEnabled,
    atmosphereEnabled: parameters.atmosphereEnabled,
    cameraMode: parameters.cameraMode,
    seed: parameters.seed >>> 0,
  });
}

export function serializeImpactParameters(parameters: Readonly<ImpactParameters>): string {
  const normalized = validateImpactParameters(parameters);
  return JSON.stringify({
    modelVersion: IMPACT_MODEL_VERSION,
    targetBodyId: normalized.targetBodyId,
    diameterM: normalized.diameterM,
    densityKgM3: normalized.densityKgM3,
    entrySpeedKmps: normalized.entrySpeedKmps,
    entryAngleDeg: normalized.entryAngleDeg,
    entryAzimuthDeg: normalized.entryAzimuthDeg,
    impactLatitudeDeg: normalized.impactLatitudeDeg,
    impactLongitudeDeg: normalized.impactLongitudeDeg,
    material: normalized.material,
    fragmentationEnabled: normalized.fragmentationEnabled,
    atmosphereEnabled: normalized.atmosphereEnabled,
    cameraMode: normalized.cameraMode,
    seed: normalized.seed,
  });
}

export function impactRunSignature(parameters: Readonly<ImpactParameters>): string {
  const serialized = serializeImpactParameters(parameters);
  let hash = 0x811c_9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x0100_0193) >>> 0;
  }
  return `impact-v2-${hash.toString(16).padStart(8, '0')}`;
}

export function isImpactTargetBodyId(value: unknown): value is ImpactTargetBodyId {
  return (
    typeof value === 'string' &&
    IMPACT_TARGET_BODY_IDS.includes(value as ImpactTargetBodyId)
  );
}

export function isImpactMaterial(value: unknown): value is ImpactMaterial {
  return typeof value === 'string' && IMPACT_MATERIALS.includes(value as ImpactMaterial);
}

export function isImpactCameraMode(value: unknown): value is ImpactCameraMode {
  return (
    typeof value === 'string' &&
    IMPACT_CAMERA_MODES.includes(value as ImpactCameraMode)
  );
}

function requireRange(
  value: number,
  label: string,
  range: Readonly<{ minimum: number; maximum: number }>,
): void {
  if (!Number.isFinite(value) || value < range.minimum || value > range.maximum) {
    throw new RangeError(
      `Impact ${label} must be finite and between ${range.minimum} and ${range.maximum}.`,
    );
  }
}

function requireMember<Value extends string>(
  value: Value,
  values: readonly Value[],
  label: string,
): void {
  if (!values.includes(value)) {
    throw new RangeError(`Unknown impact ${label} "${String(value)}".`);
  }
}
