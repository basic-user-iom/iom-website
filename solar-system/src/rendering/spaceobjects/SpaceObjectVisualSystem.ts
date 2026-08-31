import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Matrix4,
  Object3D,
  SphereGeometry,
  MeshStandardMaterial,
  Vector3,
} from 'three';

import type { DebugRenderFrame, PhysicalPosition } from '../RenderContext';
import type { RenderScaleModel } from '../RenderScaleModel';
import { EARTH_SATELLITE_DEFINITIONS } from '../../simulation/artificial';
import { sampleEarthSatellite, sampleEarthSatelliteOrbitPath } from '../../simulation/artificial';
import { SPACECRAFT_DEFINITIONS } from '../../simulation/spacecraft';
import { sampleSpacecraftTrajectory, sampleSpacecraftTrajectoryPath } from '../../simulation/spacecraft';
import { SpaceObjectWorkerClient, type SpaceObjectWorkerResultResponse } from '../../workers/space-objects';

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
}

const ZERO: PhysicalPosition = Object.freeze({ x: 0, y: 0, z: 0 });
const EARTH = new Vector3();
const LOCAL = new Vector3();
const OBJECT = new Object3D();
const MATRIX = new Matrix4();
const EARTH_RADIUS_M = 6_371_008.4;

export class SpaceObjectVisualSystem {
  public readonly root = new Group();
  private readonly earthSatelliteMesh: InstancedMesh<SphereGeometry, MeshStandardMaterial>;
  private readonly spacecraftMesh: InstancedMesh<SphereGeometry, MeshStandardMaterial>;
  private readonly earthSatelliteTrajectory: Line<BufferGeometry, LineBasicMaterial>;
  private readonly spacecraftTrajectory: Line<BufferGeometry, LineBasicMaterial>;
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
    this.earthSatelliteTrajectory = createTrajectoryLine('earth-satellite-selected-orbit', 96, 0x6ecfff);
    this.spacecraftTrajectory = createTrajectoryLine('spacecraft-selected-trajectory', 128, 0xffbf67);
    this.root.add(this.earthSatelliteTrajectory, this.spacecraftTrajectory, this.earthSatelliteMesh, this.spacecraftMesh);
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
        const radius = this.selectedObjectId === satellite.id ? 0.005 : 0.0024;
        OBJECT.scale.setScalar(scaleModel.mode === 'presentation' ? radius : 0.00008);
        OBJECT.updateMatrix();
        MATRIX.copy(OBJECT.matrix);
        this.earthSatelliteMesh.setMatrixAt(index, MATRIX);
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
        OBJECT.scale.setScalar(this.selectedObjectId === mission.id ? 0.006 : 0.0028);
        OBJECT.updateMatrix();
        MATRIX.copy(OBJECT.matrix);
        this.spacecraftMesh.setMatrixAt(index, MATRIX);
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
    });
  }

  public dispose(): void {
    this.root.traverse((object) => {
      const renderable = object as typeof object & { geometry?: SphereGeometry; material?: MeshStandardMaterial };
      renderable.geometry?.dispose();
      renderable.material?.dispose();
    });
    this.workerClient?.dispose();
    this.workerClient = null;
    this.root.clear();
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
    OBJECT.position.set(0, 0, 0);
    OBJECT.scale.setScalar(0);
    OBJECT.updateMatrix();
    MATRIX.copy(OBJECT.matrix);
    mesh.setMatrixAt(index, MATRIX);
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
