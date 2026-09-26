import { ImpactTerrainRenderer } from './ImpactTerrainRenderer';
import { OceanImpactRenderer } from './OceanImpactRenderer';
import {
  BufferGeometry,
  Color,
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
  NormalBlending,
  PlaneGeometry,
  PointLight,
  Points,
  Quaternion,
  ShaderMaterial,
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
import {
  impactVisibilityMultiplier,
  impactorVisualRadiusRatio,
  type ImpactVisibilityMode,
} from './ImpactVisibility';
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
const Z_AXIS = new Vector3(0, 0, 1);

interface DynamicLineResources {
  readonly line: Line<BufferGeometry, LineBasicMaterial>;
  readonly attribute: BufferAttribute;
  readonly maximumCount: number;
}

interface DynamicEntryTrailResources {
  readonly mesh: Mesh<BufferGeometry, ShaderMaterial>;
  /** Spine sample centres used to build the ribbon (and for diagnostics). */
  readonly spineAttribute: BufferAttribute;
  readonly positionAttribute: BufferAttribute;
  readonly sideAttribute: BufferAttribute;
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

  // Detail 2 + flat shading reads as faceted rock instead of a smooth gray ball.
  private readonly impactorGeometry = new IcosahedronGeometry(1, 2);
  private readonly impactorBasePositions: Float32Array;
  private readonly impactorBaseColors: Float32Array;
  private readonly impactorMaterial = new MeshBasicMaterial({
    color: 0xffffff,
    toneMapped: false,
    vertexColors: true,
  });
  private readonly impactor = new Mesh(this.impactorGeometry, this.impactorMaterial);
  // Air-cap: short flattened billboard along velocity (Fresnel fringe only — no closed mesh).
  private readonly bowShockGeometry = new PlaneGeometry(2, 2);
  private readonly bowShockMaterial = createAirCapMaterial();
  private readonly bowShock = new Mesh(this.bowShockGeometry, this.bowShockMaterial);
  // Sheath mesh kept for dispose contracts but never shown as a closed shell.
  private readonly sheathGeometry = new PlaneGeometry(0.01, 0.01);
  private readonly sheathMaterial = createAirCapMaterial();
  private readonly sheath = new Mesh(this.sheathGeometry, this.sheathMaterial);
  // Dusty wake sheath ribbon (multi-layer with the bright core trail) — not a cone.
  private readonly plasma = createDynamicEntryTrail(MAX_TRAIL_POINTS);
  private readonly entryLight = new PointLight(0xc8e8ff, 0, 0.04, 2);
  private readonly fragmentGeometry = new IcosahedronGeometry(1, 0);
  private readonly fragmentBasePositions: Float32Array;
  private readonly fragmentMaterial = new MeshStandardMaterial({
    color: 0x3a322c,
    emissive: 0x1a0a04,
    emissiveIntensity: 0.22,
    flatShading: true,
    metalness: 0.04,
    roughness: 0.96,
  });
  private readonly fragments = new InstancedMesh(
    this.fragmentGeometry,
    this.fragmentMaterial,
    MAX_FRAGMENTS,
  );
  private readonly trail = createDynamicEntryTrail(MAX_TRAIL_POINTS);
  private readonly terrain = new ImpactTerrainRenderer();
  private readonly ocean = new OceanImpactRenderer();
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
  private readonly impactorWorldPosition = new Vector3();
  private readonly impactorWorldScale = new Vector3();
  private readonly scratchQuaternion = new Quaternion();
  private readonly scratchMatrix = new Matrix4();
  private readonly scratchScale = new Vector3();
  private readonly velocityBodyLocal = new Vector3();
  private readonly velocityObjectLocal = new Vector3();
  private readonly alignedDirection = new Vector3();
  private readonly tumbleAxis = new Vector3(0.33, 0.78, 0.53).normalize();
  private deformedRunSignature = '';
  private fragmentDeformedSignature = '';
  private impactorSurfaceKey = '';
  private quality: VisualQuality;
  private reducedMotion = false;
  private reduceFlashes = true;
  private cameraPresetId: ImpactCameraPresetId | null = null;
  private visibilityMode: ImpactVisibilityMode = 'physical';
  private diagnostics: Readonly<ImpactVisualDiagnostics> = EMPTY_IMPACT_DIAGNOSTICS;
  private disposed = false;

  public constructor(initialQuality: VisualQuality = 'high') {
    this.quality = initialQuality;
    this.root.name = 'impact-lab-target-local-layer';
    this.root.visible = false;
    this.impactorBasePositions = Float32Array.from(
      this.impactorGeometry.getAttribute('position').array,
    );
    this.impactorBaseColors = new Float32Array(this.impactorBasePositions.length);
    this.impactorGeometry.setAttribute(
      'color',
      new Float32BufferAttribute(new Float32Array(this.impactorBasePositions.length), 3),
    );
    this.fragmentBasePositions = Float32Array.from(
      this.fragmentGeometry.getAttribute('position').array,
    );

    this.previewReticleGeometry.setAttribute(
      'position',
      new Float32BufferAttribute(new Float32Array([0, 0, 0]), 3),
    );
    this.previewReticle.name = 'impact-preview-target-reticle';
    this.previewReticle.frustumCulled = false;
    this.previewReticle.renderOrder = 6;

    this.impactor.name = 'impact-impactor';
    this.impactor.frustumCulled = false;
    this.impactor.renderOrder = 16;
    this.impactorMaterial.depthWrite = true;
    this.bowShock.name = 'impact-entry-bow-shock';
    this.bowShock.renderOrder = 11;
    this.bowShock.frustumCulled = false;
    this.sheath.name = 'impact-entry-plasma-sheath';
    this.sheath.visible = false;
    this.sheath.renderOrder = 8;
    this.plasma.mesh.name = 'impact-entry-plasma-envelope';
    this.plasma.mesh.renderOrder = 9;
    this.plasma.mesh.material.uniforms.uPlasma!.value = 1;
    this.plasma.mesh.material.uniforms.uDustySheath!.value = 1;
    this.entryLight.name = 'impact-entry-ablation-light';
    this.entryLight.castShadow = false;
    this.fragments.name = 'impact-fragments';
    this.fragments.renderOrder = 8;
    this.fragments.count = 0;
    this.trail.mesh.material.uniforms.uIntensity!.value = 0;
    this.trail.mesh.material.uniforms.uHeating!.value = 0;
    this.trail.mesh.material.uniforms.uDustySheath!.value = 0;
    this.plasma.mesh.material.uniforms.uIntensity!.value = 0;
    this.plasma.mesh.material.uniforms.uHeating!.value = 0;
    this.fragments.instanceMatrix.setUsage(DynamicDrawUsage);
    this.root.add(
      this.previewReticle,
      this.previewTrajectory.line,
      this.impactor,
      this.bowShock,
      this.sheath,
      this.plasma.mesh,
      this.entryLight,
      this.trail.mesh,
      this.fragments,
      this.impactFlash.root,
      this.terrain.root,
      this.ocean.root,
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

    this.terrain.update(state, this.surfaceBasis, impactVisibilityMultiplier(this.visibilityMode, state));
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
    const presentationMultiplier = impactVisibilityMultiplier(this.visibilityMode, state);
    this.root.visible = active;

    this.applyImpactorDeformation(state.runSignature, runSeed);
    this.applyFragmentDeformation(state.runSignature, runSeed);
    this.applyImpactorMaterial(
      state.impactorMaterial,
      state.normalizedHeating,
      state.runSignature,
      runSeed,
    );
    const remainingRadiusFraction = Math.max(
      0.16,
      Math.cbrt(state.remainingMassFraction),
    );
    const physicalImpactorRadius = state.physicalDiameterM * 0.5 / radiusM
      * remainingRadiusFraction;
    const impactorRadius = (this.visibilityMode === 'physical' ? state.physicalDiameterM * 0.5 / radiusM : impactorVisualRadiusRatio(state.physicalDiameterM, radiusM))
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
    this.applyLeadingFaceHeating(
      state.normalizedHeating,
      velocityAvailable && entryStage,
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
          state.normalizedHeating,
        )
      : 0;
    if (!entryEffectsEnabled) {
      this.bowShock.visible = false;
      this.sheath.visible = false;
      this.plasma.mesh.visible = false;
      this.bowShockMaterial.uniforms.uOpacity!.value = 0;
      this.sheathMaterial.uniforms.uOpacity!.value = 0;
      this.plasma.mesh.material.uniforms.uIntensity!.value = 0;
      this.entryLight.intensity = 0;
      this.entryLight.visible = false;
    } else {
      // No PointLight during entry — it washes the rock into a white fog ball.
      this.entryLight.intensity = 0;
      this.entryLight.visible = false;
    }

    const trailPointCount = entryEffectsEnabled
      ? writeEnuArray(
          this.trail.spineAttribute,
          state.trailLocalEnuM,
          Math.min(this.trail.maximumCount, budget.trail),
          radiusM,
          this.normal,
          this.east,
          this.north,
        )
      : 0;
    this.applyEntryTrailTurbulence(0, impactorRadius, runSeed);
    // Use only the recent wake segment so the ribbon stays a thin line, not a cloud.
    const ribbonCount = trailPointCount >= 2 ? Math.min(trailPointCount, 24) : 0;
    if (ribbonCount > 0 && ribbonCount < trailPointCount) {
      const spine = this.trail.spineAttribute.array as Float32Array;
      const shift = (trailPointCount - ribbonCount) * 3;
      spine.copyWithin(0, shift, trailPointCount * 3);
      this.trail.spineAttribute.needsUpdate = true;
      const dusty = this.plasma.spineAttribute.array as Float32Array;
      dusty.set(spine.subarray(0, ribbonCount * 3));
      this.plasma.spineAttribute.needsUpdate = true;
    } else if (trailPointCount > 0) {
      const spine = this.trail.spineAttribute.array as Float32Array;
      const dusty = this.plasma.spineAttribute.array as Float32Array;
      dusty.set(spine.subarray(0, trailPointCount * 3));
      this.plasma.spineAttribute.needsUpdate = true;
    }
    this.writeEntryTrailRibbon(ribbonCount, impactorRadius, entryEffectIntensity, false);
    // Plasma mesh stays allocated for diagnostics/alignment; do not draw a second fill.
    this.plasma.mesh.geometry.setDrawRange(0, 0);
    this.trail.mesh.material.uniforms.uIntensity!.value = entryEffectIntensity;
    this.trail.mesh.material.uniforms.uHeating!.value = state.normalizedHeating;
    this.trail.mesh.visible = entryEffectsEnabled && ribbonCount >= 2;
    this.plasma.mesh.material.uniforms.uIntensity!.value = 0;
    this.plasma.mesh.material.uniforms.uHeating!.value = state.normalizedHeating;
    this.plasma.mesh.visible = entryEffectsEnabled && ribbonCount >= 2;

    const breakupVisible = state.stage === 'impact';
    // Few large chips only — never during flash (avoids streaking the flash frame).
    const fragmentBudget = Math.min(5, budget.fragments);
    const fragmentCount = this.updateFragments(
      state,
      state.stage === 'fragmentation' || breakupVisible ? fragmentBudget : 0,
      impactorRadius * (breakupVisible ? 2.35 : 1.4),
      runSeed,
    );
    this.fragments.visible = active
      && fragmentCount > 0
      && (state.stage === 'fragmentation' || breakupVisible);
    this.ejecta.setBudget(budget.ejecta, budget.pointSize);
    this.plume.setBudget(budget.plume, budget.pointSize + 1);
    this.ocean.setBudget(budget.plume);
    this.impactFlash.update(
      state,
      this.surfaceBasis,
      active,
      this.reduceFlashes,
      presentationMultiplier,
    );
    this.ocean.update(state, this.surfaceBasis, active, presentationMultiplier);
    this.craterPatch.update(state, this.surfaceBasis, active, presentationMultiplier);
    this.surfaceShockwave.update(state, this.surfaceBasis, active, presentationMultiplier);
    this.ejecta.update(state, this.surfaceBasis, active, presentationMultiplier);
    this.plume.update(state, this.surfaceBasis, active, presentationMultiplier);
    this.atmosphericScar.update(state, this.surfaceBasis, active, presentationMultiplier);

    const ejectaPointCount = this.ejecta.activeCount;
    const plumePointCount = this.plume.pointCount;
    const flashVisible = this.impactFlash.visible;
    const shockwaveVisible = this.surfaceShockwave.groundVisible
      || this.surfaceShockwave.atmosphericVisible;
    const hazeVisible = this.plume.visible && state.hazeOpacity > 0;
    const giantTarget = state.targetClass === 'gas-giant' || state.targetClass === 'ice-giant';
    const solidSurfaceEffectsSuppressed = (giantTarget || state.outcomeKind === 'ocean-surface-impact')
      && !this.craterPatch.visible
      && !this.surfaceShockwave.groundVisible
      && !this.ejecta.visible;
    const aftermathPersistent = this.craterPatch.persistent || this.atmosphericScar.visible;
    const activeObjectCount = Number(this.impactor.visible)
      + Number(this.bowShock.visible)
      + Number(this.plasma.mesh.visible)
      + Number(this.trail.mesh.visible)
      + Number(this.fragments.visible)
      + this.impactFlash.activeObjectCount
      + this.craterPatch.activeObjectCount
      + this.surfaceShockwave.activeObjectCount
      + this.ejecta.activeObjectCount
      + this.plume.activeObjectCount
      + this.atmosphericScar.activeObjectCount
      + this.ocean.root.children.filter(child => child.visible).length;

    const maximumAltitudeRatio = Math.max(
      state.impactorLocalEnuM?.upM ?? 0,
      state.plumeHeightM * presentationMultiplier,
      state.ejectaRadiusM * presentationMultiplier,
      state.shockwaveRadiusM * presentationMultiplier,
    ) / radiusM;
    this.diagnostics = Object.freeze({
      active,
      presentationMode: state.presentationMode,
      lifecycleState: state.lifecycleState,
      stage: state.stage,
      runSignature: state.runSignature,
      cameraPresetId: this.cameraPresetId,
      visibilityMode: this.visibilityMode,
      visibilityMultiplier: presentationMultiplier,
      reticleVisible: false,
      projectedTrajectoryPointCount: 0,
      trailPointCount,
      fragmentCount,
      ejectaPointCount,
      plumePointCount,
      impactorVisible: this.impactor.visible,
      bowShockVisible: this.bowShock.visible,
      plasmaVisible: this.plasma.mesh.visible,
      entryTrailVisible: this.trail.mesh.visible,
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
    this.terrain.reset();
    if (this.disposed) return;
    this.root.visible = false;
    this.root.children.forEach((child) => { child.visible = false; });
    this.previewTrajectory.line.geometry.setDrawRange(0, 0);
    this.trail.mesh.geometry.setDrawRange(0, 0);
    this.plasma.mesh.geometry.setDrawRange(0, 0);
    this.fragments.count = 0;
    this.trail.mesh.material.uniforms.uIntensity!.value = 0;
    this.trail.mesh.material.uniforms.uHeating!.value = 0;
    this.plasma.mesh.material.uniforms.uIntensity!.value = 0;
    this.plasma.mesh.material.uniforms.uHeating!.value = 0;
    this.bowShockMaterial.uniforms.uOpacity!.value = 0;
    this.sheathMaterial.uniforms.uOpacity!.value = 0;
    this.impactFlash.reset();
    this.craterPatch.reset();
    this.surfaceShockwave.reset();
    this.ejecta.reset();
    this.plume.reset();
    this.atmosphericScar.reset();
    this.ocean.reset();
    this.cameraPresetId = null;
    this.diagnostics = Object.freeze({
      ...EMPTY_IMPACT_DIAGNOSTICS,
      visibilityMode: this.visibilityMode,
    });
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

  public setVisibilityMode(mode: ImpactVisibilityMode): void {
    this.assertNotDisposed();
    this.visibilityMode = mode;
    this.diagnostics = Object.freeze({
      ...this.diagnostics,
      visibilityMode: mode,
      visibilityMultiplier: mode === 'physical' ? 1 : this.diagnostics.visibilityMultiplier,
    });
  }

  public getDiagnostics(): Readonly<ImpactVisualDiagnostics> {
    return this.diagnostics;
  }

  /**
   * World-space sphere around the drawn impactor. The chase camera uses it so
   * the near plane stays in front of the mesh instead of clipping it away.
   */
  public getImpactorClipSphere(): { readonly center: Vector3; readonly radius: number } | null {
    if (this.disposed || !this.impactor.visible) return null;
    this.impactor.updateWorldMatrix(true, false);
    this.impactor.getWorldPosition(this.impactorWorldPosition);
    this.impactor.getWorldScale(this.impactorWorldScale);
    const uniformScale = Math.max(
      this.impactorWorldScale.x,
      this.impactorWorldScale.y,
      this.impactorWorldScale.z,
    );
    // getWorldScale already includes the impactor's local scale.
    const radius = uniformScale;
    if (!Number.isFinite(radius) || radius <= 0) return null;
    if (
      !Number.isFinite(this.impactorWorldPosition.x)
      || !Number.isFinite(this.impactorWorldPosition.y)
      || !Number.isFinite(this.impactorWorldPosition.z)
    ) {
      return null;
    }
    return { center: this.impactorWorldPosition, radius };
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
    this.ocean.dispose();
    this.terrain.dispose();
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
    this.entryLight.dispose();
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
      visibilityMode: this.visibilityMode,
      visibilityMultiplier: 1,
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
    this.bowShockMaterial.uniforms.uOpacity!.value = 0;
    this.sheath.visible = false;
    this.sheathMaterial.uniforms.uOpacity!.value = 0;
    this.plasma.mesh.visible = false;
    this.plasma.mesh.geometry.setDrawRange(0, 0);
    this.plasma.mesh.material.uniforms.uIntensity!.value = 0;
    this.entryLight.intensity = 0;
    this.entryLight.visible = false;
    this.trail.mesh.visible = false;
    this.trail.mesh.geometry.setDrawRange(0, 0);
    this.fragments.visible = false;
    this.fragments.count = 0;
    this.impactFlash.reset();
    this.craterPatch.reset();
    this.surfaceShockwave.reset();
    this.ejecta.reset();
    this.plume.reset();
    this.atmosphericScar.reset();
    this.ocean.reset();
  }

  private applyImpactorDeformation(signature: string, seed: number): void {
    if (this.deformedRunSignature === signature) return;
    const attribute = this.impactorGeometry.getAttribute('position') as BufferAttribute;
    const output = attribute.array as Float32Array;
    // Strong triaxial stretch so the silhouette is clearly not an icosphere.
    const axisX = 0.62 + random01(seed, 401) * 0.52;
    const axisY = 0.52 + random01(seed, 402) * 0.58;
    const axisZ = 0.58 + random01(seed, 403) * 0.5;
    const phaseA = random01(seed, 404) * Math.PI * 2;
    const phaseB = random01(seed, 405) * Math.PI * 2;
    const craterDirections = Array.from({ length: 9 }, (_, index) => {
      const longitude = random01(seed, 420 + index * 4) * Math.PI * 2;
      const latitude = Math.asin(random01(seed, 421 + index * 4) * 2 - 1);
      return Object.freeze({
        x: Math.cos(latitude) * Math.cos(longitude),
        y: Math.sin(latitude),
        z: Math.cos(latitude) * Math.sin(longitude),
        cosineRadius: Math.cos(0.11 + random01(seed, 422 + index * 4) * 0.28),
        depth: 0.06 + random01(seed, 423 + index * 4) * 0.11,
      });
    });
    for (let offset = 0; offset < output.length; offset += 3) {
      const baseX = this.impactorBasePositions[offset] ?? 0;
      const baseY = this.impactorBasePositions[offset + 1] ?? 0;
      const baseZ = this.impactorBasePositions[offset + 2] ?? 0;
      const inverseLength = 1 / Math.max(1e-8, Math.hypot(baseX, baseY, baseZ));
      const nx = baseX * inverseLength;
      const ny = baseY * inverseLength;
      const nz = baseZ * inverseLength;
      const broadRelief = Math.sin(nx * 2.1 + ny * 1.6 - nz * 2.8 + phaseA) * 0.16;
      const mediumRelief = Math.sin(nx * 6.4 - ny * 5.1 + nz * 7.2 + phaseB) * 0.08;
      const fineRelief = Math.sin((nx + nz) * 17.0 + ny * 13.4 + phaseA * 0.61) * 0.04;
      const facetBreak = Math.sin(nx * 28.0 - ny * 24.0 + nz * 21.0 + phaseB) * 0.032;
      let deformation = 0.9 + broadRelief + mediumRelief + fineRelief + facetBreak;
      for (const crater of craterDirections) {
        const dot = nx * crater.x + ny * crater.y + nz * crater.z;
        if (dot <= crater.cosineRadius) continue;
        const cap = (dot - crater.cosineRadius) / (1 - crater.cosineRadius);
        const depression = Math.sin(Math.min(1, cap) * Math.PI * 0.5) ** 2;
        const rim = Math.exp(-(((cap - 0.1) / 0.048) ** 2));
        deformation += rim * crater.depth * 0.34 - depression * crater.depth;
      }
      deformation = Math.max(0.46, Math.min(1.34, deformation));
      output[offset] = baseX * deformation * axisX;
      output[offset + 1] = baseY * deformation * axisY;
      output[offset + 2] = baseZ * deformation * axisZ;
    }
    attribute.needsUpdate = true;
    this.impactorGeometry.computeVertexNormals();
    this.impactorGeometry.computeBoundingSphere();
    this.deformedRunSignature = signature;
    this.impactorSurfaceKey = '';
  }

  private applyFragmentDeformation(signature: string, seed: number): void {
    if (this.fragmentDeformedSignature === signature) return;
    const attribute = this.fragmentGeometry.getAttribute('position') as BufferAttribute;
    const output = attribute.array as Float32Array;
    const phase = random01(seed, 711) * Math.PI * 2;
    for (let offset = 0; offset < output.length; offset += 3) {
      const baseX = this.fragmentBasePositions[offset] ?? 0;
      const baseY = this.fragmentBasePositions[offset + 1] ?? 0;
      const baseZ = this.fragmentBasePositions[offset + 2] ?? 0;
      const inverseLength = 1 / Math.max(1e-8, Math.hypot(baseX, baseY, baseZ));
      const nx = baseX * inverseLength;
      const ny = baseY * inverseLength;
      const nz = baseZ * inverseLength;
      const chip = 0.82
        + Math.sin(nx * 4.2 + ny * 3.1 + phase) * 0.14
        + Math.sin(nx * 11.0 - nz * 9.0 + phase * 1.3) * 0.08;
      output[offset] = baseX * chip * (0.72 + random01(seed, offset + 720) * 0.46);
      output[offset + 1] = baseY * chip * (0.58 + random01(seed, offset + 721) * 0.52);
      output[offset + 2] = baseZ * chip * (0.68 + random01(seed, offset + 722) * 0.48);
    }
    attribute.needsUpdate = true;
    this.fragmentGeometry.computeVertexNormals();
    this.fragmentGeometry.computeBoundingSphere();
    this.fragmentDeformedSignature = signature;
  }

  private applyImpactorMaterial(
    material: ImpactImpactorMaterial,
    normalizedHeating: number,
    signature: string,
    seed: number,
  ): void {
    // Impactor is MeshBasic + vertex colors so scene lights cannot wash it white.
    this.impactorMaterial.color.setHex(0xffffff);
    if (material === 'iron') {
      this.fragmentMaterial.color.setHex(0x4a4e52);
      this.fragmentMaterial.metalness = 0.7;
      this.fragmentMaterial.roughness = 0.66;
      this.fragmentMaterial.emissive.setRGB(0.55, 0.35, 0.18);
    } else if (material === 'porous-rock') {
      this.fragmentMaterial.color.setHex(0x32261f);
      this.fragmentMaterial.metalness = 0.01;
      this.fragmentMaterial.roughness = 0.98;
      this.fragmentMaterial.emissive.setRGB(0.65, 0.22, 0.05);
    } else {
      this.fragmentMaterial.color.setHex(0x4a3c33);
      this.fragmentMaterial.metalness = 0.04;
      this.fragmentMaterial.roughness = 0.9;
      this.fragmentMaterial.emissive.setRGB(0.75, 0.28, 0.06);
    }
    this.applyImpactorSurfaceColors(material, signature, seed);
    const heat = clamp01(normalizedHeating);
    this.fragmentMaterial.emissiveIntensity = 0.03 + heat * 0.05;
  }

  private applyImpactorSurfaceColors(
    material: ImpactImpactorMaterial,
    signature: string,
    seed: number,
  ): void {
    const key = `${signature}:${material}`;
    if (this.impactorSurfaceKey === key) return;
    const baseColor = new Color(
      material === 'iron' ? 0x1a1b1e : material === 'porous-rock' ? 0x100c09 : 0x16120e,
    );
    const warmColor = new Color(
      material === 'iron' ? 0x3a2e28 : material === 'porous-rock' ? 0x2a1e16 : 0x34281c,
    );
    const veinColor = new Color(
      material === 'iron' ? 0x4a4038 : material === 'porous-rock' ? 0x2e2218 : 0x3e3228,
    );
    const color = new Color();
    const phase = random01(seed, 612) * Math.PI * 2;
    for (let offset = 0; offset < this.impactorBaseColors.length; offset += 3) {
      const baseX = this.impactorBasePositions[offset] ?? 0;
      const baseY = this.impactorBasePositions[offset + 1] ?? 0;
      const baseZ = this.impactorBasePositions[offset + 2] ?? 0;
      const broad = 0.5 + 0.5 * Math.sin(baseX * 5.3 - baseY * 3.7 + baseZ * 4.1 + phase);
      const fine = 0.5 + 0.5 * Math.sin(baseX * 19.1 + baseY * 23.7 - baseZ * 17.3 + phase * 1.7);
      const vein = 0.5 + 0.5 * Math.sin(baseX * 41.0 + baseY * 37.0 - baseZ * 29.0 + phase * 2.1);
      const coordinateSeed = Math.abs(Math.round(
        baseX * 7_919 + baseY * 15_491 + baseZ * 31_337,
      ));
      const grain = random01(seed ^ coordinateSeed, 619);
      color.copy(baseColor).lerp(warmColor, broad * (material === 'iron' ? 0.48 : 0.32));
      color.lerp(veinColor, vein * vein * 0.22);
      color.multiplyScalar(0.72 + fine * 0.2 + grain * 0.16);
      this.impactorBaseColors[offset] = color.r;
      this.impactorBaseColors[offset + 1] = color.g;
      this.impactorBaseColors[offset + 2] = color.b;
    }
    this.impactorSurfaceKey = key;
  }

  /**
   * Educational approximation of ablation: only the windward face reads as
   * molten/plasma-heated; the lee side stays dark rock/metal.
   */
  private applyLeadingFaceHeating(normalizedHeating: number, alignToVelocity: boolean): void {
    const attribute = this.impactorGeometry.getAttribute('color') as BufferAttribute;
    const output = attribute.array as Float32Array;
    const heat = clamp01(normalizedHeating);
    const useVelocity = alignToVelocity && this.velocityBodyLocal.lengthSq() > 1e-12;
    if (useVelocity) {
      this.velocityObjectLocal.copy(this.velocityBodyLocal)
        .applyQuaternion(this.scratchQuaternion.copy(this.impactor.quaternion).invert());
      if (this.velocityObjectLocal.lengthSq() > 1e-12) {
        this.velocityObjectLocal.normalize();
      } else {
        this.velocityObjectLocal.set(0, 0, 1);
      }
    }
    const positions = this.impactorGeometry.getAttribute('position').array as Float32Array;
    for (let offset = 0; offset < output.length; offset += 3) {
      const baseR = this.impactorBaseColors[offset] ?? 0.2;
      const baseG = this.impactorBaseColors[offset + 1] ?? 0.16;
      const baseB = this.impactorBaseColors[offset + 2] ?? 0.12;
      let facing = 0;
      if (useVelocity) {
        const px = positions[offset] ?? 0;
        const py = positions[offset + 1] ?? 0;
        const pz = positions[offset + 2] ?? 0;
        const inverseLength = 1 / Math.max(1e-8, Math.hypot(px, py, pz));
        facing = Math.max(
          0,
          (px * this.velocityObjectLocal.x
            + py * this.velocityObjectLocal.y
            + pz * this.velocityObjectLocal.z) * inverseLength,
        );
        facing = facing ** 2.2;
      }
      // Soften the heat curve so mid-entry already shows a bright nose.
      const heatCurve = heat ** 0.75;
      const glow = facing * heatCurve;
      // Shock-layer look: bright leading face only — lee stays dark rock.
      const plasmaMix = clamp01(glow * 1.1);
      const moltenR = 0.55 + plasmaMix * 0.4;
      const moltenG = 0.28 + plasmaMix * 0.35;
      const moltenB = 0.1 + plasmaMix * 0.28;
      const leeKeep = 1 - glow * 0.88;
      output[offset] = baseR * leeKeep + moltenR * glow;
      output[offset + 1] = baseG * leeKeep + moltenG * glow;
      output[offset + 2] = baseB * (1 - glow * 0.7) + moltenB * glow;
    }
    attribute.needsUpdate = true;
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
    normalizedHeating: number,
  ): number {
    const heat = clamp01(normalizedHeating);
    void profileStrength;
    // Tiny marker for velocity-alignment diagnostics — opacity near zero so it
    // cannot fog the rock. Leading-face heat is vertex color only.
    const capWidth = impactorRadius * 0.18;
    const capHeight = impactorRadius * 0.1;
    this.bowShock.position.copy(this.impactor.position)
      .addScaledVector(this.velocityBodyLocal, impactorRadius * 0.55);
    this.bowShock.quaternion.setFromUnitVectors(Z_AXIS, this.velocityBodyLocal);
    this.bowShock.scale.set(capWidth, capHeight, 1);
    const bowColor = profile === 'thin'
      ? (heat > 0.45 ? 0xffc878 : 0xc8a878)
      : (heat > 0.45 ? 0xffc878 : 0xd0b07a);
    (this.bowShockMaterial.uniforms.uColor!.value as Color).setHex(bowColor);
    this.bowShockMaterial.uniforms.uOpacity!.value = 0.08 + intensity * 0.06;
    this.bowShockMaterial.uniforms.uIntensity!.value = Math.max(0.15, intensity * 0.4);
    this.bowShock.visible = true;
    void heat;

    // Closed sheath mesh is retired — never show a bowl/shell silhouette.
    this.sheath.visible = false;
    this.sheathMaterial.uniforms.uOpacity!.value = 0;

    // Dusty wake ribbon sits on the trail spine (multi-layer). Marker position
    // behind the rock keeps velocity-alignment diagnostics meaningful.
    this.plasma.mesh.position.copy(this.impactor.position)
      .addScaledVector(this.velocityBodyLocal, -impactorRadius * (2.2 + intensity * 1.2));
    this.plasma.mesh.quaternion.identity();

    this.alignedDirection.copy(Z_AXIS)
      .applyQuaternion(this.bowShock.quaternion)
      .normalize();
    return Math.min(1, Math.max(-1, this.alignedDirection.dot(this.velocityBodyLocal)));
  }

  private applyEntryTrailTurbulence(
    count: number,
    impactorRadius: number,
    seed: number,
  ): void {
    const positions = this.trail.spineAttribute.array as Float32Array;
    for (let index = 0; index < count; index += 1) {
      const progress = count <= 1 ? 1 : index / (count - 1);
      const wakeWidth = impactorRadius * (0.02 + (1 - progress) * 0.45);
      const phase = progress * 37 + random01(seed, index + 1_701) * Math.PI * 2;
      const eastOffset = Math.sin(phase) * wakeWidth;
      const northOffset = Math.cos(phase * 0.73 + 1.2) * wakeWidth * 0.55;
      const offset = index * 3;
      positions[offset] = (positions[offset] ?? 0)
        + this.east.x * eastOffset + this.north.x * northOffset;
      positions[offset + 1] = (positions[offset + 1] ?? 0)
        + this.east.y * eastOffset + this.north.y * northOffset;
      positions[offset + 2] = (positions[offset + 2] ?? 0)
        + this.east.z * eastOffset + this.north.z * northOffset;
    }
    if (count > 0) this.trail.spineAttribute.needsUpdate = true;
  }

  private writeEntryTrailRibbon(
    spinePointCount: number,
    impactorRadius: number,
    intensity: number,
    dustySheath: boolean,
  ): void {
    const resources = dustySheath ? this.plasma : this.trail;
    const mesh = resources.mesh;
    if (spinePointCount < 2) {
      mesh.geometry.setDrawRange(0, 0);
      return;
    }
    const positions = resources.positionAttribute.array as Float32Array;
    const sides = resources.sideAttribute.array as Float32Array;
    const phases = resources.progressAttribute.array as Float32Array;
    const spine = resources.spineAttribute.array as Float32Array;
    // Bright core stays thin; dusty sheath is wider and softer.
    const halfBase = dustySheath
      ? impactorRadius * (0.08 + intensity * 0.08)
      : impactorRadius * (0.028 + intensity * 0.035);
    // Dusty ribbon verts are authored in body space; cancel the diagnostic offset.
    const originX = dustySheath ? this.plasma.mesh.position.x : 0;
    const originY = dustySheath ? this.plasma.mesh.position.y : 0;
    const originZ = dustySheath ? this.plasma.mesh.position.z : 0;
    for (let index = 0; index < spinePointCount; index += 1) {
      const source = index * 3;
      const x = (spine[source] ?? 0) - originX;
      const y = (spine[source + 1] ?? 0) - originY;
      const z = (spine[source + 2] ?? 0) - originZ;
      const prev = Math.max(0, index - 1) * 3;
      const next = Math.min(spinePointCount - 1, index + 1) * 3;
      let tx = (spine[next] ?? spine[source] ?? 0) - (spine[prev] ?? spine[source] ?? 0);
      let ty = (spine[next + 1] ?? spine[source + 1] ?? 0) - (spine[prev + 1] ?? spine[source + 1] ?? 0);
      let tz = (spine[next + 2] ?? spine[source + 2] ?? 0) - (spine[prev + 2] ?? spine[source + 2] ?? 0);
      const tLen = Math.hypot(tx, ty, tz) || 1;
      tx /= tLen;
      ty /= tLen;
      tz /= tLen;
      let sx = ty * this.north.z - tz * this.north.y;
      let sy = tz * this.north.x - tx * this.north.z;
      let sz = tx * this.north.y - ty * this.north.x;
      let sLen = Math.hypot(sx, sy, sz);
      if (sLen < 1e-6) {
        sx = ty * this.east.z - tz * this.east.y;
        sy = tz * this.east.x - tx * this.east.z;
        sz = tx * this.east.y - ty * this.east.x;
        sLen = Math.hypot(sx, sy, sz) || 1;
      }
      sx /= sLen;
      sy /= sLen;
      sz /= sLen;
      const fraction = index / (spinePointCount - 1);
      const halfWidth = halfBase * (dustySheath
        ? (0.55 + Math.pow(1 - fraction, 0.45) * 1.15)
        : (0.3 + Math.pow(1 - fraction, 0.55) * 0.75));
      const left = index * 2;
      const right = left + 1;
      positions[left * 3] = x - sx * halfWidth;
      positions[left * 3 + 1] = y - sy * halfWidth;
      positions[left * 3 + 2] = z - sz * halfWidth;
      positions[right * 3] = x + sx * halfWidth;
      positions[right * 3 + 1] = y + sy * halfWidth;
      positions[right * 3 + 2] = z + sz * halfWidth;
      sides[left] = -1;
      sides[right] = 1;
      phases[left] = fraction;
      phases[right] = fraction;
    }
    resources.positionAttribute.needsUpdate = true;
    resources.sideAttribute.needsUpdate = true;
    resources.progressAttribute.needsUpdate = true;
    mesh.geometry.setDrawRange(0, Math.max(0, spinePointCount - 1) * 6);
    mesh.geometry.computeBoundingSphere();
  }

  private updateFragments(
    state: Readonly<ImpactRenderState>,
    maximumCount: number,
    impactorRadius: number,
    seed: number,
  ): number {
    const values = state.fragmentsLocalEnuM;
    const count = Math.min(values.length / 3, maximumCount, MAX_FRAGMENTS);
    const breakupBoost = state.stage === 'fragmentation'
      || state.stage === 'impact'
      || state.stage === 'impact-flash'
      ? 1.15
      : 1;
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
      const randomB = random01(seed, index + 1_003);
      const randomC = random01(seed, index + 2_017);
      this.scratchQuaternion.setFromAxisAngle(
        index % 2 === 0 ? this.east : this.north,
        state.scenarioTimeSeconds * (1.2 + random * 2.2) + random * Math.PI * 2,
      );
      // Spall/chip look: small dark rock chips — never bright white shards.
      this.scratchScale.set(
        impactorRadius * (0.22 + random * 0.28) * breakupBoost,
        impactorRadius * (0.12 + randomB * 0.2) * breakupBoost,
        impactorRadius * (0.18 + randomC * 0.25) * breakupBoost,
      );
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
    this.trail.mesh.material.uniforms.uBaseWidth!.value = 1;
    this.ejecta.setBudget(budget.ejecta, budget.pointSize);
    this.plume.setBudget(budget.plume, budget.pointSize + 1);
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error('Impact visual system is disposed.');
  }
}

function createDynamicEntryTrail(maximumCount: number): DynamicEntryTrailResources {
  const spineAttribute = new Float32BufferAttribute(new Float32Array(maximumCount * 3), 3);
  spineAttribute.setUsage(DynamicDrawUsage);
  const vertexCount = maximumCount * 2;
  const positionAttribute = new Float32BufferAttribute(new Float32Array(vertexCount * 3), 3);
  positionAttribute.setUsage(DynamicDrawUsage);
  const sideAttribute = new Float32BufferAttribute(new Float32Array(vertexCount), 1);
  sideAttribute.setUsage(DynamicDrawUsage);
  const progressAttribute = new Float32BufferAttribute(new Float32Array(vertexCount), 1);
  progressAttribute.setUsage(DynamicDrawUsage);
  const index = new Uint16Array(Math.max(0, maximumCount - 1) * 6);
  for (let segment = 0; segment < maximumCount - 1; segment += 1) {
    const offset = segment * 6;
    const left = segment * 2;
    index[offset] = left;
    index[offset + 1] = left + 1;
    index[offset + 2] = left + 2;
    index[offset + 3] = left + 1;
    index[offset + 4] = left + 3;
    index[offset + 5] = left + 2;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('aSide', sideAttribute);
  geometry.setAttribute('aProgress', progressAttribute);
  geometry.setIndex(Array.from(index));
  geometry.setDrawRange(0, 0);
    const material = new ShaderMaterial({
    blending: NormalBlending,
    depthTest: true,
    depthWrite: false,
    fragmentShader: `
      uniform float uHeating;
      uniform float uIntensity;
      uniform float uPlasma;
      uniform float uDustySheath;
      varying float vProgress;
      varying float vSide;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      void main() {
        float edge = pow(max(0.0, 1.0 - abs(vSide)), mix(5.5, 3.2, uDustySheath));
        float historyFade = smoothstep(0.0, mix(0.08, 0.03, uDustySheath), vProgress);
        // Keep trail under bloom threshold — thin ribbon, not a glowing ball.
        float alpha = edge * historyFade
          * (uDustySheath > 0.5 ? (0.08 + uIntensity * 0.14) : (0.22 + uIntensity * 0.35));
        if (alpha < 0.02) discard;
        vec3 nearBody = mix(vec3(0.55, 0.42, 0.28), vec3(0.85, 0.55, 0.22), clamp(uHeating, 0.0, 1.0));
        vec3 farWake = mix(vec3(0.35, 0.22, 0.12), vec3(0.22, 0.18, 0.14), 1.0 - uHeating);
        vec3 dusty = mix(vec3(0.32, 0.26, 0.2), vec3(0.5, 0.35, 0.2), clamp(uHeating, 0.0, 1.0));
        vec3 color = uDustySheath > 0.5
          ? mix(dusty, nearBody, pow(vProgress, 0.55) * 0.25)
          : mix(farWake, nearBody, pow(vProgress, 0.42));
        gl_FragColor = vec4(color, min(alpha, uDustySheath > 0.5 ? 0.22 : 0.48));
      }
    `,
    side: DoubleSide,
    transparent: true,
    toneMapped: false,
    uniforms: {
      uBaseWidth: { value: 1 },
      uHeating: { value: 0 },
      uIntensity: { value: 0 },
      uPlasma: { value: 0 },
      uDustySheath: { value: 0 },
    },
    vertexShader: `
      attribute float aSide;
      attribute float aProgress;
      varying float vProgress;
      varying float vSide;
      void main() {
        vProgress = aProgress;
        vSide = aSide;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'impact-ablation-trail';
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  return {
    mesh,
    spineAttribute,
    positionAttribute,
    sideAttribute,
    progressAttribute,
    maximumCount,
  };
}

function createAirCapMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    blending: NormalBlending,
    depthTest: true,
    depthWrite: false,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;
      void main() {
        vec2 centered = vUv * 2.0 - 1.0;
        float radial = length(centered);
        float shell = pow(max(1.0 - abs(dot(normalize(vNormalView), normalize(vViewDirection))), 0.0), 1.8);
        // Smooth nose fringe only — no hash speckles (those read as a white point bowl).
        float fringe = smoothstep(0.05, 0.45, radial) * (1.0 - smoothstep(0.55, 0.95, radial));
        float alpha = uOpacity * fringe * (0.25 + shell * 0.9) * (0.5 + uIntensity * 0.55);
        if (alpha < 0.03) discard;
        vec3 hot = mix(uColor, vec3(1.0, 0.97, 0.9), clamp(shell * 0.55 + uIntensity * 0.2, 0.0, 0.9));
        gl_FragColor = vec4(hot, min(alpha, 0.7));
      }
    `,
    side: DoubleSide,
    toneMapped: false,
    transparent: true,
    uniforms: {
      uColor: { value: new Color(0xfff2c8) },
      uIntensity: { value: 0 },
      uOpacity: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;
      void main() {
        vUv = uv;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
  });
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
