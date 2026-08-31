import type { VisualQuality } from '../bodies/VisualQuality';

export type BlackHoleEncounterMode =
  | 'physics-flyby'
  | 'complete-consumption-cinematic';

export type BlackHoleRenderLifecycleState =
  | 'idle'
  | 'running'
  | 'paused'
  | 'complete'
  | 'error';

export type BlackHoleRenderStage =
  | 'idle'
  | 'approach'
  | 'closest-approach'
  | 'aftermath'
  | 'disruption'
  | 'accretion'
  | 'consumption'
  | 'remnant'
  | 'complete';

export type BlackHoleBodyOutcome =
  | 'intact'
  | 'tidally-stressed'
  | 'disrupted'
  | 'accretion-stream'
  | 'captured'
  | 'ejected';

export type BlackHoleLensingPath = 'off' | 'simplified' | 'schwarzschild';

export type BlackHoleVectorTuple = readonly [number, number, number];

/**
 * Rendering subset of a Phase 10 scenario body snapshot. Positions remain in
 * scenario-local SI coordinates until DebugSolarSystemRenderer maps them.
 */
export interface BlackHoleBodyRenderState {
  readonly bodyId: string;
  readonly massKg: number;
  readonly radiusM: number;
  readonly positionLocalM: BlackHoleVectorTuple;
  readonly velocityLocalMps: BlackHoleVectorTuple;
  readonly outcome: BlackHoleBodyOutcome;
  readonly tidalStress: number;
  readonly streamProgress: number;
  readonly captureProgress: number;
}

export interface BlackHoleSourceRenderState {
  readonly massKg: number;
  readonly massSolarMasses: number;
  readonly schwarzschildRadiusM: number;
  readonly captureRadiusM: number;
  readonly positionLocalM: BlackHoleVectorTuple;
  readonly velocityLocalMps: BlackHoleVectorTuple;
  /** Visual-only disk direction/asymmetry control; it does not alter physics. */
  readonly spinVisualization: number;
  readonly accretionDiskEnabled: boolean;
}

/**
 * Adapter-friendly renderer input matching the scenario snapshot vocabulary.
 * This is not an orbital-GR state: trajectory positions come from the
 * scenario's Newtonian integrator, while lensing is a separate visual effect.
 */
export interface BlackHoleRenderState {
  readonly lifecycleState: BlackHoleRenderLifecycleState;
  readonly mode: BlackHoleEncounterMode;
  readonly stage: BlackHoleRenderStage;
  readonly scenarioTimeSeconds: number;
  readonly progress: number;
  readonly scenarioOriginM: BlackHoleVectorTuple;
  readonly scenarioOriginVelocityMps: BlackHoleVectorTuple;
  readonly blackHole: Readonly<BlackHoleSourceRenderState>;
  readonly bodyStates: readonly Readonly<BlackHoleBodyRenderState>[];
  readonly runSignature: string;
}

export interface BlackHoleMappedBodyRenderState {
  readonly bodyId: string;
  readonly positionRenderUnits: BlackHoleVectorTuple;
  readonly radiusRenderUnits: number;
  readonly outcome: BlackHoleBodyOutcome;
  readonly tidalStress: number;
  readonly streamProgress: number;
  readonly captureProgress: number;
}

/** Internal, finite screen/scene-space frame consumed by the visual system. */
export interface BlackHoleVisualFrame {
  readonly lifecycleState: BlackHoleRenderLifecycleState;
  readonly mode: BlackHoleEncounterMode;
  readonly stage: BlackHoleRenderStage;
  readonly scenarioTimeSeconds: number;
  readonly progress: number;
  readonly runSignature: string;
  readonly positionRenderUnits: BlackHoleVectorTuple;
  readonly eventHorizonRadiusRenderUnits: number;
  readonly minimumVisualRadiusRenderUnits: number;
  readonly accretionDiskEnabled: boolean;
  readonly spinVisualization: number;
  readonly bodies: readonly Readonly<BlackHoleMappedBodyRenderState>[];
}

export interface BlackHoleLensingDiagnostics {
  readonly active: boolean;
  readonly path: BlackHoleLensingPath;
  readonly quality: VisualQuality;
  readonly highQualitySupported: boolean;
  readonly centerNdc: readonly [number, number];
  readonly eventHorizonRadiusNdc: number;
  readonly influenceRadiusNdc: number;
  readonly finite: boolean;
}

export interface BlackHoleVisualDiagnostics {
  readonly active: boolean;
  readonly mode: BlackHoleEncounterMode | 'none';
  readonly lifecycleState: BlackHoleRenderLifecycleState;
  readonly stage: BlackHoleRenderStage;
  readonly runSignature: string;
  readonly eventHorizonRadiusRenderUnits: number;
  readonly visualRadiusRenderUnits: number;
  readonly presentationRadiusExaggerated: boolean;
  readonly accretionDiskVisible: boolean;
  readonly streamPointCount: number;
  readonly capturedBodyCount: number;
  readonly disruptedBodyCount: number;
  readonly baseBodyOverrideCount: number;
  readonly finite: boolean;
  readonly lensing: Readonly<BlackHoleLensingDiagnostics>;
}

export const EMPTY_BLACK_HOLE_LENSING_DIAGNOSTICS: Readonly<BlackHoleLensingDiagnostics> =
  Object.freeze({
    active: false,
    path: 'off',
    quality: 'high',
    highQualitySupported: false,
    centerNdc: Object.freeze([0, 0] as const),
    eventHorizonRadiusNdc: 0,
    influenceRadiusNdc: 0,
    finite: true,
  });

export const EMPTY_BLACK_HOLE_VISUAL_DIAGNOSTICS: Readonly<BlackHoleVisualDiagnostics> =
  Object.freeze({
    active: false,
    mode: 'none',
    lifecycleState: 'idle',
    stage: 'idle',
    runSignature: '',
    eventHorizonRadiusRenderUnits: 0,
    visualRadiusRenderUnits: 0,
    presentationRadiusExaggerated: false,
    accretionDiskVisible: false,
    streamPointCount: 0,
    capturedBodyCount: 0,
    disruptedBodyCount: 0,
    baseBodyOverrideCount: 0,
    finite: true,
    lensing: EMPTY_BLACK_HOLE_LENSING_DIAGNOSTICS,
  });
