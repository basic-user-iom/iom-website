import type { ScenarioPlaybackState } from '../ScenarioModule';

export const BLACK_HOLE_REQUIRED_BODY_IDS = [
  'sun',
  'mercury',
  'venus',
  'earth',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
] as const;

/**
 * Default hand-off set for the production encounter. The major planets are the
 * required physics floor; the Moon is included because its authoritative
 * ephemeris, mass, and radius are also available. Comets remain optional test
 * particles because their pinned catalog intentionally does not invent masses.
 */
export const BLACK_HOLE_SCENARIO_BODY_IDS = [
  'sun',
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

export type BlackHoleRequiredBodyId =
  (typeof BLACK_HOLE_REQUIRED_BODY_IDS)[number];

export const BLACK_HOLE_ACCURACY_LEVELS = [
  'balanced',
  'high',
  'ultra',
] as const;
export type BlackHoleAccuracy = (typeof BLACK_HOLE_ACCURACY_LEVELS)[number];

export type BlackHoleVector3 = readonly [number, number, number];

/**
 * Captured observatory state at scenario hand-off. Arrays are structure-of-
 * arrays Float64 storage so the exact same payload can be transferred to the
 * module worker without numerical conversion.
 */
export interface BlackHoleCapturedInitialState {
  readonly bodyIds: readonly string[];
  readonly positionsM: Float64Array;
  readonly velocitiesMps: Float64Array;
  readonly massesKg: Float64Array;
  readonly radiiM: Float64Array;
}

export interface ExternalBlackHoleInitialConditions {
  readonly massSolarMasses: number;
  readonly initialPositionM: BlackHoleVector3;
  readonly initialVelocityMps: BlackHoleVector3;
  readonly closestApproachTargetM: BlackHoleVector3;
  readonly closestApproachTimeSeconds: number;
  /** Rendering-only dimensionless parameter in [-1, 1]. */
  readonly spinVisualization: number;
  readonly accretionDiskEnabled: boolean;
  readonly captureRadiusMultiple: number;
}

export interface BlackHoleEncounterParameters {
  readonly initialState: BlackHoleCapturedInitialState;
  readonly blackHole: ExternalBlackHoleInitialConditions;
  readonly accuracy: BlackHoleAccuracy;
  readonly durationSeconds: number;
  readonly physicsSecondsPerScenarioSecond: number;
  readonly playbackRate: number;
  readonly seed: number;
  readonly ejectionRadiusM: number;
}

export interface CinematicInfallParameters {
  /** Exponential tangential velocity decay coefficient in physical s^-1. */
  readonly angularMomentumDampingPerPhysicalSecond: number;
  /** Deliberate non-gravitational acceleration toward the black hole. */
  readonly inwardBiasMps2: number;
  readonly stagingStartSeconds: number;
  readonly stagingIntervalSeconds: number;
}

export interface CompleteConsumptionParameters
  extends BlackHoleEncounterParameters {
  readonly infall: CinematicInfallParameters;
}

export type BlackHoleBodyOutcome =
  | 'intact'
  | 'tidally-stressed'
  | 'disrupted'
  | 'accretion-stream'
  | 'captured'
  | 'ejected';

export type PhysicsFlybyStage =
  | 'idle'
  | 'approach'
  | 'closest-approach'
  | 'aftermath'
  | 'complete';

export type CompleteConsumptionStage =
  | 'idle'
  | 'approach'
  | 'disruption'
  | 'accretion'
  | 'consumption'
  | 'remnant'
  | 'complete';

export interface BlackHoleBodySnapshot {
  readonly bodyId: string;
  readonly massKg: number;
  readonly radiusM: number;
  readonly positionLocalM: BlackHoleVector3;
  readonly velocityLocalMps: BlackHoleVector3;
  readonly outcome: BlackHoleBodyOutcome;
  readonly tidalStress: number;
  readonly streamProgress: number;
  readonly captureProgress: number;
}

export interface BlackHoleRenderState {
  readonly massKg: number;
  readonly massSolarMasses: number;
  readonly schwarzschildRadiusM: number;
  readonly captureRadiusM: number;
  readonly positionLocalM: BlackHoleVector3;
  readonly velocityLocalMps: BlackHoleVector3;
  readonly spinVisualization: number;
  readonly accretionDiskEnabled: boolean;
}

export interface BlackHoleDiagnostics {
  readonly kineticEnergyJ: number;
  readonly potentialEnergyJ: number;
  readonly totalEnergyJ: number;
  readonly linearMomentumKgMps: BlackHoleVector3;
  readonly linearMomentumMagnitudeKgMps: number;
  readonly angularMomentumKgM2ps: BlackHoleVector3;
  readonly angularMomentumMagnitudeKgM2ps: number;
  readonly relativeEnergyDrift: number;
  readonly relativeLinearMomentumDrift: number;
  readonly relativeAngularMomentumDrift: number;
  readonly minimumPairDistanceM: number;
  readonly chosenSubstepSeconds: number;
  readonly completedSubsteps: number;
  readonly integratedPhysicalTimeSeconds: number;
  readonly finite: boolean;
}

interface BlackHoleScenarioSnapshotBase<
  Mode extends 'physics-flyby' | 'complete-consumption-cinematic',
  Stage extends PhysicsFlybyStage | CompleteConsumptionStage,
  Parameters extends BlackHoleEncounterParameters,
> {
  readonly state: ScenarioPlaybackState;
  readonly mode: Mode;
  readonly classification: 'educational-approximation' | 'cinematic';
  readonly title: string;
  readonly warning: string;
  readonly stage: Stage;
  readonly scenarioTimeSeconds: number;
  readonly totalDurationSeconds: number;
  readonly progress: number;
  readonly playbackRate: number;
  readonly parameters: Readonly<Parameters> | null;
  readonly bodyStates: readonly Readonly<BlackHoleBodySnapshot>[];
  readonly blackHole: Readonly<BlackHoleRenderState> | null;
  readonly diagnostics: Readonly<BlackHoleDiagnostics> | null;
  readonly scenarioOriginM: BlackHoleVector3;
  readonly scenarioOriginVelocityMps: BlackHoleVector3;
  readonly runSignature: string | null;
  readonly captureCount: number;
  readonly ejectionCount: number;
  readonly survivorCount: number;
  readonly allBodiesCaptured: boolean;
}

export type PhysicsFlybySnapshot = BlackHoleScenarioSnapshotBase<
    'physics-flyby',
    PhysicsFlybyStage,
    BlackHoleEncounterParameters
  >;

export type CompleteConsumptionSnapshot = BlackHoleScenarioSnapshotBase<
    'complete-consumption-cinematic',
    CompleteConsumptionStage,
    CompleteConsumptionParameters
  >;

export const COMPLETE_CONSUMPTION_WARNING =
  'Nonphysical cinematic mode: artificial orbital damping is applied to guarantee that every body spirals inward.';

export const PHYSICS_FLYBY_WARNING =
  'Educational approximation: Newtonian gravity is integrated in double precision; lensing is visual only and outcomes are not guaranteed.';
