# Phase 11 release checklist

This checklist is the evidence gate for a Solar System release. It intentionally contains no pre-checked performance or leak claims: the release owner records the browser, GPU, viewport, commit, command output, and observations for the exact candidate being shipped.

## Candidate record

- [ ] Commit: `________________`
- [ ] Date/time and timezone: `________________`
- [ ] Operating system: `________________`
- [ ] Browser and version: `________________`
- [ ] GPU/driver or software renderer: `________________`
- [ ] Viewport and device-pixel ratio: `________________`
- [ ] Evidence location: `________________`

## Automated release gate

From `solar-system/`:

```bash
npm ci
npx playwright install chromium
npm run check:release
```

`check:release` must complete lint, TypeScript, Vitest, ephemeris-script tests, all release asset verifiers, the production Vite build, and the Playwright suite.

- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run test` passes.
- [ ] `npm run test:ephemeris-scripts` passes.
- [ ] `npm run verify:assets` passes without network access.
- [ ] `npm run build` passes and emits no public source maps.
- [ ] `npm run test:e2e` passes in bundled Chromium.
- [ ] Optional Chrome-channel run passes with `SOLAR_SYSTEM_E2E_CHANNEL=chrome npm run test:e2e`.

Do not replace a failed command with a narrower command and declare the release complete. Record and fix the first failing gate, then rerun the complete release gate.

## Quality-tier and adaptive-resolution evidence

Profile the same repeatable heavy scene at the same viewport and device-pixel ratio. Capture the performance diagnostic before the effect, during sustained load, and after reset. Controller targets are pressure thresholds, not promised benchmark results.

| Tier | Target threshold | Minimum heavy-effect scale | Full-tier baseline captured | Sustained heavy effect captured | Reset returns to full scale |
| --- | ---: | ---: | --- | --- | --- |
| Low | 30 FPS | 0.75 | [ ] | [ ] | [ ] |
| Medium | 40 FPS | 0.70 | [ ] | [ ] | [ ] |
| High | 50 FPS | 0.60 | [ ] | [ ] | [ ] |
| Ultra | 55 FPS | 0.50 | [ ] | [ ] | [ ] |

For each tier, record:

- [ ] Active effect/state and test duration.
- [ ] Target/smoothed FPS and median/p95/p99 frame intervals.
- [ ] Current/minimum scale and adjustment count.
- [ ] Requested/effective device-pixel ratio.
- [ ] Draw calls, triangles, points, geometries, textures, and programs.
- [ ] The scale never goes below the tier floor.
- [ ] Sustained pressure—not one isolated frame—precedes a downward adjustment.
- [ ] Recovery is slower than degradation and does not visibly oscillate.
- [ ] Leaving the heavy scenario immediately restores the tier's full resolution scale.
- [ ] Ephemeris values, physical summaries, scenario signatures, and deterministic replay remain unchanged by resolution adjustment.

Meaningful tier differences must also be visible in the configured work: atmosphere path, anisotropy, bloom, corona shells, comet/belt budgets, Saturn spokes, sky tier, and black-hole lensing. Do not infer a universal ranking from one FPS sample; browser scheduling, refresh rate, power state, thermals, drivers, viewport, and scene content all matter.

## Repeated-reset and resource acceptance

Warm each scenario once so intentional lazy textures, materials, shader programs, and worker code have loaded. Then perform at least ten start/reset cycles per scenario while recording diagnostics after every reset:

- [ ] Impact Lab: ten start/reset cycles restore the same observatory state.
- [ ] Scientific Solar Evolution: ten start/reset cycles restore the same observatory state.
- [ ] Fictional Solar Supernova: ten start/reset cycles restore the same observatory state and exposure.
- [ ] Black-Hole Physics Flyby: ten start/reset cycles terminate scenario workers and clear lensing/overlays.
- [ ] Complete Consumption - Cinematic: ten start/reset cycles terminate scenario workers and clear lensing/overlays.
- [ ] Double reset is harmless for every scenario.
- [ ] No scenario can overlap another scenario's authority.
- [ ] No stale camera override, presentation scale, paused clock, body visibility, exposure ceiling, warning, or preference-suspension state remains after reset.
- [ ] After warm-up, geometry, texture, and program counts stabilize instead of growing monotonically across reset cycles.
- [ ] Worker count returns to the expected baseline after every black-hole reset/replay.
- [ ] Event-listener and animation-frame counts return to baseline after canvas unmount/remount.
- [ ] A final renderer teardown explicitly releases controls, scene resources, post-processing targets, workers, observers/listeners, animation authority, and the WebGL context.

`renderer.info` counters are useful regression evidence but do not cover all JavaScript, browser, driver, or GPU allocations. Heap and process-memory samples may be recorded as supporting evidence only; garbage collection and driver caching mean that a single nonzero delta is not automatically a leak. The acceptance failure is sustained, reproducible growth or retained authority after warm-up/reset.

## Browser capability and recovery matrix

- [ ] WebGL2 available: the interactive renderer reaches Ready.
- [ ] WebGL2 unavailable/context creation rejected: the accessible static fallback is shown and non-3D information remains usable.
- [ ] `EXT_color_buffer_float` unavailable: direct rendering remains usable without composer/bloom; the canvas is not blank.
- [ ] Module-worker construction rejected for black-hole physics: the deterministic direct-kernel fallback is reported and remains functional.
- [ ] Ephemeris worker failure: the application shows an actionable error and never silently substitutes circular, fixed, or fabricated states.
- [ ] Optional comet bundle unavailable: planetary/lunar observatory operation continues with the degradation disclosed.
- [ ] Body or sky texture load rejected: the documented procedural/static fallback is used and diagnostics disclose it.
- [ ] `webglcontextlost`: default browser handling is prevented, the loss is announced, and hidden scenario/time progress is suspended.
- [ ] `webglcontextrestored`: rendering is resized/reinitialized, prior run/pause authority is restored deliberately, and diagnostics return to Ready.
- [ ] Failed or timed-out context restoration reaches an actionable fallback rather than waiting forever.
- [ ] Repeated loss/restore cycles do not duplicate listeners, animation loops, render targets, or scenario authority.
- [ ] Page visibility changes stop/restart animation authority without creating a second loop.

## Scientific and interaction regression

- [ ] All six camera modes work: overview, free orbit, body follow, Earth–Moon system, top-down ecliptic, and velocity chase.
- [ ] Pointer drag/wheel hands an automated camera to free orbit unless an active scenario owns the camera.
- [ ] Earth–Moon mode shows both bodies using their unmodified linear ephemeris positions.
- [ ] Default presentation scale uses the shared `40×` Earth/Moon factor, preserving their physical radius ratio and preventing exaggerated-sphere intersection.
- [ ] Presentation-scale warning remains visible whenever exaggerated radii contribute.
- [ ] True scale preserves physical radius-to-distance ratios.
- [ ] Physics Flyby still permits survivors/ejections and reports energy-drift diagnostics.
- [ ] Complete Consumption remains persistently labelled nonphysical and captures every body by authored design.
- [ ] Solar Evolution and Fictional Solar Supernova remain visibly and textually separate.
- [ ] Impact Lab remains labelled an educational approximation.
- [ ] Reduced Motion and Reduce Flashes alter presentation only, not physical state or deterministic outcomes.
- [ ] Layout and dialogs remain usable without horizontal overflow at 1280 px and 320 px.

## Asset, source, and notice audit

- [ ] Planetary/lunar ephemeris release identity, length, hash, structure, and withheld-reference validation pass.
- [ ] Small-body identity, routing, boundary, hashes, and withheld-reference validation pass.
- [ ] Phase 4/5 source manifest matches all 14 runtime texture paths and transformations.
- [ ] Phase 6 sky manifest, WebP derivatives, and BSC5P artifacts pass verification.
- [ ] Phase 10 black-hole lookup tables match the pinned commit, dimensions, byte lengths, finite payload, and hashes.
- [ ] README, SCIENTIFIC_NOTES, SOURCES, and THIRD_PARTY_NOTICES agree on classifications, formats, and limitations.
- [ ] No new third-party asset or dependency lacks provenance and a compatible notice.
- [ ] No document claims KTX2/Basis support; this release ships documented PNG/JPEG/WebP imagery instead.

## Build and scoped production release

From the repository root, build the standalone source into its committed demo output:

```bash
node scripts/build-solar-system.mjs
```

- [ ] `public/demos/solar-system/index.html` exists.
- [ ] Required ephemeris, sky, texture, and black-hole assets are present under the built demo.
- [ ] The built demo loads from `/demos/solar-system/` with no source-map publication.
- [ ] Only the intended `solar-system/` source and `public/demos/solar-system/` output are staged for this release.
- [ ] Source and generated output are committed together.

Only after the user explicitly authorizes production deployment, run from the repository root:

```bash
npm run deploy -- --scope project:solar-system
```

- [ ] The repository deploy guard reports a clean, synchronized release candidate.
- [ ] The scoped deployment succeeds.
- [ ] The production URL is smoke-tested after deployment.

Never deploy this project with `npx vercel --prod` or a direct `git push origin master`.

## Final limitations acknowledgement

- [ ] The release notes retain the explicit limitations in [SCIENTIFIC_NOTES.md](./SCIENTIFIC_NOTES.md).
- [ ] Adaptive-resolution targets are not described as measured or guaranteed FPS.
- [ ] Renderer counters are not described as complete GPU-memory telemetry.
- [ ] No KTX2/Basis compression is claimed.
- [ ] WebGL2 remains the production baseline; WebGPU is not implemented.
- [ ] Ephemeris authority is limited to the bundled 2000–2100 interval and recorded source solutions.
- [ ] UTC-to-TDB conversion remains approximate and is not leap-second/IERS grade.
- [ ] Presentation radii, textures, shaders, lighting, atmosphere, comet tails, belts, rings, impact effects, Solar Fate, and black-hole visuals retain their documented scientific/educational/cinematic classifications.
- [ ] No research-grade relativity, climate, tide prediction, collision physics, stellar evolution, hydrodynamics, or radiometric rendering is claimed.

The release is complete only when the automated gate passes, the applicable manual checks have evidence, critical failures are fixed rather than waived, and the final limitations remain visible.
