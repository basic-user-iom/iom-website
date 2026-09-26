# Planet and comet visual review — 26 September 2026

## Confirmed defects and changes

- **Mars:** profile 4 incorrectly entered the Venus radar recoloring branch. The Viking RGB map now remains authoritative. A broad synthetic cap formerly started at about 51 degrees latitude and overpainted the map; polar caps are now synthetic only for the missing-map fallback, above about 78 degrees.
- **Saturn surface:** incomplete OPAL polar/occultation coverage is feathered into the modeled atmosphere. Giant shaders now use camera-relative positions, avoiding Float32 cancellation at AU distances.
- **Saturn rings:** replaced a slab 0.072 planetary radii thick with one double-sided optical sheet. Removed cylindrical walls and duplicate faces, corrected double sRGB-to-linear conversion and transparent output, filtered radial profiles, and removed repeated invented spokes. Lit/unlit face selection compares both Sun and observer; the planet shadow is applied once. Ring-to-planet shadow continues to sample the same optical-depth profile.
- **Uranus:** its rings are real, but narrow and dark. Measured radial regions remain; the artificial vertical wall responsible for the broad brown hoop is gone.
- **Uranus / Neptune:** removed hard-threshold white cloud spots. Modeled visible-light palettes are pale cyan / slightly bluer cyan, following the 2024 color reassessment. These are **procedural cloud tops, not measured global surface maps**. Dated Neptune storm activation remains bounded to its source interval.
- **Comets:** dust now follows solar gravity reduced by radiation pressure using bounded velocity-Verlet integration. Dust sampling uses the actual orbital plane. Both tails share one display scale; the four artificial display offsets are removed. Interpolated dust samples fill a diffuse fan, and the ion tail uses a narrow randomized envelope with an end fade. Activity governs brightness.

## Scientific references

- [NASA Viking global color views of Mars](https://science.nasa.gov/photojournal/global-color-views-of-mars/)
- [NASA residual polar caps](https://science.nasa.gov/photojournal/what-is-a-residual-polar-cap/)
- [NASA natural-color Saturn ring structure](https://science.nasa.gov/resource/colorful-structure-at-fine-scales/)
- [NASA transient Saturn spokes](https://science.nasa.gov/resource/spokes-on-the-wheel/)
- [NASA Uranus facts and rings](https://science.nasa.gov/uranus/facts/)
- [Oxford 2024 Uranus and Neptune color reassessment](https://www.ox.ac.uk/news/2024-01-05-new-images-reveal-what-neptune-and-uranus-really-look-0)
- [ESA comet structure: straight ion tail, curved dust tail](https://www.esa.int/ESA_Multimedia/Images/2023/11/Structure_of_a_comet)

The images establish appearance and qualitative structure. They do not calibrate this renderer's radiometry, predict transient cloud features, or supply a measured comet-tail forecast. Ring fine banding and arc phase remain illustrative. Comet tails retain a common compressed close-up display scale; dust ages are limited by bundled ephemeris coverage, so the initial epoch has only half a day of dust history.

## Validation

- Before/after screenshots: `tmp/planet-audit-before`, `tmp/planet-audit-after`.
- Additional all-planet / five-comet inspection: `tmp/planet-audit-all`.
- Regression tests cover planar ring geometry, one color conversion, preserved physical dust/ion length ratio, deterministic replay, and the gravity / radiation-pressure limits of dust propagation.

Controlled material captures in `tmp/material-lighting-review` cover daylight maps, lit/unlit/edge-on Saturn rings, and low/medium/high/ultra quality. This fixture uses a fixed illustrative light direction; it verifies materials, not an ephemeris observation. All 30 screenshots completed without browser/GLSL errors. TypeScript, lint, the 84-file unit suite (576 tests before the final color regression), the final focused 24-test suite, and the scoped production build passed.

Final browser acceptance: Saturn quality/shadow checks, dated Neptune storm behavior, and the five-comet offline selection/replay test all passed. The only initial failure was an obsolete profile-version matcher, corrected before rerunning.
