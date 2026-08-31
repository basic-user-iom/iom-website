import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Points,
  ShaderMaterial,
} from 'three';

import type { VisualQuality } from '../bodies/VisualQuality';
import { ASTRONOMICAL_UNIT_M } from '../../simulation/core/Units';

export type StatisticalBeltId = 'asteroid-belt' | 'kuiper-belt';

export type StatisticalBeltPopulation =
  | 'asteroid-inner'
  | 'asteroid-middle'
  | 'asteroid-outer'
  | 'asteroid-family'
  | 'kuiper-resonant'
  | 'kuiper-cold-classical'
  | 'kuiper-hot-classical'
  | 'kuiper-outer';

export interface StatisticalBeltProfile {
  readonly id: StatisticalBeltId;
  readonly label: string;
  readonly innerRadiusAu: number;
  readonly outerRadiusAu: number;
  readonly maximumEccentricity: number;
  readonly maximumInclinationDeg: number;
  readonly deterministicSeed: number;
  readonly color: string;
  /** Muted display palette; these are statistical classes, not measured colors. */
  readonly colorPalette?: readonly string[];
  /** Reference point diameter in framebuffer pixels at the maximum quality count. */
  readonly markerSizePx: number;
  /** Hard screen-space diameter cap. It is never presented as a physical radius. */
  readonly maximumMarkerSizePx: number;
  readonly qualityCounts: Readonly<Record<VisualQuality, number>>;
  readonly excludedNamedBodies: readonly string[];
}

export interface StatisticalBeltParticle {
  readonly xM: number;
  readonly yM: number;
  readonly zM: number;
  readonly radiusAu: number;
  readonly semimajorAxisAu: number;
  readonly eccentricity: number;
  readonly meanAnomalyRad: number;
  readonly eccentricAnomalyRad: number;
  /** The modeled orbital-plane inclination, rather than instantaneous latitude. */
  readonly inclinationDeg: number;
  readonly orbitalInclinationDeg: number;
  readonly eclipticLatitudeDeg: number;
  readonly population: StatisticalBeltPopulation;
  readonly markerScale: number;
  readonly paletteIndex: number;
  readonly albedoScale: number;
}

export interface StatisticalBeltDiagnostics {
  readonly asteroidVisible: boolean;
  readonly kuiperVisible: boolean;
  readonly asteroidInstanceCount: number;
  readonly kuiperInstanceCount: number;
  readonly label: 'Statistical visualization';
}

export interface StatisticalBeltVisualMetrics {
  readonly sampleCount: number;
  readonly markerSizePx: number;
  readonly maximumMarkerSizePx: number;
  readonly maximumRenderedMarkerPx: number;
  readonly opacity: number;
  /** Sum of point area weights after the screen-space cap and tier normalization. */
  readonly integratedWeight: number;
}

interface BeltVisualStyle {
  readonly markerSizePx: number;
  readonly opacity: number;
  readonly integratedWeight: number;
  readonly maximumRenderedMarkerPx: number;
}

interface BeltResources {
  readonly profile: Readonly<StatisticalBeltProfile>;
  readonly particles: readonly StatisticalBeltParticle[];
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  visible: boolean;
  sampleCount: number;
  style: Readonly<BeltVisualStyle>;
}

interface SampledElements {
  readonly semimajorAxisAu: number;
  readonly eccentricity: number;
  readonly inclinationDeg: number;
  readonly population: StatisticalBeltPopulation;
}

const TWO_PI = Math.PI * 2;
const QUALITY_SIZE_EXPONENT = 0.18;
const ASTEROID_REFERENCE_OPACITY = 0.13;
const KUIPER_REFERENCE_OPACITY = 0.09;
const MAX_TIER_OPACITY = 0.72;

const ASTEROID_GAPS: readonly Readonly<{
  centerAu: number;
  halfWidthAu: number;
  rejectionProbability: number;
}>[] = Object.freeze([
  Object.freeze({ centerAu: 2.50, halfWidthAu: 0.024, rejectionProbability: 0.94 }),
  Object.freeze({ centerAu: 2.82, halfWidthAu: 0.020, rejectionProbability: 0.91 }),
  Object.freeze({ centerAu: 2.96, halfWidthAu: 0.016, rejectionProbability: 0.84 }),
  Object.freeze({ centerAu: 3.27, halfWidthAu: 0.018, rejectionProbability: 0.90 }),
]);

/**
 * Statistical context density. Samples are deliberately not a catalog of real
 * asteroids or trans-Neptunian objects. Point diameters are bounded display
 * marks, not physical body radii, and no asteroid-like comet tails are drawn.
 */
export class StatisticalBeltRenderer {
  public readonly root = new Group();
  private readonly belts = new Map<StatisticalBeltId, BeltResources>();
  private quality: VisualQuality;
  private metersPerRenderUnit: number;
  private disposed = false;

  public constructor(
    profiles: readonly Readonly<StatisticalBeltProfile>[] = DEFAULT_BELT_PROFILES,
    initialQuality: VisualQuality = 'high',
    initialMetersPerRenderUnit = ASTRONOMICAL_UNIT_M,
  ) {
    requirePositiveFinite(initialMetersPerRenderUnit, 'Statistical belt render scale');
    this.root.name = 'statistical-belt-layer';
    this.quality = initialQuality;
    this.metersPerRenderUnit = initialMetersPerRenderUnit;
    for (const profile of profiles) {
      validateProfile(profile);
      if (this.belts.has(profile.id)) throw new Error(`Duplicate belt profile "${profile.id}".`);
      const maximumCount = Math.max(...Object.values(profile.qualityCounts));
      const particles = createStatisticalBeltDistribution(profile, maximumCount);
      const geometry = createPointGeometry(profile, particles, this.metersPerRenderUnit);
      const initialCount = profile.qualityCounts[initialQuality];
      const style = visualStyleFor(profile, particles, initialCount);
      const material = createDensityMaterial(profile, style);
      const points = new Points(geometry, material);
      points.name = `${profile.id}-statistical-instances`;
      points.renderOrder = 0;
      geometry.setDrawRange(0, initialCount);
      const visible = profile.id === 'asteroid-belt';
      points.visible = visible;
      this.root.add(points);
      this.belts.set(profile.id, {
        profile,
        particles,
        points,
        visible,
        sampleCount: initialCount,
        style,
      });
    }
  }

  /** Positions the heliocentric belt root after floating-origin subtraction. */
  public setSunRenderPosition(x: number, y: number, z: number): void {
    this.assertNotDisposed();
    if (![x, y, z].every(Number.isFinite)) {
      throw new RangeError('Statistical belt Sun position must be finite.');
    }
    this.root.position.set(x, y, z);
  }

  /**
   * Updates physical-to-render mapping without changing the statistical sample.
   * Default observatory scales use one AU per render unit, so existing callers
   * remain correct until they supply a different scale model.
   */
  public setMetersPerRenderUnit(metersPerRenderUnit: number): void {
    this.assertNotDisposed();
    requirePositiveFinite(metersPerRenderUnit, 'Statistical belt render scale');
    if (metersPerRenderUnit === this.metersPerRenderUnit) return;
    this.metersPerRenderUnit = metersPerRenderUnit;
    for (const belt of this.belts.values()) {
      writeMappedPositions(belt.points.geometry, belt.particles, metersPerRenderUnit);
    }
  }

  public getMetersPerRenderUnit(): number {
    return this.metersPerRenderUnit;
  }

  public setVisible(id: StatisticalBeltId, visible: boolean): void {
    this.assertNotDisposed();
    const belt = this.requireBelt(id);
    belt.visible = visible;
    belt.points.visible = visible;
  }

  public isVisible(id: StatisticalBeltId): boolean {
    return this.requireBelt(id).visible;
  }

  public setQuality(quality: VisualQuality): void {
    this.assertNotDisposed();
    if (quality === this.quality) return;
    this.quality = quality;
    this.applyQualityCounts();
  }

  public getDiagnostics(): Readonly<StatisticalBeltDiagnostics> {
    const asteroid = this.requireBelt('asteroid-belt');
    const kuiper = this.requireBelt('kuiper-belt');
    return Object.freeze({
      asteroidVisible: asteroid.visible,
      kuiperVisible: kuiper.visible,
      asteroidInstanceCount: asteroid.visible ? asteroid.sampleCount : 0,
      kuiperInstanceCount: kuiper.visible ? kuiper.sampleCount : 0,
      label: 'Statistical visualization',
    });
  }

  public getVisualMetrics(id: StatisticalBeltId): Readonly<StatisticalBeltVisualMetrics> {
    const belt = this.requireBelt(id);
    return Object.freeze({
      sampleCount: belt.sampleCount,
      markerSizePx: belt.style.markerSizePx,
      maximumMarkerSizePx: belt.profile.maximumMarkerSizePx,
      maximumRenderedMarkerPx: belt.style.maximumRenderedMarkerPx,
      opacity: belt.style.opacity,
      integratedWeight: belt.style.integratedWeight,
    });
  }

  public getParticles(id: StatisticalBeltId): readonly StatisticalBeltParticle[] {
    return this.requireBelt(id).particles;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const belt of this.belts.values()) {
      belt.points.geometry.dispose();
      belt.points.material.dispose();
    }
    this.belts.clear();
    this.root.clear();
  }

  private applyQualityCounts(): void {
    for (const belt of this.belts.values()) {
      belt.sampleCount = belt.profile.qualityCounts[this.quality];
      belt.style = visualStyleFor(belt.profile, belt.particles, belt.sampleCount);
      belt.points.geometry.setDrawRange(0, belt.sampleCount);
      setUniformNumber(belt.points.material, 'uMarkerSizePx', belt.style.markerSizePx);
      setUniformNumber(belt.points.material, 'uOpacity', belt.style.opacity);
    }
  }

  private requireBelt(id: StatisticalBeltId): BeltResources {
    const belt = this.belts.get(id);
    if (belt === undefined) throw new Error(`Unknown statistical belt "${id}".`);
    return belt;
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error('Statistical belt renderer is disposed.');
  }
}

export function createStatisticalBeltDistribution(
  profile: Readonly<StatisticalBeltProfile>,
  count: number,
): readonly StatisticalBeltParticle[] {
  validateProfile(profile);
  if (!Number.isInteger(count) || count <= 0) {
    throw new RangeError('Statistical belt count must be a positive integer.');
  }
  const random = createRandom(profile.deterministicSeed);
  const paletteSize = Math.max(1, profile.colorPalette?.length ?? 1);
  const particles: StatisticalBeltParticle[] = [];
  for (let index = 0; index < count; index += 1) {
    const elements = profile.id === 'asteroid-belt'
      ? sampleAsteroidElements(profile, random)
      : sampleKuiperElements(profile, random);
    const eccentricity = elements.eccentricity;
    const meanAnomaly = random() * TWO_PI;
    const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, eccentricity);
    const trueAnomaly = 2 * Math.atan2(
      Math.sqrt(1 + eccentricity) * Math.sin(eccentricAnomaly / 2),
      Math.sqrt(1 - eccentricity) * Math.cos(eccentricAnomaly / 2),
    );
    const radiusAu = elements.semimajorAxisAu * (1 - eccentricity * Math.cos(eccentricAnomaly));
    const periapsis = random() * TWO_PI;
    const ascendingNode = random() * TWO_PI;
    const inclination = elements.inclinationDeg * Math.PI / 180;
    const argument = trueAnomaly + periapsis;
    const cosNode = Math.cos(ascendingNode);
    const sinNode = Math.sin(ascendingNode);
    const cosArg = Math.cos(argument);
    const sinArg = Math.sin(argument);
    const cosInclination = Math.cos(inclination);
    const sinInclination = Math.sin(inclination);
    // Physical ecliptic xyz; +Z is ecliptic north.
    const xAu = radiusAu * (cosNode * cosArg - sinNode * sinArg * cosInclination);
    const yAu = radiusAu * (sinNode * cosArg + cosNode * sinArg * cosInclination);
    const zAu = radiusAu * sinArg * sinInclination;
    const measuredRadiusAu = Math.hypot(xAu, yAu, zAu);
    particles.push(Object.freeze({
      xM: xAu * ASTRONOMICAL_UNIT_M,
      yM: yAu * ASTRONOMICAL_UNIT_M,
      zM: zAu * ASTRONOMICAL_UNIT_M,
      radiusAu: measuredRadiusAu,
      semimajorAxisAu: elements.semimajorAxisAu,
      eccentricity,
      meanAnomalyRad: meanAnomaly,
      eccentricAnomalyRad: eccentricAnomaly,
      inclinationDeg: elements.inclinationDeg,
      orbitalInclinationDeg: elements.inclinationDeg,
      eclipticLatitudeDeg:
        Math.asin(zAu / Math.max(measuredRadiusAu, 1e-12)) * 180 / Math.PI,
      population: elements.population,
      markerScale: 0.80 + random() * 0.40,
      paletteIndex: Math.min(paletteSize - 1, Math.floor(random() * paletteSize)),
      albedoScale: 0.70 + random() * 0.28,
    }));
  }
  return Object.freeze(particles);
}

/** Newton solve for M = E - e sin(E), with inputs normalized to one revolution. */
export function solveEccentricAnomaly(meanAnomalyRad: number, eccentricity: number): number {
  if (!Number.isFinite(meanAnomalyRad) || !Number.isFinite(eccentricity)) {
    throw new RangeError('Kepler inputs must be finite.');
  }
  if (eccentricity < 0 || eccentricity >= 1) {
    throw new RangeError('Statistical belt eccentricity must be in [0, 1).');
  }
  const meanAnomaly = positiveModulo(meanAnomalyRad, TWO_PI);
  let eccentricAnomaly = eccentricity < 0.8 ? meanAnomaly : Math.PI;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const residual = eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly;
    const derivative = 1 - eccentricity * Math.cos(eccentricAnomaly);
    const correction = residual / derivative;
    eccentricAnomaly -= correction;
    if (Math.abs(correction) < 1e-13) break;
  }
  return eccentricAnomaly;
}

function sampleAsteroidElements(
  profile: Readonly<StatisticalBeltProfile>,
  random: () => number,
): SampledElements {
  const selector = random();
  let population: StatisticalBeltPopulation;
  let lowerAu: number;
  let upperAu: number;
  let eccentricitySigma: number;
  let inclinationSigmaDeg: number;
  if (selector < 0.29) {
    population = 'asteroid-inner';
    lowerAu = profile.innerRadiusAu;
    upperAu = Math.min(profile.outerRadiusAu, 2.50);
    eccentricitySigma = 0.070;
    inclinationSigmaDeg = 4.2;
  } else if (selector < 0.64) {
    population = 'asteroid-middle';
    lowerAu = Math.max(profile.innerRadiusAu, 2.50);
    upperAu = Math.min(profile.outerRadiusAu, 2.82);
    eccentricitySigma = 0.065;
    inclinationSigmaDeg = 4.8;
  } else if (selector < 0.94) {
    population = 'asteroid-outer';
    lowerAu = Math.max(profile.innerRadiusAu, 2.82);
    upperAu = profile.outerRadiusAu;
    eccentricitySigma = 0.075;
    inclinationSigmaDeg = 5.8;
  } else {
    population = 'asteroid-family';
    lowerAu = profile.innerRadiusAu;
    upperAu = profile.outerRadiusAu;
    eccentricitySigma = 0.040;
    inclinationSigmaDeg = 2.8;
  }
  if (upperAu <= lowerAu) {
    lowerAu = profile.innerRadiusAu;
    upperAu = profile.outerRadiusAu;
  }
  const semimajorAxisAu = sampleAsteroidSemimajorAxis(
    lowerAu,
    upperAu,
    population,
    random,
  );
  return {
    semimajorAxisAu,
    eccentricity: sampleTruncatedRayleigh(random, eccentricitySigma, profile.maximumEccentricity),
    inclinationDeg: sampleTruncatedRayleigh(
      random,
      inclinationSigmaDeg,
      profile.maximumInclinationDeg,
    ),
    population,
  };
}

function sampleAsteroidSemimajorAxis(
  lowerAu: number,
  upperAu: number,
  population: StatisticalBeltPopulation,
  random: () => number,
): number {
  let candidate = (lowerAu + upperAu) / 2;
  for (let attempt = 0; attempt < 48; attempt += 1) {
    if (population === 'asteroid-family') {
      const centers = [2.36, 2.64, 3.14] as const;
      const center = centers[Math.min(centers.length - 1, Math.floor(random() * centers.length))] ?? 2.64;
      candidate = clamp(center + gaussian(random) * 0.032, lowerAu, upperAu);
    } else {
      candidate = lowerAu + (upperAu - lowerAu) * random();
    }
    const rejected = ASTEROID_GAPS.some((gap) =>
      Math.abs(candidate - gap.centerAu) < gap.halfWidthAu &&
      random() < gap.rejectionProbability,
    );
    if (!rejected) return candidate;
  }
  return candidate;
}

function sampleKuiperElements(
  profile: Readonly<StatisticalBeltProfile>,
  random: () => number,
): SampledElements {
  const selector = random();
  if (selector < 0.27) {
    const resonances = [
      { centerAu: 36.4, sigmaAu: 0.22 },
      { centerAu: 39.4, sigmaAu: 0.34 },
      { centerAu: 47.7, sigmaAu: 0.30 },
    ] as const;
    const resonanceSelector = random();
    const resonance = resonanceSelector < 0.16
      ? resonances[0]
      : resonanceSelector < 0.77
        ? resonances[1]
        : resonances[2];
    return {
      semimajorAxisAu: clamp(
        resonance.centerAu + gaussian(random) * resonance.sigmaAu,
        profile.innerRadiusAu,
        profile.outerRadiusAu,
      ),
      eccentricity: Math.min(
        profile.maximumEccentricity,
        0.045 + sampleTruncatedRayleigh(random, 0.070, profile.maximumEccentricity),
      ),
      inclinationDeg: sampleTruncatedRayleigh(random, 7.5, profile.maximumInclinationDeg),
      population: 'kuiper-resonant',
    };
  }
  if (selector < 0.69) {
    return {
      semimajorAxisAu: boundedUniform(random, profile, 42.0, 47.0),
      eccentricity: Math.min(
        profile.maximumEccentricity,
        0.018 + sampleTruncatedRayleigh(random, 0.028, 0.10),
      ),
      inclinationDeg: sampleTruncatedRayleigh(
        random,
        1.8,
        Math.min(7, profile.maximumInclinationDeg),
      ),
      population: 'kuiper-cold-classical',
    };
  }
  if (selector < 0.93) {
    return {
      semimajorAxisAu: boundedUniform(random, profile, 40.0, 48.0),
      eccentricity: sampleTruncatedRayleigh(random, 0.085, profile.maximumEccentricity),
      inclinationDeg: sampleTruncatedRayleigh(random, 11.5, profile.maximumInclinationDeg),
      population: 'kuiper-hot-classical',
    };
  }
  return {
    semimajorAxisAu: boundedUniform(random, profile, 47.0, 50.0),
    eccentricity: Math.min(
      profile.maximumEccentricity,
      0.075 + sampleTruncatedRayleigh(random, 0.080, profile.maximumEccentricity),
    ),
    inclinationDeg: sampleTruncatedRayleigh(random, 13.0, profile.maximumInclinationDeg),
    population: 'kuiper-outer',
  };
}

function boundedUniform(
  random: () => number,
  profile: Readonly<StatisticalBeltProfile>,
  requestedLowerAu: number,
  requestedUpperAu: number,
): number {
  let lowerAu = Math.max(profile.innerRadiusAu, requestedLowerAu);
  let upperAu = Math.min(profile.outerRadiusAu, requestedUpperAu);
  if (upperAu <= lowerAu) {
    lowerAu = profile.innerRadiusAu;
    upperAu = profile.outerRadiusAu;
  }
  return lowerAu + (upperAu - lowerAu) * random();
}

function sampleTruncatedRayleigh(
  random: () => number,
  sigma: number,
  maximum: number,
): number {
  if (maximum <= 0) return 0;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const sample = sigma * Math.sqrt(-2 * Math.log(Math.max(1e-12, 1 - random())));
    if (sample <= maximum) return sample;
  }
  return maximum * random();
}

function gaussian(random: () => number): number {
  const first = Math.max(random(), 1e-12);
  const second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(TWO_PI * second);
}

function createPointGeometry(
  profile: Readonly<StatisticalBeltProfile>,
  particles: readonly StatisticalBeltParticle[],
  metersPerRenderUnit: number,
): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.name = `${profile.id}-statistical-density-geometry`;
  geometry.setAttribute('position', new Float32BufferAttribute(particles.length * 3, 3));
  const colors = new Float32Array(particles.length * 3);
  const markerScales = new Float32Array(particles.length);
  const palette = profile.colorPalette?.length ? profile.colorPalette : [profile.color];
  const color = new Color();
  particles.forEach((particle, index) => {
    const offset = index * 3;
    color.set(palette[particle.paletteIndex % palette.length] ?? profile.color);
    color.multiplyScalar(particle.albedoScale);
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
    markerScales[index] = particle.markerScale;
  });
  geometry.setAttribute('aColor', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aMarkerScale', new Float32BufferAttribute(markerScales, 1));
  writeMappedPositions(geometry, particles, metersPerRenderUnit);
  return geometry;
}

function writeMappedPositions(
  geometry: BufferGeometry,
  particles: readonly StatisticalBeltParticle[],
  metersPerRenderUnit: number,
): void {
  const positions = geometry.getAttribute('position');
  if (positions.count !== particles.length) {
    throw new RangeError('Statistical belt position buffer does not match its sample count.');
  }
  particles.forEach((particle, index) => {
    positions.setXYZ(
      index,
      particle.xM / metersPerRenderUnit,
      particle.zM / metersPerRenderUnit,
      -particle.yM / metersPerRenderUnit,
    );
  });
  positions.needsUpdate = true;
  geometry.computeBoundingSphere();
}

function createDensityMaterial(
  profile: Readonly<StatisticalBeltProfile>,
  style: Readonly<BeltVisualStyle>,
): ShaderMaterial {
  const material = new ShaderMaterial({
    depthTest: true,
    depthWrite: false,
    fragmentShader: `
      precision highp float;
      uniform float uOpacity;
      varying vec3 vColor;
      void main() {
        vec2 centered = gl_PointCoord * 2.0 - 1.0;
        float radiusSquared = dot(centered, centered);
        if (radiusSquared > 1.0) discard;
        float softEdge = 1.0 - smoothstep(0.44, 1.0, radiusSquared);
        float density = exp(-radiusSquared * 1.7) * softEdge;
        gl_FragColor = vec4(vColor, density * uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    toneMapped: true,
    uniforms: {
      uMarkerCapPx: { value: profile.maximumMarkerSizePx },
      uMarkerSizePx: { value: style.markerSizePx },
      uOpacity: { value: style.opacity },
    },
    vertexShader: `
      precision highp float;
      attribute vec3 aColor;
      attribute float aMarkerScale;
      uniform float uMarkerCapPx;
      uniform float uMarkerSizePx;
      varying vec3 vColor;
      void main() {
        vColor = aColor;
        gl_PointSize = min(uMarkerCapPx, uMarkerSizePx * aMarkerScale);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  });
  material.name = `${profile.id}-statistical-density-material`;
  return material;
}

function visualStyleFor(
  profile: Readonly<StatisticalBeltProfile>,
  particles: readonly StatisticalBeltParticle[],
  sampleCount: number,
): Readonly<BeltVisualStyle> {
  const maximumCount = Math.max(...Object.values(profile.qualityCounts));
  const referenceOpacity = profile.id === 'asteroid-belt'
    ? ASTEROID_REFERENCE_OPACITY
    : KUIPER_REFERENCE_OPACITY;
  const markerSizePx = Math.min(
    profile.maximumMarkerSizePx,
    profile.markerSizePx * Math.pow(maximumCount / sampleCount, QUALITY_SIZE_EXPONENT),
  );
  const referenceArea = projectedPointArea(
    particles,
    maximumCount,
    profile.markerSizePx,
    profile.maximumMarkerSizePx,
  );
  const currentArea = projectedPointArea(
    particles,
    sampleCount,
    markerSizePx,
    profile.maximumMarkerSizePx,
  );
  const targetWeight = referenceArea * referenceOpacity;
  const opacity = Math.min(MAX_TIER_OPACITY, targetWeight / Math.max(currentArea, 1e-12));
  let maximumRenderedMarkerPx = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const particle = particles[index];
    if (particle !== undefined) {
      maximumRenderedMarkerPx = Math.max(
        maximumRenderedMarkerPx,
        Math.min(profile.maximumMarkerSizePx, markerSizePx * particle.markerScale),
      );
    }
  }
  return Object.freeze({
    markerSizePx,
    opacity,
    integratedWeight: currentArea * opacity,
    maximumRenderedMarkerPx,
  });
}

function projectedPointArea(
  particles: readonly StatisticalBeltParticle[],
  count: number,
  markerSizePx: number,
  maximumMarkerSizePx: number,
): number {
  let sum = 0;
  for (let index = 0; index < count; index += 1) {
    const particle = particles[index];
    if (particle === undefined) {
      throw new RangeError(`Statistical belt particle ${index} is missing.`);
    }
    const diameter = Math.min(maximumMarkerSizePx, markerSizePx * particle.markerScale);
    sum += diameter * diameter;
  }
  return sum;
}

function setUniformNumber(material: ShaderMaterial, name: string, value: number): void {
  const uniform = material.uniforms[name];
  if (uniform === undefined) throw new Error(`Statistical belt uniform "${name}" is missing.`);
  uniform.value = value;
}

function validateProfile(profile: Readonly<StatisticalBeltProfile>): void {
  if (
    !Number.isFinite(profile.innerRadiusAu) ||
    !Number.isFinite(profile.outerRadiusAu) ||
    profile.innerRadiusAu <= 0 ||
    profile.outerRadiusAu <= profile.innerRadiusAu
  ) {
    throw new RangeError(`Invalid radial range for ${profile.id}.`);
  }
  if (
    !Number.isFinite(profile.maximumEccentricity) ||
    profile.maximumEccentricity <= 0 ||
    profile.maximumEccentricity >= 1 ||
    !Number.isFinite(profile.maximumInclinationDeg) ||
    profile.maximumInclinationDeg <= 0 ||
    profile.maximumInclinationDeg > 180 ||
    !Number.isInteger(profile.deterministicSeed) ||
    !Number.isFinite(profile.markerSizePx) ||
    profile.markerSizePx <= 0 ||
    !Number.isFinite(profile.maximumMarkerSizePx) ||
    profile.maximumMarkerSizePx < profile.markerSizePx
  ) {
    throw new RangeError(`Invalid distribution controls for ${profile.id}.`);
  }
  if (profile.colorPalette !== undefined && profile.colorPalette.length === 0) {
    throw new RangeError(`Invalid empty color palette for ${profile.id}.`);
  }
  const orderedCounts = [
    profile.qualityCounts.low,
    profile.qualityCounts.medium,
    profile.qualityCounts.high,
    profile.qualityCounts.ultra,
  ];
  let previousCount = 0;
  for (const count of orderedCounts) {
    if (!Number.isInteger(count) || count <= 0) {
      throw new RangeError(`Invalid quality count for ${profile.id}.`);
    }
    if (count < previousCount) {
      throw new RangeError(`Quality counts must be non-decreasing for ${profile.id}.`);
    }
    previousCount = count;
  }
}

function requirePositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be positive and finite.`);
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export const DEFAULT_BELT_PROFILES: readonly Readonly<StatisticalBeltProfile>[] =
  Object.freeze([
    Object.freeze({
      id: 'asteroid-belt',
      label: 'Asteroid belt — statistical visualization',
      innerRadiusAu: 2.08,
      outerRadiusAu: 3.32,
      maximumEccentricity: 0.18,
      maximumInclinationDeg: 18,
      deterministicSeed: 0x41_53_54_36,
      color: '#766b60',
      colorPalette: Object.freeze(['#675f58', '#75695e', '#806e5f', '#6d6963']),
      markerSizePx: 1.25,
      maximumMarkerSizePx: 2.20,
      qualityCounts: Object.freeze({ low: 900, medium: 1_800, high: 3_600, ultra: 6_400 }),
      excludedNamedBodies: Object.freeze(['ceres', 'vesta', 'pallas', 'hygiea']),
    }),
    Object.freeze({
      id: 'kuiper-belt',
      label: 'Kuiper belt — statistical visualization',
      innerRadiusAu: 30,
      outerRadiusAu: 50,
      maximumEccentricity: 0.24,
      maximumInclinationDeg: 28,
      deterministicSeed: 0x4b_42_4f_36,
      color: '#746966',
      colorPalette: Object.freeze(['#686464', '#756a67', '#806b65', '#8a7068']),
      markerSizePx: 1.15,
      maximumMarkerSizePx: 2.00,
      qualityCounts: Object.freeze({ low: 700, medium: 1_400, high: 2_800, ultra: 4_800 }),
      excludedNamedBodies: Object.freeze(['pluto', 'eris', 'haumea', 'makemake']),
    }),
  ]);
