# Scenario review ? 2026-09-26

Scope: local Impact Lab, Scientific Solar Evolution, Fictional Solar Supernova, Physics Flyby, Complete Consumption. No production release.

## Findings and implemented changes

| Area | Finding | Change |
| --- | --- | --- |
| Scientific evolution | The "present" chapter already interpolated toward a red giant, while the renderer still showed the ordinary Sun. | Hold present-day properties steady. Begin continuous expansion in the red-giant chapter; render the physical core during brightening too. |
| Solar Fate camera | Camera tracked only the core and moved inside enormous nebular shells. | Physical envelope-aware framing; logarithmic nebula-to-white-dwarf transition. Automatic, entire-envelope and star-close-up choices. Portrait framing margin. |
| Solar Fate controls | Sequential skip was the only way to explore phases. | Six direct phase buttons per mode, including backward navigation, current-step semantics and concise phase explanations. |
| Stellar rendering | Flat, nearly featureless disks and hard spherical halos. | Deterministic surface granulation, limb shading, temperature-dependent tint and center-weighted fading halos. Animation uses scenario time and respects reduced motion. |
| Ejecta and nebula | AU-scale point attenuation pinned particles at a 26 px maximum. | Scale-relative attenuation with a 7 px cap, correctly ordered smoothstep edges, structured nebular density. Existing quality budgets and deterministic particle placement retained. |
| Fictional supernova | Early shock and radiation shells dominated the later debris view. | Time-dependent fading; automatic late-phase framing follows debris and nebula. |
| All scenarios | Solar/BH entry forced presentation scale. Grids, orbit lines, labels and statistical belts cluttered event effects. | Preserve the user's scale selection and temporarily suppress reference overlays; restore on reset without rewriting user preferences. |
| Black-Hole rendering | Custom disk/ring shaders bypassed tone mapping and output color conversion when composited after lensing. | Shader output chunks and tone-mapped materials support direct and composer paths. |
| Impact regressions | Old tests assumed all events had land craters, exaggerated impactors and clamped surface flashes. | Explicit land/iron crater fixture and enhanced-mode fixture; atmospheric Jupiter flash assertions; check bounded brightness instead of requiring every weak flash to reach a clamp. Added regional camera coverage. |

## Verification

- 165 focused unit/UI/rendering/scenario tests passed (18 files).
- TypeScript and targeted ESLint passed.
- Full isolated production build passed, including asset integrity verification. Existing large-bundle warnings remain.
- 8 Solar Fate / Black-Hole acceptance tests passed, covering classification, deterministic transport, replay, reset and responsive layouts.
- Final Solar Fate harness: 13 stage captures plus three camera views, four quality levels and 320 px controls; no runtime/shader errors; True scale remained selected.
- Final Black-Hole harness: eight stage captures across both modes; no runtime/shader errors; grid restored after both resets.
- Repeated the reported Earth ocean impact (1000 m, 5000 kg/m?, 40 km/s, iron, 20 N / 30 W) at 16.3 and 62.5 seconds: water and atmosphere visible, finite camera/clipping values, correct ocean outcome, clean reset.
- Impact Moon/Jupiter and land-camera acceptance checks: both passed after updating the legacy fixtures and assertions (Moon/Jupiter 5.8 min; all five cameras and full reset 5.4 min)..

## Reproduce

```powershell
node scripts/review-solar-fate.mjs
node scripts/review-black-hole.mjs
node scripts/verify-impact-regional.mjs
npx vitest run src/tests/scenarios src/tests/rendering/SolarFateCamera.test.ts src/tests/rendering/SolarFateVisualSystems.test.ts src/tests/rendering/BlackHoleVisualSystem.test.ts src/tests/rendering/ImpactVisualSystem.test.ts src/tests/ui/SolarFatePanel.test.tsx src/tests/ui/BlackHoleEncounterPanel.test.tsx src/tests/ui/ImpactLabPanel.test.tsx
npm run build -- --outDir ../tmp/scenario-review-build
```

Visual gallery: http://127.0.0.1:5194/demos/solar-system/tmp/scenario-review/index.html

Build output: F:/iom_website/tmp/scenario-review-build. Generated public/demos/solar-system release files were not changed.

## Scientific and rendering references

The scientific narrative keeps the Sun-like-star sequence of envelope expansion, expelled outer layers and a compact white dwarf. Colors, times and gas structures are illustrative, not a stellar or hydrodynamic simulation. The impossible supernova remains explicitly fictional.

- NASA: [Life cycle of a Sun-like star](https://science.nasa.gov/resource/the-life-cycle-of-a-sun-like-star-annotated/)
- NASA: [Types of stars](https://science.nasa.gov/universe/stars/types/)
- Three.js: [Color management](https://threejs.org/manual/pages/color-management.html), including the output conversion required by custom shader materials.
- Three.js: [Post-processing](https://threejs.org/manual/pages/how-to-use-post-processing.html), including OutputPass.
