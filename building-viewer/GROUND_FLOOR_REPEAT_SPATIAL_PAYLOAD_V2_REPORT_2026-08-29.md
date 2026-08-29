# Ground Floor repeat spatial payload v2 — 2026-08-29

## Outcome

The repeated chair/table family now has a deterministic, disabled spatial payload candidate that fits its **isolated-family** Web and Quest resident/transition ceilings without changing the current 1.5 m entry, 3.5 m LOD0 exit, 3.5 m Web-mid entry, or 5.5 m Web-mid exit policy.

The candidate is intentionally **not ready for activation**:

- `ready: false`
- `activationApproved: false`
- `runtimeIntegrated: false`
- production manifest/routing unchanged

This distinction matters. Web's worst exit envelope uses 1,983,007 of the 2,000,000-triangle hard resident ceiling, leaving only 16,993 triangles. The repeat family therefore passes alone but cannot yet share the complete-layer budget with the structural shell, persistent rig, animated owners, migrated fire-safety payload, and unowned static packages.

## Exact payload result

The initial deterministic nearest-neighbor plan produced 41 two-instance packages. An exact greedy witness analysis split 16 hotspot pairs, producing the final 57-package plan. Each package contains one or two logical instances and four parity-homogeneous material-slot draws.

| Variant / level | Payloads | Logical instances | Primitive-instances | Submitted triangles if all loaded | Draws if all loaded | Physical GLB bytes |
|---|---:|---:|---:|---:|---:|---:|
| Web LOD0 / near | 57 | 78 | 312 | 4,778,982 | 228 | 87,698,664 |
| Web approved conservative mid | 57 | 78 | 312 | 3,810,534 | 228 | 72,903,820 |
| Quest LOD0 / exact | 57 | 78 | 312 | 1,711,398 | 228 | 21,284,316 |
| Total emitted diagnostic set | 171 | — | — | — | — | 181,886,800 |

Quest has no mid payload. Its topology-safe simplification produced no triangle saving, so v2 continues to fail closed to exact Quest LOD0.

## Exact spatial windows

These are closed-AABB sweeps of the physically emitted payload bounds. Starts are included before evaluation and ends are retired after evaluation, so touching envelopes count as simultaneous residency. Web LOD0 and mid are mutually exclusive per package. The exit result is the independent-latch upper envelope, and the transition result adds the one same-package HLOD-to-LOD0 payload that can coexist during load-before-retire. The runtime retires out-of-window packages before loading unrelated packages.

| Variant | Window | Max triangles | Max draws | Max physical GLB bytes | Result |
|---|---|---:|---:|---:|---|
| Web | entry | 1,309,048 | 84 | 29,194,760 | pass |
| Web | exit/hysteresis upper envelope | 1,983,007 | 116 | 42,541,224 | pass, only 16,993 triangle headroom |
| Web | load-before-retire peak | 2,080,713 | 120 | 43,820,264 | pass vs. 2,500,000 peak ceiling |
| Quest | entry | 329,115 | 52 | 4,854,556 | pass |
| Quest | exit/hysteresis upper envelope | 526,584 | 84 | 7,841,084 | pass |
| Quest | load-before-retire peak | 526,584 | 84 | 7,841,084 | pass vs. 1,000,000 peak ceiling |

Encoded and decoded texture residency is exactly zero for every payload. This family is textureless; all four authored materials and their `POSITION`/`NORMAL` contracts are nevertheless pinned and re-audited per GLB.

## Correctness and interaction contract

- Exact logical source-ID bijection `0..77` and exact 312 material-slot primitive-instance records at Web LOD0, Web mid, and Quest LOD0.
- Exact source paths are preserved per package for picking, hide, isolate, and restore through `sourceIds[instanceId]`.
- Every local instance matrix has positive determinant. Mirroring remains on parity-homogeneous host nodes, preserving front-face winding without forcing `DoubleSide`.
- Owner-local matrices, materials, primitive arrays, attributes, and per-source transforms compose to the same content digests as the v1 Web/Quest payloads.
- Payloads contain no animation clips and do not duplicate `Ground Floor._anim1`; every root declares attachment to that persistent owner.
- The approved Web mid is pinned to the passed seven-view Blender review. The v2 visual handoff requires the same front/back/left/right/top/bottom/grazing review and records exact composite equivalence. No unapproved Web far or Quest mid geometry is selectable.

## Determinism and negative gates

`npm.cmd run test:repeat-spatial-v2` performs a build, physical audit, actual second rebuild, byte/hash comparison of all 171 GLBs, and a second audit. It passed.

- Reproducibility digest: `990a573016bd2ea99f9c2ea5c0f3b007184d7c0c22b8e64dfb9c36bc536b2ec0`
- Structural/payload-pin digest in both rebuilds: `2a54c0aefb812c362a104fed4e90f737d38f4fc100c10960ab9d38b5ad328883`
- Final index: 1,055,119 bytes, SHA-256 `9ba4f70c94816eaef7d869d546bd868e09e841c5e649eb2fd117d46cd990e003`

Negative tests block enabling/ready flags, production-routing mutation, duplicated ownership, missing Quest exact geometry, illegal Quest HLOD, per-payload triangle overflow, stale hashes, negative instance determinants, primitive-instance ownership drift, and resident/transition budget failures.

## Evidence

- `tmp/repeat-spatial-payload-v2/index.json`
- `tmp/repeat-spatial-payload-v2/physical-audit.json`
- `tmp/repeat-spatial-payload-v2/deterministic-rebuild-proof.json`
- `tmp/repeat-spatial-payload-v2/manifest-v3-fragment.disabled.json`
- `tmp/repeat-spatial-payload-v2/visual-qa-handoff.json`
- `tmp/repeat-spatial-payload-v2/README.md`

## Remaining blockers and smartest next step

A reservation-aware 0.25 m margin sweep evaluated 81 Web and 9 Quest policies against a 500k Web / 250k Quest triangle reservation for all other owners. Thirteen Web points pass only after materially collapsing hysteresis; none retains the current two metres, and none retains even one metre at both Web levels. Reducing only HLOD exit has one mathematical pass at 3.5 m, where HLOD entry equals exit and hysteresis becomes zero, so it is not operationally acceptable. At the current approved margins, the exit witness must lose at least 483,007 triangles. Quest’s unchanged 3.5 m exit passes. Exact evidence is in `tmp/repeat-spatial-reservation-what-if-v1/`.

1. Do not activate this family as-is in the complete manifest: Web resident triangle headroom is only 16,993 at the exit witness.
2. The 181.9 MB emitted set duplicates the same four primitive geometries across many GLBs. Before activation, replace package-local geometry duplication with an audited shared-geometry/external-buffer strategy, a runtime instance-cluster representation, or a coarser visually approved far cluster. Browser cache behavior alone does not remove the encoded duplication.
3. Compose the repeat spatial window with the structural shell, rig, five animated owners, migrated fire-safety payload, and emitted unowned-static windows. The combined gate must use actual focus-correlated package states, not the sum of unrelated individual worst cases, but it must remain below the same hard ceilings at every witness and transition.
4. Run final composite browser renders and rapid focus-churn/cancellation/recovery QA, followed by physical Web and Quest-class frame-time, request-concurrency, network, and memory acceptance.

Until all four items pass, the safe production route remains the complete monolithic model.
