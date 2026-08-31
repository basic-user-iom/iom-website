import { Texture, Vector3, type TextureLoader } from 'three';

import {
  PHASE_SIX_BRIGHT_STARS,
  PHASE_SIX_SKY_TEXTURES,
} from '../../rendering/background/BackgroundAssetCatalog';
import {
  CelestialBackground,
  parseBsc5pCatalog,
  tierForQuality,
} from '../../rendering/background/CelestialBackground';
import { ExposureAdaptation } from '../../rendering/ExposureAdaptation';
import brightStarPayload from '../../data/catalogs/bright-stars.bsc5p.v1.json';

describe('Phase 6 celestial-background assets', () => {
  it('selects 4K for low through high and 8K only for supported ultra contexts', () => {
    expect(tierForQuality('low', 8_192)).toBe('4k');
    expect(tierForQuality('medium', 8_192)).toBe('4k');
    expect(tierForQuality('high', 8_192)).toBe('4k');
    expect(tierForQuality('ultra', 8_191)).toBe('4k');
    expect(tierForQuality('ultra', 8_192)).toBe('8k');

    expect(PHASE_SIX_SKY_TEXTURES.texture4kUrl).toMatch(
      /assets\/phase6\/milky-way-4k\.webp$/,
    );
    expect(PHASE_SIX_SKY_TEXTURES.texture8kUrl).toMatch(
      /assets\/phase6\/milky-way-8k\.webp$/,
    );
  });

  it('loads the selected tier and upgrades to 8K only when ultra is supported', () => {
    const supportedLoader = createTextureLoaderStub();
    const supported = new CelestialBackground({
      stars: [TEST_STAR],
      texture4kUrl: '/sky-4k.webp',
      texture8kUrl: '/sky-8k.webp',
      initialQuality: 'high',
      maximumTextureSize: 8_192,
      textureLoader: supportedLoader.loader,
    });

    expect(supportedLoader.load.mock.calls.map(([url]) => url)).toEqual(['/sky-4k.webp']);
    expect(supported.getDiagnostics()).toMatchObject({
      assetState: 'ready',
      textureTier: '4k',
    });
    supported.setQuality('ultra');
    expect(supportedLoader.load.mock.calls.map(([url]) => url)).toEqual([
      '/sky-4k.webp',
      '/sky-8k.webp',
    ]);
    expect(supported.getDiagnostics().textureTier).toBe('8k');
    supported.dispose();

    const limitedLoader = createTextureLoaderStub();
    const limited = new CelestialBackground({
      stars: [TEST_STAR],
      texture4kUrl: '/sky-4k.webp',
      texture8kUrl: '/sky-8k.webp',
      initialQuality: 'ultra',
      maximumTextureSize: 4_096,
      textureLoader: limitedLoader.loader,
    });
    expect(limitedLoader.load.mock.calls.map(([url]) => url)).toEqual(['/sky-4k.webp']);
    expect(limited.getDiagnostics().textureTier).toBe('4k');
    limited.dispose();
  });

  it('remains exactly camera-centered without translating its local sky geometry', () => {
    const loader = createTextureLoaderStub();
    const background = new CelestialBackground({
      stars: [TEST_STAR],
      texture4kUrl: '/sky-4k.webp',
      texture8kUrl: '/sky-8k.webp',
      textureLoader: loader.loader,
    });
    const positionAttribute = background.starPoints.geometry.getAttribute('position');
    const originalStarPosition = [
      positionAttribute.getX(0),
      positionAttribute.getY(0),
      positionAttribute.getZ(0),
    ];

    for (const cameraPosition of [
      new Vector3(12.5, -4.25, 88),
      new Vector3(-9_000, 1_250, 0.125),
    ]) {
      background.updateCameraPosition(cameraPosition);
      background.root.updateMatrixWorld(true);
      expect(background.root.position.toArray()).toEqual(cameraPosition.toArray());
      expect(background.skyMesh.getWorldPosition(new Vector3()).toArray()).toEqual(
        cameraPosition.toArray(),
      );
      expect(background.starPoints.getWorldPosition(new Vector3()).toArray()).toEqual(
        cameraPosition.toArray(),
      );
      expect(background.celestialOrientation.position.toArray()).toEqual([0, 0, 0]);
      expect([
        positionAttribute.getX(0),
        positionAttribute.getY(0),
        positionAttribute.getZ(0),
      ]).toEqual(originalStarPosition);
    }

    expect(() => background.updateCameraPosition(new Vector3(Number.NaN, 0, 0))).toThrow(
      RangeError,
    );
    background.dispose();
  });

  it('validates the generated BSC5P schema and exposes all retained stars', () => {
    expect(brightStarPayload).toMatchObject({
      schema_version: 1,
      catalog_id: 'bright-stars-bsc5p-v1',
      coordinate_frame: {
        system: 'FK5 equatorial',
        equinox: 'J2000.0',
        epoch: 'J2000.0',
      },
      field_order: ['hr', 'ra_rad', 'dec_rad', 'vmag', 'bv_color'],
      filters: {
        source_rows: 9_110,
        retained_rows: 9_096,
      },
    });
    expect(brightStarPayload.filters.excluded_nonstellar_hr).toHaveLength(14);
    expect(brightStarPayload.stars).toHaveLength(9_096);
    expect(PHASE_SIX_BRIGHT_STARS).toHaveLength(9_096);
    expect(PHASE_SIX_BRIGHT_STARS[0]?.hr).toBe(1);
    expect(PHASE_SIX_BRIGHT_STARS.at(-1)?.hr).toBe(9_110);
    expect(Object.isFrozen(PHASE_SIX_BRIGHT_STARS)).toBe(true);
    expect(PHASE_SIX_BRIGHT_STARS.every((star) =>
      Number.isInteger(star.hr) &&
      Number.isFinite(star.rightAscensionRad) &&
      Number.isFinite(star.declinationRad) &&
      Number.isFinite(star.visualMagnitude) &&
      (star.bvColor === null || Number.isFinite(star.bvColor))
    )).toBe(true);

    expect(() => parseBsc5pCatalog({ schema_version: 2, stars: [] })).toThrow(/schema/i);
    expect(() => parseBsc5pCatalog({ schema_version: 1, stars: [[1, 2, 3]] })).toThrow(
      /row 0/i,
    );
    expect(() =>
      parseBsc5pCatalog({ schema_version: 1, stars: [[1, 0, 0, Number.NaN, null]] }),
    ).toThrow(/non-finite/i);
  });

  it('keeps background compensation stable while scene exposure changes', () => {
    const loader = createTextureLoaderStub();
    const background = new CelestialBackground({
      stars: [TEST_STAR],
      texture4kUrl: '/sky-4k.webp',
      texture8kUrl: '/sky-8k.webp',
      textureLoader: loader.loader,
    });
    const adaptation = new ExposureAdaptation();
    const sceneExposures: number[] = [];
    const backgroundCompensations: number[] = [];

    for (const preset of ['deep-space', 'balanced', 'solar-closeup'] as const) {
      adaptation.setPreset(preset, true);
      sceneExposures.push(adaptation.state.exposure);
      backgroundCompensations.push(background.getDiagnostics().exposureCompensation);
    }

    expect(new Set(sceneExposures).size).toBe(3);
    expect(backgroundCompensations).toEqual([1, 1, 1]);
    expect(background.skyMesh.material.toneMapped).toBe(false);
    expect(background.starPoints.material.toneMapped).toBe(false);
    background.dispose();
  });
});

const TEST_STAR = Object.freeze({
  hr: 1,
  rightAscensionRad: 0.25,
  declinationRad: -0.4,
  visualMagnitude: 1.5,
  bvColor: 0.2,
});

function createTextureLoaderStub(): {
  readonly loader: TextureLoader;
  readonly load: ReturnType<typeof vi.fn<(url: string) => Texture>>;
} {
  const load = vi.fn((url: string, onLoad: (texture: Texture) => void) => {
    const texture = new Texture();
    texture.name = url;
    onLoad(texture);
    return texture;
  });
  return {
    loader: { load } as unknown as TextureLoader,
    load,
  };
}
