import {
  BufferGeometry,
  CircleGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  type Camera,
  type Material,
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
}

interface MajorResource {
  readonly definition: NaturalSatelliteDefinition;
  readonly mesh: Mesh<SphereGeometry, MeshStandardMaterial>;
  readonly orbit: Line<BufferGeometry, LineBasicMaterial>;
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
  private readonly geometry = new SphereGeometry(1, 14, 10);
  private readonly major = new Map<string, MajorResource>();
  private readonly minor = new Map<string, MinorResource>();
  private readonly transitShadows = new Map<string, Mesh<CircleGeometry, MeshBasicMaterial>>();
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
  }

  public setLabelContainer(container: HTMLElement | null): void {
    this.labelContainer = container;
    for (const resource of this.major.values()) {
      resource.label?.remove();
      resource.label = this.labelContainer === null ? null : this.createLabel(resource.definition);
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
    const resource = this.major.get(id);
    return resource === undefined || !resource.mesh.visible ? null : resource.mesh.position.clone();
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
    for (const resource of this.major.values()) {
      const parent = parentById.get(resource.definition.parentId);
      if (parent === undefined || !parent.visible) {
        resource.mesh.visible = false;
        resource.orbit.visible = false;
        continue;
      }
      const localScale = this.localOrbitScale(resource.definition, parent, scaleModel, selectedParentId);
      this.localScaleApplied ||= localScale > 1.0001;
      scaleModel.mapPosition(PARENT_POSITION, parent.positionM, originM);
      const state = sampleNaturalSatellite(resource.definition, frame.currentJdTdb);
      const parentToSun = sun === undefined
        ? ZERO
        : { x: sun.positionM.x - parent.positionM.x, y: sun.positionM.y - parent.positionM.y, z: sun.positionM.z - parent.positionM.z };
      const eclipsed = sun !== undefined && isNaturalSatelliteInParentShadow(state, parent.meanRadiusM, parentToSun);
      if (eclipsed) this.eclipsedMajorCount += 1;
      const baseColor = PROFILE_COLORS[resource.definition.visualProfile] ?? 0x9bb4c2;
      resource.mesh.material.color.setHex(baseColor).multiplyScalar(eclipsed ? 0.16 : 1);
      resource.mesh.material.emissiveIntensity = eclipsed
        ? 0.004
        : resource.definition.id === this.selectedSatelliteId ? 0.34 : 0.04;
      this.mapLocalOffset(LOCAL, state.positionM, scaleModel, localScale);
      resource.mesh.position.copy(PARENT_POSITION).add(LOCAL);
      const physicalRadius = resource.definition.physicalRadiusM * scaleModel.metersToRenderUnits;
      const markerRadius = Math.max(
        physicalRadius * (scaleModel.mode === 'presentation' ? 420 : 1),
        scaleModel.mode === 'presentation'
          ? (selectedParentId === parent.bodyId ? 0.012 : 0.0045)
          : 0.00004,
      );
      resource.mesh.scale.setScalar(markerRadius);
      resource.mesh.visible = this.majorVisible;
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
      this.localScaleApplied ||= localScale > 1.0001;
      scaleModel.mapPosition(PARENT_POSITION, parent.positionM, originM);
      resource.definitions.forEach((definition, index) => {
        const state = sampleNaturalSatellite(definition, frame.currentJdTdb);
        this.mapLocalOffset(LOCAL, state.positionM, scaleModel, localScale);
        INSTANCE_HELPER.position.copy(PARENT_POSITION).add(LOCAL);
        const markerRadius = scaleModel.mode === 'presentation' ? 0.0018 : 0.000025;
        INSTANCE_HELPER.scale.setScalar(markerRadius);
        INSTANCE_HELPER.updateMatrix();
        INSTANCE_MATRIX.copy(INSTANCE_HELPER.matrix);
        resource.mesh.setMatrixAt(index, INSTANCE_MATRIX);
      });
      resource.mesh.instanceMatrix.needsUpdate = true;
      resource.mesh.visible = this.minorVisible;
    }
  }

  public updateLabels(
    camera: Camera,
    viewportWidth: number,
    viewportHeight: number,
    suppressed = false,
  ): void {
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
  }

  public getDiagnostics(): NaturalSatelliteVisualDiagnostics {
    const majorCount = NATURAL_SATELLITE_DEFINITIONS.filter((item) => item.tier === 'major').length;
    const namedCount = NATURAL_SATELLITE_DEFINITIONS.filter((item) => item.tier === 'named').length;
    const minorCount = NATURAL_SATELLITE_DEFINITIONS.filter((item) => item.tier === 'minor-point').length;
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
    this.root.clear();
    this.major.clear();
    this.minor.clear();
  }

  private createMajor(definition: NaturalSatelliteDefinition): void {
    const material = new MeshStandardMaterial({
      color: PROFILE_COLORS[definition.visualProfile] ?? 0x9bb4c2,
      roughness: definition.visualProfile.includes('ice') ? 0.72 : 0.88,
      metalness: 0,
      emissive: new Color(PROFILE_COLORS[definition.visualProfile] ?? 0x9bb4c2),
      emissiveIntensity: 0.04,
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
      label: this.labelContainer === null ? null : this.createLabel(definition),
    });
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
