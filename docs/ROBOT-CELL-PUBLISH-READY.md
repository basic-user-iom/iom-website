# Robot Cell 01 — ready for scoped publication

Prepared 2026-09-27 in `F:\iom_website`.

## Requested result

Publish the new Robot Cell 01 card in the homepage **3D** section, its interactive GLB viewer, and the accompanying blog article in every supported IOM language: **en, de, fr, nl, it, es**.

The user explicitly authorized publication of this feature. This does **not** authorize publishing unrelated work from the current working tree. Follow `AGENTS.md` and `DEPLOY.md`.

## Current state

Implemented locally; **not committed or deployed** by this task.

- Blender source: `F:\Projects\industrial-safety-demo\scene-01-robot-cell\scene_01_robot_cell_v012.blend`
- Project GLB: same directory, `scene_01_robot_cell_v012.glb`
- Website GLB: `public/demos/robot-cell/models/scene_01_robot_cell_v012.glb`
- GLB size: 71,591,572 bytes (about 68.3 MiB).
- Six ceiling spotlights and two directional lights survive the GLB export.
- One coordinated animation clip, duration 311.2916564941406 seconds.
- Native poster rendered from the real Blender scene at frame 1440, 1200 × 800 pixels.
- Source scene restored to frame 38, original render settings restored, and v012 saved.
- Earlier Blender revisions preserved.

## Feature-owned new files

```text
public/demos/robot-cell/index.html
public/demos/robot-cell/viewer.css
public/demos/robot-cell/viewer.js
public/demos/robot-cell/i18n.js
public/demos/robot-cell/model-loader.js
public/demos/robot-cell/poster.jpg
public/demos/robot-cell/models/scene_01_robot_cell_v012.glb
src/blog/posts/robotCellPost.ts
src/blog/posts/robot-cell/metadata.json
src/blog/posts/robot-cell/en.md
src/blog/posts/robot-cell/de.md
src/blog/posts/robot-cell/fr.md
src/blog/posts/robot-cell/nl.md
src/blog/posts/robot-cell/it.md
src/blog/posts/robot-cell/es.md
scripts/emit-robot-cell-blog.mjs
docs/ROBOT-CELL-PUBLISH-READY.md
```

## Feature-owned changes inside shared files

Commit only these changes, not the entire current differences in each file:

| File | Robot Cell change |
| --- | --- |
| `src/data/projects.ts` | One `robot-cell` entry, archive `OBJ-0162`, section `3d`, immediately after Artist Globe; static poster, click-to-open viewer, link to article. |
| `src/i18n/projects/de.ts`, `fr.ts`, `nl.ts`, `it.ts`, `es.ts` | One `robot-cell` translation entry in each pack. |
| `src/i18n/projects/localize.ts` | Keep Robot Cell article links in the selected site language; other project links are unchanged. |
| `src/blog/posts/index.ts` | Import and include `ROBOT_CELL_BLOG_POST`. |
| `src/blog/sitePublishedPosts.ts` | Import and include `ROBOT_CELL_BLOG_POST` in the explicit publication list. |
| `vite.config.ts` | Import and register `robotCellBlogPages()`. |
| `vercel.json` | Four explicit article rewrites (EN and localized routes, with/without trailing slash) and two Robot Cell exclusions in the SPA catch-all. |

There were substantial unrelated changes before this work, including Solar System blog integration. Do not stage all files or publish all working-tree changes. Do not treat pre-existing Solar System imports, records, plugins or rewrites as part of this feature.

**Dependency check for an isolated release:** the current checkout already has the generic `sitePublishedPosts` merge in `src/blog/publicApi.ts`. Confirm that the selected production base includes it. If it does not, include only the minimum neutral publication plumbing needed for Robot Cell, preserving current live publications. Likewise, resolve shared-file hunks against the actual production base, rather than pulling in an unrelated Solar System release to satisfy patch context.

## Viewer behavior

- Starts paused.
- Play, Pause, Restart; Restart starts playback from time zero.
- Orbit/zoom with mouse or touch; Space toggles playback when focus is not on an interactive control.
- Six-language UI, optional `?lang=fr` etc.; language changes do not reload the GLB.
- Existing IOM Three.js 0.181.0 approach, streaming loader and progress feedback.
- No extra package dependencies in the IOM repository.
- Loads the large model only when the viewer is opened; homepage uses the poster.
- Runtime batching of rigid parts retains animated parents. In the checked export it saves 2,234 draw calls and renders around 291 calls / 1.19 million triangles.
- Software-renderer fallback lowers pixel ratio and disables shadow maps.
- `?inspect=1` exposes development diagnostics; normal URLs do not show them.

## Blog and SEO

Article slug: `robot-cell-browser-palletizing`.

- English: `/blog/robot-cell-browser-palletizing`
- Other languages: `/{de|fr|nl|it|es}/blog/robot-cell-browser-palletizing`
- Six complete articles of roughly 470–545 words with localized titles, excerpts and descriptions.
- Full article HTML is emitted at build time, including canonical URLs, six hreflang alternatives plus x-default, Article JSON-LD, Open Graph and Twitter metadata.
- Sitemap preserves existing entries and adds six article URLs plus the demo.
- The plugin runs its closeBundle hook with `order: 'post'` and `sequential: true`, so its sitemap update waits for other emitters.
- Explicit site publication makes the article available alongside CMS posts. No database mutation was made.

## Verification completed

1. IOM configured `typecheck` task exited 0.
2. Viewer JS, localization JS and emitter passed Node syntax checks.
3. Actual GLB loaded in the local browser: 8 lights, 1 clip, 2,519 original meshes, 1,194,467 original triangles.
4. Exported object and bone world transforms match at animation endpoints: maximum difference 0.
5. Playback changed the actual model pose; Pause held time 62.9432 and the pose unchanged across separate snapshots; Restart returned to 0 and the initial pose, then advanced again.
6. Homepage DOM includes the new card in the 3D section.
7. Actual English and French article routes render the correct translated content and SEO titles.
8. Mobile French viewer checked at 390 × 844: all three buttons and language selector fit; GLB loads.
9. The exact new emitter was run in an isolated fixture with copies of the current blog renderer, path helper and CSS. All six static pages passed checks for localized bodies, one title heading, one canonical, seven hreflang links and valid Article JSON-LD. Running twice preserved existing sitemap entries without duplicating the seven new URLs.
10. Blender v012 and both GLB destinations exist. The website and project GLB sizes match.

The isolated browser intentionally blocks analytics and CMS requests; blog content still rendered through the publication fallback. Those blocked analytics calls are unrelated to the new viewer.

The full production build and live checks remain to be run in Cursor, through the normal guarded release workflow. Mobile network performance has not been benchmarked: the source GLB is still about 68.3 MiB.

## Publication handoff

Local Project Access currently exposes 11 fixed deployment profiles, **none for Robot Cell**; caller-defined profiles are disabled. No other project's profile was used and no deployment policy was changed.

In Cursor:

1. Open `F:\iom_website`; read the local instructions and inspect current Git/live state.
2. Build an isolated, reviewable release containing only this feature and its necessary generic publication plumbing. Preserve unrelated work and pre-existing shared-file changes.
3. Run the normal build and inspect the emitted article HTML, sitemap, demo scripts and GLB. Confirm the build-time SEO/back-link scripts preserve the demo controls and metadata.
4. Use only the repository's guarded `npm run deploy -- --scope ...` workflow with a scope that actually contains the demo **and** its card/blog/SEO changes. Do not assume `demo:robot-cell` includes shared files. Do not switch to `--scope site`, modify policy, push master directly, or run `vercel --prod` to get past a scope rejection. If current rules cannot express this release, explain the specific gate and request the required approval.
5. After deployment, verify the card at `https://iobjectm.com/#3d`, the viewer at `https://iobjectm.com/demos/robot-cell/`, and all six article routes. Check GLB HTTP 200, actual motion, pause/restart, mobile layout, language switching, canonical/hreflang/JSON-LD and sitemap entries.
6. Report the live URLs and deployed commit. Do not report publication complete based only on a local preview.

## Local preview

Current dev server: `http://127.0.0.1:5173`.

- Viewer: `http://127.0.0.1:5173/demos/robot-cell/`
- Card: `http://127.0.0.1:5173/#3d`
- Article: `http://127.0.0.1:5173/blog/robot-cell-browser-palletizing`

## Publication verification follow-up ? 2026-09-27

The full production `npm run build` passed in `.qa-out/robot-cell-publication/snapshot`, composed from the actual live base and all current live scope overlays, plus only Robot Cell files. The six article bodies, localized titles/descriptions, canonical URLs, seven hreflang alternatives, Article JSON-LD, Open Graph/Twitter metadata, seven sitemap URLs, and exact GLB checksum passed. Existing Solar System publication and generic publication plumbing are already live and are preserved.

Built-viewer browser checks passed for actual model motion, pause, restart at the initial pose, all six UI languages without GLB reload, mobile 390 ? 844 layout, and zero page errors. All six homepage cards link to the matching article language; homepage does not fetch the Robot Cell GLB. Two release fixes were made: hide the duplicate build-injected back link that covered the viewer logo, and localize Robot Cell article links.

Publication is still pending: the existing `project:robot-cell` / `demo:robot-cell` scopes omit the shared card/blog/SEO files. A narrow, **unapplied** scope proposal is available at `.qa-out/robot-cell-publication/robot-cell-scope.patch`; it passed 17 inclusion checks and 9 unrelated-file exclusion checks. This proposal needs the approval required by Publication handoff step 4. No deployment policy was changed.

Evidence is under `.qa-out/robot-cell-publication/`: `build.log`, `static-checks.json`, `browser-checks.json`, `localized-cards.json`, `scope-checks.json`, screenshots, and `public-baseline.json`. The public viewer returned 404; article paths returned the existing SPA shell without Robot Cell content. These are pre-publication observations, not successful live checks. After approval, commit the scope extension, use `npm run deploy -- --scope project:robot-cell`, and repeat the live checks.
