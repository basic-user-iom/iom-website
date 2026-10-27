# Storm editorial publication candidate — 2026-10-27

Status: prepared locally, not pushed or published. Standalone Storm remains independent at https://storm-monolith-studio.vercel.app/.

## Isolation

- Worktree: F:\iom_website\.qa-out\release-worktrees\storm-publication
- Branch: codex/storm-publication-20261027
- Base: 859b6364e9726b612b3095c04ac98be98db1dacf
- Parent-supplied production baseline: dpl_8k5Q5W79w9rW3fFr2e9mRwbD8Vmt. Revalidate immediately before publication.
- No CRM files, standalone scene files, credentials, permission settings, CMS rows or shared deployment state changed. Existing Vercel routing/cron/header entries retain their values and formatting.
- Existing repository drafts were searched; no Storm draft was found. Uses the existing source-maintained published-blog mechanism. CMS posts retain precedence on duplicate slug; no CMS write is required.

## Prepared content and routes

- Homepage 3D card: /#storm-monolith-studio (external public studio link, static poster, no hover renderer).
- Case-study archive card: /#case-study-storm-monolith.
- Case study: /case-studies/storm-monolith-studio.
- Article: /blog/storm-monolith-atmosphere-materials.
- All marketing content and links localized for the actual SITE_LANGS: en, de, fr, nl, it, es. English has no prefix; other paths start /de, /fr, /nl, /it, /es. The standalone studio itself is not translated by this change.
- Blog source ID: site-blog-storm-monolith-studio. Six static article snapshots provide canonical URLs, language alternates and Article structured data. Case study uses the existing SPA presentation and localized metadata.

## Evidence and editorial boundaries

Copy describes the actual browser-based React/Three.js studio, monolith-centred soft cloud boundary, distance-adaptive volumetric sampling, shared reversible 1K material detail, original PBR maps, save/export and independent public deployment. It does not claim server-side cloud rendering, per-distance render-target resolution, a fictitious client, commercial outcomes, universal mobile compatibility or whole-app performance gains. English UI control names remain exact so translated instructions match the studio.

Images are real local captures: scene.webp/scene-400.webp derive from Storm docs/cloud-extent-20261026/01-supplied-startup.png (scene overview, before the optional detail layer); detail.webp derives from docs/normal-detail-scale-20261026/after.png (final finer normal pattern). Only viewport HUD margins were cropped. No new online assets used. User-confirmed rights cover the D: textures.

## Verification

- TypeScript passed: node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit --incremental false.
- Frontend and static article build passed with the existing Vite plugins. Reproduce: node scripts/build-storm-editorial-preview.mjs.
- node scripts/test-storm-publication.mjs passed: six locale sets, translated case/article/card links, unique card IDs, no hover renderer, CMS deduplication, static canonical/hreflang/JSON-LD, rewrite ordering, image bytes and article sitemap URLs.
- git diff --check passed.
- Full multi-demo production build was not run: this intentionally sparse worktree lacks unrelated demo assets. The first ordinary Vite attempt stopped on missing /demos/dukta/website/assets/index-FFxvBcFT.js. The focused build excludes those unrelated entrypoints and must not itself be used as a complete site deployment package.
- Existing node-unrar browser externalization, dynamic-import and large-chunk warnings appeared in the successful build; no Storm type/build error remains.
- Visual layout review is pending. Hidden in-app browser is unavailable. Only foreground Chrome is available, so coordination was requested before disturbing the user's current tab. No browser claim is made from source/HTTP checks.
- Local preview started at http://127.0.0.1:4186/; use /case-studies/storm-monolith-studio and /fr/blog/storm-monolith-atmosphere-materials. It contains the candidate and sparse unrelated assets, not the full production site.

## Coordinated publication steps — parent owns scheduling

1. Finish desktop/mobile browser layout review without disturbing user activity. Check EN and one longer translation, all six language switches, case stages and live studio links.
2. Review STORM-PUBLICATION-SCOPE.json. The exact 29-path storm-publication registration is prepared in this application candidate and the separate storm-scope-registration tooling worktree. Current shared tooling remains at 99b200ebcdeb6b1ff166ae3ec8b40558b141a912; review the new candidate pin before using it. The tooling candidate adds only this registration to scripts/deploy-scope.mjs. Do not silently use --scope site or merge unrelated tooling history.
3. Coordinate against other active releases. Revalidate production ID/provenance and preserve all 22 existing scope entries plus CRM plugin and optimized email-store bytes. Reconcile shared-file patches if production advanced; do not wholesale overwrite a newer shared file.
4. Use the supported read-only external preflight from ISOLATION.md, with the reviewed tool pin, this candidate target and exact current production baseline. Run the normal scanner/R2/build/provenance gates on the composed snapshot.
5. Only after parent coordinates publication, use npm run deploy -- --scope storm-publication from the approved project checkout with the reviewed scope available. No direct Vercel command or manual push. Do not deploy the sparse preview dist.
6. Verify homepage card, case study and article in all six locales, assets, canonical/hreflang, independent studio URL and unchanged CRM/plugin routes on production. Record resulting deployment ID and commit.

No publication attempted. Release scope registration review/integration and browser layout review remain pending; neither is an access denial. User is recording a WDA walkthrough: do not take Chrome focus, mouse or keyboard until coordinated availability.
