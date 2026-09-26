# Earth Impact black-surface repair — 2026-09-26

Reproduced the reported 1000 m, 5000 kg/m³, 40 km/s iron impact at latitude 20°, longitude −30°, entry angle 35°, azimuth 90°. The integrated outcome is an ocean-surface impact over approximately 4642 m water depth. The enhanced presentation multiplier is 1; the physical outcome and event timing were not changed.

## Findings and changes

- “Regional event · recommended” previously selected the actual two-metre ground observer. Its offset followed the 392 km visibility reference, placing it roughly 580 km along the surface, outside the 450 km detailed terrain patch. The new `regional` preset uses an elevated oblique event camera; `ground-observer` is now explicitly labelled “Ground observer (2 m)”.
- Earth ground observers remain within detailed terrain (tangent offset limited to 200 km, about 212 km along the surface). The post-impact target is bounded so the horizon remains in frame. The observer still stands two metres above the rendered terrain.
- The Blue Marble texture contains nearly black deep ocean. The previous absolute blue-brightness mask gave that ocean little water reflection, and the globe shader had no sky-reflection contribution. Added a shared, bounded clear-sky Fresnel approximation and relative blue-dominance fallback; the displaced ocean blends into the same shading at its boundary.
- Close-ground world-position subtraction quantized the eye direction and produced a block pattern. Surface shading now interpolates camera-space positions and rotates the normalized eye direction back into world space. Displaced terrain supplies its displaced camera-space position to the same shader.
- The observatory reference grid is hidden during impact playback and restored on reset. It also no longer writes depth. The final regional captures have no vertical overlay streak.
- The initial experiment enabling atmospheric lookup tables for every quality did not fix the fault and was reverted. Existing quality budgets and True scale defaults remain in place.

The ocean sky colors and camera framing are educational visual approximations, not a calibrated ocean BRDF or a hydrodynamic forecast. The black surface was not caused by night: the reproduced impact point's solar cosine was approximately 0.70.

## Verification

- 63 tests passed: body visuals, impact visuals/cameras, Impact Lab UI and scenario lifecycle.
- Browser reproduction with the exact supplied settings at approximately 16.3 s and 62.5 s.
- Settled ground-camera ocean visible at Low, Medium, High and Ultra. Pixel checks over an unobstructed ocean patch confirm nonblack water and smooth adjacent pixels (mean blue-channel difference below 0.005/255).
- GPU shader checks at grazing, oblique and nadir angles: daytime reflection present, no added daylight on the night side or with fully occluded sunlight.
- Recommended regional camera checked at both times; reference grid suppression and reset restoration asserted in the browser. No browser or GLSL errors.
- Targeted ESLint, TypeScript, asset validation and isolated production build.
- Browser uses software rendering in this environment; this is appearance/flow verification, not a hardware performance benchmark.

Reproduction scripts:
- `node scripts/verify-impact-black-quality.mjs`
- `node scripts/verify-earth-ocean-shader.mjs` (reads the preceding captures, then performs GPU checks)
- `node scripts/verify-impact-regional.mjs`

Review gallery: `tmp/earth-impact-fix-review/index.html`.
Isolated build: `../tmp/earth-impact-black-review-build`.
No production deployment or generated public demo update was requested.
