import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  GridHelper,
  Group,
  Line,
  LineBasicMaterial,
  PerspectiveCamera,
  PointLight,
  Quaternion,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type BufferAttribute,
  type Material,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import type { EphemerisPathKind } from './EphemerisOrbitGeometry';
import {
  SolarPostProcessing,
  type SolarExposurePreset,
} from './SolarPostProcessing';
import {
  AdaptiveResolutionController,
  type AdaptiveResolutionDiagnostics,
  type HeavyRenderEffect,
} from './AdaptiveResolutionController';
import {
  aggregateProtectiveExposureCeilings,
  ExposureAdaptation,
  type ExposureAdaptationSnapshot,
} from './ExposureAdaptation';
import {
  writeCameraRelativePathPositions,
  writeDistanceFadedPathColors,
} from './EphemerisPathMapping';
import { PresentationRenderScale } from './PresentationRenderScale';
import type {
  DebugBodyRenderState,
  DebugOrbitTrailRenderState,
  DebugRenderFrame,
  PhysicalPosition,
  RenderContext,
} from './RenderContext';
import type { RenderScaleMode, RenderScaleModel } from './RenderScaleModel';
import { RenderScaleTransition } from './RenderScaleTransition';
import {
  projectedSphereRadiusPx,
  selectionCueOpacityForProjectedRadius,
} from './SelectionCueVisibility';
import { TrueRenderScale } from './TrueRenderScale';
import { CONTEXT_ATTRIBUTES } from './WebGLCapability';
import {
  LANDSCAPE_VERTICAL_FOV_DEG,
  verticalFovForViewport,
} from './ResponsiveCamera';
import {
  CameraController,
  CameraRig,
  NearFarPlaneController,
  calculateScaleAwareNavigation,
  getCameraCloseUpPreset,
  type CameraBodyTarget,
  type CameraCloseUpPresetId,
  type CameraMode,
  type ClipSphere,
} from './camera';
import {
  ImpactVisualSystem,
  resolveImpactCameraPose,
  type ImpactCameraPresetId,
  type ImpactRenderState,
  type ImpactVisualDiagnostics,
  type ImpactVisibilityMode,
  type RendererCameraSnapshot,
} from './impact';
import {
  FictionalSupernovaVisualSystem,
  SolarEvolutionVisualSystem,
  type FictionalSupernovaRenderState,
  type SolarEvolutionRenderState,
  type SolarFateDiagnostics,
  type SolarFateScaleContext,
} from './solar-fate';
import {
  BlackHoleVisualSystem,
  validateBlackHoleRenderState,
  type BlackHoleMappedBodyRenderState,
  type BlackHoleRenderState,
  type BlackHoleVectorTuple,
  type BlackHoleVisualDiagnostics,
} from './black-hole';
import {
  PhaseFourBodyVisualSystem,
  type PhaseFourBodyVisual,
  type PhaseFourVisualDiagnostics,
} from './bodies/BodyVisualSystem';
import type { VenusSurfaceMode, VisualQuality } from './bodies/VisualQuality';
import {
  CelestialBackground,
  type CelestialBackgroundDiagnostics,
} from './background/CelestialBackground';
import {
  PHASE_SIX_BRIGHT_STARS,
  PHASE_SIX_SKY_TEXTURES,
} from './background/BackgroundAssetCatalog';
import {
  CometVisualSystem,
  type CometFrameState,
  type CometVisual,
  type CometVisualDiagnostics,
} from './comets/CometVisualSystem';
import {
  StatisticalBeltRenderer,
  type StatisticalBeltDiagnostics,
  type StatisticalBeltId,
} from './belts/StatisticalBeltRenderer';
import { COMET_VISUAL_PROFILES } from '../simulation/bodies/CometBodyCatalog';
import {
  getGiantAtmosphereProfile,
  sampleGreatRedSpotState,
} from './bodies/GiantPlanetProfiles';
import {
  EarthTideDebugOverlay,
  type EarthTideDebugMode,
  type EarthTideDebugRenderSample,
} from './tides/EarthTideDebugOverlay';
import {
  NaturalSatelliteVisualSystem,
  type NaturalSatelliteVisualDiagnostics,
} from './satellites';
import {
  SpaceObjectVisualSystem,
  type SpaceObjectVisualDiagnostics,
} from './spaceobjects';

export interface DebugSolarSystemRendererOptions {
  readonly scaleModel?: RenderScaleModel;
  readonly initialScaleMode?: RenderScaleMode;
  readonly reducedMotion?: boolean;
  readonly labelContainer?: HTMLElement | null;
  readonly earthTideDebugMode?: EarthTideDebugMode;
}

export interface CameraRenderDiagnostics {
  readonly mode: CameraMode;
  readonly targetBodyId: string | null;
  readonly near: number;
  readonly far: number;
  readonly targetErrorRenderUnits: number | null;
}

export interface PhaseSixRenderDiagnostics {
  readonly background: Readonly<CelestialBackgroundDiagnostics>;
  readonly comet: Readonly<CometVisualDiagnostics>;
  readonly belts: Readonly<StatisticalBeltDiagnostics>;
  readonly exposure: number;
  readonly targetExposure: number;
}

export type RendererExposureSnapshot = ExposureAdaptationSnapshot;

export interface RendererPerformanceDiagnostics
  extends AdaptiveResolutionDiagnostics {
  readonly requestedPixelRatio: number;
  readonly effectivePixelRatio: number;
  readonly maximumTierPixelRatio: number;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly lines: number;
  readonly points: number;
  readonly geometries: number;
  readonly textures: number;
  readonly programs: number;
}

interface MutableCameraBodyTarget {
  bodyId: string;
  positionM: DebugBodyRenderState['positionM'];
  velocityMps: DebugBodyRenderState['velocityMps'];
  radiusM: number;
  radiusRenderUnits: number;
  visualLocalToScene: Quaternion;
  visible: boolean;
}

interface MutableClipSphere {
  readonly center: Vector3;
  radius: number;
}

interface MarkerResources {
  readonly root: Group;
  readonly visual: PhaseFourBodyVisual | CometVisual;
  readonly isComet: boolean;
  readonly cameraTarget: MutableCameraBodyTarget;
  readonly clipSphere: MutableClipSphere;
  readonly label: HTMLSpanElement | null;
  readonly scenarioPositionM: { x: number; y: number; z: number };
  readonly scenarioVelocityMps: { x: number; y: number; z: number };
  bodyState: DebugBodyRenderState;
  screenX: number;
  screenY: number;
  onScreen: boolean;
}

interface MutableBlackHoleMappedBodyRenderState {
  bodyId: string;
  positionRenderUnits: [number, number, number];
  radiusRenderUnits: number;
  outcome: BlackHoleMappedBodyRenderState['outcome'];
  tidalStress: number;
  streamProgress: number;
  captureProgress: number;
}

interface MutableBlackHoleLensingFrame {
  active: boolean;
  centerNdc: [number, number];
  eventHorizonRadiusNdc: number;
  viewportAspect: number;
  redshiftStrength: number;
}

interface MutableSolarFateScaleContext {
  metersPerRenderUnit: number;
  baseSunRadiusRenderUnits: number;
}

interface PathResources {
  readonly line: Line<BufferGeometry, LineBasicMaterial>;
  readonly source: Float64Array;
  readonly centerBodyId: string | null;
  readonly kind: EphemerisPathKind;
  readonly mappedPositions: Float32Array;
  readonly mappedColors: Float32Array;
  readonly positionAttribute: BufferAttribute;
  readonly colorAttribute: BufferAttribute;
  readonly color: Color;
}

const HELIOCENTRIC_ORIGIN: PhysicalPosition = Object.freeze({ x: 0, y: 0, z: 0 });
const MAX_DEVICE_PIXEL_RATIO = 2;
const SYSTEM_RADIUS_FLOOR = 4;
const BACKGROUND_FAR_PLANE = 800;
const VISUAL_NORTH = new Vector3(0, 1, 0);

/**
 * Phase 3 renderer. Simulation state stays Float64/SI; astronomical positions
 * cross into Float32 only after the active floating origin is subtracted.
 */
export class DebugSolarSystemRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(
    LANDSCAPE_VERTICAL_FOV_DEG,
    1,
    1e-5,
    BACKGROUND_FAR_PLANE,
  );
  private readonly controls: OrbitControls;
  private readonly scaleModel: RenderScaleModel;
  private readonly scaleTransition: RenderScaleTransition | null;
  private readonly cameraController = new CameraController();
  private readonly clippingController = new NearFarPlaneController({
    minimumNear: 1e-12,
    minimumFar: BACKGROUND_FAR_PLANE,
  });
  private readonly pathLayer = new Group();
  private readonly markerLayer = new Group();
  private readonly sphereGeometry = new SphereGeometry(1, 128, 96);
  private readonly bodyVisualSystem: PhaseFourBodyVisualSystem;
  private readonly earthTideDebugOverlay: EarthTideDebugOverlay | null;
  private readonly postProcessing: SolarPostProcessing;
  private readonly exposureAdaptation = new ExposureAdaptation({
    initialPreset: 'balanced',
    minimumExposure: 0.08,
  });
  private readonly celestialBackground: CelestialBackground;
  private readonly cometVisualSystem: CometVisualSystem;
  private readonly statisticalBelts: StatisticalBeltRenderer;
  private readonly naturalSatelliteVisualSystem = new NaturalSatelliteVisualSystem();
  private readonly spaceObjectVisualSystem = new SpaceObjectVisualSystem();
  private readonly impactVisualSystem = new ImpactVisualSystem('high');
  private readonly solarEvolutionVisualSystem = new SolarEvolutionVisualSystem('high');
  private readonly fictionalSupernovaVisualSystem =
    new FictionalSupernovaVisualSystem('high');
  private readonly blackHoleVisualSystem = new BlackHoleVisualSystem('high');
  private readonly impactCameraRig = new CameraRig();
  private readonly solarPointLight = new PointLight(0xfff2d1, 18, 0, 2);
  private readonly ambientLight = new AmbientLight(0x8396a8, 0.18);
  private readonly markers = new Map<string, MarkerResources>();
  private readonly paths = new Map<string, PathResources>();
  private readonly cameraBodies = new Map<string, CameraBodyTarget>();
  private readonly clipSpheres: ClipSphere[] = [];
  private readonly visibleBodyIds = new Set<string>();
  private readonly visiblePathIds = new Set<string>();
  private readonly currentOriginM = { ...HELIOCENTRIC_ORIGIN };
  private readonly mappedHeliocentricCenter = new Vector3();
  private readonly scratchMapped = new Vector3();
  private readonly scratchProjected = new Vector3();
  private readonly visualFeatureRotation = new Quaternion();
  private readonly impactCameraPosition = new Vector3();
  private readonly impactCameraTarget = new Vector3();
  private readonly impactCameraUp = new Vector3();
  private readonly impactBodyToVisualLocal = new Quaternion()
    .setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
  private readonly impactCameraWorldOrientation = new Quaternion();
  private readonly blackHoleProjectedPosition = new Vector3();
  private readonly blackHoleCameraPosition = new Vector3();
  private readonly blackHoleCameraTrackedCenter = new Vector3();
  private readonly blackHoleCameraTranslation = new Vector3();
  private readonly blackHoleMappedPosition = new Vector3();
  private readonly blackHolePositionTuple: [number, number, number] = [0, 0, 0];
  private readonly blackHoleClipSphere: MutableClipSphere = {
    center: this.blackHoleVisualSystem.root.position,
    radius: 0,
  };
  private readonly blackHolePhysicalPosition = { x: 0, y: 0, z: 0 };
  private readonly blackHoleMappedBodies: MutableBlackHoleMappedBodyRenderState[] = [];
  private readonly blackHoleMappedBodiesById =
    new Map<string, MutableBlackHoleMappedBodyRenderState>();
  private readonly blackHoleIncludedBodyIds = new Set<string>();
  private readonly orderedMarkerIds: string[] = [];
  private readonly occupiedLabelPositions: number[] = [];
  private readonly adaptiveResolution = new AdaptiveResolutionController('high');
  private readonly mutableCameraFrame = {
    realDeltaSeconds: 0,
    originM: HELIOCENTRIC_ORIGIN,
    originRevision: 0,
    metersPerRenderUnit: 1,
    bodies: this.cameraBodies as ReadonlyMap<string, CameraBodyTarget>,
    overviewRadiusRenderUnits: 32,
    reducedMotion: false,
  };
  private readonly mutableBlackHoleLensingFrame: MutableBlackHoleLensingFrame = {
    active: false,
    centerNdc: [0, 0],
    eventHorizonRadiusNdc: 0,
    viewportAspect: 1,
    redshiftStrength: 0,
  };
  private readonly mutableSolarFateScaleContext: MutableSolarFateScaleContext = {
    metersPerRenderUnit: 1,
    baseSunRadiusRenderUnits: 1,
  };
  private readonly labelContainer: HTMLElement | null;
  private readonly selectionIndicator: HTMLSpanElement | null;
  private lastFrame: DebugRenderFrame | null = null;
  private selectedBodyId = 'earth';
  private orbitLinesVisible = true;
  private bodyLabelsVisible = true;
  private freeOrbitNeedsInitialization = false;
  private auxiliaryFocusRadiusRenderUnits: number | null = null;
  private reducedMotion: boolean;
  private reduceFlashes = true;
  private viewportWidth = 1;
  private viewportHeight = 1;
  private overviewRadiusRenderUnits = 32;
  private visible = true;
  private contextAvailable = true;
  private contextReleased = false;
  private disposed = false;
  private smoothedFps: number | null = null;
  private visualQuality: VisualQuality = 'high';
  private requestedPixelRatio = 1;
  private diagnosticsElapsedSeconds = Number.POSITIVE_INFINITY;
  private exposurePreset: SolarExposurePreset = 'balanced';
  private cometFrameStates: readonly Readonly<CometFrameState>[] = Object.freeze([]);
  private cometsVisible = true;
  private impactRenderState: Readonly<ImpactRenderState> | null = null;
  private solarEvolutionRenderState: Readonly<SolarEvolutionRenderState> | null = null;
  private fictionalSupernovaRenderState:
    | Readonly<FictionalSupernovaRenderState>
    | null = null;
  private blackHoleRenderState: Readonly<BlackHoleRenderState> | null = null;
  private blackHoleFrameFinite = true;
  private blackHoleCameraFraming = false;
  private blackHoleSuppressedBodyCount = 0;
  private impactCameraPresetId: ImpactCameraPresetId | null = null;
  private impactCameraOverrideInitialized = false;
  private impactVisibilityMode: ImpactVisibilityMode = 'physical';
  private scenarioExposureCeiling: number | null = null;

  public constructor(
    canvas: HTMLCanvasElement,
    options: DebugSolarSystemRendererOptions = {},
  ) {
    const context = canvas.getContext('webgl2', CONTEXT_ATTRIBUTES);
    if (context === null) {
      throw new Error('A WebGL 2 rendering context could not be created.');
    }

    this.canvas = canvas;
    this.reducedMotion = options.reducedMotion ?? false;
    if (options.scaleModel === undefined) {
      const transition = new RenderScaleTransition(
        new TrueRenderScale(),
        new PresentationRenderScale(),
        { initialMode: options.initialScaleMode ?? 'presentation' },
      );
      this.scaleModel = transition;
      this.scaleTransition = transition;
    } else {
      this.scaleModel = options.scaleModel;
      this.scaleTransition =
        options.scaleModel instanceof RenderScaleTransition ? options.scaleModel : null;
    }

    this.renderer = new WebGLRenderer({
      canvas,
      context,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.postProcessing = new SolarPostProcessing(this.renderer, {
      initialQuality: 'high',
      initialExposure: 1,
    });
    this.bodyVisualSystem = new PhaseFourBodyVisualSystem(this.sphereGeometry, {
      maximumAnisotropy: this.renderer.capabilities.getMaxAnisotropy(),
      initialQuality: 'high',
      initialVenusSurfaceMode: 'clouds',
    });
    this.earthTideDebugOverlay =
      options.earthTideDebugMode === undefined || options.earthTideDebugMode === 'off'
        ? null
        : new EarthTideDebugOverlay();
    this.cometVisualSystem = new CometVisualSystem(COMET_VISUAL_PROFILES, 'high');
    this.celestialBackground = new CelestialBackground({
      stars: PHASE_SIX_BRIGHT_STARS,
      ...PHASE_SIX_SKY_TEXTURES,
      initialQuality: 'high',
      maximumTextureSize: this.renderer.capabilities.maxTextureSize,
      maximumAnisotropy: this.renderer.capabilities.getMaxAnisotropy(),
    });
    this.statisticalBelts = new StatisticalBeltRenderer(undefined, 'high');
    this.solarPointLight.name = 'comet-sunlight';
    this.ambientLight.name = 'comet-ambient-fill';

    this.scene.background = new Color(0x02050b);
    this.scene.add(this.celestialBackground.root);
    this.scene.add(this.statisticalBelts.root);
    this.scene.add(this.blackHoleVisualSystem.root);
    this.scene.add(this.pathLayer);
    this.scene.add(this.markerLayer);
    this.scene.add(this.naturalSatelliteVisualSystem.root);
    this.scene.add(this.spaceObjectVisualSystem.root);
    this.scene.add(this.solarPointLight);
    this.scene.add(this.ambientLight);

    const grid = new GridHelper(80, 40, 0x214563, 0x102338);
    grid.material.transparent = true;
    grid.material.opacity = 0.18;
    this.scene.add(grid);

    this.camera.position.set(0, 32, 62);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = !this.reducedMotion;
    this.controls.dampingFactor = 0.075;
    this.controls.enablePan = true;
    this.controls.minDistance = 1e-5;
    this.controls.maxDistance = 240;
    this.controls.target.set(0, 0, 0);
    this.controls.enabled = false;
    this.controls.update();

    this.cameraController.setMode('overview');
    this.cameraController.setTargetBody(this.selectedBodyId);

    this.labelContainer = options.labelContainer ?? null;
    this.naturalSatelliteVisualSystem.setLabelContainer(this.labelContainer);
    this.spaceObjectVisualSystem.setLabelContainer(this.labelContainer);
    this.selectionIndicator = this.createSelectionIndicator();
    this.updateExposurePreset(true);
    this.updateCanvasDiagnostics(false);
  }

  public renderFrame(context: RenderContext): void {
    this.assertNotDisposed();
    const deltaSeconds = Math.min(Math.max(context.realDeltaSeconds, 0), 0.1);
    if (this.scaleTransition !== null && !this.reducedMotion) {
      this.scaleTransition.advance(deltaSeconds);
    }
    this.applyFrame(context.frame);

    if (!this.visible || !this.contextAvailable) return;

    this.updateCamera(context.frame, deltaSeconds);
    this.updateBlackHoleLensing();
    this.celestialBackground.updateCameraPosition(this.camera.position);
    this.updateScreenSpaceLabels();
    const labelsSuppressed = this.cameraController.status.closeUpPresetId !== null
      || this.impactPlaybackActive();
    this.naturalSatelliteVisualSystem.updateLabels(
      this.camera,
      this.viewportWidth,
      this.viewportHeight,
      labelsSuppressed,
    );
    this.spaceObjectVisualSystem.updateLabels(
      this.camera,
      this.viewportWidth,
      this.viewportHeight,
      labelsSuppressed,
    );
    this.updateExposurePreset();
    this.updateScenarioExposureProtection();
    const resolutionChanged = this.adaptiveResolution.sampleFrame(
      deltaSeconds,
      this.activeHeavyRenderEffect(),
    );
    if (resolutionChanged) {
      this.postProcessing.setResolutionScale(this.adaptiveResolution.scale);
    }
    this.postProcessing.setExposure(
      this.exposureAdaptation.advance(deltaSeconds, this.reduceFlashes),
    );
    this.postProcessing.render(this.scene, this.camera, deltaSeconds);
    this.updateFps(deltaSeconds);
    this.diagnosticsElapsedSeconds += deltaSeconds;
    this.updateCanvasDiagnostics(false);
  }

  public applyFrame(frame: DebugRenderFrame): void {
    this.assertNotDisposed();
    this.applyOrigin(frame.originM);
    this.lastFrame = frame;
    this.visibleBodyIds.clear();
    this.clipSpheres.length = 0;
    this.cameraBodies.clear();
    this.scaleModel.mapPosition(
      this.mappedHeliocentricCenter,
      HELIOCENTRIC_ORIGIN,
      this.currentOriginM,
    );
    let maximumHeliocentricDistance = SYSTEM_RADIUS_FLOOR;

    for (const body of frame.bodies) {
      const marker = this.getOrCreateMarker(body);
      marker.bodyState = body;
      marker.root.visible = body.visible;
      marker.cameraTarget.positionM = body.positionM;
      marker.cameraTarget.velocityMps = body.velocityMps;
      marker.cameraTarget.radiusM = body.meanRadiusM;
      marker.cameraTarget.radiusRenderUnits = this.scaleModel.radiusFor(body);
      const layerVisible = body.kind !== 'comet' || this.cometsVisible;
      marker.cameraTarget.visible = body.visible && layerVisible;
      marker.root.visible = body.visible && layerVisible;
      if (marker.isComet) {
        marker.root.scale.setScalar(1);
        marker.clipSphere.radius = marker.cameraTarget.radiusRenderUnits * 2.5;
      } else {
        marker.root.scale.setScalar(marker.cameraTarget.radiusRenderUnits);
        marker.clipSphere.radius =
          marker.cameraTarget.radiusRenderUnits *
          (marker.visual as PhaseFourBodyVisual).boundingRadiusMultiplier;
      }
      this.cameraBodies.set(body.bodyId, marker.cameraTarget);

      if (!body.visible || !layerVisible) {
        if (marker.label !== null) marker.label.style.opacity = '0';
        continue;
      }

      this.visibleBodyIds.add(body.bodyId);
      this.scaleModel.mapPosition(marker.root.position, body.positionM, this.currentOriginM);
      this.scaleModel.mapPosition(this.scratchMapped, body.positionM, HELIOCENTRIC_ORIGIN);
      if (body.kind !== 'comet' || body.bodyId === this.selectedBodyId) {
        maximumHeliocentricDistance = Math.max(
          maximumHeliocentricDistance,
          this.scratchMapped.length() + marker.clipSphere.radius,
        );
      }
      this.clipSpheres.push(marker.clipSphere);
    }

    for (const [bodyId, marker] of this.markers) {
      if (!this.visibleBodyIds.has(bodyId)) marker.root.visible = false;
    }

    this.overviewRadiusRenderUnits = maximumHeliocentricDistance * 1.08;
    this.bodyVisualSystem.updateFrame(frame);
    this.naturalSatelliteVisualSystem.updateFrame(
      frame,
      this.scaleModel,
      this.currentOriginM,
      this.selectedBodyId,
    );
    this.spaceObjectVisualSystem.updateFrame(frame, this.scaleModel, this.currentOriginM);
    if (this.impactRenderState !== null) {
      this.impactVisualSystem.update(this.impactRenderState);
    }
    const impactTargetMarker = this.impactRenderState === null
      ? undefined
      : this.markers.get(this.impactRenderState.targetBodyId);
    if (impactTargetMarker !== undefined && !impactTargetMarker.isComet) {
      impactTargetMarker.clipSphere.radius = Math.max(
        impactTargetMarker.clipSphere.radius,
        impactTargetMarker.cameraTarget.radiusRenderUnits *
          this.impactVisualSystem.getDiagnostics().boundingRadiusMultiplier,
      );
    }
    const earthMarker = this.markers.get('earth');
    if (earthMarker !== undefined && !earthMarker.isComet) {
      earthMarker.clipSphere.radius = Math.max(
        earthMarker.clipSphere.radius,
        earthMarker.cameraTarget.radiusRenderUnits *
          (this.earthTideDebugOverlay?.getDiagnostics().boundingRadiusMultiplier ?? 1),
      );
    }
    this.updateSolarFateVisuals();
    maximumHeliocentricDistance = this.extendSunScenarioBounds(
      maximumHeliocentricDistance,
    );
    this.cometVisualSystem.updateFrame(
      frame,
      this.cometFrameStates,
      this.scaleModel.metersPerRenderUnit,
      (body) => this.scaleModel.radiusFor(body),
    );
    for (const marker of this.markers.values()) {
      if (!marker.isComet) continue;
      const cometVisual = marker.visual as CometVisual;
      if (!this.cometsVisible) cometVisual.root.visible = false;
      marker.cameraTarget.radiusRenderUnits = Math.max(
        this.scaleModel.radiusFor(marker.bodyState),
        cometVisual.focusRadiusRenderUnits,
      );
      marker.clipSphere.radius = marker.cameraTarget.radiusRenderUnits * 1.25;
    }
    // Apply scenario-local body authority after ordinary body/comet systems so
    // no ephemeris presentation pass can overwrite capture/fade state.
    maximumHeliocentricDistance = this.updateBlackHoleVisuals(
      maximumHeliocentricDistance,
    );
    this.overviewRadiusRenderUnits = maximumHeliocentricDistance * 1.08;
    const activeSun = this.blackHoleRenderState === null
      ? null
      : this.markers.get('sun');
    this.solarPointLight.position.copy(
      activeSun?.root.position ?? this.mappedHeliocentricCenter,
    );
    this.statisticalBelts.setMetersPerRenderUnit(this.scaleModel.metersPerRenderUnit);
    this.statisticalBelts.setSunRenderPosition(
      this.mappedHeliocentricCenter.x,
      this.mappedHeliocentricCenter.y,
      this.mappedHeliocentricCenter.z,
    );
    this.updateCameraTargetOrientations(frame.currentJdTdb);
    this.updatePaths(frame.trails, frame.bodies);
  }

  public resize(widthCssPixels: number, heightCssPixels: number, devicePixelRatio: number): void {
    this.assertNotDisposed();
    const width = Math.max(1, Math.round(widthCssPixels));
    const height = Math.max(1, Math.round(heightCssPixels));
    const pixelRatio = Math.min(
      Math.max(Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1, 1),
      MAX_DEVICE_PIXEL_RATIO,
    );

    this.viewportWidth = width;
    this.viewportHeight = height;
    this.requestedPixelRatio = pixelRatio;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.postProcessing.resize(width, height, pixelRatio);
    this.camera.aspect = width / height;
    this.camera.fov = verticalFovForViewport(width, height);
    this.camera.updateProjectionMatrix();
  }

  public setSelectedBody(bodyId: string): void {
    this.assertNotDisposed();
    if (bodyId.trim().length === 0) throw new RangeError('Selected body ID cannot be empty.');
    this.selectedBodyId = bodyId;
    this.spaceObjectVisualSystem.setDetailedInspectionObject(null);
    this.auxiliaryFocusRadiusRenderUnits = null;
    this.blackHoleCameraFraming = false;
    if (this.markers.get(bodyId)?.isComet !== true) this.bodyVisualSystem.ensureAssets(bodyId);
    this.cameraController.setTargetBody(bodyId);
    if (this.cameraController.mode === 'free-orbit') {
      this.freeOrbitNeedsInitialization = true;
    }
    this.updateExposurePreset();
  }

  public focusBody(bodyId: string, mode: CameraMode = 'body-follow'): boolean {
    this.assertNotDisposed();
    const body = this.lastFrame?.bodies.find((candidate) => candidate.bodyId === bodyId);
    if (body === undefined || !body.visible) return false;

    this.selectedBodyId = bodyId;
    this.spaceObjectVisualSystem.setDetailedInspectionObject(null);
    this.auxiliaryFocusRadiusRenderUnits = null;
    this.blackHoleCameraFraming = false;
    if (body.kind !== 'comet') this.bodyVisualSystem.ensureAssets(bodyId);
    this.cameraController.focusBody(bodyId, mode);
    this.controls.enabled = mode === 'free-orbit';
    this.freeOrbitNeedsInitialization = mode === 'free-orbit';
    this.updateExposurePreset();
    return true;
  }

  public setCameraMode(mode: CameraMode): void {
    this.assertNotDisposed();
    if (mode === 'earth-moon-system') {
      this.selectedBodyId = 'earth';
      this.bodyVisualSystem.ensureAssets('earth');
      this.bodyVisualSystem.ensureAssets('moon');
    }
    this.cameraController.setTargetBody(this.selectedBodyId);
    this.auxiliaryFocusRadiusRenderUnits = null;
    this.blackHoleCameraFraming = false;
    this.cameraController.setMode(mode);
    this.controls.enabled = mode === 'free-orbit';
    this.freeOrbitNeedsInitialization = mode === 'free-orbit';
    this.updateExposurePreset();
  }

  public interruptCameraToFreeOrbit(): void {
    this.assertNotDisposed();
    this.cameraController.interruptToFreeOrbit();
    this.auxiliaryFocusRadiusRenderUnits = null;
    this.blackHoleCameraFraming = false;
    this.cameraController.rig.applyTo(this.camera, this.controls.target);
    this.controls.enabled = true;
    this.controls.update();
    this.cameraController.synchronizeFreeOrbitPose(
      this.camera.position,
      this.controls.target,
      this.camera.up,
    );
    this.freeOrbitNeedsInitialization = false;
    this.updateExposurePreset();
  }

  public applyCloseUpPreset(presetId: CameraCloseUpPresetId): boolean {
    this.assertNotDisposed();
    const preset = getCameraCloseUpPreset(presetId);
    const body = this.lastFrame?.bodies.find((candidate) => candidate.bodyId === preset.bodyId);
    if (body === undefined || !body.visible) return false;
    this.selectedBodyId = preset.bodyId;
    this.auxiliaryFocusRadiusRenderUnits = null;
    this.blackHoleCameraFraming = false;
    this.bodyVisualSystem.ensureAssets(preset.bodyId);
    this.cameraController.applyCloseUpPreset(presetId);
    this.controls.enabled = false;
    this.freeOrbitNeedsInitialization = false;
    this.updateExposurePreset();
    return true;
  }

  public getActiveCloseUpPresetId(): CameraCloseUpPresetId | null {
    return this.cameraController.status.closeUpPresetId;
  }

  public getCameraMode(): CameraMode {
    return this.cameraController.mode;
  }

  public setScaleMode(mode: RenderScaleMode, immediate = false): void {
    this.assertNotDisposed();
    if (this.scaleTransition === null) {
      if (this.scaleModel.mode !== mode) {
        throw new Error('This renderer was constructed with a fixed render-scale model.');
      }
      return;
    }
    this.scaleTransition.setMode(mode, immediate || this.reducedMotion);
  }

  public setOrbitLinesVisible(visible: boolean): void {
    this.orbitLinesVisible = visible;
    this.pathLayer.visible = visible
      && !this.impactPlaybackActive()
      && !this.blackHoleVisualSystem.getDiagnostics().active;
  }

  public setBodyLabelsVisible(visible: boolean): void {
    this.bodyLabelsVisible = visible;
    if (!visible) {
      for (const marker of this.markers.values()) {
        if (marker.label !== null) marker.label.style.opacity = '0';
      }
    }
  }

  public setCometFrameStates(states: readonly Readonly<CometFrameState>[]): void {
    this.assertNotDisposed();
    this.cometFrameStates = states;
  }

  public setEarthTideDebugSample(
    sample: Readonly<EarthTideDebugRenderSample> | null,
  ): void {
    this.assertNotDisposed();
    if (this.earthTideDebugOverlay === null) return;
    if (sample === null) this.earthTideDebugOverlay.clear();
    else this.earthTideDebugOverlay.update(sample);
    this.updateCanvasDiagnostics(false);
  }

  public setImpactRenderState(state: Readonly<ImpactRenderState> | null): void {
    this.assertNotDisposed();
    if (state === null) {
      this.resetImpactVisuals();
      return;
    }
    if (this.blackHoleRenderState !== null) {
      throw new Error(
        'Impact Lab and Black-Hole Encounter render states are mutually exclusive.',
      );
    }
    const target = this.markers.get(state.targetBodyId);
    if (target === undefined || target.isComet) {
      throw new Error(
        `Impact target "${state.targetBodyId}" is not an available observatory body.`,
      );
    }
    this.impactVisualSystem.attachToTarget(target.root);
    this.impactVisualSystem.update(state);
    this.impactRenderState = state;
    this.pathLayer.visible = this.orbitLinesVisible && !this.impactPlaybackActive();
    this.synchronizeAdaptiveResolutionEffect();
    this.updateScenarioExposureProtection();
    this.updateCanvasDiagnostics();
  }

  public setImpactCameraPreset(presetId: ImpactCameraPresetId | null): boolean {
    this.assertNotDisposed();
    if (presetId === null) {
      this.impactCameraPresetId = null;
      this.impactCameraOverrideInitialized = false;
      this.impactVisualSystem.setCameraPreset(null);
      if (this.impactRenderState !== null) this.impactVisualSystem.update(this.impactRenderState);
      this.updateCanvasDiagnostics();
      return true;
    }
    if (
      this.impactRenderState === null ||
      this.markers.get(this.impactRenderState.targetBodyId)?.isComet !== false
    ) {
      return false;
    }
    // Resolve once here so an invalid basis is rejected at the API boundary,
    // rather than from inside the animation frame.
    resolveImpactCameraPose(presetId, this.impactRenderState);
    this.impactCameraPresetId = presetId;
    this.impactCameraOverrideInitialized = false;
    this.impactVisualSystem.setCameraPreset(presetId);
    this.impactVisualSystem.update(this.impactRenderState);
    this.updateCanvasDiagnostics();
    return true;
  }

  public setImpactVisibilityMode(mode: ImpactVisibilityMode): void {
    this.assertNotDisposed();
    this.impactVisibilityMode = mode;
    this.impactVisualSystem.setVisibilityMode(mode);
    if (this.impactRenderState !== null) {
      this.impactVisualSystem.update(this.impactRenderState);
      this.impactCameraOverrideInitialized = false;
    }
    this.updateCanvasDiagnostics();
  }

  public captureCameraState(): Readonly<RendererCameraSnapshot> {
    this.assertNotDisposed();
    return Object.freeze({
      selectedBodyId: this.selectedBodyId,
      mode: this.cameraController.mode,
      closeUpPresetId: this.cameraController.status.closeUpPresetId,
      position: Object.freeze([
        this.camera.position.x,
        this.camera.position.y,
        this.camera.position.z,
      ] as const),
      target: Object.freeze([
        this.controls.target.x,
        this.controls.target.y,
        this.controls.target.z,
      ] as const),
      up: Object.freeze([
        this.camera.up.x,
        this.camera.up.y,
        this.camera.up.z,
      ] as const),
    });
  }

  public restoreCameraState(snapshot: Readonly<RendererCameraSnapshot>): void {
    this.assertNotDisposed();
    validateCameraSnapshot(snapshot);
    this.impactCameraPresetId = null;
    this.impactCameraOverrideInitialized = false;
    this.impactVisualSystem.setCameraPreset(null);
    this.blackHoleCameraFraming = false;
    this.selectedBodyId = snapshot.selectedBodyId;
    if (this.markers.get(snapshot.selectedBodyId)?.isComet !== true) {
      this.bodyVisualSystem.ensureAssets(snapshot.selectedBodyId);
    }
    if (snapshot.closeUpPresetId !== null) {
      this.cameraController.applyCloseUpPreset(snapshot.closeUpPresetId);
    } else {
      this.cameraController.setTargetBody(snapshot.selectedBodyId);
      this.cameraController.setMode(snapshot.mode);
    }
    this.camera.position.fromArray(snapshot.position);
    this.controls.target.fromArray(snapshot.target);
    this.camera.up.fromArray(snapshot.up).normalize();
    this.camera.lookAt(this.controls.target);
    this.cameraController.rig.synchronizePose(
      this.camera.position,
      this.controls.target,
      this.camera.up,
    );
    this.controls.enabled = snapshot.mode === 'free-orbit';
    if (this.controls.enabled) this.controls.update();
    this.freeOrbitNeedsInitialization = false;
    this.updateExposurePreset();
    this.updateCanvasDiagnostics();
  }

  public resetImpactVisuals(): void {
    if (this.disposed) return;
    this.impactRenderState = null;
    this.impactCameraPresetId = null;
    this.impactCameraOverrideInitialized = false;
    this.impactVisualSystem.reset();
    this.pathLayer.visible = this.orbitLinesVisible
      && !this.blackHoleVisualSystem.getDiagnostics().active;
    const defaultFov = verticalFovForViewport(this.viewportWidth, this.viewportHeight);
    if (Math.abs(this.camera.fov - defaultFov) > 1e-6) {
      this.camera.fov = defaultFov;
      this.camera.updateProjectionMatrix();
    }
    this.synchronizeAdaptiveResolutionEffect();
    this.updateScenarioExposureProtection();
    this.updateCanvasDiagnostics();
  }

  public getImpactDiagnostics(): Readonly<ImpactVisualDiagnostics> {
    return this.impactVisualSystem.getDiagnostics();
  }

  public captureExposureState(): Readonly<RendererExposureSnapshot> {
    this.assertNotDisposed();
    return this.exposureAdaptation.captureState();
  }

  public restoreExposureState(
    snapshot: Readonly<RendererExposureSnapshot>,
  ): void {
    this.assertNotDisposed();
    this.exposureAdaptation.restoreState(snapshot);
    this.exposurePreset = snapshot.preset;
    this.scenarioExposureCeiling = snapshot.protectiveCeiling;
    this.updateScenarioExposureProtection(true);
    this.postProcessing.setExposure(this.exposureAdaptation.state.exposure);
    this.updateCanvasDiagnostics();
  }

  public setSolarEvolutionRenderState(
    state: Readonly<SolarEvolutionRenderState> | null,
  ): void {
    this.assertNotDisposed();
    if (state === null) {
      this.solarEvolutionRenderState = null;
      this.solarEvolutionVisualSystem.reset();
      this.synchronizeAdaptiveResolutionEffect();
      this.updateSolarFateVisuals();
      this.extendSunScenarioBounds(0);
      this.updateScenarioExposureProtection();
      this.updateCanvasDiagnostics();
      return;
    }
    if (this.blackHoleRenderState !== null) {
      throw new Error(
        'Solar Fate and Black-Hole Encounter render states are mutually exclusive.',
      );
    }
    if (this.fictionalSupernovaRenderState !== null) {
      throw new Error(
        'Scientific solar evolution and fictional supernova render states are mutually exclusive.',
      );
    }
    const context = this.getSolarFateScaleContext();
    if (context !== null) this.solarEvolutionVisualSystem.update(state, context);
    this.solarEvolutionRenderState = state;
    this.synchronizeAdaptiveResolutionEffect();
    this.extendSunScenarioBounds(0);
    this.updateCanvasDiagnostics();
  }

  public setFictionalSupernovaRenderState(
    state: Readonly<FictionalSupernovaRenderState> | null,
  ): void {
    this.assertNotDisposed();
    if (state === null) {
      this.fictionalSupernovaRenderState = null;
      this.fictionalSupernovaVisualSystem.reset();
      this.synchronizeAdaptiveResolutionEffect();
      this.updateSolarFateVisuals();
      this.extendSunScenarioBounds(0);
      this.updateScenarioExposureProtection();
      this.updateCanvasDiagnostics();
      return;
    }
    if (this.blackHoleRenderState !== null) {
      throw new Error(
        'Solar Fate and Black-Hole Encounter render states are mutually exclusive.',
      );
    }
    if (this.solarEvolutionRenderState !== null) {
      throw new Error(
        'Scientific solar evolution and fictional supernova render states are mutually exclusive.',
      );
    }
    const context = this.getSolarFateScaleContext();
    if (context !== null) this.fictionalSupernovaVisualSystem.update(state, context);
    this.fictionalSupernovaRenderState = state;
    this.synchronizeAdaptiveResolutionEffect();
    this.extendSunScenarioBounds(0);
    this.updateScenarioExposureProtection();
    this.updateCanvasDiagnostics();
  }

  public resetSolarFateVisuals(): void {
    if (this.disposed) return;
    this.solarEvolutionRenderState = null;
    this.fictionalSupernovaRenderState = null;
    this.solarEvolutionVisualSystem.reset();
    this.fictionalSupernovaVisualSystem.reset();
    this.synchronizeAdaptiveResolutionEffect();
    this.restoreSunScenarioBounds();
    this.updateScenarioExposureProtection();
    this.updateCanvasDiagnostics();
  }

  public getSolarFateDiagnostics(): Readonly<SolarFateDiagnostics> {
    const evolution = this.solarEvolutionVisualSystem.getDiagnostics();
    const supernova = this.fictionalSupernovaVisualSystem.getDiagnostics();
    return Object.freeze({
      mode: this.solarEvolutionRenderState !== null
        ? 'scientific-solar-evolution'
        : this.fictionalSupernovaRenderState !== null
          ? 'fictional-supernova'
          : 'none',
      evolution,
      supernova,
    });
  }

  public setBlackHoleRenderState(
    state: Readonly<BlackHoleRenderState> | null,
  ): void {
    this.assertNotDisposed();
    if (state === null) {
      this.resetBlackHoleVisuals();
      return;
    }
    if (
      this.impactRenderState !== null ||
      this.solarEvolutionRenderState !== null ||
      this.fictionalSupernovaRenderState !== null
    ) {
      throw new Error(
        'Black-Hole Encounter cannot render while another catastrophe is active.',
      );
    }
    validateBlackHoleRenderState(state);
    this.blackHoleRenderState = state;
    this.synchronizeAdaptiveResolutionEffect();
    this.blackHoleFrameFinite = true;
    if (this.lastFrame !== null) {
      this.updateBlackHoleVisuals(this.overviewRadiusRenderUnits / 1.08);
    }
    // Scenario state is published before the runtime's ordinary render pass.
    // Move the framed camera with the newly mapped encounter immediately so
    // lensing and diagnostics never observe the previous black-hole center.
    this.applyBlackHoleCameraTracking();
    this.updateBlackHoleLensing();
    this.updateScenarioExposureProtection();
    this.updateCanvasDiagnostics();
  }

  public resetBlackHoleVisuals(): void {
    if (this.disposed) return;
    this.blackHoleRenderState = null;
    this.blackHoleFrameFinite = true;
    this.blackHoleCameraFraming = false;
    this.blackHoleMappedBodies.length = 0;
    this.blackHoleMappedBodiesById.clear();
    this.blackHoleVisualSystem.reset();
    this.postProcessing.setBlackHoleLensing(null);
    this.synchronizeAdaptiveResolutionEffect();
    if (this.lastFrame !== null) this.applyFrame(this.lastFrame);
    this.updateScenarioExposureProtection();
    this.updateCanvasDiagnostics();
  }

  public getBlackHoleDiagnostics(): Readonly<BlackHoleVisualDiagnostics> {
    const visual = this.blackHoleVisualSystem.getDiagnostics();
    const lensing = this.postProcessing.getBlackHoleLensingDiagnostics();
    return Object.freeze({
      ...visual,
      finite: visual.finite && lensing.finite && this.blackHoleFrameFinite,
      lensing,
    });
  }

  /** Places a free-orbit camera at a presentation-only black-hole close-up. */
  public frameBlackHole(): boolean {
    this.assertNotDisposed();
    const diagnostics = this.getBlackHoleDiagnostics();
    if (!diagnostics.active || !diagnostics.finite) return false;
    const radius = Math.max(diagnostics.visualRadiusRenderUnits, 1e-5);
    const center = this.blackHoleVisualSystem.root.position;
    this.cameraController.interruptToFreeOrbit();
    this.cameraController.setTargetBody(null);
    this.blackHoleCameraFraming = true;
    this.blackHoleCameraTrackedCenter.copy(center);
    this.camera.position.set(
      center.x + radius * 5.8,
      center.y + radius * 3.2,
      center.z + radius * 10.5,
    );
    this.controls.target.copy(center);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(center);
    this.cameraController.synchronizeFreeOrbitPose(
      this.camera.position,
      this.controls.target,
      this.camera.up,
    );
    this.controls.enabled = true;
    this.controls.update();
    this.freeOrbitNeedsInitialization = false;
    this.updateBlackHoleLensing();
    this.updateCanvasDiagnostics();
    return true;
  }

  public setSkyBackgroundVisible(visible: boolean): void {
    this.celestialBackground.setVisible(visible);
  }

  public setBrightStarsVisible(visible: boolean): void {
    this.celestialBackground.setBrightStarsVisible(visible);
  }

  public setCometsVisible(visible: boolean): void {
    this.cometsVisible = visible;
    for (const marker of this.markers.values()) {
      if (marker.isComet) marker.root.visible = visible && marker.bodyState.visible;
    }
  }

  public setNaturalSatellitesVisible(visible: boolean): void {
    this.naturalSatelliteVisualSystem.setVisible(visible);
    this.updateCanvasDiagnostics();
  }

  public setMajorMoonsVisible(visible: boolean): void {
    this.naturalSatelliteVisualSystem.setMajorVisible(visible);
    this.updateCanvasDiagnostics();
  }

  public setMinorMoonsVisible(visible: boolean): void {
    this.naturalSatelliteVisualSystem.setMinorVisible(visible);
    this.updateCanvasDiagnostics();
  }

  public setMoonOrbitsVisible(visible: boolean): void {
    this.naturalSatelliteVisualSystem.setOrbitsVisible(visible);
    this.updateCanvasDiagnostics();
  }

  public setMoonLabelsVisible(visible: boolean): void {
    this.naturalSatelliteVisualSystem.setLabelsVisible(visible);
    this.updateCanvasDiagnostics();
  }

  public selectNaturalSatellite(id: string | null): void {
    this.naturalSatelliteVisualSystem.selectSatellite(id);
    this.updateCanvasDiagnostics();
  }

  public focusNaturalSatellite(id: string): boolean {
    this.spaceObjectVisualSystem.setDetailedInspectionObject(null);
    this.naturalSatelliteVisualSystem.selectSatellite(id);
    const position = this.naturalSatelliteVisualSystem.getSatelliteWorldPosition(id);
    if (position === null) return false;
    const radius = this.naturalSatelliteVisualSystem.getSatelliteRenderRadius(id) ?? 0.0005;
    this.auxiliaryFocusRadiusRenderUnits = radius;
    const distance = Math.max(radius * 8.5, 0.003);
    this.clippingController.reset();
    this.cameraController.interruptToFreeOrbit();
    this.cameraController.setTargetBody(null);
    this.camera.position.set(position.x + distance * 0.72, position.y + distance * 0.4, position.z + distance);
    this.controls.target.copy(position);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(position);
    this.cameraController.synchronizeFreeOrbitPose(this.camera.position, this.controls.target, this.camera.up);
    this.controls.enabled = true;
    this.controls.minDistance = Math.max(radius * 1.2, 1e-6);
    this.controls.update();
    this.updateCanvasDiagnostics();
    return true;
  }

  public getNaturalSatelliteDiagnostics(): Readonly<NaturalSatelliteVisualDiagnostics> {
    return this.naturalSatelliteVisualSystem.getDiagnostics();
  }

  public setSpaceObjectsVisible(visible: boolean): void {
    this.spaceObjectVisualSystem.setVisible(visible);
    this.updateCanvasDiagnostics();
  }

  public setEarthSatellitesVisible(visible: boolean): void {
    this.spaceObjectVisualSystem.setEarthSatellitesVisible(visible);
    this.updateCanvasDiagnostics();
  }

  public setSpacecraftVisible(visible: boolean): void {
    this.spaceObjectVisualSystem.setSpacecraftVisible(visible);
    this.updateCanvasDiagnostics();
  }

  public selectSpaceObject(id: string | null): void {
    this.spaceObjectVisualSystem.selectObject(id);
    this.updateCanvasDiagnostics();
  }

  public focusSpaceObject(id: string): boolean {
    this.spaceObjectVisualSystem.selectObject(id);
    const position = this.spaceObjectVisualSystem.getObjectWorldPosition(id);
    if (position === null) return false;
    const renderRadius = this.spaceObjectVisualSystem.getObjectRenderRadius(id);
    this.spaceObjectVisualSystem.setDetailedInspectionObject(id);
    this.auxiliaryFocusRadiusRenderUnits = renderRadius;
    const focusDirection = this.spaceObjectVisualSystem.getObjectFocusDirection(id);
    const distance = focusDirection === null
      ? Math.max(renderRadius * 1.8, 0.00045)
      : Math.max(renderRadius * 3.5, 1e-12);
    this.clippingController.reset();
    this.cameraController.interruptToFreeOrbit();
    this.cameraController.setTargetBody(null);
    if (focusDirection === null) {
      this.camera.position.set(
        position.x + distance * 0.72,
        position.y + distance * 0.4,
        position.z + distance,
      );
    } else {
      this.camera.position.copy(position).addScaledVector(focusDirection, distance);
    }
    this.controls.target.copy(position);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(position);
    this.cameraController.synchronizeFreeOrbitPose(this.camera.position, this.controls.target, this.camera.up);
    this.controls.enabled = true;
    this.controls.minDistance = focusDirection === null
      ? Math.max(renderRadius * 1.2, 1e-6)
      : Math.max(renderRadius * 1.2, 1e-12);
    this.controls.update();
    this.updateCanvasDiagnostics();
    return true;
  }

  public getSpaceObjectDiagnostics(): Readonly<SpaceObjectVisualDiagnostics> {
    return this.spaceObjectVisualSystem.getDiagnostics();
  }

  public setStatisticalBeltVisible(id: StatisticalBeltId, visible: boolean): void {
    this.statisticalBelts.setVisible(id, visible);
  }

  public setVisualQuality(quality: VisualQuality): void {
    this.assertNotDisposed();
    this.visualQuality = quality;
    this.adaptiveResolution.setQuality(quality);
    this.bodyVisualSystem.setQuality(quality);
    this.postProcessing.setQuality(quality);
    this.postProcessing.setResolutionScale(this.adaptiveResolution.scale);
    this.celestialBackground.setQuality(quality);
    this.cometVisualSystem.setQuality(quality);
    this.statisticalBelts.setQuality(quality);
    this.impactVisualSystem.setQuality(quality);
    this.solarEvolutionVisualSystem.setQuality(quality);
    this.fictionalSupernovaVisualSystem.setQuality(quality);
    this.blackHoleVisualSystem.setQuality(quality);
    if (this.blackHoleRenderState !== null && this.lastFrame !== null) {
      this.updateBlackHoleVisuals(this.overviewRadiusRenderUnits / 1.08);
      this.updateBlackHoleLensing();
    }
    this.updateSolarFateVisuals();
    this.updateCanvasDiagnostics();
  }

  public setVenusSurfaceMode(mode: VenusSurfaceMode): void {
    this.assertNotDisposed();
    this.bodyVisualSystem.setVenusSurfaceMode(mode);
    this.updateCanvasDiagnostics();
  }

  public getBodyPhysicalPosition(bodyId: string): PhysicalPosition | null {
    const body = this.lastFrame?.bodies.find((candidate) => candidate.bodyId === bodyId);
    return body?.positionM ?? null;
  }

  public getCameraDiagnostics(): CameraRenderDiagnostics {
    const clipping = this.clippingController.snapshot();
    const marker = this.markers.get(this.selectedBodyId);
    const targetErrorRenderUnits =
      this.cameraController.mode === 'body-follow' && marker?.root.visible === true
        ? this.cameraController.rig.target.distanceTo(marker.root.position)
        : null;
    return Object.freeze({
      mode: this.cameraController.mode,
      targetBodyId: this.cameraController.status.targetBodyId,
      near: clipping.near,
      far: clipping.far,
      targetErrorRenderUnits,
    });
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
  }

  public handleContextLost(): void {
    this.contextAvailable = false;
  }

  public handleContextRestored(): void {
    if (this.disposed) return;
    this.renderer.resetState();
    this.contextAvailable = true;
    this.adaptiveResolution.reset();
    this.postProcessing.setResolutionScale(1);
    this.postProcessing.resize(
      this.viewportWidth,
      this.viewportHeight,
      this.requestedPixelRatio,
    );
  }

  public setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
    this.impactVisualSystem.setReducedMotion(reducedMotion);
    this.solarEvolutionVisualSystem.setReducedMotion(reducedMotion);
    this.fictionalSupernovaVisualSystem.setReducedMotion(reducedMotion);
    this.blackHoleVisualSystem.setReducedMotion(reducedMotion);
    this.postProcessing.setReducedMotion(reducedMotion);
    this.controls.enableDamping = !reducedMotion;
    if (reducedMotion) {
      this.scaleTransition?.setMode(this.scaleModel.mode, true);
      this.controls.update();
    }
  }

  /** Slows upward exposure adaptation to avoid abrupt brightness changes. */
  public setReduceFlashes(reduceFlashes: boolean): void {
    this.reduceFlashes = reduceFlashes;
    this.impactVisualSystem.setReduceFlashes(reduceFlashes);
    this.solarEvolutionVisualSystem.setReduceFlashes(reduceFlashes);
    this.fictionalSupernovaVisualSystem.setReduceFlashes(reduceFlashes);
    if (this.impactRenderState !== null) {
      this.impactVisualSystem.update(this.impactRenderState);
    }
    this.updateSolarFateVisuals();
    this.updateScenarioExposureProtection();
    this.canvas.dataset.reduceFlashes = String(reduceFlashes);
  }

  public getSmoothedFps(): number | null {
    return this.smoothedFps;
  }

  public getPerformanceDiagnostics(): Readonly<RendererPerformanceDiagnostics> {
    const adaptive = this.adaptiveResolution.getDiagnostics();
    const post = this.postProcessing.getState();
    const render = this.renderer.info.render;
    return Object.freeze({
      ...adaptive,
      requestedPixelRatio: post.requestedPixelRatio,
      effectivePixelRatio: post.effectivePixelRatio,
      maximumTierPixelRatio: post.maximumPixelRatio,
      drawCalls: render.calls,
      triangles: render.triangles,
      lines: render.lines,
      points: render.points,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      programs: this.renderer.info.programs?.length ?? 0,
    });
  }

  public getScaleModel(): RenderScaleModel {
    return this.scaleModel;
  }

  public getVisualDiagnostics(): PhaseFourVisualDiagnostics {
    if (this.markers.get(this.selectedBodyId)?.isComet !== true) {
      return this.bodyVisualSystem.getDiagnostics(this.selectedBodyId);
    }
    const comet = this.cometVisualSystem.getDiagnostics(this.selectedBodyId);
    return {
      ...this.bodyVisualSystem.getDiagnostics('sun'),
      selectedMaterial: 'Deterministic irregular rough nucleus · soft radial-density coma · tapered ion ribbon · curved multi-grain dust fan',
      selectedAssetState: 'procedural',
      selectedOcclusionVisibleFraction: 1,
      selectedOcclusionKind: 'none',
      atmosphereFlowTimeDays: comet.dustHistorySpanDays,
    };
  }

  public getPhaseSixDiagnostics(): Readonly<PhaseSixRenderDiagnostics> {
    const exposure = this.exposureAdaptation.state;
    return Object.freeze({
      background: this.celestialBackground.getDiagnostics(),
      comet: this.cometVisualSystem.getDiagnostics(this.selectedBodyId),
      belts: this.statisticalBelts.getDiagnostics(),
      exposure: exposure.exposure,
      targetExposure: exposure.targetExposure,
    });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.controls.dispose();
    // Remove and dispose the scenario-owned subtree before the generic scene
    // traversal so its resources have one clear owner.
    this.earthTideDebugOverlay?.dispose();
    this.impactVisualSystem.dispose();
    this.naturalSatelliteVisualSystem.dispose();
    this.spaceObjectVisualSystem.dispose();
    this.solarEvolutionVisualSystem.dispose();
    this.fictionalSupernovaVisualSystem.dispose();
    this.blackHoleVisualSystem.dispose();
    const geometries = new Set<BufferGeometry>([this.sphereGeometry]);
    const materials = new Set<Material>();
    this.scene.traverse((object: Object3D) => {
      const disposable = object as Object3D & {
        geometry?: BufferGeometry;
        material?: Material | Material[];
      };
      if (disposable.geometry !== undefined) geometries.add(disposable.geometry);
      if (Array.isArray(disposable.material)) {
        disposable.material.forEach((material) => materials.add(material));
      } else if (disposable.material !== undefined) {
        materials.add(disposable.material);
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    this.bodyVisualSystem.dispose();
    this.cometVisualSystem.dispose();
    this.celestialBackground.dispose();
    this.statisticalBelts.dispose();
    this.postProcessing.dispose();
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.scene.clear();
    this.markers.clear();
    this.orderedMarkerIds.length = 0;
    this.occupiedLabelPositions.length = 0;
    this.paths.clear();
    this.cameraBodies.clear();
    this.labelContainer?.replaceChildren();
  }

  /** Releases the browser context only after the owning canvas is truly detached. */
  public releaseContext(): void {
    if (this.contextReleased) return;
    this.contextReleased = true;
    this.renderer.forceContextLoss();
  }

  private applyOrigin(nextOriginM: PhysicalPosition): void {
    this.currentOriginM.x = nextOriginM.x;
    this.currentOriginM.y = nextOriginM.y;
    this.currentOriginM.z = nextOriginM.z;
  }

  private getOrCreateMarker(body: DebugBodyRenderState): MarkerResources {
    const existing = this.markers.get(body.bodyId);
    if (existing !== undefined) return existing;

    const isComet = body.kind === 'comet';
    const visual = isComet
      ? this.cometVisualSystem.create(body)
      : this.bodyVisualSystem.create(body);
    const root = visual.root;
    this.markerLayer.add(root);
    this.blackHoleVisualSystem.attachBody(body.bodyId, root);
    if (!isComet && body.bodyId === 'earth') {
      if (this.earthTideDebugOverlay !== null) {
        (visual as PhaseFourBodyVisual).root.add(this.earthTideDebugOverlay.root);
      }
    }
    if (!isComet) {
      const bodyVisual = visual as PhaseFourBodyVisual;
      if (body.bodyId === 'sun') {
        this.solarEvolutionVisualSystem.attachToSun(
          bodyVisual.root,
          bodyVisual.surface,
          bodyVisual.coronaShells,
        );
        this.fictionalSupernovaVisualSystem.attachToSun(
          bodyVisual.root,
          bodyVisual.surface,
          bodyVisual.coronaShells,
        );
      } else {
        this.solarEvolutionVisualSystem.attachBody(body.bodyId, bodyVisual.root);
        this.fictionalSupernovaVisualSystem.attachBody(body.bodyId, bodyVisual.root);
      }
    }
    if (!isComet && body.bodyId === this.selectedBodyId) {
      this.bodyVisualSystem.ensureAssets(body.bodyId);
    }

    const cameraTarget: MutableCameraBodyTarget = {
      bodyId: body.bodyId,
      positionM: body.positionM,
      velocityMps: body.velocityMps,
      radiusM: body.meanRadiusM,
      radiusRenderUnits: this.scaleModel.radiusFor(body),
      visualLocalToScene: new Quaternion(),
      visible: body.visible,
    };
    const clipSphere: MutableClipSphere = {
      center: root.position,
      radius:
        cameraTarget.radiusRenderUnits *
        (isComet ? 2.5 : (visual as PhaseFourBodyVisual).boundingRadiusMultiplier),
    };
    const label = this.createBodyLabel(body);
    const resources = {
      root,
      visual,
      isComet,
      cameraTarget,
      clipSphere,
      label,
      scenarioPositionM: { ...body.positionM },
      scenarioVelocityMps: { ...body.velocityMps },
      bodyState: body,
      screenX: 0,
      screenY: 0,
      onScreen: false,
    };
    this.markers.set(body.bodyId, resources);
    this.orderedMarkerIds.push(body.bodyId);
    this.orderedMarkerIds.sort(
      (leftId, rightId) => bodyRenderOrder(rightId) - bodyRenderOrder(leftId),
    );
    return resources;
  }

  private updatePaths(
    pathStates: readonly DebugOrbitTrailRenderState[],
    bodies: readonly DebugBodyRenderState[],
  ): void {
    this.visiblePathIds.clear();
    for (const pathState of pathStates) {
      const key = pathKey(pathState);
      this.visiblePathIds.add(key);
      let resources = this.paths.get(key);
      if (resources === undefined || resources.source !== pathState.positionsM) {
        if (resources !== undefined) {
          this.pathLayer.remove(resources.line);
          resources.line.geometry.dispose();
          resources.line.material.dispose();
        }
        resources = this.createPath(pathState);
        this.paths.set(key, resources);
      }

      const center =
        resources.centerBodyId === null
          ? HELIOCENTRIC_ORIGIN
          : bodies.find((body) => body.bodyId === resources.centerBodyId)?.positionM;
      const currentBody = bodies.find((body) => body.bodyId === pathState.bodyId);
      if (center === undefined || currentBody === undefined) {
        resources.line.visible = false;
        continue;
      }
      writeCameraRelativePathPositions(
        resources.mappedPositions,
        pathState.positionsM,
        center,
        this.currentOriginM,
        this.scaleModel.metersPerRenderUnit,
      );
      writeDistanceFadedPathColors(
        resources.mappedColors,
        pathState.positionsM,
        center,
        currentBody.positionM,
        resources.color,
        resources.kind,
      );
      resources.positionAttribute.needsUpdate = true;
      resources.colorAttribute.needsUpdate = true;
      // Every vertex is already relative to the current floating origin. A
      // second object translation would reintroduce GPU cancellation.
      resources.line.position.set(0, 0, 0);
      resources.line.visible =
        this.orbitLinesVisible &&
        !this.impactPlaybackActive() &&
        !this.blackHoleVisualSystem.getDiagnostics().active &&
        (currentBody.kind !== 'comet' || this.cometsVisible);
    }

    for (const [key, resources] of this.paths) {
      if (!this.visiblePathIds.has(key)) resources.line.visible = false;
    }
  }

  private updateCameraTargetOrientations(jdTdb: number): void {
    const greatRedSpot = getGiantAtmosphereProfile('jupiter').greatRedSpot;
    const greatRedSpotLongitude = greatRedSpot === undefined
      ? 0
      : sampleGreatRedSpotState(greatRedSpot, jdTdb).centerLongitudeRad;
    for (const marker of this.markers.values()) {
      marker.cameraTarget.visualLocalToScene.copy(marker.root.quaternion);
      if (marker.bodyState.bodyId === 'jupiter') {
        marker.cameraTarget.visualLocalToScene.multiply(
          this.visualFeatureRotation.setFromAxisAngle(
            VISUAL_NORTH,
            -greatRedSpotLongitude,
          ),
        );
      }
    }
  }

  private createPath(path: DebugOrbitTrailRenderState): PathResources {
    if (path.positionsM.length < 6 || path.positionsM.length % 3 !== 0) {
      throw new RangeError(`Ephemeris path "${path.bodyId}" requires at least two xyz samples.`);
    }

    const positionAttribute = new Float32BufferAttribute(
      new Float32Array(path.positionsM.length),
      3,
    );
    const colorAttribute = new Float32BufferAttribute(
      new Float32Array(path.positionsM.length),
      3,
    );
    // Float32BufferAttribute normalizes/copies constructor inputs. Always
    // mutate the arrays owned by the attributes that are actually uploaded.
    const mappedPositions = positionAttribute.array as Float32Array;
    const mappedColors = colorAttribute.array as Float32Array;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', positionAttribute);
    geometry.setAttribute('color', colorAttribute);
    const kind = path.kind ?? 'orbit';
    const color = new Color(bodyColor(path.bodyId));
    const line = new Line(
      geometry,
      new LineBasicMaterial({
        color: 0xffffff,
        opacity: kind === 'trail' ? 0.78 : path.bodyId === 'moon' ? 0.46 : 0.38,
        transparent: true,
        vertexColors: true,
      }),
    );
    line.name = `ephemeris-${kind}-${path.bodyId}`;
    line.frustumCulled = false;
    line.renderOrder = kind === 'trail' ? 2 : 1;
    this.pathLayer.add(line);
    return {
      line,
      source: path.positionsM,
      centerBodyId: path.centerBodyId ?? null,
      kind,
      mappedPositions,
      mappedColors,
      positionAttribute,
      colorAttribute,
      color,
    };
  }

  private updateCamera(frame: DebugRenderFrame, deltaSeconds: number): void {
    const cameraFrame = this.mutableCameraFrame;
    cameraFrame.realDeltaSeconds = deltaSeconds;
    cameraFrame.originM = frame.originM;
    cameraFrame.originRevision = frame.originRevision;
    cameraFrame.metersPerRenderUnit = this.scaleModel.metersPerRenderUnit;
    cameraFrame.overviewRadiusRenderUnits = this.overviewRadiusRenderUnits;
    cameraFrame.reducedMotion = this.reducedMotion;
    const initializingFreeOrbit =
      this.cameraController.mode === 'free-orbit' &&
      this.freeOrbitNeedsInitialization;

    if (initializingFreeOrbit) {
      // Let the controller resolve the selected body's scale-aware focus pose
      // before OrbitControls is allowed to synchronize its previous pivot.
      this.controls.enabled = false;
      this.cameraController.update(cameraFrame);
      this.cameraController.rig.snapToDesired();
      this.cameraController.rig.applyTo(this.camera, this.controls.target);
      this.controls.enabled = true;
      this.controls.update();
      this.cameraController.synchronizeFreeOrbitPose(
        this.camera.position,
        this.controls.target,
        this.camera.up,
      );
      this.freeOrbitNeedsInitialization = false;
    } else if (this.cameraController.mode === 'free-orbit') {
      this.controls.enabled = true;
      this.controls.update(deltaSeconds);
      this.cameraController.synchronizeFreeOrbitPose(
        this.camera.position,
        this.controls.target,
        this.camera.up,
      );
    } else {
      this.controls.enabled = false;
      this.cameraController.update(cameraFrame);
    }

    if (this.cameraController.mode === 'free-orbit' && !initializingFreeOrbit) {
      this.cameraController.update(cameraFrame);
    }
    this.cameraController.rig.applyTo(this.camera, this.controls.target);
    this.applyBlackHoleCameraTracking();
    this.applyImpactCameraOverride(deltaSeconds);
    this.updateScaleAwareNavigation();
    this.updateClipping(deltaSeconds);
    this.camera.updateMatrixWorld();
  }

  /** Keeps a user-orbitable close-up translated with the moving encounter. */
  private applyBlackHoleCameraTracking(): void {
    const diagnostics = this.blackHoleVisualSystem.getDiagnostics();
    if (!this.blackHoleCameraFraming || !diagnostics.active) return;
    const center = this.blackHoleVisualSystem.root.position;
    this.blackHoleCameraTranslation
      .copy(center)
      .sub(this.blackHoleCameraTrackedCenter);
    if (!isFiniteVector(this.blackHoleCameraTranslation)) {
      this.blackHoleFrameFinite = false;
      return;
    }
    if (this.blackHoleCameraTranslation.lengthSq() > 0) {
      this.camera.position.add(this.blackHoleCameraTranslation);
      this.controls.target.add(this.blackHoleCameraTranslation);
      this.cameraController.synchronizeFreeOrbitPose(
        this.camera.position,
        this.controls.target,
        this.camera.up,
      );
    }
    this.blackHoleCameraTrackedCenter.copy(center);
  }

  private applyImpactCameraOverride(deltaSeconds: number): void {
    if (this.impactCameraPresetId === null || this.impactRenderState === null) return;
    const target = this.markers.get(this.impactRenderState.targetBodyId);
    if (target === undefined || target.isComet || !target.root.visible) return;
    const pose = resolveImpactCameraPose(
      this.impactCameraPresetId,
      this.impactRenderState,
      this.impactVisualSystem.getDiagnostics().visibilityMultiplier,
    );
    const localEnhanced = this.impactCameraPresetId === 'ground-observer'
      && this.impactVisibilityMode === 'enhanced';
    const desiredFov = localEnhanced
      ? 40
      : verticalFovForViewport(this.viewportWidth, this.viewportHeight);
    if (Math.abs(this.camera.fov - desiredFov) > 1e-6) {
      this.camera.fov = desiredFov;
      this.camera.updateProjectionMatrix();
    }
    target.root.updateWorldMatrix(true, true);
    this.impactCameraPosition
      .set(pose.position.x, pose.position.y, pose.position.z);
    this.impactCameraPosition.applyQuaternion(this.impactBodyToVisualLocal);
    target.root.localToWorld(this.impactCameraPosition);
    this.impactCameraTarget
      .set(pose.target.x, pose.target.y, pose.target.z);
    this.impactCameraTarget.applyQuaternion(this.impactBodyToVisualLocal);
    target.root.localToWorld(this.impactCameraTarget);
    target.root.getWorldQuaternion(this.impactCameraWorldOrientation);
    this.impactCameraUp
      .set(pose.up.x, pose.up.y, pose.up.z)
      .applyQuaternion(this.impactBodyToVisualLocal)
      .applyQuaternion(this.impactCameraWorldOrientation)
      .normalize();

    if (!this.impactCameraOverrideInitialized) {
      this.impactCameraRig.synchronizePose(
        this.camera.position,
        this.controls.target,
        this.camera.up,
      );
      this.impactCameraOverrideInitialized = true;
    }
    this.impactCameraRig.setDesiredPose(
      this.impactCameraPosition,
      this.impactCameraTarget,
      this.impactCameraUp,
    );
    this.impactCameraRig.advance(deltaSeconds, 0.24, this.reducedMotion);
    this.impactCameraRig.applyTo(this.camera, this.controls.target);
    this.controls.enabled = false;
  }

  private updateScaleAwareNavigation(): void {
    const blackHoleDiagnostics = this.blackHoleVisualSystem.getDiagnostics();
    if (
      this.blackHoleCameraFraming &&
      blackHoleDiagnostics.active &&
      this.blackHoleRenderState !== null
    ) {
      const distance = Math.max(
        this.camera.position.distanceTo(this.blackHoleVisualSystem.root.position),
        1e-6,
      );
      const metrics = calculateScaleAwareNavigation({
        cameraDistanceRenderUnits: distance,
        targetRadiusM: this.blackHoleRenderState.blackHole.schwarzschildRadiusM,
        targetRadiusRenderUnits: blackHoleDiagnostics.visualRadiusRenderUnits,
        metersPerRenderUnit: this.scaleModel.metersPerRenderUnit,
        verticalFovDeg: this.camera.fov,
        viewportWidthPx: this.viewportWidth,
        viewportHeightPx: this.viewportHeight,
        systemRadiusRenderUnits: this.overviewRadiusRenderUnits,
      });
      this.controls.minDistance = metrics.minimumDistanceRenderUnits;
      this.controls.maxDistance = metrics.maximumDistanceRenderUnits;
      this.controls.zoomSpeed = 1;
      this.controls.panSpeed = Math.min(
        2.5,
        Math.max(0.25, metrics.renderUnitsPerPixel * 500),
      );
      this.controls.rotateSpeed = Math.min(
        1.2,
        Math.max(0.35, metrics.orbitRadiansPerPixel * 180),
      );
      return;
    }
    if (this.cameraController.mode === 'free-orbit' && this.auxiliaryFocusRadiusRenderUnits !== null) {
      const distance = Math.max(this.camera.position.distanceTo(this.controls.target), 1e-12);
      const radius = this.auxiliaryFocusRadiusRenderUnits;
      const metrics = calculateScaleAwareNavigation({
        cameraDistanceRenderUnits: distance,
        targetRadiusM: radius * this.scaleModel.metersPerRenderUnit,
        targetRadiusRenderUnits: radius,
        metersPerRenderUnit: this.scaleModel.metersPerRenderUnit,
        verticalFovDeg: this.camera.fov,
        viewportWidthPx: this.viewportWidth,
        viewportHeightPx: this.viewportHeight,
        systemRadiusRenderUnits: this.overviewRadiusRenderUnits,
      });
      this.controls.minDistance = metrics.minimumDistanceRenderUnits;
      this.controls.maxDistance = metrics.maximumDistanceRenderUnits;
      this.controls.zoomSpeed = 1;
      this.controls.panSpeed = Math.min(2.5, Math.max(0.25, metrics.renderUnitsPerPixel * 500));
      this.controls.rotateSpeed = Math.min(1.2, Math.max(0.35, metrics.orbitRadiansPerPixel * 180));
      return;
    }
    const marker = this.impactCameraPresetId === null
      ? this.markers.get(this.selectedBodyId) ?? this.markers.get('sun')
      : this.markers.get('earth');
    if (marker === undefined) return;
    const distance = Math.max(
      this.camera.position.distanceTo(marker.root.position),
      1e-6,
    );
    const metrics = calculateScaleAwareNavigation({
      cameraDistanceRenderUnits: distance,
      targetRadiusM: marker.bodyState.meanRadiusM,
      targetRadiusRenderUnits: marker.cameraTarget.radiusRenderUnits,
      metersPerRenderUnit: this.scaleModel.metersPerRenderUnit,
      verticalFovDeg: this.camera.fov,
      viewportWidthPx: this.viewportWidth,
      viewportHeightPx: this.viewportHeight,
      systemRadiusRenderUnits: this.overviewRadiusRenderUnits,
    });
    this.controls.minDistance = metrics.minimumDistanceRenderUnits;
    this.controls.maxDistance = metrics.maximumDistanceRenderUnits;
    this.controls.zoomSpeed = 1;
    this.controls.panSpeed = Math.min(
      2.5,
      Math.max(0.25, metrics.renderUnitsPerPixel * 500),
    );
    this.controls.rotateSpeed = Math.min(
      1.2,
      Math.max(0.35, metrics.orbitRadiansPerPixel * 180),
    );
  }

  private updateClipping(deltaSeconds: number): void {
    const marker = this.impactCameraPresetId === null
      ? this.markers.get(this.selectedBodyId) ?? this.markers.get('sun')
      : this.markers.get('earth');
    const blackHoleDiagnostics = this.blackHoleVisualSystem.getDiagnostics();
    const blackHoleFocus =
      this.blackHoleCameraFraming && blackHoleDiagnostics.active;
    const auxiliaryFocus =
      this.cameraController.mode === 'free-orbit' &&
      this.auxiliaryFocusRadiusRenderUnits !== null;
    const overviewFocus =
      this.impactCameraPresetId === null && this.cameraController.mode === 'overview';
    const focusCenter =
      blackHoleFocus
        ? this.blackHoleVisualSystem.root.position
        : auxiliaryFocus
        ? this.controls.target
        : overviewFocus || marker === undefined
        ? this.mappedHeliocentricCenter
        : marker.root.position;
    const focusRadius =
      blackHoleFocus
        ? blackHoleDiagnostics.visualRadiusRenderUnits
        : auxiliaryFocus
        ? this.auxiliaryFocusRadiusRenderUnits ?? 0
        : overviewFocus || marker === undefined
        ? this.overviewRadiusRenderUnits
        : marker.cameraTarget.radiusRenderUnits;
    this.clippingController.update(
      {
        cameraPosition: this.camera.position,
        focusCenter,
        focusRadius,
        visibleSpheres: this.clipSpheres,
      },
      deltaSeconds,
    );
    this.clippingController.applyTo(this.camera);
  }

  private createBodyLabel(body: DebugBodyRenderState): HTMLSpanElement | null {
    if (this.labelContainer === null) return null;
    const label = document.createElement('span');
    label.className = 'body-screen-label';
    label.textContent = body.displayName;
    label.dataset.bodyId = body.bodyId;
    label.dataset.testid = `body-label-${body.bodyId}`;
    label.setAttribute('aria-hidden', 'true');
    this.labelContainer.append(label);
    return label;
  }

  private createSelectionIndicator(): HTMLSpanElement | null {
    if (this.labelContainer === null) return null;
    const indicator = document.createElement('span');
    indicator.className = 'body-selection-indicator';
    indicator.dataset.testid = 'selected-body-marker';
    indicator.setAttribute('aria-hidden', 'true');
    this.labelContainer.append(indicator);
    return indicator;
  }

  private updateScreenSpaceLabels(): void {
    for (const [bodyId, marker] of this.markers) {
      const projected = this.scratchProjected.copy(marker.root.position).project(this.camera);
      marker.onScreen =
        marker.root.visible &&
        projected.z >= -1 &&
        projected.z <= 1 &&
        projected.x >= -1.08 &&
        projected.x <= 1.08 &&
        projected.y >= -1.08 &&
        projected.y <= 1.08;
      marker.screenX = (projected.x * 0.5 + 0.5) * this.viewportWidth;
      marker.screenY = (-projected.y * 0.5 + 0.5) * this.viewportHeight;
      if (marker.label !== null) marker.label.dataset.selected = String(bodyId === this.selectedBodyId);
    }

    // Close-up presets deliberately aim at a rendered surface feature or ring
    // system. Body/comet labels and the selected-body reticle share that same
    // screen-space target and would obscure the feature being inspected.
    // Keep the projections above current for diagnostics, then suppress the
    // complete marker-label layer until the preset hands control back to a
    // normal camera mode.
    if (
      this.cameraController.status.closeUpPresetId !== null
      || this.impactPlaybackActive()
    ) {
      for (const marker of this.markers.values()) {
        if (marker.label !== null) marker.label.style.opacity = '0';
      }
      if (this.selectionIndicator !== null) {
        this.selectionIndicator.style.opacity = '0';
      }
      return;
    }

    const occupied = this.occupiedLabelPositions;
    occupied.length = 0;
    const selectedMarker = this.markers.get(this.selectedBodyId);
    if (selectedMarker !== undefined) {
      this.placeScreenLabel(selectedMarker, this.selectedBodyId, occupied, true);
    }
    for (const bodyId of this.orderedMarkerIds) {
      const marker = this.markers.get(bodyId);
      if (marker === undefined) continue;
      if (bodyId !== this.selectedBodyId) {
        this.placeScreenLabel(marker, bodyId, occupied, false);
      }
    }

    if (this.selectionIndicator !== null && selectedMarker?.onScreen === true) {
      const projectedRadiusPx = projectedSphereRadiusPx(
        this.camera,
        selectedMarker.root.position,
        selectedMarker.cameraTarget.radiusRenderUnits,
        this.viewportWidth,
        this.viewportHeight,
      );
      const cueOpacity = selectionCueOpacityForProjectedRadius(projectedRadiusPx);
      this.selectionIndicator.dataset.bodyId = this.selectedBodyId;
      this.selectionIndicator.dataset.projectedRadiusPx = projectedRadiusPx.toFixed(2);
      this.selectionIndicator.dataset.proximityHidden = String(cueOpacity <= 0.001);
      this.selectionIndicator.style.opacity = cueOpacity.toFixed(3);
      this.selectionIndicator.style.transform =
        `translate(${selectedMarker.screenX}px, ${selectedMarker.screenY}px) translate(-50%, -50%)`;
    } else if (this.selectionIndicator !== null) {
      this.selectionIndicator.style.opacity = '0';
    }
  }

  private placeScreenLabel(
    marker: MarkerResources,
    bodyId: string,
    occupied: number[],
    selected: boolean,
  ): void {
    if (marker.label === null) return;
    const x = marker.screenX + 14;
    const y = marker.screenY + labelVerticalOffset(bodyId);
    let overlaps = false;
    for (let index = 0; index < occupied.length; index += 2) {
      const occupiedX = occupied[index] ?? 0;
      const occupiedY = occupied[index + 1] ?? 0;
      if (Math.abs(occupiedX - x) < 68 && Math.abs(occupiedY - y) < 20) {
        overlaps = true;
        break;
      }
    }
    const shown = this.bodyLabelsVisible && marker.onScreen && (selected || !overlaps);
    marker.label.style.opacity = shown ? (selected ? '1' : '0.76') : '0';
    marker.label.style.transform = `translate(${x}px, ${y}px) translate(0, -50%)`;
    if (shown) occupied.push(x, y);
  }

  private updateCanvasDiagnostics(force = true): void {
    if (!force && this.diagnosticsElapsedSeconds < 0.1) return;
    this.diagnosticsElapsedSeconds = 0;
    const diagnostics = this.getCameraDiagnostics();
    this.canvas.dataset.cameraMode = diagnostics.mode;
    this.canvas.dataset.cameraTarget = diagnostics.targetBodyId ?? '';
    this.canvas.dataset.cameraNear = diagnostics.near.toExponential(6);
    this.canvas.dataset.cameraFar = diagnostics.far.toExponential(6);
    this.canvas.dataset.followError =
      diagnostics.targetErrorRenderUnits === null
        ? ''
        : diagnostics.targetErrorRenderUnits.toExponential(6);
    this.canvas.dataset.scaleMode = this.scaleModel.mode;
    this.canvas.dataset.presentationWarning = String(
      this.scaleModel.presentationWarningRequired,
    );
    this.canvas.dataset.presentationMix = String(
      this.scaleTransition?.presentationMix ?? (this.scaleModel.mode === 'presentation' ? 1 : 0),
    );
    this.canvas.dataset.currentJdTdb = this.lastFrame?.currentJdTdb.toFixed(6) ?? '';
    this.canvas.dataset.selectedBody = this.selectedBodyId;
    const naturalSatellites = this.naturalSatelliteVisualSystem.getDiagnostics();
    this.canvas.dataset.naturalSatellitesVisible = String(naturalSatellites.visible);
    this.canvas.dataset.naturalSatelliteMajorCount = String(naturalSatellites.majorCount);
    this.canvas.dataset.naturalSatelliteMinorCount = String(naturalSatellites.minorCount);
    this.canvas.dataset.naturalSatelliteRenderedMajorCount = String(naturalSatellites.renderedMajorCount);
    this.canvas.dataset.naturalSatelliteRenderedMinorCount = String(naturalSatellites.renderedMinorCount);
    this.canvas.dataset.naturalSatelliteLocalScale = String(naturalSatellites.localScaleApplied);
    this.canvas.dataset.naturalSatelliteSelected = naturalSatellites.selectedSatelliteId ?? '';
    this.canvas.dataset.naturalSatelliteEclipsedCount = String(naturalSatellites.eclipsedMajorCount);
    this.canvas.dataset.naturalSatelliteTransitShadowCount = String(naturalSatellites.transitShadowCount);
    this.canvas.dataset.naturalSatelliteVisibleLabelCount = String(naturalSatellites.visibleLabelCount);
    this.canvas.dataset.naturalSatelliteSuppressedLabelCount = String(naturalSatellites.suppressedLabelCount);
    this.canvas.dataset.naturalSatelliteOfficialTextureReadyCount = String(naturalSatellites.officialTextureReadyCount);
    this.canvas.dataset.naturalSatelliteOfficialTextureFallbackCount = String(naturalSatellites.officialTextureFallbackCount);
    this.canvas.dataset.naturalSatelliteProceduralTextureCount = String(naturalSatellites.proceduralTextureCount);
    this.canvas.dataset.naturalSatelliteSelectedRenderRadius = naturalSatellites.selectedRenderRadius?.toExponential(6) ?? '';
    this.canvas.dataset.naturalSatelliteSelectedParentRenderRadius = naturalSatellites.selectedParentRenderRadius?.toExponential(6) ?? '';
    this.canvas.dataset.naturalSatelliteSelectedRadiusToParent = naturalSatellites.selectedRadiusToParent?.toFixed(6) ?? '';
    this.canvas.dataset.naturalSatelliteSelectedOnScreen = String(naturalSatellites.selectedOnScreen);
    this.canvas.dataset.naturalSatelliteSelectionCueOpacity = naturalSatellites.selectedCueOpacity.toFixed(3);
    this.canvas.dataset.naturalSatelliteSelectionHaloVisible = String(naturalSatellites.selectionHaloVisible);
    const spaceObjects = this.spaceObjectVisualSystem.getDiagnostics();
    this.canvas.dataset.spaceObjectsVisible = String(spaceObjects.visible);
    this.canvas.dataset.earthSatelliteCount = String(spaceObjects.earthSatelliteCount);
    this.canvas.dataset.earthSatelliteRenderedCount = String(spaceObjects.earthSatelliteRenderedCount);
    this.canvas.dataset.spacecraftCount = String(spaceObjects.spacecraftCount);
    this.canvas.dataset.spacecraftRenderedCount = String(spaceObjects.spacecraftRenderedCount);
    this.canvas.dataset.spaceObjectSelected = spaceObjects.selectedObjectId ?? '';
    this.canvas.dataset.spaceObjectDetailedInspection = spaceObjects.detailedInspectionObjectId ?? '';
    this.canvas.dataset.spaceObjectInspectionSuppressedMarkers = String(spaceObjects.inspectionSuppressedMarkerCount);
    this.canvas.dataset.spaceObjectTrajectoryPoints = String(spaceObjects.selectedTrajectoryPointCount);
    this.canvas.dataset.spaceObjectSelectedOnScreen = String(spaceObjects.selectedOnScreen);
    this.canvas.dataset.spaceObjectPropagationExecution = spaceObjects.propagationExecution;
    this.canvas.dataset.issModelState = spaceObjects.issModelState;
    this.canvas.dataset.issModelAssetId = spaceObjects.issModelAssetId;
    this.canvas.dataset.issModelMeshCount = String(spaceObjects.issModelMeshCount);
    this.canvas.dataset.issModelTriangleCount = String(spaceObjects.issModelTriangleCount);
    this.canvas.dataset.issPhysicalSpanMeters = String(spaceObjects.issPhysicalSpanMeters);
    this.canvas.dataset.issSpanToEarthDiameter = spaceObjects.issSpanToEarthDiameter.toExponential(9);
    this.canvas.dataset.issScalePolicy = spaceObjects.issScalePolicy;
    this.canvas.dataset.spaceObjectSelectedRenderRadius = spaceObjects.selectedRenderRadius?.toExponential(6) ?? '';
    this.canvas.dataset.spaceObjectFocusDistanceRatio =
      this.auxiliaryFocusRadiusRenderUnits === null || spaceObjects.selectedRenderRadius === null
        ? ''
        : (this.camera.position.distanceTo(this.controls.target) / spaceObjects.selectedRenderRadius).toFixed(6);
    const earthMarker = this.markers.get('earth');
    const moonMarker = this.markers.get('moon');
    const earthMoonRenderSeparation =
      earthMarker === undefined || moonMarker === undefined
        ? Number.NaN
        : earthMarker.root.position.distanceTo(moonMarker.root.position);
    const earthMoonRadiusSum =
      earthMarker === undefined || moonMarker === undefined
        ? Number.NaN
        : earthMarker.cameraTarget.radiusRenderUnits + moonMarker.cameraTarget.radiusRenderUnits;
    const earthMoonScreenSeparation =
      earthMarker === undefined || moonMarker === undefined
        ? Number.NaN
        : Math.hypot(
            earthMarker.screenX - moonMarker.screenX,
            earthMarker.screenY - moonMarker.screenY,
          );
    this.canvas.dataset.earthOnScreen = String(earthMarker?.onScreen === true);
    this.canvas.dataset.moonOnScreen = String(moonMarker?.onScreen === true);
    this.canvas.dataset.moonLabelVisible = String(
      moonMarker?.label != null && moonMarker.label.style.opacity !== '0',
    );
    this.canvas.dataset.earthMoonRenderSeparation = Number.isFinite(
      earthMoonRenderSeparation,
    )
      ? earthMoonRenderSeparation.toExponential(6)
      : '';
    this.canvas.dataset.earthMoonRadiusSum = Number.isFinite(earthMoonRadiusSum)
      ? earthMoonRadiusSum.toExponential(6)
      : '';
    this.canvas.dataset.earthMoonScreenSeparation = Number.isFinite(
      earthMoonScreenSeparation,
    )
      ? earthMoonScreenSeparation.toFixed(3)
      : '';
    this.canvas.dataset.earthMoonNonIntersecting = String(
      Number.isFinite(earthMoonRenderSeparation) &&
        Number.isFinite(earthMoonRadiusSum) &&
        earthMoonRenderSeparation > earthMoonRadiusSum,
    );
    const tides = this.earthTideDebugOverlay?.getDiagnostics();
    this.canvas.dataset.tideDebugMode = tides?.mode ?? 'off';
    this.canvas.dataset.tideOverlayActive = String(tides?.active === true);
    this.canvas.dataset.tideSampleValid = String(tides?.hasValidSample === true);
    this.canvas.dataset.tideJdTdb = tides?.jdTdb?.toFixed(6) ?? '';
    this.canvas.dataset.tideLunarVisible = String(tides?.lunarVisible === true);
    this.canvas.dataset.tideSolarVisible = String(tides?.solarVisible === true);
    this.canvas.dataset.tideLunarAmplitude = tides?.lunarAmplitude.toFixed(6) ?? '0.000000';
    this.canvas.dataset.tideSolarAmplitude = tides?.solarAmplitude.toFixed(6) ?? '0.000000';
    this.canvas.dataset.sublunarVisualDirection = tides === undefined
      ? ''
      : `${tides.lunarVisualX.toFixed(8)},${tides.lunarVisualY.toFixed(8)},${tides.lunarVisualZ.toFixed(8)}`;
    this.canvas.dataset.subsolarVisualDirection = tides === undefined
      ? ''
      : `${tides.solarVisualX.toFixed(8)},${tides.solarVisualY.toFixed(8)},${tides.solarVisualZ.toFixed(8)}`;
    this.canvas.dataset.tideBoundingRadius =
      (tides?.boundingRadiusMultiplier ?? 1).toFixed(6);
    const visuals = this.getVisualDiagnostics();
    this.canvas.dataset.visualMaterial = visuals.selectedMaterial;
    this.canvas.dataset.assetState = visuals.selectedAssetState;
    this.canvas.dataset.assetFallbackCount = String(visuals.fallbackAssetCount);
    this.canvas.dataset.atmospherePath = visuals.atmospherePath;
    this.canvas.dataset.venusSurfaceMode = visuals.venusSurfaceMode;
    this.canvas.dataset.earthSunDirection = [
      visuals.earthSunDirection.x,
      visuals.earthSunDirection.y,
      visuals.earthSunDirection.z,
    ].map((component) => component.toFixed(6)).join(',');
    this.canvas.dataset.earthCloudAngle = visuals.earthCloudAngleRad.toFixed(6);
    this.canvas.dataset.earthSolarIrradiance =
      visuals.earthSolarIrradianceWm2.toFixed(3);
    this.canvas.dataset.occlusionVisibleFraction =
      visuals.selectedOcclusionVisibleFraction.toFixed(6);
    this.canvas.dataset.occlusionKind = visuals.selectedOcclusionKind;
    this.canvas.dataset.giantProfileVersion = visuals.giantProfileVersion;
    this.canvas.dataset.atmosphereFlowTimeDays = visuals.atmosphereFlowTimeDays.toFixed(6);
    this.canvas.dataset.greatRedSpotLongitude = visuals.greatRedSpotLongitudeRad.toFixed(6);
    this.canvas.dataset.greatRedSpotVortexPhase =
      visuals.greatRedSpotVortexPhaseRad.toFixed(6);
    this.canvas.dataset.ringMeshCount = String(visuals.selectedRingMeshCount);
    this.canvas.dataset.surfaceVertexCount = String(
      visuals.selectedSurfaceVertexCount,
    );
    this.canvas.dataset.ringShadowEnabled = String(visuals.selectedRingShadowEnabled);
    this.canvas.dataset.ringSpokesEnabled = String(visuals.selectedSpokesEnabled);
    this.canvas.dataset.neptuneStormActive = String(visuals.neptuneStormActive);
    this.canvas.dataset.closeUpPreset = this.cameraController.status.closeUpPresetId ?? '';
    const post = this.postProcessing.getState();
    this.canvas.dataset.bloomEnabled = String(post.enabled);
    this.canvas.dataset.hdrRenderTarget = String(post.hdrRenderTargetSupported);
    this.canvas.dataset.bloomStrength = post.strength.toFixed(2);
    this.canvas.dataset.exposure = post.exposure.toFixed(2);
    this.canvas.dataset.exposurePreset = this.exposurePreset;
    const performance = this.getPerformanceDiagnostics();
    this.canvas.dataset.visualQuality = this.visualQuality;
    this.canvas.dataset.adaptiveResolutionState = performance.state;
    this.canvas.dataset.heavyRenderEffect = performance.heavyEffect;
    this.canvas.dataset.resolutionScale = performance.resolutionScale.toFixed(2);
    this.canvas.dataset.minimumResolutionScale = performance.minimumScale.toFixed(2);
    this.canvas.dataset.performanceTargetFps = String(performance.targetFps);
    this.canvas.dataset.performanceSmoothedFps = formatOptionalMetric(
      performance.smoothedFps,
    );
    this.canvas.dataset.performanceSamples = String(performance.sampleCount);
    this.canvas.dataset.performanceMedianFrameMs = formatOptionalMetric(
      performance.medianFrameMs,
    );
    this.canvas.dataset.performanceP95FrameMs = formatOptionalMetric(
      performance.p95FrameMs,
    );
    this.canvas.dataset.performanceP99FrameMs = formatOptionalMetric(
      performance.p99FrameMs,
    );
    this.canvas.dataset.performanceAdjustments = String(performance.adjustmentCount);
    this.canvas.dataset.requestedPixelRatio = performance.requestedPixelRatio.toFixed(2);
    this.canvas.dataset.effectivePixelRatio = performance.effectivePixelRatio.toFixed(2);
    this.canvas.dataset.maximumTierPixelRatio =
      performance.maximumTierPixelRatio.toFixed(2);
    this.canvas.dataset.drawCalls = String(performance.drawCalls);
    this.canvas.dataset.renderedTriangles = String(performance.triangles);
    this.canvas.dataset.renderedLines = String(performance.lines);
    this.canvas.dataset.renderedPoints = String(performance.points);
    this.canvas.dataset.gpuGeometries = String(performance.geometries);
    this.canvas.dataset.gpuTextures = String(performance.textures);
    this.canvas.dataset.gpuPrograms = String(performance.programs);
    this.canvas.dataset.gpuTimerAvailable = 'false';
    const phaseSix = this.getPhaseSixDiagnostics();
    this.canvas.dataset.skyAssetState = phaseSix.background.assetState;
    this.canvas.dataset.skyTextureTier = phaseSix.background.textureTier;
    this.canvas.dataset.brightStarCount = String(phaseSix.background.starCount);
    this.canvas.dataset.backgroundCenter = [
      phaseSix.background.backgroundCenter.x,
      phaseSix.background.backgroundCenter.y,
      phaseSix.background.backgroundCenter.z,
    ].map((component) => component.toFixed(6)).join(',');
    this.canvas.dataset.cameraPosition = [this.camera.position.x, this.camera.position.y, this.camera.position.z]
      .map((component) => component.toFixed(6)).join(',');
    this.canvas.dataset.cameraWorldTarget = [this.controls.target.x, this.controls.target.y, this.controls.target.z]
      .map((component) => component.toFixed(6)).join(',');
    this.canvas.dataset.targetExposure = phaseSix.targetExposure.toFixed(3);
    this.canvas.dataset.cometActivity = phaseSix.comet.activity.toFixed(6);
    this.canvas.dataset.cometIonDirection = [
      phaseSix.comet.ionDirection.x,
      phaseSix.comet.ionDirection.y,
      phaseSix.comet.ionDirection.z,
    ].map((component) => component.toFixed(6)).join(',');
    this.canvas.dataset.cometIonPointCount = String(phaseSix.comet.ionPointCount);
    this.canvas.dataset.cometDustPointCount = String(phaseSix.comet.dustPointCount);
    this.canvas.dataset.cometDustHistoryDays = phaseSix.comet.dustHistorySpanDays.toFixed(6);
    this.canvas.dataset.cometDustCurvatureM = phaseSix.comet.dustCurvatureM.toExponential(6);
    this.canvas.dataset.cometTrustedEphemeris = String(phaseSix.comet.trustedEphemeris);
    this.canvas.dataset.cometComaRendering = phaseSix.comet.comaRendering;
    this.canvas.dataset.cometTailRendering = phaseSix.comet.tailRendering;
    this.canvas.dataset.asteroidBeltInstances = String(phaseSix.belts.asteroidInstanceCount);
    this.canvas.dataset.kuiperBeltInstances = String(phaseSix.belts.kuiperInstanceCount);
    this.canvas.dataset.statisticalBeltLabel = phaseSix.belts.label;
    const asteroidBeltMetrics = this.statisticalBelts.getVisualMetrics('asteroid-belt');
    const kuiperBeltMetrics = this.statisticalBelts.getVisualMetrics('kuiper-belt');
    this.canvas.dataset.asteroidBeltMaximumMarkerPx =
      asteroidBeltMetrics.maximumRenderedMarkerPx.toFixed(3);
    this.canvas.dataset.kuiperBeltMaximumMarkerPx =
      kuiperBeltMetrics.maximumRenderedMarkerPx.toFixed(3);
    const impact = this.impactVisualSystem.getDiagnostics();
    this.canvas.dataset.impactTargetBody = this.impactRenderState?.targetBodyId ?? '';
    this.canvas.dataset.impactActive = String(impact.active);
    this.canvas.dataset.impactPresentationMode = impact.presentationMode;
    this.canvas.dataset.impactLifecycle = impact.lifecycleState;
    this.canvas.dataset.impactStage = impact.stage;
    this.canvas.dataset.impactRunSignature = impact.runSignature;
    this.canvas.dataset.impactCameraPreset = impact.cameraPresetId ?? '';
    this.canvas.dataset.impactVisibilityMode = impact.visibilityMode;
    this.canvas.dataset.impactVisibilityMultiplier = impact.visibilityMultiplier.toFixed(3);
    this.canvas.dataset.impactTrailPoints = String(impact.trailPointCount);
    this.canvas.dataset.impactFragments = String(impact.fragmentCount);
    this.canvas.dataset.impactEjectaPoints = String(impact.ejectaPointCount);
    this.canvas.dataset.impactPlumePoints = String(impact.plumePointCount);
    this.canvas.dataset.impactImpactorVisible = String(impact.impactorVisible);
    this.canvas.dataset.impactPreviewReticleVisible = String(impact.reticleVisible);
    this.canvas.dataset.impactPreviewTrajectoryPoints =
      String(impact.projectedTrajectoryPointCount);
    this.canvas.dataset.impactBowShockVisible = String(impact.bowShockVisible);
    this.canvas.dataset.impactPlasmaVisible = String(impact.plasmaVisible);
    this.canvas.dataset.impactEntryTrailVisible = String(impact.entryTrailVisible);
    this.canvas.dataset.impactVelocityAlignment = impact.velocityAlignmentDot.toFixed(6);
    this.canvas.dataset.impactNormalizedHeating = impact.normalizedHeating.toFixed(6);
    this.canvas.dataset.impactImpactorSizeExaggerated =
      String(impact.impactorSizeExaggerated);
    this.canvas.dataset.impactEntryEffectProfile = impact.entryEffectProfile;
    this.canvas.dataset.impactEntryEffectIntensity = impact.entryEffectIntensity.toFixed(6);
    this.canvas.dataset.impactOutcomeKind = impact.outcomeKind ?? '';
    this.canvas.dataset.impactSurfaceEffectProfile = impact.surfaceEffectProfile;
    this.canvas.dataset.impactAftermathKind = impact.aftermathKind;
    this.canvas.dataset.impactFlashAttachmentErrorM =
      impact.flashAttachmentErrorM.toFixed(6);
    this.canvas.dataset.impactFlashNormalAlignment =
      impact.flashNormalAlignmentDot.toFixed(9);
    this.canvas.dataset.impactFlashCapAngularRadius =
      impact.flashCapAngularRadiusRad.toFixed(9);
    this.canvas.dataset.impactFlashLightVisible = String(impact.flashLightVisible);
    this.canvas.dataset.impactFlashHdrClamped = String(impact.flashHdrClamped);
    this.canvas.dataset.impactCraterAttachmentErrorM =
      impact.craterAttachmentErrorM.toFixed(6);
    this.canvas.dataset.impactCraterAngularRadius =
      impact.craterAngularRadiusRad.toFixed(9);
    this.canvas.dataset.impactCraterFormationProgress =
      impact.craterFormationProgress.toFixed(6);
    this.canvas.dataset.impactCraterPersistent = String(impact.craterPersistent);
    this.canvas.dataset.impactGroundShockwaveVisible =
      String(impact.groundShockwaveVisible);
    this.canvas.dataset.impactAtmosphericShockwaveVisible =
      String(impact.atmosphericShockwaveVisible);
    this.canvas.dataset.impactGroundShockwaveAngularRadius =
      impact.groundShockwaveAngularRadiusRad.toFixed(9);
    this.canvas.dataset.impactAtmosphericShockwaveAngularRadius =
      impact.atmosphericShockwaveAngularRadiusRad.toFixed(9);
    this.canvas.dataset.impactShockwaveSurfaceConforming =
      String(impact.shockwaveSurfaceConforming);
    this.canvas.dataset.impactEjectaActiveCount = String(impact.ejectaActiveCount);
    this.canvas.dataset.impactEjectaRecontactCount = String(impact.ejectaRecontactCount);
    this.canvas.dataset.impactPlumeVisible = String(impact.plumeVisible);
    this.canvas.dataset.impactPlumeLayerCount = String(impact.plumeLayerCount);
    this.canvas.dataset.impactPlumeCoolingProgress =
      impact.plumeCoolingProgress.toFixed(6);
    this.canvas.dataset.impactCloudScarVisible = String(impact.cloudScarVisible);
    this.canvas.dataset.impactCloudRippleVisible = String(impact.cloudRippleVisible);
    this.canvas.dataset.impactCloudScarAngularRadius =
      impact.cloudScarAngularRadiusRad.toFixed(9);
    this.canvas.dataset.impactCloudScarOpacity = impact.cloudScarOpacity.toFixed(6);
    this.canvas.dataset.impactCloudScarAdvection =
      impact.cloudScarAdvectionRad.toFixed(9);
    this.canvas.dataset.impactSolidSurfaceEffectsSuppressed =
      String(impact.solidSurfaceEffectsSuppressed);
    this.canvas.dataset.impactAftermathPersistent = String(impact.aftermathPersistent);
    this.canvas.dataset.impactActiveObjectCount = String(impact.activeObjectCount);
    this.canvas.dataset.impactFlashVisible = String(impact.flashVisible);
    this.canvas.dataset.impactCraterVisible = String(impact.craterVisible);
    this.canvas.dataset.impactShockwaveVisible = String(impact.shockwaveVisible);
    this.canvas.dataset.impactHazeVisible = String(impact.hazeVisible);
    this.canvas.dataset.impactFlashIntensity = impact.effectiveFlashIntensity.toFixed(3);
    this.canvas.dataset.impactBoundingRadius = impact.boundingRadiusMultiplier.toFixed(6);
    const solarFate = this.getSolarFateDiagnostics();
    this.canvas.dataset.solarFateMode = solarFate.mode;
    this.canvas.dataset.solarEvolutionActive = String(solarFate.evolution.active);
    this.canvas.dataset.solarEvolutionPhase = solarFate.evolution.phase;
    this.canvas.dataset.solarEvolutionRunSignature =
      solarFate.evolution.runSignature;
    this.canvas.dataset.solarEvolutionRadius =
      solarFate.evolution.stellarRadiusRenderUnits.toFixed(6);
    this.canvas.dataset.solarEvolutionStellarRadius =
      solarFate.evolution.stellarRadiusRenderUnits.toFixed(6);
    this.canvas.dataset.solarEvolutionBoundingRadius =
      solarFate.evolution.boundingRadiusRenderUnits.toFixed(6);
    this.canvas.dataset.solarEvolutionParticles =
      String(solarFate.evolution.particleCount);
    this.canvas.dataset.solarEvolutionHeatedBodies =
      String(solarFate.evolution.heatedBodyCount);
    this.canvas.dataset.solarEvolutionBaseSunHidden =
      String(solarFate.evolution.baseSunHidden);
    this.canvas.dataset.supernovaActive = String(solarFate.supernova.active);
    this.canvas.dataset.supernovaPhase = solarFate.supernova.phase;
    this.canvas.dataset.supernovaRunSignature = solarFate.supernova.runSignature;
    this.canvas.dataset.supernovaCoreRadius =
      solarFate.supernova.coreRadiusRenderUnits.toFixed(6);
    this.canvas.dataset.supernovaBoundingRadius =
      solarFate.supernova.boundingRadiusRenderUnits.toFixed(6);
    this.canvas.dataset.supernovaDebrisPoints =
      String(solarFate.supernova.debrisPointCount);
    this.canvas.dataset.supernovaHeatedBodies =
      String(solarFate.supernova.heatedBodyCount);
    this.canvas.dataset.supernovaFlashVisible =
      String(solarFate.supernova.flashVisible);
    this.canvas.dataset.supernovaFlashIntensity =
      solarFate.supernova.effectiveFlashIntensity.toFixed(3);
    this.canvas.dataset.fictionalSupernovaActive =
      String(solarFate.supernova.active);
    this.canvas.dataset.fictionalSupernovaPhase = solarFate.supernova.phase;
    this.canvas.dataset.fictionalSupernovaRunSignature =
      solarFate.supernova.runSignature;
    this.canvas.dataset.fictionalSupernovaCoreRadius =
      solarFate.supernova.coreRadiusRenderUnits.toFixed(6);
    this.canvas.dataset.fictionalSupernovaBoundingRadius =
      solarFate.supernova.boundingRadiusRenderUnits.toFixed(6);
    this.canvas.dataset.fictionalSupernovaDebrisPoints =
      String(solarFate.supernova.debrisPointCount);
    this.canvas.dataset.fictionalSupernovaHeatedBodies =
      String(solarFate.supernova.heatedBodyCount);
    this.canvas.dataset.fictionalSupernovaFlashVisible =
      String(solarFate.supernova.flashVisible);
    this.canvas.dataset.fictionalSupernovaFlashIntensity =
      solarFate.supernova.effectiveFlashIntensity.toFixed(3);
    this.canvas.dataset.fictionalSupernovaBaseSunHidden =
      String(solarFate.supernova.baseSunHidden);
    const blackHole = this.getBlackHoleDiagnostics();
    this.canvas.dataset.blackHoleActive = String(blackHole.active);
    this.canvas.dataset.blackHoleMode = blackHole.mode;
    this.canvas.dataset.blackHoleLifecycle = blackHole.lifecycleState;
    this.canvas.dataset.blackHoleStage = blackHole.stage;
    this.canvas.dataset.blackHoleRunSignature = blackHole.runSignature;
    this.canvas.dataset.blackHoleFinite = String(blackHole.finite);
    this.canvas.dataset.blackHoleEventHorizonRadius =
      blackHole.eventHorizonRadiusRenderUnits.toExponential(6);
    this.canvas.dataset.blackHoleVisualRadius =
      blackHole.visualRadiusRenderUnits.toFixed(6);
    this.canvas.dataset.blackHolePresentationRadiusExaggerated =
      String(blackHole.presentationRadiusExaggerated);
    this.canvas.dataset.blackHoleAccretionDiskVisible =
      String(blackHole.accretionDiskVisible);
    this.canvas.dataset.blackHoleStreamPoints = String(blackHole.streamPointCount);
    this.canvas.dataset.blackHoleCapturedBodies =
      String(blackHole.capturedBodyCount);
    this.canvas.dataset.blackHoleDisruptedBodies =
      String(blackHole.disruptedBodyCount);
    this.canvas.dataset.blackHoleBaseBodyOverrides =
      String(blackHole.baseBodyOverrideCount);
    this.canvas.dataset.blackHoleSuppressedBodies =
      String(this.blackHoleSuppressedBodyCount);
    this.canvas.dataset.blackHoleEphemerisPathsHidden = String(
      blackHole.active && !this.pathLayer.visible,
    );
    this.canvas.dataset.blackHoleStatisticalBeltsHidden = String(
      blackHole.active && !this.statisticalBelts.root.visible,
    );
    this.canvas.dataset.blackHoleLensingPath = blackHole.lensing.path;
    this.canvas.dataset.blackHoleLensingActive = String(blackHole.lensing.active);
    this.canvas.dataset.blackHoleLensingFinite = String(blackHole.lensing.finite);
    this.canvas.dataset.blackHoleLensingHighQualitySupported =
      String(blackHole.lensing.highQualitySupported);
    this.canvas.dataset.blackHoleLensingHorizonRadiusNdc =
      blackHole.lensing.eventHorizonRadiusNdc.toFixed(6);
    this.canvas.dataset.blackHoleCameraFraming = String(
      this.blackHoleCameraFraming && blackHole.active,
    );
    this.canvas.dataset.blackHoleCameraTargetError =
      this.blackHoleCameraFraming && blackHole.active
        ? this.controls.target.distanceTo(this.blackHoleVisualSystem.root.position)
          .toExponential(6)
        : '0.000000e+0';
  }

  private updateSolarFateVisuals(): void {
    const context = this.getSolarFateScaleContext();
    if (context === null) return;
    if (this.solarEvolutionRenderState !== null) {
      this.solarEvolutionVisualSystem.update(
        this.solarEvolutionRenderState,
        context,
      );
    }
    if (this.fictionalSupernovaRenderState !== null) {
      this.fictionalSupernovaVisualSystem.update(
        this.fictionalSupernovaRenderState,
        context,
      );
    }
  }

  private getSolarFateScaleContext(): Readonly<SolarFateScaleContext> | null {
    const sun = this.markers.get('sun');
    if (sun === undefined || sun.isComet) return null;
    this.mutableSolarFateScaleContext.metersPerRenderUnit =
      this.scaleModel.metersPerRenderUnit;
    this.mutableSolarFateScaleContext.baseSunRadiusRenderUnits =
      this.scaleModel.radiusFor(sun.bodyState);
    return this.mutableSolarFateScaleContext;
  }

  private extendSunScenarioBounds(currentMaximum: number): number {
    const sun = this.markers.get('sun');
    if (sun === undefined || sun.isComet) return currentMaximum;
    const evolution = this.solarEvolutionVisualSystem.getDiagnostics();
    const supernova = this.fictionalSupernovaVisualSystem.getDiagnostics();
    const baseRadius = this.scaleModel.radiusFor(sun.bodyState);
    const coreRadius = evolution.active
      ? evolution.stellarRadiusRenderUnits
      : supernova.active
        ? supernova.coreRadiusRenderUnits
        : 0;
    const boundingRadius = evolution.active
      ? evolution.boundingRadiusRenderUnits
      : supernova.active
        ? supernova.boundingRadiusRenderUnits
        : 0;
    const baseSunVisible =
      (!evolution.active || !evolution.baseSunHidden) &&
      (!supernova.active || !supernova.baseSunHidden);
    const visibleBaseRadius = baseSunVisible ? baseRadius : 0;
    sun.cameraTarget.radiusRenderUnits = Math.max(visibleBaseRadius, coreRadius);
    sun.clipSphere.radius = Math.max(
      visibleBaseRadius * (sun.visual as PhaseFourBodyVisual).boundingRadiusMultiplier,
      boundingRadius,
    );
    return Math.max(
      currentMaximum,
      sun.root.position.distanceTo(this.mappedHeliocentricCenter) +
        sun.clipSphere.radius,
    );
  }

  private restoreSunScenarioBounds(): void {
    const sun = this.markers.get('sun');
    if (sun === undefined || sun.isComet) return;
    const baseRadius = this.scaleModel.radiusFor(sun.bodyState);
    sun.cameraTarget.radiusRenderUnits = baseRadius;
    sun.clipSphere.radius =
      baseRadius * (sun.visual as PhaseFourBodyVisual).boundingRadiusMultiplier;
  }

  private updateBlackHoleVisuals(currentMaximum: number): number {
    const state = this.blackHoleRenderState;
    if (state === null) {
      if (this.blackHoleVisualSystem.getDiagnostics().active) {
        this.blackHoleVisualSystem.reset();
      }
      this.blackHoleIncludedBodyIds.clear();
      this.blackHoleSuppressedBodyCount = 0;
      this.pathLayer.visible = this.orbitLinesVisible && !this.impactPlaybackActive();
      this.statisticalBelts.root.visible = true;
      this.blackHoleClipSphere.radius = 0;
      return currentMaximum;
    }
    validateBlackHoleRenderState(state);
    const active =
      state.lifecycleState === 'running' ||
      state.lifecycleState === 'paused' ||
      state.lifecycleState === 'complete';
    const metersPerRenderUnit = this.scaleModel.metersPerRenderUnit;
    if (!Number.isFinite(metersPerRenderUnit) || metersPerRenderUnit <= 0) {
      this.blackHoleFrameFinite = false;
      throw new RangeError(
        'Black-hole render scale must contain a finite positive metres-per-unit value.',
      );
    }

    this.setScenarioWorldPosition(
      this.blackHolePhysicalPosition,
      state.scenarioOriginM,
      state.blackHole.positionLocalM,
    );
    this.scaleModel.mapPosition(
      this.blackHoleMappedPosition,
      this.blackHolePhysicalPosition,
      this.currentOriginM,
    );
    this.blackHolePositionTuple[0] = this.blackHoleMappedPosition.x;
    this.blackHolePositionTuple[1] = this.blackHoleMappedPosition.y;
    this.blackHolePositionTuple[2] = this.blackHoleMappedPosition.z;
    const eventHorizonRadiusRenderUnits =
      state.blackHole.schwarzschildRadiusM / metersPerRenderUnit;
    const minimumVisualRadiusRenderUnits = Math.min(
      Math.max(currentMaximum * 0.006, 0.035),
      1.25,
    );
    if (
      !Number.isFinite(eventHorizonRadiusRenderUnits) ||
      eventHorizonRadiusRenderUnits <= 0 ||
      !isFiniteVector(this.blackHoleMappedPosition)
    ) {
      this.blackHoleFrameFinite = false;
      throw new RangeError('Black-hole render mapping produced a non-finite value.');
    }

    this.blackHoleMappedBodies.length = 0;
    this.blackHoleIncludedBodyIds.clear();
    for (const body of state.bodyStates) {
      this.blackHoleIncludedBodyIds.add(body.bodyId);
      let mapped = this.blackHoleMappedBodiesById.get(body.bodyId);
      if (mapped === undefined) {
        mapped = {
          bodyId: body.bodyId,
          positionRenderUnits: [0, 0, 0],
          radiusRenderUnits: 0,
          outcome: body.outcome,
          tidalStress: 0,
          streamProgress: 0,
          captureProgress: 0,
        };
        this.blackHoleMappedBodiesById.set(body.bodyId, mapped);
      }
      const marker = this.markers.get(body.bodyId);
      const physicalPosition = marker?.scenarioPositionM ?? this.blackHolePhysicalPosition;
      this.setScenarioWorldPosition(
        physicalPosition,
        state.scenarioOriginM,
        body.positionLocalM,
      );
      const mappedPosition = active && marker !== undefined
        ? marker.root.position
        : this.scratchMapped;
      this.scaleModel.mapPosition(
        mappedPosition,
        physicalPosition,
        this.currentOriginM,
      );
      mapped.positionRenderUnits[0] = mappedPosition.x;
      mapped.positionRenderUnits[1] = mappedPosition.y;
      mapped.positionRenderUnits[2] = mappedPosition.z;
      mapped.radiusRenderUnits = marker === undefined
        ? body.radiusM / metersPerRenderUnit
        : this.scaleModel.radiusFor(marker.bodyState);
      mapped.outcome = body.outcome;
      mapped.tidalStress = body.tidalStress;
      mapped.streamProgress = body.streamProgress;
      mapped.captureProgress = body.captureProgress;
      this.blackHoleMappedBodies.push(mapped);

      if (!active || marker === undefined) continue;
      marker.scenarioVelocityMps.x =
        state.scenarioOriginVelocityMps[0] + body.velocityLocalMps[0];
      marker.scenarioVelocityMps.y =
        state.scenarioOriginVelocityMps[1] + body.velocityLocalMps[1];
      marker.scenarioVelocityMps.z =
        state.scenarioOriginVelocityMps[2] + body.velocityLocalMps[2];
      marker.cameraTarget.positionM = marker.scenarioPositionM;
      marker.cameraTarget.velocityMps = marker.scenarioVelocityMps;
      marker.cameraTarget.radiusM = body.radiusM;

      const captured = body.outcome === 'captured';
      const captureScale = Math.max(0.06, 1 - body.captureProgress * 0.94);
      const stress = Math.min(Math.max(body.tidalStress, 0), 1);
      const baseScale = marker.isComet
        ? 1
        : this.scaleModel.radiusFor(marker.bodyState);
      marker.root.scale.set(
        baseScale * captureScale * (1 + stress * 0.65),
        baseScale * captureScale * (1 - stress * 0.28),
        baseScale * captureScale * (1 - stress * 0.18),
      );
      marker.cameraTarget.radiusRenderUnits = mapped.radiusRenderUnits * captureScale;
      const layerVisible = marker.bodyState.kind !== 'comet' || this.cometsVisible;
      marker.root.visible = marker.bodyState.visible && layerVisible && !captured;
      marker.cameraTarget.visible = marker.root.visible;
      marker.clipSphere.radius = captured
        ? 0
        : marker.cameraTarget.radiusRenderUnits *
          (marker.isComet
            ? 2.5
            : (marker.visual as PhaseFourBodyVisual).boundingRadiusMultiplier) *
          (1 + stress * 0.65);
      if (captured && marker.label !== null) marker.label.style.opacity = '0';
      currentMaximum = Math.max(
        currentMaximum,
        marker.root.position.distanceTo(this.mappedHeliocentricCenter) +
          marker.clipSphere.radius,
      );
    }

    this.blackHoleSuppressedBodyCount = 0;
    this.pathLayer.visible = this.orbitLinesVisible && !active;
    this.statisticalBelts.root.visible = !active;
    if (active) {
      // Bodies without defensible masses (currently the five catalogued
      // comets) stay outside the N-body worker. Suppress their ephemeris-owned
      // visuals while scenario-local authority is active so they cannot look
      // unaffected by a complete-system cinematic. Reset reapplies lastFrame.
      for (const [bodyId, marker] of this.markers) {
        if (this.blackHoleIncludedBodyIds.has(bodyId)) continue;
        marker.root.visible = false;
        marker.cameraTarget.visible = false;
        marker.clipSphere.radius = 0;
        if (marker.label !== null) marker.label.style.opacity = '0';
        this.blackHoleSuppressedBodyCount += 1;
      }
    }

    this.blackHoleVisualSystem.update({
      lifecycleState: state.lifecycleState,
      mode: state.mode,
      stage: state.stage,
      scenarioTimeSeconds: state.scenarioTimeSeconds,
      progress: state.progress,
      runSignature: state.runSignature,
      positionRenderUnits: this.blackHolePositionTuple,
      eventHorizonRadiusRenderUnits,
      minimumVisualRadiusRenderUnits,
      accretionDiskEnabled: state.blackHole.accretionDiskEnabled,
      spinVisualization: state.blackHole.spinVisualization,
      bodies: this.blackHoleMappedBodies,
    });
    const diagnostics = this.blackHoleVisualSystem.getDiagnostics();
    if (active) {
      const visualBounds = diagnostics.visualRadiusRenderUnits *
        (diagnostics.accretionDiskVisible ? 6.4 : 1.65);
      this.blackHoleClipSphere.radius = visualBounds;
      this.clipSpheres.push(this.blackHoleClipSphere);
      currentMaximum = Math.max(
        currentMaximum,
        this.blackHoleVisualSystem.root.position.distanceTo(
          this.mappedHeliocentricCenter,
        ) + visualBounds,
      );
    } else {
      this.blackHoleClipSphere.radius = 0;
    }
    this.blackHoleFrameFinite = true;
    return currentMaximum;
  }

  private updateBlackHoleLensing(): void {
    const diagnostics = this.blackHoleVisualSystem.getDiagnostics();
    if (!diagnostics.active || diagnostics.visualRadiusRenderUnits <= 0) {
      this.postProcessing.setBlackHoleLensing(null);
      this.blackHoleVisualSystem.setLensingDiagnostics(
        this.postProcessing.getBlackHoleLensingDiagnostics(),
      );
      return;
    }
    this.camera.updateMatrixWorld();
    if (
      !isFiniteMatrix(this.camera.matrixWorld) ||
      !isFiniteMatrix(this.camera.matrixWorldInverse) ||
      !isFiniteMatrix(this.camera.projectionMatrix)
    ) {
      this.blackHoleFrameFinite = false;
      this.postProcessing.setBlackHoleLensing(null);
      this.blackHoleVisualSystem.setLensingDiagnostics(
        this.postProcessing.getBlackHoleLensingDiagnostics(),
      );
      return;
    }
    this.blackHoleCameraPosition
      .copy(this.blackHoleVisualSystem.root.position)
      .applyMatrix4(this.camera.matrixWorldInverse);
    this.blackHoleProjectedPosition
      .copy(this.blackHoleVisualSystem.root.position)
      .project(this.camera);
    if (
      !isFiniteVector(this.blackHoleCameraPosition) ||
      !isFiniteVector(this.blackHoleProjectedPosition)
    ) {
      this.blackHoleFrameFinite = false;
      this.postProcessing.setBlackHoleLensing(null);
      this.blackHoleVisualSystem.setLensingDiagnostics(
        this.postProcessing.getBlackHoleLensingDiagnostics(),
      );
      return;
    }
    const distance = Math.max(
      this.camera.position.distanceTo(this.blackHoleVisualSystem.root.position),
      1e-9,
    );
    const halfVerticalSpan = Math.max(
      distance * Math.tan((this.camera.fov * Math.PI) / 360),
      1e-9,
    );
    const eventHorizonRadiusNdc = Math.min(
      diagnostics.visualRadiusRenderUnits / halfVerticalSpan,
      3,
    );
    const onScreen =
      this.blackHoleCameraPosition.z < 0 &&
      this.blackHoleProjectedPosition.z >= -1 &&
      this.blackHoleProjectedPosition.z <= 1 &&
      Math.abs(this.blackHoleProjectedPosition.x) <= 2 &&
      Math.abs(this.blackHoleProjectedPosition.y) <= 2;
    const lensingFrame = this.mutableBlackHoleLensingFrame;
    lensingFrame.active = onScreen;
    lensingFrame.centerNdc[0] = this.blackHoleProjectedPosition.x;
    lensingFrame.centerNdc[1] = this.blackHoleProjectedPosition.y;
    lensingFrame.eventHorizonRadiusNdc = eventHorizonRadiusNdc;
    lensingFrame.viewportAspect = Math.max(this.camera.aspect, 1e-6);
    lensingFrame.redshiftStrength = Math.min(
      1,
      0.3 +
        diagnostics.disruptedBodyCount * 0.05 +
        diagnostics.capturedBodyCount * 0.08,
    );
    this.postProcessing.setBlackHoleLensing(lensingFrame);
    this.blackHoleVisualSystem.setLensingDiagnostics(
      this.postProcessing.getBlackHoleLensingDiagnostics(),
    );
    this.blackHoleFrameFinite = true;
  }

  private setScenarioWorldPosition(
    target: { x: number; y: number; z: number },
    originM: BlackHoleVectorTuple,
    localM: BlackHoleVectorTuple,
  ): void {
    target.x = originM[0] + localM[0];
    target.y = originM[1] + localM[1];
    target.z = originM[2] + localM[2];
  }

  private updateScenarioExposureProtection(force = false): void {
    const exposure = aggregateProtectiveExposureCeilings([
      this.impactVisualSystem.getProtectiveExposureCeiling(),
      this.fictionalSupernovaVisualSystem.getProtectiveExposureCeiling(),
      this.blackHoleVisualSystem.getProtectiveExposureCeiling(),
    ]);
    if (!force && this.scenarioExposureCeiling === exposure) return;
    this.scenarioExposureCeiling = exposure;
    this.exposureAdaptation.setProtectiveCeiling(exposure, exposure !== null);
  }

  private updateExposurePreset(immediate = false): void {
    const nextPreset: SolarExposurePreset =
      this.selectedBodyId === 'sun' && this.cameraController.mode !== 'overview'
        ? 'solar-closeup'
        : this.cameraController.mode === 'overview'
          ? 'deep-space'
          : 'balanced';
    if (nextPreset === this.exposurePreset && !immediate) return;
    this.exposurePreset = nextPreset;
    this.exposureAdaptation.setPreset(nextPreset, immediate);
    if (immediate) this.postProcessing.setExposure(this.exposureAdaptation.state.exposure);
  }

  private impactPlaybackActive(): boolean {
    const state = this.impactRenderState;
    return state?.presentationMode === 'playback'
      && state.lifecycleState !== 'idle'
      && state.lifecycleState !== 'error';
  }

  private updateFps(deltaSeconds: number): void {
    if (deltaSeconds <= 0) return;
    const instantFps = 1 / deltaSeconds;
    this.smoothedFps =
      this.smoothedFps === null ? instantFps : this.smoothedFps * 0.9 + instantFps * 0.1;
  }

  private activeHeavyRenderEffect(): HeavyRenderEffect {
    if (this.blackHoleRenderState !== null) return 'black-hole';
    if (this.fictionalSupernovaRenderState !== null) return 'supernova';
    if (this.solarEvolutionRenderState !== null) return 'solar-evolution';
    if (this.impactRenderState !== null) return 'impact';
    return 'none';
  }

  private synchronizeAdaptiveResolutionEffect(): void {
    if (
      this.adaptiveResolution.sampleFrame(0, this.activeHeavyRenderEffect())
    ) {
      this.postProcessing.setResolutionScale(this.adaptiveResolution.scale);
    }
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error('DebugSolarSystemRenderer has been disposed.');
  }
}

function pathKey(path: DebugOrbitTrailRenderState): string {
  return `${path.kind ?? 'orbit'}:${path.bodyId}`;
}

function labelVerticalOffset(bodyId: string): number {
  const index = bodyRenderOrder(bodyId);
  return -12 + ((index % 3) - 1) * 13;
}

function bodyRenderOrder(bodyId: string): number {
  return BODY_RENDER_ORDER.get(bodyId) ?? BODY_RENDER_ORDER.size;
}

const BODY_RENDER_ORDER = new Map(
  [
    'sun',
    'mercury',
    'venus',
    'earth',
    'mars',
    'jupiter',
    'saturn',
    'uranus',
    'neptune',
    'moon',
    '1p-halley',
    '2p-encke',
    '67p-churyumov-gerasimenko',
    'c-1995-o1-hale-bopp',
    'c-2020-f3-neowise',
  ].map((bodyId, index) => [bodyId, index]),
);

function formatOptionalMetric(value: number | null): string {
  return value === null ? '' : value.toFixed(3);
}

function bodyColor(bodyId: string): number {
  switch (bodyId) {
    case 'sun':
      return 0xffc45c;
    case 'mercury':
      return 0xb9b4aa;
    case 'venus':
      return 0xe7b66f;
    case 'earth':
      return 0x55a9ff;
    case 'moon':
      return 0xd7dbe2;
    case 'mars':
      return 0xd86e4a;
    case 'jupiter':
      return 0xd7aa7c;
    case 'saturn':
      return 0xe2ca86;
    case 'uranus':
      return 0x84d7df;
    case 'neptune':
      return 0x567ee8;
    case '1p-halley':
      return 0x8dd8ff;
    case '2p-encke':
      return 0x70e0c2;
    case '67p-churyumov-gerasimenko':
      return 0x84b8ff;
    case 'c-1995-o1-hale-bopp':
      return 0xc29cff;
    case 'c-2020-f3-neowise':
      return 0x6fefff;
    default:
      return 0x9fc8e8;
  }
}

function validateCameraSnapshot(snapshot: Readonly<RendererCameraSnapshot>): void {
  if (snapshot.selectedBodyId.trim().length === 0) {
    throw new RangeError('Renderer camera snapshot requires a selected body ID.');
  }
  validateCameraTuple(snapshot.position, 'position');
  validateCameraTuple(snapshot.target, 'target');
  validateCameraTuple(snapshot.up, 'up');
  const upLength = Math.hypot(snapshot.up[0], snapshot.up[1], snapshot.up[2]);
  if (upLength === 0) throw new RangeError('Renderer camera snapshot up vector is zero.');
  if (snapshot.closeUpPresetId !== null) {
    getCameraCloseUpPreset(snapshot.closeUpPresetId);
  }
}

function isFiniteVector(vector: Readonly<Vector3>): boolean {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

function isFiniteMatrix(matrix: { readonly elements: readonly number[] }): boolean {
  return matrix.elements.length === 16 && matrix.elements.every(Number.isFinite);
}

function validateCameraTuple(
  value: readonly [number, number, number],
  label: string,
): void {
  if (!value.every(Number.isFinite)) {
    throw new RangeError(`Renderer camera snapshot ${label} must be finite.`);
  }
}
