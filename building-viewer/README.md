# IOM Building Viewer

Professional reusable Web 3D building viewer (TypeScript + Three.js + WebXR).

## Local development

```bash
# Install viewer deps
npm --prefix building-viewer install

# Dev server (viewer only)
npm run dev:building-viewer

# Production bundle → public/demos/building-viewer/ (also runs from root `npm run build`)
npm run build:building-viewer
```

Open: http://localhost:5192/ (package dev) or `/demos/building-viewer/` after a root/site build.

Do **not** add `"cellManifest"` on `icm-anim-2025`. The current 925-cell bake is position-only and breaks floor animation. See `VISUAL_REALISM_AND_HIGH_FPS_REVISION_PLAN.md`.

## Models

Manifest: `public/models/manifest.json`. Optimize / validate from repo root:

```bash
npm run model:validate
npm --prefix building-viewer run model:optimize -- --input <src.glb> --out public/models/<id> --name model
```

## Controls

- **Orbit** — left drag rotate, wheel/pinch zoom, Reset View
- **Walk** — drag the person icon onto a valid floor, then WASD + pointer lock (Shift = run, Esc = unlock)
- **Exit Walk** — restores previous orbit camera
- **Enter VR** — shown when `immersive-vr` is supported
- **Drag & drop GLB** — local preview (browser File API; no upload)
- `?debug=1` — reserved for collision/capsule helpers

## Optimization

Uses the same glTF Transform / meshoptimizer / sharp stack as `automotive-studio/scripts/optimize-model.mjs`, plus **KTX2/Basis** (`ktx2-encoder`): ETC1S for opaque color, UASTC + mipmaps for normals/ORM/alpha/glass. Pass `--no-ktx2` to keep JPEG/PNG only.

### Cell streaming (Phase C)

**Do not enable in production until bake validation passes.** The old whole-mesh bake duplicated geometry (~4.7 GiB). The current baker uses **triangle ownership** (centroid → one cell).

```bash
# Rebuild cells (keeps streaming OFF in manifest until you add cellManifest)
npm run model:cells -- --input public/models/icm-anim-2025/model-web.glb

# Asset contract check
npm run model:validate
```

Only add `"cellManifest": "/models/<id>/cell-manifest.json"` after `model:validate` reports OK and walk/orbit look complete.

Walk-only coarse proxies (floors/stairs/ramps — no walls, simplified):

```bash
npm run model:collision -- --input public/models/icm-ext/model-web.glb --walk-only --simplify
npm run model:collision -- --input public/models/icm-anim-2025/model-web.glb --walk-only --simplify
```

Writes `collision.glb` as `COLLIDER_*` meshes. Point the manifest at `"collision": "/models/<id>/collision.glb"`.
Both production models use their validated dedicated collision GLBs. Visual geometry is built only as a fallback when a dedicated file is missing or fails runtime validation; it is not merged back into Walk or XR.

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
