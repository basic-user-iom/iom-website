import { createSeamRepairedImage } from './TextureSeamRepair';
import { EARTH_OCEAN_REFLECTION_GLSL } from './EarthOceanReflection';
import {
  AdditiveBlending,
  BackSide,
  Color,
  DataTexture,
  FrontSide,
  Group,
  Mesh,
  NoColorSpace,
  Quaternion,
  RepeatWrapping,
  RGBAFormat,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  UnsignedByteType,
  Vector3,
  Vector4,
  type IUniform,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';

import { createAtmosphereMaterial, EARTH_ATMOSPHERE_SHELL_RADIUS } from './AtmosphereScattering';
import { BODY_TEXTURE_ASSETS, textureAssetsForBody, type BodyTextureChannel } from './AssetCatalog';
import {
  createAtmosphereLutBundle,
} from './AtmosphereLut';
import {
  coronaShellCount,
  textureAnisotropyCap,
  usesAtmosphereLut,
  type VenusSurfaceMode,
  type VisualQuality,
} from './VisualQuality';
import {
  applyGiantPlanetQuality,
  createGiantPlanetMaterialBundle,
  createRingSystemVisualBundle,
  updateGiantPlanetMaterial,
} from './GiantPlanetMaterials';
import {
  GIANT_PLANET_VISUAL_CATALOG,
  getGiantAtmosphereProfile,
  getRingSystemProfile,
  isGiantPlanetId,
} from './GiantPlanetProfiles';
import type { DebugBodyRenderState, DebugRenderFrame } from '../RenderContext';
import type { EphemerisBodyId } from '../../simulation/bodies/EphemerisBodyCatalog';
import {
  createRotationState,
  type RotationState,
} from '../../simulation/bodies/RotationModel';
import { EPHEMERIS_ROTATION_MODELS } from '../../simulation/bodies/RotationModelCatalog';
import {
  createBodySunLightingSample,
  sampleBodySunLighting,
} from '../../simulation/lighting/BodySunLighting';
import {
  createAnalyticSphereOcclusionSample,
  sampleAnalyticSphereOcclusion,
  type OcclusionKind,
} from '../../simulation/lighting/AnalyticOcclusion';

type AssetState = 'unrequested' | 'loading' | 'ready' | 'fallback';

export interface PhaseFourBodyVisual {
  readonly bodyId: string;
  readonly root: Group;
  readonly surface: Mesh<SphereGeometry, ShaderMaterial>;
  readonly materials: readonly ShaderMaterial[];
  readonly coronaShells: readonly Mesh<SphereGeometry, ShaderMaterial>[];
  readonly atmosphere: Mesh<SphereGeometry, ShaderMaterial> | null;
  readonly clouds: Mesh<SphereGeometry, ShaderMaterial> | null;
  readonly secondaryClouds: Mesh<SphereGeometry, ShaderMaterial> | null;
  readonly rings: readonly Mesh<BufferGeometry, ShaderMaterial>[];
  readonly boundingRadiusMultiplier: number;
  readonly textureBindings: ReadonlyMap<BodyTextureChannel, readonly ShaderMaterial[]>;
}

export interface PhaseFourVisualDiagnostics {
  readonly selectedMaterial: string;
  readonly selectedAssetState: AssetState | 'procedural';
  readonly fallbackAssetCount: number;
  readonly atmospherePath: 'lut' | 'analytic';
  readonly venusSurfaceMode: VenusSurfaceMode;
  readonly earthSunDirection: Readonly<Vector3>;
  readonly earthCloudAngleRad: number;
  readonly earthSolarIrradianceWm2: number;
  readonly selectedOcclusionVisibleFraction: number;
  readonly selectedOcclusionKind: OcclusionKind;
  readonly giantProfileVersion: string;
  readonly atmosphereFlowTimeDays: number;
  readonly greatRedSpotLongitudeRad: number;
  readonly greatRedSpotVortexPhaseRad: number;
  readonly selectedRingMeshCount: number;
  readonly selectedRingShadowEnabled: boolean;
  readonly selectedSpokesEnabled: boolean;
  readonly neptuneStormActive: boolean;
  readonly selectedSurfaceVertexCount: number;
}

export interface PhaseFourBodyVisualSystemOptions {
  readonly maximumAnisotropy: number;
  readonly initialQuality?: VisualQuality;
  readonly initialVenusSurfaceMode?: VenusSurfaceMode;
}

const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);
const WHITE_PIXEL = new Uint8Array([255, 255, 255, 255]);
const BLACK_PIXEL = new Uint8Array([0, 0, 0, 255]);
const NEUTRAL_NORMAL_PIXEL = new Uint8Array([128, 128, 255, 255]);
const VENUS_CLOUD_SUPERROTATION_DAYS = 4;

const MATERIAL_LABELS: Readonly<Record<string, string>> = Object.freeze({
  sun: 'Seamless modeled photosphere · dated SDO/HMI active-region detail · multiscale granulation · chromosphere',
  mercury: 'MESSENGER MD3 color mosaic · USGS DEM-derived normal detail',
  venus: 'Akatsuki/Hubble-informed procedural cloud tops · modeled 4-day superrotation',
  earth: 'Blue Marble · ocean Fresnel/glint · independent clouds · terminator night lights',
  moon: 'LRO LROC WAC color mosaic · LOLA DEM-derived normal detail',
  mars: 'Viking MDIM 2.1 color · MOLA normal detail · polar caps · dust haze',
  jupiter: 'Hubble OPAL 2025 color · JunoCam 2019 GRS detail · modeled flow (mixed-date visualization)',
  saturn: 'Hubble OPAL 2025 color bands · modeled Cassini CB2 jet flow · JPL 1-bar oblate cloud tops · optical-depth rings and mutual shadows',
  uranus: 'Modeled cloud bands · seasonal polar haze · analytic winds · faint measured-radius rings',
  neptune: 'Modeled cloud bands and methane filaments · dated nonpermanent storm · faint rings and arcs',
});

/**
 * Phase 4 body renderer. Translation remains owned by the Float64 ephemeris
 * pipeline; this system owns body-local orientation, light response, shells,
 * texture lifecycle, and deterministic procedural fallbacks.
 */
export class PhaseFourBodyVisualSystem {
  private geometry: SphereGeometry;
  /** Shared corona envelope geometry (not quality-swapped). */
  private readonly coronaGeometry: SphereGeometry;
  private readonly qualityGeometries: Readonly<Record<VisualQuality, SphereGeometry>>;
  private readonly textureLoader = new TextureLoader();
  private readonly maximumAnisotropy: number;
  private readonly visuals = new Map<string, PhaseFourBodyVisual>();
  private readonly assetStates = new Map<string, AssetState>();
  private readonly requestedBodies = new Set<string>();
  private readonly loadedTextures = new Set<Texture>();
  private readonly generatedTextures = new Set<Texture>();
  private readonly generatedGeometries = new Set<BufferGeometry>();
  private readonly loadedTexturesByChannel = new Map<string, Texture>();
  private readonly whiteTexture = createSolidTexture(WHITE_PIXEL, 'phase-4-white-fallback');
  private readonly blackTexture = createSolidTexture(BLACK_PIXEL, 'phase-4-black-fallback');
  private readonly neutralNormalTexture = createSolidTexture(
    NEUTRAL_NORMAL_PIXEL,
    'phase-4-neutral-normal-fallback',
  );
  private readonly atmosphereGeometry = new SphereGeometry(1, 128, 96);
  private readonly atmosphereLuts = createAtmosphereLutBundle();
  private readonly earthSunDirection = new Vector3(-1, 0, 0);
  private readonly sceneFromInertial = new Quaternion().setFromAxisAngle(X_AXIS, -Math.PI / 2);
  private readonly meshToBodyLocal = new Quaternion().setFromAxisAngle(X_AXIS, Math.PI / 2);
  private readonly sampledOrientation = new Quaternion();
  private readonly scratchSpinQuaternion = new Quaternion();
  private readonly rotationState: RotationState = createRotationState();
  private readonly sunLighting = createBodySunLightingSample();
  private readonly physicalSunDirectionScene = new Vector3(-1, 0, 0);
  private readonly physicalSunDirectionBodyLocal = new Vector3(-1, 0, 0);
  private readonly occlusionSample = createAnalyticSphereOcclusionSample();
  private readonly occlusionVisibleByBody = new Map<string, number>();
  private readonly occlusionKindByBody = new Map<string, OcclusionKind>();
  private readonly bodyStatesById = new Map<string, DebugBodyRenderState>();
  private quality: VisualQuality;
  private venusSurfaceMode: VenusSurfaceMode;
  private earthCloudAngleRad = 0;
  private earthSolarIrradianceWm2 = 0;
  private disposed = false;

  public constructor(
    geometry: SphereGeometry,
    options: PhaseFourBodyVisualSystemOptions,
  ) {
    this.geometry = geometry;
    const lowGeometry = createQualitySphereGeometry(24, 16, 'low');
    const mediumGeometry = createQualitySphereGeometry(48, 32, 'medium');
    const ultraGeometry = createQualitySphereGeometry(192, 128, 'ultra');
    this.qualityGeometries = Object.freeze({
      low: lowGeometry,
      medium: mediumGeometry,
      high: geometry,
      ultra: ultraGeometry,
    });
    this.generatedGeometries.add(this.atmosphereGeometry);
    this.generatedGeometries.add(lowGeometry);
    this.generatedGeometries.add(mediumGeometry);
    this.generatedGeometries.add(ultraGeometry);
    this.coronaGeometry = new SphereGeometry(1, 96, 64);
    this.coronaGeometry.name = 'phase-4-corona-sphere';
    this.generatedGeometries.add(this.coronaGeometry);
    this.maximumAnisotropy = Math.max(1, options.maximumAnisotropy);
    this.quality = options.initialQuality ?? 'high';
    this.geometry = this.qualityGeometries[this.quality];
    this.venusSurfaceMode = options.initialVenusSurfaceMode ?? 'clouds';
    for (const asset of BODY_TEXTURE_ASSETS) this.assetStates.set(asset.assetId, 'unrequested');
  }

  public create(body: DebugBodyRenderState): PhaseFourBodyVisual {
    const existing = this.visuals.get(body.bodyId);
    if (existing !== undefined) return existing;
    this.assertNotDisposed();

    const visual =
      body.bodyId === 'sun'
        ? this.createSun(body)
        : body.bodyId === 'earth'
          ? this.createEarth(body)
          : body.bodyId === 'venus'
            ? this.createVenus(body)
            : isGiantPlanetId(body.bodyId)
              ? this.createGiantPlanet(body)
            : body.bodyId === 'mars'
              ? this.createMars(body)
              : this.createSurfaceOnlyBody(body);
    this.visuals.set(body.bodyId, visual);
    for (const channel of visual.textureBindings.keys()) {
      const texture = this.loadedTexturesByChannel.get(textureChannelKey(body.bodyId, channel));
      if (texture !== undefined) this.bindTexture(body.bodyId, channel, texture);
    }
    this.applyQualityToVisual(visual);
    this.applyVenusMode();
    return visual;
  }

  public get(bodyId: string): PhaseFourBodyVisual | undefined {
    return this.visuals.get(bodyId);
  }

  public ensureAssets(bodyId: string): void {
    if (this.requestedBodies.has(bodyId) || this.disposed) return;
    const assets = textureAssetsForBody(bodyId);
    if (assets.length === 0) return;
    this.requestedBodies.add(bodyId);
    for (const asset of assets) {
      this.assetStates.set(asset.assetId, 'loading');
      this.textureLoader.load(
        asset.file,
        (texture: Texture<HTMLImageElement | HTMLCanvasElement>) => {
          if (this.disposed) {
            texture.dispose();
            return;
          }
          if (asset.invalidLeftGutterPixels !== undefined) {
            texture.image = createSeamRepairedImage(
              texture.image as HTMLImageElement, asset.invalidLeftGutterPixels,
            );
          }
          texture.name = asset.assetId;
          texture.colorSpace = asset.colorSpace === 'srgb' ? SRGBColorSpace : NoColorSpace;
          texture.wrapS = RepeatWrapping;
          texture.anisotropy = Math.min(
            this.maximumAnisotropy,
            textureAnisotropyCap(this.quality),
          );
          texture.needsUpdate = true;
          this.loadedTextures.add(texture);
          this.loadedTexturesByChannel.set(textureChannelKey(asset.bodyId, asset.channel), texture);
          this.bindTexture(asset.bodyId, asset.channel, texture);
          this.assetStates.set(asset.assetId, 'ready');
        },
        undefined,
        () => {
          if (!this.disposed) this.assetStates.set(asset.assetId, 'fallback');
        },
      );
    }
  }

  public updateFrame(frame: DebugRenderFrame): void {
    const sun = this.visuals.get('sun');
    this.bodyStatesById.clear();
    for (const body of frame.bodies) this.bodyStatesById.set(body.bodyId, body);
    const sunState = this.bodyStatesById.get('sun');
    if (sun === undefined || sunState === undefined) return;

    for (const [bodyId, visual] of this.visuals) {
      const bodyState = this.bodyStatesById.get(bodyId);
      if (bodyState === undefined) continue;
      this.updateOrientation(visual, bodyState, frame);
      const visibleFraction =
        bodyId === 'sun' ? 1 : this.sampleOcclusion(bodyState, sunState, frame.bodies);
      this.occlusionVisibleByBody.set(bodyId, visibleFraction);
      if (bodyId !== 'sun') {
        sampleBodySunLighting(
          this.sunLighting,
          bodyState.positionM,
          sunState.positionM,
          this.rotationState.orientation,
        );
        this.physicalSunDirectionScene.set(
          this.sunLighting.directionScene.x,
          this.sunLighting.directionScene.y,
          this.sunLighting.directionScene.z,
        );
        this.physicalSunDirectionBodyLocal.set(
          this.sunLighting.directionBodyLocal.x,
          this.sunLighting.directionBodyLocal.y,
          this.sunLighting.directionBodyLocal.z,
        );
      }
      for (const material of visual.materials) {
        setUniformVector(material, 'uSunPositionWorld', sun.root.position);
        setUniformVector(material, 'uSunDirectionWorld', this.physicalSunDirectionScene);
        setUniformVector(
          material,
          'uSunDirectionBodyLocal',
          this.physicalSunDirectionBodyLocal,
        );
        setUniformNumber(material, 'uTimeDays', frame.currentJdTdb - 2_451_545);
        setUniformNumber(material, 'uOcclusion', visibleFraction);
        if (bodyId !== 'sun') {
          setUniformNumber(
            material,
            'uRelativeIrradiance',
            this.sunLighting.relativeIrradianceAtOneAu,
          );
        }
      }
      if (isGiantPlanetId(bodyId)) {
        updateGiantPlanetMaterial(
          visual.surface.material,
          getGiantAtmosphereProfile(bodyId),
          frame.currentJdTdb,
        );
      }
      visual.coronaShells.forEach((shell) => {
        setUniformNumber(shell.material, 'uTimeDays', frame.currentJdTdb - 2_451_545);
      });
      if (bodyId === 'earth') {
        this.earthSunDirection.set(
          this.sunLighting.directionScene.x,
          this.sunLighting.directionScene.y,
          this.sunLighting.directionScene.z,
        );
        this.earthSolarIrradianceWm2 = this.sunLighting.irradianceWm2;
      }
    }
  }

  public setQuality(quality: VisualQuality): void {
    if (this.quality === quality) return;
    this.quality = quality;
    this.geometry = this.qualityGeometries[quality];
    for (const texture of this.loadedTextures) {
      texture.anisotropy = Math.min(
        this.maximumAnisotropy,
        textureAnisotropyCap(quality),
      );
      texture.needsUpdate = true;
    }
    for (const visual of this.visuals.values()) {
      this.applyGeometryToVisual(visual);
      this.applyQualityToVisual(visual);
    }
  }

  public setVenusSurfaceMode(mode: VenusSurfaceMode): void {
    this.venusSurfaceMode = mode;
    this.applyVenusMode();
    if (mode === 'radar') this.ensureAssets('venus');
  }

  public getDiagnostics(selectedBodyId: string): PhaseFourVisualDiagnostics {
    const selectedAssets = textureAssetsForBody(selectedBodyId);
    const selectedAssetState =
      selectedBodyId === 'venus' && this.venusSurfaceMode === 'clouds'
        ? 'procedural'
        : aggregateAssetState(
            selectedAssets.map((asset) => this.assetStates.get(asset.assetId) ?? 'unrequested'),
          );
    const selectedVisual = this.visuals.get(selectedBodyId);
    const selectedSurface = selectedVisual?.surface.material;
    const selectedRingMaterial = selectedVisual?.rings[0]?.material;
    const jupiterSurface = this.visuals.get('jupiter')?.surface.material;
    const neptuneSurface = this.visuals.get('neptune')?.surface.material;
    return Object.freeze({
      selectedMaterial:
        selectedBodyId === 'venus' && this.venusSurfaceMode === 'radar'
          ? 'Magellan radar data visualization'
          : MATERIAL_LABELS[selectedBodyId] ?? 'Body-local sunlight shader',
      selectedAssetState,
      fallbackAssetCount: [...this.assetStates.values()].filter((state) => state === 'fallback')
        .length,
      atmospherePath:
        selectedBodyId === 'earth' && usesAtmosphereLut(this.quality) ? 'lut' : 'analytic',
      venusSurfaceMode: this.venusSurfaceMode,
      earthSunDirection: this.earthSunDirection.clone(),
      earthCloudAngleRad: this.earthCloudAngleRad,
      earthSolarIrradianceWm2: this.earthSolarIrradianceWm2,
      selectedOcclusionVisibleFraction: this.occlusionVisibleByBody.get(selectedBodyId) ?? 1,
      selectedOcclusionKind: this.occlusionKindByBody.get(selectedBodyId) ?? 'none',
      giantProfileVersion: GIANT_PLANET_VISUAL_CATALOG.profileVersion,
      atmosphereFlowTimeDays: uniformNumber(selectedSurface, 'uAtmosphereTimeDays', 0),
      greatRedSpotLongitudeRad: uniformNumber(jupiterSurface, 'uGrsCenterLongitudeRad', 0),
      greatRedSpotVortexPhaseRad: uniformNumber(jupiterSurface, 'uGrsVortexPhase', 0),
      selectedRingMeshCount: selectedVisual?.rings.length ?? 0,
      selectedRingShadowEnabled:
        uniformNumber(selectedSurface, 'uHasRingShadow', 0) > 0.5,
      selectedSpokesEnabled: uniformNumber(selectedRingMaterial, 'uSpokeStrength', 0) > 0,
      neptuneStormActive: uniformNumber(neptuneSurface, 'uStormActive', 0) > 0.5,
      selectedSurfaceVertexCount:
        selectedVisual?.surface.geometry.getAttribute('position').count ?? 0,
    });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loadedTextures.forEach((texture) => texture.dispose());
    this.loadedTextures.clear();
    this.generatedTextures.forEach((texture) => texture.dispose());
    this.generatedTextures.clear();
    this.generatedGeometries.forEach((geometry) => geometry.dispose());
    this.generatedGeometries.clear();
    this.loadedTexturesByChannel.clear();
    this.bodyStatesById.clear();
    this.whiteTexture.dispose();
    this.blackTexture.dispose();
    this.neutralNormalTexture.dispose();
    this.atmosphereLuts.dispose();
    this.visuals.clear();
    this.requestedBodies.clear();
  }

  private createSun(body: DebugBodyRenderState): PhaseFourBodyVisual {
    const root = namedRoot(body.bodyId);
    const surfaceMaterial = createSunMaterial();
    const surface = namedMesh(this.geometry, surfaceMaterial, `phase-4-photosphere-${body.bodyId}`);
    surface.renderOrder = 2;
    root.add(surface);

    // A faint radial emission envelope, occluded by the opaque photosphere.
    // Its geometric extent matches the clipping bounds; intensity fades before the edge.
    const coronaShells = [2.4].map((scale, index) => {
      const material = createCoronaMaterial(index, scale);
      const shell = namedMesh(this.coronaGeometry, material, `phase-4-corona-${index + 1}`);
      shell.scale.setScalar(scale);
      shell.renderOrder = 3 + index;
      root.add(shell);
      return shell;
    });
    return {
      bodyId: body.bodyId,
      root,
      surface,
      materials: [surfaceMaterial, ...coronaShells.map((shell) => shell.material)],
      coronaShells,
      atmosphere: null,
      clouds: null,
      secondaryClouds: null,
      rings: [],
      boundingRadiusMultiplier: 2.4,
      textureBindings: new Map([['observation', [surfaceMaterial]]]),
    };
  }

  private createEarth(body: DebugBodyRenderState): PhaseFourBodyVisual {
    const root = namedRoot(body.bodyId);
    const surfaceMaterial = createSurfaceMaterial({
      baseColor: 0x315f77,
      secondaryColor: 0x49714a,
      profile: 1,
      reliefStrength: 1.35,
      roughness: 0.47,
      whiteTexture: this.whiteTexture,
      blackTexture: this.blackTexture,
      neutralNormalTexture: this.neutralNormalTexture,
    });
    const surface = namedMesh(this.geometry, surfaceMaterial, 'phase-4-earth-surface');
    root.add(surface);

    const cloudMaterial = createCloudMaterial({
      baseColor: 0xffffff,
      isVenus: false,
      opacity: 0.62,
      layerPhase: 0,
      whiteTexture: this.whiteTexture,
    });
    const clouds = namedMesh(this.geometry, cloudMaterial, 'phase-4-earth-clouds');
    clouds.scale.setScalar(1.0012);
    clouds.renderOrder = 5;
    root.add(clouds);

    const atmosphereMaterial = createAtmosphereMaterial({
      color: 0x7ec8ff,
      luts: this.atmosphereLuts,
      earthLike: true,
      shellRadius: EARTH_ATMOSPHERE_SHELL_RADIUS,
      density: 0.62,
      limbPower: 0.45,
      innerFade: 0.0,
      eclipseScatterFloor: 0.24,
      name: 'phase-4-earth-atmosphere-lut',
    });
    // The atmosphere shares the exact terrain cutout, including reset.
    atmosphereMaterial.uniforms.uGroundCut = surfaceMaterial.uniforms.uImpactCut!;
    const atmosphere = namedMesh(this.atmosphereGeometry, atmosphereMaterial, 'phase-4-earth-atmosphere');
    atmosphere.scale.setScalar(EARTH_ATMOSPHERE_SHELL_RADIUS);
    atmosphere.renderOrder = 10;
    root.add(atmosphere);

    return {
      bodyId: body.bodyId,
      root,
      surface,
      materials: [surfaceMaterial, cloudMaterial, atmosphereMaterial],
      coronaShells: [],
      atmosphere,
      clouds,
      secondaryClouds: null,
      rings: [],
      boundingRadiusMultiplier: EARTH_ATMOSPHERE_SHELL_RADIUS,
      textureBindings: new Map([
        ['albedo', [surfaceMaterial]],
        ['night', [surfaceMaterial]],
        ['normal', [surfaceMaterial]],
        ['ocean', [surfaceMaterial]],
        ['roughness', [surfaceMaterial]],
        ['cloud', [cloudMaterial]],
      ]),
    };
  }

  private createVenus(body: DebugBodyRenderState): PhaseFourBodyVisual {
    const root = namedRoot(body.bodyId);
    const surfaceMaterial = createSurfaceMaterial({
      baseColor: 0xbd5d24,
      secondaryColor: 0xf1ad54,
      profile: 3,
      reliefStrength: 0.18,
      roughness: 0.72,
      whiteTexture: this.whiteTexture,
      blackTexture: this.blackTexture,
      neutralNormalTexture: this.neutralNormalTexture,
    });
    const surface = namedMesh(this.geometry, surfaceMaterial, 'phase-4-venus-radar-surface');
    root.add(surface);

    const cloudMaterial = createCloudMaterial({
      baseColor: 0xf3c880,
      isVenus: true,
      opacity: 0.96,
      layerPhase: 0,
      whiteTexture: this.whiteTexture,
    });
    const clouds = namedMesh(this.geometry, cloudMaterial, 'phase-4-venus-cloud-deck');
    clouds.scale.setScalar(1.012);
    clouds.renderOrder = 4;
    root.add(clouds);

    const upperCloudMaterial = createCloudMaterial({
      baseColor: 0xffdeb0,
      isVenus: true,
      opacity: 0.20,
      layerPhase: 0.47,
      whiteTexture: this.whiteTexture,
    });
    const secondaryClouds = namedMesh(
      this.geometry,
      upperCloudMaterial,
      'phase-4-venus-upper-cloud-deck',
    );
    secondaryClouds.scale.setScalar(1.018);
    secondaryClouds.renderOrder = 5;
    root.add(secondaryClouds);

    const atmosphereMaterial = createAtmosphereMaterial({
      color: 0xf3d09a,
      luts: this.atmosphereLuts,
      earthLike: false,
      density: 0.85,
      limbPower: 1.52,
      innerFade: 0.28,
      eclipseScatterFloor: 0.3,
      shellRadius: 1.028,
      groundRadius: 1.012,
      name: 'phase-4-venus-pale-haze',
    });
    const atmosphere = namedMesh(this.geometry, atmosphereMaterial, 'phase-4-venus-atmosphere');
    atmosphere.scale.setScalar(1.028);
    atmosphere.renderOrder = 6;
    root.add(atmosphere);

    return {
      bodyId: body.bodyId,
      root,
      surface,
      materials: [surfaceMaterial, cloudMaterial, upperCloudMaterial, atmosphereMaterial],
      coronaShells: [],
      atmosphere,
      clouds,
      secondaryClouds,
      rings: [],
      boundingRadiusMultiplier: 1.028,
      textureBindings: new Map([['radar', [surfaceMaterial]]]),
    };
  }

  private createMars(body: DebugBodyRenderState): PhaseFourBodyVisual {
    const visual = this.createSurfaceOnlyBody(body);
    const dustMaterial = createCloudMaterial({
      baseColor: 0xd58b62,
      isVenus: false,
      isMars: true,
      opacity: 0.11,
      layerPhase: 0.29,
      whiteTexture: this.whiteTexture,
    });
    const dustClouds = namedMesh(this.geometry, dustMaterial, 'phase-4-mars-dust-clouds');
    dustClouds.scale.setScalar(1.009);
    dustClouds.renderOrder = 4;
    visual.root.add(dustClouds);
    const hazeMaterial = createAtmosphereMaterial({
      color: 0xe08a55,
      luts: this.atmosphereLuts,
      earthLike: false,
      density: 0.38,
      limbPower: 1.9,
      innerFade: 0.5,
      eclipseScatterFloor: 0.16,
      shellRadius: 1.025,
      name: 'phase-4-mars-dust-haze',
    });
    const haze = namedMesh(this.atmosphereGeometry, hazeMaterial, 'phase-4-mars-dust-haze');
    haze.scale.setScalar(1.025);
    haze.renderOrder = 5;
    visual.root.add(haze);
    return {
      ...visual,
      materials: [...visual.materials, dustMaterial, hazeMaterial],
      atmosphere: haze,
      boundingRadiusMultiplier: 1.025,
      clouds: dustClouds,
    };
  }

  private createGiantPlanet(body: DebugBodyRenderState): PhaseFourBodyVisual {
    if (!isGiantPlanetId(body.bodyId)) {
      throw new RangeError(`Body "${body.bodyId}" is not a giant planet.`);
    }
    const atmosphereProfile = getGiantAtmosphereProfile(body.bodyId);
    const ringProfile = getRingSystemProfile(body.bodyId);
    const root = namedRoot(body.bodyId);
    const materialBundle = createGiantPlanetMaterialBundle(
      atmosphereProfile,
      this.whiteTexture,
      ringProfile,
    );
    this.generatedTextures.add(materialBundle.jetProfileTexture);
    this.generatedTextures.add(materialBundle.ringProfileTexture);
    const surface = namedMesh(
      this.geometry,
      materialBundle.material,
      `phase-5-${body.bodyId}-cloud-tops`,
    );
    surface.scale.set(
      atmosphereProfile.equatorialRadiusKm / atmosphereProfile.meanRadiusKm,
      atmosphereProfile.polarRadiusKm / atmosphereProfile.meanRadiusKm,
      atmosphereProfile.equatorialRadiusKm / atmosphereProfile.meanRadiusKm,
    );
    root.add(surface);

    const limbShell = giantAtmosphereShell(body.bodyId);
    const atmosphereMaterial = createAtmosphereMaterial({
      color: limbShell.color,
      luts: this.atmosphereLuts,
      earthLike: false,
      density: limbShell.density,
      limbPower: limbShell.limbPower,
      innerFade: limbShell.innerFade,
      eclipseScatterFloor: 0.2,
      shellRadius: limbShell.scale,
      name: `phase-5-${body.bodyId}-limb-atmosphere`,
    });
    const atmosphere = namedMesh(
      this.atmosphereGeometry,
      atmosphereMaterial,
      `phase-5-${body.bodyId}-limb-atmosphere`,
    );
    const atmosphereScale = limbShell.scale;
    atmosphere.scale.set(
      (atmosphereProfile.equatorialRadiusKm / atmosphereProfile.meanRadiusKm) * atmosphereScale,
      (atmosphereProfile.polarRadiusKm / atmosphereProfile.meanRadiusKm) * atmosphereScale,
      (atmosphereProfile.equatorialRadiusKm / atmosphereProfile.meanRadiusKm) * atmosphereScale,
    );
    atmosphere.renderOrder = 6;
    root.add(atmosphere);

    const ringBundle = ringProfile === null
      ? null
      : createRingSystemVisualBundle(
          atmosphereProfile,
          ringProfile,
          materialBundle.ringProfileTexture,
        );
    if (ringBundle !== null) {
      root.add(ringBundle.mesh);
      this.generatedGeometries.add(ringBundle.geometry);
    }
    const rings = ringBundle === null ? [] : [ringBundle.mesh];
    const materials = ringBundle === null
      ? [materialBundle.material, atmosphereMaterial]
      : [materialBundle.material, ringBundle.material, atmosphereMaterial];
    const textureBindings = new Map<BodyTextureChannel, readonly ShaderMaterial[]>();
    if (textureAssetsForBody(body.bodyId).some((asset) => asset.channel === 'albedo')) {
      textureBindings.set('albedo', [materialBundle.material]);
    }
    if (body.bodyId === 'jupiter') {
      textureBindings.set('grs-detail', [materialBundle.material]);
    }

    const surfaceBound =
      atmosphereProfile.equatorialRadiusKm / atmosphereProfile.meanRadiusKm * atmosphereScale;
    return {
      bodyId: body.bodyId,
      root,
      surface,
      materials,
      coronaShells: [],
      atmosphere,
      clouds: null,
      secondaryClouds: null,
      rings,
      boundingRadiusMultiplier: Math.max(
        ringBundle?.boundingRadiusMultiplier ?? surfaceBound,
        surfaceBound,
      ),
      textureBindings,
    };
  }

  private createSurfaceOnlyBody(body: DebugBodyRenderState): PhaseFourBodyVisual {
    const profile = surfaceProfile(body.bodyId);
    const root = namedRoot(body.bodyId);
    const surfaceMaterial = createSurfaceMaterial({
      ...profile,
      whiteTexture: this.whiteTexture,
      blackTexture: this.blackTexture,
      neutralNormalTexture: this.neutralNormalTexture,
    });
    const surface = namedMesh(
      this.geometry,
      surfaceMaterial,
      `phase-4-surface-${body.bodyId}`,
    );
    root.add(surface);
    const textureBindings = new Map<BodyTextureChannel, readonly ShaderMaterial[]>();
    if (textureAssetsForBody(body.bodyId).some((asset) => asset.channel === 'albedo')) {
      textureBindings.set('albedo', [surfaceMaterial]);
    }
    if (textureAssetsForBody(body.bodyId).some((asset) => asset.channel === 'normal')) {
      textureBindings.set('normal', [surfaceMaterial]);
    }
    return {
      bodyId: body.bodyId,
      root,
      surface,
      materials: [surfaceMaterial],
      coronaShells: [],
      atmosphere: null,
      clouds: null,
      secondaryClouds: null,
      rings: [],
      boundingRadiusMultiplier: 1,
      textureBindings,
    };
  }

  private updateOrientation(
    visual: PhaseFourBodyVisual,
    bodyState: DebugBodyRenderState,
    frame: DebugRenderFrame,
  ): void {
    const bodyId = visual.bodyId as EphemerisBodyId;
    const model = EPHEMERIS_ROTATION_MODELS.get(bodyId);
    if (model === undefined) return;
    const earth = bodyId === 'moon'
      ? frame.bodies.find((candidate) => candidate.bodyId === 'earth')
      : undefined;
    model.sample(
      {
        jdTdb: frame.currentJdTdb,
        bodyPositionM: bodyState.positionM,
        bodyVelocityMps: bodyState.velocityMps,
        parentPositionM: earth?.positionM,
        parentVelocityMps: earth?.velocityMps,
      },
      this.rotationState,
    );
    const orientation = this.rotationState.orientation;
    this.sampledOrientation.set(
      orientation.x,
      orientation.y,
      orientation.z,
      orientation.w,
    );
    visual.root.quaternion
      .copy(this.sceneFromInertial)
      .multiply(this.sampledOrientation)
      .multiply(this.meshToBodyLocal);
    visual.surface.quaternion.identity();

    if (visual.clouds !== null) {
      const daysSinceJ2000 = frame.currentJdTdb - 2_451_545;
      const cloudOffset =
        visual.bodyId === 'earth'
          ? daysSinceJ2000 / 0.99726968 * Math.PI * 2 * 0.035
          : visual.bodyId === 'venus'
            ? -daysSinceJ2000 / VENUS_CLOUD_SUPERROTATION_DAYS * Math.PI * 2
            : daysSinceJ2000 / 1.02595675 * Math.PI * 2 * 0.012;
      visual.clouds.quaternion.copy(
        this.scratchSpinQuaternion.setFromAxisAngle(Y_AXIS, cloudOffset),
      );
      visual.secondaryClouds?.quaternion.copy(
        this.scratchSpinQuaternion.setFromAxisAngle(Y_AXIS, cloudOffset + 1.17),
      );
      if (visual.bodyId === 'earth') {
        this.earthCloudAngleRad = normalizeRadians(cloudOffset);
      }
    }
  }

  private sampleOcclusion(
    body: DebugBodyRenderState,
    sun: DebugBodyRenderState,
    bodies: readonly DebugBodyRenderState[],
  ): number {
    let visibleFraction = 1;
    let kind: OcclusionKind = 'none';
    for (const occultor of bodies) {
      if (!occultor.visible || occultor.bodyId === body.bodyId || occultor.bodyId === 'sun') {
        continue;
      }
      sampleAnalyticSphereOcclusion(
        this.occlusionSample,
        body.positionM,
        sun.positionM,
        sun.meanRadiusM,
        occultor.positionM,
        occultor.meanRadiusM,
      );
      if (this.occlusionSample.visibleFraction < visibleFraction) {
        visibleFraction = this.occlusionSample.visibleFraction;
        kind = this.occlusionSample.kind;
      }
    }
    this.occlusionKindByBody.set(body.bodyId, kind);
    return visibleFraction;
  }

  private bindTexture(bodyId: string, channel: BodyTextureChannel, texture: Texture): void {
    const visual = this.visuals.get(bodyId);
    const materials = visual?.textureBindings.get(channel);
    if (materials === undefined) return;
    for (const material of materials) {
      if (channel === 'night') {
        setUniformTexture(material, 'uNightMap', texture);
        setUniformNumber(material, 'uHasNightMap', 1);
      } else if (channel === 'cloud') {
        setUniformTexture(material, 'uCloudMap', texture);
        setUniformNumber(material, 'uHasCloudMap', 1);
      } else if (channel === 'normal') {
        setUniformTexture(material, 'uNormalMap', texture);
        setUniformNumber(material, 'uHasNormalMap', 1);
      } else if (channel === 'ocean') {
        setUniformTexture(material, 'uOceanMap', texture);
        setUniformNumber(material, 'uHasOceanMap', 1);
      } else if (channel === 'roughness') {
        setUniformTexture(material, 'uRoughnessMap', texture);
        setUniformNumber(material, 'uHasRoughnessMap', 1);
      } else if (channel === 'grs-detail') {
        setUniformTexture(material, 'uGrsDetailMap', texture);
        setUniformNumber(material, 'uHasGrsDetailMap', 1);
      } else if (channel === 'observation') {
        setUniformTexture(material, 'uObservationMap', texture);
        setUniformNumber(material, 'uHasObservationMap', 1);
      } else {
        setUniformTexture(material, 'uMap', texture);
        const mapVisible = !(
          bodyId === 'venus' &&
          channel === 'radar' &&
          this.venusSurfaceMode !== 'radar'
        );
        setUniformNumber(material, 'uHasMap', mapVisible ? 1 : 0);
      }
      material.needsUpdate = true;
    }
  }

  private applyQualityToVisual(visual: PhaseFourBodyVisual): void {
    const visibleCoronaShells = coronaShellCount(this.quality);
    visual.coronaShells.forEach((shell, index) => {
      shell.visible = index < visibleCoronaShells;
    });
    for (const material of visual.materials) {
      const lutCapable = (
        material.uniforms.uLutCapable as IUniform<number> | undefined
      )?.value === 1;
      setUniformNumber(
        material,
        'uUseAtmosphereLut',
        lutCapable && usesAtmosphereLut(this.quality) ? 1 : 0,
      );
      setUniformNumber(material, 'uQuality', qualityIndex(this.quality));
      if (isGiantPlanetId(visual.bodyId)) {
        applyGiantPlanetQuality(material, visual.bodyId, this.quality);
      }
    }
  }

  private applyGeometryToVisual(visual: PhaseFourBodyVisual): void {
    visual.surface.geometry = this.geometry;
    for (const shell of visual.coronaShells) shell.geometry = this.coronaGeometry;
    if (visual.atmosphere !== null) visual.atmosphere.geometry = this.atmosphereGeometry;
    if (visual.clouds !== null) visual.clouds.geometry = this.geometry;
    if (visual.secondaryClouds !== null) {
      visual.secondaryClouds.geometry = this.geometry;
    }
  }

  private applyVenusMode(): void {
    const venus = this.visuals.get('venus');
    if (venus === undefined) return;
    // Keep the opaque surface pass as a depth core beneath the two cloud
    // decks. In cloud mode its authored fallback is almost fully concealed,
    // but it prevents stars and orbit lines bleeding through translucent
    // cloud fragments. Radar mode exposes the same pass and its data texture.
    venus.surface.visible = true;
    setUniformNumber(
      venus.surface.material,
      'uHasMap',
      this.venusSurfaceMode === 'radar' &&
        this.loadedTexturesByChannel.has(textureChannelKey('venus', 'radar'))
        ? 1
        : 0,
    );
    if (venus.clouds !== null) venus.clouds.visible = this.venusSurfaceMode === 'clouds';
    if (venus.secondaryClouds !== null) {
      venus.secondaryClouds.visible = this.venusSurfaceMode === 'clouds';
    }
    if (venus.atmosphere !== null) venus.atmosphere.visible = true;
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error('PhaseFourBodyVisualSystem has been disposed.');
  }
}

interface SurfaceMaterialOptions {
  readonly baseColor: number;
  readonly secondaryColor: number;
  readonly profile: number;
  readonly reliefStrength: number;
  readonly roughness: number;
  readonly whiteTexture: Texture;
  readonly blackTexture: Texture;
  readonly neutralNormalTexture: Texture;
}

function createSurfaceMaterial(options: SurfaceMaterialOptions): ShaderMaterial {
  return new ShaderMaterial({
    name: 'phase-4-body-local-surface',
    side: FrontSide,
    transparent: false,
    depthWrite: true,
    uniforms: {
      uImpactCut: { value: new Vector4(0, 0, 0, 2) },
      uMap: { value: options.whiteTexture },
      uNightMap: { value: options.blackTexture },
      uNormalMap: { value: options.neutralNormalTexture },
      uOceanMap: { value: options.blackTexture },
      uRoughnessMap: { value: options.whiteTexture },
      uHasMap: { value: 0 },
      uHasNightMap: { value: 0 },
      uHasNormalMap: { value: 0 },
      uHasOceanMap: { value: 0 },
      uHasRoughnessMap: { value: 0 },
      uSunPositionWorld: { value: new Vector3() },
      uSunDirectionWorld: { value: new Vector3(-1, 0, 0) },
      uSunDirectionBodyLocal: { value: new Vector3(-1, 0, 0) },
      uBaseColor: { value: new Color(options.baseColor) },
      uSecondaryColor: { value: new Color(options.secondaryColor) },
      uProfile: { value: options.profile },
      uReliefStrength: { value: options.reliefStrength },
      uRoughness: { value: options.roughness },
      uOcclusion: { value: 1 },
      uRelativeIrradiance: { value: 1 },
      uTimeDays: { value: 0 },
      uQuality: { value: 2 },
    },
    vertexShader: BODY_VERTEX_SHADER,
    fragmentShader: SURFACE_FRAGMENT_SHADER,
  });
}

interface CloudMaterialOptions {
  readonly baseColor: number;
  readonly isVenus: boolean;
  readonly isMars?: boolean;
  readonly opacity: number;
  readonly layerPhase: number;
  readonly whiteTexture: Texture;
}

function createCloudMaterial(options: CloudMaterialOptions): ShaderMaterial {
  return new ShaderMaterial({
    name: options.isVenus ? 'phase-4-venus-clouds' : 'phase-4-earth-clouds',
    side: FrontSide,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uCloudMap: { value: options.whiteTexture },
      uHasCloudMap: { value: 0 },
      uSunPositionWorld: { value: new Vector3() },
      uSunDirectionWorld: { value: new Vector3(-1, 0, 0) },
      uBaseColor: { value: new Color(options.baseColor) },
      uOpacity: { value: options.opacity },
      uIsVenus: { value: options.isVenus ? 1 : 0 },
      uIsMars: { value: options.isMars === true ? 1 : 0 },
      uLayerPhase: { value: options.layerPhase },
      uOcclusion: { value: 1 },
      uRelativeIrradiance: { value: 1 },
      uTimeDays: { value: 0 },
      uQuality: { value: 2 },
    },
    vertexShader: BODY_VERTEX_SHADER,
    fragmentShader: CLOUD_FRAGMENT_SHADER,
  });
}

function giantAtmosphereShell(bodyId: string): {
  readonly color: number;
  readonly density: number;
  readonly limbPower: number;
  readonly innerFade: number;
  readonly scale: number;
} {
  switch (bodyId) {
    case 'jupiter':
      return {
        color: 0xffd7a0,
        density: 0.95,
        limbPower: 1.4,
        innerFade: 0.26,
        scale: 1.008,
      };
    case 'saturn':
      return {
        color: 0xf0dfb0,
        density: 0.85,
        limbPower: 1.38,
        innerFade: 0.24,
        scale: 1.01,
      };
    case 'uranus':
      return {
        color: 0xa4d2cc,
        density: 1.35,
        limbPower: 1.05,
        innerFade: 0.14,
        scale: 1.014,
      };
    case 'neptune':
      return {
        color: 0x82b8ca,
        density: 1.55,
        limbPower: 0.75,
        innerFade: 0.0,
        // Thin haze above the cloud tops.
        scale: 1.015,
      };
    default:
      return {
        color: 0xa0b4c8,
        density: 0.5,
        limbPower: 1.7,
        innerFade: 0.4,
        scale: 1.03,
      };
  }
}

function createSunMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    name: 'phase-4-sun-photosphere',
    side: FrontSide,
    depthWrite: true,
    uniforms: {
      uTimeDays: { value: 0 },
      uQuality: { value: 2 },
      uSunspotStrength: { value: 0.58 },
      uObservationMap: { value: null },
      uHasObservationMap: { value: 0 },
    },
    vertexShader: BODY_VERTEX_SHADER,
    fragmentShader: SUN_FRAGMENT_SHADER,
  });
}

function createCoronaMaterial(index: number, shellScale: number): ShaderMaterial {
  return new ShaderMaterial({
    name: `phase-4-sun-corona-${index + 1}`,
    side: BackSide,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    uniforms: {
      uTimeDays: { value: 0 },
      uShellScale: { value: shellScale },
      uQuality: { value: 2 },
    },
    vertexShader: CORONA_VERTEX_SHADER,
    fragmentShader: CORONA_FRAGMENT_SHADER,
  });
}

function surfaceProfile(
  bodyId: string,
): Omit<
  SurfaceMaterialOptions,
  'whiteTexture' | 'blackTexture' | 'neutralNormalTexture'
> {
  switch (bodyId) {
    case 'mercury':
      return { baseColor: 0x8f887c, secondaryColor: 0xc0b39f, profile: 0, reliefStrength: 1.8, roughness: 0.82 };
    case 'moon':
      return { baseColor: 0x777777, secondaryColor: 0xb7b4ad, profile: 0, reliefStrength: 2.25, roughness: 0.91 };
    case 'mars':
      return { baseColor: 0x93452f, secondaryColor: 0xd68457, profile: 4, reliefStrength: 1.4, roughness: 0.86 };
    case 'jupiter':
      return { baseColor: 0xb68155, secondaryColor: 0xead0a0, profile: 2, reliefStrength: 0, roughness: 0.76 };
    case 'saturn':
      return { baseColor: 0xbda978, secondaryColor: 0xead9a4, profile: 2, reliefStrength: 0, roughness: 0.8 };
    case 'uranus':
      return { baseColor: 0x70c2c7, secondaryColor: 0xb3e1df, profile: 2, reliefStrength: 0, roughness: 0.7 };
    case 'neptune':
      return { baseColor: 0x315bb4, secondaryColor: 0x7394e5, profile: 2, reliefStrength: 0, roughness: 0.66 };
    default:
      return { baseColor: 0x8f9cab, secondaryColor: 0xc2ccd5, profile: 0, reliefStrength: 0.6, roughness: 0.8 };
  }
}

function namedRoot(bodyId: string): Group {
  const root = new Group();
  root.name = `phase-4-body-${bodyId}`;
  return root;
}

function namedMesh(
  geometry: SphereGeometry,
  material: ShaderMaterial,
  name: string,
): Mesh<SphereGeometry, ShaderMaterial> {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  return mesh;
}

function createQualitySphereGeometry(
  widthSegments: number,
  heightSegments: number,
  quality: VisualQuality,
): SphereGeometry {
  const geometry = new SphereGeometry(1, widthSegments, heightSegments);
  geometry.name = `phase-11-${quality}-shared-sphere-lod`;
  return geometry;
}

function createSolidTexture(data: Uint8Array, name: string): DataTexture {
  const texture = new DataTexture(data, 1, 1, RGBAFormat, UnsignedByteType);
  texture.name = name;
  texture.colorSpace = NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function aggregateAssetState(states: readonly AssetState[]): AssetState | 'procedural' {
  if (states.length === 0) return 'procedural';
  if (states.includes('fallback')) return 'fallback';
  if (states.every((state) => state === 'ready')) return 'ready';
  if (states.some((state) => state === 'loading' || state === 'ready')) return 'loading';
  return 'unrequested';
}

function setUniformNumber(material: ShaderMaterial, name: string, value: number): void {
  const uniform = material.uniforms[name] as IUniform<number> | undefined;
  if (uniform !== undefined) uniform.value = value;
}

function setUniformVector(material: ShaderMaterial, name: string, value: Vector3): void {
  const uniform = material.uniforms[name] as IUniform<Vector3> | undefined;
  uniform?.value.copy(value);
}

function setUniformTexture(material: ShaderMaterial, name: string, value: Texture): void {
  const uniform = material.uniforms[name] as IUniform<Texture> | undefined;
  if (uniform !== undefined) uniform.value = value;
}

function uniformNumber(
  material: ShaderMaterial | undefined,
  name: string,
  fallback: number,
): number {
  const value = (material?.uniforms[name] as IUniform<number> | undefined)?.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function qualityIndex(quality: VisualQuality): number {
  switch (quality) {
    case 'low': return 0;
    case 'medium': return 1;
    case 'high': return 2;
    case 'ultra': return 3;
  }
}

function normalizeRadians(value: number): number {
  const tau = Math.PI * 2;
  return ((value % tau) + tau) % tau;
}

function textureChannelKey(bodyId: string, channel: BodyTextureChannel): string {
  return `${bodyId}:${channel}`;
}

export function disposeBodyVisualMaterials(visual: { readonly materials: readonly Material[] }): void {
  visual.materials.forEach((material) => material.dispose());
}

const BODY_VERTEX_SHADER = /* glsl */ `
  varying vec3 vSurfaceViewPosition;
  varying vec3 vObjectPosition;
  varying vec2 vUv;
  varying float vCameraRadius;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec3 vObjectNormal;
  varying vec3 vBodyNormal;

  void main() {
    vUv = uv;
    vObjectPosition = position;
    vCameraRadius = length(cameraPosition - modelMatrix[3].xyz) / length(modelMatrix[0].xyz);
    vObjectNormal = normalize(normal);
    vBodyNormal = normalize(vec3(normal.x, -normal.z, normal.y));
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vSurfaceViewPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * vec4(vSurfaceViewPosition, 1.0);
  }
`;

const GLSL_NOISE = /* glsl */ `
  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float valueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
          mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
          mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.52;
    for (int i = 0; i < 5; i++) {
      value += amplitude * valueNoise(p);
      p = p * 2.03 + vec3(7.1, 3.7, 5.9);
      amplitude *= 0.49;
    }
    return value;
  }
`;

const SURFACE_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vSurfaceViewPosition;
  uniform vec4 uImpactCut;
  varying vec3 vObjectPosition;
  uniform sampler2D uMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uNormalMap;
  uniform sampler2D uOceanMap;
  uniform sampler2D uRoughnessMap;
  uniform float uHasMap;
  uniform float uHasNightMap;
  uniform float uHasNormalMap;
  uniform float uHasOceanMap;
  uniform float uHasRoughnessMap;
  uniform vec3 uSunPositionWorld;
  uniform vec3 uSunDirectionWorld;
  uniform vec3 uSunDirectionBodyLocal;
  uniform vec3 uBaseColor;
  uniform vec3 uSecondaryColor;
  uniform float uProfile;
  uniform float uReliefStrength;
  uniform float uRoughness;
  uniform float uOcclusion;
  uniform float uRelativeIrradiance;
  uniform float uTimeDays;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec3 vObjectNormal;
  varying vec3 vBodyNormal;
  ${GLSL_NOISE}

  ${EARTH_OCEAN_REFLECTION_GLSL}

  vec3 fallbackAlbedo() {
    float detail = fbm(vObjectNormal * 8.0 + vec3(0.0, uTimeDays * 0.00001, 0.0));
    vec3 result = mix(uBaseColor, uSecondaryColor, detail * 0.8);
    if (uProfile > 0.5 && uProfile < 1.5) {
      float continents = smoothstep(0.46, 0.58, fbm(vObjectNormal * 3.2 + vec3(2.7)));
      vec3 ocean = vec3(0.025, 0.12, 0.23);
      result = mix(ocean, mix(uBaseColor, uSecondaryColor, detail), continents);
    } else if (uProfile > 1.5 && uProfile < 2.5) {
      float latitude = asin(clamp(vObjectNormal.y, -1.0, 1.0));
      float bands = 0.5 + 0.5 * sin(latitude * 29.0 + detail * 3.0);
      result = mix(uBaseColor, uSecondaryColor, bands * 0.72);
    }
    return result;
  }

  vec3 reliefNormal(vec3 baseNormal) {
    if (uHasNormalMap < 0.5 || uReliefStrength <= 0.0) return baseNormal;
    vec3 q0 = dFdx(vWorldPosition);
    vec3 q1 = dFdy(vWorldPosition);
    vec2 st0 = dFdx(vUv);
    vec2 st1 = dFdy(vUv);
    vec3 tangentRaw = q0 * st1.y - q1 * st0.y;
    vec3 bitangentRaw = -q0 * st1.x + q1 * st0.x;
    if (dot(tangentRaw, tangentRaw) < 1e-10 || dot(bitangentRaw, bitangentRaw) < 1e-10) {
      return baseNormal;
    }
    vec3 tangent = normalize(tangentRaw);
    vec3 bitangent = normalize(bitangentRaw);
    vec3 mapped = texture2D(uNormalMap, vUv).xyz * 2.0 - 1.0;
    mapped.xy *= uReliefStrength;
    mapped = normalize(mapped);
    return normalize(mat3(tangent, bitangent, baseNormal) * mapped);
  }

  void main() {
    if(uImpactCut.w < 1.5 && dot(normalize(vObjectPosition),uImpactCut.xyz)>uImpactCut.w) discard;
    vec3 mapColor = texture2D(uMap, vUv).rgb;
    vec3 albedo = uHasMap > 0.5 ? mapColor : fallbackAlbedo();
    if (uProfile > 2.5 && uProfile < 3.5 && uHasMap > 0.5) {
      float radarReturn = dot(mapColor, vec3(0.299, 0.587, 0.114));
      albedo = mix(uBaseColor, uSecondaryColor, smoothstep(0.06, 0.92, radarReturn));
    }
    // The Viking mosaic already contains the observed polar caps.
    if (uProfile > 3.5 && uHasMap < 0.5) {
      float polarCap = smoothstep(0.978, 0.995, abs(vBodyNormal.z));
      albedo = mix(albedo, vec3(0.82, 0.76, 0.66), polarCap * 0.82);
    }
    if (uProfile < 0.5) {
      albedo = mix(albedo, albedo * vec3(0.82, 0.88, 0.96), 0.12);
    }
    vec3 normal = reliefNormal(normalize(vWorldNormal));
    vec3 lightDirection = normalize(uSunDirectionWorld);
    // Interpolate camera-space distances before rotating back to world space.
    // Subtracting AU-scale positions per fragment quantizes a metre-high view.
    vec3 eyeView = normalize(-vSurfaceViewPosition);
    vec3 viewDirection = normalize(vec3(dot(viewMatrix[0].xyz, eyeView),
      dot(viewMatrix[1].xyz, eyeView), dot(viewMatrix[2].xyz, eyeView)));
    vec3 halfDirection = normalize(lightDirection + viewDirection);
    float geometricSolarCosine = dot(normalize(vBodyNormal), normalize(uSunDirectionBodyLocal));
    float nDotL = dot(normal, lightDirection);
    float irradianceScale = clamp(pow(max(uRelativeIrradiance, 0.0001), 0.25), 0.55, 1.8);
    float day = max(nDotL, 0.0) * step(0.0, geometricSolarCosine) * clamp(uOcclusion, 0.0, 1.0) * irradianceScale;
    float ambient = uProfile > 1.5 && uProfile < 3.5 ? 0.075 : 0.028;
    float diffuse = ambient + day * 0.97;
    float fresnel = pow(1.0 - clamp(dot(normal, viewDirection), 0.0, 1.0), 5.0);
    float sampledRoughness = texture2D(uRoughnessMap, vUv).r;
    float surfaceRoughness = mix(uRoughness, sampledRoughness, uHasRoughnessMap);
    float specPower = mix(180.0, 18.0, surfaceRoughness);
    float specular = pow(max(dot(normal, halfDirection), 0.0), specPower) * day;

    float oceanMask = 0.0;
    if (uProfile > 0.5 && uProfile < 1.5) {
      float blueDominance = albedo.b - max(albedo.r, albedo.g) * 0.72;
      // Relative blue dominance also recognizes the almost-black deep ocean.
      // An absolute brightness threshold suppresses its sky reflection.
      float derivedOcean = smoothstep(0.25, 0.55, blueDominance / max(albedo.b, 0.0001))
        * (1.0 - smoothstep(0.05, 0.20, albedo.b));
      oceanMask = max(derivedOcean, texture2D(uOceanMap, vUv).r * uHasOceanMap);
      specular *= oceanMask * 2.8;
      specular += fresnel * oceanMask * day * 0.20;
    } else {
      specular *= 0.06 * (1.0 - surfaceRoughness);
    }

    vec3 color = albedo * diffuse + vec3(1.0, 0.92, 0.72) * specular;
    color += oceanMask * earthOceanSkyReflection(normal, viewDirection, geometricSolarCosine, uOcclusion, irradianceScale);
    if (uProfile > 0.5 && uProfile < 1.5) {
      vec3 night = texture2D(uNightMap, vUv).rgb;
      float nightSide = 1.0 - smoothstep(-0.22, 0.13, geometricSolarCosine);
      color += night * nightSide * uHasNightMap * 2.25;
    }
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const CLOUD_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uCloudMap;
  uniform float uHasCloudMap;
  uniform vec3 uSunPositionWorld;
  uniform vec3 uSunDirectionWorld;
  uniform vec3 uBaseColor;
  uniform float uOpacity;
  uniform float uIsVenus;
  uniform float uIsMars;
  uniform float uLayerPhase;
  uniform float uOcclusion;
  uniform float uRelativeIrradiance;
  uniform float uTimeDays;
  uniform float uQuality;
  varying vec2 vUv;
  varying float vCameraRadius;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec3 vObjectNormal;
  varying vec3 vBodyNormal;
  ${GLSL_NOISE}

  void main() {
    vec2 uv = vUv;
    vec3 bodyNormal = normalize(vBodyNormal);
    float latitude = abs(bodyNormal.z);
    float signedLatitude = asin(clamp(bodyNormal.z, -1.0, 1.0));
    float longitude = atan(bodyNormal.y, bodyNormal.x);
    float venusOscillation = sin(uTimeDays * 1.57079632679) * 0.055;
    float differentialAdvection = uTimeDays * (0.0012 + latitude * 0.0009) +
      uLayerPhase + (uIsVenus > 0.5 ? venusOscillation : 0.0);
    float cloudScale = uIsVenus > 0.5 ? 5.5 : (uIsMars > 0.5 ? 7.0 : 5.0);
    float procedural = fbm(bodyNormal * cloudScale + vec3(differentialAdvection, uLayerPhase * 3.7, 0.0));
    if (uIsVenus > 0.5) {
      float broadCells = fbm(
        bodyNormal * 4.2 +
        vec3(differentialAdvection * 0.7, uLayerPhase * 4.1, -differentialAdvection * 0.4)
      );
      float mesoscaleFlow = fbm(
        bodyNormal * 17.0 +
        vec3(-differentialAdvection * 2.1, uLayerPhase * 11.0, differentialAdvection)
      );
      float fineFlow = mesoscaleFlow;
      if (uQuality > 1.5) {
        fineFlow = fbm(
          bodyNormal * mix(28.0, 42.0, clamp(uQuality - 2.0, 0.0, 1.0)) +
          vec3(uLayerPhase * 17.0, differentialAdvection * 1.6, -differentialAdvection)
        );
      }
      // Integer longitude frequency keeps these observation-inspired
      // chevrons continuous across the equirectangular seam. The restrained
      // contrast evokes UV morphology without claiming measured live weather.
      float chevrons = 0.5 + 0.5 * sin(
        longitude * 2.0 + signedLatitude * 8.0 + broadCells * 4.2 +
        uLayerPhase * 6.28318530718
      );
      float zonalBands = 0.5 + 0.5 * sin(
        signedLatitude * 21.0 + mesoscaleFlow * 3.4 - longitude * 2.0
      );
      float polarHood = smoothstep(0.58, 0.93, latitude);
      procedural = clamp(
        broadCells * 0.22 + mesoscaleFlow * 0.24 + fineFlow * 0.18 +
        chevrons * 0.20 + zonalBands * 0.16 + polarHood * 0.08,
        0.0,
        1.0
      );
    }
    float mapped = dot(texture2D(uCloudMap, uv).rgb, vec3(0.3333));
    float density = mix(procedural, mapped, uHasCloudMap);
    if (uIsVenus > 0.5) {
      density = smoothstep(0.20, 0.88, density);
    } else if (uIsMars > 0.5) {
      density = smoothstep(0.62, 0.88, density);
    } else {
      density = smoothstep(0.18, 0.82, density);
    }
    vec3 normal = normalize(vWorldNormal);
    vec3 lightDirection = normalize(uSunDirectionWorld);
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float irradianceScale = clamp(pow(max(uRelativeIrradiance, 0.0001), 0.25), 0.55, 1.8);
    float solarCosine = dot(normal, lightDirection);
    float day = max(solarCosine, 0.0) * clamp(uOcclusion, 0.0, 1.0) * irradianceScale;
    float limb = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.2);
    float venusTwilight = smoothstep(-0.20, 0.24, solarCosine) *
      clamp(uOcclusion, 0.0, 1.0) * irradianceScale;
    float lighting = uIsVenus > 0.5
      ? 0.18 + day * 0.67 + venusTwilight * 0.15
      : 0.12 + day * 0.88;
    vec3 color = uBaseColor * lighting + uBaseColor * limb * 0.18;
    if (uIsVenus > 0.5) {
      float polarHaze = smoothstep(0.58, 0.92, latitude);
      float absorber = smoothstep(0.30, 0.70, 1.0 - density) * (1.0 - polarHaze * 0.65);
      vec3 uvAbsorberTint = uBaseColor * vec3(0.86, 0.90, 0.94);
      vec3 creamCloud = uBaseColor * vec3(1.18, 1.10, 0.96);
      color = mix(uvAbsorberTint, creamCloud, smoothstep(0.18, 0.88, density));
      color = mix(color, creamCloud * 1.07, polarHaze * 0.42);
      color *= lighting * mix(0.95, 1.02, density);
      color *= 1.0 - absorber * 0.045;
      color += uBaseColor * limb * 0.15;
    }
    float alpha = uIsVenus > 0.5
      ? uOpacity * mix(
          uLayerPhase > 0.1 ? 0.12 : 0.90,
          uLayerPhase > 0.1 ? 0.62 : 0.99,
          density
        )
      : density * uOpacity * (uIsMars > 0.5 ? 0.72 : 0.88);
    // The Earth cloud map is a distant shell, not volumetric cloud interiors.
    // Fade it before a close camera intersects its triangles; the atmosphere
    // continues to render the local sky and horizon at these altitudes.
    if (uIsVenus < 0.5 && uIsMars < 0.5) {
      alpha *= smoothstep(1.015, 1.08, vCameraRadius);
    }
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const SUN_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTimeDays;
  uniform float uQuality;
  uniform float uSunspotStrength;
  uniform sampler2D uObservationMap;
  uniform float uHasObservationMap;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec3 vObjectNormal;
  ${GLSL_NOISE}

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float mu = max(dot(normalize(vWorldNormal), viewDirection), 0.0);
    vec3 photosphereNormal = normalize(vObjectNormal);
    float latitude = abs(photosphereNormal.y);
    float qualityMix = smoothstep(0.5, 3.0, uQuality);
    float granuleScale = mix(38.0, 74.0, qualityMix);
    float granuleFine = valueNoise(
      photosphereNormal * granuleScale + vec3(0.0, uTimeDays * 0.34, 0.0)
    );
    float granuleSubstructure = valueNoise(
      photosphereNormal * granuleScale * 1.71 + vec3(7.0, -uTimeDays * 0.51, 3.0)
    );
    float supergranulation = fbm(
      photosphereNormal * 18.0 - vec3(uTimeDays * 0.016, 0.0, 0.0)
    );
    float laneDistance = abs(granuleFine - 0.5);
    float intergranularLanes = 1.0 - smoothstep(0.035, 0.16, laneDistance);

    float spotField = fbm(photosphereNormal * 4.8 + vec3(11.0, 3.0, 7.0));
    float activeLatitude = 1.0 - smoothstep(0.34, 0.72, latitude);
    float penumbra = smoothstep(0.64, 0.76, spotField) * activeLatitude;
    float umbra = smoothstep(0.74, 0.84, spotField) * activeLatitude;
    float penumbraFilaments = 0.72 + 0.28 * valueNoise(
      photosphereNormal * 84.0 + vec3(2.0, 9.0, 5.0)
    );

    float limbDarkening = 0.36 + 0.64 * pow(mu, 0.58);
    float granulation = 0.90 + (granuleFine - 0.5) * 0.18 +
      (granuleSubstructure - 0.5) * 0.055 + (supergranulation - 0.5) * 0.075;
    granulation *= 1.0 - intergranularLanes * mix(0.025, 0.045, qualityMix);
    vec3 warmCell = vec3(1.0, 0.64, 0.22);
    vec3 hotCell = vec3(1.0, 0.86, 0.50);
    float cellTemperature = clamp(0.46 + (granuleFine - 0.5) * 0.30, 0.0, 1.0);
    vec3 color = mix(warmCell, hotCell, cellTemperature);
    color *= granulation * limbDarkening;
    color *= 1.0 - penumbra * penumbraFilaments *
      clamp(uSunspotStrength, 0.0, 0.9) * 0.72;
    color = mix(
      color,
      vec3(0.12, 0.022, 0.006),
      umbra * clamp(uSunspotStrength, 0.0, 0.9)
    );
    float faculae = penumbra * (1.0 - umbra) * pow(1.0 - mu, 1.7);
    color += vec3(1.0, 0.70, 0.26) * faculae * 0.34;
    color += vec3(1.0, 0.31, 0.045) * pow(1.0 - mu, 7.0) * 0.18;
    // SDO/HMI supplies a dated planar observation, not a global texture. Use it
    // only to recover the observed active-region contrast over the continuous
    // procedural photosphere. Blending its absolute color over one hemisphere
    // makes the sphere look like two joined surfaces because the observation
    // and the modeled far side have different color and exposure responses.
    vec2 observationUv = vec2(0.5) + photosphereNormal.xy * 0.472;
    vec3 observed = texture2D(uObservationMap, observationUv).rgb;
    float observedLuminance = dot(observed, vec3(0.2126, 0.7152, 0.0722));
    float observationCoverage = smoothstep(0.08, 0.30, photosphereNormal.z) *
      uHasObservationMap;
    float observedPenumbra = 1.0 - smoothstep(0.46, 0.59, observedLuminance);
    float observedUmbra = 1.0 - smoothstep(0.12, 0.34, observedLuminance);
    float observedActiveRegion = clamp(
      observedPenumbra * 0.48 + observedUmbra * 0.52,
      0.0,
      1.0
    ) * observationCoverage;
    color *= 1.0 - observedActiveRegion * 0.62;
    color = mix(
      color,
      vec3(0.12, 0.022, 0.006) * limbDarkening,
      observedUmbra * observationCoverage * 0.80
    );
    // Preserve photosphere contrast below the former clipping-heavy output;
    // the separate post-process still supplies a restrained HDR glow.
    gl_FragColor = vec4(color * 1.48, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const CORONA_VERTEX_SHADER = /* glsl */ `
  uniform float uShellScale;
  varying vec3 vPointSolar;
  varying vec3 vCameraSolar;

  void main() {
    // Work in photosphere radii, with camera-relative transforms. A deformed
    // shell normal is not the distance of a viewing ray from the Sun.
    float solarRadiusView = length(modelViewMatrix[0].xyz) / uShellScale;
    vec3 cameraFromCenter = -modelViewMatrix[3].xyz;
    vCameraSolar = vec3(
      dot(cameraFromCenter, normalize(modelViewMatrix[0].xyz)),
      dot(cameraFromCenter, normalize(modelViewMatrix[1].xyz)),
      dot(cameraFromCenter, normalize(modelViewMatrix[2].xyz))
    ) / max(solarRadiusView, 1e-12);
    vPointSolar = position * uShellScale;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CORONA_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTimeDays;
  uniform float uShellScale;
  uniform float uQuality;
  varying vec3 vPointSolar;
  varying vec3 vCameraSolar;
  ${GLSL_NOISE}

  void main() {
    vec3 ray = normalize(vPointSolar - vCameraSolar);
    vec3 perpendicular = cross(vCameraSolar, ray);
    float radiusSolar = length(perpendicular);
    if (radiusSolar < 1.0) discard;

    // Radial structures are anchored to the Sun, rather than to the screen.
    vec3 radial = normalize(cross(ray, perpendicular));
    float time = uTimeDays * 0.0005;
    float equatorial = exp(-abs(radial.y) * 3.8);
    float structure = uQuality > 1.5
      ? fbm(radial * 9.0 + vec3(time, 0.0, 0.0))
      : valueNoise(radial * 9.0 + vec3(time, 0.0, 0.0));
    float streamers = 0.22 + 0.5 * equatorial
      + 1.8 * pow(smoothstep(0.3, 0.78, structure), 3.0);

    float height = radiusSolar - 1.0;
    float limbFade = smoothstep(1.0, 1.018, radiusSolar);
    float outerFade = 1.0 - smoothstep(1.65, uShellScale, radiusSolar);
    float innerGlow = 0.18 * exp(-height * 13.0);
    float outerGlow = 0.065 * exp(-height * 3.3) * streamers;
    float intensity = (innerGlow + outerGlow) * limbFade * outerFade;
    vec3 color = mix(vec3(1.0, 0.91, 0.76), vec3(0.78, 0.87, 1.0),
      smoothstep(0.0, 0.8, height));

    gl_FragColor = vec4(color * intensity, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
