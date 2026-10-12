# Stradivari Amantes S3 — CRM demo

CRM integration of `F:\Projects\iom-stradivari-demo\web`, using its verified v05 PBR GLB and Monochrome Studio 02 HDR. The original local project and Blender sources stay intact.

Build from the IOM repository root:

```powershell
node scripts/build-stradivari-amantes-s3.mjs
```

Uses the repository's installed Vite, TypeScript and Three.js tools. The script verifies the model and HDR hashes, typechecks, and writes only `public/demos/stradivari-amantes-s3/`. Commit this source folder and that output together.

Route: `/demos/stradivari-amantes-s3/`. CRM Demo lists the entry with Preview and Expand; iframe loading needs no password or special authentication. The link is unlisted and marked noindex, not access-controlled. NL/EN, three phases, cutaway hotspots and the 2-second schematic animation are retained.

The GLB contains the v05 PBR textures; model geometry and animation are unchanged. HDR parameters: `src/environment.ts` (linear PMREM, intensity 0.65, rotation 270 degrees). Source attribution and checksums: `research/hdri-monochrome-studio-02.json` and `research/pbr-sources.json`. Poly Haven Monochrome Studio 02 and ambientCG Paper001 / Metal050A use CC0.

Publish only this completed integration with the repository's guarded command:

```powershell
npm run deploy -- --scope project:stradivari-amantes-s3
```

The release includes the CRM registry entry and indexing/build exclusions needed for this demo. It excludes unrelated workspace edits. It is not a public project card or blog release.

Browser integration check: `node scripts/verify-stradivari-crm.mjs`. It renders the real CRM Demo component in a local fixture, checks Preview/Expand, and verifies the built iframe and direct mobile route. No client data or CRM login is used. Evidence stays in `.qa-out/stradivari-crm/`.
