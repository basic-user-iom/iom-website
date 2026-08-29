# Whole-layer owner claims composition — 2026-08-29

## Result

A generic, fail-closed claims composer now consumes any number of audited owner-local package indices and maps their owner-relative source paths to the exact atomic primitive-instance identities in the pinned whole-layer contract.

The current demonstration combines all four available shell candidates:

- `1st Floor._anim1`
- `2st Floor._anim1`
- `Mezzanine._anim1`
- `Ceiling._anim1`

All four indices pass the ownership-evidence checks and have zero cross-candidate overlap. The composed claim is still incomplete and the CLI exits with status 1 because `Ground Floor._anim1` and `__unowned__` have no owner package indices. No runtime manifest was emitted and no production route was changed.

## Exact composed coverage

| Variant | Claimed atomic units | Required atomic units | Missing | Duplicate |
|---|---:|---:|---:|---:|
| Web | 2,970 | 6,415 | 3,445 | 0 |
| Quest | 2,962 | 6,407 | 3,445 | 0 |

Missing units by owner:

| Owner | Web claimed / required | Web missing | Quest claimed / required | Quest missing |
|---|---:|---:|---:|---:|
| `1st Floor._anim1` | 1,087 / 1,087 | 0 | 1,080 / 1,080 | 0 |
| `2st Floor._anim1` | 967 / 967 | 0 | 967 / 967 | 0 |
| `Ceiling._anim1` | 593 / 593 | 0 | 593 / 593 | 0 |
| `Mezzanine._anim1` | 323 / 323 | 0 | 322 / 322 | 0 |
| `Ground Floor._anim1` | 0 / 230 | 230 | 0 / 230 | 230 |
| `__unowned__` | 0 / 3,215 | 3,215 | 0 / 3,215 | 3,215 |

The whole-layer contract digest remains:

`e237934febe6c17fb2899169a6902d380f5212b1616c651907e680df32556142`

## Candidate evidence pins

| Owner | Web paths | Quest paths | Web units | Quest units | Index SHA-256 | Audited payload-set SHA-256 |
|---|---:|---:|---:|---:|---|---|
| `1st Floor._anim1` | 708 | 704 | 1,087 | 1,080 | `f8f4a2921ea411412178e6811b5e9974467467c6f95c998b23108f00e5c7b607` | `2d02c3b40768131281831e08a09de79f4cfc558eb5bb0204cd4f44d76e5e73a9` |
| `2st Floor._anim1` | 682 | 680 | 967 | 967 | `4b895a7dba4b6f6b34dff247feca5215ce06a60e54f51f27ed44814dd794fc55` | `7ab0240690bfd1dd3f31a29aa88eee658f2b8f0979a58d4fb9db2f6a14f53911` |
| `Mezzanine._anim1` | 172 | 172 | 323 | 322 | `c49597146befe02000856ece38bf4f7fd91f69ce7edb786ddf41eb6d7a2ad86c` | `0f183c1d2e327d6810820154d96703deecaad642e421e1ae4be8d1189be74e64` |
| `Ceiling._anim1` | 357 | 357 | 593 | 593 | `b50b3e12564bdc6c8d301c3d5df6adeca1f6723225886be2a81d8a0f6e78b734` | `4b0124c1e3827fd0704cd879cbd4d646c720aedba59247066e6a92a91f8a1184` |

The composer recomputes each payload-set digest from every DCC source, streamed payload, shell payload, and rig declared by the index. This binds an audit to the current index even though the existing audit schema does not contain a direct whole-index hash.

## Exact mapping behavior

For every candidate and for both variants, the composer:

1. Requires a disabled `IOM_OWNER_LOCAL_DETAIL_PACKAGE_PILOT` v1 index and an adjacent passed `IOM_OWNER_LOCAL_DETAIL_PACKAGE_AUDIT` v1 report.
2. Verifies the candidate source hashes equal the pinned whole-layer GLBs.
3. Recomputes the audit payload-set digest from the index.
4. Verifies detail and shell source-path counts and digests.
5. Resolves each source path only under its declared nearest owner. Unknown paths are errors; there is no fallback or name-based guess.
6. Looks up that pinned source node's complete primitive-instance set and emits exact `sourceUnitIds` rather than approximate node counts.
7. Verifies each candidate covers its complete owner partition exactly once.
8. Rejects repeated owner candidates or any atomic unit claimed by multiple candidates.
9. Runs the composed claims through the whole-layer coverage validator and reports missing units by owner.

Audit blockers remain separate from ownership correctness. The four audits currently carry ten blocker entries, including manual multi-angle visual approval, detached fire-hose ownership pending integration, and texture duplication for the first and second floors. Therefore even future complete ownership would remain non-releasable until those audit blockers are cleared.

## Files

New source files:

- `scripts/lib/whole-layer-owner-claims-composer.mjs`
- `scripts/compose-whole-layer-owner-claims.mjs`
- `scripts/test-whole-layer-owner-claims-composer.mjs`

Generated evidence under `tmp/whole-layer-owner-claims-composition/`:

- `whole-layer-owner-claims-v1.json` — exact atomic claims for all four owner candidates;
- `composition-review.json` — candidate pins, audit status, overlap result, whole-layer validation, and missing counts by owner;
- `REPORT.md` — compact review.

These are evidence files only. The composer never emits an animation-package manifest and never enables routing.

## Demonstration command

```powershell
node scripts/compose-whole-layer-owner-claims.mjs `
  --out tmp/whole-layer-owner-claims-composition `
  --candidate tmp/hlod-pilot-first-floor-shell-candidate/detail-package-index.json `
  --candidate tmp/hlod-pilot-second-floor-shell-candidate/detail-package-index.json `
  --candidate tmp/hlod-pilot-mezzanine-shell-candidate/detail-package-index.json `
  --candidate tmp/hlod-pilot-ceiling-shell-candidate/detail-package-index.json
```

Expected fail-closed result:

```text
Whole-layer owner claims composition: BLOCKED
  web: 2,970 / 6,415 atomic units; missing 3,445; overlaps 0
    missing Ground Floor._anim1: 230
    missing __unowned__: 3,215
  quest: 2,962 / 6,407 atomic units; missing 3,445; overlaps 0
    missing Ground Floor._anim1: 230
    missing __unowned__: 3,215
```

## Negative tests

`node scripts/test-whole-layer-owner-claims-composer.mjs` passes and proves:

- all four current indices map to exact atomic IDs with no overlap;
- supplying the first-floor candidate twice is rejected, exposing 1,087 overlapping Web units and 1,080 overlapping Quest units;
- changing a declared payload hash makes the audit payload-set stale and rejects the index;
- changing a candidate's pinned source hash rejects the index;
- the incomplete real composition remains blocked.

## Next requirement

Produce complete, audited candidates for `Ground Floor._anim1` and `__unowned__`, then rerun this composer. A zero-missing ownership result is necessary but not sufficient: every candidate audit blocker and the other independent release gates must also pass before any disabled manifest can be considered for routing.
