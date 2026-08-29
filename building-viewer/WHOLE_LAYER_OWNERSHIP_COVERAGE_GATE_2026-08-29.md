# Whole-layer visual ownership coverage gate — 2026-08-29

## Result

A versioned, fail-closed ownership inventory and coverage gate now exists for the complete `icm-anim-2025` rendered layer. It is read-only evidence: no production GLB, manifest, source route, or runtime flag was changed.

The current first-floor shell/detail candidate **does not satisfy this gate**. It owns the full first-floor partition, but it omits every other animation owner and the required `__unowned__`/static partition. Whole-layer activation therefore remains blocked.

## Pinned production sources

| Variant | Bytes | SHA-256 |
|---|---:|---|
| Web | 97,549,356 | `b96cf36f64a03d16047e3ff26aa93131481f636c184df80b5c7ea2032e4cb5e8` |
| Quest | 52,092,404 | `430987ed81842b5a6a3544c401707c82f2edfdc02d16111e70bf6e5245658083` |

The v1 whole-layer coverage digest is:

`e237934febe6c17fb2899169a6902d380f5212b1616c651907e680df32556142`

Variant digests:

| Variant | Coverage digest | Animation-target digest |
|---|---|---|
| Web | `a5561c3e6f2fff994c3cf0330292e13fd302c1c44776c0b3e0265cb29e334fa5` | `4450973faf99a31cfa0f31456cf4537b53427655b3f0b73f39e00be17f4a836e` |
| Quest | `171ce7468710b0b269004a349237c7330cd6e812b05d3a8b8d71a2784e26677f` | `4450973faf99a31cfa0f31456cf4537b53427655b3f0b73f39e00be17f4a836e` |

The animation target list is identical in Web and Quest and pinned to:

- `1st Floor._anim1`
- `2st Floor._anim1`
- `Ceiling._anim1`
- `Mezzanine._anim1`

`Ground Floor._anim1` is retained as an explicit static owner. Geometry without one of the five nearest owner ancestors is retained as the explicit required `__unowned__` partition; it is not ignored.

## Exact inventory

The atomic coverage unit is one mesh primitive at one logical instance. This is deliberately stricter than mesh-node counting: a candidate cannot silently lose a material primitive or one member of an instanced batch.

| Variant | Nearest owner | Animated | Render nodes | Logical instances | Primitive-instance units | Expanded triangles | Renderer draws |
|---|---|---|---:|---:|---:|---:|---:|
| Web | `1st Floor._anim1` | yes | 708 | 708 | 1,087 | 2,489,874 | 1,087 |
| Web | `2st Floor._anim1` | yes | 682 | 682 | 967 | 1,439,367 | 967 |
| Web | `Ceiling._anim1` | yes | 357 | 357 | 593 | 850,124 | 593 |
| Web | `Mezzanine._anim1` | yes | 172 | 172 | 323 | 1,074,011 | 323 |
| Web | `Ground Floor._anim1` | no | 143 | 143 | 230 | 313,536 | 230 |
| Web | `__unowned__` | no | 398 | 3,060 | 3,215 | 7,418,703 | 553 |
| **Web total** |  |  | **2,460** | **5,122** | **6,415** | **13,585,615** | **3,753** |
| Quest | `1st Floor._anim1` | yes | 704 | 704 | 1,080 | 1,239,891 | 1,080 |
| Quest | `2st Floor._anim1` | yes | 680 | 680 | 967 | 639,766 | 967 |
| Quest | `Ceiling._anim1` | yes | 357 | 357 | 593 | 598,157 | 593 |
| Quest | `Mezzanine._anim1` | yes | 172 | 172 | 322 | 502,120 | 322 |
| Quest | `Ground Floor._anim1` | no | 143 | 143 | 230 | 156,086 | 230 |
| Quest | `__unowned__` | no | 398 | 3,060 | 3,215 | 2,971,754 | 553 |
| **Quest total** |  |  | **2,454** | **5,116** | **6,407** | **6,107,774** | **3,745** |

Identity digests:

| Variant | Render-node IDs | Logical-instance IDs | Atomic-unit IDs | Owner assignments |
|---|---|---|---|---|
| Web | `267e3f0bc51bd0c22a1ed7ca54259cb66edc390d9451a1c48c450ba0a659d635` | `bcef229ef01354ac38780a2f4c47623fea282e4f520266ead9ae57204fb74a3c` | `5b57bf0d30a5c1a573c9c0d14566e383356a4be10f8aa941ffc8b34cbf644cfb` | `0702df4e3103a20cf761b34d796def73b08536611d98f4c190e03bfa26e2b357` |
| Quest | `853b5638199fa124352206a0b99f194297b15eb54acae0c0e4fb06017c40e938` | `c95c4a98487cc41c8788be4edd890e51d28d40e6fda763d55aa2c6bfcd52b856` | `0a1fb3b676cd686dbaaaaa461c79f4387f463435e62a8d4a4f37b0ddbe6dddec` | `778298f049b34adf6203e43adb9613e759ba8824108a3ba34261204560a57148` |

## Identity and coverage rules

Each render-node identity uses the pinned active-scene hierarchy and its nearest owner-relative child path. Each logical-instance identity appends its exact instance ordinal. Each atomic unit appends both its primitive ordinal and instance ordinal. These ordinals are stable for the pinned source bytes; changing or reordering the source changes its SHA-256 and fails the source check.

A future package candidate supplies an `IOM_WHOLE_LAYER_VISUAL_OWNERSHIP_CLAIMS` v1 document. For each Web and Quest package it declares:

- one and only one owner;
- the pinned source and animation-target digests;
- either whole `sourceNodeIds` or deliberately split `sourceUnitIds`.

The release check expands node claims to their primitive-instance units. It passes only when the multiset of claimed units is exactly equal to the source inventory: no omissions, no duplicates, no unknown identities, and no wrong-owner assignments. The verifier requires both a contract and claims file and exits non-zero when either is absent or invalid.

## First-floor candidate result

The existing first-floor shell plus detail packages resolve cleanly against their owner-relative source paths and have no duplicate claims. Nevertheless:

| Variant | Claimed units | Required units | Missing units | Whole-layer coverage |
|---|---:|---:|---:|---:|
| Web | 1,087 | 6,415 | 5,328 | 16.94% |
| Quest | 1,080 | 6,407 | 5,327 | 16.86% |

The missing units are the complete `2st Floor._anim1`, `Ceiling._anim1`, `Mezzanine._anim1`, `Ground Floor._anim1`, and `__unowned__` partitions. The first-floor candidate must remain disabled; it cannot replace the monolithic layer.

## Files and generated evidence

New source files:

- `scripts/lib/whole-layer-ownership-contract.mjs` — inventory, contract digests, claims adapter, structural validator, source verifier, and exact coverage validator.
- `scripts/generate-whole-layer-ownership-coverage.mjs` — writes a complete, enumerated v1 contract and candidate review without touching production.
- `scripts/verify-whole-layer-ownership-coverage.mjs` — mandatory fail-closed release verifier for a contract plus claims.
- `scripts/test-whole-layer-ownership-coverage.mjs` — exact positive and negative tests.

Generated review evidence is under `tmp/whole-layer-ownership-v1/`:

- `whole-layer-ownership-contract-v1.json` — all stable render-node, logical-instance, and primitive-instance identities;
- `candidate-ownership-claims-v1.json` — adapted first-floor claims;
- `candidate-coverage-review.json` — exact gap/duplication result;
- `summary.json` and `REPORT.md` — compact metrics and guidance.

The generated directory is review evidence only and is not a production route.

## Test evidence

`node scripts/test-whole-layer-ownership-coverage.mjs` passes and proves:

1. Current pinned Web and Quest sources reproduce the exact contract.
2. A synthetic exact whole-layer claim set is accepted.
3. One omitted source node is rejected.
4. One duplicated source node is rejected at primitive-instance multiplicity.
5. A source node claimed under the wrong owner is rejected.
6. Stale candidate and stale source hashes are rejected.
7. A forged but internally consistent shortened inventory is rejected by rebuilding the inventory from the pinned GLBs.
8. A changed animation target is rejected.
9. The current first-floor-only candidate is rejected with 5,328 Web and 5,327 Quest units missing.

The explicit release verifier was also run against the first-floor candidate and exited with status 1:

```text
Whole-layer ownership release gate: BLOCKED
  coverage: web: missing 5328 render units
  coverage: quest: missing 5327 render units
```

## Next prerequisite

Build and audit packages for the other four named owners and the full `__unowned__` partition, then produce claims against this exact digest. Only after the coverage verifier passes should the disabled manifest emitter be allowed to consume the evidence. Visual parity, runtime budget, collision, texture ownership, focus recovery, and physical-device checks remain separate gates; whole-layer ownership success alone must never enable routing.
