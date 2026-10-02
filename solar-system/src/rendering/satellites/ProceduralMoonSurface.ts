import {
  DataTexture,
  IcosahedronGeometry,
  LinearFilter,
  RepeatWrapping,
  RGBAFormat,
  type SphereGeometry,
  SRGBColorSpace,
  UnsignedByteType,
  Vector3,
  type BufferGeometry,
} from 'three';

import type { NaturalSatelliteDefinition } from '../../simulation/satellites/NaturalSatelliteCatalog';
import { NATURAL_SATELLITE_TEXTURE_BY_ID } from './NaturalSatelliteAssetCatalog';

/** Majors without an accepted equirectangular NASA VTAD globe map. */
export const PROCEDURAL_MAJOR_MOON_IDS = Object.freeze([
  'phobos',
  'deimos',
  'mimas',
  'hyperion',
  'phoebe',
  'proteus',
  'nereid',
] as const);

export type ProceduralMajorMoonId = (typeof PROCEDURAL_MAJOR_MOON_IDS)[number];

export interface ProceduralMoonMaps {
  readonly color: DataTexture;
  readonly normal: DataTexture;
  readonly roughness: number;
  readonly normalScale: number;
}

const PROFILE_COLORS: Readonly<Record<string, number>> = Object.freeze({
  'lunar-rocky': 0xb9b8b0,
  'phobos-irregular': 0x7a6a5c,
  'deimos-irregular': 0x8a7468,
  'io-sulfurous': 0xd5a62e,
  'europa-ice': 0xbac8d6,
  'ganymede-grooved-ice': 0x8e8274,
  'callisto-cratered': 0x625b55,
  'mimas-ice': 0xd7e2ea,
  'enceladus-ice-plume': 0xe1eef4,
  'tethys-ice': 0xcad3dc,
  'dione-ice': 0xbac5ce,
  'rhea-ice': 0xc3c9d1,
  'titan-haze': 0xc79455,
  'hyperion-irregular': 0x9a7a64,
  'iapetus-two-tone': 0x5e5a50,
  'phoebe-irregular': 0x6a635c,
  'miranda-varied-terrain': 0x9b9a94,
  'ariel-ice': 0xadc1c6,
  'umbriel-dark-ice': 0x777d80,
  'titania-ice': 0xa5b9be,
  'oberon-ice': 0x929da2,
  'triton-nitrogen-ice': 0xb7d2dc,
  'proteus-irregular': 0x6a7580,
  'nereid-irregular': 0xb0b2b6,
  'minor-point-fallback': 0x8ac9df,
});

export function isProceduralMajorMoon(id: string): id is ProceduralMajorMoonId {
  return (PROCEDURAL_MAJOR_MOON_IDS as readonly string[]).includes(id);
}

export function profileColorHex(visualProfile: string): number {
  return PROFILE_COLORS[visualProfile] ?? 0x9bb4c2;
}

export function shapeAxesFor(id: string): Readonly<Vector3> {
  switch (id) {
    case 'phobos': return new Vector3(1, 0.78, 0.68);
    case 'deimos': return new Vector3(1, 0.82, 0.71);
    case 'mimas': return new Vector3(1, 0.97, 0.94);
    case 'hyperion': return new Vector3(1, 0.58, 0.48);
    case 'phoebe': return new Vector3(1, 0.91, 0.86);
    case 'proteus': return new Vector3(1, 0.88, 0.80);
    case 'nereid': return new Vector3(1, 0.95, 0.90);
    default: return new Vector3(1, 1, 1);
  }
}

export function materialRoughnessForProfile(visualProfile: string): number {
  if (visualProfile.includes('ice')) return 0.88;
  if (visualProfile.includes('irregular')) return 0.94;
  if (visualProfile.includes('haze')) return 0.78;
  return 0.86;
}

export function createProceduralMoonMaps(
  definition: Readonly<NaturalSatelliteDefinition>,
): ProceduralMoonMaps {
  // VTAD-mapped majors only need a cheap cover until the official WebP arrives.
  if (NATURAL_SATELLITE_TEXTURE_BY_ID.has(definition.id)) {
    return createPlaceholderMoonMaps(definition);
  }
  return createRichProceduralMoonMaps(definition);
}

export function createPlaceholderMoonMaps(
  definition: Readonly<NaturalSatelliteDefinition>,
): ProceduralMoonMaps {
  const width = 64;
  const height = 32;
  const colorPixels = new Uint8Array(width * height * 4);
  const normalPixels = new Uint8Array(width * height * 4);
  const baseHex = profileColorHex(definition.visualProfile);
  const r = (baseHex >> 16) & 0xff;
  const g = (baseHex >> 8) & 0xff;
  const b = baseHex & 0xff;
  for (let y = 0; y < height; y += 1) {
    const limb = 0.78 + 0.22 * Math.sin((y / (height - 1)) * Math.PI);
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const band = 0.92 + 0.08 * Math.sin(x * 0.35 + y * 0.2);
      colorPixels[offset] = clampByte(r * limb * band);
      colorPixels[offset + 1] = clampByte(g * limb * band);
      colorPixels[offset + 2] = clampByte(b * limb * band);
      colorPixels[offset + 3] = 255;
      normalPixels[offset] = 128;
      normalPixels[offset + 1] = 128;
      normalPixels[offset + 2] = 255;
      normalPixels[offset + 3] = 255;
    }
  }
  return Object.freeze({
    color: createDataTexture(colorPixels, width, height, `procedural-moon-placeholder-${definition.id}`, true),
    normal: createDataTexture(normalPixels, width, height, `procedural-moon-placeholder-normal-${definition.id}`, false),
    roughness: materialRoughnessForProfile(definition.visualProfile),
    normalScale: 0.35,
  });
}

function createRichProceduralMoonMaps(
  definition: Readonly<NaturalSatelliteDefinition>,
): ProceduralMoonMaps {
  const width = 1024;
  const height = 512;
  const colorPixels = new Uint8Array(width * height * 4);
  const normalPixels = new Uint8Array(width * height * 4);
  const heightField = new Float32Array(width * height);

  let seed = hashText(definition.id);
  const baseHex = profileColorHex(definition.visualProfile);
  const base = [
    (baseHex >> 16) & 0xff,
    (baseHex >> 8) & 0xff,
    baseHex & 0xff,
  ] as const;
  const accent = accentRgb(definition, seed);
  const style = surfaceStyleFor(definition);

  const craters = Array.from({ length: style.craterCount }, (_, index) => {
    seed = nextSeed(seed);
    const longitude = seed / 0xffffffff * Math.PI * 2 - Math.PI;
    seed = nextSeed(seed);
    const latitude = (seed / 0xffffffff - 0.5) * Math.PI * style.latitudeSpan;
    seed = nextSeed(seed);
    const radius = style.craterRadiusMin + seed / 0xffffffff * style.craterRadiusSpan;
    seed = nextSeed(seed);
    const depth = style.craterDepthMin + seed / 0xffffffff * style.craterDepthSpan;
    // One oversized basin for Mimas-like ice bodies so they do not read as blank balls.
    const heroic = index === 0 && style.heroicBasin;
    return {
      longitude: heroic ? 0.0 : longitude,
      latitude: heroic ? 0.05 : latitude,
      radius: heroic ? Math.max(radius, 0.55) : radius,
      depth: heroic ? Math.max(depth, 0.85) : depth,
    };
  });

  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height;
    const latitude = (0.5 - v) * Math.PI;
    const cosLat = Math.cos(latitude);
    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width;
      const longitude = (u - 0.5) * Math.PI * 2;
      const nx = Math.cos(latitude) * Math.cos(longitude);
      const ny = Math.sin(latitude);
      const nz = Math.cos(latitude) * Math.sin(longitude);

      let heightSample =
        fbm3(nx * 1.7, ny * 1.7, nz * 1.7, seed, 4) * style.broadAmp +
        fbm3(nx * 6.1, ny * 6.1, nz * 6.1, seed ^ 0xa5a5_5a5a, 3) * style.fineAmp;

      if (style.grooveStrength > 0) {
        const groove =
          Math.sin(longitude * style.grooveFrequency + latitude * 2.4 + seed * 1e-7) *
          Math.cos(latitude * 7.1);
        heightSample += groove * style.grooveStrength;
      }

      if (style.spongeStrength > 0) {
        const sponge = Math.abs(fbm3(nx * 11.0, ny * 11.0, nz * 11.0, seed ^ 0x51_51, 2) - 0.5);
        heightSample += (0.5 - sponge) * style.spongeStrength;
      }

      let albedoMix = 0.5 + heightSample * 0.9;
      for (const crater of craters) {
        const dx = wrappedLongitude(longitude - crater.longitude) * cosLat;
        const dy = latitude - crater.latitude;
        const distance = Math.hypot(dx, dy);
        const rimWidth = crater.radius * 0.2;
        const rim = Math.exp(-((distance - crater.radius) ** 2) / Math.max(rimWidth ** 2, 1e-6));
        const bowl = Math.max(0, 1 - distance / crater.radius);
        const bowlCurve = bowl * bowl;
        heightSample += rim * crater.depth * 0.45 - bowlCurve * crater.depth;
        albedoMix += rim * 0.22 - bowlCurve * 0.34;
      }

      // Soft limb cue in the albedo so even distant moons keep a rounded read.
      const limb = 0.92 + 0.08 * Math.pow(Math.max(0, cosLat), 0.5);
      let shade = Math.max(0.5, (0.82 + albedoMix * 0.42) * limb);
      // Extra dark floor inside Mimas's heroic basin so it reads at a glance.
      if (style.heroicBasin) {
        const basin = craters[0]!;
        const dx = wrappedLongitude(longitude - basin.longitude) * cosLat;
        const dy = latitude - basin.latitude;
        const basinDist = Math.hypot(dx, dy);
        if (basinDist < basin.radius) {
          const t = 1 - basinDist / basin.radius;
          shade *= 1 - t * t * 0.48;
        } else if (basinDist < basin.radius * 1.18) {
          // Bright rim so the basin edge stays sharp against ice.
          const rimT = 1 - (basinDist - basin.radius) / (basin.radius * 0.18);
          shade = Math.min(1.12, shade * (1 + rimT * 0.22));
        }
      }
      const blend = clamp01(0.28 + heightSample * style.accentStrength);
      const offset = (y * width + x) * 4;
      colorPixels[offset] = clampByte((base[0] * (1 - blend) + accent[0] * blend) * shade);
      colorPixels[offset + 1] = clampByte((base[1] * (1 - blend) + accent[1] * blend) * shade);
      colorPixels[offset + 2] = clampByte((base[2] * (1 - blend) + accent[2] * blend) * shade);
      colorPixels[offset + 3] = 255;
      heightField[y * width + x] = heightSample;
    }
  }

  const slopeGain = style.normalStrength;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const left = heightField[y * width + ((x - 1 + width) % width)]!;
      const right = heightField[y * width + ((x + 1) % width)]!;
      const up = heightField[((y - 1 + height) % height) * width + x]!;
      const down = heightField[((y + 1) % height) * width + x]!;
      const dx = (right - left) * slopeGain;
      const dy = (down - up) * slopeGain;
      const invLen = 1 / Math.hypot(dx, dy, 1);
      const offset = (y * width + x) * 4;
      normalPixels[offset] = clampByte((0.5 - dx * invLen * 0.5) * 255);
      normalPixels[offset + 1] = clampByte((0.5 + dy * invLen * 0.5) * 255);
      normalPixels[offset + 2] = clampByte((0.5 + invLen * 0.5) * 255);
      normalPixels[offset + 3] = 255;
    }
  }

  const color = createDataTexture(
    colorPixels,
    width,
    height,
    `procedural-moon-color-${definition.id}`,
    true,
  );
  const normal = createDataTexture(
    normalPixels,
    width,
    height,
    `procedural-moon-normal-${definition.id}`,
    false,
  );

  return Object.freeze({
    color,
    normal,
    roughness: materialRoughnessForProfile(definition.visualProfile),
    normalScale: style.normalScale,
  });
}

/**
 * Vertex sculpt for irregular majors. Hyperion gets a dedicated spongy mesh;
 * other irregulars use a cloned sphere with lobe displacement.
 */
export function createMoonBodyGeometry(
  definition: Readonly<NaturalSatelliteDefinition>,
  sharedSphere: SphereGeometry,
): BufferGeometry {
  if (!isProceduralMajorMoon(definition.id)) {
    return sharedSphere;
  }
  if (definition.id === 'hyperion') {
    return createHyperionGeometry();
  }
  const amplitude = irregularAmplitude(definition.id);
  if (amplitude < 0.01) return sharedSphere;

  const geometry = sharedSphere.clone();
  sculptIrregularVertices(geometry, hashText(definition.id), amplitude, definition.id === 'mimas');
  geometry.name = `natural-satellite-geometry-${definition.id}`;
  return geometry;
}

/** Chaotic potato silhouette — Hyperion must not read as a crater-stamped ball. */
function createHyperionGeometry(): BufferGeometry {
  const geometry = new IcosahedronGeometry(1, 5);
  const positions = geometry.getAttribute('position');
  const seed = hashText('hyperion');
  const lobes = [
    { dir: normalize3(0.92, 0.28, -0.18), strength: 0.34, power: 2.4 },
    { dir: normalize3(-0.55, 0.78, 0.22), strength: 0.3, power: 2.1 },
    { dir: normalize3(-0.2, -0.42, 0.88), strength: 0.36, power: 2.6 },
    { dir: normalize3(0.18, -0.86, -0.35), strength: 0.28, power: 2.2 },
    { dir: normalize3(-0.75, -0.12, -0.62), strength: 0.32, power: 2.5 },
  ] as const;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const length = Math.hypot(x, y, z) || 1;
    const nx = x / length;
    const ny = y / length;
    const nz = z / length;
    let radius = 0.72;
    radius += fbm3(nx * 1.8, ny * 1.8, nz * 1.8, seed, 4) * 0.34;
    radius += fbm3(nx * 5.5, ny * 5.5, nz * 5.5, seed ^ 0x51_51, 3) * 0.16;
    for (const lobe of lobes) {
      const alignment = Math.max(0, nx * lobe.dir[0] + ny * lobe.dir[1] + nz * lobe.dir[2]);
      radius += lobe.strength * alignment ** lobe.power;
    }
    // Deep sponge pits so the silhouette breaks into irregular concavities.
    const pit = fbm3(nx * 9.5, ny * 9.5, nz * 9.5, seed ^ 0xa5a5, 2);
    radius -= Math.max(0, pit - 0.55) * 0.42;
    radius = Math.max(0.48, Math.min(1.28, radius));
    positions.setXYZ(index, nx * radius, ny * radius, nz * radius);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.name = 'natural-satellite-geometry-hyperion';
  return geometry;
}

function sculptIrregularVertices(
  geometry: BufferGeometry,
  seed: number,
  amplitude: number,
  mimasBasin: boolean,
): void {
  const positions = geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const length = Math.hypot(x, y, z) || 1;
    const nx = x / length;
    const ny = y / length;
    const nz = z / length;
    let lump =
      fbm3(nx * 2.4, ny * 2.4, nz * 2.4, seed, 3) * amplitude +
      Math.sin(nx * 9.1 + seed * 1e-6) * Math.cos(ny * 7.3) * amplitude * 0.35;
    if (mimasBasin) {
      // Push a Herschel-scale cavity onto the +X face so close-ups show a basin.
      const basin = Math.max(0, nx * 0.95 + ny * 0.08 - 0.22);
      lump -= basin * basin * 0.22;
    }
    const radius = 1 + lump - amplitude * 0.35;
    positions.setXYZ(index, nx * radius, ny * radius, nz * radius);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

function normalize3(x: number, y: number, z: number): readonly [number, number, number] {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length] as const;
}

export { PROFILE_COLORS };

interface SurfaceStyle {
  readonly craterCount: number;
  readonly craterRadiusMin: number;
  readonly craterRadiusSpan: number;
  readonly craterDepthMin: number;
  readonly craterDepthSpan: number;
  readonly latitudeSpan: number;
  readonly broadAmp: number;
  readonly fineAmp: number;
  readonly grooveStrength: number;
  readonly grooveFrequency: number;
  readonly spongeStrength: number;
  readonly accentStrength: number;
  readonly normalStrength: number;
  readonly normalScale: number;
  readonly heroicBasin: boolean;
}

function surfaceStyleFor(definition: Readonly<NaturalSatelliteDefinition>): SurfaceStyle {
  switch (definition.id) {
    case 'phobos':
      return {
        craterCount: 28,
        craterRadiusMin: 0.03,
        craterRadiusSpan: 0.14,
        craterDepthMin: 0.25,
        craterDepthSpan: 0.35,
        latitudeSpan: 0.95,
        broadAmp: 0.22,
        fineAmp: 0.14,
        grooveStrength: 0.12,
        grooveFrequency: 11,
        spongeStrength: 0.05,
        accentStrength: 0.7,
        normalStrength: 4.8,
        normalScale: 1.25,
        heroicBasin: false,
      };
    case 'deimos':
      return {
        craterCount: 18,
        craterRadiusMin: 0.025,
        craterRadiusSpan: 0.11,
        craterDepthMin: 0.18,
        craterDepthSpan: 0.28,
        latitudeSpan: 0.9,
        broadAmp: 0.18,
        fineAmp: 0.12,
        grooveStrength: 0.04,
        grooveFrequency: 7,
        spongeStrength: 0.04,
        accentStrength: 0.58,
        normalStrength: 4.0,
        normalScale: 1.12,
        heroicBasin: false,
      };
    case 'mimas':
      return {
        craterCount: 34,
        craterRadiusMin: 0.018,
        craterRadiusSpan: 0.09,
        craterDepthMin: 0.28,
        craterDepthSpan: 0.38,
        latitudeSpan: 0.85,
        broadAmp: 0.18,
        fineAmp: 0.14,
        grooveStrength: 0.04,
        grooveFrequency: 6,
        spongeStrength: 0,
        accentStrength: 0.72,
        normalStrength: 7.5,
        normalScale: 1.85,
        heroicBasin: true,
      };
    case 'hyperion':
      return {
        craterCount: 38,
        craterRadiusMin: 0.025,
        craterRadiusSpan: 0.14,
        craterDepthMin: 0.32,
        craterDepthSpan: 0.5,
        latitudeSpan: 1,
        broadAmp: 0.28,
        fineAmp: 0.2,
        grooveStrength: 0.06,
        grooveFrequency: 8,
        spongeStrength: 0.36,
        accentStrength: 0.95,
        normalStrength: 4.6,
        normalScale: 1.15,
        heroicBasin: false,
      };
    case 'phoebe':
      return {
        craterCount: 26,
        craterRadiusMin: 0.025,
        craterRadiusSpan: 0.13,
        craterDepthMin: 0.22,
        craterDepthSpan: 0.34,
        latitudeSpan: 0.95,
        broadAmp: 0.15,
        fineAmp: 0.1,
        grooveStrength: 0.025,
        grooveFrequency: 6,
        spongeStrength: 0.05,
        accentStrength: 0.5,
        normalStrength: 4.0,
        normalScale: 1.2,
        heroicBasin: false,
      };
    case 'proteus':
      return {
        craterCount: 24,
        craterRadiusMin: 0.03,
        craterRadiusSpan: 0.12,
        craterDepthMin: 0.24,
        craterDepthSpan: 0.32,
        latitudeSpan: 0.92,
        broadAmp: 0.13,
        fineAmp: 0.09,
        grooveStrength: 0.05,
        grooveFrequency: 9,
        spongeStrength: 0.04,
        accentStrength: 0.48,
        normalStrength: 4.1,
        normalScale: 1.18,
        heroicBasin: false,
      };
    case 'nereid':
      return {
        craterCount: 16,
        craterRadiusMin: 0.02,
        craterRadiusSpan: 0.09,
        craterDepthMin: 0.16,
        craterDepthSpan: 0.24,
        latitudeSpan: 0.88,
        broadAmp: 0.1,
        fineAmp: 0.07,
        grooveStrength: 0.015,
        grooveFrequency: 5,
        spongeStrength: 0.02,
        accentStrength: 0.35,
        normalStrength: 3.2,
        normalScale: 0.95,
        heroicBasin: false,
      };
    default:
      return {
        craterCount: 16,
        craterRadiusMin: 0.03,
        craterRadiusSpan: 0.12,
        craterDepthMin: 0.2,
        craterDepthSpan: 0.25,
        latitudeSpan: 0.9,
        broadAmp: 0.1,
        fineAmp: 0.08,
        grooveStrength: 0.02,
        grooveFrequency: 6,
        spongeStrength: 0.02,
        accentStrength: 0.4,
        normalStrength: 3.4,
        normalScale: 1,
        heroicBasin: false,
      };
  }
}

function irregularAmplitude(id: ProceduralMajorMoonId): number {
  switch (id) {
    case 'phobos': return 0.18;
    case 'deimos': return 0.13;
    case 'mimas': return 0.09;
    case 'hyperion': return 0.42;
    case 'phoebe': return 0.12;
    case 'proteus': return 0.15;
    case 'nereid': return 0.08;
  }
}

function accentRgb(
  definition: Readonly<NaturalSatelliteDefinition>,
  seed: number,
): readonly [number, number, number] {
  const baseHex = profileColorHex(definition.visualProfile);
  const base = [
    (baseHex >> 16) & 0xff,
    (baseHex >> 8) & 0xff,
    baseHex & 0xff,
  ] as const;
  const warm = definition.visualProfile.includes('ice') ? -18 : 22;
  const cool = definition.visualProfile.includes('ice') ? 28 : -12;
  const jitter = ((seed >>> 8) & 0xff) / 255;
  return [
    clampByte(base[0] + warm + jitter * 10),
    clampByte(base[1] + (warm + cool) * 0.25),
    clampByte(base[2] + cool - jitter * 8),
  ] as const;
}

function createDataTexture(
  pixels: Uint8Array,
  width: number,
  height: number,
  name: string,
  srgb: boolean,
): DataTexture {
  const texture = new DataTexture(pixels, width, height, RGBAFormat, UnsignedByteType);
  texture.name = name;
  if (srgb) texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function hashText(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function nextSeed(value: number): number {
  return (Math.imul(value, 1_664_525) + 1_013_904_223) >>> 0;
}

function hash2d(x: number, y: number, seed: number): number {
  let value = Math.imul(x + 1, 374_761_393) ^ Math.imul(y + 1, 668_265_263) ^ seed;
  value = Math.imul(value ^ (value >>> 13), 1_274_126_177);
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
}

function valueNoise3(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const n000 = hash2d(xi, yi + zi * 57, seed);
  const n100 = hash2d(xi + 1, yi + zi * 57, seed);
  const n010 = hash2d(xi, yi + 1 + zi * 57, seed);
  const n110 = hash2d(xi + 1, yi + 1 + zi * 57, seed);
  const n001 = hash2d(xi, yi + (zi + 1) * 57, seed);
  const n101 = hash2d(xi + 1, yi + (zi + 1) * 57, seed);
  const n011 = hash2d(xi, yi + 1 + (zi + 1) * 57, seed);
  const n111 = hash2d(xi + 1, yi + 1 + (zi + 1) * 57, seed);
  const x00 = n000 + (n100 - n000) * u;
  const x10 = n010 + (n110 - n010) * u;
  const x01 = n001 + (n101 - n001) * u;
  const x11 = n011 + (n111 - n011) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

function fbm3(x: number, y: number, z: number, seed: number, octaves: number): number {
  let amplitude = 0.5;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += valueNoise3(x * frequency, y * frequency, z * frequency, seed + octave * 1013) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return sum / Math.max(norm, 1e-6);
}

function wrappedLongitude(value: number): number {
  return ((value + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
