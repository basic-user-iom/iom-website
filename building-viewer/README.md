# IOM Building Viewer

Professional reusable Web 3D building viewer (TypeScript + Three.js + WebXR).

## Local development

```bash
# Install exactly the viewer dependencies in package-lock.json
npm --prefix building-viewer ci

# Dev server (viewer only)
npm run dev:building-viewer

# Production bundle → public/demos/icm-building/
npm run build:building-viewer
```

Open: http://localhost:5192/ (package dev) or `/demos/icm-building/` after building the viewer.

Do **not** add `"cellManifest"` on `icm-anim-2025`. The current 925-cell bake is position-only and breaks floor animation. See `VISUAL_REALISM_AND_HIGH_FPS_REVISION_PLAN.md`.

## Models

Manifest: `public/models/manifest.json`. Optimize and validate from the repository root:

```bash
npm run model:validate
npm run model:gate
npm run model:optimize -- --input <src.glb> --out public/models/<id> --name model
```

`model:validate` is the normal integrity check used by the viewer build. It reads
Meshopt-compressed visuals/collision files, prints stored and node-expanded
triangles/draws, and warns about stale reports. `model:gate` is the release gate:
it requires a report whose SHA-256 and expanded workload match each active GLB,
enforces Web/Quest full-asset budgets, and fails on every warning.

## Controls

- **Orbit** — left drag rotate, wheel/pinch zoom, Reset View
- **Walk** — drag the person icon onto a valid floor, then WASD + pointer lock (Shift = run, Esc = unlock)
- **Exit Walk** — restores previous orbit camera
- **Enter VR** — shown when `immersive-vr` is supported
- **Drag & drop GLB** — local preview (browser File API; no upload)
- `?debug=1` — reserved for collision/capsule helpers

## Optimization

The preprocessing optimizer pins glTF Transform 4.4.2, meshoptimizer 1.2.0,
sharp 0.35.3, and `ktx2-encoder` 0.6.0. It uses ETC1S for opaque color and
UASTC with mipmaps for normals/ORM/alpha/glass. Pass `--no-ktx2` only for a
raster diagnostic build; KTX2 encoder failures abort release output instead of
silently producing a mixed file.

The authoritative final compression stage is the native **gltfpack 1.2**
wrapper. Its release URL, archive/executable SHA-256 values, and exact Web/Quest
arguments are pinned in `toolchain/gltfpack-1.2.json`. The wrapper preserves
names, material names, extras, unused UV1 attributes, and explicitly declared
animation sampling; it adds EXT_meshopt compression, role-aware KTX2, and
eligible GPU instancing. It removes empty scenes only when exactly one
populated scene remains, and refuses sources with multiple populated scenes;
gltfpack instancing can otherwise attach content to the wrong scene.

```bash
# Verify version + executable hash without changing an asset
npm --prefix building-viewer run tool:gltfpack:check

# Print the exact command without writing output
npm run model:gltfpack -- --input <preprocessed.glb> --output <release.glb> --profile web --dry-run

# Produce a new file plus <release.glb>.provenance.json (never overwrites by default)
npm run model:gltfpack -- --input <preprocessed.glb> --output <release.glb> --profile web
```

For CAD exports containing one populated scene plus empty scene slots, normalize
the scene list losslessly before compression. For the animated building, batch
only within animation-safe hierarchy/spatial groups before the final gltfpack
stage:

```bash
npm run model:normalize-scenes -- --input <source.glb> --out <single-scene.glb>
npm run model:batch -- --input <prepared.glb> --out <batched.glb>
```

`model:batch` preserves animated transform targets and excludes transparent
materials from offline joins. `--flatten-static --join-scene-root` is an
advanced, opt-in pass and must be followed by animation and semantic QA.

For an animated 24 Hz source, add `--animation-fps 24`. The wrapper requires an
explicit rate, verifies it against source key timing, and refuses gltfpack's
implicit 30 Hz resampling.

On Windows, extract the official archive to
`building-viewer/tmp/tools/gltfpack-v1.2/gltfpack.exe`, or set
`IOM_GLTFPACK_PATH`. Never substitute an unversioned binary. Legacy assets that
passed through gltfpack 1.1 are historical; regenerate with 1.2 and a current
provenance report before release.

### Physical texture scale

Architectural ground textures are validated in world units at runtime, not by
UV range alone. Paving and landscape outliers are projected at 1.5 m per repeat;
already-correct authored UVs remain untouched. Valid tiled CAD UVs can exceed
1,000 units and must not be normalized. The gltfpack missing-UV fallback follows
the same metric policy so a future rebuild cannot stretch one texture across an
entire plaza.

`npm run test:visual-correctness` covers collapsed 0–1 paving UVs, shared
material isolation, high-range authored UV preservation, KHR repeat
compensation, water cleanup, and idempotence. The normal `npm run build` runs
this suite automatically.

### Surface visibility and mirrored packing

Architectural open shells are selected per primitive/use and retain
`iomDoubleSidedReason` through material deduplication and final compression.
Closed furniture and wall volumes remain single-sided. Imported/procedural
shared draws reject item transforms whose determinant would reverse winding
inside one `InstancedMesh` or `BatchedMesh`.

```bash
npm run model:audit-surfaces -- --input ../public/models/icm-anim-2025/model-web.glb
npm run test:surface-visibility
npm run qa:surface-visibility
```

The browser QA checks authored reasons/roles, exact audited exterior and
interior targets, active packed-item determinant signs, WebGL errors, and
focused opposing-angle captures. Do not replace these selective rules with a
global `DoubleSide` mutation.

### Cell streaming (Phase C)

**Do not enable in production until bake validation passes.** The old whole-mesh bake duplicated geometry (~4.7 GiB). The current baker uses **triangle ownership** (centroid → one cell).

```bash
# Rebuild cells for a static model (keeps streaming OFF in the manifest)
npm run model:cells -- --input public/models/<static-id>/model-web.glb

# Asset contract check
npm run model:validate
```

Never run the current flattening cell baker on an animated floor/building model.
Only add `"cellManifest": "/models/<id>/cell-manifest.json"` after
`npm run model:validate -- --require-cells` reports OK and walk/orbit look complete.

Animation-aware streaming uses a separate manifest-v3 contract. Its current
`1st Floor._anim1` fixture is deliberately disabled and contains no production
packages. It gates persistent rig ownership, owner-local transforms/bounds,
source/rig hashes, required attributes, LOD0/HLOD declarations, and resident
budgets without enabling the historical 925 position-only cells:

```bash
npm run test:hlod-contract
npm run test:hlod-runtime
npm run model:plan-first-floor-pilot
node scripts/validate-animation-package-manifest-v3.mjs <manifest-v3.json> --asset-root ../public
```

The runtime gate covers persistent-rig binding, owner-local transforms, HLOD-first
swaps, cancellation, resource isolation, resident budgets, and monolithic fallback.
`model:plan-first-floor-pilot` audits the current Web/Quest partition without writing
assets. `model:build-first-floor-pilot` writes the disabled lossless detail-package
and DCC handoff set below `building-viewer/tmp/`; it never edits production assets.

Walk-only coarse proxies (floors/stairs/ramps — no walls, simplified):

```bash
npm run model:collision -- --input ../public/models/icm-ext/model-web.glb --out ../public/models/icm-ext/collision.glb --walk-only --simplify
npm run model:collision -- --input <semantic-prebatch-animated.glb> --out ../public/models/icm-anim-2025/collision.glb --walk-only --simplify
npm run model:collision-coverage:all
```

Writes `collision.glb` as `COLLIDER_*` meshes. Point the manifest at `"collision": "/models/<id>/collision.glb"`.
Both production models use their validated dedicated collision GLBs. Visual geometry is built only as a fallback when a dedicated file is missing or fails runtime validation; it is not merged back into Walk or XR.
For animated/CAD scenes, extract from the last file that still has semantic node owners. A globally batched visual can retain material names while losing the stair owner names needed to distinguish treads from reused materials on doors, lights, and furniture. The extractor preserves stair topology, separates mixed stair/floor primitives, enforces the runtime-expanded triangle budget, and fails rather than writing an unsafe over-budget proxy. Never promote a generated collider unless `model:collision-coverage:all` passes.

The dormant manifest-v3 route has an additional, fail-closed activation gate.
Its evidence is generated from the exact post-build browser collision geometry
and the production Web visual-model coverage grid:

```bash
npm run model:collision-evidence:inspect
npm run model:collision-evidence:generate  # writes reviewed pins intentionally
npm run model:collision-evidence:check     # normal CI/release preflight
```

`collision-coverage-v1.json` binds authored spawn, walk, landing, and stair
probes plus broad multi-level coverage to the collision SHA/byte count and exact
runtime triangles, chunks, bounds, and collider count. The separately pinned
`collision-activation-v1.json` sets the acceptance thresholds. An enabled
`hlodStreaming` entry must supply both pinned JSON assets under
`collisionActivation`; missing, stale, mismatched, or malformed evidence falls
back to the complete monolithic GLB before streamed render packages initialize.
The production manifest remains unchanged and does not enable this route.

### Quest test harness (Phase D)

In the browser console:

```js
__iomQuestTest.start('lobby')
__iomQuestTest.stop()
__iomQuestTest.download()
```

Or click **Perf** in the toolbar to fly every camera view and download JSON.

Pass bar: min FPS ≥ 72 and CPU p95 ≤ 13.89 ms; GPU p95 too when timer queries exist. Desktop 60 FPS is not a Quest result.

Decoders are self-hosted at `/basis/` and `/draco/gltf/` (no CDN). Pass `?probeSize=1` to restore the optional HEAD size probe.

Building profiles: `web`, `quest`.
