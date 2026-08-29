# Ground Floor repeat-geometry release candidate — 2026-08-29

## Outcome

A reproducible, disabled release candidate now covers the 78 repeated Ground Floor chair/table instances in the current Web and Quest models. Production assets, manifests, and routing were not changed.

The final payloads contain no animation clips and no `Ground Floor._anim1` node. They are safe to attach beneath a future persistent rig owner without duplicating hierarchy or animation ownership.

## Measured result

| Variant / level | Unique triangles | Submitted triangles | Safe renderer draws | Payload bytes | Selectable |
| --- | ---: | ---: | ---: | ---: | --- |
| Web LOD0 | 61,269 | 4,778,982 | 52 | 1,584,120 | yes |
| Web conservative mid | 48,853 | 3,810,534 | 52 | 1,324,716 | yes, after integration QA |
| Quest LOD0 | 21,941 | 1,711,398 | 52 | 419,144 | yes |
| Quest conservative mid probe | 21,941 | 1,711,398 | 52 | 419,140 | no — topology gate fell back to exact |

Compared with the current runtime safety/spatial projection for this family:

- Web and Quest fall from 176 to 52 safe draws: 124 fewer draws, or 70.45%.
- Web mid saves 968,448 submitted triangles, or 20.26%, relative to Web LOD0.
- Quest receives the draw reduction only. A duplicate zero-saving LOD is excluded.

## Safety and identity gates

- Thirteen deterministic parity/spatial groups, each with four material-slot batches.
- Every material slot contains the exact source-ID bijection `0..77`.
- `InspectPicker` resolves real imported `sourceIds` and passes per-instance pick, hide, isolate, and restore for Web and Quest LOD0.
- All per-instance matrices have positive determinant. Mirroring exists only on parity-homogeneous host nodes, preserving front-face winding.
- The persistent rig is the sole animation source; the Ground Floor payload world transform stays unchanged at both animation endpoints.
- Materials, `POSITION`/`NORMAL` semantics, retained source vertex tuples, authored boundaries, connected components, and topology-regression limits pass after GLB round-trip.
- All payloads are self-contained, hash-pinned, and below the 2 MiB per-payload gate. The full diagnostic set is 3,747,120 bytes, below its 6 MiB gate.

The prior isolated Web conservative-mid geometry passed seven Blender opposing-angle views. The final combined parity/spatial payload render remains explicitly pending. No far payload is included in this bounded candidate.

## Reproduction and evidence

Run:

```powershell
npm.cmd run test:repeat-release-candidate
```

This command rebuilds from the current production pins, runs the instancing runtime prerequisites, and loads the selectable payloads through the production `ModelLoader` in Playwright Chromium.

Evidence:

- `tmp/repeat-geometry-release-candidate/report.json`
- `tmp/repeat-geometry-release-candidate/manifest.disabled.json`
- `tmp/repeat-geometry-release-candidate/browser-runtime-qa.json`
- `tmp/repeat-geometry-release-candidate/README.md`
- `tmp/repeat-lod-ground-floor/visual-qa/visual-approval.json`

Focused validation also passes:

```powershell
node scripts/test-ground-floor-repeat-instancing-runtime.mjs
npm.cmd run test:instancing-runtime-prereqs
node scripts/qa-ground-floor-repeat-release-candidate.mjs
```

## Remaining activation blockers

1. This is one isolated repeated family, not a complete replacement for the animated monolith. Its 78 source paths must be composed exactly once into a complete, validated manifest-v3 ownership set.
2. After a selector is integrated, test load-before-retire swaps and rapid LOD threshold reversals in the full browser scene.
3. Run frame-time, culling, and memory acceptance on physical Web and Quest-class hardware.
4. Capture final combined-payload Blender views before enabling Web mid. Prior isolated-mid evidence is supportive but does not replace final-payload evidence.

Until those gates pass, `enabled` and `runtimeIntegrated` remain `false`.
