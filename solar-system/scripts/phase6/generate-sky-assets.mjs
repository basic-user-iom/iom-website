import { join } from 'node:path'
import process from 'node:process'

import {
  DEFAULT_CACHE_DIRECTORY,
  DEFAULT_CATALOG_DIRECTORY,
  DEFAULT_OUTPUT_DIRECTORY,
  GENERATOR_ID,
  MILKY_WAY_SOURCE,
} from './phase6-config.mjs'
import { generateBrightStarCatalog } from './generate-bright-star-catalog.mjs'
import { generateMilkyWayAssets } from './generate-milky-way-assets.mjs'
import { atomicWriteJson, isDirectRun, parseGeneratorArguments } from './phase6-io.mjs'

const MANIFEST_FILE_NAME = 'sky-manifest.json'

export async function generateSkyAssets(options) {
  const milkyWay = await generateMilkyWayAssets(options)
  const brightStars = await generateBrightStarCatalog(options)
  const manifest = createManifest(milkyWay, brightStars)
  const manifestPath = join(options.outputDirectory, MANIFEST_FILE_NAME)
  await atomicWriteJson(manifestPath, manifest)
  return { manifest_path: manifestPath, ...manifest }
}

function createManifest(milkyWay, brightStars) {
  const assets = [...milkyWay.assets, ...brightStars.assets].map((asset) => ({
    ...asset,
    public_url: `/assets/phase6/${asset.local_file}`,
  }))
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    scope: 'Phase 6 celestial-background generated asset bundle',
    generator: {
      id: GENERATOR_ID,
      entry_point: 'scripts/phase6/generate-sky-assets.mjs',
      generation_commands: {
        clean_checkout_online: 'npm run generate:phase6-sky',
        cached_offline: 'npm run generate:phase6-sky -- --offline',
      },
      source_cache:
        '.cache/phase6-sky (ignored by git; the cached-offline command requires both source files to exist)',
      reproducibility: {
        asset_bytes:
          'With identical source bytes and the locked generator versions, the image and catalog asset bytes are intended to reproduce.',
        manifest_timestamp:
          'generated_at records the wall-clock time of each run, so sky-manifest.json is intentionally not byte-for-byte deterministic.',
      },
      versions: milkyWay.generator_versions,
    },
    coordinate_contract: {
      panorama_reference_system: 'ICRF equatorial, J2000.0',
      star_catalog_reference_system: 'FK5 equatorial, equinox and epoch J2000.0',
      visual_alignment:
        'The renderer treats the ICRF and FK5/J2000 axes as coincident for this visualization; their sub-arcsecond distinction is not modeled.',
      right_handed: true,
      star_directions:
        'Catalog right ascension and declination are stored in radians; they are static J2000 directions.',
      panorama:
        'Plate carrée equatorial projection with RA increasing right-to-left and RA 0h at horizontal center.',
      runtime_scene_mapping:
        'The renderer is responsible for applying one equatorial-to-scene axis map consistently to both panorama and points.',
    },
    sources: [milkyWay.source, brightStars.source],
    assets,
    transformations: {
      milky_way: milkyWay.transforms,
      bright_stars: brightStars.transforms,
    },
    filters: {
      bright_stars: brightStars.filters,
    },
    statistics: {
      milky_way_linear_source: milkyWay.linear_source_statistics,
      bright_stars: brightStars.statistics,
    },
    credits: [
      MILKY_WAY_SOURCE.credit,
      'Bright Star Catalog: Hoffleit, D. & Warren, W. H. Jr. (1991), BSC5P; catalog service provided by NASA HEASARC.',
      'When using HEASARC data, acknowledge NASA HEASARC and the original catalog authors. Attribution does not imply endorsement.',
    ],
    policy_references: [
      'https://www.nasa.gov/nasa-brand-center/images-and-media/',
      'https://heasarc.gsfc.nasa.gov/docs/heasarc/data_policy.html',
    ],
    limitations: [
      'The Milky Way WebPs are deterministic 8-bit display derivatives of the official linear OpenEXR, not unmodified NASA files or radiometrically calibrated measurements.',
      'BSC5P directions are static J2000 catalog coordinates. This bundle does not propagate proper motion, parallax, precession, aberration, or radial velocity.',
      'HEASARC defines the retained Vmag field as photographic magnitude. Vmag_Code and Vmag_Uncert were not requested, so the bundle does not retain per-record magnitude provenance or uncertainty flags.',
      'B-V is retained when present for an approximate display-color cue; it is not a complete spectral energy distribution.',
      'The panorama layer excludes its source product’s separate bright-star layer so the BSC5P points do not intentionally double those stars.',
    ],
  }
}

if (isDirectRun(import.meta.url)) {
  const options = parseGeneratorArguments(process.argv.slice(2), {
    cacheDirectory: DEFAULT_CACHE_DIRECTORY,
    outputDirectory: DEFAULT_OUTPUT_DIRECTORY,
    catalogDirectory: DEFAULT_CATALOG_DIRECTORY,
  })
  if (options.help) {
    process.stdout.write(
      'Usage: node --max-old-space-size=2048 generate-sky-assets.mjs [--offline | --refresh] [--cache-dir PATH] [--output-dir PATH] [--catalog-dir PATH]\n',
    )
  } else {
    const manifest = await generateSkyAssets(options)
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`)
  }
}
