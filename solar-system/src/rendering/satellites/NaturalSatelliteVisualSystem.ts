import { PrecisionLine } from '../PrecisionPath';
import {
  type BufferGeometry,
  CircleGeometry,
  Color,
  DataTexture,
  DoubleSide,
  Group,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  RepeatWrapping,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
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
import {
  PROFILE_COLORS,
  createMoonBodyGeometry,
  createProceduralMoonMaps,
  createPlaceholderMoonMaps,
  isProceduralMajorMoon,
  materialRoughnessForProfile,
  shapeAxesFor,
} from './ProceduralMoonSurface';

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

function normalizeRotation(value: number): number {
  return ((value % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

interface MajorResource {
  readonly definition: NaturalSatelliteDefinition;
  readonly mesh: Mesh<BufferGeometry, MeshStandardMaterial>;
  readonly orbit: PrecisionLine;
  readonly shapeAxes: Readonly<Vector3>;
  readonly ownsGeometry: boolean;
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
const BASIN_AXIS = new Vector3(1, 0, 0);
const MAX_ANISOTROPY = 8;

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
  private readonly transitShadows = new Map<string, Mesh<CircleGeometry, ShaderMaterial>>();
  private readonly selectionHalo: Mesh<RingGeometry, MeshBasicMaterial>;
  private compactSelectionLabel: HTMLSpanElement | null = null;
  private selectionScreenIndicator: HTMLSpanElement | null = null;
  private visible = true;
  private majorVisible = true;
  private minorVisible = true;
  private orbitsVisible = true;
  private scenarioOverlaysSuppressed = false;
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
        new CircleGeometry(1, 48),
        new ShaderMaterial({
          name: `jupiter-transit-shadow-${satelliteId}`,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
          uniforms: {
            uOpacity: { value: 0.58 },
          },
          vertexShader: /* glsl */ `
            varying vec2 vLocal;
            void main() {
              vLocal = position.xy;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: /* glsl */ `
            uniform float uOpacity;
            varying vec2 vLocal;
            void main() {
              float radius = length(vLocal);
              // Soft penumbra: dark core with gradual falloff instead of a hard disc.
              float umbra = 1.0 - smoothstep(0.42, 0.72, radius);
              float penumbra = 1.0 - smoothstep(0.55, 1.0, radius);
              float shade = mix(penumbra * 0.55, 1.0, umbra);
              float alpha = shade * uOpacity * (1.0 - smoothstep(0.92, 1.0, radius));
              if (alpha < 0.01) discard;
              gl_FragColor = vec4(vec3(0.015, 0.02, 0.03), alpha);
            }
          `,
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

  public setScenarioOverlaysSuppressed(suppressed: boolean): void {
    this.scenarioOverlaysSuppressed = suppressed;
  }

  public setOrbitsVisible(visible: boolean): void {
    this.orbitsVisible = visible;
  }

  public setLabelsVisible(visible: boolean): void {
    this.labelsVisible = visible;
  }

  public selectSatellite(id: string | null): void {
    this.selectedSatelliteId = id;
    const selectedResource = id === null ? undefined : this.major.get(id);
    if (selectedResource !== undefined) this.ensureSurfaceDetail(selectedResource);
    for (const resource of this.major.values()) {
      const selected = resource.definition.id === id;
      const official = resource.mesh.userData.surfaceMode === 'official-vtad-map';
      resource.mesh.material.emissiveIntensity = selected
        ? (official ? 0.01 : 0.02)
        : (official ? 0.018 : 0.045);
    }
  }

  public getSatelliteWorldPosition(id: string): Vector3 | null {
    return this.worldPositions.get(id)?.clone() ?? null;
  }

  public getSatelliteRenderRadius(id: string): number | null {
    return this.renderedRadii.get(id) ?? null;
  }

  /** Includes irregular silhouettes without changing the catalogue's mean radius. */
  public getSatelliteFramingRadius(id: string): number | null {
    const resource = this.major.get(id);
    if (resource === undefined) return this.getSatelliteRenderRadius(id);
    resource.mesh.geometry.computeBoundingSphere();
    return (resource.mesh.geometry.boundingSphere?.radius ?? 1)
      * Math.max(resource.mesh.scale.x, resource.mesh.scale.y, resource.mesh.scale.z);
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
      resource.mesh.material.color.copy(WHITE).multiplyScalar(eclipsed ? 0.18 : 1);
      const official = resource.mesh.userData.surfaceMode === 'official-vtad-map';
      const selected = resource.definition.id === this.selectedSatelliteId;
      resource.mesh.material.emissiveIntensity = eclipsed
        ? 0.004
        : selected
          ? (official ? 0.01 : 0.02)
          : (official ? 0.018 : 0.04);
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
      // Face Mimas's authored +X basin toward the sun so the lit inspection
      // camera sees Herschel instead of the night side.
      if (selected && resource.definition.id === 'mimas' && sun !== undefined) {
        SUN_DIRECTION.set(
          sun.positionM.x - (parent.positionM.x + state.positionM.x),
          sun.positionM.y - (parent.positionM.y + state.positionM.y),
          sun.positionM.z - (parent.positionM.z + state.positionM.z),
        );
        if (SUN_DIRECTION.lengthSq() > 1e-16) {
          SUN_DIRECTION.normalize();
          resource.mesh.quaternion.setFromUnitVectors(BASIN_AXIS, SUN_DIRECTION);
        }
      }
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
    for (const resource of this.major.values()) {
      if (!resource.mesh.visible || resource.mesh.userData.surfaceDetailReady || !isProceduralMajorMoon(resource.definition.id)) continue;
      const radius = this.renderedRadii.get(resource.definition.id) ?? 0;
      if (projectedSphereRadiusPx(camera, resource.mesh.position, radius, viewportWidth, viewportHeight) > 12) {
        this.ensureSurfaceDetail(resource);
      }
    }
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
      // During moon close-ups, only the inspected moon keeps a label.
      if (!selected && projectedRadiusPx > 70) {
        resource.label.style.opacity = '0';
        this.suppressedLabelCount += 1;
        continue;
      }
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
      if (Array.isArray(renderable.material)) renderable.material.forEach((material) => material.dispose());
      else renderable.material?.dispose();
    });
    for (const resource of this.major.values()) {
      if (resource.ownsGeometry) resource.mesh.geometry.dispose();
      resource.orbit.geometry.dispose();
      resource.label?.remove();
    }
    this.geometry.dispose();
    this.selectionHalo.geometry.dispose();
    for (const shadow of this.transitShadows.values()) shadow.geometry.dispose();
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

  private ensureSurfaceDetail(resource: MajorResource): void {
    if (!isProceduralMajorMoon(resource.definition.id) || resource.mesh.userData.surfaceDetailReady) return;
    const maps = createProceduralMoonMaps(resource.definition);
    this.disposeProceduralMaps(resource.mesh.material);
    this.proceduralTextures.add(maps.color);
    this.proceduralTextures.add(maps.normal);
    Object.assign(resource.mesh.material, { map: maps.color, normalMap: maps.normal, emissiveMap: maps.color, roughness: maps.roughness });
    resource.mesh.material.normalScale.setScalar(maps.normalScale);
    resource.mesh.material.needsUpdate = true;
    resource.mesh.userData.surfaceDetailReady = true;
  }

  private createMajor(definition: NaturalSatelliteDefinition): void {
    const maps = createPlaceholderMoonMaps(definition);
    this.proceduralTextures.add(maps.color);
    this.proceduralTextures.add(maps.normal);
    const material = new MeshStandardMaterial({
      color: 0xffffff,
      map: maps.color,
      normalMap: maps.normal,
      normalScale: new Vector2(maps.normalScale, maps.normalScale),
      roughness: maps.roughness,
      metalness: 0,
      emissive: new Color(0xffffff),
      emissiveMap: maps.color,
      // Tiny albedo-linked fill so dark procedural limbs stay readable without washing maps.
      emissiveIntensity: 0.045,
    });
    material.name = `natural-satellite-material-${definition.id}`;
    const bodyGeometry = createMoonBodyGeometry(definition, this.geometry);
    const ownsGeometry = bodyGeometry !== this.geometry;
    const mesh = new Mesh(bodyGeometry, material);
    mesh.name = `natural-satellite-${definition.id}`;
    mesh.userData.satelliteId = definition.id;
    mesh.userData.surfaceMode = ownsGeometry ? 'procedural-irregular' : 'procedural-sphere';
    mesh.frustumCulled = false;
    const orbit = new PrecisionLine(96, new LineBasicMaterial({ color: PROFILE_COLORS[definition.visualProfile] ?? 0x7fbfd9, transparent: true, opacity: 0.38 }));
    orbit.name = `natural-satellite-orbit-${definition.id}`;
    orbit.frustumCulled = false;
    this.root.add(orbit, mesh);
    this.major.set(definition.id, {
      definition,
      mesh,
      orbit,
      shapeAxes: shapeAxesFor(definition.id),
      ownsGeometry,
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
          this.disposeProceduralMaps(resource.mesh.material);
          texture.name = asset.assetId;
          texture.colorSpace = SRGBColorSpace;
          texture.wrapS = RepeatWrapping;
          texture.wrapT = RepeatWrapping;
          texture.generateMipmaps = true;
          texture.minFilter = LinearMipmapLinearFilter;
          texture.magFilter = LinearFilter;
          texture.anisotropy = MAX_ANISOTROPY;
          texture.needsUpdate = true;
          this.loadedTextures.add(texture);
          resource.mesh.material.map = texture;
          // Official VTAD maps are base-color only; clear authored normals so we do not invent relief.
          resource.mesh.material.normalMap = null;
          resource.mesh.material.normalScale.set(1, 1);
          resource.mesh.material.emissiveMap = texture;
          resource.mesh.material.emissive.set(0xffffff);
          resource.mesh.material.emissiveIntensity = 0.016;
          resource.mesh.material.roughness = materialRoughnessForProfile(resource.definition.visualProfile);
          resource.mesh.material.needsUpdate = true;
          resource.mesh.userData.surfaceMode = 'official-vtad-map';
          this.officialTextureStates.set(asset.satelliteId, 'ready');
        },
        undefined,
        () => this.officialTextureStates.set(asset.satelliteId, 'fallback'),
      );
    }
  }

  private disposeProceduralMaps(material: MeshStandardMaterial): void {
    for (const slot of [material.map, material.normalMap] as const) {
      if (slot instanceof DataTexture && this.proceduralTextures.has(slot)) {
        slot.dispose();
        this.proceduralTextures.delete(slot);
      }
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
      ? 0.1
      : selectedParentId === parent.bodyId ? 0.014 : 0.005;
    return Math.min(parentRadius * 0.16, Math.max(relativeRadius, parentRadius * minimumFraction));
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
    orbit: PrecisionLine,
    definition: NaturalSatelliteDefinition,
    parent: Readonly<DebugBodyRenderState>,
    jdTdb: number,
    scaleModel: Readonly<RenderScaleModel>,
    originM: Readonly<PhysicalPosition>,
    localScale: number,
  ): void {
    const current = sampleNaturalSatellite(definition, jdTdb).positionM;
    const positions = sampleNaturalSatelliteOrbit(definition, jdTdb, definition.id === 'nereid' || definition.id === 'phoebe' ? 0.35 : 1, 96);
    scaleModel.mapPosition(PARENT_POSITION, parent.positionM, originM);
    this.mapLocalOffset(LOCAL, current, scaleModel, localScale);
    orbit.path.anchor.copy(PARENT_POSITION).add(LOCAL);
    const array = orbit.path.positions;
    const unit = localScale / scaleModel.metersPerRenderUnit;
    for (let index = 0; index < 96; index += 1) {
      array[index * 3] = (positions[index * 3]! - current.x) * unit;
      array[index * 3 + 1] = (positions[index * 3 + 2]! - current.z) * unit;
      array[index * 3 + 2] = (current.y - positions[index * 3 + 1]!) * unit;
    }
    orbit.visible = this.majorVisible && this.orbitsVisible && this.visible && !this.scenarioOverlaysSuppressed;
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
    const inspectingThisMoon = this.selectedSatelliteId === definition.id;
    const inspectingSibling = this.selectedSatelliteId !== null &&
      definition.parentId === parent.bodyId &&
      (NATURAL_SATELLITE_DEFINITIONS.find((item) => item.id === this.selectedSatelliteId)?.parentId === parent.bodyId);
    // Pull selected inner moons outside the exaggerated parent so close-ups
    // do not end up staring into Saturn's disc.
    const minimumOrbit = parentRadius * (
      inspectingThisMoon ? 2.85 :
      inspectingSibling ? 2.35 :
      selectedParentId === parent.bodyId ? 1.85 : 1.45
    );
    return Math.max(1, minimumOrbit / Math.max(physicalOrbit, 1e-8));
  }
}
