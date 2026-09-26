# Voyager inspection review — 2026-09-27

Voyager 1 and Voyager 2 previously used only octahedral position markers. Both now use NASA's textured Voyager Probe (B) model by Michael D. Carbajal, published April 18, 2025. The probes share the same spacecraft design and one lazy download; their JPL Horizons positions remain independent.

Sources:
- https://science.nasa.gov/3d-resources/voyager-probe-b/
- https://www.jpl.nasa.gov/images/pia14111-model-of-voyager-artist-concept/
- https://github.com/nasa/NASA-3D-Resources

The packaged GLB retains all 20,390 source triangles and embedded texture/fallback images. It is converted from Draco to the existing meshopt decoder, with quantization, and occupies 1,880,052 bytes. Source/output checksums and credit are recorded in `public/assets/space-objects/voyager/source.json`. `space-objects:voyager-model:generate` regenerates it; `space-objects:voyager-model:verify` is part of the normal build gate.

The authored origin is retained near the spacecraft core rather than recentering on the long magnetometer boom. Inspection uses physical meter units. The dish points toward Earth as an illustrative attitude, not measured SPICE attitude telemetry. A neutral inspection light keeps the model readable at outer-solar-system distances; this display choice is stated beside the controls.

Wheel/pinch, drag orbit, and explicit Zoom in/Zoom out buttons work around the spacecraft. Navigation can approach the dish rather than being limited by the full boom bounding sphere. The camera follows trajectory translation and floating-origin rebases while preserving zoom and pan.

Two existing camera issues were corrected: spacecraft framing did not synchronize the application's free-orbit state, allowing the first wheel event to restore a planetary target; and a moon-specific framing clamp also applied to spacecraft. The clamp is now restricted to natural-moon inspection. Other artificial-object locators are suppressed during detailed inspection.

Verification:
- TypeScript and targeted ESLint checks passed.
- 25 focused unit tests passed, including Earthward attitude, camera transforms, navigation scales, and the existing object panel.
- Both Voyager browser cases passed: shared lazy download, physical scale, detailed geometry, persistent close/distant wheel zoom, buttons, orbit, moving-clock tracking, return to Earth, and failed-download locator fallback.
- Production build and every asset verifier passed.
- Moon framing acceptance passed after updating its stale resource count: seven procedural moons each already have a color and normal map (fourteen textures).
- ISS framing acceptance passed. Its setup now explicitly selects presentation scale before testing the transition to physical scale, checks the camera target against low Earth orbit in meters, and selects the visible selection label rather than the hidden overview label.

Browser commands:

```powershell
$env:SOLAR_SYSTEM_E2E_PORT='5194'
node scripts/run-e2e.mjs e2e/voyager-inspection.acceptance.spec.ts
node scripts/run-e2e.mjs e2e/phase13.acceptance.spec.ts --grep 'guards stale OMM|frames a major moon' --timeout 120000
```
