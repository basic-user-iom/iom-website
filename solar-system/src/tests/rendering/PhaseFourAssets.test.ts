import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import {
  BODY_TEXTURE_ASSETS,
  type BodyTextureChannel,
} from '../../rendering/bodies/AssetCatalog';

interface SourceManifestAsset {
  readonly asset_id: string;
  readonly local_files: readonly string[];
  readonly checksum: {
    readonly algorithm: string;
    readonly value: string;
  };
  readonly byte_length: number;
  readonly dimensions: {
    readonly width: number;
    readonly height: number;
  };
  readonly color_space: {
    readonly runtime: string;
  };
  readonly channel: {
    readonly role: BodyTextureChannel;
  };
}

interface SourceManifest {
  readonly assets: readonly SourceManifestAsset[];
}

interface MoonSurfaceManifestAsset {
  readonly id: string;
  readonly file: string;
  readonly width: number;
  readonly height: number;
  readonly byteLength: number;
  readonly sha256: string;
}

interface MoonSurfaceManifest {
  readonly assets: readonly MoonSurfaceManifestAsset[];
}

const PUBLIC_ASSET_ROOT = resolve(process.cwd(), 'public/assets');
const MANIFEST_FILE = resolve(PUBLIC_ASSET_ROOT, 'source-manifest.json');
const MOON_SURFACE_MANIFEST_FILE = resolve(PUBLIC_ASSET_ROOT, 'moons/manifest.json');

const EXPECTED_ASSET_CHANNELS = Object.freeze([
  'sun-sdo-hmi-intensity-2025-12-26-2k:sun:observation',
  'earth-blue-marble-2k:earth:albedo',
  'earth-blue-marble-derived-normal-2k:earth:normal',
  'earth-blue-marble-derived-ocean-mask-2k:earth:ocean',
  'earth-city-lights-2k:earth:night',
  'earth-derived-roughness-2k:earth:roughness',
  'earth-modis-clouds-2k:earth:cloud',
  'jupiter-hubble-opal-2025a-global-map:jupiter:albedo',
  'jupiter-junocam-pia23606-grs-detail:jupiter:grs-detail',
  'saturn-hubble-opal-2025a-global-map:saturn:albedo',
  'mars-mola-megdr-normal-2k:mars:normal',
  'mars-viking-mdim21-color-1k:mars:albedo',
  'mercury-messenger-dem-normal-2k:mercury:normal',
  'mercury-messenger-md3-color-1k:mercury:albedo',
  'moon-lola-ldem-normal-2k:moon:normal',
  'moon-lro-lroc-wac-color-2k:moon:albedo',
  'venus-magellan-c3-midr-radar-1k:venus:radar',
]);

const LINEAR_DATA_CHANNELS = new Set<BodyTextureChannel>([
  'cloud',
  'grs-detail',
  'normal',
  'ocean',
  'radar',
  'roughness',
]);

const DERIVED_2K_PNG_ASSET_IDS = new Set([
  'earth-blue-marble-derived-normal-2k',
  'earth-blue-marble-derived-ocean-mask-2k',
  'earth-derived-roughness-2k',
  'mars-mola-megdr-normal-2k',
  'mercury-messenger-dem-normal-2k',
  'moon-lola-ldem-normal-2k',
]);

describe('Phase 4 and 5 texture asset contract', () => {
  it('declares the exact unique asset/channel set and keeps data maps linear', () => {
    expect(BODY_TEXTURE_ASSETS).toHaveLength(17);
    expect(new Set(BODY_TEXTURE_ASSETS.map((asset) => asset.assetId)).size).toBe(17);
    expect(
      new Set(BODY_TEXTURE_ASSETS.map((asset) => `${asset.bodyId}:${asset.channel}`)),
    ).toHaveProperty('size', 17);

    const actualAssetChannels = BODY_TEXTURE_ASSETS.map(
      (asset) => `${asset.assetId}:${asset.bodyId}:${asset.channel}`,
    ).sort();
    expect(actualAssetChannels).toEqual([...EXPECTED_ASSET_CHANNELS].sort());

    for (const asset of BODY_TEXTURE_ASSETS) {
      if (LINEAR_DATA_CHANNELS.has(asset.channel)) {
        expect(asset.colorSpace, `${asset.assetId} must bypass sRGB decoding`).toBe(
          'linear',
        );
      }
    }
  });

  it('matches every catalog entry to a complete, byte-accurate manifest record', () => {
    const phaseFourFiveAssets = BODY_TEXTURE_ASSETS.filter((asset) => asset.channel !== 'observation');
    expect(existsSync(MANIFEST_FILE)).toBe(true);
    const manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')) as SourceManifest;
    expect(Array.isArray(manifest.assets)).toBe(true);
    expect(manifest.assets).toHaveLength(16);

    const manifestById = new Map(
      manifest.assets.map((asset) => [asset.asset_id, asset] as const),
    );
    expect(manifestById.size).toBe(16);
    expect([...manifestById.keys()].sort()).toEqual(
      phaseFourFiveAssets.map((asset) => asset.assetId).sort(),
    );

    for (const catalogAsset of phaseFourFiveAssets) {
      const manifestAsset = manifestById.get(catalogAsset.assetId);
      expect(manifestAsset, `missing manifest entry for ${catalogAsset.assetId}`).toBeDefined();
      if (manifestAsset === undefined) continue;

      expect(manifestAsset.channel.role).toBe(catalogAsset.channel);
      expect(manifestAsset.local_files).toHaveLength(1);
      const localFile = manifestAsset.local_files[0];
      expect(localFile).toBeDefined();
      if (localFile === undefined) continue;

      const normalizedLocalFile = localFile.replaceAll('\\', '/');
      expect(
        catalogAsset.file
          .replaceAll('\\', '/')
          .endsWith(`/assets/${normalizedLocalFile}`),
      ).toBe(true);

      const absoluteFile = resolve(PUBLIC_ASSET_ROOT, localFile);
      expectPathInsideAssetRoot(absoluteFile);
      expect(existsSync(absoluteFile), `${catalogAsset.assetId} local file`).toBe(true);

      const bytes = readFileSync(absoluteFile);
      expect(statSync(absoluteFile).size).toBe(manifestAsset.byte_length);
      expect(bytes.byteLength).toBe(manifestAsset.byte_length);
      expect(manifestAsset.checksum.algorithm.toUpperCase()).toBe('SHA-256');
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(
        manifestAsset.checksum.value.toLowerCase(),
      );

      if (LINEAR_DATA_CHANNELS.has(catalogAsset.channel)) {
        expect(manifestAsset.color_space.runtime.toLowerCase()).toContain('linear');
      }

      if (DERIVED_2K_PNG_ASSET_IDS.has(catalogAsset.assetId)) {
        expect(manifestAsset.dimensions).toEqual({ width: 2_048, height: 1_024 });
        expect(readPngDimensions(bytes)).toEqual({ width: 2_048, height: 1_024 });
      }
    }
  });

  it('matches the dated Sun observation to the separate moon-surface manifest', () => {
    const sunAsset = BODY_TEXTURE_ASSETS.find((asset) => asset.channel === 'observation');
    expect(sunAsset).toBeDefined();
    expect(existsSync(MOON_SURFACE_MANIFEST_FILE)).toBe(true);
    const manifest = JSON.parse(readFileSync(MOON_SURFACE_MANIFEST_FILE, 'utf8')) as MoonSurfaceManifest;
    const manifestAsset = manifest.assets.find((asset) => asset.id === sunAsset?.assetId);
    expect(manifestAsset).toBeDefined();
    if (sunAsset === undefined || manifestAsset === undefined) return;

    expect(sunAsset.file.replaceAll('\\', '/')).toContain(`/assets/moons/${manifestAsset.file}`);
    const absoluteFile = resolve(PUBLIC_ASSET_ROOT, 'moons', manifestAsset.file);
    expectPathInsideAssetRoot(absoluteFile);
    const bytes = readFileSync(absoluteFile);
    expect(bytes.byteLength).toBe(manifestAsset.byteLength);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifestAsset.sha256);
    expect(manifestAsset).toMatchObject({ width: 2_048, height: 2_048 });
  });
});

function expectPathInsideAssetRoot(absoluteFile: string): void {
  const relativeFile = relative(PUBLIC_ASSET_ROOT, absoluteFile);
  expect(isAbsolute(relativeFile)).toBe(false);
  expect(relativeFile === '..' || relativeFile.startsWith(`..${sep}`)).toBe(false);
}

function readPngDimensions(bytes: Buffer): Readonly<{ width: number; height: number }> {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(bytes.subarray(0, pngSignature.length).equals(pngSignature)).toBe(true);
  expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return Object.freeze({
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  });
}
