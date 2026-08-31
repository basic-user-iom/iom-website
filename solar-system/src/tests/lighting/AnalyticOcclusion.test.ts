import {
  angularDiscOccludedFraction,
  createAnalyticSphereOcclusionSample,
  sampleAnalyticSphereOcclusion,
} from '../../simulation/lighting/AnalyticOcclusion';
import { createVec3d } from '../../simulation/core/Vec3d';

describe('angular-disc overlap', () => {
  it('handles disjoint, tangent, centered annular, and total discs', () => {
    expect(angularDiscOccludedFraction(1, 1, 3)).toBe(0);
    expect(angularDiscOccludedFraction(1, 1, 2)).toBe(0);
    expect(angularDiscOccludedFraction(1, 0.5, 0)).toBe(0.25);
    expect(angularDiscOccludedFraction(1, 2, 0)).toBe(1);
  });

  it('matches the closed-form partial overlap for equal discs', () => {
    const expected = (2 * Math.PI / 3 - Math.sqrt(3) / 2) / Math.PI;
    expect(angularDiscOccludedFraction(1, 1, 1)).toBeCloseTo(expected, 14);
  });

  it('stays finite and clamped near overlap boundaries', () => {
    const cases = [
      [1, 1, 1e-15],
      [1, 1, 0.5],
      [1, 1, 1.999_999_999_999],
      [1, 1, 2],
      [Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE],
      [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE],
    ] as const;
    for (const [lightRadius, occultorRadius, separation] of cases) {
      const fraction = angularDiscOccludedFraction(
        lightRadius,
        occultorRadius,
        separation,
      );
      expect(Number.isFinite(fraction)).toBe(true);
      expect(fraction).toBeGreaterThanOrEqual(0);
      expect(fraction).toBeLessThanOrEqual(1);
    }
  });
});

describe('analytic spherical occlusion sampling', () => {
  const observer = createVec3d();
  const light = createVec3d(100, 0, 0);

  it('distinguishes total, annular, partial, and background occultors', () => {
    const total = sampleAnalyticSphereOcclusion(
      createAnalyticSphereOcclusionSample(),
      observer,
      light,
      10,
      createVec3d(50, 0, 0),
      6,
    );
    expect(total.kind).toBe('total');
    expect(total.occludedFraction).toBe(1);
    expect(total.visibleFraction).toBe(0);
    expect(total.occultorInFront).toBe(true);

    const annular = sampleAnalyticSphereOcclusion(
      createAnalyticSphereOcclusionSample(),
      observer,
      light,
      10,
      createVec3d(50, 0, 0),
      2,
    );
    expect(annular.kind).toBe('annular');
    expect(annular.occludedFraction).toBeGreaterThan(0);
    expect(annular.occludedFraction).toBeLessThan(1);

    const offsetRad = 0.08;
    const partial = sampleAnalyticSphereOcclusion(
      createAnalyticSphereOcclusionSample(),
      observer,
      light,
      10,
      createVec3d(50 * Math.cos(offsetRad), 50 * Math.sin(offsetRad), 0),
      4,
    );
    expect(partial.kind).toBe('partial');
    expect(partial.occludedFraction).toBeGreaterThan(0);
    expect(partial.occludedFraction).toBeLessThan(1);

    const background = sampleAnalyticSphereOcclusion(
      createAnalyticSphereOcclusionSample(),
      observer,
      light,
      10,
      createVec3d(200, 0, 0),
      50,
    );
    expect(background.kind).toBe('none');
    expect(background.occultorInFront).toBe(false);
    expect(background.occludedFraction).toBe(0);
    expect(background.visibleFraction).toBe(1);
  });

  it('returns a finite total eclipse when the observer is inside the occultor', () => {
    const out = createAnalyticSphereOcclusionSample();
    const returned = sampleAnalyticSphereOcclusion(
      out,
      observer,
      light,
      10,
      observer,
      1,
    );

    expect(returned).toBe(out);
    expect(out.occultorAngularRadiusRad).toBe(Math.PI);
    expect(out.angularSeparationRad).toBe(0);
    expect(out.kind).toBe('total');
    expect(out.occludedFraction).toBe(1);
    expect(Number.isFinite(out.visibleFraction)).toBe(true);
  });

  it('rejects invalid radii and coincident observer/light positions', () => {
    expect(() => angularDiscOccludedFraction(0, 1, 0)).toThrow(/positive/);
    expect(() => sampleAnalyticSphereOcclusion(
      createAnalyticSphereOcclusionSample(),
      observer,
      observer,
      1,
      createVec3d(2, 0, 0),
      1,
    )).toThrow(/distinct/);
    expect(() => sampleAnalyticSphereOcclusion(
      createAnalyticSphereOcclusionSample(),
      observer,
      light,
      1,
      createVec3d(2, 0, 0),
      -1,
    )).toThrow(/non-negative/);
  });
});
