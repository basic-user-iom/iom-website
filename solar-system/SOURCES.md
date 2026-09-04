# Sources and provenance

## Observatory texture and catalog refresh

The major-moon texture bundle is generated from embedded base-color images in official NASA Visualization Technology Applications and Development (VTAD) 3D-model resources. The generator accepts an image only when its dimensions identify an approximately 2:1 equirectangular globe map, then resizes it to 2048 x 1024 and encodes a quality-88 WebP. Sixteen resources pass that contract: Io, Europa, Ganymede, Callisto, Enceladus, Tethys, Dione, Rhea, Titan, Iapetus, Miranda, Ariel, Umbriel, Titania, Oberon, and Triton. Example source records include:

- <https://science.nasa.gov/resource/io-3d-model/>
- <https://science.nasa.gov/resource/europa-3d-model/>
- <https://science.nasa.gov/resource/ganymede-3d-model/>
- <https://science.nasa.gov/resource/callisto-3d-model/>
- <https://science.nasa.gov/resource/enceladus-3d-model/>
- <https://science.nasa.gov/resource/triton-3d-model/>

Mimas and Hyperion were inspected but rejected because their embedded 2048 x 2048 and 1024 x 1024 images are mesh-specific UV atlases rather than globe maps. Phobos, Deimos, Phoebe, Proteus, and Nereid had no compatible official global map in this audit. Those seven objects retain distinct deterministic procedural coverage; this is disclosed as an authored fallback and is preferable to presenting a distorted atlas or unrelated generic texture as observed data. Earth's Moon retains the separately documented NASA LRO-derived CGI Moon Kit map.

The Sun addition is a project-generated WebP derivative of the fixed NASA Solar Dynamics Observatory HMI intensitygram at `2025-12-26T00:00:00Z`:

- Data entry point: <https://sdo.gsfc.nasa.gov/data/>
- Exact source image: <https://sdo.gsfc.nasa.gov/assets/img/browse/2025/12/26/20251226_000000_2048_HMIIF.jpg>

The source is an observer-facing solar disk, not an equirectangular map. Runtime therefore extracts active-region contrast on its supported body-local hemisphere and applies it over a continuous procedural photosphere; it does not wrap the observation's absolute color around half of the sphere. The unobserved far side stays procedural. The date remains fixed while the simulation clock changes, so the layer is an appearance reference rather than time-matched solar state.

[`public/assets/moons/manifest.json`](./public/assets/moons/manifest.json) is authoritative for the 17 derivative paths, exact source URLs, observation time, source image names, transforms, dimensions, byte lengths, SHA-256 hashes, rejected atlases, and unresolved fallback list. `scripts/space-objects/generate-major-moon-textures.mjs` performs the networked generation; `npm run space-objects:moon-textures:verify` is the offline release check.

Complete-catalog navigation and the corrected presentation-scale policy are project-authored interface/rendering changes. Search indexes the already bundled body, natural-satellite, OMM, and spacecraft records; it does not contact a live catalog. Major-moon display radii first preserve the physical moon-to-parent radius ratio under the parent's presentation exaggeration, then apply only a bounded contextual legibility floor and a 6.5% parent-radius cap. These display rules do not alter catalog radii or propagated positions.

## Phase 12 tidal-forcing extension provenance

Phase 12 is the final numbered master-plan build. It adds no scientific dataset, downloaded media, runtime asset, third-party shader, package dependency, or license. `THIRD_PARTY_NOTICES.md` therefore requires no Phase 12 license entry. The developer visualization and its URL parser are project-authored implementation work.

The service reuses the bundled NASA/JPL Horizons Sun, Earth, and Moon state vectors and the existing catalog values for body masses and Earth's mean radius. Earth-relative directions are transformed by the existing approximate constant-rate Earth rotation model with its provisional J2000 prime-meridian phase. No new Earth-orientation, geodetic, ocean, or tide dataset is introduced, and the resulting subpoint longitudes are not authoritative IAU/IERS products.

The point-mass differential acceleration, quadrupole tide-generating potential, and center tidal tensors are project-authored classical calculations in SI units. The flagged display accepts only `?experimentalTides=both`, `?experimentalTides=lunar`, or `?experimentalTides=solar`; the setting is URL-only and transient. Its lunar and solar two-bulge shapes are normalized and deliberately exaggerated for legibility, so their rendered size and color are presentation values rather than predicted physical displacement.

This extension is not an ocean-tide prediction and supplies no bathymetry, harmonic constituents, Love numbers, loading, elasticity, self-gravity, hydrodynamics, coastline or basin response, local tide phase, current, or water-height model. It adds no source or licensing claim beyond the ephemeris and catalog records already documented below.

## Phase 11 production-hardening provenance

Phase 11 adds no new scientific dataset, media asset, shader source, or runtime dependency. Its adaptive-resolution controller, frame-statistics sampler, renderer counters, lifecycle guards, context-loss handling, and release checks are project-authored implementation work. The Low/Medium/High/Ultra target values are control thresholds selected for bounded runtime behavior; they are not values taken from a scientific source and are not published benchmark results.

The controller can scale only heavy scenario render targets and returns ordinary observatory rendering to the selected tier's full scale. This changes display sampling cost, never ephemeris vectors, scenario integration, body radii, physical outcomes, or scientific telemetry. Resource diagnostics use browser timing and Three.js renderer counters; they do not constitute a complete CPU, browser, driver, or GPU-memory measurement.

The Phase 11 asset audit retains the exact assets and provenance records already documented below. Runtime image payloads are the recorded PNG, JPEG, and WebP files; the black-hole lookup tables and ephemeris binaries retain their manifest-pinned formats and hashes. The project does not ship KTX2/Basis textures and therefore makes no GPU block-compression claim. `npm run verify:assets` runs the planetary/lunar ephemeris, small-body ephemeris, Phase 6 sky, and Phase 10 lensing verifiers without contacting remote services.

The Earth–Moon camera and shared default `40×` presentation-radius factor are also project-authored presentation choices. Both bodies retain their independent bundled Horizons positions, their physical catalog radii, and their linear center-to-center separation. The shared factor prevents the two exaggerated display spheres from intersecting and preserves the physical Earth-to-Moon radius ratio; it is not a JPL or NASA recommendation.

## Phase 10 black-hole dynamics and lensing basis

### Scenario dynamics

The Phase 10 encounter worker is a project-authored implementation (`GENERATED`/algorithmic). It snapshots the currently selected ephemeris epoch for the Sun, Moon, and all eight planets into Float64 structure-of-arrays storage, recenters those values into a scenario-local frame, and advances a Newtonian point-mass system with a kick-drift-kick velocity-Verlet method. The deterministic adaptive policy chooses only from a fixed list of substeps and never uses explicit Euler integration. Catalogued comets are not assigned fabricated masses, so they are excluded from this worker and visually suppressed while scenario-local body authority is active.

The Schwarzschild radius is calculated from `r_s = 2 G M / c^2` using the configured mass. A separately configurable multiple of that radius is used as a finite capture boundary so the integrator never evaluates the singularity. These equations do not make the orbit solver relativistic. Tidal-state thresholds, disruption streams, the outward-radius ejection classifier, the finite pair-distance clamp, and black-hole capture handling are application models whose scientific limits are recorded in [SCIENTIFIC_NOTES.md](./SCIENTIFIC_NOTES.md); body-body collision outcomes are not implemented.

The Complete Consumption cinematic uses the same state/container architecture plus the project-authored `CinematicInfallForceProvider`. Its tangential damping, inward bias, and authored capture schedule have no external scientific source because they are deliberately nonphysical controls whose purpose is to guarantee the named cinematic result.

### Real-time black-hole rendering reference

The isolated High/Ultra lensing path is grounded in Eric Bruneton's nonrotating real-time black-hole reference and its beam-tracing paper:

- Reference implementation and source: [Eric Bruneton, `black_hole_shader`](https://github.com/ebruneton/black_hole_shader)
- Reference documentation: [Real-time High-Quality Rendering of Non-Rotating Black Holes](https://ebruneton.github.io/black_hole_shader/)
- Technical paper: [Bruneton, 2020, arXiv:2010.08735](https://arxiv.org/abs/2010.08735)
- Reference revision inspected for this implementation: commit `e72b3f293409893a6fa25528b29572c96fc57f57`
- Upstream license: BSD 3-Clause, Copyright (c) 2020 Eric Bruneton; reproduced in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)

Bruneton's reference uses precomputed beam-tracing lookup data to render a nonrotating Schwarzschild black hole, background stars, and an accretion disk in bounded runtime cost. This application ships byte-for-byte copies of the official demo's `deflection.dat` and `inverse_radius.dat` files under [`public/assets/phase10/black-hole/`](./public/assets/phase10/black-hole/). The adjacent manifest records their exact URLs, retrieval date, pinned upstream commit, byte lengths, dimensions, and SHA-256 checksums; the release verifier checks every value plus the finite Float32 payloads. The isolated WebGL postprocess under `src/rendering/black-hole/` adapts the reference's Appendix-A coordinate mappings, precomputed deflection lookup, inverse-radius domain check, and inward-ray branch to the existing Three.js composer, then projects the deflected direction back into a 2D scene buffer for a static distant observer. It does not claim equivalence to Bruneton's complete renderer, cubemap star filtering, disc-intersection shader, relativistic Doppler model, or moving-camera treatment. Medium uses a simpler bounded radial-distortion fallback; Low disables the lensing pass. The accretion-disk colors, Doppler-inspired side-to-side gain, event-horizon presentation floor, redshift/fade, and disruption streams are application-authored visualization choices.

## Phase 6 celestial-background asset bundle

Phase 6 adds a separately versioned celestial-background bundle under [`public/assets/phase6`](./public/assets/phase6). Its authoritative machine-readable record is [`public/assets/phase6/sky-manifest.json`](./public/assets/phase6/sky-manifest.json). This manifest is intentionally separate from the 14-entry Phase 4/5 [`public/assets/source-manifest.json`](./public/assets/source-manifest.json), whose asset identities and runtime semantics remain unchanged.

From a clean checkout with dependencies installed, `npm run generate:phase6-sky` is the online generation command and downloads the exact sources into the ignored `.cache/phase6-sky` directory. `npm run generate:phase6-sky -- --offline` is only a cached regeneration command and fails unless both source files already exist there. With identical source bytes and locked generator versions, the image and catalog asset bytes are intended to reproduce; `generated_at` is a wall-clock run timestamp, so the manifest JSON itself is intentionally not byte-for-byte deterministic.

### NASA SVS Deep Star Maps 2020 background

| Item | Exact source/output | Dimensions | Bytes | SHA-256 |
| --- | --- | ---: | ---: | --- |
| Linear source | [NASA SVS `milkyway_2020_8k.exr`](https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/milkyway_2020_8k.exr) from [Deep Star Maps 2020](https://svs.gsfc.nasa.gov/4851/) | 8192 × 4096 | 137,307,727 | `361d1961647af073b3b3e4aea4fca85f15b3c9d915e0c8c4befb02520dadd10a` |
| 4K runtime derivative | `public/assets/phase6/milky-way-4k.webp` | 4096 × 2048 | 675,372 | `ef5d73597c903ca5f8bff0168df9ebe8ec1776bacedfa1819567cd072f95581b` |
| 8K runtime derivative | `public/assets/phase6/milky-way-8k.webp` | 8192 × 4096 | 5,173,452 | `62c7761c5ae9469cd5bd72889bf7e1871a1c523e46c1695fc5bc0c4baf0fc734` |

The source OpenEXR was retrieved on 2026-08-29 into the ignored `.cache/phase6-sky` build cache. [`scripts/phase6/generate-milky-way-assets.mjs`](./scripts/phase6/generate-milky-way-assets.mjs) decodes its linear half-float RGB samples, clamps negative or non-finite values, applies the pinned exposure-1 ACES-fitted display transform and sRGB transfer function, and encodes 8-bit WebP at quality 88/effort 6. The 8K tier is not spatially resampled. The 4K tier is a linear-space 2 × 2 area average before the same display transform. Neither output is an unmodified NASA file or a radiometrically calibrated product.

The map is plate carrée/equirectangular in ICRF/J2000 equatorial coordinates, with right ascension increasing right-to-left, RA 0h at horizontal center, declination +90° at the top, and −90° at the bottom. The selected `milkyway_2020` source layer omits the source product's separate bright Hipparcos/Tycho stars, preventing intentional duplication with the point catalog below. Required credit: **NASA/Goddard Space Flight Center Scientific Visualization Studio. Gaia DR2: ESA/Gaia/DPAC.**

### HEASARC BSC5P bright-star catalog

The generator queries NASA HEASARC's [Bright Star Catalog, 5th Revised Ed.](https://heasarc.gsfc.nasa.gov/W3Browse/catalog/bsc5p.html) through the documented [Xamin API](https://heasarc.gsfc.nasa.gov/docs/xamin-api.html), requesting only `hr`, `ra`, `dec`, `vmag`, and `bv_color`, sorted by Harvard Revised number with a 10,000-row ceiling. The exact pipe-delimited response contained 9,110 rows, was retrieved on 2026-08-29, is 349,469 bytes, and has SHA-256 `d5a87a534d42928fe5e7ff64d3624dd2b4a7e735e967151539a0edf137b60507`.

Fourteen HEASARC-identified nonstellar rows are removed by explicit HR number: `92`, `95`, `182`, `1057`, `1841`, `2472`, `2496`, `3515`, `3671`, `6309`, `6515`, `7189`, `7539`, and `8296`. The retained 9,096 records store HR, J2000 RA/Dec in radians, HEASARC's `Vmag` value, and optional B−V color. HEASARC documents `Vmag` as photographic magnitude; because the query does not request `Vmag_Code` or `Vmag_Uncert`, these derivatives retain neither each value's provenance code nor its uncertainty/questionable flag. No proper-motion, parallax, aberration, precession, or radial-velocity propagation is applied.

| Output | Role | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `public/assets/phase6/bright-stars.bsc5p.v1.json` | Inspectable provenance copy; not fetched at runtime | 910,168 | `13cca15195b866d1e55a1edea292ee6537127f87057c59d7d64277c4b20ca193` |
| `src/data/catalogs/bright-stars.bsc5p.v1.json` | Byte-identical build import bundled as the runtime input | 910,168 | `13cca15195b866d1e55a1edea292ee6537127f87057c59d7d64277c4b20ca193` |
| `public/assets/phase6/bright-stars.bsc5p.v1.bin` | Compact alternate/verification encoding; not fetched at runtime | 181,952 | `b5275b58e1a0d98fe0422f979077d75325b1c81eaa3b46bbc8d25fd853b1ab0b` |

The binary begins with a 32-byte `IOMSTAR\0` v1.0 header and stores fixed 20-byte records. The complete byte layout, row counts, filters, source query, transformations, checksums, and JSON-copy relationship are pinned in `sky-manifest.json` and verified by [`scripts/phase6/verify-sky-assets.mjs`](./scripts/phase6/verify-sky-assets.mjs). Catalog citation: Hoffleit, D. & Warren, W. H. Jr. (1991), *Bright Star Catalog, 5th Revised Ed.* NASA HEASARC and the original catalog authors should be acknowledged; attribution does not imply endorsement.

## Phase 6 JPL small-body bundle

The comet resolver queried the official [NASA/JPL Small-Body Database API](https://ssd-api.jpl.nasa.gov/doc/sbdb.html) on 2026-08-29 for the exact designations `1P`, `2P`, `67P`, `C/1995 O1`, and `C/2020 F3`. [`src/data/generated/comets.sbdb.json`](./src/data/generated/comets.sbdb.json) retains a normalized, provenance-bearing representation of each pinned response, including canonical identity, SPK ID, orbit solution, covariance/model fields, nongravitational parameters, physical parameters, explicit missing values, request identity, and response digest. Raw responses remain ignored build-cache inputs. The resolver rejects ambiguous or mismatched identities rather than selecting a search result heuristically.

The generator then requested vectors from the official [NASA/JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html), using pinned record commands for Halley (`90000030;`), Encke (`90000091;`), and 67P (`90000703;`), and exact designation commands for Hale-Bopp (`DES=1995 O1;`) and NEOWISE (`DES=2020 F3;`). Returned target names and `JPL#<orbit-id>` source labels must match the catalog. All requests use center `500@10`, reference system `ICRF`, reference plane `ECLIPTIC`, time scale `TDB`, geometric states, and source units `KM-S`; the parser converts each component to SI once. Coverage is 2000-01-01 through 2100-01-01 TDB, split into one-day baseline and six-hour perihelion segments. Normal application use is entirely local and never calls either JPL service.

The small-body visual revision is project-authored and adds no observed image, measured coma/tail field, or asteroid catalog at runtime. Its soft radial-density coma is an opacity heuristic rather than radiative transfer; its narrow ion ribbon follows the instantaneous anti-solar direction; and its curved dust view emits four deterministic grains per age bin from historical ephemeris states. These choices use official qualitative references: NASA's [2P/Encke overview](https://science.nasa.gov/solar-system/comets/2p-encke/), NASA's description of [Encke's compact solar-wind-aligned ion tail](https://www.nasa.gov/science-research/heliophysics/comet-encke-a-solar-windsock-observed-by-nasas-stereo/), JPL's infrared image of [Encke riding its orbit-following debris trail](https://www.jpl.nasa.gov/images/pia07222-riding-a-trail-of-debris/), and ESA's [comet-structure summary](https://www.esa.int/ESA_Multimedia/Images/2023/11/Structure_of_a_comet). The cited Encke debris image is an infrared observation and is not a natural-color texture used by the renderer.

The asteroid and Kuiper belts remain screen-space, tier-normalized statistical marker fields, not physical-size renders or one-to-one object catalogs. Ordinary asteroids are rendered without physical tails. NASA's [asteroid facts](https://science.nasa.gov/solar-system/asteroids/facts/), the Dawn mission's [asteroid-belt spacing explanation](https://science.nasa.gov/mission/dawn/faq/), and ESA's [asteroid structure and composition overview](https://www.esa.int/Science_Exploration/Space_Science/Asteroids_Structure_and_composition_of_asteroids) support the sparse, generally dark, irregular-body interpretation; they are references, not bundled inputs.

| Generated artifact | Role | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `src/data/generated/comets.sbdb.json` | Normalized pinned SBDB sidecar for five logical comets | 344,542 | `b968a71cd70b3b70651a2f2c3f7c0e9f6f1fa82be649d57183f833176b557774` |
| `src/data/generated/small-body-ephemeris.v1.bin` | 101 Float64 IOMEPH physical cadence series | 12,359,016 | `8e68010d0efdec1f42725b042680898d2e8a04f874f5406ff07f06b0f11c53c1` |
| `src/data/generated/small-body-ephemeris.manifest.json` | Per-series Horizons identity, solution, retrieval, and response hashes | 139,133 | `888f053e890dd9c7a31691172f4fa6647872784992a9de15112e23679878cb0c` |
| `src/data/generated/small-body-segments.json` | Five-comet logical routing across the physical series | 31,125 | `944c1e04fec6b4e45ee6fe0414f0a2f30874d8d7a50e1c0a01e4b7cb6b7920b1` |
| `src/data/generated/small-body-ephemeris.validation.json` | Structural results and independent withheld Horizons checks | 253,195 | `7ec626cc73542effbca631fe6be660e43640d39afed9dd1122556127e72559ef` |

The release ID is `jpl-horizons-small-bodies-fa7cdf93908e0612`. Its physical-series counts are Halley 3, Encke 62, 67P 32, Hale-Bopp 1, and NEOWISE 3. The verifier checks binary and routing hashes, exact logical identities, all 101 physical series, 96 shared segment boundaries, and 303 independently requested `TLIST` samples at quarter-step epochs. All checks pass; the maximum measured interpolation differences are `298.858584 m` and `0.0141331 m/s`. These are pipeline comparisons with Horizons, not estimates of the underlying orbit solutions' absolute uncertainty.

## Phase 5 giant-planet visualization inputs

Phase 5 adds three losslessly encoded derivatives of official Hubble/Juno imagery and one versioned project catalog, [`src/data/catalogs/giant-planet-visual-profiles.json`](./src/data/catalogs/giant-planet-visual-profiles.json). The catalog records atmospheric wind inputs, equatorial/polar radii, explicitly categorized storm parameters, and radial ring regions for Jupiter, Saturn, Uranus, and Neptune. It is classified in the file itself as **dated scientific visualization inputs; not a live-weather product**. Numerical provenance does not make the resulting procedural cloud motion, colors, scattering, or complete rendered frame an official scientific product.

Giant-planet mean and equatorial radii follow [NASA/JPL Solar System Dynamics planetary physical parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html). Saturn’s `60,268 km` equatorial and `54,364 km` polar 1-bar radii are also recorded in the [NASA Planetary Data System Cassini CAPS User’s Guide](https://pds.nasa.gov/data/pds4/misc/document_cassini/CAPS_PDS_USER_GUIDE_V1_00.PDF). Runtime scales the shared sphere mesh by those equatorial-to-mean and polar-to-mean ratios; the resulting `≈0.09796` flattening is physical input, not an authored visual exaggeration.

### Hubble OPAL Jupiter map and JunoCam GRS detail

| Asset ID | Local file | Official source record | Exact downloaded resource |
| --- | --- | --- | --- |
| `jupiter-hubble-opal-2025a-global-map` | `public/assets/phase5/jupiter-opal-2025.webp` | [OPAL Jupiter Cycle 32](https://archive.stsci.edu/hlsp/opal/opal-jupiter-cycle-32) | [Rotation A 3600 × 1800 color TIFF](https://archive.stsci.edu/missions/hlsp/opal/cycle32/jupiter/hlsp_opal_hst_wfc3-uvis_jupiter-2025a_f395n-f502n-f631n_v1_globalmap.tif) |
| `jupiter-junocam-pia23606-grs-detail` | `public/assets/phase5/jupiter-grs-junocam-detail.webp` | [NASA Photojournal PIA23606](https://science.nasa.gov/photojournal/the-great-red-spot/) | [2793 × 1156 TIFF](https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia23/pia23606/PIA23606.tif) |
| `saturn-hubble-opal-2025a-global-map` | `public/assets/phase5/saturn-opal-2025.webp` | [OPAL Saturn Cycle 32](https://archive.stsci.edu/hlsp/opal/opal-saturn-cycle-32) | [Rotation A 1800 × 900 color TIFF](https://archive.stsci.edu/missions/hlsp/opal/cycle32/saturn/hlsp_opal_hst_wfc3-uvis_saturn-2025a_f395n-f502n-f631n_v1_globalmap.tif) |

The `19,444,834`-byte TIFF was retrieved from MAST on 2026-08-30 with SHA-256 `52b6cc32639f699ff5614b169c4c2727fff98e7eb432aff7c718177191716e6c`. `scripts/generate-phase5-jupiter-map.mjs` encodes the unchanged 3600 × 1800 RGB pixels as a `4,982,512`-byte lossless WebP with SHA-256 `c23ff8788762b32d49eb53308a979bbe0e574fbe9579fe47d83535dd8b6ec3ac`; it does not crop, resize, reproject, or recolor. OPAL Cycle 32 Rotation A combines Hubble WFC3/UVIS F395N, F502N, and F631N observations acquired on 2025-12-11. It is a dated cloud-map visualization, not current Jovian weather.

The `8,805,142`-byte PIA23606 TIFF was retrieved from NASA Science on 2026-08-30 with SHA-256 `c76e7ff974ab1213585b86c231ce4375c47a301a7ec2d0674469cd013d428bda`. `scripts/generate-phase5-jupiter-grs-detail.mjs` crops and centers the GRS, removes the enhanced-color component by converting to grayscale, subtracts a sigma-16 low-pass from a lightly denoised layer, and writes the neutral-centered residual as a `1,600 × 1,130`, `941,982`-byte lossless WebP with SHA-256 `649535f7350893e24c9625bda1a82951af7412263f0dc198bf834238c89f6b79`. PIA23606 was acquired on 2019-02-12 and resolves features as small as about 50 km. Credit: Image data NASA/JPL-Caltech/SwRI/MSSS; image processing by Kevin M. Gill, © CC BY.

The `4,885,052`-byte Saturn TIFF was retrieved from MAST on 2026-09-01 with SHA-256 `c34a13a8253a39bcc1f8376b24c077b89f05ce0b5202706f535ded20314440d7`. `scripts/generate-phase5-saturn-map.mjs` preserves the 1800 × 900 projection and composite color, encodes black/no-data and ring-obscured pixels as alpha coverage, clamps isolated transiting-body and mosaic outliers within each valid latitude row, and writes a `943,130`-byte lossless RGBA WebP with SHA-256 `42bf2ce013bf9d38fabe0fd09f84a23780ba6b00040b5eaa330ec0cbeb3d58ea`. Runtime uses the observed map at up to `86%` strength over the continuous Cassini-wind-driven layer, so missing coverage is filled by the disclosed procedural atmosphere rather than fabricated image pixels. OPAL Rotation A combines Hubble WFC3/UVIS observations acquired on 2025-08-29; it is a dated cloud-color composite, not measured albedo or current Saturnian weather.

The observed OPAL Great Red Spot lies near normalized source `x = 0.106` at approximately `−22°` latitude. Runtime sampling calibrates it to visual longitude `+142°` at the map epoch, fills its source location from both neighboring sides of the same latitude band when it drifts away, and reuses the observed OPAL color pixels inside the tracked vortex. The inner vortex receives only restrained PIA23606 luminance residuals; its 2019 enhanced color is not imported. This is an illustrative multi-epoch enhancement, not a calibrated 2025 reconstruction. The counterclockwise circulation, collar lag, drift, and pulsation are project rendering operations; they are not a reprojection, measured velocity solution, or historical reconstruction supplied by Hubble, OPAL, or JunoCam. Extreme-polar map rows are faded to project-authored haze rather than shown as black/no-data pixels.

### Wind and dated-feature sources

| Body | Catalog input | Primary reference | Runtime interpretation and limitation |
| --- | --- | --- | --- |
| Jupiter | Compact exact latitude/wind rows from HST/OPAL cloud tracking, with a project taper from the measured `±60°` boundary to zero at the poles | [Schmider et al. 2024, DOI 10.3847/PSJ/ad3066](https://doi.org/10.3847/PSJ/ad3066) | Linear latitude interpolation drives restrained procedural atmosphere motion while the dated Hubble map remains sharp and static. It is not a dynamical atmosphere or a weather state at the selected epoch. |
| Jupiter Great Red Spot | Approximate center, angular dimensions, longitudinal drift, 90-day oscillation, and vortex timing | [Simon et al. 2024, DOI 10.3847/PSJ/ad71d1](https://doi.org/10.3847/PSJ/ad71d1) | The shader circulates observed OPAL source pixels counterclockwise, adds a subtle periodic collar lag, and retains `5%` pulsation. Category: `animated-visualization`, not an observed velocity field or forecast shape evolution. |
| Saturn | Compact exact rows from the Cassini ISS CB2 750 nm cloud-top profile | [NASA GISS CB2 wind table](https://data.giss.nasa.gov/cassini/winds/cb2_winds.txt) and [Del Genio & Barbara 2012, DOI 10.1016/j.icarus.2012.03.035](https://doi.org/10.1016/j.icarus.2012.03.035) | Linear interpolation explicitly bridges missing source spans `+5.5°` to `−6.5°`, `−40.5°` to `−43.5°`, and `−54°` to `−57.5°`. Values inside those bridges are inferred, not measurements. |
| Uranus | A 14-coefficient Legendre drift model converted to zonal speed using the catalog ellipsoid | [Sromovsky et al., *Post-equinox dynamics and polar cloud structure on Uranus*, DOI 10.1016/j.icarus.2012.05.029](https://doi.org/10.1016/j.icarus.2012.05.029), [open preprint](https://arxiv.org/pdf/1503.00592), and [Fletcher et al. 2020 review, DOI 10.1007/s11214-020-00646-1](https://doi.org/10.1007/s11214-020-00646-1) | The implementation converts westward drift to an east-positive residual relative to the adopted rotation. It is an analytic visualization profile, not date-resolved circulation. |
| Neptune | Voyager cloud-tracking polynomial `u = −389 + 0.188 φ² − 1.2×10⁻⁵ φ⁴ m/s` through absolute latitude `75°`, with a project cosine taper to zero at the poles | [French, McGhee-French & Sicardy 1998, DOI 10.1006/icar.1998.6001](https://doi.org/10.1006/icar.1998.6001) | The polynomial is interpreted east-positive relative to a `16.11 h` reference rotation. The polar taper is a project boundary treatment outside the stated domain. |
| Neptune NDS-2018 | Finite catalog visibility interval, approximate center, size, contrast, and drift | [Wong et al. 2026, DOI 10.1029/2026GL122748](https://doi.org/10.1029/2026GL122748) | Category: `dated-nonpermanent-visualization`. The feature is rendered only inside its catalog interval and fades illustratively; longitude and appearance are not an ephemeris or a reconstruction of every observation. |

The `jetSamples` arrays retained beside the Uranus and Neptune analytic models are documented fallback knots; the current sampler uses the analytic models. All shader noise, latitude blending, band contrast, haze, feature deformation, and time evolution are project-authored.

### Ring-system sources

| Body | Source | Catalog coverage |
| --- | --- | --- |
| Saturn | [NASA PDS Ring-Moon Systems Node: Saturn ring vital statistics](https://pds-rings.seti.org/saturn/saturn_rings_table.html) | D, C, B, A, and F rings; Cassini and Roche divisions; Colombo, Maxwell, Huygens, Encke, and Keeler gaps; representative radial optical depths. |
| Uranus | [NASA PDS Ring-Moon Systems Node: Uranus](https://pds-rings.seti.org/uranus/) | Zeta, 6, 5, 4, alpha, beta, eta, gamma, delta, lambda, and epsilon ring radii/widths with simplified optical-depth inputs. |
| Neptune | [NASA PDS Ring-Moon Systems Node: Neptune](https://pds-rings.seti.org/neptune/) | Galle, Le Verrier, Lassell, Arago, and Adams ring regions, plus metadata identifying localized Adams-ring arcs. |

The renderer samples these profiles into a one-dimensional radial texture and draws a geometrically thin annulus in each planet's visual equatorial plane. Catalog radii and optical-depth inputs inform radial structure, while RGB colors, display gains, subpixel filtering, forward-scattering approximation, sparkle, Saturn spoke timing/shape, and Neptune arc longitudes/contrast are project choices. Ring shadows use analytic ray/ellipsoid tests. No particle dynamics, self-shadowing between individual ring particles, shepherd-moon forcing, wave structure, occultation inversion, or date-resolved spoke/arc ephemeris is implemented.

### Coordinate and sign conventions

- Horizons translation remains in its declared `ICRF`/`ECLIPTIC` source axes until the floating origin is subtracted; scene mapping then uses `(x, z, −y)`.
- The physical rotating-body frame uses local `+Z` as the north pole. Three.js sphere and ring geometry use a visual-local frame with `+Y` north, related by the same `(x, z, −y)` component mapping. Ring annuli therefore occupy the visual-local `XZ` equatorial plane.
- Texture and close-up targeting use **visual longitude**, not an authoritative IAU System I/II/III prime meridian. Jupiter's preset tracks the synthesized vortex after its catalog drift rather than claiming a spacecraft pointing solution.
- Wind signs are interpreted in the reference frames declared by each catalog entry. Their use as texture-coordinate advection must not be treated as a direct map of parcel motion or as an absolute rotation model.

## Phase 4 visual asset bundle

Phase 4 bundles 13 local runtime textures for Mercury, Venus, Earth, the Moon, and Mars. Seven color/radar/cloud images were retrieved on 2026-08-28 from the official NASA or USGS URLs below and renamed without changing their bytes. Six additional PNGs were deterministically generated by [`scripts/generate-phase4-derived-maps.mjs`](./scripts/generate-phase4-derived-maps.mjs): three normal maps from quantitative planetary elevation rasters and three Earth rendering maps from Blue Marble image heuristics.

The machine-readable record at [`public/assets/source-manifest.json`](./public/assets/source-manifest.json) is authoritative for all 16 Phase 4/5 local paths, byte lengths, dimensions, SHA-256 digests, encoded/runtime color handling, source-raster identities, transformations, and channel semantics.

### Official runtime source files

| Asset ID | Local file | Official source record | Exact downloaded resource |
| --- | --- | --- | --- |
| `mercury-messenger-md3-color-1k` | `public/assets/phase4/mercury.jpg` | [Mercury MESSENGER MDIS Basemap MD3 Color Global Mosaic 665m](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_basemap_md3_color_global_mosaic_665m) | [USGS 1024-pixel JPEG](https://astrogeology.usgs.gov/ckan/dataset/fc37692f-e806-4632-b300-0250bb61c3de/resource/b1ef80b6-a44a-4c24-8786-e5e901842657/download/mercury_messenger_mdis_basemap_md3color_mosaic_global_1024.jpg) |
| `venus-magellan-c3-midr-radar-1k` | `public/assets/phase4/venus-radar.jpg` | [Venus Magellan Global C3-MDIR Mosaic 2025m](https://astrogeology.usgs.gov/search/map/venus_magellan_global_c3_mdir_mosaic_2025m) | [USGS full browse JPEG](https://astrogeology.usgs.gov/ckan/dataset/bf10c4f9-7587-4357-b0d9-81d5b6e6637c/resource/12345d86-e2a3-45eb-af88-c1e8bf3ac358/download/full.jpg) |
| `earth-blue-marble-ng-topography-8k` | `public/assets/phase4/earth-day-8k.webp` | [Blue Marble: Next Generation with Topography](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography/) | [NASA/GSFC 21600 × 10800 JPEG](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography/august/world.topo.200408.3x21600x10800.jpg), resampled to 8192 × 4096 WebP |
| `earth-black-marble-2016-8k` | `public/assets/phase4/earth-night-8k.webp` | [Earth at Night / Black Marble flat maps](https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/) | [NASA/GSFC 13500 × 6750 JPEG](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg), resampled to 8192 × 4096 WebP |
| `earth-modis-clouds-8k` | `public/assets/phase4/earth-clouds-8k.webp` | [Blue Marble: Clouds](https://visibleearth.nasa.gov/images/57747/blue-marble-clouds/77558l) | [NASA/GSFC 8192 × 4096 TIFF](https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_8192.tif), encoded as quality-74 WebP |
| `moon-lro-lroc-wac-color-2k` | `public/assets/phase4/moon.jpg` | [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/) | [NASA/GSFC 2048 × 1024 JPEG](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg) |
| `mars-viking-mdim21-color-1k` | `public/assets/phase4/mars.jpg` | [Mars Viking Colorized Global Mosaic 232m](https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m) | [USGS 1024-pixel JPEG](https://astrogeology.usgs.gov/ckan/dataset/7131d503-cdc9-45a5-8f83-5126c0fd397e/resource/6afad901-1caa-48a7-8b62-3911da0004c2/download/mars_viking_mdim21_clrmosaic_global_1024.jpg) |

Mercury, Venus, Moon, and Mars are byte-for-byte downloads. The three documented Earth runtime images are resolution-conscious WebP adaptations of the linked official NASA sources; none is cropped, reprojected, recolored, or channel-edited.

### Generated runtime files

| Asset ID | Local file | Classification | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| `mercury-messenger-dem-normal-2k` | `public/assets/phase4/mercury-normal.png` | Quantitative USGS DEM-derived normal; linear | 548,455 | `5c052c899d2f189f28f4971880643b5779d0207c5682d0620b65a05f7e4bea85` |
| `moon-lola-ldem-normal-2k` | `public/assets/phase4/moon-normal.png` | Quantitative NASA LOLA displacement-derived normal; linear | 1,336,846 | `dccc06061532874a2b77f5f62a6cf2d504e233e2b4fbeae98014c15ef8cf481d` |
| `mars-mola-megdr-normal-2k` | `public/assets/phase4/mars-normal.png` | Quantitative NASA MOLA topography-derived normal; linear | 1,647,954 | `88f990173a18dc3521149fe9e8c10ae86f932be4a20101ba492ac64cd99c94fe` |
| `earth-blue-marble-derived-normal-2k` | `public/assets/phase4/earth-normal.png` | Project-authored Blue Marble luminance-relief proxy; linear | 1,114,540 | `1f47978d1b1a2e08856fc23aa986a2ef66208e781b6f166caffa546811fe5722` |
| `earth-blue-marble-derived-ocean-mask-2k` | `public/assets/phase4/earth-ocean.png` | Project-authored Blue Marble blue-dominance mask; linear | 268,976 | `c6d9611e2e1ec86eed43d9139edfd9f12ce3867eacb75f6c47e55a367c66e3b3` |
| `earth-derived-roughness-2k` | `public/assets/phase4/earth-roughness.png` | Project-authored material parameter; linear | 488,853 | `ed9a2cdfa907edeacd5b84b00e5ccdd534a2e4a5474bde714ba72dbb55ac02f5` |

All six generated maps are 2048 × 1024 PNGs and are sampled as linear data, never as sRGB color. Their retained quantitative source inputs are:

| Body | Official source and exact resource | Source dimensions | Bytes | SHA-256 |
| --- | --- | ---: | ---: | --- |
| Mercury | [USGS Mercury MESSENGER Global DEM 665m record](https://astrogeology.usgs.gov/search/map/mercury_messenger_global_dem_665m) · [GeoTIFF](https://planetarymaps.usgs.gov/mosaic/Mercury_Messenger_USGS_DEM_Global_665m_v2.tif) | 23,040 × 11,520 | 530,934,581 | `defce776241dcaf44cb0f081ee508c17dbea28aa5a22880bf7a5e8c25f96cbea` |
| Moon | [NASA CGI Moon Kit / LOLA record](https://svs.gsfc.nasa.gov/4720/) · [unsigned 16-bit TIFF](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif) | 5,760 × 2,880 | 33,201,026 | `45a2b32d56e81ed30db07fead8abc842b249b6511219d9ca2c53f81bc2dc5d62` |
| Mars | [NASA PDS MOLA MEGDR record](https://pds-geosciences.wustl.edu/missions/mgs/megdr.html) · [16-pixel/degree IMG](https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg016/megt90n000eb.img) · [PDS4 label](https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg016/megt90n000eb.xml) | 5,760 × 2,880 | 33,177,600 | `d18d9b9ab8c5516d02e157dd2cde0f1d0d160c21940e953ba22391269a545e7b` |

The Mercury GeoTIFF stores metres relative to the 2,439,400 m datum radius. The Moon TIFF stores unsigned half-metre LOLA samples; its constant unsigned offset cancels when gradients are taken. The Mars IMG stores big-endian signed 16-bit metres above the MOLA areoid. Mercury and Mars use positive-east 0–360° longitude, so the generator rolls both by 180° to align with the runtime color maps. It downsamples the quantitative rasters, computes wrapped central differences with latitude-aware east-west spacing, and encodes tangent-space normals. Visual slope amplification is `36×` for Mercury, `48×` for the Moon, and `1.4×` for Mars. These factors affect shading legibility; no sphere vertices are displaced.

The three Earth maps have a different evidentiary status. They are regenerated from the exact bundled 8192 × 4096 Blue Marble runtime input (`2,270,416` bytes; SHA-256 `0a609bdc1df3ef5e58b516151056e2a0bd9455ccd21d47660008eeb982df0049`). The normal is a restrained finite-difference cue from image luminance, not elevation. The ocean mask is a smooth blue-dominance classification, not authoritative coastline data. Roughness is an authored blend of lower ocean and higher land-like values, not a measured NASA/USGS PBR product. Exact formulas are recorded in the machine-readable manifest and generator source.

### Representation and product caveats

- **Mercury:** the color map is the MD3 false-color product, not the principal-component “enhanced color” mosaic and not a natural-eye rendering. Its RGB channels contain the MESSENGER MDIS 1000 nm, 750 nm, and 430 nm bands respectively. Its separate normal map is quantitatively DEM-derived but visually slope-amplified.
- **Venus:** the bundled image is the achromatic C3-MIDR radar mosaic, not the separate synthetic-color product. Magellan SAR brightness depends on surface roughness, slope and look direction, dielectric properties, and processing geometry. It is neither optical albedo nor elevation, and the browse image preserves visible gaps and seam artifacts.
- **Earth day and derived maps:** Blue Marble is a static, stitched visualization assembled from observations acquired over time; it is not an instantaneous photograph or live surface state. It includes compositing and shaded topography. The Earth normal, ocean, and roughness files inherit those image limitations and are explicitly heuristic.
- **Earth night:** the DMSP Operational Linescan System city-light image is a static composite of permanent-light observations. Runtime use as night-side emission is illustrative, not a calibrated, current energy or population map.
- **Earth clouds:** the source record describes two days of visible imagery plus a third day of thermal-infrared polar imagery. It is a static RGB JPEG with no alpha channel; runtime averages its channels into a density mask and moves the whole cloud shell. It is not current weather or a forecast.
- **Moon:** the 2025 CGI Moon Kit color map uses LROC WAC 643/566/415 nm data, white-balance and exposure adjustments, inpainting, and lower-resolution monochromatic LOLA albedo outside the principal WAC latitude coverage. NASA explicitly describes this color map as optimized for aesthetics rather than scientific analysis. Its separate normal map comes from quantitative LOLA displacement.
- **Mars:** the NASA Ames/USGS color product is explicitly artistically colorized. It blends an older Viking color mosaic over controlled grayscale MDIM 2.1; the grayscale source processing emphasizes morphology and suppresses regional albedo. It must not be described as calibrated true color. Its separate normal map comes from quantitative MOLA topography.

The runtime maps are global equirectangular-style 2:1 textures. Compact browse dimensions and resampled normals limit surface inspection, and a texture's presence does not make the rendered lighting, material, orientation, atmosphere, or complete frame an official source product.

### Phase 4/5 project-authored algorithms

The following Phase 4/5 components are project implementations (`GENERATED`/algorithmic). Cited NASA, USGS, PDS, and scholarly inputs do not make these complete algorithms official source products:

- Mercury, Moon, and Mars use project-generated normal textures derived from official quantitative elevation products. Their resampling, tangent-space conversion, and visual slope amplification are project choices. Earth instead uses separate heuristic normal, ocean, and roughness maps derived from Blue Marble image values; those three are not quantitative geophysical datasets.
- The Sun uses a procedural photosphere whose high and ultra tiers add finer multiscale granulation and intergranular lanes. Structured penumbra, umbra, and limb-weighted faculae remain deterministic shader fields. The photosphere's authored display-emission multiplier is `1.48`, and each quality-gated corona shell is progressively fainter outward. These choices were checked qualitatively against the official [SDO HMI/AIA channel descriptions](https://sdo.gsfc.nasa.gov/data/channels.php) and NASA SVS's [February 2013 *Busy Sun* HMI visible-light sequence and 4K frames](https://svs.gsfc.nasa.gov/4133/). Neither source is bundled or sampled at runtime: the rendered Sun is not an observed texture, a live feed, a timestamp-matched solar disk, a magnetic model, or radiometric output. Restrained HDR bloom and local exposure presets remain authored display controls.
- Earth atmosphere rendering uses project-precomputed RGB transmittance, approximate multi-scattering, and sky-view lookup textures. The compact model is physically parameterized but not a full spectral, iterative 4D radiative-transfer solver. Venus uses two layered procedural cloud decks over an optional Magellan radar **data view**. Both layers now share one modeled four-day westward superrotation while keeping a fixed phase offset; procedural chevrons, zonal bands, a polar hood, restrained UV-absorber-inspired contrast, and softer twilight were informed qualitatively by NASA's [Hubble ultraviolet cloud-top description](https://science.nasa.gov/photojournal/venus-cloud-tops-viewed-by-hubble/) and the [Akatsuki UVI instrument description](https://darts.isas.jaxa.jp/missions/akatsuki/uvi_en.html). No Akatsuki radiance map or wind vector is sampled, so this is not observed, current, date-matched, or cloud-motion-vector-driven Venus weather. Earth keeps the cloud shell independent from the surface and combines a separate ocean-glint mask with terminator-gated city lights. Mars combines mapped surface/topography with procedural polar-cap, dust-cloud, and haze treatments.
- Phase 5 gives Jupiter, Saturn, Uranus, and Neptune dedicated project-authored giant-planet shaders driven by the sourced catalog above. Jupiter and Saturn add dated Hubble OPAL 2025a visual foundations with documented coverage handling; Uranus and Neptune remain procedurally colored. Ring rendering, modeled storm motion, procedural atmosphere flow, shadow approximations, and all display effects remain project implementations.
- Body-to-Sun direction and nominal inverse-square irradiance come from Float64 ephemeris positions. The inertial Sun vector is transformed into each rotating body's local frame before the surface/cloud shaders evaluate illumination. Display exposure remains compressed and is not radiometric output.
- Apparent-disc overlap of spherical bodies produces a uniform visible-Sun fraction for analytic eclipse dimming. It does not trace a spatial umbra or penumbra across a body's surface or atmosphere.
- Constant-rate rotation models use catalog seed periods and axial tilts with a provisional inertial tilt node and prime-meridian phase. The Moon instead uses an approximate line-of-centers synchronous orientation. Authoritative IAU pole/prime-meridian series and lunar physical libration remain pending.
- The Phase 12 tide-ready service evaluates Earth-fixed sublunar/subsolar geometry, separate point-mass lunar and solar quadrupole forcing, differential acceleration, and center tidal tensors from the bundled ephemerides and catalog masses. Its URL-flagged two-bulge view is normalized and exaggerated display geometry, not an ocean-tide model; it contains no bathymetry, harmonic constituents, Love numbers, loading, elasticity, self-gravity, or hydrodynamics.

For a possible future observed Venus foundation, the project evaluated the CC BY 4.0 [Akatsuki UVI Level 3 longitude-latitude radiance maps](https://doi.org/10.17597/isas.darts/vco-00016) and [Akatsuki Cloud Motion Vector dataset](https://doi.org/10.17597/isas.darts/vco-00020). They are references and candidate future inputs only. This revision did not download, derive, bundle, or redistribute either dataset, and added no third-party runtime asset or license obligation.

The Phase 4/5 shader code, normal/material-map generation, atmosphere lookup integration, post-processing integration, and visualization logic described in this section are project-authored. Phase 10's separately isolated and attributed black-hole lensing path is the sole exception to the earlier no-third-party-shader statement; its provenance and complete license are recorded in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

See [SCIENTIFIC_NOTES.md](./SCIENTIFIC_NOTES.md) for the rendering and model limitations, and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for attribution and media-use policies.

## Phase 2 generated ephemeris

The application bundles a generated NASA/JPL Horizons vector dataset. Retrieval and generation completed on 2026-08-28; the production browser never calls Horizons.

Official references, accessed 2026-08-28:

- NASA/JPL Horizons API documentation: <https://ssd-api.jpl.nasa.gov/doc/horizons.html>
- NASA/JPL Horizons system manual: <https://ssd.jpl.nasa.gov/horizons/manual.html>
- NASA/JPL Horizons API endpoint used by the build-time cache: <https://ssd.jpl.nasa.gov/api/horizons.api>

### Query and representation contract

- Provider: `JPL_HORIZONS`
- Query center: `500@10` (Sun); manifest center ID: `10`
- Reference system: `ICRF`
- Reference plane: `ECLIPTIC` (ecliptic plane for the returned Cartesian axes)
- Time scale: `TDB`
- Vector table: state vectors (`VEC_TABLE=2`)
- Aberration correction: none (`VEC_CORR=NONE`), so states are geometric
- Source units: `KM-S`
- Stored units: position in meters, velocity in meters per second
- Coverage: `JD 2451544.5` through `JD 2488069.5`, inclusive; 2000-01-01 through 2100-01-01 TDB
- Cadence: one day for the Sun and planets; six hours for the Moon
- Generator: `iom-ephemeris-generator/1.0.0`

The parser validates target/center metadata and a complete `$$SOE`/`$$EOE` block before converting to SI. Raw responses are cached for reproducible build work but are not shipped to the browser.

### Bodies and Horizons solutions

| Body | Horizons target | Center | Cadence | Solution reported by response |
| --- | ---: | ---: | ---: | --- |
| Sun | 10 | 500@10 | 1 day | DE441 |
| Mercury | 199 | 500@10 | 1 day | DE441 |
| Venus | 299 | 500@10 | 1 day | DE441 |
| Earth | 399 | 500@10 | 1 day | DE441 |
| Moon | 301 | 500@10 | 6 hours | DE441 |
| Mars | 499 | 500@10 | 1 day | mar099 |
| Jupiter | 599 | 500@10 | 1 day | jup365_merged |
| Saturn | 699 | 500@10 | 1 day | sat441l |
| Uranus | 799 | 500@10 | 1 day | ura184_merged |
| Neptune | 899 | 500@10 | 1 day | nep098_merged |

The exact response hashes and per-body retrieval timestamps are recorded in `src/data/generated/solar-system-ephemeris.manifest.json`.

### Artifact identity

- Dataset ID: `jpl-horizons-7099a7cebc78d3e0`
- Binary: `src/data/generated/solar-system-ephemeris.v1.bin`
- Exact binary length: `22,792,656` bytes
- Manifest-pinned SHA-256: `9f888e0cb3d5d44e23bd0dd56d9926a00ccadb8dde8a1bad9d51b96c2510437c`
- Format: `IOMEPH` 1.0, little-endian Float64, components `px,py,pz,vx,vy,vz`
- Manifest generated: `2026-08-28T19:22:38.799Z`

Sidecars:

- `solar-system-ephemeris.manifest.json` records binary identity, format, coverage, cadence, query metadata, retrieval timestamps, source-response hashes, and source solutions.
- `validation-references.json` records 240 separately requested, withheld Horizons `TLIST` states and per-body tolerances.
- `solar-system-ephemeris.validation.json` records structural checks and measured Hermite interpolation errors. All checks passed when generated on 2026-08-28.

## Generated algorithms

### Cubic Hermite interpolation

- Provider: project implementation (`GENERATED`)
- Inputs: adjacent Horizons position and velocity samples
- Output: interpolated SI position and velocity at an in-coverage TDB epoch
- Validation: compared with independent Horizons `TLIST` samples; see [SCIENTIFIC_NOTES.md](./SCIENTIFIC_NOTES.md)
- Limitation: interpolation accuracy is cadence- and trajectory-dependent and is not a force model

### Worker decoding and integrity

- Provider: project implementation (`GENERATED`)
- The browser fetches only Vite-bundled local assets.
- SHA-256 is checked against the manifest before the binary is decoded in a Web Worker.
- The provider does not silently substitute circular or fixed states when data is missing or out of range.

## Extension phase source contracts

Natural-satellite identity/count references use NASA’s Solar System Moons overview and the JPL Solar System Dynamics satellite ephemeris service:

- <https://science.nasa.gov/solar-system/moons/>
- <https://ssd.jpl.nasa.gov/sats/>
- <https://ssd.jpl.nasa.gov/sats/ephem/>
- <https://ssd.jpl.nasa.gov/horizons/>

The bundled natural-satellite catalog is a dated `2026-08-31` snapshot contract. `major-moon-anchors.horizons.v1.json` contains 526 parent-centered `ICRF`/`ECLIPTIC`, TDB, SI-converted position/velocity anchors for each of 24 major moons from 1990 through 2035. Its generator verifies target and parent identities in each Horizons response. Runtime propagation restarts from the nearest preceding anchor and does not linearly join sparse fast-moon positions. Compact minor-point records preserve the official snapshot count and remain marked as approximations. No browser request is made to these sources.

Earth-orbit object ingestion follows CelesTrak’s public OMM format and usage policy:

- <https://celestrak.org/NORAD/elements/>
- <https://celestrak.org/NORAD/documentation/gp-data-formats.php>
- <https://celestrak.org/usage-policy.php>

`generate-earth-satellite-catalog.mjs` queries five curated catalog IDs through CelesTrak's OMM JSON endpoint, validates and normalizes every field, and writes a checksummed artifact. Network refresh was unavailable for this build, so the committed artifact retains `fallback: true`; it records retrieval time, element epoch, category, string catalog ID, source frame (`TEME`), and generator version. Runtime propagation uses `satellite.js` SGP4/SDP4 plus explicit data-age windows. It is intentionally small and offline; it is not a live feed or a complete catalog.

Spacecraft trajectory records follow the JPL Horizons mission-data contract; NAIF SPICE remains a documented alternative source for future mission-specific kernel work:

- <https://ssd.jpl.nasa.gov/horizons/>
- <https://naif.jpl.nasa.gov/naif/spiceconcept.html>
- <https://naif.jpl.nasa.gov/naif/data.html>

`spacecraft-trajectories.horizons.v1.json` contains 15,583 geometric heliocentric position/velocity samples for 14 missions, generated from exact Horizons spacecraft IDs relative to `500@10`. Runtime uses piecewise cubic Hermite interpolation and rejects dates outside each returned interval. These are Horizons states, not authored curves and not reconstructed SPICE navigation solutions.

## Phase 1 records retained

### Astronomical unit

- Value: exactly `149,597,870,700 m`
- Use: unit conversion, scale tests, and the historical Phase 1 fixed Earth fixture
- Authority: IAU 2012 Resolution B2, which defines the astronomical unit as an exact conventional length
- Reference: <https://www.iau.org/static/resolutions/IAU2012_English.pdf>
- Retrieval: documentation reference recorded 2026-08-28; no remote file is bundled

### Julian Date Unix-epoch relation

- Value: Unix epoch `1970-01-01T00:00:00Z` corresponds to `JD 2,440,587.5`
- Use: deterministic UTC/Julian Date conversion helpers
- Units: days and SI milliseconds

### Approximate UTC-to-TDB conversion

- Provider: project implementation (`GENERATED`/algorithmic)
- Use: mapping user-entered UTC dates onto the TDB ephemeris timeline
- Inputs: UTC timestamp, fixed modern `TAI - UTC` assumption, TT offset, and low-order periodic correction
- Accuracy status: approximation; not validated as a scientific time authority
- Full assumptions: [SCIENTIFIC_NOTES.md](./SCIENTIFIC_NOTES.md)

### Historical Sun/Earth debug fixture

- Provider: project-authored deterministic test data
- Units: meters, meters per second, and unit quaternion
- Scientific authority: none
- Runtime status: superseded by the generated provider; retained only where isolated tests need an architecture fixture
