# Building Viewer — Completion and Next Phases

**Project:** `F:\iom_website\building-viewer`  
**Review date:** 29 August 2026  
**Release status:** Local implementation and verification only. No Git commit or production deployment was requested or performed.

## 1. Current result

The viewer-side defects reported in the supplied exterior and interior images are repaired in the current local Web and Quest routes:

- Ground, walkway, connector, wall, façade, roof, and Fire cabinet surfaces are protected from unsafe visibility, winding, LOD, batching, and material-deduplication behavior.
- Open or mixed-winding architectural sheets use selective two-sided rendering; closed geometry retains back-face culling. This avoids missing faces without globally doubling raster and shadow cost.
- Mirrored instances cannot share an unsafe packed draw. Imported negative-determinant instances are separated, and runtime packing is revalidated against the final host transform.
- The Fire cabinet keeps its six semantic material roles. Opaque body/front components are not converted to glass, and the actual pane retains the controlled transparent path.
- Ground and connector content is never hidden by inferred duplicate rules. Only explicit authored ownership can suppress a duplicate.
- Walk-mode stair ascent/descent uses the validated animated collision route. Direction, ambiguous-volume, landing, multi-hit ground-probe, and mirrored stair cases are permanent regression tests.
- Oversized paving and landscape UVs are corrected to a 1.5 m physical repeat where their semantic/material evidence is exact. Correctly scaled surfaces remain unchanged.
- The visible water checker is removed and replaced with a stable real-time water material.
- The final unclassified 110 m/repeat C5/C6 slab was proven to contain a 2×2 pure black/white debug image, not a legitimate architectural texture. The exact hash-pinned primitive now uses its existing neutral `fb_c5_c6` floor finish. The unused material and KTX2 texture are removed from both exterior tiers.
- Daylight exposure, sun, ambient, hemisphere, and image-based lighting are calibrated as one balanced system. Adaptive quality, runtime antialias fallback, loading cancellation, WebGL recovery, XR lifecycle, stream failover, and shared-texture ownership are hardened.

The production manifest remains deliberately monolithic. No incomplete HLOD/cell candidate is routed to users, so the optimization work cannot reintroduce holes, missing furniture, broken animation, or missing collision.

## 2. Active asset state

| Asset | Current result | Notes |
|---|---:|---|
| Exterior Web | 1,195,062 expanded triangles; 130 draws; 27 KTX2 textures; 93 materials | Debug checker removed; geometry unchanged; one draw, one material, and one texture removed |
| Exterior Quest | 799,575 expanded triangles; 130 draws; 27 KTX2 textures; 93 materials | Under the 800k Quest full-asset triangle ceiling |
| Animated Web | 13,585,615 expanded triangles; 3,753 draws | Complete and visually safe, but still above the final streaming/performance asset gate |
| Animated Quest | 6,107,774 expanded triangles; 3,745 draws | Complete fallback route; still above the final Quest gate |
| Animated collision | 120,838 live triangles; 304 chunks | 255/282 broad walk cells, six probes, four qualifying elevation bands, 12/12 contract stairs |

The active animated Web route now points to `model-web.glb`; it no longer incorrectly reuses the lower-quality Quest file.

## 3. Verification completed

The following acceptance evidence is current:

- `npm run build`: pass, including model validation, both collision-coverage audits, character stairs, stair geometry, visual correctness, surface visibility, lighting calibration, runtime stability, GPU-timer/performance-monitor behavior, instancing prerequisites, HLOD contract/runtime failover, verified GLB boundaries, collision activation, shared-texture ownership, TypeScript, and Vite production compilation.
- `npm run model:validate`: pass with zero warnings.
- Exterior collision: zero sparse walk cells and 2/2 tested stair groups at 100% support.
- Animated collision: all 13 required stair owners at 100%; the activation contract validates 12/12 named stair assemblies.
- Whole-layer source ownership: Web 6,415/6,415 and Quest 6,407/6,407 primitive-instance units, each claimed exactly once with no omission, duplication, or unauthorized owner move.
- Local browser surface QA: opposing-angle exterior/interior cameras, Fire/connector/material assertions, packed-transform checks, animation playback, and WebGL error checks pass. The final set also includes the corrected C5/C6 slab.
- Built-preview performance smoke: exterior 57.5 FPS at 219 calls / 767,206 submitted triangles; animated 27.6 FPS at 1,016 calls / 4,358,894 submitted triangles. This was Chromium SwiftShader and is diagnostic evidence only, not a physical GPU or Quest acceptance result; its software-rendered FPS must not be compared with a physical GPU target.

The strict `npm run model:gate` remains intentionally red only for the four animated-monolith limits:

- Web triangles: 13,585,615 > 2,000,000.
- Web draws: 3,753 > 1,000.
- Quest triangles: 6,107,774 > 800,000.
- Quest draws: 3,745 > 1,000.

Those thresholds were not weakened and the complete fallback GLBs were not blindly decimated.

## 4. Optimization phase completed safely

The animation-aware optimization groundwork is substantially further than a conceptual plan:

- A manifest-v3 runtime supports a persistent animation rig, owner-local packages, verified hashes/bytes, exact bounds, Web/Quest variants, transition-peak budgets, load-before-retire swaps, cancellation, and atomic fallback.
- First floor, second floor, mezzanine, ceiling, and corrected Ground Floor package candidates have real lossless Web/Quest GLBs and machine audits. They remain disabled.
- The Ground Floor fire-hose correction maps 149 nodes / 290 primitive-instance units, including six batches / 60 migrated fire instances, with zero node or atomic world-transform drift.
- The chair/table repeat candidate reduces safe projected draws from 176 to 52. Its Web mid LOD reduces submitted repeated geometry from 4,778,982 to 3,810,534 triangles; the Quest mid LOD correctly fails closed to exact geometry.
- The unowned/static partition is deterministic: 3,215 units = 312 repeat + 60 migrated fire + 2,843 remaining static, with no overlap.
- The final logical ownership composition is exact: Web 6,415/6,415 and Quest 6,407/6,407, multiplicity one.
- Shared-texture candidate QA proves actual GPU texture reuse inside the candidate runtime. Production package network duplication is still unresolved.

The Ground Floor’s automatically selected 80-triangle shell was correctly rejected by visual QA. It has 100% precision/alignment but only 0.817% minimum and 2.287% mean source coverage. Enabling it would create the same type of missing-surface defect the current work fixes.

### Phase A continuation — measured physical evidence

The next offline iteration is complete and remains deliberately fail-closed:

- Structural proxy v2 selects 108 exact whole source paths and conserves the static domain as **1,144 proxy + 1,699 detail = 2,843 units** per variant, with zero overlap, omission, duplication, repeat overlap, or migrated-Fire overlap.
- The Web and Quest proxy GLBs are identical, 6,842,184 bytes and 149,948 expanded triangles, with no textures, images, animations, or unreachable dependencies. This makes them useful far-proxy evidence, but not a material-preserving near replacement.
- Seven-view DCC projection is **77.162% minimum / 78.994% mean**, with 99.403% minimum precision, 77.693% top coverage, 77.972% bottom coverage, and perfect Web/Quest parity. The unchanged 80% minimum, 88% mean, 92% top, and 85% bottom thresholds correctly reject it.
- Material-preserving near LOD0 is now physically complete. The plan contains **98 detail packages + 88 structural-near packages = 186 packages per variant**. It preserves all 2,843 static units and the original PBR bindings, with explicit mutually exclusive proxy/near ownership and load-before-retire semantics.
- The complete Web set contains 2,571,081 triangles, 1,059 draws, and 93,886,196 GLB bytes. Quest contains 1,228,616 triangles, 1,059 draws, and 51,831,944 GLB bytes. Lossless Meshopt transport keeps vertex arrays byte-identical and preserves the complete winding-oriented triangle multiset. Every unchanged per-payload byte gate passes.
- A second complete 372-GLB rebuild is byte/hash deterministic. The independent audit passes **232,881 assertions with zero failures**, including source identity, exact physical ownership, vertex data, triangle winding/topology, transforms, materials, texture bytes, shared-texture metadata, bounds, draws, and package limits.
- Every emitted image now carries an exact embedded-image SHA-256 annotation consumed by the fail-closed shared-texture registry. Real-browser QA loads two independent packages, proves compatible GPU texture reuse, and proves the registry returns to zero entries/references after release.
- Exact static resident-window sweeps now pass every unchanged isolated ceiling. At the 3.5 m exit margin, Web peaks at 1,090,896 triangles / 212 draws and 358,980,064 pooled conservative GPU-texture bytes. Quest peaks at 485,715 triangles / 213 draws and 153,281,080 pooled bytes, below the 201,326,592-byte ceiling. Pooling removes 206,990,320 Web bytes and 64,445,980 Quest bytes from the respective worst unpooled windows; embedded GLB/network bytes remain additive.
- Repeat spatial v2 emits 57 packages and 171 diagnostic GLBs with exact 78 logical / 312 primitive-instance ownership. Its isolated Web exit is 1,983,007 triangles, leaving only 16,993 triangles for every other owner. A 90-policy reservation analysis found no Web solution preserving two metres, or even one metre, of hysteresis while reserving 500k triangles. At unchanged proven margins, the current witness needs at least **483,007 fewer submitted triangles**. Quest’s current margin passes its 250k reservation.
- The final combined disabled gate now verifies **6,415/6,415 Web** and **6,407/6,407 Quest** physical units, zero missing/duplicate claims, 328 verified payloads per variant, and a valid combined persistent rig. Its only machine-evidence error is the rejected far structural proxy projection audit. Activation still has explicit whole-layer budget, browser-composition, network-duplication, runtime-manifest, and physical-hardware blockers.
- The final local browser sweep passes 14 exterior/interior camera views, all semantic surface checks, packed-transform checks, animation checks, and WebGL error checks with no page or console errors.

Two offline-emission defects found during this continuation were repaired and regression-covered: copied geometry plus instancing data is now consolidated to the single buffer required by GLB, and the `--plan` CLI option now reaches the builder’s `planPath` rather than silently falling back to v1.

## 5. What is not finished and why

The viewer is locally corrected and buildable, but the final “V-Ray quality plus 60 FPS / Quest 72 Hz everywhere” target still has asset-production and hardware phases. They should proceed in this order:

### Phase A — Remaining authored HLOD and whole-layer budget work

1. Replace or re-author proxy v2’s broad ground/roof silhouette without adding to the already nearly full 149,948/150,000 triangle budget. The same seven views must reach every unchanged coverage threshold.
2. Author a lower-cost, seven-view-approved Web chair/table HLOD or floor-aware cluster that removes at least 483,007 triangles at the current exit witness without reducing proven hysteresis. Shared geometry must also remove the 181.9 MB diagnostic-set duplication.
3. Run one focus-correlated resident and transition-peak gate across proxy/near, all 186 static packages, repeat, migrated Fire geometry, five animated owners, and the persistent rig. Then repeat browser parity, picking/hide/isolate, focus churn, cancellation, recovery, collision, and stairs.

### Phase B — Release texture residency and streaming

1. Extend the now-proven image-hash metadata and shared GPU registry contract from the unowned candidate to every animated-owner/repeat package in the complete manifest.
2. Externalize immutable SHA-named KTX2 textures or author reviewed room/floor atlases so packages do not ship duplicate network bytes; GPU pooling alone does not reduce embedded downloads.
3. Measure decoded GPU residency and load-before-retire transition peaks on physical desktop and Quest-class hardware.
4. Author a disabled full manifest-v3 release candidate, then enable it only after every shell and payload gate passes.

### Phase C — V-Ray/Cycles-quality baked lighting

1. Create non-overlapping UV1 for static opaque receivers, partitioned per room/floor with sufficient mip padding.
2. Bake diffuse indirect GI and selected static shadowing in V-Ray or Cycles; do not bake specular reflections into diffuse lightmaps.
3. Export high-value atlases as linear KTX2 UASTC with mipmaps.
4. Match HDR rotation, real sun direction, exposure, white balance, and bake scenario.
5. Add local reflection probes for foyer, interior, and glazing zones. Keep only bounded near-camera dynamic sun/contact shadows.

### Phase D — Physical hardware acceptance

1. Desktop: frame p95 ≤ 16.67 ms at the agreed output resolution.
2. Mobile: stable selected 30/45 FPS tier with no memory or context loss.
3. Quest: CPU and GPU p95 ≤ 13.89 ms, 72 Hz minimum, plus a 10–15 minute thermal soak.
4. Record cold/warm load, peak memory, animation playback, context recovery, Walk stair traversal, and every saved surface view.

### Phase E — Presentation effects last

After the streaming and hardware gates pass, add high-tier SSR/contact refinement or WebGPU-only enhancements if their measured cost fits. Literal Unreal Lumen, Nanite, and Virtual Shadow Maps do not execute inside this Three.js browser viewer. Their practical browser equivalents are baked/probe GI, authored LOD/HLOD and streaming, Meshopt/instancing, and bounded dynamic plus baked shadows. If literal Unreal rendering is mandatory, use Unreal Pixel Streaming as a separate product mode.

## 6. Evidence and reproduction

Primary reports:

- `IMPLEMENTATION_AND_REMAINING_WORK_REPORT_2026-08-28.md`
- `WHOLE_LAYER_OWNERSHIP_COVERAGE_GATE_2026-08-29.md`
- `WHOLE_LAYER_OWNER_CLAIMS_COMPOSITION_2026-08-29.md`
- `WHOLE_LAYER_LOGICAL_OWNERSHIP_PLAN_2026-08-29.md`
- `GROUND_FLOOR_REPEAT_GEOMETRY_RELEASE_CANDIDATE_REPORT_2026-08-29.md`
- `GROUND_FLOOR_REPEAT_SPATIAL_PAYLOAD_V2_REPORT_2026-08-29.md`
- `UNOWNED_STRUCTURAL_PROXY_V2_REPORT_2026-08-29.md`
- `PHASE_A_COMPLETE_DISABLED_CANDIDATE_GATE_2026-08-29.md`
- `DISABLED_MANIFEST_V3_RELEASE_GATE.md`

Current local evidence directories:

- `tmp/qa-surface-visibility-release-2026-08-29-final-v2/`
- `tmp/whole-layer-ownership-v1/`
- `tmp/whole-layer-logical-ownership-plan-v1/`
- `tmp/hlod-pilot-ground-floor-shell-candidate/`
- `tmp/repeat-geometry-release-candidate/`
- `tmp/unowned-static-partition-plan-v1/`
- `tmp/hlod-pilot-unowned-structural-proxy-v2/`
- `tmp/unowned-static-partition-plan-proxy-v2/`
- `tmp/unowned-static-payload-candidate-proxy-v2/`
- `tmp/unowned-static-resident-window-proxy-v2/`
- `tmp/repeat-spatial-payload-v2/`
- `tmp/repeat-spatial-reservation-what-if-v1/`
- `tmp/phase-a-complete-disabled-candidate-proxy-v2/`
- `tmp/qa-surface-visibility-release-2026-08-29-final-v3/`

No production deploy or Git commit was performed.
