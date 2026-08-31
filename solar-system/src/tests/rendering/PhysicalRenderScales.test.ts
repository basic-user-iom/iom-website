import { Vector3 } from 'three';

import { PresentationRenderScale } from '../../rendering/PresentationRenderScale';
import type { DebugBodyRenderState } from '../../rendering/RenderContext';
import { RenderScaleTransition } from '../../rendering/RenderScaleTransition';
import { TrueRenderScale } from '../../rendering/TrueRenderScale';

const METERS_PER_RENDER_UNIT = 1_000;

describe('physical render scales', () => {
  it('uses one exact linear conversion for true-scale positions and radii', () => {
    const scale = new TrueRenderScale(METERS_PER_RENDER_UNIT);
    const earth = createBody('earth', 'planet', 100);
    const position = scale.mapPosition(
      new Vector3(),
      { x: 5_000, y: 4_000, z: 3_000 },
      { x: 1_000, y: 1_000, z: 1_000 },
    );

    // Ecliptic +Z is Three +Y and ecliptic +Y is Three -Z.
    expect(position.toArray()).toEqual([4, 2, -3]);
    expect(scale.radiusFor(earth)).toBe(0.1);
    expect(scale.mode).toBe('true');
    expect(scale.radiiAreExaggerated).toBe(false);
    expect(scale.presentationWarningRequired).toBe(false);
  });

  it('keeps positions linear while applying declared kind-specific radius factors', () => {
    const scale = new PresentationRenderScale({
      metersPerRenderUnit: METERS_PER_RENDER_UNIT,
      radiusExaggeration: { star: 2, planet: 5, moon: 8 },
      radiusExaggerationByBody: { earth: 5, moon: 8 },
      minimumOverviewRadiusWorld: 0.003,
    });
    const trueScale = new TrueRenderScale(METERS_PER_RENDER_UNIT);
    const positionM = { x: 12_000, y: -3_000, z: 8_000 };
    const originM = { x: 2_000, y: 1_000, z: 3_000 };

    expect(scale.mapPosition(new Vector3(), positionM, originM).toArray()).toEqual(
      trueScale.mapPosition(new Vector3(), positionM, originM).toArray(),
    );
    expect(scale.radiusFor(createBody('sun', 'star', 100))).toBe(0.2);
    expect(scale.radiusFor(createBody('earth', 'planet', 100))).toBe(0.5);
    expect(scale.radiusFor(createBody('moon', 'moon', 100))).toBe(0.8);
    expect(scale.mode).toBe('presentation');
    expect(scale.presentationWarningRequired).toBe(true);
    expect(scale.minimumOverviewRadiusWorld).toBe(0.003);
  });

  it('keeps default Earth and Moon presentation spheres separate without moving them', () => {
    const scale = new PresentationRenderScale();
    const earth = createBody('earth', 'planet', 6_371_008.4);
    const moon = createBody('moon', 'moon', 1_737_400);
    const minimumBundledSeparationM = 350_840_940;
    const combinedPresentationRadiusM =
      (scale.radiusFor(earth) + scale.radiusFor(moon)) * scale.metersPerRenderUnit;

    expect(scale.radiusExaggerationByBody).toMatchObject({ earth: 40, moon: 40 });
    expect(combinedPresentationRadiusM).toBeLessThan(minimumBundledSeparationM);
    expect(scale.mapPosition(new Vector3(), moon.positionM, earth.positionM).toArray()).toEqual(
      new TrueRenderScale().mapPosition(new Vector3(), moon.positionM, earth.positionM).toArray(),
    );
  });

  it('rejects invalid physical-scale inputs instead of hiding bad catalog data', () => {
    expect(() => new TrueRenderScale(0)).toThrow(RangeError);
    expect(
      () =>
        new PresentationRenderScale({
          radiusExaggeration: { planet: 1 },
        }),
    ).toThrow(RangeError);
    expect(
      () =>
        new PresentationRenderScale({
          radiusExaggerationByBody: { moon: Number.NaN },
        }),
    ).toThrow(RangeError);
    expect(() =>
      new TrueRenderScale().radiusFor(createBody('earth', 'planet', Number.NaN)),
    ).toThrow(RangeError);
  });
});

describe('RenderScaleTransition', () => {
  it('smoothly blends radii and exposes selected-mode semantics', () => {
    const trueScale = new TrueRenderScale(METERS_PER_RENDER_UNIT);
    const presentationScale = new PresentationRenderScale({
      metersPerRenderUnit: METERS_PER_RENDER_UNIT,
      radiusExaggeration: { star: 5, planet: 5, moon: 5 },
    });
    const transition = new RenderScaleTransition(trueScale, presentationScale, {
      durationSeconds: 1,
    });
    const earth = createBody('earth', 'planet', 100);

    expect(transition.radiusFor(earth)).toBe(0.1);
    transition.setMode('presentation');
    expect(transition.mode).toBe('presentation');
    expect(transition.presentationWarningRequired).toBe(true);
    expect(transition.presentationMix).toBe(0);

    transition.advance(0.25);
    expect(transition.presentationMix).toBeCloseTo(0.15625, 12);
    expect(transition.radiusFor(earth)).toBeCloseTo(0.1625, 12);
    transition.advance(0.75);
    expect(transition.presentationMix).toBe(1);
    expect(transition.radiusFor(earth)).toBe(0.5);
    expect(transition.isTransitioning).toBe(false);
  });

  it('keeps the warning through an outgoing blend and supports continuous reversal', () => {
    const transition = new RenderScaleTransition(
      new TrueRenderScale(METERS_PER_RENDER_UNIT),
      new PresentationRenderScale({
        metersPerRenderUnit: METERS_PER_RENDER_UNIT,
        radiusExaggeration: { star: 3, planet: 3, moon: 3 },
      }),
      { durationSeconds: 2 },
    );
    const earth = createBody('earth', 'planet', 100);

    transition.setMode('presentation');
    transition.advance(1);
    const midpointRadius = transition.radiusFor(earth);
    transition.setMode('true');
    expect(transition.mode).toBe('true');
    expect(transition.presentationWarningRequired).toBe(true);
    expect(transition.radiusFor(earth)).toBe(midpointRadius);

    transition.advance(1);
    expect(transition.presentationMix).toBe(0);
    expect(transition.presentationWarningRequired).toBe(false);
    expect(transition.radiiAreExaggerated).toBe(false);
  });

  it('can switch immediately for reduced-motion callers', () => {
    const transition = new RenderScaleTransition(
      new TrueRenderScale(),
      new PresentationRenderScale(),
    );

    transition.setMode('presentation', true);
    expect(transition.presentationMix).toBe(1);
    transition.setMode('true', true);
    expect(transition.presentationMix).toBe(0);
    expect(transition.presentationWarningRequired).toBe(false);
    expect(() => transition.advance(-1)).toThrow(RangeError);
  });

  it('requires one shared linear orbit-distance scale to prevent camera teleportation', () => {
    expect(
      () =>
        new RenderScaleTransition(
          new TrueRenderScale(1_000),
          new PresentationRenderScale({ metersPerRenderUnit: 2_000 }),
        ),
    ).toThrow('one orbit-distance conversion');
  });
});

function createBody(
  bodyId: string,
  kind: DebugBodyRenderState['kind'],
  meanRadiusM: number,
): DebugBodyRenderState {
  return {
    bodyId,
    displayName: bodyId,
    kind,
    meanRadiusM,
    positionM: { x: 0, y: 0, z: 0 },
    velocityMps: { x: 0, y: 0, z: 0 },
    visible: true,
  };
}
