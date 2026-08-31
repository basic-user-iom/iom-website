# Phase 12 release checklist

Phase 12 is the final numbered build in the Solar System master plan. This checklist is the evidence gate for its developer-only tidal-forcing extension. Nothing is pre-approved: record results for the exact commit, browser, GPU, viewport, and build candidate being released.

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

`check:release` must complete lint, TypeScript, Vitest, ephemeris-script tests, asset verification, the production Vite build, and the complete Playwright suite. To rerun only the Phase 12 browser acceptance while diagnosing a failure:

```bash
npm run test:e2e -- e2e/phase12.acceptance.spec.ts
```

- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run test` passes, including tidal-service and visual-system tests.
- [ ] `npm run verify:assets` passes without network access.
- [ ] `npm run build` passes and emits no public source maps.
- [ ] `npm run test:e2e` passes, including Phase 12 acceptance.

Do not replace a failed complete gate with a narrower passing command and declare the release complete. Fix the first failure and rerun the complete release gate.

## Canonical URL-only flag matrix

Use a clean browser context for each row. The flag is intentionally not a durable preference.

| Query | Expected result | Verified |
| --- | --- | --- |
| No `experimentalTides` query | No tide overlay, tide legend, or developer tide control is present | [ ] |
| `?experimentalTides=both` | Lunar and solar two-bulge forcing components plus sublunar and subsolar points are shown | [ ] |
| `?experimentalTides=lunar` | Only the lunar two-bulge component is shown; required subpoint diagnostics remain available | [ ] |
| `?experimentalTides=solar` | Only the solar two-bulge component is shown; required subpoint diagnostics remain available | [ ] |
| Empty, differently cased, or unknown value | No tide overlay, tide legend, or developer tide control is present | [ ] |

- [ ] Reloading an unflagged URL after any flagged mode leaves the tidal view absent.
- [ ] No `experimentalTides` value is written to local storage, persisted Zustand preferences, scenario snapshots, or another durable store.
- [ ] The query changes visualization only; it does not change the epoch, playback direction/rate, pause state, selected body, camera mode, render scale, ephemeris vectors, or scenario parameters.

## Tidal service and geometry acceptance

- [ ] Samples use the existing Sun, Earth, and Moon ephemeris states; there is no tide-specific position fallback or fabricated orbit.
- [ ] Sublunar and subsolar points agree with the service's Earth-fixed Moon and Sun directions.
- [ ] Lunar and solar forcing components remain separately inspectable, and the combined tensor/signal is their finite elementwise/numerical sum.
- [ ] Center tidal tensors are symmetric and trace-free within documented floating-point tolerance.
- [ ] Repeated sampling reuses caller-owned vectors, tensors, and samples rather than allocating per frame.
- [ ] Changing the date across at least two separated epochs moves both subpoints consistently with the Moon/Sun geometry.
- [ ] Pausing freezes the overlay at the current epoch; resuming or scrubbing updates it without a React per-frame state loop.
- [ ] The overlay remains registered to Earth's body-local frame through floating-origin rebases, camera changes, and true/presentation scale switches.
- [ ] Starting a scenario cannot leave stale observatory tide geometry mixed with scenario-owned body state; reset restores normal unflagged/flagged observatory behavior deliberately.

## Display and lifecycle acceptance

- [ ] The overlay uses normalized, deliberately exaggerated two-bulge geometry; it does not label rendered radius or displacement as metres or tide height.
- [ ] Lunar and solar components and their subpoints can be distinguished by labels or shapes rather than color alone.
- [ ] The scientific limitation remains visible or directly available whenever the flagged visualization is active.
- [ ] Reduced-motion mode introduces no pulsing, flashing, or rapid decorative animation.
- [ ] Low/Medium/High/Ultra may change display tessellation or presentation detail but never computed forcing directions or values.
- [ ] The disabled/unflagged path performs no tide sampling and submits no tide geometry.
- [ ] Repeated flagged reloads and renderer mount/unmount cycles do not grow geometry, material, texture, program, listener, or animation-loop counts after warm-up.
- [ ] Context loss and restoration do not duplicate the tide visual system or leave a stale overlay.
- [ ] The developer disclosure and controls, if present, remain keyboard-operable and avoid horizontal overflow at 1280 px and 320 px.

## Scientific classification acknowledgement

- [ ] The UI and documentation call this an experimental equilibrium/tide-generating **forcing visualization**, not an ocean-tide prediction.
- [ ] The normalized/exaggerated display gain is disclosed and is not presented as physical surface displacement.
- [ ] The approximate constant-rate Earth rotation and provisional prime-meridian phase are disclosed; subpoint longitude is not called an authoritative IAU/IERS or geodetic result.
- [ ] The omissions are explicit: no bathymetry, harmonic constituents, Love numbers, loading, elasticity, self-gravity, hydrodynamics, coastline/basin response, solid-Earth response, local tide phase, currents, or water-height prediction.
- [ ] README, SCIENTIFIC_NOTES, and SOURCES agree on the exact `both`, `lunar`, and `solar` URL values and the transient/unflagged behavior.

## Asset, source, and license audit

- [ ] Phase 12 adds no runtime asset, downloaded data, package dependency, copied shader, or third-party code.
- [ ] The existing ephemeris and physical-catalog source records remain unchanged and authoritative for the reused inputs.
- [ ] No Phase 12 entry is required in `THIRD_PARTY_NOTICES.md`; any later introduction of third-party material invalidates this statement until provenance and license terms are added.
- [ ] Generated demo output is rebuilt only after the implementation and all documentation agree.

## Final build and release

From the repository root, after the complete gate passes:

```bash
node scripts/build-solar-system.mjs
```

- [ ] `public/demos/solar-system/index.html` exists and the built unflagged demo contains no visible tide UI.
- [ ] The built demo accepts all three canonical Phase 12 query values.
- [ ] Source and generated output correspond to the same tested candidate.

Only after the user explicitly authorizes production deployment, use the repository's scoped deployment command. Never deploy with `npx vercel --prod` or a direct `git push origin master`.

The Phase 12 build is complete only when the full automated gate passes, the flag matrix and geometry checks have recorded evidence, resource behavior is bounded, and the non-prediction limitations remain explicit.
