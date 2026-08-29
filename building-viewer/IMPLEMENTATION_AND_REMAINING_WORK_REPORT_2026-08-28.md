# Building Viewer — Implementation and Remaining Work Report

**Implementation review:** 28 August 2026  
**Project:** `F:\iom_website\building-viewer`  
**Baseline plan:** [VISUAL_REALISM_AND_HIGH_FPS_REVISION_PLAN.md](./VISUAL_REALISM_AND_HIGH_FPS_REVISION_PLAN.md)  
**Deployment status:** Not deployed. No production deploy or Git commit was requested.

## 1. Executive result

All correctness defects that could be repaired safely in the viewer and current GLB pipeline have been addressed. In particular:

- The broad visibility rule that could remove valid ground, walkway, connector, and interior content has been replaced with explicit ownership/semantic rules.
- Runtime triangle-winding mutation has been removed. It was unsafe for open and concave CAD assemblies and could make correct front faces disappear.
- The exact `Fire` cabinet hierarchy and its six material roles are protected from LOD, floor zoning, deduplication, incorrect glass conversion, and ordinary batching.
- Glass classification is now per material slot rather than per mixed assembly.
- The exterior and animated source models were cleaned and rebuilt into current Web and Quest tiers with Meshopt, KTX2, dramatically fewer submissions, mostly single-sided opaque materials, repaired missing texture coordinates, animation preservation, and reproducible provenance.
- Animated collision was rebuilt from 14.16 MiB / 626,746 expanded triangles to 4.87 MiB / 150,882 expanded triangles and passed collision-coverage validation, including all 13 required animated stair owners.
- Loading, cancellation, WebGL context recovery, XR session setup/teardown, runtime antialias fallback, adaptive-quality hysteresis, and startup thumbnail work were hardened.
- The production viewer bundle builds successfully, ordinary model validation has zero warnings, all automated regression tests pass, and the final browser smoke test has no application, shader, or WebGL errors.

The current result is a materially safer, smaller, and faster viewer, but it is not honest to certify the full animated building as a final 60 FPS / Quest 72 Hz asset yet. The strict gate still rejects that asset because it remains a monolithic 13.59M-triangle Web scene and 6.11M-triangle Quest scene. Meeting the final gate requires animation-aware floor/room HLOD packages and real-device testing, not another blind global decimation pass.

## 2. The two reported visual defects

### 2.1 Ground and walkway holes

#### Confirmed causes

The defect was not one single missing polygon. Several unsafe policies could produce the same symptom:

1. A broad duplicate policy inferred that large ground or connector meshes belonged to the exterior and hid them while another layer was active.
2. Runtime winding repair used a global-centroid test on open/concave CAD geometry. A valid surface could be flipped and then disappear under back-face culling.
3. Thin ground meshes and untextured campus fills were not consistently treated as always-resident coverage surfaces.
4. Missing or invalid texture coordinates could make otherwise valid ground render as a constant or broken sample.

#### Implemented repair

- Duplicate suppression now requires authored `orbitDuplicateOf: "icm-ext"` ownership or the explicit façade-shutter policy. Name, size, or ground-like appearance alone can no longer hide a mesh.
- Valid building connections (`Verbindung`, walkway, footbridge, skybridge, connector, passage) are semantic visibility-critical objects.
- Runtime winding mutation was removed. Winding and mirrored-transform repair belongs in Blender/source preprocessing.
- Floor, plaza, water, and thin ground surfaces retain `detailLodIgnore` / `floorZoneAlways` residency and are never removed by distance LOD.
- The campus fill is retained as a slightly lowered underlay instead of acting as a coplanar opaque cover.
- Textured primitives missing the referenced UV attribute receive a deterministic planar fallback during release preparation; the current production routes report zero missing UV0.
- Lossless batching now accepts ordinary ground/floor objects while preserving their residency flags and per-object frustum culling. Named safety and connection assemblies remain individually addressable.

#### Evidence

- Exterior ground wide, close, and grazing views showed no through-hole in visual QA.
- Exterior collision coverage passes with zero sparse walk cells.
- Visual-correctness regression tests cover explicit duplicate ownership, ground residency, connection semantics, imported-instancing splits, and batch semantics.

### 2.2 Fire cabinet / missing front faces

#### Confirmed causes

1. The exact node name `Fire` was previously vulnerable to ordinary detail/duplicate behavior.
2. Material deduplication could merge a fire-safety material into a visually identical ordinary CAD material, spreading or losing the safety role.
3. A mixed cabinet assembly could be classified as entirely glass, causing opaque front/body slots to receive transparent glass behavior.
4. Unsafe runtime winding changes and widespread double-sided source materials masked the underlying face-orientation problem.

#### Implemented repair

- `Fire` and fire/hose/hydrant/feuer/brandschutz assemblies are visibility-critical through their hierarchy.
- The exact cabinet stays visible, always resident, and excluded from destructive LOD and ordinary opaque batching.
- Six cabinet materials are isolated and carry either `fire-safety-opaque` or `fire-safety-glass` role metadata.
- Material deduplication includes the semantic role in its signature and excludes material merging in the offline batching pass.
- Glass is classified and converted per material slot. Cabinet metal, plastic, red body, reel, valve, hose, and lower panel remain opaque; only the glass slot uses the stable opacity-glass path.
- No runtime triangle-winding mutation is performed.

#### Evidence

- Browser inspection found the exact `Fire` object with own and effective visibility both `true`.
- The cabinet front and side visual checks showed the body, front, reel, hose, valve, and lower panel present; the pane remained translucent rather than black.
- All six fire material roles remain isolated to the cabinet’s logical instances after final compression.

## 3. Asset results

“Expanded triangles” include node/instance reuse and are more meaningful than unique stored triangles. “Draws” below are GLB primitive submissions before runtime packing and view culling.

| Asset | Audit baseline | Current result | Main result |
|---|---:|---:|---|
| Exterior Web | 31.44 MiB; 1,196,916 tris; 793 draws | 16.77 MiB; 1,195,062 tris; 131 draws | About 47% smaller and 83% fewer submissions, with essentially unchanged geometry |
| Exterior Quest | 16.23 MiB; 743,927 tris; 793 draws | 10.39 MiB; 799,575 tris; 131 draws | Under the 800k gate; topology/quality retained while submissions fell 83% |
| Animated Web | 154.82 MiB; 13,657,202 tris; 14,687 draws | 93.03 MiB; 13,585,615 tris; 3,753 draws | About 40% smaller and 74% fewer submissions |
| Animated Quest | 83.27 MiB; 7,879,319 tris; 14,684 draws | 49.68 MiB; 6,107,774 tris; 3,745 draws | About 40% smaller and 74% fewer submissions, with the stricter Quest geometry tier |
| Animated collision | 14.16 MiB; 626,746 expanded tris | 4.87 MiB; 150,882 expanded tris | About 66% smaller and 76% fewer expanded triangles; coverage and stairs pass |

Additional production properties:

- Exterior: 28/28 textures KTX2; 94 materials, 27 selectively double-sided.
- Animated: 139/139 textures KTX2; 458 materials, 70 selectively double-sided in the GLB.
- Both active Web/Quest routes use Meshopt compression and current SHA-256-matched provenance reports.
- The animated route contains one 2.708333-second clip sampled at 24 Hz with all four non-constant floor/ceiling translation tracks preserved.
- The Web manifest now points to the actual high-quality animated Web asset instead of incorrectly reusing the Quest file.
- The collision route contains no textures or animation.

## 4. Runtime and viewer work completed

### Geometry, materials, and visibility

- Explicit duplicate ownership instead of inferred ground/size/name hiding.
- Semantic protection for fire equipment and building connections.
- Per-material glass classification for mixed assemblies.
- Stable opacity/reflection glass path with no damaged normal/transmission maps, depth writing, or black metallic mirror factors.
- Source material-sidedness normalization: closed CAD materials become single-sided; explicit foliage/sheet/fabric/sign materials remain double-sided.
- Transparent BatchedMesh uses per-object sorting and culling and never casts shadows.
- Imported `EXT_mesh_gpu_instancing` groups are split spatially so one distant instance cannot keep a campus-wide group resident.
- Material-role-aware deduplication prevents critical-role contamination.

### Performance and quality stability

- P95-based adaptive quality with warm-up, hysteresis, and cooldown instead of short average-FPS oscillation.
- Quest fallback is one-way during a session to prevent repeated full asset/profile oscillation.
- Runtime FXAA fallback works when boot-time context MSAA is unavailable.
- Ground/floor batching retains exact geometry and residency semantics while reducing submissions.
- Camera thumbnails are deferred to avoid synchronous startup readback stalls.
- Collision uses validated dedicated coarse GLBs rather than merging visual geometry back into Walk/XR.

### Loading, cancellation, and recovery

- Model replacement is atomic: the old scene and collision remain active until the replacement is ready.
- Stale model, stream, animation, and collision work is guarded by abort signals and generation checks.
- WebGL context loss restores the correct route; Quest has a controlled reload fallback.
- XR order is correct: request session, apply framebuffer scale, then bind the session.
- XR pending/dispose races are handled and the pre-XR quality profile is restored on exit.

### Reproducible asset pipeline

- Pinned glTF Transform 4.4.2, meshoptimizer 1.2.0, Sharp 0.35.3, and `ktx2-encoder` 0.6.0.
- Pinned official gltfpack 1.2 executable and SHA-256.
- Strict single-populated-scene handling.
- Explicit 24 Hz animation validation and duration/non-constant-track checks.
- UV-reference validation and deterministic missing-UV fallback.
- KTX2, Meshopt, semantic-name, fire-role, material-sidedness, and provenance validation.
- Animation-safe offline instancing/batching with exact repeat and spatial grouping statistics.
- Collision extraction reads Meshopt/KTX-compressed release assets correctly.
- Root `build:building-viewer` now produces the current viewer bundle and runs model/type validation first.

## 5. Plan comparison

| Original plan item | State | Evidence / remaining boundary |
|---|---|---|
| P0.1 Rebuild animated asset offline | **Partial** | Source cleaned, compressed, material-correct, role-safe, and submissions reduced ~75%. Animation-aware floor/room HLOD and streaming packages still required. |
| P0.2 Remove first-load asset construction | **Partial** | Expensive unsafe work was removed/hardened and thumbnails deferred. Runtime packing remains necessary until HLOD packages exist. |
| P0.3 Replace broken runtime LOD | **Partial** | Critical/floor surfaces are excluded from destructive LOD and tests protect them. Final reviewed offline LOD0/1/2/HLOD is not authored. |
| P0.4 Trustworthy build and gates | **Complete** | Root viewer build, expanded-workload accounting, provenance hashes, regression tests, collision coverage, and strict release gate exist. |
| P1.1 Geometry/transforms/topology | **Browser safeguard complete; DCC cleanup remains** | Open and mixed-winding architectural shells are selectively protected and mirrored shared draws are prevented. Permanent Blender normal/non-manifold/thickness repair remains source-authoring debt. |
| P1.2 UV0 and lightmap UV1 | **Partial** | Active textured routes have no missing UV0. Golden slices prove UV1/lightmap binding. Full static building UV1 atlases are not baked. |
| P1.3 Efficient glTF PBR materials | **Mostly complete in runtime/release** | Closed materials retain back-face culling while only 27 exterior / 70 animated materials are selectively two-sided; glass and semantic roles are fixed. Full V-Ray master conversion with richer normal/ORM data remains DCC work. |
| P1.4 Project lighting | **Partial** | AgX/PMREM/daylight controls and lightmap infrastructure work; two golden lightmapped slices exist. Full building V-Ray/Cycles GI, local probes, and matched HDR/sun presets are not produced. |
| P1.5 Stable quality selection | **Complete in code; hardware validation pending** | P95 hysteresis, cooldowns, FXAA fallback, Quest policy, XR restore, DPR/profile controls. |
| P1.6 Animation-safe cells/HLOD | **Runtime and lossless package pilot complete; activation blocked on authored assets** | The guarded manifest-v3 runtime, persistent rig, verified package swaps, 25-package first-floor pilot, offline acceptance gate, recovery path, and texture registry now exist. The old 925 position-only cells remain disabled. Activation still requires an authored shell, ownership repartition, collision evidence, texture-residency completion, and hardware review. |
| P1.7 Startup/per-frame work | **Mostly complete** | Duplicate traversal is explicit/state-driven, thumbnails deferred, loads cancellable/atomic, packing improved. Animated monolith still causes load/preprocess cost. |
| P2 Photo/SSR/path-traced presentation | **Not started** | Correctly deferred until the interactive asset meets its performance gate. |

## 6. Acceptance evidence

### Passing

- `npm run build:building-viewer` — pass; production output created at `public/demos/icm-building/`.
- `npm run model:validate` — pass, **0 warnings**.
- `npx tsc --noEmit` — pass.
- `npm run test:visual-correctness` — pass.
- `npm run test:surface-visibility` — pass.
- `npm run test:hlod-contract` — pass.
- `npm run test:runtime-stability` — pass.
- `npm run test:performance-monitor` — pass.
- `npm run test:stair-geometry` — pass.
- `npm run model:collision-coverage -- --id icm-ext` — pass.
- `npm run model:collision-coverage -- --id icm-anim-2025` — pass.
- Final local-browser smoke test — pass: animation available/playing, exact Fire visible, four connection objects visible, zero missing textured UV0, WebGL error 0, no page/shader/application errors.

The blocked Google Fonts requests seen by the headless sandbox are external-network warnings only; they do not affect viewer boot or rendering.

### Deliberately still failing

`npm run model:gate` now fails only four animated-model budget checks:

- Web expanded triangles: 13,585,615 > 2,000,000.
- Web GLB primitive draws: 3,753 > 1,000.
- Quest expanded triangles: 6,107,774 > 800,000.
- Quest GLB primitive draws: 3,745 > 1,000.

The exterior passes both Web and Quest asset ceilings. The animated limits were not weakened and the asset was not blindly decimated until small cabinet, railing, signage, glass, and walkway geometry disappeared. That would exchange a visible defect for a green number.

Headless Chromium uses SwiftShader in this environment, so its displayed FPS is not a desktop or Quest performance result. Its counters are useful for regression diagnosis only. The current wide animated-overview sample was 1,882 renderer calls and 18.51M submitted triangles including view/shadow passes. The final focused surface QA snapshots measured 254 calls / 1.07M submitted triangles for the exterior and 166 calls / 1.44M for the targeted animated interior view. This viewpoint spread is exactly why floor/room streaming and real-device percentile measurements remain mandatory.

## 7. Work still required for the target result

### 7.1 Animation-aware HLOD and room/floor streaming — highest priority

This is the remaining blocker for high FPS on the full animated building.

In Blender/3ds Max/Revit export preparation:

1. Keep the four translated animation targets as lightweight transform roots.
2. Separate static shell, each floor, rooms, furniture/fixtures, railings, vegetation, and transparent panes into deterministic packages.
3. Author and visually approve LOD0/LOD1/LOD2 for repeated/high-cost categories.
4. Build opaque HLOD clusters per floor and approximately 12–24 m spatial cell while retaining material, normal, UV0, optional UV1, tangent, semantic role, and animation-root ownership.
5. Keep an always-resident exterior shell below approximately 150k triangles.
6. Keep individual cells below 250k triangles and design normal resident sets to stay below 2M Web / 800k Quest visible triangles and 1,000 submissions.
7. Preserve the exact Fire cabinet and connection objects in their correct packages; repeat the current browser regressions after every bake.

Do not enable the existing `icm-anim-2025/cell-manifest.json`. It is historical position-only output and fails the required visual/animation contract.

The first safe implementation slice is complete: `scripts/validate-animation-package-manifest-v3.mjs` and its disabled `1st Floor._anim1` pilot enforce source/rig hashes, persistent ownership, owner-local transforms and bounds, required geometry attributes, both Web/Quest LOD0+HLOD payloads, and the 250k/150k/2M/800k triangle ceilings. It is a contract gate only; production streaming remains intentionally off until real packages exist.

### 7.2 Full V-Ray/Cycles baked-lighting production

To move from a clean real-time PBR viewer toward V-Ray presentation:

1. Apply transforms and resolve mirrored geometry in the source DCC file.
2. Create non-overlapping UV1 for static opaque receiving surfaces, with atlas padding appropriate to the final atlas and mip chain.
3. Bake diffuse indirect GI and selected static shadowing in V-Ray or Cycles; do not bake specular reflections into diffuse lightmaps.
4. Partition lightmaps per room/floor rather than one enormous campus atlas.
5. Export lightmaps as linear data and transcode high-value atlases to KTX2 UASTC with mipmaps.
6. Match the real sun direction, HDR rotation, exposure, white balance, and bake scenario.
7. Add local reflection probes for foyer/interior/glass zones. Keep only near-camera dynamic sun/contact shadows in Explore/VR.
8. Validate no lightmap UV overlap, bleed, black padding shimmer, or duplicated lighting.

The small golden exterior/interior slices prove the viewer-side UV1/lightmap contract, including the correct exclusion of emissive downlights. They are a proof of pipeline, not a full-building bake.

### 7.3 Real hardware acceptance

Run the built viewer—not the development server—on target devices:

- Desktop: 60 FPS target, frame p95 ≤ 16.67 ms.
- Mobile: 30/45 FPS according to chosen tier, no memory/context loss.
- Quest: 72 Hz minimum, CPU and GPU p95 ≤ 13.89 ms, thermal soak for at least 10–15 minutes.

Use `__iomQuestTest.start('<view>')`, traverse all saved views and representative Walk/VR paths, then export the report. Record cold load, warm load, peak GPU memory if available, context loss, and animation playback.

## 8. Unreal/Lumen/Nanite boundary

Literal Unreal Lumen, Nanite, and Unreal Virtual Shadow Maps do not run inside this Three.js/WebGL viewer. The implemented/recommended browser equivalents are:

- **Lumen equivalent:** baked diffuse GI/lightmaps, irradiance/reflection probes, PMREM environment lighting, and optional high-tier screen-space effects.
- **Nanite equivalent:** authored LOD/HLOD, spatial/floor streaming, Meshopt, true instancing, BatchedMesh, frustum/occlusion culling, and strict resident-set budgets.
- **Virtual Shadow Maps equivalent:** baked static shadowing plus tightly bounded/cached near-camera real-time sun/contact shadows.
- **TSR/DLSS equivalent:** adaptive internal resolution with stable FXAA/SMAA/temporal AA appropriate to the device.

If literal Unreal rendering is mandatory, use Unreal Pixel Streaming as a separate product mode. It provides the Unreal renderer in the browser as streamed video, with GPU-server cost, latency, bandwidth, concurrency, and operational trade-offs.

## 9. Recovery and handoff

- Pre-release asset backups are under `building-viewer/tmp/pre-release-2026-08-28/`.
- QA screenshots are under `building-viewer/tmp/qa-release-v3-final/` and `building-viewer/tmp/qa-release-final-smoke.png`.
- Current model provenance files are beside each production GLB in `public/models/<id>/`.
- Nothing has been deployed or committed by this work.

The safest next production milestone is not another renderer effect. It is the animation-aware HLOD/streaming asset pass, followed by the complete V-Ray/Cycles lightmap bake and real Quest/desktop percentile testing.

## 10. Stair-walking fix addendum — 2026-08-28

**Status: fixed and verified through the real browser runtime for both production model variants.**

### 10.1 Root causes

The stair failure was a combination of asset extraction and character-controller defects:

1. The reduced animated collision GLB omitted primary stair owners including `TR_Stufen010`, `TR_Stufen_002`, `TR_Stufen`, `TR_Stufen_001`, `TR_Stufen_003`, `Podest`, and `Boden_2_Tafeln_Foyer_Treppe`.
2. The old extractor classified geometry by shared material names. Objects such as doors, lights, furniture, and ventilation that reused `treppe_naturstein` could therefore become false stair colliders.
3. Mixed batched meshes could turn one stair material into an oversized stair bounding volume containing unrelated floor geometry.
4. The controller started volume-based climbing merely by entering a stair proxy, even without blocked contact. It could continue climbing while reversing or moving sideways and did not reliably transition onto lower treads during descent.
5. Ground probing stopped at the first steep triangle. A stair riser could therefore hide a valid horizontal tread directly behind it.
6. Some exterior CAD stairs have valid tread tops but sparse side topology, so whole-envelope stair-axis inference alone could not determine a safe ascent direction.

### 10.2 Implemented correction

- Rebuilt both production collision assets from semantically valid geometry and preserved the real stair topology.
- Changed extraction to use owning node hierarchy and primitive role, not material name alone.
- Split mixed batched geometry into `stair`, `walk`, and inferred-walk primitives before collision processing.
- Excluded known non-walk owners and roles such as doors, lights, furniture, ventilation, ceilings, walls, and railings.
- Added expanded-runtime triangle accounting, including shared nodes and `EXT_mesh_gpu_instancing`, with a hard failure when the collision budget is exceeded.
- Made volume climbing require real blocked stair contact and a valid forward ascent direction.
- Reset the climbing state on reversal, sideways departure, lower-tread contact, teleport, or stair exit.
- Added a multi-hit ground-ray fallback so a steep riser cannot mask a walkable tread.
- Added conservative tread-centroid ascent inference for sparse CAD stairs. It requires multiple distinct levels, sufficient rise and run, strong height/run correlation, plausible width, and a safe grade.

### 10.3 Production collision assets

| Model | Collision size | Runtime triangles | Resident chunks | Stair chunks | Stair validation |
|---|---:|---:|---:|---:|---|
| `icm-ext` | 2,551,864 bytes | 245,603 | 57 | 4 | `Treppen all_004` 26/26 and `Treppen all_007` 4/4 samples supported |
| `icm-anim-2025` | 5,111,224 bytes | 120,838 | 304 | 79 | All 13 protected stair owners present; representative primary surfaces 100% supported |

Current SHA-256 values:

- Exterior collision: `B59B9D7E44D20BF976B76863DA150D65035C8DABD212F073F450280F42412AD2`
- Animated collision: `3F37A14C33A38362DDFF0B1F0DCC76D15CA3B9F757FB4183799D9E6D70EE0B48`

The replaced collision files remain recoverable under `building-viewer/tmp/pre-release-2026-08-28/`.

### 10.4 Browser traversal evidence

The acceptance test loads the production collision route through `GLTFLoader`, builds the actual runtime collision chunks, and drives the real `CharacterController`; it is not only a static GLB inspection.

- Exterior stair: climbed 2.942 m, reached a 2.773 m vertical span, then descended 2.777 m and returned to the lower level.
- Animated `TR_Stufen004`: travelled 7.956 m along the stair, climbed 4.058 m across a 4.045 m span, then descended 4.350 m to the lower level.
- Dedicated collision remained active; the visual-model fallback was not used.
- No relevant browser console, shader, WebGL, or asset-request errors occurred. Sandbox-blocked Google Fonts requests were ignored because they do not affect local geometry or movement.

### 10.5 Permanent regression gates

The standard build now validates both collision routes before TypeScript and Vite compilation:

```text
npm run model:validate
npm run model:collision-coverage:all
npx tsc --noEmit
vite build
```

Additional passing diagnostics:

- `npm run test:character-stairs`
- `npm run test:stair-geometry`
- `npm run test:runtime-stability`
- `npm run test:visual-correctness`
- `npm run test:performance-monitor`

The coverage validator intentionally fails if a protected animated stair owner disappears, real horizontal tread support drops below the threshold, broad walkable coverage regresses, or non-walk semantic owners re-enter the collision asset. This prevents a future “optimization” from silently reintroducing the stair, hole, or false-collider defects.

## 11. Physical texture-scale fix addendum — 2026-08-28

**Status: fixed and browser-verified for the reported exterior paving, landscape, and water surfaces.**

### 11.1 Root causes

1. `Asphalt_05` and `ICM_Asphalt_001` had no authored UV0. The release fallback normalized each primitive to 0–1 before batching, stretching one `Aussen_Kopfsteinpflaster-Ringe-72dpi` image across a combined 174.16 × 77.36 m slab.
2. Runtime UV validation treated any UV span above 512 as corrupt. Two correctly authored paths exceed 1,000 UV units, so the viewer replaced their good approximately 1 m tiling with a coarse universal 4 m projection.
3. UV validation checked only numeric range, not physical metres represented by one texture repeat. A syntactically valid 0–1 UV island could therefore cover thousands of square metres.
4. Grass materials used valid KHR texture transforms, but different meshes sharing those materials had substantially different physical UV density.
5. The water base-color image contains a low-frequency, non-seamless blue square. Stretching or repeating it produces the large pool-tile grid visible in the overview.
6. KTX2/compressed textures were skipped by the anisotropic-filtering path, making corrected fine paving unnecessarily blurry at oblique camera angles.

### 11.2 Implemented correction

- Added horizontal triangle-area analysis that measures world metres per effective texture repeat, including `Texture.repeat`/KHR texture transforms.
- Added narrow semantic policies using mesh, material, and texture names. Paving and ground-cover outliers are remapped in world X/Z at 1.5 m per repeat.
- Corrected geometry is cloned per mesh, so shared materials and textures on already-correct paths remain unchanged.
- Raised the valid authored-UV ceiling from 512 to 1,000,000 units; non-finite and collapsed UVs are still repaired.
- Preserved KHR repeat and offset behavior by dividing the authored repeat out of generated metric UVs.
- Removed the non-seamless water albedo from the runtime water clone and replaced it with a stable teal, non-metallic, moderately rough reflective surface. This removes the checker grid and one texture sample without changing water geometry or collision.
- Enabled configured anisotropic filtering for KTX2/compressed textures as well as uncompressed textures.
- Changed the offline gltfpack fallback to create metric planar UVs for future releases: 1.5 m for paving/landscape, 8 m for water-source UVs, and 4 m for generic missing-UV materials. Future rebuilds no longer generate one normalized tile per whole primitive.

### 11.3 Measured before/after values

| Production surface | Before | After |
|---|---:|---:|
| Broken `mat_16 - Default_004` cobble slab | 54.488 m/repeat | 1.500 m/repeat |
| `grundplatte` cobblestone | 3.298 m/repeat | 1.500 m/repeat |
| `seeweg` stone path | 2.149 m/repeat | 1.500 m/repeat |
| `GRUEN` landscape meshes | 4.000–5.050 m/repeat | 1.500 m/repeat |
| `GRUEN_002` landscape meshes | 6.017–10.009 m/repeat | 1.500 m/repeat |
| Correct `mat_16`, `mnschner_001`, `steinboden`, and `kopfstein_strasse` surfaces | 0.998–1.518 m/repeat | unchanged |
| Water checker albedo | one visible low-frequency grid | removed from runtime water material |

The same affected UV topology exists in the Web and Quest exterior GLBs; the runtime correction therefore covers both quality routes.

### 11.4 Regression evidence

- Added deterministic visual-correctness cases for collapsed 0–1 paving UVs, shared-material isolation, preservation of valid >1,000-unit UVs, KHR-repeat compensation, water material cleanup, and repeat-call idempotence.
- `npm run build` now runs `test:visual-correctness` before TypeScript and Vite compilation.
- Full production build: pass, zero model-validation warnings.
- Exterior and animated collision coverage: pass.
- Runtime stability, stair controller, stair geometry, visual correctness, and performance monitor tests: pass.
- Browser metric audit: all targeted paving and landscape outliers reached 1.500 m/repeat while correct reference surfaces stayed unchanged.
- Browser before/after views: reported wide, close, and grazing views pass with no page, shader, WebGL, or model-request errors. Only sandbox-blocked Google Fonts requests remain irrelevant to rendering.
- Two-layer browser smoke: animated clip playing, Fire assembly visible, all four connection assemblies visible, zero textured meshes missing UV0, and WebGL error code 0.

## 12. Exterior and interior surface-visibility fix addendum — 2026-08-28

**Status: fixed in the current Web and Quest assets and protected by runtime/build/browser gates.**

### 12.1 Confirmed causes

1. The source CAD/GLB uses many legitimate open architectural shells. Converting every opaque material to `FrontSide` made wall, façade, connector, and cabinet faces disappear from the reverse view.
2. A global `DoubleSide` fallback would have hidden the source problem at a severe raster/shadow cost. The animated Web source contains thousands of open primitives, so the repair had to be per primitive/use.
3. Some affected meshes have no boundary edge but do contain mixed winding or non-manifold edges. A boundary-only topology test could therefore miss them.
4. `Flugturm` used generic `mat_24 - Default*` materials and lost its owner name during optimization. `GebudeWest`, `NebenGebude23`, hall shells, and two connection batches had similar semantic-loss paths.
5. Mirrored children from parent branches with opposite determinant signs could enter the same `InstancedMesh`/`BatchedMesh`. WebGL cannot change front-face winding per item inside one shared draw, causing angle-dependent exterior and interior loss.

### 12.2 Implemented correction

- Added position-welded topology inspection so UV/normal seams do not masquerade as open borders.
- Added source-time, per-use material splitting with persistent `iomDoubleSidedReason` metadata. Shared generic materials remain single-sided on closed furniture/volumes.
- Protected exact tower, façade, building/hall, connector, fire-safety, interior-wall, and mixed-winding roof/wall shells.
- Added a final-repack promotion path for an audited shell name created by offline batching; it clones the material rather than mutating unrelated `m.wall.white` use.
- Added a runtime fallback for the same exact audited names and topology evidence.
- Partitioned procedural instance/batch candidates by packing-host determinant sign, revalidated against the final host, and extracted mirrored imported instances to standalone meshes.
- Expanded the browser QA from one overview to focused opposing-angle exterior/interior cameras, plus exact semantic/material and active packed-transform assertions.

### 12.3 Measured scope and evidence

- The targeted mixed-winding set contains 24 primitive instances / 2,140 triangles; all 24 are now authored `DoubleSide`, with zero single-sided matches.
- Exterior release: 27 selectively two-sided materials; animated release: 70. Closed opaque materials still retain back-face culling.
- `Flugturm` is complete from four cardinal views; low/roof views are included in the final focused QA set.
- Exact animated targets include `BT_3_front_wand_021.001`, `Fassade_Metall.001/.002`, `Wand_40.004/.005`, `BT3_innenwaende.002/.004/.005/.006`, `Wand_bt1_001.002`, `turm.001`, all audited office façades, the west tower roof cap, all `Verbindung West*` primitives, and all six fire-safety roles.
- The first browser audit found 27 active negative packed transforms. After determinant partitioning: exterior 0, animated 0, inactive/stale 0.
- Mirrored safety leaves 20 unsafe items standalone; the measured animated runtime changed by only one renderer call.
- Final focused browser QA produced 13 HUD-free exterior/interior captures with zero failures, zero audited or authored `FrontSide` violations, zero active mirrored packed transforms, zero WebGL errors, zero page errors, and zero console errors. Evidence is stored in `tmp/qa-surface-visibility-camera-final/report.json` beside the 13 PNG captures.
- `npm run model:validate`: pass, 0 warnings.
- Surface, visual-correctness, runtime, stair, collision, HLOD-contract, TypeScript, and full production build gates: pass.

### 12.4 Permanent DCC repair still recommended

The browser safeguard is intentional and low-cost, but Blender/3ds Max should still repair the source meshes: apply mirrored transforms, recalculate outward normals, resolve non-manifold/duplicate faces, and add thickness where an element is physically a solid wall or roof. Keep deliberate one-plane glazing, signs, foliage, and open architectural sheets two-sided. Re-export and rerun the same opposing-angle QA before removing any audited fallback.

## 13. Next phase started: animation-aware HLOD contract

The historical 925 cells remain disabled because they are stale, position-only, animation-breaking packages. A replacement manifest-v3 contract and disabled `1st Floor._anim1` pilot now establish the safe gate for the next phase:

- verified source and rig SHA-256;
- one persistent animation owner with owner-local transforms and bounds;
- required `POSITION`, usage-driven lit normals/texture UV sets, and declared semantic roles;
- Web and Quest lossless LOD0 contracts, a required always-resident shell, and optional per-detail HLOD;
- maximum 250k triangles per detail package;
- maximum 150k triangles for the always-resident shell;
- maximum declared resident sets of 2M Web / 800k Quest triangles;
- rejection of stale hashes, duplicate IDs/owners, invalid per-variant selection or exact payload bounds, unsafe transforms, missing attributes, incoherent LOD margins, and over-budget packages.

This phase is deliberately not connected to the production manifest yet. Lossless owner-local detail packages and persistent-rig loading now exist for the first-floor pilot. The next DCC deliverable is the disjoint, visually approved opaque shell, followed by collision-evidence, texture-residency, Fire/connector, no-hole, animation, cancellation, stair, and hardware acceptance. Only then should the other animation owners be packaged.

## 14. Animation-aware runtime and first-floor package handoff addendum

The persistent-rig runtime portion of the next phase is now implemented and remains guarded behind an explicit `hlodStreaming.enabled: true` model-entry opt-in. It:

- validates manifest v3 again in the browser against independent model, source, and rig pins;
- loads one persistent rig and attaches every payload in its declared owner-local transform space;
- establishes HLOD before requesting nearby LOD0, then keeps the old level visible until its replacement is attached;
- preserves the existing animation mixer binding and transport across package swaps;
- aborts superseded loads, enforces the active resident-triangle budget, isolates shared resources, and falls back atomically to the monolithic GLB when initialization fails;
- rejects legacy cells and package-embedded animation clips.

The runtime regression is part of the mandatory viewer build and passes together with the manifest contract. The balanced coalesced pilot now uses 25 owner-local packages for `1st Floor._anim1`, each below the 235k planning ceiling; `Fire`, `Verbindung West002.001`, and `Verbindung West.002` are isolated in the persistent critical package.

Production activation is still intentionally blocked. The remaining DCC deliverable is a visually reviewed Web/Quest opaque shell with disjoint source ownership; per-detail HLOD is optional under the current contract. Collision evidence, texture residency, visual/cancellation testing, and real-device acceptance must also pass. The lossless detail-package builder writes only to `building-viewer/tmp/` and cannot alter the production manifest.

## 15. Final state reconciliation after activation-safety review

This section supersedes earlier package counts and any earlier wording that described every detail package as requiring its own HLOD. The current balanced pilot has 25 packages: one persistent critical LOD0 and 24 streamed lossless LOD0 packages. One authored always-resident shell is required; per-detail HLOD is optional. Production remains on the complete monolithic Web/Quest GLBs because the package route is deliberately not present in `public/models/manifest.json`.

### 15.1 Additional implementation completed

- Verified GLB loading now enforces a strict, self-contained GLB v2 boundary before parsing. Invalid containers, external URIs, mismatched byte pins, oversized responses, and hash mismatches fail before GLTFLoader receives the data. The verified-load ceiling is 512 MiB.
- Web and Quest source provenance are separate. Source hashes, manifest hashes, manifest byte counts, selection bounds, and exact payload bounds are variant-specific.
- Source ownership is not trusted as metadata alone: the browser recomputes the sorted source-path SHA-256 for both variants before accepting the manifest.
- Payload selection uses a stable per-variant envelope; each LOD level has its own exact bounds. HLOD enter/exit margins are checked so no transition gap can occur.
- Resource budgets now distinguish network/encoded texture bytes from conservative decoded GPU residency. Triangle, draw, file-byte, encoded-texture, and GPU-texture limits all participate in resident and transition-peak checks.
- The offline and runtime payload boundaries now agree on the important rejections: cameras, lights, lines/points/sprites, embedded animation, skinned or morph-deformed render payloads, non-finite attributes, invalid indices, missing declared attributes, duplicate ownership, empty geometry, metrics, and exact bounds.
- Offline asset URL verification rejects relative or absolute traversal outside the approved manifest/asset root.
- The shared-texture pool no longer trusts GLB-authored `userData` ownership flags. Runtime-only WeakMap ownership controls disposal, spoofed flags are ignored, and mutable compatibility-key drift fails closed.
- Focus changes use one serialized latest-focus worker. Failed monolithic recovery leaves the previous streamed scene/collision active and re-arms recovery instead of stranding the layer.
- Streaming is refused when a layer has an unpinned project lightmap; the complete monolithic route is retained until package/lightmap pins and ownership are designed.
- Imported InstancedMesh/BatchedMesh objects now have full instance-aware LOD bounds. Inspector selection, Source ID display, per-instance hide/isolate, cohort handling, and restore behavior are safe prerequisites for an isolated instancing candidate.
- The collision activation phase is now complete for the exact animated proxy. `collision-coverage-v1.json` is bound to collision SHA `3f37a14c...ee0b48`, 5,111,224 bytes, 120,838 live triangles, 304 live chunks, exact runtime bounds, and 2,525 preferred collider meshes. It records 255/282 broad walk cells (90.43%), six authored spawn/walk/landing/stair probes, six elevation bands, and all 13 named stair/landing owners; 12 stair assemblies are mandatory activation gates. The separately pinned activation contract is checked before any manifest-v3 render package initializes. Missing, stale, or tampered evidence falls back to the monolith. A cheap flat collider plane cannot satisfy this gate.

### 15.2 Current first-floor pilot evidence

| Gate | Web | Quest |
|---|---:|---:|
| Packages | 25 | 25 |
| Expanded triangles | 2,489,874 | 1,239,891 |
| Draws | 1,087 | 1,080 |
| GLB bytes | 84,216,832 | 36,910,896 |
| Encoded texture bytes | 53,400,646 | 18,190,325 |
| Conservative GPU texture copies | 1,315,357,040 | 522,699,668 |

The independent package audit passes 4,637 assertions. The standalone payload gate passes all 50 real Web/Quest GLBs, including exact indexed-vertex bounds. `Fire`, `Verbindung West002.001`, and `Verbindung West.002` remain exactly once in the persistent critical package. Production activation is still blocked and no production package manifest has been emitted.

### 15.3 Final verification run

- `npm run build:building-viewer`: pass; full model, collision, regression, TypeScript, and Vite build gate.
- `npm run model:validate`: pass with zero warnings.
- Exterior and animated collision coverage: pass; animated required stair owners 13/13 and all listed primary tread samples 100% supported.
- Exact animated collision activation evidence: pass; coverage pin `a784df85...4baf81` / 7,111 bytes, contract pin `f73b3ef0...102cf` / 3,701 bytes, 255/282 broad cells, four qualifying activation bands, six probes, and 12/12 required stair assemblies.
- Character stair ascent/descent diagnostics, stair geometry, runtime stability, performance monitor, visual correctness, surface visibility, verified GLB, stream recovery, collision activation, shared texture residency, and instancing prerequisite tests: pass.
- Coalesced package audit: pass, 4,637 assertions; activation status remains blocked for the explicit reasons below.
- Offline stream-payload gate: pass, 50 real payloads plus the separate repeat-instancing parity artifact.
- Repeat instancing pilot: parity-safe and runtime-stable but still disabled; 61,269 unique / 4,778,982 expanded Web triangles and 52 projected spatial draws.
- Repeat LOD render audit: pass, 14 comparisons and zero failures.
- Local browser surface QA: pass, 13 exterior/interior views, no protected FrontSide violations, no unsafe active mirrored batches, WebGL error 0, and no page or console errors. Evidence: `tmp/qa-surface-visibility-final/report.json` and its PNG captures.
- Strict `npm run model:gate`: intentionally fails only the same four animated monolith limits: Web 13,585,615 triangles / 3,753 draws and Quest 6,107,774 triangles / 3,745 draws versus 2M/1,000 and 800k/1,000 ceilings.

### 15.4 Remaining blockers and next phases

These are asset/release tasks; they cannot be truthfully solved by another runtime toggle.

1. **DCC shell and ownership repartition.** Author visually approved Web and Quest opaque shells below 150k triangles. Select their structural source paths, remove those exact paths from every detail package, rebuild, and recompute complete disjoint ownership. Adding a shell over the current all-detail ownership would duplicate geometry.
2. **Released shared-texture strategy.** Externalize immutable SHA-named KTX2 content or use reviewed local atlases, then prove actual cross-package GPU reuse and peak transition residency. The analysis predicts large savings, but current self-contained package GLBs still duplicate texture content.
3. **Ground-floor ownership cleanup.** Reparent the six detached instanced fire-hose material batches to `Ground Floor._anim1` while preserving world transforms before Ground Floor packaging.
4. **Disabled release candidate.** Emit a disabled manifest-v3 candidate only after items 1-3. Keep the monolith as fallback and run full t=0/end animation, focus churn, cancellation, Fire/connector, surface, collision, stair, and memory QA.
5. **Isolated repeat-instancing candidate.** Rebuild the candidate without package-embedded animation and from the current production-profile transforms, then repeat Web/Quest image parity, picking/hide/isolate, animation, and hardware tests before any routing change.
6. **Real hardware acceptance.** Test the built candidate on desktop, mobile, and Quest with frame-time percentiles, GPU/CPU split, cold/warm load, peak memory, context loss, and a 10-15 minute Quest thermal soak.
7. **Expand owner by owner.** After the first-floor candidate passes, repeat the same contract for the remaining animation owners. Do not reactivate the historical 925-cell output.
8. **V-Ray/Cycles lighting phase.** Produce UV1, room/floor lightmap atlases, GI/shadow bakes, matched HDR/sun/exposure, and reflection-probe zones. Streaming must remain off for lightmapped layers until package-level lightmap integrity and ownership are pinned.
9. **Presentation effects last.** Add high-tier SSR/contact refinements only after the performance asset gate. Use Unreal Pixel Streaming only if literal Lumen/Nanite/VSM rendering is a product requirement.

No Git commit or production deployment was performed.

## 16. First-floor opaque-shell candidate update

The ownership-repartition step now has a concrete disabled candidate at `tmp/hlod-pilot-first-floor-shell-candidate/`:

- Web shell: 141 exact opaque structural paths, 112,809 triangles, 176 draws.
- Quest shell: 140 exact opaque structural paths, 84,594 triangles, 175 draws.
- Repartitioned detail ownership: 567 Web and 564 Quest paths.
- Shell and detail ownership are disjoint; their union exactly restores all 708 Web / 704 Quest paths, original ownership digests, 2,489,874 / 1,239,891 triangles, and 1,087 / 1,080 draws.
- The independent `--require-shell` audit passes 4,382 assertions with zero failures.
- Exact source-owner and shell review GLBs were rendered at seven identical 960 px cameras. Minimum source projection coverage is 89.40%, mean coverage is 92.61%, shell precision is at least 99.993%, and Web/Quest shell IoU is at least 99.610%.

This completes the mechanical shell selection, export, and ownership-repartition work without touching production assets. It does not complete architectural approval: projection evidence cannot distinguish intentional omitted furniture/transparency from every possible structural hole. `shellCompletion.ready` therefore remains `false`, and the candidate remains disabled. See `FIRST_FLOOR_OPAQUE_SHELL_CANDIDATE_REPORT_2026-08-28.md` for the full evidence and reproduction procedure.
