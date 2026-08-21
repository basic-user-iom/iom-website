# Automotive Studio — Professional Engineering and Visual Audit

**Audit date:** 4 August 2026  
**Audited application:** `http://localhost:5190/demos/automotive-studio/`  
**Source:** `automotive-studio/` in the local IOM website repository  
**Primary reference vehicle:** the supplied Lixiang L9 rigged GLB and its optimized variants  
**Purpose:** define the work required to turn the current Automotive Studio into a dependable, visually premium client presentation system  
**Change policy for this audit:** read-only. No application, model, build, or existing documentation file was changed. This report is the only new repository file.

---

## 1. Executive verdict

Automotive Studio is a credible and unusually broad prototype. The product structure is promising: it already separates authoring from presentation, detects embedded GLB animations, supports vehicle variants and rig manifests, has route and wheel-motion foundations, includes a declarative project format, and establishes a coherent visual UI.

It is **not yet ready for an external BMW-level presentation**. The main reason is not a lack of visual polish. Several underlying systems currently make the result inconsistent or unsafe:

1. The default WebGPU renderer loses image-based lighting, producing materially different and much darker vehicle rendering than WebGL2.
2. The cyclorama hides the sky, sun, moon, and stars across most current hero views, so improving those objects alone will not make them visible.
3. The visible environment and reflected environment do not change together; a car can reflect a neutral studio while standing in a golden or night scene.
4. Navigating away, replacing a quality slot, or clearing a project can delete vehicle blobs that Undo cannot restore, and normal Studio reopening is not deterministic.
5. Material and emissive edits are runtime-only and do not survive reload, variant switching, export, or Presentation.
6. A Presentation URL currently depends on the same browser's IndexedDB. It is a local preview, not a link that can be sent to a client.
7. The root production build does not automatically rebuild Automotive Studio, and a prototype GLB currently sits under a Vite `public` directory where it could be copied into an artifact.

The right next move is therefore a staged hardening and visual-system rebuild, beginning with data/state safety and a validated production renderer path. Tuning colors, stars, bloom, or moon textures before those fixes would make the application look better in one path while leaving the underlying contradictions in place.

### Recommended release position

| Area | Current state | BMW-facing target |
|---|---|---|
| Authoring UI | Strong prototype foundation | Polished after state, accessibility, and workflow fixes |
| Vehicle import/animation detection | Functioning | Keep; add deterministic compatibility and validation |
| WebGL2 rendering | Useful baseline | Production fallback after visual rework |
| WebGPU rendering | Incorrect IBL behavior | Fix and certify parity, or ship validated WebGL2 by default while WebGPU remains behind a QA/capability flag |
| Day/night environments | Art-direction prototype | Rebuild as one correlated environment system |
| Moon/sun/stars | Technically present but usually occluded and physically inconsistent | Camera-relative, correctly scaled, asset-backed celestial system |
| Materials/emissive | Destructive heuristics and transient edits | Persistent semantic material and vehicle-light system |
| Hotspots | Good schema concept, incomplete execution and presentation | Premium accessible markers, media cards, and deterministic actions |
| Client presentation | Same-browser preview | Immutable published project with hosted assets and real access policy |
| Persistence/build safety | Release blockers present | Automated save/reopen, artifact, and regression gates |

---

## 2. Audit method and evidence

The audit combined:

- a live walkthrough of Studio and Presentation at the supplied local URL;
- comparison of Studio, Day, Golden Hour, and Night in the default WebGPU path and a forced WebGL2 path;
- import and inspection of the supplied rigged Lixiang model and optimized variants;
- source review across renderer, environment, stage, persistence, animation, route, hotspots, UI, Presentation, model optimization, and build configuration;
- a strict TypeScript check (`tsc --noEmit`), which passed;
- basic desktop and 390 × 844 responsive measurements;
- short idle-render samples to identify continuous rendering behavior;
- inspection of current built assets and local prototype assets; and
- verification against authoritative Three.js and NASA documentation.

This is an engineering and product-quality audit, not a calibrated color-science or GPU laboratory certification. Frame-rate and CPU figures in headless/software-rendered Chromium are directional. Final budgets must be measured on named target hardware in real Chrome, Edge, and Safari where applicable.

The served build and working source were not fully synchronized at audit time: generated demo assets predated several current source edits, and the repository already contained uncommitted user work. Runtime observations therefore describe the actual page served on port 5190, while source findings describe the working-tree snapshot. The report calls out this build gap as a release blocker rather than assuming the two are identical.

### Observed vehicle import

The Balanced rigged Lixiang variant was recognized as approximately 24.76 MiB and exposed one animation of 14.542 seconds with 16 tracks. The inspector reported approximately 1.25 million triangles, 132 meshes, 203 nodes, 33 materials, 15 textures, and an estimated 67 MiB of GPU texture memory. This confirms that embedded animation discovery is working.

Two presentation problems were immediately visible:

- the dimensions read `L 5.10 m · W 3.84 m · H 1.68 m`; the width is clearly not a valid exterior vehicle width, demonstrating a semantic-bounds/orientation problem that may involve source yaw, animated/open components, or incorrect node exclusions and must be isolated before dimensions are shown; and
- promotional/credit geometry such as “FREE 3D MODEL”, model-name text, and a Discord mark remains visible around the vehicle, even though some of it is excluded from bounds calculations.

The second issue should be handled with the model's license in mind. Presentation geometry should be removed or hidden through an explicit semantic exclusion manifest only when the license permits it; required attribution should remain available in a polished Credits/Information surface.

---

## 3. What is already worth preserving

The following decisions are sound and should survive the rebuild:

- Separate Studio and Presentation entry points.
- A versioned, declarative project schema rather than serializing a live Three.js scene.
- Binary blobs stored separately from project JSON.
- Vehicle normalization wrappers and semantic anchors.
- Exact Three.js dependency pinning and self-hosted decoder assets.
- Model analysis, animation discovery, quality-variant import, and rig-manifest concepts.
- Route distance, wheel rotation, steering, body-lean, and chase-camera foundations.
- A declarative hotspot model with content blocks and action types.
- A coherent dark authoring interface with a clear viewport/inspector/timeline hierarchy.
- A WebGPU/WebGL backend abstraction, provided its implementation is made backend-correct.

The goal should be to harden these foundations, not discard the whole application.

---

## 4. Live visual assessment

### 4.1 Preset comparison

| Preset | Default WebGPU observation | Forced WebGL2 observation | Required change |
|---|---|---|---|
| Studio | Vehicle paint, wheels, glass, and interior are heavily crushed because IBL creation fails. Contact shadow is visually dominant. | Vehicle is brighter and paint reads better because the neutral RoomEnvironment works. | Correct IBL on both backends; create a real cove and fitted soft shadows. |
| Day | Mostly a flat gray cyclorama; sky and sun are not convincingly visible. | Very similar to Studio because the same neutral IBL remains active and the cyc hides the sky. | Open the stage, use a daylight sky plus matching daylight IBL, and define a real sun rig. |
| Golden Hour | Orange flood with a harsh dark shadow and little believable sky context. | Background/reflections still feel neutral while direct light becomes warm. | Correlate sky, IBL, key direction, exposure, haze, stage response, and shadow softness. |
| Night | Nearly black; only strong vehicle emissive areas remain readable. Stars and moon are not visible. | Still resembles the neutral studio more than a moonlit exterior. | Add a moon-aligned light and night IBL, expose the sky, protect shadow detail, and use controlled emissive bloom. |

### 4.2 Vehicle framing and stage composition

The current camera leaves a large amount of unused stage and makes the vehicle feel small. A premium automotive default should frame the car as the subject, normally occupying roughly 65–78% of viewport width for a hero three-quarter view, while retaining safe room for hotspots and the inspector. Shot templates should include front three-quarter, rear three-quarter, side profile, interior, wheel/detail, and lighting-feature views.

The present radial contact shadow is much larger and darker than the vehicle footprint, particularly at night. It reads as a graphic oval rather than contact. The source credit meshes further weaken composition and should never appear in a client hero shot.

---

## 5. Why the current sky, sun, moon, and stars do not work

### 5.1 WebGPU image-based lighting fails

`createRenderer.ts` constructs a `PMREMGenerator` imported from the WebGL-oriented Three.js entry point and passes the WebGPU renderer through a type cast. At runtime the default backend logs:

```text
[automotive-studio] RoomEnvironment IBL unavailable
TypeError: Cannot read properties of undefined (reading 'buffers')
```

The affected logic is in [`createRenderer.ts`](../automotive-studio/src/renderer/createRenderer.ts), approximately lines 309–320. In the pinned 0.181.2 setup, the core `three` PMREM implementation is the WebGL path; the [`PMREMGenerator`](https://threejs.org/docs/pages/PMREMGenerator.html) API documents a `WebGLRenderer` input. A TypeScript cast cannot make that implementation operate on a WebGPU renderer.

**Impact:** default WebGPU has no usable `envMap`, so metallic paint, chrome, glass, wheels, and dark interior materials lose the reflections that communicate shape. This is the first visual blocker.

**Decision:** implement genuinely separate, supported backend paths behind one environment interface. Do not cast one renderer into the other renderer's utility API. Three.js 0.181.2 exports a backend-specific `PMREMGenerator` from `three/webgpu`; use it with `WebGPURenderer`, while retaining the core `three` PMREM path for `WebGLRenderer`. Keep and dispose the generated render target correctly, not only a detached texture. Treat failure to initialize the approved fallback IBL as a renderer boot failure with a branded fallback, not a warning that silently continues.

### 5.2 The cyclorama blocks celestial elements in most current views

The stage creates an opaque, double-sided, approximately 1.7π cylindrical wall around most camera directions, with an approximate radius of 14 m and height of 10 m in [`createRenderer.ts`](../automotive-studio/src/renderer/createRenderer.ts), approximately lines 119–136. It leaves an open-backed gap, but the sky dome, star field, moon, and sun are outside the wall across the normal hero views. The opaque inner wall therefore wins the depth test and hides them from most current compositions.

This is the principal reason stars, moon, and sun remain invisible even when their code is running.

**Decision:** use the enclosed cyclorama only for Studio. Day, Golden Hour, and Night need an open exterior stage/ground policy, or the sky/celestials must be rendered in a dedicated camera-relative background pass. A true studio cove should be a modeled floor-to-wall sweep, not an opaque cylinder surrounding all possible views.

### 5.3 The reflected world and visible world are disconnected

WebGL2 creates one neutral `RoomEnvironment` and retains it in all four presets. `applyEnvironment.ts` changes gradients and direct lights, but it does not select a matching IBL. Consequently the car can be lit by a golden direct light while still reflecting a neutral room.

`polishVehicleMaterials.ts` also assigns an explicit `material.envMap` to vehicle materials. Three.js notes that `Scene.environmentIntensity` affects materials using the scene environment, but not a material that already has its own explicit environment map; see [`Scene.environmentIntensity`](https://threejs.org/docs/pages/Scene.html). This makes a global environment-intensity control unreliable for the current vehicle materials.

**Decision:** make scene-level environment lighting the normal path. Explicit per-material environment maps should be exceptional. Background and IBL need independent rotation/intensity controls but must be authored as a coordinated preset.

### 5.4 Exposure is applied twice

Environment exposure currently multiplies direct-light intensities in `applyEnvironment.ts`, then the same value is assigned to renderer tone-mapping exposure in `createRenderer.ts`, approximately lines 338–350.

This couples camera exposure to physical/artistic light power: direct-light gain approximately receives the same scalar in light power and again before nonlinear tone mapping. The exact screen result is not a simple universal square, but it is nonlinear, hard to predict, and difficult to balance between presets.

**Decision:** store and tune these separately:

- `cameraExposure` — the tone-mapping/camera value;
- `environmentIntensity` — diffuse/specular IBL response;
- `sunLux` or an art-directed `sunIntensity`;
- `moonIntensity`;
- `fillIntensity` and `rimIntensity`;
- `emissiveGain` and `bloomStrength`.

The UI may expose a simplified “Brightness” macro, but it should write a controlled mapping, not one shared scalar.

### 5.5 Celestial scale and placement are physically implausible

The moon is a white `MeshBasicMaterial` sphere with radius approximately 1.4 at a distance of 55. This produces an angular diameter near 2.9°, around 5.5 times the real Moon's roughly 0.52°. The sun sphere is similarly around six times too large. Both are world-origin-relative.

The route can extend far enough that origin-relative celestial geometry and a fixed 120 m sky sphere cause parallax or containment problems. Celestial features should appear infinitely distant.

**Decision:** render the sky and celestial objects camera-relative, with no translational parallax. Default both sun and moon to about 0.53° angular diameter, then offer a restrained “cinematic apparent size” override with a clear nonphysical label.

### 5.6 Night uses a below-ground sun instead of a moon light

The Night preset keeps the sun directional light active while using a negative sun elevation. Its position can therefore fall below the ground and light upward. The visible moon is placed separately and does not drive a corresponding moon key.

**Decision:** the visible light source and the directional key must agree. At night, disable or smoothly reduce the solar key below the horizon and activate a separate moon directional rig aligned with the visible moon. Moonlight should be cool-neutral rather than saturated blue; most of the “blue night” look should come from exposure, sky/IBL balance, and warm/cool contrast.

### 5.7 The current labels overstate the implementation

The `hdrBackground` option changes a procedural gradient response; it does not load or render HDR radiance data. The stage “emissive” control makes a surface self-lit but does not cause it to illuminate nearby objects, and no bloom pass creates a visible glow halo.

**Decision:** use precise UI language. Call the current surface behavior “Self illumination” unless a light proxy or global-illumination approximation is part of the feature. Reserve “HDR/UltraHDR environment” for actual radiance assets.

### 5.8 Editing a preset can unexpectedly replace its visual identity

An environment edit changes `presetId` to `custom` in `projectStore.ts`, approximately line 164. `applyEnvironment.ts` then guesses whether a custom state should look like Day, Studio, Golden, or Night using hard numeric thresholds around line 372. In a runtime test, lowering the Day sun to roughly 2° abruptly selected a blue Night-like result and even made the visible sun blue.

**Decision:** persist both `basePresetId` and `customized: true`. A slider edit should modify the selected look, never infer a different base look. Switching base presets must be an explicit user action.

### 5.9 Natural and photographic lighting are stacked without a clear owner

Hemisphere light, ambient light, IBL, sun, fill, and rim can all contribute simultaneously. This tends to flatten contrast and makes it difficult to understand why a surface is bright. The rim target also does not consistently follow the moving vehicle.

**Decision:** separate `NaturalLightRig` from `StudioLightRig`. Exterior presets normally use sun or moon plus sky/ground IBL. Studio presets use authored reflection panels and an explicit photographic key/fill/rim rig. Advanced users may combine them, but the contribution and ownership of every source must remain visible.

---

## 6. Target visual architecture

### 6.1 One correlated Environment Controller

Introduce one `EnvironmentController` that owns every property that must change together:

```text
Environment preset
├── visible sky/background
├── image-based lighting source, rotation, and intensity
├── sun disc + solar key direction/color/intensity
├── moon disc/phase + lunar key direction/color/intensity
├── stars and atmospheric visibility
├── exposure and tone-mapping target
├── fill/rim/accent policy
├── fog/haze and horizon treatment
├── floor/cyclorama visibility and material response
├── shadow softness/contact policy
└── post-processing profile
```

The renderer backend should supply capabilities to this controller, not leak casts or backend-specific objects into preset logic. The final appearance of each preset must be regression-tested on every client-eligible backend; WebGPU remains behind its QA flag until it passes the same references as forced WebGL2.

### 6.2 Recommended rendering modes

Use two intentional modes rather than one environment trying to do everything:

1. **Authored presentation presets — release default.** Four polished, repeatable looks: Studio, Day, Golden Hour, and Night. Each uses an approved local HDR/UltraHDR or a backend-correct procedural sky plus a matching cached IBL. This offers predictable client results.
2. **Physical time/date/location — later optional mode.** Compute solar/lunar direction and phase from a real location and time only after the authored presets are stable. It should never replace art direction by default.

For WebGPU, Three.js exposes [`SkyMesh`](https://threejs.org/docs/pages/SkyMesh.html); the documentation identifies it as WebGPU-only and points WebGL users to `Sky`. Three.js also provides [`UltraHDRLoader`](https://threejs.org/docs/pages/UltraHDRLoader.html) for gain-map HDR imagery. A production implementation can choose either:

- local, licensed UltraHDR/HDR assets for the most controlled result; or
- equivalent procedural sky implementations behind the two backend adapters.

Do not regenerate PMREM every frame or on every slider event. Load and prefilter each authored IBL once, cache it, then switch or crossfade through an intentional transition strategy.

### 6.3 Preset art direction

#### Studio

- Neutral-to-slightly-cool dark studio, not a black void.
- True cove with a seamless floor/wall radius and subtle material variation.
- Large soft key reflection cards and restrained edge strips to describe paint curvature.
- Neutral IBL around 5000–5600 K, with deliberate bright panels for automotive paint.
- Soft fitted grounding shadow; no visible exterior sky.
- Dark interior remains readable without lifting black paint into gray.

#### Day

- Open ground/horizon; cyclorama disabled.
- Sun approximately 15–35° above the horizon for useful form, unless the selected shot calls for higher noon light.
- Clear or lightly hazed sky with a matching daylight IBL.
- Shadow softness and contrast calibrated to the sky turbidity, not an arbitrary blur.
- Paint reflections must show sky/ground separation.
- Preserve highlight detail on white paint and glass.

#### Golden Hour

- Sun approximately 2–8° above the horizon.
- Warm direct solar key with a cooler sky fill; do not make the whole scene orange.
- Matching low-sun IBL and a visible horizon gradient/haze.
- Longer, softer-edged shadows with preserved dark-side detail.
- A subtle exposure transition from Day rather than a hard preset jump.

#### Night

- Open, camera-relative night sky.
- A moon key aligned with the moon and a low-energy sky/ground IBL.
- Vehicle lighting becomes an intentional part of the composition.
- Stars attenuate toward the horizon and disappear under strong local light/exposure.
- Avoid pure black backgrounds and saturated blue floods.
- Contact shadow reduced or disabled if moon/key shadows already ground the car.

### 6.4 Environment transitions

Preset changes should take approximately 0.8–1.5 seconds by default and interpolate in linear-light space where appropriate. Interpolate:

- exposure;
- direct-light color and intensity;
- fog/haze;
- background color/sky parameters;
- stage visibility/material response; and
- bloom/emissive profile.

IBL switching is more complex than lerping a color. Prefer preloaded/prefiltered assets and either:

- a deliberate midpoint switch hidden by the visual transition; or
- a supported two-environment blend in a dedicated shader/node path.

Avoid compiling shaders or generating environment convolutions during a client-facing transition.

### 6.5 Suggested versioned state shape

The environment schema should make the separation of concerns explicit. The following is a design sketch, not a drop-in implementation:

```ts
interface EnvironmentStateV2 {
  presetSource:
    | {
        kind: 'built-in'
        basePresetId:
          | 'studio-dark'
          | 'studio-light'
          | 'day'
          | 'golden-hour'
          | 'blue-hour'
          | 'night'
      }
    | { kind: 'custom-template'; templateAssetId: string }
  customized: boolean
  exposureCompensationEv: number // resolved as baseExposure × 2^EV
  transitionSeconds: number

  background: {
    source: 'procedural-sky' | 'ultrahdr' | 'solid'
    assetId?: string
    intensity: number // dimensionless radiance multiplier
    rotationDeg: number
    blurriness: number
  }
  ibl: {
    source: 'studio-rig' | 'procedural-sky' | 'ultrahdr'
    assetId?: string
    intensity: number // dimensionless reflection multiplier
    rotationDeg: number
  }
  atmosphere: {
    turbidity: number
    rayleigh: number
    mieCoefficient: number
    mieDirectionalG: number
    haze: number
  }
  sun: {
    enabled: boolean
    azimuthDeg: number
    elevationDeg: number
    angularDiameterDeg: number
    illuminanceLux: number
    artisticGain: number // dimensionless multiplier, normally 1
    colorTemperatureK: number
  }
  moon: {
    enabled: boolean
    azimuthDeg: number
    elevationDeg: number
    phase: number
    angularDiameterDeg: number
    illuminanceLux: number
    artisticGain: number // dimensionless multiplier, normally 1
    textureAssetId?: string
  }
  stars: {
    enabled: boolean
    source: 'catalog' | 'texture'
    assetId?: string
    intensity: number
    rotationDeg: number
  }
  photographicRig: {
    enabled: boolean
    fillIntensity: number
    rimIntensity: number
    accentProfileId?: string
  }
  stagePolicyId: string
  shadowProfileId: string
  contactProfileId: string
  postProcessingProfileId: string
  autoVehicleLights: boolean
}
```

Art-directed mode writes the celestial directions directly. A later physical mode can derive them from date, time, latitude, longitude, and a project north heading while retaining an author-approved exposure and lighting profile.

---

## 7. Moon specification and real texture decision

### 7.1 Reusable asset already in the repository

The repository already contains a suitable NASA-derived lunar texture:

```text
public/demos/message-in-a-bottle/textures/moon-lroc-2k.jpg
```

The inspected file is approximately 1.85 MB with SHA-256:

```text
2740024F64BF7805BA94D3C5DD22FC9062877997036B24918137A994F72E4BDA
```

Its attribution identifies the NASA Scientific Visualization Studio CGI Moon Kit and the LROC WAC Hapke mosaic. The existing Message in a Bottle demo already uses the texture with phase/limb/aureole shader logic. Automotive Studio should reuse the approved data and provenance, plus the useful phase concepts, **not** import the complete ocean/cloud/sky shader from that unrelated demo. At implementation time, package a reviewed copy under Automotive Studio's own asset inventory rather than depending at runtime on a sibling demo path.

NASA's current [`CGI Moon Kit`](https://svs.gsfc.nasa.gov/4720/) provides color maps and elevation/displacement resources at multiple resolutions. NASA's [`Images and Media Usage Guidelines`](https://www.nasa.gov/nasa-brand-center/images-and-media/) should be retained with the asset record: acknowledge NASA as the source, avoid implying endorsement, and separately review any third-party marks or material.

### 7.2 Recommended implementation

For a premium but efficient implementation:

- use the NASA lunar albedo/color map as sRGB color data;
- preferably use a dedicated lunar phase shader driven by sun, moon, and view directions; if a standard lit material is used, isolate it from scene ambient/IBL so fill light cannot wash out the terminator;
- derive or acquire a subtle normal map from the Moon Kit elevation data, at a restrained strength;
- compute the terminator/phase from normalized sun and moon directions;
- render the object camera-relative and outside normal scene parallax;
- make apparent angular size approximately 0.53° by default;
- prevent it from casting an enormous scene shadow;
- add a separate, very subtle aureole or bloom contribution; and
- expose only art-safe controls: azimuth, elevation, phase/time link, apparent size, brightness, and aureole.

For the sky, a shader disc can be better than a nearby tessellated sphere because it preserves infinite distance and clean phase edges. A low-poly sphere is acceptable only if it is camera-relative, correctly shaded, and large enough in screen-space tessellation to avoid a faceted limb.

### 7.3 Asset recommendation

Use a local, reviewed 2K texture for normal presentation and optionally a 4K source for high-resolution stills. Convert the runtime asset to an appropriate efficient format only after side-by-side review. Do not fetch the Moon from a public CDN during a client presentation.

---

## 8. Sun and daylight specification

The sun must be treated as a coherent visual and lighting system:

- one direction drives the visible disc, solar directional light, shadows, sky scattering, and lens/bloom cue;
- apparent diameter defaults to approximately 0.53°;
- the disc remains high dynamic range but should not create a huge clipped white area;
- the halo should be atmospheric and exposure-dependent, not a fixed billboard;
- sun color and atmospheric extinction change together near the horizon;
- the shadow camera follows the vehicle/shot and is tightly fitted; and
- below the horizon, solar contribution fades smoothly instead of illuminating from beneath the floor.

There must be exactly one visible sun-disc owner per backend. If a procedural sky implementation already renders its own disc, either use that disc or disable it while rendering the custom analytic disc. Apply the same rule during IBL/PMREM capture to avoid two suns or duplicated high-energy reflection artifacts.

Avoid a prominent cinematic lens flare by default. A restrained bloom/veiling-glare cue is more appropriate for a product configurator, and it should be disabled or reduced when it compromises body-line readability.

---

## 9. Star-field specification

The current approximately 1,400 random points are a useful prototype but not a premium sky. Because the random sequence is unseeded, the sky changes between loads and cannot support visual regression.

Recommended production behavior:

- deterministic seed or a curated public star catalogue;
- magnitude-weighted size and luminance, with many dim stars and very few bright stars;
- restrained spectral colors rather than uniform white or exaggerated RGB;
- camera-relative/infinite-distance rendering;
- atmospheric extinction toward the horizon;
- visibility driven by sun elevation, sky luminance, and exposure;
- only subtle twinkle on a small set of bright stars; and
- performance tiers using a point/instanced or procedural path with pixel-correct sizes.

The field should be an infinite/background-depth component that remains behind normal opaque scene geometry. The stage should still occlude it where an opaque wall intentionally covers the view, but the stars must not use nearby world positions or disappear because the route moves hundreds of meters.

There is also a concrete bug in the current implementation: the night fog can reach full opacity around 90 m while stars are distributed roughly 70–110 m from the origin, and the point material is not explicitly excluded from fog. Even with the cyclorama removed, much of the field can therefore be fogged away.

If a texture-backed, catalog-derived sky is desired, NASA's [`Deep Star Maps 2020`](https://svs.gsfc.nasa.gov/4851/) is a strong source candidate with HDR and separated star/Milky-Way layers. It is not an individually addressable runtime star catalogue. Its exact attribution and runtime conversion should be recorded in the same asset inventory as the Moon.

---

## 10. Vehicle materials and emissive lighting

### 10.1 Make automatic “polish” reversible

[`polishVehicleMaterials.ts`](../automotive-studio/src/renderer/polishVehicleMaterials.ts), approximately lines 17–70, heuristically changes glass opacity/transmission/thickness, paint clearcoat/roughness, and chrome properties. It also assigns environment maps directly. These changes are not recorded as project edits and can misclassify unusually named materials.

Replace this with:

1. a non-destructive analysis report;
2. an optional named preset such as “Automotive PBR normalization”;
3. an exact before/after diff;
4. per-change accept/reject and Reset to imported values; and
5. persistent overrides reapplied to every compatible quality variant.

### 10.2 Persist material overrides

The object inspector currently mutates live Three.js materials directly. The project schema needs a durable material/node override layer keyed primarily by:

- `vehicleFamilyId` or `rigManifestId` shared by verified High/Balanced/Mobile variants;
- stable semantic node/material identity plus material slot; and
- whether an edit affects a shared material or creates a mesh-local copy.

Keep a real SHA-256 for every individual asset as validation and variant-binding evidence, but do not make that hash the primary override key: each quality variant correctly has different bytes and therefore a different hash.

Persist at minimum:

- visibility;
- base color;
- emissive color, emissive map, and emissive intensity/strength;
- metalness and roughness;
- specular color/intensity and relevant `KHR_materials_specular` maps;
- clearcoat and clearcoat roughness;
- opacity, alpha mode/cutoff, and double-sided state;
- transmission, thickness, attenuation, and IOR where supported;
- normal/texture substitutions; and
- environment response.

Overrides must survive Save, reload, Undo/Redo, quality switching, `.iomcar` export/import, and published Presentation.

### 10.3 Add a semantic vehicle-light rig

A generic emissive slider is not sufficient for automotive work. Create semantic light groups:

- daytime running lights;
- low beam and high beam;
- tail lights;
- brake lights;
- left/right indicators and hazards;
- reverse lights;
- interior ambient zones; and
- optional welcome/farewell sequence.

Each group maps stable mesh/material targets and may drive three coordinated outputs:

1. an emissive surface/overlay that makes the lens appear lit;
2. a small, carefully bounded proxy light where the beam should affect the scene; and
3. selective bloom for optical glow.

The action system should expose `vehicleLight.set`, `vehicleLight.toggle`, and authored sequences. It must resolve conflicts with embedded GLB animation and presentation timelines through one ownership coordinator.

Route/transport semantics should be first-class: brake lamps respond to authored or measured deceleration, reverse lamps to travel direction, and indicators use the central presentation clock rather than independent timers. Night may propose automatic running lights, but an explicit author state remains authoritative. Proxy lights should be role-specific, tightly bounded, and normally shadowless for performance.

Three.js's current [`BloomNode`](https://threejs.org/docs/pages/BloomNode.html) documentation describes selective bloom driven by emissive output/MRT in the WebGPU post-processing path. Use backend-equivalent selective bloom; do not bloom the entire frame. White paint, chrome, UI, and the moon's full disc must not glow merely because they are bright.

### 10.4 Material quality rules

- Preserve authored PBR values unless an explicit normalization preset is applied.
- Keep all color-space declarations correct; color textures are sRGB and data textures remain non-color. See the Three.js [`Color Management`](https://threejs.org/manual/en/color-management.html) guidance.
- Do not use emissive intensity to compensate for missing IBL.
- Avoid pure black paint values; black automotive paint still needs specular environment detail.
- Tune glass after IBL works. Transmission without a suitable environment and background will always appear wrong.
- Provide separate production-quality material profiles only when variants have been visually approved, not as opaque “optimization” side effects.

---

## 11. Stage, shadows, camera, and post-processing

### 11.1 Stage policy

- **Studio:** modeled cove, controllable floor/wall sweep, subtle roughness difference, optional turntable or reflection cards.
- **Day/Golden/Night:** open ground plane or authored environment-specific stage; enclosed cylinder hidden.
- Stage geometry must not be disposed and recreated for unrelated project updates.
- Each surface needs its own texture sampler/clone so repeat settings cannot overwrite another surface.
- Async texture changes need a revision token or cancellation so stale loads cannot win.

### 11.2 Shadows

The current renderer uses a 4096² primary and 1024² secondary directional shadow map, while nearly every non-glass vehicle mesh casts. The approximately 32 m shadow window wastes resolution around a roughly 5 m car.

Implement quality tiers and framing-aware shadows:

| Tier | Suggested starting point | Policy |
|---|---|---|
| High desktop/stills | 2048–4096 primary, optional 1024 secondary | Tight fitted frustum; selective casters; stable texel snapping |
| Balanced desktop | 2048 primary, secondary only when visually necessary | Update on change/motion, not blindly |
| Mobile | 1024 primary or baked/contact strategy | No secondary; aggressively limited casters |

The existing 6.5 m radial contact blob at opacity around 0.85, increasing at night, should be replaced by a vehicle-footprint-aware soft contact solution or reduced to a very subtle supplement. Do not stack a black blob with already strong real-time shadows.

`enableVehicleShadows.ts` currently sets opaque exterior meshes to `receiveShadow = false` under its classification path. That removes useful self-shadowing beneath mirrors, open panels, wheel arches, and overlapping bodywork. Opaque exterior components should normally receive shadows; solve acne with fitted bounds, stable texel snapping, calibrated bias/normal bias, and semantic classification rather than disabling reception globally.

WebGL2 and WebGPU also do not currently share an explicitly equivalent shadow strategy. Define parity reference shots per tier and keep only one natural outdoor shadow caster—sun by day, moon by night. A moving fitted shadow camera should snap to texel increments to avoid shimmer.

### 11.3 Camera

- Add approved shot templates and safe-space guides.
- Recompute framing from semantically filtered vehicle bounds, excluding credits and helpers.
- Correct and validate the semantic bounds/orientation pipeline before displaying dimensions or using it for auto-framing.
- Add camera near/far tuning per shot to improve depth precision.
- For Presentation, use authored easing, hold time, clearance checks, and motion-reduction behavior.

### 11.4 Post-processing

Start small:

- backend-equivalent tone mapping and color management;
- selective bloom for vehicle lighting, sun halo, and lunar aureole;
- subtle vignette only where approved;
- optional high-quality antialiasing strategy per backend;
- very subtle, masked AO/contact treatment only if it improves grounding, excluding transparent and emissive surfaces so white paint and glass are not dirtied;
- restrained dithering/noise only if gradient banding is visible; and
- no default depth of field on whole-vehicle hero views.

WebGPU uses a distinct post-processing path; the Three.js [`WebGPURenderer manual`](https://threejs.org/manual/en/webgpurenderer) explicitly describes separate WebGPU post-processing and the experimental status of the renderer. Backend parity must therefore be a designed test target, not an assumption.

The feature currently described as “volumetrics” is implemented as a small set of translucent planes rather than depth-aware participating media. These cards can expose their edges and do not follow a real spot cone. Rename the current option to “Light haze”, or implement a depth-aware cone/volume only in a quality tier that can afford it.

### 11.5 Renderer quality tiers

Model quality alone is not enough. Pixel ratio, shadow resolution, IBL resolution, post effects, and volumetrics need one stable capability policy with hysteresis:

| Tier | DPR | Natural shadow | Environment-source starting point | Effects |
|---|---:|---:|---:|---|
| Hero | ≤2.0 | fitted 4096/2048 | visually tested 2–4K equirectangular source | selective bloom, masked AO/haze |
| Balanced | ≤1.5 | 2048 | 1–2K source | half-resolution bloom, limited masked AO |
| Mobile | 1.0 | 1024 or cheaper grounding | 512–1K source | no volumetric effect; optional low-cost bloom |

These source sizes are not PMREM face/output sizes; the environment pipeline should choose that separately and validate smooth clearcoat/chrome response. Automatic changes should use sustained frame-time thresholds and a cooldown so quality does not oscillate. Always retain an author override for controlled client hardware.

---

## 12. Full engineering audit

### 12.1 P0 — release blockers

| Finding | Evidence/impact | Required remediation |
|---|---|---|
| WebGPU IBL failure | `PMREMGenerator` is used with a WebGPU renderer in `createRenderer.ts`; runtime error leaves the vehicle without reflections. | Use backend-correct environment loading/prefiltering; until WebGPU passes parity goldens, make validated WebGL2 the production default and keep WebGPU behind a QA flag. |
| Normal editing/navigation can irreversibly delete vehicle blobs | `VehicleSession.dispose()` reaches blob deletion during `beforeunload`; replacing a quality slot immediately deletes its previous blob; Clear/New deletes every variant. Undo restores metadata but cannot recover already deleted binary data. | Split GPU/runtime disposal from persistent deletion. Use reference counting/tombstones and deferred, explicit garbage collection. Cover Save → Present → Exit → Reload, Clear → Undo, and Replace variant → Undo. |
| Studio auto-reopen is unreliable | Boot creates a new random project ID and attempts to load that ID; Presentation's key fallback is not recency. | Persist `lastProjectId`, add project metadata and picker, preserve explicit project query IDs. |
| Presentation is local-browser-only | Projects and assets load from IndexedDB; `accessPolicy` is metadata, not enforcement. | Build immutable published manifests and content-addressed hosted assets with real authentication/signed access. Keep current flow labelled Local Preview. |
| State and live scene can diverge | Store snapshots are mutable; route/runtime code changes references directly; Undo does not rehydrate all systems. | Immutable state, all edits through commands, slice-based runtime coordinator, full Undo/Redo parity. |
| Import/project replacement is not atomic | Store can be swapped before vehicle restoration; old runtime content can remain after failure. | Validate and hydrate a staging project/runtime, then make one atomic swap or leave the old project untouched. |
| Material and visibility edits are not durable | Object inspector directly mutates runtime materials and schema lacks overrides. | Add persistent semantic overrides and reapply them after every compatible load/variant switch. |
| Hotspot execution contradicts its schema | `timeRange`, `trackFilter`, reverse behavior, close behavior, and several action types are unimplemented; actions can run on open and again on button click. | One shared, deterministic action compiler/runner with explicit `onOpen`, `button`, and `onClose` triggers. |
| Imported content crosses unsafe HTML/URL boundaries | GLB filename, animation names, extension/warning text, and rig messages are interpolated into `reportEl.innerHTML` without escaping in `studioShell.ts`, approximately lines 1540–1559; validation is shallow and CTA protocols are not allowlisted. | Render those report values with `textContent`/escaped nodes, use strict runtime schemas, approved `https:` URLs, archive limits, and never auto-open navigation actions. |
| Build can be stale or leak prototype content | Root build does not invoke the Automotive Studio build; `automotive-studio/public/_dev/lixiang-mobile-rigged.glb` can be copied by Vite. | Integrate a clean deterministic build and fail artifact inspection on `_dev`, source maps, or unapproved GLBs. Move prototype assets outside `public`. |

### 12.2 P1 — high-priority product and engineering work

| Area | Current issue | Recommendation |
|---|---|---|
| Transform/timeline ownership | Route, embedded animation, wheels, hotspot actions, editing, and camera can operate concurrently; animation uses a separate clock. | One coordinator for time and ownership; editing pauses motion; conflicting claims produce a clear resolution. |
| Vehicle replacement | Previous normalization and rig can be preserved across a different car; current “content hash” is only a weak hint. | Compute SHA-256; automatically reuse bindings only across verified compatible variants; otherwise remap explicitly. |
| Props | Imported props are live-only and not restored/exported/cleared as project state. | Complete persistent prop instances and editing, or hide the feature until it is complete. |
| Store subscriptions | Every command reapplies environment, rebuilds stage geometry/material work, lights, and hotspots. | Subscribe by state slice; mutate safe properties; rebuild only the affected subsystem. |
| Stage sliders/history | Each `input` event creates a full command and quickly exhausts history. | Live preview while dragging, one commit on release/change. |
| Stage texture cache | One shared texture object has repeat/color-space mutated per surface; async results can race. | Share decoded image data but clone sampler textures; cache in-flight promises; cancel/version requests. |
| HDR/EXR stage inputs | The UI accepts HDR/EXR files, but the stage path uses ordinary `TextureLoader`, which is not the correct radiance decoder. | Use `RGBELoader`, `EXRLoader`, or `UltraHDRLoader` as appropriate, or remove unsupported extensions from the control. |
| Model optimization | Mobile remains approximately 14.18 MiB and 675k triangles; no Meshopt transport encoding or KTX2. | Add final Meshopt compression and KTX2/Basis variants after visual review; enforce budgets in CI. |
| Import memory/cancellation | Full GLB is copied into memory; abort rejects the wrapper but parsing can continue; overlapping jobs can commit out of order. | Job IDs, stale-result disposal, transactional batch import, quota/memory preflight, optimized-source guidance. |
| `.iomcar` packaging | Whole-archive memory use; no entry/count/size/ratio limits or integrity verification. | Store already compressed media without DEFLATE, checksums, strict limits, staged validation, streaming where possible. |
| Asset lifecycle | Removed media/maps can remain orphaned and still be exported. | Reachability/reference tracking plus explicit, recoverable orphan cleanup. |
| Rendering loop | Studio and Presentation run continuously; Transport can add another RAF. | Demand-driven invalidation when settled; continuous only for motion/video/editing; pause while hidden. |
| Renderer resilience | No complete device/context-loss recovery or polished poster fallback; resize watches only `window`. The backend `unavailable` state still attempts `new WebGLRenderer`, so a true no-WebGL2/no-WebGPU device can throw. | `ResizeObserver`, backend-loss handling, a real no-GPU branch, retry, and branded fallback image/video. |
| Responsive Studio | At 390 × 844, document/canvas measured about 473 px wide, creating roughly 83 px overflow. | Declare authoring desktop/tablet-only with a clear gate, or implement real mobile drawers and touch targets. |
| Presentation bundle | The stale generated output measured approximately 461 KiB gzip for the Presentation JS+CSS entry; shared code includes authoring/package functionality. | Lazy-load package/editor paths; use ≤400 KiB gzip as a provisional target to validate on the rebuilt output. |
| Source maps | The stale generated output contains roughly 6.81 MiB of maps that can be public. | Disable public production maps or upload privately to diagnostics infrastructure. |
| Three.js version | App pins 0.181.2 while newer releases exist and WebGPU remains experimental. | Do not upgrade during the emergency IBL fix. Run a controlled, visual-regression-backed upgrade spike separately. |
| Preset customization | The first slider edit changes a preset to `custom`, then hard thresholds guess a different visual family. | Retain the explicit base preset plus overrides; never select a look implicitly from one parameter. |
| Exterior self-shadowing | Opaque body meshes can be configured not to receive shadows. | Restore reception for semantic opaque parts and address acne through fitted stable shadow settings. |
| Nested demo caching | The immutable cache rule covers `/assets/*`, not `/demos/automotive-studio/assets/*`; hashed Studio chunks can miss the intended long-term caching policy. | Add and verify an Automotive Studio asset rule with immutable caching only for content-hashed files. |
| Authoring recovery/storage | Large binary projects have no complete debounced autosave, dirty-navigation recovery, quota/eviction plan, or user-facing export escape path. | Add debounced autosave with status, dirty-navigation guard, quota monitoring, `navigator.storage.persist()` handling where available, and recovery/export before storage failure. |
| Accessibility and publish preflight | Keyboard hotspot access, focus restoration, reduced motion, required captions, and validation of broken anchors/actions/media are incomplete. | Treat them as release requirements, not visual polish; fail publish on blocking errors and produce a reviewed warning report for non-blocking issues. |
| Regression foundation | Foundational flows lack automated coverage; the Lixiang inspection test currently exits successfully when its fixture is absent. | Add regression tests within each implementation phase and make required fixtures fail loudly in CI. |

### 12.3 P2 — professional finish

- Project dashboard with thumbnails, client, vehicle, modified date, status, and duplicate/archive controls.
- Branded loading sequence with model download/decode progress and a high-quality poster.
- Shot thumbnails, ordering, naming, transition/hold duration, easing, and per-shot cues.
- Guided and Explore Presentation modes with deterministic reset and Next/Previous/progress.
- Client-approved branding, legal credits, support reference codes, and no developer-facing backend text.
- Enhanced non-blocking preflight guidance, repair shortcuts, and exportable client-approval reports, after blocking validation already works.
- Advanced accessibility refinement and independent assistive-technology review, after keyboard/focus/reduced-motion/caption release requirements already pass.
- Visual “safe area” to prevent hotspots/cards from colliding with vehicle, branding, and navigation.
- Zero-warning console on both backends as a release condition.

---

## 13. Premium hotspot and media design

The current hotspot schema is a useful foundation, but its marker and card implementation is not yet suitable for a high-end presentation.

### 13.1 Marker layer

Replace fixed 0.11 m 3D spheres with a screen-space DOM marker layer driven by projected 3D anchors:

- stable scale independent of camera distance;
- occlusion test with visible/hidden/edge states;
- collision avoidance or clustering;
- optional short leader line;
- a minimum 44 px interaction target;
- visible focus and keyboard navigation;
- accessible list alternative; and
- restrained pulse used only to introduce an unvisited point, disabled for reduced motion.

A proposed premium visual language is a 28–32 px glass/metal ring with a quiet accent center, a short label on focus/hover, and state variations for unvisited, active, visited, unavailable, and action-running. Avoid constant large pulsing circles.

### 13.2 Information card

Use a labelled dialog/card system with:

- title and concise editorial body;
- still image or gallery;
- poster-first video with explicit playback;
- caption/subtitle track and media error state;
- specification rows;
- CTA with validated destination;
- clearly labelled action buttons; and
- focus entry, Escape/close, and focus restoration to the originating marker.

Do not autoplay every video. A global mute control must actually govern all media and authored audio. Async media/card requests need generation IDs so rapidly selecting another marker cannot display stale content.

### 13.3 Action logic

Every action must have an explicit trigger:

```text
onOpen      safe visual setup only; never external navigation
button      user-initiated animation, light, shot, environment, media, or link action
onClose     optional deterministic reset/reverse
```

Support the schema's time range, track filter, reverse action, toggle semantics, and close behavior. Compile filtered clips instead of playing an entire embedded animation. The same central runner must work in Studio Preview and Presentation and preflight every target before publishing.

---

## 14. Publishing and client delivery

The current Presentation page is valuable as a local preview, but a URL sent to another machine cannot access the originating browser's IndexedDB. A professional publish pipeline should create:

1. a validated, immutable project manifest with a schema version;
2. content-addressed model, texture, image, caption, and video assets;
3. an approved quality policy and fallback poster;
4. a preflight report and content/license inventory;
5. a published revision ID that can be rolled back;
6. real access enforcement—authenticated route, expiring signed link, or client portal—applied to every manifest, model, texture, image, and video request with reviewed private-cache behavior; and
7. telemetry limited to explicitly approved operational events.

Authentication and signed URLs are access controls, not DRM. An authorized browser that receives a GLB can technically extract it. For confidential OEM assets, decide explicitly among contractual controls, visible/invisible watermarking or other hardening, reduced-quality client delivery, and controlled streamed rendering. Do not promise technical prevention that a browser-delivered asset cannot provide.

Presentation should never expose internal phrases such as “re-import in Studio”, renderer backend labels, stack traces, or IndexedDB instructions. Show a branded recovery state, Retry, and a diagnostic reference code.

---

## 15. Performance and model-quality direction

### 15.1 Current directional measurements

- Empty settled Studio still runs a continuous render loop.
- With the mobile model loaded, the idle main-thread cost rose materially in a short headless sample.
- The stale generated output contains approximately 1.65 MiB of raw JavaScript and 6.81 MiB of generated source maps.
- Approximate generated-entry gzip including CSS: Studio 473 KiB; Presentation 461 KiB. These are not measurements of a fresh build from the latest audited source.
- The inspected mobile GLB is approximately 14.18 MiB, about 675k triangles, and uses quantization/WebP but no `EXT_meshopt_compression` or KTX2 texture compression.
- Estimated decoded texture memory for that model was roughly 27.5 MiB; compressed transfer size alone is therefore not a GPU-memory budget.

### 15.2 Optimization order

1. Fix correctness and define visual golden shots.
2. Remove idle work and duplicate RAF ownership.
3. Tighten shadows and selective casters.
4. Stop unrelated stage/environment rebuilds.
5. Apply Meshopt transport compression and KTX2 texture tiers.
6. Reduce Presentation-only bundle and lazy-load authoring/package code.
7. Add adaptive quality based on named capability tiers, not only user-agent checks.

Every optimization must be judged against fixed-camera reference renders. A smaller GLB is not acceptable if glass, lighting graphics, paint normals, wheel detail, or animation topology visibly degrades.

---

## 16. Recommended implementation program

The effort bands below are planning ranges for one experienced engineer working with prompt visual/design review. They are not a delivery commitment and will change after the first renderer spike.

### Phase A — data, state, rights, and reproducibility (approximately 6–10 engineering days)

- Split runtime disposal from persistent deletion; add tombstones/reference tracking and deferred garbage collection.
- Fix deterministic project reopen and project selection.
- Establish an immutable store boundary and a slice-based runtime coordinator before new environment/material migrations are built.
- Make project/import replacement atomic and define the minimum action/time/transform ownership contract.
- Add debounced autosave, dirty-navigation recovery, storage quota/persistence handling, and an emergency export path.
- Move prototype GLBs outside Vite public assets.
- Integrate Automotive Studio into the intended build and artifact checks.
- Add strict URL/content escaping and initial project/archive validation.
- Resolve client-use and redistribution rights for the vehicle, trademarks, textures, environment/media assets, and required credits.
- Freeze four representative camera/model golden scenes on both backends.
- Add phase-level regression tests for disposal, Clear/Undo, Replace/Undo, atomic failure, reopen, and required-fixture enforcement.

**Exit:** normal navigation/editing never irreversibly deletes referenced data; Undo and failed imports restore a coherent live scene; the same local project reliably reopens; rights are documented; the production artifact contains no development model or public source maps; test scenes are reproducible.

### Phase B — validated renderer path and environment core (approximately 4–7 days)

- Replace the invalid WebGPU PMREM path.
- Implement backend capability adapters.
- Decide the launch policy: certify WebGPU, or default to validated WebGL2 and place WebGPU behind a QA/capability flag.
- Introduce the correlated Environment Controller.
- Separate camera exposure, IBL intensity, and direct-light power.
- Remove explicit material environment maps from the normal polish path.
- Add cached, matching IBL assets for four presets.

**Exit:** the selected production-default backend has no IBL error or reflection/background mismatch. If WebGPU is a launch requirement, fixed Studio/Day/Golden/Night shots demonstrate comparable artistic intent on WebGPU and WebGL2; otherwise the unqualified WebGPU path cannot be selected by clients.

### Phase C — sky, sun, moon, stars, and stage policy (approximately 5–8 days)

- Make all exterior sky elements camera-relative.
- Disable/open the cyclorama for exterior presets.
- Add the NASA lunar texture, phase, angular-size, and aureole implementation.
- Align sun/moon discs with their directional lighting.
- Replace random stars with deterministic magnitude/spectral behavior.
- Add environment transitions without per-frame PMREM generation.

**Exit:** all celestial elements are visible when expected, stable across route motion, physically coherent by default, and art-directable within safe limits.

### Phase D — persistent materials and semantic vehicle lighting (approximately 5–9 days)

- Add material/node overrides to schema, migrations, Undo/Redo, export, and Presentation.
- Make automatic material normalization optional and reversible.
- Create semantic vehicle-light mapping and UI.
- Add controlled light proxies and selective bloom on both backends.
- Validate white paint, black paint, chrome, glass, interior, and emissive reference materials.

**Exit:** every edit survives reload/quality switch/export and vehicle lights can be triggered predictably by hotspots/timeline.

### Phase E — stage, shadows, camera, and performance (approximately 4–7 days)

- Build a true studio cove and exterior ground policy.
- Fit shadow frusta, add quality tiers, and replace the heavy contact blob.
- Add approved camera templates and correct semantic bounds/dimensions.
- Implement invalidation rendering, hidden-tab pause, and one time owner.
- Remove stage/material rebuild churn and async texture races.

**Exit:** hero shots are well framed, stable, grounded, and meet desktop/mobile performance budgets without idle rendering.

### Phase F — actions, hotspots, and publishable Presentation (approximately 8–15 days)

- Complete the semantic action compiler and advanced ownership behavior on the Phase A contract.
- Premium accessible hotspot markers and rich media cards.
- Guided/Explore modes and real Studio Preview.
- Immutable hosted publish format and access control integration.

**Exit:** a clean browser can open an authorized client URL and reproduce the approved project, media, interactions, and appearance without local Studio state.

### Phase G — qualification and client polish (approximately 3–6 days)

- Execute the final browser/device, accessibility, context-loss, security, persistence, and package qualification matrix; foundational tests were added with their owning phases.
- Visual regression and performance capture on named hardware.
- Copy, credits, branding, error states, and support flow review.
- Verify the already-approved legal/license inventory against the exact artifact and complete the release checklist.

**Exit:** all gates in the next section pass and a rehearsal presentation completes without developer intervention.

---

## 17. Measurable acceptance gates

The performance, bundle, and model budgets below are **provisional target-hardware gates**, not universal correctness thresholds. Confirm them against named client devices and the approved fixed-camera visual references before freezing release criteria.

### Data and delivery

- Save, close, reopen, and restore the identical project and every asset through three cycles.
- Unload/runtime disposal deletes no persisted asset.
- Clear → Undo and Replace quality variant → Undo restore both metadata and the exact referenced binary; garbage collection removes only proven unreferenced tombstones.
- A published URL opens in a clean authorized browser with empty IndexedDB.
- Every published manifest and asset request is authorized according to the selected policy and uses reviewed private/immutable cache behavior.
- Material, visibility, environment, hotspot, rig, route, and light states survive reload, quality switching, package round-trip, and Presentation.
- Import failure leaves the previous project/runtime completely intact.
- Autosave/recovery survives a forced refresh; quota pressure produces a clear recovery/export path before data loss.
- Production artifact contains no `_dev` path, unapproved GLB, development source map, or unreviewed license asset.

### Visual quality

- Fixed-camera golden renders exist for all four presets on the production backend and forced WebGL2; WebGPU has equivalent goldens before its QA flag can be removed.
- No runtime IBL, shader, device, texture, or context error in the approved browser matrix.
- Background, IBL reflections, direct-light direction, shadow direction, and celestial source agree in every preset.
- In a declared color-managed output space and locked reference exposure, shot-specific regions of interest use approved luminance thresholds/masks and reference-image comparison to detect unintended clipping or lost shadow detail. Intentionally black paint/background and authored sun/emissive regions are masked separately, and every automated result receives human visual approval.
- Moon and sun default to approximately 0.53° apparent diameter and do not show translational parallax.
- Stars remain deterministic and route-independent, fade correctly by atmosphere/exposure, and do not appear through opaque geometry.
- Vehicle paint preserves readable curvature in white and black reference finishes.
- Glass has no obvious sorting, opacity, black-background, or double-surface failure in approved hero shots.
- No shadow acne, peter-panning, oversized contact blob, or visible shadow-frustum transition.
- Selective bloom affects only approved light/celestial masks and retains texture/detail inside lamps.

### Performance

- Settled Presentation renders no more than five frames over five seconds and uses under 5% of one CPU core on target hardware, excluding active animation, camera damping, video, environment transitions, and direct interaction.
- Desktop at 1920 × 1080: median at least 55 FPS and 1% low at least 45 FPS in the agreed hero/tour scene.
- Mobile Presentation at 390 × 844: median at least 30 FPS with the mobile variant.
- No horizontal overflow at 320, 390, 768, 1024, and 1440 px for Presentation.
- Mobile model target: ≤10 MiB preferred, ≤500k triangles, and estimated GPU textures ≤64 MiB, assessed together with draw calls, material/transmission passes, shadow passes, animation cost, and fixed visual references.
- Balanced model target: ≤25 MiB; high presentation model target: ≤30 MiB, unless a signed quality exception documents the reason.
- Initial Presentation JavaScript ≤400 KiB gzip.
- Twenty quality switches and 300 stage-slider events return renderer geometry/texture counts to baseline with no stale async result.

### Interaction and accessibility

- Every hotspot is reachable by pointer, keyboard, and an accessible alternative list.
- Focus enters and exits the hotspot card correctly; Escape and reduced motion work.
- Video has poster, controls, error state, global mute integration, and captions where speech/information requires them.
- No external link opens without a deliberate user action and an approved protocol.
- Action ranges, filters, forward/reverse, toggle, close behavior, and conflict ownership have deterministic automated tests.
- Guided and Explore tours can be reset to the same starting state every time.

### Resilience and security

- Malformed/oversized project and `.iomcar` inputs fail before runtime mutation.
- Context/device loss recovers or shows a branded poster with Retry and a diagnostic code—never a blank viewport.
- Model, media, action, and URL inputs pass strict runtime validation.
- No untrusted imported string is injected as HTML.

---

## 18. Decisions to make before implementation

These are the few product choices that materially affect architecture:

1. **Presentation hosting:** private authenticated portal, expiring signed link, or public unlisted revision. Recommendation: authenticated/signed access for high-profile client work.
2. **Default exterior style:** pure horizon/ground, photographic HDR location, or minimal architectural stage. Recommendation: one minimal premium exterior per Day/Golden/Night, with optional approved HDR packs later.
3. **Physical time mode:** needed in the first client release or later. Recommendation: later; ship authored reliable presets first.
4. **Studio mobile authoring:** full support or explicit desktop/tablet minimum. Recommendation: explicitly desktop/tablet for authoring initially; make Presentation excellent on mobile.
5. **Rights and confidentiality:** whether the vehicle model, trademarks, textures, animations, environment/media assets, and derivative optimized files may be used and redistributed in this client context, including whether visible credit geometry may be removed. Recommendation: resolve this in Phase A and move required attribution to a premium Credits panel only where the governing terms permit it.
6. **Three.js upgrade:** remain on 0.181.2 for stabilization or include an upgrade spike. Recommendation: stabilize the IBL architecture first, then run a separate current-release spike with golden tests.

---

## 19. Immediate next action

Do not begin with a moon texture swap or star styling in isolation. Begin with a short **Renderer and Persistence Stabilization milestone**:

1. protect saved assets, deterministic reopen, immutable runtime coordination, and atomic import/Undo behavior;
2. establish a correct IBL path on the production-default backend—either certified WebGPU/WebGL2 parity or validated WebGL2 with WebGPU behind a QA flag;
3. expose sky/celestials by applying the correct stage policy;
4. freeze four approved visual references; then
5. implement the NASA Moon, sun, stars, and emissive vehicle-light system against those references.

This order produces visible improvement quickly while ensuring that the work remains correct when the project is saved, reopened, quality-switched, published, and viewed on any backend declared client-ready.

---

## 20. Authoritative external references

- [Three.js WebGPU renderer manual](https://threejs.org/manual/en/webgpurenderer)
- [Three.js WebGPURenderer API](https://threejs.org/docs/pages/WebGPURenderer.html)
- [Three.js PMREMGenerator API](https://threejs.org/docs/pages/PMREMGenerator.html)
- [Three.js Scene background/environment controls](https://threejs.org/docs/pages/Scene.html)
- [Three.js SkyMesh API](https://threejs.org/docs/pages/SkyMesh.html)
- [Three.js UltraHDRLoader API](https://threejs.org/docs/pages/UltraHDRLoader.html)
- [Three.js BloomNode API](https://threejs.org/docs/pages/BloomNode.html)
- [Three.js color-management guide](https://threejs.org/manual/en/color-management.html)
- [NASA Scientific Visualization Studio CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/)
- [NASA Scientific Visualization Studio Deep Star Maps 2020](https://svs.gsfc.nasa.gov/4851/)
- [NASA images and media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)
- [Poly Haven CC0 license](https://polyhaven.com/license)
- [Poly Haven HDRI library](https://polyhaven.com/hdris)
- [Three.js official releases](https://github.com/mrdoob/three.js/releases)

For production environment imagery, download and store a reviewed local copy with source, license, checksum, conversion settings, and intended preset recorded in the asset inventory. Poly Haven is one suitable CC0 source; it is not the only acceptable source.

---

## 21. Audit change record

- No Automotive Studio source file was changed.
- No built demo file was changed.
- No model, texture, or project data was changed.
- No production build or deployment was run.
- Temporary browser screenshots used for inspection were outside the repository.
- This report is the sole file added by the audit.
