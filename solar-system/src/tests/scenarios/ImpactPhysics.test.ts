import {
  DEFAULT_IMPACT_PARAMETERS,
  impactRunSignature,
  serializeImpactParameters,
  validateImpactParameters,
} from '../../simulation/scenarios/impact/ImpactConfiguration';
import {
  atmosphereDensityAtAltitudeM,
  calculateImpactPhysicalSummary,
  createImpactFrame,
  deriveImpactVisualProfile,
  sampleImpactTrajectory,
  simulateImpactEntry,
} from '../../simulation/scenarios/impact/ImpactPhysics';
import {
  getImpactTargetProfile,
  impactTargetCollisionRadiusM,
} from '../../simulation/scenarios/impact/ImpactTargetProfiles';
import {
  IMPACT_VISUAL_TUNING_PROFILES,
  getImpactVisualTuningProfile,
} from '../../simulation/scenarios/impact/ImpactVisualProfiles';
import {
  IMPACT_TARGET_BODY_IDS,
  type ImpactTargetBodyId,
} from '../../simulation/scenarios/impact/ImpactTypes';
import type { ImpactParameters } from '../../simulation/scenarios/impact/ImpactTypes';

function parameters(
  overrides: Partial<ImpactParameters> = {},
): Readonly<ImpactParameters> {
  return { ...DEFAULT_IMPACT_PARAMETERS, ...overrides };
}

function expectRelativeClose(actual: number, expected: number, tolerance = 1e-10): void {
  const scale = Math.max(Math.abs(actual), Math.abs(expected), Number.MIN_VALUE);
  expect(Math.abs(actual - expected) / scale).toBeLessThanOrEqual(tolerance);
}

describe('Impact Lab physical summaries', () => {
  it('reports exact spherical mass, kinetic energy, and TNT equivalent in SI units', () => {
    const summary = calculateImpactPhysicalSummary(parameters({
      diameterM: 100,
      densityKgM3: 3_000,
      entrySpeedKmps: 20,
      entryAngleDeg: 45,
    }));

    expectRelativeClose(summary.massKg, 1.570_796_326_8e9);
    expectRelativeClose(summary.kineticEnergyJ, 3.141_592_653_589_793e17);
    expectRelativeClose(summary.tntMegatons, 75.085_866_48);
    expect(summary.diameterM).toBe(100);
    expect(summary.densityKgM3).toBe(3_000);
    expect(summary.entryAngleRad).toBeCloseTo(Math.PI / 4, 14);
    expect(summary.estimatedAirburstAltitudeM).toBeUndefined();
  });

  it('keeps authored visual scaling separate and explicitly labeled', () => {
    const summary = simulateImpactEntry(DEFAULT_IMPACT_PARAMETERS).physicalSummary;
    const before = { ...summary };
    const visual = deriveImpactVisualProfile(summary);

    expect(summary).toEqual(before);
    expect(visual.flashIntensity).toBeGreaterThan(0);
    expect(visual.craterRadiusM).toBeGreaterThan(0);
    expect(visual.approximationNotes.join(' ')).toMatch(/artistically tuned/i);
    expect(Object.isFrozen(visual)).toBe(true);
  });
});

describe('Impact Lab parameter validation', () => {
  it('accepts and freezes canonical parameters with stable serialization/signatures', () => {
    const validated = validateImpactParameters(DEFAULT_IMPACT_PARAMETERS);
    expect(validated).toEqual(DEFAULT_IMPACT_PARAMETERS);
    expect(Object.isFrozen(validated)).toBe(true);
    expect(serializeImpactParameters(validated)).toBe(
      serializeImpactParameters({ ...DEFAULT_IMPACT_PARAMETERS }),
    );
    expect(impactRunSignature(validated)).toMatch(/^impact-v2-[0-9a-f]{8}$/);
  });

  it.each([
    { diameterM: 0 },
    { densityKgM3: Number.NaN },
    { entrySpeedKmps: 100 },
    { entryAngleDeg: 0 },
    { entryAzimuthDeg: -1 },
    { entryAzimuthDeg: 361 },
    { impactLatitudeDeg: 91 },
    { impactLongitudeDeg: -181 },
    { seed: -1 },
    { seed: 1.5 },
  ] satisfies readonly Partial<ImpactParameters>[])(
    'rejects invalid numeric input %#',
    (override) => {
      expect(() => validateImpactParameters(parameters(override))).toThrow();
    },
  );

  it('rejects unknown material and camera identifiers', () => {
    expect(() => validateImpactParameters(parameters({
      material: 'ice' as ImpactParameters['material'],
    }))).toThrow(/material/);
    expect(() => validateImpactParameters(parameters({
      cameraMode: 'flyby' as ImpactParameters['cameraMode'],
    }))).toThrow(/cameraMode/);
  });
});

describe('Impact Lab target profiles and spherical frames', () => {
  it('maps every required body to the V2 target class and capabilities', () => {
    const expectedClasses: Readonly<Record<ImpactTargetBodyId, string>> = {
      mercury: 'airless-rocky',
      venus: 'dense-atmosphere-rocky',
      earth: 'dense-atmosphere-rocky',
      moon: 'airless-rocky',
      mars: 'thin-atmosphere-rocky',
      jupiter: 'gas-giant',
      saturn: 'gas-giant',
      uranus: 'ice-giant',
      neptune: 'ice-giant',
    };

    for (const bodyId of IMPACT_TARGET_BODY_IDS) {
      const profile = getImpactTargetProfile(bodyId);
      expect(profile.targetClass).toBe(expectedClasses[bodyId]);
      expect(profile.meanRadiusM).toBeGreaterThan(0);
      expect(profile.surfaceGravityMps2).toBeGreaterThan(0);
      if (profile.targetClass === 'gas-giant' || profile.targetClass === 'ice-giant') {
        expect(profile.supportsCrater).toBe(false);
        expect(profile.supportsCloudScar).toBe(true);
      }
    }
  });

  it('resolves one frozen finite visual tuning profile for every target', () => {
    expect(Object.isFrozen(IMPACT_VISUAL_TUNING_PROFILES)).toBe(true);
    for (const bodyId of IMPACT_TARGET_BODY_IDS) {
      const target = getImpactTargetProfile(bodyId);
      const tuning = getImpactVisualTuningProfile(target.visualProfileId);
      expect(Object.isFrozen(tuning)).toBe(true);
      expect(tuning.id).toBe(target.visualProfileId);
      for (const [key, value] of Object.entries(tuning)) {
        if (key === 'id') continue;
        expect(Number.isFinite(value), `${target.bodyId}.${key}`).toBe(true);
      }
    }
    expect(() => getImpactVisualTuningProfile('missing-profile')).toThrow(
      /Missing impact visual tuning profile/,
    );
  });

  it('resolves distinct Earth, Moon, Mars, and Jupiter effect profiles', () => {
    const earth = deriveImpactVisualProfile(simulateImpactEntry(parameters({
      targetBodyId: 'earth',
      fragmentationEnabled: false,
    })).physicalSummary);
    const moon = deriveImpactVisualProfile(simulateImpactEntry(parameters({
      targetBodyId: 'moon',
      atmosphereEnabled: false,
      fragmentationEnabled: false,
    })).physicalSummary);
    const mars = deriveImpactVisualProfile(simulateImpactEntry(parameters({
      targetBodyId: 'mars',
      fragmentationEnabled: false,
    })).physicalSummary);
    const jupiter = deriveImpactVisualProfile(simulateImpactEntry(parameters({
      targetBodyId: 'jupiter',
      fragmentationEnabled: false,
    })).physicalSummary);

    expect(earth.craterRadiusM).toBeGreaterThan(0);
    expect(earth.atmosphericShockwaveSpeedMps).toBeGreaterThan(0);
    expect(moon.craterRadiusM).toBeGreaterThan(0);
    expect(moon.atmosphericShockwaveSpeedMps).toBe(0);
    expect(moon.cloudScarRadiusM).toBe(0);
    expect(moon.ejectaLifetimeSeconds).toBeGreaterThan(
      earth.ejectaLifetimeSeconds,
    );
    expect(mars.plumeRadiusM).not.toBe(earth.plumeRadiusM);
    expect(mars.plumeLifetimeSeconds).toBeGreaterThan(
      earth.plumeLifetimeSeconds,
    );
    expect(jupiter.craterRadiusM).toBe(0);
    expect(jupiter.craterDepthM).toBe(0);
    expect(jupiter.ejectaRadiusM).toBe(0);
    expect(jupiter.groundShockwaveSpeedMps).toBe(0);
    expect(jupiter.atmosphericShockwaveSpeedMps).toBeGreaterThan(0);
    expect(jupiter.cloudScarRadiusM).toBeGreaterThan(0);
    expect(jupiter.cloudScarLifetimeSeconds).toBeGreaterThan(0);
  });

  it('constructs an orthonormal right-handed impact frame', () => {
    const frame = createImpactFrame(37.25, -122.4);
    const { normalBodyLocal: normal, eastBodyLocal: east, northBodyLocal: north } = frame;
    const length = (value: typeof normal) => Math.hypot(value.x, value.y, value.z);
    const dot = (left: typeof normal, right: typeof normal) =>
      left.x * right.x + left.y * right.y + left.z * right.z;

    expect(length(normal)).toBeCloseTo(1, 14);
    expect(length(east)).toBeCloseTo(1, 14);
    expect(length(north)).toBeCloseTo(1, 14);
    expect(dot(normal, east)).toBeCloseTo(0, 14);
    expect(dot(normal, north)).toBeCloseTo(0, 14);
    expect(dot(east, north)).toBeCloseTo(0, 14);
  });

  it('interprets entry azimuth clockwise from north', () => {
    const northbound = simulateImpactEntry(parameters({
      targetBodyId: 'moon',
      entryAzimuthDeg: 0,
      entryAngleDeg: 45,
      atmosphereEnabled: false,
      fragmentationEnabled: false,
    })).samples[0];
    const eastbound = simulateImpactEntry(parameters({
      targetBodyId: 'moon',
      entryAzimuthDeg: 90,
      entryAngleDeg: 45,
      atmosphereEnabled: false,
      fragmentationEnabled: false,
    })).samples[0];

    expect(northbound).toBeDefined();
    expect(eastbound).toBeDefined();
    expect(northbound!.velocityEnuMps.y).toBeGreaterThan(0);
    expect(Math.abs(northbound!.velocityEnuMps.x)).toBeLessThan(1e-6);
    expect(eastbound!.velocityEnuMps.x).toBeGreaterThan(0);
    expect(Math.abs(eastbound!.velocityEnuMps.y)).toBeLessThan(
      eastbound!.velocityEnuMps.x * 0.01,
    );
  });

  it('terminates on the configured solid or cloud-top radius', () => {
    for (const targetBodyId of ['moon', 'earth', 'jupiter'] as const) {
      const result = simulateImpactEntry(parameters({
        targetBodyId,
        atmosphereEnabled: false,
        fragmentationEnabled: false,
      }));
      const terminal = result.samples.at(-1);
      const expectedRadiusM = impactTargetCollisionRadiusM(
        getImpactTargetProfile(targetBodyId),
      );

      expect(result.physicalSummary.reachedSurface).toBe(true);
      expect(result.physicalSummary.outcomeKind).toBe(
        targetBodyId === 'jupiter'
          ? 'deep-atmosphere-breakup'
          : 'solid-surface-impact',
      );
      expect(result.physicalSummary.targetRadiusM).toBe(expectedRadiusM);
      expect(terminal?.altitudeM).toBeCloseTo(0, 6);
      expect(terminal?.positionEnuM.x).toBeCloseTo(0, 5);
      expect(terminal?.positionEnuM.y).toBeCloseTo(0, 5);
      expect(terminal?.positionEnuM.z).toBeCloseTo(0, 5);
    }
  });

  it('ignores the atmosphere toggle for airless targets', () => {
    const result = simulateImpactEntry(parameters({
      targetBodyId: 'moon',
      atmosphereEnabled: true,
      fragmentationEnabled: true,
    }));

    expect(result.fragmentation.count).toBe(0);
    expect(result.physicalSummary.atmosphericEnergyLossJ).toBe(0);
    expect(result.samples.every((sample) => sample.dynamicPressurePa === 0)).toBe(true);
  });

  it('never derives crater or ejecta visuals for giant planets', () => {
    for (const targetBodyId of ['jupiter', 'saturn', 'uranus', 'neptune'] as const) {
      const result = simulateImpactEntry(parameters({
        targetBodyId,
        atmosphereEnabled: false,
        fragmentationEnabled: false,
      }));
      const visual = deriveImpactVisualProfile(result.physicalSummary);
      expect(result.physicalSummary.reachedSurface).toBe(true);
      expect(result.physicalSummary.outcomeKind).toBe(
        'deep-atmosphere-breakup',
      );
      expect(visual.craterRadiusM).toBe(0);
      expect(visual.craterDepthM).toBe(0);
      expect(visual.ejectaRadiusM).toBe(0);
      expect(visual.groundShockwaveSpeedMps).toBe(0);
    }
  });

  it('uses one maximum-energy-loss event for airburst altitude, time, and frame', () => {
    const result = simulateImpactEntry(parameters({
      targetBodyId: 'venus',
      diameterM: 1,
      material: 'porous-rock',
      atmosphereEnabled: true,
      fragmentationEnabled: true,
    }));
    const altitudeM = result.physicalSummary.estimatedAirburstAltitudeM;
    const event = sampleImpactTrajectory(result, result.terminalEventTimeSeconds);

    expect(result.physicalSummary.reachedSurface).toBe(false);
    expect(result.physicalSummary.outcomeKind).toBe('airburst');
    expect(altitudeM).toBeDefined();
    expect(Math.abs(event.altitudeM - (altitudeM ?? 0))).toBeLessThan(2_000);
    expect(Math.abs(event.positionEnuM.x)).toBeLessThan(2_000);
    expect(Math.abs(event.positionEnuM.y)).toBeLessThan(2_000);
    expect(Math.abs(event.positionEnuM.z - event.altitudeM)).toBeLessThan(2_000);
  });
});

describe('Impact Lab fixed-step entry approximation', () => {
  it('produces a visible deterministic breakup and surface impact for defaults', () => {
    const first = simulateImpactEntry(DEFAULT_IMPACT_PARAMETERS);
    const second = simulateImpactEntry({ ...DEFAULT_IMPACT_PARAMETERS });

    expect(first.physicalSummary.reachedSurface).toBe(true);
    expect(first.physicalSummary.outcomeKind).toBe('solid-surface-impact');
    expect(first.physicalSummary.estimatedAirburstAltitudeM).toBeUndefined();
    expect(first.physicalSummary.impactMassKg).toBeGreaterThan(0);
    expect(first.fragmentation.count).toBeGreaterThanOrEqual(3);
    expect(first.fragmentation.eventAltitudeM).toBeGreaterThan(0);
    expect(first).toEqual(second);
  });

  it('applies atmosphere drag/ablation and disables breakup in vacuum', () => {
    const atmospheric = simulateImpactEntry(parameters({
      fragmentationEnabled: false,
      atmosphereEnabled: true,
    }));
    const vacuum = simulateImpactEntry(parameters({
      fragmentationEnabled: true,
      atmosphereEnabled: false,
    }));

    expect(atmospheric.physicalSummary.impactMassKg).toBeLessThan(
      vacuum.physicalSummary.impactMassKg,
    );
    expect(atmospheric.physicalSummary.impactEnergyJ).toBeLessThan(
      vacuum.physicalSummary.impactEnergyJ,
    );
    expect(atmospheric.physicalSummary.atmosphericEnergyLossJ).toBeGreaterThan(0);
    expect(vacuum.physicalSummary.atmosphericEnergyLossJ).toBe(0);
    expect(vacuum.fragmentation.count).toBe(0);
  });

  it('changes entry duration and trajectory when angle/speed/diameter change', () => {
    const shallow = simulateImpactEntry(parameters({ entryAngleDeg: 15 }));
    const steep = simulateImpactEntry(parameters({ entryAngleDeg: 80 }));
    const faster = simulateImpactEntry(parameters({ entrySpeedKmps: 35 }));
    const smaller = simulateImpactEntry(parameters({ diameterM: 20 }));

    expect(shallow.terminalEventTimeSeconds).toBeGreaterThan(
      steep.terminalEventTimeSeconds,
    );
    expect(faster.physicalSummary.kineticEnergyJ).toBeGreaterThan(
      steep.physicalSummary.kineticEnergyJ,
    );
    expect(smaller.physicalSummary.massKg).toBeLessThan(
      steep.physicalSummary.massKg,
    );
  });

  it('uses a static exponential atmosphere with bounded density', () => {
    expect(atmosphereDensityAtAltitudeM(0)).toBe(1.225);
    expect(atmosphereDensityAtAltitudeM(8_500)).toBeCloseTo(1.225 / Math.E, 12);
    expect(atmosphereDensityAtAltitudeM(120_000)).toBe(0);
    expect(atmosphereDensityAtAltitudeM(-1_000)).toBe(1.225);
    expect(() => atmosphereDensityAtAltitudeM(Number.NaN)).toThrow(/finite/);
  });

  it('changes seeded fragment dispersion without introducing non-finite states', () => {
    const first = simulateImpactEntry(parameters({ seed: 1 }));
    const second = simulateImpactEntry(parameters({ seed: 2 }));

    expect(first.fragmentation.separationVelocitiesEnuMps).not.toEqual(
      second.fragmentation.separationVelocitiesEnuMps,
    );
    for (const result of [first, second]) {
      for (const sample of result.samples) {
        expect(Number.isFinite(sample.positionEnuM.x)).toBe(true);
        expect(Number.isFinite(sample.positionEnuM.y)).toBe(true);
        expect(Number.isFinite(sample.positionEnuM.z)).toBe(true);
        expect(Number.isFinite(sample.massKg)).toBe(true);
      }
    }
  });
});
