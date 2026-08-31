import {
  ASTRONOMICAL_UNIT_M,
  GRAVITATIONAL_CONSTANT_M3_KG_S2,
} from '../../../simulation/core/Units';
import {
  advanceBlackHoleKernel,
  BLACK_HOLE_ALLOWED_SUBSTEPS_SECONDS,
  initializeBlackHoleKernel,
  selectAdaptiveSubstepSeconds,
  SOLAR_MASS_KG,
  type BlackHoleKernelConfiguration,
} from '../../../simulation/scenarios/black-hole';
import { solarSystemInitialState } from './BlackHoleTestFixtures';

const PHYSICS_CONFIGURATION: BlackHoleKernelConfiguration = Object.freeze({
  accuracy: 'ultra',
  ejectionRadiusM: 100 * ASTRONOMICAL_UNIT_M,
  captureRadiusMultiple: 8,
  physicsSecondsPerScenarioSecond: 1,
  cinematicInfall: null,
});

describe('black-hole velocity-Verlet physics kernel', () => {
  it('keeps a circular orbit around an equal-mass Sun replacement instead of inventing inspiral', () => {
    const orbitalRadiusM = ASTRONOMICAL_UNIT_M;
    const circularSpeedMps = Math.sqrt(
      GRAVITATIONAL_CONSTANT_M3_KG_S2 * SOLAR_MASS_KG / orbitalRadiusM,
    );
    const initial = {
      bodyIds: ['earth'],
      positionsM: new Float64Array([orbitalRadiusM, 0, 0]),
      velocitiesMps: new Float64Array([0, circularSpeedMps, 0]),
      massesKg: new Float64Array([5.972_17e24]),
      radiiM: new Float64Array([6_371_008.4]),
    };
    const blackHole = {
      massSolarMasses: 1,
      initialPositionM: [0, 0, 0] as const,
      initialVelocityMps: [0, 0, 0] as const,
      closestApproachTargetM: [0, 0, 0] as const,
      closestApproachTimeSeconds: 1,
      spinVisualization: 0,
      accretionDiskEnabled: false,
      captureRadiusMultiple: 8,
    };
    const initialized = initializeBlackHoleKernel(initial, blackHole);
    const advanced = advanceBlackHoleKernel(
      initialized.state,
      PHYSICS_CONFIGURATION,
      30 * 86_400,
    );
    const bodyOffset = 0;
    const bhOffset = advanced.state.blackHoleIndex * 3;
    const finalRadiusM = Math.hypot(
      (advanced.state.positionsM[bodyOffset] ?? 0) -
        (advanced.state.positionsM[bhOffset] ?? 0),
      (advanced.state.positionsM[bodyOffset + 1] ?? 0) -
        (advanced.state.positionsM[bhOffset + 1] ?? 0),
      (advanced.state.positionsM[bodyOffset + 2] ?? 0) -
        (advanced.state.positionsM[bhOffset + 2] ?? 0),
    );
    expect(finalRadiusM / orbitalRadiusM).toBeCloseTo(1, 3);
    expect(advanced.state.outcomeCodes[0]).toBe(0);
    expect(Math.abs(advanced.diagnostics.relativeEnergyDrift)).toBeLessThan(1e-5);
  });

  it('selects adaptive substeps only from a deterministic discrete set', () => {
    const coarse = selectAdaptiveSubstepSeconds('balanced', 1e14, 1e-6, 14_400);
    const close = selectAdaptiveSubstepSeconds('ultra', 1e7, 1e5, 900);
    expect(BLACK_HOLE_ALLOWED_SUBSTEPS_SECONDS).toContain(coarse);
    expect(BLACK_HOLE_ALLOWED_SUBSTEPS_SECONDS).toContain(close);
    expect(close).toBeLessThan(coarse);
    expect(selectAdaptiveSubstepSeconds('ultra', 1e7, 1e5, 900)).toBe(close);
  });

  it('is finite, deterministic, recenters locally, and leaves its input untouched', () => {
    const initial = solarSystemInitialState();
    const blackHole = {
      massSolarMasses: 8,
      initialPositionM: [35 * ASTRONOMICAL_UNIT_M, 2 * ASTRONOMICAL_UNIT_M, 0] as const,
      initialVelocityMps: [-220_000, 8_000, 0] as const,
      closestApproachTargetM: [0, 0, 0] as const,
      closestApproachTimeSeconds: 1_000_000,
      spinVisualization: 0.2,
      accretionDiskEnabled: true,
      captureRadiusMultiple: 8,
    };
    const initialized = initializeBlackHoleKernel(initial, blackHole);
    const inputPositions = initialized.state.positionsM.slice();
    const first = advanceBlackHoleKernel(initialized.state, PHYSICS_CONFIGURATION, 3_600);
    const second = advanceBlackHoleKernel(initialized.state, PHYSICS_CONFIGURATION, 3_600);
    expect(first).toEqual(second);
    expect(initialized.state.positionsM).toEqual(inputPositions);
    expect(first.diagnostics.finite).toBe(true);
    expect(first.diagnostics.completedSubsteps).toBeGreaterThan(0);
    expect(Number.isFinite(first.diagnostics.totalEnergyJ)).toBe(true);
    expect(Number.isFinite(first.diagnostics.minimumPairDistanceM)).toBe(true);
    expect([...first.state.originM]).not.toEqual([0, 0, 0]);
  });
});
