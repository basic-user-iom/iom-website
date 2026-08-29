# First-floor coalesced streaming pilot

Status: **validated offline, disabled, not production-ready**.

## Result

The recommended balanced partition is the material-aware 96-draw profile in `tmp/hlod-pilot-first-floor-coalesced/`.

- 25 packages instead of 53: one `persistent-lossless` critical LOD0 plus 24 streamed, shell-covered LOD0 packages.
- One Web/Quest always-resident shell is required. Per-detail HLOD is not required. A separate streamed regional HLOD is optional only after profiling.
- 24 m base grid; connected clusters are limited to 2 x 2 cells; actual-AABB LOD0 margin is 12 m.
- Hard package gates: 235,000 triangles and 96 draws.
- The merge cost favors shared texture/image dependencies and material signatures, then compact spatial coverage.

The rebuilt audit passed 4,637 assertions. Exact conservation:

| Gate | Web | Quest |
|---|---:|---:|
| Source paths expected/packaged | 708 / 708 | 704 / 704 |
| Expanded triangles | 2,489,874 | 1,239,891 |
| Draws | 1,087 | 1,080 |
| Missing required attributes/UVs | 0 | 0 |
| Duplicate ownership paths | 0 | 0 |

`Fire`, `Verbindung West002.001`, and `Verbindung West.002` each occur exactly once. Raw and packaged detail match for topology, base PBR plus transmission/specular/IOR/emissive-strength/unlit state, extension textures, semantic material roles, and surface-sidedness reasons.

## Baseline comparison

| Metric | 53-package baseline | 25-package pilot | Change |
|---|---:|---:|---:|
| Package count | 53 | 25 | -52.8% |
| Web bytes | 99,753,588 | 84,216,832 | -15.6% |
| Quest bytes | 42,856,820 | 36,910,896 | -13.9% |
| Web embedded texture bytes | 68,247,640 | 53,400,646 | -21.8% |
| Quest embedded texture bytes | 23,711,512 | 18,190,325 | -23.3% |
| Web duplicated texture bytes | 51,213,705 | 36,366,711 | -29.0% |
| Quest duplicated texture bytes | 17,225,136 | 11,703,949 | -32.1% |
| Web decoded copies, all packages | 1,658,018,756 | 1,315,357,040 | -20.7% |
| Quest decoded copies, all packages | 656,846,388 | 522,699,668 | -20.4% |

Texture copies fall from 186 Web / 185 Quest to 147 / 147. The 75 unique content hashes remain; coalescing cannot replace a shared GPU texture system.

Largest package: Web 219,926 triangles / 96 draws; Quest 142,617 / 95.

## Near-resident stress samples

Every package AABB center and covered-cell center was sampled. Persistent critical content is always included; streamed AABBs within the radius are included; the missing shell cost is excluded.

| Variant/radius | Requests baseline -> pilot | Tris baseline -> pilot | Draws baseline -> pilot | Download MiB baseline -> pilot | Decoded texture MiB baseline -> pilot |
|---|---:|---:|---:|---:|---:|
| Web/12 m | 12 -> 8 | 1,029,930 -> 987,309 | 356 -> 496 | 47.15 -> 47.06 | 878.19 -> 805.67 |
| Web/24 m | 17 -> 9 | 1,207,670 -> 1,063,728 | 489 -> 520 | 60.30 -> 54.55 | 1,071.33 -> 897.70 |
| Quest/12 m | 12 -> 8 | 456,638 -> 505,601 | 355 -> 489 | 16.69 -> 17.89 | 304.96 -> 279.75 |
| Quest/24 m | 17 -> 10 | 709,094 -> 745,140 | 487 -> 540 | 24.46 -> 22.65 | 381.61 -> 333.67 |

Coalescing reduces requests and decoded duplication, but loads more draws per region. The 489-540-draw peaks still require instancing/material consolidation and hardware profiling. A tested 64-draw partition reduced the worst 12 m sample to about 370 draws but increased packages to 29 and worsened 24 m overlap; keep 96 as the balanced default unless Quest profiling proves draw-call-bound.

## Reproducibility

- Plan SHA-256: `75b8cd8dde5ecec18a44101f63ef7ff18fac63bd477b73aa8e37146d89417cee`
- Rig/DCC/LOD0 payload-set SHA-256: `9d557090bacc8b7ec07cf2c0f338389b8a4f04dd1d1e219d936659ac05a62252`
- Independent audit payload-set SHA-256: `978a0a1960a12ee7d3bccc21cd3aa9b1b088633b9ab3d2645dd0645464868b4b`
- Rig SHA-256: `eebbbcc7a4a0abe8fec88211a33c7275e27b12171b275b79fdf573b4d8c32b23`

Two clean builds produced identical plan and payload hashes.

## Required texture strategy

1. Create separate content-addressed Web and Quest KTX2 banks, using immutable SHA-named files.
2. Make geometry packages reference shared external KTX2 URIs; HTTP cache reuse reduces downloads.
3. Add a GPU resource registry because separate GLTFLoader sessions do not guarantee one decoded texture. Key safe reuse by image hash, color space, sampler/wrap/filter state, and texture role; preserve UV sets and `KHR_texture_transform`.
4. Atlas only reviewed local furniture/signage. Do not blindly atlas tiling floors/walls.
5. Re-audit on target hardware. Current Quest near estimates of 279.75-333.67 MiB decoded copies are not activation evidence.

## Remaining blockers

1. Author and visually approve the opaque shell at the two paths in `shellCompletion.requiredAlwaysResidentShell.outputs`; maximum 150,000 triangles; exclude transparent panes, furniture, Fire, and connectors.
2. Externalize/deduplicate KTX2 textures and prove actual GPU reuse.
3. Reduce near draw calls without changing semantic nodes, materials, or sidedness.
4. Reparent the six detached fire-hose batches to `Ground Floor._anim1` before Ground Floor streaming.
5. Run `node scripts/audit-first-floor-package-pilot.mjs tmp/hlod-pilot-first-floor-coalesced/detail-package-index.json --require-shell`.
6. Complete interior/exterior t=0/end visual review, focus-change/stair/collision regression, and Web/Quest hardware profiling.
7. Emit a disabled manifest-v3 candidate. Add regional HLOD only if profiling proves it useful.

No production manifest, enable flag, runtime route, or production model asset was changed by this pilot.

## Contract-hardening update

The final rebuild now records separate Web/Quest selection envelopes and exact indexed-vertex bounds for every payload. This fixed a real audit defect where accessor min/max values could include unused vertices and differ from visible geometry by metres. All 50 Web/Quest payloads pass the standalone offline acceptance gate.

The package resource contract now separates encoded texture bytes from conservative decoded GPU bytes. The complete package copies total 1,315,357,040 GPU bytes for Web and 522,699,668 for Quest before cross-package sharing. The shared-content projection remains 651.53 MiB saved on Web and 250.32 MiB on Quest, but activation stays blocked until the released packages actually use a verified shared-texture strategy and target-device peak residency is measured.

The shell cannot be added over the current detail set. Its selected structural source paths must first be removed from the detail packages, then both variants and the complete ownership digest must be rebuilt. `requiresDetailOwnershipRepartition` is therefore a hard activation blocker, not a documentation suggestion.

Update: that repartition has now been implemented in the separate disabled `tmp/hlod-pilot-first-floor-shell-candidate/` successor artifact. Its exact shell/detail union passes the independent machine audit, but `shellCompletion.ready` remains false pending architectural review of the paired source-versus-shell projections. See `FIRST_FLOOR_OPAQUE_SHELL_CANDIDATE_REPORT_2026-08-28.md`.
