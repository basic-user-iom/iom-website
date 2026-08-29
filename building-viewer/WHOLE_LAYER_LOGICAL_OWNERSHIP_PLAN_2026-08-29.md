# Whole-layer logical ownership plan — 2026-08-29

## Outcome

The plan-level composition is **ownership-complete and activation-blocked**.

- Web coverage: **6,415 / 6,415** atomic source units exactly once.
- Quest coverage: **6,407 / 6,407** atomic source units exactly once.
- Missing units: **0**.
- Duplicate units: **0**.
- Unauthorized logical ownership changes: **0**.
- Runtime manifest emitted: **no**.
- Production routing changed: **no**.

This result combines the five audited owner candidates, the exact Ground Floor migration v2 sidecar, and the unowned/static plan v1. It proves ownership accounting only; it does not prove that all planned payloads exist or that the viewer is ready to activate streaming.

## Exact accounting

| Logical owner | Web atomic units | Quest atomic units | Evidence state |
|---|---:|---:|---|
| `1st Floor._anim1` | 1,087 | 1,080 | audited payload candidate; shell approval pending |
| `2st Floor._anim1` | 967 | 967 | audited payload candidate; shell approval pending |
| `Ceiling._anim1` | 593 | 593 | audited payload candidate; shell approval pending |
| `Mezzanine._anim1` | 323 | 322 | audited payload candidate; shell approval pending |
| `Ground Floor._anim1` | 290 | 290 | audited corrected payload candidate: 230 original Ground + 60 authorized fire |
| `__unowned__` | 3,155 | 3,155 | plan-only: 312 repeat + 2,843 remaining static |
| **Total** | **6,415** | **6,407** | exact multiplicity one |

Source-partition equation:

- Web: `2,970 four owners + 230 original Ground + 60 migrated fire + 312 repeat + 2,843 static = 6,415`.
- Quest: `2,962 four owners + 230 original Ground + 60 migrated fire + 312 repeat + 2,843 static = 6,407`.

The original `__unowned__` partition remains exactly accounted as:

`3,215 = 312 repeat + 60 fire migration + 2,843 remaining static`.

After the authorized logical migration, `__unowned__` claims only `312 + 2,843 = 3,155`. None of the 60 fire IDs remains in repeat or static claims.

## Migration authority and unchanged base gate

The base whole-layer contract remains unchanged at digest:

`e237934febe6c17fb2899169a6902d380f5212b1616c651907e680df32556142`

It still records the 60 detached fire-hose units under their original `__unowned__` source identity. Its existing wrong-owner validator still rejects those IDs if they are submitted directly as Ground claims.

The separate migration sidecar is the sole authorization for the plan-level logical reassignment:

- schema/version: `IOM_GROUND_FLOOR_SOURCE_OWNERSHIP_MIGRATION` v2;
- bytes: 917,766;
- SHA-256: `91310321f6e106ea89180ab3de753e8cff8710a6156b2ab57808a512ad013027`;
- exact scope: 230 existing Ground units plus 60 migrated fire units equals 290 corrected Ground units;
- migrated mesh batches: 6;
- missing/extra/duplicate mappings: 0;
- maximum recorded world-transform delta: 0.

The plan composer translates every corrected Ground package path through the sidecar's explicit atomic mapping. It never guesses by node name, material, or approximate bounds. If the sidecar is absent, stale, or does not enumerate the exact original source IDs, the corrected Ground candidate is excluded and the plan fails closed.

## Evidence pins

- Logical plan digest: `571758709c482eff7aaab93a6073ae1b8025026d01b29d5d9aa01daffd871219`.
- Unowned/static plan file SHA-256: `af0fb2e1f4ea23e65ccb263b79d475aba0c573b8cc2cd4cc61d946665ccb3b14`.
- Unowned/static internal plan digest: `e5237306713bf4c73008fe94e23b983dfe3a75a8ec40693933d5d4a165b6b0df`.
- Corrected Ground index SHA-256: `0cfb74adf00288d4a4f36e621c808fffd3f90c00622b05a9171190130fe4aa62`.
- Corrected Ground audit SHA-256: `cb93fb4ea1cc187352f4139f083aa133658a0faabe1bc31801e0b8e7f0eabb86`.
- Corrected Ground audited payload-set SHA-256: `ef6ffa1102824bacedb0408e8b51a312dd22fca7e00402e87b261e32b5609378`.

The four non-Ground candidate pins and their exact atomic coverage remain recorded in `WHOLE_LAYER_OWNER_CLAIMS_COMPOSITION_2026-08-29.md` and in the nested composition review.

## Why activation remains blocked

Ownership completeness is only one prerequisite. The resulting plan deliberately declares `enabled: false`, `runtimeManifestEmitted: false`, and `productionRoutingChanged: false`.

Remaining release blockers:

- The 312 repeat units and 2,843 remaining-static units are only planned; their complete self-contained streaming GLBs and emitted-byte gates do not exist.
- The Ground and other owner shell candidates still require manual multi-angle browser/DCC visual approval.
- Shared texture/network duplication is not release-complete for every owner package set.
- Complete-layer resident-window, request concurrency, transition, and eviction behavior is not proven.
- Physical Web GPU and Quest-class hardware FPS/memory testing remains required.
- No runtime manifest has been emitted or enabled; production continues to use the monolithic source.

## New files

- `scripts/lib/whole-layer-plan-composer.mjs`
- `scripts/compose-whole-layer-ownership-plan.mjs`
- `scripts/test-whole-layer-ownership-plan-composer.mjs`
- this report

Generated evidence is under `tmp/whole-layer-logical-ownership-plan-v1/`:

- `whole-layer-logical-ownership-plan-v1.json` — all plan-level source claims and logical owners;
- `plan-composition-review.json` — multiplicity, authorization, input pins, payload status, and blockers;
- `REPORT.md` — concise generated summary.

No runtime manifest or production asset is written by this composer.

## Test evidence

Run:

```powershell
node scripts/test-whole-layer-ownership-plan-composer.mjs
```

The focused test passes and proves:

1. Web `6,415/6,415` and Quest `6,407/6,407` source units are claimed with multiplicity one.
2. Ground receives exactly 230 original units and 60 sidecar-authorized fire units.
3. The unowned plan claims exactly 312 repeat and 2,843 static units and excludes all fire units.
4. The unchanged base gate still rejects direct fire-to-Ground claims.
5. A missing migration sidecar is rejected and leaves 290 units unclaimed.
6. A stale migration sidecar is rejected and leaves 290 units unclaimed.
7. Adding a migrated fire ID to a static package is rejected as a fire/static overlap and duplicate claim.
8. Even the valid complete ownership plan remains release-blocked.

## Next phase

Emit and audit the planned unowned payloads, clear visual/texture/runtime blockers for every owner, and run complete-layer physical-device performance testing. Only after those independent gates pass should a disabled runtime manifest be considered. This plan does not authorize activation.
