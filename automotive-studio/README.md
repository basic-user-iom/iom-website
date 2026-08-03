# Automotive Studio (source)

Phase 1 foundation for `/demos/automotive-studio/`.

## Commands

```bash
cd automotive-studio
npm install
npm run dev          # http://localhost:5190/
npm run test:schema
npm run build        # writes to ../public/demos/automotive-studio/
```

From repo root:

```bash
npm run build:automotive-studio
```

## Entries

| File | Role |
|---|---|
| `index.html` | Studio authoring shell |
| `presentation.html` | Client presentation shell (no authoring chrome) |

Force WebGL2: `?forceWebGL2=1`

## Pins

- `three@0.181.2` (exact). Volumetric/TSL parity with Volume Lighting may require a later dedicated bump — do not change site-wide Three implicitly.

## Out of scope until foundation review

- Vehicle GLB import
- Optimization pipeline
- Wheel re-rig
- Public project listing / `projects.ts`
