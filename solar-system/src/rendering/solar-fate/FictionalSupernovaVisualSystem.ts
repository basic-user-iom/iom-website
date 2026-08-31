import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  type Object3D,
} from 'three';

import { coronaShellCount, type VisualQuality } from '../bodies/VisualQuality';
import {
  EMPTY_SUPERNOVA_DIAGNOSTICS,
  type FictionalSupernovaDiagnostics,
  type FictionalSupernovaRenderState,
  type SolarFateScaleContext,
} from './SolarFateRenderTypes';
import {
  PlanetHeatOverlayLayer,
  clamp01,
  createSolarPoints,
  isActiveLifecycle,
  particleBudget,
  physicalRadiusToLocal,
  physicalRadiusToRenderUnits,
  requireFiniteNonNegative,
  requirePositive,
  requireUnitInterval,
  validateLifecycle,
  validateProgress,
  writeDeterministicShellParticles,
} from './SolarFateSupport';

const PHASES = [
  'surface-pulse',
  'core-flash',
  'shock-breakout',
  'shock-shell',
  'radiation-front',
  'debris-nebula',
  'remnant',
] as const;
const MAX_DEBRIS_POINTS = 1_024;

export class FictionalSupernovaVisualSystem {
  public readonly root = new Group();

  private readonly sphereGeometry = new SphereGeometry(1, 64, 40);
  private readonly coreMaterial = new MeshBasicMaterial({ color: 0xff8a39 });
  private readonly core = new Mesh(this.sphereGeometry, this.coreMaterial);
  private readonly flashMaterial = shellMaterial(0xffffff, 0, BackSide);
  private readonly flash = new Mesh(this.sphereGeometry, this.flashMaterial);
  private readonly shockMaterial = shellMaterial(0xffb24f, 0, DoubleSide);
  private readonly shock = new Mesh(this.sphereGeometry, this.shockMaterial);
  private readonly radiationMaterial = shellMaterial(0xa9d9ff, 0, DoubleSide);
  private readonly radiation = new Mesh(this.sphereGeometry, this.radiationMaterial);
  private readonly nebulaMaterial = shellMaterial(0xc768d4, 0, DoubleSide);
  private readonly nebula = new Mesh(this.sphereGeometry, this.nebulaMaterial);
  private readonly remnantMaterial = new MeshBasicMaterial({
    color: new Color().setRGB(2.2, 2.7, 3.4),
    toneMapped: false,
  });
  private readonly remnant = new Mesh(this.sphereGeometry, this.remnantMaterial);
  private readonly debris = createSolarPoints(
    'fictional-supernova-debris',
    MAX_DEBRIS_POINTS,
    0xffb75f,
    4,
  );
  private readonly heating = new PlanetHeatOverlayLayer();
  private baseSurface: Object3D | null = null;
  private baseCorona: readonly Object3D[] = Object.freeze([]);
  private quality: VisualQuality;
  private reducedMotion = false;
  private reduceFlashes = true;
  private diagnostics: Readonly<FictionalSupernovaDiagnostics> =
    EMPTY_SUPERNOVA_DIAGNOSTICS;
  private disposed = false;

  public constructor(initialQuality: VisualQuality = 'high') {
    this.quality = initialQuality;
    this.root.name = 'fictional-supernova-layer';
    this.core.name = 'fictional-supernova-core';
    this.core.renderOrder = 3;
    this.flash.name = 'fictional-supernova-flash';
    this.flash.renderOrder = 12;
    this.shock.name = 'fictional-supernova-shock-shell';
    this.shock.renderOrder = 8;
    this.radiation.name = 'fictional-supernova-radiation-front';
    this.radiation.renderOrder = 9;
    this.nebula.name = 'fictional-supernova-nebula';
    this.nebula.renderOrder = 7;
    this.remnant.name = 'fictional-supernova-remnant';
    this.remnant.renderOrder = 10;
    this.root.add(
      this.core,
      this.flash,
      this.shock,
      this.radiation,
      this.debris.points,
      this.nebula,
      this.remnant,
    );
    this.applyQuality();
    this.reset();
  }

  public attachToSun(
    sunRoot: Group,
    baseSurface: Object3D,
    baseCorona: readonly Object3D[],
  ): void {
    this.assertNotDisposed();
    this.baseSurface = baseSurface;
    this.baseCorona = baseCorona;
    if (this.root.parent !== sunRoot) sunRoot.add(this.root);
  }

  public attachBody(bodyId: string, root: Group): void {
    this.assertNotDisposed();
    this.heating.attachBody(bodyId, root);
  }

  public update(
    state: Readonly<FictionalSupernovaRenderState>,
    context: Readonly<SolarFateScaleContext>,
  ): void {
    this.assertNotDisposed();
    validateSupernovaState(state, context);
    const active = isActiveLifecycle(state.lifecycleState);
    this.setBaseSunHidden(active);
    this.root.visible = active;

    const coreLocal = physicalRadiusToLocal(state.coreRadiusM, context);
    const coreRender = physicalRadiusToRenderUnits(state.coreRadiusM, context);
    const remnantLocal = physicalRadiusToLocal(state.remnantRadiusM, context);
    const remnantRender = physicalRadiusToRenderUnits(state.remnantRadiusM, context);
    const shockLocal = physicalRadiusToLocal(state.shockRadiusM, context);
    const shockRender = physicalRadiusToRenderUnits(state.shockRadiusM, context);
    const radiationLocal = physicalRadiusToLocal(state.radiationFrontRadiusM, context);
    const radiationRender = physicalRadiusToRenderUnits(state.radiationFrontRadiusM, context);
    const debrisLocal = physicalRadiusToLocal(state.debrisRadiusM, context);
    const debrisRender = physicalRadiusToRenderUnits(state.debrisRadiusM, context);
    const nebulaLocal = physicalRadiusToLocal(state.nebulaRadiusM, context);
    const nebulaRender = physicalRadiusToRenderUnits(state.nebulaRadiusM, context);

    this.core.visible = active && state.phase !== 'remnant';
    this.core.scale.setScalar(Math.max(coreLocal, 1e-9));
    this.coreMaterial.color.set(state.phase === 'core-flash' ? 0xfff4d5 : 0xff8738);

    const effectiveFlashIntensity = this.reduceFlashes
      ? Math.min(state.flashIntensity, 0.68)
      : Math.min(state.flashIntensity, 6);
    const flashVisible = active && effectiveFlashIntensity > 0.001;
    this.flash.visible = flashVisible;
    this.flash.scale.setScalar(Math.max(coreLocal * 1.85, 1e-9));
    this.flashMaterial.opacity = Math.min(0.92, effectiveFlashIntensity * 0.34);

    this.shock.visible = active && state.shockRadiusM > 0;
    this.shock.scale.setScalar(Math.max(shockLocal, 1e-9));
    this.shockMaterial.opacity = 0.48 * (1 - state.progress * 0.42);

    this.radiation.visible = active && state.radiationFrontRadiusM > 0;
    this.radiation.scale.setScalar(Math.max(radiationLocal, 1e-9));
    this.radiationMaterial.opacity = this.reduceFlashes ? 0.08 : 0.2;

    const requestedDebris = active && state.debrisRadiusM > 0
      ? particleBudget(this.quality, MAX_DEBRIS_POINTS, this.reducedMotion)
      : 0;
    const debrisPointCount = requestedDebris === 0
      ? 0
      : writeDeterministicShellParticles(
          this.debris,
          requestedDebris,
          debrisLocal,
          0.42,
          state.runSignature,
          state.scenarioTimeSeconds,
          this.reducedMotion ? 0 : 0.000025,
        );
    this.debris.points.visible = debrisPointCount > 0;
    this.debris.points.material.opacity = clamp01(state.debrisOpacity) * 0.74;

    this.nebula.visible = active && state.nebulaRadiusM > 0 && state.nebulaOpacity > 0;
    this.nebula.scale.setScalar(Math.max(nebulaLocal, 1e-9));
    this.nebulaMaterial.opacity = clamp01(state.nebulaOpacity) * 0.2;

    this.remnant.visible = active && state.phase === 'remnant' && state.remnantRadiusM > 0;
    this.remnant.scale.setScalar(Math.max(remnantLocal, 1e-9));
    this.remnantMaterial.color.set(
      state.remnantKind === 'neutron-star' ? 0xb9dcff : 0xe4edff,
    );

    const heatedBodyCount = this.heating.update(
      state.heatingByBody,
      this.reduceFlashes,
    );
    const boundingRadiusRenderUnits = Math.max(
      coreRender,
      flashVisible ? coreRender * 1.85 : 0,
      remnantRender,
      shockRender,
      radiationRender,
      debrisPointCount > 0 ? debrisRender * 1.5 : debrisRender,
      nebulaRender,
    );
    this.diagnostics = Object.freeze({
      active,
      phase: state.phase,
      runSignature: state.runSignature,
      coreRadiusRenderUnits: state.phase === 'remnant' ? remnantRender : coreRender,
      boundingRadiusRenderUnits,
      debrisPointCount,
      heatedBodyCount,
      flashVisible,
      effectiveFlashIntensity,
      baseSunHidden: active,
    });
  }

  public reset(): void {
    if (this.disposed) return;
    this.root.visible = false;
    this.root.children.forEach((child) => { child.visible = false; });
    this.debris.points.geometry.setDrawRange(0, 0);
    this.debris.points.material.opacity = 0;
    this.flashMaterial.opacity = 0;
    this.heating.reset();
    this.setBaseSunHidden(false);
    this.diagnostics = EMPTY_SUPERNOVA_DIAGNOSTICS;
  }

  public setQuality(quality: VisualQuality): void {
    this.assertNotDisposed();
    this.quality = quality;
    this.applyQuality();
    if (!this.diagnostics.active) this.restoreBaseSun();
  }

  public setReducedMotion(reducedMotion: boolean): void {
    this.assertNotDisposed();
    this.reducedMotion = reducedMotion;
  }

  public setReduceFlashes(reduceFlashes: boolean): void {
    this.assertNotDisposed();
    this.reduceFlashes = reduceFlashes;
  }

  public getProtectiveExposureCeiling(): number | null {
    if (!this.diagnostics.flashVisible) return null;
    return this.reduceFlashes ? 0.1 : 0.18;
  }

  public getDiagnostics(): Readonly<FictionalSupernovaDiagnostics> {
    return this.diagnostics;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.reset();
    this.disposed = true;
    this.root.removeFromParent();
    this.heating.dispose();
    this.debris.points.geometry.dispose();
    this.debris.points.material.dispose();
    this.coreMaterial.dispose();
    this.flashMaterial.dispose();
    this.shockMaterial.dispose();
    this.radiationMaterial.dispose();
    this.nebulaMaterial.dispose();
    this.remnantMaterial.dispose();
    this.sphereGeometry.dispose();
    this.root.clear();
  }

  private setBaseSunHidden(hidden: boolean): void {
    if (hidden) {
      if (this.baseSurface !== null) this.baseSurface.visible = false;
      this.baseCorona.forEach((shell) => { shell.visible = false; });
    } else {
      this.restoreBaseSun();
    }
  }

  private restoreBaseSun(): void {
    if (this.baseSurface !== null) this.baseSurface.visible = true;
    const visibleCoronaCount = coronaShellCount(this.quality);
    this.baseCorona.forEach((shell, index) => {
      shell.visible = index < visibleCoronaCount;
    });
  }

  private applyQuality(): void {
    this.debris.points.material.size =
      this.quality === 'low' ? 2 : this.quality === 'medium' ? 3 : this.quality === 'high' ? 4 : 5;
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error('Fictional supernova visual system is disposed.');
  }
}

function shellMaterial(color: number, opacity: number, side: typeof BackSide | typeof DoubleSide) {
  return new MeshBasicMaterial({
    blending: AdditiveBlending,
    color,
    depthWrite: false,
    opacity,
    side,
    toneMapped: false,
    transparent: true,
  });
}

function validateSupernovaState(
  state: Readonly<FictionalSupernovaRenderState>,
  context: Readonly<SolarFateScaleContext>,
): void {
  validateLifecycle(state.lifecycleState);
  if (!PHASES.includes(state.phase)) {
    throw new RangeError(`Unsupported fictional-supernova phase "${String(state.phase)}".`);
  }
  validateProgress(state.progress);
  [
    ['scenario time', state.scenarioTimeSeconds],
    ['pulse scale', state.pulseScale],
    ['flash intensity', state.flashIntensity],
    ['core radius', state.coreRadiusM],
    ['shock radius', state.shockRadiusM],
    ['radiation-front radius', state.radiationFrontRadiusM],
    ['debris radius', state.debrisRadiusM],
    ['debris opacity', state.debrisOpacity],
    ['nebula radius', state.nebulaRadiusM],
    ['nebula opacity', state.nebulaOpacity],
    ['remnant radius', state.remnantRadiusM],
  ].forEach(([label, value]) => requireFiniteNonNegative(value as number, label as string));
  requirePositive(state.pulseScale, 'pulse scale');
  requireUnitInterval(state.debrisOpacity, 'debris opacity');
  requireUnitInterval(state.nebulaOpacity, 'nebula opacity');
  requirePositive(context.metersPerRenderUnit, 'metres per render unit');
  requirePositive(context.baseSunRadiusRenderUnits, 'base Sun render radius');
  if (!['compact-remnant', 'neutron-star'].includes(state.remnantKind)) {
    throw new RangeError(`Unsupported fictional-supernova remnant "${String(state.remnantKind)}".`);
  }
  if (state.runSignature.trim().length === 0) {
    throw new RangeError('Fictional-supernova run signature cannot be empty.');
  }
  for (const [bodyId, value] of Object.entries(state.heatingByBody)) {
    if (bodyId.trim().length === 0) throw new RangeError('Supernova heating body ID is empty.');
    requireUnitInterval(value, `heating for ${bodyId}`);
  }
}
