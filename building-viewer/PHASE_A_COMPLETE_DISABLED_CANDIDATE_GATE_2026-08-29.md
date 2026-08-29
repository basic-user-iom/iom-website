# Phase A complete disabled candidate gate

**Current result:** complete physical ownership evidence; activation remains fail-closed.

**Production routing changed:** no. **Runtime manifest emitted:** no. **Deployment performed:** no.

The final-mode gate now receives the exact structural-proxy v2 evidence, shell-aware static plan, complete physical static payload set, physical residency result, and repeat-spatial v2 result as explicit pinned inputs. It verifies every GLB byte/SHA boundary and does not treat a plan, proxy claim, or logical record as a physical payload.

## Exact physical composition

| Variant | Physical coverage | Missing | Duplicate | Verified payloads | Verified bytes | Partition |
|---|---:|---:|---:|---:|---:|---|
| Web | 6,415 / 6,415 | 0 | 0 | 328 | 355,575,216 | 3,260 five-owner + 312 repeat + 2,843 static |
| Quest | 6,407 / 6,407 | 0 | 0 | 328 | 153,099,344 | 3,252 five-owner + 312 repeat + 2,843 static |

The combined persistent rig passes: six unique anchors, four unchanged animation channels, no render objects, and identity anchors for Ground and `__unowned__`.

## Complete static package evidence

The shell-aware physical static set is now complete:

- 98 exact detail packages plus 88 exact material-preserving structural-near packages = 186 packages per variant.
- 1,699 detail units plus 1,144 near units = all 2,843 static units.
- Near packages retain source geometry, PBR material/image bytes, transforms, and explicit distance-exclusive load-before-retire replacement semantics. Additive proxy/near composition is forbidden.
- Web: 2,571,081 triangles, 1,059 draws, 93,886,196 emitted GLB bytes.
- Quest: 1,228,616 triangles, 1,059 draws, 51,831,944 emitted GLB bytes.
- Every unchanged per-payload byte gate passes.
- Lossless Meshopt transport leaves vertex arrays byte-identical. Its triangle codec may rotate/reorder triples, so the audit proves the exact winding-preserving oriented triangle multiset instead of incorrectly requiring irrelevant list order.
- The complete rebuild is byte/hash deterministic.
- Independent audit: 232,881 assertions, zero failures.

This closes the earlier 1,144-unit physical/material gap. The combined gate resolves the proxy snapshot's historical “near LOD0 does not exist” blockers from the newer exact plan and payload evidence while preserving the immutable upstream snapshot.

## Shared GPU texture residency

Every emitted static image carries `images[*].extras.iomSharedTexture` with the exact embedded-image SHA-256 and encoded byte count. Pooling requires an exact content plus sampler/UV-transform/flipY/color-space compatibility key; name or URL is never accepted as identity.

Real browser QA loads two independently parsed, SHA/byte-verified GLBs and proves:

- metadata reaches every used Three.js texture;
- the second package replaces a compatible duplicate with the canonical GPU texture;
- reference counts cover both roots;
- releasing both roots returns the registry to zero entries, roots, and references.

The exact closed-AABB resident sweep counts compatible pooled GPU resources once, while keeping GLB/network bytes additive:

| Variant | Exit triangles | Exit draws | Unpooled worst GPU bytes | Pooled worst GPU bytes | GPU ceiling | Result |
|---|---:|---:|---:|---:|---:|---|
| Web | 1,090,896 | 212 | 565,970,384 | 358,980,064 | 805,306,368 | pass |
| Quest | 485,715 | 213 | 217,727,060 | 153,281,080 | 201,326,592 | pass |

The isolated physical static residency gate now passes at both the 1.5 m entry and conservative 3.5 m exit margin. Pooling saves 206,990,320 Web bytes and 64,445,980 Quest bytes in the exact worst windows. Package-local embedded texture bytes are still duplicated on the network; external SHA-named KTX2 files or reviewed atlases remain a separate optimization.

## Why activation is still blocked

The combined final gate now reports one machine-evidence error:

- Structural proxy v2 fails the unchanged strong seven-view projection gate.

Its measured coverage remains 77.162% minimum, 78.994% mean, 77.693% top, and 77.972% bottom, below the unchanged 80%, 88%, 92%, and 85% thresholds. Precision (99.403%) and Web/Quest parity (100%) pass, but cannot compensate for missing silhouette coverage.

Additional activation blockers remain intentionally explicit even though they are not malformed-input errors:

- repeat-spatial Web leaves only 16,993 triangles at its current exit witness and needs at least 483,007 fewer triangles to preserve the requested 500k reservation at unchanged hysteresis;
- one complete focus-correlated steady-state and transition-peak budget is still required across all owners, repeat, static near/detail, far proxy, Fire migration, and rig;
- full-layer browser parity, picking, hide/isolate, focus churn, cancellation, recovery, collision, and stairs must be retested on the composed disabled manifest;
- duplicate embedded/network texture delivery remains unresolved even though live GPU pooling is proven;
- physical desktop and Quest-class FPS, memory, and thermal acceptance remain required;
- the runtime manifest is intentionally not emitted until the above gates pass.

No threshold was relaxed and no rejected proxy or incomplete streaming route was enabled.

## Current evidence

- `tmp/hlod-pilot-unowned-structural-proxy-v2/`
- `tmp/unowned-static-partition-plan-proxy-v2/unowned-static-partition-plan-v2.json`
- `tmp/unowned-static-payload-candidate-proxy-v2/payload-index.json`
- `tmp/unowned-static-payload-candidate-proxy-v2/payload-audit.json`
- `tmp/unowned-static-payload-candidate-proxy-v2/shared-texture-browser-qa.json`
- `tmp/unowned-static-resident-window-proxy-v2/unowned-static-resident-window-plan-v1.json`
- `tmp/repeat-spatial-payload-v2/`
- `tmp/repeat-spatial-reservation-what-if-v1/`
- `tmp/phase-a-complete-disabled-candidate-proxy-v2/`

## Focused verification commands

```powershell
npm.cmd run test:unowned-static-payload-contract
npm.cmd run test:spatial-resident-window
node scripts/test-phase-a-complete-candidate-gate.mjs
node scripts/test-phase-a-final-input-contract.mjs
node scripts/qa-unowned-static-shared-texture-candidate.mjs
```

The final full build remains the required regression boundary before handoff:

```powershell
npm.cmd run build
```
