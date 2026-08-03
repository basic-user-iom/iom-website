# IOM Automotive Studio — Product and Technical Plan

**Status:** Phase 0 A–F locked; Phase 1 foundation implemented (review pending)  
**Last updated:** 3 August 2026  
**Proposed public route:** `/demos/automotive-studio/`  
**Existing demo retained:** `/demos/volume-lighting/`  
**Planning asset:** `FREE_Lixiang_L9_2024_(White_Interior).glb`  
**Implementation status:** Phase 2 import/analysis/normalization in progress — Lixiang offline profile verified; vehicle import via Studio UI  
**Phase 0 notes:** `docs/automotive-studio-phase0.md`

---

## 1. Executive summary

IOM Automotive Studio should be built as a separate, modular product rather than as another layer of controls added to the existing Volume Lighting demo.

The product will have two connected experiences:

1. **Studio** — an authoring environment for importing, analysing, optimizing, rigging, animating, lighting, annotating, and presenting a vehicle.
2. **Presentation** — a polished, client-facing experience for guided or free exploration, with no developer controls or editing chrome.

The first reference asset is a 176.39 MiB animated Lixiang L9 GLB. It provides a realistic stress test for animation detection, model optimization, material fidelity, wheel rigging, large-file persistence, premium lighting, and client delivery.

The recommended solution includes:

- Automatic animation discovery and a generic clip player.
- Per-model semantic actions such as door opening, liftgate movement, and steering demonstrations.
- Correct physical scale, grounding, orientation, and vehicle role management.
- A non-destructive optimization pipeline with High and Mobile variants.
- An editable, distance-based vehicle route.
- Correct tire rolling derived from travelled distance and calibrated wheel radius.
- Studio, Day, Golden Hour, and Night environment modes.
- Premium hotspots containing mixed text, imagery, video, technical data, and animation actions.
- A synchronized presentation timeline and camera shot sequence.
- A portable `.iomcar` project package and local autosave.
- Explicit performance, compatibility, accessibility, security, and visual quality gates.

The existing Volume Lighting, Raven Path, Message in a Bottle, and Panorama/Viewer hotspot implementations are valuable references, but none should be copied wholesale. Their strongest concepts should be extracted into a cleaner architecture designed specifically for automotive presentation.

---

## 2. Recommended way to proceed

Proceed in controlled phases with a reviewable result at the end of each phase.

1. Approve this document and resolve the decisions in Section 22.
2. Establish the new Automotive Studio application shell and project schema.
3. Make the supplied Lixiang model import, analyse, animate, scale, and save correctly.
4. Build and visually validate optimized model variants and repair the wheel rig.
5. Add vehicle route motion, tire rotation, environment modes, and lighting polish.
6. Add premium hotspots and semantic animation actions.
7. Build the client presentation, shot sequence, and portable project workflow.
8. Complete performance, compatibility, security, licensing, and OEM-quality review.

Do not deploy an unfinished editor publicly. Each phase should be reviewed locally or on a controlled preview before the next phase begins.

---

## 3. Product goals

### 3.1 Primary goals

- Produce a presentation credible enough to share with automotive manufacturers and high-end enterprise clients.
- Accept animated GLB assets and clearly report what animation content was detected.
- Preserve source PBR materials, animation bindings, and semantic vehicle parts.
- Make physical model scale and download/GPU optimization understandable as separate workflows.
- Allow the vehicle to follow an editable ground route with believable steering and wheel rotation.
- Allow authors to build polished product stories using cameras, environments, hotspots, text, imagery, video, and mechanical actions.
- Provide a clean client mode that requires no technical knowledge.
- Remain reliable on a useful range of corporate desktop and mobile devices.
- Keep imported models and media local during authoring unless the user explicitly publishes them.

### 3.2 Secondary goals

- Support static props and stage objects alongside one Active Vehicle.
- Support authored runtime-quality profiles.
- Support reversible material or light overrides without mutating the source asset.
- Support guided presentations and free client exploration from the same project.
- Make the project format extensible for future configurators, variants, AR, or analytics.

### 3.3 Non-goals for the first release

- Full rigid-body vehicle physics or a driving game.
- General-purpose DCC modelling comparable to Blender or Maya.
- Automatic, perfect wheel rigging for every arbitrary vehicle model.
- Automatic legal clearance for vehicle brands, models, media, or HDR environments.
- Multi-user collaborative editing.
- Cloud asset processing by default.
- A complete material configurator unless separately approved.
- Public hosting of confidential OEM assets without access control.

---

## 4. Audit baseline

### 4.1 Existing Volume Lighting strengths

The current demo already provides a useful foundation:

- WebGPU/TSL volumetric lighting.
- Rect-area lights with shadow-casting spotlight proxies.
- GLB/GLTF/FBX import UI.
- Object hierarchy and contextual transforms.
- Transform gizmos.
- Camera view recording and playback.
- Project save/load.
- Adaptive mobile resolution and volumetric quality.
- A start gate and presentation poster.

### 4.2 Existing Volume Lighting gaps

- Imported GLB animation clips are discarded because only `gltf.scene` is retained.
- FBX animation arrays are also not retained.
- Single-file Blob loading cannot reliably resolve external `.gltf` buffers or textures.
- The project file embeds imported assets as base64 JSON, increasing their size by roughly one third and creating large memory spikes.
- The hard `navigator.gpu` gate prevents Three.js from attempting its WebGL2 backend fallback.
- Import/delete disposal does not comprehensively dispose textures and ImageBitmaps.
- The application is a large monolithic HTML file, which makes additional state ownership difficult to reason about.
- Camera views, project controls, object editing, and global scene controls are distributed across unrelated panels.
- The continuous turntable, future vehicle route, imported animation, and transform editing would compete for the same transforms.
- The checker floor and rotating RGB lights read as a technology demo rather than a premium automotive presentation.
- A bright environment background may be added twice by the normal and additive volumetric passes unless those scenes/layers are isolated.

### 4.3 Supplied Lixiang GLB profile

| Metric | Measured value |
|---|---:|
| File size | 184,955,864 bytes / 176.39 MiB |
| Nodes | 199 |
| Meshes/primitives | 132 / 132 |
| Vertices | 1,464,409 |
| Triangles | 1,928,682 |
| Materials | 37 |
| Textures/images | 15 / 15 |
| Embedded compressed image bytes | 108.81 MiB |
| Estimated RGBA8 texture memory with mipmaps | Approximately 947 MiB |
| Animation clips | 1 |
| Animation duration | 14.542 seconds |
| Animation channels | 16 |
| glTF material extensions | `KHR_materials_specular`, `KHR_materials_transmission` |
| Existing transport compression | None |

Texture profile:

- Eleven 4096 × 4096 PNG images.
- One 1024 × 1024 image.
- Three smaller images.
- Large normal, dashboard, suspension, seat, and interior maps dominate size.

Geometry profile:

- Logical geometry streams occupy approximately 67.45 MiB.
- Positions, normals, UVs, and tangents are primarily Float32.
- Tire-assigned geometry alone is approximately 600,000 triangles.
- The six largest material groups account for approximately 75.6% of triangles.
- All 37 materials are marked double-sided.
- Exact material deduplication can reduce 37 materials to approximately 26 before visual overrides.

Animation profile:

- The clip is named `Animation`.
- Four doors reach approximately 45 degrees at 4.959 seconds.
- Two generic rear body/liftgate-related nodes also animate.
- Two front wheel assemblies steer by approximately 15 degrees.
- Eight scale tracks are effectively constant and may be removable after validation.
- The full clip returns nearly to the bind pose at 14.542 seconds.

Wheel-rig profile:

- The two front wheel assemblies have individual steering roots.
- Tire/rim, suspension, and likely caliper geometry are mixed beneath those roots.
- The rear wheels are combined into one mesh with an unusable shared pivot.
- The asset cannot support mechanically correct four-wheel rolling without a one-time rig repair.

Scene-normalization profile:

- The outer Sketchfab root contains arbitrary rotation and translation.
- Separate Discord/logo promotional geometry distorts naive scene bounds.
- The car-aligned content measures approximately 132.551 × 46.443 × 56.910 asset units.
- Normalization must use a wrapper around the car branch and must not overwrite authored animation transforms.

### 4.4 Measured optimization proof of concept

A read-only in-memory dry run using the installed glTF Transform and Meshoptimizer libraries produced:

| Pipeline | Result |
|---|---:|
| Deduplication, pruning, animation resampling, quantization, Meshopt; textures unchanged | 120.67 MiB |
| Same pipeline with textures resized to a maximum of 2K PNG | 26.53 MiB |

No triangle simplification was applied in the 26.53 MiB result. This proves that a sub-30 MiB desktop presentation asset is plausible, but it is not yet a production artifact. It still contains 1.93 million triangles and approximately 243 MiB of decoded 2K texture memory with mipmaps.

### 4.5 Reuse decision

| Existing system | Reuse | Replace or redesign |
|---|---|---|
| Volume Lighting | Volumetric pipeline, light concepts, transform/outliner ideas, start gate | Monolithic UI, importer state, base64 projects, hard WebGPU gate, default art direction |
| Raven Path | Catmull-Rom route data, point editing concepts, JSON interoperability, offline glTF-Transform idea | Runtime `SimplifyModifier`, normalized route speed, Raven-specific pruning/material edits, one-clip UI |
| Message in a Bottle | Central environment state, time-of-day interpolation ideas, quality presets, coalesced slider updates | Ocean-specific sky/water shader, expensive star/cloud stack, lack of automotive IBL |
| 3D viewer hotspots | Content sanitation, URL validation, media handling, video overlay concepts, connector-line ideas | Window globals, localStorage-only state, developer floating panels, single-content-type cards, world-space video as default |

---

## 5. Product model and terminology

Clear terminology is necessary because several existing demos use the same words for different features.

### 5.1 Scene roles

- **Active Vehicle:** exactly one scene object receiving automotive controls.
- **Prop:** any additional imported stage or scene object.
- **Stage:** floor, backdrop, cyclorama, road, environment dome, and non-vehicle presentation geometry.
- **Environment:** visible sky/background plus image-based lighting and atmospheric state.
- **Accent Light Rig:** optional rect lights and volumetric effects layered over the base environment.

### 5.2 Motion terms

- **Embedded Animation:** clips contained in the imported model.
- **Semantic Action:** a named, stable action such as `front-left-door.toggle` built from one or more animation tracks or authored transforms.
- **Vehicle Route:** the ground path followed by the Active Vehicle.
- **Shot Sequence:** authored camera views and transitions.
- **Presentation Timeline:** the synchronized controller for vehicle, embedded clips, cameras, environments, and timed hotspot events.
- **Turntable:** idle rotation around the vehicle’s vertical axis.

### 5.3 Size terms

- **Physical Dimensions:** real-world length, width, height, scale, orientation, and grounding.
- **Download Size:** compressed network bytes.
- **Decoded/GPU Memory:** runtime texture and geometry memory.
- **Render Cost:** triangles, draw calls, transparency, shadows, volumetric work, and frame time.

The interface must never label all three of these as simply “size” or “quality.”

---

## 6. Users and primary workflows

### 6.1 Author / IOM Studio user

The author needs to:

1. Create or open a project.
2. Import a GLB as the Active Vehicle.
3. Review asset compatibility and warnings.
4. Set real-world dimensions, orientation, and ground contact.
5. Review detected animations and create semantic actions.
6. Confirm or repair wheel mappings.
7. Generate and compare optimized variants.
8. Design the vehicle route and speed profile.
9. Select environment and lighting presets.
10. Create camera shots and a sequence.
11. Place hotspots and compose text/image/video/action cards.
12. Preview Guided and Explore presentation modes.
13. Run preflight and export/publish.

### 6.2 Client reviewer

The reviewer should be able to:

- Start the experience quickly with clear loading progress.
- Watch a guided presentation or explore freely.
- Select elegant, understandable hotspots.
- Read product stories, inspect specifications, watch video, and trigger mechanisms.
- Switch among a small curated set of environments when allowed.
- Pause, resume, mute, enter fullscreen, and exit without confusion.
- Use mouse, keyboard, touch, or trackpad.
- Receive a fallback poster or video if full 3D is not available.

The reviewer should never see transform gizmos, raw node names, triangle counts, optimization warnings, or developer status text.

---

## 7. Experience modes

### 7.1 Studio mode

Full authoring controls are available. The UI shows dirty state, undo/redo, diagnostics, hierarchy, routes, hotspot anchors, safe frames, and preflight warnings.

### 7.2 Preview mode

The author sees the client experience without leaving the editor. Editing controls are hidden, but an obvious return control remains.

### 7.3 Guided Presentation

- The Shot Sequence controls the camera.
- Curated environment and action events can run on the Presentation Timeline.
- Hotspots may appear only at relevant moments.
- Manual orbit is locked unless a step explicitly releases it.
- Escape exits the presentation.

### 7.4 Explore Presentation

- The camera Shot Sequence is disabled.
- Orbit is enabled within curated limits.
- Approved hotspots and actions remain available.
- Technical and authoring controls remain hidden.

---

## 8. Recommended information architecture

### 8.1 Desktop shell

**Top bar**

- Project name and dirty state.
- Undo/Redo.
- Save.
- Runtime-quality selector.
- Preview.
- Present.
- Project menu and Help.

**Left scene rail**

- Vehicle.
- Route.
- Stage / Props.
- Environment.
- Accent Lights.
- Hotspots.
- Shots.
- Deliver.

**Center viewport**

- Orbit/select tools.
- One active transform gizmo.
- Object-relative camera shortcuts.
- Safe-frame and device-frame overlays.
- Route handles only in Route Edit.
- Hotspot anchors only in Hotspot Edit.
- Optional performance HUD in Diagnostics mode only.

**Right contextual inspector**

- Shows controls for the selected rail item or scene object.
- Advanced raw hierarchy is a disclosure, not the primary workflow.
- Every numeric control shows units and allows direct entry.

**Bottom transport/timeline**

- One global Play/Pause control.
- Current time and duration.
- Scrubber.
- Loop and playback speed.
- Vehicle route track.
- Embedded/semantic action track.
- Camera track.
- Environment track.
- Hotspot event track.

### 8.2 Tablet and mobile

- Compact top bar.
- Bottom transport.
- Inspector becomes a snap-point bottom sheet.
- Explicit View, Select, Route, and Hotspot authoring modes.
- Shot thumbnails become a horizontal carousel.
- Minimum 44 px touch targets.
- Large-model memory warnings before parsing.
- Heavy optimization tools live under Details and may be disabled on low-memory devices.
- Client Presentation remains fully supported even where full authoring is reduced.

---

## 9. System architecture

The application should use a command-driven project store and explicit service boundaries.

```text
Studio UI / Presentation UI
            |
         Commands
            |
      Versioned Project Store
       /       |        \
Asset Registry |      Undo/Redo
               |
        Global Transport
      /     /    |    \      \
 Route  Actions Shots Environment Hotspot Events
      \     |     |      |       /
        Scene Runtime / Renderer
               |
      Performance + Preflight
```

### 9.1 Core services

- **ProjectStore:** versioned state, commands, dirty state, undo/redo, transactions, migrations.
- **AssetManager:** import, loader configuration, object lifetime, disposal, fingerprints, and variants.
- **AssetAnalyzer:** dimensions, geometry, textures, materials, GPU estimates, animation, and wheel candidates.
- **VehicleAdapter:** Active Vehicle wrapper, coordinate normalization, grounding, semantic nodes, and rig metadata.
- **AnimationController:** mixers, clip validation, semantic actions, track ownership, scrubbing, and cleanup.
- **RouteController:** curve editing, distance sampling, speed profile, steering, and route persistence.
- **WheelController:** wheel mapping, radius calibration, steering/rolling layers, and distance-driven rotation.
- **EnvironmentController:** environment presets, IBL, sky, sun/moon/fill, fog, floor, exposure, and vehicle-light automation.
- **LightingController:** accent lights, volume pass, shadows, and quality adaptation.
- **ShotController:** object-relative cameras, camera interpolation, thumbnails, and follow modes.
- **HotspotController:** anchors, occlusion, layout, content cards, media, and declarative actions.
- **Transport:** one authoritative time source and conflict/ownership coordinator.
- **ProjectPackage:** IndexedDB persistence and `.iomcar` ZIP import/export.
- **Preflight:** asset, binding, media, performance, accessibility, and publishing validation.

### 9.2 Proposed source/build layout

The exact build integration should be confirmed in Phase 1, but the preferred layout is:

```text
automotive-studio/
  index.html
  src/
    main.ts
    app/
    assets/
    animation/
    route/
    vehicle/
    environment/
    lighting/
    hotspots/
    shots/
    persistence/
    presentation/
    ui/
    tests/
scripts/
  build-automotive-studio.mjs
  optimize-automotive-model.mjs
public/demos/automotive-studio/
  generated production output
```

The Automotive Studio bundle should pin one exact, tested Three.js release together with self-hosted Meshopt, Draco, and KTX2 decoder assets. It should not depend on multiple live CDN versions. If changing the site-wide Three.js package is risky, use a dedicated package alias/build entry instead of upgrading unrelated scenes implicitly.

WebGPU capability detection is only a routing decision, not proof of visual parity. The exact paint, transmission, shadow, volume, post-processing, and texture pipeline must be approved independently on the WebGPU and WebGL2 backends; unsupported effects degrade as a coherent quality tier, with poster/video fallback available.

Studio authoring and Presentation are separate entry points over the same versioned runtime and schema. Presentation must ship only the smaller curated runtime; it must not expose optimizer, hierarchy, source-file, or authoring code paths.

---

## 10. Feature specification — asset ingestion and analysis

### 10.1 Import choices

When a model is imported, ask:

- **Replace Active Vehicle** — default.
- **Add as Prop.**
- Cancel.

Do not use a sticky “remove car on next import” setting.

### 10.2 Supported formats

- Version 1 imports self-contained GLB as its supported production format.
- Standalone/multi-file glTF is deferred until ZIP/folder companion-resource resolution is implemented and tested.
- FBX is deferred from the new production workflow; a future convenience importer must convert and validate it as GLB before optimization, persistence, or publishing.

### 10.3 Compatibility report

After import, display:

- Filename, source byte size, and checksum.
- Detected dimensions and likely units.
- Nodes, meshes, primitives, vertices, triangles, and draw-call estimate.
- Material count and extensions.
- Texture count, resolution, compressed bytes, and estimated decoded/GPU memory.
- Transparency, transmission, double-sided materials, skins, morph targets, and instancing.
- Animation clips with name, duration, track count, and affected properties/nodes.
- Root-motion warning.
- Wheel candidates with confidence.
- Missing resource, duplicate-name, unsupported extension, or binding warnings.
- Optimizer compatibility and expected memory risk.

### 10.4 Loader configuration

The production GLTFLoader must support the chosen output formats:

- Meshopt decoder.
- KTX2 loader with runtime support detection.
- Draco decoder only if Draco outputs are approved.
- Central LoadingManager with byte/progress reporting.
- Abort/cancel where technically possible.

### 10.5 Asset lifetime

On replacement or deletion:

- Stop actions.
- Restore bind state where required.
- Uncache mixer actions, clips, and roots.
- Dispose geometry, materials, textures, render targets, and decoded image resources.
- Revoke object URLs.
- Remove asset blobs from temporary state only after transaction success.

---

## 11. Feature specification — physical dimensions and normalization

### 11.1 Coordinate layers

Keep separate transform layers:

```text
VehiclePlacementRoot       scene placement / route motion
  VehicleNormalizationRoot axes, source scale, grounding
    VehicleActionRoot      authored clips and semantic mechanisms
      VehicleModel         untouched imported hierarchy
```

Additional steering/rolling pivots are inserted at the appropriate wheel branches.

### 11.2 Controls

- Real-world target length, width, or height in metres.
- Uniform scale lock by default.
- Front-axis selector and 180-degree flip.
- Up-axis validation.
- Ground contact and offset.
- Primary car-content root selector.
- Exclude auxiliary/promo nodes from bounds.
- Reset normalization.

### 11.3 Rules

- Never bake user placement into animated source nodes.
- Never use the full scene Box3 blindly when auxiliary geometry exists.
- Store route coordinates in metres.
- Automatically scale detected wheel radius with vehicle scale.
- Warn when a manually entered physical wheel radius conflicts with a later scale change.

---

## 12. Feature specification — asset optimization

### 12.1 Three separate reports

The optimizer must report independently:

1. **Network:** GLB, geometry, texture, media, and decoder bytes.
2. **Memory:** decoded geometry, decoded textures/mipmaps, render targets, and rough total GPU estimate.
3. **Rendering:** triangles, draw calls, transparency, double-sided surfaces, shadow casters, and measured frame time.

### 12.2 Production pipeline

Build a configurable offline pipeline derived from the Raven glTF-Transform work, but designed for semantic automotive assets.

Safe initial operations:

- Inspect and validate.
- Remove proven no-op animation tracks.
- Deduplicate exact materials, textures, and accessors.
- Prune genuinely unused resources.
- Controlled animation resampling.
- Controlled quantization after paint/material/animation validation.
- Meshopt transport compression.
- Texture resizing by semantic slot and asset role.
- KTX2 ETC1S for appropriate colour maps.
- KTX2 UASTC for normals and data maps where quality requires it.

Operations requiring explicit per-model validation:

- Flattening or pruning named pivots.
- Joining meshes.
- Simplification.
- Backface-culling changes.
- Alpha/transmission changes.
- Normal/tangent changes.
- Removing badges, promo geometry, or credits.

### 12.3 Automotive-specific preservation manifest

Every production vehicle may define:

- Primary car root.
- Bounds exclusions.
- Nodes that must retain names and paths.
- Animated nodes.
- Selectable parts.
- Transparent/transmission meshes.
- Wheel/steering/brake groups.
- Mesh-specific simplification permissions.
- Texture-specific maximum sizes and codecs.
- Semantic actions and hotspot anchor targets.

Before optimization or hotspot authoring, inject durable IDs such as `extras.iomId` and map them to logical parts such as `vehicle.frontLeftDoor`. Three.js UUIDs, array positions, and names alone are not stable identities. Optimization may not flatten, prune, merge, or rename protected semantic targets without emitting an explicit remap table and passing orphan checks.

### 12.4 Runtime/browser optimizer

The first Studio release should expose analysis and a small set of already validated presets. It may later offer non-destructive optimization in a Web Worker:

- Operates on a copy.
- Pauses transport.
- Shows progress and estimated memory use.
- Supports cancel.
- Produces a side-by-side report and visual compare mode.
- Validates animations, semantic actions, wheel mappings, and hotspot anchors before activation.
- Allows Revert and Export optimized GLB.
- Warns or refuses when the browser lacks enough memory for a large source asset.

The offline Node/Blender-capable production pipeline must be deterministic and completed before using browser output for client deliverables. It records source/output hashes, tool versions, transform settings, Khronos validation, and before/after reference renders. A Worker avoids UI blocking but does not make a multi-gigabyte decode peak safe; memory preflight may require the author to use the offline process.

### 12.5 Proposed variants

Final values should be based on visual profiling, but begin with:

| Variant | Intended use | Preliminary target |
|---|---|---:|
| Master | Local authoring/reference | Original fidelity; not publicly served by default |
| Presentation High | Desktop guided/explore | Target ≤30 MiB; optional approved hero tier may reach 35 MiB |
| Balanced | Integrated and lower-power desktop/tablet | Approximately 15–25 MiB |
| Mobile | Phone/fallback interactive | Approximately 8–15 MiB, aggressive selective LOD |

Do not promise a target solely from file size. A variant is accepted only if material, animation, rig, memory, and frame-time gates also pass.

---

## 13. Feature specification — embedded animation and semantic actions

### 13.1 Generic animation discovery

For every imported model:

- Retain `gltf.animations` or FBX animation arrays.
- Reset duration and validate every clip.
- Reject or flag empty, non-finite, or near-zero-duration clips.
- Display name, duration, track count, and affected nodes/properties.
- Do not autoplay the first clip.
- Create one AnimationMixer per independently animated asset root.

### 13.2 Player controls

- Clip selector.
- Play/Pause/Stop.
- Scrub.
- Speed.
- Loop once, repeat, or ping-pong.
- Reverse where supported.
- Fade/crossfade.
- Restore bind pose.
- Affected-node details in Advanced.

### 13.3 Semantic action registry

Hotspots and guided presentations must not reference raw clip-array indexes. They reference stable action IDs.

Example actions:

- `vehicle.showcase.play`
- `door.front-left.toggle`
- `door.front-right.toggle`
- `doors.all.toggle`
- `liftgate.toggle`
- `steering.demo`
- `vehicle.reset-mechanisms`

A semantic action may contain:

- A source clip.
- A time range.
- A filtered set of tracks.
- Playback direction.
- Loop mode.
- Fade duration.
- Preconditions.
- Completion behaviour.
- Reverse/close action.

### 13.4 Lixiang action preparation

The Lixiang’s one monolithic clip should remain available as “Showcase animation.” After visual confirmation, filtered sub-actions can be created for doors, rear body/liftgate parts, and steering.

Important rules:

- Use Three.js track-name parsing rather than splitting track names naively on dots.
- Confirm the two generic `Plane.*` targets visually before naming them.
- Validate track filtering after every optimized variant is generated.
- Remove no-op scale tracks only after before/after animation comparison.

---

## 14. Feature specification — wheel rig and tire animation

### 14.1 Generic wheel detection

Detection may suggest candidates using:

- Node and material names.
- Disk-like geometry bounds.
- Smallest local extent as axle hypothesis.
- Position relative to the vehicle bounds.
- Pivot-to-geometry-centre distance.
- Left/right and front/rear clustering.

Detection is advisory. The author confirms FL, FR, RL, and RR, axle, radius, steering role, and rotating/static children.

### 14.2 Wheel transform layers

```text
SteeringPivot      authored steering or route steering
  RollingPivot     procedural tire/rim rotation
    TireAndRim
  StaticBrakeGroup caliper/suspension; does not roll
```

### 14.3 Lixiang wheel repair

- Preserve the two authored front steering roots.
- Insert nested rolling pivots for front tire/rim geometry.
- Separate caliper/suspension geometry from rolling geometry.
- Split combined rear-wheel geometry into independent left and right assemblies.
- Centre rear rolling pivots.
- Calibrate radius and rolling axis.
- Confirm forward/reverse sign.
- Persist the mapping in the vehicle rig manifest.

### 14.4 Route-linked rotation

Wheel rotation is derived from physical distance:

```text
wheelAngle += signedDistanceTravelled / scaledWheelRadius
```

This ensures:

- Wheels stop when the car stops.
- Wheels reverse when the car reverses.
- Route length does not alter implied speed.
- Scale changes remain coherent.

Curvature-based steering affects front SteeringPivots while RollingPivots continue to rotate independently.

---

## 15. Feature specification — vehicle route

### 15.1 Curve foundation

- Centripetal `CatmullRomCurve3`.
- Open or closed route.
- Ground-plane XZ editing by default.
- Optional controlled elevation only if explicitly enabled.
- Arc-length/distance sampling.
- Versioned JSON import/export inside the project format.

### 15.2 Editing

- Add, insert, remove, duplicate, and reset points.
- Drag points with TransformControls.
- One active point/gizmo.
- Snap to ground/stage.
- Route origin and orientation.
- Route width and optional centreline preview.
- Undo/redo for every point and path operation.
- Hide handles outside Route Edit.

### 15.3 Motion

- Speed in km/h and m/s.
- Acceleration and braking.
- Start/end hold.
- Loop, once, reverse, and ping-pong where appropriate.
- Curvature/lookahead steering.
- Maximum steering clamp.
- Curvature warnings for implausibly tight turns.
- Reset to start.
- Deterministic playback from the global Transport.

No physics engine is required for the first release. A deterministic cinematic controller is more reliable for authored presentations.

---

## 16. Feature specification — environment, day/night, and lighting

### 16.1 Authored environment modes

Primary client controls:

- Studio.
- Day.
- Golden Hour.
- Night.
- Custom when the author changes advanced values.

Advanced controls may include:

- Time of day.
- Sun direction/elevation.
- Environment rotation and intensity.
- Background intensity/blurriness.
- Haze/fog.
- Exposure.
- Automatic vehicle lights.

Moon bearing and phase should not be primary automotive controls unless they materially improve an approved scene.

### 16.2 Rendering approach

- Use the tested Three.js SkyMesh for procedural Day/Golden Hour when appropriate.
- Use licensed, locally hosted HDR/UltraHDR environments for stable automotive reflections, especially Studio and Night.
- Use coherent image-based lighting for paint, chrome, glass, transmission, and clearcoat.
- Use a focused directional sun with bounded shadow maps.
- Use one environment state to coordinate sky, IBL, sun/moon/fill, floor, fog, exposure, and optional headlights.
- Rebuild procedural PMREM only after slider release/debounce or use precomputed authored presets.
- Do not regenerate PMREM every frame.

### 16.3 Volumetric integration

- Keep the existing quarter-resolution volumetric pass as the baseline.
- Retain desktop/mobile raymarch step differences after profiling.
- Treat the existing rect lights as an optional Accent Light Rig.
- Do not add a second expensive volumetric cloud system by default.
- Keep visible HDR/sky geometry out of the volumetric layer or render the volume in a separate black-background scene to prevent double-added backgrounds.

### 16.4 Automotive art direction

- Premium neutral stage by default.
- Seamless floor/cyclorama or a curated exterior stage.
- Strong, stable reflection shapes.
- Subtle contact shadows.
- Controlled panel gaps, glass, chrome, paint, lamp, badge, and interior readability.
- Restrained accent colours.
- No default checkerboard or constantly rotating RGB-light show.
- No abrupt exposure changes between modes.
- Neutral tone mapping initially; any ACES/AgX change requires paint-colour validation.

---

## 17. Feature specification — premium hotspots

### 17.1 Product requirement

Hotspots are first-class story and interaction objects. They are not simple floating text labels.

Every hotspot has:

1. A 3D anchor.
2. A presentation marker.
3. A mixed-content client card.
4. Zero or more declarative actions.
5. Presentation rules for activation, visibility, occlusion, close behaviour, and guided-tour membership.

Hotspots, media, semantic actions, shots, environments, and vehicle parts use stable project IDs. A hotspot must never bind an animation by clip-array index or depend only on a mutable Three.js UUID.

### 17.2 Authoring flow

1. Enter Hotspot Edit.
2. Select Add Hotspot.
3. Click a vehicle or stage surface.
4. Store the owning semantic node, local position, and local normal.
5. Choose marker style and short label.
6. Compose card blocks.
7. Add actions from validated dropdowns.
8. Choose presentation visibility and close behaviour.
9. Preview in Guided and Explore modes.
10. Run hotspot preflight.

The Hotspot inspector has four focused tabs: **Content**, **Actions**, **Appearance**, and **Rules**. Authors can select, rename, duplicate, reorder, hide, lock, re-anchor, and delete hotspots, with every destructive or positional edit covered by undo/redo.

Supported activation patterns are:

- Open the card.
- Run an action.
- Open the card and run an action together.
- Run an action, then open the card.
- Open the card first and expose explicit action buttons.

### 17.3 Anchoring

Store:

- Asset fingerprint.
- Semantic node ID.
- Fallback node path/name.
- Local position.
- Local surface normal.
- Optional offset.
- Fallback normalized vehicle coordinate.

The hotspot therefore follows:

- Vehicle route motion.
- Vehicle scale and placement.
- Door/liftgate animation when attached to that part.
- Optimized variants after binding validation.

If an optimized variant loses or changes the anchor node, activation must be blocked until the author remaps or accepts a fallback.

Anchor resolution order is:

1. Exact stable semantic node ID.
2. Optimizer-preserved manifest mapping.
3. Verified node path/name plus structural fingerprint.
4. Manual rebind.

Low-confidence matches enter an explicit **Needs rebind** state; they do not silently attach to the vehicle root. The first release guarantees anchors on rigid automotive parts. Anchoring to deforming skinned surfaces is out of scope until a bone or barycentric attachment strategy is separately implemented and tested.

### 17.4 Marker presentation

- Minimal dot, number, or custom approved icon.
- Project-level theme and accent colour.
- Optional short label and connector line.
- Camera-aware screen-size clamp.
- Surface offset to prevent z-fighting.
- Occlusion detection against the vehicle/stage.
- Hide or soften markers on the far side of the car.
- Use occlusion hysteresis to prevent flicker at silhouette edges.
- Offer Normal, Glass-aware, and approved per-shot visibility modes for interior features.
- Edge-safe projected placement.
- Collision/clustering strategy for dense views.
- Click/tap as the primary activation.
- Hover/focus may reveal the short label but must not be required.
- Reduced-motion support disables unnecessary pulsing.
- A keyboard-accessible **Features** index mirrors every published hotspot so clients do not have to discover features spatially.

### 17.5 Client card content

Cards support ordered blocks, allowing text and media in the same hotspot:

- Eyebrow/category.
- Title.
- Rich text or sanitized Markdown/HTML subset.
- Image.
- Image gallery.
- Locally hosted video.
- Optional YouTube/Vimeo embed.
- Specification table.
- Quote or feature highlight.
- CTA button or safe external link.
- Action buttons.

Recommended templates:

- Feature Story.
- Cinematic Film.
- Interactive Mechanism.
- Technical Specification.

Full content cards should be screen-space DOM overlays for readability, accessibility, responsive layout, and reliable video. The 3D scene should retain only the marker, short label, and optional connector.

Project-level design tokens control typography, colour, spacing, radius, shadow, marker, and accent treatment. Authors receive curated template choices rather than unrestricted per-card styling. Desktop uses an edge-safe floating card; narrow screens use an accessible bottom sheet.

### 17.6 Video requirements

- Prefer locally hosted MP4/H.264 with a poster; add WebM/modern sources where beneficial.
- Lazy-load video only when needed.
- `playsinline` on mobile.
- User controls and accessible labels.
- Captions/subtitles for client-facing deliverables.
- Muted autoplay only after an explicit user action; never surprise the user with audio.
- Pause and unload media when the card closes unless the project explicitly keeps it alive.
- External embeds use privacy-enhanced URLs where possible and display a reliable fallback.
- A presentation should not depend exclusively on a third-party video provider that a corporate firewall may block.
- External providers are opt-in and load only after the required consent or client gesture.
- Closing, deleting, or replacing a project must stop playback and release media elements, object URLs, and event listeners.

### 17.7 Hotspot actions

Supported declarative action types:

- `card.open` / `card.close`.
- `action.play` / `action.reverse` / `action.toggle`.
- `clip.playSegment` for approved advanced use.
- `shot.goTo`.
- `environment.setPreset`.
- `vehicleLights.set`.
- `timeline.playSequence`.
- `link.open`.

Example:

```text
Executive Interior hotspot
  1. Pause vehicle route and settle to zero speed.
  2. Move to Interior Front 3/4 shot.
  3. Toggle front-left door action.
  4. Open a card with feature text, image, and video.
```

### 17.8 Hotspot conflict rules

- A mechanical door/liftgate action pauses route motion first by default.
- Only one action owner may write a given node/property at a time.
- Repeated clicks cannot stack conflicting actions.
- Toggle actions are reversible and idempotent.
- The author chooses one explicit close policy: keep current state, reverse the hotspot action, or run a named close sequence.
- Playing video may pause camera and vehicle tracks while keeping the current mechanism pose.
- Guided steps may reveal, focus, open, or hide hotspots through timeline events.
- Explore mode shows only hotspots approved for Explore.
- Missing media, unsafe links, broken anchors, or broken action references fail preflight.

### 17.9 Content security

- Sanitize authored/imported rich content.
- Allow only a documented HTML/Markdown subset.
- Validate `http`/`https` URLs.
- Reject scriptable URL protocols and credentials in URLs.
- Sandbox allowed iframes.
- Restrict external media to approved provider/domain allowlists.
- Escape embedded project JSON safely.
- Do not allow arbitrary JavaScript actions from hotspot data.
- Use Content Security Policy appropriate for local and published media.
- Keep analytics and external tracking disabled by default.

---

## 18. Feature specification — shots, timeline, and presentation

### 18.1 Standard automotive shots

Provide object-relative presets:

- Front.
- Rear.
- Left.
- Right.
- Front 3/4.
- Rear 3/4.
- Top.
- Interior when a suitable target is available.

### 18.2 Authored shots

Each shot stores:

- Name and thumbnail.
- Camera position/orientation or orbit target.
- Lens/FOV.
- Transition duration.
- Hold duration.
- Easing.
- Environment override when approved.
- Hotspot visibility group.
- Optional action/timeline events.

Shots can be reordered. Playback is render-loop driven, cancellable, deterministic, and synchronized with the global Transport.

For the first release, this is a declarative sequence editor rather than a general nonlinear animation tool. Authors arrange typed steps—shot, semantic action, environment, card, media, wait, and route control—with duration, cancellation, and ownership rules. Arbitrary keyframe curves and unrestricted track editing remain out of scope.

### 18.3 Camera conflicts

- Shot Sequence and follow camera are mutually exclusive camera owners.
- Manual orbit in Studio/Preview releases only the camera track and labels the state “Free camera.”
- Vehicle/action/environment tracks may continue when the camera is released.
- Guided Presentation owns the camera unless a step explicitly enables exploration.
- Explore Presentation disables the camera track.

### 18.4 Presentation controls

Client controls remain minimal:

- Play/Pause.
- Progress or shot dots when useful.
- Mute.
- Fullscreen.
- Optional approved environment selector.
- Info/credits.
- Exit.

Presentation preflight compiles shaders, confirms assets, validates actions and hotspots, checks media, and selects a runtime profile before revealing the scene.

---

## 19. Interaction and state ownership rules

| Area | Rule |
|---|---|
| Root motion | Static, Turntable, Vehicle Route, and Embedded Root Motion are mutually exclusive vehicle-root owners. |
| Embedded mechanisms | Door/interior actions may layer over route motion only when their safety policy permits it. |
| Door/liftgate hotspots | Pause/settle route by default before playing. |
| Wheel rotation | Each wheel has one rolling driver: Route Distance, Embedded Clip, or Off. |
| Steering | Authored steering and route steering require an explicit ownership policy; do not sum blindly. |
| Scale changes | Routes remain in metres; auto wheel radii scale, manual radii warn. |
| Transform editing | Starting a gizmo or route/hotspot-anchor edit pauses Transport. |
| Route editing | Handles are visible only in Route Edit. |
| Hotspot editing | Anchors and safe-area previews are visible only in Hotspot Edit. |
| Camera playback | Manual orbit releases the camera track, not necessarily the entire Transport. |
| Video | May pause camera/vehicle tracks; audio remains user-controlled. |
| Environment presets | One coherent state updates sky, IBL, lighting, floor, fog, exposure, and automatic lights. |
| Manual look edits | Change the active preset label to Custom. |
| Vehicle replacement | Preserve stage, route, environment, shots, and hotspot content; clear/revalidate vehicle-specific bindings and offer Undo. |
| Optimized variant activation | Block on failed animation, rig, semantic-action, or hotspot-anchor validation. |
| Project loading | Validate into temporary state, then apply atomically. Failure must not half-clear the current project. |
| Presentation | Hides authoring helpers and enforces Guided or Explore ownership rules. |

---

## 20. Persistence and project format

### 20.1 Local persistence

- IndexedDB for project metadata and binary asset blobs.
- Debounced autosave.
- Crash-recovery snapshot.
- Dirty-state indicator.
- Explicit Save command.
- Undo/redo command history.
- Never place large model/video blobs in localStorage.

### 20.2 Portable `.iomcar` package

Use a ZIP container rather than base64 JSON.

```text
project.iomcar
  manifest.json
  assets/
    models/
      vehicle-high.glb
      vehicle-mobile.glb
    environments/
    images/
    videos/
    captions/
  thumbnails/
  license/
```

The manifest contains:

- Schema and application version.
- Asset checksums and roles.
- Active Vehicle normalization and dimensions.
- Optimization variants.
- Rig manifest and wheel bindings.
- Clip metadata and semantic actions.
- Route and speed profile.
- Environment, lighting, fog, exposure, and vehicle-light state.
- Shots and Presentation Timeline.
- Hotspot anchors, content blocks, actions, visibility, and theme.
- Presentation/runtime settings.
- Credits and licence metadata.

Packaging rules:

- Stream large entries where the selected library/platform supports it; do not require the whole archive and all expanded assets in memory at once.
- Store already-compressed GLB, KTX2, video, and image entries without redundant ZIP recompression.
- Deduplicate binary media by content hash.
- Enforce entry-count, compressed-size, expanded-size, MIME/type, and path-traversal limits before extraction.
- Preserve source URL, licence snapshot/reference, acquisition date, rights notes, and content hash for every third-party production asset.
- Consider a directory/File System Access workspace for heavy local authoring, while retaining `.iomcar` as the portable interchange format.

### 20.3 Project loading

- Validate archive structure and schema.
- Validate checksums.
- Validate referenced assets before changing the live scene.
- Migrate older schema versions.
- Resolve action, shot, node, and hotspot bindings.
- Apply the new project as one transaction.
- Preserve the previous project if validation fails.

### 20.4 Publishing

Publishing is distinct from saving an authoring project.

- Build a separate, immutable Presentation revision from the Studio project and retain its project/runtime/asset hashes.
- Export only approved runtime variants and media.
- Exclude the local Master asset unless explicitly permitted.
- Create a presentation manifest.
- Precompile or warm critical shaders where possible.
- Generate poster and fallback video/image.
- Include accessible credits/info.
- Choose public, unlisted, or access-controlled hosting deliberately.
- Decide per revision whether client links are public, authenticated, expiring, and/or permitted to be embedded on an allowlisted origin.
- An unlisted static URL is not secure for confidential OEM assets.
- Do not reuse a client-side/sessionStorage access code as security; protected presentations require real server/edge authorization.
- Retain the last known-good Presentation revision for rollback.

---

## 21. Data model sketch

This is a planning model, not a frozen implementation contract.

```ts
interface AutomotiveProject {
  schemaVersion: number
  id: string
  name: string
  assets: AssetRecord[]
  activeVehicleId: string | null
  stage: StageState
  vehicle: VehicleState | null
  route: VehicleRoute | null
  environment: EnvironmentState
  accentLights: AccentLightState
  shots: Shot[]
  timeline: TimelineState
  hotspots: Hotspot[]
  presentation: PresentationSettings
  credits: CreditRecord[]
}

interface VehicleRigManifest {
  assetFingerprint: string
  primaryRoot: SemanticNodeRef
  boundsExclusions: SemanticNodeRef[]
  forwardAxis: string
  upAxis: string
  wheels: WheelBinding[]
  semanticActions: SemanticAction[]
  preservedNodes: SemanticNodeRef[]
}

interface SemanticAction {
  id: string
  label: string
  sourceClipId?: string
  timeRange?: [number, number]
  trackFilter?: SemanticNodeRef[]
  mode: 'play' | 'toggle' | 'momentary'
  preconditions?: ActionPrecondition[]
  reverseActionId?: string
}

interface Hotspot {
  id: string
  name: string
  anchor: HotspotAnchor
  marker: HotspotMarkerStyle
  card: HotspotCard
  triggers: HotspotTrigger[]
  visibility: HotspotVisibility
}

interface HotspotAnchor {
  assetFingerprint: string
  node: SemanticNodeRef
  localPosition: [number, number, number]
  localNormal: [number, number, number]
  offset: number
  fallbackVehicleCoordinate?: [number, number, number]
}

interface HotspotCard {
  template: 'feature' | 'film' | 'mechanism' | 'specification' | 'custom'
  blocks: HotspotContentBlock[]
  themeId: string
  closeBehavior: 'keep-state' | 'reverse-actions' | 'reset-sequence'
}

type HotspotAction =
  | { type: 'action.toggle'; actionId: string }
  | { type: 'action.play'; actionId: string }
  | { type: 'shot.goTo'; shotId: string }
  | { type: 'environment.setPreset'; presetId: string }
  | { type: 'timeline.playSequence'; sequenceId: string }
  | { type: 'link.open'; url: string }
```

---

## 22. Decisions required before implementation

### 22.1 Recommended defaults

| Decision | Recommendation |
|---|---|
| Product route | `/demos/automotive-studio/` |
| Existing Volume Lighting | Keep unchanged |
| Primary authoring format | GLB |
| Active scene roles | One Active Vehicle plus optional Props |
| Default presentation look | Premium neutral Studio |
| Environment modes | Studio, Day, Golden Hour, Night |
| Hotspot activation | Click/tap; hover/focus reveals label only |
| Hotspot cards | Mixed block content, screen-space overlay |
| Video | Self-hosted first; external embeds optional |
| Optimization order | Offline production pipeline first; browser worker second |
| Wheel solution | One-time professional Lixiang rig repair plus generic advisory mapping |
| Project format | IndexedDB + portable `.iomcar` ZIP |
| Presentation modes | Guided and Explore |
| Prototype asset | Lixiang for technical development pending public-use review |

### 22.2 Owner decisions — A–F locked 3 August 2026

| ID | Decision | Status | Locked choice |
|---|---|---|---|
| **A** | Presentation access | **Approved** | Access-controlled or local-only for v1. Unlisted static URL is not accepted as security for confidential/OEM assets. |
| **B** | Lixiang asset use | **Approved** | Technical prototype / internal only until written public-use clearance. Not for client pitch branding or extractable handoff. |
| **C** | Desktop vs mobile | **Approved** | Desktop-first for client meetings. Mobile Presentation supported; equal polish is not a launch gate. |
| **D** | Studio art direction | **Approved** | Dark premium Studio as default. Bright architectural Studio may follow as a second preset after IBL/paint validation. |
| **E** | Rear-wheel re-rig | **Approved** | One-time offline split/re-rig of Lixiang rear wheels, with supplied source GLB retained unchanged. |
| **F** | Client deliverable | **Approved** | Hosted Presentation revision only for clients. `.iomcar` / Master / extractable GLBs remain IOM-internal unless separately licensed. |

### 22.3 Remaining owner decisions (deferrable past A–F)

Not blocking Phase 0/1 foundation. Confirm before public publish or Phase 6+ media polish as noted:

1. Is `/demos/automotive-studio/` the desired public name? *(default: yes)*
2. Exact access mechanism for A: password, authenticated account, expiring link, and/or local-only preview.
3. Should local video upload be required in the first usable hotspot milestone, or follow text/image/action? *(default: follow later)*
4. Which reference devices/browsers define performance acceptance?
5. Is multi-language hotspot content required initially? *(default: no)*
6. Client branding: IOM-only, neutral, or configurable per project? *(default: IOM-only)*
7. Hotspot engagement analytics later, and under what privacy policy? *(default: deferred, off by default)*

---

## 23. Milestone plan and exit criteria

### Phase 0 — Scope, rights, and quality target

**Deliverables**

- Approved plan and route name.
- Confirmed prototype/public asset status.
- Reference hardware/browser list.
- Initial art-direction board or screenshots.
- Confirmed first-release scope.
- Confirmed client-delivery policy: local, public, authenticated, expiring, and/or embeddable.
- Renderer compatibility spike using the actual paint, glass/transmission, shadows, KTX2, volumetrics, and post-processing on WebGPU and forced WebGL2.

**Exit criteria**

- No unresolved decision that materially changes architecture.
- Asset/publication status documented.
- Performance and visual review devices agreed.
- Studio, Presentation, and non-3D fallback support levels agreed from measured backend results.

### Phase 1 — Application foundation

**Deliverables**

- Separate Automotive Studio source/build entry.
- Pinned Three.js and self-hosted production bundle.
- Studio/Preview/Presentation shell.
- ProjectStore, command model, undo/redo, dirty state.
- Global Transport and ownership rules.
- Initial `.iomcar` schema including hotspots/actions.
- Renderer initialization with WebGPU and tested WebGL2 fallback path.

**Exit criteria**

- Existing website build remains green.
- Existing Volume Lighting remains unchanged.
- Empty project can save/load and migrate.
- Studio and Presentation shells are responsive and keyboard reachable.
- Forced WebGL2 test produces an intentional result or documented reduced fallback.
- Studio and Presentation build as separate entries against the same pinned schema/runtime contracts.

### Phase 2 — Import, analysis, and normalization

**Deliverables**

- Atomic GLB import.
- Active Vehicle/Prop role choice.
- Asset compatibility report.
- Animation detection/player fallback.
- Physical dimensions, axes, grounding, bounds exclusions.
- Correct disposal/replacement lifecycle.
- Lixiang import profile and regression fixture where licensing permits.

**Exit criteria**

- Lixiang reports the expected clip and duration.
- Static and animated test GLBs both load.
- Vehicle scale/orientation/grounding remain stable after save/load.
- Replacing a vehicle does not leave leaked scene objects or half-cleared project state.
- External-resource glTF claims match actual supported behaviour.

### Phase 3 — Production optimization and wheel rig

**Deliverables**

- Configurable automotive optimization script.
- High/Balanced/Mobile candidates.
- Texture codec/size profiles.
- Visual comparison captures.
- Animation and semantic-node validation.
- Repaired Lixiang wheel rig and manifest.
- Runtime Meshopt/KTX2 loading.

**Exit criteria**

- Optimized assets load with no console errors.
- Door/rear/steering animation matches the approved reference.
- Paint, glass, chrome, interior, normals, badges, and panel gaps pass close-up comparison.
- Four tires roll about correct pivots; calipers/suspension remain static.
- Variant change preserves vehicle placement and all approved bindings.
- Network, memory, and render reports are recorded for each variant.
- The source GLB is never overwritten, and output reports include source/output hashes and tool settings.
- Presentation High is ≤30 MiB and Mobile is ≤15 MiB unless a measured visual exception is explicitly approved.
- Optimized reference captures pass the agreed masked comparison threshold or receive explicit shot-by-shot visual sign-off.

### Phase 4 — Motion and global transport

**Deliverables**

- Semantic action registry.
- Lixiang showcase and approved mechanism actions.
- Editable world-distance Vehicle Route.
- Speed, acceleration, braking, loop/reverse.
- Curvature steering and distance-linked tire rotation.
- Single synchronized transport/timeline.

**Exit criteria**

- Route speed is independent of route length.
- Wheels stop and reverse correctly.
- Integrated wheel angle matches signed travelled distance divided by calibrated radius within 1%.
- Five closed-route loops produce no cumulative wheel or route seam drift.
- Steering and rolling do not overwrite each other.
- Editing pauses transport predictably.
- Action/route conflicts follow the documented rules.
- Project round-trip preserves route and action state.
- A ten-minute route/action stress run shows no progressive memory growth, NaN, orientation flip, or motion instability.

### Phase 5 — Environment, lighting, and visual direction

**Deliverables**

- Studio, Day, Golden Hour, Night presets.
- Coherent IBL and visible backgrounds/skies.
- Directional/fill/shadow setup.
- Premium stage/floor.
- Optional accent volumetric rig.
- Automatic vehicle-light hooks where supported.
- Environment track on the timeline.

**Exit criteria**

- Paint and glass read correctly in every approved preset.
- No double-added/washing background in the volume pass.
- No exposure jumps.
- Preset transitions begin promptly and complete without visible lighting, background, or reflection popping.
- Shadow and volume quality meet desktop/mobile budgets.
- Preset-to-Custom behaviour is clear and persisted.

### Phase 6 — Premium hotspots and media

**Deliverables**

- Surface placement and semantic node anchoring.
- Marker styles, labels, connector, occlusion, and overlap handling.
- Mixed text/image/gallery/video/specification cards.
- Self-hosted video and optional privacy-enhanced embed.
- Declarative animation, shot, environment, sequence, and link actions.
- Hotspot authoring inspector and templates.
- Sanitization, URL validation, and media preflight.

**Exit criteria**

- A door-attached hotspot follows the door through animation.
- A vehicle hotspot follows route, scale, and variant changes.
- Example hotspot can stop the vehicle, move camera, open a door, and show mixed text/video content.
- That example sequence produces the same final state on repeated playback and rapid repeated activation cannot stack actions.
- Desktop cards and phone bottom sheets pass approved layouts without covering the primary vehicle focal point.
- Keyboard, touch, captions, reduced motion, and Escape behaviour pass.
- Broken anchors/actions/media block publishing with useful messages.
- No arbitrary script execution is possible from hotspot content.

### Phase 7 — Shots, presentation, persistence, and delivery

**Deliverables**

- Object-relative standard shots.
- Shot thumbnails and sequence editor.
- Guided and Explore Presentation.
- IndexedDB autosave/recovery.
- Portable `.iomcar` packages with media.
- Runtime export/publish package.
- Poster and reduced-quality/video fallback.
- Credits/info presentation.

**Exit criteria**

- Guided sequence is deterministic across repeated playback.
- Explore mode permits only curated interactions.
- Large project save/load succeeds without base64 memory spikes.
- Presentation contains no authoring chrome.
- Approved desktop/tablet/phone breakpoints contain no inspector, grid, gizmo, source path, raw node ID, or technical warning.
- Corporate-device fallback is understandable and polished.
- Published package contains only approved assets.
- Published output is an immutable, hash-recorded revision with a tested rollback target.

### Phase 8 — OEM-quality hardening

**Deliverables**

- Full regression suite.
- Browser/device matrix.
- Performance traces.
- Visual regression set.
- Accessibility review.
- Security/content review.
- Licence/credits review.
- Client presentation rehearsal.
- Deployment checklist.
- Private stakeholder review URL before any public project listing.

**Exit criteria**

- All Definition of Done items pass.
- No unresolved P0/P1 defect.
- Performance budgets pass on agreed reference hardware or approved fallbacks are documented.
- Asset rights and presentation wording are approved.
- Owner signs off the exact production package before deployment.

---

## 24. Preliminary quality and performance budgets

These are starting targets. Phase 0 should confirm reference hardware and final budgets.

Measure runtime budgets in a repeatable 60-second presentation scenario after shader warm-up, with separate cold-cache load measurements:

| Metric | Desktop Presentation | Mobile Presentation |
|---|---:|---:|
| Vehicle transfer | ≤30 MiB | ≤15 MiB |
| Visible triangles | ≤1.0M Hero / ≤500k Balanced | ≤250k target |
| Draw calls | ≤120 | ≤80 |
| Estimated GPU allocation before optional video | ≤350 MiB | ≤180 MiB target |
| Median frame rate | ≥55 FPS | ≥30 FPS |
| p95 frame time | ≤25 ms | ≤40 ms |
| Shell interactive, vehicle excluded | ≤2 s | ≤3 s |
| Presentation ready | ≤8 s at 50 Mbps | ≤10 s at 20 Mbps |
| Hotspot/semantic-action response | ≤100 ms | ≤150 ms |

These are acceptance targets, not guarantees derived from file size. Phase 0 names the exact test hardware, viewport, quality profile, thermal conditions, and browser versions used to approve them.

### 24.1 Network and loading

- Application shell and critical UI kept compact and cached.
- Presentation High vehicle targeted at no more than 30 MiB; an optional 35 MiB hero exception requires measured approval.
- Mobile vehicle approximately 8–15 MiB.
- Non-default HDR environments and hotspot video lazy-loaded.
- Real byte/download/parse/compile progress.
- First useful visual shown through an approved poster/start gate while heavy assets load.
- No dependency on a third-party CDN for core renderer/application code.

### 24.2 Runtime memory

- KTX2 used to control GPU texture memory where quality allows.
- Desktop presentation total GPU estimate targeted below approximately 350 MiB before optional video decoding, subject to measurement.
- Mobile runtime profile targeted below approximately 180 MiB, subject to device testing.
- No monotonic memory growth after repeated model, environment, hotspot, or project changes.

### 24.3 Rendering

- Desktop target: 50–60 FPS on agreed reference hardware at the approved resolution.
- Mobile target: stable 30 FPS in Presentation.
- Presentation High triangle target determined by profiling; selective reduction from 1.93 million is expected.
- Balanced desktop target below approximately 500,000 visible triangles; Mobile targets approximately 250,000, subject to visual approval.
- Shadow casters and transparent/double-sided surfaces explicitly reviewed.
- Volumetric resolution and steps adapt by runtime profile.
- No long synchronous optimization on the main thread.

### 24.4 Interaction

- Editing feedback should feel immediate.
- Timeline, hotspot, and camera controls should not hitch during steady-state rendering.
- Large operations show progress and remain cancellable where possible.
- Client controls remain responsive while media loads.

---

## 25. Test strategy

### 25.1 Unit tests

- Project migrations and transactions.
- Asset stat calculations.
- Animation validation and semantic track filtering.
- Track-name parsing.
- Route distance sampling and speed profiles.
- Wheel distance/radius math and reverse behaviour.
- Environment preset interpolation.
- Hotspot anchor transforms.
- Hotspot action conflict resolution.
- URL, content, and project-package validation.

### 25.2 Integration tests

- Import static GLB.
- Import animated GLB.
- Import invalid/unsupported file.
- Replace Active Vehicle atomically.
- Save/load a large `.iomcar` package.
- Switch optimized variants.
- Play embedded animation while static and while permitted on route.
- Trigger a mechanism from a hotspot.
- Play route + wheel + camera + environment timeline.
- Close/reopen video cards and verify cleanup.
- Force WebGL2 fallback.

### 25.3 Visual regression

Capture approved views of:

- Paint and reflections.
- Glass/transmission.
- Chrome and trim.
- Interior materials.
- Doors and rear mechanisms at rest/open.
- Front steering and four rolling wheels.
- Ground contact.
- Studio/Day/Golden/Night.
- Volumetric accents.
- Hotspot marker and each card template.
- Guided and Explore Presentation.
- Desktop, tablet, and mobile layouts.

### 25.4 Performance tests

- Download, parse, first render, shader compile, and ready times.
- Frame time and frame pacing.
- GPU/decoded memory estimates and browser observations.
- Shadow/volume cost.
- Route/action/hotspot steady state.
- Repeated project/model/environment/media changes for leaks.
- Slow network and low-memory behaviour.

### 25.5 Accessibility tests

- Keyboard-only Studio and Presentation controls.
- Visible focus.
- Dialog focus trap and Escape.
- Live announcements for import, optimization, save, and errors.
- Reduced motion.
- Captions and video labels.
- Colour contrast.
- Minimum touch targets.
- No essential information conveyed by colour alone.

### 25.6 Security tests

- Malicious hotspot HTML.
- Unsafe URL schemes.
- Iframe sandbox boundaries.
- Malformed ZIP/project manifests.
- Oversized/decompression-bomb package limits.
- Missing and mismatched checksums.
- No arbitrary action execution from project JSON.
- Published asset list review.

### 25.7 Required compatibility matrix

Reference assets:

- Supplied Lixiang: large textures, one combined clip, difficult wheel hierarchy.
- Existing static showcase vehicle as an import/render regression.
- Small controlled fixture containing multiple clips, skinning, morph targets, root motion, transparent materials, and approved Draco/Meshopt/KTX2 combinations.
- Corrupt, unsupported, missing-resource, oversized, and malicious package fixtures.
- High/Balanced/Mobile production variants.

Platforms, finalized in Phase 0:

- Windows 11 Chrome and Edge with WebGPU.
- The same Windows reference machine with forced WebGL2 fallback.
- macOS Safari and Chrome.
- iPhone Safari and Android Chrome on named devices.
- Firefox/WebGL2 as either a declared support target or a deliberately designed fallback case.

Lifecycle and failure scenarios:

- Cold/warm cache and the documented 50/20 Mbps network profiles.
- Context loss/recovery, background tab/restore, resize, and orientation change.
- Import/cancel/replace/save/reload/migrate across valid and invalid projects.
- Pairwise conflicts among route, embedded clips, steering, tire roll, hotspot actions, camera sequence, media, and environment.
- Ten-minute stress playback and repeated vehicle/environment/project/media swaps.

---

## 26. Key risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Lixiang/Sketchfab/brand rights not suitable for public OEM pitch | Legal and reputational | Treat as prototype until written use/publication review; retain licence metadata; use OEM-approved asset for final if needed |
| Raw GLB can be extracted from a public web experience | Asset-distribution/confidentiality | Do not treat unlisted URL as security; use approved runtime asset, access control, and publication policy |
| 947 MiB source texture footprint | Crashes and poor mobile performance | KTX2, semantic resizing, variants, memory preflight, mobile profile |
| 1.93 million triangles multiplied by shadows/passes | Low FPS | Selective LOD, tire reduction, caster selection, profiling |
| Rear wheels have no usable individual pivots | Incorrect tire animation | One-time offline split and rig manifest |
| Front subtrees mix rolling and static parts | Calipers/suspension rotate incorrectly | Separate rolling pivots and static brake groups |
| One monolithic animation has generic targets | Confusing client actions | Visual confirmation, track-filtered semantic action registry, generic fallback player |
| Optimization removes semantic nodes | Broken actions/hotspots | Preservation manifest and binding validation before variant activation |
| WebGPU/TSL behaviour differs on fallback | Corporate-device failure | Remove hard gate, test forced WebGL2, offer reduced fallback/poster/video |
| Bright background enters additive volume pass | Washed/doubled environment | Layer-0 dome or separate volume scene with black background |
| Browser optimization of 176 MiB source exhausts memory | Tab crash | Offline production pipeline first; worker, memory estimate, cancel/refuse thresholds |
| External video is blocked or tracks users | Broken/private presentations | Self-hosted video first, privacy-enhanced optional embeds, fallback poster/link |
| Large video bloats project package | Slow save/publish | Media budgets, transcode presets, lazy runtime package, checksum/dedup |
| Arbitrary hotspot HTML/iframes | XSS/content risk | Sanitization, safe URL policy, sandbox, CSP, declarative actions only |
| Independent controls compete for transforms | Jitter and corrupt state | Explicit ownership matrix and one global Transport |
| Existing dirty worktree is overwritten | Lost unrelated work | Isolate new files, review status before edits, phase commits, never reset/stash destructively |
| Monolithic implementation becomes unmaintainable | Slow iteration/regressions | Dedicated modules, typed project model, commands, tests, build entry |

---

## 27. Licensing and client-delivery considerations

The supplied folder identifies the model as Sketchfab Standard licensed and includes source/author information. Standard licensing may allow broad derivative/commercial use, but public delivery must still be reviewed for:

- Restrictions on making the stand-alone asset available.
- Vehicle design, badge, and trademark rights.
- Implied manufacturer endorsement or affiliation.
- Removal or hiding of embedded promotional/credit geometry.
- Whether an optimized GLB may be distributed to a client.
- Whether the final website exposes the asset more broadly than intended.

Recommended policy:

- Use the Lixiang as the technical reference asset initially.
- Preserve the licence text/snapshot, author, source URL, acquisition date, and exact asset hash in the project record.
- Keep any `.iomcar` containing the original or an extractable optimized Lixiang GLB internal unless the recipient has independent rights or written distribution permission; a client-facing web presentation is not permission to hand over the source asset.
- Do not label the prototype as affiliated with BMW or another OEM.
- Confirm rights before public deployment or client asset handoff.
- Prefer an OEM-supplied, neutral, or explicitly cleared vehicle for the final targeted presentation.
- Keep credits accessible through an elegant Info control rather than covering the presentation.
- Ensure published terms prohibit extracting or redistributing third-party model assets; technical URL hiding or obfuscation is not a rights-control mechanism.

This plan is technical/product guidance, not legal advice.

---

## 28. Development, review, and deployment discipline

- Read `DEPLOY.md` before changing `public/demos/**`.
- Keep the existing Volume Lighting demo untouched unless a separate change is explicitly approved.
- Preserve unrelated working-tree changes.
- Use focused commits by phase.
- Include tests and before/after captures with each material rendering change.
- Review generated Automotive Studio output separately from source.
- Keep the new route unlinked from public project navigation until its release-candidate gate passes.
- Add the build integration and smoke test before changing `src/data/projects.ts`, sitemap entries, project cards, or posters.
- Do not deploy automatically at the end of a development phase.
- When the owner explicitly approves production deployment, use only:

```bash
npm run deploy
```

Recommended commit boundaries:

1. Application/build foundation.
2. Project schema and persistence.
3. Import/analyser/normalization.
4. Optimization pipeline and variants.
5. Wheel rig and semantic actions.
6. Route and global transport.
7. Environment/lighting/stage.
8. Hotspots/media/actions.
9. Shots/presentation.
10. QA/hardening/documentation.

---

## 29. Definition of Done

Automotive Studio is complete only when:

- It exists as a separate, maintainable application.
- The existing Volume Lighting demo remains functional.
- The supplied animated GLB is correctly detected and playable.
- Semantic actions are stable, reversible, and correctly labelled.
- Physical dimensions and grounding are correct and persisted.
- The vehicle route uses world distance and realistic speed units.
- Four tires roll correctly while brakes/calipers remain static.
- Route steering, embedded steering, wheel roll, and edit controls do not fight.
- High and Mobile assets pass visual, binding, memory, and performance gates.
- Studio, Day, Golden Hour, and Night look intentionally art-directed.
- Automotive materials receive coherent IBL and stable shadows/reflections.
- Premium hotspots support mixed text, images, video, specifications, and actions.
- Hotspots remain correctly anchored through animation, route movement, scaling, and approved variant changes.
- Guided and Explore presentations are polished on desktop and mobile.
- Projects autosave, recover, and round-trip through `.iomcar` without base64 model embedding.
- Publishing preflight catches missing assets, broken bindings, unsafe content, and performance risks.
- Accessibility, security, reduced-motion, and fallback requirements pass.
- Licensing/credits and the exact production asset set are approved.
- Production build and smoke tests pass.
- The owner explicitly approves the production presentation before deployment.

---

## 30. Immediate next action

**A–F locked** (§22.2). **Phase 1 foundation is in place** for review:

| Path | Role |
|---|---|
| `automotive-studio/` | Source app (Studio + Presentation entries) |
| `public/demos/automotive-studio/` | Built output |
| `npm run build:automotive-studio` | Build orchestrator |
| `docs/automotive-studio-phase0.md` | Phase 0 lock notes |

Local review:

```bash
npm run build:automotive-studio
# then open /demos/automotive-studio/ via site vite, or:
cd automotive-studio && npm run dev
```

Force WebGL2: append `?forceWebGL2=1`.

**Do not** start vehicle import, optimization, or wheel surgery until this foundation is reviewed together.

Next after sign-off: Phase 2 (import / analysis / normalization) only.
