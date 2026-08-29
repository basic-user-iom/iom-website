# Unowned structural proxy v2 — final disabled candidate report

Date: 2026-08-29  
Scope: `__unowned__` static geometry only  
Verdict: **REJECTED for activation; fail closed**

## Outcome

The second isolated structural-proxy iteration is complete. It materially improves the rejected v1 silhouette while meeting the hard geometry, ownership, dependency, normals, opposing-side, and Web/Quest parity constraints. It does **not** meet the unchanged seven-view coverage thresholds, and its texture-free materials are not acceptable for close-range display.

Nothing in production was modified. The candidate is not runtime-integrated, no production route points to it, and every activation/readiness flag remains `false`.

Final candidate facts:

- 108 exact whole source paths; path digest `267067f00180dcfb3649ebf4f84a4ac27d5c404687957700ad8b69c915e1effe`.
- 149,948 expanded triangles per variant, 52 triangles below the 150,000 ceiling.
- 1,017 meshes and 130 double-sided materials per final GLB.
- 0 textures, 0 images, 0 animations, 0 unreferenced nodes/meshes/materials/textures.
- 15 exact degenerate triangles found after GLB serialization and removed by the finalizer; final independent audit reports zero.
- Web and Quest final proxy GLBs are byte-identical: 6,842,184 bytes, SHA-256 `a0eef5d560b1da5b5ab39de33537e4fd245ba41494d35f927628cc4558b32a0f`.
- Render report is pinned at 5,872 bytes, SHA-256 `a457bc2577c9ffd1dc48955ff332628ee83a737be941a54ef18af916b50d0e49`.

## Method

The final candidate starts from the rejected v1 whole-path selection and adds exact broad ground/roof receiver paths. It uses a Quest-derived, texture-free DCC input and a bounded 1-degree limited-dissolve pass only on an explicit allowlist of high-cost near-planar paths. Material, seam, and sharp boundaries are delimiters. There is no global or ratio-based decimation.

The selection was fitted to the triangle ceiling by empirical seven-view marginal coverage, not triangle count alone. Material inspection promoted actual architectural receivers such as corrugated roof path 34, wood floor path 157, and wall/screen path 178. Repeat-owned and migrated fire-hose units were excluded before extraction.

All final primitives have finite positions and normals, triangle topology, recalculated normals, opaque double-sided materials, and deterministic `iomProxySourcePath` extras. Every claimed path has non-zero final geometry.

## Seven-view projection result

Foreground masks use a fixed luma threshold of 60 at 960×960. Coverage is intersection divided by source pixels; precision is intersection divided by proxy pixels.

| Variant | View | Source coverage | Proxy precision | IoU |
|---|---:|---:|---:|---:|
| Web | Front | 77.934% | 99.684% | 77.742% |
| Web | Back | 77.162% | 99.964% | 77.140% |
| Web | Left | 79.791% | 99.703% | 79.602% |
| Web | Right | 80.079% | 99.633% | 79.843% |
| Web | Top | 77.693% | 99.403% | 77.332% |
| Web | Bottom | 77.972% | 99.996% | 77.970% |
| Web | Grazing | 81.881% | 99.817% | 81.758% |
| Quest | Front | 77.970% | 99.684% | 77.778% |
| Quest | Back | 77.327% | 99.964% | 77.305% |
| Quest | Left | 79.909% | 99.703% | 79.719% |
| Quest | Right | 80.375% | 99.633% | 80.138% |
| Quest | Top | 77.702% | 99.407% | 77.343% |
| Quest | Bottom | 77.990% | 100.000% | 77.990% |
| Quest | Grazing | 82.137% | 99.817% | 82.014% |

| Gate | Required | Actual | Result |
|---|---:|---:|---:|
| Minimum source coverage | 80.000% | 77.162% | FAIL |
| Mean source coverage | 88.000% | 78.994% | FAIL |
| Top source coverage | 92.000% | 77.693% | FAIL |
| Bottom source coverage | 85.000% | 77.972% | FAIL |
| Minimum proxy precision | 98.000% | 99.403% | PASS |
| Minimum Web/Quest proxy IoU | 95.000% | 100.000% | PASS |

All 14 source/variant views retain more than 10% reference-only pixels. The proxy therefore remains rejected even though precision and cross-variant parity are strong.

Compared with rejected v1, minimum coverage improves from 50.262% to 77.162%, mean coverage from 68.352% to 78.994%, and top coverage from 50.262% to 77.693%. The remaining gap is still too large to activate safely.

## Ownership and composition

The sidecar defines a hypothetical future repartition only; it does not alter current production payloads.

For both variants:

- Proxy: 1,144 exact atomic units across 108 whole source paths.
- Detail complement: 1,699 atomic units.
- Conserved static total: 2,843 atomic units.
- Proxy/detail overlap: 0.
- Omitted static units: 0.
- Duplicate proxy claims: 0.
- Repeat-owned overlap: 0.
- Migrated fire-hose overlap: 0.

The original 122-payload composition and the earlier frozen detail-plan v2 are explicitly incompatible with this repartition. A separate shell-aware rebuild has now been emitted and audited downstream; the rejected far proxy itself remains unchanged and disabled.

## Material-fidelity follow-up completed downstream

The final proxy is intentionally texture-free. Its 130 materials retain only neutral factor-based display properties, with zero source PBR textures/images. If the 1,144 proxy-owned units were simply removed from close-range detail, their original V-Ray/PBR appearance would be permanently replaced by the neutral proxy.

Two approaches were available:

1. Preferred: build mutually exclusive near-LOD0 packages containing the original textured proxy-owned units, with explicit and tested near/far replacement semantics.
2. Alternative: preserve suitable source PBR bindings in a far proxy while proving memory and FPS budgets.

The preferred approach is now complete in `tmp/unowned-static-partition-plan-proxy-v2/` and `tmp/unowned-static-payload-candidate-proxy-v2/`: 88 material-preserving near packages exactly cover all 1,144 proxy units, retain source geometry/PBR bindings, and declare mutually exclusive load-before-retire replacement. Together with 98 detail packages they physically conserve all 2,843 static units per variant. The combined final gate accepts this downstream material contract.

The immutable proxy-candidate snapshot still truthfully records `materialFidelityReady=false`, `nearLod0Required=true`, `nearLod0PackagePresent=false`, and `explicitReplacementSemanticsValidated=false` because that artifact predates and does not contain the near tier. Those snapshot fields are no longer the combined-candidate blocker. The far proxy's failed seven-view projection thresholds remain the blocker, and a silhouette pass alone still cannot authorize activation.

## Rejected experiments retained as negative evidence

- A 3-degree, 119-path pass simplified additional retained structures to fit broad new paths. It collapsed valid slabs and regressed to 36.883% minimum / 53.048% mean coverage. It is rejected and is not a final artifact.
- Restoring paths 63 and 190 at 1 degree while removing broad dispersed contributors reduced top coverage from about 77.69% to 72.91% and mean coverage from about 78.99% to 76.84%. Their large AABBs overestimated marginal filled-mask value in this composition.
- The selected 1-degree pass is safer than using a larger dissolve angle. No threshold was relaxed to accept it.

## Evidence and reproducibility

- [Candidate index](tmp/hlod-pilot-unowned-structural-proxy-v2/candidate-index.json)
- [Exact ownership repartition](tmp/hlod-pilot-unowned-structural-proxy-v2/ownership-repartition-v2.json)
- [Ownership audit](tmp/hlod-pilot-unowned-structural-proxy-v2/ownership-audit-v2.json)
- [Dependency audit](tmp/hlod-pilot-unowned-structural-proxy-v2/dependency-audit-v2.json)
- [Topology audit](tmp/hlod-pilot-unowned-structural-proxy-v2/topology-audit-v2.json)
- [Projection audit](tmp/hlod-pilot-unowned-structural-proxy-v2/visual-qa/projection-audit.json)
- [Pinned Blender render report](tmp/hlod-pilot-unowned-structural-proxy-v2/visual-qa/render-report.json)
- [Final Web proxy](tmp/hlod-pilot-unowned-structural-proxy-v2/hlod/web/unowned-structural-proxy-v2.glb)
- [Final Quest proxy](tmp/hlod-pilot-unowned-structural-proxy-v2/hlod/quest/unowned-structural-proxy-v2.glb)

Rebuild and validation commands:

```powershell
node scripts\prepare-unowned-structural-proxy-v2.mjs
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python scripts\blender-build-unowned-structural-proxy-v2.py -- --input tmp\hlod-pilot-unowned-structural-proxy-v2\source\quest-feature-preserving-proxy-input.glb --output tmp\hlod-pilot-unowned-structural-proxy-v2\dcc\unowned-structural-proxy-v2.glb --report tmp\hlod-pilot-unowned-structural-proxy-v2\dcc\blender-proxy-report.json --angle-degrees 1.0
node scripts\build-unowned-structural-proxy-v2-candidate.mjs
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python scripts\blender-render-repeat-lod-qa.py -- --input web-source=tmp\hlod-pilot-unowned-structural-proxy-v2\source\web-source-static-geometry-review.glb --input web-shell=tmp\hlod-pilot-unowned-structural-proxy-v2\hlod\web\unowned-structural-proxy-v2.glb --input quest-source=tmp\hlod-pilot-unowned-structural-proxy-v2\source\quest-source-static-geometry-review.glb --input quest-shell=tmp\hlod-pilot-unowned-structural-proxy-v2\hlod\quest\unowned-structural-proxy-v2.glb --output tmp\hlod-pilot-unowned-structural-proxy-v2\visual-qa --resolution 960
node scripts\audit-unowned-structural-proxy-v2-visual-qa.mjs
node scripts\test-unowned-structural-proxy-v2.mjs
```

## Recommended next phase

Do not continue blind dissolve/decimation trials. The next logical phase is a source-semantic DCC pass that authors dedicated coarse ground and roof receivers from validated architectural boundaries, while keeping exact original textured units in near-LOD0 packages. Then rebuild the disjoint payload composition, validate physical resident-window evidence, rerun these unchanged seven-view thresholds, and obtain manual architectural approval before any runtime integration.
