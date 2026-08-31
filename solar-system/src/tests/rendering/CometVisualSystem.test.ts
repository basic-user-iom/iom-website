import type {
  DebugBodyRenderState,
  DebugRenderFrame,
} from '../../rendering/RenderContext';
import type { CometTailSample } from '../../rendering/comets/CometTailDynamics';
import {
  CometVisualSystem,
  type CometFrameState,
  type CometVisualProfile,
} from '../../rendering/comets/CometVisualSystem';

const BODY_ID = '67p-fixture';
const EPOCH_JD_TDB = 2_460_000;
const PROFILE: Readonly<CometVisualProfile> = Object.freeze({
  bodyId: BODY_ID,
  nucleusColor: '#393531',
  dustColor: '#d9b98c',
  ionColor: '#6dc8f6',
  nucleusElongation: Object.freeze([1.35, 0.74, 0.72] as const),
  activity: Object.freeze({
    onsetDistanceAu: 4,
    peakDistanceAu: 1,
    comaRadiusKm: 50_000,
    ionTailLengthAu: 0.3,
    dustTailAgeDays: 90,
    dustRadiationPressureBeta: 0.08,
    dustEjectionSpeedMps: 35,
    deterministicSeed: 0x675036,
  }),
});

describe('CometVisualSystem', () => {
  it('creates layered irregular comet visuals and updates tails, diagnostics, and visibility', () => {
    const system = new CometVisualSystem([PROFILE]);
    const comet = body(true);
    const visual = system.create(comet);

    expect(visual.root.children).toEqual(
      expect.arrayContaining([
        visual.nucleus,
        visual.coma,
        visual.innerComa,
        visual.ionCore,
        visual.dustSpine,
        visual.ionTail,
        visual.dustTail,
      ]),
    );
    expect(visual.coma).not.toBe(visual.innerComa);
    expect(visual.coma.material).not.toBe(visual.innerComa.material);
    expect(visual.ionTail).not.toBe(visual.dustTail);
    expect(visual.ionTail.geometry).not.toBe(visual.dustTail.geometry);
    expect(visual.ionTail.material).not.toBe(visual.dustTail.material);
    expect(visual.ionPositionAttribute).not.toBe(visual.dustPositionAttribute);
    expect(visual.coma.material.name).toBe('soft-optically-thin-comet-coma');
    expect(visual.coma.material.fragmentShader).toContain('radialDensity');
    expect(visual.ionTail.material.fragmentShader).toContain('gl_PointCoord');
    expect(visual.ionCore.material.name).toBe('continuous-tapered-comet-ion-ribbon');
    expect(visual.dustSpine.material.name).toBe('continuous-tapered-comet-dust-ribbon');

    const nucleusPositions = visual.nucleus.geometry.getAttribute('position');
    const nucleusRadii = Array.from({ length: nucleusPositions.count }, (_, index) =>
      Math.hypot(
        nucleusPositions.getX(index),
        nucleusPositions.getY(index),
        nucleusPositions.getZ(index),
      ),
    );
    expect(nucleusRadii.every(Number.isFinite)).toBe(true);
    expect(Math.max(...nucleusRadii) - Math.min(...nucleusRadii)).toBeGreaterThan(0.1);

    const activeState = state(0.64, {
      trustedEphemeris: false,
      approximationWarning: 'Fixture long-range approximation warning.',
    });
    system.updateFrame(frame([comet]), [activeState], 1_000_000, () => 2);

    expect(visual.nucleus.scale.toArray()).toEqual([2.7, 1.48, 1.44]);
    expect(visual.coma.scale.x).toBeGreaterThan(visual.innerComa.scale.x);
    expect(visual.innerComa.scale.x).toBeGreaterThan(visual.nucleus.scale.x);
    expect(visual.coma.scale.x).toBe(visual.coma.scale.y);
    expect(visual.innerComa.scale.x).toBe(visual.innerComa.scale.z);
    expect(visual.ionTail.visible).toBe(true);
    expect(visual.dustTail.visible).toBe(true);
    expect(visual.ionTail.geometry.drawRange.count).toBe(3);
    expect(visual.dustTail.geometry.drawRange.count).toBe(8);
    expect(visual.dustSpine.geometry.drawRange.count).toBe(2);
    expect(visual.coma.material.uniforms.uOpacity?.value).toBeGreaterThan(0);

    system.setQuality('ultra');
    expect(visual.ionTail.material.uniforms.uPointSize?.value).toBe(2);

    const diagnostics = system.getDiagnostics(BODY_ID);
    expect(diagnostics).toMatchObject({
      bodyId: BODY_ID,
      activity: 0.64,
      ionPointCount: 3,
      dustPointCount: 8,
      dustHistorySpanDays: 42,
      dustCurvatureM: 875_000,
      trustedEphemeris: false,
      approximationWarning: 'Fixture long-range approximation warning.',
      comaRendering: 'soft radial density',
      tailRendering: 'continuous faded ribbons with soft particles',
    });
    const mappedIonLength = Math.sqrt(77);
    expect(diagnostics.ionDirection.x).toBeCloseTo(4 / mappedIonLength, 6);
    expect(diagnostics.ionDirection.y).toBeCloseTo(6 / mappedIonLength, 6);
    expect(diagnostics.ionDirection.z).toBeCloseTo(-5 / mappedIonLength, 6);

    system.updateFrame(frame([comet]), [state(0.015)], 1_000_000, () => 2);
    expect(visual.root.visible).toBe(true);
    expect(visual.ionTail.visible).toBe(true);
    expect(visual.dustTail.visible).toBe(false);
    expect(system.getDiagnostics(BODY_ID)).toMatchObject({
      activity: 0.015,
      trustedEphemeris: true,
      approximationWarning: null,
    });

    system.updateFrame(frame([]), [], 1_000_000, () => 2);
    expect(visual.root.visible).toBe(false);

    system.dispose();
  });
});

function body(visible: boolean): DebugBodyRenderState {
  return Object.freeze({
    bodyId: BODY_ID,
    displayName: '67P fixture',
    kind: 'comet' as const,
    meanRadiusM: 2_000,
    positionM: Object.freeze({ x: 150_000_000_000, y: 0, z: 0 }),
    velocityMps: Object.freeze({ x: 0, y: 29_000, z: 0 }),
    visible,
  });
}

function frame(bodies: readonly DebugBodyRenderState[]): DebugRenderFrame {
  return Object.freeze({
    currentJdTdb: EPOCH_JD_TDB,
    originM: Object.freeze({ x: 0, y: 0, z: 0 }),
    originRevision: 0,
    bodies,
    trails: [],
  });
}

function state(
  activity: number,
  overrides: Partial<Pick<CometFrameState, 'trustedEphemeris' | 'approximationWarning'>> = {},
): Readonly<CometFrameState> {
  return Object.freeze({
    bodyId: BODY_ID,
    tail: tail(activity),
    trustedEphemeris: overrides.trustedEphemeris ?? true,
    approximationWarning: overrides.approximationWarning ?? null,
  });
}

function tail(activity: number): Readonly<CometTailSample> {
  return Object.freeze({
    bodyId: BODY_ID,
    jdTdb: EPOCH_JD_TDB,
    heliocentricDistanceM: 150_000_000_000,
    activity,
    ionDirection: Object.freeze({ x: 1, y: 0, z: 0 }),
    ionPositionsM: new Float64Array([
      0, 0, 0,
      2_000_000, 3_000_000, 4_000_000,
      4_000_000, 5_000_000, 6_000_000,
    ]),
    dustPositionsM: new Float64Array([
      0, 0, 0,
      0, 0, 0,
      0, 0, 0,
      0, 0, 0,
      1_000_000, 2_000_000, 3_000_000,
      1_100_000, 2_100_000, 2_900_000,
      900_000, 1_900_000, 3_100_000,
      1_000_000, 2_000_000, 3_000_000,
    ]),
    dustBirthJdTdb: new Float64Array([
      EPOCH_JD_TDB,
      EPOCH_JD_TDB,
      EPOCH_JD_TDB,
      EPOCH_JD_TDB,
      EPOCH_JD_TDB - 42,
      EPOCH_JD_TDB - 42,
      EPOCH_JD_TDB - 42,
      EPOCH_JD_TDB - 42,
    ]),
    dustHistorySpanDays: 42,
    dustCurvatureM: 875_000,
  });
}
