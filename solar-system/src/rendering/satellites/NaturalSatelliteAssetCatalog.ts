export interface NaturalSatelliteTextureAsset {
  readonly satelliteId: string;
  readonly assetId: string;
  readonly file: string;
  readonly source: 'NASA_VTAD_GLOBAL_MAP';
}

const ASSET_ROOT = `${import.meta.env.BASE_URL}assets/moons/`;

const TEXTURED_MAJOR_MOON_IDS = Object.freeze([
  'io',
  'europa',
  'ganymede',
  'callisto',
  'enceladus',
  'tethys',
  'dione',
  'rhea',
  'titan',
  'iapetus',
  'miranda',
  'ariel',
  'umbriel',
  'titania',
  'oberon',
  'triton',
] as const);

export const NATURAL_SATELLITE_TEXTURE_ASSETS: readonly NaturalSatelliteTextureAsset[] =
  Object.freeze(
    TEXTURED_MAJOR_MOON_IDS.map((satelliteId) => Object.freeze({
      satelliteId,
      assetId: `${satelliteId}-nasa-vtad-global-map-2k`,
      file: `${ASSET_ROOT}${satelliteId}-nasa-vtad-2k.webp`,
      source: 'NASA_VTAD_GLOBAL_MAP' as const,
    })),
  );

export const NATURAL_SATELLITE_TEXTURE_BY_ID = new Map(
  NATURAL_SATELLITE_TEXTURE_ASSETS.map((asset) => [asset.satelliteId, asset]),
);
