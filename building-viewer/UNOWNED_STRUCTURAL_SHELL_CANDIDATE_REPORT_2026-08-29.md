# Disabled unowned structural shell candidate

**Date:** 29 August 2026  
**Scope:** Phase A offline evidence only  
**Production state:** unchanged; no manifest, route, runtime, public model, commit, or deployment was modified

## Outcome

A materially better Web/Quest structural-shell candidate now covers the broad ground, floor, facade, wall, ceiling, and stair-envelope geometry in the `__unowned__` partition that the earlier 80-triangle Ground Floor shell did not represent.

The candidate is ownership-safe and below the 150,000-triangle ceiling, but its projection coverage is not strong enough for activation. It is therefore explicitly rejected and remains `enabled=false`, `ready=false`, and `activationApproved=false`.

| Variant | Whole source paths | Shell atomic units | Detail-complement units | Expanded triangles | GLB bytes |
|---|---:|---:|---:|---:|---:|
| Web | 56 | 181 | 2,662 | 149,261 | 16,432,772 |
| Quest | 56 | 180 | 2,663 | 118,309 | 6,951,700 |

The Web/Quest atomic-unit difference is source-authored: the optimized variants have one different primitive record inside the same reviewed source-path set. Each variant still conserves exactly 2,843 static units.

## Exact ownership and safety

The shell uses an explicit, deterministic whole-source-node allowlist. Every selected item resolves to the pinned whole-layer `mesh-primitive-instance` contract.

- Static partition conservation: `2,843 = shell + detail complement` in both variants.
- Shell/detail overlap: zero.
- Omitted static units: zero in the repartition contract.
- Repeat furniture overlap: zero of the reserved 312 units.
- Migrated Fire overlap: zero of the migrated 60 units.
- Foreign owner and connector claims selected: zero.
- Source-to-shell world-transform drift: zero.
- Selected topology, primitive counts, material factors, and sidedness: unchanged.
- Automatic decimation: not used.
- Production monolith remains the only live fallback.

An extraction defect was found and corrected during audit: several selected scene-root mesh nodes were also parents of animated owner subtrees. The initial extraction retained those descendants. The final extractor detaches and disposes every descendant and asserts that every output render node has an explicit `__unowned__` source annotation. This prevents hidden foreign-owner duplication.

The exact repartition is in `tmp/hlod-pilot-unowned-structural-shell-candidate/ownership-repartition.json`. It contains all shell paths, shell primitive-instance IDs, and all detail-complement IDs with pinned digests.

The sidecar deliberately declares:

```text
compositionGuard.original122PayloadCandidateCompatible = false
```

The original 122-package plan still claims all 2,843 static units. It must not be composed with this shell. Those payloads have to be rebuilt from each variant's explicit `detailComplement.sourceUnitIds` first.

## Multi-angle visual result

Blender 5.2 rendered source-static and shell geometry with the same 960 px framing from front, back, left, right, top, bottom, and grazing views. The audit compared binary foreground masks and separately checked Web/Quest shell parity.

| Metric | Result | Strong threshold | Verdict |
|---|---:|---:|---|
| Minimum source coverage | 50.262% | 80% | Fail |
| Mean source coverage | 68.352% | 88% | Fail |
| Minimum top coverage | 50.262% | 92% | Fail |
| Minimum bottom coverage | 62.561% | 85% | Fail |
| Minimum candidate precision | 98.898% | 98% | Pass |
| Minimum Web/Quest shell IoU | 99.167% | 95% | Pass |
| Mean Web/Quest shell IoU | 99.519% | N/A | Informational |

Per-view source coverage is consistent across variants:

| View | Web | Quest |
|---|---:|---:|
| Front | 67.37% | 67.30% |
| Back | 75.02% | 74.92% |
| Left | 71.39% | 71.48% |
| Right | 70.99% | 70.92% |
| Top | 50.26% | 50.27% |
| Bottom | 62.58% | 62.56% |
| Grazing | 81.18% | 80.67% |

This is a large improvement over the rejected Ground Floor 80-triangle shell, whose minimum/mean coverage was 0.817%/2.287%. It is still insufficient: all 14 variant/view comparisons leave more than 10% of the source projection uncovered, and the top view exposes substantial omitted ground/roof silhouette. Enabling it could therefore recreate visible ground holes.

Machine status:

```text
projection-insufficient-candidate-rejected-for-activation
```

## Dependency audit

The corrected extraction explicitly disposes all unreachable resources before writing:

| Variant | Unused meshes | Unused materials | Unused textures | Reachable textures | Reachable encoded image bytes |
|---|---:|---:|---:|---:|---:|
| Web | 0 | 0 | 0 | 32 | 13,501,377 |
| Quest | 0 | 0 | 0 | 32 | 4,518,689 |

The remaining texture footprint is genuinely reachable from selected source materials. It was not downsampled or visually altered. Release still requires immutable shared textures or a reviewed structural-shell atlas; otherwise package-level duplication would waste network and GPU residency.

## Evidence and commands

Source scripts:

- `scripts/build-unowned-structural-shell-candidate.mjs`
- `scripts/audit-unowned-structural-shell-visual-qa.mjs`
- Existing deterministic renderer: `scripts/blender-render-repeat-lod-qa.py`

Primary evidence:

- `tmp/hlod-pilot-unowned-structural-shell-candidate/candidate-index.json`
- `tmp/hlod-pilot-unowned-structural-shell-candidate/ownership-repartition.json`
- `tmp/hlod-pilot-unowned-structural-shell-candidate/ownership-audit.json`
- `tmp/hlod-pilot-unowned-structural-shell-candidate/dependency-audit.json`
- `tmp/hlod-pilot-unowned-structural-shell-candidate/visual-qa/projection-audit.json`
- `tmp/hlod-pilot-unowned-structural-shell-candidate/hlod/web/unowned-structural-shell.glb`
- `tmp/hlod-pilot-unowned-structural-shell-candidate/hlod/quest/unowned-structural-shell.glb`

Rebuild and audit:

```powershell
node scripts/build-unowned-structural-shell-candidate.mjs
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python scripts\blender-render-repeat-lod-qa.py -- --input web-source=tmp\hlod-pilot-unowned-structural-shell-candidate\visual-qa\inputs\web-source-static-geometry-review.glb --input web-shell=tmp\hlod-pilot-unowned-structural-shell-candidate\visual-qa\inputs\web-shell-geometry-review.glb --input quest-source=tmp\hlod-pilot-unowned-structural-shell-candidate\visual-qa\inputs\quest-source-static-geometry-review.glb --input quest-shell=tmp\hlod-pilot-unowned-structural-shell-candidate\visual-qa\inputs\quest-shell-geometry-review.glb --output tmp\hlod-pilot-unowned-structural-shell-candidate\visual-qa --resolution 960
node scripts/audit-unowned-structural-shell-visual-qa.mjs
```

## Required next iteration

Do not add more lossless source triangles to this candidate: the Web shell is already at 99.5% of its triangle ceiling. The next iteration must be an authored closure/proxy shell in Blender, 3ds Max, Revit, or equivalent DCC:

1. Use this candidate and the source-static top/bottom difference masks as the starting point.
2. Close the missing broad ground and roof silhouettes with purpose-built low-poly surfaces; do not use blind global decimation.
3. Preserve openings that are architecturally intentional, outward normals, mirrored transforms, and opposing-side visibility.
4. Keep Fire, repeat furniture, and connector ownership outside the shell.
5. Rebuild detail payloads from the pinned complement sidecar rather than the original 2,843-unit plan.
6. Repeat all seven views and require every strong threshold to pass before manual interior/exterior approval.
7. Resolve shared texture residency, then test the composed candidate on physical desktop and Quest hardware.

Until those steps pass, this evidence is useful for authoring and exact repartition only; it is not a release candidate.
