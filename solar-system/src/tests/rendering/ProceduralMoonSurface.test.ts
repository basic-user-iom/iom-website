import { SphereGeometry } from 'three';

import { getNaturalSatelliteDefinition } from '../../simulation/satellites/NaturalSatelliteCatalog';
import { NATURAL_SATELLITE_TEXTURE_BY_ID } from '../../rendering/satellites/NaturalSatelliteAssetCatalog';
import {
  PROCEDURAL_MAJOR_MOON_IDS,
  createMoonBodyGeometry,
  createProceduralMoonMaps,
  isProceduralMajorMoon,
  materialRoughnessForProfile,
  shapeAxesFor,
} from '../../rendering/satellites/ProceduralMoonSurface';
import { NaturalSatelliteVisualSystem } from '../../rendering/satellites/NaturalSatelliteVisualSystem';

describe('ProceduralMoonSurface', () => {
  it('keeps the seven majors without VTAD maps on the procedural path', () => {
    expect(PROCEDURAL_MAJOR_MOON_IDS).toEqual([
      'phobos',
      'deimos',
      'mimas',
      'hyperion',
      'phoebe',
      'proteus',
      'nereid',
    ]);
    for (const id of PROCEDURAL_MAJOR_MOON_IDS) {
      expect(isProceduralMajorMoon(id)).toBe(true);
      expect(NATURAL_SATELLITE_TEXTURE_BY_ID.has(id)).toBe(false);
    }
    expect(isProceduralMajorMoon('io')).toBe(false);
    expect(NATURAL_SATELLITE_TEXTURE_BY_ID.has('io')).toBe(true);
  });

  it('builds distinct color and normal maps with readable crater contrast', () => {
    const phobos = getNaturalSatelliteDefinition('phobos');
    const hyperion = getNaturalSatelliteDefinition('hyperion');
    expect(phobos).toBeDefined();
    expect(hyperion).toBeDefined();

    const phobosMaps = createProceduralMoonMaps(phobos!);
    const hyperionMaps = createProceduralMoonMaps(hyperion!);

    expect(phobosMaps.color.image.width).toBe(1024);
    expect(phobosMaps.color.image.height).toBe(512);
    expect(phobosMaps.normal.image.width).toBe(1024);
    expect(phobosMaps.color.colorSpace).toBe('srgb');
    expect(phobosMaps.roughness).toBeGreaterThan(0.8);
    expect(hyperionMaps.normalScale).toBeGreaterThan(0.9);
    expect(phobosMaps.normalScale).toBeGreaterThan(0.9);

    const phobosPixels = phobosMaps.color.image.data as Uint8Array;
    const hyperionPixels = hyperionMaps.color.image.data as Uint8Array;
    const phobosRange = luminanceRange(phobosPixels);
    const hyperionRange = luminanceRange(hyperionPixels);
    expect(phobosRange).toBeGreaterThan(30);
    expect(hyperionRange).toBeGreaterThan(40);
    expect(pixelVariance(phobosPixels)).toBeGreaterThan(15);
    expect(pixelVariance(hyperionPixels)).toBeGreaterThan(25);
    expect(normalMapHasSlope(phobosMaps.normal.image.data as Uint8Array)).toBe(true);

    phobosMaps.color.dispose();
    phobosMaps.normal.dispose();
    hyperionMaps.color.dispose();
    hyperionMaps.normal.dispose();
  });

  it('sculpts irregular majors instead of leaving a perfect shared sphere', () => {
    const shared = new SphereGeometry(1, 32, 24);
    const hyperion = getNaturalSatelliteDefinition('hyperion');
    const europa = getNaturalSatelliteDefinition('europa');
    expect(hyperion).toBeDefined();
    expect(europa).toBeDefined();

    const irregular = createMoonBodyGeometry(hyperion!, shared);
    const mapped = createMoonBodyGeometry(europa!, shared);
    expect(mapped).toBe(shared);
    expect(irregular).not.toBe(shared);

    const radii = vertexRadii(irregular);
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(0.28);
    expect(shapeAxesFor('hyperion').y).toBeLessThan(0.65);
    expect(materialRoughnessForProfile('mimas-ice')).toBeLessThan(
      materialRoughnessForProfile('phobos-irregular'),
    );

    irregular.dispose();
    shared.dispose();
  });

  it('wires procedural majors with normals and keeps VTAD moons on the official catalog', () => {
    const system = new NaturalSatelliteVisualSystem();
    try {
      const diagnostics = system.getDiagnostics();
      expect(diagnostics.majorCount).toBeGreaterThanOrEqual(23);
      expect(diagnostics.proceduralTextureCount).toBeGreaterThanOrEqual(PROCEDURAL_MAJOR_MOON_IDS.length * 2);

      const hyperion = system.root.getObjectByName('natural-satellite-hyperion') as
        | { material: { map: { name: string }; normalMap: { name: string } | null }; userData: { surfaceMode: string }; geometry: { uuid: string } }
        | undefined;
      const io = system.root.getObjectByName('natural-satellite-io') as
        | { material: { map: { name: string }; normalMap: unknown }; userData: { surfaceMode: string } }
        | undefined;
      expect(hyperion?.material.map.name).toContain('procedural-moon-color-hyperion');
      expect(hyperion?.material.normalMap?.name).toContain('procedural-moon-normal-hyperion');
      expect(hyperion?.userData.surfaceMode).toBe('procedural-irregular');
      expect(io?.material.map.name).toContain('procedural-moon-placeholder-io');
      expect(io?.userData.surfaceMode).toBe('procedural-sphere');
      expect(NATURAL_SATELLITE_TEXTURE_BY_ID.get('io')?.file).toContain('io-nasa-vtad-2k.webp');
    } finally {
      system.dispose();
    }
  }, 30_000);
});

function pixelVariance(pixels: Uint8Array): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let offset = 0; offset < pixels.length; offset += 16) {
    const luminance = (pixels[offset]! * 0.3 + pixels[offset + 1]! * 0.59 + pixels[offset + 2]! * 0.11);
    sum += luminance;
    sumSq += luminance * luminance;
    count += 1;
  }
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

function luminanceRange(pixels: Uint8Array): number {
  let min = 255;
  let max = 0;
  for (let offset = 0; offset < pixels.length; offset += 16) {
    const luminance = pixels[offset]! * 0.3 + pixels[offset + 1]! * 0.59 + pixels[offset + 2]! * 0.11;
    min = Math.min(min, luminance);
    max = Math.max(max, luminance);
  }
  return max - min;
}

function normalMapHasSlope(pixels: Uint8Array): boolean {
  let tilted = 0;
  for (let offset = 0; offset < pixels.length; offset += 64) {
    const dx = Math.abs(pixels[offset]! - 128);
    const dy = Math.abs(pixels[offset + 1]! - 128);
    if (dx > 8 || dy > 8) tilted += 1;
  }
  return tilted > 40;
}

function vertexRadii(geometry: { getAttribute: (name: string) => { count: number; getX: (i: number) => number; getY: (i: number) => number; getZ: (i: number) => number } }): number[] {
  const positions = geometry.getAttribute('position');
  return Array.from({ length: positions.count }, (_, index) =>
    Math.hypot(positions.getX(index), positions.getY(index), positions.getZ(index)),
  );
}
