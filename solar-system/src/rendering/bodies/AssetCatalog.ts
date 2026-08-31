export type BodyTextureChannel =
  | 'albedo'
  | 'night'
  | 'cloud'
  | 'radar'
  | 'normal'
  | 'ocean'
  | 'roughness'
  | 'grs-detail'
  | 'observation';

export interface BodyTextureAsset {
  readonly assetId: string;
  readonly bodyId: 'sun' | 'mercury' | 'venus' | 'earth' | 'moon' | 'mars' | 'jupiter';
  readonly channel: BodyTextureChannel;
  readonly file: string;
  readonly colorSpace: 'srgb' | 'linear';
}

const PHASE_FOUR_ASSET_ROOT = `${import.meta.env.BASE_URL}assets/phase4/`;
const PHASE_FIVE_ASSET_ROOT = `${import.meta.env.BASE_URL}assets/phase5/`;
const MOON_ASSET_ROOT = `${import.meta.env.BASE_URL}assets/moons/`;

export const BODY_TEXTURE_ASSETS: readonly BodyTextureAsset[] = Object.freeze([
  Object.freeze({
    assetId: 'sun-sdo-hmi-intensity-2025-12-26-2k',
    bodyId: 'sun',
    channel: 'observation',
    file: `${MOON_ASSET_ROOT}sun-hmi-intensity-2025-12-26-2k.webp`,
    colorSpace: 'srgb',
  }),
  Object.freeze({
    assetId: 'mercury-messenger-md3-color-1k',
    bodyId: 'mercury',
    channel: 'albedo',
    file: `${PHASE_FOUR_ASSET_ROOT}mercury.jpg`,
    colorSpace: 'srgb',
  }),
  Object.freeze({
    assetId: 'mercury-messenger-dem-normal-2k',
    bodyId: 'mercury',
    channel: 'normal',
    file: `${PHASE_FOUR_ASSET_ROOT}mercury-normal.png`,
    colorSpace: 'linear',
  }),
  Object.freeze({
    assetId: 'venus-magellan-c3-midr-radar-1k',
    bodyId: 'venus',
    channel: 'radar',
    file: `${PHASE_FOUR_ASSET_ROOT}venus-radar.jpg`,
    colorSpace: 'linear',
  }),
  Object.freeze({
    assetId: 'earth-blue-marble-2k',
    bodyId: 'earth',
    channel: 'albedo',
    file: `${PHASE_FOUR_ASSET_ROOT}earth-day.png`,
    colorSpace: 'srgb',
  }),
  Object.freeze({
    assetId: 'earth-city-lights-2k',
    bodyId: 'earth',
    channel: 'night',
    file: `${PHASE_FOUR_ASSET_ROOT}earth-night.png`,
    colorSpace: 'srgb',
  }),
  Object.freeze({
    assetId: 'earth-blue-marble-derived-normal-2k',
    bodyId: 'earth',
    channel: 'normal',
    file: `${PHASE_FOUR_ASSET_ROOT}earth-normal.png`,
    colorSpace: 'linear',
  }),
  Object.freeze({
    assetId: 'earth-blue-marble-derived-ocean-mask-2k',
    bodyId: 'earth',
    channel: 'ocean',
    file: `${PHASE_FOUR_ASSET_ROOT}earth-ocean.png`,
    colorSpace: 'linear',
  }),
  Object.freeze({
    assetId: 'earth-derived-roughness-2k',
    bodyId: 'earth',
    channel: 'roughness',
    file: `${PHASE_FOUR_ASSET_ROOT}earth-roughness.png`,
    colorSpace: 'linear',
  }),
  Object.freeze({
    assetId: 'earth-modis-clouds-2k',
    bodyId: 'earth',
    channel: 'cloud',
    file: `${PHASE_FOUR_ASSET_ROOT}earth-clouds.jpg`,
    colorSpace: 'linear',
  }),
  Object.freeze({
    assetId: 'moon-lro-lroc-wac-color-2k',
    bodyId: 'moon',
    channel: 'albedo',
    file: `${PHASE_FOUR_ASSET_ROOT}moon.jpg`,
    colorSpace: 'srgb',
  }),
  Object.freeze({
    assetId: 'moon-lola-ldem-normal-2k',
    bodyId: 'moon',
    channel: 'normal',
    file: `${PHASE_FOUR_ASSET_ROOT}moon-normal.png`,
    colorSpace: 'linear',
  }),
  Object.freeze({
    assetId: 'mars-viking-mdim21-color-1k',
    bodyId: 'mars',
    channel: 'albedo',
    file: `${PHASE_FOUR_ASSET_ROOT}mars.jpg`,
    colorSpace: 'srgb',
  }),
  Object.freeze({
    assetId: 'mars-mola-megdr-normal-2k',
    bodyId: 'mars',
    channel: 'normal',
    file: `${PHASE_FOUR_ASSET_ROOT}mars-normal.png`,
    colorSpace: 'linear',
  }),
  Object.freeze({
    assetId: 'jupiter-hubble-opal-2025a-global-map',
    bodyId: 'jupiter',
    channel: 'albedo',
    file: `${PHASE_FIVE_ASSET_ROOT}jupiter-opal-2025.webp`,
    colorSpace: 'srgb',
  }),
  Object.freeze({
    assetId: 'jupiter-junocam-pia23606-grs-detail',
    bodyId: 'jupiter',
    channel: 'grs-detail',
    file: `${PHASE_FIVE_ASSET_ROOT}jupiter-grs-junocam-detail.webp`,
    colorSpace: 'linear',
  }),
]);

export function textureAssetsForBody(bodyId: string): readonly BodyTextureAsset[] {
  return BODY_TEXTURE_ASSETS.filter((asset) => asset.bodyId === bodyId);
}
