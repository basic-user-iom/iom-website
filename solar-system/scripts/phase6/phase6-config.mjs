import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, URL, URLSearchParams } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))

export const PROJECT_DIRECTORY = resolve(scriptDirectory, '..', '..')
export const DEFAULT_CACHE_DIRECTORY = join(PROJECT_DIRECTORY, '.cache', 'phase6-sky')
export const DEFAULT_OUTPUT_DIRECTORY = join(PROJECT_DIRECTORY, 'public', 'assets', 'phase6')
export const DEFAULT_CATALOG_DIRECTORY = join(PROJECT_DIRECTORY, 'src', 'data', 'catalogs')
export const GENERATOR_ID = 'iom-phase6-sky-assets/1.0.0'

export const MILKY_WAY_SOURCE = Object.freeze({
  id: 'nasa-svs-deep-star-maps-2020-milky-way-8k-exr',
  organization: 'NASA/Goddard Space Flight Center Scientific Visualization Studio',
  title: 'Deep Star Maps 2020 — Milky Way background without bright stars, 8K OpenEXR',
  record: 'https://svs.gsfc.nasa.gov/4851/',
  machineRecord: 'https://svs.gsfc.nasa.gov/api/4851',
  download:
    'https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/milkyway_2020_8k.exr',
  cacheFileName: 'milkyway_2020_8k.exr',
  width: 8192,
  height: 4096,
  mediaType: 'image/x-exr',
  credit:
    'NASA/Goddard Space Flight Center Scientific Visualization Studio. Gaia DR2: ESA/Gaia/DPAC.',
})

const brightStarQuery = new URL('https://heasarc.gsfc.nasa.gov/xamin/query')
brightStarQuery.search = new URLSearchParams({
  table: 'bsc5p',
  fields: 'hr,ra,dec,vmag,bv_color',
  format: 'stream',
  resultmax: '10000',
  sortvar: 'hr',
}).toString()

export const BRIGHT_STAR_SOURCE = Object.freeze({
  id: 'nasa-heasarc-bsc5p-stream',
  organization: 'NASA High Energy Astrophysics Science Archive Research Center (HEASARC)',
  title: 'Bright Star Catalog, 5th Revised Ed. (BSC5P)',
  record: 'https://heasarc.gsfc.nasa.gov/W3Browse/catalog/bsc5p.html',
  apiDocumentation: 'https://heasarc.gsfc.nasa.gov/docs/xamin-api.html',
  query: brightStarQuery.href,
  cacheFileName: 'bsc5p-hr-ra-dec-vmag-bv.stream.txt',
  expectedRows: 9110,
  expectedRetainedRows: 9096,
  mediaType: 'text/plain; charset=ISO-8859-1',
  catalogCitation:
    'Hoffleit, D. & Warren, W. H. Jr. 1991, Bright Star Catalog, 5th Revised Ed.',
})

// HEASARC identifies these catalog rows as nonstellar objects. They are omitted
// from the point-star layer but remain reproducibly documented in its manifest.
export const NONSTELLAR_BSC5P_HR = Object.freeze([
  92,
  95,
  182,
  1057,
  1841,
  2472,
  2496,
  3515,
  3671,
  6309,
  6515,
  7189,
  7539,
  8296,
])

export const STAR_BINARY = Object.freeze({
  fileName: 'bright-stars.bsc5p.v1.bin',
  magic: 'IOMSTAR\0',
  majorVersion: 1,
  minorVersion: 0,
  headerBytes: 32,
  recordBytes: 20,
  dataOffset: 32,
  flags: 1,
})

export const STAR_JSON_FILE_NAME = 'bright-stars.bsc5p.v1.json'

export const MILKY_WAY_OUTPUTS = Object.freeze([
  Object.freeze({ fileName: 'milky-way-4k.webp', width: 4096, height: 2048 }),
  Object.freeze({ fileName: 'milky-way-8k.webp', width: 8192, height: 4096 }),
])

export const MILKY_WAY_DISPLAY_TRANSFORM = Object.freeze({
  exposure: 1,
  toneMap: 'ACES fitted (Narkowicz approximation)',
  transfer: 'IEC 61966-2-1 sRGB transfer function',
  negativeAndNonfinitePolicy: 'Clamp negative and non-finite linear samples to zero.',
  downsample: 'The 4K tier is a 2 x 2 area average in linear source space.',
  encoder: Object.freeze({
    format: 'WebP',
    quality: 88,
    alphaQuality: 100,
    effort: 6,
    smartSubsample: true,
  }),
})
