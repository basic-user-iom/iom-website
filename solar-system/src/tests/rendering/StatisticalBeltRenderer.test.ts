import { Points, ShaderMaterial } from 'three';

import {
  DEFAULT_BELT_PROFILES,
  StatisticalBeltRenderer,
  createStatisticalBeltDistribution,
  solveEccentricAnomaly,
  type StatisticalBeltId,
  type StatisticalBeltProfile,
} from '../../rendering/belts/StatisticalBeltRenderer';
import { ASTRONOMICAL_UNIT_M } from '../../simulation/core/Units';

const ASTEROID_PROFILE: StatisticalBeltProfile = Object.freeze({
  id: 'asteroid-belt',
  label: 'Asteroid belt — statistical visualization',
  innerRadiusAu: 2.08,
  outerRadiusAu: 3.32,
  maximumEccentricity: 0.18,
  maximumInclinationDeg: 18,
  deterministicSeed: 12345,
  color: '#766b60',
  colorPalette: Object.freeze(['#675f58', '#806e5f']),
  markerSizePx: 1.25,
  maximumMarkerSizePx: 2.2,
  qualityCounts: Object.freeze({ low: 8, medium: 12, high: 16, ultra: 24 }),
  excludedNamedBodies: Object.freeze(['ceres']),
});

const KUIPER_PROFILE: StatisticalBeltProfile = Object.freeze({
  id: 'kuiper-belt',
  label: 'Kuiper belt — statistical visualization',
  innerRadiusAu: 30,
  outerRadiusAu: 50,
  maximumEccentricity: 0.24,
  maximumInclinationDeg: 28,
  deterministicSeed: 67890,
  color: '#746966',
  colorPalette: Object.freeze(['#686464', '#8a7068']),
  markerSizePx: 1.15,
  maximumMarkerSizePx: 2,
  qualityCounts: Object.freeze({ low: 6, medium: 10, high: 14, ultra: 20 }),
  excludedNamedBodies: Object.freeze(['pluto']),
});

describe('StatisticalBeltRenderer', () => {
  it('creates deterministic finite orbital samples and solves Kepler exactly', () => {
    const first = createStatisticalBeltDistribution(ASTEROID_PROFILE, 512);
    const replay = createStatisticalBeltDistribution(ASTEROID_PROFILE, 512);

    expect(first).toEqual(replay);
    expect(first).toHaveLength(512);
    let maximumKeplerResidual = 0;
    for (const particle of first) {
      expect([
        particle.xM,
        particle.yM,
        particle.zM,
        particle.radiusAu,
        particle.semimajorAxisAu,
      ].every(Number.isFinite)).toBe(true);
      expect(particle.semimajorAxisAu).toBeGreaterThanOrEqual(ASTEROID_PROFILE.innerRadiusAu);
      expect(particle.semimajorAxisAu).toBeLessThanOrEqual(ASTEROID_PROFILE.outerRadiusAu);
      expect(particle.eccentricity).toBeGreaterThanOrEqual(0);
      expect(particle.eccentricity).toBeLessThanOrEqual(ASTEROID_PROFILE.maximumEccentricity);
      expect(particle.orbitalInclinationDeg).toBeGreaterThanOrEqual(0);
      expect(particle.orbitalInclinationDeg)
        .toBeLessThanOrEqual(ASTEROID_PROFILE.maximumInclinationDeg);
      expect(particle.inclinationDeg).toBe(particle.orbitalInclinationDeg);
      expect(Math.abs(particle.eclipticLatitudeDeg))
        .toBeLessThanOrEqual(particle.orbitalInclinationDeg + 1e-10);
      const keplerResidual = Math.abs(
        particle.eccentricAnomalyRad -
        particle.eccentricity * Math.sin(particle.eccentricAnomalyRad) -
        particle.meanAnomalyRad,
      );
      maximumKeplerResidual = Math.max(maximumKeplerResidual, keplerResidual);
      expect(particle.radiusAu).toBeCloseTo(
        particle.semimajorAxisAu *
          (1 - particle.eccentricity * Math.cos(particle.eccentricAnomalyRad)),
        11,
      );
    }
    expect(maximumKeplerResidual).toBeLessThan(1e-11);
    expect(solveEccentricAnomaly(1.7, 0.24) - 0.24 * Math.sin(
      solveEccentricAnomaly(1.7, 0.24),
    )).toBeCloseTo(1.7, 12);
  });

  it('retains deterministic main-belt gaps and distinct Kuiper populations', () => {
    const asteroids = createStatisticalBeltDistribution(defaultProfile('asteroid-belt'), 24_000);
    const gapCount = countSemimajorBin(asteroids, 2.96, 0.010);
    const adjacentCount = (
      countSemimajorBin(asteroids, 2.925, 0.010) +
      countSemimajorBin(asteroids, 2.995, 0.010)
    ) / 2;
    expect(gapCount).toBeLessThan(adjacentCount * 0.45);
    expect(new Set(asteroids.map((particle) => particle.population))).toEqual(new Set([
      'asteroid-inner',
      'asteroid-middle',
      'asteroid-outer',
      'asteroid-family',
    ]));

    const kuiper = createStatisticalBeltDistribution(defaultProfile('kuiper-belt'), 16_000);
    const populations = new Set(kuiper.map((particle) => particle.population));
    expect(populations).toEqual(new Set([
      'kuiper-resonant',
      'kuiper-cold-classical',
      'kuiper-hot-classical',
      'kuiper-outer',
    ]));
    const cold = kuiper.filter((particle) => particle.population === 'kuiper-cold-classical');
    const hot = kuiper.filter((particle) => particle.population === 'kuiper-hot-classical');
    expect(mean(cold.map((particle) => particle.orbitalInclinationDeg)))
      .toBeLessThan(mean(hot.map((particle) => particle.orbitalInclinationDeg)) * 0.4);
    expect(cold.every((particle) =>
      particle.semimajorAxisAu >= 42 && particle.semimajorAxisAu <= 47,
    )).toBe(true);
  });

  it('uses capped soft density points while preserving counts, visibility, and disclosure', () => {
    const renderer = new StatisticalBeltRenderer(
      [ASTEROID_PROFILE, KUIPER_PROFILE],
      'high',
    );

    expect(renderer.getDiagnostics()).toEqual({
      asteroidVisible: true,
      kuiperVisible: false,
      asteroidInstanceCount: 16,
      kuiperInstanceCount: 0,
      label: 'Statistical visualization',
    });
    const asteroidPoints = renderer.root.getObjectByName('asteroid-belt-statistical-instances');
    expect(asteroidPoints).toBeInstanceOf(Points);
    expect((asteroidPoints as Points).material).toBeInstanceOf(ShaderMaterial);
    const material = (asteroidPoints as Points).material as ShaderMaterial;
    expect(material.fragmentShader).toContain('gl_PointCoord');
    expect(material.fragmentShader).toContain('discard');
    expect(material.vertexShader).toContain('min(uMarkerCapPx');
    expect(material.depthWrite).toBe(false);
    expect(material.toneMapped).toBe(true);
    const metrics = renderer.getVisualMetrics('asteroid-belt');
    expect(metrics.maximumRenderedMarkerPx).toBeLessThanOrEqual(metrics.maximumMarkerSizePx);
    expect(metrics.maximumMarkerSizePx).toBe(2.2);

    renderer.setVisible('kuiper-belt', true);
    renderer.setSunRenderPosition(1, 2, 3);
    expect(renderer.root.position.toArray()).toEqual([1, 2, 3]);
    expect(renderer.getDiagnostics()).toMatchObject({
      asteroidInstanceCount: 16,
      kuiperInstanceCount: 14,
      kuiperVisible: true,
    });

    renderer.dispose();
    expect(() => renderer.setSunRenderPosition(0, 0, 0)).toThrow(/disposed/);
  });

  it('normalizes aggregate point weight across quality tiers without exceeding marker caps', () => {
    const renderer = new StatisticalBeltRenderer(undefined, 'low');
    for (const id of ['asteroid-belt', 'kuiper-belt'] as const) {
      const metrics = (['low', 'medium', 'high', 'ultra'] as const).map((quality) => {
        renderer.setQuality(quality);
        return renderer.getVisualMetrics(id);
      });
      const referenceWeight = metrics[metrics.length - 1]?.integratedWeight ?? 0;
      expect(referenceWeight).toBeGreaterThan(0);
      for (const tier of metrics) {
        expect(tier.maximumRenderedMarkerPx).toBeLessThanOrEqual(
          tier.maximumMarkerSizePx + 1e-12,
        );
        expect(tier.opacity).toBeGreaterThan(0);
        expect(tier.opacity).toBeLessThanOrEqual(0.72);
        expect(tier.integratedWeight).toBeCloseTo(referenceWeight, 8);
      }
      expect(metrics.map((tier) => tier.sampleCount)).toEqual(
        id === 'asteroid-belt'
          ? [900, 1_800, 3_600, 6_400]
          : [700, 1_400, 2_800, 4_800],
      );
    }
    renderer.dispose();
  });

  it('remaps the unchanged physical distribution for a custom render scale', () => {
    const renderer = new StatisticalBeltRenderer(
      [ASTEROID_PROFILE, KUIPER_PROFILE],
      'high',
      ASTRONOMICAL_UNIT_M,
    );
    const beforeParticles = renderer.getParticles('asteroid-belt');
    const beforeLength = firstRenderedPositionLength(renderer, 'asteroid-belt');

    renderer.setMetersPerRenderUnit(ASTRONOMICAL_UNIT_M * 2);

    expect(renderer.getMetersPerRenderUnit()).toBe(ASTRONOMICAL_UNIT_M * 2);
    expect(firstRenderedPositionLength(renderer, 'asteroid-belt')).toBeCloseTo(beforeLength / 2, 6);
    expect(renderer.getParticles('asteroid-belt')).toBe(beforeParticles);
    expect(() => renderer.setMetersPerRenderUnit(0)).toThrow(/positive and finite/i);
    renderer.dispose();
  });
});

function defaultProfile(id: StatisticalBeltId): Readonly<StatisticalBeltProfile> {
  const profile = DEFAULT_BELT_PROFILES.find((candidate) => candidate.id === id);
  if (profile === undefined) throw new Error(`Missing default profile ${id}.`);
  return profile;
}

function countSemimajorBin(
  particles: readonly { readonly semimajorAxisAu: number }[],
  centerAu: number,
  halfWidthAu: number,
): number {
  return particles.filter((particle) =>
    Math.abs(particle.semimajorAxisAu - centerAu) < halfWidthAu,
  ).length;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function firstRenderedPositionLength(
  renderer: StatisticalBeltRenderer,
  id: StatisticalBeltId,
): number {
  const points = renderer.root.getObjectByName(`${id}-statistical-instances`) as Points | undefined;
  if (points === undefined) throw new Error(`Missing point layer ${id}.`);
  const position = points.geometry.getAttribute('position');
  return Math.hypot(position.getX(0), position.getY(0), position.getZ(0));
}
