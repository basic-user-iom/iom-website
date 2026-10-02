import { PrecisionLine } from '../PrecisionPath';
import {
  Box3,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  Sphere,
  MeshStandardMaterial,
  Texture,
  Vector3,
  type Camera,
} from 'three';

import type { DebugRenderFrame, PhysicalPosition } from '../RenderContext';
import type { RenderScaleModel } from '../RenderScaleModel';
import { EARTH_SATELLITE_DEFINITIONS } from '../../simulation/artificial';
import { sampleEarthSatellite, sampleEarthSatelliteOrbitPath } from '../../simulation/artificial';
import { SPACECRAFT_DEFINITIONS } from '../../simulation/spacecraft';
import { sampleSpacecraftTrajectory, sampleSpacecraftTrajectoryPath } from '../../simulation/spacecraft';
import { SpaceObjectWorkerClient, type SpaceObjectWorkerResultResponse } from '../../workers/space-objects';
import { ISS_MODEL_ASSET, VOYAGER_MODEL_ASSET, isVoyager } from './SpaceObjectAssetCatalog';
import { VoyagerModelVisual } from './VoyagerModelVisual';
import {
  bodyRelativePhysicalScale,
  earthSatelliteMarkerRadius,
  physicalModelScale,
  screenAwareMarkerRadius,
  spacecraftMarkerRadius,
} from './SpaceObjectRenderScale';

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
  readonly detailedInspectionObjectId: string | null;
  readonly inspectionSuppressedMarkerCount: number;
  readonly markersNotToScale: boolean;
  readonly selectedTrajectoryPointCount: number;
  readonly propagationExecution: 'module-worker' | 'direct-fallback';
  readonly voyagerModelState: IssModelState;
  readonly voyagerModelMeshCount: number;
  readonly voyagerModelAssetId: string;
  readonly issModelState: IssModelState;
  readonly issModelAssetId: string;
  readonly issModelMeshCount: number;
  readonly issModelTriangleCount: number;
  readonly issPhysicalSpanMeters: number;
  readonly issSpanToEarthDiameter: number;
  readonly issScalePolicy: 'physical-earth-relative';
  readonly selectedRenderRadius: number | null;
  readonly selectedOnScreen: boolean;
  readonly coverageLabelCount: number;
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
const ISS_SIZE = new Vector3();
const PROJECTED = new Vector3();
const EARTH_RADIUS_M = 6_371_008.4;
const ISS_INDEX = EARTH_SATELLITE_DEFINITIONS.findIndex((item) => item.id === ISS_MODEL_ASSET.objectId);
const ISS_REFERENCE_SCALE = physicalModelScale(
  ISS_MODEL_ASSET.modelBoundsMeters,
  ISS_MODEL_ASSET.physicalSpanMeters,
);
const ISS_SPAN_TO_EARTH_DIAMETER = ISS_MODEL_ASSET.physicalSpanMeters / (EARTH_RADIUS_M * 2);

const EARTH_SATELLITE_MARKER_COLOR = 0x6fd8ff;
const SPACECRAFT_MARKER_COLOR = 0xffb14a;

export class SpaceObjectVisualSystem {
  public readonly root = new Group();
  private readonly earthSatelliteMesh: InstancedMesh<SphereGeometry, MeshBasicMaterial>;
  private readonly spacecraftMesh: InstancedMesh<SphereGeometry, MeshBasicMaterial>;
  private readonly issModelAnchor = new Group();
  private readonly voyagerModels = new VoyagerModelVisual();
  private metersToRenderUnits = 1 / 149_597_870_700;
  private readonly earthSatelliteTrajectory: PrecisionLine;
  private readonly spacecraftTrajectory: PrecisionLine;
  private readonly worldPositions = new Map<string, Vector3>();
  private readonly renderedRadii = new Map<string, number>();
  private readonly visibleLocators: Array<{
    id: string;
    mesh: InstancedMesh<SphereGeometry, MeshBasicMaterial>;
    index: number;
  }> = [];
  private visible = true;
  private earthSatellitesVisible = true;
  private spacecraftVisible = true;
  private selectedObjectId: string | null = null;
  private detailedInspectionObjectId: string | null = null;
  private inspectionSuppressedMarkerCount = 0;
  private renderedEarthSatelliteCount = 0;
  private renderedSpacecraftCount = 0;
  private selectedTrajectoryPointCount = 0;
  private workerClient: SpaceObjectWorkerClient | null = null;
  private workerResult: SpaceObjectWorkerResultResponse | null = null;
  private workerRequestPending = false;
  private issModelState: IssModelState = 'idle';
  private issModelLoad: Promise<void> | null = null;
  private issModelPhysicalCorrection = ISS_REFERENCE_SCALE.correction;
  private issModelPhysicalRadiusMeters = ISS_REFERENCE_SCALE.correctedBoundingRadiusMeters;
  private issModelMeshCount = 0;
  private issModelTriangleCount = 0;
  private selectionLabel: HTMLSpanElement | null = null;
  private selectionIndicator: HTMLSpanElement | null = null;
  private selectedOnScreen = false;
  private disposed = false;

  public constructor() {
    this.root.name = 'space-objects-layer';
    this.root.renderOrder = 5;
    const earthSatelliteGeometry = new SphereGeometry(1, 16, 12);
    this.earthSatelliteMesh = new InstancedMesh(
      earthSatelliteGeometry,
      createMarkerMaterial(EARTH_SATELLITE_MARKER_COLOR),
      EARTH_SATELLITE_DEFINITIONS.length,
    );
    this.earthSatelliteMesh.name = 'earth-satellite-markers';
    this.earthSatelliteMesh.frustumCulled = false;
    this.earthSatelliteMesh.renderOrder = 6;
    const spacecraftGeometry = new SphereGeometry(1, 16, 12);
    this.spacecraftMesh = new InstancedMesh(
      spacecraftGeometry,
      createMarkerMaterial(SPACECRAFT_MARKER_COLOR),
      SPACECRAFT_DEFINITIONS.length,
    );
    this.spacecraftMesh.name = 'spacecraft-probe-markers';
    this.spacecraftMesh.frustumCulled = false;
    this.spacecraftMesh.renderOrder = 6;
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
      this.voyagerModels.root,
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

  public setLabelContainer(container: HTMLElement | null): void {
    this.selectionLabel?.remove();
    this.selectionIndicator?.remove();
    this.selectionLabel = null;
    this.selectionIndicator = null;
    if (container === null) return;

    const label = document.createElement('span');
    label.className = 'space-object-screen-label';
    label.setAttribute('aria-hidden', 'true');
    container.append(label);
    this.selectionLabel = label;

    const indicator = document.createElement('span');
    indicator.className = 'body-selection-indicator auxiliary-selection-indicator space-object-selection-indicator';
    indicator.dataset.testid = 'selected-space-object-marker';
    indicator.setAttribute('aria-hidden', 'true');
    container.append(indicator);
    this.selectionIndicator = indicator;

  }

  public setEarthSatellitesVisible(visible: boolean): void {
    this.earthSatellitesVisible = visible;
  }

  public setSpacecraftVisible(visible: boolean): void {
    this.spacecraftVisible = visible;
  }

  public selectObject(id: string | null): void {
    if (id !== this.detailedInspectionObjectId) this.detailedInspectionObjectId = null;
    this.selectedObjectId = id;
    if (id === ISS_MODEL_ASSET.objectId) void this.requestIssModel();
    if (isVoyager(id)) void this.voyagerModels.request();
  }

  public setDetailedInspectionObject(id: string | null): void {
    this.detailedInspectionObjectId = id === ISS_MODEL_ASSET.objectId || isVoyager(id) ? id : null;
  }

  public getObjectWorldPosition(id: string): Vector3 | null {
    return this.worldPositions.get(id)?.clone() ?? null;
  }

  public getObjectRenderRadius(id: string): number {
    if (isVoyager(id)) return VOYAGER_MODEL_ASSET.boundingRadiusMeters * this.metersToRenderUnits;
    return this.renderedRadii.get(id) ?? 0.0003;
  }

  public getObjectNavigationRadius(id: string): number {
    return isVoyager(id) ? VOYAGER_MODEL_ASSET.dishRadiusMeters * this.metersToRenderUnits : this.getObjectRenderRadius(id);
  }

  public getObjectFocusUp(id: string): Vector3 {
    return isVoyager(id) ? this.voyagerModels.focusUp(id) : new Vector3(0, 1, 0);
  }

  public getObjectFocusDirection(id: string): Vector3 | null {
    if (isVoyager(id)) return this.voyagerModels.focusDirection(id);
    if (id !== ISS_MODEL_ASSET.objectId) return null;
    return ISS_FOCUS_DIRECTION.clone().applyQuaternion(this.issModelAnchor.quaternion).normalize();
  }

  public updateLabels(
    camera: Camera,
    viewportWidth: number,
    viewportHeight: number,
    suppressed = false,
  ): void {
    this.updateMarkerSizes(camera, viewportHeight);
    const id = this.selectedObjectId;
    const position = id === null ? undefined : this.worldPositions.get(id);
    const earthSatelliteSelected = id !== null && EARTH_SATELLITE_DEFINITIONS.some((item) => item.id === id);
    const categoryVisible = earthSatelliteSelected ? this.earthSatellitesVisible : this.spacecraftVisible;

    if (suppressed || !this.visible || !categoryVisible || id === null || position === undefined) {
      this.hideSelectionUi();
      return;
    }

    PROJECTED.copy(position).project(camera);
    const onScreen = PROJECTED.z >= -1 && PROJECTED.z <= 1
      && PROJECTED.x >= -1.05 && PROJECTED.x <= 1.05
      && PROJECTED.y >= -1.05 && PROJECTED.y <= 1.05;
    this.selectedOnScreen = onScreen;
    if (!onScreen) {
      this.hideSelectionUi(false);
      return;
    }
    const x = (PROJECTED.x * 0.5 + 0.5) * viewportWidth;
    const y = (-PROJECTED.y * 0.5 + 0.5) * viewportHeight;
    const definition = EARTH_SATELLITE_DEFINITIONS.find((item) => item.id === id)
      ?? SPACECRAFT_DEFINITIONS.find((item) => item.id === id);
    if (this.selectionLabel !== null) {
      this.selectionLabel.textContent = definition?.name ?? id;
      this.selectionLabel.dataset.objectId = id;
      this.selectionLabel.dataset.selected = 'true';
      this.selectionLabel.style.opacity = '1';
      this.selectionLabel.style.transform = `translate(${x + 15}px, ${y - 15}px)`;
    }
    if (this.selectionIndicator !== null) {
      this.selectionIndicator.dataset.objectId = id;
      this.selectionIndicator.style.opacity = isVoyager(id) && this.voyagerModels.state === 'ready' &&
        this.detailedInspectionObjectId === id ? '0' : '1';
      this.selectionIndicator.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
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
    this.visibleLocators.length = 0;
    this.worldPositions.clear();
    this.renderedRadii.clear();
    this.issModelAnchor.visible = false;
    this.voyagerModels.hide();
    this.metersToRenderUnits = scaleModel.metersToRenderUnits;
    this.inspectionSuppressedMarkerCount = 0;
    this.requestWorkerSample(frame.currentJdTdb);
    const earth = frame.bodies.find((body) => body.bodyId === 'earth');
    this.renderedEarthSatelliteCount = 0;
    this.selectedTrajectoryPointCount = 0;
    this.earthSatelliteTrajectory.visible = false;
    this.spacecraftTrajectory.visible = false;
    if (earth !== undefined && earth.visible && this.earthSatellitesVisible) {
      scaleModel.mapPosition(EARTH, earth.positionM, originM);
      const earthRelativeScale = bodyRelativePhysicalScale(
        scaleModel.radiusFor(earth),
        EARTH_RADIUS_M,
        scaleModel.metersToRenderUnits,
      );
      EARTH_SATELLITE_DEFINITIONS.forEach((satellite, index) => {
        const state = this.earthSatelliteState(satellite, frame.currentJdTdb);
        if (state.dataAgeState === 'outside-hard-window' || state.propagationStatus !== 'ok') {
          this.hideInstance(this.earthSatelliteMesh, index);
          return;
        }
        scaleModel.mapPosition(LOCAL, {
          x: state.positionEarthCenteredM.x * earthRelativeScale.positionMultiplier,
          y: state.positionEarthCenteredM.y * earthRelativeScale.positionMultiplier,
          z: state.positionEarthCenteredM.z * earthRelativeScale.positionMultiplier,
        }, ZERO);
        OBJECT.position.copy(EARTH).add(LOCAL);
        const isIss = index === ISS_INDEX;
        const suppressLocator = satellite.id !== this.selectedObjectId;
        const baseRadius = isIss
          ? this.issModelPhysicalRadiusMeters * earthRelativeScale.metersToRenderUnits
          : earthSatelliteMarkerRadius(this.selectedObjectId === satellite.id, scaleModel.mode);
        const useIssModel = isIss && this.issModelState === 'ready' && !suppressLocator;
        if (useIssModel) {
          this.hideInstance(this.earthSatelliteMesh, index);
          this.updateIssModel(
            OBJECT.position,
            state.positionEarthCenteredM,
            state.velocityEarthCenteredMps,
            earthRelativeScale.metersToRenderUnits,
          );
        } else if (suppressLocator) {
          this.hideInstance(this.earthSatelliteMesh, index);
          if (this.detailedInspectionObjectId !== null) this.inspectionSuppressedMarkerCount += 1;
        } else {
          OBJECT.scale.setScalar(baseRadius);
          OBJECT.updateMatrix();
          MATRIX.copy(OBJECT.matrix);
          this.earthSatelliteMesh.setMatrixAt(index, MATRIX);
          if (!isIss) this.visibleLocators.push({ id: satellite.id, mesh: this.earthSatelliteMesh, index });
        }
        this.recordObjectPosition(satellite.id, OBJECT.position, baseRadius);
        if (!suppressLocator) this.renderedEarthSatelliteCount += 1;
      });
      const selectedSatellite = EARTH_SATELLITE_DEFINITIONS.find((satellite) => satellite.id === this.selectedObjectId);
      if (selectedSatellite !== undefined) {
        const selectedState = sampleEarthSatellite(selectedSatellite, frame.currentJdTdb);
        if (selectedState.dataAgeState !== 'outside-hard-window' && selectedState.propagationStatus === 'ok') {
          this.updateEarthSatelliteTrajectory(
            selectedSatellite,
            frame.currentJdTdb,
            EARTH,
            scaleModel,
            earthRelativeScale.positionMultiplier,
          );
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
        const detailedVoyager = isVoyager(mission.id) && this.selectedObjectId === mission.id;
        const baseRadius = detailedVoyager ? this.getObjectRenderRadius(mission.id) : spacecraftMarkerRadius(
          this.selectedObjectId === mission.id, scaleModel.mode,
        );
        const modelShown = isVoyager(mission.id) && this.voyagerModels.update(mission.id, OBJECT.position,
          earth?.positionM, state.positionM, scaleModel.metersToRenderUnits, detailedVoyager);
        const suppressLocator = mission.id !== this.selectedObjectId;
        if (modelShown) {
          this.hideInstance(this.spacecraftMesh, index);
        } else if (suppressLocator) {
          this.hideInstance(this.spacecraftMesh, index);
          if (this.detailedInspectionObjectId !== null) this.inspectionSuppressedMarkerCount += 1;
        } else {
          OBJECT.scale.setScalar(baseRadius);
          OBJECT.updateMatrix();
          MATRIX.copy(OBJECT.matrix);
          this.spacecraftMesh.setMatrixAt(index, MATRIX);
          if (!detailedVoyager) this.visibleLocators.push({ id: mission.id, mesh: this.spacecraftMesh, index });
        }
        this.recordObjectPosition(mission.id, OBJECT.position, baseRadius);
        if (!suppressLocator) this.renderedSpacecraftCount += 1;
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
      detailedInspectionObjectId: this.detailedInspectionObjectId,
      inspectionSuppressedMarkerCount: this.inspectionSuppressedMarkerCount,
      markersNotToScale: true,
      selectedTrajectoryPointCount: this.selectedTrajectoryPointCount,
      propagationExecution: this.workerClient === null ? 'direct-fallback' : 'module-worker',
      voyagerModelState: this.voyagerModels.state,
      voyagerModelMeshCount: this.voyagerModels.meshCount,
      voyagerModelAssetId: VOYAGER_MODEL_ASSET.assetId,
      issModelState: this.issModelState,
      issModelAssetId: ISS_MODEL_ASSET.assetId,
      issModelMeshCount: this.issModelMeshCount,
      issModelTriangleCount: this.issModelTriangleCount,
      issPhysicalSpanMeters: ISS_MODEL_ASSET.physicalSpanMeters,
      issSpanToEarthDiameter: ISS_SPAN_TO_EARTH_DIAMETER,
      issScalePolicy: 'physical-earth-relative',
      selectedRenderRadius: this.selectedObjectId === null
        ? null
        : this.renderedRadii.get(this.selectedObjectId) ?? null,
      selectedOnScreen: this.selectedOnScreen,
      coverageLabelCount: 0,
    });
  }

  public dispose(): void {
    this.disposed = true;
    this.voyagerModels.dispose();
    this.root.traverse((object) => {
      const renderable = object as typeof object & {
        geometry?: { dispose(): void };
        material?: MeshBasicMaterial | MeshStandardMaterial | Array<MeshBasicMaterial | MeshStandardMaterial>;
      };
      renderable.geometry?.dispose();
      const materials = Array.isArray(renderable.material)
        ? renderable.material
        : renderable.material === undefined ? [] : [renderable.material];
      for (const material of materials) disposeMaterial(material);
    });
    this.workerClient?.dispose();
    this.workerClient = null;
    this.selectionLabel?.remove();
    this.selectionIndicator?.remove();
    this.selectionLabel = null;
    this.selectionIndicator = null;
    this.worldPositions.clear();
    this.renderedRadii.clear();
    this.root.clear();
  }

  private hideSelectionUi(resetOnScreen = true): void {
    if (resetOnScreen) this.selectedOnScreen = false;
    if (this.selectionLabel !== null) this.selectionLabel.style.opacity = '0';
    if (this.selectionIndicator !== null) this.selectionIndicator.style.opacity = '0';
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
      ISS_BOUNDS.getSize(ISS_SIZE);
      if (!Number.isFinite(ISS_SPHERE.radius) || ISS_SPHERE.radius <= 0) {
        throw new Error('NASA ISS model has invalid bounds.');
      }
      model.position.sub(ISS_CENTER);
      const physicalScale = physicalModelScale(
        [ISS_SIZE.x, ISS_SIZE.y, ISS_SIZE.z],
        ISS_MODEL_ASSET.physicalSpanMeters,
      );
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
      this.issModelPhysicalCorrection = physicalScale.correction;
      this.issModelPhysicalRadiusMeters = ISS_SPHERE.radius * physicalScale.correction;
      this.issModelAnchor.add(model);
      this.issModelState = 'ready';
    } catch (error) {
      this.issModelState = 'fallback';
      console.warn('NASA ISS model unavailable; retaining its physical-scale locator.', error);
    }
  }

  private updateIssModel(
    position: Readonly<Vector3>,
    earthCenteredPositionM: Readonly<PhysicalPosition>,
    earthCenteredVelocityMps: Readonly<PhysicalPosition>,
    metersToRenderUnits: number,
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
    this.issModelAnchor.scale.setScalar(metersToRenderUnits * this.issModelPhysicalCorrection);
    this.issModelAnchor.updateMatrixWorld();
  }

  private requestWorkerSample(jdTdb: number): void {
    if (this.workerClient === null || this.workerRequestPending || this.workerResult?.jdTdb === jdTdb) return;
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
    if (workerState === undefined || workerResult === null || workerResult.jdTdb !== jdTdb) {
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
    if (workerState === undefined || workerResult === null || workerResult.jdTdb !== jdTdb) {
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

  private updateMarkerSizes(camera: Camera, viewportHeight: number): void {
    if (!this.visible) return;
    camera.updateMatrixWorld();
    for (const { id, mesh, index } of this.visibleLocators) {
      const position = this.worldPositions.get(id);
      const baseRadius = this.renderedRadii.get(id);
      if (position === undefined || baseRadius === undefined) continue;
      OBJECT.position.copy(position);
      OBJECT.scale.setScalar(screenAwareMarkerRadius(
        baseRadius, position, camera, viewportHeight, id === this.selectedObjectId,
      ));
      OBJECT.updateMatrix();
      mesh.setMatrixAt(index, OBJECT.matrix);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  private hideInstance(mesh: InstancedMesh<SphereGeometry, MeshBasicMaterial>, index: number): void {
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
    positionMultiplier: number,
  ): void {
    const current = this.earthSatelliteState(satellite, jdTdb).positionEarthCenteredM;
    const precision = this.earthSatelliteTrajectory.path;
    const output = precision.positions;
    scaleModel.mapPosition(LOCAL, {
      x: current.x * positionMultiplier, y: current.y * positionMultiplier, z: current.z * positionMultiplier,
    }, ZERO);
    precision.anchor.copy(earthPosition).add(LOCAL);
    const path = sampleEarthSatelliteOrbitPath(satellite, jdTdb, 96, 1);
    // Subtract in physical doubles before converting to the rendered scale.
    const unit = positionMultiplier / scaleModel.metersPerRenderUnit;
    for (let index = 0; index < 96; index += 1) {
      output[index * 3] = (path[index * 3]! - current.x) * unit;
      output[index * 3 + 1] = (path[index * 3 + 2]! - current.z) * unit;
      output[index * 3 + 2] = (current.y - path[index * 3 + 1]!) * unit;
    }
    this.earthSatelliteTrajectory.visible = true;
    this.selectedTrajectoryPointCount = 96;
  }

  private updateSpacecraftTrajectory(
    mission: (typeof SPACECRAFT_DEFINITIONS)[number],
    jdTdb: number,
    scaleModel: Readonly<RenderScaleModel>,
    originM: Readonly<PhysicalPosition>,
  ): void {
    const current = this.spacecraftState(mission, jdTdb).positionM;
    const precision = this.spacecraftTrajectory.path;
    const output = precision.positions;
    scaleModel.mapPosition(precision.anchor, current, originM);
    const path = sampleSpacecraftTrajectoryPath(mission, jdTdb, 128);
    const unit = scaleModel.metersPerRenderUnit;
    for (let index = 0; index < 128; index += 1) {
      output[index * 3] = (path[index * 3]! - current.x) / unit;
      output[index * 3 + 1] = (path[index * 3 + 2]! - current.z) / unit;
      output[index * 3 + 2] = (current.y - path[index * 3 + 1]!) / unit;
    }
    this.spacecraftTrajectory.visible = true;
    this.selectedTrajectoryPointCount = 128;
  }
}

function createMarkerMaterial(color: number): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    toneMapped: false,
  });
}

function createTrajectoryLine(name: string, points: number, color: number): PrecisionLine {
  const line = new PrecisionLine(points, new LineBasicMaterial({ color, transparent: true, opacity: 0.7 }));
  line.name = name;
  line.frustumCulled = false;
  line.visible = false;
  return line;
}

function disposeMaterial(material: MeshBasicMaterial | MeshStandardMaterial): void {
  const textures = new Set<Texture>();
  for (const value of Object.values(material)) {
    if (value instanceof Texture) textures.add(value);
  }
  for (const texture of textures) texture.dispose();
  material.dispose();
}
