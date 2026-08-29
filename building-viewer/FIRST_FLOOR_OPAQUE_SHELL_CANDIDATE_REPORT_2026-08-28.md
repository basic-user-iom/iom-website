# First-floor opaque-shell and ownership-repartition candidate

## Outcome

A reproducible, lossless opaque-shell candidate now exists under `tmp/hlod-pilot-first-floor-shell-candidate/`. It remains deliberately disabled. The candidate is technically valid and ownership-complete, but it is not marked ready because the remaining source-versus-shell projection difference still requires architectural visual review.

No production GLB or production model manifest was changed.

## What was built

- The shell is an exact subset of structural source nodes. It is not proxy-box geometry and it is not blindly decimated.
- Selection admits only opaque, non-transmissive sources with structural wall, slab, ceiling, façade, roof, column, beam, stair, parapet, or corridor semantics.
- Furniture, lights, ventilation, sprinklers, doors, windows/glass, raster panels, Fire, and both Verbindung connectors are excluded from shell ownership.
- Every selected source path is removed from the detail packages before either variant is exported.
- `Fire`, `Verbindung West002.001`, and `Verbindung West.002` remain exact and persistent in `first-floor-critical`.
- POSITION, NORMAL, referenced UVs, materials, PBR factors, IOM extras, authored double-sided flags, owner-local transforms, and exact indexed bounds are retained.
- Web and Quest packages retain the animation/rig contract; shell and detail payloads contain no duplicated animation owner or animation clips.

## Measured package result

| Metric | Web | Quest |
|---|---:|---:|
| Complete source paths | 708 | 704 |
| Shell paths | 141 | 140 |
| Repartitioned detail paths | 567 | 564 |
| Shell triangles | 112,809 | 84,594 |
| Shell draws | 176 | 175 |
| Detail triangles | 2,377,065 | 1,155,297 |
| Detail draws | 911 | 905 |
| Conserved shell + detail triangles | 2,489,874 | 1,239,891 |
| Conserved shell + detail draws | 1,087 | 1,080 |
| Shell file bytes | 7,278,624 | 2,884,492 |
| Shell conservative GPU texture bytes | 202,651,872 | 61,082,300 |

Both shells are below the 150,000-triangle ceiling. Detail and shell path sets have zero overlap. Their sorted union exactly recreates the original full-owner path count and original ownership digest for each variant.

## Independent audit

`shell-package-audit.json` passes 4,382 assertions with zero failures. It independently verifies:

- source, cleaned-source, rig, animation duration, and transform provenance;
- exact shell and detail file hashes and metrics;
- exact selected source-node resolution in each production source GLB;
- shell source-to-output triangle, draw, exact indexed-bound, PBR, and sidedness equality;
- opaque/non-transmissive shell materials and required attributes;
- absence of Fire/connectors and animation from the shell;
- global detail-path uniqueness;
- shell/detail disjointness;
- complete source-path and expanded-triangle conservation;
- complete ownership SHA-256 digests;
- persistent triangle budgets.

The package audit remains activation-blocked for visual approval, detached Ground Floor fire-hose ownership, and unresolved self-contained texture duplication.

## Same-camera source-versus-shell evidence

Texture-free review GLBs were generated because Blender 5.2 cannot import the source KTX2 extension directly. The review copies change only texture bindings and neutral review shading; geometry, transforms, hierarchy, indices, and authored double-sided flags remain unchanged.

The exact review sources contain 708 Web paths / 2,489,874 triangles and 704 Quest paths / 1,239,891 triangles. Blender 5.2 rendered source and shell at identical 960 px cameras from front, back, left, right, top, bottom, and grazing angles.

| Projection result | Value |
|---|---:|
| Minimum shell coverage of source foreground | 89.40% |
| Mean shell coverage of source foreground | 92.61% |
| Minimum shell-pixel precision against source | 99.993% |
| Minimum Web/Quest shell projection IoU | 99.610% |
| Mean Web/Quest shell projection IoU | 99.778% |

This proves that the shell is aligned to the source and that Web/Quest shell silhouettes are effectively equivalent. It does not prove that every 5.8–10.6% omitted source pixel is furniture or transparent/nonstructural detail. For that reason `shellCompletion.ready` and `activationApproved` remain `false`.

## Reproduction and evidence paths

- Build: `npm run model:build-first-floor-shell-candidate -- --force`
- Machine audit: `npm run model:audit-first-floor-shell-candidate`
- Prepare source/shell review GLBs: `npm run model:prepare-first-floor-shell-visual-qa`
- Render the four prepared GLBs with `scripts/blender-render-repeat-lod-qa.py` at 960 px.
- Projection audit: `npm run model:audit-first-floor-shell-visual-qa`
- Candidate index: `tmp/hlod-pilot-first-floor-shell-candidate/detail-package-index.json`
- Package audit: `tmp/hlod-pilot-first-floor-shell-candidate/shell-package-audit.json`
- Render inventory: `tmp/hlod-pilot-first-floor-shell-candidate/visual-qa/render-report.json`
- Projection audit: `tmp/hlod-pilot-first-floor-shell-candidate/visual-qa/projection-audit.json`

## Release decision

This is the closest safe automated candidate, not a production release. The next acceptance step is a human/DCC review of the source-only pixels in all seven paired views, with focused checks on façades, stairs, connectors, opposing wall faces, and floor/ceiling continuity. If any omitted region is structural, add its exact source path to the shell selection, remove it from detail ownership, rebuild both variants, and repeat both audits. Do not enable the candidate by changing metadata alone.
