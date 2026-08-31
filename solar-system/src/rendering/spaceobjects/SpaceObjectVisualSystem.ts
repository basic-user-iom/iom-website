import {
  Box3,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  Object3D,
  Sphere,
  SphereGeometry,
  MeshStandardMaterial,
  Texture,
  Vector3,
} from 'three';

import type { DebugRenderFrame, PhysicalPosition } from '../RenderContext';
import type { RenderScaleModel } from '../RenderScaleModel';
import { EARTH_SATELLITE_DEFINITIONS } from '../../simulation/artificial';
import { sampleEarthSatellite, sampleEarthSatelliteOrbitPath } from '../../simulation/artificial';
import { SPACECRAFT_DEFINITIONS } from '../../simulation/spacecraft';
import { sampleSpacecraftTrajectory, sampleSpacecraftTrajectoryPath } from '../../simulation/spacecraft';
import { SpaceObjectWorkerClient, type SpaceObjectWorkerResultResponse } from '../../workers/space-objects';
import { ISS_MODEL_ASSET } from './SpaceObjectAssetCatalog';

export type IssModelState = 'idle' | 'loading' | 'ready' | 'fallback';

export interface SpaceObjectVisualDiagnostics {
  readonly visible: boolean;
  readonly earthSatellitesVisible: boolean;
  readonly spacecraftVisible: boolean;
  readonly earthSatelliteCount: number;
  readonly earthSatelliteRenderedCount: number;
  readonly spacecraftCount: number;
  readonly spacecraftRenderedCount: number;
  readonly selectedObjectId: string | null;
  readonly markersNotToScale: boolean;
  readonly selectedTrajectoryPointCount: number;
  readonly propagationExecution: 'module-worker' | 'direct-fallback';
  readonly issModelState: IssModelState;
  readonly issModelAssetId: string;
  readonly issModelMeshCount: number;
  readonly issModelTriangleCount: number;
}

const ZERO: PhysicalPosition = Object.freeze({ x: 0, y: 0, z: 0 });
const EARTH = new Vector3();
const LOCAL = new Vector3();
const OBJECT = new Object3D();
const MATRIX = new Matrix4();
const ISS_ORIENTATION = new Matrix4();
const ISS_RADIAL = new Vector3();
const ISS_ALONG_TRACK = new Vector3();
const ISS_CROSS_TRACK = new Vector3();
const ISS_FOCUS_DIRECTION = new Vector3(0.35, 1, 0.45).normalize();
const ISS_BOUNDS = new Box3();
const ISS_CENTER = new Vector3();
const ISS_SPHERE = new Sphere();
const EARTH_RADIUS_M = 6_371_008.4;
const ISS_INDEX = EARTH_SATELLITE_DEFINITIONS.findIndex((item) => item.id === ISS_MODEL_ASSET.objectId);

export class SpaceObjectVisualSystem {
  public readonly root = new Group();
  private readonly earthSatelliteMesh: InstancedMesh<SphereGeometry, MeshStandardMaterial>;
  private readonly spacecraftMesh: InstancedMesh<SphereGeometry, MeshStandardMaterial>;
  private readonly issModelAnchor = new Group();
  private readonly earthSatelliteTrajectory: Line<BufferGeometry, LineBasicMaterial>;
  private readonly spacecraftTrajectory: Line<BufferGeometry, LineBasicMaterial>;
  private readonly worldPositions = new Map<string, Vector3>();
  private readonly renderedRadii = new Map<string, number>();
  private visible = true;
  private earthSatellitesVisible = true;
  private spacecraftVisible = true;
  private selectedObjectId: string | null = null;
  private renderedEarthSatelliteCount = 0;
  private renderedSpacecraftCount = 0;
  private selectedTrajectoryPointCount = 0;
  private workerClient: SpaceObjectWorkerClient | null = null;
  private workerResult: SpaceObjectWorkerResultResponse | null = null;
  private workerRequestPending = false;
  private issModelState: IssModelState = 'idle';
  private issModelLoad: Promise<void> | null = null;
  private issModelRadiusMeters = 1;
  private issModelMeshCount = 0;
  private issModelTriangleCount = 0;
  private disposed = false;

  public constructor() {
    this.root.name = 'space-objects-layer';
    this.root.renderOrder = 5;
    const earthSatelliteGeometry = new SphereGeometry(1, 8, 6);
    this.earthSatelliteMesh = new InstancedMesh(
      earthSatelliteGeometry,
      new MeshStandardMaterial({ color: 0x9ce4ff, emissive: new Color(0x1e6b91), emissiveIntensity: 0.24, roughness: 0.55 }),
      EARTH_SATELLITE_DEFINITIONS.length,
    );
    this.earthSatelliteMesh.name = 'earth-satellite-markers';
    this.earthSatelliteMesh.frustumCulled = false;
    const spacecraftGeometry = new SphereGeometry(1, 8, 6);
    this.spacecraftMesh = new InstancedMesh(
      spacecraftGeometry,
      new MeshStandardMaterial({ color: 0xffc86c, emissive: new Color(0xa84a13), emissiveIntensity: 0.3, roughness: 0.55 }),
      SPACECRAFT_DEFINITIONS.length,
    );
    this.spacecraftMesh.name = 'spacecraft-probe-markers';
    this.spacecraftMesh.frustumCulled = false;
    this.issModelAnchor.name = 'iss-nasa-jsc-igoal-model';
    this.issModelAnchor.visible = false;
    this.earthSatelliteTrajectory = createTrajectoryLine('earth-satellite-selected-orbit', 96, 0x6ecfff);
    this.spacecraftTrajectory = createTrajectoryLine('spacecraft-selected-trajectory', 128, 0xffbf67);
    this.root.add(
      this.earthSatelliteTrajectory,
      this.spacecraftTrajectory,
      this.earthSatelliteMesh,
      this.spacecraftMesh,
      this.issModelAnchor,
    );
    if (typeof Worker === 'function') {
      try {
        this.workerClient = new SpaceObjectWorkerClient();
      } catch {
        this.workerClient = null;
      }
    }
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.visible = visible;
  }

  public setEarthSatellitesVisible(visible: boolean): void {
    this.earthSatellitesVisible = visible;
  }

  public setSpacecraftVisible(visible: boolean): void {
    this.spacecraftVisible = visible;
  }

  public selectObject(id: string | null): void {
    this.selectedObjectId = id;
    if (id === ISS_MODEL_ASSET.objectId) void this.requestIssModel();
  }

  public getObjectWorldPosition(id: string): Vector3 | null {
    return this.worldPositions.get(id)?.clone() ?? null;
  }

  public getObjectRenderRadius(id: string): number {
    return this.renderedRadii.get(id) ?? 0.0003;
  }

  public getObjectFocusDirection(id: string): Vector3 | null {
    if (id !== ISS_MODEL_ASSET.objectId || this.issModelState !== 'ready') return null;
    return ISS_FOCUS_DIRECTION.clone().applyQuaternion(this.issModelAnchor.quaternion).normalize();
  }

  public updateFrame(
    frame: Readonly<DebugRenderFrame>,
    scaleModel: Readonly<RenderScaleModel>,
    originM: Readonly<PhysicalPosition>,
  ): void {
    if (!this.visible) {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    this.worldPositions.clear();
    this.renderedRadii.clear();
    this.issModelAnchor.visible = false;
    this.requestWorkerSample(frame.currentJdTdb);
    const earth = frame.bodies.find((body) => body.bodyId === 'earth');
    this.renderedEarthSatelliteCount = 0;
    this.selectedTrajectoryPointCount = 0;
    this.earthSatelliteTrajectory.visible = false;
    this.spacecraftTrajectory.visible = false;
    if (earth !== undefined && earth.visible && this.earthSatellitesVisible) {
      scaleModel.mapPosition(EARTH, earth.positionM, originM);
      const localScale = Math.max(1, scaleModel.radiusFor(earth) * 4 / (EARTH_RADIUS_M * scaleModel.metersToRenderUnits));
      EARTH_SATELLITE_DEFINITIONS.forEach((satellite, index) => {
        const state = this.earthSatelliteState(satellite, frame.currentJdTdb);
        if (state.dataAgeState === 'outside-hard-window' || state.propagationStatus !== 'ok') {
          this.hideInstance(this.earthSatelliteMesh, index);
          return;
        }
        scaleModel.mapPosition(LOCAL, {
          x: state.positionEarthCenteredM.x * localScale,
          y: state.positionEarthCenteredM.y * localScale,
          z: state.positionEarthCenteredM.z * localScale,
        }, ZERO);
        OBJECT.position.copy(EARTH).add(LOCAL);
        const markerRadius = scaleModel.mode === 'presentation'
          ? (this.selectedObjectId === satellite.id ? 0.00018 : 0.000065)
          : 0.00000008;
        const useIssModel = index === ISS_INDEX && this.issModelState === 'ready';
        if (useIssModel) {
          this.hideInstance(this.earthSatelliteMesh, index);
          this.updateIssModel(OBJECT.position, state.positionEarthCenteredM, state.velocityEarthCenteredMps, markerRadius);
        } else {
          OBJECT.scale.setScalar(markerRadius);
          OBJECT.updateMatrix();
          MATRIX.copy(OBJECT.matrix);
          this.earthSatelliteMesh.setMatrixAt(index, MATRIX);
        }
        this.recordObjectPosition(satellite.id, OBJECT.position, markerRadius);
        this.renderedEarthSatelliteCount += 1;
      });
      const selectedSatellite = EARTH_SATELLITE_DEFINITIONS.find((satellite) => satellite.id === this.selectedObjectId);
      if (selectedSatellite !== undefined) {
        const selectedState = sampleEarthSatellite(selectedSatellite, frame.currentJdTdb);
        if (selectedState.dataAgeState !== 'outside-hard-window' && selectedState.propagationStatus === 'ok') {
          this.updateEarthSatelliteTrajectory(selectedSatellite, frame.currentJdTdb, EARTH, scaleModel, localScale);
        }
      }
    } else {
      EARTH_SATELLITE_DEFINITIONS.forEach((_, index) => this.hideInstance(this.earthSatelliteMesh, index));
    }
    this.earthSatelliteMesh.instanceMatrix.needsUpdate = true;
    this.earthSatelliteMesh.visible = this.earthSatellitesVisible;

    this.renderedSpacecraftCount = 0;
    if (this.spacecraftVisible) {
      SPACECRAFT_DEFINITIONS.forEach((mission, index) => {
        const state = this.spacecraftState(mission, frame.currentJdTdb);
        if (!state.valid) {
          this.hideInstance(this.spacecraftMesh, index);
          return;
        }
        scaleModel.mapPosition(LOCAL, state.positionM, originM);
        OBJECT.position.copy(LOCAL);
        const markerRadius = this.selectedObjectId === mission.id ? 0.0006 : 0.00022;
        OBJECT.scale.setScalar(markerRadius);
        OBJECT.updateMatrix();
        MATRIX.copy(OBJECT.matrix);
        this.spacecraftMesh.setMatrixAt(index, MATRIX);
        this.recordObjectPosition(mission.id, OBJECT.position, markerRadius);
        this.renderedSpacecraftCount += 1;
      });
      const selectedMission = SPACECRAFT_DEFINITIONS.find((mission) => mission.id === this.selectedObjectId);
      if (selectedMission !== undefined && this.spacecraftState(selectedMission, frame.currentJdTdb).valid) {
        this.updateSpacecraftTrajectory(selectedMission, frame.currentJdTdb, scaleModel, originM);
      }
    } else {
      SPACECRAFT_DEFINITIONS.forEach((_, index) => this.hideInstance(this.spacecraftMesh, index));
    }
    this.spacecraftMesh.instanceMatrix.needsUpdate = true;
    this.spacecraftMesh.visible = this.spacecraftVisible;
  }

  public getDiagnostics(): SpaceObjectVisualDiagnostics {
    return Object.freeze({
      visible: this.visible,
      earthSatellitesVisible: this.earthSatellitesVisible,
      spacecraftVisible: this.spacecraftVisible,
      earthSatelliteCount: EARTH_SATELLITE_DEFINITIONS.length,
      earthSatelliteRenderedCount: this.renderedEarthSatelliteCount,
      spacecraftCount: SPACECRAFT_DEFINITIONS.length,
      spacecraftRenderedCount: this.renderedSpacecraftCount,
      selectedObjectId: this.selectedObjectId,
      markersNotToScale: true,
      selectedTrajectoryPointCount: this.selectedTrajectoryPointCount,
      propagationExecution: this.workerClient === null ? 'direct-fallback' : 'module-worker',
      issModelState: this.issModelState,
      issModelAssetId: ISS_MODEL_ASSET.assetId,
      issModelMeshCount: this.issModelMeshCount,
      issModelTriangleCount: this.issModelTriangleCount,
    });
  }

  public dispose(): void {
    this.disposed = true;
    this.root.traverse((object) => {
      const renderable = object as typeof object & {
        geometry?: { dispose(): void };
        material?: MeshStandardMaterial | MeshStandardMaterial[];
      };
      renderable.geometry?.dispose();
      const materials = Array.isArray(renderable.material)
        ? renderable.material
        : renderable.material === undefined ? [] : [renderable.material];
      for (const material of materials) disposeMaterial(material);
    });
    this.workerClient?.dispose();
    this.workerClient = null;
    this.worldPositions.clear();
    this.renderedRadii.clear();
    this.root.clear();
  }

  private async requestIssModel(): Promise<void> {
    if (this.issModelState === 'ready' || this.issModelState === 'fallback') return;
    if (this.issModelLoad !== null) return this.issModelLoad;
    this.issModelState = 'loading';
    this.issModelLoad = this.loadIssModel();
    return this.issModelLoad;
  }

  private async loadIssModel(): Promise<void> {
    try {
      const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
        import('three/addons/loaders/GLTFLoader.js'),
        import('three/addons/libs/meshopt_decoder.module.js'),
      ]);
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      const gltf = await loader.loadAsync(ISS_MODEL_ASSET.file);
      if (this.disposed) return;
      const model = gltf.scene;
      model.name = 'iss-nasa-jsc-igoal-content';
      model.updateMatrixWorld(true);
      ISS_BOUNDS.setFromObject(model);
      ISS_BOUNDS.getCenter(ISS_CENTER);
      ISS_BOUNDS.getBoundingSphere(ISS_SPHERE);
      if (!Number.isFinite(ISS_SPHERE.radius) || ISS_SPHERE.radius <= 0) {
        throw new Error('NASA ISS model has invalid bounds.');
      }
      model.position.sub(ISS_CENTER);
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        object.frustumCulled = false;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (!(material instanceof MeshStandardMaterial)) continue;
          // The NASA Blender export marks nearly every surface fully metallic.
          // That is useful in a neutral model viewer, but the observatory's
          // deliberately intense solar point light turns it into white glare.
          // Preserve every authored texture while restoring readable diffuse
          // color and broad, restrained highlights for the on-orbit close-up.
          material.color.multiplyScalar(0.78);
          material.metalness = Math.min(material.metalness, 0.22);
          material.roughness = Math.max(material.roughness, 0.68);
          material.envMapIntensity = Math.min(material.envMapIntensity, 0.35);
          material.needsUpdate = true;
        }
        this.issModelMeshCount += 1;
        const index = object.geometry.getIndex();
        const position = object.geometry.getAttribute('position');
        this.issModelTriangleCount += Math.floor((index?.count ?? position?.count ?? 0) / 3);
      });
      this.issModelRadiusMeters = ISS_SPHERE.radius;
      this.issModelAnchor.add(model);
      this.issModelState = 'ready';
    } catch (error) {
      this.issModelState = 'fallback';
      console.warn('NASA ISS model unavailable; retaining the compact satellite marker.', error);
    }
  }

  private updateIssModel(
    position: Readonly<Vector3>,
    earthCenteredPositionM: Readonly<PhysicalPosition>,
    earthCenteredVelocityMps: Readonly<PhysicalPosition>,
    markerRadius: number,
  ): void {
    this.issModelAnchor.visible = true;
    this.issModelAnchor.position.copy(position);
    ISS_RADIAL.set(
      earthCenteredPositionM.x,
      earthCenteredPositionM.y,
      earthCenteredPositionM.z,
    ).normalize();
    ISS_ALONG_TRACK.set(
      earthCenteredVelocityMps.x,
      earthCenteredVelocityMps.y,
      earthCenteredVelocityMps.z,
    );
    ISS_ALONG_TRACK.addScaledVector(ISS_RADIAL, -ISS_ALONG_TRACK.dot(ISS_RADIAL)).normalize();
    if (ISS_ALONG_TRACK.lengthSq() < 0.5 || ISS_RADIAL.lengthSq() < 0.5) {
      this.issModelAnchor.quaternion.identity();
    } else {
      // NASA's source model uses +X along the pressurized modules, +Y as the
      // station vertical, and +Z across the solar-array/truss span.
      ISS_CROSS_TRACK.crossVectors(ISS_ALONG_TRACK, ISS_RADIAL).normalize();
      ISS_ORIENTATION.makeBasis(ISS_ALONG_TRACK, ISS_RADIAL, ISS_CROSS_TRACK);
      this.issModelAnchor.quaternion.setFromRotationMatrix(ISS_ORIENTATION);
    }
    this.issModelAnchor.scale.setScalar(markerRadius / this.issModelRadiusMeters);
    this.issModelAnchor.updateMatrixWorld();
  }

  private requestWorkerSample(jdTdb: number): void {
    if (this.workerClient === null || this.workerRequestPending) return;
    this.workerRequestPending = true;
    void this.workerClient.sample(jdTdb).then((result) => {
      this.workerResult = result;
    }).catch(() => {
      this.workerClient?.dispose();
      this.workerClient = null;
      this.workerResult = null;
    }).finally(() => {
      this.workerRequestPending = false;
    });
  }

  private earthSatelliteState(
    satellite: (typeof EARTH_SATELLITE_DEFINITIONS)[number],
    jdTdb: number,
  ): ReturnType<typeof sampleEarthSatellite> {
    const workerResult = this.workerResult;
    const workerState = workerResult?.earthSatellites.find((item) => item.id === satellite.id);
    if (workerState === undefined || workerResult === null || Math.abs(workerResult.jdTdb - jdTdb) > 0.05) {
      return sampleEarthSatellite(satellite, jdTdb);
    }
    return {
      satelliteId: satellite.id,
      catalogId: satellite.catalogId,
      jdTdb,
      sourceFrame: 'TEME',
      destinationFrame: 'earth-centered-inertial',
      propagator: 'SGP4/SDP4',
      positionTemeM: { x: 0, y: 0, z: 0 },
      velocityTemeMps: { x: 0, y: 0, z: 0 },
      positionEarthCenteredM: { x: workerState.positionM[0], y: workerState.positionM[1], z: workerState.positionM[2] },
      velocityEarthCenteredMps: { x: workerState.velocityMps[0], y: workerState.velocityMps[1], z: workerState.velocityMps[2] },
      dataAgeDays: workerState.dataAgeDays,
      dataAgeState: workerState.dataAgeState,
      propagationStatus: workerState.propagationStatus,
      propagationError: workerState.propagationError,
    };
  }

  private spacecraftState(
    mission: (typeof SPACECRAFT_DEFINITIONS)[number],
    jdTdb: number,
  ): ReturnType<typeof sampleSpacecraftTrajectory> {
    const workerResult = this.workerResult;
    const workerState = workerResult?.spacecraft.find((item) => item.id === mission.id);
    if (workerState === undefined || workerResult === null || Math.abs(workerResult.jdTdb - jdTdb) > 0.05) {
      return sampleSpacecraftTrajectory(mission, jdTdb);
    }
    const positionM = { x: workerState.positionM[0], y: workerState.positionM[1], z: workerState.positionM[2] };
    const velocityMps = { x: workerState.velocityMps[0], y: workerState.velocityMps[1], z: workerState.velocityMps[2] };
    return {
      spacecraftId: mission.id,
      jdTdb,
      valid: workerState.valid,
      positionM,
      velocityMps,
      distanceFromSunM: Math.hypot(positionM.x, positionM.y, positionM.z),
      speedMps: Math.hypot(velocityMps.x, velocityMps.y, velocityMps.z),
      source: 'JPL_HORIZONS',
      interpolation: 'cubic-hermite',
    };
  }

  private hideInstance(mesh: InstancedMesh<SphereGeometry, MeshStandardMaterial>, index: number): void {
    // Keep OBJECT intact: the ISS path hides its fallback instance after
    // calculating the station position, then reuses that position for the
    // detailed model and camera framing.
    MATRIX.makeScale(0, 0, 0);
    mesh.setMatrixAt(index, MATRIX);
  }

  private recordObjectPosition(id: string, position: Readonly<Vector3>, radius: number): void {
    const existing = this.worldPositions.get(id);
    if (existing === undefined) this.worldPositions.set(id, new Vector3(position.x, position.y, position.z));
    else existing.copy(position);
    this.renderedRadii.set(id, radius);
  }

  private updateEarthSatelliteTrajectory(
    satellite: (typeof EARTH_SATELLITE_DEFINITIONS)[number],
    jdTdb: number,
    earthPosition: Vector3,
    scaleModel: Readonly<RenderScaleModel>,
    localScale: number,
  ): void {
    const attribute = this.earthSatelliteTrajectory.geometry.getAttribute('position');
    if (!(attribute instanceof Float32BufferAttribute)) return;
    const output = attribute.array as Float32Array;
    const path = sampleEarthSatelliteOrbitPath(satellite, jdTdb, 96, 1);
    for (let index = 0; index < 96; index += 1) {
      scaleModel.mapPosition(LOCAL, {
        x: (path[index * 3] ?? 0) * localScale,
        y: (path[index * 3 + 1] ?? 0) * localScale,
        z: (path[index * 3 + 2] ?? 0) * localScale,
      }, ZERO);
      output[index * 3] = earthPosition.x + LOCAL.x;
      output[index * 3 + 1] = earthPosition.y + LOCAL.y;
      output[index * 3 + 2] = earthPosition.z + LOCAL.z;
    }
    attribute.needsUpdate = true;
    this.earthSatelliteTrajectory.visible = true;
    this.selectedTrajectoryPointCount = 96;
  }

  private updateSpacecraftTrajectory(
    mission: (typeof SPACECRAFT_DEFINITIONS)[number],
    jdTdb: number,
    scaleModel: Readonly<RenderScaleModel>,
    originM: Readonly<PhysicalPosition>,
  ): void {
    const attribute = this.spacecraftTrajectory.geometry.getAttribute('position');
    if (!(attribute instanceof Float32BufferAttribute)) return;
    const output = attribute.array as Float32Array;
    const path = sampleSpacecraftTrajectoryPath(mission, jdTdb, 128);
    for (let index = 0; index < 128; index += 1) {
      scaleModel.mapPosition(LOCAL, {
        x: path[index * 3] ?? 0,
        y: path[index * 3 + 1] ?? 0,
        z: path[index * 3 + 2] ?? 0,
      }, originM);
      output[index * 3] = LOCAL.x;
      output[index * 3 + 1] = LOCAL.y;
      output[index * 3 + 2] = LOCAL.z;
    }
    attribute.needsUpdate = true;
    this.spacecraftTrajectory.visible = true;
    this.selectedTrajectoryPointCount = 128;
  }
}

function createTrajectoryLine(name: string, points: number, color: number): Line<BufferGeometry, LineBasicMaterial> {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(points * 3), 3));
  const line = new Line(geometry, new LineBasicMaterial({ color, transparent: true, opacity: 0.7 }));
  line.name = name;
  line.frustumCulled = false;
  line.visible = false;
  return line;
}

function disposeMaterial(material: MeshStandardMaterial): void {
  const textures = new Set<Texture>();
  for (const value of Object.values(material)) {
    if (value instanceof Texture) textures.add(value);
  }
  for (const texture of textures) texture.dispose();
  material.dispose();
}
