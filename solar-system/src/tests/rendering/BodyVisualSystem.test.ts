import { DoubleSide, SphereGeometry, type DataTexture, type ShaderMaterial } from 'three';

import { PhaseFourBodyVisualSystem } from '../../rendering/bodies/BodyVisualSystem';
import {
  getGiantAtmosphereProfile,
  getRingSystemProfile,
} from '../../rendering/bodies/GiantPlanetProfiles';
import type {
  DebugBodyRenderState,
  DebugRenderFrame,
} from '../../rendering/RenderContext';

describe('PhaseFourBodyVisualSystem shell contracts', () => {
  it('uses strictly tiered shared sphere LOD without reallocating on switches', () => {
    const geometry = new SphereGeometry(1, 96, 64);
    const system = new PhaseFourBodyVisualSystem(geometry, {
      maximumAnisotropy: 1,
      initialQuality: 'low',
    });
    const earth = system.create(body('earth'));
    const counts: number[] = [];

    for (const quality of ['low', 'medium', 'high', 'ultra'] as const) {
      system.setQuality(quality);
      counts.push(earth.surface.geometry.getAttribute('position').count);
      expect(system.getDiagnostics('earth').selectedSurfaceVertexCount).toBe(
        earth.surface.geometry.getAttribute('position').count,
      );
    }

    expect(counts[1]).toBeGreaterThan(counts[0] ?? 0);
    expect(counts[2]).toBeGreaterThan(counts[1] ?? 0);
    expect(counts[3]).toBeGreaterThan(counts[2] ?? 0);
    system.dispose();
    geometry.dispose();
  });

  it('keeps an opaque Venus depth core beneath the default layered clouds', () => {
    const geometry = new SphereGeometry(1, 8, 6);
    const system = new PhaseFourBodyVisualSystem(geometry, {
      maximumAnisotropy: 1,
      initialVenusSurfaceMode: 'clouds',
    });

    const venus = system.create(body('venus'));

    expect(venus.surface.visible).toBe(true);
    expect(venus.surface.material.transparent).toBe(false);
    expect(venus.surface.material.depthWrite).toBe(true);
    expect(venus.clouds?.visible).toBe(true);
    expect(venus.secondaryClouds?.visible).toBe(true);
    if (venus.clouds === null || venus.secondaryClouds === null) {
      throw new Error('Venus cloud layers must exist.');
    }
    expect(uniformNumber(venus.clouds.material, 'uOpacity')).toBeCloseTo(0.96, 12);
    expect(uniformNumber(venus.secondaryClouds.material, 'uOpacity')).toBeCloseTo(0.20, 12);
    expect(venus.clouds.material.fragmentShader).toContain('float chevrons');
    expect(venus.clouds.material.fragmentShader).toContain('uniform float uQuality');
    expect(venus.clouds.material.fragmentShader).not.toContain(
      'density = clamp(0.42 + density * 0.58',
    );

    system.setVenusSurfaceMode('radar');
    expect(venus.surface.visible).toBe(true);
    expect(venus.clouds?.visible).toBe(false);
    expect(venus.secondaryClouds?.visible).toBe(false);

    system.dispose();
    geometry.dispose();
  });

  it('quality-gates fine Sun detail and fades the corona outward without clipping rings', () => {
    const geometry = new SphereGeometry(1, 8, 6);
    const system = new PhaseFourBodyVisualSystem(geometry, {
      maximumAnisotropy: 1,
      initialQuality: 'low',
    });
    const sun = system.create(body('sun'));

    expect(uniformNumber(sun.surface.material, 'uQuality')).toBe(0);
    expect(sun.surface.material.fragmentShader).toContain('float granuleScale');
    expect(sun.surface.material.fragmentShader).toContain('float intergranularLanes');
    expect(sun.surface.material.fragmentShader).toContain(
      'observationUv = vec2(0.5) + photosphereNormal.xy * 0.472',
    );
    expect(sun.surface.material.fragmentShader).toContain(
      'smoothstep(0.08, 0.30, photosphereNormal.z)',
    );
    expect(sun.surface.material.fragmentShader).toContain(
      'float observedActiveRegion = clamp(',
    );
    expect(sun.surface.material.fragmentShader).toContain(
      'color *= 1.0 - observedActiveRegion * 0.62',
    );
    expect(sun.surface.material.fragmentShader).not.toContain(
      'color = mix(color, observedColor',
    );
    expect(sun.surface.material.fragmentShader).not.toContain(
      'uTimeDays * (0.018 + latitude * 0.006)',
    );
    expect(sun.surface.material.fragmentShader).toContain('color * 1.48');
    expect(sun.surface.material.fragmentShader).not.toContain('color * 2.15');
    expect(sun.coronaShells).toHaveLength(3);
    for (const shell of sun.coronaShells) {
      expect(shell.material.fragmentShader).toContain('float radialFade');
      expect(shell.material.fragmentShader).not.toContain('float rim =');
    }

    system.setQuality('ultra');
    expect(uniformNumber(sun.surface.material, 'uQuality')).toBe(3);

    system.dispose();
    geometry.dispose();
  });

  it('binds eclipse and inverse-square inputs to atmosphere materials', () => {
    const geometry = new SphereGeometry(1, 8, 6);
    const system = new PhaseFourBodyVisualSystem(geometry, {
      maximumAnisotropy: 1,
    });

    const earth = system.create(body('earth'));

    expect(earth.atmosphere?.material.uniforms.uOcclusion?.value).toBe(1);
    expect(earth.atmosphere?.material.uniforms.uRelativeIrradiance?.value).toBe(1);

    system.dispose();
    geometry.dispose();
  });

  it('creates oblate, data-driven giant surfaces and only attaches measured ring systems', () => {
    const geometry = new SphereGeometry(1, 8, 6);
    const system = new PhaseFourBodyVisualSystem(geometry, {
      maximumAnisotropy: 1,
    });

    const jupiter = system.create(body('jupiter'));
    expect(jupiter.surface.material.name).toBe('phase-5-jupiter-differential-atmosphere');
    expect(jupiter.rings).toHaveLength(0);
    expect(jupiter.textureBindings.get('albedo')).toEqual([jupiter.surface.material]);
    expect(jupiter.textureBindings.get('grs-detail')).toEqual([jupiter.surface.material]);
    expect(jupiter.surface.scale.x).toBeGreaterThan(jupiter.surface.scale.y);
    expect(jupiter.surface.scale.z).toBeCloseTo(jupiter.surface.scale.x, 12);
    expect(uniformNumber(jupiter.surface.material, 'uHasGreatRedSpot')).toBe(1);
    expect(uniformNumber(jupiter.surface.material, 'uHasGrsDetailMap')).toBe(0);
    expect(uniformNumber(jupiter.surface.material, 'uHasRingShadow')).toBe(0);
    expect(jupiter.surface.material.fragmentShader).toContain(
      'albedo = mix(procedural, staticMap, observedCoverage)',
    );
    expect(jupiter.surface.material.fragmentShader).not.toContain('vec2 advectedUv');
    expect(jupiter.surface.material.fragmentShader).not.toContain('internalFilaments');
    expect(jupiter.surface.material.fragmentShader).toContain(
      'texture2D(uGrsDetailMap, detailUv)',
    );
    expect(jupiter.surface.material.fragmentShader).toContain(
      'albedo = applyGreatRedSpot(albedo, angles)',
    );
    expect(jupiter.surface.material.fragmentShader).toContain(
      'float terminator = smoothstep(-0.012, 0.012, solarCosine)',
    );
    expect(jupiter.surface.material.fragmentShader).toContain(
      'albedo * (0.012 + direct * 0.988)',
    );
    expect(jupiter.surface.material.vertexShader).toContain(
      'vWorldNormal = normalize(viewNormal * mat3(viewMatrix))',
    );
    expect(jupiter.surface.material.vertexShader).not.toContain(
      'vWorldNormal = normalize(normalMatrix * normal)',
    );
    const jetTexture = uniformTexture(jupiter.surface.material, 'uJetProfile');
    expect(jetTexture.image).toMatchObject({ width: 256, height: 1 });

    for (const bodyId of ['saturn', 'uranus', 'neptune'] as const) {
      const visual = system.create(body(bodyId));
      const atmosphere = getGiantAtmosphereProfile(bodyId);
      const rings = getRingSystemProfile(bodyId);
      expect(rings).not.toBeNull();
      if (rings === null) continue;

      expect(visual.surface.material.name).toBe(
        `phase-5-${bodyId}-differential-atmosphere`,
      );
      expect(visual.surface.scale.x).toBeCloseTo(
        atmosphere.equatorialRadiusKm / atmosphere.meanRadiusKm,
        12,
      );
      expect(visual.surface.scale.y).toBeCloseTo(
        atmosphere.polarRadiusKm / atmosphere.meanRadiusKm,
        12,
      );
      expect(visual.rings).toHaveLength(1);
      expect(visual.root.children).toContain(visual.rings[0]);
      expect(visual.boundingRadiusMultiplier).toBeCloseTo(
        rings.outerRadiusKm / atmosphere.meanRadiusKm,
        12,
      );
      if (bodyId === 'saturn') {
        expect(visual.surface.scale.y / visual.surface.scale.x).toBeCloseTo(
          54_364 / 60_268,
          12,
        );
        expect(1 - visual.surface.scale.y / visual.surface.scale.x).toBeCloseTo(
          0.09796,
          4,
        );
        expect(visual.textureBindings.get('albedo')).toEqual([visual.surface.material]);
        expect(visual.surface.material.fragmentShader).toContain(
          'vec4 observedSample = texture2D(uMap, vUv)',
        );
        expect(visual.surface.material.fragmentShader).toContain(
          'observedSample.a * 0.86',
        );
      } else {
        expect(visual.textureBindings.size).toBe(0);
      }
    }

    system.dispose();
    geometry.dispose();
  });

  it('uses a one-pass premultiplied annulus with depth testing and Saturn mutual shadows', () => {
    const geometry = new SphereGeometry(1, 8, 6);
    const system = new PhaseFourBodyVisualSystem(geometry, {
      maximumAnisotropy: 1,
    });
    const saturn = system.create(body('saturn'));
    const rings = saturn.rings[0];
    expect(rings).toBeDefined();
    if (rings === undefined) return;

    expect(rings.material.name).toBe('phase-5-saturn-ring-optical-depth');
    expect(rings.material.side).toBe(DoubleSide);
    expect(rings.material.transparent).toBe(true);
    expect(rings.material.depthTest).toBe(true);
    expect(rings.material.depthWrite).toBe(false);
    expect(rings.material.premultipliedAlpha).toBe(true);
    expect(rings.material.forceSinglePass).toBe(true);
    expect(rings.frustumCulled).toBe(false);
    expect(uniformNumber(saturn.surface.material, 'uHasRingShadow')).toBe(1);
    expect(uniformTexture(saturn.surface.material, 'uRingProfile')).toBe(
      uniformTexture(rings.material, 'uRingProfile'),
    );
    expect(saturn.surface.material.fragmentShader).toContain(
      'filteredRingShadowTransmittance',
    );
    expect(saturn.surface.material.fragmentShader).toContain(
      'SATURN_SOLAR_ANGULAR_RADIUS',
    );
    expect(saturn.surface.material.fragmentShader).toContain('fwidth(radialUv)');
    expect(saturn.surface.material.fragmentShader).toContain(
      'smoothstep(0.0, 0.24',
    );
    expect(rings.material.fragmentShader).toContain('return mix(0.08, 1.0, visibility)');
    expect(rings.material.vertexShader).toContain(
      'vWorldNormal = normalize(viewNormal * mat3(viewMatrix))',
    );
    expect(rings.material.vertexShader).not.toContain(
      'vWorldNormal = normalize(normalMatrix * normal)',
    );

    const positions = rings.geometry.getAttribute('position');
    let maximumAbsoluteY = 0;
    for (let index = 0; index < positions.count; index += 1) {
      maximumAbsoluteY = Math.max(maximumAbsoluteY, Math.abs(positions.getY(index)));
    }
    expect(maximumAbsoluteY).toBeLessThan(1e-6);
    rings.geometry.computeBoundingSphere();
    expect(rings.geometry.boundingSphere?.radius).toBeCloseTo(
      saturn.boundingRadiusMultiplier,
      5,
    );
    expect(saturn.boundingRadiusMultiplier).toBeGreaterThan(2.4);

    system.dispose();
    geometry.dispose();
  });

  it('quality-gates transient Saturn spokes at high and ultra only', () => {
    const geometry = new SphereGeometry(1, 8, 6);
    const system = new PhaseFourBodyVisualSystem(geometry, {
      maximumAnisotropy: 1,
      initialQuality: 'medium',
    });
    const saturn = system.create(body('saturn'));
    const ringMaterial = saturn.rings[0]?.material;
    expect(ringMaterial).toBeDefined();
    if (ringMaterial === undefined) return;

    expect(uniformNumber(ringMaterial, 'uSpokeStrength')).toBe(0);
    expect(system.getDiagnostics('saturn').selectedSpokesEnabled).toBe(false);
    system.setQuality('high');
    expect(uniformNumber(ringMaterial, 'uSpokeStrength')).toBeCloseTo(0.18, 12);
    expect(system.getDiagnostics('saturn').selectedSpokesEnabled).toBe(true);
    expect(ringMaterial.fragmentShader).toContain('localizedFilaments');
    expect(ringMaterial.fragmentShader).not.toContain('angle * 431.0');
    system.setQuality('ultra');
    expect(uniformNumber(ringMaterial, 'uSpokeStrength')).toBeCloseTo(0.28, 12);
    system.setQuality('low');
    expect(uniformNumber(ringMaterial, 'uSpokeStrength')).toBe(0);
    expect(system.getDiagnostics('saturn').selectedSpokesEnabled).toBe(false);

    system.dispose();
    geometry.dispose();
  });

  it('propagates deterministic GRS phases and dated Neptune storm visibility per frame', () => {
    const geometry = new SphereGeometry(1, 8, 6);
    const system = new PhaseFourBodyVisualSystem(geometry, {
      maximumAnisotropy: 1,
    });
    const sun = body('sun');
    const jupiter = body('jupiter');
    const neptune = body('neptune');
    system.create(sun);
    system.create(jupiter);
    system.create(neptune);

    const greatRedSpot = getGiantAtmosphereProfile('jupiter').greatRedSpot;
    expect(greatRedSpot).toBeDefined();
    if (greatRedSpot === undefined) return;

    system.updateFrame(frame(greatRedSpot.epochJdTdb, [sun, jupiter, neptune]));
    const initial = system.getDiagnostics('jupiter');
    expect(initial.greatRedSpotLongitudeRad).toBeCloseTo(142 * Math.PI / 180, 14);
    expect(initial.greatRedSpotVortexPhaseRad).toBe(0);
    expect(initial.neptuneStormActive).toBe(false);

    system.updateFrame(frame(2_459_000, [sun, jupiter, neptune]));
    const activeStorm = system.getDiagnostics('neptune');
    expect(activeStorm.neptuneStormActive).toBe(true);
    expect(activeStorm.greatRedSpotLongitudeRad).not.toBe(0);
    expect(activeStorm.greatRedSpotVortexPhaseRad).not.toBe(0);

    const formerWrapBoundary = 2_451_545 + 4_096;
    system.updateFrame(frame(formerWrapBoundary - 0.001, [sun, jupiter, neptune]));
    const beforeBoundary = system.getDiagnostics('jupiter').atmosphereFlowTimeDays;
    system.updateFrame(frame(formerWrapBoundary + 0.001, [sun, jupiter, neptune]));
    const afterBoundary = system.getDiagnostics('jupiter').atmosphereFlowTimeDays;
    expect(afterBoundary - beforeBoundary).toBeCloseTo(0.002, 8);

    system.updateFrame(frame(2_461_041.5, [sun, jupiter, neptune]));
    expect(system.getDiagnostics('neptune').neptuneStormActive).toBe(false);

    system.dispose();
    geometry.dispose();
  });
});

type TestBodyId =
  | 'sun'
  | 'earth'
  | 'venus'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune';

const BODY_RADII_M: Readonly<Record<TestBodyId, number>> = Object.freeze({
  sun: 695_700_000,
  earth: 6_371_008.4,
  venus: 6_051_800,
  jupiter: 69_911_000,
  saturn: 58_232_000,
  uranus: 25_362_000,
  neptune: 24_622_000,
});

const BODY_DISTANCE_M: Readonly<Record<TestBodyId, number>> = Object.freeze({
  sun: 0,
  earth: 149_597_870_700,
  venus: 108_210_000_000,
  jupiter: 778_500_000_000,
  saturn: 1_434_000_000_000,
  uranus: 2_871_000_000_000,
  neptune: 4_495_000_000_000,
});

function body(bodyId: TestBodyId): DebugBodyRenderState {
  const distanceM = BODY_DISTANCE_M[bodyId];
  return Object.freeze({
    bodyId,
    displayName: bodyId[0]?.toUpperCase() + bodyId.slice(1),
    kind: bodyId === 'sun' ? 'star' : 'planet',
    meanRadiusM: BODY_RADII_M[bodyId],
    positionM: Object.freeze({
      x: distanceM,
      y: bodyId === 'neptune' ? -30_000_000_000 : distanceM * 0.01,
      z: 0,
    }),
    velocityMps: Object.freeze({ x: 0, y: bodyId === 'sun' ? 0 : 12_000, z: 0 }),
    visible: true,
  });
}

function frame(
  currentJdTdb: number,
  bodies: readonly DebugBodyRenderState[],
): DebugRenderFrame {
  return Object.freeze({
    currentJdTdb,
    originM: Object.freeze({ x: 0, y: 0, z: 0 }),
    originRevision: 0,
    bodies,
    trails: [],
  });
}

function uniformNumber(material: ShaderMaterial, name: string): number {
  const value: unknown = material.uniforms[name]?.value;
  expect(typeof value, `uniform ${name}`).toBe('number');
  return value as number;
}

function uniformTexture(material: ShaderMaterial, name: string): DataTexture {
  const value: unknown = material.uniforms[name]?.value;
  expect(value, `uniform ${name}`).toHaveProperty('isDataTexture', true);
  return value as DataTexture;
}
