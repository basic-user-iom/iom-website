import {
  BackSide,
  DoubleSide,
  Group,
  Mesh,
  SphereGeometry,
  type Object3D,
  type ShaderMaterial,
} from 'three';

import { coronaShellCount, type VisualQuality } from '../bodies/VisualQuality';
import {
  EMPTY_SOLAR_EVOLUTION_DIAGNOSTICS,
  type SolarEvolutionDiagnostics,
  type SolarEvolutionRenderState,
  type SolarFateScaleContext,
} from './SolarFateRenderTypes';
import {
  PlanetHeatOverlayLayer,
  clamp01,
  createSoftShellMaterial,
  createSolarPoints,
  createStellarCoreMaterial,
  isActiveLifecycle,
  particleBudget,
  physicalRadiusToLocal,
  physicalRadiusToRenderUnits,
  requireFiniteNonNegative,
  requirePositive,
  requireUnitInterval,
  setShaderOpacity,
  setShaderTint,
  validateLifecycle,
  validateProgress,
  writeDeterministicShellParticles,
} from './SolarFateSupport';

const PHASES = [
  'present',
  'brightening',
  'red-giant',
  'mass-loss',
  'planetary-nebula',
  'white-dwarf',
  'cooling',
] as const;
const MAX_OUTFLOW_POINTS = 768;

export class SolarEvolutionVisualSystem {
  public readonly root = new Group();

  private readonly sphereGeometry = new SphereGeometry(1, 64, 40);
  private readonly coreMaterial = createStellarCoreMaterial(0xffb067);
  private readonly core = new Mesh(this.sphereGeometry, this.coreMaterial);
  private readonly coreHaloMaterial = createSoftShellMaterial(0xd8ecff, 0, BackSide, 'halo');
  private readonly coreHalo = new Mesh(this.sphereGeometry, this.coreHaloMaterial);
  private readonly chromosphereMaterial = createSoftShellMaterial(0xff6f35, 0.34, BackSide);
  private readonly chromosphere = new Mesh(
    this.sphereGeometry,
    this.chromosphereMaterial,
  );
  private readonly massLossMaterials = [
    createSoftShellMaterial(0xff9a5a, 0.2, DoubleSide, 'nebula'),
    createSoftShellMaterial(0xffc58a, 0.12, DoubleSide, 'nebula'),
  ];
  private readonly massLossShells = this.massLossMaterials.map(
    (material) => new Mesh(this.sphereGeometry, material),
  );
  private readonly nebulaMaterials = [
    createSoftShellMaterial(0x5bb9c9, 0.15, DoubleSide, 'nebula'),
    createSoftShellMaterial(0xd477c5, 0.1, DoubleSide, 'nebula'),
  ];
  private readonly nebulaShells = this.nebulaMaterials.map(
    (material) => new Mesh(this.sphereGeometry, material),
  );
  private readonly outflow = createSolarPoints(
    'solar-evolution-mass-loss-particles',
    MAX_OUTFLOW_POINTS,
    0xffc285,
    3,
  );
  private readonly heating = new PlanetHeatOverlayLayer();
  private baseSurface: Object3D | null = null;
  private baseCorona: readonly Object3D[] = Object.freeze([]);
  private quality: VisualQuality;
  private reducedMotion = false;
  private reduceFlashes = true;
  private diagnostics: Readonly<SolarEvolutionDiagnostics> =
    EMPTY_SOLAR_EVOLUTION_DIAGNOSTICS;
  private disposed = false;

  public constructor(initialQuality: VisualQuality = 'high') {
    this.quality = initialQuality;
    this.root.name = 'scientific-solar-evolution-layer';
    this.core.name = 'solar-evolution-stellar-core';
    this.core.renderOrder = 3;
    this.coreHalo.name = 'solar-evolution-stellar-halo';
    this.coreHalo.renderOrder = 4;
    this.chromosphere.name = 'solar-evolution-chromosphere';
    this.chromosphere.renderOrder = 5;
    this.massLossShells.forEach((shell, index) => {
      shell.name = `solar-evolution-mass-loss-shell-${index + 1}`;
      shell.renderOrder = 6 + index;
    });
    this.nebulaShells.forEach((shell, index) => {
      shell.name = `solar-evolution-nebula-shell-${index + 1}`;
      shell.renderOrder = 8 + index;
    });
    this.root.add(
      this.core,
      this.coreHalo,
      this.chromosphere,
      ...this.massLossShells,
      ...this.nebulaShells,
      this.outflow.points,
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
    state: Readonly<SolarEvolutionRenderState>,
    context: Readonly<SolarFateScaleContext>,
  ): void {
    this.assertNotDisposed();
    validateEvolutionState(state, context);
    const active = isActiveLifecycle(state.lifecycleState);
    const stellarLocal = physicalRadiusToLocal(state.stellarRadiusM, context);
    const stellarRender = physicalRadiusToRenderUnits(state.stellarRadiusM, context);
    const nebulaLocal = physicalRadiusToLocal(state.nebulaRadiusM, context);
    const nebulaRender = physicalRadiusToRenderUnits(state.nebulaRadiusM, context);
    const replacementCore = active && state.phase !== 'present';
    this.setBaseSunHidden(replacementCore);
    this.root.visible = active;
    const materialTime = this.reducedMotion ? 0 : state.scenarioTimeSeconds;
    this.root.traverse((object) => {
      if (object instanceof Mesh && !Array.isArray(object.material) && 'uniforms' in object.material) {
        const material = object.material as ShaderMaterial;
        if (material.uniforms.time !== undefined) material.uniforms.time.value = materialTime;
      }
    });

    this.core.visible = replacementCore;
    this.core.scale.setScalar(Math.max(stellarLocal, 1e-9));
    setShaderTint(this.coreMaterial, stellarColor(state.effectiveTemperatureK));
    const glowBoost = state.phase === 'white-dwarf' || state.phase === 'cooling'
      ? 1.55
      : state.phase === 'red-giant' || state.phase === 'mass-loss'
        ? 0.95
        : 1.1;
    (this.coreMaterial.uniforms.glowBoost as { value: number }).value = glowBoost;

    const compactRemnant = replacementCore &&
      (state.phase === 'white-dwarf' || state.phase === 'cooling');
    this.coreHalo.visible = compactRemnant;
    this.coreHalo.scale.setScalar(Math.max(stellarLocal * (compactRemnant ? 2.2 : 1.6), 1e-9));
    setShaderOpacity(
      this.coreHaloMaterial,
      compactRemnant ? 0.12 : 0,
    );
    setShaderTint(
      this.coreHaloMaterial,
      state.effectiveTemperatureK > 12_000 ? 0xcfe8ff : 0xffe1b5,
    );

    const brightening = active && state.phase === 'brightening';
    const giantLike = active && ['red-giant', 'mass-loss'].includes(state.phase);
    this.chromosphere.visible = brightening || giantLike;
    this.chromosphere.scale.setScalar(
      Math.max(stellarLocal * 1.035, 1e-9),
    );
    setShaderOpacity(
      this.chromosphereMaterial,
      brightening ? Math.min(0.36, 0.08 + state.progress * 0.28) : 0.28,
    );

    const massLoss = active && ['mass-loss', 'planetary-nebula'].includes(state.phase);
    this.massLossShells.forEach((shell, index) => {
      shell.visible = massLoss && state.massLossOpacity > 0;
      shell.scale.setScalar(
        Math.max(stellarLocal, nebulaLocal * (0.32 + index * 0.2), 1e-9),
      );
      setShaderOpacity(
        shell.material as ShaderMaterial,
        clamp01(state.massLossOpacity) * (0.22 - index * 0.07),
      );
    });

    const nebulaVisible =
      active && ['planetary-nebula', 'white-dwarf', 'cooling'].includes(state.phase);
    this.nebulaShells.forEach((shell, index) => {
      shell.visible = nebulaVisible && state.nebulaOpacity > 0;
      shell.scale.setScalar(Math.max(nebulaLocal * (0.78 + index * 0.22), 1e-9));
      setShaderOpacity(
        shell.material as ShaderMaterial,
        clamp01(state.nebulaOpacity) * (0.18 - index * 0.06),
      );
    });

    const requestedParticles = massLoss || nebulaVisible
      ? particleBudget(this.quality, MAX_OUTFLOW_POINTS, this.reducedMotion)
      : 0;
    const particleRadius = Math.max(stellarLocal * 1.2, nebulaLocal * 0.75);
    const particleCount = requestedParticles === 0 || particleRadius <= 0
      ? 0
      : writeDeterministicShellParticles(
          this.outflow,
          requestedParticles,
          particleRadius,
          0.34,
          state.runSignature,
          state.scenarioTimeSeconds,
          this.reducedMotion ? 0 : 0.00004,
        );
    this.outflow.points.visible = particleCount > 0;
    this.outflow.setOpacity(Math.max(
      clamp01(state.massLossOpacity) * 0.6,
      clamp01(state.nebulaOpacity) * 0.34,
    ));

    const heatedBodyCount = this.heating.update(
      state.heatingByBody,
      this.reduceFlashes,
      state.engulfmentByBody,
    );
    const particleBoundingRadius = particleCount > 0
      ? Math.max(stellarRender * 1.2, nebulaRender * 0.75) * 1.45
      : 0;
    const boundingRadiusRenderUnits = Math.max(
      stellarRender * (giantLike ? 1.035 : 1),
      nebulaRender,
      particleBoundingRadius,
    );
    this.diagnostics = Object.freeze({
      active,
      phase: state.phase,
      runSignature: state.runSignature,
      stellarRadiusRenderUnits: stellarRender,
      boundingRadiusRenderUnits,
      particleCount,
      heatedBodyCount,
      baseSunHidden: replacementCore,
    });
  }

  public reset(): void {
    if (this.disposed) return;
    this.root.visible = false;
    this.root.children.forEach((child) => { child.visible = false; });
    this.outflow.points.geometry.setDrawRange(0, 0);
    this.outflow.setOpacity(0);
    this.heating.reset();
    this.setBaseSunHidden(false);
    this.diagnostics = EMPTY_SOLAR_EVOLUTION_DIAGNOSTICS;
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

  public getDiagnostics(): Readonly<SolarEvolutionDiagnostics> {
    return this.diagnostics;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.reset();
    this.disposed = true;
    this.root.removeFromParent();
    this.heating.dispose();
    this.outflow.points.geometry.dispose();
    this.outflow.points.material.dispose();
    this.coreMaterial.dispose();
    this.coreHaloMaterial.dispose();
    this.chromosphereMaterial.dispose();
    this.massLossMaterials.forEach((material) => material.dispose());
    this.nebulaMaterials.forEach((material) => material.dispose());
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
    this.outflow.setPointSize(
      this.quality === 'low' ? 2 : this.quality === 'medium' ? 3 : this.quality === 'high' ? 4 : 5,
    );
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error('Solar evolution visual system is disposed.');
  }
}

function stellarColor(temperatureK: number): number {
  if (temperatureK < 4_000) return 0xff8648;
  if (temperatureK < 7_000) return 0xffd5a0;
  if (temperatureK < 12_000) return 0xfff1dd;
  return 0xbddcff;
}

function validateEvolutionState(
  state: Readonly<SolarEvolutionRenderState>,
  context: Readonly<SolarFateScaleContext>,
): void {
  validateLifecycle(state.lifecycleState);
  if (!PHASES.includes(state.phase)) {
    throw new RangeError(`Unsupported solar-evolution phase "${String(state.phase)}".`);
  }
  validateProgress(state.progress);
  requireFiniteNonNegative(state.scenarioTimeSeconds, 'scenario time');
  requirePositive(state.stellarRadiusM, 'stellar radius');
  requireFiniteNonNegative(state.luminositySolar, 'solar luminosity');
  requirePositive(state.effectiveTemperatureK, 'effective temperature');
  requirePositive(state.massSolar, 'solar mass');
  requireUnitInterval(state.massLossOpacity, 'mass-loss opacity');
  requireFiniteNonNegative(state.nebulaRadiusM, 'nebula radius');
  requireUnitInterval(state.nebulaOpacity, 'nebula opacity');
  requirePositive(context.metersPerRenderUnit, 'metres per render unit');
  requirePositive(context.baseSunRadiusRenderUnits, 'base Sun render radius');
  if (state.runSignature.trim().length === 0) {
    throw new RangeError('Solar-evolution run signature cannot be empty.');
  }
  validateBodyValues(state.heatingByBody, 'heating');
  validateBodyValues(state.engulfmentByBody, 'engulfment');
}

function validateBodyValues(values: Readonly<Record<string, number>>, label: string): void {
  for (const [bodyId, value] of Object.entries(values)) {
    if (bodyId.trim().length === 0) throw new RangeError(`Solar-fate ${label} body ID is empty.`);
    requireUnitInterval(value, `${label} for ${bodyId}`);
  }
}
