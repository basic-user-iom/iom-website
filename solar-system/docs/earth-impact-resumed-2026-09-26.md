# Impact Lab continuation — 2026-09-26

The interrupted attempts had not changed the default airburst plume or fixed the reported atmospheric grid. The earlier v5 terrain, ocean, depth pass, physical effect scale and True scale defaults were present and were preserved.

## Atmospheric grid
Reproduced the user's latitude/longitude grid with Impact Lab open. The opaque depth prepass contains the coarse globe's planar triangles. Ray integration continued below the analytic reference ellipsoid into those faces; clamping density to sea level produced a different optical thickness across each face.

AtmosphereScattering now caps that ray at the analytic ground intersection outside the local terrain opening. Earth shares the surface's live cutout uniform with its atmosphere, so measured relief and excavated craters still use scene depth inside the opening. Reset restores both via the shared uniform.

Controlled browser comparison: same camera, lighting, high quality and active depth prepass. The old-depth image temporarily bypasses the new analytic cap (atmosphere uniform only); the fixed-depth image uses the corrected code. The grid disappears. This is not a resolution or texture-filter workaround.

The final ground-view check also exposed an aliased scratch-vector subtraction in ImpactDepthPass: copying the camera into the planet-center vector and subtracting that same vector always produced zero. This held daytime star visibility at 50%. The corrected subtraction preserves the planet center; regression tests now cover daytime air, night, orbit and reset.

The remaining daytime speckles were separately isolated to the statistical asteroid/Kuiper belt layer, not the star shaders. Belt alpha now uses the same daylight visibility uniform without changing the user visibility toggles or orbital sample data.

## Default airburst
Reproduced default 100 m, 3000 kg/m3, 20 km/s, 35 degrees, latitude 20, longitude -30. The integrated outcome remains airburst at approximately 16.48 km. No surface crater is fabricated.

- Detached cloud head and a dissipating wake sampled backward along the actual entry trajectory.
- Light gray atmospheric dust instead of the surface plume's brown coloration.
- Exponential visual cooling (1.8 s time constant), independent of the longer dust-cloud lifetime. At about 9.8 s after the event, cooling exceeds 99%.
- Chase camera includes the wake and horizon, and pulls back for portrait aspect ratios; default selection also verified without manually switching the camera or requesting reduced motion.
- HUD identifies an airburst cloud and displays the estimated burst altitude.
- Pooling, scenario-clock pause/replay determinism and quality budgets retained.

The wake morphology, billow radii, dispersion, cooling time and cinematic composition remain authored educational visual approximations. They are not a calibrated CFD or radiative-transfer prediction. Entry physics and impact classifications were not changed.

Reference for separating a luminous bolide from its persistent aerosol wake: NASA, [Around the World in Four Days: NASA Tracks Chelyabinsk Meteor Plume](https://www.nasa.gov/solar-system/around-the-world-in-four-days-nasa-tracks-chelyabinsk-meteor-plume/). This supports the qualitative distinction, not the chosen numerical visual timing.

## Validation
- 136 tests across 14 relevant test files passed.
- TypeScript passed; isolated production build and all bundled-asset checks passed.
- Targeted ESLint and git diff whitespace checks passed.
- Default airburst browser flow, all four quality settings, mobile viewport, Earth atmosphere comparison, land/ocean events and ground observer: no browser/GLSL errors.
- Detailed browser artifacts: tmp/impact-resume-after/ and tmp/impact-resume-surface/.
- Built to ../tmp/earth-impact-resume-review-build; no production release or generated public demo was changed.

The browser uses software rendering on this environment; screenshots establish appearance and flow, not hardware frame-rate guarantees.
