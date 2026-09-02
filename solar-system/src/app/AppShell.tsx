import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  captureBlackHoleInitialState,
  createPlaceholderBlackHoleInitialState,
} from './BlackHoleScenarioState';
import {
  readExperimentalTideMode,
  toggleExperimentalTideComponent,
  type ExperimentalTideComponent,
} from './ExperimentalFeatures';

import ephemerisBinaryUrl from '../data/generated/solar-system-ephemeris.v1.bin?url';
import ephemerisManifestUrl from '../data/generated/solar-system-ephemeris.manifest.json?url';
import ephemerisValidationUrl from '../data/generated/solar-system-ephemeris.validation.json?url';
import smallBodyEphemerisBinaryUrl from '../data/generated/small-body-ephemeris.v1.bin?url';
import smallBodyEphemerisManifestUrl from '../data/generated/small-body-ephemeris.manifest.json?url';
import smallBodySegmentsUrl from '../data/generated/small-body-segments.json?url';
import smallBodyValidationUrl from '../data/generated/small-body-ephemeris.validation.json?url';
import { DebugCanvas } from '../rendering/DebugCanvas';
import {
  getGiantAtmosphereProfile,
  isGiantPlanetId,
} from '../rendering/bodies/GiantPlanetProfiles';
import type {
  DebugSolarSystemRenderer,
  RendererExposureSnapshot,
} from '../rendering/DebugSolarSystemRenderer';
import {
  type ImpactCameraPresetId,
  type ImpactRenderState,
  type ImpactVisualStage,
  type RendererCameraSnapshot,
} from '../rendering/impact';
import type {
  FictionalSupernovaPhase,
  FictionalSupernovaRenderState,
  SolarEvolutionPhase,
  SolarEvolutionRenderState,
} from '../rendering/solar-fate';
import type { BlackHoleRenderState as BlackHoleSceneRenderState } from '../rendering/black-hole';
import type { EarthTideDebugRenderSample } from '../rendering/tides/EarthTideDebugOverlay';
import {
  EPHEMERIS_ORBIT_DISPLAY_SPAN_DAYS,
  createEphemerisOrbitGeometry,
  createEphemerisTrailGeometry,
  type EphemerisPathGeometry,
} from '../rendering/EphemerisOrbitGeometry';
import type { DebugBodyRenderState, DebugRenderFrame } from '../rendering/RenderContext';
import { sampleCometTail } from '../rendering/comets/CometTailDynamics';
import type { CometFrameState } from '../rendering/comets/CometVisualSystem';
import type { RenderScaleMode } from '../rendering/RenderScaleModel';
import { ISS_MODEL_ASSET } from '../rendering/spaceobjects/SpaceObjectAssetCatalog';
import {
  CINEMATIC_TOUR_ROUTE,
  CinematicTourController,
  getCameraCloseUpPreset,
  type CameraCloseUpPresetId,
  type CameraMode,
  type CinematicTourTransitionSummary,
  type CinematicTourWaypoint,
} from '../rendering/camera';
import {
  EPHEMERIS_BODY_IDS,
} from '../simulation/bodies/EphemerisBodyCatalog';
import { getEphemerisRotationModel } from '../simulation/bodies/RotationModelCatalog';
import {
  COMET_BODY_IDS,
  cometEphemerisWarning,
  getCometDefinition,
  getCometVisualProfile,
  type CometBodyId,
} from '../simulation/bodies/CometBodyCatalog';
import {
  OBSERVATORY_BODY_DEFINITIONS,
  OBSERVATORY_BODY_IDS,
  createObservatoryBodyRuntimeStates,
  getObservatoryBodyDefinition,
  isObservatoryBodyId,
  type ObservatoryBodyDefinition,
  type ObservatoryBodyId,
} from '../simulation/bodies/ObservatoryBodyCatalog';
import {
  NATURAL_SATELLITE_DEFINITIONS,
  getNaturalSatelliteDefinition,
} from '../simulation/satellites';
import {
  EARTH_SATELLITE_DEFINITIONS,
  getEarthSatelliteDefinition,
  sampleEarthSatellite,
} from '../simulation/artificial';
import {
  SPACECRAFT_DEFINITIONS,
  getSpacecraftDefinition,
  nearestSpacecraftCoverageJdTdb,
} from '../simulation/spacecraft';
import { FloatingOrigin } from '../simulation/core/FloatingOrigin';
import { approximateTdbToDateUtc } from '../simulation/core/JulianDate';
import {
  SimulationClock,
  type SimulationClockSnapshot,
} from '../simulation/core/SimulationClock';
import { SimulationContext } from '../simulation/core/SimulationContext';
import { SECONDS_PER_DAY } from '../simulation/core/Units';
import {
  SimulationEngine,
  type SimulationFrame,
} from '../simulation/core/SimulationEngine';
import { createVec3d, lengthVec3d } from '../simulation/core/Vec3d';
import { EphemerisOutOfRangeError } from '../simulation/ephemeris/EphemerisErrors';
import type { EphemerisProvider } from '../simulation/ephemeris/EphemerisProvider';
import type { GeneratedEphemerisManifest } from '../simulation/ephemeris/EphemerisTypes';
import { GeneratedEphemerisProvider } from '../simulation/ephemeris/GeneratedEphemerisProvider';
import { CompositeEphemerisProvider } from '../simulation/ephemeris/CompositeEphemerisProvider';
import { verifySmallBodyBundleIntegrity } from '../simulation/ephemeris/SmallBodyBundleIntegrity';
import {
  SegmentedEphemerisProvider,
  type SegmentedEphemerisBodyDefinition,
} from '../simulation/ephemeris/SegmentedEphemerisProvider';
import { ScenarioManager } from '../simulation/scenarios/ScenarioManager';
import {
  EphemerisTidalForcingService,
  createTidalForcingSample,
} from '../simulation/modules/TidalForcingService';
import {
  AsteroidImpactScenario,
  DEFAULT_IMPACT_PARAMETERS,
  deriveImpactVisualProfile,
  getImpactTargetProfile,
  impactRunSignature,
  simulateImpactEntry,
  type ImpactCameraMode,
  type ImpactParameters,
  type ImpactScenarioSnapshot,
  type ImpactSimulationResult,
} from '../simulation/scenarios/impact';
import {
  DEFAULT_FICTIONAL_SOLAR_SUPERNOVA_PARAMETERS,
  DEFAULT_SCIENTIFIC_SOLAR_EVOLUTION_PARAMETERS,
  FICTIONAL_SOLAR_SUPERNOVA_IDLE_SNAPSHOT,
  SCIENTIFIC_SOLAR_EVOLUTION_IDLE_SNAPSHOT,
  FictionalSolarSupernovaScenario,
  ScientificSolarEvolutionScenario,
  type FictionalSolarSupernovaSnapshot,
  type FictionalSolarSupernovaStage,
  type ScientificSolarEvolutionSnapshot,
  type SolarEvolutionPhaseId,
} from '../simulation/scenarios/solar-fate';
import {
  BLACK_HOLE_PHYSICS_FLYBY_IDLE_SNAPSHOT,
  COMPLETE_CONSUMPTION_IDLE_SNAPSHOT,
  BlackHolePhysicsFlybyScenario,
  CompleteConsumptionCinematicScenario,
  createDefaultCompleteConsumptionParameters,
  createDefaultPhysicsFlybyParameters,
  type BlackHoleEncounterParameters,
  type CompleteConsumptionSnapshot,
  type PhysicsFlybySnapshot,
} from '../simulation/scenarios/black-hole';
import {
  selectBodyLabelsVisible,
  selectSkyBackgroundVisible,
  selectBrightStarsVisible,
  selectCometsVisible,
  selectAsteroidBeltVisible,
  selectKuiperBeltVisible,
  selectCameraMode,
  selectMotionPreference,
  selectReduceFlashes,
  selectPreferencesHydrated,
  selectOrbitLinesVisible,
  selectReducedMotion,
  selectRenderScaleMode,
  selectSetVenusSurfaceMode,
  selectSetVisualQuality,
  selectSelectedTrailInterval,
  selectSelectedBodyId,
  selectSetBodyLabelsVisible,
  selectSetSkyBackgroundVisible,
  selectSetBrightStarsVisible,
  selectSetCometsVisible,
  selectSetAsteroidBeltVisible,
  selectSetKuiperBeltVisible,
  selectSetCameraMode,
  selectSetMotionPreference,
  selectSetPreferencesPersistenceSuspended,
  selectSetReduceFlashes,
  selectSetOrbitLinesVisible,
  selectSetReducedMotion,
  selectSetRenderScaleMode,
  selectSetSelectedBodyId,
  selectSetSelectedTrailInterval,
  selectSetSnapshot,
  selectSetWebGLStatus,
  selectSimulationSnapshot,
  selectVenusSurfaceMode,
  selectVisualQuality,
  selectWebGLMessage,
  selectWebGLStatus,
} from '../state/selectors';
import { createSimulationSnapshotPublisher } from '../state/simulationSnapshotPublisher';
import {
  useAppStore,
  type SelectedTrailInterval,
} from '../state/useAppStore';
import { DEFAULT_APP_PREFERENCES } from '../state/AppPreferences';
import type { EphemerisDiagnosticState } from '../ui/debug/DebugDiagnostics';
import {
  DebugTimeControls,
  type SimulationControlPort,
} from '../ui/debug/DebugTimeControls';
import type { TimePresetView } from '../ui/debug/timeControlModel';
import {
  BodyInspector,
  type SelectedBodyTelemetry,
} from '../ui/observatory/BodyInspector';
import {
  ObjectNavigator,
  type NavigatorBodyOption,
  type NavigatorCatalogTarget,
} from '../ui/observatory/ObjectNavigator';
import { ViewControls } from '../ui/observatory/ViewControls';
import { CanvasLegend } from '../ui/observatory/CanvasLegend';
import { ObservatoryViewport } from '../ui/observatory/ObservatoryViewport';
import { HelpOverlay } from '../ui/observatory/HelpOverlay';
import { ProvenanceOverlay } from '../ui/observatory/ProvenanceOverlay';
import { ImpactLabPanel } from '../ui/observatory/ImpactLabPanel';
import { NaturalSatellitePanel } from '../ui/observatory/NaturalSatellitePanel';
import { SpaceObjectsPanel } from '../ui/observatory/SpaceObjectsPanel';
import {
  FICTIONAL_SOLAR_SUPERNOVA_WARNING,
  SCIENTIFIC_SOLAR_EVOLUTION_CAVEAT,
  SolarFatePanel,
  type SolarFateActiveScenario,
} from '../ui/observatory/SolarFatePanel';
import {
  BLACK_HOLE_PHYSICS_CAVEAT,
  COMPLETE_CONSUMPTION_CINEMATIC_WARNING,
  BlackHoleEncounterPanel,
  type BlackHoleEncounterActiveScenario,
  type BlackHoleFlybyPanelParameters,
} from '../ui/observatory/BlackHoleEncounterPanel';
import {
  createObservatoryShortcutHandler,
  type ObservatoryShortcutAction,
} from '../input/ObservatoryShortcuts';
import {
  createEphemerisDecoder,
  type EphemerisDecoder,
} from '../workers/EphemerisWorkerClient';

const SNAPSHOT_INTERVAL_MS = 100;
const PATH_REFRESH_MIN_REAL_MS = 100;
const EXPECTED_BINARY_FILE = 'solar-system-ephemeris.v1.bin';
const EXPECTED_SMALL_BODY_BINARY_FILE = 'small-body-ephemeris.v1.bin';
const surfaceAssetManifestUrl = `${import.meta.env.BASE_URL}assets/source-manifest.json`;
const moonSurfaceAssetManifestUrl = `${import.meta.env.BASE_URL}assets/moons/manifest.json`;

const BODY_OPTIONS: readonly NavigatorBodyOption[] = Object.freeze(
  OBSERVATORY_BODY_DEFINITIONS.map(({ id, displayName, kind }) => {
    if (kind !== 'star' && kind !== 'planet' && kind !== 'moon' && kind !== 'comet') {
      throw new Error(`Unsupported observatory body kind "${kind}".`);
    }
    return Object.freeze({ id: requireObservatoryBodyId(id), displayName, kind });
  }),
);

const CATALOG_TARGETS: readonly NavigatorCatalogTarget[] = Object.freeze([
  ...NATURAL_SATELLITE_DEFINITIONS.filter((satellite) => satellite.id !== 'moon').map((satellite) => Object.freeze({
    id: satellite.id,
    displayName: satellite.name,
    kind: 'natural-satellite' as const,
    detail: `${formatCatalogParent(satellite.parentId)} · ${satellite.tier === 'major' ? 'major moon' : 'compact point record'}`,
    searchText: `${satellite.id} ${satellite.parentId} ${satellite.visualProfile}`,
  })),
  ...EARTH_SATELLITE_DEFINITIONS.map((satellite) => Object.freeze({
    id: satellite.id,
    displayName: satellite.name,
    kind: 'earth-satellite' as const,
    detail: `NORAD ${satellite.catalogId} · ${satellite.category.replaceAll('-', ' ')}`,
    searchText: `${satellite.catalogId} ${satellite.objectId ?? ''} ${satellite.category}`,
  })),
  ...SPACECRAFT_DEFINITIONS.map((mission) => Object.freeze({
    id: mission.id,
    displayName: mission.name,
    kind: 'spacecraft' as const,
    detail: `${mission.operator} · ${mission.status}`,
    searchText: `${mission.missionId} ${mission.primaryTargets.join(' ')}`,
  })),
]);

function formatCatalogParent(parentId: string): string {
  return parentId.charAt(0).toLocaleUpperCase() + parentId.slice(1);
}

const INITIAL_EPHEMERIS_DIAGNOSTICS: Readonly<EphemerisDiagnosticState> = Object.freeze({
  status: 'loading',
  providerLabel: 'JPL Horizons · bundled',
  coverageLabel: 'Reading manifest…',
  message: null,
});

const INITIAL_SELECTED_BODY_TELEMETRY: Readonly<SelectedBodyTelemetry> = Object.freeze({
  distanceFromSunM: 0,
  speedMps: 0,
});

interface SelectedVisualStatus {
  readonly materialLabel: string;
  readonly assetState: string;
}

interface SelectedCometStatus {
  readonly bodyId: CometBodyId;
  readonly activity: number;
  readonly dustHistorySpanDays: number;
  readonly orbitId: string;
  readonly elementEpochJdTdb: number;
  readonly approximationWarning: string | null;
}

const INITIAL_VISUAL_STATUS: Readonly<SelectedVisualStatus> = Object.freeze({
  materialLabel: 'Observatory renderer starting',
  assetState: 'Waiting for renderer',
});

const INITIAL_IMPACT_SNAPSHOT: Readonly<ImpactScenarioSnapshot> = Object.freeze({
  state: 'idle',
  stage: 'idle',
  scenarioTimeSeconds: 0,
  totalDurationSeconds: 0,
  progress: 0,
  playbackRate: 1,
  parameters: null,
  physicalSummary: null,
  visualProfile: null,
  impactFrame: null,
  impactorPosition: null,
  impactorVelocity: null,
  normalizedHeating: 0,
  normalizedDynamicPressure: 0,
  remainingMassFraction: 1,
  eventElapsedSeconds: null,
  craterFormationProgress: 0,
  surfaceScorchOpacity: 0,
  trailPositions: Object.freeze([]),
  fragmentPositions: Object.freeze([]),
  flashIntensity: 0,
  ejectaRadiusM: 0,
  ejectaHeightM: 0,
  ejectaOpacity: 0,
  shockwaveRadiusM: 0,
  groundShockwaveAngularRadiusRad: 0,
  groundShockwaveOpacity: 0,
  atmosphericShockwaveAngularRadiusRad: 0,
  atmosphericShockwaveOpacity: 0,
  plumeHeightM: 0,
  plumeRadiusM: 0,
  plumeOpacity: 0,
  plumeCoolingProgress: 0,
  hazeOpacity: 0,
  cloudScarGrowthProgress: 0,
  cloudScarOpacity: 0,
  cloudScarAdvectionRad: 0,
  runSignature: null,
  fragmentCount: 0,
});

const DEFAULT_IMPACT_PREVIEW = simulateImpactEntry(DEFAULT_IMPACT_PARAMETERS);
const DEFAULT_IMPACT_VISUAL_PROFILE = deriveImpactVisualProfile(
  DEFAULT_IMPACT_PREVIEW.physicalSummary,
);
const PLACEHOLDER_BLACK_HOLE_INITIAL_STATE = createPlaceholderBlackHoleInitialState();
const DEFAULT_BLACK_HOLE_PANEL_PARAMETERS = blackHolePanelParametersFrom(
  createDefaultPhysicsFlybyParameters(PLACEHOLDER_BLACK_HOLE_INITIAL_STATE),
);

interface MutableDebugBodyRenderState {
  readonly bodyId: string;
  readonly displayName: string;
  readonly kind: 'star' | 'planet' | 'moon' | 'comet';
  readonly meanRadiusM: number;
  readonly positionM: DebugBodyRenderState['positionM'];
  readonly velocityMps: DebugBodyRenderState['velocityMps'];
  visible: boolean;
}

interface MutableDebugRenderFrame {
  currentJdTdb: number;
  readonly originM: DebugRenderFrame['originM'];
  originRevision: number;
  readonly bodies: readonly DebugBodyRenderState[];
  trails: readonly EphemerisPathGeometry[];
}

interface ObservatoryRuntime {
  readonly context: SimulationContext;
  readonly engine: SimulationEngine;
  readonly provider: EphemerisProvider;
  selectedBodyId: ObservatoryBodyId;
  cameraMode: CameraMode;
  renderScaleMode: RenderScaleMode;
  selectedTrailInterval: SelectedTrailInterval;
  focusedBodyId: string;
  originBodyId: string;
  documentVisible: boolean;
  forcePublish(): void;
  refreshDynamicPaths(force: boolean): void;
  synchronizeTrackedOrigin(): void;
  synchronizeEphemeris(): boolean;
  renderNow(): void;
}

interface SavedTourPreferences {
  readonly selectedBodyId: ObservatoryBodyId;
  readonly cameraMode: CameraMode;
}

interface ScenarioEnvironmentSnapshot {
  readonly selectedBodyId: ObservatoryBodyId;
  readonly cameraMode: CameraMode;
  readonly renderScaleMode: RenderScaleMode;
  readonly clock: Readonly<SimulationClockSnapshot>;
  readonly rendererCamera: Readonly<RendererCameraSnapshot> | null;
  readonly rendererExposure: Readonly<RendererExposureSnapshot> | null;
}

function captureScenarioEnvironmentSnapshot(
  runtime: Readonly<ObservatoryRuntime>,
  renderer: DebugSolarSystemRenderer | null,
): Readonly<ScenarioEnvironmentSnapshot> {
  return Object.freeze({
    selectedBodyId: runtime.selectedBodyId,
    cameraMode: runtime.cameraMode,
    renderScaleMode: runtime.renderScaleMode,
    clock: runtime.context.clock.snapshot(),
    rendererCamera: renderer?.captureCameraState() ?? null,
    rendererExposure: renderer?.captureExposureState() ?? null,
  });
}

export function AppShell() {
  const experimentalTideMode = useMemo(() => readExperimentalTideMode(), []);
  const [activeTideMode, setActiveTideMode] = useState(experimentalTideMode);
  const activeTideModeRef = useRef(experimentalTideMode);
  const rendererRef = useRef<DebugSolarSystemRenderer | null>(null);
  const runtimeRef = useRef<ObservatoryRuntime | null>(null);
  const impactScenarioRef = useRef<AsteroidImpactScenario | null>(null);
  const solarEvolutionScenarioRef = useRef<ScientificSolarEvolutionScenario | null>(null);
  const fictionalSupernovaScenarioRef = useRef<FictionalSolarSupernovaScenario | null>(null);
  const blackHolePhysicsScenarioRef = useRef<BlackHolePhysicsFlybyScenario | null>(null);
  const completeConsumptionScenarioRef =
    useRef<CompleteConsumptionCinematicScenario | null>(null);
  const scenarioManagerRef = useRef<ScenarioManager<ScenarioEnvironmentSnapshot> | null>(null);
  const impactPreviewEnvironmentRef =
    useRef<Readonly<ScenarioEnvironmentSnapshot> | null>(null);
  const impactPreviewSuspendedRef = useRef(false);
  const impactPreviewNeedsFocusRef = useRef(false);
  const impactPreviewPublishedRef = useRef(false);
  const impactPreviewTargetBodyIdRef =
    useRef<ImpactParameters['targetBodyId'] | null>(null);
  const tourApplyingWaypointRef = useRef(false);
  const savedTourPreferencesRef = useRef<Readonly<SavedTourPreferences> | null>(null);
  const documentVisibleRef = useRef(
    typeof document === 'undefined' || document.visibilityState === 'visible',
  );
  const [ephemeris, setEphemeris] = useState(INITIAL_EPHEMERIS_DIAGNOSTICS);
  const [cometShortcutAvailable, setCometShortcutAvailable] = useState(false);
  const [selectedBodyTelemetry, setSelectedBodyTelemetry] = useState(
    INITIAL_SELECTED_BODY_TELEMETRY,
  );
  const [presentationWarningRequired, setPresentationWarningRequired] = useState(true);
  const [selectedVisualStatus, setSelectedVisualStatus] = useState(INITIAL_VISUAL_STATUS);
  const [selectedCometStatus, setSelectedCometStatus] =
    useState<Readonly<SelectedCometStatus> | null>(null);
  const [activeCloseUpPresetId, setActiveCloseUpPresetId] =
    useState<CameraCloseUpPresetId | null>(null);
  const [pathCoverageWarnings, setPathCoverageWarnings] = useState<
    Readonly<Record<string, string>>
  >({});
  const [tourSummary, setTourSummary] =
    useState<Readonly<CinematicTourTransitionSummary> | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [provenanceOpen, setProvenanceOpen] = useState(false);
  const [impactLabOpen, setImpactLabOpen] = useState(false);
  const [solarFateOpen, setSolarFateOpen] = useState(false);
  const [blackHoleEncounterOpen, setBlackHoleEncounterOpen] = useState(false);
  const [naturalSatelliteVisible, setNaturalSatelliteVisible] = useState(true);
  const [majorMoonsVisible, setMajorMoonsVisible] = useState(true);
  const [minorMoonsVisible, setMinorMoonsVisible] = useState(false);
  const [moonOrbitsVisible, setMoonOrbitsVisible] = useState(true);
  const [moonLabelsVisible, setMoonLabelsVisible] = useState(true);
  const [selectedNaturalSatelliteId, setSelectedNaturalSatelliteId] = useState<string | null>(null);
  const [spaceObjectsVisible, setSpaceObjectsVisible] = useState(true);
  const [earthSatellitesVisible, setEarthSatellitesVisible] = useState(true);
  const [spacecraftVisible, setSpacecraftVisible] = useState(true);
  const [selectedSpaceObjectId, setSelectedSpaceObjectId] = useState<string | null>(null);
  const [impactParameters, setImpactParameters] = useState<Readonly<ImpactParameters>>(
    DEFAULT_IMPACT_PARAMETERS,
  );
  const impactParametersRef = useRef<Readonly<ImpactParameters>>(
    DEFAULT_IMPACT_PARAMETERS,
  );
  const [impactSnapshot, setImpactSnapshot] = useState(INITIAL_IMPACT_SNAPSHOT);
  const [impactError, setImpactError] = useState<string | null>(null);
  const [solarEvolutionSnapshot, setSolarEvolutionSnapshot] = useState(
    SCIENTIFIC_SOLAR_EVOLUTION_IDLE_SNAPSHOT,
  );
  const [fictionalSupernovaSnapshot, setFictionalSupernovaSnapshot] = useState(
    FICTIONAL_SOLAR_SUPERNOVA_IDLE_SNAPSHOT,
  );
  const [solarFateError, setSolarFateError] = useState<string | null>(null);
  const [blackHolePanelParameters, setBlackHolePanelParameters] =
    useState<Readonly<BlackHoleFlybyPanelParameters>>(
      DEFAULT_BLACK_HOLE_PANEL_PARAMETERS,
    );
  const [blackHolePhysicsSnapshot, setBlackHolePhysicsSnapshot] = useState(
    BLACK_HOLE_PHYSICS_FLYBY_IDLE_SNAPSHOT,
  );
  const [completeConsumptionSnapshot, setCompleteConsumptionSnapshot] = useState(
    COMPLETE_CONSUMPTION_IDLE_SNAPSHOT,
  );
  const [blackHoleError, setBlackHoleError] = useState<string | null>(null);
  const [tourController] = useState(
    () => new CinematicTourController({
      onTransition: setTourSummary,
    }),
  );

  const snapshot = useAppStore(selectSimulationSnapshot);
  const webglStatus = useAppStore(selectWebGLStatus);
  const webglMessage = useAppStore(selectWebGLMessage);
  const reducedMotion = useAppStore(selectReducedMotion);
  const motionPreference = useAppStore(selectMotionPreference);
  const reduceFlashes = useAppStore(selectReduceFlashes);
  const preferencesHydrated = useAppStore(selectPreferencesHydrated);
  const selectedBodyId = useAppStore(selectSelectedBodyId);
  const cameraMode = useAppStore(selectCameraMode);
  const renderScaleMode = useAppStore(selectRenderScaleMode);
  const visualQuality = useAppStore(selectVisualQuality);
  const venusSurfaceMode = useAppStore(selectVenusSurfaceMode);
  const orbitLinesVisible = useAppStore(selectOrbitLinesVisible);
  const bodyLabelsVisible = useAppStore(selectBodyLabelsVisible);
  const skyBackgroundVisible = useAppStore(selectSkyBackgroundVisible);
  const brightStarsVisible = useAppStore(selectBrightStarsVisible);
  const cometsVisible = useAppStore(selectCometsVisible);
  const asteroidBeltVisible = useAppStore(selectAsteroidBeltVisible);
  const kuiperBeltVisible = useAppStore(selectKuiperBeltVisible);
  const selectedTrailInterval = useAppStore(selectSelectedTrailInterval);
  const setSnapshot = useAppStore(selectSetSnapshot);
  const setWebGLStatus = useAppStore(selectSetWebGLStatus);
  const setReducedMotion = useAppStore(selectSetReducedMotion);
  const updateMotionPreference = useAppStore(selectSetMotionPreference);
  const setPreferencesPersistenceSuspended = useAppStore(
    selectSetPreferencesPersistenceSuspended,
  );
  const updateReduceFlashes = useAppStore(selectSetReduceFlashes);
  const updateSelectedBodyId = useAppStore(selectSetSelectedBodyId);
  const updateCameraMode = useAppStore(selectSetCameraMode);
  const updateRenderScaleMode = useAppStore(selectSetRenderScaleMode);
  const updateVisualQuality = useAppStore(selectSetVisualQuality);
  const updateVenusSurfaceMode = useAppStore(selectSetVenusSurfaceMode);
  const updateOrbitLinesVisible = useAppStore(selectSetOrbitLinesVisible);
  const updateBodyLabelsVisible = useAppStore(selectSetBodyLabelsVisible);
  const updateSkyBackgroundVisible = useAppStore(selectSetSkyBackgroundVisible);
  const updateBrightStarsVisible = useAppStore(selectSetBrightStarsVisible);
  const updateCometsVisible = useAppStore(selectSetCometsVisible);
  const updateAsteroidBeltVisible = useAppStore(selectSetAsteroidBeltVisible);
  const updateKuiperBeltVisible = useAppStore(selectSetKuiperBeltVisible);
  const updateSelectedTrailInterval = useAppStore(selectSetSelectedTrailInterval);

  const impactPreview = useMemo(() => {
    try {
      const simulation = simulateImpactEntry(impactParameters);
      return Object.freeze({
        parameters: impactParameters,
        simulation,
        visualProfile: deriveImpactVisualProfile(simulation.physicalSummary),
      });
    } catch {
      return Object.freeze({
        parameters: DEFAULT_IMPACT_PARAMETERS,
        simulation: DEFAULT_IMPACT_PREVIEW,
        visualProfile: DEFAULT_IMPACT_VISUAL_PROFILE,
      });
    }
  }, [impactParameters]);
  const impactPhysicalSummary =
    impactSnapshot.physicalSummary ?? impactPreview.simulation.physicalSummary;
  const impactVisualProfile =
    impactSnapshot.visualProfile ?? impactPreview.visualProfile;
  const impactActive = impactSnapshot.state !== 'idle';
  const solarEvolutionActive = solarEvolutionSnapshot.state !== 'idle';
  const fictionalSupernovaActive = fictionalSupernovaSnapshot.state !== 'idle';
  const solarFateActive = solarEvolutionActive || fictionalSupernovaActive;
  const blackHolePhysicsActive = blackHolePhysicsSnapshot.state !== 'idle';
  const completeConsumptionActive = completeConsumptionSnapshot.state !== 'idle';
  const blackHoleActive = blackHolePhysicsActive || completeConsumptionActive;
  const scenarioActive = impactActive || solarFateActive || blackHoleActive;
  const activeScenarioId = impactActive
    ? 'asteroid-impact'
    : solarEvolutionActive
      ? 'scientific-solar-evolution'
      : fictionalSupernovaActive
        ? 'fictional-supernova'
        : blackHolePhysicsActive
          ? 'black-hole-physics-flyby'
          : completeConsumptionActive
            ? 'black-hole-complete-consumption'
            : '';
  const solarFateMode = solarEvolutionActive
    ? 'scientific-evolution'
    : fictionalSupernovaActive
      ? 'fictional-supernova'
      : 'idle';
  const solarFateState = solarEvolutionActive
    ? solarEvolutionSnapshot.state
    : fictionalSupernovaActive
      ? fictionalSupernovaSnapshot.state
      : 'idle';
  const solarFateStage = solarEvolutionActive
    ? solarEvolutionSnapshot.stage
    : fictionalSupernovaActive
      ? fictionalSupernovaSnapshot.stage
      : 'idle';
  const solarFatePanelState = useMemo<Readonly<SolarFateActiveScenario> | null>(
    () => createSolarFatePanelState(solarEvolutionSnapshot, fictionalSupernovaSnapshot),
    [fictionalSupernovaSnapshot, solarEvolutionSnapshot],
  );
  const blackHoleMode = blackHolePhysicsActive
    ? 'physics-flyby'
    : completeConsumptionActive
      ? 'complete-consumption-cinematic'
      : 'idle';
  const blackHoleState = blackHolePhysicsActive
    ? blackHolePhysicsSnapshot.state
    : completeConsumptionActive
      ? completeConsumptionSnapshot.state
      : 'idle';
  const blackHoleStage = blackHolePhysicsActive
    ? blackHolePhysicsSnapshot.stage
    : completeConsumptionActive
      ? completeConsumptionSnapshot.stage
      : 'idle';
  const blackHolePanelState = useMemo<
    Readonly<BlackHoleEncounterActiveScenario> | null
  >(
    () => createBlackHolePanelState(
      blackHolePhysicsSnapshot,
      completeConsumptionSnapshot,
    ),
    [blackHolePhysicsSnapshot, completeConsumptionSnapshot],
  );

  const refreshSelectedVisualStatus = useCallback(
    (renderer: DebugSolarSystemRenderer | null = rendererRef.current): void => {
      if (renderer === null) return;
      const diagnostics = renderer.getVisualDiagnostics();
      const next: SelectedVisualStatus = {
        materialLabel: diagnostics.selectedMaterial,
        assetState: formatVisualAssetState(diagnostics.selectedAssetState),
      };
      setSelectedVisualStatus((current) =>
        current.materialLabel === next.materialLabel && current.assetState === next.assetState
          ? current
          : next,
      );
    },
    [setSelectedVisualStatus],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () =>
      setReducedMotion(
        motionPreference === 'reduce' ||
          (motionPreference === 'system' && mediaQuery.matches),
      );
    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, [motionPreference, setReducedMotion]);

  useEffect(() => {
    tourController.setReducedMotion(reducedMotion);
  }, [reducedMotion, tourController]);

  useEffect(() => {
    tourController.setBodyAvailabilityResolver(
      (bodyId) => runtimeRef.current?.context.getBody(bodyId)?.visible === true,
    );
  }, [tourController]);

  const handleWebGLStatusChange = useCallback(
    (status: Parameters<typeof setWebGLStatus>[0], message?: string | null) => {
      setWebGLStatus(status, message);
      const runtime = runtimeRef.current;
      if (runtime !== null) {
        if (status === 'ready' && runtime.documentVisible) runtime.engine.start();
        else runtime.engine.stop();
        runtime.forcePublish();
      }
      if (status !== 'ready' && tourController.state === 'running') {
        tourController.pause();
      }
    },
    [setWebGLStatus, tourController],
  );

  useEffect(() => {
    const abortController = new AbortController();
    let effectActive = true;
    let decoder: EphemerisDecoder | null = null;
    let disposeRuntime = (): void => undefined;

    const start = async (): Promise<void> => {
      try {
        const [manifestResponse, binaryResponse] = await Promise.all([
          fetch(ephemerisManifestUrl, { signal: abortController.signal }),
          fetch(ephemerisBinaryUrl, { signal: abortController.signal }),
        ]);
        assertSuccessfulAssetResponse(manifestResponse, 'ephemeris manifest');
        assertSuccessfulAssetResponse(binaryResponse, 'ephemeris binary');
        const manifest = (await manifestResponse.json()) as GeneratedEphemerisManifest;
        if (manifest.binaryFile !== EXPECTED_BINARY_FILE) {
          throw new Error(
            `Manifest names "${manifest.binaryFile}" but this build bundles "${EXPECTED_BINARY_FILE}".`,
          );
        }
        const binary = await binaryResponse.arrayBuffer();
        await verifyBinaryHash(binary, manifest.binarySha256);

        decoder = createEphemerisDecoder();
        const dataset = await decoder.decode(binary);
        const coreProvider = new GeneratedEphemerisProvider(dataset, manifest, {
          outOfRangeBehavior: 'throw',
        });
        for (const bodyId of EPHEMERIS_BODY_IDS) {
          if (!coreProvider.hasBody(bodyId)) {
            throw new Error(`Generated ephemeris is missing required body "${bodyId}".`);
          }
        }

        let provider: EphemerisProvider = coreProvider;
        let smallBodyBundleWarning: string | null = null;
        try {
          const [
            smallManifestResponse,
            smallBinaryResponse,
            segmentsResponse,
            smallValidationResponse,
          ] =
            await Promise.all([
              fetch(smallBodyEphemerisManifestUrl, { signal: abortController.signal }),
              fetch(smallBodyEphemerisBinaryUrl, { signal: abortController.signal }),
              fetch(smallBodySegmentsUrl, { signal: abortController.signal }),
              fetch(smallBodyValidationUrl, { signal: abortController.signal }),
            ]);
          assertSuccessfulAssetResponse(smallManifestResponse, 'small-body ephemeris manifest');
          assertSuccessfulAssetResponse(smallBinaryResponse, 'small-body ephemeris binary');
          assertSuccessfulAssetResponse(segmentsResponse, 'small-body segment routing');
          assertSuccessfulAssetResponse(smallValidationResponse, 'small-body validation');
          const smallManifest =
            (await smallManifestResponse.json()) as GeneratedEphemerisManifest;
          if (smallManifest.binaryFile !== EXPECTED_SMALL_BODY_BINARY_FILE) {
            throw new Error(
              `Small-body manifest names "${smallManifest.binaryFile}" but this build bundles "${EXPECTED_SMALL_BODY_BINARY_FILE}".`,
            );
          }
          const smallBinary = await smallBinaryResponse.arrayBuffer();
          await verifyBinaryHash(smallBinary, smallManifest.binarySha256);
          const [segmentRouting, smallValidation] = await Promise.all([
            segmentsResponse.json() as Promise<unknown>,
            smallValidationResponse.json() as Promise<unknown>,
          ]);
          await verifySmallBodyBundleIntegrity(
            smallManifest,
            smallValidation,
            segmentRouting,
          );
          const smallDataset = await decoder.decode(smallBinary);
          const segmentSource = new GeneratedEphemerisProvider(
            smallDataset,
            smallManifest,
            { outOfRangeBehavior: 'throw' },
          );
          const segmentDefinitions = parseSmallBodySegmentDefinitions(
            segmentRouting,
          );
          const cometProvider = new SegmentedEphemerisProvider(
            segmentSource,
            segmentDefinitions,
          );
          for (const bodyId of COMET_BODY_IDS) {
            if (!cometProvider.hasBody(bodyId)) {
              throw new Error(`Small-body ephemeris is missing required comet "${bodyId}".`);
            }
          }
          provider = new CompositeEphemerisProvider([coreProvider, cometProvider]);
        } catch (error) {
          smallBodyBundleWarning =
            error instanceof Error
              ? `Comet bundle unavailable: ${error.message}`
              : 'Comet bundle unavailable; planetary simulation remains active.';
        }
        decoder.dispose();
        decoder = null;
        if (!effectActive) return;
        setCometShortcutAvailable(
          COMET_BODY_IDS.some((bodyId) => provider.hasBody(bodyId)),
        );

        const tidalForcingService = experimentalTideMode === 'off'
          ? null
          : new EphemerisTidalForcingService({
              ephemerisProvider: provider,
              earthRotationModel: getEphemerisRotationModel('earth'),
            });
        const tidalForcingSample = tidalForcingService === null
          ? null
          : createTidalForcingSample();
        const tidalRenderSample = tidalForcingSample === null
          ? null
          : {
              jdTdb: 0,
              mode: experimentalTideMode,
              moonDirectionEarthFixed: tidalForcingSample.moonPositionEarthFixedM,
              sunDirectionEarthFixed: tidalForcingSample.sunPositionEarthFixedM,
              lunarAmplitude: 0,
              solarAmplitude: 0,
            } satisfies EarthTideDebugRenderSample;
        let tidalDebugSamplePublished = false;

        const clock = new SimulationClock();
        const floatingOrigin = new FloatingOrigin();
        const context = new SimulationContext({
          clock,
          floatingOrigin,
          bodies: createObservatoryBodyRuntimeStates(clock.currentJdTdb),
        });
        synchronizeBodiesFromProvider(context, provider);
        const initialUi = useAppStore.getState();
        const initialSelectedBodyId =
          initialUi.cameraMode === 'earth-moon-system'
            ? ('earth' as ObservatoryBodyId)
            : initialUi.selectedBodyId;
        if (initialSelectedBodyId !== initialUi.selectedBodyId) {
          updateSelectedBodyId(initialSelectedBodyId);
        }
        let orbitPaths = createObservatoryOrbitPaths(provider, clock.currentJdTdb);
        const orbitEpochsJdTdb = new Map<ObservatoryBodyId, number>(
          orbitPaths.map((path) => [path.bodyId, clock.currentJdTdb]),
        );
        let selectedTrail = createSelectedBodyTrail(
          provider,
          initialSelectedBodyId,
          clock.currentJdTdb,
          initialUi.selectedTrailInterval,
        );
        let selectedTrailEpochJdTdb = clock.currentJdTdb;
        let lastPathRefreshRealMs = Number.NEGATIVE_INFINITY;
        setPathCoverageWarnings(collectPathCoverageWarnings(orbitPaths));
        const engine = new SimulationEngine(context);
        const snapshotPublisher = createSimulationSnapshotPublisher({
          intervalMs: SNAPSHOT_INTERVAL_MS,
          publish: setSnapshot,
        });
        let ownedScenarioManager: ScenarioManager<ScenarioEnvironmentSnapshot> | null = null;
        let ownedUnsubscribeFrame: (() => void) | null = null;
        let cleanupStarted = false;
        disposeRuntime = () => {
          if (cleanupStarted) return;
          cleanupStarted = true;
          ownedUnsubscribeFrame?.();
          ownedUnsubscribeFrame = null;
          engine.dispose();
          snapshotPublisher.reset();
          if (runtimeRef.current?.engine === engine) runtimeRef.current = null;
          impactPreviewEnvironmentRef.current = null;
          impactPreviewPublishedRef.current = false;
          impactPreviewNeedsFocusRef.current = false;
          impactPreviewTargetBodyIdRef.current = null;
          if (
            ownedScenarioManager !== null &&
            scenarioManagerRef.current === ownedScenarioManager
          ) {
            scenarioManagerRef.current = null;
            impactScenarioRef.current = null;
            solarEvolutionScenarioRef.current = null;
            fictionalSupernovaScenarioRef.current = null;
            blackHolePhysicsScenarioRef.current = null;
            completeConsumptionScenarioRef.current = null;
          }
          const manager = ownedScenarioManager;
          ownedScenarioManager = null;
          if (manager !== null) {
            void manager.dispose().catch((cleanupError: unknown) => {
              if (!effectActive) return;
              setEphemeris({
                status: 'error',
                providerLabel: 'JPL Horizons Â· generated bundle',
                coverageLabel: 'Cleanup failed',
                message:
                  cleanupError instanceof Error
                    ? cleanupError.message
                    : 'Scenario cleanup failed.',
              });
            });
          }
        };
        const renderBodies: MutableDebugBodyRenderState[] = OBSERVATORY_BODY_DEFINITIONS.map(
          (definition) => {
            const runtimeBody = context.getBody(definition.id);
            if (runtimeBody === undefined) {
              throw new Error(`Ephemeris body runtime state is missing for "${definition.id}".`);
            }
            if (
              definition.kind !== 'star' &&
              definition.kind !== 'planet' &&
              definition.kind !== 'moon' &&
              definition.kind !== 'comet'
            ) {
              throw new Error(`Unsupported observatory body kind "${definition.kind}".`);
            }
            return {
              bodyId: definition.id,
              displayName: definition.displayName,
              kind: definition.kind,
              meanRadiusM:
                'visualNucleusRadiusM' in definition
                  ? definition.visualNucleusRadiusM
                  : definition.meanRadiusM,
              positionM: runtimeBody.positionM,
              velocityMps: runtimeBody.velocityMps,
              visible: runtimeBody.visible && provider.hasBody(definition.id),
            };
          },
        );
        const renderOriginM = createVec3d();
        const renderFrame: MutableDebugRenderFrame = {
          currentJdTdb: clock.currentJdTdb,
          originM: renderOriginM,
          originRevision: floatingOrigin.revision,
          bodies: renderBodies,
          trails: mergeEphemerisPaths(orbitPaths, selectedTrail),
        };
        const renderContext = { frame: renderFrame, realDeltaSeconds: 0 };
        const earthCoverage = provider.getCoverage('earth');
        if (earthCoverage === undefined) {
          throw new Error('Generated Earth ephemeris has no declared coverage.');
        }
        const coverageLabel =
          `${earthCoverage.startJdTdb.toFixed(1)}–` +
          `${earthCoverage.endJdTdb.toFixed(1)} JD TDB`;
        const providerLabel =
          smallBodyBundleWarning === null
            ? 'JPL Horizons · planetary + segmented comet bundles'
            : 'JPL Horizons · planetary bundle';
        let runtimeDiagnosticStatus: EphemerisDiagnosticState['status'] = 'ready';
        let runtimeDiagnosticMessage: string | null = smallBodyBundleWarning;
        let latestFrame: Readonly<SimulationFrame> | null = null;
        let lastSnapshotFrameMs = Number.NEGATIVE_INFINITY;

        const updateDiagnostics = (
          status: EphemerisDiagnosticState['status'],
          message: string | null,
        ): void => {
          if (status === runtimeDiagnosticStatus && message === runtimeDiagnosticMessage) return;
          runtimeDiagnosticStatus = status;
          runtimeDiagnosticMessage = message;
          setEphemeris({ status, providerLabel, coverageLabel, message });
        };

        const synchronizeEphemeris = (): boolean => {
          try {
            synchronizeBodiesFromProvider(context, provider);
            updateDiagnostics('ready', smallBodyBundleWarning);
            return true;
          } catch (error) {
            clock.setPaused(true);
            if (error instanceof EphemerisOutOfRangeError) {
              updateDiagnostics(
                'out-of-range',
                `JD ${error.requestedJdTdb.toFixed(6)} is outside the generated 2000–2100 range. Set a supported date to continue.`,
              );
            } else {
              updateDiagnostics(
                'error',
                error instanceof Error ? error.message : 'Ephemeris sampling failed.',
              );
            }
            return false;
          }
        };

        const publishSnapshot = (force: boolean): void => {
          const frameNowMs = latestFrame?.nowMs ?? performance.now();
          if (!force && frameNowMs - lastSnapshotFrameMs < SNAPSHOT_INTERVAL_MS) return;
          const runtime = runtimeRef.current;
          if (runtime === null || runtime.engine !== engine) return;

          const frame = latestFrame;
          const published = snapshotPublisher.publish(
            {
              currentJdTdb: clock.currentJdTdb,
              currentUtcIso: clock.getApproximateUtcDate().toISOString(),
              paused: clock.paused,
              direction: clock.direction,
              timeScale: clock.timeScale,
              dtRealSeconds: frame?.dtRealSeconds ?? 0,
              dtSimSeconds: frame?.dtSimSeconds ?? 0,
              originRevision: floatingOrigin.revision,
              focusedBodyId: runtime.focusedBodyId,
              originBodyId: runtime.originBodyId,
              renderFps: rendererRef.current?.getSmoothedFps() ?? null,
              documentVisible: runtime.documentVisible,
            },
            force,
          );
          if (published) {
            lastSnapshotFrameMs = frameNowMs;
            const selectedBody = context.getBody(runtime.selectedBodyId);
            if (selectedBody !== undefined) {
              setSelectedBodyTelemetry({
                distanceFromSunM: lengthVec3d(selectedBody.positionM),
                speedMps: lengthVec3d(selectedBody.velocityMps),
              });
            }
            const scaleModel = rendererRef.current?.getScaleModel();
            setPresentationWarningRequired(
              scaleModel?.presentationWarningRequired ??
                runtime.renderScaleMode === 'presentation',
            );
            refreshSelectedVisualStatus();
            const cometDefinition = getCometDefinition(runtime.selectedBodyId);
            const cometDiagnostics = rendererRef.current?.getPhaseSixDiagnostics().comet;
            if (cometDefinition === undefined) {
              setSelectedCometStatus(null);
            } else {
              setSelectedCometStatus({
                bodyId: cometDefinition.id,
                activity:
                  cometDiagnostics?.bodyId === cometDefinition.id
                    ? cometDiagnostics.activity
                    : 0,
                dustHistorySpanDays:
                  cometDiagnostics?.bodyId === cometDefinition.id
                    ? cometDiagnostics.dustHistorySpanDays
                    : 0,
                orbitId: cometDefinition.jplOrbitId,
                elementEpochJdTdb: cometDefinition.orbitElementEpochJdTdb,
                approximationWarning:
                  cometDiagnostics?.bodyId === cometDefinition.id
                    ? cometDiagnostics.approximationWarning
                    : cometEphemerisWarning(cometDefinition.id, clock.currentJdTdb),
              });
            }
          }
        };

        let lastCometTailEpochJdTdb = Number.NEGATIVE_INFINITY;
        const updateCometFrameStates = (): void => {
          const renderer = rendererRef.current;
          if (renderer === null) return;
          if (Math.abs(clock.currentJdTdb - lastCometTailEpochJdTdb) < 1 / 24) return;
          const states: CometFrameState[] = [];
          for (const bodyId of COMET_BODY_IDS) {
            if (!provider.hasBody(bodyId)) continue;
            const profile = getCometVisualProfile(bodyId);
            const definition = getCometDefinition(bodyId);
            if (profile === undefined || definition === undefined) continue;
            try {
              const warning = cometEphemerisWarning(bodyId, clock.currentJdTdb);
              states.push({
                bodyId,
                tail: sampleCometTail(
                  provider,
                  bodyId,
                  clock.currentJdTdb,
                  profile.activity,
                  { quality: useAppStore.getState().visualQuality },
                ),
                trustedEphemeris:
                  clock.currentJdTdb >= definition.trustedStartJdTdb &&
                  clock.currentJdTdb <= definition.trustedEndJdTdb,
                approximationWarning: warning,
              });
            } catch {
              // A single optional comet must never pause the planetary observatory.
            }
          }
          renderer.setCometFrameStates(Object.freeze(states));
          lastCometTailEpochJdTdb = clock.currentJdTdb;
        };

        const renderNow = (): void => {
          renderFrame.currentJdTdb = clock.currentJdTdb;
          renderFrame.originRevision = floatingOrigin.revision;
          floatingOrigin.getOrigin(renderOriginM);
          for (const renderBody of renderBodies) {
            renderBody.visible =
              provider.hasBody(renderBody.bodyId) &&
              (context.getBody(renderBody.bodyId)?.visible ?? false);
          }
          updateCometFrameStates();
          const renderer = rendererRef.current;
          if (renderer === null) return;
          if (
            tidalForcingService !== null
            && tidalForcingSample !== null
            && tidalRenderSample !== null
          ) {
            if (ownedScenarioManager?.activeScenarioId === null) {
              tidalForcingService.sampleEarth(clock.currentJdTdb, tidalForcingSample);
              const maximumScale = Math.max(
                tidalForcingSample.lunarTidalTensorScaleS2,
                tidalForcingSample.solarTidalTensorScaleS2,
              );
              tidalRenderSample.jdTdb = tidalForcingSample.jdTdb;
              tidalRenderSample.mode = activeTideModeRef.current;
              tidalRenderSample.lunarAmplitude =
                tidalForcingSample.lunarTidalTensorScaleS2 / maximumScale;
              tidalRenderSample.solarAmplitude =
                tidalForcingSample.solarTidalTensorScaleS2 / maximumScale;
              renderer.setEarthTideDebugSample(tidalRenderSample);
              tidalDebugSamplePublished = true;
            } else if (tidalDebugSamplePublished) {
              renderer.setEarthTideDebugSample(null);
              tidalDebugSamplePublished = false;
            }
          }
          renderer.renderFrame(renderContext);
        };

        const runtime: ObservatoryRuntime = {
          context,
          engine,
          provider,
          selectedBodyId: initialSelectedBodyId,
          cameraMode: initialUi.cameraMode,
          renderScaleMode: initialUi.renderScaleMode,
          selectedTrailInterval: initialUi.selectedTrailInterval,
          focusedBodyId: initialSelectedBodyId,
          originBodyId: 'sun',
          documentVisible: documentVisibleRef.current,
          forcePublish: () => publishSnapshot(true),
          refreshDynamicPaths(force) {
            const nowMs = performance.now();
            if (!force && nowMs - lastPathRefreshRealMs < PATH_REFRESH_MIN_REAL_MS) {
              return;
            }
            lastPathRefreshRealMs = nowMs;

            let pathsChanged = false;
            orbitPaths = orbitPaths.map((path) => {
              const previousEpochJdTdb = orbitEpochsJdTdb.get(path.bodyId);
              const refreshCadenceDays = orbitRefreshCadenceDays(path.bodyId);
              if (
                !force &&
                previousEpochJdTdb !== undefined &&
                Math.abs(clock.currentJdTdb - previousEpochJdTdb) < refreshCadenceDays
              ) {
                return path;
              }
              pathsChanged = true;
              orbitEpochsJdTdb.set(path.bodyId, clock.currentJdTdb);
              return createObservatoryOrbitPath(provider, path.bodyId, clock.currentJdTdb);
            });

            const trailCadenceDays = selectedTrailRefreshCadenceDays(
              provider,
              runtime.selectedBodyId,
            );
            if (
              force ||
              Math.abs(clock.currentJdTdb - selectedTrailEpochJdTdb) >= trailCadenceDays
            ) {
              selectedTrail = createSelectedBodyTrail(
                provider,
                runtime.selectedBodyId,
                clock.currentJdTdb,
                runtime.selectedTrailInterval,
              );
              selectedTrailEpochJdTdb = clock.currentJdTdb;
              pathsChanged = true;
            }

            if (pathsChanged) {
              renderFrame.trails = mergeEphemerisPaths(orbitPaths, selectedTrail);
              const nextWarnings = collectPathCoverageWarnings(orbitPaths);
              setPathCoverageWarnings((currentWarnings) =>
                equalWarningRecords(currentWarnings, nextWarnings)
                  ? currentWarnings
                  : nextWarnings,
              );
            }
          },
          synchronizeTrackedOrigin() {
            const anchorBodyId =
              runtime.cameraMode === 'overview' ? 'sun' : runtime.selectedBodyId;
            const anchor = context.getBody(anchorBodyId);
            if (anchor === undefined) return;
            context.rebaseOriginTo(anchor.positionM);
            runtime.originBodyId = anchorBodyId;
          },
          synchronizeEphemeris,
          renderNow,
        };

        const capturedBlackHoleState = captureBlackHoleInitialState(context);
        setBlackHolePanelParameters(
          blackHolePanelParametersFrom(
            createDefaultPhysicsFlybyParameters(capturedBlackHoleState),
          ),
        );
        const impactScenario = new AsteroidImpactScenario();
        const solarEvolutionScenario = new ScientificSolarEvolutionScenario();
        const fictionalSupernovaScenario = new FictionalSolarSupernovaScenario();
        const blackHolePhysicsScenario = new BlackHolePhysicsFlybyScenario();
        const completeConsumptionScenario = new CompleteConsumptionCinematicScenario();
        const scenarioManager = new ScenarioManager<ScenarioEnvironmentSnapshot>({
          context,
          environment: {
            capture: () =>
              impactPreviewEnvironmentRef.current ??
              captureScenarioEnvironmentSnapshot(runtime, rendererRef.current),
            prepare: (scenarioId) => {
              if (!effectActive) return;
              setPreferencesPersistenceSuspended(true);
              clock.setPaused(true);
              const impactMode = scenarioId === impactScenario.id;
              const solarFateMode =
                scenarioId === solarEvolutionScenario.id ||
                scenarioId === fictionalSupernovaScenario.id;
              const blackHoleMode =
                scenarioId === blackHolePhysicsScenario.id ||
                scenarioId === completeConsumptionScenario.id;
              const targetBodyId: ObservatoryBodyId = impactMode
                ? impactParametersRef.current.targetBodyId
                : 'sun';
              const scenarioCameraMode: CameraMode = blackHoleMode
                ? 'free-orbit'
                : 'body-follow';
              updateSelectedBodyId(targetBodyId);
              updateCameraMode(scenarioCameraMode);
              runtime.selectedBodyId = targetBodyId;
              runtime.focusedBodyId = targetBodyId;
              runtime.cameraMode = scenarioCameraMode;
              runtime.renderScaleMode = 'presentation';
              const renderer = rendererRef.current;
              impactPreviewEnvironmentRef.current = null;
              impactPreviewPublishedRef.current = false;
              impactPreviewNeedsFocusRef.current = false;
              impactPreviewTargetBodyIdRef.current = null;
              renderer?.setEarthTideDebugSample(null);
              tidalDebugSamplePublished = false;
              renderer?.resetImpactVisuals();
              renderer?.resetSolarFateVisuals();
              renderer?.resetBlackHoleVisuals();
              renderer?.setSelectedBody(targetBodyId);
              renderer?.setCameraMode(scenarioCameraMode);
              renderer?.setScaleMode('presentation');
              setPresentationWarningRequired(true);
              setImpactLabOpen(impactMode);
              setSolarFateOpen(solarFateMode);
              setBlackHoleEncounterOpen(blackHoleMode);
              setImpactError(null);
              setSolarFateError(null);
              setBlackHoleError(null);
              runtime.refreshDynamicPaths(true);
              runtime.synchronizeTrackedOrigin();
              runtime.forcePublish();
            },
            restore: (saved) => {
              if (!effectActive) return;
              const renderer = rendererRef.current;
              impactPreviewEnvironmentRef.current = null;
              impactPreviewPublishedRef.current = false;
              impactPreviewNeedsFocusRef.current = false;
              impactPreviewTargetBodyIdRef.current = null;
              renderer?.resetImpactVisuals();
              renderer?.setImpactCameraPreset(null);
              renderer?.resetSolarFateVisuals();
              renderer?.resetBlackHoleVisuals();

              clock.setCurrentJdTdb(saved.clock.currentJdTdb);
              clock.setDirection(saved.clock.direction);
              clock.setTimeScale(saved.clock.timeScale);
              if (saved.clock.scrubTargetJdTdb === null) {
                clock.clearScrubTarget();
              } else {
                clock.setScrubTargetJdTdb(saved.clock.scrubTargetJdTdb);
              }
              clock.setPaused(saved.clock.paused);

              updateSelectedBodyId(saved.selectedBodyId);
              updateCameraMode(saved.cameraMode);
              updateRenderScaleMode(saved.renderScaleMode);
              runtime.selectedBodyId = saved.selectedBodyId;
              runtime.focusedBodyId = saved.selectedBodyId;
              runtime.cameraMode = saved.cameraMode;
              runtime.renderScaleMode = saved.renderScaleMode;
              renderer?.setSelectedBody(saved.selectedBodyId);
              renderer?.setCameraMode(saved.cameraMode);
              renderer?.setScaleMode(saved.renderScaleMode);
              if (saved.rendererCamera !== null) {
                renderer?.restoreCameraState(saved.rendererCamera);
              }
              if (saved.rendererExposure !== null) {
                renderer?.restoreExposureState(saved.rendererExposure);
              }
              setPresentationWarningRequired(
                renderer?.getScaleModel().presentationWarningRequired ??
                  saved.renderScaleMode === 'presentation',
              );
              runtime.synchronizeEphemeris();
              runtime.refreshDynamicPaths(true);
              runtime.synchronizeTrackedOrigin();
              runtime.renderNow();
              runtime.forcePublish();
              setPreferencesPersistenceSuspended(false);
              setImpactSnapshot(impactScenario.getSnapshot());
              setSolarEvolutionSnapshot(solarEvolutionScenario.getSnapshot());
              setFictionalSupernovaSnapshot(fictionalSupernovaScenario.getSnapshot());
              setBlackHolePhysicsSnapshot(blackHolePhysicsScenario.getSnapshot());
              setCompleteConsumptionSnapshot(completeConsumptionScenario.getSnapshot());
              setImpactError(null);
              setSolarFateError(null);
              setBlackHoleError(null);
            },
          },
        });
        ownedScenarioManager = scenarioManager;
        await scenarioManager.register(impactScenario);
        if (!effectActive) return;
        await scenarioManager.register(solarEvolutionScenario);
        if (!effectActive) return;
        await scenarioManager.register(fictionalSupernovaScenario);
        if (!effectActive) return;
        await scenarioManager.register(blackHolePhysicsScenario);
        if (!effectActive) return;
        await scenarioManager.register(completeConsumptionScenario);
        if (!effectActive) return;
        runtimeRef.current = runtime;
        impactScenarioRef.current = impactScenario;
        solarEvolutionScenarioRef.current = solarEvolutionScenario;
        fictionalSupernovaScenarioRef.current = fictionalSupernovaScenario;
        blackHolePhysicsScenarioRef.current = blackHolePhysicsScenario;
        completeConsumptionScenarioRef.current = completeConsumptionScenario;
        scenarioManagerRef.current = scenarioManager;

        const activeRenderer = rendererRef.current;
        activeRenderer?.setSelectedBody(initialSelectedBodyId);
        activeRenderer?.setCameraMode(initialUi.cameraMode);
        activeRenderer?.setScaleMode(initialUi.renderScaleMode);
        activeRenderer?.setVisualQuality(initialUi.visualQuality);
        activeRenderer?.setVenusSurfaceMode(initialUi.venusSurfaceMode);
        activeRenderer?.setOrbitLinesVisible(initialUi.orbitLinesVisible);
        activeRenderer?.setBodyLabelsVisible(initialUi.bodyLabelsVisible);
        activeRenderer?.setSkyBackgroundVisible(initialUi.skyBackgroundVisible);
        activeRenderer?.setBrightStarsVisible(initialUi.brightStarsVisible);
        activeRenderer?.setCometsVisible(initialUi.cometsVisible);
        activeRenderer?.setStatisticalBeltVisible('asteroid-belt', initialUi.asteroidBeltVisible);
        activeRenderer?.setStatisticalBeltVisible('kuiper-belt', initialUi.kuiperBeltVisible);
        runtime.synchronizeTrackedOrigin();

        let lastScenarioUiFrameMs = Number.NEGATIVE_INFINITY;
        let lastImpactUiState = impactScenario.state;
        let lastImpactUiStage = impactScenario.getSnapshot().stage;
        let lastSolarEvolutionUiState = solarEvolutionScenario.state;
        let lastSolarEvolutionUiStage = solarEvolutionScenario.getSnapshot().stage;
        let lastFictionalUiState = fictionalSupernovaScenario.state;
        let lastFictionalUiStage = fictionalSupernovaScenario.getSnapshot().stage;
        let lastBlackHolePhysicsUiState = blackHolePhysicsScenario.state;
        let lastBlackHolePhysicsUiStage = blackHolePhysicsScenario.getSnapshot().stage;
        let lastCompleteConsumptionUiState = completeConsumptionScenario.state;
        let lastCompleteConsumptionUiStage = completeConsumptionScenario.getSnapshot().stage;
        const unsubscribeFrame = engine.onFrame((frame) => {
          latestFrame = frame;
          if (
            rendererRef.current !== null &&
            useAppStore.getState().webglStatus === 'ready'
          ) {
            tourController.advance(frame.dtRealSeconds);
          }
          const activeScenarioId = scenarioManager.activeScenarioId;
          if (activeScenarioId !== null) {
            scenarioManager.advance(frame.dtRealSeconds);
            if (activeScenarioId === impactScenario.id) {
              const nextImpactSnapshot = impactScenario.getSnapshot();
              rendererRef.current?.setImpactRenderState(
                createImpactRenderState(nextImpactSnapshot),
              );
              if (
                frame.nowMs - lastScenarioUiFrameMs >= SNAPSHOT_INTERVAL_MS ||
                nextImpactSnapshot.state !== lastImpactUiState ||
                nextImpactSnapshot.stage !== lastImpactUiStage
              ) {
                lastScenarioUiFrameMs = frame.nowMs;
                lastImpactUiState = nextImpactSnapshot.state;
                lastImpactUiStage = nextImpactSnapshot.stage;
                setImpactSnapshot(nextImpactSnapshot);
              }
            } else if (activeScenarioId === solarEvolutionScenario.id) {
              const nextSolarEvolutionSnapshot = solarEvolutionScenario.getSnapshot();
              rendererRef.current?.setSolarEvolutionRenderState(
                createSolarEvolutionRenderState(nextSolarEvolutionSnapshot),
              );
              if (
                frame.nowMs - lastScenarioUiFrameMs >= SNAPSHOT_INTERVAL_MS ||
                nextSolarEvolutionSnapshot.state !== lastSolarEvolutionUiState ||
                nextSolarEvolutionSnapshot.stage !== lastSolarEvolutionUiStage
              ) {
                lastScenarioUiFrameMs = frame.nowMs;
                lastSolarEvolutionUiState = nextSolarEvolutionSnapshot.state;
                lastSolarEvolutionUiStage = nextSolarEvolutionSnapshot.stage;
                setSolarEvolutionSnapshot(nextSolarEvolutionSnapshot);
              }
            } else if (activeScenarioId === fictionalSupernovaScenario.id) {
              const nextFictionalSnapshot = fictionalSupernovaScenario.getSnapshot();
              rendererRef.current?.setFictionalSupernovaRenderState(
                createFictionalSupernovaRenderState(nextFictionalSnapshot),
              );
              if (
                frame.nowMs - lastScenarioUiFrameMs >= SNAPSHOT_INTERVAL_MS ||
                nextFictionalSnapshot.state !== lastFictionalUiState ||
                nextFictionalSnapshot.stage !== lastFictionalUiStage
              ) {
                lastScenarioUiFrameMs = frame.nowMs;
                lastFictionalUiState = nextFictionalSnapshot.state;
                lastFictionalUiStage = nextFictionalSnapshot.stage;
                setFictionalSupernovaSnapshot(nextFictionalSnapshot);
              }
            } else if (activeScenarioId === blackHolePhysicsScenario.id) {
              const nextBlackHoleSnapshot = blackHolePhysicsScenario.getSnapshot();
              rendererRef.current?.setBlackHoleRenderState(
                createBlackHoleRenderState(nextBlackHoleSnapshot),
              );
              if (
                frame.nowMs - lastScenarioUiFrameMs >= SNAPSHOT_INTERVAL_MS ||
                nextBlackHoleSnapshot.state !== lastBlackHolePhysicsUiState ||
                nextBlackHoleSnapshot.stage !== lastBlackHolePhysicsUiStage
              ) {
                lastScenarioUiFrameMs = frame.nowMs;
                lastBlackHolePhysicsUiState = nextBlackHoleSnapshot.state;
                lastBlackHolePhysicsUiStage = nextBlackHoleSnapshot.stage;
                setBlackHolePhysicsSnapshot(nextBlackHoleSnapshot);
              }
            } else if (activeScenarioId === completeConsumptionScenario.id) {
              const nextConsumptionSnapshot = completeConsumptionScenario.getSnapshot();
              rendererRef.current?.setBlackHoleRenderState(
                createBlackHoleRenderState(nextConsumptionSnapshot),
              );
              if (
                frame.nowMs - lastScenarioUiFrameMs >= SNAPSHOT_INTERVAL_MS ||
                nextConsumptionSnapshot.state !== lastCompleteConsumptionUiState ||
                nextConsumptionSnapshot.stage !== lastCompleteConsumptionUiStage
              ) {
                lastScenarioUiFrameMs = frame.nowMs;
                lastCompleteConsumptionUiState = nextConsumptionSnapshot.state;
                lastCompleteConsumptionUiStage = nextConsumptionSnapshot.stage;
                setCompleteConsumptionSnapshot(nextConsumptionSnapshot);
              }
            }
          }
          if (synchronizeEphemeris()) {
            runtime.synchronizeTrackedOrigin();
            runtime.refreshDynamicPaths(false);
            renderContext.realDeltaSeconds = frame.dtRealSeconds;
            renderNow();
          }
          publishSnapshot(false);
        });
        ownedUnsubscribeFrame = unsubscribeFrame;

        setEphemeris({
          status: 'ready',
          providerLabel,
          coverageLabel,
          message: smallBodyBundleWarning,
        });
        renderNow();
        publishSnapshot(true);
        if (
          effectActive &&
          runtime.documentVisible &&
          useAppStore.getState().webglStatus === 'ready'
        ) {
          engine.start();
        }
      } catch (error) {
        disposeRuntime();
        if (!effectActive || abortController.signal.aborted) return;
        setCometShortcutAvailable(false);
        setEphemeris({
          status: 'error',
          providerLabel: 'JPL Horizons · generated bundle',
          coverageLabel: 'Unavailable',
          message: error instanceof Error ? error.message : 'Generated ephemeris failed to load.',
        });
      }
    };

    void start();
    return () => {
      effectActive = false;
      abortController.abort();
      decoder?.dispose();
      disposeRuntime();
    };
  }, [
    experimentalTideMode,
    refreshSelectedVisualStatus,
    setPreferencesPersistenceSuspended,
    setSnapshot,
    tourController,
    updateCameraMode,
    updateRenderScaleMode,
    updateSelectedBodyId,
  ]);

  const restoreIdleImpactPreviewEnvironment = useCallback((): void => {
    const saved = impactPreviewEnvironmentRef.current;
    const hadPublishedPreview = impactPreviewPublishedRef.current;
    if (saved === null && !hadPublishedPreview) return;

    impactPreviewEnvironmentRef.current = null;
    impactPreviewPublishedRef.current = false;
    impactPreviewNeedsFocusRef.current = false;
    impactPreviewTargetBodyIdRef.current = null;

    const renderer = rendererRef.current;
    renderer?.resetImpactVisuals();
    renderer?.setImpactCameraPreset(null);

    const runtime = runtimeRef.current;
    if (saved !== null && runtime !== null) {
      const clock = runtime.context.clock;
      clock.setCurrentJdTdb(saved.clock.currentJdTdb);
      clock.setDirection(saved.clock.direction);
      clock.setTimeScale(saved.clock.timeScale);
      if (saved.clock.scrubTargetJdTdb === null) {
        clock.clearScrubTarget();
      } else {
        clock.setScrubTargetJdTdb(saved.clock.scrubTargetJdTdb);
      }
      clock.setPaused(saved.clock.paused);

      updateSelectedBodyId(saved.selectedBodyId);
      updateCameraMode(saved.cameraMode);
      updateRenderScaleMode(saved.renderScaleMode);
      runtime.selectedBodyId = saved.selectedBodyId;
      runtime.focusedBodyId = saved.selectedBodyId;
      runtime.cameraMode = saved.cameraMode;
      runtime.renderScaleMode = saved.renderScaleMode;
      renderer?.setSelectedBody(saved.selectedBodyId);
      renderer?.setCameraMode(saved.cameraMode);
      renderer?.setScaleMode(saved.renderScaleMode);
      if (saved.rendererCamera !== null) {
        renderer?.restoreCameraState(saved.rendererCamera);
      }
      if (saved.rendererExposure !== null) {
        renderer?.restoreExposureState(saved.rendererExposure);
      }
      setPresentationWarningRequired(
        renderer?.getScaleModel().presentationWarningRequired ??
          saved.renderScaleMode === 'presentation',
      );
      runtime.synchronizeEphemeris();
      runtime.refreshDynamicPaths(true);
      runtime.synchronizeTrackedOrigin();
      runtime.renderNow();
      runtime.forcePublish();
    }
    setPreferencesPersistenceSuspended(false);
  }, [
    setPreferencesPersistenceSuspended,
    updateCameraMode,
    updateRenderScaleMode,
    updateSelectedBodyId,
  ]);

  useEffect(() => {
    const manager = scenarioManagerRef.current;
    const scenario = impactScenarioRef.current;
    const scenarioIdle = (scenario?.state ?? impactSnapshot.state) === 'idle';

    if (!impactLabOpen) {
      if (scenarioIdle && (manager?.activeScenarioId ?? null) === null) {
        restoreIdleImpactPreviewEnvironment();
      }
      return;
    }
    if (
      !scenarioIdle ||
      (manager?.activeScenarioId ?? null) !== null ||
      impactPreviewSuspendedRef.current
    ) {
      return;
    }

    const runtime = runtimeRef.current;
    const renderer = rendererRef.current;
    if (runtime === null || renderer === null || webglStatus !== 'ready') return;

    if (impactPreviewEnvironmentRef.current === null) {
      impactPreviewEnvironmentRef.current = captureScenarioEnvironmentSnapshot(
        runtime,
        renderer,
      );
      setPreferencesPersistenceSuspended(true);
    }

    const previewState = createImpactPreviewRenderState(
      impactPreview.parameters,
      impactPreview.simulation,
    );
    renderer.setImpactCameraPreset(null);
    renderer.setImpactRenderState(previewState);
    impactPreviewPublishedRef.current = true;

    const targetBodyId = impactPreview.parameters.targetBodyId;
    const shouldFocusTarget =
      impactPreviewNeedsFocusRef.current ||
      impactPreviewTargetBodyIdRef.current !== targetBodyId;
    if (shouldFocusTarget) {
      updateSelectedBodyId(targetBodyId);
      updateCameraMode('body-follow');
      runtime.selectedBodyId = targetBodyId;
      runtime.focusedBodyId = targetBodyId;
      runtime.cameraMode = 'body-follow';
      runtime.refreshDynamicPaths(true);
      runtime.synchronizeTrackedOrigin();
      renderer.setSelectedBody(targetBodyId);
      renderer.focusBody(targetBodyId, 'body-follow');
      impactPreviewNeedsFocusRef.current = false;
      impactPreviewTargetBodyIdRef.current = targetBodyId;
    }
    runtime.renderNow();
    runtime.forcePublish();
  }, [
    impactLabOpen,
    impactPreview,
    impactSnapshot.state,
    restoreIdleImpactPreviewEnvironment,
    setPreferencesPersistenceSuspended,
    updateCameraMode,
    updateSelectedBodyId,
    webglStatus,
  ]);

  const handleRendererReady = useCallback((renderer: DebugSolarSystemRenderer | null) => {
    rendererRef.current = renderer;
    if (renderer === null) return;
    const ui = useAppStore.getState();
    renderer.setSelectedBody(ui.selectedBodyId);
    renderer.setCameraMode(ui.cameraMode);
    renderer.setScaleMode(ui.renderScaleMode);
    renderer.setVisualQuality(ui.visualQuality);
    renderer.setVenusSurfaceMode(ui.venusSurfaceMode);
    renderer.setOrbitLinesVisible(ui.orbitLinesVisible);
    renderer.setBodyLabelsVisible(ui.bodyLabelsVisible);
    renderer.setSkyBackgroundVisible(ui.skyBackgroundVisible);
    renderer.setBrightStarsVisible(ui.brightStarsVisible);
    renderer.setCometsVisible(ui.cometsVisible);
    renderer.setStatisticalBeltVisible('asteroid-belt', ui.asteroidBeltVisible);
    renderer.setStatisticalBeltVisible('kuiper-belt', ui.kuiperBeltVisible);
    renderer.setReducedMotion(ui.reducedMotion);
    renderer.setReduceFlashes(ui.reduceFlashes);
    const impact = impactScenarioRef.current?.getSnapshot();
    const impactRenderState = impact === undefined ? null : createImpactRenderState(impact);
    if (impactRenderState !== null) {
      renderer.setImpactRenderState(impactRenderState);
      renderer.setImpactCameraPreset(
        impactCameraPresetFor(impact?.parameters?.cameraMode ?? 'orbital'),
      );
    }
    const solarEvolution = solarEvolutionScenarioRef.current?.getSnapshot();
    const solarEvolutionRenderState = solarEvolution === undefined
      ? null
      : createSolarEvolutionRenderState(solarEvolution);
    if (solarEvolutionRenderState !== null) {
      renderer.setSolarEvolutionRenderState(solarEvolutionRenderState);
    }
    const fictionalSupernova = fictionalSupernovaScenarioRef.current?.getSnapshot();
    const fictionalSupernovaRenderState = fictionalSupernova === undefined
      ? null
      : createFictionalSupernovaRenderState(fictionalSupernova);
    if (fictionalSupernovaRenderState !== null) {
      renderer.setFictionalSupernovaRenderState(fictionalSupernovaRenderState);
    }
    setPresentationWarningRequired(renderer.getScaleModel().presentationWarningRequired);
    refreshSelectedVisualStatus(renderer);
    runtimeRef.current?.renderNow();
  }, [refreshSelectedVisualStatus, setPresentationWarningRequired]);

  const handleVisibilityChange = useCallback((visible: boolean) => {
    documentVisibleRef.current = visible;
    const runtime = runtimeRef.current;
    if (runtime === null) return;
    runtime.documentVisible = visible;
    if (visible) runtime.engine.start();
    else runtime.engine.stop();
    runtime.forcePublish();
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (renderer === null) return;
    renderer.setNaturalSatellitesVisible(naturalSatelliteVisible);
    renderer.setMajorMoonsVisible(majorMoonsVisible);
    renderer.setMinorMoonsVisible(minorMoonsVisible);
    renderer.setMoonOrbitsVisible(moonOrbitsVisible);
    renderer.setMoonLabelsVisible(moonLabelsVisible);
    renderer.selectNaturalSatellite(selectedNaturalSatelliteId);
    renderer.setSpaceObjectsVisible(spaceObjectsVisible);
    renderer.setEarthSatellitesVisible(earthSatellitesVisible);
    renderer.setSpacecraftVisible(spacecraftVisible);
    renderer.selectSpaceObject(selectedSpaceObjectId);
    runtimeRef.current?.renderNow();
  }, [
    majorMoonsVisible,
    minorMoonsVisible,
    moonLabelsVisible,
    moonOrbitsVisible,
    naturalSatelliteVisible,
    selectedNaturalSatelliteId,
    earthSatellitesVisible,
    selectedSpaceObjectId,
    spacecraftVisible,
    spaceObjectsVisible,
  ]);

  const restoreSavedTourPreferences = useCallback(
    (restoreScene: boolean): Readonly<SavedTourPreferences> | null => {
      const savedPreferences = savedTourPreferencesRef.current;
      if (savedPreferences === null) return null;

      updateSelectedBodyId(savedPreferences.selectedBodyId);
      updateCameraMode(savedPreferences.cameraMode);
      setPreferencesPersistenceSuspended(false);
      savedTourPreferencesRef.current = null;

      if (restoreScene) {
        const renderer = rendererRef.current;
        const runtime = runtimeRef.current;
        renderer?.setSelectedBody(savedPreferences.selectedBodyId);
        renderer?.setCameraMode(savedPreferences.cameraMode);
        if (runtime !== null) {
          runtime.selectedBodyId = savedPreferences.selectedBodyId;
          runtime.focusedBodyId = savedPreferences.selectedBodyId;
          runtime.cameraMode = savedPreferences.cameraMode;
          runtime.refreshDynamicPaths(true);
          runtime.synchronizeTrackedOrigin();
          runtime.renderNow();
          runtime.forcePublish();
        }
        refreshSelectedVisualStatus(renderer);
      }

      return savedPreferences;
    },
    [
      refreshSelectedVisualStatus,
      setPreferencesPersistenceSuspended,
      updateCameraMode,
      updateSelectedBodyId,
    ],
  );

  const cancelTourForManualInput = useCallback(() => {
    if (tourApplyingWaypointRef.current || !tourController.active) return;
    tourController.cancel();
    setActiveCloseUpPresetId(null);
    restoreSavedTourPreferences(true);
  }, [restoreSavedTourPreferences, setActiveCloseUpPresetId, tourController]);

  const controls = useMemo<SimulationControlPort>(
    () => ({
      setPaused(paused) {
        const runtime = runtimeRef.current;
        if (runtime === null) return;
        runtime.context.clock.setPaused(paused);
        runtime.forcePublish();
      },
      setDirection(direction) {
        const runtime = runtimeRef.current;
        if (runtime === null) return;
        runtime.context.clock.setDirection(direction);
        runtime.forcePublish();
      },
      setTimeScale(timeScale) {
        const runtime = runtimeRef.current;
        if (runtime === null) return;
        runtime.context.clock.setTimeScale(timeScale);
        runtime.forcePublish();
      },
      setExactDateUtc(isoUtc) {
        const runtime = runtimeRef.current;
        if (runtime === null) return;
        runtime.context.clock.setExactDateUtc(new Date(isoUtc));
        if (runtime.synchronizeEphemeris()) {
          runtime.synchronizeTrackedOrigin();
          runtime.refreshDynamicPaths(true);
          runtime.renderNow();
        }
        runtime.forcePublish();
      },
      applyPreset(preset: TimePresetView) {
        const runtime = runtimeRef.current;
        if (runtime === null) return;
        runtime.context.clock.applyPreset(preset);
        runtime.forcePublish();
      },
      selectBody(bodyId) {
        cancelTourForManualInput();
        setActiveCloseUpPresetId(null);
        const selected = requireObservatoryBodyId(bodyId);
        updateSelectedBodyId(selected);
        rendererRef.current?.setSelectedBody(selected);
        const runtime = runtimeRef.current;
        if (runtime === null) return;
        if (runtime.cameraMode === 'earth-moon-system' && selected !== 'earth') {
          updateCameraMode('body-follow');
          rendererRef.current?.setCameraMode('body-follow');
          runtime.cameraMode = 'body-follow';
        }
        runtime.selectedBodyId = selected;
        runtime.focusedBodyId = selected;
        runtime.refreshDynamicPaths(true);
        runtime.synchronizeTrackedOrigin();
        runtime.renderNow();
        runtime.forcePublish();
      },
      focusBody(bodyId) {
        cancelTourForManualInput();
        setActiveCloseUpPresetId(null);
        const selected = requireObservatoryBodyId(bodyId);
        updateSelectedBodyId(selected);
        updateCameraMode('body-follow');
        const runtime = runtimeRef.current;
        if (runtime === null) return;
        runtime.selectedBodyId = selected;
        runtime.focusedBodyId = selected;
        runtime.cameraMode = 'body-follow';
        runtime.refreshDynamicPaths(true);
        runtime.synchronizeTrackedOrigin();
        if (rendererRef.current?.focusBody(selected, 'body-follow') ?? false) {
          runtime.renderNow();
          runtime.forcePublish();
        }
      },
      rebaseToBody(bodyId) {
        cancelTourForManualInput();
        setActiveCloseUpPresetId(null);
        const runtime = runtimeRef.current;
        if (runtime === null) return;
        const selected = requireObservatoryBodyId(bodyId);
        const body = runtime.context.getBody(selected);
        if (body === undefined) return;
        updateSelectedBodyId(selected);
        updateCameraMode('body-follow');
        runtime.selectedBodyId = selected;
        runtime.focusedBodyId = selected;
        runtime.cameraMode = 'body-follow';
        rendererRef.current?.focusBody(selected, 'body-follow');
        runtime.context.rebaseOriginTo(body.positionM);
        runtime.originBodyId = selected;
        runtime.refreshDynamicPaths(true);
        runtime.renderNow();
        runtime.forcePublish();
      },
      setCameraMode(mode) {
        cancelTourForManualInput();
        setActiveCloseUpPresetId(null);
        const earthMoonSystem = mode === 'earth-moon-system';
        if (earthMoonSystem) {
          updateSelectedBodyId('earth');
          rendererRef.current?.setSelectedBody('earth');
        }
        updateCameraMode(mode);
        rendererRef.current?.setCameraMode(mode);
        const runtime = runtimeRef.current;
        if (runtime === null) return;
        if (earthMoonSystem) {
          runtime.selectedBodyId = 'earth';
          runtime.focusedBodyId = 'earth';
          runtime.refreshDynamicPaths(true);
        }
        runtime.cameraMode = mode;
        runtime.synchronizeTrackedOrigin();
        runtime.renderNow();
        runtime.forcePublish();
      },
      setRenderScaleMode(mode, immediate = false) {
        updateRenderScaleMode(mode);
        const renderer = rendererRef.current;
        renderer?.setScaleMode(mode, immediate);
        setPresentationWarningRequired(
          renderer?.getScaleModel().presentationWarningRequired ?? mode === 'presentation',
        );
        const runtime = runtimeRef.current;
        if (runtime === null) return;
        runtime.renderScaleMode = mode;
        runtime.renderNow();
        runtime.forcePublish();
      },
      setOrbitLinesVisible(visible) {
        updateOrbitLinesVisible(visible);
        rendererRef.current?.setOrbitLinesVisible(visible);
        runtimeRef.current?.renderNow();
      },
      setBodyLabelsVisible(visible) {
        updateBodyLabelsVisible(visible);
        rendererRef.current?.setBodyLabelsVisible(visible);
        runtimeRef.current?.renderNow();
      },
      setSelectedTrailInterval(interval) {
        updateSelectedTrailInterval(interval);
        const runtime = runtimeRef.current;
        if (runtime === null) return;
        runtime.selectedTrailInterval = interval;
        runtime.refreshDynamicPaths(true);
        runtime.renderNow();
        runtime.forcePublish();
      },
    }),
    [
      cancelTourForManualInput,
      setActiveCloseUpPresetId,
      setPresentationWarningRequired,
      updateBodyLabelsVisible,
      updateCameraMode,
      updateOrbitLinesVisible,
      updateRenderScaleMode,
      updateSelectedBodyId,
      updateSelectedTrailInterval,
    ],
  );

  const focusSpaceObjectForInspection = useCallback(
    (id: string): boolean => {
      if (id === ISS_MODEL_ASSET.objectId) {
        // Detailed ISS inspection keeps the station and nearby bodies on one
        // physical scale. The visual system also suppresses nonphysical
        // locator spheres such as the nearby JWST marker in this close-up.
        controls.setRenderScaleMode('true', true);
      }
      const focused = rendererRef.current?.focusSpaceObject(id) ?? false;
      runtimeRef.current?.renderNow();
      return focused;
    },
    [controls],
  );

  const handleLegendBodyFocus = useCallback(
    (bodyId: ObservatoryBodyId) => {
      if (scenarioActive) return;
      setSelectedNaturalSatelliteId(null);
      setSelectedSpaceObjectId(null);
      rendererRef.current?.selectNaturalSatellite(null);
      rendererRef.current?.selectSpaceObject(null);
      controls.focusBody(bodyId);
    },
    [controls, scenarioActive],
  );

  const handleLegendCometFocus = useCallback(() => {
    if (scenarioActive) return;
    const runtime = runtimeRef.current;
    if (runtime === null) return;
    const target = COMET_BODY_IDS.find((bodyId) => runtime.provider.hasBody(bodyId));
    if (target === undefined) return;
    updateCometsVisible(true);
    rendererRef.current?.setCometsVisible(true);
    setSelectedNaturalSatelliteId(null);
    setSelectedSpaceObjectId(null);
    rendererRef.current?.selectNaturalSatellite(null);
    rendererRef.current?.selectSpaceObject(null);
    controls.focusBody(target);
  }, [controls, scenarioActive, updateCometsVisible]);

  const handleLegendTideToggle = useCallback(
    (component: ExperimentalTideComponent) => {
      if (scenarioActive || experimentalTideMode === 'off') return;
      const nextMode = toggleExperimentalTideComponent(
        activeTideModeRef.current,
        component,
      );
      activeTideModeRef.current = nextMode;
      setActiveTideMode(nextMode);
      controls.setCameraMode('earth-moon-system');
    },
    [controls, experimentalTideMode, scenarioActive],
  );

  const applyCameraCloseUpPreset = useCallback(
    (presetId: CameraCloseUpPresetId): boolean => {
      cancelTourForManualInput();
      const renderer = rendererRef.current;
      const runtime = runtimeRef.current;
      const preset = getCameraCloseUpPreset(presetId);
      if (renderer === null || runtime === null || !renderer.applyCloseUpPreset(presetId)) {
        return false;
      }
      const selected = requireObservatoryBodyId(preset.bodyId);
      setActiveCloseUpPresetId(presetId);
      updateSelectedBodyId(selected);
      updateCameraMode('body-follow');
      runtime.selectedBodyId = selected;
      runtime.focusedBodyId = selected;
      runtime.cameraMode = 'body-follow';
      runtime.refreshDynamicPaths(true);
      runtime.synchronizeTrackedOrigin();
      runtime.renderNow();
      runtime.forcePublish();
      refreshSelectedVisualStatus(renderer);
      return true;
    },
    [
      cancelTourForManualInput,
      refreshSelectedVisualStatus,
      setActiveCloseUpPresetId,
      updateCameraMode,
      updateSelectedBodyId,
    ],
  );

  const enterTourWaypoint = useCallback(
    (waypoint: Readonly<CinematicTourWaypoint>): boolean => {
      const renderer = rendererRef.current;
      const runtime = runtimeRef.current;
      if (
        renderer === null ||
        runtime === null ||
        useAppStore.getState().webglStatus !== 'ready'
      ) {
        return false;
      }
      tourApplyingWaypointRef.current = true;
      try {
        if (waypoint.closeUpPresetId !== null) {
          return applyCameraCloseUpPreset(waypoint.closeUpPresetId);
        }
        if (waypoint.bodyId !== null) {
          controls.focusBody(waypoint.bodyId);
        }
        controls.setCameraMode(waypoint.cameraMode);
        const camera = renderer.getCameraDiagnostics();
        return (
          camera.mode === waypoint.cameraMode &&
          (waypoint.bodyId === null || camera.targetBodyId === waypoint.bodyId)
        );
      } finally {
        tourApplyingWaypointRef.current = false;
      }
    },
    [applyCameraCloseUpPreset, controls],
  );
  useEffect(() => {
    if (tourSummary?.reason === 'completed') {
      restoreSavedTourPreferences(true);
      return;
    }
    if (
      tourSummary?.waypoint !== null &&
      tourSummary?.waypoint !== undefined &&
      (tourSummary.reason === 'started' ||
        tourSummary.reason === 'waypoint-changed' ||
        tourSummary.reason === 'resumed') &&
      !enterTourWaypoint(tourSummary.waypoint)
    ) {
      tourController.pause();
    }
  }, [enterTourWaypoint, restoreSavedTourPreferences, tourController, tourSummary]);

  const handleCanvasInteractionStart = useCallback(() => {
    const tourWasActive = tourController.active;
    const activeScenario = scenarioManagerRef.current?.activeScenarioId ?? null;
    if (!tourWasActive && activeScenario !== null) return;

    let savedPreferences: Readonly<SavedTourPreferences> | null = null;
    if (tourWasActive) {
      tourController.cancel();
      savedPreferences = restoreSavedTourPreferences(false);
    } else {
      const currentCameraMode =
        runtimeRef.current?.cameraMode ?? useAppStore.getState().cameraMode;
      if (currentCameraMode === 'free-orbit') return;
    }

    setActiveCloseUpPresetId(null);
    const restoredBodyId =
      savedPreferences?.selectedBodyId ?? useAppStore.getState().selectedBodyId;
    updateCameraMode('free-orbit');
    const renderer = rendererRef.current;
    const runtime = runtimeRef.current;
    renderer?.setSelectedBody(restoredBodyId);
    renderer?.interruptCameraToFreeOrbit();
    if (runtime !== null) {
      runtime.selectedBodyId = restoredBodyId;
      runtime.focusedBodyId = restoredBodyId;
      runtime.cameraMode = 'free-orbit';
      runtime.refreshDynamicPaths(true);
      runtime.synchronizeTrackedOrigin();
      runtime.renderNow();
      runtime.forcePublish();
    }
    refreshSelectedVisualStatus(renderer);
  }, [
    refreshSelectedVisualStatus,
    restoreSavedTourPreferences,
    setActiveCloseUpPresetId,
    tourController,
    updateCameraMode,
  ]);

  const handleTourToggle = useCallback(() => {
    if (tourController.state === 'running') {
      tourController.pause();
      return;
    }
    if (tourController.state === 'paused') {
      if (
        webglStatus === 'ready' &&
        rendererRef.current !== null &&
        runtimeRef.current !== null
      ) {
        tourController.resume();
      }
      return;
    }
    if (
      webglStatus !== 'ready' ||
      rendererRef.current === null ||
      runtimeRef.current === null
    ) {
      return;
    }

    const currentPreferences = useAppStore.getState();
    savedTourPreferencesRef.current = Object.freeze({
      selectedBodyId: currentPreferences.selectedBodyId,
      cameraMode: currentPreferences.cameraMode,
    });
    setPreferencesPersistenceSuspended(true);
    tourController.start();
  }, [setPreferencesPersistenceSuspended, tourController, webglStatus]);

  const synchronizeImpactPresentation = useCallback(
    (requestedCameraMode?: ImpactCameraMode): void => {
      const scenario = impactScenarioRef.current;
      if (scenario === null) return;
      const nextSnapshot = scenario.getSnapshot();
      setImpactSnapshot(nextSnapshot);
      const renderer = rendererRef.current;
      const renderState = createImpactRenderState(nextSnapshot);
      renderer?.setImpactRenderState(renderState);
      if (renderState !== null) {
        const cameraMode =
          requestedCameraMode ?? nextSnapshot.parameters?.cameraMode ?? 'orbital';
        renderer?.setImpactCameraPreset(impactCameraPresetFor(cameraMode));
      }
      runtimeRef.current?.renderNow();
      runtimeRef.current?.forcePublish();
    },
    [],
  );

  const handleImpactParametersChange = useCallback(
    (parameters: Readonly<ImpactParameters>): void => {
      const previousParameters = impactParametersRef.current;
      const previewWasSuspended = impactPreviewSuspendedRef.current;
      impactPreviewSuspendedRef.current = false;
      if (
        previewWasSuspended ||
        previousParameters.targetBodyId !== parameters.targetBodyId
      ) {
        impactPreviewNeedsFocusRef.current = true;
      }
      impactParametersRef.current = parameters;
      setImpactParameters(parameters);
    },
    [],
  );

  const handleImpactStart = useCallback(() => {
    cancelTourForManualInput();
    const manager = scenarioManagerRef.current;
    const scenario = impactScenarioRef.current;
    if (manager === null || scenario === null || manager.activeScenarioId !== null) return;
    impactParametersRef.current = impactParameters;
    setImpactError(null);
    void manager
      .start(scenario, impactParameters)
      .then(() => synchronizeImpactPresentation(impactParameters.cameraMode))
      .catch((error: unknown) => {
        setImpactError(
          error instanceof Error ? error.message : 'The Impact Lab scenario could not start.',
        );
        setImpactSnapshot(scenario.getSnapshot());
      });
  }, [cancelTourForManualInput, impactParameters, synchronizeImpactPresentation]);

  const handleImpactPause = useCallback(() => {
    scenarioManagerRef.current?.pause();
    synchronizeImpactPresentation(impactParametersRef.current.cameraMode);
  }, [synchronizeImpactPresentation]);

  const handleImpactResume = useCallback(() => {
    scenarioManagerRef.current?.resume();
    synchronizeImpactPresentation(impactParametersRef.current.cameraMode);
  }, [synchronizeImpactPresentation]);

  const handleImpactFrameStep = useCallback(() => {
    scenarioManagerRef.current?.frameStep();
    synchronizeImpactPresentation(impactParametersRef.current.cameraMode);
  }, [synchronizeImpactPresentation]);

  const handleImpactReplay = useCallback(() => {
    scenarioManagerRef.current?.replay();
    synchronizeImpactPresentation(impactParameters.cameraMode);
  }, [impactParameters.cameraMode, synchronizeImpactPresentation]);

  const handleImpactReset = useCallback(() => {
    const manager = scenarioManagerRef.current;
    if (manager === null) return;
    impactPreviewSuspendedRef.current = true;
    impactPreviewNeedsFocusRef.current = false;
    impactPreviewTargetBodyIdRef.current = null;
    void manager
      .reset()
      .then(() => {
        setImpactSnapshot(impactScenarioRef.current?.getSnapshot() ?? INITIAL_IMPACT_SNAPSHOT);
      })
      .catch((error: unknown) => {
        setImpactError(
          error instanceof Error ? error.message : 'The observatory could not restore its state.',
        );
      });
  }, []);

  const handleImpactCameraMode = useCallback(
    (mode: ImpactCameraMode) => {
      const scenario = impactScenarioRef.current;
      if (scenario === null || scenario.state === 'idle') return;
      if (mode === 'slow-motion-replay') {
        scenario.replay();
        scenario.setPlaybackRate(0.25);
      } else {
        scenario.setPlaybackRate(1);
      }
      synchronizeImpactPresentation(mode);
    },
    [synchronizeImpactPresentation],
  );

  const synchronizeSolarFatePresentation = useCallback((): void => {
    const solarEvolution = solarEvolutionScenarioRef.current?.getSnapshot() ??
      SCIENTIFIC_SOLAR_EVOLUTION_IDLE_SNAPSHOT;
    const fictionalSupernova = fictionalSupernovaScenarioRef.current?.getSnapshot() ??
      FICTIONAL_SOLAR_SUPERNOVA_IDLE_SNAPSHOT;
    setSolarEvolutionSnapshot(solarEvolution);
    setFictionalSupernovaSnapshot(fictionalSupernova);
    const renderer = rendererRef.current;
    if (solarEvolution.state !== 'idle') {
      renderer?.setSolarEvolutionRenderState(
        createSolarEvolutionRenderState(solarEvolution),
      );
    } else if (fictionalSupernova.state !== 'idle') {
      renderer?.setFictionalSupernovaRenderState(
        createFictionalSupernovaRenderState(fictionalSupernova),
      );
    } else {
      renderer?.resetSolarFateVisuals();
    }
    runtimeRef.current?.renderNow();
    runtimeRef.current?.forcePublish();
  }, []);

  const handleSolarEvolutionStart = useCallback(() => {
    cancelTourForManualInput();
    const manager = scenarioManagerRef.current;
    const scenario = solarEvolutionScenarioRef.current;
    if (manager === null || scenario === null || manager.activeScenarioId !== null) return;
    setSolarFateError(null);
    void manager
      .start(scenario, DEFAULT_SCIENTIFIC_SOLAR_EVOLUTION_PARAMETERS)
      .then(synchronizeSolarFatePresentation)
      .catch((error: unknown) => {
        setSolarFateError(
          error instanceof Error
            ? error.message
            : 'Scientific Solar Evolution could not start.',
        );
        setSolarEvolutionSnapshot(scenario.getSnapshot());
      });
  }, [cancelTourForManualInput, synchronizeSolarFatePresentation]);

  const handleFictionalSupernovaStart = useCallback(() => {
    cancelTourForManualInput();
    const manager = scenarioManagerRef.current;
    const scenario = fictionalSupernovaScenarioRef.current;
    if (manager === null || scenario === null || manager.activeScenarioId !== null) return;
    setSolarFateError(null);
    void manager
      .start(scenario, DEFAULT_FICTIONAL_SOLAR_SUPERNOVA_PARAMETERS)
      .then(synchronizeSolarFatePresentation)
      .catch((error: unknown) => {
        setSolarFateError(
          error instanceof Error
            ? error.message
            : 'The fictional Solar Supernova cinematic could not start.',
        );
        setFictionalSupernovaSnapshot(scenario.getSnapshot());
      });
  }, [cancelTourForManualInput, synchronizeSolarFatePresentation]);

  const handleSolarFatePause = useCallback(() => {
    scenarioManagerRef.current?.pause();
    synchronizeSolarFatePresentation();
  }, [synchronizeSolarFatePresentation]);

  const handleSolarFateResume = useCallback(() => {
    scenarioManagerRef.current?.resume();
    synchronizeSolarFatePresentation();
  }, [synchronizeSolarFatePresentation]);

  const handleSolarFateFrameStep = useCallback(() => {
    scenarioManagerRef.current?.frameStep();
    synchronizeSolarFatePresentation();
  }, [synchronizeSolarFatePresentation]);

  const handleSolarFateSkip = useCallback(() => {
    const manager = scenarioManagerRef.current;
    if (manager?.activeScenarioId === solarEvolutionScenarioRef.current?.id) {
      solarEvolutionScenarioRef.current?.skipToNextPhase();
    } else if (manager?.activeScenarioId === fictionalSupernovaScenarioRef.current?.id) {
      fictionalSupernovaScenarioRef.current?.skipToNextStage();
    }
    synchronizeSolarFatePresentation();
  }, [synchronizeSolarFatePresentation]);

  const handleSolarFateReplay = useCallback(() => {
    scenarioManagerRef.current?.replay();
    synchronizeSolarFatePresentation();
  }, [synchronizeSolarFatePresentation]);

  const handleSolarFateReset = useCallback(() => {
    const manager = scenarioManagerRef.current;
    if (manager === null) return;
    void manager
      .reset()
      .then(synchronizeSolarFatePresentation)
      .catch((error: unknown) => {
        setSolarFateError(
          error instanceof Error ? error.message : 'The observatory could not restore its state.',
        );
      });
  }, [synchronizeSolarFatePresentation]);

  const synchronizeBlackHolePresentation = useCallback((frameCamera = false): void => {
    const physics = blackHolePhysicsScenarioRef.current?.getSnapshot() ??
      BLACK_HOLE_PHYSICS_FLYBY_IDLE_SNAPSHOT;
    const cinematic = completeConsumptionScenarioRef.current?.getSnapshot() ??
      COMPLETE_CONSUMPTION_IDLE_SNAPSHOT;
    setBlackHolePhysicsSnapshot(physics);
    setCompleteConsumptionSnapshot(cinematic);
    const renderer = rendererRef.current;
    const activeSnapshot = physics.state !== 'idle'
      ? physics
      : cinematic.state !== 'idle'
        ? cinematic
        : null;
    if (activeSnapshot === null) {
      renderer?.resetBlackHoleVisuals();
    } else {
      renderer?.setBlackHoleRenderState(createBlackHoleRenderState(activeSnapshot));
      if (frameCamera) renderer?.frameBlackHole();
    }
    runtimeRef.current?.renderNow();
    runtimeRef.current?.forcePublish();
  }, []);

  const handleBlackHolePhysicsStart = useCallback((
    panelParameters: Readonly<BlackHoleFlybyPanelParameters>,
  ) => {
    cancelTourForManualInput();
    const manager = scenarioManagerRef.current;
    const scenario = blackHolePhysicsScenarioRef.current;
    const runtime = runtimeRef.current;
    if (
      manager === null ||
      scenario === null ||
      runtime === null ||
      manager.activeScenarioId !== null
    ) {
      return;
    }
    setBlackHolePanelParameters(panelParameters);
    setBlackHoleError(null);
    const initialState = captureBlackHoleInitialState(runtime.context);
    const parameters = applyBlackHolePanelParameters(
      createDefaultPhysicsFlybyParameters(initialState),
      panelParameters,
    );
    void manager
      .start(scenario, parameters)
      .then(() => synchronizeBlackHolePresentation(true))
      .catch((error: unknown) => {
        setBlackHoleError(
          error instanceof Error
            ? error.message
            : 'The Black-Hole Physics Flyby could not start.',
        );
        setBlackHolePhysicsSnapshot(scenario.getSnapshot());
      });
  }, [cancelTourForManualInput, synchronizeBlackHolePresentation]);

  const handleCompleteConsumptionStart = useCallback(() => {
    cancelTourForManualInput();
    const manager = scenarioManagerRef.current;
    const scenario = completeConsumptionScenarioRef.current;
    const runtime = runtimeRef.current;
    if (
      manager === null ||
      scenario === null ||
      runtime === null ||
      manager.activeScenarioId !== null
    ) {
      return;
    }
    setBlackHoleError(null);
    const initialState = captureBlackHoleInitialState(runtime.context);
    const parameters = createDefaultCompleteConsumptionParameters(initialState);
    void manager
      .start(scenario, parameters)
      .then(() => synchronizeBlackHolePresentation(true))
      .catch((error: unknown) => {
        setBlackHoleError(
          error instanceof Error
            ? error.message
            : 'Complete Consumption cinematic could not start.',
        );
        setCompleteConsumptionSnapshot(scenario.getSnapshot());
      });
  }, [
    cancelTourForManualInput,
    synchronizeBlackHolePresentation,
  ]);

  const handleBlackHolePause = useCallback(() => {
    scenarioManagerRef.current?.pause();
    synchronizeBlackHolePresentation();
  }, [synchronizeBlackHolePresentation]);

  const handleBlackHoleResume = useCallback(() => {
    scenarioManagerRef.current?.resume();
    synchronizeBlackHolePresentation();
  }, [synchronizeBlackHolePresentation]);

  const handleBlackHoleFrameStep = useCallback(() => {
    scenarioManagerRef.current?.frameStep();
    synchronizeBlackHolePresentation();
  }, [synchronizeBlackHolePresentation]);

  const handleBlackHoleSkip = useCallback(() => {
    const manager = scenarioManagerRef.current;
    const physics = blackHolePhysicsScenarioRef.current;
    const cinematic = completeConsumptionScenarioRef.current;
    if (physics !== null && manager?.activeScenarioId === physics.id) {
      physics.skipToNextStage();
    } else if (cinematic !== null && manager?.activeScenarioId === cinematic.id) {
      cinematic.skipToNextStage();
    }
    synchronizeBlackHolePresentation();
  }, [synchronizeBlackHolePresentation]);

  const handleBlackHoleReplay = useCallback(() => {
    scenarioManagerRef.current?.replay();
    synchronizeBlackHolePresentation(true);
  }, [synchronizeBlackHolePresentation]);

  const handleBlackHoleReset = useCallback(() => {
    const manager = scenarioManagerRef.current;
    if (manager === null) return;
    void manager
      .reset()
      .then(() => synchronizeBlackHolePresentation())
      .catch((error: unknown) => {
        setBlackHoleError(
          error instanceof Error ? error.message : 'The observatory could not restore its state.',
        );
      });
  }, [synchronizeBlackHolePresentation]);

  const observatoryUnavailable =
    !preferencesHydrated || ephemeris.status === 'loading' || ephemeris.status === 'error';
  const controlsDisabled = observatoryUnavailable || scenarioActive;
  const manualCameraInteractionLocked =
    observatoryUnavailable || (scenarioActive && cameraMode !== 'free-orbit');
  const selectedBodyDefinition = getRequiredBodyDefinition(selectedBodyId);
  const selectedPathCoverageWarning = pathCoverageWarnings[selectedBodyId] ?? null;
  const limitedPathCount = Object.keys(pathCoverageWarnings).length;
  const selectedCometDefinition =
    'jplOrbitId' in selectedBodyDefinition ? selectedBodyDefinition : null;
  const stageModeLabel = impactActive
    ? 'Educational approximation · Impact Lab'
    : solarEvolutionActive
      ? 'Scientific Solar Evolution · compressed educational visualization'
      : fictionalSupernovaActive
        ? 'Fictional Solar Supernova · cinematic and impossible for the Sun'
        : blackHolePhysicsActive
          ? 'Black-Hole Physics Flyby · Newtonian educational approximation'
          : completeConsumptionActive
            ? 'Complete Consumption · nonphysical cinematic'
            : `${classificationLabelForStage(selectedBodyDefinition)} · live scientific view`;

  const resetSavedPreferences = useCallback(() => {
    if (scenarioActive) return;
    const defaults = DEFAULT_APP_PREFERENCES;
    controls.selectBody(defaults.selectedBodyId);
    controls.setCameraMode(defaults.cameraMode);
    controls.setRenderScaleMode(defaults.renderScaleMode);
    controls.setOrbitLinesVisible(defaults.orbitLinesVisible);
    controls.setBodyLabelsVisible(defaults.bodyLabelsVisible);
    controls.setSelectedTrailInterval(defaults.selectedTrailInterval);
    updateVisualQuality(defaults.visualQuality);
    updateVenusSurfaceMode(defaults.venusSurfaceMode);
    updateSkyBackgroundVisible(defaults.skyBackgroundVisible);
    updateBrightStarsVisible(defaults.brightStarsVisible);
    updateCometsVisible(defaults.cometsVisible);
    updateAsteroidBeltVisible(defaults.asteroidBeltVisible);
    updateKuiperBeltVisible(defaults.kuiperBeltVisible);
    updateMotionPreference(defaults.motionPreference);
    updateReduceFlashes(defaults.reduceFlashes);

    const renderer = rendererRef.current;
    renderer?.setVisualQuality(defaults.visualQuality);
    renderer?.setVenusSurfaceMode(defaults.venusSurfaceMode);
    renderer?.setSkyBackgroundVisible(defaults.skyBackgroundVisible);
    renderer?.setBrightStarsVisible(defaults.brightStarsVisible);
    renderer?.setCometsVisible(defaults.cometsVisible);
    renderer?.setStatisticalBeltVisible('asteroid-belt', defaults.asteroidBeltVisible);
    renderer?.setStatisticalBeltVisible('kuiper-belt', defaults.kuiperBeltVisible);
    runtimeRef.current?.renderNow();
    refreshSelectedVisualStatus(renderer);
  }, [
    controls,
    refreshSelectedVisualStatus,
    scenarioActive,
    updateAsteroidBeltVisible,
    updateBrightStarsVisible,
    updateCometsVisible,
    updateKuiperBeltVisible,
    updateMotionPreference,
    updateReduceFlashes,
    updateSkyBackgroundVisible,
    updateVenusSurfaceMode,
    updateVisualQuality,
  ]);

  const handleShortcutAction = useCallback(
    (action: ObservatoryShortcutAction) => {
      if (action.type === 'toggle-help') {
        setProvenanceOpen(false);
        setHelpOpen((open) => !open);
        return;
      }
      if (action.type === 'toggle-provenance') {
        setHelpOpen(false);
        setProvenanceOpen((open) => !open);
        return;
      }
      if (controlsDisabled) return;

      switch (action.type) {
        case 'toggle-playback':
          controls.setPaused(!snapshot.paused);
          break;
        case 'toggle-direction':
          controls.setDirection(snapshot.direction === 1 ? -1 : 1);
          break;
        case 'select-relative-body': {
          const currentIndex = BODY_OPTIONS.findIndex((body) => body.id === selectedBodyId);
          const nextIndex =
            (Math.max(currentIndex, 0) + action.offset + BODY_OPTIONS.length) %
            BODY_OPTIONS.length;
          const nextBody = BODY_OPTIONS[nextIndex];
          if (nextBody !== undefined) controls.focusBody(nextBody.id);
          break;
        }
        case 'focus-selected-body':
          controls.focusBody(selectedBodyId);
          break;
        case 'set-camera-mode':
          controls.setCameraMode(action.mode);
          break;
        case 'toggle-render-scale':
          controls.setRenderScaleMode(
            renderScaleMode === 'presentation' ? 'true' : 'presentation',
          );
          break;
        case 'toggle-body-labels':
          controls.setBodyLabelsVisible(!bodyLabelsVisible);
          break;
        case 'toggle-orbit-lines':
          controls.setOrbitLinesVisible(!orbitLinesVisible);
          break;
        case 'cancel-camera-motion':
          handleCanvasInteractionStart();
          break;
      }
    },
    [
      bodyLabelsVisible,
      controls,
      controlsDisabled,
      handleCanvasInteractionStart,
      orbitLinesVisible,
      renderScaleMode,
      selectedBodyId,
      setHelpOpen,
      setProvenanceOpen,
      snapshot.direction,
      snapshot.paused,
    ],
  );

  useEffect(() => {
    const handler = createObservatoryShortcutHandler(handleShortcutAction, {
      enabled: () => !helpOpen && !provenanceOpen,
    });
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleShortcutAction, helpOpen, provenanceOpen]);

  return (
    <div
      className="observatory-app"
      data-testid="solar-system-app"
      data-trail-interval={selectedTrailInterval}
      data-visual-quality={visualQuality}
      data-venus-surface-mode={venusSurfaceMode}
      data-motion-preference={motionPreference}
      data-reduce-flashes={String(reduceFlashes)}
      data-tour-state={tourSummary?.state ?? 'idle'}
      data-impact-state={impactSnapshot.state}
      data-impact-stage={impactSnapshot.stage}
      data-impact-signature={impactSnapshot.runSignature ?? ''}
      data-active-scenario={activeScenarioId}
      data-solar-fate-mode={solarFateMode}
      data-solar-fate-state={solarFateState}
      data-solar-fate-stage={solarFateStage}
      data-black-hole-mode={blackHoleMode}
      data-black-hole-state={blackHoleState}
      data-black-hole-stage={blackHoleStage}
    >
      <a className="skip-link" href="#observatory-controls">
        Skip 3D view
      </a>

      <header className="observatory-header">
        <div className="brand-lockup" aria-label="Solar System: Living Observatory">
          <span className="brand-orbit" aria-hidden="true" />
          <span>
            <span className="brand-kicker">Solar System</span>
            <span className="brand-title">Living Observatory</span>
          </span>
        </div>
        <div className="header-actions">
          <div className="header-status" aria-label="Observatory release status">
            <span className="status-pip" aria-hidden="true" />
            <span className="header-meta">Scientific 3D observatory</span>
          </div>
          <button
            className="command-button"
            type="button"
            data-testid="scenario-drawer-toggle"
            disabled={observatoryUnavailable || (scenarioActive && !impactActive)}
            aria-pressed={impactLabOpen}
            aria-controls="impact-lab-workspace"
            onClick={() => {
              setSolarFateOpen(false);
              setBlackHoleEncounterOpen(false);
              setImpactLabOpen((open) => {
                if (impactActive) return true;
                const nextOpen = !open;
                if (nextOpen) {
                  impactPreviewSuspendedRef.current = false;
                  impactPreviewNeedsFocusRef.current = true;
                }
                return nextOpen;
              });
            }}
          >
            Impact Lab
          </button>
          <button
            className="command-button"
            type="button"
            data-testid="solar-fate-drawer-toggle"
            disabled={observatoryUnavailable || (scenarioActive && !solarFateActive)}
            aria-pressed={solarFateOpen}
            aria-controls="solar-fate-workspace"
            onClick={() => {
              setImpactLabOpen(false);
              setBlackHoleEncounterOpen(false);
              setSolarFateOpen((open) => (solarFateActive ? true : !open));
            }}
          >
            Solar Fate
          </button>
          <button
            className="command-button"
            type="button"
            data-testid="black-hole-encounter-drawer-toggle"
            disabled={observatoryUnavailable || (scenarioActive && !blackHoleActive)}
            aria-pressed={blackHoleEncounterOpen}
            aria-controls="black-hole-encounter-workspace"
            onClick={() => {
              setImpactLabOpen(false);
              setSolarFateOpen(false);
              setBlackHoleEncounterOpen((open) => (blackHoleActive ? true : !open));
            }}
          >
            Black-Hole Encounter
          </button>
          <button
            className="command-button"
            type="button"
            data-testid="tour-toggle"
            disabled={controlsDisabled || webglStatus !== 'ready'}
            aria-pressed={tourSummary?.state === 'running'}
            onClick={handleTourToggle}
          >
            {tourSummary?.state === 'running'
              ? 'Pause tour'
              : tourSummary?.state === 'paused'
                ? 'Resume tour'
                : 'Start tour'}
          </button>
          {tourSummary?.state === 'running' || tourSummary?.state === 'paused' ? (
            <button
              className="command-button"
              type="button"
              data-testid="tour-stop"
              onClick={handleCanvasInteractionStart}
            >
              Stop tour
            </button>
          ) : null}
          <button
            className="command-button"
            type="button"
            data-testid="provenance-open"
            aria-haspopup="dialog"
            onClick={() => setProvenanceOpen(true)}
          >
            Data & provenance
          </button>
          <button
            className="command-button"
            type="button"
            data-testid="help-open"
            aria-haspopup="dialog"
            aria-keyshortcuts="?"
            onClick={() => setHelpOpen(true)}
          >
            Help <span aria-hidden="true">?</span>
          </button>
        </div>
      </header>

      <main
        className="observatory-main"
        aria-busy={!preferencesHydrated || ephemeris.status === 'loading'}
      >
        <div className="workspace-title-row">
          <h1 id="observatory-title">Watch real sunlight—and explore the Sun's possible and impossible futures.</h1>
          <p>Generated JPL motion · isolated scenario clocks · declared scientific boundaries</p>
        </div>
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {ephemeris.status === 'ready'
            ? 'JPL ephemeris bundles ready. Observatory controls available.'
            : ephemeris.status === 'loading'
              ? 'Loading and validating bundled JPL ephemeris data.'
              : ephemeris.message ?? `Ephemeris status: ${ephemeris.status}.`}
        </p>

        <div className="observatory-workspace" id="observatory-controls">
          <div className="workspace-rail workspace-rail-left">
            <ObjectNavigator
              bodies={BODY_OPTIONS}
              catalogTargets={CATALOG_TARGETS}
              selectedBodyId={selectedBodyId}
              orbitLinesVisible={orbitLinesVisible}
              bodyLabelsVisible={bodyLabelsVisible}
              skyBackgroundVisible={skyBackgroundVisible}
              brightStarsVisible={brightStarsVisible}
              cometsVisible={cometsVisible}
              asteroidBeltVisible={asteroidBeltVisible}
              kuiperBeltVisible={kuiperBeltVisible}
              disabled={controlsDisabled}
              onSelectBody={(bodyId) => {
                setSelectedNaturalSatelliteId(null);
                setSelectedSpaceObjectId(null);
                rendererRef.current?.selectNaturalSatellite(null);
                rendererRef.current?.selectSpaceObject(null);
                const body = getObservatoryBodyDefinition(bodyId);
                if (body?.kind === 'comet') {
                  updateCometsVisible(true);
                  rendererRef.current?.setCometsVisible(true);
                }
                controls.focusBody(bodyId);
              }}
              onSelectCatalogTarget={(target) => {
                const renderer = rendererRef.current;
                if (target.kind === 'natural-satellite') {
                  const satellite = getNaturalSatelliteDefinition(target.id);
                  if (satellite === undefined) return;
                  setNaturalSatelliteVisible(true);
                  renderer?.setNaturalSatellitesVisible(true);
                  if (satellite.tier === 'major') {
                    setMajorMoonsVisible(true);
                    renderer?.setMajorMoonsVisible(true);
                  } else {
                    setMinorMoonsVisible(true);
                    renderer?.setMinorMoonsVisible(true);
                  }
                  setSelectedSpaceObjectId(null);
                  renderer?.selectSpaceObject(null);
                  setSelectedNaturalSatelliteId(target.id);
                  renderer?.selectNaturalSatellite(target.id);
                  if (isObservatoryBodyId(satellite.parentId)) controls.focusBody(satellite.parentId);
                  window.setTimeout(() => {
                    rendererRef.current?.focusNaturalSatellite(target.id);
                    runtimeRef.current?.renderNow();
                  }, 80);
                  return;
                }
                setSelectedNaturalSatelliteId(null);
                renderer?.selectNaturalSatellite(null);
                setSpaceObjectsVisible(true);
                renderer?.setSpaceObjectsVisible(true);
                setSelectedSpaceObjectId(target.id);
                renderer?.selectSpaceObject(target.id);
                if (target.kind === 'earth-satellite') {
                  const satellite = getEarthSatelliteDefinition(target.id);
                  setEarthSatellitesVisible(true);
                  renderer?.setEarthSatellitesVisible(true);
                  if (satellite !== undefined && sampleEarthSatellite(satellite, snapshot.currentJdTdb).dataAgeState === 'outside-hard-window') {
                    controls.setExactDateUtc(satellite.elementEpochUtc);
                  }
                  controls.focusBody('earth');
                  window.setTimeout(() => {
                    focusSpaceObjectForInspection(target.id);
                  }, 120);
                } else {
                  setSpacecraftVisible(true);
                  renderer?.setSpacecraftVisible(true);
                  const mission = getSpacecraftDefinition(target.id);
                  const focusJdTdb = mission === undefined
                    ? snapshot.currentJdTdb
                    : nearestSpacecraftCoverageJdTdb(mission, snapshot.currentJdTdb);
                  if (Math.abs(focusJdTdb - snapshot.currentJdTdb) > 1e-9) {
                    controls.setExactDateUtc(approximateTdbToDateUtc(focusJdTdb).toISOString());
                    controls.focusBody('sun');
                    window.setTimeout(() => {
                      focusSpaceObjectForInspection(target.id);
                    }, 120);
                  } else if (!focusSpaceObjectForInspection(target.id)) {
                    controls.focusBody('sun');
                  }
                }
              }}
              onOrbitLinesVisibleChange={controls.setOrbitLinesVisible}
              onBodyLabelsVisibleChange={controls.setBodyLabelsVisible}
              onSkyBackgroundVisibleChange={(visible) => {
                updateSkyBackgroundVisible(visible);
                rendererRef.current?.setSkyBackgroundVisible(visible);
                runtimeRef.current?.renderNow();
              }}
              onBrightStarsVisibleChange={(visible) => {
                updateBrightStarsVisible(visible);
                rendererRef.current?.setBrightStarsVisible(visible);
                runtimeRef.current?.renderNow();
              }}
              onCometsVisibleChange={(visible) => {
                updateCometsVisible(visible);
                rendererRef.current?.setCometsVisible(visible);
                runtimeRef.current?.renderNow();
              }}
              onAsteroidBeltVisibleChange={(visible) => {
                updateAsteroidBeltVisible(visible);
                rendererRef.current?.setStatisticalBeltVisible('asteroid-belt', visible);
                runtimeRef.current?.renderNow();
              }}
              onKuiperBeltVisibleChange={(visible) => {
                updateKuiperBeltVisible(visible);
                rendererRef.current?.setStatisticalBeltVisible('kuiper-belt', visible);
                runtimeRef.current?.renderNow();
              }}
            />
            <NaturalSatellitePanel
              visible={naturalSatelliteVisible}
              majorVisible={majorMoonsVisible}
              minorVisible={minorMoonsVisible}
              orbitsVisible={moonOrbitsVisible}
              labelsVisible={moonLabelsVisible}
              selectedSatelliteId={selectedNaturalSatelliteId}
              disabled={controlsDisabled}
              onVisibleChange={(visible) => setNaturalSatelliteVisible(visible)}
              onMajorVisibleChange={(visible) => setMajorMoonsVisible(visible)}
              onMinorVisibleChange={(visible) => setMinorMoonsVisible(visible)}
              onOrbitsVisibleChange={(visible) => setMoonOrbitsVisible(visible)}
              onLabelsVisibleChange={(visible) => setMoonLabelsVisible(visible)}
              onSelectSatellite={(id) => {
                setSelectedSpaceObjectId(null);
                rendererRef.current?.selectSpaceObject(null);
                setSelectedNaturalSatelliteId(id);
                rendererRef.current?.selectNaturalSatellite(id);
              }}
              onFocusSatellite={(id) => {
                if (id === 'moon') {
                  setSelectedNaturalSatelliteId(null);
                  rendererRef.current?.selectNaturalSatellite(null);
                  controls.focusBody('moon');
                  return;
                }
                const satellite = getNaturalSatelliteDefinition(id);
                setNaturalSatelliteVisible(true);
                rendererRef.current?.setNaturalSatellitesVisible(true);
                if (satellite?.tier === 'major') {
                  setMajorMoonsVisible(true);
                  rendererRef.current?.setMajorMoonsVisible(true);
                } else {
                  setMinorMoonsVisible(true);
                  rendererRef.current?.setMinorMoonsVisible(true);
                }
                setSelectedNaturalSatelliteId(id);
                window.setTimeout(() => {
                  rendererRef.current?.focusNaturalSatellite(id);
                  runtimeRef.current?.renderNow();
                }, 80);
              }}
              onFocusParent={(parentId) => {
                if (isObservatoryBodyId(parentId)) controls.focusBody(parentId);
              }}
            />
            <SpaceObjectsPanel
              currentJdTdb={snapshot.currentJdTdb}
              visible={spaceObjectsVisible}
              earthSatellitesVisible={earthSatellitesVisible}
              spacecraftVisible={spacecraftVisible}
              selectedObjectId={selectedSpaceObjectId}
              disabled={controlsDisabled}
              onVisibleChange={setSpaceObjectsVisible}
              onEarthSatellitesVisibleChange={setEarthSatellitesVisible}
              onSpacecraftVisibleChange={setSpacecraftVisible}
              onSelectObject={(id) => {
                setSelectedNaturalSatelliteId(null);
                rendererRef.current?.selectNaturalSatellite(null);
                setSelectedSpaceObjectId(id);
                rendererRef.current?.selectSpaceObject(id);
              }}
              onFocusObject={(id) => {
                setSpaceObjectsVisible(true);
                rendererRef.current?.setSpaceObjectsVisible(true);
                const satellite = getEarthSatelliteDefinition(id);
                if (satellite !== undefined && sampleEarthSatellite(satellite, snapshot.currentJdTdb).dataAgeState === 'outside-hard-window') {
                  setEarthSatellitesVisible(true);
                  rendererRef.current?.setEarthSatellitesVisible(true);
                  controls.setExactDateUtc(satellite.elementEpochUtc);
                  window.setTimeout(() => {
                    focusSpaceObjectForInspection(id);
                  }, 120);
                  return;
                }
                const mission = getSpacecraftDefinition(id);
                if (mission !== undefined) {
                  setSpacecraftVisible(true);
                  rendererRef.current?.setSpacecraftVisible(true);
                  const focusJdTdb = nearestSpacecraftCoverageJdTdb(mission, snapshot.currentJdTdb);
                  if (Math.abs(focusJdTdb - snapshot.currentJdTdb) > 1e-9) {
                    controls.setExactDateUtc(approximateTdbToDateUtc(focusJdTdb).toISOString());
                    window.setTimeout(() => {
                      focusSpaceObjectForInspection(id);
                    }, 120);
                    return;
                  }
                }
                focusSpaceObjectForInspection(id);
              }}
              onFocusEarth={() => controls.focusBody('earth')}
              onFocusSun={() => controls.focusBody('sun')}
              onReturnToSatelliteEpoch={() => controls.setExactDateUtc('2026-08-30T12:00:00.000Z')}
            />
          </div>

          <section className="observatory-stage" aria-label="Interactive observatory stage">
            <div className="stage-heading">
              <div className="stage-heading-primary">
                <span className="body-list-marker" data-body-id={selectedBodyId} aria-hidden="true" />
                <span>
                  <strong>{selectedBodyDefinition.displayName}</strong>
                  {stageModeLabel}
                </span>
              </div>
              <div className="stage-heading-actions">
                <span>{formatStageUtc(snapshot.currentUtcIso)}</span>
                <span aria-hidden="true">·</span>
                <span>{snapshot.paused ? 'Paused' : snapshot.direction === -1 ? 'Reverse' : 'Running'}</span>
                <span aria-hidden="true">·</span>
                <span>{snapshot.originBodyId} · revision {snapshot.originRevision}</span>
                <span aria-hidden="true">·</span>
                <span title={webglMessage ?? undefined}>GPU {webglStatus}</span>
              </div>
            </div>

            <ObservatoryViewport
              closeUpActive={activeCloseUpPresetId !== null}
              ariaLabel="Interactive Solar System observatory with catastrophe labs, adaptive performance, and optional experimental equilibrium-tide forcing"
            >
          <DebugCanvas
            reducedMotion={reducedMotion}
            reduceFlashes={reduceFlashes}
            cameraMode={cameraMode}
            earthTideDebugMode={experimentalTideMode}
            manualCameraInteractionLocked={manualCameraInteractionLocked}
            onRendererReady={handleRendererReady}
            onStatusChange={handleWebGLStatusChange}
            onVisibilityChange={handleVisibilityChange}
            onInteractionStart={
              manualCameraInteractionLocked ? undefined : handleCanvasInteractionStart
            }
          />
          <div className="canvas-topbar">
            <div className="badge-stack">
              <span
                className={`mode-badge ${ephemeris.status === 'ready' ? '' : 'mode-badge-warning'}`}
                data-testid="ephemeris-provider-badge"
              >
                {ephemeris.status === 'ready'
                  ? 'JPL Horizons · generated offline bundles'
                  : `Ephemeris · ${ephemeris.status}`}
              </span>
              {experimentalTideMode !== 'off' ? (
                <span
                  className="mode-badge mode-badge-warning"
                  data-testid="experimental-tide-badge"
                  data-tide-debug-mode={activeTideMode}
                >
                  {activeTideMode === 'off'
                    ? 'Experimental equilibrium tides · overlays off · normalized / exaggerated · not an ocean-tide prediction'
                    : `Experimental ${activeTideMode} equilibrium tides · normalized / exaggerated · not an ocean-tide prediction`}
                </span>
              ) : null}
              {presentationWarningRequired ? (
                <span
                  className="mode-badge mode-badge-warning"
                  data-testid="presentation-scale-warning-badge"
                >
                  Body sizes exaggerated · presentation scale
                </span>
              ) : null}
              {limitedPathCount > 0 ? (
                <span
                  className="mode-badge mode-badge-warning"
                  data-testid="orbit-coverage-warning-badge"
                  title={Object.values(pathCoverageWarnings).join(' ')}
                >
                  {limitedPathCount} coverage-limited orbit {limitedPathCount === 1 ? 'arc' : 'arcs'}
                  {' · '}none fabricated
                  <span className="sr-only"> {Object.values(pathCoverageWarnings).join(' ')}</span>
                </span>
              ) : null}
              <span className="mode-badge">Positions linear · 1 AU / unit</span>
            </div>
          </div>
          <CanvasLegend
            selectedBodyId={selectedBodyId}
            selectedBodyIsComet={selectedCometDefinition !== null}
            cometsVisible={cometsVisible}
            cometShortcutAvailable={cometShortcutAvailable}
            experimentalTidesEnabled={experimentalTideMode !== 'off'}
            activeTideMode={activeTideMode}
            disabled={controlsDisabled}
            onFocusBody={handleLegendBodyFocus}
            onFocusComet={handleLegendCometFocus}
            onToggleTideComponent={handleLegendTideToggle}
          />
          {ephemeris.status === 'loading' ? (
            <div className="observatory-load-state" role="status" data-testid="ephemeris-loading-state">
              <span className="loading-orbit" aria-hidden="true" />
              <strong>Validating bundled ephemerides</strong>
              <span>Checking manifests, hashes, frames, and small-body routing.</span>
            </div>
          ) : null}
          {ephemeris.status === 'error' ? (
            <div className="observatory-load-state observatory-load-error" role="alert">
              <strong>Scientific data could not be loaded</strong>
              <span>{ephemeris.message}</span>
              <button className="button button-secondary" type="button" onClick={() => location.reload()}>
                Retry observatory
              </button>
            </div>
          ) : null}
          {(tourSummary?.state === 'running' || tourSummary?.state === 'paused') &&
          tourSummary.waypoint !== null ? (
            <div className="cinematic-tour-status" role="status" data-testid="cinematic-tour-status">
              <span className="eyebrow">Guided observatory tour</span>
              <strong>{tourSummary?.waypoint.label}</strong>
              <span>
                Cinematic camera movement · simulation data unchanged ·{' '}
                {Math.max(
                  1,
                  CINEMATIC_TOUR_ROUTE.findIndex(
                    (waypoint) => waypoint.id === tourSummary?.waypoint?.id,
                  ) + 1,
                )}
                /{CINEMATIC_TOUR_ROUTE.length}
              </span>
            </div>
          ) : null}
          {impactActive ? (
            <div
              className="impact-event-hud"
              role="status"
              aria-live="polite"
              data-testid="impact-event-hud"
            >
              <span className="eyebrow">Educational approximation · Impact Lab</span>
              <strong>{formatImpactStage(impactSnapshot.stage)}</strong>
              <span>
                Scenario-local time {impactSnapshot.scenarioTimeSeconds.toFixed(2)} s ·{' '}
                {Math.round(impactSnapshot.progress * 100)}% · {impactSnapshot.playbackRate}x
              </span>
              <span>Entry, breakup, impact, and aftermath visuals are simplified for this target.</span>
            </div>
          ) : null}
          {solarEvolutionActive ? (
            <div
              className="solar-fate-event-hud solar-evolution-hud"
              role="region"
              aria-label="Scientific Solar Evolution status"
              data-testid="solar-evolution-hud"
            >
              <span className="eyebrow">
                Scientific Solar Evolution · compressed educational visualization
              </span>
              <strong>{solarEvolutionSnapshot.phaseLabel}</strong>
              <span>
                Compressed sequence time {solarEvolutionSnapshot.scenarioTimeSeconds.toFixed(2)} s ·{' '}
                {Math.round(solarEvolutionSnapshot.progress * 100)}% ·{' '}
                {solarEvolutionSnapshot.playbackRate}x
              </span>
              <span>{SCIENTIFIC_SOLAR_EVOLUTION_CAVEAT}</span>
              <span className="sr-only" role="status" aria-live="polite">
                Scientific Solar Evolution phase: {solarEvolutionSnapshot.phaseLabel}.
              </span>
            </div>
          ) : null}
          {fictionalSupernovaActive ? (
            <div
              className="solar-fate-event-hud fictional-supernova-hud"
              role="region"
              aria-label="Fictional Solar Supernova warning and status"
              data-testid="fictional-supernova-hud"
            >
              <span className="eyebrow">Fictional · cinematic · impossible for the Sun</span>
              <strong>{formatFictionalSupernovaStage(fictionalSupernovaSnapshot.stage)}</strong>
              <span>{FICTIONAL_SOLAR_SUPERNOVA_WARNING}</span>
              <span>
                Scenario-local time {fictionalSupernovaSnapshot.scenarioTimeSeconds.toFixed(2)} s ·{' '}
                {Math.round(fictionalSupernovaSnapshot.progress * 100)}% · visually compressed
              </span>
              <span>Event timing and radiation propagation are compressed for visualization.</span>
              <span className="sr-only" role="status" aria-live="polite">
                Fictional Solar Supernova stage:{' '}
                {formatFictionalSupernovaStage(fictionalSupernovaSnapshot.stage)}.
              </span>
            </div>
          ) : null}
          {blackHolePhysicsActive ? (
            <div
              className="black-hole-event-hud black-hole-physics-hud"
              role="region"
              aria-label="Black-Hole Physics Flyby status"
              data-testid="black-hole-physics-hud"
            >
              <span className="eyebrow">Physics Flyby · Newtonian educational approximation</span>
              <strong>{formatBlackHoleStage(blackHolePhysicsSnapshot.stage)}</strong>
              <span>{BLACK_HOLE_PHYSICS_CAVEAT}</span>
              <span>
                Scenario-local time {blackHolePhysicsSnapshot.scenarioTimeSeconds.toFixed(2)} s ·{' '}
                {Math.round(blackHolePhysicsSnapshot.progress * 100)}% ·{' '}
                {blackHolePhysicsSnapshot.captureCount} captured ·{' '}
                {blackHolePhysicsSnapshot.ejectionCount} ejected ·{' '}
                {blackHolePhysicsSnapshot.survivorCount} surviving/active
              </span>
              <span>
                Newtonian trajectories · lensing is rendering only · outcomes are not guaranteed
              </span>
            </div>
          ) : null}
          {completeConsumptionActive ? (
            <div
              className="black-hole-event-hud black-hole-cinematic-hud"
              role="region"
              aria-label="Complete Consumption cinematic warning and status"
              data-testid="black-hole-cinematic-hud"
            >
              <span className="eyebrow">Complete Consumption · nonphysical cinematic</span>
              <strong>{formatBlackHoleStage(completeConsumptionSnapshot.stage)}</strong>
              <span>{COMPLETE_CONSUMPTION_CINEMATIC_WARNING}</span>
              <span>
                Black-hole mass{' '}
                {(completeConsumptionSnapshot.blackHole?.massSolarMasses ?? 0).toFixed(3)} M☉ ·{' '}
                {completeConsumptionSnapshot.captureCount}/
                {completeConsumptionSnapshot.bodyStates.length} bodies captured
              </span>
              <span>
                Scenario-local time {completeConsumptionSnapshot.scenarioTimeSeconds.toFixed(2)} s ·{' '}
                {Math.round(completeConsumptionSnapshot.progress * 100)}% · timing and damping are artistic
              </span>
            </div>
          ) : null}
        </ObservatoryViewport>

            <DebugTimeControls
              snapshot={snapshot}
              controls={controls}
              bodyOptions={BODY_OPTIONS}
              selectedBodyId={selectedBodyId}
              disabled={controlsDisabled}
            />
          </section>

          <div className="workspace-rail workspace-rail-right">
            {impactLabOpen ? (
              <div className="impact-lab-workspace" id="impact-lab-workspace">
                {impactError === null ? null : (
                  <p className="control-panel scale-warning impact-error" role="alert">
                    {impactError}
                  </p>
                )}
                <ImpactLabPanel
                  parameters={impactParameters}
                  summary={impactPhysicalSummary}
                  visualProfile={impactVisualProfile}
                  snapshot={impactSnapshot}
                  disabled={observatoryUnavailable}
                  reduceFlashes={reduceFlashes}
                  onParametersChange={handleImpactParametersChange}
                  onReduceFlashesChange={updateReduceFlashes}
                  onConfirmRun={handleImpactStart}
                  onClose={() => setImpactLabOpen(false)}
                  onPause={handleImpactPause}
                  onResume={handleImpactResume}
                  onFrameStep={handleImpactFrameStep}
                  onReplay={handleImpactReplay}
                  onReset={handleImpactReset}
                  onCameraModeChange={handleImpactCameraMode}
                />
              </div>
            ) : solarFateOpen ? (
              <div className="solar-fate-workspace" id="solar-fate-workspace">
                {solarFateError === null ? null : (
                  <p className="control-panel scale-warning impact-error" role="alert">
                    {solarFateError}
                  </p>
                )}
                <SolarFatePanel
                  activeScenario={solarFatePanelState}
                  disabled={observatoryUnavailable}
                  reduceFlashes={reduceFlashes}
                  onReduceFlashesChange={updateReduceFlashes}
                  onStartScientificEvolution={handleSolarEvolutionStart}
                  onStartFictionalSupernova={handleFictionalSupernovaStart}
                  onClose={() => setSolarFateOpen(false)}
                  onPause={handleSolarFatePause}
                  onResume={handleSolarFateResume}
                  onFrameStep={handleSolarFateFrameStep}
                  onSkip={handleSolarFateSkip}
                  onReplay={handleSolarFateReplay}
                  onReset={handleSolarFateReset}
                />
              </div>
            ) : blackHoleEncounterOpen ? (
              <div
                className="black-hole-encounter-workspace"
                id="black-hole-encounter-workspace"
              >
                {blackHoleError === null ? null : (
                  <p className="control-panel scale-warning impact-error" role="alert">
                    {blackHoleError}
                  </p>
                )}
                <BlackHoleEncounterPanel
                  parameters={blackHolePanelParameters}
                  activeScenario={blackHolePanelState}
                  disabled={observatoryUnavailable}
                  reduceFlashes={reduceFlashes}
                  onParametersChange={setBlackHolePanelParameters}
                  onReduceFlashesChange={updateReduceFlashes}
                  onStartPhysicsFlyby={handleBlackHolePhysicsStart}
                  onStartCompleteConsumption={handleCompleteConsumptionStart}
                  onClose={() => setBlackHoleEncounterOpen(false)}
                  onPause={handleBlackHolePause}
                  onResume={handleBlackHoleResume}
                  onFrameStep={handleBlackHoleFrameStep}
                  onSkip={handleBlackHoleSkip}
                  onReplay={handleBlackHoleReplay}
                  onReset={handleBlackHoleReset}
                />
              </div>
            ) : (
              <>
            <BodyInspector
              body={selectedBodyDefinition}
              telemetry={selectedBodyTelemetry}
              cameraMode={cameraMode}
              presentationWarningRequired={presentationWarningRequired}
              pathCoverageWarning={selectedPathCoverageWarning}
              materialLabel={selectedVisualStatus.materialLabel}
              assetState={selectedVisualStatus.assetState}
              cometStatus={
                selectedCometDefinition !== null &&
                selectedCometStatus?.bodyId === selectedCometDefinition.id
                  ? selectedCometStatus
                  : null
              }
            />
            <ViewControls
              cameraMode={cameraMode}
              renderScaleMode={renderScaleMode}
              visualQuality={visualQuality}
              venusSurfaceMode={venusSurfaceMode}
              activeCloseUpPresetId={activeCloseUpPresetId}
              presentationWarningRequired={presentationWarningRequired}
              selectedTrailInterval={selectedTrailInterval}
              disabled={controlsDisabled}
              onCameraModeChange={controls.setCameraMode}
              onRenderScaleModeChange={controls.setRenderScaleMode}
              onVisualQualityChange={(quality) => {
                updateVisualQuality(quality);
                rendererRef.current?.setVisualQuality(quality);
                runtimeRef.current?.renderNow();
                refreshSelectedVisualStatus();
              }}
              onVenusSurfaceModeChange={(mode) => {
                updateVenusSurfaceMode(mode);
                rendererRef.current?.setVenusSurfaceMode(mode);
                runtimeRef.current?.renderNow();
                refreshSelectedVisualStatus();
              }}
              onCloseUpPresetSelect={applyCameraCloseUpPreset}
              onSelectedTrailIntervalChange={controls.setSelectedTrailInterval}
            />
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="observatory-footer">
        <p>Camera-relative ephemerides · isolated scenario clocks · 2000–2100 TDB observatory data</p>
        <p>
          <a href={ephemerisValidationUrl} target="_blank" rel="noreferrer">
            Planetary validation
          </a>
          {' · '}
          <a href={smallBodyValidationUrl} target="_blank" rel="noreferrer">
            Comet validation
          </a>
          {' · '}
          <a href={surfaceAssetManifestUrl} target="_blank" rel="noreferrer">
            Surface source manifest
          </a>
          <a href={moonSurfaceAssetManifestUrl} target="_blank" rel="noreferrer">
            Moon texture manifest
          </a>
          {' · '}giant-atmosphere and ring profiles are versioned visualization data
        </p>
      </footer>

      <HelpOverlay
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        motionPreference={motionPreference}
        onMotionPreferenceChange={updateMotionPreference}
        reduceFlashes={reduceFlashes}
        onReduceFlashesChange={updateReduceFlashes}
        onResetPreferences={resetSavedPreferences}
        resetPreferencesDisabled={scenarioActive}
      />
      <ProvenanceOverlay
        open={provenanceOpen}
        onClose={() => setProvenanceOpen(false)}
        selectedBodyId={selectedBodyId}
        selectedBodyName={selectedBodyDefinition.displayName}
        providerLabel={ephemeris.providerLabel}
        providerStatus={ephemeris.status}
        providerCoverage={ephemeris.coverageLabel}
        providerMessage={ephemeris.message}
        snapshot={snapshot}
        cameraMode={cameraMode}
        renderScaleMode={renderScaleMode}
        presentationWarningRequired={presentationWarningRequired}
        ephemerisValidationUrl={ephemerisValidationUrl}
        smallBodyValidationUrl={smallBodyValidationUrl}
        surfaceAssetManifestUrl={surfaceAssetManifestUrl}
        moonSurfaceAssetManifestUrl={moonSurfaceAssetManifestUrl}
      />
    </div>
  );
}

function blackHolePanelParametersFrom(
  parameters: Readonly<BlackHoleEncounterParameters>,
): Readonly<BlackHoleFlybyPanelParameters> {
  return Object.freeze({
    massSolarMasses: parameters.blackHole.massSolarMasses,
    initialPositionM: parameters.blackHole.initialPositionM,
    initialVelocityMps: parameters.blackHole.initialVelocityMps,
    closestApproachTargetM: parameters.blackHole.closestApproachTargetM,
    closestApproachTimeSeconds: parameters.blackHole.closestApproachTimeSeconds,
    spinVisualization: parameters.blackHole.spinVisualization,
    accretionDiskEnabled: parameters.blackHole.accretionDiskEnabled,
    captureRadiusMultiple: parameters.blackHole.captureRadiusMultiple,
    accuracy: parameters.accuracy,
    seed: parameters.seed,
  });
}

function applyBlackHolePanelParameters<Parameters extends BlackHoleEncounterParameters>(
  parameters: Readonly<Parameters>,
  panel: Readonly<BlackHoleFlybyPanelParameters>,
): Parameters {
  return {
    ...parameters,
    blackHole: {
      ...parameters.blackHole,
      massSolarMasses: panel.massSolarMasses,
      initialPositionM: panel.initialPositionM,
      initialVelocityMps: panel.initialVelocityMps,
      closestApproachTargetM: panel.closestApproachTargetM,
      closestApproachTimeSeconds: panel.closestApproachTimeSeconds,
      spinVisualization: panel.spinVisualization,
      accretionDiskEnabled: panel.accretionDiskEnabled,
      captureRadiusMultiple: panel.captureRadiusMultiple,
    },
    accuracy: panel.accuracy,
    seed: panel.seed,
  } as Parameters;
}

function createBlackHolePanelState(
  physics: Readonly<PhysicsFlybySnapshot>,
  cinematic: Readonly<CompleteConsumptionSnapshot>,
): Readonly<BlackHoleEncounterActiveScenario> | null {
  if (physics.state !== 'idle' && physics.diagnostics !== null) {
    return Object.freeze({
      mode: 'physics-flyby',
      state: physics.state,
      stage: physics.stage,
      scenarioTimeSeconds: physics.scenarioTimeSeconds,
      totalDurationSeconds: physics.totalDurationSeconds,
      progress: physics.progress,
      diagnostics: physics.diagnostics,
      bodyStates: physics.bodyStates,
      captureCount: physics.captureCount,
      ejectionCount: physics.ejectionCount,
      survivorCount: physics.survivorCount,
      allBodiesCaptured: physics.allBodiesCaptured,
    });
  }
  if (cinematic.state !== 'idle' && cinematic.diagnostics !== null) {
    return Object.freeze({
      mode: 'complete-consumption-cinematic',
      state: cinematic.state,
      stage: cinematic.stage,
      scenarioTimeSeconds: cinematic.scenarioTimeSeconds,
      totalDurationSeconds: cinematic.totalDurationSeconds,
      progress: cinematic.progress,
      diagnostics: cinematic.diagnostics,
      bodyStates: cinematic.bodyStates,
      captureCount: cinematic.captureCount,
      ejectionCount: cinematic.ejectionCount,
      survivorCount: cinematic.survivorCount,
      allBodiesCaptured: cinematic.allBodiesCaptured,
    });
  }
  return null;
}

function createBlackHoleRenderState(
  snapshot: Readonly<PhysicsFlybySnapshot | CompleteConsumptionSnapshot>,
): Readonly<BlackHoleSceneRenderState> | null {
  if (
    snapshot.state === 'idle' ||
    snapshot.blackHole === null ||
    snapshot.runSignature === null
  ) {
    return null;
  }
  return Object.freeze({
    lifecycleState: snapshot.state,
    mode: snapshot.mode,
    stage: snapshot.stage,
    scenarioTimeSeconds: snapshot.scenarioTimeSeconds,
    progress: snapshot.progress,
    scenarioOriginM: snapshot.scenarioOriginM,
    scenarioOriginVelocityMps: snapshot.scenarioOriginVelocityMps,
    blackHole: snapshot.blackHole,
    bodyStates: snapshot.bodyStates,
    runSignature: snapshot.runSignature,
  });
}

function formatBlackHoleStage(stage: string): string {
  return stage.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function createSolarFatePanelState(
  solarEvolution: Readonly<ScientificSolarEvolutionSnapshot>,
  fictionalSupernova: Readonly<FictionalSolarSupernovaSnapshot>,
): Readonly<SolarFateActiveScenario> | null {
  if (solarEvolution.state !== 'idle') {
    return Object.freeze({
      mode: 'scientific-evolution',
      playbackState: solarEvolution.state,
      stageId: solarEvolution.stage,
      phaseName: solarEvolution.phaseLabel,
      scenarioTimeSeconds: solarEvolution.scenarioTimeSeconds,
      progress: solarEvolution.progress,
      radiusLabel: solarEvolution.radiusLabel,
      luminosityLabel: solarEvolution.luminosityLabel,
      massLossLabel: solarEvolution.massLossLabel,
      timeCompressionNotice: solarEvolution.timeCompressionNotice,
      caveats: solarEvolution.caveats,
      uncertainBodyIds: solarEvolution.uncertainBodyIds,
      compactRemnantSizeExaggerationRequired:
        solarEvolution.compactRemnantSizeExaggerationRequired,
    });
  }
  if (fictionalSupernova.state !== 'idle') {
    return Object.freeze({
      mode: 'fictional-supernova',
      playbackState: fictionalSupernova.state,
      stageId: fictionalSupernova.stage,
      stageName: formatFictionalSupernovaStage(fictionalSupernova.stage),
      scenarioTimeSeconds: fictionalSupernova.scenarioTimeSeconds,
      progress: fictionalSupernova.progress,
    });
  }
  return null;
}

function createSolarEvolutionRenderState(
  snapshot: Readonly<ScientificSolarEvolutionSnapshot>,
): Readonly<SolarEvolutionRenderState> | null {
  if (snapshot.state === 'idle' || snapshot.runSignature === null) return null;
  return Object.freeze({
    lifecycleState: snapshot.state,
    phase: solarEvolutionRenderPhaseFor(snapshot.phaseId, snapshot.phaseProgress),
    scenarioTimeSeconds: snapshot.scenarioTimeSeconds,
    progress: snapshot.progress,
    stellarRadiusM: snapshot.physicalRadiusM,
    luminositySolar: snapshot.luminositySolar,
    effectiveTemperatureK: snapshot.effectiveTemperatureK,
    massSolar: snapshot.massSolarMasses,
    massLossOpacity: snapshot.massLossShellOpacity,
    nebulaRadiusM: snapshot.nebulaDisplayRadiusM,
    nebulaOpacity: snapshot.nebulaOpacity,
    heatingByBody: snapshot.heatingByBody,
    engulfmentByBody: snapshot.engulfmentByBody,
    runSignature: snapshot.runSignature,
  });
}

function createFictionalSupernovaRenderState(
  snapshot: Readonly<FictionalSolarSupernovaSnapshot>,
): Readonly<FictionalSupernovaRenderState> | null {
  if (snapshot.state === 'idle' || snapshot.runSignature === null) return null;
  return Object.freeze({
    lifecycleState: snapshot.state,
    phase: fictionalSupernovaRenderPhaseFor(snapshot.stage, snapshot.shockProgress),
    scenarioTimeSeconds: snapshot.scenarioTimeSeconds,
    progress: snapshot.progress,
    pulseScale: snapshot.pulseScale,
    flashIntensity: snapshot.flashIntensity,
    coreRadiusM: snapshot.coreRadiusM,
    shockRadiusM: snapshot.shockRadiusM,
    radiationFrontRadiusM: snapshot.radiationFrontRadiusM,
    debrisRadiusM: snapshot.debrisRadiusM,
    debrisOpacity: snapshot.debrisOpacity,
    nebulaRadiusM: snapshot.nebulaRadiusM,
    nebulaOpacity: snapshot.nebulaOpacity,
    remnantRadiusM: snapshot.remnantRadiusM,
    remnantKind: snapshot.remnantKind,
    heatingByBody: snapshot.heatingByBody,
    runSignature: snapshot.runSignature,
  });
}

function solarEvolutionRenderPhaseFor(
  phaseId: SolarEvolutionPhaseId | null,
  phaseProgress: number,
): SolarEvolutionPhase {
  switch (phaseId) {
    case 'present':
      return 'present';
    case 'red-giant':
      return phaseProgress < 0.22 ? 'brightening' : 'red-giant';
    case 'inner-system-heating':
      return 'red-giant';
    case 'mass-loss-nebular':
      return phaseProgress < 0.45 ? 'mass-loss' : 'planetary-nebula';
    case 'white-dwarf':
      return 'white-dwarf';
    case 'cooling-remnant':
    case null:
      return 'cooling';
  }
}

function fictionalSupernovaRenderPhaseFor(
  stage: FictionalSolarSupernovaStage,
  shockProgress: number,
): FictionalSupernovaPhase {
  switch (stage) {
    case 'idle':
    case 'surface-pulse':
      return 'surface-pulse';
    case 'core-flash':
      return 'core-flash';
    case 'shock-breakout':
      return shockProgress < 0.18 ? 'shock-breakout' : 'shock-shell';
    case 'radiation-front':
      return 'radiation-front';
    case 'debris-nebula':
      return 'debris-nebula';
    case 'fictional-remnant':
    case 'complete':
      return 'remnant';
  }
}

function formatFictionalSupernovaStage(stage: FictionalSolarSupernovaStage): string {
  if (stage === 'fictional-remnant') return 'Fictional Remnant';
  return stage.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function createImpactRenderState(
  snapshot: Readonly<ImpactScenarioSnapshot>,
): Readonly<ImpactRenderState> | null {
  const parameters = snapshot.parameters;
  const physical = snapshot.physicalSummary;
  const visual = snapshot.visualProfile;
  const impactFrame = snapshot.impactFrame;
  if (
    snapshot.state === 'idle' ||
    parameters === null ||
    physical === null ||
    visual === null ||
    impactFrame === null ||
    snapshot.runSignature === null
  ) {
    return null;
  }
  const targetProfile = getImpactTargetProfile(parameters.targetBodyId);
  const targetRenderRadii = impactTargetRenderRadii(
    parameters.targetBodyId,
    physical.targetRadiusM,
  );
  const surfaceEffectProfile = impactSurfaceEffectProfileFor(
    physical.targetClass,
    parameters.atmosphereEnabled,
  );
  const aftermathKind = impactAftermathKindFor(
    physical.outcomeKind,
    physical.targetClass,
    targetProfile.supportsCrater,
    parameters.atmosphereEnabled && targetProfile.supportsCloudScar,
  );

  return Object.freeze({
    presentationMode: 'playback',
    lifecycleState: snapshot.state,
    stage: impactVisualStageFor(snapshot.stage),
    scenarioTimeSeconds: snapshot.scenarioTimeSeconds,
    progress: snapshot.progress,
    targetBodyId: parameters.targetBodyId,
    targetRadiusM: physical.targetRadiusM,
    targetEquatorialRadiusM: targetRenderRadii.equatorialRadiusM,
    targetPolarRadiusM: targetRenderRadii.polarRadiusM,
    targetClass: physical.targetClass,
    surfaceGravityMps2: targetProfile.surfaceGravityMps2,
    supportsCrater: targetProfile.supportsCrater,
    supportsGroundShockwave: targetProfile.supportsGroundShockwave,
    supportsAtmosphericShockwave:
      parameters.atmosphereEnabled && targetProfile.supportsAtmosphericShockwave,
    supportsPersistentSurfaceDecal: targetProfile.supportsPersistentSurfaceDecal,
    supportsCloudScar:
      parameters.atmosphereEnabled && targetProfile.supportsCloudScar,
    outcomeKind: physical.outcomeKind,
    surfaceEffectProfile,
    aftermathKind,
    impactNormalBodyLocal: impactFrame.normalBodyLocal,
    impactEastBodyLocal: impactFrame.eastBodyLocal,
    impactNorthBodyLocal: impactFrame.northBodyLocal,
    impactorLocalEnuM:
      snapshot.impactorPosition === null
        ? null
        : Object.freeze({
            eastM: snapshot.impactorPosition.x,
            northM: snapshot.impactorPosition.y,
            upM: snapshot.impactorPosition.z,
          }),
    impactorVelocityLocalEnuMps:
      snapshot.impactorVelocity === null
        ? null
        : Object.freeze({
            eastM: snapshot.impactorVelocity.x,
            northM: snapshot.impactorVelocity.y,
            upM: snapshot.impactorVelocity.z,
          }),
    trailLocalEnuM: interleaveImpactPositions(snapshot.trailPositions),
    fragmentsLocalEnuM: interleaveImpactPositions(snapshot.fragmentPositions),
    physicalDiameterM: physical.diameterM,
    impactorMaterial: parameters.material,
    entryEffectProfile: impactEntryEffectProfileFor(
      physical.targetClass,
      parameters.atmosphereEnabled,
    ),
    normalizedHeating: snapshot.normalizedHeating,
    normalizedDynamicPressure: snapshot.normalizedDynamicPressure,
    remainingMassFraction: snapshot.remainingMassFraction,
    eventElapsedSeconds: snapshot.eventElapsedSeconds,
    flashIntensity: snapshot.flashIntensity,
    flashRadiusM: visual.flashRadiusM,
    craterRadiusM: visual.craterRadiusM,
    craterDepthM: visual.craterDepthM,
    scorchRadiusM: visual.scorchRadiusM,
    craterFormationProgress: snapshot.craterFormationProgress,
    surfaceScorchOpacity: snapshot.surfaceScorchOpacity,
    ejectaRadiusM: snapshot.ejectaRadiusM,
    ejectaLaunchSpeedMps: visual.ejectaLaunchSpeedMps,
    ejectaLifetimeSeconds: visual.ejectaLifetimeSeconds,
    ejectaHeightM: snapshot.ejectaHeightM,
    ejectaOpacity: snapshot.ejectaOpacity,
    shockwaveRadiusM: snapshot.shockwaveRadiusM,
    groundShockwaveAngularRadiusRad: snapshot.groundShockwaveAngularRadiusRad,
    groundShockwaveOpacity: snapshot.groundShockwaveOpacity,
    atmosphericShockwaveAngularRadiusRad:
      snapshot.atmosphericShockwaveAngularRadiusRad,
    atmosphericShockwaveOpacity: snapshot.atmosphericShockwaveOpacity,
    plumeHeightM: snapshot.plumeHeightM,
    plumeRadiusM: snapshot.plumeRadiusM,
    plumeOpacity: snapshot.plumeOpacity,
    plumeCoolingProgress: snapshot.plumeCoolingProgress,
    hazeOpacity: snapshot.hazeOpacity,
    cloudScarRadiusM: visual.cloudScarRadiusM,
    cloudScarGrowthProgress: snapshot.cloudScarGrowthProgress,
    cloudScarOpacity: snapshot.cloudScarOpacity,
    cloudScarAdvectionRad: snapshot.cloudScarAdvectionRad,
    runSignature: snapshot.runSignature,
  });
}

function createImpactPreviewRenderState(
  parameters: Readonly<ImpactParameters>,
  simulation: Readonly<ImpactSimulationResult>,
): Readonly<ImpactRenderState> {
  const physical = simulation.physicalSummary;
  const targetProfile = getImpactTargetProfile(parameters.targetBodyId);
  const targetRenderRadii = impactTargetRenderRadii(
    parameters.targetBodyId,
    physical.targetRadiusM,
  );
  return Object.freeze({
    presentationMode: 'preview',
    lifecycleState: 'armed',
    stage: 'preview',
    scenarioTimeSeconds: 0,
    progress: 0,
    targetBodyId: physical.targetBodyId,
    targetRadiusM: physical.targetRadiusM,
    targetEquatorialRadiusM: targetRenderRadii.equatorialRadiusM,
    targetPolarRadiusM: targetRenderRadii.polarRadiusM,
    targetClass: physical.targetClass,
    surfaceGravityMps2: targetProfile.surfaceGravityMps2,
    supportsCrater: targetProfile.supportsCrater,
    supportsGroundShockwave: targetProfile.supportsGroundShockwave,
    supportsAtmosphericShockwave: false,
    supportsPersistentSurfaceDecal: targetProfile.supportsPersistentSurfaceDecal,
    supportsCloudScar: false,
    outcomeKind: physical.outcomeKind,
    surfaceEffectProfile: 'none',
    aftermathKind: 'none',
    impactNormalBodyLocal: simulation.impactFrame.normalBodyLocal,
    impactEastBodyLocal: simulation.impactFrame.eastBodyLocal,
    impactNorthBodyLocal: simulation.impactFrame.northBodyLocal,
    impactorLocalEnuM: null,
    impactorVelocityLocalEnuMps: null,
    trailLocalEnuM: interleaveImpactPositions(
      simulation.samples.map((sample) => sample.positionEnuM),
    ),
    fragmentsLocalEnuM: new Float64Array(0),
    physicalDiameterM: physical.diameterM,
    impactorMaterial: parameters.material,
    entryEffectProfile: 'none',
    normalizedHeating: 0,
    normalizedDynamicPressure: 0,
    remainingMassFraction: 1,
    eventElapsedSeconds: null,
    flashIntensity: 0,
    flashRadiusM: 0,
    craterRadiusM: 0,
    craterDepthM: 0,
    scorchRadiusM: 0,
    craterFormationProgress: 0,
    surfaceScorchOpacity: 0,
    ejectaRadiusM: 0,
    ejectaLaunchSpeedMps: 0,
    ejectaLifetimeSeconds: 0,
    ejectaHeightM: 0,
    ejectaOpacity: 0,
    shockwaveRadiusM: 0,
    groundShockwaveAngularRadiusRad: 0,
    groundShockwaveOpacity: 0,
    atmosphericShockwaveAngularRadiusRad: 0,
    atmosphericShockwaveOpacity: 0,
    plumeHeightM: 0,
    plumeRadiusM: 0,
    plumeOpacity: 0,
    plumeCoolingProgress: 0,
    hazeOpacity: 0,
    cloudScarRadiusM: 0,
    cloudScarGrowthProgress: 0,
    cloudScarOpacity: 0,
    cloudScarAdvectionRad: 0,
    runSignature: impactRunSignature(parameters).replace(
      'impact-v2-',
      'impact-preview-v2-',
    ),
  });
}

function impactEntryEffectProfileFor(
  targetClass: ImpactSimulationResult['physicalSummary']['targetClass'],
  atmosphereEnabled: boolean,
): ImpactRenderState['entryEffectProfile'] {
  if (!atmosphereEnabled || targetClass === 'airless-rocky') return 'none';
  if (targetClass === 'thin-atmosphere-rocky') return 'thin';
  if (targetClass === 'gas-giant' || targetClass === 'ice-giant') return 'giant';
  return 'dense';
}

function impactSurfaceEffectProfileFor(
  targetClass: ImpactSimulationResult['physicalSummary']['targetClass'],
  atmosphereEnabled: boolean,
): ImpactRenderState['surfaceEffectProfile'] {
  if (targetClass === 'gas-giant' || targetClass === 'ice-giant') {
    return atmosphereEnabled ? 'giant-atmospheric' : 'none';
  }
  if (!atmosphereEnabled || targetClass === 'airless-rocky') {
    return 'solid-airless';
  }
  return 'solid-atmospheric';
}

function impactAftermathKindFor(
  outcomeKind: ImpactSimulationResult['physicalSummary']['outcomeKind'],
  targetClass: ImpactSimulationResult['physicalSummary']['targetClass'],
  supportsCrater: boolean,
  supportsCloudScar: boolean,
): ImpactRenderState['aftermathKind'] {
  if (outcomeKind === 'deep-atmosphere-breakup') {
    return supportsCloudScar ? 'cloud-scar' : 'none';
  }
  if (outcomeKind === 'airburst') {
    return supportsCloudScar ? 'cloud-scar' : 'none';
  }
  if (!supportsCrater) return supportsCloudScar ? 'cloud-scar' : 'none';
  return targetClass === 'thin-atmosphere-rocky' ? 'dusty-crater' : 'crater';
}

function impactTargetRenderRadii(
  bodyId: ImpactSimulationResult['physicalSummary']['targetBodyId'],
  targetRadiusM: number,
): Readonly<{ equatorialRadiusM: number; polarRadiusM: number }> {
  if (!isGiantPlanetId(bodyId)) {
    return Object.freeze({
      equatorialRadiusM: targetRadiusM,
      polarRadiusM: targetRadiusM,
    });
  }
  const profile = getGiantAtmosphereProfile(bodyId);
  return Object.freeze({
    equatorialRadiusM: profile.equatorialRadiusKm * 1_000,
    polarRadiusM: profile.polarRadiusKm * 1_000,
  });
}

function interleaveImpactPositions(
  positions: readonly Readonly<{ x: number; y: number; z: number }>[],
): Float64Array {
  const values = new Float64Array(positions.length * 3);
  for (let index = 0; index < positions.length; index += 1) {
    const position = positions[index];
    if (position === undefined) continue;
    const offset = index * 3;
    values[offset] = position.x;
    values[offset + 1] = position.y;
    values[offset + 2] = position.z;
  }
  return values;
}

function impactVisualStageFor(stage: ImpactScenarioSnapshot['stage']): ImpactVisualStage {
  switch (stage) {
    case 'idle':
      return 'idle';
    case 'approach':
      return 'approach';
    case 'atmospheric-entry':
      return 'entry';
    case 'fragmentation':
      return 'fragmentation';
    case 'airburst':
      return 'airburst';
    case 'impact-flash':
      return 'impact-flash';
    case 'ejecta':
      return 'ejecta';
    case 'plume':
      return 'plume';
    case 'haze':
      return 'aftermath';
    case 'aftermath':
      return 'aftermath';
    case 'complete':
      return 'complete';
  }
}

function impactCameraPresetFor(mode: ImpactCameraMode): ImpactCameraPresetId {
  return mode === 'slow-motion-replay' ? 'orbital' : mode;
}

function formatImpactStage(stage: ImpactScenarioSnapshot['stage']): string {
  return stage.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function classificationLabelForStage(
  body: Readonly<ObservatoryBodyDefinition>,
): string {
  if (body.kind === 'moon') return 'Natural satellite';
  return `${body.kind.charAt(0).toLocaleUpperCase()}${body.kind.slice(1)}`;
}

function formatStageUtc(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);
}

function synchronizeBodiesFromProvider(
  context: SimulationContext,
  provider: EphemerisProvider,
): void {
  for (const bodyId of OBSERVATORY_BODY_IDS) {
    const body = context.getBody(bodyId);
    if (body === undefined) throw new Error(`Runtime body "${bodyId}" is unavailable.`);
    if (!provider.hasBody(bodyId)) {
      body.visible = false;
      continue;
    }
    provider.sample(bodyId, context.clock.currentJdTdb, body);
    body.visible = true;
  }
}

function assertSuccessfulAssetResponse(response: Response, label: string): void {
  if (!response.ok) {
    throw new Error(`Bundled ${label} could not be loaded (HTTP ${response.status}).`);
  }
}

async function verifyBinaryHash(binary: ArrayBuffer, expectedSha256: string): Promise<void> {
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256)) {
    throw new Error('Ephemeris manifest contains an invalid SHA-256 digest.');
  }
  if (globalThis.crypto?.subtle === undefined) {
    throw new Error('This browser cannot verify the bundled ephemeris SHA-256 digest.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', binary);
  const actualSha256 = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  if (actualSha256.toLowerCase() !== expectedSha256.toLowerCase()) {
    throw new Error('Bundled ephemeris does not match its provenance manifest.');
  }
}

function createObservatoryOrbitPaths(
  provider: EphemerisProvider,
  requestedEpochJdTdb: number,
): readonly EphemerisPathGeometry[] {
  const paths: EphemerisPathGeometry[] = [];
  for (const bodyId of OBSERVATORY_BODY_IDS) {
    if (bodyId === 'sun' || !provider.hasBody(bodyId)) continue;
    paths.push(createObservatoryOrbitPath(provider, bodyId, requestedEpochJdTdb));
  }
  return Object.freeze(paths);
}

function createObservatoryOrbitPath(
  provider: EphemerisProvider,
  bodyId: ObservatoryBodyId,
  requestedEpochJdTdb: number,
): EphemerisPathGeometry {
  if (bodyId === 'sun') {
    throw new RangeError('The Sun has no heliocentric orbit path.');
  }
  const coverage = provider.getCoverage(bodyId);
  if (coverage === undefined) {
    throw new RangeError(`Generated ephemeris has no orbit coverage for "${bodyId}".`);
  }
  const spanDays = EPHEMERIS_ORBIT_DISPLAY_SPAN_DAYS[bodyId];
  const coverageDays = coverage.endJdTdb - coverage.startJdTdb;
  const epochJdTdb =
    spanDays <= coverageDays
      ? Math.min(
          Math.max(requestedEpochJdTdb, coverage.startJdTdb + spanDays / 2),
          coverage.endJdTdb - spanDays / 2,
        )
      : (coverage.startJdTdb + coverage.endJdTdb) / 2;
  return createEphemerisOrbitGeometry(provider, bodyId, {
    epochJdTdb,
    spanDays,
    maxPoints: 2_049,
    samplesPerSourceInterval: 2,
  });
}

function createSelectedBodyTrail(
  provider: EphemerisProvider,
  bodyId: ObservatoryBodyId,
  requestedEpochJdTdb: number,
  interval: SelectedTrailInterval,
): EphemerisPathGeometry | null {
  if (bodyId === 'sun') return null;
  const coverage = provider.getCoverage(bodyId);
  if (coverage === undefined) return null;
  const epochJdTdb = Math.min(
    Math.max(requestedEpochJdTdb, coverage.startJdTdb),
    coverage.endJdTdb,
  );
  const availableDays =
    interval === 'previous'
      ? epochJdTdb - coverage.startJdTdb
      : coverage.endJdTdb - epochJdTdb;
  if (availableDays <= 0) return null;
  const durationDays = Math.min(selectedTrailDurationDays(bodyId), availableDays);
  const endJdTdb = interval === 'previous' ? epochJdTdb : epochJdTdb + durationDays;
  return createEphemerisTrailGeometry(provider, bodyId, {
    endJdTdb,
    durationDays,
    centerBodyId: null,
    maxPoints: 513,
    samplesPerSourceInterval: 2,
  });
}

function orbitRefreshCadenceDays(bodyId: ObservatoryBodyId): number {
  switch (bodyId) {
    case 'sun':
      return Number.POSITIVE_INFINITY;
    case 'moon':
      return 1;
    case 'mercury':
      return 7;
    case 'venus':
      return 14;
    case 'earth':
    case 'mars':
      return 30;
    case 'jupiter':
      return 90;
    case 'saturn':
      return 180;
    case 'uranus':
    case 'neptune':
      return 365;
    case '2p-encke':
    case '67p-churyumov-gerasimenko':
      return 14;
    case '1p-halley':
    case 'c-1995-o1-hale-bopp':
    case 'c-2020-f3-neowise':
      return 30;
  }
}

function selectedTrailRefreshCadenceDays(
  provider: EphemerisProvider,
  bodyId: ObservatoryBodyId,
): number {
  if (bodyId === 'sun') return Number.POSITIVE_INFINITY;
  const coverage = provider.getCoverage(bodyId);
  return coverage === undefined
    ? 1
    : Math.max(coverage.sampleStepSeconds / SECONDS_PER_DAY, 1 / 24);
}

function collectPathCoverageWarnings(
  paths: readonly EphemerisPathGeometry[],
): Readonly<Record<string, string>> {
  const warnings: Record<string, string> = {};
  for (const path of paths) {
    if (path.warning !== null) warnings[path.bodyId] = path.warning;
  }
  return Object.freeze(warnings);
}

function equalWarningRecords(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => left[key] === right[key])
  );
}

function mergeEphemerisPaths(
  orbits: readonly EphemerisPathGeometry[],
  selectedTrail: EphemerisPathGeometry | null,
): readonly EphemerisPathGeometry[] {
  return selectedTrail === null
    ? orbits
    : Object.freeze([...orbits, selectedTrail]);
}

function selectedTrailDurationDays(bodyId: Exclude<ObservatoryBodyId, 'sun'>): number {
  switch (bodyId) {
    case 'moon':
      return 7;
    case 'mercury':
      return 22;
    case 'venus':
      return 56;
    case 'earth':
      return 90;
    case 'mars':
      return 120;
    case 'jupiter':
    case 'saturn':
      return 365;
    case 'uranus':
    case 'neptune':
      return 730;
    case '2p-encke':
    case '67p-churyumov-gerasimenko':
      return 120;
    case '1p-halley':
    case 'c-1995-o1-hale-bopp':
    case 'c-2020-f3-neowise':
      return 365;
  }
}

function requireObservatoryBodyId(bodyId: string): ObservatoryBodyId {
  if (!isObservatoryBodyId(bodyId)) {
    throw new RangeError(`Unknown observatory body "${bodyId}".`);
  }
  return bodyId;
}

function getRequiredBodyDefinition(
  bodyId: ObservatoryBodyId,
): Readonly<ObservatoryBodyDefinition> {
  const definition = getObservatoryBodyDefinition(bodyId);
  if (definition === undefined) {
    throw new Error(`Missing body definition for "${bodyId}".`);
  }
  return definition;
}

function parseSmallBodySegmentDefinitions(
  value: unknown,
): readonly Readonly<SegmentedEphemerisBodyDefinition>[] {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.bodies)) {
    throw new Error('Small-body segment routing must use schemaVersion 1 with a bodies array.');
  }
  const definitions = value.bodies.map((bodyValue) => {
    if (!isRecord(bodyValue) || typeof bodyValue.bodyId !== 'string') {
      throw new Error('Small-body routing contains an invalid logical body.');
    }
    const bodyId = bodyValue.bodyId;
    if (!COMET_BODY_IDS.includes(bodyId as CometBodyId) || !Array.isArray(bodyValue.segments)) {
      throw new Error(`Small-body routing contains unknown comet "${bodyId}".`);
    }
    const segments = bodyValue.segments.map((segmentValue) => {
      if (
        !isRecord(segmentValue) ||
        typeof segmentValue.seriesBodyId !== 'string' ||
        !Number.isFinite(segmentValue.startJdTdb) ||
        !Number.isFinite(segmentValue.endJdTdb) ||
        !Number.isFinite(segmentValue.stepSeconds)
      ) {
        throw new Error(`Small-body routing contains invalid segment metadata for "${bodyId}".`);
      }
      const rawKind = segmentValue.kind;
      const kind =
        rawKind === 'baseline' || rawKind === 'coarse'
          ? 'baseline'
          : rawKind === 'perihelion' || rawKind === 'perihelion-dense'
            ? 'perihelion'
            : null;
      if (kind === null) {
        throw new Error(`Small-body routing contains invalid cadence kind for "${bodyId}".`);
      }
      return Object.freeze({
        seriesBodyId: segmentValue.seriesBodyId,
        startJdTdb: segmentValue.startJdTdb as number,
        endJdTdb: segmentValue.endJdTdb as number,
        stepSeconds: segmentValue.stepSeconds as number,
        kind,
      });
    });
    return Object.freeze({ bodyId, segments: Object.freeze(segments) });
  });
  const ids = definitions.map((definition) => definition.bodyId);
  if (
    definitions.length !== COMET_BODY_IDS.length ||
    new Set(ids).size !== ids.length ||
    COMET_BODY_IDS.some((bodyId) => !ids.includes(bodyId))
  ) {
    throw new Error('Small-body routing must contain all five canonical comets exactly once.');
  }
  return Object.freeze(definitions);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function formatVisualAssetState(
  state: 'procedural' | 'unrequested' | 'loading' | 'ready' | 'fallback',
): string {
  switch (state) {
    case 'procedural':
      return 'Project-authored procedural renderer';
    case 'unrequested':
      return 'Authoritative map · loads on selection';
    case 'loading':
      return 'Loading provenance-tracked map…';
    case 'ready':
      return 'Authoritative map ready';
    case 'fallback':
      return 'Procedural fallback active';
  }
}
