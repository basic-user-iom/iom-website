import { Group, Points } from 'three';

import {
  BlackHoleVisualSystem,
  validateBlackHoleRenderState,
  type BlackHoleRenderState,
  type BlackHoleVisualFrame,
} from '../../rendering/black-hole';

describe('BlackHoleVisualSystem', () => {
  it('separates the physical Schwarzschild radius from robust visual framing', () => {
    const system = new BlackHoleVisualSystem('high');
    const earth = new Group();
    system.attachBody('earth', earth);
    system.update(visualFrame());

    expect(system.root.position.toArray()).toEqual([4, -2, 1]);
    expect(system.getDiagnostics()).toMatchObject({
      active: true,
      mode: 'physics-flyby',
      stage: 'closest-approach',
      eventHorizonRadiusRenderUnits: 0.02,
      visualRadiusRenderUnits: 0.24,
      presentationRadiusExaggerated: true,
      accretionDiskVisible: true,
      capturedBodyCount: 1,
      disruptedBodyCount: 2,
      baseBodyOverrideCount: 2,
      finite: true,
    });
    expect(system.getDiagnostics().streamPointCount).toBeGreaterThan(0);
    expect(system.getProtectiveExposureCeiling()).toBe(0.68);
    // The visual layer owns an overlay only; renderer-controlled base body
    // position/visibility is not mutated here and is therefore safe to restore.
    expect(earth.visible).toBe(true);
    expect(earth.position.toArray()).toEqual([0, 0, 0]);

    system.reset();
    system.reset();
    expect(system.getDiagnostics()).toMatchObject({
      active: false,
      mode: 'none',
      stage: 'idle',
      streamPointCount: 0,
      baseBodyOverrideCount: 0,
    });
    expect(system.getProtectiveExposureCeiling()).toBeNull();
    system.dispose();
    system.dispose();
  });

  it('replays disruption streams deterministically and applies real quality budgets', () => {
    const system = new BlackHoleVisualSystem('high');
    const state = visualFrame();
    system.update(state);
    const firstCount = system.getDiagnostics().streamPointCount;
    const first = streamPositions(system, firstCount);

    system.reset();
    system.update(state);
    expect(system.getDiagnostics().streamPointCount).toBe(firstCount);
    expect(streamPositions(system, firstCount)).toEqual(first);

    system.setQuality('low');
    system.update(state);
    expect(system.getDiagnostics().streamPointCount).toBeLessThan(firstCount);
    system.setReducedMotion(true);
    system.update(state);
    expect(system.getDiagnostics().streamPointCount).toBeLessThan(firstCount / 2);
    system.dispose();
  });

  it('rejects invalid visual frames before they can reach GPU matrices', () => {
    const system = new BlackHoleVisualSystem();
    expect(() => system.update(visualFrame({
      positionRenderUnits: [Number.NaN, 0, 0],
    }))).toThrow(/render position/i);
    expect(() => system.update(visualFrame({
      eventHorizonRadiusRenderUnits: Number.POSITIVE_INFINITY,
    }))).toThrow(/event-horizon/i);
    expect(() => system.update(visualFrame({ spinVisualization: 1.1 })))
      .toThrow(/spin/i);
    system.dispose();
  });
});

describe('black-hole render-state validation', () => {
  it('accepts signed spin and exact core capture-state vocabulary', () => {
    expect(() => validateBlackHoleRenderState(renderState())).not.toThrow();
    expect(() => validateBlackHoleRenderState(renderState({
      blackHole: { ...renderState().blackHole, spinVisualization: -1 },
    }))).not.toThrow();
  });

  it('keeps physics and cinematic stages mutually exclusive', () => {
    expect(() => validateBlackHoleRenderState(renderState({
      mode: 'physics-flyby',
      stage: 'consumption',
    }))).toThrow(/does not belong/i);
    expect(() => validateBlackHoleRenderState(renderState({
      mode: 'complete-consumption-cinematic',
      stage: 'closest-approach',
    }))).toThrow(/does not belong/i);
  });

  it('rejects singular/NaN inputs and capture radii inside the horizon', () => {
    expect(() => validateBlackHoleRenderState(renderState({
      blackHole: {
        ...renderState().blackHole,
        captureRadiusM: 10,
        schwarzschildRadiusM: 20,
      },
    }))).toThrow(/capture radius/i);
    expect(() => validateBlackHoleRenderState(renderState({
      scenarioOriginM: [0, Number.NaN, 0],
    }))).toThrow(/scenario origin/i);
  });
});

function streamPositions(
  system: BlackHoleVisualSystem,
  count: number,
): readonly number[] {
  const streams = system.root.getObjectByName(
    'black-hole-deterministic-accretion-streams',
  );
  expect(streams).toBeInstanceOf(Points);
  const attribute = (streams as Points).geometry.getAttribute('position');
  return Array.from(attribute.array).slice(0, count * 3);
}

function visualFrame(
  overrides: Partial<BlackHoleVisualFrame> = {},
): Readonly<BlackHoleVisualFrame> {
  return {
    lifecycleState: 'running',
    mode: 'physics-flyby',
    stage: 'closest-approach',
    scenarioTimeSeconds: 12,
    progress: 0.5,
    runSignature: 'phase10-render-replay',
    positionRenderUnits: [4, -2, 1],
    eventHorizonRadiusRenderUnits: 0.02,
    minimumVisualRadiusRenderUnits: 0.24,
    accretionDiskEnabled: true,
    spinVisualization: -0.65,
    bodies: [
      {
        bodyId: 'earth',
        positionRenderUnits: [7, 0, 1],
        radiusRenderUnits: 0.1,
        outcome: 'accretion-stream',
        tidalStress: 0.8,
        streamProgress: 0.72,
        captureProgress: 0.34,
      },
      {
        bodyId: 'mars',
        positionRenderUnits: [9, 1, 0],
        radiusRenderUnits: 0.07,
        outcome: 'captured',
        tidalStress: 1.4,
        streamProgress: 1,
        captureProgress: 1,
      },
    ],
    ...overrides,
  };
}

function renderState(
  overrides: Partial<BlackHoleRenderState> = {},
): Readonly<BlackHoleRenderState> {
  return {
    lifecycleState: 'running',
    mode: 'physics-flyby',
    stage: 'closest-approach',
    scenarioTimeSeconds: 12,
    progress: 0.5,
    scenarioOriginM: [0, 0, 0],
    scenarioOriginVelocityMps: [0, 0, 0],
    blackHole: {
      massKg: 1.98847e31,
      massSolarMasses: 10,
      schwarzschildRadiusM: 29_533.4,
      captureRadiusM: 88_600.2,
      positionLocalM: [4e11, 0, 0],
      velocityLocalMps: [-12_000, 0, 0],
      spinVisualization: -0.65,
      accretionDiskEnabled: true,
    },
    bodyStates: [
      {
        bodyId: 'earth',
        massKg: 5.9722e24,
        radiusM: 6_371_008.4,
        positionLocalM: [1.5e11, 0, 0],
        velocityLocalMps: [0, 29_780, 0],
        outcome: 'tidally-stressed',
        tidalStress: 0.4,
        streamProgress: 0,
        captureProgress: 0,
      },
    ],
    runSignature: 'phase10-render-state',
    ...overrides,
  };
}
