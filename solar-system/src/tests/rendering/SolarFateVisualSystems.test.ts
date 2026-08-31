import {
  Group,
  Vector3,
  type BufferGeometry,
  type Points,
} from 'three';

import {
  FictionalSupernovaVisualSystem,
  SolarEvolutionVisualSystem,
  physicalRadiusToLocal,
  physicalRadiusToRenderUnits,
  type FictionalSupernovaRenderState,
  type SolarEvolutionRenderState,
  type SolarFateScaleContext,
} from '../../rendering/solar-fate';

const SCALE: Readonly<SolarFateScaleContext> = Object.freeze({
  metersPerRenderUnit: 1_000_000_000,
  baseSunRadiusRenderUnits: 12,
});

describe('solar-fate physical radius mapping', () => {
  it('cancels presentation exaggeration and preserves true render-unit radius', () => {
    const radiusM = 139_140_000_000;
    const compactContext = { ...SCALE, baseSunRadiusRenderUnits: 4 };
    const exaggeratedContext = { ...SCALE, baseSunRadiusRenderUnits: 40 };
    const renderRadius = physicalRadiusToRenderUnits(radiusM, SCALE);

    expect(physicalRadiusToLocal(radiusM, compactContext) * 4)
      .toBeCloseTo(renderRadius, 12);
    expect(physicalRadiusToLocal(radiusM, exaggeratedContext) * 40)
      .toBeCloseTo(renderRadius, 12);
    expect(physicalRadiusToRenderUnits(radiusM, compactContext))
      .toBe(renderRadius);
    expect(physicalRadiusToRenderUnits(radiusM, exaggeratedContext))
      .toBe(renderRadius);
  });

  it('rejects non-finite mapped radii instead of passing them to Three.js', () => {
    expect(() => physicalRadiusToRenderUnits(Number.MAX_VALUE, {
      metersPerRenderUnit: 1,
      baseSunRadiusRenderUnits: 1,
    })).toThrow(RangeError);
    expect(() => physicalRadiusToRenderUnits(Number.MAX_VALUE, {
      metersPerRenderUnit: Number.MIN_VALUE,
      baseSunRadiusRenderUnits: 1,
    })).toThrow(RangeError);
  });
});

describe('SolarEvolutionVisualSystem', () => {
  it('renders deterministic evolution layers and restores the base Sun idempotently', () => {
    const system = new SolarEvolutionVisualSystem('high');
    const { sun, surface, corona } = attachSun(system);
    const earth = new Group();
    const mercury = new Group();
    system.attachBody('earth', earth);
    system.attachBody('mercury', mercury);
    sun.scale.setScalar(SCALE.baseSunRadiusRenderUnits);

    const event = evolutionState();
    const children = system.root.children.slice();
    system.update(event, SCALE);
    const diagnostics = system.getDiagnostics();
    expect(diagnostics).toMatchObject({
      active: true,
      phase: 'mass-loss',
      runSignature: 'evolution:fixture',
      stellarRadiusRenderUnits: 139.14,
      boundingRadiusRenderUnits: 261,
      particleCount: 537,
      heatedBodyCount: 2,
      baseSunHidden: true,
    });
    expect(surface.visible).toBe(false);
    expect(corona.every((shell) => !shell.visible)).toBe(true);
    expect(earth.getObjectByName('solar-fate-heat-earth')?.visible).toBe(true);
    expect(mercury.getObjectByName('solar-fate-heat-mercury')?.visible).toBe(true);

    sun.updateMatrixWorld(true);
    const core = system.root.getObjectByName('solar-evolution-stellar-core');
    expect(core).toBeDefined();
    expect(core?.getWorldScale(new Vector3()).x).toBeCloseTo(139.14, 9);

    const firstParticles = pointPositions(
      system.root,
      'solar-evolution-mass-loss-particles',
    );
    system.update(event, SCALE);
    expect(pointPositions(system.root, 'solar-evolution-mass-loss-particles'))
      .toEqual(firstParticles);

    system.reset();
    system.reset();
    expect(system.root.children).toEqual(children);
    expect(system.getDiagnostics()).toMatchObject({ active: false, phase: 'present' });
    expect(surface.visible).toBe(true);
    expect(corona.map((shell) => shell.visible)).toEqual([true, true, false]);
    expect(earth.getObjectByName('solar-fate-heat-earth')?.visible).toBe(false);

    system.update(event, SCALE);
    expect(pointPositions(system.root, 'solar-evolution-mass-loss-particles'))
      .toEqual(firstParticles);
    system.dispose();
    system.dispose();
    expect(system.root.children).toHaveLength(0);
  });

  it('propagates quality, reduced-motion, and finite-value validation', () => {
    const system = new SolarEvolutionVisualSystem('low');
    attachSun(system);
    system.setReducedMotion(true);
    system.setReduceFlashes(true);
    system.update(evolutionState(), SCALE);
    expect(system.getDiagnostics().particleCount).toBe(76);
    expect(() => system.update(
      evolutionState({ effectiveTemperatureK: Number.NaN }),
      SCALE,
    )).toThrow(RangeError);
    expect(() => system.update(evolutionState({ runSignature: ' ' }), SCALE))
      .toThrow(RangeError);
    expect(() => system.update(evolutionState({ nebulaOpacity: 1.1 }), SCALE))
      .toThrow(RangeError);
    system.dispose();
  });
});

describe('FictionalSupernovaVisualSystem', () => {
  it('renders deterministic fictional effects with flash and exposure safeguards', () => {
    const system = new FictionalSupernovaVisualSystem('high');
    const { sun, surface, corona } = attachSun(system);
    sun.scale.setScalar(SCALE.baseSunRadiusRenderUnits);
    const earth = new Group();
    system.attachBody('earth', earth);
    const event = supernovaState();
    const children = system.root.children.slice();

    system.update(event, SCALE);
    expect(system.getDiagnostics()).toMatchObject({
      active: true,
      phase: 'shock-shell',
      runSignature: 'supernova:fixture',
      coreRadiusRenderUnits: 0.9,
      boundingRadiusRenderUnits: 40,
      debrisPointCount: 716,
      heatedBodyCount: 1,
      flashVisible: true,
      effectiveFlashIntensity: 0.68,
      baseSunHidden: true,
    });
    expect(system.getProtectiveExposureCeiling()).toBe(0.1);
    expect(surface.visible).toBe(false);
    expect(corona.every((shell) => !shell.visible)).toBe(true);
    sun.updateMatrixWorld(true);
    const core = system.root.getObjectByName('fictional-supernova-core');
    expect(core?.getWorldScale(new Vector3()).x).toBeCloseTo(0.9, 12);
    const firstDebris = pointPositions(system.root, 'fictional-supernova-debris');
    system.update(event, SCALE);
    expect(pointPositions(system.root, 'fictional-supernova-debris'))
      .toEqual(firstDebris);

    system.setReduceFlashes(false);
    system.update(event, SCALE);
    expect(system.getDiagnostics().effectiveFlashIntensity).toBe(4);
    expect(system.getProtectiveExposureCeiling()).toBe(0.18);

    system.setQuality('low');
    system.setReducedMotion(true);
    system.update(event, SCALE);
    expect(system.getDiagnostics().debrisPointCount).toBe(102);

    system.reset();
    system.reset();
    expect(system.root.children).toEqual(children);
    expect(surface.visible).toBe(true);
    expect(corona.map((shell) => shell.visible)).toEqual([false, false, false]);
    expect(system.getProtectiveExposureCeiling()).toBeNull();
    system.dispose();
    system.dispose();
    expect(system.root.children).toHaveLength(0);
  });

  it('rejects malformed snapshots before updating visual resources', () => {
    const system = new FictionalSupernovaVisualSystem();
    attachSun(system);
    expect(() => system.update(
      supernovaState({ shockRadiusM: Number.POSITIVE_INFINITY }),
      SCALE,
    )).toThrow(RangeError);
    expect(() => system.update(supernovaState({ runSignature: '' }), SCALE))
      .toThrow(RangeError);
    expect(() => system.update(supernovaState({ debrisOpacity: -0.1 }), SCALE))
      .toThrow(RangeError);
    expect(() => system.update(supernovaState({
      remnantKind: 'black-hole' as FictionalSupernovaRenderState['remnantKind'],
    }), SCALE)).toThrow(RangeError);
    expect(system.getDiagnostics().active).toBe(false);
    system.dispose();
  });
});

function attachSun(
  system: SolarEvolutionVisualSystem | FictionalSupernovaVisualSystem,
): {
  sun: Group;
  surface: Group;
  corona: readonly Group[];
} {
  const sun = new Group();
  const surface = new Group();
  const corona = [new Group(), new Group(), new Group()];
  sun.add(surface, ...corona);
  system.attachToSun(sun, surface, corona);
  return { sun, surface, corona };
}

function pointPositions(root: Group, name: string): readonly number[] {
  const points = root.getObjectByName(name) as Points<BufferGeometry> | undefined;
  if (points === undefined) throw new Error(`Missing test points "${name}".`);
  const count = points.geometry.drawRange.count;
  const values = points.geometry.getAttribute('position').array as Float32Array;
  return Array.from(values.slice(0, count * 3));
}

function evolutionState(
  overrides: Partial<SolarEvolutionRenderState> = {},
): Readonly<SolarEvolutionRenderState> {
  return Object.freeze({
    lifecycleState: 'running',
    phase: 'mass-loss',
    scenarioTimeSeconds: 1_250,
    progress: 0.62,
    stellarRadiusM: 139_140_000_000,
    luminositySolar: 2_400,
    effectiveTemperatureK: 3_400,
    massSolar: 0.72,
    massLossOpacity: 0.8,
    nebulaRadiusM: 240_000_000_000,
    nebulaOpacity: 0.34,
    heatingByBody: Object.freeze({ earth: 0.72 }),
    engulfmentByBody: Object.freeze({ mercury: 1 }),
    runSignature: 'evolution:fixture',
    ...overrides,
  });
}

function supernovaState(
  overrides: Partial<FictionalSupernovaRenderState> = {},
): Readonly<FictionalSupernovaRenderState> {
  return Object.freeze({
    lifecycleState: 'running',
    phase: 'shock-shell',
    scenarioTimeSeconds: 18,
    progress: 0.42,
    pulseScale: 0.8,
    flashIntensity: 4,
    coreRadiusM: 900_000_000,
    shockRadiusM: 20_000_000_000,
    radiationFrontRadiusM: 30_000_000_000,
    debrisRadiusM: 25_000_000_000,
    debrisOpacity: 0.82,
    nebulaRadiusM: 40_000_000_000,
    nebulaOpacity: 0.5,
    remnantRadiusM: 12_000_000,
    remnantKind: 'neutron-star',
    heatingByBody: Object.freeze({ earth: 0.94 }),
    runSignature: 'supernova:fixture',
    ...overrides,
  });
}
