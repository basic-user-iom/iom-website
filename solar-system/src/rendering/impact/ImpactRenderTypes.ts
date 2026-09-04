import type { CameraCloseUpPresetId } from '../camera/CameraCloseUpPresets';
import type { CameraMode } from '../camera/CameraTypes';
import type { ImpactVisibilityMode } from './ImpactVisibility';

export const IMPACT_LIFECYCLE_STATES = [
  'idle',
  'armed',
  'running',
  'paused',
  'complete',
  'error',
] as const;

export type ImpactLifecycleState = (typeof IMPACT_LIFECYCLE_STATES)[number];

export const IMPACT_VISUAL_STAGES = [
  'idle',
  'preview',
  'approach',
  'entry',
  'atmospheric-entry',
  'fragmentation',
  'airburst',
  'impact',
  'impact-flash',
  'ejecta',
  'plume',
  'haze',
  'aftermath',
  'complete',
  'error',
] as const;

export type ImpactVisualStage = (typeof IMPACT_VISUAL_STAGES)[number];

export const IMPACT_PRESENTATION_MODES = ['preview', 'playback'] as const;

export type ImpactPresentationMode = (typeof IMPACT_PRESENTATION_MODES)[number];

export interface ImpactBodyLocalDirection {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ImpactLocalEnuPositionM {
  readonly eastM: number;
  readonly northM: number;
  readonly upM: number;
}

export const IMPACT_IMPACTOR_MATERIALS = ['porous-rock', 'stone', 'iron'] as const;

export type ImpactImpactorMaterial = (typeof IMPACT_IMPACTOR_MATERIALS)[number];

export const IMPACT_ENTRY_EFFECT_PROFILES = ['none', 'thin', 'dense', 'giant'] as const;

export type ImpactEntryEffectProfile = (typeof IMPACT_ENTRY_EFFECT_PROFILES)[number];

export const IMPACT_RENDER_TARGET_CLASSES = [
  'airless-rocky',
  'thin-atmosphere-rocky',
  'dense-atmosphere-rocky',
  'gas-giant',
  'ice-giant',
] as const;

export type ImpactRenderTargetClass = (typeof IMPACT_RENDER_TARGET_CLASSES)[number];

export const IMPACT_RENDER_OUTCOME_KINDS = [
  'solid-surface-impact',
  'airburst',
  'deep-atmosphere-breakup',
] as const;

export type ImpactRenderOutcomeKind = (typeof IMPACT_RENDER_OUTCOME_KINDS)[number];

export const IMPACT_SURFACE_EFFECT_PROFILES = [
  'none',
  'solid-airless',
  'solid-atmospheric',
  'giant-atmospheric',
] as const;

export type ImpactSurfaceEffectProfile = (typeof IMPACT_SURFACE_EFFECT_PROFILES)[number];

export const IMPACT_AFTERMATH_KINDS = [
  'none',
  'crater',
  'dusty-crater',
  'cloud-scar',
] as const;

export type ImpactAftermathKind = (typeof IMPACT_AFTERMATH_KINDS)[number];

/**
 * Rendering-only snapshot produced by the Impact Lab scenario boundary.
 *
 * Positions in the typed arrays are interleaved east/north/up metres in the
 * selected target body's local tangent frame. Physical calculations remain
 * outside rendering; the size/effect fields are the scenario's explicitly
 * authored visual profile.
 */
export interface ImpactRenderState {
  /** Preview exposes only setup guidance; playback exposes the simulated event. */
  readonly presentationMode: ImpactPresentationMode;
  readonly lifecycleState: ImpactLifecycleState;
  readonly stage: ImpactVisualStage;
  readonly scenarioTimeSeconds: number;
  readonly progress: number;
  /** Stable identity of the body whose visual root owns this local event. */
  readonly targetBodyId: string;
  /** Physical mean radius of the target body; never a presentation-scale radius. */
  readonly targetRadiusM: number;
  /** Render-shape axes in the same physical scale as targetRadiusM. */
  readonly targetEquatorialRadiusM: number;
  readonly targetPolarRadiusM: number;
  readonly targetClass: ImpactRenderTargetClass;
  readonly surfaceGravityMps2: number;
  readonly supportsCrater: boolean;
  readonly supportsGroundShockwave: boolean;
  readonly supportsAtmosphericShockwave: boolean;
  readonly supportsPersistentSurfaceDecal: boolean;
  readonly supportsCloudScar: boolean;
  readonly outcomeKind: ImpactRenderOutcomeKind;
  readonly surfaceEffectProfile: ImpactSurfaceEffectProfile;
  readonly aftermathKind: ImpactAftermathKind;
  readonly impactNormalBodyLocal: Readonly<ImpactBodyLocalDirection>;
  readonly impactEastBodyLocal: Readonly<ImpactBodyLocalDirection>;
  readonly impactNorthBodyLocal: Readonly<ImpactBodyLocalDirection>;
  readonly impactorLocalEnuM: Readonly<ImpactLocalEnuPositionM> | null;
  /** Velocity in the same local ENU component order as impactorLocalEnuM, in m/s. */
  readonly impactorVelocityLocalEnuMps: Readonly<ImpactLocalEnuPositionM> | null;
  readonly trailLocalEnuM: Float64Array;
  readonly fragmentsLocalEnuM: Float64Array;
  readonly physicalDiameterM: number;
  readonly impactorMaterial: ImpactImpactorMaterial;
  readonly entryEffectProfile: ImpactEntryEffectProfile;
  readonly normalizedHeating: number;
  readonly normalizedDynamicPressure: number;
  readonly remainingMassFraction: number;
  /** Null before the terminal event, otherwise deterministic time since it. */
  readonly eventElapsedSeconds: number | null;
  readonly flashIntensity: number;
  readonly flashRadiusM: number;
  readonly craterRadiusM: number;
  readonly craterDepthM: number;
  readonly scorchRadiusM: number;
  readonly craterFormationProgress: number;
  readonly surfaceScorchOpacity: number;
  readonly ejectaRadiusM: number;
  readonly ejectaLaunchSpeedMps: number;
  readonly ejectaLifetimeSeconds: number;
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
  readonly cloudScarRadiusM: number;
  readonly cloudScarGrowthProgress: number;
  readonly cloudScarOpacity: number;
  readonly cloudScarAdvectionRad: number;
  /** Stable seed/parameter signature; identical runs produce identical particles. */
  readonly runSignature: string;
}

export const IMPACT_CAMERA_PRESET_IDS = [
  'overview',
  'orbital',
  'side-entry',
  'horizon',
  'chase',
  'ground-observer',
] as const;

export type ImpactCameraPresetId = (typeof IMPACT_CAMERA_PRESET_IDS)[number];

export interface ImpactCameraPose {
  /** Target-visual-root-local coordinates, where one unit is one target radius. */
  readonly position: Readonly<ImpactBodyLocalDirection>;
  readonly target: Readonly<ImpactBodyLocalDirection>;
  readonly up: Readonly<ImpactBodyLocalDirection>;
}

export interface RendererCameraSnapshot {
  readonly selectedBodyId: string;
  readonly mode: CameraMode;
  readonly closeUpPresetId: CameraCloseUpPresetId | null;
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly up: readonly [number, number, number];
}

export interface ImpactVisualDiagnostics {
  readonly active: boolean;
  readonly presentationMode: ImpactPresentationMode;
  readonly lifecycleState: ImpactLifecycleState;
  readonly stage: ImpactVisualStage;
  readonly runSignature: string;
  readonly cameraPresetId: ImpactCameraPresetId | null;
  readonly visibilityMode: ImpactVisibilityMode;
  readonly visibilityMultiplier: number;
  readonly reticleVisible: boolean;
  readonly projectedTrajectoryPointCount: number;
  readonly trailPointCount: number;
  readonly fragmentCount: number;
  readonly ejectaPointCount: number;
  readonly plumePointCount: number;
  readonly impactorVisible: boolean;
  readonly bowShockVisible: boolean;
  readonly plasmaVisible: boolean;
  readonly entryTrailVisible: boolean;
  /** Alignment of the rendered entry-effect axis and physical ENU velocity. */
  readonly velocityAlignmentDot: number;
  readonly impactorSizeExaggerated: boolean;
  readonly normalizedHeating: number;
  readonly entryEffectProfile: ImpactEntryEffectProfile;
  readonly entryEffectIntensity: number;
  readonly outcomeKind: ImpactRenderOutcomeKind | null;
  readonly surfaceEffectProfile: ImpactSurfaceEffectProfile;
  readonly aftermathKind: ImpactAftermathKind;
  readonly flashVisible: boolean;
  readonly flashAttachmentErrorM: number;
  readonly flashNormalAlignmentDot: number;
  readonly flashCapAngularRadiusRad: number;
  readonly flashLightVisible: boolean;
  readonly flashHdrClamped: boolean;
  readonly craterVisible: boolean;
  readonly craterAttachmentErrorM: number;
  readonly craterAngularRadiusRad: number;
  readonly craterFormationProgress: number;
  readonly craterPersistent: boolean;
  readonly shockwaveVisible: boolean;
  readonly groundShockwaveVisible: boolean;
  readonly atmosphericShockwaveVisible: boolean;
  readonly groundShockwaveAngularRadiusRad: number;
  readonly atmosphericShockwaveAngularRadiusRad: number;
  readonly shockwaveSurfaceConforming: boolean;
  readonly ejectaActiveCount: number;
  readonly ejectaRecontactCount: number;
  readonly plumeVisible: boolean;
  readonly plumeLayerCount: number;
  readonly plumeCoolingProgress: number;
  readonly cloudScarVisible: boolean;
  readonly cloudRippleVisible: boolean;
  readonly cloudScarAngularRadiusRad: number;
  readonly cloudScarOpacity: number;
  readonly cloudScarAdvectionRad: number;
  readonly solidSurfaceEffectsSuppressed: boolean;
  readonly aftermathPersistent: boolean;
  readonly activeObjectCount: number;
  readonly hazeVisible: boolean;
  readonly effectiveFlashIntensity: number;
  readonly boundingRadiusMultiplier: number;
}

export const EMPTY_IMPACT_DIAGNOSTICS: Readonly<ImpactVisualDiagnostics> = Object.freeze({
  active: false,
  presentationMode: 'playback',
  lifecycleState: 'idle',
  stage: 'idle',
  runSignature: '',
  cameraPresetId: null,
  visibilityMode: 'physical',
  visibilityMultiplier: 1,
  reticleVisible: false,
  projectedTrajectoryPointCount: 0,
  trailPointCount: 0,
  fragmentCount: 0,
  ejectaPointCount: 0,
  plumePointCount: 0,
  impactorVisible: false,
  bowShockVisible: false,
  plasmaVisible: false,
  entryTrailVisible: false,
  velocityAlignmentDot: 0,
  impactorSizeExaggerated: false,
  normalizedHeating: 0,
  entryEffectProfile: 'none',
  entryEffectIntensity: 0,
  outcomeKind: null,
  surfaceEffectProfile: 'none',
  aftermathKind: 'none',
  flashVisible: false,
  flashAttachmentErrorM: 0,
  flashNormalAlignmentDot: 0,
  flashCapAngularRadiusRad: 0,
  flashLightVisible: false,
  flashHdrClamped: false,
  craterVisible: false,
  craterAttachmentErrorM: 0,
  craterAngularRadiusRad: 0,
  craterFormationProgress: 0,
  craterPersistent: false,
  shockwaveVisible: false,
  groundShockwaveVisible: false,
  atmosphericShockwaveVisible: false,
  groundShockwaveAngularRadiusRad: 0,
  atmosphericShockwaveAngularRadiusRad: 0,
  shockwaveSurfaceConforming: false,
  ejectaActiveCount: 0,
  ejectaRecontactCount: 0,
  plumeVisible: false,
  plumeLayerCount: 0,
  plumeCoolingProgress: 0,
  cloudScarVisible: false,
  cloudRippleVisible: false,
  cloudScarAngularRadiusRad: 0,
  cloudScarOpacity: 0,
  cloudScarAdvectionRad: 0,
  solidSurfaceEffectsSuppressed: false,
  aftermathPersistent: false,
  activeObjectCount: 0,
  hazeVisible: false,
  effectiveFlashIntensity: 0,
  boundingRadiusMultiplier: 1,
});
