# Precision object study

Premium 3D product presentation prototype at:

```text
/demos/precision-object/
```

Password-gated (same overlay pattern as Kelly Kettle / ICM). Default unlock: `precision`. Override with `VITE_PRECISION_OBJECT_DEMO_PASSWORD`. Not listed on the public homepage or sitemap.

It is a capability study for precision-manufactured objects. The current file is a watch GLB used as a stand-in. Do not describe it as a Kinu product.

## Setup

From the IOM website root (`F:\iom_website`):

1. Place the model at `public/models/Watch.glb`.
2. Place the environment at `public/env/EveningSkyHDRI027B_2K_HDR.exr`.
3. `npm install` (if needed).
4. `npm run dev`
5. Open http://localhost:5173/demos/precision-object/

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local Vite server, including this MPA route |
| `npx tsc -b --pretty false` | Typecheck |
| `npm run build` | Full site production build (includes this demo) |

## Environment (HDR)

The viewer follows the Three.js UltraHDR example pattern: load an equirectangular radiance map, set `texture.mapping = EquirectangularReflectionMapping`, then assign it to `scene.environment` (metal/glass reflections) and `scene.background` (dimmed + slightly blurred so the page copy stays readable).

This file is EXR, not UltraHDR JPEG, so it is decoded with `EXRLoader`. If the EXR is missing, a `RoomEnvironment` fallback is used.

## PBR maps

The **PBR** chip (on by default) applies AmbientCG Metal049A 2K maps from `public/textures/metal049a/`:

- Stand: color, roughness, metalness, OpenGL normal, and a light displacement.
- Watch metal parts: the same maps, multiplied by the authored metal color so the object keeps its hue. Dial, glass and black materials stay untextured.

Turn the chip off to return to the untextured studio look.

## Look studio

Open **Look** in the viewer toolbar. It is a working session, not the baked final:

1. **Stand / Watch metal** — pick Metal 049A, None, or Load maps (color / roughness / metalness / normal / displacement files).
2. **Sun** — yaw and pitch rotate the HDRI (environment + background together).
3. **Shadows** — real key-light shadows on the PBR stand (on/off, intensity, softness) plus an optional contact blob.
4. **Materials** — metalness, roughness, env, color; glass also has transmission and IOR.
5. **Hotspots** — turn on Place, select 01–04, click the object surface (not the floor).
6. **Save look** — copies JSON (and stores it in the browser). Paste that JSON in chat when you want it as the default.

Custom uploads preview until reload; the saved JSON keeps the filenames so they can be copied into `public/textures/`.

## Replace the model

Keep the viewer and change configuration only:

1. Replace `public/models/Watch.glb` with the real product GLB.
2. Edit `src/demo/precision-object/productConfig.ts`:
   - `modelUrl` if the filename changes
   - `envUrl` if the HDR/EXR filename changes
   - copy (`heroTitle`, CTA, story, hotspots)
   - `HOTSPOTS[].position` as fractions of the bounding box
   - `CAMERA_PRESETS` if framing needs a different three-quarter / detail / top
   - `modelRotation` if the new file faces the wrong way
   - `explodePartNames` only when the GLB has true mechanical parts

The supplied watch is **not** exploded: its meshes are material layers (`Watch_metal_0`, `Watch_Glass_0`, …), not separable assemblies.

## Notes

- Stack: existing Vite + React + TypeScript + Three.js. No React Three Fiber.
- Glass is adjusted to a physical/transparent material because the file ships glass as metallic BLEND.
- Visual direction is Kinu-like (dark, quiet, product-led) without copying Kinu assets.
- Motion uses clip `Armature|Action` (second-hand) when the bind survives. The viewer scales a wrapper group rather than the skinned scene so GPU skinning can keep its bind pose. Motion starts on unless `prefers-reduced-motion`.
