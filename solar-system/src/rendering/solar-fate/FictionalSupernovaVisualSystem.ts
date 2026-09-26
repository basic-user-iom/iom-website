import {
  AdditiveBlending,
  BackSide,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Uniform,
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
  private readonly coreMaterial = createStellarCoreMaterial(0xff8a39);
  private readonly core = new Mesh(this.sphereGeometry, this.coreMaterial);
  private readonly flashMaterial = createSoftShellMaterial(0xffffff, 0, BackSide, 'halo');
  private readonly flash = new Mesh(this.sphereGeometry, this.flashMaterial);
  private readonly shockMaterial = createSoftShellMaterial(0xffb24f, 0, DoubleSide, 'nebula');
  private readonly shock = new Mesh(this.sphereGeometry, this.shockMaterial);
  private readonly radiationMaterial = createSoftShellMaterial(0xa9d9ff, 0, DoubleSide);
  private readonly radiation = new Mesh(this.sphereGeometry, this.radiationMaterial);
  private readonly nebulaMaterial = createSoftShellMaterial(0xc768d4, 0, DoubleSide, 'nebula');
  private readonly nebula = new Mesh(this.sphereGeometry, this.nebulaMaterial);
  private readonly remnantMaterial = createStellarCoreMaterial(0xb9dcff);
  private readonly remnant = new Mesh(this.sphereGeometry, this.remnantMaterial);
  private readonly remnantHaloMaterial = createSoftShellMaterial(0x9ec8ff, 0, BackSide, 'halo');
  private readonly remnantHalo = new Mesh(this.sphereGeometry, this.remnantHaloMaterial);
  private readonly beamGeometry = new ConeGeometry(1, 1, 24, 1, true);
  private readonly beamMaterialA = createBeamMaterial();
  private readonly beamMaterialB = createBeamMaterial();
  private readonly beamA = new Mesh(this.beamGeometry, this.beamMaterialA);
  private readonly beamB = new Mesh(this.beamGeometry, this.beamMaterialB);
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
    this.remnantHalo.name = 'fictional-supernova-remnant-halo';
    this.remnantHalo.renderOrder = 11;
    this.beamA.name = 'fictional-supernova-remnant-beam-a';
    this.beamB.name = 'fictional-supernova-remnant-beam-b';
    this.beamA.renderOrder = 11;
    this.beamB.renderOrder = 11;
    this.root.add(
      this.core,
      this.flash,
      this.shock,
      this.radiation,
      this.debris.points,
      this.nebula,
      this.remnant,
      this.remnantHalo,
      this.beamA,
      this.beamB,
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
    const materialTime = this.reducedMotion ? 0 : state.scenarioTimeSeconds;
    this.root.traverse((object) => {
      if (object instanceof Mesh && !Array.isArray(object.material) && 'uniforms' in object.material) {
        const material = object.material as ShaderMaterial;
        if (material.uniforms.time !== undefined) material.uniforms.time.value = materialTime;
      }
    });

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
    setShaderTint(
      this.coreMaterial,
      state.phase === 'core-flash' ? 0xfff4d5 : 0xff8738,
    );
    (this.coreMaterial.uniforms.glowBoost as { value: number }).value =
      state.phase === 'core-flash' ? 1.8 : 1.15;

    const effectiveFlashIntensity = this.reduceFlashes
      ? Math.min(state.flashIntensity, 0.68)
      : Math.min(state.flashIntensity, 6);
    const flashVisible = active && effectiveFlashIntensity > 0.001;
    this.flash.visible = flashVisible;
    this.flash.scale.setScalar(Math.max(coreLocal * 1.85, 1e-9));
    setShaderOpacity(this.flashMaterial, Math.min(0.92, effectiveFlashIntensity * 0.34));

    // Keep the late debris readable after the initial shock passes.
    const shockFade = Math.exp(-Math.max(0, state.scenarioTimeSeconds - 8) * 0.3);
    this.shock.visible = active && state.shockRadiusM > 0 && shockFade > 0.015;
    this.shock.scale.setScalar(Math.max(shockLocal, 1e-9));
    setShaderOpacity(this.shockMaterial, 0.48 * (1 - state.progress * 0.42) * shockFade);

    this.radiation.visible = active && state.radiationFrontRadiusM > 0 && shockFade > 0.015;
    this.radiation.scale.setScalar(Math.max(radiationLocal, 1e-9));
    setShaderOpacity(this.radiationMaterial, (this.reduceFlashes ? 0.08 : 0.2) * shockFade);

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
    this.debris.setOpacity(clamp01(state.debrisOpacity) * 0.74);

    this.nebula.visible = active && state.nebulaRadiusM > 0 && state.nebulaOpacity > 0;
    this.nebula.scale.setScalar(Math.max(nebulaLocal, 1e-9));
    setShaderOpacity(this.nebulaMaterial, clamp01(state.nebulaOpacity) * 0.2);

    const remnantVisible = active && state.phase === 'remnant' && state.remnantRadiusM > 0;
    this.remnant.visible = remnantVisible;
    this.remnant.scale.setScalar(Math.max(remnantLocal, 1e-9));
    const remnantTint = state.remnantKind === 'neutron-star' ? 0xb9dcff : 0xe4edff;
    setShaderTint(this.remnantMaterial, remnantTint);
    (this.remnantMaterial.uniforms.glowBoost as { value: number }).value =
      state.remnantKind === 'neutron-star' ? 1.85 : 1.35;

    this.remnantHalo.visible = remnantVisible;
    this.remnantHalo.scale.setScalar(Math.max(remnantLocal * 2.4, 1e-9));
    setShaderOpacity(
      this.remnantHaloMaterial,
      state.remnantKind === 'neutron-star' ? 0.28 : 0.16,
    );

    const beamsVisible =
      remnantVisible &&
      state.remnantKind === 'neutron-star' &&
      this.quality !== 'low';
    this.beamA.visible = beamsVisible;
    this.beamB.visible = beamsVisible;
    if (beamsVisible) {
      const beamLength = remnantLocal * (this.reducedMotion ? 7 : 11);
      const beamRadius = remnantLocal * 0.55;
      this.beamA.scale.set(beamRadius, beamLength, beamRadius);
      this.beamB.scale.set(beamRadius * 0.9, beamLength * 0.92, beamRadius * 0.9);
      this.beamA.position.set(0, beamLength * 0.52, 0);
      this.beamB.position.set(0, -beamLength * 0.48, 0);
      const spin = this.reducedMotion ? 0 : state.scenarioTimeSeconds * 1.7;
      this.beamA.rotation.y = spin;
      this.beamB.rotation.y = spin + Math.PI;
      const beamOpacity = this.reducedMotion ? 0.18 : 0.3;
      (this.beamMaterialA.uniforms.opacity as Uniform<number>).value = beamOpacity;
      (this.beamMaterialB.uniforms.opacity as Uniform<number>).value = beamOpacity * 0.85;
      (this.beamMaterialA.uniforms.time as Uniform<number>).value =
        state.scenarioTimeSeconds;
      (this.beamMaterialB.uniforms.time as Uniform<number>).value =
        state.scenarioTimeSeconds;
    }

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
      beamsVisible ? remnantRender * 12 : 0,
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
    this.debris.setOpacity(0);
    setShaderOpacity(this.flashMaterial, 0);
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
    this.remnantHaloMaterial.dispose();
    this.beamGeometry.dispose();
    this.beamMaterialA.dispose();
    this.beamMaterialB.dispose();
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
    this.debris.setPointSize(
      this.quality === 'low' ? 2 : this.quality === 'medium' ? 3 : this.quality === 'high' ? 4 : 5,
    );
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error('Fictional supernova visual system is disposed.');
  }
}

function createBeamMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
    transparent: true,
    uniforms: {
      time: new Uniform(0),
      opacity: new Uniform(0.25),
    },
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying vec2 vUv;
      void main() {
        vAlong = uv.y;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform float opacity;
      varying float vAlong;
      varying vec2 vUv;
      void main() {
        float core = 1.0 - smoothstep(0.0, 0.5, abs(vUv.x - 0.5) * 2.0);
        float taper = pow(1.0 - vAlong, 1.4);
        float pulse = 0.82 + 0.18 * sin(vAlong * 22.0 - time * 3.2);
        vec3 color = mix(vec3(0.55, 0.8, 1.5), vec3(1.7, 1.9, 2.5), core) * pulse;
        gl_FragColor = vec4(color, core * taper * opacity);
      }
    `,
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
