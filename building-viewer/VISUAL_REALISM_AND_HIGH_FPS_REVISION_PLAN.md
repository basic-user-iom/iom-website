# Building Viewer: Visual Realism and High-FPS Revision Plan

> **Implementation update — 28 August 2026:** This file remains the original audit baseline. See [IMPLEMENTATION_AND_REMAINING_WORK_REPORT_2026-08-28.md](./IMPLEMENTATION_AND_REMAINING_WORK_REPORT_2026-08-28.md) for completed ground, stair, texture-scale, exterior/interior surface, mirrored-batch, and asset-pipeline fixes; current measurements and QA evidence; the disabled animation-aware HLOD manifest-v3 pilot; and the remaining real HLOD, full-lightmap, and hardware-acceptance work.

**Audit date:** 15 August 2026  
**Project:** `F:\iom_website\building-viewer`  
**Document status:** Read-only technical audit and implementation plan  
**Change boundary:** No application code, GLB, configuration, build output, or deployment was changed as part of this audit.

## 1. Executive decision

The viewer has a sound Three.js foundation, but its main limitation is the content pipeline, especially the animated building. The recommended target is a **hybrid, locally rendered browser viewer**:

1. V-Ray- or Cycles-baked diffuse global illumination on a dedicated lightmap UV channel.
2. Correct glTF physically based materials, project-specific HDR lighting, and localized reflection probes.
3. A small, controlled amount of real-time lighting: one sun, cached/cascaded near shadows, contact shading, and optional desktop-only screen-space effects.
4. Offline-authored LOD/HLOD, true instancing, room/floor streaming, Meshopt geometry compression, and the existing KTX2 texture pipeline.
5. Separate **Explore**, **Photo**, and **VR** quality modes instead of trying to make one renderer configuration do everything.

This is the best route to V-Ray-like architectural presentation while retaining reliable browser and headset frame rates.

### Important technical boundary

Unreal Engine's Lumen, Nanite, and Virtual Shadow Maps cannot be copied into this Three.js/WebGL viewer as libraries or checkboxes. They depend on Unreal's renderer, data formats, GPU-driven geometry system, and platform-specific pipelines. Current browser WebGPU standardizes render and compute work, but not a portable hardware ray-tracing pipeline or acceleration-structure API.

The practical browser equivalents are:

- **Lumen:** baked view-independent GI/lightmaps, irradiance or spherical-harmonic probes, reflection probes, and limited screen-space GI/AO on high-end devices.
- **Nanite:** authored LODs, HLODs, mesh clustering, spatial streaming, occlusion/frustum culling, instancing, and Meshopt compression.
- **Unreal Virtual Shadow Maps:** baked static shadows plus cached local/cascaded dynamic sun shadows. Three.js `VSMShadowMap` means *Variance Shadow Maps* and is not Unreal Virtual Shadow Maps.
- **TSR/DLSS:** temporal anti-aliasing/upscaling or dynamic internal resolution, with ordinary SMAA/FXAA as lower-cost fallbacks.
- **Ray-traced reflections:** PMREM image-based lighting, localized probes, selective planar reflections, and restrained SSR where supported.

If literal Lumen, Nanite, Unreal VSM, and hardware ray tracing are mandatory, the alternative is **Unreal Pixel Streaming**: Unreal runs on a remote GPU and streams video to the browser over WebRTC. It can deliver the exact Unreal look, but introduces GPU-server cost, session concurrency limits, bandwidth requirements, latency, infrastructure, and operational complexity. Twinmotion Cloud follows this general streamed-application model.

## 2. Recommended product modes

| Mode | Purpose | Rendering strategy | Primary target |
|---|---|---|---|
| **Explore** | Default interactive architectural viewer | Baked GI, probes, limited dynamic shadows, stable AA, adaptive resolution, streamed LOD/HLOD | Desktop 60 FPS; mobile 30/45 FPS |
| **Photo** | Marketing stills and deliberate viewpoints | Higher internal resolution, GTAO/SSGI, selective SSR/planar reflections, better glass, optional progressive path tracing | High-end desktop; responsiveness may be lower |
| **VR** | Comfortable standalone or tethered viewing | Baked GI/probes, very limited dynamic shadows, aggressive LOD/culling, fixed foveation, stable resolution | Quest 72 Hz minimum |
| **Unreal Stream** *(optional)* | Exact Unreal/Lumen presentation | Remote Unreal renderer through Pixel Streaming | Managed GPU cloud/onsite servers |

The default experience should remain Explore. Photo mode must be opt-in, and its expensive features must never silently become the VR configuration.

## 3. What was audited

The review covered:

- Three.js renderer setup, quality switching, lighting, shadows, model loading, collision, LOD, batching/instancing, streaming, XR entry, and performance instrumentation.
- Original GLBs and all active Web, Quest, collision, animation, and generated-cell files.
- Direct GLB chunk/accessor/material/image analysis, expanded scene workload, topology, UVs, instances, animation constraints, texture use, and estimated GPU data.
- Read-only compilation and asset validation.
- A headless browser diagnostic for runtime counters and warnings. Headless timings were used to find stalls and failures, **not** as real-device FPS results.
- Official documentation for Unreal Engine, Three.js, WebGPU, Khronos glTF, Blender, Chaos V-Ray, Twinmotion, and D5 Render.

### Validation results

- Strict TypeScript check passed: `tsc --noEmit`.
- Current visual/collision validator passed with zero warnings.
- Current collision coverage validation passed for both production models.
- Those validators do not catch the most important current defects: expanded instance workload, pervasive double-sided materials, missing/broken UVs, excessive UV ranges, runtime LOD failures, cell quality, and animation-aware batching.

## 4. Current asset baseline

### 4.1 Source-to-production comparison

“Stored triangles” count unique mesh definitions. “Expanded scene triangles” and “primitive draws” include reuse of a mesh by multiple nodes and better represent the workload before runtime batching, shadow passes, and double-sided transparent passes.

#### ICM Exterior

| Profile | Transfer size | Nodes / mesh nodes | Meshes / primitives | Materials | Stored triangles | Expanded scene triangles | Primitive draws |
|---|---:|---:|---:|---:|---:|---:|---:|
| Original source | 66.38 MiB | 609 / 527 | 332 / 477 | 87 | 759,814 | 1,196,916 | 793 |
| Web | 31.44 MiB | 529 / 527 | 116 / 182 | 78 | 448,590 | 1,196,916 | 793 |
| Quest | 16.23 MiB | 529 / 527 | 116 / 182 | 78 | 310,563 | 743,927 | 793 |

The Web optimizer reduces transfer and unique storage, but does not reduce the exterior's expanded triangle or primitive-draw workload. Quest reduces expanded triangles by 37.8%, but leaves almost all draw submissions.

Estimated production GPU asset data, excluding framebuffers, shadow maps, environment maps, programs, BVH data, and transcoding peaks:

- Exterior Web: approximately 40.44 MiB textures + 17.88 MiB geometry = **58.32 MiB**.
- Exterior Quest: approximately 19.47 MiB textures + 9.23 MiB geometry = **28.70 MiB**.
- Exterior collision: approximately another 5.98 MiB geometry.

#### ICM Animated 2025

| Profile | Transfer size | Nodes / mesh nodes | Meshes / primitives | Materials | Stored triangles | Expanded scene triangles | Primitive draws |
|---|---:|---:|---:|---:|---:|---:|---:|
| Original source | 320.28 MiB | 8,140 / 7,885 | 4,274 / 7,050 | 422 | 7,419,074 | 13,657,202 | 14,687 |
| Web | 154.82 MiB | 7,982 / 7,885 | 1,839 / 2,980 | 350 | 3,612,168 | 13,657,202 | 14,687 |
| Quest | 83.27 MiB | 7,982 / 7,885 | 1,839 / 2,977 | 349 | 2,237,144 | 7,879,319 | 14,684 |

The animated Web report currently suggests 3.61 million triangles because it counts unique mesh storage. The expanded browser scene is actually about **13.66 million triangles and 14,687 primitive submissions** before shadows and transparent/double-sided extra passes. Quest remains about **7.88 million triangles and 14.7 thousand submissions**, far beyond a sensible standalone-VR starting point.

Estimated production GPU asset data:

- Animated Web: approximately 164.84 MiB textures + 107.84 MiB geometry = **272.68 MiB**.
- Animated Quest: approximately 74.61 MiB textures + 59.49 MiB geometry = **134.10 MiB**.
- Animated collision: approximately another 12.78 MiB geometry.

The source animated texture set would occupy roughly 1.45 GiB as base-level RGBA8 before mipmaps, so the existing KTX2 work is valuable and must be retained.

### 4.2 Runtime observations

- Current-source exterior High view submitted approximately 163–228 calls and 697,000–754,000 visible triangles at sampled viewpoints after runtime packing.
- A production-bundle animated diagnostic required roughly 209 seconds to load/preprocess in the headless environment and still captured about 5,357 calls and 27.25 million submitted triangles. The time is not a hardware benchmark, but a multi-minute synchronous preparation path is unacceptable.
- Runtime `DetailLOD` repeatedly fails while simplifying interleaved GLB attributes: `Cannot set properties of undefined (setting 'NaN')`. The diagnostic produced no usable geometry LODs.
- The generated public viewer bundle is older than the current TypeScript source, and the root application build does not invoke the viewer build.

### 4.3 Existing strengths to preserve

- sRGB output, AgX tone mapping, and PMREM-filtered HDR environment setup.
- Self-hosted KTX2, Draco, and Meshopt decoder configuration.
- Every shipped production texture is KTX2, with sensible Web and Quest maximum resolutions and mip chains.
- Tightened camera near/far planes, DPR caps, cached shadows, Quest framebuffer scaling/foveation, hidden-page render suspension, timer-query support, and region-based collision BVH.
- Exterior runtime batching already cuts a meaningful number of calls.
- Dedicated collision GLBs are texture-free and pass the current limits.

## 5. Confirmed issues and priorities

### P0 — Must be resolved before adding visual effects

#### P0.1 Rebuild the animated asset offline

The animated asset is the main performance blocker. Runtime traversal, cloning, simplification, and batching cannot turn a 13.66-million-triangle, 14.7-thousand-submission monolith into a reliable high-FPS browser/VR asset.

Required outcome:

- Separate static floor/room architecture from lightweight animated transform roots.
- Author LOD0/LOD1/LOD2 and HLOD meshes offline.
- Create animation-safe instancing/batches inside each of the five animated floor roots.
- Precompute spatial metadata, collision, visibility groups, and cell ownership.
- Ship a cheap always-resident building shell and load rooms/floors on demand.

#### P0.2 Remove runtime asset-building from the first interactive load

The current main-thread load path performs material preparation, visual collision extraction, non-indexed geometry copies, runtime instancing and BatchedMesh reconstruction, runtime LOD simplification, zone analysis, BVH-related work, and shader compilation.

Move these operations offline. Runtime should primarily download, decode, upload, attach precomputed metadata, and compile only the shader variants actually needed for the initial view.

#### P0.3 Replace broken runtime LOD generation

Most accessors in the GLBs are interleaved, and the current `SimplifyModifier` route fails on them. Even if deinterleaved, synchronous first-view simplification is the wrong production architecture.

Required outcome:

- Primary: offline-authored and visually reviewed LODs.
- Temporary fallback only: deinterleave, validate attributes, group by geometry UUID, simplify in a worker, and cache one result per unique geometry—not per mesh node.
- Validate matching attribute schemas before BatchedMesh construction.

#### P0.4 Establish trustworthy build and measurement gates

- The deployed/built viewer is stale relative to source.
- The root build does not build the viewer.
- README commands for viewer build/development and model import/validation/cells/collision are not defined in the available package scripts.
- Current triangle reports count unique mesh resources, not node-expanded scene work.
- The displayed “CPU” sample is frame interval, not measured JavaScript execution time; large stalls are also capped before being reported.

Before comparing visual changes, the build and metrics must be reproducible and trustworthy.

### P1 — Main realism and sustained-performance work

#### P1.1 Repair geometry, transforms, and topology in Blender/DCC

Source defects include:

- 1,499 exact zero-area exterior triangles and 18,334 animated triangles.
- Current production Web outputs still contain approximately 1,409 exterior and 17,169 animated degenerate or repeated-index triangles.
- 961 negative-determinant animated transforms, which complicate back-face culling and instancing.
- A container geometry spanning roughly 714,074 local units, corrected by node scale `0.00001`.
- Excessive tiny geometry: the animated source contains 131,238 triangles below `0.0001 m²` in local area.

Apply transforms, normalize units, resolve mirrored meshes, recalculate outside normals, remove duplicate/zero-area faces, delete hidden/internal construction geometry, and rebase the project near the building center.

#### P1.2 Correct UVs and create a dedicated lightmap channel

- Animated Web: 399 of 521 distinct UV0 accessors leave `[0,1]`, reaching about ±70,376.
- Exterior Web: 46 of 54 leave `[0,1]`, reaching about 16,053.
- Five exterior and fifteen animated textured primitives have no UV0 at all.
- Production files have no second UV set, although some source meshes contain secondary UVs that the optimizer prunes.

Large repeated UVs can be intentional, but these ranges indicate unresolved V-Ray real-world mapping or unapplied object scales and are hostile to precision and quantization.

Required outcome:

- Repair missing UV0 and visually validate every affected surface.
- Rebase/wrap tiling UVs to sane ranges and express repetition with `KHR_texture_transform` where possible.
- Create non-overlapping UV1 (`TEXCOORD_1`) for baked lighting, with sufficient chart padding and no mirrored/overlapping static-lighting islands.
- Preserve UV1 explicitly through optimization. Standard glTF PBR does not reference a lightmap texture, so the viewer pipeline must retain UV1 deliberately and bind the lightmap through project metadata/material setup.

#### P1.3 Rebuild V-Ray materials as efficient glTF PBR

All 78 exterior and all 350 animated Web materials are double-sided. This disables back-face culling, and transparent double-sided surfaces can require additional render passes.

Other material defects:

- Animated Web has only five normal-map slots and no AO maps across 350 materials; exterior has three normal maps, one metallic-roughness map, and no AO maps.
- No primitive includes tangents.
- Many normal, roughness, and other data maps originated as JPEG, so block/ringing artifacts are already baked into the source.
- Numerous nearly flat or untextured materials remain separate.
- Glass materials combine transmission, base alpha reduction, metallic values near 0.53, and double-sided rendering.
- Transmission is assigned to some ceramics, paint, ceiling lights, and raster materials where it is not physically justified.
- Cutout-like assets use blend behavior instead of cheaper, stable alpha masking.

Required outcome:

- Opaque architecture should be single-sided after normals and mirror transforms are fixed.
- Consolidate visually equivalent materials and use texture atlases only where they improve batching without destroying texel density.
- Base color/emissive are sRGB; normal, roughness, metallic, AO, and lightmaps remain linear data.
- Use OpenGL `+Y` normal maps, lossless source masters, and KTX2 UASTC for normals/lightmaps/high-value data.
- Pack AO/roughness/metallic consistently where useful.
- Generate MikkTSpace tangents only for meshes that actually use normal maps.
- Use `MASK` for foliage/grilles/fabric cutouts whenever possible; reserve `BLEND` for genuinely translucent surfaces.
- Glass should normally be metallic 0, have correct outward normals, and avoid overlapping/coplanar panes. Use a cheap opacity/reflection material on low tiers and selective physical transmission only for hero panes on Desktop High/Photo.

#### P1.4 Replace generic lighting with project lighting

The viewer currently uses the same generic 1K quarry HDR for daylight, overcast, and golden-hour presets, with one directional light plus hemisphere and ambient contributions. This is stable, but it produces a flat/washed architectural result and physically mismatched sun, sky, and reflections.

Required outcome:

- Use a project-specific, properly exposed HDRI or procedural sky per lighting scenario.
- Match sun direction, sky rotation, white balance, and exposure.
- Bake static indirect lighting and much of the static shadowing.
- Add localized room/exterior reflection probes rather than one global reflection environment for every surface.
- Reduce redundant ambient/hemisphere fill once baked GI and probes are active.
- Use selective near-camera dynamic shadows; do not rely on one 1024/2048 shadow map across an approximately 500 m scene.

#### P1.5 Make quality selection real and stable

The renderer's WebGL antialias context flag is chosen only at boot. Normal desktop boot detection chooses Balanced, not High, so selecting High later cannot enable context MSAA. All current post-processing switches are false.

Required outcome:

- Use runtime-controllable AA: SMAA or a validated temporal solution on higher tiers, FXAA/SMAA on lower tiers.
- Separate render quality from asset selection.
- Change resolution, shadows, effects, and LOD before considering a full Web/Quest model reload.
- Base adaptive quality on raw GPU/CPU percentiles with hysteresis and a multi-second cooldown, not short average-FPS changes every 250 ms.
- Do not automatically oscillate between complete asset variants.

#### P1.6 Replace the current cells instead of enabling them

The existing manifest correctly does not enable cell streaming. All 925 generated cells total 165.23 MiB and contain:

- 13,547,661 triangles and 27,863 primitives if all resident.
- Position attributes only—no normals, UVs, tangents, colors, textures, alpha, or physical material extensions.
- 5,664 repeated flat-material definitions.
- Seven cells above the declared 250,000-triangle limit; the largest is 699,426 triangles.
- Hundreds of very small files, creating excessive request overhead.
- About 110,191 dropped source triangles, potentially creating holes.
- Flattened transforms that break the five floor animations.

Do **not** activate these files. Rebuild streaming content as animation-aware floor/room HLOD packages preserving normals, UV0, selected UV1, required tangents, complete PBR material data, and shared texture references.

#### P1.7 Eliminate avoidable per-frame and startup work

- Duplicate-hiding logic traverses every mesh of non-exterior layers every frame even when state has not changed.
- Camera thumbnails are rendered and converted with `toDataURL` during startup, causing synchronous GPU readbacks.
- HDR loading is awaited before model-manifest loading.
- The Web/Quest switch can trigger long reload/preparation work.

Make visibility updates event-driven, render desktop orbit on demand while idle, lazy-generate/cache thumbnails after interaction is available, load environment and model concurrently, and support cancellation/generation tokens for superseded loads.

### P2 — Reliability, accessibility, and polish

- Request WebXR session while transient user activation is still valid; do not await a model-tier reload before `requestSession()`.
- Add context-loss/restore handling and a clear capability/fallback screen.
- Split actual CPU execution time from RAF frame interval in the telemetry and Quest harness.
- Time network fetch separately from GLB parsing/decompression/upload.
- Add VR teleport, comfort vignette, and locomotion options.
- Remove unused package coupling and make model-tool dependencies reproducible.
- Pin a supported KTX2 encoder/toolchain; the currently available encoder is not declared as a reproducible project dependency.

## 6. Asset-specific repair list

### 6.1 Animated building

| Hotspot | Current cost | Required repair |
|---|---:|---|
| `Mesh.13786` chair | 61,269 triangles × 78 = 4,778,982 expanded triangles | Retopologize to about 8–12K close, 2–4K medium, and 500–1,500 distant/Quest; instance inside each floor root |
| `Mesh.13787` light fixture | 1,559 instances × 3 primitives = 4,677 submissions | Merge compatible primitives/materials and instance per floor/cell; use emissive material without unnecessary transmission |
| `Mesh.13793` blinds | 1,176 submissions | Use repeated modules/instances, alpha mask where appropriate, and distance HLOD |
| `Mesh.8867` wardrobes | 13,668 triangles × 28 = 382,704 expanded triangles | Retopologize, instance, and author medium/far LODs |
| `Mesh.2505` chairs | 6,786 triangles × 48 = 325,728 expanded triangles | Instance and author lower LODs |
| `Decke_Raster001` ceiling | 136,536 triangles | Replace repetitive grid geometry with instanced modules, normal/opacity treatment, or a baked HLOD depending on close-view need |

Animation-safe opaque instancing with a minimum of five instances is estimated to reduce the animated primitive baseline from about 14,687 to roughly 5,058. Including carefully managed transparent batches could approach 4,085, but that is still too high for VR; HLOD, material consolidation, spatial residency, and visibility culling are also required.

### 6.2 Exterior

| Hotspot | Current cost | Required repair |
|---|---:|---|
| `Mesh.9507` | 50,048 triangles × 6 = 300,288 | Retopologize and instance |
| `Mesh.562` container | 41,372 triangles × 7 = 289,604; pathological source extent/scale | Apply transforms, normalize to meters, retopologize, instance |
| `Mesh.11896` | 2,204 triangles × 70 = 154,280 | True instancing and LOD/HLOD |

Opaque-only instancing opportunities suggest the exterior's 793 primitive baseline can approach about 208 before visibility and HLOD work.

### 6.3 Collision

Current collision complexity:

- Exterior: 145,003 stored / 177,649 expanded triangles and 147 mesh nodes.
- Animated: 395,271 stored / 626,660 expanded triangles and 3,428 mesh nodes.

Create authored proxies containing only floors, ramps, stair treads, important walls, and rail boundaries. Remove glazing, furniture, trims, lights, ceilings, decorative objects, unused normals/materials/extensions, and empty nodes.

Provisional targets:

- Exterior collision: below about 50,000 triangles.
- Full animated building collision: about 100,000–150,000 triangles, divided by floor/zone.

After coverage testing around stairs and floor transitions, stop merging visual geometry into collision (`collisionMergeVisual`) and load only the zone proxies required by the player.

## 7. V-Ray/Blender lighting pipeline

### 7.1 Authoring rules

1. Work in meters, near the project origin, with applied transforms.
2. Keep UV0 for material textures and create unique UV1 for static-lighting data.
3. Use chart padding that survives mipmapping; start with at least 8–16 final-texture pixels between important islands and validate at the lowest streamed mip.
4. Divide lightmaps by room/floor/HLOD zone. Avoid one enormous building atlas.
5. Use higher texel density only for hero interiors and close façades; large flat surfaces can use lower density and probes.
6. Keep a clean, linear source pipeline and tone-map only once in the viewer.

### 7.2 What to bake

Bake **view-independent diffuse lighting**:

- Indirect diffuse GI/color bleeding.
- Static emissive contribution where architecturally meaningful.
- Optional static direct-light/shadow contribution only when the sun/lighting scenario is fixed.
- A restrained AO or bent-normal term, preferably separate from albedo so it can be tuned.

Do not bake camera-dependent V-Ray beauty components such as sharp reflections, refraction, glossy highlights, exposure, bloom, depth of field, or tone mapping into a navigable PBR material. Those cues become incorrect as the camera moves.

### 7.3 Scenario strategy

Choose one of two production approaches:

- **Recommended:** one neutral daytime GI bake, with a matched dynamic sun/sky and probes. This minimizes download and transition cost.
- **Premium presets:** separate lightmap/probe packages for daylight, overcast, golden hour, and selected interior-night states. Stream only the selected scenario and crossfade carefully.

Do not use one lightmap to represent radically different sun directions.

### 7.4 Browser binding

glTF 2.0 has no core standardized lightmap binding. Preserve baked UV1 as `TEXCOORD_1`, then associate lightmap textures and intensity through a project manifest or material extras. In Three.js, bind them to the second UV channel with linear color-space treatment.

Recommended packaging:

- KTX2 UASTC for lightmaps, high-value normals, and clean gradient data.
- Full mip chains, edge dilation, and chart padding.
- Shared per-zone lightmap/probe resources, not copies inside hundreds of cell GLBs.
- Validate seams, leaks, fireflies, compression banding, and dark-corner crushing in the browser, not only in V-Ray/Blender.

### 7.5 Reflection and dynamic-light strategy

- Generate a project-specific PMREM global environment.
- Add localized room/floor/exterior probes and choose/blend them by zone.
- Reserve planar reflections for one or two hero mirrors/water planes.
- Use SSR only in Desktop High/Photo, with a fallback to probes.
- Use baked lighting for static architecture and light probes for moving/animated objects.
- Do not make thousands of emissive fixtures into real dynamic lights.

## 8. Geometry, packaging, and streaming pipeline

### 8.1 Offline export sequence

1. Validate meters, origin, transforms, mirrors, normals, manifold expectations, and animation roots.
2. Delete hidden construction geometry and merge only objects that share material, zone, lightmap, shadow, and animation ownership.
3. Retopologize hotspots and produce LOD0/LOD1/LOD2 plus HLOD shells.
4. Create true repeated assets for chairs, lights, blinds, wardrobes, doors, vents, and window modules.
5. Repair UV0 and create/preserve UV1.
6. Bake GI/AO/probes and validate the linear color workflow.
7. Convert and consolidate materials to glTF PBR.
8. Export animation roots separately from static floor/room packages where practical.
9. Apply vertex-cache/fetch optimization, quantization, and `EXT_meshopt_compression`.
10. Apply role-aware KTX2 compression and keep full mip chains.
11. Build animation-aware HLOD/cell packages and collision zones.
12. Run glTF validation plus project-specific expanded-workload and visual-contract checks.

### 8.2 Compression opportunity

A read-only in-memory Meshopt proof produced the following transfer reductions without writing files:

| Asset | Current | Meshopt proof | Reduction |
|---|---:|---:|---:|
| Exterior Web | 31.44 MiB | 17.49 MiB | 44.4% |
| Animated Web | 154.82 MiB | 75.61 MiB | 51.2% |
| Exterior Quest | 16.23 MiB | 9.78 MiB | 39.7% |
| Animated Quest | 83.27 MiB | 43.94 MiB | 47.2% |

The viewer already configures `MeshoptDecoder`; the missing part is a reproducible encoder stage. Compression improves download, storage, and often decode/upload behavior, but it does **not** by itself reduce draw calls or expanded triangles.

### 8.3 Streaming design

Use a hierarchy rather than a uniform grid of micro-files:

```text
Building
├─ Always-resident exterior HLOD shell
├─ Floor 01
│  ├─ Floor HLOD
│  ├─ Room/wing packages with LOD0 and LOD1
│  ├─ Static props/instances
│  └─ Collision proxy
├─ Floor 02 …
├─ Animated transform/object layer
└─ Shared textures, lightmaps, and reflection probes
```

Runtime requirements:

- Front-to-back/distance/portal priority queue.
- Roughly 3–6 concurrent requests after real network testing.
- Abort/cancel superseded requests.
- Resident byte, triangle, draw, and texture budgets.
- Hysteresis so cells do not flap at boundaries.
- A cheap fallback HLOD while a detailed room loads.
- Floor/room portal or potentially-visible-set culling for interiors.
- Texture/lightmap sharing across packages.
- Animation-root ownership preserved; animation must not globally disable streaming.

## 9. Renderer revision plan

### 9.1 Lighting

- Retain AgX and explicit color management.
- Replace the generic quarry HDR with project environments.
- Load environment and model in parallel; use a lightweight placeholder sky immediately.
- Match environment rotation to the sun.
- Introduce baked GI and zone probes before adding full-screen effects.
- Keep exposure calibrated per scenario, with a limited user range rather than arbitrary compensation.

### 9.2 Shadows

Desktop High:

- Baked static shadows/GI for most architecture.
- Two or three near-camera sun cascades or a tightly fitted local shadow region.
- Cached far shadow/HLOD contribution.
- Optional low-cost contact shadow/GTAO for grounding.

Balanced/mobile:

- One tightly fitted cached sun shadow, baked static shadowing elsewhere.
- Lower shadow-caster set and no transparent/glass casters unless essential.

Quest:

- Prefer baked shadows and lightmaps.
- At most one small, tightly bounded dynamic shadow region when demonstrably necessary.
- Shadow proxy geometry, no decorative micro-casters, and no expensive transparent shadows.

Increasing one whole-building shadow map to 4096/8192 is not a scalable solution; it increases memory/bandwidth while still wasting texels away from the camera.

### 9.3 Anti-aliasing and resolution

- Make High quality use a runtime AA method; the current immutable boot-time MSAA flag does not become active when High is selected later.
- Desktop High: validated temporal AA/upscaling or SMAA, depending on renderer branch and ghosting results.
- Balanced/mobile: SMAA or FXAA plus sensible DPR cap.
- Quest: headset-native MSAA/resolution strategy, fixed foveation, and conservative dynamic resolution.
- Drive resolution changes from GPU p95 with hysteresis, cooldown, and gradual scale steps.

### 9.4 Contact depth, reflections, and post-processing

Add in this order:

1. Correct geometry/materials and baked GI.
2. Project HDRI and local probes.
3. Stable AA.
4. Subtle GTAO/contact treatment on capable desktop devices.
5. Selective SSR or planar reflection only for materials that benefit.
6. Very restrained bloom only for true emissive sources.

Do not use strong SSAO, bloom, sharpening, or color grading to hide incorrect materials and lighting.

### 9.5 Glass

Use tiered glass:

- **Quest/mobile:** opaque or alpha-masked/reflection approximation; no transmission.
- **Balanced:** single-sided alpha/reflection material, minimal overlapping layers.
- **Desktop High:** selective physical transmission/refraction on hero panes only.
- **Photo:** higher-quality transmission and optional planar/SSR support where visually justified.

The current runtime deliberately strips glass transmission/normal/thickness data to avoid black panes. Keep that defensive path until the source glass normals, winding, thickness, coplanar layers, and material energy are corrected.

### 9.6 Optional WebGPU branch

Do not block the core asset/baked-lighting work on a renderer migration. After the WebGL path meets its targets, test a separate WebGPU branch for newer Three.js node-renderer features such as GTAO, SSGI, SSR, temporal upscaling, and compute-assisted work. Confirm browser coverage and fallback behavior before adopting it.

WebGPU alone does not create Lumen, Nanite, or hardware ray tracing.

## 10. Runtime and viewer engineering steps

### Phase 0 — Integrity and baseline

- Make one reproducible command build the current viewer output and make the root production build consume it.
- Define the currently documented model/viewer commands and pin all optimizer dependencies.
- Record source/output hashes and tool versions in each report.
- Report both unique/upload and node-expanded/submitted triangles and primitives.
- Add counts for double-sided, transparent, transmission, missing UV, excessive UV range, degenerate geometry, texture/GPU estimates, and collision/cell neighborhood cost.
- Measure raw RAF interval, actual main-thread execution, and GPU timer-query time separately.
- Capture fixed test viewpoints and golden images.

### Phase 1 — Asset correctness

- Perform the Blender/DCC cleanup and retopology in Section 6.
- Repair UV0 and material conversion.
- Create UV1 and V-Ray/Cycles GI bake tests for one representative exterior façade and one representative interior room.
- Approve visual and memory results before baking the whole building.

### Phase 2 — Offline optimization

- Generate reviewed LODs/HLODs and animation-safe instances/batches.
- Build authored collision zones.
- Add Meshopt encoding after geometry preparation and retain KTX2.
- Correct model reports and validation gates.
- Remove first-load simplification, batching, collision extraction, and large scene-analysis work after equivalent offline artifacts exist.

### Phase 3 — Lighting and material integration

- Bind UV1 lightmaps and zone probes.
- Add project environment/sun presets.
- Implement quality-tier shadows and glass.
- Add runtime AA, then subtle desktop contact/reflection effects.

### Phase 4 — Streaming and adaptive quality

- Replace the current 925-cell bake with floor/room HLOD packages.
- Add prioritized concurrent loading, cancellation, residency budgets, and HLOD fallback.
- Add event-driven visibility and interior portal/PVS behavior.
- Use dynamic resolution/lighting/LOD changes before any asset-tier reload.

### Phase 5 — XR and resilience

- Correct WebXR transient-activation ordering.
- Preload the VR asset tier before enabling entry where possible.
- Add context-loss recovery, capability diagnostics, comfort options, and long-duration headset tests.

### Phase 6 — Optional premium paths

- Evaluate WebGPU Photo features behind capability detection.
- Prototype Unreal Pixel Streaming only if exact Unreal rendering is a business requirement and its operating cost/concurrency model is acceptable.

## 11. Provisional performance budgets

These are project starting gates, not universal engine limits. Refine them after profiling the target devices and fixed routes.

| Target | Frame gate | Main-thread/GPU guidance | Visible draw target | Visible triangle target | Notes |
|---|---|---|---:|---:|---|
| Desktop High, 1440p | 60 FPS; p95 frame below 16.67 ms | Aim for CPU p95 ≤12 ms and GPU p95 ≤14–15 ms | ≤250 normal, ≤350 worst view | ≤1.5–2.0M | Effects must fit remaining GPU budget |
| Desktop Balanced | 60 FPS | Both p95 comfortably below 16.67 ms | ≤180–220 | ≤1.0M | Baked GI/probes; limited shadows |
| Mid-range mobile | 30/45 FPS | p95 below 30/21 ms respectively | ≤100–150 | 300–500K | No physical glass/SSR |
| Quest | 72 Hz minimum; 13.89 ms absolute frame | Engineer toward CPU/GPU p95 around 11–12 ms for safety | ≤100–150 per eye/worst stable view | roughly 0.5–0.8M per eye | Validate 15–30 minute thermal stability |

Additional starting gates:

- No first-interaction task over 50 ms; aim below 16 ms for normal tasks.
- No synchronous runtime simplification or full-scene batching on the first view.
- Initial exterior shell should become interactive before detailed rooms/animation finish loading.
- No GLB validation errors, runtime LOD errors, BatchedMesh schema errors, WebGL warnings, or missing texture/UV errors.
- Track peak GPU/resource memory, decode/transcode peak, and resident streaming budgets rather than file size alone.
- Use visual quality gates alongside FPS so adaptive resolution cannot silently make the result unacceptable.

## 12. Acceptance checklist

### Asset gates

- [ ] Units, origin, transforms, negative mirrors, winding, and normals validated.
- [ ] No known zero-area/repeated-index faces in production exports.
- [ ] All textured primitives have valid UV0.
- [ ] Tiling UVs are within an approved range or use texture transforms.
- [ ] Static lit meshes have non-overlapping UV1 with verified padding.
- [ ] UV1 survives the optimizer.
- [ ] Opaque materials are single-sided unless documented otherwise.
- [ ] Glass is metallic 0 unless a deliberate non-glass effect is documented.
- [ ] Cutouts use mask rather than blend where possible.
- [ ] Data maps come from clean linear/lossless masters.
- [ ] LOD transitions and HLOD silhouettes pass visual review.
- [ ] Expanded workload and instance counts are present in reports.
- [ ] Collision proxies pass stairs, ramps, rail, and floor-transition routes.

### Visual gates

- [ ] Browser golden images are compared with approved V-Ray reference views under matched camera, sun, exposure, and white balance.
- [ ] Neutral materials use a controlled albedo/roughness calibration chart.
- [ ] No lightmap seams, leaks, UV overlap, block artifacts, crushed corners, or double tone mapping.
- [ ] Glass has correct normals, energy, thickness behavior, and no black/coplanar artifacts.
- [ ] Sun, HDR reflection direction, and baked shadows agree.
- [ ] Interiors have contact depth without exaggerated AO halos.
- [ ] Photo effects do not contaminate Explore or VR tiers.

### Performance and reliability gates

- [ ] Cold and warm load measured separately.
- [ ] Fixed exterior overview/front/close routes pass budgets.
- [ ] Interior walk/collision route passes budgets.
- [ ] Animation-playing route passes budgets.
- [ ] Environment/shadow changes do not create long stalls.
- [ ] Real desktop, representative mobile, and real Quest results are recorded; headless FPS is not accepted as device evidence.
- [ ] Quest passes a 15–30 minute thermal/memory session.
- [ ] Rapid model/quality changes cancel obsolete work safely.
- [ ] Context loss and memory pressure recover or fail gracefully.
- [ ] WebXR entry works reliably from a user gesture.

## 13. Work that should not be done

- Do not enable the current 925 cell files.
- Do not try to solve the animated model solely with runtime traversal, simplification, or post-load BatchedMesh construction.
- Do not increase a whole-building shadow map to 8192 as the primary shadow strategy.
- Do not add heavy SSAO/SSR/bloom before fixing UVs, geometry, materials, GI, and environment lighting.
- Do not bake V-Ray reflections, refraction, exposure, bloom, or tone mapping into navigable base-color textures.
- Do not retain all materials as double-sided.
- Do not use JPEG masters for normal, roughness, metallic, AO, or lightmap data.
- Do not turn every emissive light fixture into a dynamic real-time light.
- Do not reload the complete Web/Quest asset because of a brief FPS fluctuation.
- Do not describe Three.js variance shadow maps as Unreal Virtual Shadow Maps.
- Do not claim Lumen, Nanite, DLSS, or hardware ray tracing unless the implementation truly uses those technologies through an appropriate renderer/streaming path.

## 14. Recommended delivery order

| Order | Deliverable | Why first | Expected effect |
|---:|---|---|---|
| 1 | Reproducible build, corrected metrics, fixed test cameras | Every later decision needs trustworthy evidence | Prevents false optimization claims |
| 2 | One exterior and one interior “golden slice” rebuilt in Blender and baked in V-Ray/Cycles | Proves the complete look/pipeline cheaply | Establishes visual target and lightmap budget |
| 3 | Chair, light, blind, wardrobe, container retopology/instancing | Largest known geometry/draw hotspots | Multi-million triangle and multi-thousand draw reduction |
| 4 | Full material/UV/transform cleanup | Enables culling, stable compression, correct PBR, and GI | Better realism and lower overdraw |
| 5 | Offline LOD/HLOD, collision, Meshopt, correct reports | Removes runtime build work | Faster load and stable runtime |
| 6 | Baked GI, probes, project HDRI, matched sun | Largest realism improvement | V-Ray-like indirect light at low frame cost |
| 7 | Runtime AA, tiered shadows/glass/contact/reflections | Adds polish after fundamentals are correct | Cleaner, grounded image |
| 8 | Floor/room streaming and portal/PVS culling | Required for full animated building/VR | Bounded memory and frame workload |
| 9 | Quest/XR acceptance and resilience | Confirms comfort and production safety | Stable 72 Hz and longer sessions |
| 10 | Optional WebGPU Photo or Unreal Pixel Streaming proof | Premium path, not a prerequisite | Higher ceiling for selected users |

## 15. Source and tooling references

The following are primary or official sources used to establish the technical recommendations.

### Unreal Engine

- [Lumen Global Illumination and Reflections](https://dev.epicgames.com/documentation/en-us/unreal-engine/lumen-global-illumination-and-reflections-in-unreal-engine)
- [Lumen Technical Details](https://dev.epicgames.com/documentation/en-us/unreal-engine/lumen-technical-details-in-unreal-engine)
- [Lumen Performance Guide](https://dev.epicgames.com/documentation/unreal-engine/lumen-performance-guide-for-unreal-engine?lang=en-US)
- [Nanite Virtualized Geometry](https://dev.epicgames.com/documentation/en-us/unreal-engine/nanite-virtualized-geometry-in-unreal-engine)
- [Nanite Technical Details](https://dev.epicgames.com/documentation/en-us/unreal-engine/nanite-technical-details)
- [Virtual Shadow Maps](https://dev.epicgames.com/documentation/en-us/unreal-engine/virtual-shadow-maps-in-unreal-engine)
- [Temporal Super Resolution](https://dev.epicgames.com/documentation/unreal-engine/temporal-super-resolution-in-unreal-engine)
- [Pixel Streaming Overview](https://dev.epicgames.com/documentation/unreal-engine/overview-of-pixel-streaming-in-unreal-engine?lang=en-US)

### Web platform and Three.js

- [W3C WebGPU specification](https://www.w3.org/TR/webgpu/)
- [WebGPU feature names](https://gpuweb.github.io/types/types/GPUFeatureName.html)
- [WebGL2 disjoint timer query](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/)
- [Three.js WebGPU renderer manual](https://threejs.org/manual/en/webgpurenderer)
- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [Three.js MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html)
- [Three.js MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html)
- [Three.js PMREMGenerator](https://threejs.org/docs/pages/PMREMGenerator.html)
- [Three.js color management](https://threejs.org/manual/en/color-management.html)
- [Three.js LightProbe](https://threejs.org/docs/pages/LightProbe.html)
- [Three.js shadow guide](https://threejs.org/manual/en/shadows.html)
- [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)
- [Three.js LOD](https://threejs.org/docs/pages/LOD.html)
- [Three.js KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html)
- [Three.js Cascaded Shadow Maps](https://threejs.org/docs/pages/CSM.html)
- [MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)

### Khronos glTF and optimization

- [glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator)
- [Khronos glTF Compressor](https://github.com/KhronosGroup/glTF-Compressor)
- [`KHR_texture_basisu`](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_texture_basisu/README.md)
- [`EXT_meshopt_compression`](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Vendor/EXT_meshopt_compression/README.md)
- [`EXT_mesh_gpu_instancing`](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Vendor/EXT_mesh_gpu_instancing/README.md)
- [Khronos real-time asset creation guidelines](https://github.com/KhronosGroup/3DC-Asset-Creation/blob/main/asset-creation-guidelines/RealtimeAssetCreationGuidelines.md)
- [Khronos glTF PBR reference](https://www.khronos.org/gltf/pbr)

### Blender and V-Ray

- [Blender glTF 2.0 import/export](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)
- [Blender Cycles baking](https://docs.blender.org/manual/en/latest/render/cycles/baking.html)
- [Chaos V-Ray Bake for Unreal](https://docs.chaos.com/display/VRAYUNREAL/V-Ray%2BBake)
- [Chaos V-Ray for 3ds Max texture baking](https://docs.chaos.com/display/VMAX/Texture%2BBaking)
- [Chaos V-Ray Bake Elements](https://docs.chaos.com/display/VMAX/Bake%2BElements)

### Twinmotion and D5 Render

- [Twinmotion Lumen overview](https://dev.epicgames.com/documentation/twinmotion/lumen-global-illumination-overview)
- [Optimizing models for Twinmotion real-time rendering](https://dev.epicgames.com/documentation/twinmotion/optimizing-3d-models-for-realtime-rendering-in-twinmotion?lang=en-US)
- [Twinmotion Cloud overview](https://dev.epicgames.com/documentation/twinmotion/an-overview-of-twinmotion-cloud?lang=en-US)
- [D5 Render global illumination](https://www.d5render.com/posts/d5-render-global-illumination)
- [D5 Render smoothness/performance](https://www.d5render.com/posts/d5-render-smoothness)
- [D5 Render DLSS 3.5 integration](https://www.d5render.com/posts/d5-render-integrates-dlss-3-5)

## 16. Final recommendation

Do not begin by adding more post-processing. First rebuild one representative exterior/interior slice and prove this chain end to end:

**clean Blender geometry → correct glTF PBR → UV1 → V-Ray/Cycles baked GI → offline LOD/instancing → Meshopt + KTX2 → project HDR/probes → measured browser result.**

Once that slice meets both the approved V-Ray reference and the frame/memory budget, apply the same controlled pipeline to the rest of the project. This produces a realistic, maintainable browser viewer without promising Unreal features that the local web renderer does not actually implement.
