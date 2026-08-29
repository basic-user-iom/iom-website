# Disabled unowned static payload emission handoff

Status: **v1/v2 emitter and independent auditor implemented; Web/Quest smoke audits PASS; full proxy-v2 emission waits for the final conserved structural-shell plan**.

Production assets, manifests, routes, and runtime code were not changed. All generated files are disabled evidence below `building-viewer/tmp`.

## Implemented

- `scripts/build-unowned-static-payload-candidate.mjs` emits deterministic, self-contained Web and Quest GLBs from an explicitly supplied partition plan.
- Partition schema versions 1 and 2 are accepted. All other versions fail before output is removed or written.
- Package counts and Web/Quest detail-unit totals are dynamic. Completeness is derived from the exact pinned plan; no 122-package or 2,843-unit release assumption remains.
- For v2, every evidence file is reopened and hash/byte checked. The inherited v1 correspondence and semantic mapping, shell/detail/repeat/fire conservation, static-package digest, per-variant complement digests, and shell output pins must all agree.
- Atomic identity is `mesh-primitive-instance`. Spatially split source batches retain exact subsets of every `EXT_mesh_gpu_instancing` accessor.
- Positive and mirrored instances are emitted as separate draw groups, preserving front-face behavior.
- Source node world matrices, instance transforms, primitive attributes and indices, materials, material extensions, texture bytes, samplers, UV transforms, extras, bounds, triangles, draws, and file hashes are pinned.
- Every package exposes actual GLB bytes and actual encoded/decoded texture-memory estimates. KTX2 decoded values are conservative RGBA8 mip-chain upper bounds.
- `scripts/audit-unowned-static-payload-candidate.mjs` independently reopens the production GLBs and every emitted payload. It reconstructs expected source identity rather than trusting emitter metadata.
- Complete candidates also produce `source-static-reference-{web,quest}.glb`, `emitted-static-composite-{web,quest}.glb`, and `visual-qa-handoff.json` for matched-camera review.
- The output remains `enabled: false`, `activationApproved: false`, and fail-closed until visual, runtime, resident-window, and physical-hardware gates pass.

## Validated smoke result

Evidence: `tmp/unowned-static-payload-smoke/`.

The deterministic package `unowned-fm1-cxm7-cz0-p1` was emitted and audited in both variants:

| Variant | Atomic units | Triangles | Draws | GLB bytes | Byte gate |
|---|---:|---:|---:|---:|---|
| Web | 1 | 172 | 1 | 248,032 | PASS |
| Quest | 1 | 168 | 1 | 210,524 | PASS |

Independent audit: **PASS — 171 assertions, 0 failures**.

After the v1/v2 compatibility work, the same v1 smoke was rebuilt and independently re-audited: **PASS — 2,149 assertions, 0 failures**.

The current v2 plan was also exercised without a full emission:

| Variant | Packages emitted | Atomic units | Triangles | Draws | GLB bytes | Byte gate |
|---|---:|---:|---:|---:|---:|---|
| Web | 1 of 117 | 3 | 682 | 3 | 1,509,388 | PASS |
| Quest | 1 of 117 | 3 | 674 | 3 | 1,415,180 | PASS |

Independent v2 smoke audit: **PASS — 2,241 assertions, 0 failures**.

`npm run test:unowned-static-payload-contract` additionally passes a regenerated v2 smoke audit and proves both the emitter and auditor block:

- unsupported partition versions;
- stale v2 evidence pins;
- altered inherited semantic correspondence;
- a changed package count that no longer conserves exact ownership.

## Why the original full run is intentionally deferred

Partition plan v1 assigns all 2,843 remaining-static units to detail payloads. The separate structural-shell work selected part of that same domain. Emitting both unchanged would overlap ownership, duplicate surfaces, and risk z-fighting.

The emitter therefore has no ad-hoc exclusion switch. The safe input is a revised partition plan supplied with `--plan`: it must move the shell's exact primitive-instance IDs out of detail ownership, prove Web/Quest conservation and multiplicity one, and update all plan/correspondence digests. The full run and deterministic rebuild audit should then be performed from that pinned plan.

## Commands

Default v1 commands (baseline evidence only):

```text
npm run model:build-unowned-static-payloads
npm run model:audit-unowned-static-payloads
```

Final proxy-v2 release-candidate commands, after this exact plan exists:

```text
node scripts/build-unowned-static-payload-candidate.mjs --plan tmp/unowned-static-partition-plan-proxy-v2/unowned-static-partition-plan-v2.json --out tmp/unowned-static-payload-candidate-proxy-v2 --force
node scripts/build-unowned-static-payload-candidate.mjs --plan tmp/unowned-static-partition-plan-proxy-v2/unowned-static-partition-plan-v2.json --out tmp/unowned-static-payload-candidate-proxy-v2-rebuild --force
node scripts/audit-unowned-static-payload-candidate.mjs --index tmp/unowned-static-payload-candidate-proxy-v2/payload-index.json --compare-index tmp/unowned-static-payload-candidate-proxy-v2-rebuild/payload-index.json
```

Neither command changes production routing.
