# Solar System: Living Observatory

This directory contains the standalone React 19 application for the Solar System project. Phase 12 is the final numbered master-plan build: it exposes the existing Sun/Earth/Moon tidal-forcing service through a URL-only developer visualization without changing the bundled scientific state, ephemeris authority, or scenario outcomes. Phase 11's production hardening and Phase 10's two deliberately independent **Black-Hole Encounter** experiences remain available alongside Solar Fate, Impact Lab, and the complete observatory.

## Phase 12 tide-ready extension status

- The experimental overlay is absent during ordinary use. It is enabled only by the exact URL query `?experimentalTides=both`; `?experimentalTides=lunar` and `?experimentalTides=solar` select the individual components. Empty, missing, or unrecognized values do not expose the overlay.
- The opt-in is URL-only and transient. It is not written to Zustand preferences, local storage, scenario snapshots, or any other durable state, and a later unflagged load starts with no tidal visualization.
- The overlay marks the sublunar and subsolar points and draws normalized, deliberately exaggerated two-bulge lunar and/or solar forcing geometry. The display gain makes the forcing directions legible; the rendered bulge size is not a surface displacement, sea level, or value in metres.
- Sun, Earth, and Moon states come from the existing bundled ephemeris path. Earth-fixed directions use the existing approximate constant-rate Earth rotation and provisional prime-meridian phase, not an authoritative IAU Earth-orientation or geodetic service.
- This is **not an ocean-tide prediction**. It includes no bathymetry, harmonic constituents, Love numbers, loading, elasticity, self-gravity, hydrodynamics, coastline or basin response, or solid-Earth/ocean response model.
- Phase 12 adds no asset, scientific dataset, runtime dependency, third-party shader, or license. Its final verification and manual evidence requirements are recorded in [PHASE12_RELEASE_CHECKLIST.md](./PHASE12_RELEASE_CHECKLIST.md).

## Phase 11 production status

- The selected Low/Medium/High/Ultra tier remains the user's detail ceiling. Adaptive resolution is active only while Impact Lab, Scientific Solar Evolution, Fictional Solar Supernova, or a black-hole encounter owns a heavy effect; ordinary observatory rendering immediately returns to the tier's full resolution scale.
- The controller uses an exponential moving average and sustained-pressure hysteresis instead of reacting to a single slow frame. It lowers scale in `0.10` steps after about `0.75 s` of sustained pressure and recovers in `0.05` steps after about `2.25 s` of headroom, with cooldowns to limit oscillation.
- Tier controller targets and minimum scales are Low `30 / 0.75`, Medium `40 / 0.70`, High `50 / 0.60`, and Ultra `55 / 0.50` (target frames per second / minimum heavy-effect resolution scale). These are control thresholds, not measured FPS claims or promises for a particular device.
- Diagnostics expose the active effect/state, target and smoothed FPS, current/minimum scale, median/p95/p99 frame intervals, sample and adjustment counts, requested/effective device-pixel ratio, draw calls, triangles, points, geometries, textures, and shader programs. Browser and GPU counters are operational clues, not a complete driver-memory profiler.
- Existing quality tiers also change actual work: atmosphere path, anisotropy, bloom, corona shells, comet and belt budgets, Saturn spokes, sky tier, and black-hole lensing path. Resolution adaptation does not alter ephemerides, scenario integration, scientific readouts, or serialized parameters.
- Body textures remain lazily requested and have deterministic procedural fallbacks. Runtime imagery uses the documented PNG/JPEG/WebP assets; this release does **not** ship KTX2/Basis texture compression and does not claim that it does.
- WebGL2 creation failure keeps an accessible static fallback. Missing half-float color attachments use direct rendering without bloom/composer. Context loss is surfaced, and the release checklist requires bounded recovery or an actionable fallback. Worker construction/failure paths must retain an explicit deterministic fallback or actionable error rather than silently changing scientific data.
- The release gate is `npm run check:release` inside this package, followed by the repository build helper. Manual tier profiling, repeated-reset resource checks, context-loss recovery, and browser evidence remain release-owner checks recorded in [PHASE11_RELEASE_CHECKLIST.md](./PHASE11_RELEASE_CHECKLIST.md).

## Phase 10 status

- **Physics Flyby** transfers a captured Sun-and-major-planets state to a dedicated module worker and advances Newtonian N-body gravity with deterministic kick-drift-kick velocity Verlet steps. A scenario-local origin and fixed Float64 storage keep astronomical coordinates away from GPU matrices.
- The allowed substep is selected deterministically from the chosen accuracy ceiling, closest separation, and acceleration. The integrator never advances through the black-hole singularity: a configurable multiple of the calculated Schwarzschild radius defines the capture boundary.
- Flyby outcomes are not authored in advance. Bodies can remain intact, become tidally stressed or disrupted, form an accretion stream, be captured, or be classified as ejected. The interface reports survivors, captures, and ejections without promising that every run consumes the system.
- Runtime diagnostics expose kinetic energy, approximate Newtonian potential and total energy, linear and angular momentum, their relative drifts, minimum pair distance, selected substep, completed substeps, integrated physical time, and a finite-state guard. They diagnose this educational integrator; they do not turn it into a general-relativistic solution.
- **Complete Consumption - Cinematic** starts from the same external-encounter architecture but adds the separately named `CinematicInfallForceProvider`. Its serialized tangential damping, inward bias, and staging controls are used only by this mode. The exact persistent warning is: **Nonphysical cinematic mode: artificial orbital damping is applied to guarantee that every body spirals inward.**
- The cinematic sequences disruption, streams, disk feeding, and capture so every body reaches `captured` before completion. Black-hole mass is still shown, while the UI explicitly identifies timing and damping as artistic.
- Rendering separates orbital physics from optics. Both modes show an event-horizon silhouette, optional asymmetric accretion disk, body redshift/fade, and disruption streams. Low quality disables lensing, Medium uses a bounded screen-space fallback, and High/Ultra use the isolated licensed Schwarzschild-inspired lensing path when supported.
- The High/Ultra path is isolated under `src/rendering/black-hole/`, adapts Eric Bruneton's BSD-3-Clause nonrotating ray mappings and inward-ray deflection branch, and loads byte-for-byte copies of the official `deflection.dat` and `inverse_radius.dat` tables. Their dimensions, finite Float32 payloads, pinned source commit, byte lengths, and SHA-256 checksums are release-verified from `public/assets/phase10/black-hole/manifest.json`. Runtime diagnostics switch from the simplified fallback to `schwarzschild` only after both tables validate and bind; load failure keeps the reported and rendered fallback honest. This remains a 2D postprocess adapter, not Bruneton's complete scene renderer and not a claim that the Newtonian trajectory worker implements relativity.
- Reset is idempotent: it terminates scenario authority, clears lensing, horizon, disk, streams, base-body overrides, and exposure protection, then restores the exact captured ephemeris, camera, selected body, render scale, and clock state.
- Focused regression tests include the required misconception check: replacing the Sun with an equal-mass black hole while preserving the same mass and orbital initial conditions does not make a circularly orbiting planet fall inward merely because the central object is a black hole.

## Phase 9 status

- Scientific Solar Evolution follows a validated, versioned phase profile from the present Sun through red-giant expansion, inner-system heating/engulfment, mass-loss and nebular display, and a white-dwarf cooling remnant. The compressed interpolation is an educational visualization, not a detailed stellar-evolution solver.
- The scientific profile keeps physical radius, luminosity, remaining mass, temperature, qualitative mass loss, inner-body heating, nebular opacity, and remnant blend separate from authored display duration and particle styling. Mercury and Venus engulfment is distinguished from Earth's uncertain fate.
- Active scientific phases expose the profile-owned time-compression notice, global and phase caveats, uncertain-body labels, and compact-remnant scale note. A physical-radius close-up camera keeps the pulse, flash, and remnants legible without applying a display-size floor.
- Fictional Solar Supernova is a separate cinematic module with an unremovable statement that the real Sun is not massive enough to explode as a supernova. Its pulse, bounded flash, shock shell, compressed radiation front, debris/nebula, and fictional remnant are not presented as solar evolution.
- Both modules use a fixed `1/120 s` scenario clock independent of astronomical playback. One shared scenario manager prevents Impact Lab, Solar Evolution, and Fictional Solar Supernova from overlapping.
- Reduced-motion and reduce-flashes preferences affect presentation only. Flash luminance is capped before exposure adaptation, and protective exposure ceilings are aggregated across scenario renderers so reset cannot leave a stale or broken exposure state.
- Solar Fate does not evolve the 2000-2100 planetary vectors across billions of years. Captured planet geometry is frozen as illustrative context; no orbital response to red-giant mass loss, climate prediction, hydrodynamics, or radiation transport is implied.
- Reset is idempotent and removes scenario-owned shells, heat overlays, particles, nebulae, debris, remnant proxies, camera overrides, and exposure protection before restoring the exact captured observatory state.

### Phase 8 Impact Lab retained

- Impact parameters cover spherical-equivalent diameter, editable density, entry speed and angle, target latitude/longitude, porous-rock/stone/iron material behavior, atmosphere and fragmentation toggles, event camera, and an unsigned deterministic seed.
- The visible physical summary keeps sphere mass, kinetic energy, and TNT equivalent separate from the artistically tuned crater, ejecta, shockwave, plume, and haze profile. Visual scaling never feeds back into the physical result.
- Atmospheric entry advances on a scenario-local 120 Hz fixed step in an Earth-local east/north/up tangent frame. The normal ephemeris clock is frozen, not replaced, while the event is active.
- Dynamic pressure can trigger deterministic fragmentation; an exponential atmosphere, drag, gravity, and a deliberately simplified ablation term determine whether material reaches the surface or produces an estimated airburst.
- Orbital, horizon, chase, and ground-observer event cameras are renderer-local overrides. Slow-motion replay keeps the same serialized parameters and seed. Reduced-motion and reduce-flashes preferences affect presentation only, never physical outcomes.
- Reset is idempotent: it removes all scenario-local meshes, trails, fragments, flash, crater, ejecta, shockwave, plume, and haze, then restores the captured body, camera, render scale, clock epoch, direction, rate, pause state, and normal exposure authority.
- Every run requires a photosensitivity confirmation and retains a textual educational warning while active. Scenario parameters, stage, particles, and crater state are intentionally excluded from durable preferences.

### Phase 7 production interface retained

- The observatory uses one responsive production workspace. At desktop widths the searchable object navigator is left of the 3D stage, the scientific inspector and camera/quality tools are on the right, and the exact UTC controls, 2000–2100 ephemeris timeline, logarithmic speed slider, and presets form a bottom dock. Narrow layouts reflow without horizontal clipping.
- Keyboard commands cover help, provenance, playback, adjacent objects, focus, all six camera modes, scale, labels, orbit lines, and tour interruption. Global shortcuts ignore form fields, links, buttons, editable content, modifier chords, held-key repeats, and modal dialogs.
- Help and provenance use named modal dialogs with initial focus, contained Tab/Shift+Tab navigation, Escape dismissal, and focus restoration. Scientific abbreviations and visualization limitations have programmatic descriptions rather than relying on color or hover-only cues.
- A versioned, field-validated local preference record stores only durable target, camera, scale, quality, layer, trail, and accessibility choices. Corrupt, future-version, unavailable, or exception-throwing storage falls back safely. Simulation epochs, telemetry, GPU/errors, effective motion state, and tour progress are never persisted.
- The cinematic tour advances in real display time outside React's high-frequency state. React receives only transition summaries. It changes camera framing without changing simulation time or scientific data, honors reduced-motion behavior, and yields immediately to manual body/camera input or Escape.
- Effective motion can follow the operating system, force reduced motion, or allow full motion. A separate reduce-flashes preference is persisted for this phase and later event visualizations. The renderer's per-frame body, orbit, comet, and camera state remains outside React; UI snapshots stay capped at 10 Hz.
- Loading, ready, degraded WebGL, and ephemeris error states are announced and visible. A failed scientific bundle offers a retry path; WebGL2 failure retains the static fallback and usable non-3D controls.
- Phase 7 browser acceptance covers the full 1280 px observatory workflow, keyboard/form guards, dialog focus behavior, persistence/reload, tour interruption, provenance, loading, and overflow checks from 1280 px down to 320 px. Phase 8 adds physical-summary, confirmation, deterministic replay, event-control, parameter-effect, and full-reset checks. Phase 9 adds mode-separation, profile-caveat, physical close-up, finite-diagnostic, exposure-restoration, persistent-warning, flash-cap, replay, reset, and responsive-dialog/HUD checks. Phase 10 adds encounter-mode separation, worker diagnostics, survivor/ejection semantics, cinematic all-captured completion, persistent-warning, quality-tier lensing, deterministic replay, pristine double-reset, and 320 px overflow checks.

### Phase 6 scientific baseline retained

- The browser loads separate self-describing Float64 planetary and segmented-comet ephemeris binaries. It makes no runtime request to NASA or JPL; failure of the optional comet bundle does not stop the planetary observatory.
- The binary contains geometric heliocentric states for the Sun, Mercury, Venus, Earth, Moon, Mars, Jupiter, Saturn, Uranus, and Neptune.
- A separate small-body bundle contains 2000–2100 geometric heliocentric Horizons vectors for 1P/Halley, 2P/Encke, 67P/Churyumov-Gerasimenko, C/1995 O1 (Hale-Bopp), and C/2020 F3 (NEOWISE). Daily baseline segments switch to six-hour samples around catalog-planned perihelion windows.
- Generation queries Horizons center `500@10` (Sun), reference system `ICRF`, reference plane `ECLIPTIC`, time scale `TDB`, and source units `KM-S`. Parsing converts position and velocity to meters and meters per second exactly once.
- Coverage is `2000-01-01T00:00:00 TDB` through `2100-01-01T00:00:00 TDB` (`JD 2451544.5` through `2488069.5`). The Sun and planets use one-day samples; the Moon uses six-hour samples.
- A Web Worker decodes both binaries. The runtime providers verify their bundled SHA-256 digests, then use cubic Hermite interpolation between position/velocity samples.
- True scale applies one linear metres-to-render-units conversion to positions and radii, preserving physical radius-to-distance ratios. Presentation scale keeps the same linear orbital distances and exaggerates radii only. Its default kind factors are `25×` for the Sun, `250×` for planets, `500×` for moons, and `5,000×` for comet nuclei, with a deliberate shared `40×` body override for Earth and the Moon. The shared factor preserves their physical radius ratio and keeps their presentation spheres separate without moving either body. A persistent warning remains visible whenever presentation-scale geometry contributes to a frame.
- Scale changes use a smooth, reversible real-time transition; reduced-motion mode applies the requested scale immediately. Presentation mode is the initial mode, while true scale makes most planets subpixel in a system overview.
- Six camera modes are available: Solar System overview, free orbit, body follow, Earth–Moon system, top-down ecliptic, and velocity chase. Earth–Moon mode frames both bodies from ecliptic north using their linear ephemeris positions and current rendered radii; it does not magnify their separation. Non-overview modes keep the floating render origin on the selected body (Earth for Earth–Moon mode); overview keeps it on the Sun.
- Dedicated close-up presets track Jupiter's rendered Great Red Spot and frame Saturn's complete ring system from an oblique view. These are presentation views, not physical telescope or spacecraft camera solutions.
- Camera near/far clipping, free-orbit distance limits, and navigation sensitivities are recalculated from the current target, rendered radius, viewport, and system extent. Camera poses and scale changes stay camera-relative instead of sending astronomical absolute coordinates to GPU matrices.
- Orbit lines for every non-Sun body and the selected body's previous/next trail are sampled from the bundled ephemeris provider in Float64 on the CPU. Capacity-limited paths allocate additional genuine provider samples by measured turn and midpoint chord error, concentrating detail around fast comet perihelia without fitting a display spline. They preserve the source trajectory's inclination, eccentricity, and orientation rather than drawing circular fixtures, and distant vertices fade to reduce clutter.
- Path windows refresh after exact-date changes and at body-specific simulated-time cadences during playback. Every Float64 point is combined with its Sun/Earth center and subtracts the current floating origin before its final Float32 GPU upload, avoiding outer-planet matrix cancellation. Coverage-limited arcs are disclosed in the canvas and inspector; no missing segment is fabricated.
- Screen-space labels use collision suppression with priority for the selected object. The searchable object navigator can focus all 15 bodies and toggle orbit lines, labels, sky, bright stars, comets, or either statistical belt; the inspector reports catalog properties plus current heliocentric distance and speed.
- The camera-centered sky uses NASA SVS Deep Star Maps 2020 in 4K and 8K quality tiers, while 9,096 BSC5P bright stars are rendered separately from FK5/J2000 coordinates. The WebPs already include their documented build-time tone map; the sky material is excluded from further runtime renderer tone mapping so solar close-up exposure changes do not make it pump. Its center follows camera translation exactly, so it has no artificial parallax.
- Each comet has a deterministic irregular rough nucleus, a distance-driven soft radial-density coma, a narrow instantaneous anti-solar ion ribbon, a separately colored ephemeris path for unambiguous crossings, and a curved dust visualization reconstructed from timestamped historical ephemeris states with four deterministic grains per age bin. The coma is an authored opacity falloff, not radiative transfer, and the nucleus, coma, ion ribbon, and dust grains are educational visualizations rather than measured shape models or plasma/dust forecasts.
- The optional asteroid and Kuiper belts use deterministic instancing for context and remain persistently labeled **Statistical visualization**. Their screen-space markers are normalized for each quality tier's point budget; marker size is not physical object size, and particles are not individual cataloged objects. Ordinary asteroids have no rendered physical tails; colored orbit/path curves are interface guides, separate from comet dust.
- The body renderer lazily loads 15 compact runtime textures: seven byte-for-byte official NASA/USGS color, radar, night, or cloud files plus eight deterministic project-generated derivatives. Phase 5 uses one lossless WebP generated without resizing or recoloring from Hubble OPAL's December 2025 Rotation A global Jupiter TIFF and one local luminance-detail WebP derived from NASA JunoCam PIA23606. Load failure remains visible in diagnostics and falls back to deterministic procedural materials. Exact runtime/source hashes, byte lengths, dimensions, transformations, linear/sRGB handling, and semantics are recorded in `public/assets/source-manifest.json`.
- Mercury, Moon, and Mars normals are generated from quantitative USGS MESSENGER DEM, NASA LOLA displacement, and NASA MOLA topography data. Their visual slope amplification is documented and they do not displace the spherical meshes. Earth's separate normal, ocean, and roughness maps are Blue Marble image heuristics—not measured topography, coastline, bathymetry, or material properties.
- The Sun remains procedural: quality-gated multiscale granulation and dark intergranular lanes, structured umbra/penumbra/faculae, a lower `1.48` display-emission multiplier, limb darkening, and an outward-fading layered corona are informed by [SDO/HMI channels](https://sdo.gsfc.nasa.gov/data/channels.php) and NASA SVS's [4K HMI *Busy Sun* reference](https://svs.gsfc.nasa.gov/4133/), but no SDO image is used as a texture and the result is not live or timestamp-matched solar imagery. Venus likewise remains procedural: its two cloud decks share one modeled four-day westward superrotation and add restrained UV-absorber-inspired contrast, chevrons, zonal structure, a polar hood, and softer twilight informed qualitatively by [Hubble UV cloud-top imagery](https://science.nasa.gov/photojournal/venus-cloud-tops-viewed-by-hubble/) and [Akatsuki UVI](https://darts.isas.jaxa.jp/missions/akatsuki/uvi_en.html). No UVI texture or cloud-motion-vector product drives the current renderer, so this is not observed or live Venus weather; the separate Magellan radar **data view** remains available beneath the clouds. No new third-party runtime asset or license was added by this visual revision. Earth combines Blue Marble, independent city-light and cloud composites, a separately rotating cloud shell, separate ocean glint/roughness inputs, and terminator-gated lights. Mars combines mapped color/topography with procedural polar caps, dust clouds, and haze.
- Jupiter keeps the dated Hubble cloud map sharp and static while published wind profiles drive restrained procedural atmosphere motion; Saturn, Uranus, and Neptune use cited wind inputs for their procedural cloud motion. These inputs are deterministic shader controls, not a fluid simulation, forecast, or reconstruction of weather at the selected date. The OPAL Jupiter image is a December 2025 visual foundation, not live imagery.
- Jupiter's Great Red Spot preserves OPAL color and sampled cloud structure while a higher-resolution grayscale residual from the February 2019 JunoCam PIA23606 mosaic restores restrained inner-cloud detail. The body-tracked vortex uses an authored elliptical blend informed by cited size, drift, and pulsation parameters; its counterclockwise texture circulation and subtle collar lag are modeled. This is explicitly a mixed-date presentation enhancement—not a calibrated 2025 reconstruction, measured outline, measured wind field, forecast, or live weather—and the previous painted sine-wave spiral and saturated synthetic core are absent. Neptune's NDS-2018 is likewise a finite-lifetime dated visualization and is absent outside its catalog interval.
- Saturn, Uranus, and Neptune use thin annular meshes driven by source-attributed radial regions and optical depths. Saturn includes ring-to-planet and planet-to-ring shadows, named divisions and gaps, plus optional illustrative spokes at high/ultra quality; Neptune includes illustrative localization of the Adams-ring arcs. Ring color, scattering, sparkle, display gain, spokes, and arc phase are rendering choices rather than measured particle dynamics.
- High/ultra Earth atmosphere rendering samples project-precomputed physical transmittance, approximate multi-scattering, and sky-view LUTs; low/medium use a compact analytic fallback. The LUT model is three-wavelength and physically parameterized, but is not a full spectral, iterative 4D atmospheric solver.
- HDR composition uses ACES tone mapping, restrained above-white-threshold bloom, and contextual deep-space/body/solar-closeup exposure presets. If a WebGL2 device cannot render half-float color attachments, the composer and bloom are bypassed for a direct-render fallback instead of risking a blank framebuffer. These are display controls, not radiometric calibration.
- Constant-rate seed rotation models provide period and axial tilt for most bodies, including Uranus' extreme tilt; an approximate synchronous model keeps the Moon's near side toward Earth. These are not authoritative IAU pole/prime-meridian series and do not include lunar physical libration.
- Body-to-Sun direction and inverse-square irradiance are derived from the Float64 ephemerides, then transformed into each rotating body's local frame for geometric day/night and terminator evaluation. Display irradiance remains deliberately compressed, and spherical apparent-disc overlap dims direct light uniformly during analytic eclipses; it does not draw a spatial umbra/penumbra footprint.
- The Phase 12 tide-ready Earth service exposes sublunar/subsolar geometry, separate lunar and solar quadrupole forcing, differential acceleration, and center tidal tensors. Its flagged two-bulge overlay is normalized and exaggerated for inspection; it is not an ocean-tide predictor and includes no bathymetry, harmonic constituents, Love numbers, loading, elasticity, self-gravity, or hydrodynamics.
- Visual quality can be set to low, medium, high, or ultra; it changes anisotropy, atmosphere path, bloom profile/resolution, corona-shell count, comet point budgets, belt instance counts, and the 4K/8K sky tier without changing ephemeris state or scientific readouts.

The committed planetary/lunar dataset is `jpl-horizons-7099a7cebc78d3e0`. Its binary is exactly `22,792,656` bytes, and the manifest pins SHA-256 `9f888e0cb3d5d44e23bd0dd56d9926a00ccadb8dde8a1bad9d51b96c2510437c`.

The committed small-body dataset is `jpl-horizons-small-bodies-fa7cdf93908e0612`. Its binary is exactly `12,359,016` bytes and pins SHA-256 `8e68010d0efdec1f42725b042680898d2e8a04f874f5406ff07f06b0f11c53c1`. The release contains five logical comets routed across 101 physical cadence segments with 96 shared boundaries. All 303 independently requested, withheld Horizons samples passed; the largest measured interpolation differences were `298.858584 m` in position and `0.0141331 m/s` in velocity.

Generated artifacts live in `src/data/generated/`:

- `solar-system-ephemeris.v1.bin`: compact runtime states
- `solar-system-ephemeris.manifest.json`: per-body provenance and binary digest
- `validation-references.json`: separately requested withheld Horizons `TLIST` samples
- `solar-system-ephemeris.validation.json`: structural and independent interpolation results
- `comets.sbdb.json`: normalized pinned JPL SBDB identity/orbit metadata used at generation time
- `small-body-ephemeris.v1.bin`: compact uniform physical series for every comet cadence segment
- `small-body-ephemeris.manifest.json`: per-segment Horizons provenance and binary digest
- `small-body-segments.json`: logical-comet routing across baseline/perihelion segments
- `small-body-ephemeris.validation.json`: structural results plus the embedded five-request, 303-sample withheld Horizons `TLIST` reference set and interpolation checks

Phase 4 visual assets live in `public/assets/phase4/`; the Phase 5 Jupiter map and local GRS detail live in `public/assets/phase5/`; Phase 6 sky assets and their dedicated manifest live in `public/assets/phase6/`. Planetary machine-readable provenance and SHA-256 digests remain in `public/assets/source-manifest.json`. Human-readable provenance and scientific caveats live in [SOURCES.md](./SOURCES.md) and [SCIENTIFIC_NOTES.md](./SCIENTIFIC_NOTES.md).

See [SCIENTIFIC_NOTES.md](./SCIENTIFIC_NOTES.md) for the measured validation results and limitations.

## Extension phases 2–4: natural satellites, satellites, and probes

The observatory now exposes a dated natural-satellite catalog and a separate human-made space-object layer. Natural satellites are parent-associated and evaluated from absolute simulation time: 24 major moons use individual meshes and parent-relative orbit lines, while 432 minor records use instanced point markers. Major-moon motion is re-anchored every 32 days to 12,624 parent-centered NASA/JPL Horizons states over 1990–2035, then propagated from each anchor rather than linearly joining sparse positions. The source-snapshot metadata records 456 records across Earth, Mars, Jupiter, Saturn, Uranus, and Neptune; the official counts are dated and not treated as timeless constants. Major moons receive analytic parent-umbra dimming, and close Jupiter views can show Galilean transit-shadow markers.

The Space objects panel separates Earth-orbit OMM records from JPL Horizons spacecraft trajectories. OMM IDs remain strings (including six-digit IDs), frame provenance remains explicit (`TEME` → Earth-centered inertial), and `satellite.js` 6.0.2 supplies SGP4/SDP4 propagation with preferred/hard data-age windows. The checked-in five-object OMM artifact remains explicitly marked as a fallback whenever CelesTrak cannot be refreshed. Fourteen spacecraft use 15,583 generated Horizons position/velocity states, exact returned validity intervals, and cubic-Hermite interpolation; they never use SGP4/OMM. Markers are batched and explicitly not to scale, selected objects draw an open coverage-limited arc, Earth propagation runs in a module worker, and the large Horizons bundle is not duplicated inside that worker.

Normal browser use is fully offline. The JPL datasets are generated and checksummed primary-source derivatives; the OMM catalog is a refreshable, schema-validated snapshot rather than live polling. The moon-anchor two-body propagation and spacecraft interpolation are not reconstructed mission navigation solutions or prediction services. See [SCIENTIFIC_NOTES.md](./SCIENTIFIC_NOTES.md) and [SOURCES.md](./SOURCES.md) for the boundaries.

## Local commands

Install this package independently from the website root, then run commands from `solar-system/`:

```bash
npm install
npx playwright install chromium
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:ephemeris-scripts
npm run test:e2e
npm run test:e2e:phase11
npm run test:e2e:phase12
npm run profile:quality
npm run verify:assets
npm run check:release
npm run verify:phase6-sky
npm run ephemeris:small-bodies:verify
npm run space-objects:earth:verify
npm run space-objects:spacecraft:verify
npm run space-objects:moons:verify
npm run build
```

The smoke suite uses Playwright's installed Chromium by default. To validate against a locally installed Chrome channel instead, set `SOLAR_SYSTEM_E2E_CHANNEL=chrome` for that command. The test server defaults to port `5196`; `SOLAR_SYSTEM_E2E_PORT` can override it when needed.

Sky asset generation from a clean checkout requires network access and populates the ignored source cache. The offline form works only after both exact source files already exist in `.cache/phase6-sky`:

```bash
npm run generate:phase6-sky
npm run generate:phase6-sky -- --offline
```

With identical cached source bytes and locked generator versions, the image and catalog asset bytes are intended to reproduce. The manifest's `generated_at` field records each run's wall-clock time, so `sky-manifest.json` itself is intentionally not byte-for-byte deterministic.

The build-time generator is catalog-driven and supports date, cadence, body, cache, offline, retry, and output options:

```bash
npm run ephemeris:generate -- --help
node scripts/ephemeris/resolve-comets.mjs --help
npm run ephemeris:small-bodies:generate -- --help
```

Its default interval is 2000-01-01 through 2100-01-01, using each body's catalog cadence. Regeneration is the only workflow that contacts Horizons; normal development, testing, building, and browser use consume local artifacts. The independent validator takes explicit binary, manifest, reference, and report paths; the committed report is already available beside the binary.

The complete regeneration/validation sequence is:

```bash
npm run ephemeris:generate
npm run ephemeris:references
npm run ephemeris:validate
node scripts/ephemeris/resolve-comets.mjs
npm run ephemeris:small-bodies:generate
npm run ephemeris:small-bodies:verify
```

`ephemeris:generate`, `ephemeris:references`, and `ephemeris:small-bodies:generate` contact Horizons unless satisfied from cache/offline mode; `resolve-comets.mjs` contacts SBDB. Validation and verification commands are local-only and fail if a binary hash, dataset identity, structure, provenance contract, or interpolation budget does not pass.

The repository-level build helper, run from the repository root, is:

```bash
node scripts/build-solar-system.mjs
```

It never installs packages. It validates the nested package and dependencies, runs the nested build, and confirms `public/demos/solar-system/index.html` and the required bundled ephemeris assets exist.

After the release checklist passes, commit the `solar-system/` source together with `public/demos/solar-system/`. Production deployment is performed only when explicitly authorized, from the repository root, through the scoped project command:

```bash
npm run deploy -- --scope project:solar-system
```

Do not invoke Vercel directly. The repository deploy command performs its own clean/sync/build/release checks.

## Runtime and build boundary

- Production URL base: `/demos/solar-system/`
- Source package: `solar-system/`
- Generated output: `public/demos/solar-system/`
- Rendering: direct/raw Three.js mounted by React; React Three Fiber is not used.
- UI state: Zustand. High-frequency body transforms remain outside React and are exposed only through throttled snapshots.
- Experimental tides: URL-only and transient. `experimentalTides=both`, `lunar`, or `solar` opts into the Phase 12 developer overlay; unflagged and unrecognized values leave it absent and nothing is persisted.
- Simulation: one request-animation-frame loop, double-precision SI state, floating origin, and a typed event boundary established in Phase 1.
- Unit tests: Vitest and Node's built-in test runner for generation scripts.
- Browser smoke tests: Playwright.
- Production renderer baseline: WebGL2. WebGPU is not part of Phase 7.

The build targets ES2022 and does not emit public source maps.

## Time conversion caveat

User-entered dates are UTC. The simulation converts UTC to Julian Date and then uses a documented low-order approximation for TDB. It assumes a fixed modern `TAI - UTC = 37 s`, adds the `32.184 s` TT offset, and applies a millisecond-scale periodic TDB correction. It does not ship a leap-second table and is not a historical or predictive time authority. Horizons samples themselves are timestamped in TDB; the approximation affects mapping user-entered UTC to those epochs. See [SCIENTIFIC_NOTES.md](./SCIENTIFIC_NOTES.md).

## Documentation

- [Scientific scope and limitations](./SCIENTIFIC_NOTES.md)
- [Data and algorithm provenance](./SOURCES.md)
- [Third-party software and data notices](./THIRD_PARTY_NOTICES.md)
- [Phase 12 release checklist](./PHASE12_RELEASE_CHECKLIST.md)
- [Phase 11 release checklist](./PHASE11_RELEASE_CHECKLIST.md)
- [Machine-readable Phase 4/5 asset manifest](./public/assets/source-manifest.json)
- [Machine-readable Phase 6 sky manifest](./public/assets/phase6/sky-manifest.json)
