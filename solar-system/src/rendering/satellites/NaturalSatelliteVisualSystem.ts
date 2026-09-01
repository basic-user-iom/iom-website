import {
  BufferGeometry,
  CircleGeometry,
  Color,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LinearFilter,
  Line,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  RepeatWrapping,
  RingGeometry,
  RGBAFormat,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  UnsignedByteType,
  Vector3,
  type Camera,
  type Material,
  type Texture,
} from 'three';

import type { NaturalSatelliteDefinition } from '../../simulation/satellites/NaturalSatelliteCatalog';
import {
  getNaturalSatellitesByParent,
  NATURAL_SATELLITE_DEFINITIONS,
} from '../../simulation/satellites/NaturalSatelliteCatalog';
import {
  sampleNaturalSatellite,
  sampleNaturalSatelliteOrbit,
  isNaturalSatelliteInParentShadow,
} from '../../simulation/satellites/NaturalSatelliteProvider';
import type { DebugBodyRenderState, DebugRenderFrame, PhysicalPosition } from '../RenderContext';
import type { RenderScaleModel } from '../RenderScaleModel';
import {
  projectedSphereRadiusPx,
  selectionCueOpacityForProjectedRadius,
} from '../SelectionCueVisibility';
import { NATURAL_SATELLITE_TEXTURE_ASSETS } from './NaturalSatelliteAssetCatalog';

export interface NaturalSatelliteVisualDiagnostics {
  readonly visible: boolean;
  readonly majorVisible: boolean;
  readonly minorVisible: boolean;
  readonly orbitsVisible: boolean;
  readonly labelsVisible: boolean;
  readonly selectedSatelliteId: string | null;
  readonly majorCount: number;
  readonly namedCount: number;
  readonly minorCount: number;
  readonly renderedMajorCount: number;
  readonly renderedMinorCount: number;
  readonly localScaleApplied: boolean;
  readonly markersNotToScale: boolean;
  readonly eclipsedMajorCount: number;
  readonly transitShadowCount: number;
  readonly visibleLabelCount: number;
  readonly suppressedLabelCount: number;
  readonly officialTextureReadyCount: number;
  readonly officialTextureFallbackCount: number;
  readonly proceduralTextureCount: number;
  readonly selectedRenderRadius: number | null;
  readonly selectedParentRenderRadius: number | null;
  readonly selectedRadiusToParent: number | null;
  readonly selectedOnScreen: boolean;
  readonly selectedCueOpacity: number;
  readonly selectionHaloVisible: boolean;
}

function shapeAxesFor(id: string): Readonly<Vector3> {
  switch (id) {
    case 'phobos': return new Vector3(1, 0.83, 0.72);
    case 'deimos': return new Vector3(1, 0.86, 0.76);
    case 'mimas': return new Vector3(1, 0.96, 0.92);
    case 'hyperion': return new Vector3(1, 0.81, 0.72);
    case 'phoebe': return new Vector3(1, 0.94, 0.89);
    case 'proteus': return new Vector3(1, 0.91, 0.84);
    case 'nereid': return new Vector3(1, 0.96, 0.91);
    default: return new Vector3(1, 1, 1);
  }
}

function createProceduralMoonTexture(definition: Readonly<NaturalSatelliteDefinition>): DataTexture {
  const width = 256;
  const height = 128;
  const pixels = new Uint8Array(width * height * 4);
  let seed = hashText(definition.id);
  const craters = Array.from({ length: 16 }, () => {
    seed = nextSeed(seed);
    const longitude = seed / 0xffffffff * Math.PI * 2 - Math.PI;
    seed = nextSeed(seed);
    const latitude = (seed / 0xffffffff - 0.5) * Math.PI * 0.9;
    seed = nextSeed(seed);
    const radius = 0.035 + seed / 0xffffffff * 0.16;
    return { longitude, latitude, radius };
  });
  const baseHex = PROFILE_COLORS[definition.visualProfile] ?? 0x9bb4c2;
  const base = [
    (baseHex >> 16) & 0xff,
    (baseHex >> 8) & 0xff,
    baseHex & 0xff,
  ] as const;
  for (let y = 0; y < height; y += 1) {
    const latitude = (0.5 - (y + 0.5) / height) * Math.PI;
    for (let x = 0; x < width; x += 1) {
      const longitude = ((x + 0.5) / width - 0.5) * Math.PI * 2;
      const broad = Math.sin(longitude * 3.1 + latitude * 5.7 + seed * 1e-7) * 0.08;
      const fine = hash2d(x, y, seed) * 0.17 - 0.085;
      let shade = 0.92 + broad + fine;
      for (const crater of craters) {
        const dx = wrappedLongitude(longitude - crater.longitude) * Math.cos(latitude);
        const dy = latitude - crater.latitude;
        const distance = Math.hypot(dx, dy);
        const rimWidth = crater.radius * 0.18;
        const rim = Math.exp(-((distance - crater.radius) ** 2) / Math.max(rimWidth ** 2, 1e-6));
        const bowl = Math.max(0, 1 - distance / crater.radius);
        shade += rim * 0.13 - bowl * 0.17;
      }
      const offset = (y * width + x) * 4;
      pixels[offset] = clampByte(base[0] * shade);
      pixels[offset + 1] = clampByte(base[1] * shade);
      pixels[offset + 2] = clampByte(base[2] * shade);
      pixels[offset + 3] = 255;
    }
  }
  const texture = new DataTexture(pixels, width, height, RGBAFormat, UnsignedByteType);
  texture.name = `procedural-coverage-fallback-${definition.id}`;
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function hashText(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function nextSeed(value: number): number {
  return (Math.imul(value, 1_664_525) + 1_013_904_223) >>> 0;
}

function hash2d(x: number, y: number, seed: number): number {
  let value = Math.imul(x + 1, 374_761_393) ^ Math.imul(y + 1, 668_265_263) ^ seed;
  value = Math.imul(value ^ (value >>> 13), 1_274_126_177);
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
}

function wrappedLongitude(value: number): number {
  return ((value + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}

function normalizeRotation(value: number): number {
  return ((value % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

interface MajorResource {
  readonly definition: NaturalSatelliteDefinition;
  readonly mesh: Mesh<SphereGeometry, MeshStandardMaterial>;
  readonly orbit: Line<BufferGeometry, LineBasicMaterial>;
  readonly shapeAxes: Readonly<Vector3>;
  label: HTMLSpanElement | null;
}

interface MinorResource {
  readonly definitions: readonly NaturalSatelliteDefinition[];
  readonly mesh: InstancedMesh<SphereGeometry, MeshStandardMaterial>;
}

interface LabelCandidate {
  readonly resource: MajorResource;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly priority: number;
}

const ZERO: PhysicalPosition = Object.freeze({ x: 0, y: 0, z: 0 });
const LOCAL = new Vector3();
const PARENT_POSITION = new Vector3();
const INSTANCE_HELPER = new Mesh();
const INSTANCE_MATRIX = new Matrix4();
const WHITE = new Color(0xffffff);
const SUN_DIRECTION = new Vector3();
const SHADOW_PERPENDICULAR = new Vector3();
const SHADOW_SURFACE = new Vector3();
const SHADOW_NORMAL = new Vector3(0, 0, 1);
const PROFILE_COLORS: Readonly<Record<string, number>> = Object.freeze({
  'lunar-rocky': 0xb9b8b0,
  'phobos-irregular': 0x5a4e46,
  'deimos-irregular': 0x76645b,
  'io-sulfurous': 0xd5a62e,
  'europa-ice': 0xbac8d6,
  'ganymede-grooved-ice': 0x8e8274,
  'callisto-cratered': 0x625b55,
  'mimas-ice': 0xcbd5dd,
  'enceladus-ice-plume': 0xe1eef4,
  'tethys-ice': 0xcad3dc,
  'dione-ice': 0xbac5ce,
  'rhea-ice': 0xc3c9d1,
  'titan-haze': 0xc79455,
  'hyperion-irregular': 0x765f52,
  'iapetus-two-tone': 0x5e5a50,
  'phoebe-irregular': 0x514c48,
  'miranda-varied-terrain': 0x9b9a94,
  'ariel-ice': 0xadc1c6,
  'umbriel-dark-ice': 0x777d80,
  'titania-ice': 0xa5b9be,
  'oberon-ice': 0x929da2,
  'triton-nitrogen-ice': 0xb7d2dc,
  'proteus-irregular': 0x555e68,
  'nereid-irregular': 0x9a9ca0,
  'minor-point-fallback': 0x8ac9df,
});

/** Draws natural satellites without allocating one React object or DOM label per moon. */
export class NaturalSatelliteVisualSystem {
  public readonly root = new Group();
  private readonly geometry = new SphereGeometry(1, 48, 32);
  private readonly textureLoader = new TextureLoader();
  private readonly major = new Map<string, MajorResource>();
  private readonly minor = new Map<string, MinorResource>();
  private readonly worldPositions = new Map<string, Vector3>();
  private readonly renderedRadii = new Map<string, number>();
  private readonly parentRenderedRadii = new Map<string, number>();
  private readonly officialTextureStates = new Map<string, 'loading' | 'ready' | 'fallback'>();
  private readonly loadedTextures = new Set<Texture>();
  private readonly proceduralTextures = new Set<DataTexture>();
  private readonly transitShadows = new Map<string, Mesh<CircleGeometry, MeshBasicMaterial>>();
  private readonly selectionHalo: Mesh<RingGeometry, MeshBasicMaterial>;
  private compactSelectionLabel: HTMLSpanElement | null = null;
  private selectionScreenIndicator: HTMLSpanElement | null = null;
  private visible = true;
  private majorVisible = true;
  private minorVisible = true;
  private orbitsVisible = true;
  private labelsVisible = true;
  private selectedSatelliteId: string | null = null;
  private localScaleApplied = false;
  private labelContainer: HTMLElement | null = null;
  private selectedParentId = 'sun';
  private eclipsedMajorCount = 0;
  private transitShadowCount = 0;
  private visibleLabelCount = 0;
  private suppressedLabelCount = 0;
  private selectedOnScreen = false;
  private selectedCueOpacity = 0;

  public constructor() {
    this.root.name = 'natural-satellite-layer';
    this.root.renderOrder = 4;
    for (const definition of NATURAL_SATELLITE_DEFINITIONS) {
      if (definition.id === 'moon') continue;
      if (definition.tier === 'major') this.createMajor(definition);
    }
    for (const parentId of ['mars', 'jupiter', 'saturn', 'uranus', 'neptune']) {
      const definitions = getNaturalSatellitesByParent(parentId, 'minor-point');
      if (definitions.length === 0) continue;
      const mesh = new InstancedMesh(
        this.geometry,
        new MeshStandardMaterial({
          color: PROFILE_COLORS['minor-point-fallback'],
          emissive: new Color(PROFILE_COLORS['minor-point-fallback']).multiplyScalar(0.22),
          emissiveIntensity: 0.18,
          roughness: 0.86,
          metalness: 0,
        }),
        definitions.length,
      );
      mesh.name = `natural-satellites-${parentId}-minor-points`;
      mesh.frustumCulled = false;
      this.root.add(mesh);
      this.minor.set(parentId, { definitions, mesh });
    }
    this.selectionHalo = new Mesh(
      new RingGeometry(1.2, 1.3, 48),
      new MeshBasicMaterial({
        color: 0x72d8ff,
        transparent: true,
        opacity: 0.82,
        side: DoubleSide,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.selectionHalo.name = 'natural-satellite-selection-halo';
    this.selectionHalo.visible = false;
    this.selectionHalo.renderOrder = 8;
    this.root.add(this.selectionHalo);
    for (const satelliteId of ['io', 'europa', 'ganymede', 'callisto']) {
      const shadow = new Mesh(
        new CircleGeometry(1, 32),
        new MeshBasicMaterial({
          color: 0x020508,
          transparent: true,
          opacity: 0.62,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
      );
      shadow.name = `jupiter-transit-shadow-${satelliteId}`;
      shadow.visible = false;
      shadow.renderOrder = 5;
      this.root.add(shadow);
      this.transitShadows.set(satelliteId, shadow);
    }
    INSTANCE_HELPER.rotation.set(0, 0, 0);
    this.loadOfficialTextures();
  }

  public setLabelContainer(container: HTMLElement | null): void {
    this.compactSelectionLabel?.remove();
    this.selectionScreenIndicator?.remove();
    this.labelContainer = container;
    for (const resource of this.major.values()) {
      resource.label?.remove();
      resource.label = this.labelContainer === null ? null : this.createLabel(resource.definition);
    }
    this.compactSelectionLabel = null;
    this.selectionScreenIndicator = null;
    if (container !== null) {
      const label = document.createElement('span');
      label.className = 'natural-satellite-screen-label compact-satellite-selection-label';
      label.dataset.selected = 'true';
      label.setAttribute('aria-hidden', 'true');
      container.append(label);
      this.compactSelectionLabel = label;

      const indicator = document.createElement('span');
      indicator.className = 'body-selection-indicator auxiliary-selection-indicator natural-satellite-selection-indicator';
      indicator.dataset.testid = 'selected-natural-satellite-marker';
      indicator.setAttribute('aria-hidden', 'true');
      container.append(indicator);
      this.selectionScreenIndicator = indicator;
    }
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.visible = visible;
  }

  public setMajorVisible(visible: boolean): void {
    this.majorVisible = visible;
  }

  public setMinorVisible(visible: boolean): void {
    this.minorVisible = visible;
  }

  public setOrbitsVisible(visible: boolean): void {
    this.orbitsVisible = visible;
  }

  public setLabelsVisible(visible: boolean): void {
    this.labelsVisible = visible;
  }

  public selectSatellite(id: string | null): void {
    this.selectedSatelliteId = id;
    for (const resource of this.major.values()) {
      resource.mesh.material.emissiveIntensity = resource.definition.id === id ? 0.34 : 0.04;
    }
  }

  public getSatelliteWorldPosition(id: string): Vector3 | null {
    return this.worldPositions.get(id)?.clone() ?? null;
  }

  public getSatelliteRenderRadius(id: string): number | null {
    return this.renderedRadii.get(id) ?? null;
  }

  public updateFrame(
    frame: Readonly<DebugRenderFrame>,
    scaleModel: Readonly<RenderScaleModel>,
    originM: Readonly<PhysicalPosition>,
    selectedParentId: string,
  ): void {
    if (!this.visible) {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    const parentById = new Map(frame.bodies.map((body) => [body.bodyId, body]));
    const sun = parentById.get('sun');
    this.selectedParentId = selectedParentId;
    this.eclipsedMajorCount = 0;
    this.transitShadowCount = 0;
    for (const shadow of this.transitShadows.values()) shadow.visible = false;
    this.localScaleApplied = false;
    this.worldPositions.clear();
    this.renderedRadii.clear();
    this.parentRenderedRadii.clear();
    for (const resource of this.major.values()) {
      const parent = parentById.get(resource.definition.parentId);
      if (parent === undefined || !parent.visible) {
        resource.mesh.visible = false;
        resource.orbit.visible = false;
        continue;
      }
      const localScale = this.localOrbitScale(resource.definition, parent, scaleModel, selectedParentId);
      this.parentRenderedRadii.set(parent.bodyId, scaleModel.radiusFor(parent));
      this.localScaleApplied ||= localScale > 1.0001;
      scaleModel.mapPosition(PARENT_POSITION, parent.positionM, originM);
      const state = sampleNaturalSatellite(resource.definition, frame.currentJdTdb);
      const parentToSun = sun === undefined
        ? ZERO
        : { x: sun.positionM.x - parent.positionM.x, y: sun.positionM.y - parent.positionM.y, z: sun.positionM.z - parent.positionM.z };
      const eclipsed = sun !== undefined && isNaturalSatelliteInParentShadow(state, parent.meanRadiusM, parentToSun);
      if (eclipsed) this.eclipsedMajorCount += 1;
      resource.mesh.material.color.copy(WHITE).multiplyScalar(eclipsed ? 0.16 : 1);
      resource.mesh.material.emissiveIntensity = eclipsed
        ? 0.004
        : resource.definition.id === this.selectedSatelliteId ? 0.055 : 0.008;
      this.mapLocalOffset(LOCAL, state.positionM, scaleModel, localScale);
      resource.mesh.position.copy(PARENT_POSITION).add(LOCAL);
      const markerRadius = this.displayedMajorRadius(resource.definition, parent, scaleModel, selectedParentId);
      resource.mesh.scale.set(
        markerRadius * resource.shapeAxes.x,
        markerRadius * resource.shapeAxes.y,
        markerRadius * resource.shapeAxes.z,
      );
      resource.mesh.rotation.y = normalizeRotation(
        (frame.currentJdTdb - 2_451_545) * 86_400 / resource.definition.rotationPeriodSeconds * Math.PI * 2,
      );
      resource.mesh.visible = this.majorVisible;
      if (resource.mesh.visible) {
        this.recordWorldPosition(resource.definition.id, resource.mesh.position);
        this.renderedRadii.set(resource.definition.id, markerRadius);
      }
      this.updateOrbit(resource.orbit, resource.definition, parent, frame.currentJdTdb, scaleModel, originM, localScale);
      if (parent.bodyId === 'jupiter' && sun !== undefined) {
        this.updateJupiterTransitShadow(resource, state, parent, parentToSun, scaleModel);
      }
    }
    for (const [parentId, resource] of this.minor) {
      const parent = parentById.get(parentId);
      if (parent === undefined || !parent.visible) {
        resource.mesh.visible = false;
        continue;
      }
      const localScale = this.localOrbitScale(resource.definitions[0]!, parent, scaleModel, selectedParentId);
      this.parentRenderedRadii.set(parent.bodyId, scaleModel.radiusFor(parent));
      this.localScaleApplied ||= localScale > 1.0001;
      scaleModel.mapPosition(PARENT_POSITION, parent.positionM, originM);
      resource.definitions.forEach((definition, index) => {
        const state = sampleNaturalSatellite(definition, frame.currentJdTdb);
        this.mapLocalOffset(LOCAL, state.positionM, scaleModel, localScale);
        INSTANCE_HELPER.position.copy(PARENT_POSITION).add(LOCAL);
        const parentRadius = scaleModel.radiusFor(parent);
        const markerRadius = definition.id === this.selectedSatelliteId
          ? 0.00018
          : scaleModel.mode === 'presentation'
            ? Math.min(0.00042, Math.max(0.000045, parentRadius * 0.0022))
            : Math.max(definition.physicalRadiusM * scaleModel.metersToRenderUnits, 0.000002);
        INSTANCE_HELPER.scale.setScalar(markerRadius);
        INSTANCE_HELPER.updateMatrix();
        INSTANCE_MATRIX.copy(INSTANCE_HELPER.matrix);
        resource.mesh.setMatrixAt(index, INSTANCE_MATRIX);
        if (definition.id === this.selectedSatelliteId) {
          this.recordWorldPosition(definition.id, INSTANCE_HELPER.position);
          this.renderedRadii.set(definition.id, markerRadius);
        }
      });
      resource.mesh.instanceMatrix.needsUpdate = true;
      resource.mesh.visible = this.minorVisible;
    }
    const selectedPosition = this.selectedSatelliteId === null
      ? undefined
      : this.worldPositions.get(this.selectedSatelliteId);
    const selectedRadius = this.selectedSatelliteId === null
      ? undefined
      : this.renderedRadii.get(this.selectedSatelliteId);
    this.selectionHalo.visible = selectedPosition !== undefined && selectedRadius !== undefined;
    if (selectedPosition !== undefined && selectedRadius !== undefined) {
      this.selectionHalo.position.copy(selectedPosition);
      this.selectionHalo.scale.setScalar(selectedRadius);
    }
  }

  public updateLabels(
    camera: Camera,
    viewportWidth: number,
    viewportHeight: number,
    suppressed = false,
  ): void {
    const selectedPosition = this.selectedSatelliteId === null
      ? undefined
      : this.worldPositions.get(this.selectedSatelliteId);
    const selectedRadius = this.selectedSatelliteId === null
      ? undefined
      : this.renderedRadii.get(this.selectedSatelliteId);
    const projectedRadiusPx = selectedPosition === undefined || selectedRadius === undefined
      ? 0
      : projectedSphereRadiusPx(
          camera,
          selectedPosition,
          selectedRadius,
          viewportWidth,
          viewportHeight,
        );
    this.selectedCueOpacity = suppressed || selectedPosition === undefined || selectedRadius === undefined
      ? 0
      : selectionCueOpacityForProjectedRadius(projectedRadiusPx);
    this.selectionHalo.visible = selectedPosition !== undefined && selectedRadius !== undefined &&
      this.selectedCueOpacity > 0.001;
    this.selectionHalo.material.opacity = 0.82 * this.selectedCueOpacity;
    if (this.selectionHalo.visible) this.selectionHalo.quaternion.copy(camera.quaternion);
    this.visibleLabelCount = 0;
    this.suppressedLabelCount = 0;
    const candidates: LabelCandidate[] = [];
    for (const resource of this.major.values()) {
      if (resource.label === null) continue;
      if (suppressed || !this.labelsVisible || !resource.mesh.visible) {
        resource.label.style.opacity = '0';
        continue;
      }
      const projected = resource.mesh.position.clone().project(camera);
      const onScreen = projected.z >= -1 && projected.z <= 1 && projected.x >= -1.05 && projected.x <= 1.05 && projected.y >= -1.05 && projected.y <= 1.05;
      if (!onScreen) {
        resource.label.style.opacity = '0';
        continue;
      }
      const x = (projected.x * 0.5 + 0.5) * viewportWidth + 8;
      const y = (-projected.y * 0.5 + 0.5) * viewportHeight;
      const selected = resource.definition.id === this.selectedSatelliteId;
      candidates.push({
        resource,
        x,
        y,
        width: Math.max(42, resource.definition.name.length * 7 + 18),
        height: 22,
        priority: selected ? 2 : resource.definition.parentId === this.selectedParentId ? 1 : 0,
      });
    }
    candidates.sort((left, right) => right.priority - left.priority || left.resource.definition.id.localeCompare(right.resource.definition.id));
    const occupied: Array<Readonly<{ left: number; right: number; top: number; bottom: number }>> = [];
    for (const candidate of candidates) {
      const selected = candidate.resource.definition.id === this.selectedSatelliteId;
      const bounds = {
        left: candidate.x - 4,
        right: candidate.x + candidate.width,
        top: candidate.y - candidate.height * 0.5,
        bottom: candidate.y + candidate.height * 0.5,
      };
      const collides = !selected && occupied.some((other) =>
        bounds.left < other.right && bounds.right > other.left && bounds.top < other.bottom && bounds.bottom > other.top);
      if (collides) {
        candidate.resource.label!.style.opacity = '0';
        this.suppressedLabelCount += 1;
        continue;
      }
      occupied.push(bounds);
      candidate.resource.label!.style.opacity = selected ? '1' : '0.72';
      candidate.resource.label!.style.transform = `translate(${candidate.x}px, ${candidate.y}px) translate(0, -50%)`;
      candidate.resource.label!.dataset.selected = String(selected);
      this.visibleLabelCount += 1;
    }
    this.updateSelectedScreenCue(
      camera,
      viewportWidth,
      viewportHeight,
      suppressed,
      projectedRadiusPx,
      this.selectedCueOpacity,
    );
  }

  public getDiagnostics(): NaturalSatelliteVisualDiagnostics {
    const majorCount = NATURAL_SATELLITE_DEFINITIONS.filter((item) => item.tier === 'major').length;
    const namedCount = NATURAL_SATELLITE_DEFINITIONS.filter((item) => item.tier === 'named').length;
    const minorCount = NATURAL_SATELLITE_DEFINITIONS.filter((item) => item.tier === 'minor-point').length;
    const selectedDefinition = this.selectedSatelliteId === null
      ? undefined
      : NATURAL_SATELLITE_DEFINITIONS.find((item) => item.id === this.selectedSatelliteId);
    const selectedRenderRadius = this.selectedSatelliteId === null
      ? undefined
      : this.renderedRadii.get(this.selectedSatelliteId);
    const selectedParentRenderRadius = selectedDefinition === undefined
      ? undefined
      : this.parentRenderedRadii.get(selectedDefinition.parentId);
    return Object.freeze({
      visible: this.visible,
      majorVisible: this.majorVisible,
      minorVisible: this.minorVisible,
      orbitsVisible: this.orbitsVisible,
      labelsVisible: this.labelsVisible,
      selectedSatelliteId: this.selectedSatelliteId,
      majorCount,
      namedCount,
      minorCount,
      renderedMajorCount: [...this.major.values()].filter((resource) => resource.mesh.visible).length,
      renderedMinorCount: [...this.minor.values()].reduce((count, resource) => count + (resource.mesh.visible ? resource.definitions.length : 0), 0),
      localScaleApplied: this.localScaleApplied,
      markersNotToScale: true,
      eclipsedMajorCount: this.eclipsedMajorCount,
      transitShadowCount: this.transitShadowCount,
      visibleLabelCount: this.visibleLabelCount,
      suppressedLabelCount: this.suppressedLabelCount,
      officialTextureReadyCount: [...this.officialTextureStates.values()].filter((state) => state === 'ready').length,
      officialTextureFallbackCount: [...this.officialTextureStates.values()].filter((state) => state === 'fallback').length,
      proceduralTextureCount: this.proceduralTextures.size,
      selectedRenderRadius: selectedRenderRadius ?? null,
      selectedParentRenderRadius: selectedParentRenderRadius ?? null,
      selectedRadiusToParent: selectedRenderRadius !== undefined && selectedParentRenderRadius !== undefined
        ? selectedRenderRadius / selectedParentRenderRadius
        : null,
      selectedOnScreen: this.selectedOnScreen,
      selectedCueOpacity: this.selectedCueOpacity,
      selectionHaloVisible: this.selectionHalo.visible,
    });
  }

  public dispose(): void {
    this.root.traverse((object) => {
      const renderable = object as typeof object & { geometry?: BufferGeometry; material?: Material | Material[] };
      renderable.geometry?.dispose();
      if (Array.isArray(renderable.material)) renderable.material.forEach((material) => material.dispose());
      else renderable.material?.dispose();
    });
    for (const resource of this.major.values()) resource.label?.remove();
    this.compactSelectionLabel?.remove();
    this.selectionScreenIndicator?.remove();
    this.compactSelectionLabel = null;
    this.selectionScreenIndicator = null;
    for (const texture of this.loadedTextures) texture.dispose();
    for (const texture of this.proceduralTextures) texture.dispose();
    this.loadedTextures.clear();
    this.proceduralTextures.clear();
    this.worldPositions.clear();
    this.renderedRadii.clear();
    this.parentRenderedRadii.clear();
    this.root.clear();
    this.major.clear();
    this.minor.clear();
  }

  private updateSelectedScreenCue(
    camera: Camera,
    viewportWidth: number,
    viewportHeight: number,
    suppressed: boolean,
    projectedRadiusPx: number,
    cueOpacity: number,
  ): void {
    const id = this.selectedSatelliteId;
    const definition = id === null
      ? undefined
      : NATURAL_SATELLITE_DEFINITIONS.find((item) => item.id === id);
    const position = id === null ? undefined : this.worldPositions.get(id);
    if (suppressed || definition === undefined || position === undefined) {
      this.hideSelectedScreenCue();
      return;
    }
    const selectedId = definition.id;
    const projected = position.clone().project(camera);
    const onScreen = projected.z >= -1 && projected.z <= 1
      && projected.x >= -1.05 && projected.x <= 1.05
      && projected.y >= -1.05 && projected.y <= 1.05;
    this.selectedOnScreen = onScreen;
    if (!onScreen) {
      this.hideSelectedScreenCue(false);
      return;
    }
    const x = (projected.x * 0.5 + 0.5) * viewportWidth;
    const y = (-projected.y * 0.5 + 0.5) * viewportHeight;
    if (this.selectionScreenIndicator !== null) {
      this.selectionScreenIndicator.dataset.satelliteId = selectedId;
      this.selectionScreenIndicator.dataset.projectedRadiusPx = projectedRadiusPx.toFixed(2);
      this.selectionScreenIndicator.dataset.proximityHidden = String(cueOpacity <= 0.001);
      this.selectionScreenIndicator.style.opacity = cueOpacity.toFixed(3);
      this.selectionScreenIndicator.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
    const compactSelected = definition.tier !== 'major';
    if (this.compactSelectionLabel !== null) {
      this.compactSelectionLabel.textContent = definition.name;
      if (compactSelected) this.compactSelectionLabel.dataset.satelliteId = selectedId;
      else delete this.compactSelectionLabel.dataset.satelliteId;
      this.compactSelectionLabel.style.opacity = compactSelected ? '1' : '0';
      this.compactSelectionLabel.style.transform = `translate(${x + 14}px, ${y - 14}px)`;
      if (compactSelected) this.visibleLabelCount += 1;
    }
  }

  private hideSelectedScreenCue(resetOnScreen = true): void {
    if (resetOnScreen) this.selectedOnScreen = false;
    if (this.compactSelectionLabel !== null) this.compactSelectionLabel.style.opacity = '0';
    if (this.selectionScreenIndicator !== null) this.selectionScreenIndicator.style.opacity = '0';
  }

  private createMajor(definition: NaturalSatelliteDefinition): void {
    const fallbackTexture = createProceduralMoonTexture(definition);
    this.proceduralTextures.add(fallbackTexture);
    const material = new MeshStandardMaterial({
      color: 0xffffff,
      map: fallbackTexture,
      roughness: definition.visualProfile.includes('ice') ? 0.72 : 0.88,
      metalness: 0,
      emissive: new Color(0x161616),
      emissiveIntensity: 0.008,
    });
    const mesh = new Mesh(this.geometry, material);
    mesh.name = `natural-satellite-${definition.id}`;
    mesh.userData.satelliteId = definition.id;
    mesh.frustumCulled = false;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(96 * 3), 3));
    const orbit = new Line(geometry, new LineBasicMaterial({ color: PROFILE_COLORS[definition.visualProfile] ?? 0x7fbfd9, transparent: true, opacity: 0.38 }));
    orbit.name = `natural-satellite-orbit-${definition.id}`;
    orbit.frustumCulled = false;
    this.root.add(orbit, mesh);
    this.major.set(definition.id, {
      definition,
      mesh,
      orbit,
      shapeAxes: shapeAxesFor(definition.id),
      label: this.labelContainer === null ? null : this.createLabel(definition),
    });
  }

  private loadOfficialTextures(): void {
    for (const asset of NATURAL_SATELLITE_TEXTURE_ASSETS) {
      const resource = this.major.get(asset.satelliteId);
      if (resource === undefined) continue;
      this.officialTextureStates.set(asset.satelliteId, 'loading');
      this.textureLoader.load(
        asset.file,
        (texture) => {
          const fallbackTexture = resource.mesh.material.map;
          if (fallbackTexture instanceof DataTexture && this.proceduralTextures.has(fallbackTexture)) {
            fallbackTexture.dispose();
            this.proceduralTextures.delete(fallbackTexture);
          }
          texture.name = asset.assetId;
          texture.colorSpace = SRGBColorSpace;
          texture.wrapS = RepeatWrapping;
          texture.minFilter = LinearFilter;
          texture.magFilter = LinearFilter;
          texture.needsUpdate = true;
          this.loadedTextures.add(texture);
          resource.mesh.material.map = texture;
          resource.mesh.material.needsUpdate = true;
          this.officialTextureStates.set(asset.satelliteId, 'ready');
        },
        undefined,
        () => this.officialTextureStates.set(asset.satelliteId, 'fallback'),
      );
    }
  }

  private recordWorldPosition(id: string, position: Readonly<Vector3>): void {
    const existing = this.worldPositions.get(id);
    if (existing === undefined) this.worldPositions.set(id, new Vector3(position.x, position.y, position.z));
    else existing.copy(position);
  }

  private displayedMajorRadius(
    definition: Readonly<NaturalSatelliteDefinition>,
    parent: Readonly<DebugBodyRenderState>,
    scaleModel: Readonly<RenderScaleModel>,
    selectedParentId: string,
  ): number {
    const physicalRadius = definition.physicalRadiusM * scaleModel.metersToRenderUnits;
    if (scaleModel.mode !== 'presentation') return physicalRadius;
    const parentRadius = scaleModel.radiusFor(parent);
    const parentExaggeration = parentRadius /
      Math.max(parent.meanRadiusM * scaleModel.metersToRenderUnits, 1e-12);
    const relativeRadius = physicalRadius * parentExaggeration;
    const minimumFraction = definition.id === this.selectedSatelliteId
      ? 0.018
      : selectedParentId === parent.bodyId ? 0.009 : 0.0035;
    return Math.min(parentRadius * 0.065, Math.max(relativeRadius, parentRadius * minimumFraction));
  }

  private createLabel(definition: NaturalSatelliteDefinition): HTMLSpanElement {
    const label = document.createElement('span');
    label.className = 'natural-satellite-screen-label';
    label.textContent = definition.name;
    label.dataset.satelliteId = definition.id;
    label.setAttribute('aria-hidden', 'true');
    this.labelContainer?.append(label);
    return label;
  }

  private updateOrbit(
    orbit: Line<BufferGeometry, LineBasicMaterial>,
    definition: NaturalSatelliteDefinition,
    parent: Readonly<DebugBodyRenderState>,
    jdTdb: number,
    scaleModel: Readonly<RenderScaleModel>,
    originM: Readonly<PhysicalPosition>,
    localScale: number,
  ): void {
    const attribute = orbit.geometry.getAttribute('position') as Float32BufferAttribute;
    const array = attribute.array as Float32Array;
    const positions = sampleNaturalSatelliteOrbit(definition, jdTdb, definition.id === 'nereid' || definition.id === 'phoebe' ? 0.35 : 1, 96);
    scaleModel.mapPosition(PARENT_POSITION, parent.positionM, originM);
    for (let index = 0; index < 96; index += 1) {
      this.mapLocalOffset(LOCAL, {
        x: positions[index * 3] ?? 0,
        y: positions[index * 3 + 1] ?? 0,
        z: positions[index * 3 + 2] ?? 0,
      }, scaleModel, localScale);
      array[index * 3] = PARENT_POSITION.x + LOCAL.x;
      array[index * 3 + 1] = PARENT_POSITION.y + LOCAL.y;
      array[index * 3 + 2] = PARENT_POSITION.z + LOCAL.z;
    }
    attribute.needsUpdate = true;
    orbit.visible = this.majorVisible && this.orbitsVisible && this.visible;
  }

  private updateJupiterTransitShadow(
    resource: Readonly<MajorResource>,
    state: ReturnType<typeof sampleNaturalSatellite>,
    parent: Readonly<DebugBodyRenderState>,
    parentToSunM: Readonly<PhysicalPosition>,
    scaleModel: Readonly<RenderScaleModel>,
  ): void {
    const shadow = this.transitShadows.get(resource.definition.id);
    if (shadow === undefined || !this.majorVisible) return;
    SUN_DIRECTION.set(parentToSunM.x, parentToSunM.y, parentToSunM.z);
    if (SUN_DIRECTION.lengthSq() === 0) return;
    SUN_DIRECTION.normalize();
    LOCAL.set(state.positionM.x, state.positionM.y, state.positionM.z);
    const sunwardDistance = LOCAL.dot(SUN_DIRECTION);
    if (sunwardDistance <= parent.meanRadiusM) return;
    SHADOW_PERPENDICULAR.copy(LOCAL).addScaledVector(SUN_DIRECTION, -sunwardDistance);
    const perpendicularDistanceSq = SHADOW_PERPENDICULAR.lengthSq();
    const parentRadiusSq = parent.meanRadiusM ** 2;
    if (perpendicularDistanceSq >= parentRadiusSq) return;
    const surfaceAxialDistance = Math.sqrt(parentRadiusSq - perpendicularDistanceSq);
    SHADOW_SURFACE.copy(SHADOW_PERPENDICULAR).addScaledVector(SUN_DIRECTION, surfaceAxialDistance).normalize();
    const renderRadius = scaleModel.radiusFor(parent);
    shadow.position.copy(PARENT_POSITION).addScaledVector(SHADOW_SURFACE, renderRadius * 1.002);
    shadow.quaternion.setFromUnitVectors(SHADOW_NORMAL, SHADOW_SURFACE);
    const physicalShadowRatio = Math.min(0.055, Math.max(0.012, resource.definition.physicalRadiusM / parent.meanRadiusM));
    shadow.scale.setScalar(renderRadius * physicalShadowRatio);
    shadow.visible = true;
    this.transitShadowCount += 1;
  }

  private mapLocalOffset(output: Vector3, vectorM: Readonly<{ x: number; y: number; z: number }>, scaleModel: Readonly<RenderScaleModel>, localScale: number): void {
    scaleModel.mapPosition(output, {
      x: vectorM.x * localScale,
      y: vectorM.y * localScale,
      z: vectorM.z * localScale,
    }, ZERO);
  }

  private localOrbitScale(
    definition: Readonly<NaturalSatelliteDefinition>,
    parent: Readonly<DebugBodyRenderState>,
    scaleModel: Readonly<RenderScaleModel>,
    selectedParentId: string,
  ): number {
    const parentRadius = scaleModel.radiusFor(parent);
    const physicalOrbit = definition.semiMajorAxisM * scaleModel.metersToRenderUnits;
    const minimumOrbit = parentRadius * (selectedParentId === parent.bodyId ? 1.85 : 1.45);
    return Math.max(1, minimumOrbit / Math.max(physicalOrbit, 1e-8));
  }
}
