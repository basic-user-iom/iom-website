import brightStarPayload from '../../data/catalogs/bright-stars.bsc5p.v1.json';
import { parseBsc5pCatalog } from './CelestialBackground';

export const PHASE_SIX_SKY_TEXTURES = Object.freeze({
  texture4kUrl: `${import.meta.env.BASE_URL}assets/phase6/milky-way-4k.webp`,
  texture8kUrl: `${import.meta.env.BASE_URL}assets/phase6/milky-way-8k.webp`,
});

export const PHASE_SIX_BRIGHT_STARS = parseBsc5pCatalog(brightStarPayload);
