# Automotive Studio — Phase 3 notes

**Date:** 3 August 2026  
**Source (untouched):** `F:/FREE_Lixiang_L9_2024_(White_Interior)/FREE_Lixiang_L9_2024_(White_Interior).glb`  
**Output dir:** `F:/FREE_Lixiang_L9_2024_(White_Interior)/optimized/`

## Commands

```bash
npm run optimize:automotive              # all variants (runs under automotive-studio deps)
npm run optimize:automotive:high
npm run rig:lixiang-wheels               # master-only pivots (~source size)
npm run rig:lixiang-wheels:variants      # bake pivots into High/Balanced/Mobile
```

## Variants (internal / prototype only — not published)

| Variant | File | Size | Tris | Gate |
|---|---|---:|---:|---|
| High | `lixiang-presentation-high.glb` | **35.48 MiB** | 1,928,682 | ≤30 miss; **≤35 hero exception approved for prototype** |
| Balanced | `lixiang-balanced.glb` | 24.76 MiB | 1,253,847 | OK mid tier |
| Mobile | `lixiang-mobile.glb` | **14.17 MiB** | 675,453 | ≤15 pass |
| High + pivots | `lixiang-presentation-high-rigged.glb` | 35.48 MiB | same | Phase 4 authoring |
| Balanced + pivots | `lixiang-balanced-rigged.glb` | 24.76 MiB | same | Phase 4 authoring |
| Mobile + pivots | `lixiang-mobile-rigged.glb` | 14.17 MiB | same | Phase 4 authoring |
| Wheels rigged (master) | `lixiang-wheels-rigged.glb` | ~150–175 MiB | source | optional; prefer *-rigged variants |
| Manifest | `vehicle-rig.manifest.json` | — | — | FL/FR/RL/RR → RollingPivots |

### High hero exception (prototype)

Presentation High lands at **35.48 MiB** (plan target ≤30, optional hero ceiling 35). For this internal Lixiang prototype we keep High as-is — further texture/mesh cuts can wait until visual A/B against a tighter bake. Mobile stays under 15 MiB.

Animation preserved: **16 channels · 14.542s**. Textures: **15/15 decodable WebP**.

Pipeline: weld → dedup → prune → resample → optional simplify → textureCompress (WebP) → quantize → prune. **No flatten**.

## Optimizer pitfalls fixed (3 Aug 2026)

1. **Corrupt WebP / Studio import failure** — earlier High GLBs labeled textures `image/webp` but stored garbage bytes. Optimizer now **re-reads and sharp-decodes** every texture after write.
2. **Must run under `automotive-studio/` deps** — root `node_modules` sharp/gltf-transform copies produced bad WebP; `npm run optimize:automotive` delegates there.
3. **Temp path must end in `.glb`** — `file.glb.tmp` made NodeIO write a non-GLB (~200 KiB). Uses `file.glb.tmp.glb` → rename.

## Wheel re-rig

- Front: `FL_RollingPivot` / `FR_RollingPivot` under steering roots — animation preserved.
- Rear: single combined `Rear_RollingPivot` (broken Z-split removed). RL/RR share one roll axis until a proper L/R bake.
- Prefer `npm run rig:lixiang-wheels:variants` so authoring uses pivoted High/Balanced/Mobile, not the 150 MB master.

### Pivots must sit at the hub centre (fixed 4 Aug 2026)

The first bake created pivots at `[0,0,0]` in the steering node's space. The tire meshes are offset from that origin, so rolling **orbited** the wheels on a wide arc instead of spinning them — tires flew out of the arches. The script now measures each wheel's mesh bounds, places the pivot at that centre, and subtracts the offset from the children.

Measured on the High variant (steering-local units):

| Pivot | Hub centre | Wheel size | Note |
|---|---|---|---|
| `FL_RollingPivot` | `[0.00, -2.93, 0.00]` | `[19.73, 7.85, 19.73]` | thin axis = axle → local **Y** |
| `FR_RollingPivot` | `[0.00, 0.00, 0.00]` | `[19.73, 7.85, 19.73]` | |
| `Rear_RollingPivot` | `[-9.96, 0.00, -33.15]` | `[19.73, 48.27, 19.73]` | spans both rear wheels on the shared axle |

The combined rear pivot is geometrically valid: its origin lies on the axle line running through *both* rear hubs, so one rotation spins both wheels correctly in place.

Vehicle measures 186.1 units → 5.1 m, so tire radius ≈ 0.28 m. `axleAxis` and `radiusMetres` in the manifesto are **hints only** — see runtime calibration below.

Debug helper: `node automotive-studio/scripts/inspect-wheel-pivots.mjs [glb]`.

### Heading offset

Route yaw aims the placement root's local **+Z**, but this asset's nose is along **+X**, so following the path needed a **−90°** yaw offset. Studio derives it from whether the vehicle is longer along local X or Z, and shows it as "Heading fix" in the Route panel.

## Studio runtime

- Import High/Balanced/Mobile (or `*-rigged`); Active quality switching; rig manifesto import.
- Meshopt + KTX2 Basis under `/demos/automotive-studio/basis/`.
- Phase 4 MVP: Route panel → demo oval + transport Play + distance-linked tire roll on RollingPivots.
- Re-import the **regenerated** High/Mobile / `*-rigged` files after the texture fix.

### Smooth cornering (fixed 4 Aug 2026)

The demo oval is 24 points. Sampling that as a **polyline** gives a heading that is constant
per segment and snaps ~15° at every vertex, which reads as jerking through corners. The route
is now driven along an arc-length parameterized **Catmull-Rom spline** (`routeCurve.ts`,
centripetal, 600+ arc divisions) so position and tangent stay continuous. The guide line is
drawn from the same spline so the drawn path matches the driven path.

Two related snaps also fixed:

- **Once-per-lap wheel snap** — roll used the wrapped `distanceAlong`, which resets to 0 each
  lap and jumped the tire angle. Roll now accumulates a monotonic distance from the shortest
  signed delta.
- **Speed-change teleport** — transport time maps to distance via speed, so changing speed
  moved the car along the path. Transport time is now rescaled to preserve lap position.

### Tire roll speed

Route panel has a **Tire roll speed** multiplier (0.3–2.0×) on top of the measured radius, since
the measured ~0.28 m is smaller than the real L9 tire and spins slightly fast. The stats line
reports the equivalent radius so a slip-free setting can be dialled in.

### Front-wheel steering from path curvature (4 Aug 2026)

The front uprights now steer with real geometry instead of a lookahead guess:

- **Angle** — `tan(δ) = wheelbase × κ`, where κ is the signed curvature of the spline (centred yaw
  difference over ±0.4 m) and the wheelbase is measured between the front and rear hub midpoints,
  so it needs no tuning per model. Clamped to a **Steering lock** slider (default 35°).
- **Axis** — the old code set `steering.rotation.y`, but the Lixiang uprights carry a quaternion of
  `[0.5, -0.5, -0.5, 0.5]`, so local Y is *not* world up: the wheels cambered instead of steering.
  The axis is now calibrated the same way the axle is — nudge each local axis both ways and keep
  whichever swings a point ahead of the hub sideways (`up × forward`). This also survives the
  mirrored `FL_Wheel.001` instance, which a quaternion-only derivation steers backwards.
- **Smoothing** — eased over **distance** (`1 - e^(-Δs/0.6 m)`), not frames, so the response is
  identical at 30 and 144 fps.
- **Oval widened to rx 9.5 / rz 7.5 m.** At the old 6.5 × 4.2 the tightest radius was 2.7 m —
  half the real turning circle — so the wheels would sit pinned at full lock the whole lap. The
  new tightest radius (rz²/rx ≈ 5.9 m) matches an L9 and peaks around 28° of steer. Still inside
  the 24 × 24 m floor.

Steering is applied even when *Distance-linked tire roll* is off, since the two are independent.

### The car is parked at 27° inside its own scene (fixed 4 Aug 2026)

Two compounding bugs made the body sit beside the path at an angle:

**1. `measureCarBounds` never pruned excluded subtrees.** `Object3D.traverse()` always visits
children — returning early from its callback skips only that one node. The floor promo caption
`Text.001_33` therefore counted toward the vehicle bounds. It sits ~45 units past the bumper:

| Bounds | Size | Centre | Implied scale | Tire radius |
|---|---|---|---|---|
| everything | `[106.1, 46.4, 190.3]` | `[-8.4, 2.8, -511.9]` | 0.02680 | 0.277 m |
| old regex (drops `discord` only) | `[106.1, 46.4, 186.1]` | `[-8.4, 2.8, -514.0]` | 0.02741 | 0.284 m |
| **pruned subtrees + promo text** | `[106.1, 46.4, 141.0]` | `[-8.4, 2.8, -536.5]` | 0.03616 | **0.374 m** |

0.374 m is the real L9 tire radius, so the car had been scaled ~26% small and its centre was
0.89 m off the body — and the tires spun ~35% fast, which matches "maybe a little too fast".
`measureCarBounds` now walks manually and prunes. Note `sketchfab` was removed from the regex:
the wrapper root is literally `Sketchfab_model`, so pruning on it would discard the whole car.

**2. Heading came from box proportions, which cannot see a rotated car.** Wheel hub positions
show the vehicle faces ~27° off +Z in its own scene:

```
FL hub [ 29.7, -10.1, -509.3]   FR hub [-8.1, -10.1, -489.8]
rear   [-25.5, -10.1, -569.5]   → forward (36.3, 0, 69.95) = 27.4° off +Z
```

A diagonal car just yields a wider bounding box (141 × 106 matches a 5.2 × 2.0 m body rotated
27°), so the X-vs-Z test reported a 0° heading fix. The wheel rig is now authoritative: forward
is front-axle-midpoint minus rear-axle-centre, and the **wheelbase centre** is the point kept on
the path, so the whole body tracks the spline instead of just the placement origin. Bounding-box
proportions remain the fallback when no rig is bound. The Route panel reports which was used.

Debug helper: `node automotive-studio/scripts/inspect-scene-parts.mjs [glb]`.

Known remainder: length is still measured on the axis-aligned box, so a diagonal asset scales
~8% small. Roll stays slip-free regardless because the radius is measured from the same geometry.
A proper fix is baking the rig-derived yaw into the normalization root.

### Runtime axle calibration

Roll and steer are applied as `restQuaternion ⊗ axisAngle` so authored bind poses survive.
On the first driven frame Studio nudges each pivot ±0.02 rad about local X/Y/Z, watches which
one moves the top of the tire *forward*, and locks in that axis and sign. Radius comes from the
pivot's measured world bounds. This is asset-agnostic — no manifesto axis guessing, and it
survives mirrored wheel instances and nested rotations. Result shows as
"Axle calibration" in the Route panel.
