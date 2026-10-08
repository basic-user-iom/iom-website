import fs from'node:fs';import assert from'node:assert/strict';import crypto from'node:crypto';
const dir='../../evidence/escalators-v11.2';for(const name of ['staged-v11-tests','activated-v11-tests','native-rendered-tests','registry-preservation','visual-review'])assert.equal(JSON.parse(fs.readFileSync(dir+'/'+name+'.json')).passed,true,name);
const reg=JSON.parse(fs.readFileSync(dir+'/teleport-fast.json'));assert.equal(reg.results.length,5);assert.deepEqual(reg.errors,[]);assert.ok(reg.results.every(r=>r.rounds.every(x=>x.returned&&x.arrivalError<.015&&x.heldDrift<.005&&x.grounded)));
const files=['controls/stairTeleportSurvey.ts','ReviewLocations.ts','main.ts'].map(f=>({file:'site/building-viewer/src/'+f,beforeSha256:crypto.createHash('sha256').update(fs.readFileSync(dir+'/source-before/'+f.split('/').at(-1))).digest('hex'),sha256:crypto.createHash('sha256').update(fs.readFileSync('src/'+f)).digest('hex')}));fs.writeFileSync(dir+'/changed-files.json',JSON.stringify(files,null,2));
const summary=`ICM viewer v11.2 — escalator teleports — 2026-10-08

Local preview: http://127.0.0.1:5204/
Built preview: http://127.0.0.1:5204/demos/icm-building/index.html
Runtime source: viewer-integration-20261004/site/building-viewer
Use OPEN-ICM-LOCAL.ps1 for the dedicated hardware-accelerated Chrome profile.
UI: Location > Teleport: foyer escalators; place the character to enter Walk mode.

Implemented:
Two reciprocal routes added to the RT_Seiten escalators beside TR_Stufen_002 (foyer east).
UP circles on the ground floor, DOWN circles on the first-floor landing.
North: bottom [-78.4,0,-31.4], top [-60.9,6.000002384185791,-31.4].
South: bottom [-78.4,0,-26.7], top [-60.9,6.000002384185791,-26.7].
Both radii 0.6 m. Coordinates are feet, world metres, Y-up.
Existing fade/beam/particles, input reset, instantaneous capsule transfer and re-entry gate reused unchanged.
74 bidirectional routes / 148 portals now; all 72 previous route records preserved exactly, including E276/E277.
Interior/exterior name/material inventory found this one RT escalator pair; the long Laufband floors were not treated as stairs.
No model, collision GLB, Blender source, original project or production deployment changed.

Runtime files changed:
site/building-viewer/src/controls/stairTeleportSurvey.ts — append two routes.
site/building-viewer/src/ReviewLocations.ts — add escalator review location.
site/building-viewer/src/main.ts — v11.2 label.
Build refreshed under site/public/demos/icm-building. QA scripts and evidence are separate support files.

Validation:
npm run build passed, including required diagnostics, TypeScript and Vite (existing large chunk warning).
52 live landing probes matched visual floors and upward collision normals; standing capsule valid.
Staged and activated actual viewer tests: north up/down and south up/down, 4/4 passed.
Each tested 1.2 m entry, reset velocity/grounding, 2 s standing, 1 m exit, no floor animation movement or capsule interpolation.
Native rendered browser keyboard tests: 4 directions plus return = 8 transfers, 2.15+ s standing, zero drift, exits >1 m.
Five existing routes, including the adjacent central wooden stair: 20 regression transfers passed.
All 148 portals ready. New trigger circles do not overlap existing triggers or hysteresis margins.
Visual review confirmed three separate circles at each end and the existing transporter fade.
Evidence: evidence/escalators-v11.2 (JSON, screenshots, logs and source-before snapshots).

Unchanged limitations:
E276/E277 physical stair connection remains obstructed; use their verified floor teleports.
Previously noted 21 grass support samples remain a separate task; no new claim of resolving them.
1 FPS follow-up: evidence/perf-20261008/RESULTS.txt documents the original Chrome software renderer and the dedicated RTX 3090 preview. Browser profile/driver settings were not changed globally.
`;
fs.writeFileSync('../../ESCALATORS-v11.2-RESULTS.txt',summary);fs.writeFileSync('../../NASTAVAK-v11.2.txt',summary);
fs.mkdirSync(dir+'/authoring',{recursive:true});for(const name of ['prepare-escalators-v11.2.mjs','activate-escalators-v11.2.mjs'])fs.renameSync('scripts/'+name,dir+'/authoring/'+name);
console.log('Saved v11.2 handoff and three-file source manifest');
