import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type BufferAttribute,
  type Material,
  type Object3D,
} from 'three';

import type { VisualQuality } from '../bodies/VisualQuality';
import { AtmosphericScarRenderer } from './AtmosphericScarRenderer';
import { CraterPatchRenderer } from './CraterPatchRenderer';
import { EjectaRenderer } from './EjectaRenderer';
import { ImpactFlashRenderer } from './ImpactFlashRenderer';
import {
  EMPTY_IMPACT_DIAGNOSTICS,
  IMPACT_AFTERMATH_KINDS,
  IMPACT_ENTRY_EFFECT_PROFILES,
  IMPACT_IMPACTOR_MATERIALS,
  IMPACT_LIFECYCLE_STATES,
  IMPACT_RENDER_OUTCOME_KINDS,
  IMPACT_RENDER_TARGET_CLASSES,
  IMPACT_SURFACE_EFFECT_PROFILES,
  IMPACT_VISUAL_STAGES,
  type ImpactCameraPresetId,
  type ImpactEntryEffectProfile,
  type ImpactImpactorMaterial,
  type ImpactRenderState,
  type ImpactVisualDiagnostics,
} from './ImpactRenderTypes';
import { SurfaceShockwaveRenderer } from './SurfaceShockwaveRenderer';
import { VolumetricPlumeRenderer } from './VolumetricPlumeRenderer';

const MAX_TRAIL_POINTS = 256;
const MAX_PREVIEW_TRAJECTORY_POINTS = 256;
const MAX_FRAGMENTS = 96;
const SURFACE_IMPACT_STAGES = new Set([
  'impact',
  'impact-flash',
  'ejecta',
  'plume',
  'haze',
  'aftermath',
  'complete',
]);
const ENTRY_EFFECT_STAGES = new Set(['entry', 'atmospheric-entry', 'fragmentation']);
const ENTRY_PROFILE_STRENGTH: Readonly<Record<ImpactEntryEffectProfile, number>> = {
  none: 0,
  thin: 0.38,
  dense: 1,
  giant: 1.25,
};
const Y_AXIS = new Vector3(0, 1, 0);

interface DynamicLineResources {
  readonly line: Line<BufferGeometry, LineBasicMaterial>;
  readonly attribute: BufferAttribute;
  readonly maximumCount: number;
}

interface DynamicEntryTrailResources {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  readonly positionAttribute: BufferAttribute;
  readonly progressAttribute: BufferAttribute;
  readonly maximumCount: number;
}

interface QualityBudget {
  readonly trail: number;
  readonly fragments: number;
  readonly ejecta: number;
  readonly plume: number;
  readonly pointSize: number;
}

/**
 * Preallocated target-body-local visual layer for Impact Lab.
 * Resetting a run never allocates or disposes GPU resources.
 */
export class ImpactVisualSystem {
  public readonly root = new Group();

  private readonly previewReticleGeometry = new BufferGeometry();
  private readonly previewReticleMaterial = new ShaderMaterial({
    depthTest: true,
    depthWrite: false,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 point = gl_PointCoord * 2.0 - 1.0;
        float radius = length(point);
        float ring = 1.0 - smoothstep(0.055, 0.115, abs(radius - 0.62));
        float horizontal = (1.0 - smoothstep(0.045, 0.11, abs(point.y)))
          * step(0.72, abs(point.x)) * step(abs(point.x), 0.96);
        float vertical = (1.0 - smoothstep(0.045, 0.11, abs(point.x)))
          * step(0.72, abs(point.y)) * step(abs(point.y), 0.96);
        float alpha = max(ring, max(horizontal, vertical));
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(vColor, alpha * 0.96);
      }
    `,
    transparent: true,
    uniforms: {
      uPointSize: { value: 22 },
      uReticleColor: { value: new Color(0x8bdcff) },
    },
    vertexShader: `
      uniform float uPointSize;
      uniform vec3 uReticleColor;
      varying vec3 vColor;
      void main() {
        vColor = uReticleColor;
        gl_PointSize = uPointSize;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  });
  private readonly previewReticle = new Points(
    this.previewReticleGeometry,
    this.previewReticleMaterial,
  );
  private readonly previewTrajectory = createDynamicLine(
    'impact-preview-trajectory',
    MAX_PREVIEW_TRAJECTORY_POINTS,
  );

  private readonly impactorGeometry = new IcosahedronGeometry(1, 2);
  private readonly impactorBasePositions: Float32Array;
  private readonly impactorMaterial = new MeshStandardMaterial({
    color: 0x453c36,
    emissive: 0x1d0903,
    emissiveIntensity: 0.35,
    flatShading: true,
    metalness: 0.08,
    roughness: 0.92,
  });
  private readonly impactor = new Mesh(this.impactorGeometry, this.impactorMaterial);
  private readonly bowShockGeometry = new SphereGeometry(
    1,
    24,
    12,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.5,
  );
  private readonly bowShockMaterial = new MeshBasicMaterial({
    blending: AdditiveBlending,
    color: 0xffd7a6,
    depthTest: true,
    depthWrite: false,
    opacity: 0,
    side: DoubleSide,
    toneMapped: false,
    transparent: true,
  });
  private readonly bowShock = new Mesh(this.bowShockGeometry, this.bowShockMaterial);
  private readonly plasmaGeometry = new ConeGeometry(1, 3, 24, 2, true);
  private readonly plasmaMaterial = new MeshBasicMaterial({
    blending: AdditiveBlending,
    color: 0xff6a28,
    depthTest: true,
    depthWrite: false,
    opacity: 0,
    side: DoubleSide,
    toneMapped: false,
    transparent: true,
  });
  private readonly plasma = new Mesh(this.plasmaGeometry, this.plasmaMaterial);
  private readonly fragmentGeometry = new IcosahedronGeometry(1, 1);
  private readonly fragmentMaterial = new MeshStandardMaterial({
    color: 0x51443a,
    emissive: 0x351005,
    emissiveIntensity: 0.5,
    flatShading: true,
    metalness: 0.05,
    roughness: 0.95,
  });
  private readonly fragments = new InstancedMesh(
    this.fragmentGeometry,
    this.fragmentMaterial,
    MAX_FRAGMENTS,
  );
  private readonly trail = createDynamicEntryTrail(MAX_TRAIL_POINTS);
  private readonly impactFlash = new ImpactFlashRenderer();
  private readonly craterPatch = new CraterPatchRenderer();
  private readonly surfaceShockwave = new SurfaceShockwaveRenderer();
  private readonly ejecta = new EjectaRenderer();
  private readonly plume = new VolumetricPlumeRenderer();
  private readonly atmosphericScar = new AtmosphericScarRenderer();

  private readonly normal = new Vector3(0, 1, 0);
  private readonly east = new Vector3(1, 0, 0);
  private readonly north = new Vector3(0, 0, 1);
  private readonly surfaceBasis = {
    normal: this.normal,
    east: this.east,
    north: this.north,
  };
  private readonly scratchPosition = new Vector3();
  private readonly scratchQuaternion = new Quaternion();
  private readonly scratchMatrix = new Matrix4();
  private readonly scratchScale = new Vector3();
  private readonly velocityBodyLocal = new Vector3();
  private readonly alignedDirection = new Vector3();
  private readonly tumbleAxis = new Vector3(0.33, 0.78, 0.53).normalize();
  private deformedRunSignature = '';
  private quality: VisualQuality;
  private reducedMotion = false;
  private reduceFlashes = true;
  private cameraPresetId: ImpactCameraPresetId | null = null;
  private diagnostics: Readonly<ImpactVisualDiagnostics> = EMPTY_IMPACT_DIAGNOSTICS;
  private disposed = false;

  public constructor(initialQuality: VisualQuality = 'high') {
    this.quality = initialQuality;
    this.root.name = 'impact-lab-target-local-layer';
    this.root.visible = false;
    this.impactorBasePositions = Float32Array.from(
      this.impactorGeometry.getAttribute('position').array,
    );

    this.previewReticleGeometry.setAttribute(
      'position',
      new Float32BufferAttribute(new Float32Array([0, 0, 0]), 3),
    );
    this.previewReticle.name = 'impact-preview-target-reticle';
    this.previewReticle.frustumCulled = false;
    this.previewReticle.renderOrder = 6;

    this.impactor.name = 'impact-impactor';
    this.impactor.renderOrder = 7;
    this.bowShock.name = 'impact-entry-bow-shock';
    this.bowShock.renderOrder = 9;
    this.plasma.name = 'impact-entry-plasma-envelope';
    this.plasma.renderOrder = 8;
    this.fragments.name = 'impact-fragments';
    this.fragments.renderOrder = 8;
    this.fragments.count = 0;
    this.trail.points.material.uniforms.uIntensity!.value = 0;
    this.trail.points.material.uniforms.uHeating!.value = 0;
    this.fragments.instanceMatrix.setUsage(DynamicDrawUsage);
    this.root.add(
      this.previewReticle,
      this.previewTrajectory.line,
      this.impactor,
      this.bowShock,
      this.plasma,
      this.trail.points,
      this.fragments,
      this.impactFlash.root,
      this.craterPatch.root,
      this.surfaceShockwave.root,
      this.ejecta.root,
      this.plume.root,
      this.atmosphericScar.root,
    );
    this.applyQuality();
    this.reset();
  }

  public attachToTarget(targetRoot: Group): void {
    this.assertNotDisposed();
    if (this.root.parent === targetRoot) return;
    targetRoot.add(this.root);
  }

  /** @deprecated Use attachToTarget. Kept temporarily for Earth-only callers. */
  public attachToEarth(earthRoot: Group): void {
    this.attachToTarget(earthRoot);
  }

  public update(state: Readonly<ImpactRenderState>): void {
    this.assertNotDisposed();
    validateState(state);
    setBodyLocalAsVisualLocal(this.normal, state.impactNormalBodyLocal, 'normal');
    setBodyLocalAsVisualLocal(this.east, state.impactEastBodyLocal, 'east');
    setBodyLocalAsVisualLocal(this.north, state.impactNorthBodyLocal, 'north');

    if (state.presentationMode === 'preview') {
      this.updatePreview(state);
      return;
    }

    this.hidePreviewVisuals();
    const active = state.lifecycleState !== 'idle' && state.lifecycleState !== 'error';
    const surfaceImpact = SURFACE_IMPACT_STAGES.has(state.stage);
    const budget = qualityBudget(this.quality, this.reducedMotion);
    const radiusM = state.targetRadiusM;
    const runSeed = hashString(state.runSignature);
    const entryStage = ENTRY_EFFECT_STAGES.has(state.stage);
    const entryProfileStrength = ENTRY_PROFILE_STRENGTH[state.entryEffectProfile];
    const physicalEntryIntensity = clamp01(
      state.normalizedHeating * 0.72 + state.normalizedDynamicPressure * 0.28,
    );
    const entryEffectIntensity = clamp01(entryProfileStrength * physicalEntryIntensity);

    this.root.visible = active;

    this.applyImpactorDeformation(state.runSignature, runSeed);
    this.applyImpactorMaterial(state.impactorMaterial, state.normalizedHeating);
    const remainingRadiusFraction = Math.max(
      0.16,
      Math.cbrt(state.remainingMassFraction),
    );
    const physicalImpactorRadius = state.physicalDiameterM * 0.5 / radiusM
      * remainingRadiusFraction;
    const impactorRadius = impactorVisualRadius(state.physicalDiameterM, radiusM)
      * remainingRadiusFraction;
    const impactorSizeExaggerated = impactorRadius
      > physicalImpactorRadius * (1 + 1e-6);
    if (state.impactorLocalEnuM !== null) {
      mapEnuToBodyLocal(
        this.impactor.position,
        state.impactorLocalEnuM.eastM,
        state.impactorLocalEnuM.northM,
        state.impactorLocalEnuM.upM,
        radiusM,
        this.normal,
        this.east,
        this.north,
      );
    }
    this.impactor.scale.setScalar(impactorRadius);
    this.updateImpactorTumble(state.scenarioTimeSeconds, runSeed);
    this.impactor.visible =
      active && state.impactorLocalEnuM !== null && !surfaceImpact && state.stage !== 'airburst';

    const velocityAvailable = this.updateVelocityDirection(
      state.impactorVelocityLocalEnuMps,
    );
    const entryEffectsEnabled = active
      && entryStage
      && state.entryEffectProfile !== 'none'
      && velocityAvailable
      && state.impactorLocalEnuM !== null
      && entryEffectIntensity > 0.002;
    const velocityAlignmentDot = entryEffectsEnabled
      ? this.updateEntryEnvelopes(
          impactorRadius,
          entryEffectIntensity,
          entryProfileStrength,
          state.entryEffectProfile,
        )
      : 0;
    if (!entryEffectsEnabled) {
      this.bowShock.visible = false;
      this.plasma.visible = false;
      this.bowShockMaterial.opacity = 0;
      this.plasmaMaterial.opacity = 0;
    }

    const trailPointCount = entryEffectsEnabled
      ? writeEnuArray(
          this.trail.positionAttribute,
          state.trailLocalEnuM,
          Math.min(this.trail.maximumCount, budget.trail),
          radiusM,
          this.normal,
          this.east,
          this.north,
        )
      : 0;
    this.updateEntryTrailProgress(trailPointCount);
    this.trail.points.material.uniforms.uIntensity!.value = entryEffectIntensity;
    this.trail.points.material.uniforms.uHeating!.value = state.normalizedHeating;
    this.trail.points.geometry.setDrawRange(0, trailPointCount);
    this.trail.points.visible = entryEffectsEnabled && trailPointCount >= 2;

    const fragmentCount = this.updateFragments(state, budget.fragments, impactorRadius, runSeed);
    this.fragments.visible = active && fragmentCount > 0 && !surfaceImpact;
    this.ejecta.setBudget(budget.ejecta, budget.pointSize);
    this.plume.setBudget(budget.plume, budget.pointSize + 2);
    this.impactFlash.update(state, this.surfaceBasis, active, this.reduceFlashes);
    this.craterPatch.update(state, this.surfaceBasis, active);
    this.surfaceShockwave.update(state, this.surfaceBasis, active);
    this.ejecta.update(state, this.surfaceBasis, active);
    this.plume.update(state, this.surfaceBasis, active);
    this.atmosphericScar.update(state, this.surfaceBasis, active);

    const ejectaPointCount = this.ejecta.activeCount;
    const plumePointCount = this.plume.pointCount;
    const flashVisible = this.impactFlash.visible;
    const shockwaveVisible = this.surfaceShockwave.groundVisible
      || this.surfaceShockwave.atmosphericVisible;
    const hazeVisible = this.plume.visible && state.hazeOpacity > 0;
    const giantTarget = state.targetClass === 'gas-giant' || state.targetClass === 'ice-giant';
    const solidSurfaceEffectsSuppressed = giantTarget
      && !this.craterPatch.visible
      && !this.surfaceShockwave.groundVisible
      && !this.ejecta.visible;
    const aftermathPersistent = this.craterPatch.persistent || this.atmosphericScar.visible;
    const activeObjectCount = Number(this.impactor.visible)
      + Number(this.bowShock.visible)
      + Number(this.plasma.visible)
      + Number(this.trail.points.visible)
      + Number(this.fragments.visible)
      + this.impactFlash.activeObjectCount
      + this.craterPatch.activeObjectCount
      + this.surfaceShockwave.activeObjectCount
      + this.ejecta.activeObjectCount
      + this.plume.activeObjectCount
      + this.atmosphericScar.activeObjectCount;

    const maximumAltitudeRatio = Math.max(
      state.impactorLocalEnuM?.upM ?? 0,
      state.plumeHeightM,
      state.ejectaRadiusM,
      state.shockwaveRadiusM,
    ) / radiusM;
    this.diagnostics = Object.freeze({
      active,
      presentationMode: state.presentationMode,
      lifecycleState: state.lifecycleState,
      stage: state.stage,
      runSignature: state.runSignature,
      cameraPresetId: this.cameraPresetId,
      reticleVisible: false,
      projectedTrajectoryPointCount: 0,
      trailPointCount,
      fragmentCount,
      ejectaPointCount,
      plumePointCount,
      impactorVisible: this.impactor.visible,
      bowShockVisible: this.bowShock.visible,
      plasmaVisible: this.plasma.visible,
      entryTrailVisible: this.trail.points.visible,
      velocityAlignmentDot,
      impactorSizeExaggerated,
      normalizedHeating: state.normalizedHeating,
      entryEffectProfile: state.entryEffectProfile,
      entryEffectIntensity,
      outcomeKind: state.outcomeKind,
      surfaceEffectProfile: state.surfaceEffectProfile,
      aftermathKind: state.aftermathKind,
      flashVisible,
      flashAttachmentErrorM: this.impactFlash.attachmentErrorM,
      flashNormalAlignmentDot: this.impactFlash.normalAlignmentDot,
      flashCapAngularRadiusRad: this.impactFlash.capAngularRadiusRad,
      flashLightVisible: this.impactFlash.lightVisible,
      flashHdrClamped: this.impactFlash.hdrClamped,
      craterVisible: this.craterPatch.visible,
      craterAttachmentErrorM: this.craterPatch.attachmentErrorM,
      craterAngularRadiusRad: this.craterPatch.angularRadiusRad,
      craterFormationProgress: this.craterPatch.formationProgress,
      craterPersistent: this.craterPatch.persistent,
      shockwaveVisible,
      groundShockwaveVisible: this.surfaceShockwave.groundVisible,
      atmosphericShockwaveVisible: this.surfaceShockwave.atmosphericVisible,
      groundShockwaveAngularRadiusRad: this.surfaceShockwave.groundAngularRadiusRad,
      atmosphericShockwaveAngularRadiusRad:
        this.surfaceShockwave.atmosphericAngularRadiusRad,
      shockwaveSurfaceConforming: this.surfaceShockwave.surfaceConforming,
      ejectaActiveCount: this.ejecta.activeCount,
      ejectaRecontactCount: this.ejecta.recontactCount,
      plumeVisible: this.plume.visible,
      plumeLayerCount: this.plume.layerCount,
      plumeCoolingProgress: this.plume.coolingProgress,
      cloudScarVisible: this.atmosphericScar.visible,
      cloudRippleVisible: this.atmosphericScar.rippleVisible,
      cloudScarAngularRadiusRad: this.atmosphericScar.angularRadiusRad,
      cloudScarOpacity: this.atmosphericScar.opacity,
      cloudScarAdvectionRad: this.atmosphericScar.advectionRad,
      solidSurfaceEffectsSuppressed,
      aftermathPersistent,
      activeObjectCount,
      hazeVisible,
      effectiveFlashIntensity: this.impactFlash.effectiveIntensity,
      boundingRadiusMultiplier: Math.max(1.04, 1 + maximumAltitudeRatio),
    });
  }

  public reset(): void {
    if (this.disposed) return;
    this.root.visible = false;
    this.root.children.forEach((child) => { child.visible = false; });
    this.previewTrajectory.line.geometry.setDrawRange(0, 0);
    this.trail.points.geometry.setDrawRange(0, 0);
    this.fragments.count = 0;
    this.trail.points.material.uniforms.uIntensity!.value = 0;
    this.trail.points.material.uniforms.uHeating!.value = 0;
    this.bowShockMaterial.opacity = 0;
    this.plasmaMaterial.opacity = 0;
    this.impactFlash.reset();
    this.craterPatch.reset();
    this.surfaceShockwave.reset();
    this.ejecta.reset();
    this.plume.reset();
    this.atmosphericScar.reset();
    this.cameraPresetId = null;
    this.diagnostics = EMPTY_IMPACT_DIAGNOSTICS;
    this.root.removeFromParent();
  }

  public setQuality(quality: VisualQuality): void {
    this.assertNotDisposed();
    if (this.quality === quality) return;
    this.quality = quality;
    this.applyQuality();
  }

  public setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
  }

  public setReduceFlashes(reduceFlashes: boolean): void {
    this.reduceFlashes = reduceFlashes;
  }

  public setCameraPreset(presetId: ImpactCameraPresetId | null): void {
    this.cameraPresetId = presetId;
    this.diagnostics = Object.freeze({ ...this.diagnostics, cameraPresetId: presetId });
  }

  public getDiagnostics(): Readonly<ImpactVisualDiagnostics> {
    return this.diagnostics;
  }

  public getProtectiveExposureCeiling(): number | null {
    if (!this.diagnostics.flashVisible) return null;
    return this.reduceFlashes ? 0.5 : 0.58;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.impactFlash.dispose();
    this.craterPatch.dispose();
    this.surfaceShockwave.dispose();
    this.ejecta.dispose();
    this.plume.dispose();
    this.atmosphericScar.dispose();
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    this.root.traverse((object: Object3D) => {
      const renderable = object as Object3D & {
        geometry?: BufferGeometry;
        material?: Material | Material[];
      };
      if (renderable.geometry !== undefined) geometries.add(renderable.geometry);
      if (Array.isArray(renderable.material)) {
        renderable.material.forEach((material) => materials.add(material));
      } else if (renderable.material !== undefined) {
        materials.add(renderable.material);
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    this.root.clear();
    this.diagnostics = EMPTY_IMPACT_DIAGNOSTICS;
  }

  private updatePreview(state: Readonly<ImpactRenderState>): void {
    this.hidePlaybackVisuals();
    const visible = state.lifecycleState !== 'error';
    this.root.visible = visible;

    this.previewReticle.position.copy(this.normal).multiplyScalar(1.00002);
    this.previewReticle.visible = visible;

    const projectedTrajectoryPointCount = writeEnuArray(
      this.previewTrajectory.attribute,
      state.trailLocalEnuM,
      this.previewTrajectory.maximumCount,
      state.targetRadiusM,
      this.normal,
      this.east,
      this.north,
    );
    this.previewTrajectory.line.geometry.setDrawRange(0, projectedTrajectoryPointCount);
    this.previewTrajectory.line.visible = visible && projectedTrajectoryPointCount >= 2;

    const maximumAltitudeRatio = maximumEnuAltitudeM(state.trailLocalEnuM)
      / state.targetRadiusM;
    this.diagnostics = Object.freeze({
      active: visible,
      presentationMode: state.presentationMode,
      lifecycleState: state.lifecycleState,
      stage: state.stage,
      runSignature: state.runSignature,
      cameraPresetId: this.cameraPresetId,
      reticleVisible: this.previewReticle.visible,
      projectedTrajectoryPointCount: this.previewTrajectory.line.visible
        ? projectedTrajectoryPointCount
        : 0,
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
      entryEffectProfile: state.entryEffectProfile,
      entryEffectIntensity: 0,
      outcomeKind: state.outcomeKind,
      surfaceEffectProfile: state.surfaceEffectProfile,
      aftermathKind: state.aftermathKind,
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
      activeObjectCount: Number(this.previewReticle.visible)
        + Number(this.previewTrajectory.line.visible),
      hazeVisible: false,
      effectiveFlashIntensity: 0,
      boundingRadiusMultiplier: Math.max(1.00002, 1 + maximumAltitudeRatio),
    });
  }

  private hidePreviewVisuals(): void {
    this.previewReticle.visible = false;
    this.previewTrajectory.line.visible = false;
    this.previewTrajectory.line.geometry.setDrawRange(0, 0);
  }

  private hidePlaybackVisuals(): void {
    this.impactor.visible = false;
    this.bowShock.visible = false;
    this.bowShockMaterial.opacity = 0;
    this.plasma.visible = false;
    this.plasmaMaterial.opacity = 0;
    this.trail.points.visible = false;
    this.trail.points.geometry.setDrawRange(0, 0);
    this.fragments.visible = false;
    this.fragments.count = 0;
    this.impactFlash.reset();
    this.craterPatch.reset();
    this.surfaceShockwave.reset();
    this.ejecta.reset();
    this.plume.reset();
    this.atmosphericScar.reset();
  }

  private applyImpactorDeformation(signature: string, seed: number): void {
    if (this.deformedRunSignature === signature) return;
    const attribute = this.impactorGeometry.getAttribute('position') as BufferAttribute;
    const output = attribute.array as Float32Array;
    const axisX = 0.88 + random01(seed, 401) * 0.22;
    const axisY = 0.82 + random01(seed, 402) * 0.28;
    const axisZ = 0.86 + random01(seed, 403) * 0.24;
    for (let offset = 0; offset < output.length; offset += 3) {
      const baseX = this.impactorBasePositions[offset] ?? 0;
      const baseY = this.impactorBasePositions[offset + 1] ?? 0;
      const baseZ = this.impactorBasePositions[offset + 2] ?? 0;
      const coordinateSeed = Math.abs(Math.round(
        baseX * 7_919 + baseY * 15_491 + baseZ * 31_337,
      ));
      const deformation = 0.78 + random01(seed ^ coordinateSeed, 0) * 0.39;
      output[offset] = baseX * deformation * axisX;
      output[offset + 1] = baseY * deformation * axisY;
      output[offset + 2] = baseZ * deformation * axisZ;
    }
    attribute.needsUpdate = true;
    this.impactorGeometry.computeVertexNormals();
    this.impactorGeometry.computeBoundingSphere();
    this.deformedRunSignature = signature;
  }

  private applyImpactorMaterial(
    material: ImpactImpactorMaterial,
    normalizedHeating: number,
  ): void {
    if (material === 'iron') {
      this.impactorMaterial.color.setHex(0x4c5154);
      this.impactorMaterial.metalness = 0.76;
      this.impactorMaterial.roughness = 0.38;
      this.fragmentMaterial.color.setHex(0x565b5e);
      this.fragmentMaterial.metalness = 0.7;
      this.fragmentMaterial.roughness = 0.4;
    } else if (material === 'porous-rock') {
      this.impactorMaterial.color.setHex(0x302821);
      this.impactorMaterial.metalness = 0.01;
      this.impactorMaterial.roughness = 0.98;
      this.fragmentMaterial.color.setHex(0x3a2d25);
      this.fragmentMaterial.metalness = 0.01;
      this.fragmentMaterial.roughness = 0.98;
    } else {
      this.impactorMaterial.color.setHex(0x51473f);
      this.impactorMaterial.metalness = 0.06;
      this.impactorMaterial.roughness = 0.84;
      this.fragmentMaterial.color.setHex(0x594a40);
      this.fragmentMaterial.metalness = 0.04;
      this.fragmentMaterial.roughness = 0.88;
    }
    const heat = clamp01(normalizedHeating);
    this.impactorMaterial.emissive.setRGB(0.72 + heat * 0.28, 0.055 + heat * 0.2, 0.008);
    this.impactorMaterial.emissiveIntensity = 0.12 + heat * 3.8;
    this.fragmentMaterial.emissive.setRGB(0.9, 0.07 + heat * 0.3, 0.01);
    this.fragmentMaterial.emissiveIntensity = 0.28 + heat * 5.2;
  }

  private updateImpactorTumble(timeSeconds: number, seed: number): void {
    this.tumbleAxis.set(
      random01(seed, 501) * 2 - 1,
      random01(seed, 502) * 2 - 1,
      random01(seed, 503) * 2 - 1,
    );
    if (this.tumbleAxis.lengthSq() < 1e-8) this.tumbleAxis.set(0.33, 0.78, 0.53);
    this.tumbleAxis.normalize();
    const phase = random01(seed, 504) * Math.PI * 2;
    const speed = 0.74 + random01(seed, 505) * 1.55;
    this.impactor.quaternion.setFromAxisAngle(
      this.tumbleAxis,
      phase + timeSeconds * speed,
    );
  }

  private updateVelocityDirection(
    velocity: Readonly<{ eastM: number; northM: number; upM: number }> | null,
  ): boolean {
    if (velocity === null) {
      this.velocityBodyLocal.set(0, 0, 0);
      return false;
    }
    this.velocityBodyLocal.copy(this.east).multiplyScalar(velocity.eastM)
      .addScaledVector(this.north, velocity.northM)
      .addScaledVector(this.normal, velocity.upM);
    if (this.velocityBodyLocal.lengthSq() < 1e-12) return false;
    this.velocityBodyLocal.normalize();
    return true;
  }

  private updateEntryEnvelopes(
    impactorRadius: number,
    intensity: number,
    profileStrength: number,
    profile: ImpactEntryEffectProfile,
  ): number {
    const transverseScale = impactorRadius * (1.38 + intensity * 1.35);
    const leadingScale = impactorRadius * (1.35 + profileStrength * 0.72);
    this.bowShock.position.copy(this.impactor.position)
      .addScaledVector(this.velocityBodyLocal, impactorRadius * (0.34 + intensity * 0.3));
    this.bowShock.quaternion.setFromUnitVectors(Y_AXIS, this.velocityBodyLocal);
    this.bowShock.scale.set(transverseScale, leadingScale, transverseScale);
    this.bowShockMaterial.color.setHex(
      profile === 'thin' ? 0xffd4ad : profile === 'giant' ? 0xffeee0 : 0xffb178,
    );
    this.bowShockMaterial.opacity = 0.08 + intensity * 0.48;
    this.bowShock.visible = true;

    const plasmaRadius = impactorRadius * (1.08 + intensity * 1.12);
    const plasmaLengthScale = impactorRadius * (0.82 + profileStrength * 1.72);
    this.plasma.quaternion.copy(this.bowShock.quaternion);
    this.plasma.position.copy(this.impactor.position).addScaledVector(
      this.velocityBodyLocal,
      -(plasmaLengthScale * 1.5 - impactorRadius * 0.42),
    );
    this.plasma.scale.set(plasmaRadius, plasmaLengthScale, plasmaRadius);
    this.plasmaMaterial.color.setHex(
      profile === 'thin' ? 0xff9a58 : profile === 'giant' ? 0xfff0b0 : 0xff632c,
    );
    this.plasmaMaterial.opacity = 0.06 + intensity * 0.42;
    this.plasma.visible = true;

    this.alignedDirection.copy(Y_AXIS)
      .applyQuaternion(this.bowShock.quaternion)
      .normalize();
    return Math.min(1, Math.max(-1, this.alignedDirection.dot(this.velocityBodyLocal)));
  }

  private updateEntryTrailProgress(count: number): void {
    const values = this.trail.progressAttribute.array as Float32Array;
    for (let index = 0; index < count; index += 1) {
      values[index] = count <= 1 ? 1 : index / (count - 1);
    }
    if (count > 0) this.trail.progressAttribute.needsUpdate = true;
  }

  private updateFragments(
    state: Readonly<ImpactRenderState>,
    maximumCount: number,
    impactorRadius: number,
    seed: number,
  ): number {
    const values = state.fragmentsLocalEnuM;
    const count = Math.min(values.length / 3, maximumCount, MAX_FRAGMENTS);
    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      mapEnuToBodyLocal(
        this.scratchPosition,
        values[offset] ?? 0,
        values[offset + 1] ?? 0,
        values[offset + 2] ?? 0,
        state.targetRadiusM,
        this.normal,
        this.east,
        this.north,
      );
      const random = random01(seed, index);
      this.scratchQuaternion.setFromAxisAngle(
        index % 2 === 0 ? this.east : this.north,
        state.scenarioTimeSeconds * (1.2 + random * 2.2) + random * Math.PI * 2,
      );
      this.scratchScale.setScalar(impactorRadius * (0.2 + random * 0.38));
      this.scratchMatrix.compose(
        this.scratchPosition,
        this.scratchQuaternion,
        this.scratchScale,
      );
      this.fragments.setMatrixAt(index, this.scratchMatrix);
    }
    this.fragments.count = count;
    if (count > 0) this.fragments.instanceMatrix.needsUpdate = true;
    return count;
  }

  private applyQuality(): void {
    const budget = qualityBudget(this.quality, this.reducedMotion);
    this.trail.points.material.uniforms.uBasePointSize!.value = budget.pointSize + 2;
    this.ejecta.setBudget(budget.ejecta, budget.pointSize);
    this.plume.setBudget(budget.plume, budget.pointSize + 2);
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error('Impact visual system is disposed.');
  }
}

function createDynamicEntryTrail(maximumCount: number): DynamicEntryTrailResources {
  const positionAttribute = new Float32BufferAttribute(
    new Float32Array(maximumCount * 3),
    3,
  );
  positionAttribute.setUsage(DynamicDrawUsage);
  const progressAttribute = new Float32BufferAttribute(new Float32Array(maximumCount), 1);
  progressAttribute.setUsage(DynamicDrawUsage);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('aProgress', progressAttribute);
  geometry.setDrawRange(0, 0);
  const material = new ShaderMaterial({
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    fragmentShader: `
      uniform float uHeating;
      uniform float uIntensity;
      varying float vProgress;
      void main() {
        vec2 point = gl_PointCoord * 2.0 - 1.0;
        float radialFade = 1.0 - smoothstep(0.18, 1.0, length(point));
        float historyFade = smoothstep(0.0, 0.3, vProgress);
        float alpha = radialFade * historyFade * (0.16 + uIntensity * 0.76);
        if (alpha < 0.01) discard;
        vec3 ember = vec3(1.0, 0.16, 0.025);
        vec3 molten = vec3(1.0, 0.82, 0.36);
        vec3 color = mix(ember, molten, clamp(uHeating * vProgress, 0.0, 1.0));
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    toneMapped: false,
    uniforms: {
      uBasePointSize: { value: 7 },
      uHeating: { value: 0 },
      uIntensity: { value: 0 },
    },
    vertexShader: `
      attribute float aProgress;
      uniform float uBasePointSize;
      uniform float uIntensity;
      varying float vProgress;
      void main() {
        vProgress = aProgress;
        float taper = mix(0.28, 1.42, pow(aProgress, 0.72));
        gl_PointSize = uBasePointSize * taper * (0.72 + uIntensity * 0.55);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  });
  const points = new Points(geometry, material);
  points.name = 'impact-ablation-trail';
  points.frustumCulled = false;
  points.renderOrder = 10;
  return { points, positionAttribute, progressAttribute, maximumCount };
}

function createDynamicLine(
  name: string,
  maximumCount: number,
): DynamicLineResources {
  const attribute = new Float32BufferAttribute(new Float32Array(maximumCount * 3), 3);
  attribute.setUsage(DynamicDrawUsage);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', attribute);
  geometry.setDrawRange(0, 0);
  const material = new LineBasicMaterial({
    color: 0x8bdcff,
    depthTest: true,
    depthWrite: false,
    opacity: 0.76,
    transparent: true,
  });
  const line = new Line(geometry, material);
  line.name = name;
  line.frustumCulled = false;
  line.renderOrder = 5;
  return { line, attribute, maximumCount };
}

function writeEnuArray(
  attribute: BufferAttribute,
  input: Float64Array,
  maximumCount: number,
  radiusM: number,
  normal: Readonly<Vector3>,
  east: Readonly<Vector3>,
  north: Readonly<Vector3>,
): number {
  const inputCount = input.length / 3;
  const count = Math.min(inputCount, maximumCount);
  const output = attribute.array as Float32Array;
  for (let index = 0; index < count; index += 1) {
    // Preserve the complete path when the simulation has more samples than the
    // preallocated GPU buffer. Endpoint-inclusive sampling ensures the preview
    // always reaches the predicted impact point instead of ending mid-entry.
    const sourceIndex = inputCount > count && count > 1
      ? Math.round(index * (inputCount - 1) / (count - 1))
      : index;
    const source = sourceIndex * 3;
    const target = index * 3;
    output[target] = normal.x * (1 + (input[source + 2] ?? 0) / radiusM)
      + east.x * (input[source] ?? 0) / radiusM
      + north.x * (input[source + 1] ?? 0) / radiusM;
    output[target + 1] = normal.y * (1 + (input[source + 2] ?? 0) / radiusM)
      + east.y * (input[source] ?? 0) / radiusM
      + north.y * (input[source + 1] ?? 0) / radiusM;
    output[target + 2] = normal.z * (1 + (input[source + 2] ?? 0) / radiusM)
      + east.z * (input[source] ?? 0) / radiusM
      + north.z * (input[source + 1] ?? 0) / radiusM;
  }
  attribute.needsUpdate = true;
  return count;
}

function mapEnuToBodyLocal(
  output: Vector3,
  eastM: number,
  northM: number,
  upM: number,
  radiusM: number,
  normal: Readonly<Vector3>,
  east: Readonly<Vector3>,
  north: Readonly<Vector3>,
): void {
  output.copy(normal)
    .addScaledVector(east, eastM / radiusM)
    .addScaledVector(north, northM / radiusM)
    .addScaledVector(normal, upM / radiusM);
}

function impactorVisualRadius(diameterM: number, targetRadiusM: number): number {
  const physical = diameterM * 0.5 / targetRadiusM;
  const visibilityProxy = 0.00042 * Math.max(0.25, (diameterM / 40) ** 0.38);
  return Math.max(physical, Math.min(0.012, visibilityProxy));
}

function qualityBudget(quality: VisualQuality, reducedMotion: boolean): QualityBudget {
  const budget = quality === 'low'
    ? { trail: 64, fragments: 12, ejecta: 48, plume: 32, pointSize: 2 }
    : quality === 'medium'
      ? { trail: 128, fragments: 24, ejecta: 96, plume: 64, pointSize: 3 }
      : quality === 'high'
        ? { trail: 192, fragments: 48, ejecta: 160, plume: 128, pointSize: 4 }
        : { trail: 256, fragments: 96, ejecta: 256, plume: 192, pointSize: 5 };
  if (!reducedMotion) return budget;
  return {
    ...budget,
    fragments: Math.max(8, Math.floor(budget.fragments * 0.5)),
    ejecta: Math.max(24, Math.floor(budget.ejecta * 0.45)),
    plume: Math.max(20, Math.floor(budget.plume * 0.5)),
  };
}

/** Physics uses +Z as body north; the visible sphere uses +Y as mesh north. */
function setBodyLocalAsVisualLocal(
  output: Vector3,
  value: Readonly<{ x: number; y: number; z: number }>,
  label: string,
): void {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.z)) {
    throw new RangeError(`Impact ${label} must contain finite components.`);
  }
  output.set(value.x, value.z, -value.y);
  if (output.lengthSq() < 1e-18) {
    throw new RangeError(`Impact ${label} must be non-zero.`);
  }
  output.normalize();
}

function validateState(state: Readonly<ImpactRenderState>): void {
  if (state.presentationMode !== 'preview' && state.presentationMode !== 'playback') {
    throw new RangeError(
      `Unsupported impact presentation mode "${String(state.presentationMode)}".`,
    );
  }
  if (!IMPACT_LIFECYCLE_STATES.includes(state.lifecycleState)) {
    throw new RangeError(`Unsupported impact lifecycle state "${String(state.lifecycleState)}".`);
  }
  if (!IMPACT_VISUAL_STAGES.includes(state.stage)) {
    throw new RangeError(`Unsupported impact visual stage "${String(state.stage)}".`);
  }
  if (
    (state.presentationMode === 'preview' && state.stage !== 'preview')
    || (state.presentationMode === 'playback' && state.stage === 'preview')
  ) {
    throw new RangeError('Impact preview stage and presentation mode must agree.');
  }
  requireFiniteNonNegative(state.scenarioTimeSeconds, 'scenario time');
  if (!Number.isFinite(state.progress) || state.progress < 0 || state.progress > 1) {
    throw new RangeError('Impact progress must be in the interval [0, 1].');
  }
  if (typeof state.targetBodyId !== 'string' || state.targetBodyId.trim().length === 0) {
    throw new RangeError('Impact target body id must be a non-empty string.');
  }
  if (!Number.isFinite(state.targetRadiusM) || state.targetRadiusM <= 0) {
    throw new RangeError('Impact target radius must be finite and positive.');
  }
  if (
    !Number.isFinite(state.targetEquatorialRadiusM)
    || state.targetEquatorialRadiusM <= 0
    || !Number.isFinite(state.targetPolarRadiusM)
    || state.targetPolarRadiusM <= 0
  ) {
    throw new RangeError('Impact target render-shape radii must be finite and positive.');
  }
  if (!IMPACT_RENDER_TARGET_CLASSES.includes(state.targetClass)) {
    throw new RangeError(`Unsupported impact target class "${String(state.targetClass)}".`);
  }
  if (!IMPACT_RENDER_OUTCOME_KINDS.includes(state.outcomeKind)) {
    throw new RangeError(`Unsupported impact outcome kind "${String(state.outcomeKind)}".`);
  }
  if (!IMPACT_SURFACE_EFFECT_PROFILES.includes(state.surfaceEffectProfile)) {
    throw new RangeError(
      `Unsupported impact surface-effect profile "${String(state.surfaceEffectProfile)}".`,
    );
  }
  if (!IMPACT_AFTERMATH_KINDS.includes(state.aftermathKind)) {
    throw new RangeError(`Unsupported impact aftermath kind "${String(state.aftermathKind)}".`);
  }
  if (!IMPACT_IMPACTOR_MATERIALS.includes(state.impactorMaterial)) {
    throw new RangeError(`Unsupported impactor material "${String(state.impactorMaterial)}".`);
  }
  if (!IMPACT_ENTRY_EFFECT_PROFILES.includes(state.entryEffectProfile)) {
    throw new RangeError(
      `Unsupported impact entry-effect profile "${String(state.entryEffectProfile)}".`,
    );
  }
  validateUnitInterval(state.normalizedHeating, 'normalized heating');
  validateUnitInterval(state.normalizedDynamicPressure, 'normalized dynamic pressure');
  validateUnitInterval(state.remainingMassFraction, 'remaining mass fraction');
  validateUnitInterval(state.craterFormationProgress, 'crater formation progress');
  validateUnitInterval(state.surfaceScorchOpacity, 'surface scorch opacity');
  validateUnitInterval(state.ejectaOpacity, 'ejecta opacity');
  validateUnitInterval(state.groundShockwaveOpacity, 'ground shockwave opacity');
  validateUnitInterval(state.atmosphericShockwaveOpacity, 'atmospheric shockwave opacity');
  validateUnitInterval(state.plumeOpacity, 'plume opacity');
  validateUnitInterval(state.plumeCoolingProgress, 'plume cooling progress');
  validateUnitInterval(state.cloudScarGrowthProgress, 'cloud-scar growth progress');
  validateUnitInterval(state.cloudScarOpacity, 'cloud-scar opacity');
  if (state.eventElapsedSeconds !== null) {
    requireFiniteNonNegative(state.eventElapsedSeconds, 'event elapsed time');
  }
  requireFinite(state.cloudScarAdvectionRad, 'cloud-scar advection');
  requireFiniteNonNegative(state.surfaceGravityMps2, 'surface gravity');
  [
    ['physical diameter', state.physicalDiameterM],
    ['flash intensity', state.flashIntensity],
    ['flash radius', state.flashRadiusM],
    ['crater radius', state.craterRadiusM],
    ['crater depth', state.craterDepthM],
    ['scorch radius', state.scorchRadiusM],
    ['ejecta radius', state.ejectaRadiusM],
    ['ejecta launch speed', state.ejectaLaunchSpeedMps],
    ['ejecta lifetime', state.ejectaLifetimeSeconds],
    ['ejecta height', state.ejectaHeightM],
    ['shockwave radius', state.shockwaveRadiusM],
    ['ground shockwave angular radius', state.groundShockwaveAngularRadiusRad],
    ['atmospheric shockwave angular radius', state.atmosphericShockwaveAngularRadiusRad],
    ['plume height', state.plumeHeightM],
    ['plume radius', state.plumeRadiusM],
    ['haze opacity', state.hazeOpacity],
    ['cloud-scar radius', state.cloudScarRadiusM],
  ].forEach(([label, value]) => requireFiniteNonNegative(value as number, label as string));
  if (
    state.groundShockwaveAngularRadiusRad > Math.PI
    || state.atmosphericShockwaveAngularRadiusRad > Math.PI
  ) {
    throw new RangeError('Impact shockwave angular radii may not exceed pi radians.');
  }
  validateEnuArray(state.trailLocalEnuM, 'trail');
  validateEnuArray(state.fragmentsLocalEnuM, 'fragments');
  if (state.impactorLocalEnuM !== null) {
    requireFinite(state.impactorLocalEnuM.eastM, 'impactor east');
    requireFinite(state.impactorLocalEnuM.northM, 'impactor north');
    requireFinite(state.impactorLocalEnuM.upM, 'impactor up');
  }
  if (state.impactorVelocityLocalEnuMps !== null) {
    requireFinite(state.impactorVelocityLocalEnuMps.eastM, 'impactor velocity east');
    requireFinite(state.impactorVelocityLocalEnuMps.northM, 'impactor velocity north');
    requireFinite(state.impactorVelocityLocalEnuMps.upM, 'impactor velocity up');
  }
}

function maximumEnuAltitudeM(values: Float64Array): number {
  let maximum = 0;
  for (let index = 2; index < values.length; index += 3) {
    maximum = Math.max(maximum, values[index] ?? 0);
  }
  return maximum;
}

function validateEnuArray(values: Float64Array, label: string): void {
  if (!(values instanceof Float64Array) || values.length % 3 !== 0) {
    throw new RangeError(`Impact ${label} positions must be an interleaved Float64 ENU array.`);
  }
  for (const value of values) requireFinite(value, `${label} coordinate`);
}

function requireFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`Impact ${label} must be finite.`);
}

function requireFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Impact ${label} must be finite and non-negative.`);
  }
}

function validateUnitInterval(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`Impact ${label} must be in the interval [0, 1].`);
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function random01(seed: number, index: number): number {
  let value = (seed + Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x1_0000_0000;
}
