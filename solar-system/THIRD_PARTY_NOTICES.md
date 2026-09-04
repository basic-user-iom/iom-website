# Third-party notices

The application uses the following open-source packages through npm, bundles generated numerical state vectors derived from NASA/JPL Horizons, and includes 15 compact Phase 4/5 planetary runtime textures. Seven are unmodified official NASA/USGS downloads; eight are project-generated derivatives of official source data or imagery. A later observatory refresh separately adds sixteen NASA-VTAD-derived major-moon WebPs and one dated NASA SDO/HMI solar-observation WebP. Phase 6 adds two NASA-SVS-derived Milky Way display textures and JSON/binary derivatives of NASA HEASARC's BSC5P catalog. Phase 10's isolated High/Ultra black-hole lensing path is derived from and attributed to Eric Bruneton's BSD-3-Clause real-time nonrotating black-hole reference and redistributes two unmodified official ray lookup tables. Exact resolved package versions and transitive software licenses are recorded by the package lock generated during dependency installation. Phase 4/5 runtime/source bytes and transformations are recorded in [`public/assets/source-manifest.json`](./public/assets/source-manifest.json); Sun/major-moon derivatives are recorded in [`public/assets/moons/manifest.json`](./public/assets/moons/manifest.json); the separate Phase 6 bundle is recorded in [`public/assets/phase6/sky-manifest.json`](./public/assets/phase6/sky-manifest.json); Phase 10 table provenance and checksums are recorded in [`public/assets/phase10/black-hole/manifest.json`](./public/assets/phase10/black-hole/manifest.json); published giant-planet wind, feature, and ring inputs are recorded in [`src/data/catalogs/giant-planet-visual-profiles.json`](./src/data/catalogs/giant-planet-visual-profiles.json).

## NASA VTAD major-moon maps and SDO/HMI Sun observation

The application redistributes sixteen project-generated 2048 x 1024 quality-88 WebP derivatives of embedded base-color images from NASA Visualization Technology Applications and Development 3D-model resources. The source pages, exact GLB downloads, embedded image names, transformations, output hashes, and deliberately rejected Mimas/Hyperion mesh atlases are recorded in [`public/assets/moons/manifest.json`](./public/assets/moons/manifest.json). Credit: **NASA Visualization Technology Applications and Development (VTAD); NASA/JPL-Caltech where identified by the source page.** Attribution does not imply endorsement.

The same manifest records `sun-hmi-intensity-2025-12-26-2k.webp`, a project-generated quality-90 WebP derivative of NASA Solar Dynamics Observatory HMI intensity imagery observed at `2025-12-26T00:00:00Z`. Runtime projection and feathering are project changes. Credit: **NASA/SDO/HMI.** This dated quick-look image is not presented as a live or global solar dataset. Source documentation: <https://sdo.gsfc.nasa.gov/data/>.

NASA's media-use conditions, including acknowledgement, non-endorsement, logo/identifier restrictions, and separately marked third-party rights, continue to apply. See NASA's [Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). No NASA logo is redistributed in this bundle.

## Phase 11 dependency and asset audit

Phase 11 production hardening introduces no new third-party runtime package, media redistribution, shader source, font, model, or scientific dataset. Adaptive resolution, performance/resource diagnostics, lifecycle handling, and release-check orchestration are project-authored code and create no additional attribution requirement.

The runtime image formats remain the PNG/JPEG/WebP files listed in the Phase 4/5 manifest and the Phase 6 WebP derivatives documented below. The application does not redistribute KTX2 or Basis Universal payloads and does not bundle a KTX2/Basis transcoder. The phrase “texture compression” must therefore not be used to imply GPU block-compressed texture support in this release. The existing JPEG/WebP files use their documented image encodings; PNG assets are lossless encoded images, and Three.js uploads decoded texture data according to the active WebGL implementation.

The release audit is reproducible through `npm run verify:assets` and the manifest-specific verifiers named in [README.md](./README.md). Those checks validate recorded file identities and transformations; they do not replace the media-use terms and license notices in this document or the licenses shipped with resolved npm packages.

## satellite.js

Earth-orbit OMM propagation uses `satellite.js` 6.0.2 under the MIT License.

```text
MIT License

Copyright (C) 2013 Shashwat Kandadai, UCSC Jack Baskin School of Engineering

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Eric Bruneton real-time nonrotating black-hole reference

Phase 10's isolated High/Ultra black-hole lensing path is based on the mathematical and shader structure documented by Eric Bruneton's [`black_hole_shader`](https://github.com/ebruneton/black_hole_shader), inspected at commit `e72b3f293409893a6fa25528b29572c96fc57f57`. The upstream documentation is [Real-time High-Quality Rendering of Non-Rotating Black Holes](https://ebruneton.github.io/black_hole_shader/), with the associated paper available as [arXiv:2010.08735](https://arxiv.org/abs/2010.08735).

The project's Three.js composer integration, quality selection, finite guards, Medium fallback, presentation-radius policy, accretion-disk styling, body fades, and disruption streams are application-specific. The application redistributes unmodified copies of the official `deflection.dat` and `inverse_radius.dat` demo tables with their pinned provenance and checksums; it does not imply endorsement by Eric Bruneton. The derived/attributed shader path and redistributed tables remain subject to the following BSD 3-Clause license:

```text
Copyright (c) 2020 Eric Bruneton
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
this list of conditions and the following disclaimer in the documentation
and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
may be used to endorse or promote products derived from this software without
specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## NASA SVS celestial background and HEASARC BSC5P

Phase 6 redistributes two project-generated WebP derivatives of the linear half-float `milkyway_2020_8k.exr` supplied with NASA Goddard Space Flight Center Scientific Visualization Studio's [Deep Star Maps 2020](https://svs.gsfc.nasa.gov/4851/):

- `public/assets/phase6/milky-way-4k.webp`
- `public/assets/phase6/milky-way-8k.webp`

The WebPs are not unmodified NASA files. The project decodes the OpenEXR, applies a fixed display tone map and sRGB transfer, downsamples the 4K tier in linear space, and uses lossy WebP encoding. Credit: **NASA/Goddard Space Flight Center Scientific Visualization Studio. Gaia DR2: ESA/Gaia/DPAC.** This attribution does not imply endorsement.

Phase 6 also includes project-generated JSON and binary subsets of NASA HEASARC's [Bright Star Catalog, 5th Revised Ed. (BSC5P)](https://heasarc.gsfc.nasa.gov/W3Browse/catalog/bsc5p.html):

- `public/assets/phase6/bright-stars.bsc5p.v1.json`
- `src/data/catalogs/bright-stars.bsc5p.v1.json` (byte-identical compile-time copy)
- `public/assets/phase6/bright-stars.bsc5p.v1.bin`

The source catalog citation is Hoffleit, D. & Warren, W. H. Jr. (1991), *Bright Star Catalog, 5th Revised Ed.* The project retains selected coordinates and photometry, converts sexagesimal coordinates to radians, excludes 14 explicitly documented nonstellar entries, and creates its own encodings. NASA HEASARC asks users to acknowledge the archive and original data providers; see the [HEASARC data policy](https://heasarc.gsfc.nasa.gov/docs/heasarc/data_policy.html). Attribution does not imply that NASA, HEASARC, ESA, Gaia/DPAC, or the catalog authors endorse this application.

NASA states that texture maps and computer graphical simulations generally may use NASA imagery subject to acknowledgement, non-endorsement, identifier/logo, people, and separately marked third-party restrictions. See NASA's [Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). No NASA/ESA identifier or logo is redistributed in this bundle.

## NASA/JPL SBDB and Horizons data

The file `src/data/generated/solar-system-ephemeris.v1.bin` contains generated position and velocity samples obtained from the NASA/JPL Horizons system on 2026-08-28. Phase 6 adds `src/data/generated/comets.sbdb.json`, a project-normalized sidecar derived from NASA/JPL Small-Body Database API records retrieved on 2026-08-29 for five named comets, and `src/data/generated/small-body-ephemeris.v1.bin`, containing their generated Horizons position and velocity samples. The accompanying manifests identify the targets, center, reference system and plane, time scale, source solutions, retrieval timestamps, generator, response hashes, routing, and binary SHA-256. The independent reference and validation JSON files contain additional Horizons state vectors and comparison results.

Source documentation:

- <https://ssd-api.jpl.nasa.gov/doc/horizons.html>
- <https://ssd-api.jpl.nasa.gov/doc/sbdb.html>
- <https://ssd.jpl.nasa.gov/horizons/manual.html>

NASA/JPL is the source of the SBDB metadata and numerical ephemeris responses. The comet selection, binary encoding, cache/generation pipeline, interpolation implementation, validation harness, and visualization are project-authored. This attribution does not imply endorsement by NASA or JPL.

## NASA imagery and planetary data

Phase 4 redistributes the following unmodified official download files under local names:

- `public/assets/phase4/earth-day-8k.webp`: NASA Earth Observatory / NASA/GSFC, *Blue Marble: Next Generation with Topography* (August global map). The runtime WebP is an 8192 × 4096 Lanczos3 reduction of NASA's official 21600 × 10800 JPEG. Credit NASA Earth Observatory and NASA/GSFC; Blue Marble data courtesy of Reto Stöckli and NASA Earth Observatory.
- `public/assets/phase4/earth-night-8k.webp`: NASA Earth Observatory / NASA/GSFC, *Earth at Night / Black Marble 2016 Color*. The runtime WebP is an 8192 × 4096 Lanczos3 reduction of NASA's official 13500 × 6750 global JPEG. Credit NASA Earth Observatory and NASA/GSFC.
- `public/assets/phase4/earth-clouds-8k.webp`: NASA/GSFC Earth Observatory / Visible Earth, *Blue Marble: Clouds*. The runtime WebP is encoded from NASA's official 8192 × 4096 TIFF. Image by Reto Stöckli; enhancements by Robert Simmon; source record also credits the MODIS Land, Science Data Support, Atmosphere, and Ocean groups and supporting USGS/DMSP data.
- `public/assets/phase4/moon.jpg`: NASA/GSFC Scientific Visualization Studio, *CGI Moon Kit* 2025 color map, adapted from LRO Camera WAC and LOLA team products. Credit requested by the source: NASA's Scientific Visualization Studio; visualizer Ernie Wright (USRA), scientist Noah Petro (NASA/GSFC).

Phase 5 additionally redistributes three project-generated lossless WebP derivatives of official imagery:

- `public/assets/phase5/jupiter-opal-2025.webp`: unchanged 3600 × 1800 RGB pixels from the Hubble OPAL Cycle 32 Rotation A global-map TIFF, re-encoded without cropping, resizing, reprojection, or recoloring. Credit NASA, ESA, STScI, and the Hubble OPAL team.
- `public/assets/phase5/jupiter-grs-junocam-detail.webp`: a cropped, geometrically adapted, neutral-centered grayscale high-frequency residual derived from NASA Photojournal PIA23606. The enhanced source color is not imported; runtime uses only restrained luminance detail over OPAL color and sampled cloud structure inside an authored elliptical blend. Credit: Image data NASA/JPL-Caltech/SwRI/MSSS; image processing by Kevin M. Gill, © CC BY. The source and derivative are from February 2019 and are disclosed as a mixed-date presentation enhancement, not a 2025 reconstruction. The crop, residual conversion, and runtime blend are project changes; attribution does not imply endorsement.
- `public/assets/phase5/saturn-opal-2025.webp`: a coverage-aware lossless RGBA derivative of the Hubble OPAL Cycle 32 Rotation A 1800 × 900 global color-map TIFF. The projection and composite color are preserved, while no-data/ring-obscured pixels become alpha coverage and isolated transiting-body or mosaic outliers are restrained per latitude row. Runtime blends observed pixels over a project-authored wind layer. Credit NASA, ESA, STScI, and the Hubble OPAL team; the processing and runtime blend are project changes and attribution does not imply endorsement.

Phase 4 also redistributes project-generated derivatives of official NASA data:

- `public/assets/phase4/moon-normal.png`: generated from the unsigned 16-bit LOLA displacement map `ldem_16_uint.tif` supplied by NASA/GSFC/SVS as part of the *CGI Moon Kit*. It is a tangent-space shading normal with project-selected `48×` visual slope amplification, not an unmodified NASA image and not a displaced shape model.
- `public/assets/phase4/mars-normal.png`: generated from the NASA PDS Geosciences Node MGS/MOLA Mission Experiment Gridded Data Record at 16 pixels per degree (`megt90n000eb.img`). It is a tangent-space shading normal with project-selected `1.4×` visual slope amplification, not an unmodified NASA/PDS product.
- `public/assets/phase4/earth-normal.png`, `earth-ocean.png`, and `earth-roughness.png`: heuristic derivatives of the bundled NASA/GSFC Blue Marble image. They are respectively an image-luminance relief cue, a blue-dominance water-like mask, and an authored material parameter. None is an official NASA DEM, coastline, bathymetry, normal, or roughness dataset.

Source records and exact downloads:

- <https://svs.gsfc.nasa.gov/2915/>
- <https://svs.gsfc.nasa.gov/2916/>
- <https://visibleearth.nasa.gov/images/57747/blue-marble-clouds/77558l>
- <https://svs.gsfc.nasa.gov/4720/>
- <https://archive.stsci.edu/hlsp/opal/opal-jupiter-cycle-32>
- <https://archive.stsci.edu/hlsp/opal/opal-saturn-cycle-32>
- <https://science.nasa.gov/photojournal/the-great-red-spot/>
- <https://pds-geosciences.wustl.edu/missions/mgs/megdr.html>
- <https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg016/megt90n000eb.img>
- <https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg016/megt90n000eb.xml>

NASA states that its content generally is not subject to copyright in the United States and may be used for educational or informational purposes, including computer graphical simulations and web pages. NASA should be acknowledged as the source, use must not imply NASA endorsement, and NASA identifiers/logos and any marked third-party material remain separately restricted. This project includes no NASA logo or identifiable person in these textures. See NASA's current [Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).

## USGS Astrogeology imagery

Phase 4 redistributes the following unmodified USGS browse resources under local names:

- `public/assets/phase4/mercury.jpg`: *Mercury MESSENGER MDIS Basemap MD3 Color Global Mosaic 665m*. Publisher: USGS Astrogeology Science Center. MESSENGER/MDIS originators identified by the source include NASA, Johns Hopkins University Applied Physics Laboratory, Arizona State University, and Carnegie Science. The product record asks users to cite its authors.
- `public/assets/phase4/venus-radar.jpg`: *Venus Magellan Global C3-MDIR Mosaic 2025m*. Publisher: USGS Astrogeology Science Center; originator: PDS Geosciences Node; source mission/instrument: Magellan SAR. The product record marks it public domain with no use constraints.
- `public/assets/phase4/mars.jpg`: *Mars Viking Colorized Global Mosaic 232m*. Primary author and publisher: USGS Astrogeology Science Center; originator: NASA Ames; source imagery: Viking Orbiter. The product record marks it public domain with no use constraints.

Phase 4 also redistributes `public/assets/phase4/mercury-normal.png`, a project-generated tangent-space normal derived from the quantitative *Mercury MESSENGER USGS DEM Global 665m v2*. The generator rolls the source longitude by 180° to align it with the runtime color map and applies a project-selected `36×` visual slope amplification. The PNG is not an unmodified USGS product and does not displace the rendered sphere.

Source records:

- <https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_basemap_md3_color_global_mosaic_665m>
- <https://astrogeology.usgs.gov/search/map/venus_magellan_global_c3_mdir_mosaic_2025m>
- <https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m>
- <https://astrogeology.usgs.gov/search/map/mercury_messenger_global_dem_665m>
- <https://planetarymaps.usgs.gov/mosaic/Mercury_Messenger_USGS_DEM_Global_665m_v2.tif>

USGS states that USGS-authored or produced data and information are considered in the U.S. public domain, while separately marked third-party content can retain its own rights. Proper credit is requested. See the USGS [Copyrights and Credits](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits) policy. No USGS identifier/logo is redistributed here, and credit does not imply endorsement.

## Published giant-planet wind, storm, and ring data

Phase 5 encodes compact numerical inputs and citations from the following scientific and archival sources. The cited papers and web pages are not bundled or redistributed as publications; the project records selected numerical values and uses them in original rendering code.

- Schmider et al. (2024), HST/OPAL cloud-tracked Jupiter zonal winds, *The Planetary Science Journal*, DOI [10.3847/PSJ/ad3066](https://doi.org/10.3847/PSJ/ad3066).
- Simon et al. (2024), Great Red Spot size, drift, and oscillation context, *The Planetary Science Journal*, DOI [10.3847/PSJ/ad71d1](https://doi.org/10.3847/PSJ/ad71d1).
- Del Genio and Barbara (2012), Saturn Cassini ISS CB2 cloud-top winds, *Icarus*, DOI [10.1016/j.icarus.2012.03.035](https://doi.org/10.1016/j.icarus.2012.03.035), with the numerical profile distributed by [NASA GISS](https://data.giss.nasa.gov/cassini/winds/cb2_winds.txt).
- Sromovsky et al., *Post-equinox dynamics and polar cloud structure on Uranus*, DOI [10.1016/j.icarus.2012.05.029](https://doi.org/10.1016/j.icarus.2012.05.029), [open preprint](https://arxiv.org/pdf/1503.00592), for the Uranus cloud-tracking Legendre coefficients; with giant-planet circulation context from Fletcher et al. (2020), *Space Science Reviews*, DOI [10.1007/s11214-020-00646-1](https://doi.org/10.1007/s11214-020-00646-1).
- Neptune Voyager cloud-tracking polynomial, DOI [10.1006/icar.1998.6001](https://doi.org/10.1006/icar.1998.6001), with circulation context from Fletcher et al. (2020) above.
- Wong et al. (2026), NDS-2018 lifecycle context, *Geophysical Research Letters*, DOI [10.1029/2026GL122748](https://doi.org/10.1029/2026GL122748).
- NASA Planetary Data System Ring-Moon Systems Node pages for [Saturn ring vital statistics](https://pds-rings.seti.org/saturn/saturn_rings_table.html), [Uranus](https://pds-rings.seti.org/uranus/), and [Neptune](https://pds-rings.seti.org/neptune/).

The authors, publishers, observatories, NASA centers, missions, and PDS nodes are the sources of the cited measurements and compilations. Latitude interpolation, polar tapering, coordinate conversion, radial texture encoding, display optical-depth gains, colors, animated vortices, spokes, arcs, shadows, and scattering are project-authored. Attribution does not imply that any cited party endorses this application or its visual interpretation.

## Project-authored shaders and generated maps

Except for the separately identified Phase 10 black-hole lensing path above, the runtime GLSL, atmosphere lookup precomputation, normal/material-map generator, giant-planet differential-flow materials, ring-profile encoding, ring/scattering effects, and rendering integrations in this project are original project implementations. No other third-party shader source code is copied or redistributed.

The Earth atmosphere coefficients and compact physical model are informed by the Earth example in Eric Bruneton's reference implementation of Bruneton and Neyret's precomputed atmospheric-scattering work: <https://ebruneton.github.io/precomputed_atmospheric_scattering/>. The project cites that scientific/reference basis but implements its own compact RGB transmittance, approximate multi-scattering, and sky-view precomputation. Those lookup textures are generated at runtime and are not third-party media assets.

## Runtime dependencies

| Package | Purpose | License |
| --- | --- | --- |
| React / React DOM | Application UI | MIT |
| Three.js | Raw WebGL rendering | MIT |
| Zustand | Application/UI state | MIT |

## Development dependencies

| Package family | Purpose | License |
| --- | --- | --- |
| Vite and `@vitejs/plugin-react` | Development server and production bundling | MIT |
| TypeScript and type packages | Static type checking | Apache-2.0 / MIT package-specific declarations |
| Vitest and jsdom | Unit/integration tests | MIT |
| Playwright Test | Browser smoke tests | Apache-2.0 |
| ESLint, typescript-eslint, and React lint plugins | Static analysis | MIT |
| Sharp | Deterministic build-time image decoding, tone mapping output, and WebP encoding | Apache-2.0 |

Primary project pages:

- <https://react.dev/>
- <https://threejs.org/>
- <https://zustand.docs.pmnd.rs/>
- <https://vite.dev/>
- <https://vitest.dev/>
- <https://playwright.dev/>
- <https://eslint.org/>

Redistributions must retain the license notices shipped with the resolved npm packages. This summary does not replace their full license texts.
