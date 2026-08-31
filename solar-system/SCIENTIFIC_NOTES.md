# Scientific notes

## Phase 12 experimental tidal-forcing visualization classification

Phase 12 is the final numbered build in the master plan. It retains the existing ephemeris and scenario cores and adds an explicitly experimental view of the tide-generating geometry already exposed by `TidalForcingService`. The recognized URL-only modes are `?experimentalTides=both`, `?experimentalTides=lunar`, and `?experimentalTides=solar`. The query is transient, is never stored as an application preference or scenario value, and leaves the visualization absent when it is missing, empty, or unrecognized.

The view marks the sublunar and subsolar surface directions and renders normalized, deliberately exaggerated two-bulge forcing geometry. `both` shows the lunar and solar components together; the other values isolate one component. Normalization and display gain are presentation operations used to make very small forcing patterns visible. Bulge radius, color, opacity, and separation are not predicted surface displacement, water height, local datum, flood level, or a value in metres.

The service derives Earth-relative Sun and Moon directions from the bundled Horizons states, then transforms them with the project's existing approximate constant-rate Earth rotation and provisional prime-meridian phase. Consequently, the displayed subpoints and longitudes are geometry diagnostics for this model, not authoritative Earth-orientation, IERS, geodetic, or navigation products.

This visualization is **not an ocean-tide prediction**. The model contains no bathymetry, harmonic constituents, Love numbers, loading, elasticity, self-gravity, hydrodynamics, coastlines, basin resonance, friction, meteorological forcing, ocean circulation, or solid-Earth/ocean response. It therefore cannot predict tide height, phase, timing, currents, or local coastal conditions.

## Phase 10 Black-Hole Physics Flyby classification

**Physics Flyby** is an educational Newtonian N-body approximation of an external black hole passing through the captured Solar System state. At scenario start, the application copies the Sun, Moon, and all eight planets from the current bundled JPL-derived ephemeris into scenario-owned Float64 arrays. From that point until reset, a module worker advances those copied states with a deterministic kick-drift-kick velocity-Verlet method. The observatory ephemeris clock is paused and the original provider-owned states remain unchanged for restoration. The five catalogued comets are omitted because their pinned JPL records intentionally provide no defensible mass; their normal markers and tails, along with statistical belts and ephemeris paths, are hidden during the scenario instead of implying that they remain under ephemeris authority.

The force model is Newtonian point-mass gravity with a finite close-pair distance clamp and a separate black-hole capture boundary. It does not implement body-body collision outcomes. It is not a general-relativistic integrator and does not model frame dragging, gravitational radiation, relativistic precession, a Kerr metric, relativistic jets, magnetohydrodynamics, radiation pressure, accretion thermodynamics, or spacetime propagation. The renderer's lensing and redshift cues are visual effects and never feed back into the trajectory worker. The spin input is likewise a rendering parameter; it is not used as a physical Kerr spin.

The start position, target vector, and planned encounter time form one coupled ballistic helper in the panel: editing position, target, or time recomputes velocity, while editing velocity recomputes the target. Gravity means the target is not a promised pericenter. The seed selects repeatable procedural stream presentation and contributes to the run signature; it does not add randomness to Newtonian accelerations. “Ejected” is an educational classifier for a body beyond the configured scenario radius with outward radial motion, not a full positive-specific-energy/unbound-orbit proof.

The event horizon uses the Schwarzschild relation `r_s = 2 G M / c^2`. Integration never crosses a mathematical singularity. A serialized multiple of `r_s` defines the capture boundary, while distance/force-gradient thresholds drive the visual tidal-stress and disruption states. Those thresholds and the rendered accretion streams are educational visualization choices rather than a material-strength, hydrodynamic, or radiative-transfer calculation.

The worker deterministically selects from a finite set of allowed physical substeps using the requested accuracy ceiling, closest separation, and acceleration. This preserves replay for a given captured state and serialized parameters, but it does not provide an error-controlled research integrator. The diagnostic potential energy is an approximate Newtonian bookkeeping value. Captures, ejections, finite capture guards, and classification transitions can make conservation readouts discontinuous; relative drift values should be used to inspect numerical behavior, not as a physical uncertainty estimate.

Possible outcomes include survival, orbital perturbation, ejection, tidal-stress/disruption visualization, an accretion stream, and capture. No outcome is guaranteed in Physics Flyby. In particular, changing a central object's identity to an equal-mass black hole while preserving its mass and the planets' positions and velocities does not itself remove their orbital angular momentum or cause automatic infall. A dedicated two-body regression test preserves that distinction.

## Phase 10 Complete Consumption - Cinematic classification

**Complete Consumption - Cinematic** is deliberately nonphysical spectacle. Its exact persistent warning is: **Nonphysical cinematic mode: artificial orbital damping is applied to guarantee that every body spirals inward.**

This mode reuses the captured-state, worker, local-origin, capture-radius, and visualization architecture, then activates a separately implemented `CinematicInfallForceProvider`. That provider applies serialized tangential/angular-momentum damping and an inward acceleration bias, and sequences each body's stress, disruption, stream, and capture state on an authored schedule. It is never enabled in the observatory or Physics Flyby. Every body is deliberately marked captured by completion; that result must not be interpreted as a prediction from the displayed mass or initial trajectory.

The cinematic's event timing, damping magnitude, inward bias, disruption ordering, stream shapes, disk brightness, redshift, fade, and capture choreography are artistic. The displayed black-hole mass and Schwarzschild radius remain calculated quantities, but they do not make the forced evolution physical. Pause and deterministic replay retain the same serialized controls. Reset removes the worker authority and every scenario-owned render layer before restoring the exact captured observatory state.

## Phase 10 black-hole rendering classification

The black-hole renderer combines a finite event-horizon silhouette, an optional authored accretion disk with Doppler-inspired brightness asymmetry, disruption streams, and body redshift/fade. The physical Schwarzschild radius is generally far too small to read at a Solar System overview scale, so the renderer can use an explicitly diagnosed minimum presentation radius. That display enlargement never changes the capture radius or dynamics.

Low quality disables lensing. Medium quality uses a simplified bounded screen-space distortion. High and Ultra load unmodified official copies of Eric Bruneton's precomputed ray-deflection and inverse-radius tables, then use adapted Appendix-A mappings and the inward-ray branch of the pinned nonrotating `TraceRay` approach. Until both tables validate and bind, or if they fail, diagnostics truthfully report the Medium-style simplified fallback. The application projects the resulting deflected direction back into its existing 2D scene buffer for a static distant observer; it does not reproduce Bruneton's cubemap star filtering, full accretion-disc intersection shading, Doppler model, moving-camera model, or complete scene renderer. Projected centers/radii and table payloads are validated, denominators are clamped, and unsafe inputs disable the pass. See [SOURCES.md](./SOURCES.md) and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for asset provenance, checksums, adaptation scope, and the BSD-3-Clause notice.

## Phase 11 performance and display-resolution classification

Adaptive resolution is a presentation control, not a scientific-accuracy control. It changes the render-target scale only while Impact Lab, Scientific Solar Evolution, Fictional Solar Supernova, or a black-hole encounter owns a heavy visual effect. It never changes the simulation clock, ephemeris samples, scenario integration step, physical inputs, outcome classifiers, camera geometry, or inspector values. Ordinary observatory rendering returns immediately to the selected quality tier's full resolution scale.

The controller uses an exponential moving average plus sustained-pressure hysteresis. Low, Medium, High, and Ultra use target/minimum-scale pairs of `30/0.75`, `40/0.70`, `50/0.60`, and `55/0.50`. Sustained pressure for about `0.75 s` can lower the scale in `0.10` increments; about `2.25 s` of sustained headroom can recover it in `0.05` increments. Cooldowns limit rapid reversal. Target values are control thresholds, not benchmark results, minimum hardware requirements, or promises that a device will attain that frame rate.

The diagnostics report smoothed FPS and frame-interval percentiles together with requested/effective pixel ratio, scale, adjustments, draw calls, primitive counts, and renderer resource counters. Those measurements are local observations affected by browser scheduling, display refresh, power policy, thermal state, drivers, viewport, and scene choice. Three.js renderer counters do not measure every browser, CPU, driver, or GPU allocation and are not proof of a leak-free process by themselves.

The asset audit verifies existing binary, manifest, PNG, JPEG, WebP, and lookup-table payloads. Body images are requested lazily where the renderer supports that path and have procedural fallbacks. No KTX2/Basis texture set is shipped, so the release must not be described as using GPU block-compressed textures.

## Phase 9 Scientific Solar Evolution classification

**Scientific Solar Evolution** is a source-informed, compressed educational visualization. It is not a detailed stellar-structure solver, an evolutionary track calculated by this application, or a prediction with uncertainty bounds. It must never be named or described as a supernova sequence.

The versioned profile is grounded in NASA's descriptions of the Sun's future: the Sun is about `4.6 billion years` old, should enter red-giant evolution in roughly another `5 billion years`, will engulf Mercury and Venus while Earth's fate remains less certain, will eject its outer layers into a planetary nebula, and will leave a white dwarf remnant. NASA describes a white dwarf as the remaining core after a low-mass red giant sheds its atmosphere and notes that the remnant is roughly Earth-sized. Primary background pages are [NASA Sun facts](https://science.nasa.gov/sun/facts/), [NASA star types](https://science.nasa.gov/universe/stars/types/), and [NASA's red-giant overview](https://science.nasa.gov/exoplanets/resources/life-and-death/chapter-6/).

The committed profile stores ordered phase records with physical radius, luminosity, remaining mass, effective temperature where used, qualitative mass-loss and heating labels, geometric photosphere intersections, nebular opacity, remnant blend, caveats, and source URLs. Display seconds are an authored compression of changes spanning billions of years. Interpolation between records is for continuity on screen; it is not evidence that real stellar properties change linearly, nor does it resolve helium flashes, thermal pulses, convection, nucleosynthesis, magnetic activity, stellar winds, or detailed planetary-nebula formation.

The normal 2000-2100 JPL-derived planet positions are frozen as illustrative spatial context while the scenario runs. Phase 9 does not propagate orbits billions of years forward, integrate mass-loss-driven orbital expansion, model tidal decay, or settle Earth's uncertain engulfment outcome. Planet heating overlays are qualitative irradiance cues, not climate, atmosphere, ocean, geology, habitability, or surface-temperature calculations. Scientific effect radii use the linear physical distance scale. The compact white-dwarf geometry is not given a minimum display-size proxy; a physical-radius close-up camera keeps it legible instead.

## Phase 9 Fictional Solar Supernova classification

**Fictional Solar Supernova** is a cinematic scenario, not part of the Sun's scientific evolution. Its exact persistent warning is: **Cinematic scenario: the real Sun is not massive enough to explode as a supernova.** NASA explains that the Sun lacks the mass required for this fate and will instead become a white dwarf; see [Why the Sun Won't Become a Black Hole](https://www.nasa.gov/image-article/why-sun-wont-become-black-hole/) and [NASA's overview of star types](https://science.nasa.gov/universe/stars/types/).

Pulse, flash, shock shell, radiation front, debris, nebula, and remnant channels follow a deterministic authored timeline. Their timing, propagation distances, colors, opacity, energy impression, and remnant are deliberately fictional and visually compressed. They do not implement stellar collapse, neutrino transport, nucleosynthesis, radiation dose, ejecta hydrodynamics, relativistic shocks, planetary destruction, or a physically possible outcome for a one-solar-mass star.

The renderer validates finite inputs, caps flash emission independently of tone mapping, applies a protective exposure ceiling, and further suppresses abrupt pulses when Reduce Flashes is enabled. These are photosensitivity and framebuffer-safety measures, not radiometric calibration. Reset removes every Solar Fate visual layer and exposure ceiling before restoring the saved camera, render scale, observatory clock, and normal Sun. Repeated reset is intended to be safe.

## Phase 8 Impact Lab classification

The Earth Impact Lab is an **educational approximation**, not an operational hazard, damage, climate, or planetary-defense model. It runs on a scenario-local deterministic clock while the generated observatory ephemeris is paused. The normal Earth state, camera, exposure authority, and time controls are restored on reset; the impact trajectory is not inserted into or used to perturb the JPL-derived Solar System state.

The physical readout begins with an explicitly spherical-equivalent impactor:

```text
r = diameter / 2
mass = (4 / 3) pi r^3 density
kinetic energy = (1 / 2) mass speed^2
TNT megatons = kinetic energy / 4.184e15 J
```

These initial mass, energy, and TNT values are never modified to improve visibility. Entry integration uses a fixed `1/120 s` step in a local east/north/up tangent frame centred on the chosen latitude and longitude. The committed model constants are an Earth mean radius of `6,371,008.4 m`, sea-level gravity of `9.80665 m/s²`, sea-level atmospheric density of `1.225 kg/m³`, an exponential scale height of `8,500 m`, an atmospheric cutoff at `120,000 m`, and a starting altitude of `160,000 m`. Atmospheric drag uses `0.5 rho Cd A v²`; density is exponential below the cutoff. The gravity, atmosphere, and tangent-plane treatment are intentionally low order and do not include Earth oblateness, winds, lift, rotation/Coriolis terms, a curved trajectory integrator, or a measured time-varying vertical atmosphere.

Ablation removes mass using an authored heat-transfer coefficient and material heat of ablation. Dynamic pressure can trigger breakup when it exceeds a representative material-strength threshold. The three versioned profiles use drag coefficients `1.05`, `1.0`, and `0.9`; illustrative breakup strengths `0.25`, `2`, and `12 MPa`; heat-of-ablation values `5`, `8`, and `6.3 MJ/kg`; and display-model heat-transfer coefficients `1.8e-4`, `1e-4`, and `6e-5` for porous rock, stone, and iron respectively. Those values characterize the application's teaching model, not tested specimens. A deterministic seed controls fragment separation and procedural effects, so identical serialized parameters replay identically.

The reached-surface/airburst result reports this simplified integrator's terminal outcome. It does not resolve fragment–fragment interactions, changing shape or orientation, hypersonic flow, radiative transfer, chemistry, ionization, acoustic propagation, ground composition, water entry, seismic coupling, or uncertainty. It must not be interpreted as a prediction for a real object.

Flash intensity, crater radius, ejecta radius, shockwave display speed, plume height, dust lifetime, and haze are held in a separate visual profile. They use bounded energy-driven heuristics and may be exaggerated so the event remains legible at astronomical render scale. The crater is a removable local overlay rather than global Earth tessellation or terrain deformation. The shockwave, plume, and haze do not model blast damage, ejecta ballistics, fire, tsunami, atmospheric circulation, ozone, climate, extinction, casualties, or economic effects. Reduced-motion and reduce-flashes options change camera/effect presentation only; they cannot change the trajectory or physical summary.

## Phase 6 celestial-background classification

The Phase 6 sky is a **hybrid scientific visualization**, not a date-matched observation or calibrated night-sky simulation. Its diffuse Milky Way foundation is a NASA SVS all-sky rendering informed by Gaia DR2, while its discrete point layer comes from the HEASARC Bright Star Catalog, 5th Revised Ed. Exact source responses, transformations, checksums, coordinate declarations, and limitations are recorded separately in [`public/assets/phase6/sky-manifest.json`](./public/assets/phase6/sky-manifest.json).

The selected NASA `milkyway_2020` OpenEXR intentionally excludes the source product's bright-star layer. The project creates 4K and 8K WebP display derivatives using a fixed ACES-fitted tone map, sRGB encoding, lossy WebP compression, and—at 4K—a linear-space 2 × 2 area average. These choices preserve a coherent celestial backdrop but change code values and fine detail. Panorama pixels are not radiance, surface brightness, dust density, distance, or a physical spectral measurement; runtime intensity, exposure, blending, and any bloom remain authored display controls.

The 9,096 retained BSC5P points are static FK5 equatorial directions at equinox and epoch J2000.0. The panorama is ICRF/J2000; the renderer treats those axes as coincident for visualization and does not model their sub-arcsecond distinction. The catalog is not propagated to the selected simulation epoch: proper motion, precession, parallax, annual/diurnal aberration, radial velocity, atmospheric refraction, extinction, variability, multiplicity, and occultation are absent. The retained HEASARC `Vmag` field—documented there as photographic magnitude and copied without `Vmag_Code` or `Vmag_Uncert`—can drive relative display size or intensity, and B−V can provide an approximate color cue; neither produces a calibrated detector response or complete spectral energy distribution. The 310 records without B−V require a neutral authored fallback.

The panorama's plate carrée convention has RA increasing right-to-left, RA 0h at horizontal center, and declination increasing upward. The renderer must apply one consistent equatorial-to-scene axis mapping to both panorama and point directions. A matching visual direction does not imply the sky is correct for a particular observer, date, light-pollution level, wavelength band, or exposure.

## Phase 6 comet and statistical-belt classification

Phase 6 resolves five named comets through the NASA/JPL Small-Body Database and stores a normalized, provenance-bearing pinned sidecar, including canonical identity, SPK ID, orbit-solution ID/epoch, elements, covariance/model fields, nongravitational parameters where supplied, physical parameters, and explicit nulls where JPL supplies no value. The resolver rejects ambiguous designations. Horizons generation uses pinned record commands for 1P, 2P, and 67P and exact `DES=` commands for Hale-Bopp and NEOWISE; every response must match the cataloged target name and pinned `JPL#<orbit-id>` source label. No SBDB or Horizons request is made by the normal browser application.

The runtime comet positions and velocities are **scientific data within the bundled interval**: geometric heliocentric `ICRF`/`ECLIPTIC`, `TDB`, SI-converted JPL Horizons vectors from 2000 through 2100. Each logical comet is routed across contiguous uniform-cadence segments, using one-day baseline sampling and six-hour sampling in planned perihelion windows. Horizons integrates adjacent requests independently, so their shared endpoint can differ by small numerical amounts. Generation rejects differences above `100 m` or `2e-7 m/s`, then assigns the preceding request's endpoint to both series; the committed 96 boundaries are therefore byte-consistent and validate exactly. Cubic Hermite interpolation remains an interpolation method rather than a force model. Orbit lines are sampled from the same provider and remain open/coverage-limited when the requested orbital window exceeds stored vectors. The application never silently extrapolates a missing comet arc.

Comet appearance is an **educational approximation**. Each nucleus is a deterministic authored irregular mesh, not a spacecraft-derived shape model. Coma activity uses a smooth distance profile and soft radial-density opacity falloff, not a measured production rate or radiative-transfer solution. The ion tail is a narrow ribbon constrained to the instantaneous anti-solar direction with a small deterministic visual ripple; it is not a magnetohydrodynamic solar-wind/plasma simulation. The curved dust visualization reconstructs timestamped historical nucleus states with four deterministic grains per age bin, authored ejection velocities, and a simple radiation-pressure-like acceleration, giving the grains memory and curvature distinct from the ion ribbon. The model omits measured grain-size distributions, fragmentation, sublimation chemistry, Lorentz forces, solar-wind variability, planetary perturbation of released grains, optical-depth transfer, and observation-calibrated brightness.

The inspector warns when a displayed date is far from the pinned JPL orbit-solution epoch because long-range comet predictions and nongravitational behavior can be uncertain even while the requested Horizons vector is inside the downloaded interval. That warning is not a quantitative uncertainty envelope. Missing mass, diameter, or rotation values remain `null`; any nucleus size needed only for rendering is explicitly identified as an illustrative fallback.

The optional asteroid and Kuiper belts are **statistical visualizations**. Their deterministic instanced particles sample authored radial, eccentricity, and inclination distributions for context. Marker sizes are normalized in screen space against each quality tier's statistical point budget, so they communicate population structure rather than physical object diameter. They are not MPC/JPL catalog entries, do not correspond one-to-one with real objects, do not evolve dynamically, and must not be counted or queried as discoveries. Named bodies listed as exclusions are not claimed to be represented by an instance. Ordinary asteroids do not receive physical tails; any colored orbit or path line is an interface visualization, not emitted material.

## Phase 5 classification

Phase 5 retains the generated NASA/JPL Horizons vectors for translational position and velocity. Those states are scientific source data with recorded provenance, not synthetic circular orbits, and orbit lines and trails are sampled from that same provider. The body renderer is a **hybrid scientific visualization**: it combines official NASA/USGS browse mosaics, official quantitative elevation inputs, published wind/ring parameters, deterministic project-generated maps, and project-authored orientation, lighting, atmospheric motion, ring scattering, exposure, and fallback algorithms. Source provenance for one layer must not be generalized into a claim that the complete rendered frame is an observation or a uniformly validated physical model.

True scale still preserves the ratio between catalog radius and ephemeris distance, but it does not make a texture, shader, rotation seed, wind profile, ring treatment, or rendered appearance scientifically faithful. Catalog physical seed values, screen-space overlays, presentation-scale sizes, generated normals/material masks, procedural layers, atmospheric lookup tables, post-processing, and analytic eclipsing must not be represented as Horizons products. Exact texture bytes and their separate semantics are recorded in [`public/assets/source-manifest.json`](./public/assets/source-manifest.json); versioned giant-planet visualization inputs are recorded separately in [`src/data/catalogs/giant-planet-visual-profiles.json`](./src/data/catalogs/giant-planet-visual-profiles.json).

## Surface textures and static composites

Phase 4 includes 13 compact, 2:1 global runtime textures for Mercury, Venus radar mode, Earth, the Moon, and Mars. Seven color/radar/cloud files are byte-for-byte NASA/USGS downloads with local renames only. Six linear PNGs are deterministic project-generated derivatives. They have different meanings and evidentiary status:

- Mercury uses a MESSENGER MDIS MD3 false-color mosaic. RGB contains 1000 nm, 750 nm, and 430 nm bands; it is neither the principal-component enhanced-color product nor natural-eye color. Its separate normal map comes from a quantitative USGS MESSENGER DEM, resampled and visually slope-amplified `36×` by the project.
- Venus' optional surface view uses an achromatic Magellan C3-MIDR SAR mosaic. Radar brightness responds to roughness, slope/look geometry, dielectric properties, and processing—not optical color or elevation. The default Venus view is an opaque procedural cloud deck because the surface is not visible in ordinary visible light.
- Earth's day, night, and cloud layers are static composites. Blue Marble stitches observations acquired over time; the city-light layer derives from DMSP OLS observations; the cloud record combines two days of visible imagery with a third day of thermal-infrared polar imagery. None is a live, date-matched Earth state. Earth normal/ocean/roughness maps are authored image heuristics, not geophysical measurements.
- The Moon uses the CGI Moon Kit's 2025 LROC WAC color rendering. It is white-balanced and exposure-adjusted, includes inpainted gaps and lower-resolution monochromatic polar fill, and is explicitly described by NASA as aesthetic rather than science-grade. Its separate normal map comes from quantitative NASA LOLA displacement, resampled and visually slope-amplified `48×` by the project.
- Mars uses an artistically colorized NASA Ames/USGS mosaic that blends an older Viking color mosaic over controlled grayscale MDIM 2.1. It is not calibrated true-color surface reflectance. Its separate normal map comes from quantitative NASA MOLA topography, resampled and visually slope-amplified `1.4×` by the project.

The compact 1024 × 512 color/radar browses and 2048 × 1024 rendering maps are appropriate for globe-scale presentation, not detailed cartography. Source DEMs are build inputs rather than runtime displacement maps; runtime geometry remains spherical. The normal PNGs store shading vectors, not elevation. There is no measured physical roughness map or surface time series.

## Derived relief, ocean, night, and material heuristics

Mercury, Moon, and Mars shading normals are generated offline from quantitative elevations. The generator downsamples their official source rasters, rolls the 0–360° Mercury and Mars sources by 180° to align with the runtime color maps, computes wrapped central height gradients with latitude-aware east-west spacing, applies the declared visual slope factors, and encodes normalized tangent-space vectors. The underlying elevation source is quantitative, but the output is an authored rendering derivative: it has resampling, 8-bit vector quantization, slope exaggeration, and no geometric displacement.

Earth deliberately uses image heuristics instead. Its normal map comes from low-strength central differences over Blue Marble's encoded RGB luminance and is attenuated over the separately derived water-like mask. It is a **relief proxy**, not DEM-derived topography. The ocean mask comes from a smooth blue-dominance threshold and is not an authoritative land/water classification, coastline, bathymetry, ice mask, or sea-state model; blue ice, inland water, haze, and image-processing artifacts can be misclassified. The roughness map is an authored low-ocean/high-land rendering parameter, not a measured physical property.

The independent Earth cloud shell rotates separately from the surface. Ocean glint samples the separate linear mask and remains a compact specular approximation rather than a wave/BRDF model. The night texture is gated by the body-local geometric terminator and amplified for visibility; it is not radiometric emission and does not evolve with the simulation date.

All ordinary surfaces use authored roughness, ambient, tint, specular, tone-mapping, and exposure choices. Therefore neither pixel luminance nor color in a screenshot should be interpreted as a calibrated physical measurement. Color/albedo textures are decoded as sRGB where declared; normal, radar, cloud-density, ocean-mask, and roughness textures are sampled as linear data.

## Data-driven giant planets and dated features

Phase 5 gives the four giant planets dedicated materials, but “data-driven” describes the inputs rather than a validated atmospheric simulation. Jupiter and Saturn sample compact tables of published cloud-tracked zonal winds; Uranus evaluates a cited Legendre drift model; Neptune evaluates a cited even polynomial through `|latitude| = 75°` and applies a project cosine taper to zero at the poles. The renderer uses the resulting latitude-dependent speed to phase project-authored procedural cloud motion; Jupiter's dated OPAL map remains static and sharp. It does not solve fluid equations, conserve momentum or energy, assimilate observations, couple vertical layers, or reproduce a date-specific weather state.

Jupiter uses the official Hubble OPAL Cycle 32 Rotation A global color map assembled from observations on 2025-12-11. The lossless WebP runtime derivative preserves the TIFF's 3600 × 1800 RGB pixels, but the image remains an sRGB visual foundation rather than a cloud albedo measurement synchronized to the simulation clock. The runtime removes the observed Great Red Spot from its source location using both neighboring sides of the latitude band, then reuses those observed color pixels in a catalog-controlled vortex. A separate neutral-centered grayscale residual derived from NASA PIA23606 adds restrained inner-cloud structure at higher local resolution while preserving OPAL's palette and sampled cloud structure. PIA23606 is an enhanced-color JunoCam mosaic acquired on 2019-02-12, so the result is explicitly a mixed-date presentation enhancement—not a calibrated 2025 reconstruction, measured outline, measured wind field, cloud-height product, or live weather. Published center, approximate dimensions, drift, and oscillation inform the feature, while the runtime boundary is an authored elliptical blend. Counterclockwise circulation, subtle periodic collar lag, and `5%` pulsation remain authored, but there is no longer a sine-painted spiral or synthetic warm core. It is categorized as `animated-visualization`, not an observed velocity-field integration or forecast of the real vortex.

Saturn's sampled Cassini wind table contains documented gaps. The project linearly bridges `+5.5°` to `−6.5°`, `−40.5°` to `−43.5°`, and `−54°` to `−57.5°`; motion within those spans is interpolation, not measurement. Jupiter's measured table ends at `±60°`, so the project tapers the profile to zero at each pole. The Uranus conversion and Neptune polynomial use their declared reference rotations and sign conventions, which are not substitutes for authoritative prime-meridian rotation series.

Neptune's NDS-2018 feature has a finite TDB interval in the catalog and is suppressed outside it. Inside the interval, an authored lifecycle envelope, approximate drift, contrast, and companion-cloud effect produce the visible storm. Its category `dated-nonpermanent-visualization` is intentional: the selected simulation date gates a historical visualization, but the rendered longitude and morphology are not a complete observation-by-observation reconstruction. No current/live weather service is queried.

The four surfaces are rendered as oblate ellipsoids using catalog equatorial-to-mean and polar-to-mean radius ratios. This is still a scaled sphere mesh rather than a geodetic reference surface or limb-fit shape model. Bands, haze, methane-cloud detail, noise spectra, colors, contrast, and subpixel texture filtering remain authored. Jupiter is the only giant with a Phase 5 photographic map; Saturn, Uranus, and Neptune remain procedurally colored.

## Ring systems

Saturn, Uranus, and Neptune use geometrically thin annular meshes with source-attributed radial regions. A one-dimensional project-generated texture encodes representative optical depth and authored color across each system. Radial supersampling helps narrow rings and gaps survive the finite texture resolution, but does not add physical width, unresolved structure, or new measurements. Display optical-depth gains—especially for the very faint Uranian and Neptunian systems—are visibility controls.

The ring shader approximates extinction, view/sun incidence, forward scattering, a soft analytic shadow from the oblate planet onto the rings, and restrained deterministic sparkle. Saturn additionally samples its radial optical-depth profile to cast an analytic ring shadow onto the planet. These terms are not radiometrically calibrated and do not model individual particles, multiple scattering, wavelength-dependent phase functions, mutual particle shadowing, or thermal emission.

Named Saturn gaps and divisions and the cataloged Uranian/Neptunian regions inform radial structure. Saturn's spokes are an optional, procedural transient effect enabled only at high/ultra quality; they are not tied to an observed epoch. Neptune's Adams-ring arcs are localized with fixed authored angular peaks rather than an arc ephemeris. Ring colors, spoke sectors, arc longitudes, sparkle phases, and optical-depth display gains must not be interpreted as observations. Ring moons, shepherding, resonances, density/bending waves, eccentric ringlets, precession, and time evolution are absent.

## Giant-planet coordinate conventions

Horizons translation uses its declared `ICRF` reference system and `ECLIPTIC` plane. After floating-origin subtraction, physical vectors map into Three.js scene axes as `(x, z, −y)`. The rotating-body model treats body-local `+Z` as north, while Three.js sphere and ring geometry use visual-local `+Y` as north; the giant renderer applies the same `(x, z, −y)` mapping between them. Ring annuli occupy the visual-local `XZ` equatorial plane and inherit the body's provisional axial orientation.

Texture sampling and close-up presets use **visual longitude**, not authoritative IAU System I, II, or III longitude. Jupiter's OPAL source map is calibrated so the observed spot and tracked vortex coincide near visual longitude `+142°` at the map epoch. The Great Red Spot preset follows that animated visual target; Saturn's preset frames the rendered ring extent. Neither preset is a telescope/spacecraft pointing solution, and neither asserts a physical prime meridian.

## Procedural Sun, clouds, and inner-planet atmospheres

The Sun's photosphere remains deterministic shader noise rather than a raster asset. High and ultra quality add finer multiscale granulation and dark intergranular lanes; the same procedural field authors structured penumbra, umbra, and limb-weighted faculae. A lower `1.48` display-emission multiplier preserves more photosphere contrast, and the quality-gated corona shells fade progressively outward. The morphology was reviewed against the official [SDO HMI/AIA channel descriptions](https://sdo.gsfc.nasa.gov/data/channels.php) and NASA SVS's [February 2013 *Busy Sun* HMI visible-light sequence and 4K frames](https://svs.gsfc.nasa.gov/4133/), but neither observation is used as a texture. The result is not a live or timestamp-matched Sun, radiometrically calibrated imagery, a measured sunspot record, or a magnetohydrodynamic model.

Venus retains two procedural cloud decks over a separate optional Magellan radar **data view**. Both decks now use the same modeled four-day westward superrotation with a fixed visual phase offset. Restrained UV-absorber-inspired contrast, chevrons, zonal bands, a polar hood, and softer twilight are qualitative rendering motifs informed by NASA's [Hubble ultraviolet cloud-top description](https://science.nasa.gov/photojournal/venus-cloud-tops-viewed-by-hubble/) and the [Akatsuki UVI instrument description](https://darts.isas.jaxa.jp/missions/akatsuki/uvi_en.html); they are not sampled cloud features. The CC BY 4.0 [Akatsuki UVI Level 3 radiance maps](https://doi.org/10.17597/isas.darts/vco-00016) and [Cloud Motion Vector dataset](https://doi.org/10.17597/isas.darts/vco-00020) were evaluated only as possible future inputs. No UVI or cloud-motion-vector asset was added, and the current animation is not observed, live, date-matched, or CMV-driven Venus weather. This visual revision therefore adds no third-party runtime asset or license. Earth's mapped cloud layer remains a static composite that moves as a rigid shell with a small relative rotation offset; it does not advect, form, dissipate, or respond to the simulated atmosphere. Mars adds procedural polar caps, a sparse rotating dust-cloud shell, and analytic dust-colored haze; these are illustrative layers, not a date-specific weather or seasonal model.

Earth's high/ultra atmosphere path uses deterministic project-precomputed RGB lookup textures for physical transmittance (`96 × 32`), approximate second-and-higher-order multi-scattering (`32 × 16`), and combined sky-view radiance/opacity (`96 × 48`). The tables integrate spherical Rayleigh, Mie, and ozone terms in SI units, but remain a compact three-wavelength visualization model: multi-scattering uses an energy-conserving escape-probability closure rather than a full iterative 4D solution, sky view is azimuth-averaged at one representative altitude, and 8-bit encodings limit range and precision. Low/medium quality use the analytic fallback. Venus and Mars use compact analytic haze shells. None of these paths models full spectra, polarization, refraction, terrain, weather, or locally varying aerosol/composition profiles.

The renderer uses an HDR render/composite path with ACES filmic tone mapping, restrained above-white-threshold bloom, and camera-context exposure presets for deep-space overview, ordinary body views, and solar close-up. Bloom thresholds are intentionally above display white so ordinary lit surfaces do not glow. Because renderable half-float color attachments are optional in WebGL2, contexts without `EXT_color_buffer_float` bypass the composer and bloom and use direct rendering; this is a visual fallback, not HDR parity. These are local display controls, not radiometric calibration, eye adaptation, or a physical camera model.

The low/medium/high/ultra selector changes texture anisotropy, Earth atmosphere lookup use, bloom strength/resolution, visible corona-shell count, comet and statistical-belt budgets, optional Saturn-spoke strength, sky tier, black-hole lensing path, and the heavy-effect adaptive-resolution bounds described above. It is a performance/detail control, not a scientific-accuracy level. Failed or unavailable images fall back to deterministic procedural surface/cloud materials and are reported through the asset-state diagnostic.

Except for Phase 10's explicitly isolated and BSD-3-Clause-attributed Bruneton black-hole ray mappings, inward deflection branch, and redistributed lookup tables, the GLSL, atmosphere lookup precomputation, generated-map code, and rendering integrations are project-authored. Other cited references inform physical coefficients and model design only.

## Rotation, sunlight, eclipses, and tide-ready geometry

Most bodies use constant-rate seed rotation models based on catalog periods and axial tilts; Phase 5 supplies giant-planet tilt seeds including Uranus' extreme `97.77°` value. That greater-than-90-degree pole is the single convention used to express Uranus' retrograde rotation; a second direction reversal is deliberately not applied. Their tilt node is provisionally the inertial +X axis and their default prime-meridian phase is zero at J2000. They do not implement authoritative IAU pole/prime-meridian series, precession/nutation, or body-specific librations, so texture feature longitude is not guaranteed to match the physical orientation at a requested epoch. The giant-planet differential-flow shaders animate relative atmospheric detail but do not alter this underlying body orientation. The Moon instead uses an approximate synchronous orientation: local +X follows the instantaneous line from Moon to Earth and local +Z follows the instantaneous orbital angular momentum when velocity is available. Physical and optical libration and an authoritative lunar pole model remain absent.

The body-to-Sun direction and nominal irradiance are computed from Float64 ephemeris positions. The inertial direction is transformed through the sampled body orientation into body-local coordinates, so geometric day/night and terminator logic rotate with the body rather than assuming a texture-space Sun direction. The diagnostic irradiance uses `1361 W m^-2` at 1 AU and inverse-square distance scaling. For display, the material takes the fourth root of relative irradiance and clamps it to `0.55`–`1.8`; this irradiance compression and the contextual exposure presets are not radiometric rendering.

Eclipse dimming treats the Sun and each possible occultor as apparent spherical discs seen from the target body's center. Their overlap gives a clamped visible-Sun fraction and a `none`/`partial`/`annular`/`total` classification. The smallest visible fraction uniformly scales the direct surface, cloud, and atmosphere-color terms. The renderer does not trace an umbra or penumbra footprint across the body, account for oblateness or terrain, model atmospheric refraction, or validate contact timing as an eclipse-prediction service.

The Phase 12 Earth tide-ready service derives Earth-fixed Sun/Moon directions from the same ephemerides and approximate rotation model. It can evaluate subsolar/sublunar points, separate point-mass quadrupole forcing, differential acceleration, and center tidal tensors. The flagged developer view visualizes normalized, exaggerated forcing geometry only; it does not deform or predict the ocean or solid Earth. Bathymetry, harmonic constituents, Love numbers, loading, elasticity, self-gravity, hydrodynamics, and ocean/solid-Earth response are absent.

## Ephemeris contract

The planetary/lunar dataset contains the Sun, Mercury, Venus, Earth, Moon, Mars, Jupiter, Saturn, Uranus, and Neptune. The separate comet bundle contains 101 physical cadence series routed to five logical bodies. Each vector uses the same geometric state contract relative to Horizons center `500@10` (the Sun), with `REF_SYSTEM=ICRF`, `REF_PLANE=ECLIPTIC`, `TIME_TYPE=TDB`, `VEC_TABLE=2`, and `VEC_CORR=NONE`. The Moon is therefore stored heliocentrically, not as an Earth-centered vector. The Sun relative to the Sun is the exact zero state.

Horizons responses declare positions in kilometers and velocities in kilometers per second (`KM-S`). The strict parser accepts only the delimited `$$SOE`/`$$EOE` vector block and converts each component to SI meters or meters per second exactly once. The compact binary stores six little-endian Float64 components per sample in `px, py, pz, vx, vy, vz` order.

Coverage is inclusive from `JD 2451544.5 TDB` (`2000-01-01T00:00:00 TDB`) through `JD 2488069.5 TDB` (`2100-01-01T00:00:00 TDB`). The Sun and eight planets are sampled every `86,400 s`; the Moon is sampled every `21,600 s`. Requests outside a body's coverage are rejected by the normal provider instead of silently substituting a fixture or approximate orbit.

## Runtime interpolation

The browser verifies both manifest-pinned binary digests and transfers both ArrayBuffers to the ephemeris Web Worker for decoding. The composite provider evaluates intermediate epochs with cubic Hermite interpolation using both endpoint positions and endpoint velocities. Sampling writes into caller-owned state objects to avoid per-frame allocation. Debug trails are sampled from this same provider; they are not independently generated ellipses.

Hermite interpolation preserves endpoint state values, but it is still an interpolation of a finite cadence. It does not add force integration, relativity, or accuracy beyond the source samples.

## Render-scale semantics

The Phase 3 scale contract retained by Phase 5 keeps orbital positions linear in both modes. With the default conversion `S = 149,597,870,700 m/render unit` and the current floating origin `o`, the renderer maps a physical position `p` with:

```text
localPosition = (p - o) / S
```

The implementation also converts the source ecliptic axes into the Three.js scene axes after subtracting the origin. It does not apply a logarithmic, compressed, or otherwise nonlinear distance mapping.

**True scale** maps a catalog mean radius `R` to `R / S`. Position and radius therefore share one conversion and retain their physical ratio. At a whole-system view, most bodies are smaller than one display pixel; screen-space labels and the selection ring remain available but are not physical geometry.

**Presentation scale** leaves `localPosition` unchanged and multiplies only the rendered radius. The default kind factors are `25×` for the Sun, `250×` for planets, `500×` for moons, and `5,000×` for comet nuclei. Earth and the Moon deliberately override those unrelated planet/moon defaults with one shared `40×` factor. That preserves their physical radius ratio and keeps their presentation spheres separate across the bundled interval without changing their linear center-to-center separation. These values affect rendering and camera framing only; they never modify ephemeris state, inspector distance/speed values, collision state, or stored catalog radii.

The default scale transition lasts `0.7` seconds of real display time and uses a smoothstep blend. It is reversible. The persistent “body sizes exaggerated” warning appears immediately when presentation mode is requested and remains until its contribution has reached zero during a transition back to true scale. With reduced motion enabled, the requested mode is applied immediately.

## Camera-relative rendering and navigation

Simulation body positions and velocities remain heliocentric SI `Number`/Float64 values. Overview mode keeps the floating render origin on the Sun. Free-orbit, body-follow, Earth–Moon system, top-down, and chase modes continually rebase it to the selected body after ephemeris sampling; Earth–Moon mode selects Earth as that anchor. Camera and desired-camera poses are remapped across every origin revision before local coordinates reach Three.js matrices, which keeps follow motion stable at outer-planet distances.

The six implemented modes are:

- **Solar System overview:** frames the current ephemeris extent around the Sun.
- **Free orbit:** enables pointer orbit, pan, and wheel dolly around the selected target.
- **Body follow:** transports the camera with the target while preserving a stable viewing direction and offset.
- **Earth–Moon system:** frames the two current rendered spheres from ecliptic north using their unchanged linear ephemeris positions. It does not magnify, compress, or replace their separation.
- **Top-down ecliptic:** views the selected target along ecliptic north.
- **Velocity chase:** positions the camera behind the selected body's heliocentric velocity and looks ahead along that direction.

Programmatic pose changes use an exponentially damped real-time camera rig and snap when reduced motion is requested. Near and far clipping planes are recalculated from camera distance, focus radius, and visible body extents; tightening is damped to avoid abrupt clipping changes. Free-orbit minimum/maximum distance, pan sensitivity, and rotation sensitivity are recalculated from the rendered target radius, camera distance, viewport, field of view, and current system extent.

Phase 5 adds a body-tracked Jupiter Great Red Spot preset at `2.8` rendered equatorial radii and a low-oblique Saturn ring preset at `6.2` radii. Camera bounds include the complete visual ring extent so wide systems are not clipped. The later Earth–Moon system mode and cinematic tour are likewise navigation/presentation aids, not physical telescope, spacecraft, or optical models. General near-surface collision protection and arbitrary surface-coordinate inspection remain absent.

## Ephemeris orbit lines and trails

Orbit geometry is sampled on the CPU from the bundled ephemeris provider into Float64 timestamps and positions. The nominal display windows are 88 days for Mercury, 225 for Venus, 366 for Earth, 28 for the Moon, 687 for Mars, 4,334 for Jupiter, 10,760 for Saturn, 30,688 for Uranus, and 60,190 for Neptune. Planet paths are Sun-relative; the Moon's orbit path is Earth-relative. No plane is flattened, no ellipse is reconstructed from a fixed eccentricity, and the line is intentionally left open because its sampled endpoints need not coincide.

Each orbit uses at most 2,049 points and requests up to two interpolated samples per stored source interval. When that requested density fits below the cap, timestamps remain uniform. When it exceeds the cap, the path starts with 64 time intervals and adds genuine provider samples where endpoint velocity, chord turn, or provider-sampled midpoint sagitta exceeds the configured visual tolerance; it does not fit Catmull–Rom, Bézier, or another display spline. This prevents fast comet perihelia from becoming long polygonal chords while leaving slowly changing distant arcs sparse. A requested interval is clipped to the intersection of the relevant bodies' trusted coverage, with no missing arc fabricated. In particular, Neptune's nominal 60,190-day window is longer than the 2000–2100 bundle and is therefore coverage-truncated.

The selected-body trail is a separate, more opaque path in the provider's heliocentric source frame. Its configured interval ranges from seven days for the Moon to two years for Uranus and Neptune, with at most 513 points and the same capacity-limited adaptive provider sampling. The user can select the interval immediately before or after the current epoch. It is refreshed when the target, interval, or exact date changes and whenever playback crosses that body's stored source cadence; it is a resampled path, not an accumulating particle trail.

Orbit windows refresh after exact-date changes and at body-specific simulated-time cadences during playback: daily for the Moon, from 7 through 180 days for the inner planets through Saturn, and annually for Uranus and Neptune. Refresh work is rate-limited to ten times per real second. The live body state remains authoritative between path refreshes.

Only after Float64 path generation does each vertex combine with its current Sun/Earth center, subtract the active floating origin, convert axes, scale, and narrow to Float32. The GPU line matrix remains at local zero, so no `+30 AU`/`-30 AU` cancellation is deferred to Float32 matrix composition near Neptune. Regression tests preserve one-metre detail at Neptune scale, including 600 successive rebases, and verify the Earth-relative Moon path. Per-vertex intensity fades with physical distance from the current body; the selected trail retains a brighter distant floor than orbit lines. Coverage-truncation warnings, including Neptune's incomplete arc, are surfaced in the canvas and selected-body inspector. Orbit labels, nodes, and perihelion overlays remain optional future layers.

## Navigator, labels, and inspector readouts

All 15 bundled bodies can be searched, selected, and focused. Body labels and the selection marker are DOM overlays projected from the current camera-relative positions; label collision suppression gives the selected target priority. They remain a constant screen-space size and must not be read as angular diameter or physical radius.

The basic inspector combines catalog seed properties (classification, mean radius, mass, and rotation period) with throttled runtime telemetry. “Distance from Sun” is the Euclidean magnitude of the selected heliocentric position, and “heliocentric speed” is the magnitude of its provider velocity. These are data readouts. The inspector separately identifies the selected material and whether its asset is ready, loading, procedural, or using a fallback; giant-planet diagnostics additionally expose catalog version, feature/ring state, and selected close-up preset, while comet diagnostics disclose solution age, visual fallbacks, and coverage limits. Those labels are not claims that every aspect of a material is authoritative.

## Independent validation

Planetary/lunar validation used separate cached Horizons `TLIST` requests at epochs withheld from generation. For each body, eight deterministic source intervals were selected and checked at fractions `0.25`, `0.5`, and `0.75`, giving 24 comparisons per body and 240 total. These reference states are not samples copied from the generated uniform grid. The committed report passed all structural checks and all 240 independent comparisons.

The budgets and measured Euclidean maximum errors are:

| Body | Checks | Position budget | Maximum position error | Velocity budget | Maximum velocity error |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sun | 24 | 0 m | 0 m | 0 m/s | 0 m/s |
| Mercury | 24 | 50,000 m | 18,597.903 m | 2 m/s | 0.646111 m/s |
| Venus | 24 | 1,000 m | 176.799 m | 0.025 m/s | 0.006139 m/s |
| Earth | 24 | 500 m | 59.266 m | 0.020 m/s | 0.002060 m/s |
| Moon | 24 | 100 m | 16.661 m | 0.015 m/s | 0.002314 m/s |
| Mars | 24 | 100 m | 7.417 m | 0.002 m/s | 0.000292 m/s |
| Jupiter | 24 | 25,000 m | 7,098.555 m | 1 m/s | 0.250558 m/s |
| Saturn | 24 | 1,000 m | 166.418 m | 0.050 m/s | 0.005987 m/s |
| Uranus | 24 | 2,000 m | 355.307 m | 0.050 m/s | 0.012502 m/s |
| Neptune | 24 | 2,000 m | 287.806 m | 0.050 m/s | 0.010318 m/s |

The separate small-body release applies the same withheld-epoch principle to every one of its 101 physical cadence segments. It requests one deterministic interval per segment at fractions `0.25`, `0.5`, and `0.75`; long `TLIST` URL sets are split into groups of at most 24 epochs without reusing generation-grid samples. All 303 comparisons and all structural/routing checks passed. Baseline budgets are `250,000 m` and `5 m/s`; perihelion budgets are `25,000 m` and `1 m/s`. Across both kinds, the measured maxima were `298.858584 m` and `0.0141331 m/s`.

These results measure the binary/parser/interpolator pipelines against Horizons at the selected epochs. They are not an estimate of Horizons' absolute uncertainty, do not validate SBDB covariance interpretation, rotation, lighting, eclipse, tide, texture, atmosphere, wind, storm, ring, comet-tail, belt, or material rendering, and do not establish accuracy outside the stored intervals.

## UTC, TT, and approximate TDB

The Phase 1 clock architecture remains in use in Phase 6. It accepts civil timestamps in UTC and computes Julian Date UTC from the Unix epoch relation:

```text
JD_UTC = unixMilliseconds / 86,400,000 + 2,440,587.5
```

It approximates Terrestrial Time with a fixed modern offset:

```text
TT - UTC ~= 37 s + 32.184 s = 69.184 s
```

It then applies this low-order periodic approximation:

```text
g = 357.53 degrees + 0.9856003 degrees * (JD_TT - 2,451,545.0)
TDB - TT ~= 0.001657 sin(g) + 0.000022 sin(2g) seconds
```

Limitations:

- `TAI - UTC` is not constant across history; the fixed 37-second value is a modern-era convenience.
- Future leap seconds are unknown until announced.
- JavaScript `Date` does not represent leap seconds.
- The periodic expression is a low-order approximation, not an IAU/IERS-grade time transformation.
- Displayed TDB and the UTC-to-ephemeris lookup epoch should therefore be marked approximate.

## Phase 1 foundation retained

The Phase 1 deterministic Sun/Earth fixture remains useful only in isolated architecture tests. Its Earth position was exactly one astronomical unit on positive X, both velocities were zero, and neither state was an observation. It is not used by the normal Phase 5 provider path.

Phase 1 also established the SI-unit helpers, allocation-free vectors, Julian Date wrapper, deterministic simulation clock, typed events, single animation loop, raw Three.js boundary, and floating-origin behavior retained by Phase 6.

## Extension phases 2–4 notes

Natural moons use a dated catalog contract. Inside 1990–2035, each major moon selects the nearest preceding 32-day NASA/JPL Horizons parent-centered anchor, derives an osculating ellipse from that position/velocity state, and evaluates it from absolute TDB time. This avoids straight interpolation and incremental phase drift, but it remains a two-body approximation between anchors: it does not reproduce every resonance, perturbation, libration, or authoritative orientation model. Outside anchor coverage the provider exposes the catalog Kepler fallback. Minor-point records intentionally preserve the August 2026 official snapshot count while documenting that their compact orbital states are approximations. The renderer applies local-system presentation scale when an exaggerated parent sphere would otherwise occlude a moon orbit. This visual scaling never changes physical state.

Earth-orbit objects use a CelesTrak OMM normalization boundary and `satellite.js` SGP4/SDP4. The displayed Earth-centered inertial axes preserve TEME orientation as a documented visualization approximation; a full Earth-orientation/IERS frame chain is not implemented. The bundled five-record catalog remains explicitly `fallback: true` because a live CelesTrak refresh was unavailable, and preferred/hard age windows prevent silent century-scale propagation. Spacecraft/probe records use a separate 14-mission NASA/JPL Horizons bundle and exact returned validity intervals. Their open paths are cubic-Hermite samples of the official position/velocity knots, not authored curves, but they remain visual ephemerides rather than reconstructed navigation solutions. Earth propagation uses a module worker when available; spacecraft interpolation stays in the main data graph so the large Horizons bundle is not downloaded twice.

Major-moon eclipse state uses a geometric parent umbra with spherical bodies and parallel-light approximation at moon scale. Galilean transit shadows are projected as restrained dark surface markers on Jupiter when a moon lies sunward and its ray intersects the parent sphere. This is a visual capability, not a contact-timing, penumbra, oblateness, atmospheric-refraction, or photometric transit model. Moon labels use screen-space priority and rectangle collision suppression; selected labels win over labels in the focused parent system, which win over other visible major moons.

## Explicitly absent or simplified after Phase 12

- A leap-second/IERS-grade UTC-to-TDB pipeline
- Keplerian or other analytical fallback propagation in the normal runtime
- Authoritative IAU pole/prime-meridian rotation series, precession/nutation, dynamically coupled atmospheric differential rotation, and lunar physical libration
- Shape models, DEM displacement, measured physical roughness, calibrated physical BRDFs, spectral rendering, and radiometric exposure calibration
- Spatial eclipse shadow footprints, atmospheric eclipse optics, and prediction-grade contact timing
- Time-varying Earth surface, weather, cloud, city-light, or seasonal products; physical cloud and climate dynamics
- Full wavelength-resolved and iterative 4D atmospheric radiative transfer, measured composition/pressure profiles, polarization, refraction, and weather
- Ocean/solid-Earth tide prediction or response, bathymetry, harmonic constituents, Love numbers, loading, elasticity, self-gravity, or hydrodynamics; Phase 12 shows normalized and exaggerated forcing geometry only
- Particle-level or dynamically evolving rings; shepherd-moon/resonance physics; observed-date spoke and ring-arc ephemerides
- Measured comet shape models, physical coma chemistry, dust-size distributions, plasma/MHD tails, observation-calibrated comet brightness, and propagated uncertainty envelopes
- One-to-one cataloged asteroid/Kuiper objects or a dynamically evolving small-body population
- General near-surface/collision-aware observatory navigation and arbitrary surface-coordinate inspection
- Orbit labels, ascending nodes, and perihelion overlays
- Research-grade impact prediction or a research-grade stellar-evolution solver
- Coupled billion-year orbital evolution, mass-loss-driven migration, tidal engulfment, planetary climate response, or a resolved planetary-nebula model
- A physically possible solar supernova; the Phase 9 supernova mode is explicitly fictional and does not model collapse, radiation transport, nucleosynthesis, or ejecta hydrodynamics
- Research-grade orbital integration, relativity, climate, or collision physics
- KTX2/Basis GPU texture payloads; runtime imagery remains in the documented PNG, JPEG, and WebP formats
- A universal FPS guarantee: adaptive-resolution targets are controller thresholds and must be profiled on the release device/browser combination

Scientific provenance for translation must not be generalized into a claim that the whole visualization is scientifically accurate.
