# Automotive Studio — Phase 0 lock

**Status:** Locked with A–F (3 August 2026)  
**Route:** `/demos/automotive-studio/`  
**Volume Lighting:** unchanged at `/demos/volume-lighting/`

## Access (decision A)

- v1 presentations are **access-controlled or local-only**.
- Unlisted static URL is **not** accepted as security.
- Interim mechanism until edge auth exists:
  1. Local Studio/Preview via `npm run build:automotive-studio` + Vite/static serve.
  2. Controlled preview: deploy only behind explicit gate / non-public path when owner requests.
  3. Production publish later requires real server/edge authorization (not client-side codes).

## Asset rights (decision B)

- Lixiang GLB is **prototype / internal only**.
- No public project card, sitemap listing, or client pitch branding until written clearance.
- Prefer OEM-cleared or neutral vehicle for any external deliverable.

## Priority (decision C)

- **Desktop-first** for client meetings.
- Mobile Presentation supported; equal polish is not a Phase 1–7 launch gate.

## Art direction (decision D)

- Default: **dark premium Studio** — charcoal stage, controlled speculars, restrained accent (warm metal, not purple glow).
- Later optional: bright architectural Studio preset after IBL/paint validation.
- Environment modes remain: Studio, Day, Golden Hour, Night (implementation from Phase 5).

## Wheel repair (decision E)

- One-time offline rear-wheel split/re-rig approved.
- Source GLB never overwritten (Phase 3).

## Client deliverable (decision F)

- Clients receive **hosted Presentation revision only**.
- `.iomcar` / Master / extractable GLBs stay IOM-internal unless separately licensed.

## Reference devices / browsers (preliminary)

| Role | Target |
|---|---|
| Primary desktop | Windows 11 — Chrome + Edge (WebGPU) |
| Fallback desktop | Same machine — forced WebGL2 |
| Secondary desktop | macOS — Safari + Chrome |
| Mobile smoke | Named iPhone Safari + Android Chrome (devices TBD at first mobile pass) |
| Optional | Firefox/WebGL2 as declared fallback or reduced poster |

Performance budgets in the main plan (§24) apply after warm-up on these targets. Exact device model names for mobile are filled when Phase 3 Mobile variant is profiled.

## Renderer spike notes (Phase 0 / 1)

- Capability detection selects backend; it is **not** visual parity proof.
- Phase 1 initializes WebGPU with intentional WebGL2 fallback path and reports backend in Diagnostics.
- Paint, transmission, shadows, KTX2, volumetrics, and post-process parity are measured in later phases against both backends.
- Unsupported effects degrade as one coherent quality tier; poster/video fallback remains available for non-3D.

## First-release scope (foundation)

Phase 0+1 only: shells, schema, Transport, renderer init — **no** production vehicle import, optimization, or wheel surgery until foundation review.
