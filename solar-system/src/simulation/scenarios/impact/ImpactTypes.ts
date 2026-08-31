import type { Vec3d } from '../../core/Vec3d';
import type { ScenarioPlaybackState } from '../ScenarioModule';

export const IMPACT_MATERIALS = ['porous-rock', 'stone', 'iron'] as const;
export type ImpactMaterial = (typeof IMPACT_MATERIALS)[number];

export const IMPACT_TARGET_BODY_IDS = [
  'mercury',
  'venus',
  'earth',
  'moon',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
] as const;
export type ImpactTargetBodyId = (typeof IMPACT_TARGET_BODY_IDS)[number];

export type ImpactTargetClass =
  | 'airless-rocky'
  | 'thin-atmosphere-rocky'
  | 'dense-atmosphere-rocky'
  | 'gas-giant'
  | 'ice-giant';

export type ImpactOutcomeKind =
  | 'solid-surface-impact'
  | 'airburst'
  | 'deep-atmosphere-breakup';

/** Data-driven physical and effect capabilities for one supported target. */
export interface ImpactTargetProfile {
  readonly bodyId: ImpactTargetBodyId;
  readonly targetClass: ImpactTargetClass;
  readonly meanRadiusM: number;
  readonly surfaceGravityMps2: number;
  readonly escapeVelocityMps?: number;
  readonly atmosphereProfileId?: string;
  readonly surfaceDensityKgM3?: number;
  readonly cloudTopRadiusM?: number;
  readonly supportsCrater: boolean;
  readonly supportsGroundShockwave: boolean;
  readonly supportsAtmosphericShockwave: boolean;
  readonly supportsPersistentSurfaceDecal: boolean;
  readonly supportsCloudScar: boolean;
  readonly visualProfileId: string;
}

/**
 * Simplified exponential atmosphere used by the educational entry model.
 * These constants are deliberately documented approximations, not weather or
 * research-grade atmosphere products.
 */
export interface ImpactAtmosphereProfile {
  readonly id: string;
  readonly referenceDensityKgM3: number;
  readonly scaleHeightM: number;
  readonly cutoffAltitudeM: number;
  readonly initialAltitudeM: number;
  readonly approximationNote: string;
}

export const IMPACT_CAMERA_MODES = [
  'overview',
  'orbital',
  'side-entry',
  'horizon',
  'chase',
  'ground-observer',
  'slow-motion-replay',
] as const;
export type ImpactCameraMode = (typeof IMPACT_CAMERA_MODES)[number];

export interface ImpactParameters {
  readonly targetBodyId: ImpactTargetBodyId;
  readonly diameterM: number;
  readonly densityKgM3: number;
  readonly entrySpeedKmps: number;
  /** Degrees above the local horizon: 90 is vertical. */
  readonly entryAngleDeg: number;
  /** Direction of travel, clockwise from local north. */
  readonly entryAzimuthDeg: number;
  readonly impactLatitudeDeg: number;
  readonly impactLongitudeDeg: number;
  readonly material: ImpactMaterial;
  readonly fragmentationEnabled: boolean;
  readonly atmosphereEnabled: boolean;
  readonly cameraMode: ImpactCameraMode;
  readonly seed: number;
}

export interface ImpactPhysicalSummary {
  readonly targetBodyId: ImpactTargetBodyId;
  readonly targetClass: ImpactTargetClass;
  readonly outcomeKind: ImpactOutcomeKind;
  /** Solid-surface or reference cloud-top collision radius. */
  readonly targetRadiusM: number;
  readonly diameterM: number;
  readonly densityKgM3: number;
  readonly entryAngleRad: number;
  readonly radiusM: number;
  readonly crossSectionAreaM2: number;
  readonly massKg: number;
  readonly entrySpeedMps: number;
  readonly kineticEnergyJ: number;
  readonly tntMegatons: number;
  readonly estimatedAirburstAltitudeM?: number;
  readonly reachedSurface: boolean;
  readonly impactMassKg: number;
  readonly impactSpeedMps: number;
  readonly impactEnergyJ: number;
  readonly atmosphericEnergyLossJ: number;
}

/** Artistically tuned display scales. None feed back into physical integration. */
export interface ImpactVisualProfile {
  readonly flashIntensity: number;
  readonly flashRadiusM: number;
  readonly flashDurationSeconds: number;
  readonly flashDecaySeconds: number;
  readonly craterRadiusM: number;
  readonly craterDepthM: number;
  readonly craterFormationSeconds: number;
  readonly scorchRadiusM: number;
  readonly ejectaRadiusM: number;
  readonly ejectaLaunchSpeedMps: number;
  readonly ejectaLifetimeSeconds: number;
  readonly plumeHeightM: number;
  readonly plumeRadiusM: number;
  readonly plumeRiseSeconds: number;
  readonly plumeLifetimeSeconds: number;
  readonly shockwaveVisualSpeedMps: number;
  readonly groundShockwaveSpeedMps: number;
  readonly groundShockwaveLifetimeSeconds: number;
  readonly atmosphericShockwaveSpeedMps: number;
  readonly atmosphericShockwaveLifetimeSeconds: number;
  readonly cloudScarRadiusM: number;
  readonly cloudScarGrowthSeconds: number;
  readonly cloudScarLifetimeSeconds: number;
  readonly cloudScarAdvectionRateRadPerSecond: number;
  readonly dustLifetimeSeconds: number;
  readonly approximationNotes: readonly string[];
}

export type ImpactStage =
  | 'idle'
  | 'approach'
  | 'atmospheric-entry'
  | 'fragmentation'
  | 'airburst'
  | 'impact-flash'
  | 'ejecta'
  | 'plume'
  | 'haze'
  | 'aftermath'
  | 'complete';

/** x=east, y=north, z=up in metres from the configured impact point. */
export type ImpactEnuPosition = Readonly<Vec3d>;

/** Orthonormal basis at the actual terminal/impact point in body-local axes. */
export interface ImpactFrame {
  readonly normalBodyLocal: Readonly<Vec3d>;
  readonly eastBodyLocal: Readonly<Vec3d>;
  readonly northBodyLocal: Readonly<Vec3d>;
}

export interface ImpactScenarioSnapshot {
  readonly state: ScenarioPlaybackState;
  readonly stage: ImpactStage;
  readonly scenarioTimeSeconds: number;
  readonly totalDurationSeconds: number;
  readonly progress: number;
  readonly playbackRate: number;
  readonly parameters: Readonly<ImpactParameters> | null;
  readonly physicalSummary: Readonly<ImpactPhysicalSummary> | null;
  readonly visualProfile: Readonly<ImpactVisualProfile> | null;
  readonly impactFrame: Readonly<ImpactFrame> | null;
  readonly impactorPosition: ImpactEnuPosition | null;
  /** Current impactor velocity in the impact frame (x=east, y=north, z=up). */
  readonly impactorVelocity: ImpactEnuPosition | null;
  /** Current convective-heating power divided by this run's precomputed peak. */
  readonly normalizedHeating: number;
  /** Current dynamic pressure divided by this run's precomputed peak. */
  readonly normalizedDynamicPressure: number;
  /** Current sampled mass divided by the impactor's configured initial mass. */
  readonly remainingMassFraction: number;
  /** Null before the terminal event; otherwise fixed-step time since it. */
  readonly eventElapsedSeconds: number | null;
  readonly craterFormationProgress: number;
  readonly surfaceScorchOpacity: number;
  readonly trailPositions: readonly ImpactEnuPosition[];
  readonly fragmentPositions: readonly ImpactEnuPosition[];
  readonly flashIntensity: number;
  readonly ejectaRadiusM: number;
  readonly ejectaHeightM: number;
  readonly ejectaOpacity: number;
  readonly shockwaveRadiusM: number;
  readonly groundShockwaveAngularRadiusRad: number;
  readonly groundShockwaveOpacity: number;
  readonly atmosphericShockwaveAngularRadiusRad: number;
  readonly atmosphericShockwaveOpacity: number;
  readonly plumeHeightM: number;
  readonly plumeRadiusM: number;
  readonly plumeOpacity: number;
  readonly plumeCoolingProgress: number;
  readonly hazeOpacity: number;
  readonly cloudScarGrowthProgress: number;
  readonly cloudScarOpacity: number;
  readonly cloudScarAdvectionRad: number;
  readonly runSignature: string | null;
  readonly fragmentCount: number;
}

export interface ImpactTrajectorySample {
  readonly timeSeconds: number;
  readonly positionEnuM: ImpactEnuPosition;
  readonly velocityEnuMps: ImpactEnuPosition;
  /** True radial altitude above the target collision radius. */
  readonly altitudeM: number;
  readonly massKg: number;
  readonly dynamicPressurePa: number;
  readonly heatingPowerW: number;
}

export interface ImpactFragmentModel {
  readonly count: number;
  readonly eventTimeSeconds: number | null;
  readonly eventAltitudeM: number | null;
  readonly separationVelocitiesEnuMps: readonly ImpactEnuPosition[];
}

export interface ImpactSimulationResult {
  readonly samples: readonly Readonly<ImpactTrajectorySample>[];
  readonly physicalSummary: Readonly<ImpactPhysicalSummary>;
  readonly fragmentation: Readonly<ImpactFragmentModel>;
  readonly impactFrame: Readonly<ImpactFrame>;
  readonly terminalEventTimeSeconds: number;
}
